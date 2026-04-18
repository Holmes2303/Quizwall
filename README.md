# Quiz Wall

Interaktive Jeopardy-Quiz-App (Vanilla HTML, CSS, JavaScript) mit Editor, Spielstand-Verwaltung und KI-Import-Workflow.

## Aktueller Funktionsumfang

- Quiz laden, bearbeiten und spielen in einer Single-Page-App
- Strikte Trennung von:
  - Quiz-Dateien (`.quiz.json`)
  - Spielstand-Dateien (`.game.json`)
- Team-Setup vor Spielstart (2-4 Teams, frei benennbar)
- Spielstatus im Startmenue mit aktiviert/deaktiviertem Button-Status
- In-App-Editor fuer Kategorien und Fragen
- Gefuehrter Fragenablauf im Vollbild-Modal:
  - Frage anzeigen
  - Antwort anzeigen
  - Teams markieren, die richtig lagen
  - Ranking anzeigen
- Live-Ranking in der Sidebar der Quizwand
- Persistenz via `localStorage`
- Farbschema-Einstellungen (Primaer-, Hintergrund-, Textfarbe)
- KI-Import-Flow mit Prompt-Generator und JSON-Parser

## Neuerungen (Version 0.8)

### 1) KI-Quiz-Import

Im Startmenue steht `🤖 KI-Quiz importieren` zur Verfuegung.

Der Flow umfasst:

- Wahl der Quiz-Basis:
  - Freies Thema (`Thema` + `Zielgruppe`)
  - Konkretes Material (mit Materialhinweisen)
- Limit fuer maximale Fragenanzahl (4-60)
- Kategorien-Modus:
  - Automatisch durch KI
  - Vorgegebene Kategorien (kommasepariert)
- Feld fuer besondere Wuensche
- Generierter Prompt zum Kopieren in externe KI
- Import einer KI-Antwort als JSON oder JSON-Codeblock

Beim Import wird die Struktur validiert und normalisiert. Ungueltige/unsaubere Antworten werden abgefangen.

### 2) Getrennte Datei-Typen fuer Quiz und Spielstand

- Quiz-Export: `*.quiz.json`
- Spielstand-Export: `*.game.json`

Beide Exporte fragen einen Dateinamen ab und erzwingen die korrekte Endung.

### 3) Spielstand mit eingebetteten Quizdaten

Gespeicherte Spielstaende enthalten auch die Kategorien. Dadurch ist ein Spielstand eigenstaendig ladbar, ohne separates Quiz-File.

### 4) Team-Setup als eigener Schritt

Nach `Neues Spiel` erfolgt ein Team-Setup mit:

- Anzahl Teams (2-4)
- Teamnamen-Eingabe
- Direkter Spielstart auf die Quizwand

### 5) Verbesserter Fragen- und Punkte-Flow

Klick auf Karten startet einen 4-Schritt-Ablauf:

1. Frage anzeigen
2. Antwort anzeigen
3. Richtige Teams auswaehlen (Checkboxen)
4. Ranking anzeigen

Danach wird die Frage als gespielt markiert und die Quizwand aktualisiert.

### 6) Sicheres Zuruecksetzen mit Bestaetigungen

- `Spielstand zuruecksetzen` (Teams/Score/Fortschritt)
- `Quiz neu erstellen` mit Optionen, vor dem Verwerfen zu speichern
- Bestaetigungsdialoge bei riskanten Aktionen

### 7) Dynamische Kategorie-Header

- Kategorienamen werden auf max. 3 Zeilen begrenzt
- Lange Namen werden gekuerzt
- Schriftgroesse passt sich automatisch an die Kachelbreite an

### 8) Mobile-First Quizwand und Floating Actions

- Quizwand wurde fuer kleine Displays und Touchgeraete ueberarbeitet
- Zwei mobile Floating-Buttons auf der Quizwand:
  - `🏆` fuer Ranking
  - `🏠` fuer Hauptmenue
- Sidebar-Ranking wird auf kompakten Layouts ausgeblendet, um Platz fuer die Quizkacheln zu schaffen
- Header-Kacheln und Fragekacheln bleiben auch mobil spaltenweise deckungsgleich

### 9) Verbesserte Darstellung in Hoch- und Querformat

- Eigene Anpassungen fuer Portrait und Landscape auf Smartphones
- Typografie und Kachelgroessen skalieren je nach verfuegbarer Hoehe/Breite
- Quizwand nutzt den verfuegbaren Screen in mobilen Szenarien deutlich besser aus

### 10) Adaptive Mobile-Modals fuer Frage, Antwort und Ranking

- Frage-, Antwort- und Ranking-Modal wurden fuer Mobilansichten dynamisch optimiert
- Schriftgroesse und Abstaende orientieren sich an der verfuegbaren Bildschirmhoehe
- Ziel: moeglichst viel Inhalt ohne Scrollen bei weiterhin guter Lesbarkeit
- Bei sehr knapper Hoehe kann die Ueberschrift in den mobilen Modals automatisch ausgeblendet werden

### 11) Antwort-Modal mit besserer Informations-Hierarchie

- Antwortbereich bleibt oben im Modal
- Team-Auswahlblock (`Welche Teams haben richtig geantwortet?`) ist im unteren Bereich verankert
- Teamliste ist ausrichtungsabhaengig:
  - Hochformat: untereinander
  - Querformat: nebeneinander
  - Bei 6+ Teams im Querformat automatisch 3 Spalten

### 12) Startmenue-Scrollverhalten korrigiert

- Das Startmenue ist so angepasst, dass Ueberschriften und oberer Bereich auch auf kleinen Displays vollstaendig erreichbar bleiben
- Vertikale Positionierung/Scrollbarkeit wurden entsprechend ueberarbeitet

## Bedienung

## Startmenue

### Hauptaktionen

- `🎮 Neues Spiel` (nur wenn ein Quiz geladen ist)
- `▶️ Spiel fortsetzen` (nur wenn ein Spielstand vorhanden ist)

### Quiz verwalten

- `🆕 Quiz neu erstellen`
- `✏️ Editor oeffnen`
- `⬇️ Quiz speichern`
- `📂 Quiz laden`
- `🎯 Demo-Quiz laden`
- `🤖 KI-Quiz importieren`

### Spiel verwalten

- `💾 Spielstand speichern`
- `📂 Spielstand laden`
- `🔄 Spielstand zuruecksetzen`

### Weitere Aktion

- `⚙️ Einstellungen`

## Editor

### Moeglichkeiten

- Quiz-Titel bearbeiten
- Kategorien anlegen
- Pro Kategorie Fragen bearbeiten:
  - Punkte
  - Frage
  - Antwort
- Spiel aus dem Editor starten

Hinweis: Fuer den Start sind mindestens 2 Kategorien erforderlich.

## Dateiformate

### Quiz-Datei (`.quiz.json`)

Beispiel:

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

Beispiel:

```json
{
  "game": {
    "teams": [
      { "id": 0, "name": "Team 1", "score": 200 }
    ],
    "categories": [
      {
        "id": 0,
        "name": "Kategorie 1",
        "questions": [
          { "id": "q-0-0", "points": 100, "question": "Frage?", "answer": "Antwort" }
        ]
      }
    ]
  },
  "played": ["q-0-0"],
  "quizTitle": "Mein Quiz"
}
```

## Persistenz

Die App nutzt `localStorage`.

- `quizwall_game`: Aktueller Spielzustand inkl. Quizdaten und gespielten Fragen
- `quiz_primary`: Benutzerfarbe primaer
- `quiz_bg`: Benutzerfarbe Hintergrund
- `quiz_text`: Benutzerfarbe Text

## Projektstruktur

```text
/
├── index.html
├── style.css
├── script.js
├── default-quiz-data.js
├── sample-quiz.json
├── QUICKSTART.md
└── README.md
```

## Entwicklung

Keine Build-Tools erforderlich.

1. Repository klonen
2. `index.html` im Browser oeffnen
3. Optional ueber GitHub Pages deployen

## Hinweise

- Die App ist clientseitig und funktioniert ohne Backend.
- JSON-Import erwartet valide Strukturen mit Kategorien und Fragen.
- Beim KI-Flow werden keine Dateien direkt aus der App an KI-Dienste uebertragen.
- Mobile Darstellung ist fuer Hoch- und Querformat optimiert; sehr kleine Viewports erhalten zusaetzliche kompakte Regeln.

## Lizenz

Derzeit keine explizite Lizenzdatei im Repository hinterlegt.