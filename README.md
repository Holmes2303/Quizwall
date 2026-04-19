# Quiz Wall

Interaktive Jeopardy-Quiz-App (Vanilla HTML/CSS/JavaScript) mit Editor, Spielstandverwaltung, KI-Import-Workflow und starkem Mobile-/Tablet-Fokus.

Aktueller UI-Stand: Version `0.9d`.

## Highlights

- Single-Page-App ohne Build-Tool, komplett clientseitig
- Trennung von Quiz (`.quiz.json`) und Spielstand (`.game.json`)
- Team-Setup vor Spielstart (2-4 Teams)
- In-App-Editor fuer Kategorien/Fragen inkl. globaler Punktestufenpflege
- Gefuehrter Frage-/Antwort-Flow mit Ranking-Update
- Manuelle Punktekorrektur pro Team (`Punkte anpassen`)
- CI-Einstellungen (Name, Logo, Farben, Farbsets)
- KI-Import mit Prompt-Generator und robustem JSON-Import
- PWA-Basis (Manifest, Service Worker, Icons)

## Schnellstart

1. `index.html` lokal oeffnen **oder** lokalen Webserver starten:

```bash
python3 -m http.server 8000
```

2. Im Browser aufrufen: `http://localhost:8000`
3. Im Hauptmenue `🎮 Neues Spiel` waehlen oder ein Quiz laden.

## Bedienung

### Hauptmenue

#### Hauptaktionen

- `🎮 Neues Spiel`
- `▶️ Spiel fortsetzen`

#### Quiz verwalten

- `🆕 Quiz neu erstellen`
- `✏️ Editor oeffnen`
- `⬇️ Quiz speichern`
- `📂 Quiz laden`
- `🎯 Demo-Quiz laden`
- `🤖 KI-Quiz importieren`

#### Spiel verwalten

- `💾 Spielstand speichern`
- `📂 Spielstand laden`
- `🔄 Spielstand zuruecksetzen`

#### Weitere Bereiche

- `⚙️ Einstellungen`
- `❓ Hilfe & Anleitung`

### Spielablauf

1. Frage auf der Quiz-Wall antippen.
2. Frage-Modal lesen, dann `Weiter`.
3. Antwort-Modal: korrekte Teams markieren oder Punkte manuell korrigieren.
4. Ranking wird aktualisiert.

#### Punkte manuell korrigieren

Im Ranking kann pro Team mit `✏️` die Karte `Punkte anpassen` geoeffnet werden:

- Modus `Gutschrift` / `Abzug`
- Punkte-Chips mehrfach nutzbar (aufsummierend)
- `Zuruecksetzen`, `Anwenden`, `Abbrechen`

### Editor

- Quiz-Titel pflegen
- Kategorien anlegen/bearbeiten/entfernen
- Fragen und Antworten pro Kategorie bearbeiten
- Globale Punktestufen:
  - einzelne Stufe bearbeiten
  - `+ Stufe` / `- Stufe`
  - `Zuruecksetzen` auf Jeopardy-Standard (100-500) mit Warnhinweis

## Einstellungen (CI)

- Name und Logo
- Farben 1-4 und Hintergrund
- Kacheltext-Modus (hell/dunkel)
- Farbset laden/speichern/zuruecksetzen
- Uebernahme per `Anwenden`, Verwerfen per `Abbrechen`

## KI-Import

- Prompt-basierter Workflow fuer externe KI
- Import von JSON oder JSON-Codeblock
- Strukturvalidierung + Normalisierung
- Hinweisdialog bei potentiell destruktiven Ueberschreibungen

## Mobile/Responsive Verhalten

- Optimierte Layouts fuer Hoch-/Querformat
- Quiz-Wall auf kleinen Touchgeraeten scrollbar, damit Browserleisten ausblendbar sind
- Mobile Floating-Buttons auf der Quiz-Wall:
  - `🏆` Ranking
  - `🏠` Hauptmenue
- Modals fuer Frage/Antwort/Ranking/Score-Adjust mit Safe-Viewport-Regeln

## PWA

- `manifest.webmanifest`
- Service Worker (`sw.js`) mit:
  - HTML `network-first`
  - Assets `stale-while-revalidate`
- Icons in `icons/` (`192`, `512`, `apple-touch-icon`)

## Dateiformate

### Quiz-Datei (`.quiz.json`)

```json
{
  "version": "1.0",
  "type": "quiz",
  "timestamp": "2026-04-18T12:00:00.000Z",
  "quizTitle": "Mein Quiz",
  "categories": [
    {
      "id": 0,
      "name": "Kategorie 1",
      "questions": [
        {
          "id": "q-0-0",
          "points": 100,
          "question": "Frage?",
          "answer": "Antwort"
        }
      ]
    }
  ]
}
```

### Spielstand-Datei (`.game.json`)

```json
{
  "game": {
    "teams": [{ "id": 0, "name": "Team 1", "score": 200 }],
    "categories": [
      {
        "id": 0,
        "name": "Kategorie 1",
        "questions": [
          {
            "id": "q-0-0",
            "points": 100,
            "question": "Frage?",
            "answer": "Antwort"
          }
        ]
      }
    ]
  },
  "played": ["q-0-0"],
  "quizTitle": "Mein Quiz"
}
```

### Farbset-Datei (`.colorset.json`)

Enthaelt Theme-Farben und optional Branding-Daten (Name/Logo).

## Persistenz

Die App speichert lokal im Browser (`localStorage`), u. a.:

- Spielzustand inkl. Teams, Kategorien, gespielte Fragen
- Theme-/Branding-Einstellungen

## Projektstruktur

```text
/
├── index.html
├── style.css
├── script.js
├── default-quiz-data.js
├── sample-quiz.json
├── manifest.webmanifest
├── sw.js
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
├── QUICKSTART.md
└── README.md
```

## Entwicklung / Deployment

- Keine Build-Pipeline noetig
- Lokales Hosting per `python3 -m http.server 8000` empfohlen
- Deployment z. B. via GitHub Pages moeglich

## Hinweise

- Rein clientseitig, kein Backend erforderlich
- Bei ungewoehnlichem Verhalten nach Updates: Seite 1-2x neu laden (Service-Worker-Cache)
- KI-Daten werden nicht automatisch direkt aus der App an KI-Dienste gesendet; Prompt/Antwort laufen manuell

## Lizenz

Im Repository ist aktuell keine separate Lizenzdatei hinterlegt.

## Changelog

### 2026-04-19

- README komplett auf den aktuellen Stand gebracht (Version 0.9d, Features, Bedienung, Mobile, PWA).
- Hilfe & Anleitung auf Akkordeon-Layout umgestellt und Inhalte aktualisiert.
- Hilfetext zu Einstellungen inhaltlich angepasst (Animation-Hinweis, Speichern/Laden/Zuruecksetzen).
- Symbol-Hinweise in der Hilfe ergaenzt (u. a. Punkte anpassen `✏️`, Ranking `🏆`, Hauptmenue `🏠`).
- Mobile Scroll-Verhalten in mehreren Bereichen verbessert:
  - Hauptmenue auf kleinen Geraeten
  - Settings-Screen
  - Quiz-Wall (Portrait/Scroll-Puffer)
  - Frage-/Antwort-/Ranking-/Punkte-anpassen-Karten
- Vollbild-Floating-Button testweise eingebaut und anschliessend vollstaendig wieder entfernt (To-do fuer spaeter).