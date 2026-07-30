import { useState, useRef, useCallback, useEffect } from 'react';
import { getMicrophoneDeniedMessage } from '../lib/microphoneHelp';
import { examApi } from '../services/api';

// Module-level stream cache so ExamSetupModal can pre-warm mic permission
// before the hook mounts, avoiding a second permission prompt on iOS.
let _sharedStream: MediaStream | null = null;

// Optimised audio constraints for speech recording across all platforms.
const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
};

const MAX_STT_AUDIO_BYTES = 25 * 1024 * 1024;

export function prewarmMicPermission(): Promise<void> {
  if (_sharedStream && _sharedStream.active) return Promise.resolve();
  if (!navigator.mediaDevices?.getUserMedia) return Promise.resolve();
  // On Safari/iOS: skip prewarm entirely. Keeping a mic stream alive causes
  // iOS audio ducking (TTS volume drops), and stopping it immediately confuses
  // the iOS audio session so TTS won't play at all. The first PTT press
  // triggers getUserMedia with a user gesture — no separate prewarm needed.
  const isSafariOrIOS = /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium|Edg/i.test(navigator.userAgent);
  if (isSafariOrIOS) return Promise.resolve();
  return navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS)
    .then(stream => { _sharedStream = stream; })
    .catch(() => {});
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function useSpeechToText(subject?: string) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAcquiringMic, setIsAcquiringMic] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Shown briefly when recording was too short for transcription.
  const [tooShort, setTooShort] = useState(false);
  // Shown briefly when transcription returned empty (speech not understood).
  const [notUnderstood, setNotUnderstood] = useState(false);
  // Audio level feedback: 'ok' = normal, 'low' = too quiet, 'silent' = no signal
  const [audioLevel, setAudioLevel] = useState<'ok' | 'low' | 'silent'>('ok');
  const lowLevelSinceRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onReadyRef = useRef<((text?: string) => void) | null>(null);
  const transcriptRef = useRef('');
  const finalTranscriptRef = useRef('');
  const isStartingRef = useRef(false);
  const recordingStartRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);

  // Persistent cached stream — acquired once, reused between recordings on iOS
  // so the permission prompt only appears the first time.
  const cachedStreamRef = useRef<MediaStream | null>(null);
  // Cache the detected MIME type so we only detect it once.
  const mimeTypeRef = useRef<string | null>(null);

  // iOS Safari supports webkitSpeechRecognition on HTTPS (Safari 14.5+).
  // We try it first and fall back to MediaRecorder if service-not-allowed fires
  // (e.g. in WKWebView or older iOS versions).
  const isSpeechAPIAvailable = !!(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );

  // Always use MediaRecorder + /api/transcribe (OpenAI Whisper primary, Gemini fallback) instead of
  // webkitSpeechRecognition. Reasons:
  // - Much better German transcription quality
  // - Consistent behavior across all browsers and platforms
  // - webkitSpeechRecognition on iOS fires empty transcripts without errors
  // - Cost is negligible (~0.2 Cent per exam session)
  const forceMediaRecorderRef = useRef(true);

  // Pre-warm microphone permission and cache the stream.
  // Call this from ExamSetupModal (or anywhere) before the user presses record
  // so that iOS does not show a permission prompt mid-interaction.
  const initMicStream = useCallback(async (): Promise<void> => {
    if (cachedStreamRef.current) return; // already have a live stream
    // Pick up the module-level pre-warmed stream if available.
    if (_sharedStream && _sharedStream.active) {
      cachedStreamRef.current = _sharedStream;
      _sharedStream = null;
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      cachedStreamRef.current = stream;

      // Detect and cache MIME type once
      if (mimeTypeRef.current === null) {
        mimeTypeRef.current = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : MediaRecorder.isTypeSupported('audio/mp4')
              ? 'audio/mp4'
              : '';
      }
    } catch {
      // Permission denied — will surface error when user actually tries to record
    }
  }, []);

  // Start monitoring audio level from a MediaStream using AnalyserNode.
  const startAudioLevelMonitor = useCallback((stream: MediaStream) => {
    try {
      const ctx = audioContextRef.current || new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      levelIntervalRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(dataArray);
        // Calculate RMS level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        // Raised thresholds — only flag genuinely problematic levels.
        // Debounce: only switch to low/silent after 2s of sustained low signal.
        if (rms < 0.002) {
          if (lowLevelSinceRef.current === null) lowLevelSinceRef.current = Date.now();
          else if (Date.now() - lowLevelSinceRef.current > 2000) setAudioLevel('silent');
        } else if (rms < 0.01) {
          if (lowLevelSinceRef.current === null) lowLevelSinceRef.current = Date.now();
          else if (Date.now() - lowLevelSinceRef.current > 2000) setAudioLevel('low');
        } else {
          lowLevelSinceRef.current = null;
          setAudioLevel('ok');
        }
      }, 250);
    } catch {
      // AudioContext not supported — skip monitoring
    }
  }, []);

  const stopAudioLevelMonitor = useCallback(() => {
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    analyserRef.current = null;
    lowLevelSinceRef.current = null;
    setAudioLevel('ok');
  }, []);

  const stopListening = useCallback((onReady?: (text?: string) => void) => {
    if (recognitionRef.current) {
      onReadyRef.current = onReady || null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      onReadyRef.current = onReady || null;
      mediaRecorderRef.current.stop();
    } else {
      // getUserMedia / initMicStream may still be in flight — set flag so recording
      // is discarded immediately when the stream resolves.
      stopRequestedRef.current = true;
      onReadyRef.current = onReady || null;
      if (!onReady) setTimeout(() => { onReadyRef.current = null; }, 200);
    }
    stopAudioLevelMonitor();
    setIsListening(false);
  }, [stopAudioLevelMonitor]);

  const startListening = useCallback(() => {
    // ── MediaRecorder fallback (iOS without native STT, Firefox, etc.) ──────
    const startWithMediaRecorder = () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Mikrofon nicht verfügbar. HTTPS erforderlich.');
        return;
      }

      stopRequestedRef.current = false;

      const startRecording = (stream: MediaStream) => {
        // User already released the button before the stream was ready — discard immediately.
        // Do NOT stop the cached stream; it will be reused on the next call.
        if (stopRequestedRef.current) {
          stopRequestedRef.current = false;
          const cb = onReadyRef.current;
          onReadyRef.current = null;
          if (cb) setTimeout(() => cb(undefined), 0);
          return;
        }

        chunksRef.current = [];

        // Use cached MIME type if already detected, otherwise detect now.
        if (mimeTypeRef.current === null) {
          mimeTypeRef.current = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
              ? 'audio/webm'
              : MediaRecorder.isTypeSupported('audio/mp4')
                ? 'audio/mp4'
                : '';
        }
        const mimeType = mimeTypeRef.current;

        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          stopAudioLevelMonitor();
          if (unmountedRef.current) {
            chunksRef.current = [];
            mediaRecorderRef.current = null;
            return;
          }
          const duration = Date.now() - recordingStartRef.current;
          const actualMimeType = recorder.mimeType || 'audio/mp4';
          const blob = new Blob(chunksRef.current, { type: actualMimeType });
          mediaRecorderRef.current = null;

          // Recording too short — skip transcription.
          // 600ms minimum: iOS needs ~200ms mic warm-up after fresh getUserMedia.
          if (blob.size < 1000 || duration < 600) {
            const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium|Edg/i.test(navigator.userAgent);
            if (isSafari && cachedStreamRef.current) {
              cachedStreamRef.current.getTracks().forEach(t => t.stop());
              cachedStreamRef.current = null;
            }
            setIsTranscribing(false);
            setTooShort(true);
            setTimeout(() => setTooShort(false), 1500);
            const cb = onReadyRef.current;
            onReadyRef.current = null;
            if (cb) setTimeout(() => cb(undefined), 100);
            return;
          }

          if (blob.size > MAX_STT_AUDIO_BYTES) {
            const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium|Edg/i.test(navigator.userAgent);
            if (isSafari && cachedStreamRef.current) {
              cachedStreamRef.current.getTracks().forEach(t => t.stop());
              cachedStreamRef.current = null;
            }
            setError('Audio-Aufnahme zu lang. Bitte antworte etwas kürzer oder sende die Antwort in zwei Teilen.');
            const cb = onReadyRef.current;
            onReadyRef.current = null;
            if (cb) setTimeout(() => cb(undefined), 100);
            return;
          }

          setIsTranscribing(true);
          let resultText = '';

          try {
            // The recording is sent straight to the local server as base64 —
            // it never leaves the machine except to the transcription provider.
            const arrayBuffer = await blob.arrayBuffer();
            resultText = await examApi.transcribe(
              arrayBufferToBase64(arrayBuffer),
              actualMimeType,
              subject,
            );

            if (resultText) {
              transcriptRef.current = resultText;
              setTranscript(resultText);
            } else {
              // Nothing recognisable — nudge the user instead of failing silently.
              setNotUnderstood(true);
              setTimeout(() => setNotUnderstood(false), 2000);
            }
          } catch (err: any) {
            setError(
              err?.name === 'AbortError'
                ? 'Zeitüberschreitung bei der Transkription.'
                : err?.message || 'Transkription fehlgeschlagen.',
            );
          } finally {
            setIsTranscribing(false);
            const cb = onReadyRef.current;
            onReadyRef.current = null;
            if (cb) setTimeout(() => cb(resultText || undefined), 100);
          }
        };

        // iOS Safari has issues with timesliced recording — omit timeslice on
        // Safari/iOS so data is collected in a single chunk on stop().
        const isSafariOrIOS = /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium|Edg/i.test(navigator.userAgent);
        if (isSafariOrIOS) {
          recorder.start();
        } else {
          recorder.start(100);
        }
        recordingStartRef.current = Date.now();
        startAudioLevelMonitor(stream);
        setIsListening(true);
        setError(null);
        setTranscript('');
        transcriptRef.current = '';
      };

      // Check if a stream is truly usable: active AND at least one audio track is live.
      const isStreamAlive = (s: MediaStream | null): s is MediaStream => {
        if (!s || !s.active) return false;
        const tracks = s.getAudioTracks();
        return tracks.length > 0 && tracks.every(t => t.readyState === 'live');
      };

      // iOS Safari: MediaRecorder consumes the stream — after stop() the tracks
      // appear "live" but produce no data on the next recording. Always acquire
      // a fresh stream on iOS/Safari. Permission was already granted so
      // getUserMedia resolves instantly without a prompt.
      const isSafariOrIOS = /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium|Edg/i.test(navigator.userAgent);

      if (isSafariOrIOS) {
        // Always fresh stream on Safari/iOS — no reuse.
        if (cachedStreamRef.current) {
          cachedStreamRef.current.getTracks().forEach(t => t.stop());
          cachedStreamRef.current = null;
        }
        _sharedStream = null;
        setIsAcquiringMic(true);
        navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS)
          .then(stream => {
            cachedStreamRef.current = stream;
            setIsAcquiringMic(false);
            startRecording(stream);
          })
          .catch(() => {
            setIsAcquiringMic(false);
            setError(getMicrophoneDeniedMessage());
          });
      } else {
        // Non-Safari: reuse cached stream when possible.
        if (!cachedStreamRef.current && _sharedStream && isStreamAlive(_sharedStream)) {
          cachedStreamRef.current = _sharedStream;
          _sharedStream = null;
        }

        if (isStreamAlive(cachedStreamRef.current)) {
          startRecording(cachedStreamRef.current);
        } else {
          if (cachedStreamRef.current) {
            (cachedStreamRef.current as MediaStream).getTracks().forEach((t: MediaStreamTrack) => t.stop());
          }
          cachedStreamRef.current = null;
          _sharedStream = null;
          setIsAcquiringMic(true);
          navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS)
            .then(stream => {
              cachedStreamRef.current = stream;
              setIsAcquiringMic(false);
              startRecording(stream);
            })
            .catch(() => {
              setIsAcquiringMic(false);
              setError(getMicrophoneDeniedMessage());
            });
        }
      }
    }; // end startWithMediaRecorder

    // ── Native Web Speech API (desktop + iOS Safari 14.5+ on HTTPS) ─────────
    if (isSpeechAPIAvailable && !forceMediaRecorderRef.current) {
      if (isStartingRef.current || recognitionRef.current) return;
      isStartingRef.current = true;

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      // Safari (iOS + macOS) doesn't reliably support continuous mode.
      const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium|Edg/i.test(navigator.userAgent);

      const recognition = new SpeechRecognition();
      recognition.lang = 'de-DE';
      recognition.interimResults = !isSafari;
      recognition.continuous = !isSafari;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        isStartingRef.current = false;
        setIsListening(true);
        setError(null);
        setTranscript('');
        transcriptRef.current = '';
        finalTranscriptRef.current = '';
      };

      recognition.onresult = (event: any) => {
        let newFinal = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            newFinal += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (newFinal) {
          finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + newFinal.trim();
        }
        const text = finalTranscriptRef.current + (interim ? (finalTranscriptRef.current ? ' ' : '') + interim : '');
        transcriptRef.current = text;
        setTranscript(text);
      };

      const silentErrors = new Set(['no-speech', 'audio-capture', 'network', 'aborted']);

      recognition.onerror = (event: any) => {
        isStartingRef.current = false;
        recognitionRef.current = null;
        setIsListening(false);

        if (event.error === 'service-not-allowed') {
          // Native recognition not available (e.g. WKWebView, older iOS) — fall back to
          // MediaRecorder permanently for this session.
          forceMediaRecorderRef.current = true;
          startWithMediaRecorder();
          return;
        }

        if (!silentErrors.has(event.error)) {
          setError(event.error === 'not-allowed'
            ? getMicrophoneDeniedMessage()
            : event.error);
        }
        const cb = onReadyRef.current;
        onReadyRef.current = null;
        if (cb) setTimeout(() => cb(transcriptRef.current || undefined), 100);
      };

      recognition.onend = () => {
        isStartingRef.current = false;
        setIsListening(false);
        recognitionRef.current = null;
        const cb = onReadyRef.current;
        onReadyRef.current = null;
        if (cb) setTimeout(() => cb(transcriptRef.current || undefined), 100);
      };

      recognition.start();
    } else {
      startWithMediaRecorder();
    }
  }, [isSpeechAPIAvailable, startAudioLevelMonitor, stopAudioLevelMonitor, subject]);

  // Re-acquire microphone stream when returning from background (iOS kills streams
  // after a few minutes of tab-switch / Safari background).
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const s = cachedStreamRef.current;
      const dead = !s || !s.active || s.getAudioTracks().some(t => t.readyState !== 'live');
      if (dead) {
        if (s) s.getTracks().forEach(t => t.stop());
        cachedStreamRef.current = null;
        initMicStream();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [initMicStream]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      // Abort any in-progress speech recognition.
      recognitionRef.current?.abort();
      recognitionRef.current = null;

      // Stop any active MediaRecorder (without waiting for transcription).
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();

      // Clean up audio level monitor.
      if (levelIntervalRef.current) clearInterval(levelIntervalRef.current);
      if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();

      // Release the cached microphone stream on unmount.
      // This is the ONLY place tracks are stopped so iOS keeps permission across recordings.
      if (cachedStreamRef.current) {
        cachedStreamRef.current.getTracks().forEach(t => t.stop());
        cachedStreamRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    isTranscribing,
    isAcquiringMic,
    isSpeechAPIAvailable,
    transcript,
    error,
    tooShort,
    notUnderstood,
    audioLevel,
    startListening,
    stopListening,
    setTranscript,
    initMicStream,
  };
}
