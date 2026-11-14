// Session Storage separated by Pyraminx mode
        let currentMode = 'normal'; // 'normal', 'tips', 'l4e'
        let sessions = JSON.parse(localStorage.getItem('cubertimer_pyraminx_sessions')) || {
            normal: [],
            tips: [],
            l4e: []
        };

        let timerState = 'IDLE'; // IDLE, HOLDING, READY, RUNNING
        let startTime = 0;
        let timerInterval = null;
        let holdTimeout = null;
        const HOLD_DURATION = 500;

        // DOM Elements
        const timerDisplay = document.getElementById('timerDisplay');
        const timerInstructions = document.getElementById('timerInstructions');
        const scrambleDisplay = document.getElementById('scrambleDisplay');
        const newScrambleBtn = document.getElementById('newScrambleBtn');
        const historyList = document.getElementById('historyList');
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        const modeBtns = document.querySelectorAll('.mode-btn');
        const statsTitle = document.getElementById('statsTitle');
        const historyTitle = document.getElementById('historyTitle');

        const statCurrent = document.getElementById('statCurrent');
        const statBest = document.getElementById('statBest');
        const statAo5 = document.getElementById('statAo5');
        const statAo12 = document.getElementById('statAo12');

        // Helper: Random Pyraminx Tips (u, l, r, b)
        function generateTips() {
            const tips = ['u', 'l', 'r', 'b'];
            const modifiers = ['', "'"];
            let result = [];
            
            tips.forEach(tip => {
                if (Math.random() < 0.75) { // 75% chance each tip is turned
                    const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
                    const turns = Math.random() < 0.5 ? '2' : ''; // sometimes double turn
                    result.push(tip + (turns || mod));
                }
            });
            return result.join(' ');
        }

        // 1. Normal WCA Pyraminx Scramble Generator (11 body moves + random tips)
        function generatePyraminxNormalScramble() {
            const axes = ['U', 'L', 'R', 'B'];
            const modifiers = ['', "'"];
            const length = 11;
            let scramble = [];
            let lastAxis = -1;

            for (let i = 0; i < length; i++) {
                let axisIndex;
                do {
                    axisIndex = Math.floor(Math.random() * axes.length);
                } while (axisIndex === lastAxis);

                lastAxis = axisIndex;
                const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
                scramble.push(axes[axisIndex] + mod);
            }

            const tipsStr = generateTips();
            return tipsStr ? `${scramble.join(' ')}   (${tipsStr})` : scramble.join(' ');
        }

        // 2. Pyraminx Tip Trainer (Drill rapid tip orientation)
        function generatePyraminxTipScramble() {
            const tips = ['u', 'l', 'r', 'b'];
            const modifiers = ['', "'", '2'];
            let scramble = [];
            
            tips.forEach(tip => {
                const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
                scramble.push(tip + mod);
            });
            return `Tip Drill: ${scramble.join(' ')}`;
        }

        // 3. Pyraminx L4E Trainer (Last Four Edges core setup)
        const L4E_CASES = [
            "R U R' U R U' R'",
            "L' U' L U' L' U L",
            "R U' R' U' R U' R'",
            "L' U L U L' U L",
            "U R U' R' U R U' R'",
            "U' L' U L U' L' U L"
        ];

        function generatePyraminxL4EScramble() {
            const base = L4E_CASES[Math.floor(Math.random() * L4E_CASES.length)];
            const tipsStr = generateTips();
            return tipsStr ? `L4E: ${base}   (${tipsStr})` : `L4E: ${base}`;
        }

        // Master Scramble Dispatcher
        function generateScrambleForMode(mode) {
            if (mode === 'tips') return generatePyraminxTipScramble();
            if (mode === 'l4e') return generatePyraminxL4EScramble();
            return generatePyraminxNormalScramble();
        }

        let currentScramble = generateScrambleForMode(currentMode);
        scrambleDisplay.textContent = currentScramble;

        newScrambleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (timerState === 'IDLE') {
                currentScramble = generateScrambleForMode(currentMode);
                scrambleDisplay.textContent = currentScramble;
            }
        });

        // Mode Switching Logic
        const MODE_LABELS = {
            normal: 'Normal Pyraminx',
            tips: 'Tip Trainer',
            l4e: 'L4E Trainer'
        };

        modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (timerState !== 'IDLE') return;

                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                currentMode = btn.dataset.mode;
                statsTitle.textContent = `${MODE_LABELS[currentMode]} Statistics`;
                historyTitle.textContent = `${MODE_LABELS[currentMode]} History`;

                currentScramble = generateScrambleForMode(currentMode);
                scrambleDisplay.textContent = currentScramble;

                renderHistory();
                calculateStats();
            });
        });

        // Time Formatting Helper
        function formatTime(ms) {
            if (ms === null || isNaN(ms)) return 'DNF';
            if (ms === Infinity) return '-';

            let seconds = ms / 1000;
            if (seconds >= 60) {
                let mins = Math.floor(seconds / 60);
                let secs = (seconds % 60).toFixed(2);
                return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            }
            return seconds.toFixed(2);
        }

        // Spacebar Listeners
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (timerState === 'RUNNING') {
                    stopTimer();
                } else if (timerState === 'IDLE') {
                    startHolding();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (timerState === 'HOLDING') {
                    cancelHolding();
                } else if (timerState === 'READY') {
                    startTimer();
                }
            }
        });

        // Touch Support for Mobile/Tablets
        const timerSection = document.getElementById('timerSection');
        timerSection.addEventListener('touchstart', (e) => {
            if (e.target.closest('button')) return;
            e.preventDefault();
            if (timerState === 'RUNNING') {
                stopTimer();
            } else if (timerState === 'IDLE') {
                startHolding();
            }
        });

        timerSection.addEventListener('touchend', (e) => {
            if (e.target.closest('button')) return;
            e.preventDefault();
            if (timerState === 'HOLDING') {
                cancelHolding();
            } else if (timerState === 'READY') {
                startTimer();
            }
        });

        function startHolding() {
            timerState = 'HOLDING';
            timerDisplay.style.color = 'var(--timer-ready)';
            timerInstructions.textContent = 'Keep holding...';

            holdTimeout = setTimeout(() => {
                if (timerState === 'HOLDING') {
                    timerState = 'READY';
                    timerDisplay.style.color = 'var(--timer-set)';
                    timerInstructions.textContent = 'Release to start!';
                }
            }, HOLD_DURATION);
        }

        function cancelHolding() {
            clearTimeout(holdTimeout);
            timerState = 'IDLE';
            timerDisplay.style.color = 'var(--timer-normal)';
            timerInstructions.textContent = 'Hold SPACEBAR until green, then release to start';
        }

        function startTimer() {
            timerState = 'RUNNING';
            timerDisplay.style.color = 'var(--timer-normal)';
            timerInstructions.textContent = 'Solving... Press SPACE to stop.';
            startTime = performance.now();

            timerInterval = requestAnimationFrame(function update() {
                if (timerState === 'RUNNING') {
                    let elapsed = performance.now() - startTime;
                    timerDisplay.textContent = formatTime(elapsed);
                    timerInterval = requestAnimationFrame(update);
                }
            });
        }

        function stopTimer() {
            cancelAnimationFrame(timerInterval);
            timerState = 'IDLE';
            timerDisplay.style.color = 'var(--timer-normal)';
            timerInstructions.textContent = 'Hold SPACEBAR until green, then release to start';

            let solveTime = performance.now() - startTime;

            sessions[currentMode].unshift({
                time: solveTime,
                penalty: 0,
                scramble: currentScramble,
                date: new Date().toISOString()
            });

            saveAndRefresh();

            currentScramble = generateScrambleForMode(currentMode);
            scrambleDisplay.textContent = currentScramble;
        }

        function saveAndRefresh() {
            localStorage.setItem('cubertimer_pyraminx_sessions', JSON.stringify(sessions));
            renderHistory();
            calculateStats();
        }

        // WCA Ao5 / Ao12 Calculations
        function calculateAverage(arr, count) {
            if (arr.length < count) return null;
            let subset = arr.slice(0, count).map(s => {
                if (s.penalty === 'DNF') return Infinity;
                return s.time + (s.penalty === '+2' ? 2000 : 0);
            });

            if (subset.filter(t => t === Infinity).length > 1) return 'DNF';

            subset.sort((a, b) => a - b);
            subset.pop();
            subset.shift();

            let sum = subset.reduce((acc, val) => acc + val, 0);
            return sum / (count - 2);
        }

        function calculateStats() {
            const solves = sessions[currentMode];

            if (solves.length === 0) {
                statCurrent.textContent = '-';
                statBest.textContent = '-';
                statAo5.textContent = '-';
                statAo12.textContent = '-';
                timerDisplay.textContent = '0.00';
                return;
            }

            let latest = solves[0];
            let latestEffectiveTime = latest.penalty === 'DNF' ? 'DNF' : latest.time + (latest.penalty === '+2' ? 2000 : 0);
            statCurrent.textContent = latest.penalty === 'DNF' ? 'DNF' : formatTime(latestEffectiveTime) + (latest.penalty === '+2' ? '+' : '');
            timerDisplay.textContent = statCurrent.textContent;

            let validSolves = solves.map(s => s.penalty === 'DNF' ? Infinity : s.time + (s.penalty === '+2' ? 2000 : 0));
            let best = Math.min(...validSolves);
            statBest.textContent = best === Infinity ? '-' : formatTime(best);

            let ao5 = calculateAverage(solves, 5);
            statAo5.textContent = ao5 === null ? '-' : (typeof ao5 === 'number' ? formatTime(ao5) : ao5);

            let ao12 = calculateAverage(solves, 12);
            statAo12.textContent = ao12 === null ? '-' : (typeof ao12 === 'number' ? formatTime(ao12) : ao12);
        }

        function renderHistory() {
            const solves = sessions[currentMode];
            historyList.innerHTML = '';

            solves.forEach((solve, index) => {
                let effectiveTime = solve.penalty === 'DNF' ? 'DNF' : solve.time + (solve.penalty === '+2' ? 2000 : 0);
                let timeStr = solve.penalty === 'DNF' ? 'DNF' : formatTime(effectiveTime);
                if (solve.penalty === '+2') timeStr += '+';

                const item = document.createElement('div');
                item.className = 'history-item';
                item.title = `Scramble: ${solve.scramble}`;
                item.innerHTML = `
                    <span>#${solves.length - index} &nbsp; ${timeStr}</span>
                    <div class="history-actions">
                        <button class="action-btn" onclick="togglePenalty(${index}, '+2')">+2</button>
                        <button class="action-btn" onclick="togglePenalty(${index}, 'DNF')">DNF</button>
                        <button class="action-btn del" onclick="deleteSolve(${index})">✕</button>
                    </div>
                `;
                historyList.appendChild(item);
            });
        }

        window.togglePenalty = function(index, type) {
            const solves = sessions[currentMode];
            solves[index].penalty = solves[index].penalty === type ? 0 : type;
            saveAndRefresh();
        };

        window.deleteSolve = function(index) {
            sessions[currentMode].splice(index, 1);
            saveAndRefresh();
        };

        clearHistoryBtn.addEventListener('click', () => {
            if (confirm(`Clear all ${MODE_LABELS[currentMode]} solve history?`)) {
                sessions[currentMode] = [];
                saveAndRefresh();
            }
        });

        // Initial load
        renderHistory();
        calculateStats();



        