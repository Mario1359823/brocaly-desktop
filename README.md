# Brocaly Desktop

**KI-Prüfungssimulation für Medizin — lokal auf deinem Rechner, mit deinem eigenen API-Schlüssel.**

Brocaly simuliert das mündliche medizinische Fachgespräch: Ein KI-Gesprächspartner stellt dir
einen echten Fall vor, du antwortest frei per Sprache, er hakt nach — Pathophysiologie,
Pharmakologie, Differenzialdiagnosen, aktuelle Standards. Danach bekommst du eine Auswertung mit
Stärken, Lernfeldern und Frage-für-Frage-Analyse.

Die App ist kostenlos, quelloffen und kommt ohne Konto, ohne Server und ohne Abo aus.

---

## Installation

| Plattform | Datei |
|---|---|
| macOS (Apple Silicon & Intel) | `Brocaly-<version>.dmg` |
| Windows 10/11 (x64 & ARM) | `Brocaly-Setup-<version>.exe` |

Lade die passende Datei aus den [Releases](https://github.com/brocaly/brocaly-desktop/releases)
herunter und installiere sie wie gewohnt.

> **Hinweis zu unsignierten Builds:** Die Releases sind derzeit nicht code-signiert.
> - **macOS:** Beim ersten Start Rechtsklick auf Brocaly → „Öffnen" → „Öffnen" bestätigen.
> - **Windows:** SmartScreen meldet sich → „Weitere Informationen" → „Trotzdem ausführen".

## Erste Schritte

Nach der Installation führt dich die App in drei Schritten durch die Einrichtung:

1. **Account erstellen** — Name, Trainingsziel und Fachgebiet. Bleibt ausschließlich auf deinem
   Rechner; kein Passwort, keine E-Mail.
2. **API-Schlüssel hinterlegen** — siehe unten.
3. **Erste Simulation starten** — Gesprächspartner wählen und loslegen.

### Den Google-Schlüssel holen (ca. 2 Minuten)

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) öffnen und mit deinem normalen
   Google-Konto anmelden — es ist keine Kreditkarte nötig.
2. **Create API key** klicken und ein Projekt auswählen oder neu anlegen.
3. Den Schlüssel (beginnt mit `AIza…`) kopieren und in Brocaly einfügen.

Brocaly prüft den Schlüssel sofort gegen Google, damit ein Tippfehler nicht erst mitten in der
Simulation auffällt.

### Optionale Schlüssel

Ein Google-Schlüssel genügt für alles: Gespräch, Auswertung, Sprachausgabe und Spracherkennung.
Unter **Einstellungen → API-Schlüssel** kannst du zusätzlich hinterlegen:

| Anbieter | Verbessert |
|---|---|
| **Anthropic Claude** | Stärkerer Prüfer für Facharzt-Gespräche (Sonnet) und feinere Auswertung |
| **ElevenLabs** | Natürlichere Prüferstimmen |
| **OpenAI** | Whisper-Spracherkennung — robuster bei Dialekt und lauter Umgebung |

### Was kostet die Nutzung?

Brocaly selbst kostet nichts. Du zahlst nur, was dein KI-Anbieter für deine Anfragen berechnet.
Google bietet für Gemini ein kostenloses Kontingent, das für regelmäßiges Üben in der Regel
ausreicht. Läufst du dagegen, meldet die App das klar und du kannst kurz warten oder in deinem
Google-Konto auf einen bezahlten Tarif wechseln.

## Datenschutz

- **Kein Konto, kein Server.** Brocaly hat keine Backend-Infrastruktur.
- Profil, Gesprächsverläufe und Auswertungen liegen als JSON-Datei im Anwendungsdatenordner deines
  Betriebssystems. Über **Einstellungen → Deine Daten** kannst du den Ordner öffnen, alles
  exportieren oder unwiderruflich löschen.
- API-Schlüssel werden über den Schlüsselbund deines Betriebssystems verschlüsselt (macOS Keychain,
  Windows DPAPI). Ist der Schlüsselbund nicht verfügbar, weist die App darauf hin.
- Deine Sprachaufnahmen und Antworten gehen ausschließlich an den KI-Anbieter, dessen Schlüssel du
  hinterlegt hast. Aufnahmen werden nicht gespeichert.
- Der eingebettete lokale Dienst lauscht nur auf `127.0.0.1` und verlangt zusätzlich ein
  Token, das bei jedem Start neu erzeugt wird — andere Programme auf deinem Rechner können ihn
  nicht ansprechen.

## Aus dem Quellcode bauen

Voraussetzung: Node.js 20 oder neuer.

```bash
cd desktop
npm install

npm run dev          # Entwicklungsmodus mit Hot Reload
npm run start        # Produktionsbuild bauen und starten
npm run typecheck    # TypeScript prüfen

npm run dist:mac     # macOS: .dmg + .zip (arm64 + x64)
npm run dist:win     # Windows: NSIS-Installer (x64 + arm64)
```

### Architektur

```
electron/   Hauptprozess: Fenster, IPC, lokaler JSON-Speicher, verschlüsselter Schlüsselbund
server/     Eingebetteter Express-Dienst auf 127.0.0.1 — Prompts, KI-Aufrufe, Fallauswahl
src/        React-Oberfläche (Vite)
shared/     Typen, die alle drei Schichten teilen
resources/  Fallbibliothek (28 Fachgebiete)
```

Der Renderer wird im Produktionsbuild vom eingebetteten Dienst ausgeliefert. Dadurch bleiben alle
`/api`-Aufrufe same-origin und das Token-Streaming des Prüfungsgesprächs funktioniert ohne Umwege.

## Wichtiger Hinweis

Brocaly ist ein **Trainingswerkzeug**. Es ist keine Prüfung, keine Prüfungsvorbereitung mit
Erfolgsgarantie und keine medizinische Beratung. Die Inhalte werden von einer KI erzeugt, sind
nicht menschlich kontrolliert und können fehlerhaft, unvollständig oder veraltet sein. Prüfe
medizinische Inhalte immer eigenverantwortlich anhand verlässlicher Quellen.

## Lizenz

[AGPL-3.0-or-later](LICENSE) — © 2026 Mario Vasic.

Du darfst Brocaly nutzen, verändern und weitergeben. Wenn du eine veränderte Fassung verbreitest
oder als Netzwerkdienst anbietest, musst du deinen Quellcode unter derselben Lizenz offenlegen.
