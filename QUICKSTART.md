# Quick Start Guide - Quiz Wall Application

## 📦 Was ist enthalten?

Dein Quiz Wall Projekt enthält **3 Dateien** und ist sofort einsatzbereit:

1. **index.html** - Die Benutzeroberfläche
2. **style.css** - Styling & Animations
3. **script.js** - Die gesamte Spiellogik

---

## 🎮 Erste Schritte (30 Sekunden)

1. Öffne `index.html` in deinem Browser
2. Du siehst das Hauptmenü
3. Klick auf "🎮 Neues Spiel starten"
4. Konfiguriere: Teams (2-4), Kategorien (3-6)
5. Fertig! Das Quiz-Board ist bereit

---

## ⚡ Kernmerkmale

### 1. **Quiz Setup**
- Definiere Teams, Kategorien und Punktwerte
- Vordefinierte Standard: `100, 200, 300, 400, 500` Punkte
- Anpassbar auf beliebige Werte (1-1000)

### 2. **Editor**
Erstelle Quiz von Grund auf:
- Kategorien hinzufügen/löschen
- Fragen und Antworten eingeben
- Punkte pro Frage anpassen
- Fragen duplizieren/löschen

**Export & Import**:
- Klick "⬇️ Herunterladen (JSON)" → Quiz als Datei speichern
- Hauptmenü: "📂 Spiel laden" → Vorher gespeicherte Quiz laden
- Für LaTeX-Sonderfälle kann `latex-regression-quiz.json` als schneller Regressionstest importiert werden

### 3. **Gameplay**
**Exakte Ablauffolge:**
1. Moderator klickt Frage-Karte auf dem Board
2. Nur die **Frage** wird angezeigt
3. Teams antwortet verbal
4. Klick "Antwort anzeigen"
5. **Antwort** + Toggle-Buttons für Teams
6. Moderator klickt Team(s), die richtig geantwortet haben
7. "Weiter" klicken → Punkte werden addiert
8. **Ranking-Screen** zeigt aktuelle Scores
9. "Zurück zur Quizwand" → Frage ist jetzt grau/deaktiviert

### 4. **Einstellungen**
Passe die Farben an:
- Primärfarbe (Buttons, Header)
- Hintergrundfarbe
- Textfarbe

Alle Einstellungen werden in `localStorage` gespeichert.

---

## 💾 Datenspeicherung

Die App speichert automatisch in `localStorage`:
- Aktuelle Spielstand (Teams, Scores, Fragen-Status)
- Benutzerdefinierte Farben
- Alles wird beim Browser-Neustart automatisch wiederhergestellt

**Wichtig**: Nutze "⬇️ Herunterladen (JSON)" um Quiz zu sichern!

---

## 📱 Responsive Design

✅ Desktop (1920px+)  
✅ Tablet (768px - 1024px)  
✅ Mobile (320px - 767px)

Die Quiz-Wand passt sich automatisch an deine Bildschirmgröße an.

---

## 🌐 GitHub Pages Deployment

Willst du die App online hosten?

1. Erstelle ein GitHub Repository
2. Lade die 3 Dateien hoch:
   ```
   index.html
   style.css
   script.js
   ```
3. Settings → Pages
4. Wähle "main branch" als Source
5. Fertig! Deine App ist unter `https://dein-username.github.io/repo-name/` online

---

## 🎨 Customization - Code-Ebene

Falls du direkt im CSS Änderungen vornehmen möchtest:

**In `style.css` findest du am Anfang:**
```css
:root {
    --primary-color: #007bff;       /* Blau - Hauptfarbe */
    --secondary-color: #6c757d;     /* Grau */
    --tertiary-color: #28a745;      /* Grün - Buttons */
    --background-color: #f8f9fa;    /* Hell */
    --text-color: #212529;          /* Dunkel */
    /* weitere Variablen... */
}
```

Diese ändern und speichern = neue Farben überall!

---

## 🚀 Beispiel-Workflow

### 1. Ein neues Wissenschafts-Quiz erstellen:
```
✏️ Editor öffnen
  → + Kategorie: "Biologie"
    - 5 Fragen mit 100-500 Punkten
  → + Kategorie: "Physik"
    - 5 Fragen mit 100-500 Punkten
  → + Kategorie: "Chemie"
    - 5 Fragen mit 100-500 Punkten
  → ⬇️ Herunterladen (JSON)
```

### 2. Quiz später erneut nutzen:
```
📂 Spiel laden
  → Wähle die science-quiz.json Datei
  → Quiz wird geladen
  → Spielen!
```

### 3. Mit 4 Teams spielen:
```
🎮 Neues Spiel starten
  → Teams: 4
  → Kategorien: 6
  → Team-Namen eingeben
  → Spiel starten
```

---

## 🔧 Technische Details

**Browser-Requirements:**
- Modern Browser mit ES6 Support
- localStorage aktiviert
- JavaScript enabled

**Kompatibilität:**
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile Browser

**Dateigröße:**
- `index.html` ≈ 8 KB
- `style.css` ≈ 15 KB
- `script.js` ≈ 12 KB
- **Total: ≈ 35 KB** (sehr schnell zu laden!)

---

## ❓ Häufige Fragen

**F: Muss ich das herunterladen oder kann ich online spielen?**  
A: Du kannst es lokal öffnen (`index.html` im Browser) ODER auf GitHub Pages hochladen.

**F: Was wenn ich 10 Kategorien will?**  
A: Technisch möglich, aber die UI ist für max. 6 optimiert. Ab 7+ wird's eng.

**F: Funktioniert das offline?**  
A: JA! Nach dem ersten Laden funktioniert alles offline. Perfekt für Events ohne Internet.

**F: Kann ich die Fragen während des Spiels ändern?**  
A: Nein. Nutze dafür "Spiel zurücksetzen" und starte neu oder verwende den Editor vorher.

**F: Wo sind meine Daten gespeichert?**  
A: Im Browser's `localStorage`. Nicht auf Servern, rein lokal auf deinem Gerät.

---

## 📞 Support

- Schau in die **console** (F12) bei Fehlern
- Probiere einen anderen Browser
- Cache löschen falls etwas komisch lädt
- Alle Dateien im gleichen Ordner?

---

## 🎯 Next Steps

1. **Test**: Öffne `index.html` im Browser
2. **Customize**: Ändere Farben in Einstellungen
3. **Create**: Nutze den Editor für dein erstes Quiz
4. **Save**: Speichere dein Quiz mit Export
5. **Share**: Lade auf GitHub Pages oder send den Link
6. **Play**: Moderiere dein Jeopardy-Spiel!

---

**Viel Spaß! 🎮🏁**

Version: 1.0 | April 2026
