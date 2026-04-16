# Quiz Wall - Jeopardy-Style Quiz Application

Eine interaktive, einseitige Webanwendung für Jeopardy-ähnliche Quiz-Spiele, geschrieben in Vanilla JavaScript, HTML und CSS. Perfekt für Liveevents, Teamspiele und Quizabende!

## 🎯 Funktionen

✅ **Spielsetup**: 2-4 Teams, 3-6 Kategorien, anpassbare Punktwerte  
✅ **In-App Editor**: Erstelle und bearbeite Quiz-Inhalte direkt in der App  
✅ **Im- & Export**: Speichere Quiz als JSON und lade sie später erneut  
✅ **Echtzeit-Scoring**: Automatische Punktevergabe an richtig antwortende Teams  
✅ **Ranglistenfunktion**: Live-Ranking nach jeder beantworteten Frage  
✅ **Responsive Design**: Funktioniert auf Desktop, Tablet und Mobile  
✅ **localStorage Integration**: Spielstand wird automatisch gespeichert  
✅ **Anpassbare Farben**: Einfache Theme-Einstellungen über CSS-Variablen  
✅ **Smooth Animations**: Moderne UI mit CSS-Übergängen  
✅ **GitHub Pages Ready**: Keine Backend notwendig!

## 🚀 Schnellstart

### 1. Einrichtung
- Klone das Repository oder lade alle 3 Dateien herunter:
  - `index.html`
  - `style.css`
  - `script.js`
- Platziere alle Dateien im gleichen Verzeichnis
- Öffne `index.html` in deinem Browser

### 2. Erste Schritte
Beim Starten siehst du das Hauptmenü mit verschiedenen Optionen:

**Hauptoptionen:**
- **🎮 Neues Spiel starten**: Schnellstart mit vorkonfiguriertem Setup
- **✏️ Editor öffnen**: Erstelle ein neues Quiz von Grund auf
- **📂 Spiel laden**: Importiere eine vorher gespeicherte JSON-Datei
- **⚙️ Einstellungen**: Passe Farben an

**Quiz verwalten:**
- **⬇️ Quiz speichern**: Exportiere das aktuelle Quiz als JSON
- **📂 Quiz laden**: Importiere eine JSON-Quiz-Datei
- **🎯 Default-Demo-Quiz laden**: Lade das mitgelieferte Demo-Quiz
- **🆕 Neues Quiz**: Erstelle ein komplett neues, leeres Quiz

## 📋 Spielablauf

### Schritt 1: Spielsetup (Neues Spiel)
```
→ Gib die Anzahl der Teams ein (2-4)
→ Gib die Anzahl der Kategorien ein (3-6)
→ Benenne deine Teams
→ Benenne deine Kategorien
→ Passe Punktwerte an (optional; Standard: 100,200,300,400,500)
```

### Schritt 2: Quiz Wall (Hauptansicht)
- Die Quiz-Wand zeigt ein Gitter mit:
  - **Spalten**: Kategorien
  - **Zeilen**: Punktwerte
- Graue/deaktivierte Karten: Bereits beantwortete Fragen
- Klick auf eine aktive Karte → Frage wird angezeigt

### Schritt 3: Frage beantworten
1. **Frage anzeigen**: Nur die Frage wird angezeigt
2. **"Antwort anzeigen" klicken**: Nachdem Team verbal antwortet
3. **Antwort + Team-Auswahl**: Die richtige Antwort erscheint, Toggle-Buttons für Teams
4. **Teams auswählen**: Klick auf Buttons der Teams, die richtig geantwortet haben
5. **"Weiter" klicken**: Punkte werden addiert, Quiz Wall aktualisiert

### Schritt 4: Ranking anschauen
Nach jeder Frage: Automatisches Ranking mit Live-Scores

### Schritt 5: Zum Board zurückkehren
"Zurück zur Quizwand" bringt dich zum Board zurück. Die Frage ist jetzt grau.

## ✏️ Editor - Quiz erstellen

### In der Editor-Ansicht:

**Linke Seite (Kategorien-Liste)**:
- Alle Kategorien deines Quiz
- Klick zum Auswählen
- "+ Kategorie" Button zum Hinzufügen

**Rechte Seite (Fragen-Editor)**:
- Kategoriename editierbar
- Jede Frage hat:
  - **Fragefield**: Die eigentliche Frage
  - **Antwortfield**: Die korrekte Antwort
  - **Punkte**: 1-1000 Punkte (anpassbar)
- **Duplizieren Button**: Kopiert eine Frage
- **Löschen Button**: Entfernt eine Frage

**Buttons unten**:
- **Spielen**: Speichert und startet das Quiz
- **⬇️ Herunterladen (JSON)**: Exportiert das Quiz als JSON-Datei
- **Abbrechen**: Zurück zum Menü

## 📤 Export und Import

### Export (Quiz speichern)
1. Im Editor: Klick auf "⬇️ Herunterladen (JSON)"
2. Eine `quiz-wall-[timestamp].json` Datei wird heruntergeladen
3. Diese Datei kannst du später wieder laden

### Import (Quiz laden)
1. Hauptmenü: Klick auf "📂 Spiel laden"
2. Wähle eine `.json` Datei aus
3. Quiz wird automatisch geladen und Spielansicht wird gestartet

**JSON Format** (Beispiel):
```json
{
  "version": "1.0",
  "timestamp": "2026-04-15T10:30:00.000Z",
  "categories": [
    {
      "id": 0,
      "name": "Wissenschaft",
      "questions": [
        {
          "id": "q-0-0",
          "points": 100,
          "question": "Was ist die chemische Formel von Wasser?",
          "answer": "H2O"
        }
      ]
    }
  ]
}
```

## ⚙️ Anpassung und Konfiguration

### Farben ändern
1. Klick auf "⚙️ Einstellungen" im Hauptmenü
2. Nutze die Farbwähler:
   - **Primärfarbe**: Button, Header, Highlights
   - **Hintergrundfarbe**: App-Hintergrund
   - **Textfarbe**: Text-Farbe
3. Klick "Farben speichern"

### CSS Variablen (im Code)
Die Farben sind in [style.css](style.css) als CSS-Variablen definiert:

```css
:root {
    --primary-color: #007bff;       /* Blau */
    --background-color: #f8f9fa;    /* Hell */
    --text-color: #212529;          /* Dunkel */
    /* ... weitere Variablen */
}
```

Du kannst diese Werte direkt im CSS ändern für dauerhafte Anpassungen.

### Standardpunkte ändern
Beim Spielsetup: Im "Punkte pro Frage" Feld anpassen (Standard: `100,200,300,400,500`)

**Eingabeformat**: Komma-separierte Werte  
**Beispiele**:
- `50,100,150,200,250` → 5 Fragen mit unterschiedlichen Werten
- `100,200,300` → 3 Fragen, alle 100 Punkte getrennt
- `500,1000` → 2 Fragen mit hohen Werten

## 💾 localStorage Integration

Alle Spielzustände werden automatisch in `localStorage` gespeichert:

- **quizWall_gameState**: Aktueller Spielstand (Teams, Scores, Fragen Status)
- **quizWall_primaryColor**: Benutzerdefinierte Primärfarbe
- **quizWall_backgroundColor**: Benutzerdefinierte Hintergrundfarbe
- **quizWall_textColor**: Benutzerdefinierte Textfarbe

**Hinweis**: Wenn der Browser Daten löscht oder die localStorage geleert wird, gehen alle Spielstände verloren. Nutze "⬇️ Herunterladen (JSON)" um deine Quiz zu sichern!

## 📱 Browser-Kompatibilität

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+
- ✅ iOS Safari
- ✅ Android Chrome

## 🌐 GitHub Pages Deployment

1. Erstelle ein Repository auf GitHub
2. Lade die 3 Dateien hoch
3. Gehe zu Repository Settings → Pages
4. Wähle "main branch" als Source
5. Dein Quiz ist dann unter `https://dein-username.github.io/repo-name/` erreichbar

## 🎨 Customization-Tipps

### Teams vor dem Spiel festlegen
Im Spielsetup die Team-Namen eingeben (z.B. "Rot", "Blau", "Grün")

### Große Quizzes erstellen
Der Editor unterstützt beliebig viele Kategorien und Fragen. Empfohlen:
- **6 Kategorien**: Größere Quizzes (2-3 Min pro Kategorien)
- **5 Punkte-Stufen**: Standard gleich wie im Original Jeopardy
- **4 Teams**: Für optimale UI-Balance

### Keyboard Shortcuts
- **Tabulator**: Navigation zwischen Feldern im Editor
- **Enter**: Hilfreiche für schnelle Bestätigung (je nach Browser)

## 📖 Häufig gestellte Fragen (FAQ)

**F: Was passiert wenn der Browser geclosht wird?**  
A: Der Spielstand wird in localStorage gespeichert und beim Neustart automatisch wiederhergestellt.

**F: Kann ich bis zu 10 Kategorien haben?**  
A: Technisch ja, aber die UI ist für max. 6 optimiert. Mehr wird schwer lesbar auf älteren Bildschirmen.

**F: Kann ich die JSON-Datei mit Excel/Sheets bearbeiten?**  
A: JSON ist Text. Du kannst es mit einem Texteditor öffnen und bearbeiten, solltest aber die Struktur beibehalten.

**F: Funktioniert das offline?**  
A: Ja! Nach dem ersten Laden kann die Seite ganz offline genutzt werden.

**F: Kann ich mehrere Quizzes parallel ausführen?**  
A: Nein, es gibt einen Spielstand per localStorage. Du müsstest einen anderen Browser nutzen oder Cookies löschen für ein neues Spiel.

## 🐛 Troubleshooting

**Problem**: Quiz lädt nicht oder zeigt Fehler  
**Lösung**:
- Browser-Konsole checken (F12)
- Alle 3 Dateien im gleichen Verzeichnis?
- JavaScript aktiviert?

**Problem**: Farben werden nicht gespeichert  
**Lösung**:
- localStorage aktiviert?
- Private Browsing deaktivieren?

**Problem**: Datei-Import funktioniert nicht  
**Lösung**:
- JSON-Format überprüfen (valid JSON?)
- Muss "categories" Array enthalten

## � Projektstruktur

```
/
├── index.html          # Haupt-HTML-Datei mit allen UI-Elementen
├── style.css           # CSS-Stile und responsive Design
├── script.js           # JavaScript-Logik für Spiel, Editor und Datenverwaltung
├── default-quiz.json   # Standard-Demo-Quiz mit Beispiel-Fragen
├── sample-quiz.json    # Zusätzliches Beispiel-Quiz-Datei
├── QUICKSTART.md       # Kurzanleitung für schnelle Einstiege
└── README.md           # Diese umfassende Dokumentation
```

## 🤝 Beitrag (Contributing)

Beiträge sind herzlich willkommen! So kannst du mithelfen:

1. **Fork** das Repository
2. Erstelle einen **Feature-Branch** (`git checkout -b feature/AmazingFeature`)
3. **Committe** deine Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. **Pushe** zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne einen **Pull Request**

### Entwicklungsrichtlinien
- Halte den Code modular und kommentiert
- Teste Änderungen auf verschiedenen Browsern
- Füge neue Features zur README hinzu
- Verwende semantische Commit-Nachrichten

## 👤 Autor

**Holmes2303**

Entwickelt als Open-Source-Projekt für die Community.

## 🙏 Danksagungen

- Inspiration aus klassischen Quiz-Shows wie Jeopardy
- Responsive Design-Prinzipien von modernen Web-Standards
- Vanilla JavaScript für maximale Kompatibilität und Performance

---

## 📄 Lizenz

## 🤝 Support & Verbesserungen

Gefällt dir die App? Gerne Feedback oder Feature-Requests!

---

**Viel Spaß mit deinem Quiz Wall! 🎯**

Version: 1.0  
Letztes Update: April 2026 
