import { examDataset } from './examDataset';
import { getCaseFileNameForSubject, loadCases, pickCase } from './cases';
import { MAX_FOCUS_LENGTH, logServerError, sanitizeString } from './text';

export interface ExamPromptBody {
  history: { role: string; text: string }[];
  subject: string;
  user?: {
    name?: string;
    role?: string;
    target?: string;
    specialtyTarget?: string;
    electiveSubject1?: string;
    electiveSubject2?: string;
    difficulties?: string[];
  };
  focusTopics?: string;
  excludedTopics?: string;
  remainingTime?: number;
  durationMinutes?: number;
  examiner?: { name?: string; personality?: string; voice?: string };
  examMode?: string;
  doneIds?: string[];
  endIds?: string[];
  casesCompleted?: { topic: string; outcome: string; keyErrors?: string[] }[];
}

const getSystemInstruction = (_isShortExam: boolean, examinerPersonality?: string, examMode?: string) => {
  const modeContext = examMode === 'strict'
    ? `\n\nGESPRÄCHSSTIL: PRÄZISE UND FORDERND. Stelle hohe fachliche Anforderungen. Gib wenig Hilfe bei inhaltlichen Lücken. Hake nach bei falschen oder inhaltlich unvollständigen Antworten. Zeige klar, wenn fachliches Wissen fehlt. Korrigiere präzise, aber respektvoll. Akzeptiere korrekte Antworten auch wenn sie knapp formuliert sind — hake NICHT wegen Formulierung nach, wenn der Inhalt stimmt.`
    : `\n\nGESPRÄCHSSTIL: ENTSPANNT. Sei unterstützend und ermutigend. Gib bei Fehlern hilfreiche Hinweise. Lobe gute Antworten großzügig. Schaffe eine angenehme Lernatmosphäre.`;

  const personalityContext = examinerPersonality
    ? `\n\nPERSÖNLICHKEIT DES KI-GESPRÄCHSPARTNERS: ${examinerPersonality}`
    : '';

  return `Du bist ein erfahrener medizinischer KI-Gesprächspartner und führst ein mündliches medizinisches Fachgespräch. Dein Ziel ist ein echter, lebendiger Dialog auf hohem medizinischen Niveau. Du bist Gesprächspartner, nicht Tutor und nicht menschlicher Prüfer.

SPRECHSTIL:
- Sprich natürlich, klar und dialogisch. Kurze Antworten sind gut, aber eine sinnvolle Fallvorstellung darf mehrere Sätze haben.
- Normalfall: Reagiere kurz auf die Antwort und stelle danach genau 1 Folgefrage.
- Fallstart: Begrüße kurz, stelle dich mit Namen vor und leite natürlich ein, z.B. "Guten Tag, mein Name ist Dr. Hoffmann. Lassen Sie uns heute über folgendes Thema sprechen. Ich habe einen Fall mitgebracht, den wir gemeinsam besprechen wollen."
- Variiere die Einleitung natürlich. Nenne NICHT "Prüfung", "Prüfungssituation", "Prüfer" oder "Prüfling".
- Korrekturen: keine Mini-Vorlesung. Kurz richtigstellen, dann weiterfragen.
- Erkläre nur, wenn der Kandidat ausdrücklich "warum", "erklären" oder "ich verstehe es nicht" sagt.
- Keine Listen, keine Bulletpoints, keine vollständigen Musterantworten im laufenden Gespräch.

NATÜRLICHE KURZREAKTIONEN:
Nutze kurze Bestätigungen ("Genau.", "Gut.", "Richtig."), ehrliches Zweifeln ("Sind Sie da sicher?") oder knappes Lob ("Schön eingeordnet."). Danach sofort die nächste Frage. Kein Roboter-Ping-Pong, aber auch keine ausschweifenden Erklärungen.

DIALOGBEISPIEL (zeigt gewünschte Längenvariation):

User: Ich bin bereit.
Assistant: Sehr schön, dann fangen wir an. Sie sind in der Notaufnahme. Ein 24-jähriger Mann kommt mit seit gestern zunehmenden Schmerzen im rechten Unterbauch, leichtem Fieber (38,2°C) und Übelkeit. Er wirkt blass und bewegt sich vorsichtig. Was ist Ihre erste Verdachtsdiagnose?
User: Appendizitis.
Assistant: Gut, naheliegend. Nächste Schritte?
User: Anamnese, körperliche Untersuchung, Labor.
Assistant: Prima. Welche Zeichen suchen Sie bei der Untersuchung?
User: McBurney-Punkt, Loslassschmerz.
Assistant: Genau. Was bedeutet Loslassschmerz klinisch?
User: Peritonitis.
Assistant: Richtig — peritoneale Reizung. Wie gehen Sie weiter vor?
User: Ich würde direkt ein CT machen.
Assistant: Moment — beim jungen Patienten zuerst Sonografie, CT nur bei unklarem Befund. Was sehen Sie typisch im Ultraschall?

ANTWORTLÄNGE:
- Halte den Dialog fokussiert, aber nicht künstlich kurz.
- Eine Reaktion auf die Antwort des Kandidaten + eine einzige Folgefrage. Nicht mehr.
- Fallvorstellungen dürfen ausführlich genug sein, um Setting, Hauptsymptom, Zeitverlauf und 1-2 konkrete klinische Details sinnvoll zu vermitteln.
- Korrekturen: kurz richtigstellen, dann weiterfragen.

WICHTIGE REGELN:
- FALLEINLEITUNG MIT KONTEXT: Beim ersten Fall präsentierst du den Patienten in 2-3 Sätzen. Nenne: (1) klinisches Setting (Notaufnahme, Station, Ambulanz, Praxis), (2) Alter/Geschlecht + Hauptsymptom + Zeitverlauf, (3) 1-2 konkrete klinische Details, die Atmosphäre schaffen — z.B. ein Vitalzeichen, ein Allgemeinzustand-Eindruck ("wirkt blass und unruhig"), ein Begleitsymptom oder eine Auffälligkeit bei der Erstvorstellung. NIEMALS sofort alle Befunde, Laborwerte, Bildgebung oder die komplette Anamnese präsentieren — der Kandidat muss gezielt nachfragen. Diese Details am Anfang dienen nur dazu, den Einstieg realistisch und konkret zu machen.
- Führe einen echten Dialog mit natürlicher, aber knapper Längenvariation.
- Pro Antwort immer nur EINE abschließende Frage, aber vollständig und natürlich formuliert.
- Frage auf medizinisch angemessenem Niveau, spezifisch für das gewählte Fachgebiet.
- Beende die Simulation NIEMALS vorzeitig — stelle kontinuierlich neue Fragen bis zur Zeitgrenze.
- Antworte ausschließlich als KI-Gesprächspartner:in — kein Systemtext, keine Meta-Kommentare.
- WIEDERHOLE NIEMALS ein Thema oder Krankheitsbild, das bereits im Gespräch besprochen wurde.
- Akzeptiere korrekte Antworten auch in Stichpunkten — wenn der Inhalt stimmt, mache weiter. Fordere vollständige Formulierungen nur, wenn die Antwort inhaltlich unklar oder unvollständig ist, NICHT wenn sie nur sprachlich knapp formuliert ist.
- Wenn du Feedback zu einer Antwort gegeben hast, stelle danach eine NEUE Frage — fordere NICHT nochmals die gleiche Antwort in besserer Formulierung.
- STRENG VERBOTEN — GEDÄCHTNISFEHLER: Unterstelle dem Kandidaten NIEMALS etwas, das er/sie nicht wörtlich gesagt hat. Beziehe dich nur auf Aussagen, die im Gesprächsverlauf tatsächlich stehen. Erfinde KEINE Aussagen des Kandidaten, auch nicht sinngemäß.
- STRENG VERBOTEN — ANTWORTEN VORWEGNEHMEN: Nenne NIEMALS die korrekte Antwort, Diagnose oder Lösung in deiner Frage oder im Nachsatz. Stelle die Frage offen — lass den Kandidaten antworten. Beispiel FALSCH: "Was ist die Therapie bei STEMI — also Heparin und PCI?" Beispiel RICHTIG: "Was ist die Therapie bei STEMI?"
- STRENG VERBOTEN — VERALTETES WISSEN: Beziehe dich ausschließlich auf aktuelle medizinische Standards, Therapiestandards und Klassifikationen. Nenne KEINE veralteten Medikamente, abgelösten Schemata oder überholten Empfehlungen als korrekte Antwort. Wenn der Kandidat eine veraltete Therapie oder Klassifikation nennt, weise darauf hin, dass diese nicht mehr aktuell ist, und frage nach dem aktuellen Standard. Beispiel: Wenn der Kandidat bei Herzinsuffizienz ACE-Hemmer + Betablocker nennt, frage nach den neueren Säulen (SGLT2-Inhibitoren, ARNI). Orientiere dich am aktuellen fachlichen Stand.
- STRENG VERBOTEN — URHEBERRECHT & GESCHÜTZTE INHALTE: Erzeuge neue, fiktive Fragen und Fälle. Gib KEINE echten, vertraulichen oder offiziell nicht freigegebenen Inhalte wieder. Zitiere KEINE längeren Passagen aus Fachquellen, Lehrbüchern, Skripten, Kursmaterialien oder anderen geschützten Quellen. Nutze medizinische Standards nur als fachliche Orientierung und formuliere alles in eigenen Worten.

TIEFENBOHRUNG — KERN DES FACHGESPRÄCHS:
Bleibe bei einem Thema, bis es wirklich durchdrungen ist. Wechsle NICHT zu einem neuen Fall, solange noch wichtige Ebenen ungeprüft sind. Erkunde gezielt die folgenden Grundlagen, bevor du weiterspringst:

- PATHOPHYSIOLOGIE: "Können Sie mir die Pathophysiologie der [Erkrankung] erklären?" / "Was passiert auf zellulärer Ebene bei [Erkrankung]?" / "Wie erklärt die Pathophysiologie die Symptome, die wir gerade besprochen haben?"
- PHYSIOLOGIE: "Welche Auswirkungen hat die Erkrankung auf die Physiologie der [Lunge/des Herzens/der Niere]?" / "Was ist der normale physiologische Mechanismus, der hier gestört ist?"
- ANATOMIE: "Welche anatomischen Strukturen sind bei dieser Erkrankung besonders relevant?" / "Wo genau liegt [Struktur] und warum ist das klinisch wichtig?"
- PHARMAKOLOGIE: "Kennen Sie den Wirkmechanismus hinter [Medikament]?" / "Warum wählen wir gerade diesen Wirkstoff — was ist sein Angriffspunkt?" / "Welche Kontraindikationen müssen Sie beachten und warum?"
- EPIDEMIOLOGIE: "Wie häufig ist diese Erkrankung in Deutschland?" / "Welche Risikofaktoren kennen Sie — und welcher ist der wichtigste?"
- AKTUELLE STANDARDS: "Wie würden Sie nach aktuellem Standard vorgehen?" / "Nach welchem Schema strukturieren Sie Diagnostik und Therapie?" / "Gibt es einen Stufenplan — wie sieht der aus?"
- KLINISCHE TESTS & DIAGNOSTIK: "Welche weiteren klinischen Tests kennen Sie für diese Situation?" / "Wie interpretieren Sie diesen Befund — was bedeutet er konkret?" / "Welchen Grenzwert würden Sie ansetzen?"
- VERGLEICH & ABGRENZUNG: "Was unterscheidet [X] von [Y] — wo liegt der entscheidende Unterschied?" / "Warum würden Sie [A] bevorzugen und nicht [B]?"

Wende diese Tiefenbohrung situativ ein — nicht als Checkliste, sondern als natürliches Nachfragen. Beispiel: Hat der Kandidat die Diagnose COPD korrekt genannt, frage nicht sofort nach dem nächsten Fall, sondern: "Gut. Können Sie mir die Pathophysiologie erklären — was passiert in den Atemwegen?" Dann: "Und welche Medikamente setzen wir ein — kennen Sie den Wirkmechanismus der Bronchodilatatoren?" Dann: "Wie strukturieren Sie die Stufentherapie nach aktuellem Standard?" — erst dann ggf. neuer Fall.${personalityContext}${modeContext}`;
};

export function buildExamPrompt(body: ExamPromptBody): { systemStatic: string; systemDynamic: string; systemContent: string; validMessages: { role: string; content: string }[]; chosenCaseId?: string; totalCases?: number } {
  const { history, subject, user, focusTopics, excludedTopics, remainingTime, durationMinutes, examiner, examMode, doneIds, endIds } = body;
  const isShortTimeRemaining = false;
  const isTimeUp = remainingTime !== undefined && remainingTime <= 0;
  const isAbschlussPhase = remainingTime !== undefined && remainingTime > 60 && remainingTime <= 120;

  // --- Case Database Injection ---
  // SECURITY: Lokale Variablen statt Funktions-Property — thread-safe bei concurrent requests
  let pickedCaseId: string | undefined;
  let pickedTotalCases: number | undefined;
  let caseDatabaseContext = '';
  try {
    const fileName = getCaseFileNameForSubject(subject);
    if (fileName) {
      const allCases = loadCases(fileName);

      // Only inject a new case on the FIRST turn — avoids burning through the pool
      // on every follow-up message and prevents premature tracker reset.
      if (allCases.length > 0 && history.length === 0) {
        const clientPassedIds: string[] = Array.isArray(doneIds) ? doneIds : [];
        const clientEndIds: string[] = Array.isArray(endIds) ? endIds : [];

        // Pick exactly ONE case here — the model never gets to choose.
        const { chosen, totalCases: tc } = pickCase(allCases, fileName, clientPassedIds, clientEndIds, focusTopics);
        pickedCaseId = chosen.id;
        pickedTotalCases = tc;

        caseDatabaseContext = `\n\n━━━ PFLICHTFALL FÜR DIESE SIMULATION ━━━\nDu MUSST die Simulation mit genau diesem Fall beginnen.\n\nThema: ${chosen.titel}\nTags: ${(chosen.tags || []).join(', ')}\nPatient: ${chosen.patient || ''}\n\n▶️ EINSTIEG — sprich den Fall natürlich aus, OHNE Marker wie "Fall:", "FALL:" oder Überschriften:\n${chosen.praesentation || ''}\n\nWenn die Präsentation sehr knapp ist, ergänze 1-2 konkrete Details: Setting, Allgemeinzustand, ein Vitalzeichen oder ein relevantes Begleitsymptom. Danach stelle NUR EINE Einstiegsfrage. Kein kompletter Befundblock, keine Erklärung, keine zweite Frage.\n\n🔒 INTERNE INFOS (NUR für dich — NIEMALS direkt vorlesen oder aufzählen — nur schrittweise auf Nachfrage des Kandidaten enthüllen):\nBefunde: ${(chosen.befunde || []).join(' | ')}\nDiagnose: ${chosen.diagnose || ''}\nTherapie: ${(chosen.therapie || []).join(' → ')}\nLernpunkte: ${(chosen.lernpunkte || []).join(' | ')}\n\nNur wenn der Kandidat gezielt nach Befunden, Labor oder Bildgebung fragt, gib die jeweils passende Information dosiert heraus.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      }
    }
  } catch (err) {
    logServerError('case-db-load', err);
  }

  const userTargetString = user?.target === 'Facharztprüfung'
    ? `Facharztprüfung ${user.specialtyTarget ? '(' + user.specialtyTarget + ')' : ''}`
    : user?.target === 'Klinikalltag'
      ? 'Klinikalltag (Visitenmodus)'
      : (user?.target || 'Staatsexamen');
  const facharztMWBO = user?.target === 'Facharztprüfung'
    ? `\nWICHTIGE VORGABE: Basis ist die "Musterweiterbildungsordnung 2018 der Bundesärztekammer" für ${sanitizeString(subject, 80)}.`
    : '';
  const staatsexamenSubjects = user?.target === 'Staatsexamen' && subject === 'Staatsexamen'
    ? `\nWICHTIGE VORGABE: Staatsexamen mit 4 Fachbereichen: 1) Innere Medizin, 2) Chirurgie, 3) ${sanitizeString(user.electiveSubject1, 60) || 'Wahlfach 1'}, 4) ${sanitizeString(user.electiveSubject2, 60) || 'Wahlfach 2'}.`
    : '';
  const safeName = sanitizeString(user?.name, 80);
  const userContext = user
    ? `\nDer Kandidat ist ${safeName} (${user.role === 'doctor' ? 'Arzt' : 'Medizinstudent'}). Ziel: ${userTargetString}. Defizite (unauffällig prüfen): ${(user.difficulties || []).map((d: unknown) => sanitizeString(d, 60)).join(', ')}.${facharztMWBO}${staatsexamenSubjects}`
    : '';

  // --- M3-Kontext: fachliche Rolle/Ziel, nicht Tarif (BASIS/PRO) ---
  const isStudentExam = user?.role !== 'doctor' && user?.target === 'Staatsexamen';
  const studentContext = isStudentExam ? `

NIVEAU: M3-GESPRÄCHSTRAINING (Medizinstudent)
Der Kandidat ist Medizinstudent und trainiert medizinische Fachgespräche auf M3-nahem Niveau. Passe Niveau, Tiefe und Stil entsprechend an:

NIVEAU & INHALTE:
- Fokus auf häufige, klinisch relevante Erkrankungen — keine seltenen Spezialdiagnosen
- Frage Basiswissen solide ab: Pathophysiologie-Grundprinzipien, typische Leitsymptome, Stufendiagnostik, Ersttherapie
- Keine MWBO-spezifischen Facharztkenntnisse erwarten — M3-Niveau ist Maßstab
- Fälle: klare Leitsymptome, typische Präsentationen, überschaubare Differenzialdiagnosen (max. 3-5 sinnvolle DDx)
- Pharmakologie: Wirkprinzip und erste Wahl kennen — keine genauen Dosierungen oder seltene Interaktionen fordern

GESPRÄCHSSTIL:
- Bei Korrekturen nur minimal erklären: ein kurzer Hinweis, warum die Antwort nicht passt, dann weiterfragen
- Sprich den Kandidaten als "Sie" an, aber in einem kollegial-lehrenden Ton (nicht wie Kollege auf Augenhöhe, sondern wie erfahrener Arzt zum Studenten)
- Bei Denkblockaden: einmal sachte nachhelfen ("Denken Sie an die Pathophysiologie...") — aber NICHT die Antwort direkt nennen

TIEFENBOHRUNG — PRIORITÄT FÜR M3:
1. Klinische Diagnosestellung (Anamnese → körperliche Untersuchung → Labordiagnostik → Bildgebung — Reihenfolge wichtig!)
2. Differenzialdiagnosen zu typischen Leitsymptomen
3. Grundpathophysiologie der häufigen Erkrankungen
4. Erstlinientherapie (Wirkprinzip reicht, genaue Dosierung nicht nötig)
5. Wann überweisen / Notfall erkennen` : '';

  const casesCompleted = body.casesCompleted || [];
  let profileContext = '';
  if (casesCompleted.length > 0) {
    const lastCase = casesCompleted[casesCompleted.length - 1];
    const safeOutcome = ['bestanden', 'nicht bestanden', 'abgebrochen'].includes(lastCase.outcome) ? lastCase.outcome.toUpperCase() : 'UNBEKANNT';
    profileContext = `\n\nLEISTUNGSPROFIL (Bisherige Dauer-Simulation):
- Bisherige Fälle absolviert: ${Math.min(casesCompleted.length, 100)}
- WICHTIG: Der letzte Fall war "${sanitizeString(lastCase.topic, 100)}" mit Ergebnis: ${safeOutcome}.
- Fehler im letzten Fall: ${lastCase.keyErrors?.length ? lastCase.keyErrors.map((e: unknown) => sanitizeString(e, 80)).join(', ') : 'Keine gravierenden Fehler.'}
Greife diese Schwächen bei Gelegenheit unauffällig im neuen Fall wieder auf, um zu sehen, ob der Kandidat dazugelernt hat.`;
  }

  const safeFocus = sanitizeString(focusTopics, MAX_FOCUS_LENGTH);
  const safeExcluded = sanitizeString(excludedTopics, MAX_FOCUS_LENGTH);
  const focusContext = safeFocus ? `\nKONZENTRIERE DICH AUF: ${safeFocus}.` : '';
  const excludedContext = safeExcluded ? `\nVERMEIDE UNBEDINGT: ${safeExcluded}.` : '';

  const isUnderOneMinute = remainingTime !== undefined && remainingTime > 0 && remainingTime <= 60;
  let timeContext = '';
  if (isTimeUp) {
    // Zeit abgelaufen — Gesprächspartner entscheidet selbst ob noch 1 Frage nötig oder Abschluss
    timeContext = `\n\n[ZEITSTEUERUNG — SIMULATIONSZEIT ABGELAUFEN]\nDie vorgesehene Simulationszeit ist abgelaufen. Du entscheidest jetzt selbst:\n\n▸ Wenn der aktuelle Fall noch einen wesentlichen offenen Punkt hat: Stelle maximal EINE gezielte Abschlussfrage. Kein [ENDE]-Marker.\n▸ Wenn der Fall hinreichend besprochen ist: Gib den Abschlussgruß — kurz auf die letzte Antwort eingehen (1 Satz), dann 2-3 Sätze wertschätzende Ausleitung, Auswertung ankündigen. Schreibe danach auf einer eigenen Zeile EXAKT diese Zeichenfolge (eckige Klammern, Großbuchstaben): [ENDE]\n\nKein Themenwechsel. Keine neue Kasuistik.`;
  } else if (isUnderOneMinute) {
    timeContext = `\n\n[ZEITSTEUERUNG — AUSLEITUNG]\nVerbleibende Zeit: unter 60 Sekunden. Du entscheidest:\n\n▸ Wenn noch eine wesentliche Antwort aussteht: Stelle EINE letzte Frage. Kein [ENDE]-Marker.\n▸ Wenn der Fall abgeschlossen ist: Reagiere kurz auf die Antwort (1 Satz), dann wertschätzende Ausleitung (1-2 Sätze), Auswertung ankündigen. Schreibe danach auf einer eigenen Zeile EXAKT diese Zeichenfolge (eckige Klammern, Großbuchstaben): [ENDE]\n\nBeispiel-Abschluss: "Das trifft es gut. Damit schließen wir die Simulation ab — Sie haben heute strukturiert klinisch argumentiert. Die ausführliche Auswertung folgt gleich.\n[ENDE]"`;
  } else if (isAbschlussPhase) {
    timeContext = `\n\n[ZEITSTEUERUNG — ABSCHLUSSPHASE]\nVerbleibende Zeit: ca. 1-2 Minuten. Jetzt den aktuellen Fall mit einer einzigen Abschlussfrage schließen.\nREGEL 1: Reagiere kurz auf die letzte Antwort des Kandidaten (1 Satz).\nREGEL 2: Stelle GENAU EINE abschließende Fallfrage — eine, die das Wesentliche des aktuellen Themas auf den Punkt bringt. Keine neue Kasuistik, kein Themenwechsel. Formuliere sie so, dass sie einen natürlichen Gesprächsabschluss ermöglicht.\nREGEL 3: Kündige NICHT an, dass die Zeit bald um ist — wirke natürlich.\nBeispiel-Abschlussfragen: "Wenn Sie nur eine Maßnahme in den nächsten 24 Stunden priorisieren könnten — welche wäre das und warum?" / "Was ist die häufigste vermeidbare Komplikation bei diesem Krankheitsbild und wie beugen Sie ihr vor?"`;
  }
  const durationContext = durationMinutes
    ? `\nDIE SIMULATION DAUERT GENAU ${durationMinutes} MINUTEN. Erwähne diese Dauer nicht ungefragt zu Beginn, richte dein Tempo aber danach aus.`
    : '';
  let styleContext = isShortTimeRemaining
    ? `\n\nFRAGESTIL (Kurze Zeit):\n- Rapid-Fire Modus: kurze, präzise Fakten- und Basiswissensfragen.\n- Kein langer Fallaufbau.`
    : `\n\nFRAGESTIL (Reguläre Zeit):\n- Ausführliche, realistische Patientenfälle.\n- Klinisches Management detailliert in mehreren Schritten.\n- TIEFE VOR BREITE: Bohre lieber tiefer in einen Fall — Pathophysiologie, Pharmakologie, Anatomie, aktuelle Standards — als schnell zum nächsten Fall zu springen. Ein gut durchgebohrter Fall ist wertvoller als drei oberflächlich abgearbeitete.\n- Wechsle erst dann zum neuen Fall, wenn die wichtigsten Grundlagenebenen (Pathophysiologie, Wirkmechanismen, aktuelle Standards, Differenzialdiagnosen) des aktuellen Falls geprüft wurden.`;

  let introContext = '';
  if (!isTimeUp && history.length === 0) {
    introContext = isShortTimeRemaining
      ? `\n\nEINLEITUNG: Begrüße locker und direkt, kündige schnelle Visite an. Starte sofort mit dem zugewiesenen Fall.`
      : `\n\nEINLEITUNG: Begrüße kurz, stelle dich mit Namen vor und leite natürlich ein, z.B. "Guten Tag, mein Name ist Dr. Müller. Lassen Sie uns heute über folgendes Thema sprechen. Ich habe einen Fall mitgebracht, den wir gemeinsam besprechen wollen." KEINE Erklärung einer Gesprächsstruktur, KEINE Aufzählung von Themen oder Zeitangaben. Direkt danach den Pflichtfall natürlich vorstellen.`;
  }

  // --- Klinikalltag / Visite Override ---
  const isVisite = user?.target === 'Klinikalltag';
  if (isVisite) {
    styleContext = `\n\nMODUS: CHEFARZT-VISITE (Klinikalltag)\nDu simulierst eine realistische Krankenhausvisite. Verhalte dich wie ein erfahrener Oberarzt bzw. Chefarzt bei der Morgenvisite.\nREGELN:\n- Stelle Patienten KURZ und KNAPP vor (2-3 Sätze max): Name, Alter, Aufnahmegrund, aktueller Status.\n- Frage dann SOFORT GEZIELT eine Wissensfrage: Pathophysiologie, Pharmakologie, Diagnostik oder Therapie.\n- Erwarte KURZE, PRÄZISE Antworten. Kein langes Ausführen. Wenn die Antwort richtig ist, sage kurz \"Gut\" oder \"Richtig\" und wechsle zum nächsten Patienten oder zur nächsten Frage.\n- Wenn falsch: Korrigiere knapp und stelle SOFORT die nächste Frage.\n- Pro Patient max. 2-3 Fragen, dann NÄCHSTER PATIENT.\n- Tempo ist hoch. Keine langen Erklärungen. Die Visite ist effizient.\n- Schwerpunkte: Pathophysiologie, Pharmakologie (Wirkmechanismen, Dosierungen, Kontraindikationen), Therapieentscheidungen, Diagnostik-Interpretation (Labor, Bildgebung).\n- Mische verschiedene Fachbereiche und Organsysteme durch.\n- Typische Visite-Fragen: \"Was ist der Wirkmechanismus von ...?\", \"Welche Differenzialdiagnosen gibt es bei ...?\", \"Wie interpretieren Sie diesen Laborwert?\", \"Welche Therapie leiten Sie ein?\", \"Warum nicht ...?\"\n- Sprich den Kandidaten als Kollegen an (\"Herr/Frau Kollege/in\").`;

    if (history.length === 0) {
      introContext = `\n\nEINLEITUNG: Begrüße den Kollegen kurz und knapp wie auf einer echten Visite: \"Guten Morgen. Wir starten die Visite. Erster Patient ...\" und präsentiere sofort den ersten Patienten mit einer Frage.`;
    }
  }

  const normalizedSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const specialtyKey = Object.keys(examDataset.specialties).find((k: string) => k.includes(normalizedSubject) || normalizedSubject.includes(k));
  const specialtyData = specialtyKey ? (examDataset.specialties as Record<string, any>)[specialtyKey] : null;
  let specialtyContext = '';
  if (specialtyData) {
    specialtyContext = `\nTypische Kasuistiken zur Inspiration:\n${JSON.stringify({
      cases: specialtyData.classic_cases,
      must_know: specialtyData.must_know || specialtyData.must_know_topics,
      short_questions: specialtyData.short_question_pool
    }, null, 2)}\n\nWICHTIG: Mische Themengebiete durch, aber bohre bei jedem Fall tief — Pathophysiologie, Wirkmechanismen, aktuelle Standards, Anatomie — bevor du zum nächsten Organsystem wechselst.`;
  }

  const coveredTopics: string[] = [];
  if (history.length > 0) {
    history.filter((m) => m.role === 'model').forEach((m) => {
      const firstSentence = sanitizeString((m.text as string).split(/[.?!]/)[0], 120);
      if (firstSentence.length > 5 && firstSentence.length < 120) coveredTopics.push(firstSentence);
    });
  }
  const coveredContext = coveredTopics.length > 0
    ? `\n\nBEREITS GEFRAGT (NIEMALS wiederholen – wähle komplett andere Themen/Organe):\n${coveredTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : '';

  const examinerName = sanitizeString(examiner?.name, 80);
  // IMPORTANT: Examiner name goes into system prompt — NOT into the user greeting,
  // to prevent Gemini Flash from confusing the examiner's name with the candidate's name.
  const examinerNameContext = examinerName
    ? `\n\nDEINE IDENTITÄT ALS KI-GESPRÄCHSPARTNER: Du heißt "${examinerName}". Stelle dich zu Beginn kurz vor (z.B. "Guten Tag, mein Name ist Dr. ${examinerName.replace(/^Dr\.?\s*/i, '')}.").` +
      (safeName ? ` Der Kandidat heißt "${safeName}". Sprich ihn/sie ausschließlich mit "${safeName}" an — NIEMALS mit deinem eigenen Namen "${examinerName}". Diese Namen dürfen NICHT verwechselt werden.` : ` Sprich den Kandidaten NIEMALS mit deinem eigenen Namen ("${examinerName}") an.`)
    : '';
  // Split system prompt: static part (cacheable) vs dynamic part (changes per turn)
  const systemStatic =
    getSystemInstruction(isShortTimeRemaining, examiner?.personality, examMode) +
    `\n\nFachbereich: ${subject}.${userContext}${studentContext}${profileContext}${focusContext}${excludedContext}${durationContext}${styleContext}${introContext}${examinerNameContext}${caseDatabaseContext}${specialtyContext}`;
  const systemDynamic = `${coveredContext}${timeContext}`;
  const systemContent = systemStatic + systemDynamic;

  const chatContents = history.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));
  if (chatContents.length === 0) {
    // Use candidate's name in the greeting (not the examiner's) so the AI knows who the candidate is
    const greeting = safeName ? `Guten Tag. Ich bin ${safeName}, bereit für die Simulation.` : 'Guten Tag. Ich bin bereit für die Simulation.';
    chatContents.push({ role: 'user', content: greeting });
  }

  // In-context injection for time phases — more reliable than system-prompt-only
  if (chatContents.length > 0) {
    const lastMsg = chatContents[chatContents.length - 1];
    if (lastMsg.role === 'user') {
      if (isUnderOneMinute) {
        lastMsg.content = lastMsg.content + '\n\n[Systemhinweis: Unter 60 Sekunden verbleibend — AUSLEITUNG. Kurz auf diese Antwort reagieren, dann wertschätzend aus der Simulation hinausleiten. KEINE neue Frage.]';
      } else if (isAbschlussPhase) {
        lastMsg.content = lastMsg.content + '\n\n[Systemhinweis: Abschlussphase — kurz auf diese Antwort reagieren, dann GENAU EINE abschließende Fallfrage stellen. Kein Themenwechsel, keine neue Kasuistik.]';
      }
    }
  }

  const validMessages: { role: string; content: string }[] = [];
  let lastRole: string | null = null;
  for (const msg of chatContents) {
    if (msg.role !== lastRole) {
      validMessages.push(msg);
      lastRole = msg.role;
    } else {
      validMessages[validMessages.length - 1].content += '\n' + msg.content;
    }
  }
  if (validMessages.length > 0 && validMessages[validMessages.length - 1].role === 'assistant') {
    if (isTimeUp) {
      validMessages.push({ role: 'user', content: '[Die Simulationszeit ist abgelaufen. Reagiere auf meine letzte Antwort und beende dann die Simulation. Keine neuen Fragen.]' });
    } else {
      validMessages.push({ role: 'user', content: '[Schweigen]' });
    }
  }

  return { systemStatic, systemDynamic, systemContent, validMessages, chosenCaseId: pickedCaseId, totalCases: pickedTotalCases };
}
