 // State Variables
        let solves = JSON.parse(localStorage.getItem('cubing_solves')) || [];
        let timerState = 'IDLE'; // IDLE, HOLDING, READY, RUNNING
        let startTime = 0;
        let timerInterval = null;
        let holdTimeout = null;
        const HOLD_DURATION = 500; // ms required to turn green

        // DOM Elements
        const timerDisplay = document.getElementById('timerDisplay');
        const timerInstructions = document.getElementById('timerInstructions');
        const scrambleDisplay = document.getElementById('scrambleDisplay');
        const newScrambleBtn = document.getElementById('newScrambleBtn');
        const historyList = document.getElementById('historyList');
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        
        const statCurrent = document.getElementById('statCurrent');
        const statBest = document.getElementById('statBest');
        const statAo5 = document.getElementById('statAo5');
        const statAo12 = document.getElementById('statAo12');

        // WCA 3x3 Scramble Generator
        function generateScramble() {
            const moves = ["R", "R'", "R2", "L", "L'", "L2", "U", "U'", "U2", "D", "D'", "D2", "F", "F'", "F2", "B", "B'", "B2"];
            const axis = ['R', 'L', 'U', 'D', 'F', 'B'];
            let scramble = [];
            let lastAxis = -1;

            for (let i = 0; i < 20; i++) {
                let randomAxis;
                do {
                    randomAxis = Math.floor(Math.random() * axis.length);
                } while (randomAxis === lastAxis);

                lastAxis = randomAxis;
                const filteredMoves = moves.filter(m => m.startsWith(axis[randomAxis]));
                const randomMove = filteredMoves[Math.floor(Math.random() * filteredMoves.length)];
                scramble.push(randomMove);
            }
            return scramble.join(' ');
        }

        let currentScramble = generateScramble();
        scrambleDisplay.textContent = currentScramble;
        newScrambleBtn.addEventListener('click', () => {
            if (timerState === 'IDLE') {
                currentScramble = generateScramble();
                scrambleDisplay.textContent = currentScramble;
            }
        });

        // Time Formatting helper (seconds to mm:ss.SS or ss.SS)
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

        // Event Listeners for Spacebar & Touch Support
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

        // Touch support for mobile devices
        const timerSection = document.getElementById('timerSection');
        timerSection.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (timerState === 'RUNNING') {
                stopTimer();
            } else if (timerState === 'IDLE') {
                startHolding();
            } else if (timerState === 'READY') {
                startTimer();
            }
        });

        timerSection.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (timerState === 'HOLDING') {
                cancelHolding();
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
            timerInstructions.textContent = 'Hold SPACEBAR to inspect / start';
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
            timerInstructions.textContent = 'Hold SPACEBAR to inspect / start';

            let solveTime = performance.now() - startTime;
            
            // Save solve
            solves.unshift({
                time: solveTime,
                penalty: 0, // 0: normal, 2: +2, DNF: DNF
                scramble: currentScramble,
                date: new Date().toISOString()
            });

            saveAndRefresh();

            // Generate next scramble
            currentScramble = generateScramble();
            scrambleDisplay.textContent = currentScramble;
        }

        function saveAndRefresh() {
            localStorage.setItem('cubing_solves', JSON.stringify(solves));
            renderHistory();
            calculateStats();
        }

        // Statistics Calculations (WCA Rules for Ao5 / Ao12)
        function calculateAverage(arr, count) {
            if (arr.length < count) return null;
            let subset = arr.slice(0, count).map(s => {
                if (s.penalty === 'DNF') return Infinity;
                return s.time + (s.penalty === 2 ? 2000 : 0);
            });

            if (subset.filter(t => t === Infinity).length > 1) return 'DNF';

            subset.sort((a, b) => a - b);
            // Drop best and worst
            subset.pop();
            subset.shift();

            let sum = subset.reduce((acc, val) => acc + val, 0);
            return sum / (count - 2);
        }

        function calculateStats() {
            if (solves.length === 0) {
                statCurrent.textContent = '-';
                statBest.textContent = '-';
                statAo5.textContent = '-';
                statAo12.textContent = '-';
                timerDisplay.textContent = '0.00';
                return;
            }

            // Current solve
            let latest = solves[0];
            let latestEffectiveTime = latest.penalty === 'DNF' ? 'DNF' : latest.time + (latest.penalty === 2 ? 2000 : 0);
            statCurrent.textContent = latest.penalty === 'DNF' ? 'DNF' : formatTime(latestEffectiveTime);
            timerDisplay.textContent = statCurrent.textContent;

            // Best solve
            let validSolves = solves.map(s => s.penalty === 'DNF' ? Infinity : s.time + (s.penalty === 2 ? 2000 : 0));
            let best = Math.min(...validSolves);
            statBest.textContent = best === Infinity ? '-' : formatTime(best);

            // Ao5
            let ao5 = calculateAverage(solves, 5);
            statAo5.textContent = typeof ao5 === 'number' ? formatTime(ao5) : ao5;

            // Ao12
            let ao12 = calculateAverage(solves, 12);
            statAo12.textContent = typeof ao12 === 'number' ? formatTime(ao12) : ao12;
        }

        function renderHistory() {
            historyList.innerHTML = '';
            solves.forEach((solve, index) => {
                let effectiveTime = solve.penalty === 'DNF' ? 'DNF' : solve.time + (solve.penalty === 2 ? 2000 : 0);
                let timeStr = solve.penalty === 'DNF' ? 'DNF' : formatTime(effectiveTime);
                if (solve.penalty === 2) timeStr += '+';

                const item = document.createElement('div');
                item.className = 'history-item';
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
            if (solves[index].penalty === type) {
                solves[index].penalty = 0;
            } else {
                solves[index].penalty = type;
            }
            saveAndRefresh();
        }

        window.deleteSolve = function(index) {
            solves.splice(index, 1);
            saveAndRefresh();
        }

        clearHistoryBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all solve history?')) {
                solves = [];
                saveAndRefresh();
            }
        });

        // Initial load
        renderHistory();
        calculateStats();



       