import { useState, useCallback, useRef, useEffect } from 'react';
import { examApi } from '../services/api';

export function useTextToSpeech(voice?: string, onEnd?: () => void) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  // true while the TTS fetch is in-flight (audio not yet ready to play)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndRef = useRef(onEnd);
  const abortRef = useRef<AbortController | null>(null);
  const continuationAbortRef = useRef<AbortController | null>(null);

  // Index-based chunk map for out-of-order delivery (server sends chunks as soon as ready)
  const pendingChunksRef = useRef<Map<number, string>>(new Map());
  const nextPlayIndexRef = useRef(0);
  // Set when playNext() finds the next chunk isn't available yet
  const waitingForChunkRef = useRef(false);
  const isPlayingRef = useRef(false);
  const streamDoneRef = useRef(false);
  // Incremented on every stop() — continuation callbacks check this to detect cancellation
  const sessionRef = useRef(0);

  // Tracks chunk count from first TTS stream — used as index offset for continuation stream
  const firstStreamChunkCountRef = useRef(0);
  // Continuation callback: returns remaining text to TTS after first stream completes
  const pendingContinuationRef = useRef<(() => Promise<string | null>) | null>(null);

  // Audio element pool (2 elements for ping-pong buffering — avoids repeated allocation)
  const audioPoolRef = useRef<HTMLAudioElement[]>([new Audio(), new Audio()]);
  const poolIndexRef = useRef(0);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  // Cleanup pool on unmount
  useEffect(() => {
    return () => {
      audioPoolRef.current.forEach(a => { a.pause(); a.src = ''; });
    };
  }, []);

  // Called when all TTS streams are done (no continuation pending)
  const finishStream = useCallback(() => {
    streamDoneRef.current = true;
    setIsLoadingAudio(false);
    if (waitingForChunkRef.current && pendingChunksRef.current.size === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      onEndRef.current?.();
    } else if (!isPlayingRef.current && pendingChunksRef.current.size === 0) {
      setIsSpeaking(false);
      onEndRef.current?.();
    }
  }, []);

  // Fires a second TTS stream for remaining text, offsetting chunk indices
  const fireContinuationTTS = useCallback((text: string, offset: number) => {
    const ctrl = examApi.textToSpeechStream(
      text,
      (url: string, index: number) => {
        const offsetIndex = offset + index;
        pendingChunksRef.current.set(offsetIndex, url);
        if (waitingForChunkRef.current && offsetIndex === nextPlayIndexRef.current) {
          waitingForChunkRef.current = false;
          playNext();
        }
      },
      () => finishStream(),
      () => finishStream(),
      voice,
    );
    continuationAbortRef.current = ctrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, finishStream]);

  // Plays the next audio chunk in index order, chaining via onended
  const playNext = useCallback(() => {
    const index = nextPlayIndexRef.current;
    const url = pendingChunksRef.current.get(index);

    if (!url) {
      if (streamDoneRef.current && pendingChunksRef.current.size === 0) {
        isPlayingRef.current = false;
        setIsSpeaking(false);
        onEndRef.current?.();
      } else {
        waitingForChunkRef.current = true;
      }
      return;
    }

    waitingForChunkRef.current = false;
    pendingChunksRef.current.delete(index);
    nextPlayIndexRef.current = index + 1;

    // Reuse pooled audio element
    const poolIdx = poolIndexRef.current % audioPoolRef.current.length;
    poolIndexRef.current++;
    const audio = audioPoolRef.current[poolIdx];
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    audioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (audioRef.current === audio) audioRef.current = null;
      playNext();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (audioRef.current === audio) audioRef.current = null;
      playNext();
    };
    audio.src = url;
    audio.volume = 1.0;  // Ensure consistent volume across pool elements (iOS)
    audio.load();        // Required on iOS when changing src on a reused element
    audio.play().catch(() => {
      URL.revokeObjectURL(url);
      if (audioRef.current === audio) audioRef.current = null;
      playNext();
    });
  }, []);

  const stop = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    if (continuationAbortRef.current) { continuationAbortRef.current.abort(); continuationAbortRef.current = null; }
    audioPoolRef.current.forEach(a => { a.pause(); a.onended = null; a.onerror = null; a.src = ''; });
    audioRef.current = null;
    for (const url of pendingChunksRef.current.values()) URL.revokeObjectURL(url);
    pendingChunksRef.current = new Map();
    nextPlayIndexRef.current = 0;
    waitingForChunkRef.current = false;
    poolIndexRef.current = 0;
    firstStreamChunkCountRef.current = 0;
    pendingContinuationRef.current = null;
    isPlayingRef.current = false;
    streamDoneRef.current = false;
    sessionRef.current++;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsLoadingAudio(false);
  }, []);

  /**
   * Core speak function. Pass `getContinuation` to enable progressive TTS:
   * when the first TTS stream finishes, getContinuation() is awaited for
   * remaining text which is synthesised and appended to the playback queue.
   */
  const speak = useCallback(async (text: string, getContinuation?: () => Promise<string | null>) => {
    if (!enabled) return;

    stop();

    // Set continuation AFTER stop() clears the ref
    pendingContinuationRef.current = getContinuation || null;
    pendingChunksRef.current = new Map();
    nextPlayIndexRef.current = 0;
    waitingForChunkRef.current = false;
    poolIndexRef.current = 0;
    firstStreamChunkCountRef.current = 0;
    isPlayingRef.current = false;
    streamDoneRef.current = false;
    setIsLoadingAudio(true);
    setIsSpeaking(false);

    const thisSession = sessionRef.current;
    let localChunkCount = 0;

    const controller = examApi.textToSpeechStream(
      text,
      (url: string, index: number) => {
        if (sessionRef.current !== thisSession) {
          URL.revokeObjectURL(url);
          return;
        }
        localChunkCount++;
        pendingChunksRef.current.set(index, url);
        if (!isPlayingRef.current && pendingChunksRef.current.has(0)) {
          isPlayingRef.current = true;
          setIsLoadingAudio(false);
          setIsSpeaking(true);
          playNext();
        } else if (waitingForChunkRef.current && index === nextPlayIndexRef.current) {
          waitingForChunkRef.current = false;
          playNext();
        }
      },
      () => {
        if (sessionRef.current !== thisSession) return;
        // First TTS stream done — check for continuation
        firstStreamChunkCountRef.current = localChunkCount;
        const getCont = pendingContinuationRef.current;
        if (getCont) {
          pendingContinuationRef.current = null;
          getCont().then(remainingText => {
            if (sessionRef.current !== thisSession) return;
            if (remainingText?.trim()) {
              fireContinuationTTS(remainingText.trim(), localChunkCount);
            } else {
              finishStream();
            }
          }).catch(() => { if (sessionRef.current === thisSession) finishStream(); });
        } else {
          finishStream();
        }
      },
      // onError — stream failed entirely, fall back to single-shot TTS
      async () => {
        if (sessionRef.current !== thisSession) return;
        pendingContinuationRef.current = null;
        try {
          const url = await examApi.textToSpeech(text, voice);
          setIsLoadingAudio(false);
          if (!url) { onEndRef.current?.(); return; }
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); audioRef.current = null; onEndRef.current?.(); };
          audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); audioRef.current = null; };
          setIsSpeaking(true);
          await audio.play().catch(() => {
            URL.revokeObjectURL(url);
            audioRef.current = null;
            setIsSpeaking(false);
          });
        } catch {
          setIsLoadingAudio(false);
          setIsSpeaking(false);
        }
      },
      voice,
    );
    abortRef.current = controller;
  }, [enabled, stop, voice, playNext, fireContinuationTTS, finishStream]);

  /**
   * Progressive TTS: starts TTS for `firstSentence` immediately, then when
   * that stream finishes, calls `getContinuation()` to get remaining text
   * and appends it to the playback queue seamlessly.
   */
  const speakProgressive = useCallback((firstSentence: string, getContinuation: () => Promise<string | null>) => {
    if (!enabled) return;
    speak(firstSentence, getContinuation);
  }, [enabled, speak]);

  return { speak, speakProgressive, stop, isSpeaking, isLoadingAudio, enabled, setEnabled };
}
