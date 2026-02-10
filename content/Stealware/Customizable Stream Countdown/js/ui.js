import { updateParam, getShareableURL, getState } from './state.js';
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

    btnToggleLayout: document.getElementById('btn-toggle-layout'),
    btnResetLayout: document.getElementById('btn-reset-layout'),
    btnResetAll: document.getElementById('btn-reset-all'),

    shadowCheckbox: document.getElementById('input-shadow-enabled'),
    shadowContainer: document.getElementById('shadow-controls-container'),
    
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
    if (window.obsstudio) {
        document.documentElement.classList.add('obs-environment');
    }
    DOM.title.innerText = state.title;


   document.documentElement.style.setProperty('--main-bg-color', state.colorBg);
    
    //    Toggle a class indicating the User WANTS transparency.
    //    Our CSS will decide whether to actually apply it (only if .obs-environment is also present).
    if (state.bgTransparent === 'true') {
        document.documentElement.classList.add('transparency-requested');
    } else {
        document.documentElement.classList.remove('transparency-requested');
    }
    
    if (state.bgTransparent === 'true' && !window.obsstudio) {
        // console.log("Transparency requested, but visible because not in OBS.");
    }
    document.body.style.color = state.colorText;

    const shadowOn = (state.shadowEnabled === 'true');
    const sColor = shadowOn ? state.shadowColor : 'transparent'; // Hide if off

    document.documentElement.style.setProperty('--shadow-color', sColor);
    document.documentElement.style.setProperty('--shadow-x', state.shadowX + 'vmin');
    document.documentElement.style.setProperty('--shadow-y', state.shadowY + 'vmin');
    document.documentElement.style.setProperty('--shadow-blur', state.shadowBlur + 'vmin');

    if (state.font) loadGoogleFont(state.font);

    if (state.audioEnabled === 'true') {
        DOM.nowPlaying.classList.remove('hidden');
    } else {
        DOM.nowPlaying.classList.add('hidden');
    }

    Audio.setVolume(state.volume);

    DOM.inputs.forEach(input => {
        const key = input.dataset.param;
        if (state[key] !== undefined) {
            if (input.type === 'checkbox') {
                input.checked = (state[key] === 'true');
            } else {
                input.value = state[key];
                if (input.type === 'color') {
                    updateColorSwatch(input);
                }
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

    if (DOM.shadowContainer) {
        if (state.shadowEnabled === 'true') {
            DOM.shadowContainer.classList.remove('vanish');
        } else {
            DOM.shadowContainer.classList.add('vanish');
        }
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
                // Wipe the URL parameters
                const cleanURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({}, document.title, cleanURL);
                
                // Reload the page to load defaults
                window.location.reload();
            }
        });
    }

    if (DOM.shadowCheckbox && DOM.shadowContainer) {
        DOM.shadowCheckbox.addEventListener('change', () => {
            if (DOM.shadowCheckbox.checked) {
                DOM.shadowContainer.classList.remove('vanish');
            } else {
                DOM.shadowContainer.classList.add('vanish');
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
                // If it's the title and they are holding Shift, do nothing (allow newline)
                if (e.shiftKey && el === DOM.title) {
                    return; 
                }
                
                // Otherwise, prevent default Enter behavior and blur (save)
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
                if (e.target.type === 'color') {
                    updateColorSwatch(e.target);
                }
            });
        }
    });

    DOM.stopBtn.addEventListener('click', () => {
        stopTimer();
        Audio.stopAudio();
        if (syncInterval) { clearInterval(syncInterval); };
        DOM.startBtn.classList.remove('hidden');
        DOM.timerContainer.classList.remove('running');

        if (!document.getElementById('input-audio-enabled').checked) {
            DOM.nowPlaying.classList.add('hidden');
        }

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

        if (key === 'audioEnabled') {
            if (value === 'true') {
                DOM.nowPlaying.classList.remove('hidden');
            } else {
                DOM.nowPlaying.classList.add('hidden');
            }
        }
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
            const bgColor = document.getElementById('input-color-bg').value;
            
            // Always update the underlying color variable
            document.documentElement.style.setProperty('--main-bg-color', bgColor);
            
            // Toggle the transparency class live
            if (isTrans) {
                document.documentElement.classList.add('transparency-requested');
            } else {
                document.documentElement.classList.remove('transparency-requested');
            }
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
        Audio.syncPlaybackRate(e.detail.seconds);
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

    if (DOM.btnToggleLayout) {
        DOM.btnToggleLayout.addEventListener('click', () => {
            // Check current state by looking at the body class
            const isCurrentlyEditing = document.body.classList.contains('layout-editing');

            if (!isCurrentlyEditing) {
               
                
                // If we aren't already in custom mode, freeze current positions so they don't jump
                if (!DOM.app.classList.contains('custom-layout')) {
                    freezeCurrentPositions();
                }

                toggleLayoutEditing(true);
                updateParam('layoutMode', 'custom');
            } else {
                // TURN OFF
                toggleLayoutEditing(false);
                // We leave 'layoutMode' as custom so positions persist
            }
        });
    }

    DOM.btnResetLayout.addEventListener('click', () => {
        if(confirm("Reset all elements to center?")) {
            // Clear State
            updateParam('posTitle', '');
            updateParam('posTimer', '');
            updateParam('posTrack', '');
            updateParam('layoutMode', 'auto');
            
            toggleLayoutEditing(false); // This now handles the button text reset
            
            DOM.app.classList.remove('custom-layout'); 

            // Clear Inline Styles
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
        const GAP_THRESHOLD = 60; // Seconds (can exceed 60). Used to be 90

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

        Audio.preloadFirstTrack(playlist);
        if (delay <= 10) {
            // If the delay is already short, preload immediately
            Audio.preloadFirstTrack(playlist);
        } else {
            // Otherwise, wait until 10 seconds before playback to preload
            const preloadWaitTime = delay - 10;
            console.log(`[UI] Waiting ${preloadWaitTime}s to preload first track...`);
            setTimeout(() => {
                if (DOM.timerContainer.classList.contains('running')) {
                    Audio.preloadFirstTrack(playlist);
                }
            }, preloadWaitTime * 1000);
        }

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
    const header = modal.querySelector('.settings-header'); // Grab the whole header
    
    let isDragging = false;
    let startX, startY, initialTranslateX, initialTranslateY;

    // Helper for coordinates
    const getCoords = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    const getTranslateValues = (element) => {
        const style = window.getComputedStyle(element);
        const matrix = new WebKitCSSMatrix(style.transform);
        return { x: matrix.m41, y: matrix.m42 };
    };

    const onStart = (e) => {
        // Only allow dragging from the header area
        // (optional check if you want to be strict)
        
        isDragging = true;
        const coords = getCoords(e);
        startX = coords.x;
        startY = coords.y;
        
        const currentPos = getTranslateValues(modal);
        initialTranslateX = currentPos.x;
        initialTranslateY = currentPos.y;
        
        header.style.cursor = 'grabbing';
        
        if(e.type === 'touchstart') document.body.style.overflow = 'hidden';
    };

    const onMove = (e) => {
        if (!isDragging) return;
        e.preventDefault(); // Stop scrolling

        const coords = getCoords(e);
        const dx = coords.x - startX;
        const dy = coords.y - startY;

        modal.style.transform = `translate(${initialTranslateX + dx}px, ${initialTranslateY + dy}px)`;
    };

    const onEnd = () => {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = 'grab';
            document.body.style.overflow = '';
        }
    };

    // Mouse
    header.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    // Touch
    header.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
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
        // --- STATE: EDITING ---
        document.body.classList.add('layout-editing');
        DOM.app.classList.add('custom-layout'); 
        Object.values(DOM.dragTargets).forEach(el => el.classList.add('draggable-item'));
        
        if (DOM.startBtn) DOM.startBtn.classList.add('hidden');

        // Update Button State
        if (DOM.btnToggleLayout) {
            DOM.btnToggleLayout.textContent = "Done";
            DOM.btnToggleLayout.classList.add('active-state'); // We will style this green
        }

    } else {
        // --- STATE: LOCKED ---
        document.body.classList.remove('layout-editing');
        
        if (DOM.startBtn && !DOM.timerContainer.classList.contains('running')) {
            DOM.startBtn.classList.remove('hidden');
        }

        // Update Button State
        if (DOM.btnToggleLayout) {
            DOM.btnToggleLayout.textContent = "Unlock";
            DOM.btnToggleLayout.classList.remove('active-state');
        }
    }
}

function makeElementDraggable(element, paramKey) {
    let isDragging = false;
    
    // Helper to get X/Y from either Mouse or Touch
    const getCoords = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    const onStart = (e) => {
        if (!document.body.classList.contains('layout-editing')) return;
        
        isDragging = true;
        element.style.cursor = 'grabbing';
        
        // Prevent scrolling while dragging on mobile
        if (e.type === 'touchstart') document.body.style.overflow = 'hidden';

        // Prevent default browser drag/selection
        // (We don't preventDefault on touchstart immediately, or click events might break.
        // We do it on move.)
        if (e.type === 'mousedown') e.preventDefault();
        
        element.style.zIndex = 1000;
    };

    const onMove = (e) => {
        if (!isDragging) return;
        
        e.preventDefault(); // Stop screen scrolling

        const coords = getCoords(e);
        
        // Calculate position as percentage of window width/height
        const xPct = (coords.x / window.innerWidth) * 100;
        const yPct = (coords.y / window.innerHeight) * 100;

        element.style.left = `${xPct}%`;
        element.style.top = `${yPct}%`;
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        element.style.cursor = 'grab';
        element.style.zIndex = '';
        
        // Re-enable scrolling
        document.body.style.overflow = '';

        // Save state
        const x = parseFloat(element.style.left).toFixed(2);
        const y = parseFloat(element.style.top).toFixed(2);
        
        const stateKey = `pos${paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}`;
        updateParam(stateKey, `${x},${y}`);
    };

    // Mouse Listeners
    element.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    // Touch Listeners (Passive: false allows us to call preventDefault)
    element.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
}


function loadGoogleFont(fontName) {
    if (!fontName) return;
    const formatted = fontName.trim().replace(/\s+/g, '+');
    DOM.fontLink.href = `https://fonts.googleapis.com/css2?family=${formatted}&display=swap`;
    document.body.style.fontFamily = `'${fontName}', sans-serif`;
}

function updateColorSwatch(input) {
    if (input && input.parentElement && input.parentElement.classList.contains('color-swatch-wrapper')) {
        input.parentElement.style.backgroundColor = input.value;
    }
}