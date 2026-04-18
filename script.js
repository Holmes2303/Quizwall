const app = {
    /**
     * Speichert den aktuellen Spielstand als JSON-Datei.
     * Fragt nach Dateinamen (Default-Basisname) und erzwingt .game.json
     */
    saveCurrentGame() {
        if (!this.state.game) {
            alert('Kein Spielstand vorhanden!');
            return;
        }
        // Default-Filename erzeugen
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const defaultBase = `quizwall-${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        const input = prompt('Dateiname fuer den Spielstand (ohne Endung):', defaultBase);
        if (input === null) return;

        const baseName = (input || defaultBase)
            .trim()
            .replace(/\.(game\.)?json$/i, '')
            .replace(/\.quiz$/i, '') || defaultBase;

        const filename = `${baseName}.game.json`;
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
            this.createSimpleModal('Frage', questionText, 'Weiter', onNext, { layout: 'qa', modalType: 'question' });
        },

        showAnswerModal(answerText, onNext) {
            // Modal mit Antworttext, Team-Auswahl und Weiter-Button
            const modal = this.createModal('Antwort', { layout: 'qa' });
            const modalRoot = modal.content.closest('.custom-modal');
            modalRoot?.classList.add('custom-modal-answer');
            const body = document.createElement('div');
            body.className = 'qa-modal-body';

            const content = document.createElement('div');
            content.className = 'answer-text';
            content.textContent = answerText;
            body.appendChild(content);

            const teamSection = document.createElement('div');
            teamSection.className = 'qa-team-section';

            // Team-Auswahl direkt darunter
            const info = document.createElement('div');
            info.className = 'qa-modal-info';
            info.textContent = 'Welche Teams haben richtig geantwortet?';
            teamSection.appendChild(info);

            const teamList = document.createElement('div');
            teamList.className = 'qa-team-list';
            const selectedTeams = new Set();
            this.state.game.teams.forEach(team => {
                const label = document.createElement('label');
                label.className = 'qa-team-row';
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

            this.applyQaModalSizing(modalRoot, {
                modalType: 'answer',
                teamCount: this.state.game.teams.length
            });
            teamSection.appendChild(teamList);
            body.appendChild(teamSection);
            modal.content.appendChild(body);

            // Weiter-Button
            const actions = document.createElement('div');
            actions.className = 'qa-modal-actions';

            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
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
            actions.appendChild(btn);
            modal.content.appendChild(actions);
        },

        applyQaModalSizing(modalRoot, { modalType = 'question', teamCount = 0 } = {}) {
            if (!modalRoot) return;

            const isMobile = window.matchMedia('(max-width: 768px)').matches
                || window.matchMedia('(hover: none) and (pointer: coarse)').matches;
            if (!isMobile) return;

            if (modalType === 'question') {
                modalRoot.classList.add('custom-modal-question');
            }

            const viewportHeight = window.innerHeight;
            const isLandscape = window.matchMedia('(orientation: landscape)').matches;
            const hideTitle = viewportHeight <= 520 || (isLandscape && viewportHeight <= 620);
            modalRoot.classList.toggle('compact-no-title', hideTitle);

            const teamColumns = modalType === 'answer'
                ? (isLandscape ? (teamCount >= 6 ? 3 : 2) : 1)
                : 1;

            const targetHeight = viewportHeight * 0.8;
            const titleAllowance = hideTitle ? 0 : 52;
            const actionAllowance = 56;
            const frameAllowance = modalType === 'answer' ? 118 : 98;
            const usableHeight = Math.max(180, targetHeight - titleAllowance - actionAllowance - frameAllowance);

            const contentScale = modalType === 'answer'
                ? usableHeight / Math.max(2, Math.ceil(teamCount / teamColumns) + 3)
                : usableHeight / 4.2;

            const contentFont = Math.max(15, Math.min(31, contentScale * (modalType === 'answer' ? 0.78 : 0.95)));
            const infoFont = Math.max(13, Math.min(20, contentFont * 0.74));
            const teamFont = Math.max(13, Math.min(21, contentFont * 0.7));
            const buttonFont = Math.max(13, Math.min(18, contentFont * 0.68));

            modalRoot.style.setProperty('--qa-card-height', '82vh');
            modalRoot.style.setProperty('--qa-title-font-size', `${Math.max(18, Math.min(30, contentFont * 1.02))}px`);
            modalRoot.style.setProperty('--qa-content-font-size', `${contentFont}px`);
            modalRoot.style.setProperty('--qa-info-font-size', `${infoFont}px`);
            modalRoot.style.setProperty('--qa-team-font-size', `${teamFont}px`);
            modalRoot.style.setProperty('--qa-button-font-size', `${buttonFont}px`);
            modalRoot.style.setProperty('--qa-team-columns', teamColumns === 1 ? '1fr' : `repeat(${teamColumns}, minmax(0, 1fr))`);
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
            if (!this.hasActiveGame()) {
                this.createSimpleModal('Ranking', 'Kein aktives Spiel vorhanden.', 'Schliessen');
                return;
            }

            const modal = this.createModal('Aktuelles Ranking', { layout: 'qa' });
            const modalRoot = modal.content.closest('.custom-modal');
            modalRoot?.classList.add('custom-modal-ranking');
            const body = document.createElement('div');
            body.className = 'qa-modal-body';

            const sorted = [...this.state.game.teams].sort((a, b) => b.score - a.score);
            this.applyRankingModalSizing(modalRoot, sorted.length);
            const list = document.createElement('div');
            list.className = 'ranking-list';
            sorted.forEach((t, idx) => {
                const li = document.createElement('div');
                li.className = 'ranking-item';
                li.innerHTML = `<span>${idx+1}. ${t.name}</span><strong>${t.score}</strong>`;
                list.appendChild(li);
            });

            body.appendChild(list);
            modal.content.appendChild(body);

            const actions = document.createElement('div');
            actions.className = 'qa-modal-actions';
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = typeof onNext === 'function' ? 'Weiter' : 'Schliessen';
            btn.onclick = () => {
                modal.close();
                if (onNext) onNext();
            };

            actions.appendChild(btn);
            modal.content.appendChild(actions);
        },

        applyRankingModalSizing(modalRoot, teamCount) {
            if (!modalRoot) return;

            const isMobile = window.matchMedia('(max-width: 768px)').matches
                || window.matchMedia('(hover: none) and (pointer: coarse)').matches;
            if (!isMobile) return;

            const viewportHeight = window.innerHeight;
            const isLandscape = window.matchMedia('(orientation: landscape)').matches;
            const hideTitle = isLandscape && viewportHeight <= 520;
            modalRoot.classList.toggle('compact-no-title', hideTitle);

            const targetHeight = viewportHeight * 0.8;
            const titleAllowance = hideTitle ? 0 : 56;
            const actionAllowance = 56;
            const frameAllowance = 110;
            const availableRowsHeight = Math.max(140, targetHeight - titleAllowance - actionAllowance - frameAllowance);
            const rowHeight = availableRowsHeight / Math.max(teamCount, 1);

            const itemFontSize = Math.max(14, Math.min(22, rowHeight * 0.48));
            const scoreFontSize = Math.max(itemFontSize, Math.min(24, itemFontSize + 2));
            const padY = Math.max(6, Math.min(12, rowHeight * 0.22));
            const padX = Math.max(8, Math.min(14, rowHeight * 0.35));

            modalRoot.style.setProperty('--ranking-card-height', '82vh');
            modalRoot.style.setProperty('--ranking-item-font-size', `${itemFontSize}px`);
            modalRoot.style.setProperty('--ranking-score-font-size', `${scoreFontSize}px`);
            modalRoot.style.setProperty('--ranking-item-pad-y', `${padY}px`);
            modalRoot.style.setProperty('--ranking-item-pad-x', `${padX}px`);
        },

        showMobileRankingPopup() {
            this.showRankingModal();
        },

        createSimpleModal(title, text, buttonText, onNext, options = {}) {
            const modal = this.createModal(title, options);

            if (options.layout === 'qa') {
                const modalRoot = modal.content.closest('.custom-modal');
                if (options.modalType === 'question') {
                    this.applyQaModalSizing(modalRoot, { modalType: 'question' });
                }

                const body = document.createElement('div');
                body.className = 'qa-modal-body';

                const content = document.createElement('div');
                content.className = 'question-text';
                content.textContent = text;
                body.appendChild(content);
                modal.content.appendChild(body);

                const actions = document.createElement('div');
                actions.className = 'qa-modal-actions';
                const btn = document.createElement('button');
                btn.className = 'btn btn-primary';
                btn.textContent = buttonText;
                btn.onclick = () => { modal.close(); if (onNext) onNext(); };
                actions.appendChild(btn);
                modal.content.appendChild(actions);
                return;
            }

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

        createModal(title, options = {}) {
            document.querySelectorAll('.custom-modal').forEach(m => m.remove());
            const modalBg = document.createElement('div');
            modalBg.className = 'custom-modal';
            if (options.layout === 'qa') {
                modalBg.classList.add('custom-modal-qa');
            }
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
            if (options.layout === 'qa') {
                modal.classList.add('custom-modal-card-qa');
            }
            modal.style.background = '#fff';
            modal.style.padding = '2rem';
            modal.style.borderRadius = '1rem';
            modal.style.maxWidth = '500px';
            modal.style.width = '90vw';
            modal.style.boxShadow = '0 10px 40px rgba(0,0,0,0.25)';

            if (options.layout === 'qa') {
                modal.style.width = '80vw';
                modal.style.height = '80vh';
                modal.style.maxWidth = 'none';
                modal.style.maxHeight = 'none';
                modal.style.display = 'flex';
                modal.style.flexDirection = 'column';
                modal.style.overflow = 'hidden';
            }

            const h2 = document.createElement('h2');
            h2.textContent = title;
            h2.style.color = 'var(--primary-color)';
            modal.appendChild(h2);
            const content = document.createElement('div');
            if (options.layout === 'qa') {
                content.classList.add('custom-modal-content-qa');
                content.style.display = 'flex';
                content.style.flexDirection = 'column';
                content.style.flex = '1';
                content.style.minHeight = '0';
            }
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
        selectedCategoryIndex: null,
        quickTeamNames: [],
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
        this.bindStaticUiHandlers();
        this.bindResponsiveUiHandlers();
        this.showScreen('startMenu');
        this.updateQuizInfo();
    },

    bindResponsiveUiHandlers() {
        const update = () => this.updateQuizWallResponsiveUi();
        window.addEventListener('resize', update, { passive: true });
        window.addEventListener('orientationchange', update, { passive: true });
        update();
    },

    isCompactLayout() {
        return window.matchMedia('(max-width: 1199px)').matches
            || window.matchMedia('(max-height: 700px)').matches
            || window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    },

    updateLayoutModeClasses() {
        const root = document.documentElement;
        const isCompact = this.isCompactLayout();
        const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        const isLandscape = window.matchMedia('(orientation: landscape)').matches;

        root.classList.toggle('layout-compact', isCompact);
        root.classList.toggle('layout-desktop', !isCompact);
        root.classList.toggle('input-touch', isTouch);
        root.classList.toggle('input-fine', !isTouch);
        root.classList.toggle('viewport-landscape', isLandscape);
        root.classList.toggle('viewport-portrait', !isLandscape);
    },

    updateQuizWallResponsiveUi() {
        const sidebar = document.getElementById('quizSidebar');
        const fabStack = document.querySelector('.mobile-fab-stack');
        const isCompact = this.isCompactLayout();

        this.updateLayoutModeClasses();

        if (sidebar) {
            sidebar.classList.toggle('mobile-hidden', isCompact);
        }

        if (fabStack) {
            fabStack.classList.toggle('is-visible', isCompact);
        }
    },

    bindStaticUiHandlers() {
        const resetBtn = document.getElementById('resetGameButton');
        if (resetBtn) {
            // Inline-onclick bleibt als Fallback bestehen; Listener stellt robuste Ausfuehrung sicher.
            resetBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.resetGame();
            });
        }

        const teamCountQuick = document.getElementById('teamCountQuick');
        if (teamCountQuick) {
            teamCountQuick.addEventListener('change', () => this.renderTeamSetup());
            teamCountQuick.addEventListener('input', () => this.renderTeamSetup());
        }

        const startQuickGame = document.getElementById('startQuickGame');
        if (startQuickGame) {
            startQuickGame.addEventListener('click', () => this.startGameFromTeamSetup());
        }

        const cancelQuickGame = document.getElementById('cancelQuickGame');
        if (cancelQuickGame) {
            cancelQuickGame.addEventListener('click', () => this.goToStartMenu());
        }
    },

    // ============ SCREEN MANAGEMENT ============
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(screenId);
        if (target) target.classList.remove('hidden');
        this.state.currentScreenId = screenId;
        this.updateQuizWallResponsiveUi();
    },

    goToStartMenu() {
        this.showScreen('startMenu');
        this.updateQuizInfo();
    },

    showAiImportFlow() {
        if (this.hasLoadedQuiz() || this.hasActiveGame()) {
            this.showAiImportConfirmation(() => this.showAiImportScreen());
            return;
        }

        this.showAiImportScreen();
    },

    showAiImportConfirmation(onConfirm) {
        const modal = this.createModal('KI-Quiz importieren');
        const text = document.createElement('p');
        text.textContent = 'Ein importiertes KI-Quiz kann dein aktuelles Quiz und den Spielstand ersetzen. Fortfahren?';
        text.style.margin = '1rem 0 1.25rem 0';
        modal.content.appendChild(text);

        const actions = document.createElement('div');
        actions.className = 'button-group';

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-danger';
        confirmBtn.textContent = 'Ja, fortfahren';
        confirmBtn.onclick = () => {
            modal.close();
            if (typeof onConfirm === 'function') onConfirm();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Abbrechen';
        cancelBtn.onclick = () => modal.close();

        actions.appendChild(confirmBtn);
        actions.appendChild(cancelBtn);
        modal.content.appendChild(actions);
    },

    showAiImportScreen() {
        this.showScreen('aiImport');
        this.initAiImportForm();
        this.updateAiPromptPreview();
    },

    initAiImportForm() {
        const defaults = {
            aiSourceMode: 'topic',
            aiTheme: '',
            aiAudience: '',
            aiMaxQuestions: '20',
            aiCategoryMode: 'auto',
            aiPresetCategories: '',
            aiSpecialWishes: '',
            aiMaterialContext: ''
        };

        Object.entries(defaults).forEach(([id, value]) => {
            const input = document.getElementById(id);
            if (input && !input.value) input.value = value;
        });

        this.toggleAiSourceMode();
        this.toggleAiCategoryInput();
    },

    toggleAiSourceMode() {
        const mode = document.getElementById('aiSourceMode')?.value || 'topic';
        const topicFields = document.getElementById('aiTopicFields');
        const materialSection = document.getElementById('aiMaterialSection');

        if (topicFields) {
            topicFields.classList.toggle('hidden', mode !== 'topic');
        }
        if (materialSection) {
            materialSection.classList.toggle('hidden', mode !== 'material');
        }

        this.updateAiPromptPreview();
    },

    toggleAiCategoryInput() {
        const mode = document.getElementById('aiCategoryMode')?.value || 'auto';
        const section = document.getElementById('aiPresetCategoriesSection');
        if (section) {
            section.classList.toggle('hidden', mode !== 'preset');
        }

        this.updateAiPromptPreview();
    },

    buildAiPrompt() {
        const sourceMode = document.getElementById('aiSourceMode')?.value || 'topic';
        const theme = (document.getElementById('aiTheme')?.value || '').trim() || 'Allgemeinwissen';
        const audience = (document.getElementById('aiAudience')?.value || '').trim() || 'gemischte Zielgruppe';
        const maxQuestionsInput = parseInt(document.getElementById('aiMaxQuestions')?.value, 10);
        const maxQuestions = Number.isInteger(maxQuestionsInput)
            ? Math.max(4, Math.min(60, maxQuestionsInput))
            : 20;
        const categoryMode = document.getElementById('aiCategoryMode')?.value || 'auto';
        const presetRaw = (document.getElementById('aiPresetCategories')?.value || '').trim();
        const special = (document.getElementById('aiSpecialWishes')?.value || '').trim();
        const materialContext = (document.getElementById('aiMaterialContext')?.value || '').trim();

        const presetCategories = presetRaw
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        const categoryInstruction = categoryMode === 'preset' && presetCategories.length > 0
            ? `Nutze exakt diese Kategorien: ${presetCategories.join(', ')}.`
            : 'Leite selbst sinnvolle Kategorien aus dem Thema ab.';

        const specialInstruction = special
            ? `Besondere Wuensche: ${special}`
            : 'Keine besonderen Zusatzwuensche.';

        const sourceInstructions = sourceMode === 'material'
            ? [
                'Quiz-Basis: Konkretes hochgeladenes Material.',
                'Erstelle Fragen ausschliesslich auf Basis des bereitgestellten Materials.',
                'WICHTIG: Der Nutzer laedt das Material direkt in der externen KI hoch.',
                materialContext
                    ? `Material-Hinweise/Inhaltsauszuege: ${materialContext}`
                    : 'Material-Hinweise/Inhaltsauszuege: keine weiteren Angaben.',
                'Wenn Material unklar ist, treffe keine Faktenannahmen ausserhalb des Materials.'
            ]
            : [
                `Thema: ${theme}`,
                `Zielgruppe: ${audience}`
            ];

        return [
            'Du erstellst ein Quiz fuer eine Jeopardy-Quizwand.',
            'WICHTIG: Gib AUSSCHLIESSLICH gueltiges JSON zurueck. Kein Text davor oder danach.',
            '',
            ...sourceInstructions,
            `Maximale Gesamtanzahl Fragen: ${maxQuestions}`,
            categoryInstruction,
            specialInstruction,
            '',
            'Anforderungen an die Struktur:',
            '- Gib ein JSON-Objekt mit den Feldern "quizTitle" und "categories" zurueck.',
            '- "categories" ist ein Array von Kategorien.',
            '- Jede Kategorie hat: "name" (String) und "questions" (Array).',
            '- Kategorienamen kurz halten: maximal 3 Zeilen à 24 Zeichen (also hoechstens 72 Zeichen pro Kategoriename).',
            '- Jede Frage hat: "points" (Integer > 0), "question" (String), "answer" (String).',
            '- Nutze sinnvolle Punktestufen pro Kategorie (z. B. 100,200,300,400,500).',
            '- Ueberschreite die maximale Gesamtanzahl Fragen nicht.',
            '',
            'Beispielformat (Schema):',
            '{',
            '  "quizTitle": "Titel",',
            '  "categories": [',
            '    {',
            '      "name": "Kategorie 1",',
            '      "questions": [',
            '        { "points": 100, "question": "...", "answer": "..." }',
            '      ]',
            '    }',
            '  ]',
            '}'
        ].join('\n');
    },

    updateAiPromptPreview() {
        const output = document.getElementById('aiPromptOutput');
        if (!output) return;
        output.value = this.buildAiPrompt();
    },

    async copyAiPrompt() {
        const output = document.getElementById('aiPromptOutput');
        if (!output) return;

        const text = output.value;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                output.focus();
                output.select();
                document.execCommand('copy');
            }
            alert('Prompt wurde in die Zwischenablage kopiert.');
        } catch (err) {
            alert('Kopieren fehlgeschlagen. Bitte Prompt manuell kopieren.');
        }
    },

    extractJsonFromAiResponse(rawText) {
        const text = (rawText || '').trim();
        if (!text) {
            throw new Error('Bitte fuege zuerst eine KI-Antwort ein.');
        }

        const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fencedMatch && fencedMatch[1]) {
            return fencedMatch[1].trim();
        }

        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) {
            throw new Error('Kein gueltiges JSON-Objekt in der KI-Antwort gefunden.');
        }

        return text.slice(start, end + 1);
    },

    normalizeImportedQuiz(parsed) {
        const categoriesSource = Array.isArray(parsed.categories)
            ? parsed.categories
            : (parsed.quiz && Array.isArray(parsed.quiz.categories)
                ? parsed.quiz.categories
                : (parsed.game && Array.isArray(parsed.game.categories)
                    ? parsed.game.categories
                    : null));

        if (!categoriesSource || categoriesSource.length === 0) {
            throw new Error('Die KI-Antwort enthaelt keine gueltigen Kategorien.');
        }

        const categories = categoriesSource.map((cat, cIdx) => {
            const name = (cat && typeof cat.name === 'string' && cat.name.trim())
                ? cat.name.trim()
                : `Kategorie ${cIdx + 1}`;

            const sourceQuestions = Array.isArray(cat?.questions) ? cat.questions : [];
            if (sourceQuestions.length === 0) {
                throw new Error(`Kategorie ${cIdx + 1} enthaelt keine Fragen.`);
            }

            const questions = sourceQuestions.map((q, qIdx) => {
                const pointsNum = parseInt(q?.points, 10);
                const points = Number.isInteger(pointsNum) && pointsNum > 0
                    ? pointsNum
                    : 100 * (qIdx + 1);
                const question = typeof q?.question === 'string' ? q.question.trim() : '';
                const answer = typeof q?.answer === 'string' ? q.answer.trim() : '';

                if (!question || !answer) {
                    throw new Error(`Frage ${qIdx + 1} in Kategorie ${cIdx + 1} ist unvollstaendig.`);
                }

                return {
                    id: `q-${cIdx}-${qIdx}`,
                    points,
                    question,
                    answer
                };
            });

            return {
                id: cIdx,
                name,
                questions
            };
        });

        const generatedTitle = (document.getElementById('aiTheme')?.value || '').trim();
        const quizTitle = (parsed.quizTitle || parsed.title || '').toString().trim() ||
            (generatedTitle ? `KI-Quiz: ${generatedTitle}` : 'KI-Quiz');

        return { quizTitle, categories };
    },

    importQuizFromAiResponse() {
        const input = document.getElementById('aiResponseInput');
        if (!input) return;

        try {
            const jsonText = this.extractJsonFromAiResponse(input.value);
            const parsed = JSON.parse(jsonText);
            const imported = this.normalizeImportedQuiz(parsed);

            this.state.quizTitle = imported.quizTitle;
            this.state.editor.categories = imported.categories;
            this.state.editor.teams = [];
            this.state.game = null;
            this.state.playedQuestions = new Set();
            this.state.currentQuestion = null;
            this.state.quickTeamNames = [];

            this.saveGameState();
            this.showScreen('editor');
            this.renderEditor();
            this.updateQuizInfo();

            alert('KI-Quiz erfolgreich importiert.');
        } catch (err) {
            alert('Import fehlgeschlagen: ' + err.message);
        }
    },

    hasLoadedQuiz() {
        return Array.isArray(this.state.editor.categories) && this.state.editor.categories.length > 0;
    },

    hasActiveGame() {
        return !!(this.state.game && Array.isArray(this.state.game.teams) && this.state.game.teams.length > 0);
    },

    updateMainMenuButtons() {
        const continueBtn = document.getElementById('continueGameBtn');
        const newGameBtn = document.getElementById('newGameBtn');
        const gameReady = this.hasActiveGame();
        const quizReady = this.hasLoadedQuiz();

        if (continueBtn) {
            continueBtn.disabled = !gameReady;
            continueBtn.title = gameReady ? '' : 'Erst einen Spielstand laden oder starten';
        }

        if (newGameBtn) {
            newGameBtn.disabled = !quizReady;
            newGameBtn.title = quizReady ? '' : 'Erst ein Quiz laden';
        }
    },

    updateQuizInfo() {
        const info = document.getElementById('quizInfo');
        this.updateMainMenuButtons();
        if (!info) return;

        if (!this.hasLoadedQuiz()) {
            info.textContent = 'ℹ️ Kein Quiz geladen';
            return;
        }

        if (!this.hasActiveGame()) {
            info.innerHTML = `✅ <strong>${this.state.quizTitle}</strong> geladen (${this.state.editor.categories.length} Kategorien) · ℹ️ Kein Spielstand geladen`;
            return;
        }

        info.innerHTML = `✅ <strong>${this.state.quizTitle}</strong> geladen (${this.state.editor.categories.length} Kategorien) · ✅ Spielstand bereit`;
    },

    // ============ GAMEPLAY & NAVIGATION ============
    continueGame() {
        if (!this.hasActiveGame()) {
            return;
        }

        this.showScreen('quizWall');
        this.renderQuizBoard();
        this.updateRanking();
    },

    showNewGameSetup() {
        if (!this.hasLoadedQuiz()) {
            return;
        }

        if (this.hasActiveGame()) {
            this.showStartNewGameConfirmation(() => this.showTeamSetup());
            return;
        }

        this.showTeamSetup();
    },

    showStartNewGameConfirmation(onConfirm) {
        const modal = this.createModal('Neues Spiel starten');
        const text = document.createElement('p');
        text.textContent = 'Dies loescht den aktuellen Spielstand, okay?';
        text.style.margin = '1rem 0 1.5rem 0';
        modal.content.appendChild(text);

        const actions = document.createElement('div');
        actions.className = 'button-group';

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-danger';
        confirmBtn.textContent = 'Ja';
        confirmBtn.onclick = () => {
            modal.close();
            if (typeof onConfirm === 'function') onConfirm();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Abbrechen';
        cancelBtn.onclick = () => modal.close();

        actions.appendChild(confirmBtn);
        actions.appendChild(cancelBtn);
        modal.content.appendChild(actions);
    },

    showTeamSetup() {
        this.showScreen('teamSetup');
        this.renderTeamSetup();
    },

    renderTeamSetup() {
        const teamCountInput = document.getElementById('teamCountQuick');
        const teamNamesContainer = document.getElementById('teamNamesQuick');
        if (!teamCountInput || !teamNamesContainer) return;

        const teamCount = Math.max(2, Math.min(4, parseInt(teamCountInput.value, 10) || 2));
        teamCountInput.value = String(teamCount);

        const names = Array.isArray(this.state.quickTeamNames) ? [...this.state.quickTeamNames] : [];
        names.length = teamCount;
        for (let i = 0; i < teamCount; i++) {
            if (!names[i]) names[i] = `Team ${i + 1}`;
        }
        this.state.quickTeamNames = names;

        teamNamesContainer.innerHTML = '';
        for (let i = 0; i < teamCount; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'team-name-input';
            input.placeholder = `Team ${i + 1}`;
            input.value = names[i];
            input.addEventListener('input', (event) => {
                this.state.quickTeamNames[i] = event.target.value;
            });
            teamNamesContainer.appendChild(input);
        }
    },

    startGameFromTeamSetup() {
        if (!this.hasLoadedQuiz()) {
            alert('Bitte zuerst ein Quiz laden.');
            this.goToStartMenu();
            return;
        }

        const teamCountInput = document.getElementById('teamCountQuick');
        const teamCount = Math.max(2, Math.min(4, parseInt(teamCountInput?.value, 10) || 2));
        const teams = [];
        for (let i = 0; i < teamCount; i++) {
            const name = (this.state.quickTeamNames?.[i] || '').trim() || `Team ${i + 1}`;
            teams.push({ id: i, name, score: 0 });
        }

        this.state.editor.teams = teams.map(team => ({ name: team.name }));
        this.state.game = { teams, playedQuestions: [] };
        this.state.playedQuestions = new Set();
        this.state.currentQuestion = null;
        this.saveGameState();

        this.showScreen('quizWall');
        this.renderQuizBoard();
        this.updateRanking();
    },

    renderGameSetup() {
        const categoryCountInput = document.getElementById('categoryCount');
        const pointsInput = document.getElementById('pointsInput');
        if (!categoryCountInput || !pointsInput) return;

        const categoryCount = Math.max(2, Math.min(6, parseInt(categoryCountInput.value, 10) || 4));
        categoryCountInput.value = String(categoryCount);

        if (!pointsInput.value.trim()) {
            pointsInput.value = '100,200,300,400,500';
        }
    },

    parsePointsSchema(rawInput) {
        return (rawInput || '')
            .split(',')
            .map(value => parseInt(value.trim(), 10))
            .filter(value => Number.isInteger(value) && value > 0);
    },

    getCategoryTitleLimits() {
        return {
            maxLines: 3,
            maxCharsPerLine: 24,
            minFontPx: 11,
            maxFontPx: 22
        };
    },

    formatCategoryTitle(rawTitle) {
        const limits = this.getCategoryTitleLimits();
        const maxTotalChars = limits.maxLines * limits.maxCharsPerLine;
        const cleaned = String(rawTitle || '').replace(/\s+/g, ' ').trim();

        if (cleaned.length <= maxTotalChars) return cleaned;
        return `${cleaned.slice(0, Math.max(1, maxTotalChars - 1)).trimEnd()}…`;
    },

    fitCategoryHeaderText(headerElement) {
        if (!headerElement) return;

        const limits = this.getCategoryTitleLimits();
        headerElement.style.setProperty('--category-title-max-lines', String(limits.maxLines));

        let size = limits.maxFontPx;
        headerElement.style.fontSize = `${size}px`;

        const maxHeight = headerElement.clientHeight;
        const maxWidth = headerElement.clientWidth;

        while (
            size > limits.minFontPx &&
            (headerElement.scrollHeight > maxHeight + 1 || headerElement.scrollWidth > maxWidth + 1)
        ) {
            size -= 1;
            headerElement.style.fontSize = `${size}px`;
        }
    },

    startNewGame() {
        const categoryCount = Math.max(2, Math.min(6, parseInt(document.getElementById('categoryCount').value, 10) || 4));
        const pointsSchema = this.parsePointsSchema(document.getElementById('pointsInput').value);

        if (pointsSchema.length === 0) {
            alert('Bitte ein gueltiges Punkte-Schema eingeben, z. B. 100,200,300,400,500.');
            return;
        }

        const categories = [];
        for (let cIdx = 0; cIdx < categoryCount; cIdx++) {
            const questions = pointsSchema.map((points, qIdx) => ({
                id: `q-${cIdx}-${qIdx}`,
                points,
                question: '',
                answer: ''
            }));
            categories.push({
                id: cIdx,
                name: `Kategorie ${cIdx + 1}`,
                questions
            });
        }

        this.state.editor.categories = categories;
        this.state.editor.teams = [];
        this.state.game = null;
        this.state.playedQuestions = new Set();
        this.state.currentQuestion = null;
        this.state.quickTeamNames = [];

        this.saveGameState();

        this.showScreen('editor');
        this.renderEditor();
        this.updateQuizInfo();
    },

    createNewGame() {
        const teamCountInput = document.getElementById('teamCount');
        if (!teamCountInput) return;

        const count = parseInt(teamCountInput.value, 10) || 2;
        const teams = [];
        for (let i = 0; i < count; i++) {
            const name = document.getElementById(`team-${i}`)?.value || `Team ${i + 1}`;
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

    goToQuizWall() {
        this.showScreen('quizWall');
        this.renderQuizBoard();
        this.updateRanking();
    },

    // ============ QUIZ VERWALTUNG ============
    downloadQuiz() {
        if (!this.state.editor.categories || this.state.editor.categories.length === 0) {
            alert('Kein Quiz vorhanden.');
            return;
        }

        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const defaultBase = `quiz-${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
        const input = prompt('Dateiname fuer das Quiz (ohne Endung):', defaultBase);
        if (input === null) return;

        const baseName = (input || defaultBase)
            .trim()
            .replace(/\.(quiz\.)?json$/i, '')
            .replace(/\.game$/i, '') || defaultBase;

        const filename = `${baseName}.quiz.json`;

        const quizData = {
            version: '1.0',
            type: 'quiz',
            timestamp: now.toISOString(),
            quizTitle: this.state.quizTitle,
            categories: this.state.editor.categories
        };

        const blob = new Blob([JSON.stringify(quizData, null, 2)], { type: 'application/json' });
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

    handleQuizUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                const categories = Array.isArray(parsed.categories)
                    ? parsed.categories
                    : (parsed.game && Array.isArray(parsed.game.categories) ? parsed.game.categories : null);

                if (!categories || categories.length === 0) {
                    throw new Error('Keine gueltigen Kategorien gefunden.');
                }

                this.state.editor.categories = categories;
                this.state.quizTitle = parsed.quizTitle || parsed.title || 'Quiz Wall';
                this.state.game = null;
                this.state.playedQuestions = new Set();
                this.state.currentQuestion = null;
                this.state.selectedCategoryIndex = null;

                this.saveGameState();
                this.updateQuizInfo();
                this.showScreen('startMenu');
                alert('Quiz erfolgreich geladen!');
            } catch (err) {
                alert('Fehler beim Laden des Quiz: ' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

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
        const hasQuiz = this.hasLoadedQuiz();
        const hasGame = this.hasActiveGame();

        if (!hasQuiz && !hasGame) {
            this.beginNewQuizFlow();
            return;
        }

        this.showResetQuizConfirmation({ hasQuiz, hasGame });
    },

    showResetQuizConfirmation({ hasQuiz, hasGame }) {
        const modal = this.createModal('Neues Quiz');
        const text = document.createElement('p');

        if (hasQuiz && hasGame) {
            text.textContent = 'Aktuelles Quiz und Spielstand gehen verloren, wenn du fortfaehrst.';
        } else if (hasQuiz) {
            text.textContent = 'Das aktuelle Quiz geht verloren, wenn du fortfaehrst.';
        } else {
            text.textContent = 'Der aktuelle Spielstand geht verloren, wenn du fortfaehrst.';
        }

        text.style.margin = '1rem 0 1.25rem 0';
        modal.content.appendChild(text);

        const actions = document.createElement('div');
        actions.className = 'button-group';

        const saveBothBtn = document.createElement('button');
        saveBothBtn.className = 'btn btn-primary';
        saveBothBtn.textContent = 'Spielstand und Quiz speichern';
        saveBothBtn.onclick = () => {
            if (hasQuiz) this.downloadQuiz();
            if (hasGame) this.saveCurrentGame();
            modal.close();
            this.beginNewQuizFlow();
        };

        const saveQuizBtn = document.createElement('button');
        saveQuizBtn.className = 'btn btn-secondary';
        saveQuizBtn.textContent = 'Nur Quiz speichern';
        saveQuizBtn.onclick = () => {
            if (hasQuiz) this.downloadQuiz();
            modal.close();
            this.beginNewQuizFlow();
        };

        const proceedBtn = document.createElement('button');
        proceedBtn.className = 'btn btn-danger';
        proceedBtn.textContent = 'Editor trotzdem starten';
        proceedBtn.onclick = () => {
            modal.close();
            this.beginNewQuizFlow();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-tertiary';
        cancelBtn.textContent = 'Abbrechen';
        cancelBtn.onclick = () => modal.close();

        actions.appendChild(saveBothBtn);
        actions.appendChild(saveQuizBtn);
        actions.appendChild(proceedBtn);
        actions.appendChild(cancelBtn);
        modal.content.appendChild(actions);
    },

    beginNewQuizFlow() {
        this.state.game = null;
        this.state.playedQuestions = new Set();
        this.state.currentQuestion = null;
        this.state.quickTeamNames = [];
        this.state.editor.teams = [];
        this.state.editor.categories = [];
        this.state.quizTitle = 'Quiz Wall';
        this.saveGameState();

        this.showScreen('gameSetup');
        this.renderGameSetup();
    },

    resetTeams() {
        if (!this.state.game) {
            alert('Kein aktives Spiel vorhanden.');
            return;
        }

        if (!confirm('Spiel zuruecksetzen? Teams und Spielstand gehen verloren, das Quiz bleibt erhalten.')) {
            return;
        }

        this.state.game = null;
        this.state.playedQuestions = new Set();
        this.state.currentQuestion = null;
        this.state.quickTeamNames = [];
        this.saveGameState();
        this.updateQuizInfo();
        this.showScreen('startMenu');
        alert('Spiel wurde zurueckgesetzt.');
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
        const headerElements = [];
        categories.forEach((cat, idx) => {
            const hDiv = document.createElement('div');
            hDiv.className = 'column-header';

            const rawName = (cat && typeof cat.name === 'string' && cat.name.trim())
                ? cat.name.trim()
                : `Kategorie ${idx + 1}`;
            const displayName = this.formatCategoryTitle(rawName);

            hDiv.textContent = displayName;
            if (displayName !== rawName) {
                hDiv.title = rawName;
            }

            header.appendChild(hDiv);
            headerElements.push(hDiv);
        });

        window.requestAnimationFrame(() => {
            headerElements.forEach(el => this.fitCategoryHeaderText(el));
        });

        this.updateQuizWallResponsiveUi();

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
        if (!this.hasActiveGame()) {
            const list = document.getElementById('rankingList');
            const sidebar = document.getElementById('sidebarRankingList');
            if (list) list.innerHTML = '';
            if (sidebar) sidebar.innerHTML = '';
            return;
        }

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
        this.showScreen('editor');
        this.renderEditor();
    },

    renderEditor() {
        // Quiz-Titel setzen
        const titleInput = document.getElementById('quizTitle');
        titleInput.value = this.state.quizTitle;
        titleInput.oninput = (event) => {
            this.state.quizTitle = event.target.value.trim() || 'Quiz Wall';
        };

        // Kategorien anzeigen
        this.renderCategoryList();

        // Fragenbereich initialisieren
        if (this.state.editor.categories.length > 0) {
            this.selectCategory(0);
        } else {
            this.state.selectedCategoryIndex = null;
            document.getElementById('selectedCategoryTitle').textContent = 'Wähle eine Kategorie';
            document.getElementById('questionsList').innerHTML = '';
        }
    },

    renderCategoryList() {
        const list = document.getElementById('categoryList');
        list.innerHTML = '';

        this.state.editor.categories.forEach((cat, idx) => {
            const div = document.createElement('div');
            div.className = 'category-item';
            if (idx === this.state.selectedCategoryIndex) {
                div.classList.add('active');
            }
            div.textContent = cat.name;
            div.onclick = () => this.selectCategory(idx);
            list.appendChild(div);
        });
    },

    selectCategory(idx) {
        this.state.selectedCategoryIndex = idx;
        const cat = this.state.editor.categories[idx];
        if (!cat) return;

        this.renderCategoryList();

        const title = document.getElementById('selectedCategoryTitle');
        title.innerHTML = '';
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.value = cat.name;
        titleInput.className = 'team-name-input';
        titleInput.oninput = (event) => {
            cat.name = event.target.value || `Kategorie ${idx + 1}`;
            this.renderCategoryList();
        };
        title.appendChild(titleInput);

        const qList = document.getElementById('questionsList');
        qList.innerHTML = '';
        cat.questions.forEach((q, qIdx) => {
            qList.appendChild(this.createQuestionEditorItem(cat, q, qIdx));
        });
    },

    createQuestionEditorItem(category, question, questionIndex) {
        const item = document.createElement('div');
        item.className = 'question-item';

        const header = document.createElement('div');
        header.className = 'question-item-header';

        const heading = document.createElement('h4');
        const getHeaderText = () => {
            const label = (question.question || '').trim();
            return `${question.points} Punkte - ${label || 'Leere Frage'}`;
        };
        heading.textContent = getHeaderText();

        const toggle = document.createElement('span');
        toggle.className = 'question-item-toggle';
        toggle.textContent = '▾';

        header.appendChild(heading);
        header.appendChild(toggle);

        const content = document.createElement('div');
        content.className = 'question-item-content';

        const body = document.createElement('div');
        body.className = 'question-item-body';

        const pointsInput = document.createElement('input');
        pointsInput.type = 'number';
        pointsInput.min = '1';
        pointsInput.value = question.points;
        pointsInput.placeholder = 'Punkte';
        pointsInput.oninput = (event) => {
            const value = parseInt(event.target.value, 10);
            if (Number.isInteger(value) && value > 0) {
                question.points = value;
                heading.textContent = getHeaderText();
            }
        };

        const questionInput = document.createElement('textarea');
        questionInput.placeholder = 'Frage eingeben';
        questionInput.value = question.question || '';
        questionInput.oninput = (event) => {
            question.question = event.target.value;
            heading.textContent = getHeaderText();
        };

        const answerInput = document.createElement('textarea');
        answerInput.placeholder = 'Antwort eingeben';
        answerInput.value = question.answer || '';
        answerInput.oninput = (event) => {
            question.answer = event.target.value;
        };

        body.appendChild(pointsInput);
        body.appendChild(questionInput);
        body.appendChild(answerInput);
        content.appendChild(body);

        header.onclick = () => {
            const willOpen = !content.classList.contains('open');
            content.classList.toggle('open', willOpen);
            header.classList.toggle('open', willOpen);
        };

        item.appendChild(header);
        item.appendChild(content);

        // Beim Rendern standardmaessig eingeklappt.

        return item;
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
            categories: this.state.editor.categories,
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
            if (Array.isArray(parsed.categories)) {
                this.state.editor.categories = parsed.categories;
            } else if (parsed.game && parsed.game.categories) {
                this.state.editor.categories = parsed.game.categories;
            }
            // Nach dem Laden alles neu rendern
            this.renderQuizBoard();
            this.updateRanking();
        }

        this.updateQuizInfo();
    }
};

// ============ INITIALISIERUNG ============
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

app.editor = {
    addCategory() {
        const categoryIndex = app.state.editor.categories.length;
        const templateCategory = app.state.editor.categories[0];
        const templateQuestions = (templateCategory && Array.isArray(templateCategory.questions) && templateCategory.questions.length > 0)
            ? templateCategory.questions
            : [{ points: 100 }];

        const questions = templateQuestions.map((templateQuestion, questionIndex) => ({
            id: `q-${categoryIndex}-${questionIndex}`,
            points: Number.isInteger(templateQuestion.points) && templateQuestion.points > 0 ? templateQuestion.points : 100,
            question: '',
            answer: ''
        }));

        app.state.editor.categories.push({
            id: categoryIndex,
            name: `Kategorie ${categoryIndex + 1}`,
            questions
        });

        app.selectCategory(categoryIndex);
    },

    saveAndPlay() {
        if (!app.state.editor.categories || app.state.editor.categories.length < 2) {
            alert('Bitte mindestens 2 Kategorien anlegen!');
            return;
        }

        // Team-Auswahl gehört zum Spiel-Flow, nicht in den Quiz-Editor.
        app.state.game = null;
        app.state.playedQuestions = new Set();
        app.state.currentQuestion = null;
        app.saveGameState();

        app.showTeamSetup();
    }
};

// QuizWall-Überschrift aktualisieren
document.getElementById('quizTitleDisplay').textContent = app.state.quizTitle;

// Fallback: Wenn keine Kategorien vorhanden sind, Demo-Quiz laden
if (!app.state.editor.categories || app.state.editor.categories.length === 0) {
    if (typeof defaultQuizData !== 'undefined') {
        app.state.editor.categories = defaultQuizData.categories;
        app.state.quizTitle = 'Demo-Quiz';
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

            const hasEmbeddedCategories =
                (Array.isArray(data.categories) && data.categories.length > 0) ||
                (data.game && Array.isArray(data.game.categories) && data.game.categories.length > 0);

            if (!hasEmbeddedCategories) {
                alert('Dieser Spielstand enthaelt keine eingebetteten Quizdaten und kann nicht geladen werden.');
                return;
            }

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
    if (!this.state.game || !Array.isArray(this.state.game.teams)) {
        alert('Kein aktiver Spielstand vorhanden.');
        return;
    }

    this.showResetConfirmation();
};

app.showResetConfirmation = function() {
    const modal = this.createModal('Bist du sicher?');

    const text = document.createElement('p');
    text.textContent = 'Der komplette Spielstand wird zurueckgesetzt.';
    text.style.margin = '1rem 0 1.5rem 0';
    modal.content.appendChild(text);

    const actions = document.createElement('div');
    actions.className = 'button-group';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-danger';
    confirmBtn.textContent = 'Ja, zuruecksetzen';
    confirmBtn.onclick = () => {
        // Punktestand aller Teams zuruecksetzen
        this.state.game.teams.forEach(team => {
            team.score = 0;
        });

        // Alle Fragen wieder als unbeantwortet markieren
        this.state.playedQuestions = new Set();
        this.state.currentQuestion = null;
        (this.state.editor.categories || []).forEach(category => {
            (category.questions || []).forEach(question => {
                if (Object.prototype.hasOwnProperty.call(question, 'answered')) {
                    question.answered = false;
                }
            });
        });

        this.saveGameState();
        this.renderQuizBoard();
        this.updateRanking();
        modal.close();
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Abbrechen';
    cancelBtn.onclick = () => modal.close();

    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);
    modal.content.appendChild(actions);
};

// App-Objekt global verfügbar machen
window.app = app;