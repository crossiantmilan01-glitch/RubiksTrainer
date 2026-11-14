// Session Storage separated by 2x2 mode
        let currentMode = 'normal'; // 'normal', 'oll', 'pll'
        let sessions = JSON.parse(localStorage.getItem('cubertimer_2x2_sessions')) || {
            normal: [],
            oll: [],
            pll: []
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

        // Helper: Random AUF (Adjustment of U Face)
        function randomAUF() {
            const aufs = ['', 'U ', "U' ", 'U2 '];
            return aufs[Math.floor(Math.random() * aufs.length)];
        }

        // 1. Normal WCA 2x2 Scramble Generator (R, U, F moves only, 9–11 moves)
        function generate2x2NormalScramble() {
            const faces = ['R', 'U', 'F'];
            const modifiers = ['', "'", '2'];
            const length = Math.floor(Math.random() * 3) + 9; // 9 to 11 moves
            let scramble = [];
            let lastFace = -1;

            for (let i = 0; i < length; i++) {
                let faceIndex;
                do {
                    faceIndex = Math.floor(Math.random() * faces.length);
                } while (faceIndex === lastFace);

                lastFace = faceIndex;
                const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
                scramble.push(faces[faceIndex] + modifier);
            }
            return scramble.join(' ');
        }

        // 2. 2x2 OLL Scrambles (Bottom layer solved, Top layer orientation scrambled)
        // Includes Sune, Antisune, H, Pi, T, U, and L cases + random U AUF
        const OLL_2X2_SCRAMBLES = [
            "R U2 R' U' R U' R'",               // Sune setup (Antisune)
            "R U R' U R U2 R'",                 // Antisune setup (Sune)
            "R2 U2 R U2 R2",                    // H Case
            "R U2 R2 U' R2 U' R2 U2 R",         // Pi Case
            "F R' F' R U R U' R'",              // T Case
            "F R U R' U' F'",                   // U Case
            "F' R U R' U' R' F R"               // L Case
        ];

        function generate2x2OLLScramble() {
            const base = OLL_2X2_SCRAMBLES[Math.floor(Math.random() * OLL_2X2_SCRAMBLES.length)];
            return `${randomAUF()}${base}`.trim();
        }

        // 3. 2x2 PLL Scrambles (Bottom layer & Top orientation solved, Top corner permutation scrambled)
        // Includes Adjacent Corner Swap (T/J perm) and Diagonal Corner Swap (Y perm) + random U AUF
        const PLL_2X2_SCRAMBLES = [
            "R U R' U' R' F R2 U' R' U' R U R' F'",             // Adjacent Swap (T-Perm)
            "R U R' F' R U R' U' R' F R2 U' R'",                // Adjacent Swap (Jb-Perm)
            "F R U' R' U' R U R' F' R U R' U' R' F R F'",       // Diagonal Swap (Y-Perm)
            "R U' R' U' F2 U' R U R' D R2"                      // Diagonal Swap (2x2 pure)
        ];

        function generate2x2PLLScramble() {
            const base = PLL_2X2_SCRAMBLES[Math.floor(Math.random() * PLL_2X2_SCRAMBLES.length)];
            return `${randomAUF()}${base}`.trim();
        }

        // Master Scramble Dispatcher
        function generateScrambleForMode(mode) {
            if (mode === 'oll') return generate2x2OLLScramble();
            if (mode === 'pll') return generate2x2PLLScramble();
            return generate2x2NormalScramble();
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
            normal: 'Normal 2x2',
            oll: '2x2 OLL Trainer',
            pll: '2x2 PLL Trainer'
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
            localStorage.setItem('cubertimer_2x2_sessions', JSON.stringify(sessions));
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