/**
 * Quiz Wall - Vollständige Spiellogik
 */
const app = {
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
        const cats = this.state.editor.categories;
        if (!cats || cats.length === 0) {
            info.textContent = 'ℹ️ Kein Quiz geladen';
        } else {
            info.innerHTML = `✅ <strong>${this.state.quizTitle}</strong> geladen (${cats.length} Kategorien)`;
        }
    },

    // ============ GAMEPLAY & NAVIGATION ============
    continueGame() {
        if (!this.state.game) {
            alert("Kein aktiver Spielstand gefunden. Bitte starte ein 'Neues Spiel'.");
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

    // ============ QUIZ BOARD ============
    renderQuizBoard() {
        const board = document.getElementById('quizBoard');
        const header = document.getElementById('categoryHeader');
        if (!board || !header) return;

        board.innerHTML = '';
        header.innerHTML = '';

        const categories = this.state.editor.categories;
        board.style.gridTemplateColumns = `repeat(${categories.length}, 1fr)`;
        header.style.gridTemplateColumns = `repeat(${categories.length}, 1fr)`;

        categories.forEach((cat, cIdx) => {
            // Header
            const hDiv = document.createElement('div');
            hDiv.className = 'category-title';
            hDiv.textContent = cat.name;
            header.appendChild(hDiv);

            // Fragen-Spalte
            cat.questions.forEach((q, qIdx) => {
                const qId = `q-${cIdx}-${qIdx}`;
                const btn = document.createElement('div');
                btn.className = 'quiz-card';
                if (this.state.playedQuestions.has(qId)) btn.classList.add('played');
                
                btn.innerHTML = `<span class="points">${q.points}</span>`;
                btn.onclick = () => this.openQuestion(cat, q, qId);
                board.appendChild(btn);
            });
        });
    },

    openQuestion(category, question, qId) {
        if (this.state.playedQuestions.has(qId)) return;
        
        this.state.currentQuestion = { ...question, qId };
        document.getElementById('modalQuestionText').textContent = question.question;
        document.getElementById('modalAnswerText').textContent = question.answer;
        document.getElementById('modalAnswerText').classList.add('hidden');
        
        // Team-Buttons im Modal generieren
        const teamBtns = document.getElementById('teamButtons');
        teamBtns.innerHTML = '';
        this.state.game.teams.forEach(team => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = `+ ${team.name}`;
            btn.onclick = () => this.awardPoints(team.id);
            teamBtns.appendChild(btn);
        });

        document.getElementById('questionModal').classList.remove('hidden');
    },

    showAnswer() {
        document.getElementById('modalAnswerText').classList.remove('hidden');
    },

    awardPoints(teamId) {
        const team = this.state.game.teams.find(t => t.id === teamId);
        if (team && this.state.currentQuestion) {
            team.score += this.state.currentQuestion.points;
            this.state.playedQuestions.add(this.state.currentQuestion.qId);
            this.closeModal();
            this.renderQuizBoard();
            this.updateRanking();
            this.saveGameState();
        }
    },

    skipQuestion() {
        if (this.state.currentQuestion) {
            this.state.playedQuestions.add(this.state.currentQuestion.qId);
            this.closeModal();
            this.renderQuizBoard();
            this.saveGameState();
        }
    },

    closeModal() {
        document.getElementById('questionModal').classList.add('hidden');
        this.state.currentQuestion = null;
    },

    updateRanking() {
        const list = document.getElementById('rankingList');
        if (!list) return;
        list.innerHTML = '';
        const sorted = [...this.state.game.teams].sort((a, b) => b.score - a.score);
        sorted.forEach(t => {
            const li = document.createElement('div');
            li.className = 'ranking-item';
            li.innerHTML = `<span>${t.name}</span><strong>${t.score}</strong>`;
            list.appendChild(li);
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
            title: this