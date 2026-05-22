
// Audio Synthesis Engine (Web Audio API)
const AudioEngine = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playClick() {
        if (!this.ctx) return;
        let bufferSize = this.ctx.sampleRate * 0.04; 
        let buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        let data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        let noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        let filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 900;
        filter.Q.value = 4;

        let gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.03);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    },
    playBell() {
        if (!this.ctx) return;
        let osc = this.ctx.createOscillator();
        let gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1450, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.25);
    }
};

const defaultTextSamples = [
    "The quick brown fox jumps over the lazy dog. This ancient pangram contains every single letter of the English alphabet, making it perfect for rhythm testing.",
    "To be, or not to be, that is the question: Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms.",
    "As the heavy iron keys struck the ink ribbon, a distinct aroma of mineral oil filled the study. Each mechanical return brought a rewarding chime across the page."
];

// Application State
let timeTotal = 60;
let timeRemaining = 60;
let timerInterval = null;
let isPlaying = false;
let charIndex = 0;
let sampleText = "";

// UI Core DOM Element Hooks
const textTarget = document.getElementById('text-target');
const actionBtn = document.getElementById('action-btn');
const timeSelect = document.getElementById('time-select');
const soundToggle = document.getElementById('sound-toggle');
const themeToggle = document.getElementById('theme-toggle');
const timerVal = document.getElementById('timer-val');
const wpmVal = document.getElementById('wpm-val');
const accuracyVal = document.getElementById('accuracy-val');
const overlay = document.getElementById('overlay');
const paper = document.getElementById('paper');
const customTextArea = document.getElementById('custom-text-area');
const filePicker = document.getElementById('file-picker');

// Dynamic Text Assembly
function generateTestInterface() {
    let customText = customTextArea.value.trim();
    if (customText.length > 0) {
        sampleText = customText;
    } else {
        sampleText = defaultTextSamples[Math.floor(Math.random() * defaultTextSamples.length)];
    }

    textTarget.innerHTML = '';
    for(let char of sampleText) {
        let span = document.createElement('span');
        span.classList.add('char');
        span.innerText = char;
        textTarget.appendChild(span);
    }
    charIndex = 0;
    highlightCurrentChar();
}

function highlightCurrentChar() {
    let spans = textTarget.querySelectorAll('.char');
    spans.forEach(s => s.classList.remove('current'));
    if(spans[charIndex]) {
        spans[charIndex].classList.add('current');
        
        // Adaptive view scrolling window
        const paperRect = paper.getBoundingClientRect();
        const charRect = spans[charIndex].getBoundingClientRect();
        if (charRect.bottom > paperRect.bottom - 40) {
            paper.scrollTop += 40;
        } else if (charRect.top < paperRect.top + 40) {
            paper.scrollTop -= 40;
        }
    }
}

function updateTimerDisplay() {
    let mins = Math.floor(timeRemaining / 60);
    let secs = timeRemaining % 60;
    timerVal.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function calculateMetrics() {
    let timeElapsedMin = (timeTotal - timeRemaining) / 60;
    if (timeElapsedMin <= 0) timeElapsedMin = 0.01;
    
    let correctCount = textTarget.querySelectorAll('.char.correct').length;
    let incorrectCount = textTarget.querySelectorAll('.char.incorrect').length;
    let totalTyped = correctCount + incorrectCount;

    let wpm = Math.round((correctCount / 5) / timeElapsedMin);
    wpmVal.innerText = wpm >= 0 ? wpm : 0;

    let acc = totalTyped > 0 ? Math.round((correctCount / totalTyped) * 100) : 100;
    accuracyVal.innerText = `${acc}%`;
}

function startSession() {
    AudioEngine.init();
    isPlaying = true;
    paper.scrollTop = 0;
    
    timeTotal = parseInt(timeSelect.value);
    timeRemaining = timeTotal;
    
    updateTimerDisplay();
    generateTestInterface();
    
    wpmVal.innerText = "0";
    accuracyVal.innerText = "100%";
    
    overlay.style.display = 'none';
    actionBtn.innerText = "ABORT";
    timeSelect.disabled = true;
    customTextArea.disabled = true;
    filePicker.disabled = true;
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        calculateMetrics();
        if(timeRemaining <= 0) endSession(false);
    }, 1000);
}

function endSession(aborted = false) {
    isPlaying = false;
    clearInterval(timerInterval);
    actionBtn.innerText = "START SESSION";
    timeSelect.disabled = false;
    customTextArea.disabled = false;
    filePicker.disabled = false;
    overlay.style.display = 'flex';
    overlay.innerText = aborted ? "Session Aborted - Click to Restart" : "Session Finished!";
    if(!aborted && soundToggle.checked) AudioEngine.playBell();
}

// Theme Switch Routine
themeToggle.addEventListener('change', () => {
    if(themeToggle.checked) {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
});

// File Selection Parsing Routine
filePicker.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        customTextArea.value = evt.target.result;
    };
    reader.readAsText(file);
});

// Physical Keyboard Event Bindings and Correction Routing
window.addEventListener('keydown', (e) => {
    const keyEl = document.querySelector(`[data-key="${e.code}"]`);
    if (keyEl) keyEl.classList.add('pressed');

    if (!isPlaying) return;

    // Block default actions for window control targets
    if (e.key === ' ' || e.key === 'Backspace') e.preventDefault();
    if (e.key.length > 1 && e.key !== 'Backspace') return;

    let spans = textTarget.querySelectorAll('.char');

    // Backspace Reversal Step Engine
    if (e.key === 'Backspace') {
        if (charIndex > 0) {
            charIndex--;
            spans[charIndex].classList.remove('correct', 'incorrect');
            if (soundToggle.checked) AudioEngine.playClick();
            highlightCurrentChar();
            calculateMetrics();
        }
        return;
    }

    // Alpha-Numeric Execution Engine
    if (charIndex < spans.length) {
        let inputChar = e.key;
        let targetChar = spans[charIndex].innerText;

        if (inputChar === targetChar) {
            spans[charIndex].classList.add('correct');
        } else {
            spans[charIndex].classList.add('incorrect');
        }

        if (soundToggle.checked) AudioEngine.playClick();
        if (inputChar === ' ' && soundToggle.checked && Math.random() > 0.75) {
            AudioEngine.playBell();
        }

        charIndex++;
        calculateMetrics();

        if (charIndex >= spans.length) {
            endSession(false);
        } else {
            highlightCurrentChar();
        }
    }
});

window.addEventListener('keyup', (e) => {
    const keyEl = document.querySelector(`[data-key="${e.code}"]`);
    if (keyEl) keyEl.classList.remove('pressed');
});

actionBtn.addEventListener('click', () => {
    if(isPlaying) endSession(true); else startSession();
});

overlay.addEventListener('click', () => {
    if(!isPlaying) startSession();
});
