const app = {
    themeStorageVersion: '2',
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
        const input = prompt('Dateiname für den Spielstand (ohne Endung):', defaultBase);
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
                    if (this.shouldShowVictoryCeremony()) {
                        this.renderQuizBoard();
                        this.updateRanking();
                        this.state.victoryCeremonyShown = true;
                        this.showVictoryCeremonyModal();
                        return;
                    }

                    // Schritt 3: Ranking anzeigen
                    this.showRankingModal(() => {
                        // Schritt 4: Zurück zur Wand
                        this.renderQuizBoard();
                        this.updateRanking();
                    });
                });
            });
        },

        showQuestionModal(questionText, onNext) {
            // Fragetext segmentieren: $...$-Bereiche als LaTeX, Rest als Text
            function renderQuestionSegments(text) {
                // Ersetze \n durch <br> für Zeilenumbrüche
                text = text.replace(/\n/g, '<br>');
                // Splitte an $...$
                const parts = [];
                let lastIndex = 0;
                let regex = /\$(.+?)\$/g;
                let match;
                while ((match = regex.exec(text)) !== null) {
                    if (match.index > lastIndex) {
                        // Text vor $...$
                        parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
                    }
                    parts.push({ type: 'latex', value: match[1] });
                    lastIndex = regex.lastIndex;
                }
                if (lastIndex < text.length) {
                    parts.push({ type: 'text', value: text.slice(lastIndex) });
                }
                // Baue HTML
                return parts.map(part => {
                    if (part.type === 'latex') {
                        return `<span class="mathjax-content">$${part.value}$</span>`;
                    } else {
                        // HTML escapen, aber <br> erhalten
                        return part.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                    }
                }).join('');
            }

            const html = renderQuestionSegments(questionText);
            this.createSimpleModal('Frage', html, 'Weiter', onNext, { layout: 'qa', modalType: 'question', isHtml: true, buttonClass: 'qa-next-btn', afterRender: (modal) => {
                // Alle LaTeX-Teile rendern
                if (window.MathJax && window.MathJax.typesetPromise) {
                    const els = modal.querySelectorAll('.mathjax-content');
                    if (els && els.length) window.MathJax.typesetPromise(Array.from(els));
                }
            }});
        },

        showAnswerModal(answerText, onNext) {
            // Modal mit Antworttext, Team-Auswahl und Weiter-Button
            const modal = this.createModal('Antwort', { layout: 'qa' });
            const modalRoot = modal.content.closest('.custom-modal');
            modalRoot?.classList.add('custom-modal-answer');
            const body = document.createElement('div');
            body.className = 'qa-modal-body';

            // Automatisch LaTeX/mhchem-Formeln in $...$ einbetten, falls nötig
            let at = answerText;
            // Auch allgemeine LaTeX-Kommandos und einfache Operatoren erkennen
            if (!at.trim().startsWith('$')) {
                const latexPattern = /\\(ce|mathrm|frac|sqrt|sum|int|rho|pi|cdot|alpha|beta|gamma|Delta|theta|mu|nu|lambda|phi|psi|Omega|leq|geq|neq|approx|rightarrow|leftarrow|infty|partial|dots|over|under|hat|bar|vec|dot|times|pm|div|sin|cos|tan|log|ln|exp)|\^|_/;
                if (latexPattern.test(at)) {
                    at = `$${at}$`;
                }
            }

            const content = document.createElement('div');
            content.className = 'answer-text mathjax-content';
            content.innerHTML = at;
            body.appendChild(content);
            // Nach dem Einfügen MathJax nur auf das relevante Element anwenden
            setTimeout(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise([content]);
                }
            }, 0);

            // Neue Chip-Auswahl für Teams
            const teamSection = document.createElement('div');
            teamSection.className = 'qa-team-section';

            const info = document.createElement('div');
            info.className = 'qa-modal-info';
            info.textContent = 'Welche Teams haben richtig geantwortet?';
            teamSection.appendChild(info);

            // Responsive Container für Chips + Button
            const chipRow = document.createElement('div');
            chipRow.className = 'qa-team-chip-row';

            const teamList = document.createElement('div');
            teamList.className = 'team-count-chip-list';
            const selectedTeams = new Set();
            // Dynamische Team-Chips je nach Teamanzahl
            const teams = Array.isArray(this.state.game.teams) ? this.state.game.teams : [];
            teams.forEach(team => {
                const chip = document.createElement('div');
                chip.className = 'team-count-chip';
                chip.textContent = team.name;
                chip.onclick = () => {
                    if (selectedTeams.has(team.id)) {
                        selectedTeams.delete(team.id);
                        chip.classList.remove('active');
                    } else {
                        selectedTeams.add(team.id);
                        chip.classList.add('active');
                    }
                };
                teamList.appendChild(chip);
            });
            chipRow.appendChild(teamList);

            // Spaltenanzahl für Team-Chips dynamisch setzen (max. 4)
            teamList.style.display = 'flex';
            teamList.style.flexWrap = 'wrap';
            teamList.style.justifyContent = 'center';
            teamList.style.gap = '0.5rem';

            // Weiter-Button
            const actions = document.createElement('div');
            actions.className = 'qa-modal-actions';
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary qa-next-btn';
            // Button-Beschriftung je nach Platz
            const isSmall = window.matchMedia('(max-width: 420px), (max-height: 420px)').matches;
            if (isSmall) {
                btn.innerHTML = '<span aria-label="Weiter" title="Weiter">&#x27A1;</span>';
            } else {
                btn.textContent = 'Weiter';
            }
            btn.onclick = () => {
                teams.forEach(team => {
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

            teamSection.appendChild(chipRow);
            // Button immer separat unterhalb, zentriert
            body.appendChild(teamSection);
            body.appendChild(actions);
            modal.content.appendChild(body);
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
                this.createSimpleModal('Ranking', 'Kein aktives Spiel vorhanden.', 'Schließen');
                return;
            }

            const modal = this.createModal('Aktuelles Ranking', { layout: 'qa', modalType: 'ranking' });
            const modalRoot = modal.content.closest('.custom-modal');
            modalRoot?.classList.add('custom-modal-ranking');
            const body = document.createElement('div');
            body.className = 'qa-modal-body';

            const sorted = [...this.state.game.teams].sort((a, b) => b.score - a.score);
            const list = document.createElement('div');
            list.className = 'ranking-list';
            sorted.forEach((t, idx) => {
                const li = document.createElement('div');
                li.className = 'ranking-item';

                const label = document.createElement('span');
                label.textContent = `${idx + 1}. ${t.name}`;

                const right = document.createElement('div');
                right.className = 'ranking-item-right';

                const score = document.createElement('strong');
                score.textContent = `${t.score}`;

                const adjustBtn = document.createElement('button');
                adjustBtn.type = 'button';
                adjustBtn.className = 'btn btn-secondary ranking-adjust-btn';
                adjustBtn.setAttribute('aria-label', `Punkte für ${t.name} anpassen`);
                adjustBtn.textContent = '✏️';
                adjustBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.showTeamScoreAdjustModal(t.id, () => {
                        modal.close();
                        this.showRankingModal(onNext);
                    });
                };

                right.appendChild(score);
                right.appendChild(adjustBtn);
                li.appendChild(label);
                li.appendChild(right);
                list.appendChild(li);
            });

            body.appendChild(list);
            modal.content.appendChild(body);

            const actions = document.createElement('div');
            actions.className = 'qa-modal-actions';
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary qa-next-btn';
            btn.textContent = typeof onNext === 'function' ? 'Weiter' : 'Schließen';
            btn.onclick = () => {
                modal.close();
                if (onNext) onNext();
            };

            actions.appendChild(btn);
            modal.content.appendChild(actions);
            this.refreshModalSizing(modalRoot, { modalType: 'ranking' });
        },

        getScoreAdjustmentChipValues() {
            const categories = Array.isArray(this.state.editor.categories)
                ? this.state.editor.categories
                : [];

            const values = [];
            categories.forEach((category) => {
                (category?.questions || []).forEach((question) => {
                    const points = parseInt(question?.points, 10);
                    if (Number.isInteger(points) && points > 0) {
                        values.push(points);
                    }
                });
            });

            const uniqueSorted = [...new Set(values)].sort((a, b) => a - b);
            if (uniqueSorted.length === 0) {
                return [100, 200, 300, 400, 500];
            }

            return uniqueSorted.slice(0, 12);
        },

        showTeamScoreAdjustModal(teamId, onApplied) {
            if (!this.hasActiveGame()) return;

            const team = this.state.game.teams.find((candidate) => candidate.id === teamId);
            if (!team) return;

            const modal = this.createModal(`Punkte anpassen: ${team.name}`, { layout: 'qa', modalType: 'score-adjust' });
            const modalRoot = modal.content.closest('.custom-modal');
            modalRoot?.classList.add('custom-modal-score-adjust');

            const chipValues = this.getScoreAdjustmentChipValues();
            let mode = 1;
            let delta = 0;
            let activeChip = null;

            const body = document.createElement('div');
            body.className = 'qa-modal-body';

            const info = document.createElement('div');
            info.className = 'qa-modal-info';
            info.textContent = 'Richtung wählen und dann Punkte-Chips antippen. Mehrfach tippen summiert.';
            body.appendChild(info);

            const modeToggle = document.createElement('div');
            modeToggle.className = 'score-adjust-mode-toggle';

            const plusBtn = document.createElement('button');
            plusBtn.type = 'button';
            plusBtn.className = 'btn btn-primary';
            plusBtn.textContent = 'Gutschrift';

            const minusBtn = document.createElement('button');
            minusBtn.type = 'button';
            minusBtn.className = 'btn btn-secondary';
            minusBtn.textContent = 'Abzug';

            const scorePreview = document.createElement('div');
            scorePreview.className = 'score-adjust-current';

            const chips = document.createElement('div');
            chips.className = 'score-adjust-chip-grid';

            const renderMode = () => {
                plusBtn.classList.toggle('btn-primary', mode === 1);
                plusBtn.classList.toggle('btn-secondary', mode !== 1);
                minusBtn.classList.toggle('btn-primary', mode === -1);
                minusBtn.classList.toggle('btn-secondary', mode !== -1);
                plusBtn.classList.toggle('is-active', mode === 1);
                minusBtn.classList.toggle('is-active', mode === -1);
            };

            const renderCurrent = () => {
                const nextScore = Math.max(0, team.score + delta);
                scorePreview.textContent = `Punktestand: ${team.score} → ${nextScore}`;
            };

            plusBtn.onclick = () => {
                mode = 1;
                renderMode();
            };

            minusBtn.onclick = () => {
                mode = -1;
                renderMode();
            };

            chipValues.forEach((value) => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'btn btn-secondary score-adjust-chip';
                chip.textContent = `${value}`;
                chip.onclick = () => {
                    if (activeChip) {
                        activeChip.classList.remove('is-active');
                        activeChip.classList.remove('btn-primary');
                        activeChip.classList.add('btn-secondary');
                    }
                    activeChip = chip;
                    activeChip.classList.add('is-active');
                    activeChip.classList.remove('btn-secondary');
                    activeChip.classList.add('btn-primary');
                    delta += mode * value;
                    renderCurrent();
                };
                chips.appendChild(chip);
            });

            modeToggle.appendChild(plusBtn);
            modeToggle.appendChild(minusBtn);
            body.appendChild(modeToggle);
            body.appendChild(chips);
            body.appendChild(scorePreview);

            const resetBtn = document.createElement('button');
            resetBtn.type = 'button';
            resetBtn.className = 'btn btn-tertiary score-adjust-reset';
            resetBtn.textContent = 'Zurücksetzen';
            resetBtn.onclick = () => {
                delta = 0;
                if (activeChip) {
                    activeChip.classList.remove('is-active');
                    activeChip.classList.remove('btn-primary');
                    activeChip.classList.add('btn-secondary');
                    activeChip = null;
                }
                renderCurrent();
            };
            modal.content.appendChild(body);

            const actions = document.createElement('div');
            actions.className = 'qa-modal-actions';

            const applyBtn = document.createElement('button');
            applyBtn.type = 'button';
            applyBtn.className = 'btn btn-primary';
            applyBtn.textContent = 'Anwenden';
            applyBtn.onclick = () => {
                if (delta === 0) {
                    this.createSimpleModal('Hinweis', 'Bitte erst eine Punkte-Änderung wählen.', 'OK');
                    return;
                }

                team.score = Math.max(0, team.score + delta);
                this.saveGameState();
                this.updateRanking();
                modal.close();

                if (typeof onApplied === 'function') {
                    onApplied(team, delta);
                }
            };

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.textContent = 'Abbrechen';
            cancelBtn.onclick = () => modal.close();

            actions.appendChild(resetBtn);
            actions.appendChild(applyBtn);
            actions.appendChild(cancelBtn);
            modal.content.appendChild(actions);
            this.refreshModalSizing(modalRoot, { modalType: 'score-adjust' });

            renderMode();
            renderCurrent();
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

        applyUnifiedModalSizing(modalRoot, options = {}) {
            if (!modalRoot) return;

            const { buttonCount = 1 } = options;
            const isLandscape = window.matchMedia('(orientation: landscape)').matches;
            const viewport = window.visualViewport;
            const vw = Math.round(viewport?.width || window.innerWidth);
            const vh = Math.round(viewport?.height || window.innerHeight);
            const minSide = Math.min(vw, vh);

            modalRoot.classList.toggle('is-landscape', isLandscape);
            modalRoot.classList.toggle('is-portrait', !isLandscape);

            [1, 2, 3, 4].forEach((count) => modalRoot.classList.remove(`modal-actions-${count}`));
            const actionColumns = isLandscape ? Math.min(4, Math.max(2, buttonCount || 2)) : 1;
            modalRoot.classList.add(`modal-actions-${actionColumns}`);

            const cardWidthPx = Math.max(280, Math.round(vw * 0.92));
            const cardHeightPx = Math.max(260, Math.round(vh * 0.92));
            const cardWidth = `${Math.min(vw - 2, cardWidthPx)}px`;
            const cardHeight = `${Math.min(vh - 2, cardHeightPx)}px`;

            const contentFont = Math.max(16, Math.min(42, minSide * 0.047));
            const titleFont = Math.max(28, Math.min(74, contentFont * 1.65));
            const buttonFont = Math.max(15, Math.min(30, contentFont * 0.68));

            modalRoot.style.setProperty('--modal-card-width', cardWidth);
            modalRoot.style.setProperty('--modal-card-height', cardHeight);
            modalRoot.style.setProperty('--modal-content-font-size', `${contentFont}px`);
            modalRoot.style.setProperty('--modal-title-font-size', `${titleFont}px`);
            modalRoot.style.setProperty('--modal-button-font-size', `${buttonFont}px`);

            modalRoot.style.setProperty('--qa-card-height', cardHeight);
            modalRoot.style.setProperty('--ranking-card-height', cardHeight);
            modalRoot.style.setProperty('--qa-content-font-size', `${contentFont}px`);
            modalRoot.style.setProperty('--qa-info-font-size', `${Math.max(15, Math.min(30, contentFont * 0.72))}px`);
            modalRoot.style.setProperty('--qa-team-font-size', `${Math.max(15, Math.min(29, contentFont * 0.68))}px`);
            modalRoot.style.setProperty('--qa-button-font-size', `${buttonFont}px`);

            // Dynamische Safe-Hoehe verhindert Versatz bei ein-/ausblendender Browser-UI.
            const safeHeightPx = `${Math.max(200, vh - 6)}px`;
            modalRoot.style.setProperty('--qa-mobile-safe-height', safeHeightPx);
            modalRoot.style.setProperty('--ranking-mobile-safe-height', safeHeightPx);
            modalRoot.style.setProperty('--score-adjust-mobile-safe-height', safeHeightPx);

            const modalCard = modalRoot.querySelector('.custom-modal-card-qa, .custom-modal-card-readme, .custom-modal > div') || modalRoot.firstElementChild;
            if (modalCard && modalCard.style) {
                modalCard.style.setProperty('--qa-mobile-safe-height', safeHeightPx);
                modalCard.style.setProperty('--ranking-mobile-safe-height', safeHeightPx);
                modalCard.style.setProperty('--score-adjust-mobile-safe-height', safeHeightPx);
            }
            modalRoot.style.pointerEvents = 'auto';

            modalRoot.style.position = 'fixed';
            modalRoot.style.top = '0';
            modalRoot.style.left = '0';
            modalRoot.style.right = '';
            modalRoot.style.width = '100dvw';
            modalRoot.style.minHeight = '';
            modalRoot.style.overflowY = '';
            modalRoot.style.alignItems = 'center';
            modalRoot.style.justifyContent = 'center';
            modalRoot.style.paddingTop = '';
            modalRoot.style.paddingBottom = '';
            modalRoot.style.height = `${vh}px`;
            modalRoot.style.maxHeight = `${vh}px`;
        },

        refreshModalSizing(modalRoot, options = {}) {
            if (!modalRoot) return;

            const effectiveModalType = options.modalType || modalRoot.dataset.modalType || 'default';
            if (effectiveModalType) {
                modalRoot.dataset.modalType = effectiveModalType;
            }

            const countFromQaActions = modalRoot.querySelectorAll('.qa-modal-actions .btn').length;
            const countFromButtonGroups = modalRoot.querySelectorAll('.button-group .btn').length;
            const buttonCount = countFromQaActions || countFromButtonGroups || 1;

            this.applyUnifiedModalSizing(modalRoot, {
                ...options,
                modalType: effectiveModalType,
                buttonCount
            });
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
                if (options.isHtml) {
                    content.innerHTML = text;
                } else {
                    content.textContent = text;
                }
                body.appendChild(content);
                modal.content.appendChild(body);
                // Nach dem Einfügen MathJax nur auf das relevante Element anwenden
                if (window.MathJax && window.MathJax.typesetPromise && options.isHtml) {
                    window.MathJax.typesetPromise([content]);
                }
                // Optionaler Callback nach Render
                if (typeof options.afterRender === 'function') {
                    options.afterRender(modal.content);
                }

                const actions = document.createElement('div');
                actions.className = 'qa-modal-actions';
                const btn = document.createElement('button');
                btn.className = 'btn btn-primary';
                btn.textContent = buttonText;
                btn.onclick = () => { modal.close(); if (onNext) onNext(); };
                actions.appendChild(btn);
                modal.content.appendChild(actions);
                this.refreshModalSizing(modalRoot, { modalType: options.modalType || 'qa-simple' });
                return;
            }

            const content = document.createElement('div');
            content.style.margin = '1.5rem 0';
            content.textContent = text;
            modal.content.appendChild(content);

            const btn = document.createElement('button');
            btn.className = 'btn btn-primary qa-next-btn';
            btn.textContent = buttonText;
            btn.onclick = () => { modal.close(); if (onNext) onNext(); };
            modal.content.appendChild(btn);

            const modalRoot = modal.content.closest('.custom-modal');
            this.refreshModalSizing(modalRoot, { modalType: 'simple' });
        },

        createModal(title, options = {}) {
            document.querySelectorAll('.custom-modal').forEach(m => m.remove());
            const modalBg = document.createElement('div');
            modalBg.className = 'custom-modal';
            modalBg.classList.add('custom-modal-responsive');
            modalBg.dataset.modalType = options.modalType || options.layout || 'default';
            if (options.layout === 'qa') {
                modalBg.classList.add('custom-modal-qa');
            }
            if (options.layout === 'readme') {
                modalBg.classList.add('custom-modal-readme');
            }
            modalBg.style.position = 'fixed';
            modalBg.style.top = '0';
            modalBg.style.left = '0';
            modalBg.style.width = '100dvw';
            modalBg.style.height = '100dvh';
            modalBg.style.background = 'rgba(0,0,0,0.5)';
            modalBg.style.display = 'flex';
            modalBg.style.alignItems = 'center';
            modalBg.style.justifyContent = 'center';
            modalBg.style.zIndex = '9999';
            modalBg.style.touchAction = 'pan-y';
            modalBg.style.webkitOverflowScrolling = 'touch';
            const modal = document.createElement('div');
            if (options.layout === 'qa') {
                modal.classList.add('custom-modal-card-qa');
            }
            if (options.layout === 'readme') {
                modal.classList.add('custom-modal-card-readme');
            }
            modal.style.background = '#fff';
            modal.style.padding = '2rem';
            modal.style.borderRadius = '1rem';
            modal.style.maxWidth = '500px';
            modal.style.width = '90vw';
            modal.style.boxShadow = '0 10px 40px rgba(0,0,0,0.25)';
            modal.style.pointerEvents = 'auto';

            if (options.layout === 'qa') {
                modal.style.width = '80vw';
                modal.style.height = '80vh';
                modal.style.maxWidth = 'none';
                modal.style.maxHeight = 'none';
                modal.style.display = 'flex';
                modal.style.flexDirection = 'column';
                modal.style.overflow = 'hidden';
            }

            if (options.layout === 'readme') {
                modal.style.width = '80vw';
                modal.style.height = '80vh';
                modal.style.maxWidth = '80vw';
                modal.style.maxHeight = '80vh';
                modal.style.display = 'flex';
                modal.style.flexDirection = 'column';
                modal.style.alignItems = 'stretch';
                modal.style.overflow = 'hidden';
                modal.style.padding = '1.2rem 1.2rem 1rem';
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
            if (options.layout === 'readme') {
                content.classList.add('custom-modal-content-readme');
                content.style.display = 'flex';
                content.style.flexDirection = 'column';
                content.style.flex = '1';
                content.style.minHeight = '0';
            }
            modal.appendChild(content);
            modalBg.appendChild(modal);
            document.body.appendChild(modalBg);

            const refreshSizing = () => this.refreshModalSizing(modalBg);
            refreshSizing();

            window.addEventListener('resize', refreshSizing, { passive: true });
            window.addEventListener('orientationchange', refreshSizing, { passive: true });

            const viewport = window.visualViewport;
            if (viewport) {
                viewport.addEventListener('resize', refreshSizing, { passive: true });
            }

            modalBg.addEventListener('click', (e) => {
                if (e.target === modalBg) {
                    window.removeEventListener('resize', refreshSizing);
                    window.removeEventListener('orientationchange', refreshSizing);
                    if (viewport) {
                        viewport.removeEventListener('resize', refreshSizing);
                    }
                    modalBg.remove();
                }
            });
            return {
                content,
                close: () => {
                    window.removeEventListener('resize', refreshSizing);
                    window.removeEventListener('orientationchange', refreshSizing);
                    if (viewport) {
                        viewport.removeEventListener('resize', refreshSizing);
                    }
                    modalBg.remove();
                }
            };
        },
    state: {
        currentScreenId: 'startMenu',
        previousScreenId: 'startMenu',
        settingsReturnScreenId: 'startMenu',
        settingsSessionSnapshot: null,
        defaultBrandLogoSrc: null,
        defaultBrandName: 'QuizWallah',
        brandLogoDataUrl: null,
        brandName: 'QuizWallah',
        quizTitle: 'QuizWallah',
        game: null, // Aktives Spiel mit Teams und Fortschritt
        selectedCategoryIndex: null,
        quickTeamNames: [],
        editor: {
            categories: (typeof defaultQuizData !== 'undefined') ? defaultQuizData.categories : [],
            teams: []
        },
        victoryCeremonyShown: false,
        playedQuestions: new Set(),
        currentQuestion: null
    },

    // ============ INITIALISIERUNG ============
    init() {
        console.log("QuizWallah wird gestartet...");
        this.initBranding();
        this.loadColorSettings();
        this.loadGameState();
        this.bindStaticUiHandlers();
        this.bindResponsiveUiHandlers();
        this.showSplashThenStart();
    },

    async showSplashThenStart() {
        this.showScreen('splashScreen');
        document.body.classList.add('is-splash-active');

        const loadFill = document.getElementById('splashLoadFill');
        const loadBar = document.querySelector('#splashScreen .splash-load');
        const splashActions = document.getElementById('splashActions');

        if (loadBar) {
            loadBar.classList.remove('hidden');
        }

        if (splashActions) {
            splashActions.classList.add('hidden');
        }

        this.updateSplashContinueButtonState();

        if (loadFill) {
            loadFill.classList.remove('is-animating');
            void loadFill.offsetWidth;
            loadFill.classList.add('is-animating');
        }

        await this.loadSplashVersionText();

        window.setTimeout(() => {
            if (loadBar) {
                loadBar.classList.add('hidden');
            }

            this.updateSplashContinueButtonState();

            if (splashActions) {
                splashActions.classList.remove('hidden');
            }
        }, 3000);
    },

    updateSplashContinueButtonState() {
        const splashContinueBtn = document.getElementById('splashContinueBtn');
        if (!splashContinueBtn) return;

        const hasGame = this.hasActiveGame();
        // Primär: Button nur bei vorhandenem Spielstand anzeigen.
        splashContinueBtn.classList.toggle('hidden', !hasGame);
        // Fallback: selbst wenn sichtbar, ohne Spielstand deaktiviert und funktionslos.
        splashContinueBtn.disabled = !hasGame;
        splashContinueBtn.setAttribute('aria-disabled', hasGame ? 'false' : 'true');
        splashContinueBtn.title = hasGame ? '' : 'Kein Spielstand geladen';
    },

    leaveSplashToStartMenu() {
        document.body.classList.remove('is-splash-active');
        this.showScreen('startMenu');
        this.updateQuizInfo();
    },

    leaveSplashToContinueGame() {
        if (!this.hasActiveGame()) {
            this.leaveSplashToStartMenu();
            return;
        }

        document.body.classList.remove('is-splash-active');
        this.continueGame();
    },

    async loadSplashVersionText() {
        const versionElement = document.getElementById('splashVersion');
        const startMenuSubtitle = document.getElementById('startMenuSubtitle');
        const subtitleBase = 'by Sigi Schulz';

        if (!versionElement) return;

        try {
            const response = await fetch('./Versioninfo.txt', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const text = (await response.text()).trim();
            const singleLineVersion = text.replace(/\s*\r?\n\s*/g, ' ').trim();
            const versionText = singleLineVersion || 'Version unbekannt';

            versionElement.textContent = versionText;

            if (startMenuSubtitle) {
                startMenuSubtitle.textContent = `${subtitleBase} ${versionText}`;
            }
        } catch {
            versionElement.textContent = 'Version unbekannt';
            if (startMenuSubtitle) {
                startMenuSubtitle.textContent = `${subtitleBase} Version unbekannt`;
            }
        }
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

        const startMenuHelpBtn = document.getElementById('startMenuHelpButton');
        if (startMenuHelpBtn) {
            startMenuHelpBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.showHelp();
            }, { capture: true });
        }

        const startMenuReadmeBtn = document.getElementById('startMenuReadmeButton');
        if (startMenuReadmeBtn) {
            startMenuReadmeBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.showReadme();
            }, { capture: true });
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

        const splashMainMenuBtn = document.getElementById('splashMainMenuBtn');
        if (splashMainMenuBtn) {
            splashMainMenuBtn.addEventListener('click', () => this.leaveSplashToStartMenu());
        }

        const splashContinueBtn = document.getElementById('splashContinueBtn');
        if (splashContinueBtn) {
            splashContinueBtn.addEventListener('click', () => this.leaveSplashToContinueGame());
        }

        const brandNameInput = document.getElementById('brandNameInput');
        if (brandNameInput) {
            const update = () => this.previewBrandNameFromInput();
            brandNameInput.addEventListener('input', update);
            brandNameInput.addEventListener('change', update);
        }

        this.bindSettingsPreviewHandlers();
    },

    bindSettingsPreviewHandlers() {
        const settingIds = [
            'primaryColor',
            'secondaryColor',
            'tertiaryColor',
            'quaternaryColor',
            'backgroundColor',
            'tileTextMode'
        ];

        const preview = () => this.previewThemeSettingsFromInputs();

        settingIds.forEach((id) => {
            const input = document.getElementById(id);
            if (!input) return;
            input.addEventListener('input', preview);
            input.addEventListener('change', preview);
        });
    },

    previewThemeSettingsFromInputs() {
        if (this.state.currentScreenId !== 'settings') {
            return;
        }
        const settings = this.collectThemeSettingsFromInputs();
        this.applyThemeSettings(settings, { persist: false, updateInputs: false });
    },

    previewBrandNameFromInput() {
        if (this.state.currentScreenId !== 'settings') {
            return;
        }

        const brandNameInput = document.getElementById('brandNameInput');
        if (!brandNameInput) return;
        this.applyBrandName(brandNameInput.value, { persist: false, updateInput: false });
    },

    showAnimationsComingSoon() {
        alert('Animationen folgen in einer späteren Version.');
    },

    initBranding() {
        const logo = document.querySelector('.brand-badge img');
        if (!logo) return;

        const nameLabel = document.querySelector('.brand-badge span');
        if (nameLabel) {
            const initialName = nameLabel.textContent ? nameLabel.textContent.trim() : '';
            if (initialName) {
                this.state.defaultBrandName = initialName;
            }
        }

        if (!this.state.defaultBrandLogoSrc) {
            this.state.defaultBrandLogoSrc = logo.getAttribute('src');
        }

        const storedLogoData = localStorage.getItem('quiz_brand_logo_data');
        if (storedLogoData) {
            this.applyBrandLogo(storedLogoData, { persist: false });
        } else {
            this.applyBrandLogo(null, { persist: false });
        }

        const storedBrandName = localStorage.getItem('quiz_brand_name');
        this.applyBrandName(storedBrandName || this.state.defaultBrandName, { persist: false, updateInput: true });
    },

    applyBrandLogo(logoDataUrl, options = {}) {
        const { persist = false } = options;
        const logo = document.querySelector('.brand-badge img');
        if (!logo) return;

        const hasCustomLogo = typeof logoDataUrl === 'string' && logoDataUrl.startsWith('data:image/');
        const fallbackSrc = this.state.defaultBrandLogoSrc || logo.getAttribute('src');
        const resolvedSrc = hasCustomLogo ? logoDataUrl : fallbackSrc;
        logo.src = resolvedSrc;

        const settingsLogoPreview = document.getElementById('settingsLogoPreview');
        if (settingsLogoPreview) {
            settingsLogoPreview.src = resolvedSrc;
        }

        const startMenuBrandLogo = document.getElementById('startMenuBrandLogo');
        if (startMenuBrandLogo) {
            startMenuBrandLogo.src = resolvedSrc;
        }

        this.state.brandLogoDataUrl = hasCustomLogo ? logoDataUrl : null;

        if (persist) {
            if (this.state.brandLogoDataUrl) {
                localStorage.setItem('quiz_brand_logo_data', this.state.brandLogoDataUrl);
            } else {
                localStorage.removeItem('quiz_brand_logo_data');
            }
        }
    },

    applyBrandName(rawName, options = {}) {
        const { persist = false, updateInput = true } = options;
        const badgeLabel = document.querySelector('.brand-badge span');
        if (!badgeLabel) return;

        const fallbackName = this.state.defaultBrandName || 'QuizWallah';
        const cleaned = typeof rawName === 'string' ? rawName.trim() : '';
        const resolvedName = cleaned || fallbackName;

        badgeLabel.textContent = resolvedName;
        const startMenuBrandTitle = document.getElementById('startMenuBrandTitle');
        if (startMenuBrandTitle) {
            startMenuBrandTitle.textContent = resolvedName;
        }
        this.state.brandName = resolvedName;

        if (updateInput) {
            const brandNameInput = document.getElementById('brandNameInput');
            if (brandNameInput) {
                brandNameInput.value = resolvedName;
            }
        }

        if (persist) {
            localStorage.setItem('quiz_brand_name', resolvedName);
        }
    },

    getBrandingSettingsSnapshot() {
        return {
            logoDataUrl: this.state.brandLogoDataUrl,
            brandName: this.state.brandName
        };
    },

    handleLogoUpload(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : null;
            if (!result) {
                alert('Logo konnte nicht geladen werden.');
                return;
            }
            this.applyBrandLogo(result, { persist: false });
            alert('Logo geladen. Mit "Anwenden" speicherst du es dauerhaft.');
        };
        reader.onerror = () => {
            alert('Logo konnte nicht gelesen werden.');
        };
        reader.readAsDataURL(file);

        // Erlaubt das erneute Auswählen derselben Datei.
        event.target.value = '';
    },

    rgbToHex(r, g, b) {
        const clamp = (value) => Math.max(0, Math.min(255, value));
        const toHex = (value) => clamp(value).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    },

    async extractPaletteFromLogoDataUrl(logoDataUrl) {
        if (!logoDataUrl) {
            throw new Error('Kein Logo verfügbar');
        }

        const image = new Image();
        image.decoding = 'async';
        image.src = logoDataUrl;

        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error('Logo konnte nicht verarbeitet werden'));
        });

        const canvas = document.createElement('canvas');
        const size = 64;
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            throw new Error('Canvas-Kontext nicht verfügbar');
        }

        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(image, 0, 0, size, size);

        const imageData = ctx.getImageData(0, 0, size, size).data;
        const buckets = new Map();

        for (let i = 0; i < imageData.length; i += 16) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            const a = imageData[i + 3];

            if (a < 180) continue;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;
            const saturation = max === 0 ? 0 : delta / max;
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;

            // Sehr neutrale Pixel und fast weiss/schwarz ausblenden.
            if (brightness > 245 || brightness < 20 || saturation < 0.08) continue;

            const qr = Math.round(r / 32) * 32;
            const qg = Math.round(g / 32) * 32;
            const qb = Math.round(b / 32) * 32;
            const key = `${qr},${qg},${qb}`;
            const score = 1 + saturation * 2;

            buckets.set(key, (buckets.get(key) || 0) + score);
        }

        const ranked = [...buckets.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([key]) => key.split(',').map((value) => parseInt(value, 10)));

        const selected = [];
        ranked.forEach((rgb) => {
            if (selected.length >= 6) return;
            const isDistinct = selected.every((other) => {
                const dist = Math.sqrt(
                    Math.pow(rgb[0] - other[0], 2)
                    + Math.pow(rgb[1] - other[1], 2)
                    + Math.pow(rgb[2] - other[2], 2)
                );
                return dist >= 52;
            });
            if (isDistinct) selected.push(rgb);
        });

        const hexPalette = selected.map((rgb) => this.rgbToHex(rgb[0], rgb[1], rgb[2]));
        return hexPalette;
    },

    async applyThemeFromLogo() {
        try {
            if (!this.state.brandLogoDataUrl) {
                alert('Bitte zuerst ein eigenes Logo laden.');
                return;
            }

            const palette = await this.extractPaletteFromLogoDataUrl(this.state.brandLogoDataUrl);
            if (palette.length === 0) {
                alert('Im Logo konnten keine geeigneten Farben erkannt werden.');
                return;
            }

            const current = this.sanitizeThemeSettings(this.collectThemeSettingsFromInputs(), this.getThemeDefaults());
            const updated = {
                ...current,
                color1: palette[0] || current.color1,
                color2: palette[1] || current.color2,
                color3: palette[2] || current.color3,
                color4: palette[3] || current.color4,
                tileTextMode: this.getDefaultTileTextMode(palette[0] || current.color1)
            };

            this.applyThemeSettings(updated, { persist: false, updateInputs: true });
        } catch (error) {
            alert(`Farben konnten nicht aus dem Logo gelesen werden: ${error.message}`);
        }
    },

    // ============ SCREEN MANAGEMENT ============
    showScreen(screenId) {
        const previous = this.state.currentScreenId;
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(screenId);
        if (target) target.classList.remove('hidden');
        this.state.previousScreenId = previous || 'startMenu';
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
            ? `Besondere Wünsche: ${special}`
            : 'Keine besonderen Zusatzwünsche.';

        const sourceInstructions = sourceMode === 'material'
            ? [
                'Quiz-Basis: Konkretes hochgeladenes Material.',
                'Erstelle Fragen ausschliesslich auf Basis des bereitgestellten Materials.',
                'WICHTIG: Der Nutzer lädt das Material direkt in der externen KI hoch.',
                materialContext
                    ? `Material-Hinweise/Inhaltsauszüge: ${materialContext}`
                    : 'Material-Hinweise/Inhaltsauszüge: keine weiteren Angaben.',
                'Wenn Material unklar ist, treffe keine Faktenannahmen ausserhalb des Materials.'
            ]
            : [
                `Thema: ${theme}`,
                `Zielgruppe: ${audience}`
            ];

        return [
            'Du erstellst ein Quiz für eine Jeopardy-Quizwand.',
            'WICHTIG: Gib AUSSCHLIESSLICH gültiges JSON zurück. Kein Text davor oder danach.',
            'Achte darauf, ausschließlich gerade ASCII-Anführungszeichen (") für alle Feldnamen und Strings zu verwenden. Keine typografischen Anführungszeichen („ “ oder ‘ ’), wie sie z. B. auf Apple-Geräten oder in Textverarbeitungen vorkommen.',
            'Jeder einzelne Backslash (\\) muss in JSON als doppelter Backslash (\\\\) geschrieben werden, z. B. $1\\,\\mathrm{kWh}$.',
            'Verwende keine Sonderzeichen oder Formatierungen, die von bestimmten Plattformen (wie macOS/iOS) automatisch eingefügt werden könnten.',
            'Das JSON muss so formatiert sein, dass es direkt importierbar ist. Kein Text, keine Kommentare, keine Formatierungen davor oder danach.',
            'HINWEIS: Fragen und Antworten werden als reiner Text angezeigt. ALLE mathematischen Formeln (z. B. Brüche, Potenzen, Indizes, griechische Buchstaben, Summen, Integrale, Wurzeln, etc.) MÜSSEN IMMER im LaTeX-Format und IMMER in $...$ gesetzt werden (z. B. $a^2 + b^2 = c^2$, $v = \\frac{s}{t}$, $\\rho = \\frac{m}{V}$, $A = \\pi r^2$).',
            'Chemische Summenformeln und Reaktionsschemata MÜSSEN IMMER als mhchem-Syntax ausgegeben werden, z. B. $\\ce{H2O}$ oder $\\ce{2H2 + O2 -> 2H2O}$. Niemals als Unicode (wie H₂O) oder Klartext!',
            'Auch LaTeX-Subskripte sind möglich (z. B. $\\mathrm{H_2O}$).',
            'Diese werden automatisch mit MathJax (inkl. mhchem) gerendert. Kein HTML, keine Tabellen, keine Bilder, keine Formatierungen außer LaTeX/mhchem.',
            '',
            ...sourceInstructions,
            `Maximale Gesamtanzahl Fragen: ${maxQuestions}`,
            categoryInstruction,
            specialInstruction,
            '',
            'Anforderungen an die Struktur:',
            '- Gib ein JSON-Objekt mit den Feldern "quizTitle" und "categories" zurück.',
            '- "categories" ist ein Array von Kategorien.',
            '- Jede Kategorie hat: "name" (String) und "questions" (Array).',
            '- Kategorienamen kurz halten: maximal 3 Zeilen à 24 Zeichen (also höchstens 72 Zeichen pro Kategoriename).',
            '- Jede Frage hat: "points" (Integer > 0), "question" (String), "answer" (String).',
            '- Nutze sinnvolle Punktestufen pro Kategorie (z. B. 100,200,300,400,500).',
            '- Überschreite die maximale Gesamtanzahl Fragen nicht.',
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
            throw new Error('Bitte füge zuerst eine KI-Antwort ein.');
        }

        const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fencedMatch && fencedMatch[1]) {
            return fencedMatch[1].trim();
        }

        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) {
            throw new Error('Kein gültiges JSON-Objekt in der KI-Antwort gefunden.');
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
            throw new Error('Die KI-Antwort enthält keine gültigen Kategorien.');
        }


        // Hilfsfunktion: Korrigiere häufige LLM-Fehler in LaTeX, aber nur wenn es wirklich wie LaTeX aussieht
        // Protokolliert Änderungen in ein Array
        function fixLatex(str, protokoll, context) {
            if (typeof str !== 'string') return str;
            let s = str;
            if (!looksLikeLatex(s)) return s;
            function logChange(alt, neu, info) {
                if (protokoll && alt !== neu) protokoll.push({ alt, neu, info });
            }
            let before;
            // 1. "rac{" nur ersetzen, wenn nicht schon ein Backslash oder Buchstabe davor steht
            before = s; s = s.replace(/(^|[^a-zA-Z\\])rac\{/g, '$1\\frac{'); logChange(before, s, context + ' rac→frac');
            // 2. "ext{" nur ersetzen, wenn nicht schon ein Backslash oder Buchstabe davor steht
            before = s; s = s.replace(/(^|[^a-zA-Z\\])ext\{/g, '$1\\text{'); logChange(before, s, context + ' ext→text');
            // 3. Fehlende Backslashes vor frac, sqrt, etc. (aber nicht doppelt)
            before = s; s = s.replace(/(?<!\\)frac\{/g, '\\frac{'); logChange(before, s, context + ' frac');
            before = s; s = s.replace(/(?<!\\)sqrt\{/g, '\\sqrt{'); logChange(before, s, context + ' sqrt');
            // 4. Fehlende Backslashes vor log, sin, cos, tan
            before = s; s = s.replace(/(?<!\\)log\b/g, '\\log'); logChange(before, s, context + ' log');
            before = s; s = s.replace(/(?<!\\)sin\b/g, '\\sin'); logChange(before, s, context + ' sin');
            before = s; s = s.replace(/(?<!\\)cos\b/g, '\\cos'); logChange(before, s, context + ' cos');
            before = s; s = s.replace(/(?<!\\)tan\b/g, '\\tan'); logChange(before, s, context + ' tan');
            // 5. Automatische Korrektur für (\\frac{...}{...}) → \\left(\\frac{...}{...}\\right)
            before = s; s = s.replace(/\((\\frac\{[^}]+\}\{[^}]+\})\)/g, '\\left($1\\right)'); logChange(before, s, context + ' (frac)');
            // 6. Speziell: Einzelnes \f gefolgt von Zahl oder Klammer durch \frac ersetzen, aber nicht wenn schon "frac" folgt
            before = s; s = s.replace(/\\f\s*(\d|\{)/g, '\\frac$1'); logChange(before, s, context + ' \\f→\\frac');
            // 7. Entferne einzelne Backslashes nur vor Zeichen, die KEIN valides LaTeX-Kommando sind, aber NICHT vor "f" oder "t" (um "frac" und "text" zu schützen)
            before = s; s = s.replace(/\\([rabcdeghjklmnopqsuvwxyz])(?![a-zA-Z])/g, ''); logChange(before, s, context + ' einzelne Backslashes');
            return s;
        }
    // Änderungsprotokoll für alle Fragen/Antworten
    const latexChangeLog = [];

        // Hilfsfunktion: Erkennt, ob ein String wie eine LaTeX-Formel aussieht
        function looksLikeLatex(str) {
            if (!str) return false;
            // Enthält typische LaTeX-Kommandos oder Operatoren, aber nicht nur ein "r" oder "f" am Anfang
            return /\\(ce|mathrm|frac|sqrt|sum|int|rho|pi|cdot|alpha|beta|gamma|Delta|theta|mu|nu|lambda|phi|psi|Omega|leq|geq|neq|approx|rightarrow|leftarrow|infty|partial|dots|over|under|hat|bar|vec|dot|times|pm|div|sin|cos|tan|log|ln|exp)|\^|_|\{|\}/.test(str);
        }

        // Hilfsfunktion: Setzt $...$ um Formeln, falls nötig
        function autoWrapLatex(str) {
            if (!str) return str;
            let s = str.trim();
            // Bereits in $...$?
            if (s.startsWith('$') && s.endsWith('$')) return s;
            // Nur Formel?
            if (looksLikeLatex(s)) return `$${s}$`;
            // Gemischter Inhalt: Suche Gleichheitszeichen mit Formel
            if (/=/.test(s) && looksLikeLatex(s)) {
                // Versuche ab erstem = alles als Formel zu wrappen
                const eqIdx = s.indexOf('=');
                const left = s.slice(0, eqIdx + 1);
                const right = s.slice(eqIdx + 1);
                if (looksLikeLatex(right)) {
                    return `${left} $${right.trim()}$`;
                }
            }
            return s;
        }

        const categories = categoriesSource.map((cat, cIdx) => {
            const name = (cat && typeof cat.name === 'string' && cat.name.trim())
                ? cat.name.trim()
                : `Kategorie ${cIdx + 1}`;

            const sourceQuestions = Array.isArray(cat?.questions) ? cat.questions : [];
            if (sourceQuestions.length === 0) {
                throw new Error(`Kategorie ${cIdx + 1} enthält keine Fragen.`);
            }

            const questions = sourceQuestions.map((q, qIdx) => {
                const pointsNum = parseInt(q?.points, 10);
                const points = Number.isInteger(pointsNum) && pointsNum > 0
                    ? pointsNum
                    : 100 * (qIdx + 1);
                let question = typeof q?.question === 'string' ? q.question.trim() : '';
                let answer = typeof q?.answer === 'string' ? q.answer.trim() : '';

                if (!question || !answer) {
                    throw new Error(`Frage ${qIdx + 1} in Kategorie ${cIdx + 1} ist unvollständig.`);
                }

                // Frage: Nur $...$-Bereiche korrigieren
                question = question.replace(/\$(.+?)\$/g, (match, p1) => {
                    const fixed = fixLatex(p1, latexChangeLog, `Frage [${cat.name} #${qIdx + 1}]`);
                    return `$${fixed}$`;
                });

                // Antwort: Nur auf Antworten anwenden, die wie LaTeX aussehen
                if (looksLikeLatex(answer)) {
                    const orig = answer;
                    const fixed = fixLatex(answer, latexChangeLog, `Antwort [${cat.name} #${qIdx + 1}]`);
                    answer = autoWrapLatex(fixed);
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

        // Nach dem Import ggf. Änderungsprotokoll anzeigen
        if (latexChangeLog.length > 0) {
            let protokoll = 'Automatische Korrekturen an LaTeX-Formeln beim Import:\n';
            protokoll += 'Nr. | Kontext | alt | neu\n';
            latexChangeLog.slice(0, 15).forEach((c, i) => {
                protokoll += `${i + 1}. | ${c.info} | ${c.alt} | ${c.neu}\n`;
            });
            if (latexChangeLog.length > 15) protokoll += `... und ${latexChangeLog.length - 15} weitere ...\n`;
            alert(protokoll);
        }
        return { quizTitle, categories };
    },

    importQuizFromAiResponse() {
        const input = document.getElementById('aiResponseInput');
        if (!input) return;

        try {
            let jsonText = this.extractJsonFromAiResponse(input.value);
            // Automatische Korrektur typografischer Anführungszeichen
            const typographicQuotes = /[“”„‟❝❞＂«»‘’‚‛❮❯‹›]/g;
            if (typographicQuotes.test(jsonText)) {
                jsonText = jsonText.replace(/[“”„‟❝❞＂«»‘’‚‛❮❯‹›]/g, '"');
            }
            let parsed;
            let parseError = null;
            try {
                parsed = JSON.parse(jsonText);
            } catch (err1) {
                parseError = err1;
            }
            if (!parsed) {
                // Fehleranalyse: Finde alle einzelnen Backslashes, nicht korrekt escaped
                const regex = /(?<!\\)\\(?![\\"/bfnrtu])/g;
                let match;
                let errorCount = 0;
                let errorContexts = [];
                while ((match = regex.exec(jsonText)) !== null) {
                    errorCount++;
                    const start = Math.max(0, match.index - 12);
                    const end = Math.min(jsonText.length, match.index + 12);
                    errorContexts.push(jsonText.slice(start, end));
                }
                let msg = `Das JSON ist fehlerhaft und konnte nicht importiert werden.\n`;
                msg += `Gefundene potenzielle Fehlerstellen (Backslashes, die nicht korrekt escaped sind): ${errorCount}`;
                if (errorCount > 0) {
                    msg += "\nBeispiele (im Kontext):\n" + errorContexts.slice(0, 5).map((c, i) => `${i + 1}. ...${c}...`).join("\n");
                }
                msg += "\nSoll eine automatische Korrektur versucht werden?";
                msg += "\n\nHinweis: Auf Apple-Geräten (macOS/iOS) und in manchen Textverarbeitungen werden oft typografische Anführungszeichen verwendet. Bitte ersetze diese durch normale doppelte Anführungszeichen (\").";
                if (confirm(msg)) {
                    // Korrektur durchführen und Änderungen protokollieren
                    let changes = [];
                    let fixed = jsonText.replace(regex, (m, offset) => {
                        const before = jsonText.slice(Math.max(0, offset - 12), offset + 2);
                        const after = jsonText.slice(Math.max(0, offset - 12), offset + 2).replace(/\\/g, "\\\\");
                        changes.push({ alt: before, neu: after });
                        return "\\\\";
                    });
                    let fixedParsed;
                    try {
                        fixedParsed = JSON.parse(fixed);
                    } catch (err2) {
                        let msg2 = 'Korrekturversuch fehlgeschlagen.\nFehler: ' + err2.message + '\n';
                        msg2 += 'Mögliche Gründe: Nicht korrekt escaped, Syntaxfehler, fehlende oder zu viele Klammern/Anführungszeichen.';
                        msg2 += '\nBitte prüfe das JSON manuell.';
                        alert(msg2);
                        return;
                    }
                    // Änderungsprotokoll anzeigen
                    if (changes.length > 0) {
                        let protokoll = 'Folgende Änderungen wurden vorgenommen (Kontext):\n';
                        protokoll += 'Nr. | alt | neu\n';
                        changes.slice(0, 10).forEach((c, i) => {
                            protokoll += `${i + 1}. | ${c.alt} | ${c.neu}\n`;
                        });
                        if (changes.length > 10) protokoll += `... und ${changes.length - 10} weitere ...\n`;
                        alert(protokoll);
                    }
                    parsed = fixedParsed;
                } else {
                    let msg2 = 'Import abgebrochen.\nMögliche Gründe für Fehler im JSON:\n';
                    msg2 += '- Nicht korrekt escaped (Backslashes, Anführungszeichen)\n';
                    msg2 += '- Syntaxfehler (fehlende oder zu viele Klammern/Anführungszeichen)\n';
                    msg2 += '- Falsche Struktur (fehlende Felder)\n';
                    msg2 += '\nGefundene Fehlerstellen (Kontext):\n';
                    msg2 += errorContexts.slice(0, 10).map((c, i) => `${i + 1}. ...${c}...`).join("\n");
                    msg2 += '\n\nHinweis: Auf Apple-Geräten (macOS/iOS) und in manchen Textverarbeitungen werden oft typografische Anführungszeichen verwendet. Bitte ersetze diese durch normale doppelte Anführungszeichen (\").';
                    alert(msg2);
                    return;
                }
            }
            const imported = this.normalizeImportedQuiz(parsed);

            this.state.quizTitle = imported.quizTitle;
            this.state.editor.categories = imported.categories;
            this.state.editor.teams = [];
            this.state.game = null;
            this.state.victoryCeremonyShown = false;
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
        text.textContent = 'Dies löscht den aktuellen Spielstand, okay?';
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
        // Chips für Teamanzahl (2-4)
        const teamCountChips = document.getElementById('teamCountChips');
        const teamNamesContainer = document.getElementById('teamNamesQuick');
        if (!teamCountChips || !teamNamesContainer) return;

        // Initialwert
        if (!this.state.quickTeamCount) this.state.quickTeamCount = 2;
        let teamCount = this.state.quickTeamCount;
        teamCount = Math.max(2, Math.min(4, teamCount));
        this.state.quickTeamCount = teamCount;

        // Chips rendern
        teamCountChips.innerHTML = '';
        for (let i = 2; i <= 4; i++) {
            const chip = document.createElement('div');
            chip.className = 'team-count-chip' + (teamCount === i ? ' active' : '');
            chip.textContent = `${i} Teams`;
            chip.onclick = () => {
                this.state.quickTeamCount = i;
                this.renderTeamSetup();
            };
            teamCountChips.appendChild(chip);
        }

        // Teamnamen-Felder
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

        // Teamanzahl aus Setup holen (immer 2-4)
        let teamCount = this.state.quickTeamCount;
        teamCount = Math.max(2, Math.min(4, teamCount));
        const teams = [];
        for (let i = 0; i < teamCount; i++) {
            const name = (this.state.quickTeamNames?.[i] || '').trim() || `Team ${i + 1}`;
            teams.push({ id: i, name, score: 0 });
        }

        this.state.editor.teams = teams.map(team => ({ name: team.name }));
        this.state.game = { teams, playedQuestions: [] };
        this.state.victoryCeremonyShown = false;
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
            alert('Bitte ein gültiges Punkte-Schema eingeben, z. B. 100,200,300,400,500.');
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
        this.state.victoryCeremonyShown = false;
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

        this.state.victoryCeremonyShown = false;
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
        const input = prompt('Dateiname für das Quiz (ohne Endung):', defaultBase);
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
                    throw new Error('Keine gültigen Kategorien gefunden.');
                }

                this.state.editor.categories = categories;
                this.state.quizTitle = parsed.quizTitle || parsed.title || 'QuizWallah';
                this.state.game = null;
                this.state.victoryCeremonyShown = false;
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
            this.state.victoryCeremonyShown = false;
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
            text.textContent = 'Aktuelles Quiz und Spielstand gehen verloren, wenn du fortfährst.';
        } else if (hasQuiz) {
            text.textContent = 'Das aktuelle Quiz geht verloren, wenn du fortfährst.';
        } else {
            text.textContent = 'Der aktuelle Spielstand geht verloren, wenn du fortfährst.';
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
        this.state.victoryCeremonyShown = false;
        this.state.quickTeamNames = [];
        this.state.editor.teams = [];
        this.state.editor.categories = [];
        this.state.quizTitle = 'QuizWallah';
        this.saveGameState();

        this.showScreen('gameSetup');
        this.renderGameSetup();
    },

    getTotalQuestionCount() {
        const categories = Array.isArray(this.state.editor.categories) ? this.state.editor.categories : [];
        return categories.reduce((sum, category) => {
            const count = Array.isArray(category?.questions) ? category.questions.length : 0;
            return sum + count;
        }, 0);
    },

    shouldShowVictoryCeremony() {
        if (this.state.victoryCeremonyShown) return false;
        if (!this.hasActiveGame()) return false;

        const totalQuestions = this.getTotalQuestionCount();
        if (totalQuestions <= 0) return false;

        return this.state.playedQuestions.size >= totalQuestions;
    },

    finishGameAndReturnToMenu() {
        this.state.game = null;
        this.state.playedQuestions = new Set();
        this.state.currentQuestion = null;
        this.state.quickTeamNames = [];
        this.state.victoryCeremonyShown = false;
        this.saveGameState();
        this.updateQuizInfo();
        this.showScreen('startMenu');
    },

    showVictoryCeremonyModal() {
        if (!this.hasActiveGame()) return;

        const sorted = [...this.state.game.teams].sort((a, b) => b.score - a.score);
        const podiumTeams = sorted.slice(0, 3);
        if (podiumTeams.length === 0) {
            this.finishGameAndReturnToMenu();
            return;
        }

        const modal = this.createModal('Siegerehrung', { layout: 'qa' });
        const modalRoot = modal.content.closest('.custom-modal');
        modalRoot?.classList.add('custom-modal-victory');
        const isLandscape = window.matchMedia('(orientation: landscape)').matches;
        const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        const viewportHeight = window.innerHeight;
        const compactLandscape = isLandscape && isTouchDevice && viewportHeight <= 560;
        let rebuildTimer = null;
        let listenersCleaned = false;

        const cleanupVictoryModalListeners = () => {
            if (listenersCleaned) return;
            listenersCleaned = true;
            if (rebuildTimer) {
                window.clearTimeout(rebuildTimer);
                rebuildTimer = null;
            }
            window.removeEventListener('orientationchange', scheduleVictoryModalRebuild);
            window.removeEventListener('resize', scheduleVictoryModalRebuild);
            observer.disconnect();
        };

        const scheduleVictoryModalRebuild = () => {
            if (!modalRoot || !document.body.contains(modalRoot)) {
                cleanupVictoryModalListeners();
                return;
            }

            if (rebuildTimer) {
                window.clearTimeout(rebuildTimer);
            }

            rebuildTimer = window.setTimeout(() => {
                if (!modalRoot || !document.body.contains(modalRoot)) {
                    cleanupVictoryModalListeners();
                    return;
                }

                cleanupVictoryModalListeners();
                modal.close();
                this.showVictoryCeremonyModal();
            }, 180);
        };

        const observer = new MutationObserver(() => {
            if (!modalRoot || !document.body.contains(modalRoot)) {
                cleanupVictoryModalListeners();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('orientationchange', scheduleVictoryModalRebuild, { passive: true });
        window.addEventListener('resize', scheduleVictoryModalRebuild, { passive: true });

        const body = document.createElement('div');
        body.className = 'qa-modal-body';
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        body.style.gap = compactLandscape ? '0.35rem' : '0.55rem';

        const podium = document.createElement('div');
        podium.style.display = 'grid';
        podium.style.gridTemplateColumns = podiumTeams.length === 3
            ? 'repeat(3, minmax(0, 1fr))'
            : `repeat(${Math.max(1, podiumTeams.length)}, minmax(0, 1fr))`;
        podium.style.gap = compactLandscape ? '0.35rem' : (isLandscape ? '0.65rem' : '0.5rem');
        podium.style.minHeight = compactLandscape
            ? 'clamp(140px, 26vh, 190px)'
            : (isLandscape ? 'clamp(220px, 44vh, 360px)' : 'clamp(220px, 38vh, 320px)');
        podium.style.alignItems = 'end';

        // Fixed podium positions; reveal strictly in this order: 3 -> 2 -> 1.
        const rankedByPlace = podiumTeams.map((team, idx) => ({ team, place: idx + 1 }));
        const displayOrder = (rankedByPlace.length === 3)
            ? [rankedByPlace[1], rankedByPlace[0], rankedByPlace[2]]
            : rankedByPlace;
        const revealPlaces = rankedByPlace.length === 3
            ? [3, 2, 1]
            : [...rankedByPlace].map((entry) => entry.place).reverse();

        const medalForPlace = (place) => {
            if (place === 1) return '🏆';
            if (place === 2) return '🥈';
            return '🥉';
        };

        const rowsByPlace = new Map();
        displayOrder.forEach(({ team, place }) => {
            const isWinner = place === 1;
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'center';
            row.style.textAlign = 'center';
            row.style.gap = compactLandscape ? '0.24rem' : (isLandscape ? '0.38rem' : '0.42rem');
            row.style.padding = isLandscape
                ? (isWinner ? '0.78rem 0.55rem' : '0.62rem 0.45rem')
                : (isWinner ? '0.72rem 0.72rem' : '0.58rem 0.62rem');
            row.style.minHeight = compactLandscape
                ? (place === 1 ? '8.1rem' : place === 2 ? '7rem' : '5.9rem')
                : isLandscape
                ? (place === 1 ? '12rem' : place === 2 ? '10rem' : '8.6rem')
                : (place === 1 ? '10.8rem' : place === 2 ? '9.2rem' : '7.8rem');
            row.style.border = isWinner ? '2px solid var(--primary-color)' : '1px solid var(--border-color)';
            row.style.borderRadius = '0.6rem';
            row.style.background = isWinner ? 'rgba(247, 192, 1, 0.12)' : '#fff';
            row.style.boxShadow = isWinner ? '0 6px 18px rgba(247, 192, 1, 0.22)' : 'none';
            row.style.opacity = '0';
            row.style.transform = compactLandscape
                ? 'translateX(8px) scale(0.98)'
                : (isLandscape ? 'translateX(12px) scale(0.98)' : 'translateY(12px) scale(0.98)');
            row.style.transition = 'opacity 420ms ease, transform 420ms ease';

            const medal = document.createElement('span');
            medal.textContent = medalForPlace(place);
            medal.style.fontSize = compactLandscape ? (isWinner ? '1.28rem' : '1.05rem') : (isWinner ? '1.6rem' : '1.25rem');
            medal.style.textAlign = 'center';

            const name = document.createElement('strong');
            name.textContent = `${place}. ${team.name}`;
            name.style.fontSize = compactLandscape ? (isWinner ? '0.94rem' : '0.82rem') : (isWinner ? '1.18rem' : '1rem');
            name.style.fontWeight = isWinner ? '800' : '700';
            name.style.lineHeight = '1.2';

            const score = document.createElement('span');
            score.textContent = `${team.score} Punkte`;
            score.style.fontWeight = isWinner ? '800' : '700';
            score.style.fontSize = compactLandscape ? (isWinner ? '0.88rem' : '0.78rem') : (isWinner ? '1.08rem' : '0.95rem');

            row.appendChild(medal);
            row.appendChild(name);
            row.appendChild(score);
            podium.appendChild(row);
            rowsByPlace.set(place, row);
        });

        body.appendChild(podium);
        modal.content.appendChild(body);

        const actions = document.createElement('div');
        actions.className = 'qa-modal-actions';
        actions.style.marginTop = '0.4rem';

        const finishBtn = document.createElement('button');
        finishBtn.className = 'btn btn-primary';
        finishBtn.textContent = 'Weiter';
        finishBtn.onclick = () => {
            cleanupVictoryModalListeners();
            modal.close();
            this.finishGameAndReturnToMenu();
        };

        actions.appendChild(finishBtn);
        modal.content.appendChild(actions);

        const card = modalRoot?.querySelector('.custom-modal-card-qa');
        if (modalRoot && card) {
            const width = compactLandscape ? '90vw' : (isLandscape ? '98vw' : '94vw');
            const height = compactLandscape ? '90svh' : (isLandscape ? '94svh' : '88svh');

            if (compactLandscape) {
                modalRoot.style.setProperty('align-items', 'center', 'important');
                modalRoot.style.setProperty('justify-content', 'center', 'important');
                modalRoot.style.setProperty('padding', '5svh 5vw', 'important');
            } else if (isLandscape) {
                modalRoot.style.setProperty('position', 'absolute', 'important');
                modalRoot.style.setProperty('top', '0', 'important');
                modalRoot.style.setProperty('left', '0', 'important');
                modalRoot.style.setProperty('right', '0', 'important');
                modalRoot.style.setProperty('height', 'auto', 'important');
                modalRoot.style.setProperty('min-height', 'calc(100svh + 70px)', 'important');
                modalRoot.style.setProperty('align-items', 'flex-start', 'important');
                modalRoot.style.setProperty('overflow-y', 'auto', 'important');
                modalRoot.style.setProperty('padding-top', 'calc(0.24rem + env(safe-area-inset-top, 0px))', 'important');
                modalRoot.style.setProperty('padding-bottom', 'calc(0.82rem + env(safe-area-inset-bottom, 0px))', 'important');
            }

            card.style.setProperty('width', width, 'important');
            card.style.setProperty('max-width', width, 'important');
            card.style.setProperty('height', height, 'important');
            card.style.setProperty('max-height', height, 'important');
            card.style.setProperty('padding', compactLandscape ? '0.5rem 0.6rem' : (isLandscape ? '0.75rem 0.85rem' : '1rem'), 'important');

            const heading = card.querySelector('h2');
            if (heading) {
                heading.style.setProperty('font-size', compactLandscape ? 'clamp(1.28rem, 4.9vw, 1.9rem)' : 'clamp(1.5rem, 5.4vw, 3rem)', 'important');
                heading.style.setProperty('margin-bottom', compactLandscape ? '0.22rem' : '0.45rem', 'important');
                heading.style.setProperty('line-height', '1.05', 'important');
            }
        }

        const firstRevealDelay = 300;
        const gap32 = Math.round(520 * 1.5);
        const gap21 = gap32 * 2;

        revealPlaces.forEach((place, idx) => {
            const row = rowsByPlace.get(place);
            if (!row) return;

            let delay = firstRevealDelay;
            if (idx === 1) delay += gap32;
            if (idx === 2) delay += gap32 + gap21;

            window.setTimeout(() => {
                row.style.opacity = '1';
                row.style.transform = 'translateX(0) translateY(0) scale(1)';
            }, delay);
        });
    },

    resetTeams() {
        if (!this.state.game) {
            alert('Kein aktives Spiel vorhanden.');
            return;
        }

        if (!confirm('Spiel zurücksetzen? Teams und Spielstand gehen verloren, das Quiz bleibt erhalten.')) {
            return;
        }

        this.finishGameAndReturnToMenu();
        alert('Spiel wurde zurückgesetzt.');
    },

    // ============ QUIZ BOARD ============
    renderQuizBoard() {
        const board = document.getElementById('quizBoard');
        const header = document.getElementById('categoryHeader');
        const titleDisplay = document.getElementById('quizTitleDisplay');
        if (titleDisplay) titleDisplay.textContent = this.state.quizTitle || 'QuizWallah';
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
            sorted.forEach((t, idx) => {
                const li = document.createElement('div');
                li.className = 'ranking-item';

                const label = document.createElement('span');
                label.textContent = `${idx + 1}. ${t.name}`;

                const right = document.createElement('div');
                right.className = 'ranking-item-right';

                const score = document.createElement('strong');
                score.textContent = `${t.score}`;

                const adjustBtn = document.createElement('button');
                adjustBtn.type = 'button';
                adjustBtn.className = 'btn btn-secondary ranking-adjust-btn';
                adjustBtn.setAttribute('aria-label', `Punkte für ${t.name} anpassen`);
                adjustBtn.textContent = '✏️';
                adjustBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.showTeamScoreAdjustModal(t.id);
                };

                right.appendChild(score);
                right.appendChild(adjustBtn);
                li.appendChild(label);
                li.appendChild(right);
                list.appendChild(li);
            });
        }
        // Sidebar-Ranking (Quizwand)
        const sidebar = document.getElementById('sidebarRankingList');
        if (sidebar) {
            sidebar.innerHTML = '';
            const sorted = [...this.state.game.teams].sort((a, b) => b.score - a.score);
            sorted.forEach((t, idx) => {
                const li = document.createElement('div');
                li.className = 'ranking-item';

                const label = document.createElement('span');
                label.textContent = `${idx + 1}. ${t.name}`;

                const right = document.createElement('div');
                right.className = 'ranking-item-right';

                const score = document.createElement('strong');
                score.textContent = `${t.score}`;

                const adjustBtn = document.createElement('button');
                adjustBtn.type = 'button';
                adjustBtn.className = 'btn btn-secondary ranking-adjust-btn';
                adjustBtn.setAttribute('aria-label', `Punkte für ${t.name} anpassen`);
                adjustBtn.textContent = '✏️';
                adjustBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.showTeamScoreAdjustModal(t.id);
                };

                right.appendChild(score);
                right.appendChild(adjustBtn);
                li.appendChild(label);
                li.appendChild(right);
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
            this.state.quizTitle = event.target.value.trim() || 'QuizWallah';
        };

        this.renderPointsSchemaControls();

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
        titleInput.className = 'editor-category-name-input';
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

    getGlobalPointsSchemaFromCategories() {
        const categories = Array.isArray(this.state.editor.categories) ? this.state.editor.categories : [];
        if (categories.length === 0) return [];

        const firstQuestions = Array.isArray(categories[0].questions) ? categories[0].questions : [];
        const schema = firstQuestions
            .map((question) => parseInt(question?.points, 10))
            .filter((points) => Number.isInteger(points) && points > 0);

        return schema;
    },

    calculateNextPointLevel(schema) {
        if (!Array.isArray(schema) || schema.length === 0) return 100;
        if (schema.length === 1) return schema[0] + 100;

        const last = schema[schema.length - 1];
        const prev = schema[schema.length - 2];
        const step = Math.max(10, last - prev);
        return last + step;
    },

    applyGlobalPointsSchema(schema) {
        const pointsSchema = Array.isArray(schema)
            ? schema
                .map((value) => parseInt(value, 10))
                .filter((value) => Number.isInteger(value) && value > 0)
            : [];

        if (pointsSchema.length === 0) {
            return;
        }

        this.state.editor.categories.forEach((category, categoryIndex) => {
            const existingQuestions = Array.isArray(category.questions) ? category.questions : [];
            category.questions = pointsSchema.map((points, questionIndex) => {
                const existing = existingQuestions[questionIndex] || {};
                return {
                    id: `q-${categoryIndex}-${questionIndex}`,
                    points,
                    question: typeof existing.question === 'string' ? existing.question : '',
                    answer: typeof existing.answer === 'string' ? existing.answer : ''
                };
            });
        });

        const selectedIndex = this.state.selectedCategoryIndex;
        if (Number.isInteger(selectedIndex) && this.state.editor.categories[selectedIndex]) {
            this.selectCategory(selectedIndex);
        } else {
            this.renderCategoryList();
        }

        this.renderPointsSchemaControls();
        this.saveGameState();
    },

    showPointSchemaChangeConfirmation(nextSchema, actionLabel, options = {}) {
        const warningText = options.warningText || '';
        const modal = this.createModal('Punktestufen ändern');
        const modalRoot = modal.content.closest('.custom-modal');
        modalRoot?.classList.add('custom-modal-point-schema-confirm');
        modal.content.classList.add('point-schema-confirm-content');

        const currentSchema = this.getGlobalPointsSchemaFromCategories();
        const info = document.createElement('p');
        info.className = 'point-schema-confirm-text';
        info.innerHTML = `Die Punktestufen werden in <strong>allen Kategorien</strong> ${actionLabel}.`;
        modal.content.appendChild(info);

        const before = document.createElement('p');
        before.className = 'point-schema-confirm-text';
        before.textContent = `Vorher: ${currentSchema.join(', ')}`;
        modal.content.appendChild(before);

        const after = document.createElement('p');
        after.className = 'point-schema-confirm-text';
        after.textContent = `Nachher: ${nextSchema.join(', ')}`;
        modal.content.appendChild(after);

        if (warningText) {
            const warning = document.createElement('p');
            warning.className = 'point-schema-confirm-text point-schema-confirm-warning';
            warning.textContent = warningText;
            modal.content.appendChild(warning);
        }

        const actions = document.createElement('div');
        actions.className = 'point-schema-confirm-actions';

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-danger';
        confirmBtn.textContent = 'Ja, übernehmen';
        confirmBtn.onclick = () => {
            this.applyGlobalPointsSchema(nextSchema);
            modal.close();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Abbrechen';
        cancelBtn.onclick = () => modal.close();

        actions.appendChild(confirmBtn);
        actions.appendChild(cancelBtn);
        modal.content.appendChild(actions);
    },

    openPointLevelEditor(levelIndex) {
        const schema = this.getGlobalPointsSchemaFromCategories();
        if (!Array.isArray(schema) || schema.length === 0) return;

        let currentIndex = Math.max(0, Math.min(schema.length - 1, levelIndex));
        const workingSchema = [...schema];

        const modal = this.createModal('Punktestufen bearbeiten');
        const modalRoot = modal.content.closest('.custom-modal');
        modalRoot?.classList.add('custom-modal-point-level');

        modal.content.classList.add('points-level-modal-content');

        const info = document.createElement('p');
        info.style.margin = '0.75rem 0 0.7rem 0';
        info.textContent = 'Tippe auf die Buttons oder gib den Wert direkt ein. Mit den Pfeilen wechselst du zur vorherigen/nächsten Stufe.';
        modal.content.appendChild(info);

        const range = document.createElement('p');
        range.style.margin = '0 0 0.75rem 0';
        range.style.fontSize = '0.92rem';
        range.style.color = 'var(--text-light)';
        modal.content.appendChild(range);

        const preview = document.createElement('div');
        preview.className = 'points-level-preview';
        modal.content.appendChild(preview);

        const stepControls = document.createElement('div');
        stepControls.className = 'points-level-step-controls';

        const stepValues = [-50, -10, 10, 50];
        stepValues.forEach((step) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-secondary points-level-step-btn';
            btn.textContent = step > 0 ? `+${step}` : `${step}`;
            btn.onclick = () => {
                const { lowerBound, upperBound } = getBoundsForIndex(currentIndex);
                const nextValue = this.clampPointLevelValue(workingSchema[currentIndex] + step, lowerBound, upperBound);
                workingSchema[currentIndex] = nextValue;
                valueInput.value = String(nextValue);
                renderState();
            };
            stepControls.appendChild(btn);
        });

        modal.content.appendChild(stepControls);

        const valueInput = document.createElement('input');
        valueInput.type = 'number';
        valueInput.value = String(workingSchema[currentIndex]);
        valueInput.className = 'team-name-input points-level-input';
        valueInput.oninput = () => {
            const parsed = parseInt(valueInput.value, 10);
            if (!Number.isInteger(parsed)) return;
            const { lowerBound, upperBound } = getBoundsForIndex(currentIndex);
            const nextValue = this.clampPointLevelValue(parsed, lowerBound, upperBound);
            workingSchema[currentIndex] = nextValue;
            if (String(nextValue) !== valueInput.value) {
                valueInput.value = String(nextValue);
            }
            renderState();
        };
        modal.content.appendChild(valueInput);

        const getBoundsForIndex = (index) => {
            return {
                lowerBound: index === 0 ? 1 : (workingSchema[index - 1] + 1),
                upperBound: index === workingSchema.length - 1 ? null : (workingSchema[index + 1] - 1)
            };
        };

        const actions = document.createElement('div');
        actions.className = 'button-group points-level-actions';

        const previousBtn = document.createElement('button');
        previousBtn.className = 'btn btn-secondary';
        previousBtn.textContent = '◀';
        previousBtn.setAttribute('aria-label', 'Vorherige Stufe');
        previousBtn.onclick = () => {
            if (currentIndex <= 0) return;
            currentIndex -= 1;
            renderState();
        };

        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-secondary';
        nextBtn.textContent = '▶';
        nextBtn.setAttribute('aria-label', 'Nächste Stufe');
        nextBtn.onclick = () => {
            if (currentIndex >= workingSchema.length - 1) return;
            currentIndex += 1;
            renderState();
        };

        const applyBtn = document.createElement('button');
        applyBtn.className = 'btn btn-primary';
        applyBtn.textContent = 'Übernehmen';
        applyBtn.onclick = () => {
            const hasChanges = workingSchema.some((value, index) => value !== schema[index]);
            if (!hasChanges) {
                modal.close();
                return;
            }

            this.showPointSchemaChangeConfirmation(workingSchema, 'angepasst');
            modal.close();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Abbrechen';
        cancelBtn.onclick = () => modal.close();

        const renderState = () => {
            const currentValue = workingSchema[currentIndex];
            const originalValue = schema[currentIndex];
            const { lowerBound, upperBound } = getBoundsForIndex(currentIndex);
            const upperText = upperBound === null ? '∞' : String(upperBound);

            range.textContent = `Stufe ${currentIndex + 1}/${workingSchema.length} · Erlaubter Bereich: ${lowerBound} bis ${upperText}`;
            preview.textContent = `Vorher: ${originalValue} -> Neu: ${currentValue}`;

            valueInput.min = String(lowerBound);
            if (upperBound !== null) {
                valueInput.max = String(upperBound);
            } else {
                valueInput.removeAttribute('max');
            }
            valueInput.value = String(currentValue);

            previousBtn.disabled = currentIndex === 0;
            nextBtn.disabled = currentIndex >= workingSchema.length - 1;
        };

        actions.appendChild(previousBtn);
        actions.appendChild(nextBtn);
        actions.appendChild(applyBtn);
        actions.appendChild(cancelBtn);
        modal.content.appendChild(actions);

        renderState();
    },

    clampPointLevelValue(value, minValue, maxValue = null) {
        let clamped = Math.max(minValue, value);
        if (maxValue !== null) {
            clamped = Math.min(maxValue, clamped);
        }
        return clamped;
    },

    renderPointsSchemaControls() {
        const host = document.getElementById('pointsSchemaEditor');
        if (!host) return;

        const schema = this.getGlobalPointsSchemaFromCategories();
        host.innerHTML = '';

        const title = document.createElement('h4');
        title.textContent = 'Punktestufen';
        host.appendChild(title);

        const hint = document.createElement('p');
        hint.className = 'points-schema-empty';
        hint.textContent = 'Tippe eine Stufe an, um sie zu bearbeiten.';
        host.appendChild(hint);

        if (schema.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'points-schema-empty';
            empty.textContent = 'Keine Punktestufen vorhanden.';
            host.appendChild(empty);
            return;
        }

        const chips = document.createElement('div');
        chips.className = 'points-schema-chip-list';
        schema.forEach((points, idx) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'btn btn-tertiary points-schema-chip';
            chip.textContent = `${points}`;
            chip.setAttribute('aria-label', `Punktestufe ${points} bearbeiten`);
            chip.onclick = () => this.openPointLevelEditor(idx);
            chips.appendChild(chip);
        });
        host.appendChild(chips);

        const controls = document.createElement('div');
        controls.className = 'points-schema-controls';

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn btn-secondary btn-small points-schema-mini-btn';
        addBtn.textContent = '+ Stufe';
        addBtn.onclick = () => {
            const nextValue = this.calculateNextPointLevel(schema);
            const nextSchema = [...schema, nextValue];
            this.showPointSchemaChangeConfirmation(nextSchema, 'erweitert');
        };

        const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
        removeBtn.className = 'btn btn-secondary btn-small points-schema-mini-btn';
        removeBtn.textContent = '- Stufe';
        removeBtn.disabled = schema.length <= 1;
        removeBtn.onclick = () => {
            if (schema.length <= 1) return;
            const nextSchema = schema.slice(0, -1);
            this.showPointSchemaChangeConfirmation(nextSchema, 'reduziert', {
                warningText: 'Hinweis: Beim Entfernen einer Stufe wird die letzte Frage jeder Kategorie gelöscht.'
            });
        };

        controls.appendChild(addBtn);
        controls.appendChild(removeBtn);
        host.appendChild(controls);

        const resetWrap = document.createElement('div');
        resetWrap.className = 'points-schema-reset-wrap';

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'btn btn-danger btn-small points-schema-reset-btn';
        resetBtn.textContent = 'Zurücksetzen';
        resetBtn.onclick = () => this.resetPointsSchemaToJeopardyDefault();

        resetWrap.appendChild(resetBtn);
        host.appendChild(resetWrap);
    },

    resetPointsSchemaToJeopardyDefault() {
        const defaultSchema = [100, 200, 300, 400, 500];
        this.showPointSchemaChangeConfirmation(defaultSchema, 'auf Jeopardy-Standard zurückgesetzt', {
            warningText: 'Hinweis: Dadurch werden in allen Kategorien exakt fünf Jeopardy-Stufen gesetzt.'
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
    showHelp() { this.showScreen('help'); },
    async showReadme() {
        const modal = this.createModal('README', { layout: 'readme' });

        const body = document.createElement('div');
        body.className = 'readme-inline-body';
        body.textContent = 'README wird geladen...';
        modal.content.appendChild(body);

        const actions = document.createElement('div');
        actions.className = 'qa-modal-actions';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn btn-secondary';
        closeBtn.textContent = 'Schließen';
        closeBtn.onclick = () => modal.close();

        actions.appendChild(closeBtn);
        modal.content.appendChild(actions);

        try {
            const response = await fetch('./README.md', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const markdown = await response.text();
            body.textContent = '';

            const pre = document.createElement('pre');
            pre.className = 'readme-inline-pre';
            pre.textContent = markdown;
            body.appendChild(pre);
        } catch (error) {
            body.textContent = `README konnte nicht geladen werden: ${error.message}`;
        }
    },
    showSettings(returnScreenId) {
        this.loadColorSettings();

        const current = this.state.currentScreenId;
        const previous = this.state.previousScreenId;
        const fallbackTarget = (current && current !== 'settings')
            ? current
            : ((previous && previous !== 'settings') ? previous : 'startMenu');

        this.state.settingsReturnScreenId = returnScreenId || fallbackTarget;
        this.state.settingsSessionSnapshot = {
            theme: this.collectThemeSettingsFromInputs(),
            branding: this.getBrandingSettingsSnapshot()
        };
        this.showScreen('settings');
    },

    closeSettings() {
        let target = this.state.settingsReturnScreenId;
        if (!target || target === 'settings') {
            const previous = this.state.previousScreenId;
            target = (previous && previous !== 'settings') ? previous : 'startMenu';
        }

        this.showScreen(target);
        if (target === 'quizWall') {
            this.renderQuizBoard();
            this.updateRanking();
        } else if (target === 'startMenu') {
            this.updateQuizInfo();
        }
    },

    parseColorToRgb(colorValue) {
        if (!colorValue || typeof colorValue !== 'string') return null;
        const color = colorValue.trim();

        if (/^#([0-9a-f]{3})$/i.test(color)) {
            const hex = color.slice(1);
            return {
                r: parseInt(hex[0] + hex[0], 16),
                g: parseInt(hex[1] + hex[1], 16),
                b: parseInt(hex[2] + hex[2], 16)
            };
        }

        if (/^#([0-9a-f]{6})$/i.test(color)) {
            return {
                r: parseInt(color.slice(1, 3), 16),
                g: parseInt(color.slice(3, 5), 16),
                b: parseInt(color.slice(5, 7), 16)
            };
        }

        const rgbMatch = color.match(/^rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)$/i);
        if (rgbMatch) {
            return {
                r: Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10))),
                g: Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10))),
                b: Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)))
            };
        }

        return null;
    },

    getDefaultTileTextMode(baseColor) {
        const rgb = this.parseColorToRgb(baseColor);
        if (!rgb) return 'light';

        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness >= 160 ? 'dark' : 'light';
    },

    getReadableTextColor(backgroundColor, darkColor = '#222222', lightColor = '#FFFFFF') {
        const rgb = this.parseColorToRgb(backgroundColor);
        if (!rgb) return lightColor;

        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness >= 187 ? darkColor : lightColor;
    },

    applyButtonTextColorSettings(settings) {
        const root = document.documentElement;

        root.style.setProperty('--btn-primary-text-color', this.getReadableTextColor(settings.color1));
        root.style.setProperty('--btn-secondary-text-color', this.getReadableTextColor(settings.color2));
        root.style.setProperty('--btn-tertiary-text-color', this.getReadableTextColor(settings.color4));
        root.style.setProperty('--btn-danger-text-color', this.getReadableTextColor(settings.color3));
    },

    getRelativeLuminance(colorValue) {
        const rgb = this.parseColorToRgb(colorValue);
        if (!rgb) return 0;

        const toLinear = (channel) => {
            const srgb = channel / 255;
            return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
        };

        const r = toLinear(rgb.r);
        const g = toLinear(rgb.g);
        const b = toLinear(rgb.b);

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    },

    getContrastRatio(colorA, colorB) {
        const l1 = this.getRelativeLuminance(colorA);
        const l2 = this.getRelativeLuminance(colorB);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    },

    applyPageHeadingColorSettings(settings) {
        const root = document.documentElement;
        const candidates = [settings.color1, settings.color2, settings.color3, settings.color4]
            .filter((color) => this.isHexColor(color));

        const fallback = settings.color1 || '#F7C001';
        if (candidates.length === 0) {
            root.style.setProperty('--page-heading-color', fallback);
            return;
        }

        let bestColor = candidates[0];
        let bestContrast = this.getContrastRatio(bestColor, settings.background);

        candidates.forEach((candidate) => {
            const contrast = this.getContrastRatio(candidate, settings.background);
            if (contrast > bestContrast) {
                bestContrast = contrast;
                bestColor = candidate;
            }
        });

        root.style.setProperty('--page-heading-color', bestColor);
    },

    applyTileTextMode(mode) {
        const root = document.documentElement;
        const resolvedMode = mode === 'dark' ? 'dark' : 'light';
        const tileColor = resolvedMode === 'dark' ? '#222222' : '#FFFFFF';
        root.style.setProperty('--tile-text-color', tileColor);
        root.setAttribute('data-tile-text-mode', resolvedMode);
    },

    isHexColor(value) {
        return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim());
    },

    getThemeDefaults() {
        const primaryInput = document.getElementById('primaryColor');
        const secondaryInput = document.getElementById('secondaryColor');
        const tertiaryInput = document.getElementById('tertiaryColor');
        const quaternaryInput = document.getElementById('quaternaryColor');
        const backgroundInput = document.getElementById('backgroundColor');
        const tileTextModeInput = document.getElementById('tileTextMode');

        const defaults = {
            color1: (primaryInput?.defaultValue || '#F7C001').trim(),
            color2: (secondaryInput?.defaultValue || '#F18A01').trim(),
            color3: (tertiaryInput?.defaultValue || '#C83426').trim(),
            color4: (quaternaryInput?.defaultValue || '#E9ECEF').trim(),
            background: (backgroundInput?.defaultValue || '#FFFFFF').trim(),
            tileTextMode: (tileTextModeInput?.value === 'dark' || tileTextModeInput?.defaultValue === 'dark') ? 'dark' : 'light'
        };

        defaults.tileTextMode = defaults.tileTextMode || this.getDefaultTileTextMode(defaults.color1);
        return defaults;
    },

    collectThemeSettingsFromInputs() {
        return {
            color1: document.getElementById('primaryColor')?.value,
            color2: document.getElementById('secondaryColor')?.value,
            color3: document.getElementById('tertiaryColor')?.value,
            color4: document.getElementById('quaternaryColor')?.value,
            background: document.getElementById('backgroundColor')?.value,
            tileTextMode: document.getElementById('tileTextMode')?.value
        };
    },

    sanitizeThemeSettings(rawSettings, fallbackSettings) {
        const fallback = fallbackSettings || this.getThemeDefaults();
        const raw = rawSettings || {};

        const color1 = raw.color1 || raw.primaryColor || raw.primary || raw.quiz_color_1;
        const color2 = raw.color2 || raw.secondaryColor || raw.secondary || raw.quiz_color_2;
        const color3 = raw.color3 || raw.tertiaryColor || raw.tertiary || raw.quiz_color_3;
        const color4 = raw.color4 || raw.quaternaryColor || raw.quaternary || raw.quiz_color_4;
        const background = raw.background || raw.backgroundColor || raw.bg || raw.quiz_color_bg;
        const tileTextMode = raw.tileTextMode || raw.tile_text_mode || raw.quiz_tile_text_mode;

        const normalized = {
            color1: this.isHexColor(color1) ? color1 : fallback.color1,
            color2: this.isHexColor(color2) ? color2 : fallback.color2,
            color3: this.isHexColor(color3) ? color3 : fallback.color3,
            color4: this.isHexColor(color4) ? color4 : fallback.color4,
            background: this.isHexColor(background) ? background : fallback.background,
            tileTextMode: (tileTextMode === 'dark' || tileTextMode === 'light') ? tileTextMode : fallback.tileTextMode
        };

        return normalized;
    },

    setThemeInputs(settings) {
        const primaryInput = document.getElementById('primaryColor');
        const secondaryInput = document.getElementById('secondaryColor');
        const tertiaryInput = document.getElementById('tertiaryColor');
        const quaternaryInput = document.getElementById('quaternaryColor');
        const backgroundInput = document.getElementById('backgroundColor');
        const tileTextModeInput = document.getElementById('tileTextMode');

        if (primaryInput) primaryInput.value = settings.color1;
        if (secondaryInput) secondaryInput.value = settings.color2;
        if (tertiaryInput) tertiaryInput.value = settings.color3;
        if (quaternaryInput) quaternaryInput.value = settings.color4;
        if (backgroundInput) backgroundInput.value = settings.background;
        if (tileTextModeInput) tileTextModeInput.value = settings.tileTextMode;
    },

    applyThemeSettings(rawSettings, options = {}) {
        const { persist = false, updateInputs = true } = options;
        const defaults = this.getThemeDefaults();
        const settings = this.sanitizeThemeSettings(rawSettings, defaults);
        const root = document.documentElement;

        root.style.setProperty('--primary-color', settings.color1);
        root.style.setProperty('--secondary-color', settings.color2);
        root.style.setProperty('--tertiary-color', settings.color3);
        root.style.setProperty('--quaternary-color', settings.color4);
        root.style.setProperty('--background-color', settings.background);
        this.applyButtonTextColorSettings(settings);
        this.applyPageHeadingColorSettings(settings);

        this.applyTileTextMode(settings.tileTextMode);

        if (updateInputs) {
            this.setThemeInputs(settings);
        }

        if (persist) {
            localStorage.setItem('quiz_color_1', settings.color1);
            localStorage.setItem('quiz_color_2', settings.color2);
            localStorage.setItem('quiz_color_3', settings.color3);
            localStorage.setItem('quiz_color_4', settings.color4);
            localStorage.setItem('quiz_color_bg', settings.background);
            localStorage.setItem('quiz_tile_text_mode', settings.tileTextMode);
            localStorage.setItem('quiz_theme_version', this.themeStorageVersion);
        }

        return settings;
    },

    applyColorSettings() {
        const settings = this.collectThemeSettingsFromInputs();
        this.applyThemeSettings(settings, { persist: true, updateInputs: true });
        this.applyBrandLogo(this.state.brandLogoDataUrl, { persist: true });
        const brandNameInput = document.getElementById('brandNameInput');
        this.applyBrandName(brandNameInput?.value || this.state.brandName, { persist: true, updateInput: true });
    },

    applyColorSettingsAndBack() {
        this.applyColorSettings();
        this.state.settingsSessionSnapshot = null;
        this.closeSettings();
    },

    cancelSettingsAndBack() {
        const snapshot = this.state.settingsSessionSnapshot;
        if (snapshot && snapshot.theme) {
            this.applyThemeSettings(snapshot.theme, { persist: false, updateInputs: true });
            this.applyBrandLogo(snapshot.branding?.logoDataUrl || null, { persist: false });
            this.applyBrandName(snapshot.branding?.brandName || this.state.defaultBrandName, { persist: false, updateInput: true });
        } else {
            this.loadColorSettings();
            this.applyBrandLogo(localStorage.getItem('quiz_brand_logo_data'), { persist: false });
            this.applyBrandName(localStorage.getItem('quiz_brand_name') || this.state.defaultBrandName, { persist: false, updateInput: true });
        }
        this.state.settingsSessionSnapshot = null;
        this.closeSettings();
    },

    saveColorSetToFile() {
        const settings = this.sanitizeThemeSettings(this.collectThemeSettingsFromInputs(), this.getThemeDefaults());

        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const defaultBase = `quizwall-farbset-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        const input = prompt('Dateiname für das Farbset (ohne Endung):', defaultBase);
        if (input === null) return;

        const baseName = (input || defaultBase)
            .trim()
            .replace(/\.(colorset\.)?json$/i, '') || defaultBase;

        const filename = `${baseName}.colorset.json`;
        const exportData = {
            format: 'quizwall-color-set',
            version: 1,
            exportedAt: new Date().toISOString(),
            theme: settings,
            branding: {
                logoDataUrl: this.state.brandLogoDataUrl,
                brandName: this.state.brandName
            }
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
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

    loadColorSetFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.colorset.json,.json,application/json';

        input.onchange = async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                const rawTheme = parsed && typeof parsed === 'object' && parsed.theme ? parsed.theme : parsed;
                const settings = this.sanitizeThemeSettings(rawTheme, this.getThemeDefaults());
                this.applyThemeSettings(settings, { persist: false, updateInputs: true });
                const logoDataUrl = parsed?.branding?.logoDataUrl;
                if (typeof logoDataUrl === 'string' || logoDataUrl === null) {
                    this.applyBrandLogo(logoDataUrl, { persist: false });
                }
                const brandName = parsed?.branding?.brandName;
                if (typeof brandName === 'string') {
                    this.applyBrandName(brandName, { persist: false, updateInput: true });
                }
                alert('Farbset geladen. Mit "Farbset anwenden und zurück" übernimmst du es dauerhaft.');
            } catch (error) {
                alert(`Farbset konnte nicht geladen werden: ${error.message}`);
            }
        };

        input.click();
    },

    loadColorSettings() {
        const version = localStorage.getItem('quiz_theme_version');
        const hasVersionedTheme = version === this.themeStorageVersion;
        const defaults = this.getThemeDefaults();

        const color1 = hasVersionedTheme ? localStorage.getItem('quiz_color_1') : defaults.color1;
        const color2 = hasVersionedTheme ? localStorage.getItem('quiz_color_2') : defaults.color2;
        const color3 = hasVersionedTheme ? localStorage.getItem('quiz_color_3') : defaults.color3;
        const color4 = hasVersionedTheme ? localStorage.getItem('quiz_color_4') : defaults.color4;
        const background = hasVersionedTheme ? localStorage.getItem('quiz_color_bg') : defaults.background;
        const storedTileTextMode = hasVersionedTheme ? localStorage.getItem('quiz_tile_text_mode') : null;

        const activePrimary = (color1 || defaults.color1 || '').trim();
        const resolvedTileTextMode = (storedTileTextMode === 'light' || storedTileTextMode === 'dark')
            ? storedTileTextMode
            : this.getDefaultTileTextMode(activePrimary);

        this.applyThemeSettings({
            color1,
            color2,
            color3,
            color4,
            background,
            tileTextMode: resolvedTileTextMode
        }, { persist: false, updateInputs: true });
    },

    resetColorSettings() {
        if (!confirm('Farbset auf Standardwerte zurücksetzen?')) {
            return;
        }
        const defaults = this.getThemeDefaults();
        this.applyThemeSettings(defaults, { persist: false, updateInputs: true });
        this.applyBrandLogo(null, { persist: false });
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

            const parsedTeams = Array.isArray(parsed?.game?.teams)
                ? parsed.game.teams
                : (Array.isArray(parsed?.teams)
                    ? parsed.teams
                    : (Array.isArray(parsed?.game?.game?.teams) ? parsed.game.game.teams : null));

            const parsedCategories = Array.isArray(parsed?.categories)
                ? parsed.categories
                : (Array.isArray(parsed?.game?.categories)
                    ? parsed.game.categories
                    : (Array.isArray(parsed?.game?.game?.categories) ? parsed.game.game.categories : null));

            const parsedPlayed = Array.isArray(parsed?.played)
                ? parsed.played
                : (Array.isArray(parsed?.game?.playedQuestions)
                    ? parsed.game.playedQuestions
                    : (Array.isArray(parsed?.game?.game?.playedQuestions) ? parsed.game.game.playedQuestions : []));

            // Teams und Punkte übernehmen
            if (Array.isArray(parsedTeams) && parsedTeams.length > 0) {
                this.state.game = {
                    teams: parsedTeams.map((t, idx) => ({
                        id: Number.isInteger(t?.id) ? t.id : idx,
                        name: t?.name || `Team ${idx + 1}`,
                        score: Number.isFinite(t?.score) ? t.score : 0
                    })),
                };
                this.state.victoryCeremonyShown = false;
            } else {
                this.state.game = null;
                this.state.victoryCeremonyShown = false;
            }
            // Gespielte Fragen übernehmen
            this.state.playedQuestions = new Set(parsedPlayed || []);
            // Quiz-Titel übernehmen
            this.state.quizTitle = parsed.quizTitle || 'QuizWallah';
            // Quizdaten (Kategorien/Fragen) übernehmen, falls vorhanden
            if (Array.isArray(parsedCategories)) {
                this.state.editor.categories = parsedCategories;
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

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then((registration) => {
                registration.update().catch(() => {
                    // Ignore update probe errors silently.
                });

                let hasRefreshed = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (hasRefreshed) return;
                    hasRefreshed = true;
                    window.location.reload();
                });
            }).catch((error) => {
                console.warn('Service Worker Registrierung fehlgeschlagen:', error);
            });
        });
    }
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
        app.state.victoryCeremonyShown = false;
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
                alert('Dieser Spielstand enthält keine eingebetteten Quizdaten und kann nicht geladen werden.');
                return;
            }

            const hasTeamData =
                (data.game && Array.isArray(data.game.teams) && data.game.teams.length > 0)
                || (Array.isArray(data.teams) && data.teams.length > 0)
                || (data.game && data.game.game && Array.isArray(data.game.game.teams) && data.game.game.teams.length > 0);

            if (!hasTeamData) {
                alert('Die Datei enthält keinen gültigen Team-Spielstand und kann nicht als Spielstand geladen werden.');
                return;
            }

            // Spielstand in localStorage speichern und laden
            localStorage.setItem('quizwall_game', JSON.stringify(data));
            this.loadGameState();

            if (!this.hasActiveGame()) {
                alert('Spielstand konnte nicht vollständig geladen werden (keine Teams gefunden).');
                return;
            }

            alert('Spielstand erfolgreich geladen!');
        } catch (err) {
            alert('Fehler beim Laden des Spielstands: ' + err.message);
        }
    };
    reader.onerror = () => {
        alert('Fehler beim Lesen der Spielstand-Datei.');
    };
    reader.readAsText(file);

    // Wichtig: erlaubt das erneute Auswählen derselben Datei,
    // damit onchange bei wiederholten Ladeversuchen erneut auslöst.
    event.target.value = '';
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
    text.textContent = 'Der komplette Spielstand wird zurückgesetzt.';
    text.style.margin = '1rem 0 1.5rem 0';
    modal.content.appendChild(text);

    const actions = document.createElement('div');
    actions.className = 'button-group';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-danger';
    confirmBtn.textContent = 'Ja, zurücksetzen';
    confirmBtn.onclick = () => {
        // Punktestand aller Teams zurücksetzen
        this.state.game.teams.forEach(team => {
            team.score = 0;
        });

        // Alle Fragen wieder als unbeantwortet markieren
        this.state.playedQuestions = new Set();
        this.state.currentQuestion = null;
        this.state.victoryCeremonyShown = false;
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