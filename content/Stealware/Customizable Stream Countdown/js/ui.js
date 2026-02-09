import { updateParam, getShareableURL } from './state.js';
import { startTimer, stopTimer, formatTime } from './timer.js';
import * as Audio from './audio.js'; 

const DOM = {
    app: document.getElementById('app-container'),
    title: document.getElementById('stream-title'),
    timer: document.getElementById('timer-display'),
    startBtn: document.getElementById('main-start-btn'), // NEW
    nowPlaying: document.getElementById('now-playing'),
    trackName: document.getElementById('track-name'),
    progressBar: document.getElementById('progress-bar'),
    settingsModal: document.getElementById('settings-modal'),
    settingsTrigger: document.getElementById('settings-trigger'),
    inputs: document.querySelectorAll('[data-param]'),
    closeSettings: document.getElementById('close-settings'),
    copyBtn: document.getElementById('copy-url-btn'),
    stopBtn: document.getElementById('stop-timer-btn'), // NEW
    fontLink: document.getElementById('dynamic-font')
};

/* =========================================
   PUBLIC API
   ========================================= */

export function applySettings(state) {
    DOM.title.textContent = state.title;
    document.body.style.backgroundColor = state.colorBg;
    document.body.style.color = state.colorText;
    
    // Set timer text initially (if not running) to match the minutes setting
    // This gives a nice preview before they hit start
    if (!DOM.timer.classList.contains('running')) {
        DOM.timer.textContent = formatTime(state.minutes * 60);
    }

    if (state.font) loadGoogleFont(state.font);
    Audio.setVolume(state.volume);

    DOM.inputs.forEach(input => {
        const key = input.dataset.param;
        if (state[key] !== undefined) {
            if (input.type === 'checkbox') {
                input.checked = (state[key] === 'true');
            } else {
                input.value = state[key];
            }
        }
    });
}

export function initEventListeners() {
    DOM.settingsTrigger.addEventListener('click', () => DOM.settingsModal.classList.remove('hidden'));
    DOM.closeSettings.addEventListener('click', () => DOM.settingsModal.classList.add('hidden'));

    // --- STOP TIMER LOGIC ---
    DOM.stopBtn.addEventListener('click', () => {
        stopTimer();
        Audio.stopAudio();
        DOM.startBtn.classList.remove('hidden'); // Bring back start button
        DOM.timer.classList.remove('running');
        DOM.nowPlaying.classList.add('hidden');
        DOM.timer.classList.remove('blink');
        DOM.settingsModal.classList.add('hidden'); // Auto close menu
        
        // Reset timer display to the config value
        // We can grab value from input since it's synced
        const mins = document.getElementById('input-minutes').value;
        DOM.timer.textContent = formatTime(mins * 60);
    });

    DOM.copyBtn.addEventListener('click', () => {
        const url = getShareableURL();
        navigator.clipboard.writeText(url).then(() => {
            DOM.copyBtn.textContent = "Copied!";
            setTimeout(() => DOM.copyBtn.textContent = "Copy OBS Link", 2000);
        });
    });

    DOM.inputs.forEach(input => {
        input.addEventListener('change', (e) => {
            const key = e.target.dataset.param;
            let val = e.target.value;
            if (e.target.type === 'checkbox') {
                val = e.target.checked ? 'true' : 'false';
            }
            updateParam(key, val); 
        });
        
        if (input.type !== 'checkbox') {
             input.addEventListener('input', (e) => {
                const key = e.target.dataset.param;
                updateParam(key, e.target.value);
            });
        }
    });

    window.addEventListener('stateChange', (e) => {
        const { key, value } = e.detail;
        if (key === 'font') loadGoogleFont(value);
        if (key === 'colorBg') document.body.style.backgroundColor = value;
        if (key === 'colorText') document.body.style.color = value;
        if (key === 'title') DOM.title.textContent = value;
        if (key === 'volume') Audio.setVolume(value);
        
        // Update timer preview if we change minutes while stopped
        if (key === 'minutes' && !DOM.timer.classList.contains('running')) {
            DOM.timer.textContent = formatTime(value * 60);
        }
    });

    window.addEventListener('timerTick', (e) => {
        DOM.timer.textContent = e.detail.formatted;
    });

    window.addEventListener('timerComplete', () => {
        DOM.timer.textContent = "00:00";
        DOM.timer.classList.add('blink'); 
        Audio.stopAudio(); 
    });

    // --- Audio Events ---
    window.addEventListener('trackChange', (e) => {
        DOM.nowPlaying.classList.remove('hidden');
        DOM.trackName.textContent = e.detail.title;
        DOM.progressBar.style.width = '0%'; 
    });

    window.addEventListener('audioProgress', (e) => {
        DOM.progressBar.style.width = `${e.detail.percent}%`;
    });
}

/* =========================================
   STARTUP LOGIC (With Back-Timing)
   ========================================= */

export async function startExperience(state) {
    const isAudioEnabled = (state.audioEnabled === 'true');

    // Hide Start Button
    DOM.startBtn.classList.add('hidden');
    DOM.timer.classList.add('running');
    DOM.timer.classList.remove('blink');

    // 1. Start the Timer immediately (Visuals first)
    startTimer(state.minutes);

    if (isAudioEnabled) {
        DOM.nowPlaying.classList.remove('hidden');
        DOM.trackName.textContent = "Loading PodCube...";
        
        // Load data
        await Audio.loadEpisodes();

        // Generate Playlist
        const timerDuration = state.minutes * 60;
        const playlist = Audio.generatePlaylist(timerDuration);
        
        // Calculate Durations
        const playlistDuration = Audio.getQueueDuration(playlist);
        const delay = timerDuration - playlistDuration;

        // --- LOGGING ---
        console.group("⏱️ Back-Timing Calculation");
        console.log(`Target Timer:   ${timerDuration}s`);
        console.log(`Playlist Total: ${playlistDuration}s`);
        console.log(`Gap to Fill:    ${delay}s`);
        
        if (delay > 0) {
            console.log("👉 Action: DELAYING start to sync end times.");
        } else {
            console.log("👉 Action: PLAYING immediately (Playlist is longer than timer).");
        }
        console.groupEnd();
        // ----------------

        if (delay > 0) {
            updateSyncStatus(delay);
            
            setTimeout(() => {
                // Check if we are still running before starting audio!
                if(DOM.timer.classList.contains('running')) {
                    Audio.playQueue(playlist);
                }
            }, delay * 1000);

        } else {
            Audio.playQueue(playlist);
        }
    } else {
        DOM.nowPlaying.classList.add('hidden');
    }
}

function updateSyncStatus(secondsRemaining) {
    if (secondsRemaining <= 0) return;
    
    DOM.trackName.textContent = `Syncing... Audio starts in ${formatTime(secondsRemaining)}`;
    DOM.progressBar.style.width = '0%';
    
    const interval = setInterval(() => {
        // Stop if user cancelled timer
        if (!DOM.timer.classList.contains('running')) {
            clearInterval(interval);
            return;
        }

        secondsRemaining--;
        if (secondsRemaining <= 0) {
            clearInterval(interval);
        } else {
             DOM.trackName.textContent = `Syncing... Audio starts in ${formatTime(secondsRemaining)}`;
        }
    }, 1000);
}

function loadGoogleFont(fontName) {
    if (!fontName) return;
    const formatted = fontName.trim().replace(/\s+/g, '+');
    DOM.fontLink.href = `https://fonts.googleapis.com/css2?family=${formatted}&display=swap`;
    document.body.style.fontFamily = `'${fontName}', sans-serif`;
}