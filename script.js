const app = {
    /**
     * Speichert den aktuellen Spielstand als JSON-Datei.
     * Fragt nach Dateinamen (Default: quizwall-YYYY-MM-DD_HH-MM-SS.json)
     */
    saveCurrentGame() {
        if (!this.state.game) {
            alert('Kein Spielstand vorhanden!');
            return;
        }
        // Default-Filename erzeugen
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const defName = `quizwall-${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.json`;
        let filename = prompt('Dateiname für den Spielstand:', defName);
        if (!filename) return;
        if (!filename.endsWith('.json')) filename += '.json';
        const data = {
            game: {
                ...this.state.game,
                categories: this.state.editor.categories // Kategorien mit abspeichern
            },
            played: Array.from(this.state.playedQuestions),
            quizTitle: this.state.quizTitle
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        }, 200);
    },
        // Neuer Ablauf für Fragenkarten
        startQuestionFlow(category, question, qId) {
            if (this.state.playedQuestions.has(qId)) return;
            this.state.currentQuestion = { ...question, qId, categoryIndex: category.id };
            // Schritt 1: Frage anzeigen
            this.showQuestionModal(question.question, () => {
                // Schritt 2: Antwort + Team-Auswahl anzeigen (Punktevergabe erfolgt dort)
                this.showAnswerModal(question.answer, () => {
                    // Schritt 3: Ranking anzeigen
                    this.showRankingModal(() => {
                        // Schritt 4: Zurück zur Wand
                        this.state.playedQuestions.add(qId);
                        this.renderQuizBoard();
                        this.updateRanking();
                    });
                });
            });
        },

        showQuestionModal(questionText, onNext) {
            this.createSimpleModal('Frage', questionText, 'Weiter', onNext);
        },

        showAnswerModal(answerText, onNext) {
            // Modal mit Antworttext, Team-Auswahl und Weiter-Button
            const modal = this.createModal('Antwort');
            const content = document.createElement('div');
            content.className = 'answer-text';
            content.textContent = answerText;
            modal.content.appendChild(content);
            // Team-Auswahl direkt darunter
            const info = document.createElement('div');
            info.textContent = 'Welche Teams haben richtig geantwortet?';
            info.style.fontSize = '1.3rem';
            info.style.margin = '1.2rem 0 0.5rem 0';
            modal.content.appendChild(info);
            const teamList = document.createElement('div');
            teamList.style.display = 'flex';
            teamList.style.flexDirection = 'column';
            teamList.style.gap = '0.7rem';
            teamList.style.marginBottom = '1.5rem';
            const selectedTeams = new Set();
            this.state.game.teams.forEach(team => {
                const label = document.createElement('label');
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.gap = '0.7rem';
                label.style.fontSize = '1.3rem';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = team.id;
                checkbox.onchange = (e) => {
                    if (e.target.checked) selectedTeams.add(team.id);
                    else selectedTeams.delete(team.id);
                };
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(team.name));
                teamList.appendChild(label);
            });
            modal.content.appendChild(teamList);
            // Weiter-Button
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.style.fontSize = '1.4rem';
            btn.style.marginTop = '1.2rem';
            btn.textContent = 'Weiter';
            btn.onclick = () => {
                this.state.game.teams.forEach(team => {
                    if (selectedTeams.has(team.id)) {
                        team.score += this.state.currentQuestion.points;
                    }
                });
                this.state.playedQuestions.add(this.state.currentQuestion.qId);
                this.saveGameState();
                modal.close();
                if (onNext) onNext();
            };
            modal.content.appendChild(btn);
        },

        showTeamSelectModal(qId, points, onNext) {
            const modal = this.createModal('Punkte vergeben');
            const info = document.createElement('div');
            info.textContent = 'Welche Teams haben richtig geantwortet?';
            modal.content.appendChild(info);
            const teamList = document.createElement('div');
            teamList.style.display = 'flex';
            teamList.style.flexDirection = 'column';
            teamList.style.gap = '0.5rem';
            const selectedTeams = new Set();
            this.state.game.teams.forEach(team => {
                const label = document.createElement('label');
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.gap = '0.5rem';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = team.id;
                checkbox.onchange = (e) => {
                    if (e.target.checked) selectedTeams.add(team.id);
                    else selectedTeams.delete(team.id);
                };
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(team.name));
                teamList.appendChild(label);
            });
            modal.content.appendChild(teamList);
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = 'Weiter';
            btn.onclick = () => {
                this.state.game.teams.forEach(team => {
                    if (selectedTeams.has(team.id)) {
                        team.score += points;
                    }
                });
                this.state.playedQuestions.add(qId);
                this.saveGameState();
                modal.close();
                if (onNext) onNext();
            };
            modal.content.appendChild(btn);
        },

        showRankingModal(onNext) {
            const modal = this.createModal('Aktuelles Ranking');
            const sorted = [...this.state.game.teams].sort((a, b) => b.score - a.score);
            const list = document.createElement('div');
            list.className = 'ranking-list';
            sorted.forEach((t, idx) => {
                const li = document.createElement('div');
                li.className = 'ranking-item';
                li.innerHTML = `<span>${idx+1}. ${t.name}</span><strong>${t.score}</strong>`;
                list.appendChild(li);
            });
            modal.content.appendChild(list);
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = 'Weiter';
            btn.onclick = () => {
                modal.close();
                if (onNext) onNext();
            };
            modal.content.appendChild(btn);
        },

        createSimpleModal(title, text, buttonText, onNext) {
            const modal = this.createModal(title);
            const content = document.createElement('div');
            content.style.margin = '1.5rem 0';
            content.textContent = text;
            modal.content.appendChild(content);
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = buttonText;
            btn.onclick = () => { modal.close(); if (onNext) onNext(); };
            modal.content.appendChild(btn);
        },

        createModal(title) {
            document.querySelectorAll('.custom-modal').forEach(m => m.remove());
            const modalBg = document.createElement('div');
            modalBg.className = 'custom-modal';
            modalBg.style.position = 'fixed';
            modalBg.style.top = '0';
            modalBg.style.left = '0';
            modalBg.style.width = '100vw';
            modalBg.style.height = '100vh';
            modalBg.style.background = 'rgba(0,0,0,0.5)';
            modalBg.style.display = 'flex';
            modalBg.style.alignItems = 'center';
            modalBg.style.justifyContent = 'center';
            modalBg.style.zIndex = '9999';
            const modal = document.createElement('div');
            modal.style.background = '#fff';
            modal.style.padding = '2rem';
            modal.style.borderRadius = '1rem';
            modal.style.maxWidth = '500px';
            modal.style.width = '90vw';
            modal.style.boxShadow = '0 10px 40px rgba(0,0,0,0.25)';
            const h2 = document.createElement('h2');
            h2.textContent = title;
            h2.style.color = 'var(--primary-color)';
            modal.appendChild(h2);
            const content = document.createElement('div');
            modal.appendChild(content);
            modalBg.appendChild(modal);
            document.body.appendChild(modalBg);
            modalBg.addEventListener('click', (e) => {
                if (e.target === modalBg) {
                    modalBg.remove();
                }
            });
            return {
                content,
                close: () => modalBg.remove()
            };
        },
    state: {
        currentScreenId: 'startMenu',
        quizTitle: 'Quiz Wall',
        game: null, // Aktives Spiel mit Teams und Fortschritt
        editor: {
            categories: (typeof defaultQuizData !== 'undefined') ? defaultQuizData.categories : [],
            teams: []
        },
        playedQuestions: new Set(),
        currentQuestion: null
    },

    // ============ INITIALISIERUNG ============
    init() {
        console.log("Quiz Wall wird gestartet...");
        this.loadColorSettings();
        this.loadGameState();
        this.showScreen('startMenu');
        this.updateQuizInfo();
    },

    // ============ SCREEN MANAGEMENT ============
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(screenId);
        if (target) target.classList.remove('hidden');
        this.state.currentScreenId = screenId;
    },

    goToStartMenu() {
        this.showScreen('startMenu');
        this.updateQuizInfo();
    },

    updateQuizInfo() {
        const info = document.getElementById('quizInfo');
        if (!info) return;
        if (!this.state.editor.categories || this.state.editor.categories.length === 0) {
            info.textContent = 'ℹ️ Kein Quiz geladen';
            return;
        }
        if (!this.state.game) {
            info.textContent = 'ℹ️ Kein Spielstand geladen';
            return;
        }
        info.innerHTML = `✅ <strong>${this.state.quizTitle}</strong> geladen (${this.state.editor.categories.length} Kategorien)`;
    },

    // ============ GAMEPLAY & NAVIGATION ============
    continueGame() {
        if (!this.state.game) {
            this.showScreen('teamSetup');
            this.renderTeamSetup();
            return;
        }
        this.showScreen('quizWall');
        this.renderQuizBoard();
        this.updateRanking();
    },

    showNewGameSetup() {
        this.showScreen('gameSetup');
        this.renderGameSetup();
    },

    renderGameSetup() {
        const container = document.getElementById('teamNamesContainer');
        const count = parseInt(document.getElementById('teamCount').value);
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `team-${i}`;
            input.placeholder = `Team ${i + 1}`;
            input.className = 'team-name-input';
            container.appendChild(input);
        }
    },

    createNewGame() {
        const count = parseInt(document.getElementById('teamCount').value);
        const teams = [];
        for (let i = 0; i < count; i++) {
            const name = document.getElementById(`team-${i}`).value || `Team ${i + 1}`;
            teams.push({ id: i, name: name, score: 0 });
        }

        this.state.game = {
            teams: teams,
            playedQuestions: []
        };
        
        this.state.playedQuestions = new Set();
        this.saveGameState();
        this.continueGame();
    },

    // ============ QUIZ VERWALTUNG ============
    loadDefaultQuiz() {
        if (typeof defaultQuizData !== 'undefined') {
            this.state.editor.categories = defaultQuizData.categories;
            this.state.quizTitle = 'Demo-Quiz';
            this.state.game = null;
            this.state.playedQuestions = new Set();
            this.saveGameState();
            this.updateQuizInfo();
            alert('Demo-Quiz geladen!');
        } else {
            alert('Demo-Quiz konnte nicht geladen werden.');
        }
    },

    resetQuiz() {
        this.state.editor.categories = [];
        this.state.quizTitle = 'Quiz Wall';
        this.state.game = null;
        this.state.playedQuestions = new Set();
        this.saveGameState();
        this.updateQuizInfo();
        alert('Quiz wurde zurückgesetzt.');
    },

    // ============ QUIZ BOARD ============
    renderQuizBoard() {
        const board = document.getElementById('quizBoard');
        const header = document.getElementById('categoryHeader');
        const titleDisplay = document.getElementById('quizTitleDisplay');
        if (titleDisplay) titleDisplay.textContent = this.state.quizTitle || 'Quiz Wall';
        if (!board || !header) return;

        board.innerHTML = '';
        header.innerHTML = '';

        const categories = this.state.editor.categories;
        if (!categories || categories.length === 0) return;

        // Setze CSS-Variable für Grid-Spalten
        const root = document.documentElement;
        root.style.setProperty('--category-count', categories.length);

        // Header als Grid
        categories.forEach((cat) => {
            const hDiv = document.createElement('div');
            hDiv.className = 'column-header';
            hDiv.textContent = cat.name;
            header.appendChild(hDiv);
        });

        // Quiz-Board als Grid (Spalten = Kategorien, Zeilen = Fragen)
        // (Grid-Template wird jetzt per CSS gesetzt)

        // Finde maximale Fragenanzahl pro Kategorie
        const maxQuestions = Math.max(...categories.map(cat => cat.questions.length));

        // Für jede Zeile (Fragen-Level)
        for (let qIdx = 0; qIdx < maxQuestions; qIdx++) {
            for (let cIdx = 0; cIdx < categories.length; cIdx++) {
                const cat = categories[cIdx];
                const q = cat.questions[qIdx];
                if (q) {
                    const qId = `q-${cIdx}-${qIdx}`;
                    const btn = document.createElement('div');
                    btn.className = 'quiz-card';
                    if (this.state.playedQuestions.has(qId)) btn.classList.add('disabled');
                    btn.innerHTML = `<span class=\"points\">${q.points}</span>`;
                    btn.onclick = () => this.startQuestionFlow(cat, q, qId);
                    board.appendChild(btn);
                } else {
                    // Leeres Feld, falls Kategorie weniger Fragen hat
                    const empty = document.createElement('div');
                    empty.className = 'quiz-card';
                    empty.style.visibility = 'hidden';
                    board.appendChild(empty);
                }
            }
        }
    },


    updateRanking() {
        // Haupt-Ranking (z.B. für Ranking-Screen)
        const list = document.getElementById('rankingList');
        if (list) {
            list.innerHTML = '';
            const sorted = [...this.state.game.teams].sort((a, b) => b.score - a.score);
            sorted.forEach(t => {
                const li = document.createElement('div');
                li.className = 'ranking-item';
                li.innerHTML = `<span>${t.name}</span><strong>${t.score}</strong>`;
                list.appendChild(li);
            });
        }
        // Sidebar-Ranking (Quizwand)
        const sidebar = document.getElementById('sidebarRankingList');
        if (sidebar) {
            sidebar.innerHTML = '';
            const sorted = [...this.state.game.teams].sort((a, b) => b.score - a.score);
            sorted.forEach(t => {
                const li = document.createElement('div');
                li.className = 'ranking-item';
                li.innerHTML = `<span>${t.name}</span><strong>${t.score}</strong>`;
                sidebar.appendChild(li);
            });
        }
    },

    // ============ EDITOR ============
    showEditor() {
        // Teams aus aktuellem Spielstand übernehmen, falls vorhanden
        if (this.state.game && Array.isArray(this.state.game.teams)) {
            this.state.editor.teams = this.state.game.teams.map(t => ({ name: t.name }));
        }
        this.showScreen('editor');
        this.renderEditor();
    },

    renderEditor() {
        // Quiz-Titel setzen
        document.getElementById('quizTitle').value = this.state.quizTitle;
        // Kategorien anzeigen
        this.renderCategoryList();
        // Teams anzeigen
        this.renderTeamsList();
        // Fragenbereich leeren
        document.getElementById('selectedCategoryTitle').textContent = 'Wähle eine Kategorie';
        document.getElementById('questionsList').innerHTML = '';
    },

    renderCategoryList() {
        const list = document.getElementById('categoryList');
        list.innerHTML = '';
        this.state.editor.categories.forEach((cat, idx) => {
            const div = document.createElement('div');
            div.className = 'category-item';
            div.textContent = cat.name;
            div.onclick = () => this.selectCategory(idx);
            list.appendChild(div);
        });
    },

    renderTeamsList() {
        const list = document.getElementById('teamsList');
        list.innerHTML = '';
        (this.state.editor.teams || []).forEach((team, idx) => {
            const div = document.createElement('div');
            div.className = 'team-item';
            div.textContent = team.name || `Team ${idx+1}`;
            // Eingabefeld für Teamnamen
            const input = document.createElement('input');
            input.type = 'text';
            input.value = team.name || `Team ${idx+1}`;
            input.className = 'team-name-input';
            input.oninput = (e) => {
                this.state.editor.teams[idx].name = e.target.value;
            };
            div.appendChild(input);
            list.appendChild(div);
        });
    },

    selectCategory(idx) {
        const cat = this.state.editor.categories[idx];
        document.getElementById('selectedCategoryTitle').textContent = cat.name;
        const qList = document.getElementById('questionsList');
        qList.innerHTML = '';
        cat.questions.forEach((q, qIdx) => {
            const div = document.createElement('div');
            div.className = 'question-item';
            div.innerHTML = `<strong>${q.points}:</strong> ${q.question}`;
            qList.appendChild(div);
        });
    },

    // ============ EINSTELLUNGEN & FARBEN ============
    showSettings() { this.showScreen('settings'); },

    applyColorSettings() {
        const p = document.getElementById('primaryColor').value;
        const b = document.getElementById('backgroundColor').value;
        const t = document.getElementById('textColor').value;
        
        localStorage.setItem('quiz_primary', p);
        localStorage.setItem('quiz_bg', b);
        localStorage.setItem('quiz_text', t);
        
        this.loadColorSettings();
        alert("Farben gespeichert!");
    },

    loadColorSettings() {
        const root = document.documentElement;
        if (localStorage.getItem('quiz_primary')) {
            root.style.setProperty('--primary-color', localStorage.getItem('quiz_primary'));
            root.style.setProperty('--background-color', localStorage.getItem('quiz_bg'));
            root.style.setProperty('--text-color', localStorage.getItem('quiz_text'));
        }
    },

    resetColorSettings() {
        localStorage.removeItem('quiz_primary');
        localStorage.removeItem('quiz_bg');
        localStorage.removeItem('quiz_text');
        location.reload();
    },

    // ============ PERSISTENZ ============
    saveGameState() {
        const data = {
            game: this.state.game,
            played: Array.from(this.state.playedQuestions),
            quizTitle: this.state.quizTitle
        };
        localStorage.setItem('quizwall_game', JSON.stringify(data));
    },

    loadGameState() {
        const data = localStorage.getItem('quizwall_game');
        if (data) {
            const parsed = JSON.parse(data);
            // Teams und Punkte übernehmen
            if (parsed.game && parsed.game.teams) {
                this.state.game = {
                    teams: parsed.game.teams.map(t => ({ id: t.id, name: t.name, score: t.score || 0 })),
                };
            } else {
                this.state.game = null;
            }
            // Gespielte Fragen übernehmen
            this.state.playedQuestions = new Set(parsed.played || []);
            // Quiz-Titel übernehmen
            this.state.quizTitle = parsed.quizTitle || 'Quiz Wall';
            // Quizdaten (Kategorien/Fragen) übernehmen, falls vorhanden
            if (parsed.game && parsed.game.categories) {
                this.state.editor.categories = parsed.game.categories;
            }
            // Nach dem Laden alles neu rendern
            this.renderQuizBoard();
            this.updateRanking();
        }
    }
};

// ============ INITIALISIERUNG ============
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

app.renderTeamSetup = function() {
    this.state.editor.categories = [];
    this.state.editor.teams = [];
    const origRenderTeamSetup = app.renderTeamSetup;
    origRenderTeamSetup.call(this);
};

app.editor = {
    addTeam() {
        if (!app.state.editor.teams) app.state.editor.teams = [];
        app.state.editor.teams.push({ name: `Team ${app.state.editor.teams.length + 1}` });
        app.renderTeamsList();
    },
    saveAndPlay() {
        // Teams aus Editor übernehmen
        if (!app.state.editor.teams || app.state.editor.teams.length < 2) {
            alert('Bitte mindestens 2 Teams anlegen!');
            return;
        }
        app.state.game = {
            teams: app.state.editor.teams.map((t, i) => ({ id: i, name: t.name || `Team ${i+1}`, score: 0 })),
            playedQuestions: []
        };
        app.state.playedQuestions = new Set();
        app.showScreen('quizWall');
        app.renderQuizBoard();
        app.updateRanking();
    }
};

// QuizWall-Überschrift aktualisieren
document.getElementById('quizTitleDisplay').textContent = app.state.quizTitle;

// Fallback: Wenn keine Kategorien vorhanden sind, Demo-Quiz laden
        if (!this.state.editor.categories || this.state.editor.categories.length === 0) {
            if (typeof defaultQuizData !== 'undefined') {
                this.state.editor.categories = defaultQuizData.categories;
                this.state.quizTitle = 'Demo-Quiz';
            }
        }

// ============ SPIELSTAND LADEN (FILE UPLOAD) ============
app.handleGameUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            // Spielstand in localStorage speichern und laden
            localStorage.setItem('quizwall_game', JSON.stringify(data));
            this.loadGameState();
            alert('Spielstand erfolgreich geladen!');
        } catch (err) {
            alert('Fehler beim Laden des Spielstands: ' + err.message);
        }
    };
    reader.readAsText(file);
};

// ============ SPIELSTAND ZURÜCKSETZEN ============
app.resetGame = function() {
    if (!confirm('Möchtest du den aktuellen Spielstand wirklich zurücksetzen?')) return;
    this.state.game = null;
    this.state.playedQuestions = new Set();
    this.clearEditorState();
    this.state.quizTitle = 'Quiz Wall';
    localStorage.removeItem('quizwall_game');
    this.saveGameState();
    this.renderQuizBoard();
    this.updateRanking();
    this.goToStartMenu();
};

// Editor-Daten komplett leeren
app.clearEditorState = function() {
    this.state.editor.categories = [];
    this.state.editor.teams = [];
};

// ResetGame leert alles und speichert den Zustand
app.resetGame = function() {
    if (!confirm('Möchtest du den aktuellen Spielstand wirklich zurücksetzen?')) return;
    this.state.game = null;
    this.state.playedQuestions = new Set();
    this.clearEditorState();
    this.state.quizTitle = 'Quiz Wall';
    localStorage.removeItem('quizwall_game');
    this.saveGameState();
    this.renderQuizBoard();
    this.updateRanking();
    this.goToStartMenu();
};

// Editor-Daten beim Start eines neuen Spiels immer leeren
const origShowNewGameSetup = app.showNewGameSetup;
app.showNewGameSetup = function() {
    this.clearEditorState();
    origShowNewGameSetup.call(this);
};

const origRenderTeamSetup = app.renderTeamSetup;
app.renderTeamSetup = function() {
    this.clearEditorState();
    origRenderTeamSetup.call(this);
};

// App-Objekt global verfügbar machen
window.app = app;