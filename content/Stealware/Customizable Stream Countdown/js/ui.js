import { updateParam, getShareableURL } from './state.js';
import { startTimer, stopTimer, formatTime } from './timer.js';
import * as Audio from './audio.js';

let syncInterval = null;

const DOM = {
    app: document.getElementById('app-container'),
    title: document.getElementById('stream-title'),
    timerContainer: document.getElementById('timer-container'),
    timerMin: document.getElementById('timer-min'),
    timerSec: document.getElementById('timer-sec'),

    startBtn: document.getElementById('main-start-btn'),
    nowPlaying: document.getElementById('now-playing'),
    trackName: document.getElementById('track-name'),
    progressBar: document.getElementById('progress-bar'),
    settingsModal: document.getElementById('settings-modal'),
    settingsTrigger: document.getElementById('settings-trigger'),
    inputs: document.querySelectorAll('[data-param]'),
    sliderMin: document.getElementById('slider-minutes'),
    inputMin: document.getElementById('input-minutes'),
    sliderSec: document.getElementById('slider-seconds'),
    inputSec: document.getElementById('input-seconds'),
    closeSettings: document.getElementById('close-settings'),
    copyBtn: document.getElementById('copy-url-btn'),
    stopBtn: document.getElementById('stop-timer-btn'),
    fontLink: document.getElementById('dynamic-font'),
    logoContainers: document.querySelectorAll('.podcube-logo'),

    inputFreePos: document.getElementById('input-free-pos'),
    btnResetLayout: document.getElementById('btn-reset-layout'),
    btnResetAll: document.getElementById('btn-reset-all'),
    
    // The draggable targets
    dragTargets: {
        title: document.getElementById('stream-title'),
        timer: document.getElementById('timer-container'),
        track: document.getElementById('now-playing')
    }
};


export async function loadBranding() {
    const logoUrl = await Audio.getPodcastLogoUrl();
    if (logoUrl) {
        DOM.logoContainers.forEach(el => {
            el.innerHTML = `<img src="${logoUrl}" alt="Show Logo">`;
        });
    }
}

export function applySettings(state) {
    DOM.title.textContent = state.title;
    const isTrans = (state.bgTransparent === 'true');
    const finalBg = isTrans ? 'rgba(0,0,0,0)' : state.colorBg;
    document.documentElement.style.setProperty('--main-bg-color', finalBg);
    document.body.style.color = state.colorText;

    const shadowOn = (state.shadowEnabled === 'true');
    const sColor = shadowOn ? state.shadowColor : 'transparent'; // Hide if off

    document.documentElement.style.setProperty('--shadow-color', sColor);
    document.documentElement.style.setProperty('--shadow-x', state.shadowX + 'vmin');
    document.documentElement.style.setProperty('--shadow-y', state.shadowY + 'vmin');
    document.documentElement.style.setProperty('--shadow-blur', state.shadowBlur + 'vmin');

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

    DOM.sliderMin.value = state.minutes;
    DOM.sliderSec.value = state.seconds;
    DOM.inputMin.value = state.minutes;
    DOM.inputSec.value = state.seconds;

    if (!DOM.timerContainer.classList.contains('running')) {
        updateTimerDisplay(state.minutes, state.seconds);
    }

    // --- Apply Layout Mode ---
    // We are in custom mode if the state says so, OR if we have saved positions.
    const hasSavedPositions = (state.posTitle || state.posTimer || state.posTrack);
    const isCustom = (state.layoutMode === 'custom') || hasSavedPositions;
    
    if (isCustom) {
        DOM.app.classList.add('custom-layout');
        
        // Ensure they have the class that makes them absolute
        Object.values(DOM.dragTargets).forEach(el => el.classList.add('draggable-item'));

        // Apply saved positions
        if (state.posTitle) applyPos(DOM.dragTargets.title, state.posTitle);
        if (state.posTimer) applyPos(DOM.dragTargets.timer, state.posTimer);
        if (state.posTrack) applyPos(DOM.dragTargets.track, state.posTrack);

        // SYNC THE CHECKBOX:
        // Only check the box if we are actively "editing" (which we don't persist usually),
        // OR just leave it unchecked so the user defaults to "Locked" mode.
        // Let's leave it unchecked by default on load to protect the layout.
        // The user must click "Enable" to start moving things again.
        if (DOM.inputFreePos.checked) {
            manageGhostBox(true);
            toggleLayoutEditing(true);
        }
    } else {
        DOM.app.classList.remove('custom-layout');
        Object.values(DOM.dragTargets).forEach(el => el.classList.remove('draggable-item'));
    }
}

export function initEventListeners() {
    DOM.settingsTrigger.addEventListener('click', () => DOM.settingsModal.classList.remove('hidden'));
    DOM.closeSettings.addEventListener('click', () => DOM.settingsModal.classList.add('hidden'));

    if (DOM.btnResetAll) {
        DOM.btnResetAll.addEventListener('click', () => {
            if (confirm("Are you sure? This will reset ALL settings, colors, and text to default.")) {
                // 1. Wipe the URL parameters
                const cleanURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({}, document.title, cleanURL);
                
                // 2. Reload the page to load defaults
                window.location.reload();
            }
        });
    }

    DOM.title.addEventListener('blur', () => updateParam('title', DOM.title.textContent));

    DOM.timerMin.addEventListener('blur', () => {
        const val = sanitizeInt(DOM.timerMin.textContent, 0, 999);
        updateParam('minutes', val);
    });

    DOM.timerSec.addEventListener('blur', () => {
        const val = sanitizeInt(DOM.timerSec.textContent, 0, 59);
        updateParam('seconds', val);
    });

    [DOM.title, DOM.timerMin, DOM.timerSec].forEach(el => {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                el.blur();
            }
        });
    });

    const linkInputs = (slider, number, param) => {
        slider.addEventListener('input', () => {
            number.value = slider.value;
            updateParam(param, slider.value);
        });
        number.addEventListener('input', () => {
            slider.value = number.value;
            updateParam(param, number.value);
        });
    };
    linkInputs(DOM.sliderMin, DOM.inputMin, 'minutes');
    linkInputs(DOM.sliderSec, DOM.inputSec, 'seconds');

    DOM.inputs.forEach(input => {
        if (input.id === 'input-minutes' || input.id === 'input-seconds') return;
        input.addEventListener('change', (e) => {
            const key = e.target.dataset.param;
            let val = e.target.type === 'checkbox' ? (e.target.checked ? 'true' : 'false') : e.target.value;
            updateParam(key, val);
        });
        if (input.type !== 'checkbox') {
            input.addEventListener('input', (e) => {
                const key = e.target.dataset.param;
                updateParam(key, e.target.value);
            });
        }
    });

    DOM.stopBtn.addEventListener('click', () => {
        stopTimer();
        Audio.stopAudio();
        if (syncInterval) { clearInterval(syncInterval); };
        DOM.startBtn.classList.remove('hidden');
        DOM.timerContainer.classList.remove('running');
        DOM.nowPlaying.classList.add('hidden');
        DOM.timerContainer.classList.remove('blink');
        DOM.settingsModal.classList.add('hidden');

        const m = parseInt(DOM.inputMin.value, 10) || 0;
        const s = parseInt(DOM.inputSec.value, 10) || 0;
        updateTimerDisplay(m, s);
    });

    DOM.copyBtn.addEventListener('click', () => {
        const url = getShareableURL();
        navigator.clipboard.writeText(url).then(() => {
            DOM.copyBtn.textContent = "Copied!";
            setTimeout(() => DOM.copyBtn.textContent = "Copy OBS Link", 2000);
        });
    });

    window.addEventListener('stateChange', (e) => {
        const { key, value } = e.detail;
        if (key === 'title') DOM.title.textContent = value;
        if (key === 'volume') Audio.setVolume(value);

        if (key === 'minutes') { DOM.inputMin.value = value; DOM.sliderMin.value = value; }
        if (key === 'seconds') { DOM.inputSec.value = value; DOM.sliderSec.value = value; }
        if ((key === 'minutes' || key === 'seconds') && !DOM.timerContainer.classList.contains('running')) {
            const m = parseInt(DOM.inputMin.value, 10) || 0;
            const s = parseInt(DOM.inputSec.value, 10) || 0;
            updateTimerDisplay(m, s);
        }

        if (key === 'font') loadGoogleFont(value);
        if (key === 'colorText') document.body.style.color = value;
        if (['shadowColor', 'shadowEnabled', 'shadowX', 'shadowY', 'shadowBlur'].includes(key)) {
            // Re-read current state values for the composite shadow property
            const sEnabled = document.getElementById('input-shadow-enabled').checked;
            const sColor = document.getElementById('input-color-shadow').value;
            const sX = document.getElementById('input-shadow-x').value;
            const sY = document.getElementById('input-shadow-y').value;
            const sBlur = document.getElementById('input-shadow-blur').value;

            const finalColor = sEnabled ? sColor : 'transparent';

            document.documentElement.style.setProperty('--shadow-color', finalColor);
            document.documentElement.style.setProperty('--shadow-x', sX + 'vmin');
            document.documentElement.style.setProperty('--shadow-y', sY + 'vmin');
            document.documentElement.style.setProperty('--shadow-blur', sBlur + 'vmin');
        }

        if (key === 'colorBg' || key === 'bgTransparent') {
            const isTrans = document.getElementById('input-bg-transparent').checked;
            document.body.style.backgroundColor = isTrans ? 'rgba(0,0,0,0)' : document.getElementById('input-color-bg').value;
        }


    });

    window.addEventListener('timerTick', (e) => {
        const parts = e.detail.formatted.split(':');
        if (parts.length === 2) {
            updateTimerDisplay(parts[0], parts[1]);
        } else if (parts.length === 3) {
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            updateTimerDisplay((h * 60 + m), parts[2]);
        }
    });

    window.addEventListener('timerComplete', () => {
        updateTimerDisplay(0, 0);
        DOM.timerContainer.classList.add('blink');

        // This tells audio to empty the queue but let the speaker finish their sentence
        Audio.finishCurrentQueue();
    });

    window.addEventListener('trackChange', (e) => {
        // Show the container if it was hidden
        DOM.nowPlaying.classList.remove('hidden');

        // Smoothly update the title
        DOM.trackName.textContent = e.detail.title;

        // Reset progress bar immediately to 0 to avoid "snapping" from 100%
        DOM.progressBar.style.transition = 'none';
        DOM.progressBar.style.width = '0%';

        // Force a reflow and re-enable transitions for smooth progress
        setTimeout(() => {
            DOM.progressBar.style.transition = 'width 0.1s linear';
        }, 50);
    });

    window.addEventListener('audioProgress', (e) => {
        DOM.progressBar.style.width = `${e.detail.percent}%`;
    });

    DOM.inputFreePos.addEventListener('change', (e) => {
        const isEditing = e.target.checked;
        
        if (isEditing) {
            // 1. REVEAL FIRST: Ensure elements are visible so we can measure them.
            manageGhostBox(true);

            // 2. FREEZE SECOND: Now that dimensions are valid, capture positions.
            if (!DOM.app.classList.contains('custom-layout')) {
                freezeCurrentPositions();
            }
            
            // 3. ENABLE EDITING: Turn on outlines/cursors
            toggleLayoutEditing(true);
            updateParam('layoutMode', 'custom');
        } else {
            // Turning off
            toggleLayoutEditing(false);
            manageGhostBox(false); // Hide the ghost box if needed
        }
    });

    DOM.btnResetLayout.addEventListener('click', () => {
        if(confirm("Reset all elements to center?")) {
            // 1. Clear State
            updateParam('posTitle', '');
            updateParam('posTimer', '');
            updateParam('posTrack', '');
            updateParam('layoutMode', 'auto'); 
            
            // 2. Clear UI
            DOM.inputFreePos.checked = false;
            toggleLayoutEditing(false); // Turn off outlines
            DOM.app.classList.remove('custom-layout'); // Revert to flex
            
            // 3. Clear Inline Styles (Crucial for Flexbox to work again)
            Object.values(DOM.dragTargets).forEach(el => {
                el.style.left = '';
                el.style.top = '';
                el.classList.remove('draggable-item');
            });
        }
    });

    // Initialize Drag Logic
    Object.entries(DOM.dragTargets).forEach(([key, element]) => {
        makeElementDraggable(element, key);
    });

    initDraggableModal();
}

export async function startExperience(state) {
    const isAudioEnabled = (state.audioEnabled === 'true');

    DOM.startBtn.classList.add('hidden');
    DOM.timerContainer.classList.add('running');
    DOM.timerContainer.classList.remove('blink');

    const totalMinutes = parseInt(state.minutes, 10) || 0;
    const totalSeconds = parseInt(state.seconds, 10) || 0;
    const durationSec = (totalMinutes * 60) + totalSeconds;

    startTimer(durationSec);

    if (isAudioEnabled) {
        DOM.nowPlaying.classList.remove('hidden');
        DOM.trackName.textContent = "Loading PodCube...";

        await Audio.loadEpisodes();

        // --- RETRY LOGIC FOR LONG GAPS ---
        let playlist = [];
        let playlistDuration = 0;
        let delay = 0;
        let retries = 0;
        const MAX_RETRIES = 3;
        const GAP_THRESHOLD = 90; // 1:30

        do {
            playlist = Audio.generatePlaylist(durationSec);
            playlistDuration = Audio.getQueueDuration(playlist);
            delay = durationSec - playlistDuration;
            retries++;
            
            if (delay > GAP_THRESHOLD && retries < MAX_RETRIES) {
                console.log(`[Audio] Gap of ${delay}s too long. Retrying (${retries}/${MAX_RETRIES})...`);
            } else {
                break;
            }
        } while (retries < MAX_RETRIES);
        // --------------------------------------

        console.group("[UI.js] Back-Timing Calculation");
        console.log(`Target Timer:   ${durationSec}s`);
        console.log(`Playlist Total: ${playlistDuration}s`);
        console.log(`Gap to Fill:    ${delay}s`);

        if (delay > 0) {
            updateSyncStatus(delay);
            setTimeout(() => {
                if (DOM.timerContainer.classList.contains('running')) {
                    Audio.playQueue(playlist);
                }
            }, delay * 1000);
        } else {
            Audio.playQueue(playlist);
        }
        console.groupEnd();

    } else {
        DOM.nowPlaying.classList.add('hidden');
    }
}

function sanitizeInt(input, min, max) {
    const clean = String(input).replace(/\D/g, '');
    let val = parseInt(clean, 10);
    if (isNaN(val)) val = 0;
    if (val < min) val = min;
    if (val > max) val = max;
    return val;
}

function updateTimerDisplay(m, s) {
    const safeM = parseInt(m, 10) || 0;
    const safeS = parseInt(s, 10) || 0;
    DOM.timerMin.textContent = safeM.toString().padStart(2, '0');
    DOM.timerSec.textContent = safeS.toString().padStart(2, '0');
}

function updateSyncStatus(secondsRemaining) {
    if (secondsRemaining <= 0) return;
    
    // Clear any existing interval to be safe
    if (syncInterval) clearInterval(syncInterval);

    DOM.trackName.textContent = `Syncing... Audio starts in ${formatTime(secondsRemaining)}`;
    
    syncInterval = setInterval(() => {
        // We still keep this check as a backup
        if (!DOM.timerContainer.classList.contains('running')) {
            clearInterval(syncInterval);
            return;
        }
        secondsRemaining--;
        if (secondsRemaining <= 0) {
            clearInterval(syncInterval);
        } else {
            DOM.trackName.textContent = `Syncing... Audio starts in ${formatTime(secondsRemaining)}`;
        }
    }, 1000);
}

function initDraggableModal() {
    const modal = document.querySelector('.settings-content');
    const header = modal.querySelector('h2'); // The "Handle"
    
    let isDragging = false;
    let startX, startY, initialTranslateX, initialTranslateY;

    // Helper to get current transform values
    const getTranslateValues = (element) => {
        const style = window.getComputedStyle(element);
        const matrix = new WebKitCSSMatrix(style.transform);
        return { x: matrix.m41, y: matrix.m42 };
    };

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        // Get current transform position (or 0 if not set yet)
        const currentPos = getTranslateValues(modal);
        initialTranslateX = currentPos.x;
        initialTranslateY = currentPos.y;
        
        header.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Apply the difference to the initial transform
        const newX = initialTranslateX + dx;
        const newY = initialTranslateY + dy;

        modal.style.transform = `translate(${newX}px, ${newY}px)`;
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = 'grab';
        }
    });
}

function applyPos(element, posString) {
    const [x, y] = posString.split(',');
    if (x && y) {
        element.style.left = `${x}%`;
        element.style.top = `${y}%`;
    }
}

// ---------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------

/**
 * Calculates where the elements currently are (in Flexbox) 
 * and applies those coordinates as percentages so they don't jump.
 */
function freezeCurrentPositions() {
    Object.entries(DOM.dragTargets).forEach(([key, element]) => {
        // Get current visual rectangle
        const rect = element.getBoundingClientRect();
        
        let xPct, yPct;

        // FIX: Check if element is hidden or has 0 dimensions (like Now Playing)
        // If so, default it to the center (50, 50) so it doesn't jump to top-left.
        if (rect.width === 0 && rect.height === 0) {
            xPct = 50;
            yPct = 50;
        } else {
            // Calculate center point relative to viewport
            const centerX = rect.left + (rect.width / 2);
            const centerY = rect.top + (rect.height / 2);
            
            // Convert to percentages
            xPct = (centerX / window.innerWidth) * 100;
            yPct = (centerY / window.innerHeight) * 100;
        }
        
        // Apply immediately
        element.style.left = `${xPct}%`;
        element.style.top = `${yPct}%`;
        
        // Save to URL
        const stateKey = `pos${key.charAt(0).toUpperCase() + key.slice(1)}`;
        updateParam(stateKey, `${xPct.toFixed(2)},${yPct.toFixed(2)}`);
    });
}

function toggleLayoutEditing(enabled) {
    if (enabled) {
        document.body.classList.add('layout-editing');
        DOM.app.classList.add('custom-layout'); 
        Object.values(DOM.dragTargets).forEach(el => el.classList.add('draggable-item'));
        // Note: Ghost box logic moved to manageGhostBox()
    } else {
        document.body.classList.remove('layout-editing');
        // Note: We leave 'custom-layout' class ON so positions stick.
    }
}

function makeElementDraggable(element, paramKey) {
    let isDragging = false;
    let startX, startY;
    
    // We need to calculate % based positions
    const onMouseDown = (e) => {
        if (!document.body.classList.contains('layout-editing')) return;
        
        isDragging = true;
        element.style.cursor = 'grabbing';
        
        // Prevent default browser drag
        e.preventDefault();
        
        // Optional: Bring to front
        element.style.zIndex = 1000;
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;

        // Calculate position as percentage of window width/height
        const xPct = (e.clientX / window.innerWidth) * 100;
        const yPct = (e.clientY / window.innerHeight) * 100;

        element.style.left = `${xPct}%`;
        element.style.top = `${yPct}%`;
    };

    const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        element.style.cursor = 'grab';
        element.style.zIndex = '';

        // Save state
        const x = parseFloat(element.style.left).toFixed(2);
        const y = parseFloat(element.style.top).toFixed(2);
        
        // Map paramKey to state key
        const stateKey = `pos${paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}`;
        updateParam(stateKey, `${x},${y}`);
    };

    element.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

/**
 * Manages the "Ghost" visibility of the Now Playing box during editing.
 * If audio is disabled, we temporarily show the box so the user can move it.
 */
function manageGhostBox(shouldShow) {
    if (shouldShow) {
        if (DOM.nowPlaying.classList.contains('hidden')) {
             DOM.nowPlaying.dataset.wasHidden = "true";
             DOM.nowPlaying.classList.remove('hidden');
             DOM.nowPlaying.style.opacity = "0.5"; 
        }
    } else {
        if (DOM.nowPlaying.dataset.wasHidden === "true") {
            DOM.nowPlaying.classList.add('hidden');
            DOM.nowPlaying.style.opacity = "";
            delete DOM.nowPlaying.dataset.wasHidden;
        }
    }
}

function loadGoogleFont(fontName) {
    if (!fontName) return;
    const formatted = fontName.trim().replace(/\s+/g, '+');
    DOM.fontLink.href = `https://fonts.googleapis.com/css2?family=${formatted}&display=swap`;
    document.body.style.fontFamily = `'${fontName}', sans-serif`;
}