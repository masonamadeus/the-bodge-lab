import { updateParam, getShareableURL, getState } from './state.js';
import { startTimer, stopTimer, formatTime } from './timer.js';
import * as Audio from './audio.js';

let syncInterval = null;

/**
 * Validates that critical DOM elements exist before initializing
 * @throws {Error} if required elements are missing
 */
function validateDOM() {
    const required = [
        'app-container', 'stream-title', 'timer-container', 'timer-min', 'timer-sec',
        'main-start-btn', 'now-playing', 'settings-modal', 'settings-trigger',
        'close-settings', 'stop-timer-btn', 'copy-url-btn', 'dynamic-font',
        'svg-filter-container', 'dynamic-drop-shadow', 'input-shadow-enabled'
    ];
    
    for (const id of required) {
        if (!document.getElementById(id)) {
            console.error(`[UI] Critical DOM element missing: #${id}`);
        }
    }
}

/**
 * Validates user input values
 */
function validateInput(key, value) {
    if (key === 'title') {
        // Title must not be empty or just whitespace
        return String(value).trim().length > 0 ? String(value).trim() : 'Click to Edit';
    }
    if (key === 'font') {
        // Font names must be valid (alphanumeric, spaces, hyphens)
        const sanitized = String(value).trim().replace(/[^a-zA-Z0-9\s\-]/g, '');
        return sanitized.length > 0 ? sanitized : 'sans-serif';
    }
    return value;
}

/**
 * Shows a custom confirmation dialog with keyboard support
 * @param {string} title - The dialog title
 * @param {string} message - The confirmation message
 * @returns {Promise<boolean>} - True if confirmed, false if cancelled
 */
function showConfirmDialog(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');

        titleEl.textContent = title;
        messageEl.textContent = message;

        const cleanup = () => {
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKeyDown);
            modal.classList.add('hidden');
        };

        const onOk = () => {
            cleanup();
            resolve(true);
        };

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                onOk();
            }
        };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKeyDown);
        modal.classList.remove('hidden');
        
        // Focus the cancel button (safer default)
        setTimeout(() => cancelBtn.focus(), 0);
    });
}

const DOM = {
    app: document.getElementById('app-container'),
    title: document.getElementById('stream-title'),
    timerContainer: document.getElementById('timer-container'),
    timerMin: document.getElementById('timer-min'),
    timerSec: document.getElementById('timer-sec'),

    startBtn: document.getElementById('main-start-btn'),
    nowPlaying: document.getElementById('now-playing'),
    trackName: document.getElementById('track-name'),
    brandLabel: document.getElementById('brand-label'),
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
    svgFilter: document.getElementById('svg-filter-container'),
    dropShadowNode: document.getElementById('dynamic-drop-shadow'),
    shadowKnob: document.getElementById('input-shadow-knob'),
    shadowPointer: document.querySelector('.knob-pointer'),
    shadowDist: document.getElementById('input-shadow-dist'),
    shadowBlur: document.getElementById('input-shadow-blur'),
    
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
    try {
        // Validate DOM on first run
        validateDOM();
        
        // --- Drop Shadow Defaults & Sanitization ---
        // Set defaults if missing or invalid
        if (!('shadowAngle' in state) || isNaN(Number(state.shadowAngle))) state.shadowAngle = 90;
        if (!('shadowDistance' in state) || isNaN(Number(state.shadowDistance))) state.shadowDistance = 0;
        if (!('shadowBlur' in state) || isNaN(Number(state.shadowBlur))) state.shadowBlur = 0;

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



    // SHADOW - will be fully applied by applyShadowTransformation() below
    document.documentElement.style.setProperty('--shadow-color', 
        (state.shadowEnabled === 'true') ? state.shadowColor : 'transparent');

    // Sync UI controls to state (robust)
    if (DOM.shadowDist) DOM.shadowDist.value = String(Number(state.shadowDistance) || 0);
    if (DOM.shadowBlur) DOM.shadowBlur.value = String(Number(state.shadowBlur) || 0);
    if (DOM.shadowKnob && DOM.shadowPointer) {
        let angle = Number(state.shadowAngle);
        if (!isFinite(angle)) angle = 90;
        DOM.shadowPointer.style.transform = `rotate(${angle}deg)`;
    }

    // Apply complete shadow transformation including opacity and container visibility
    applyShadowTransformation(state);

    if (state.font) {
        const cleanFont = validateInput('font', state.font);
        loadGoogleFont(cleanFont);
    }

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
            } else if (input.tagName === 'SELECT') {
                input.value = state[key];
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
            if (state.posTitle) applyPos(DOM.dragTargets.title, state.posTitle, state.scaleTitle, state.rotTitle);
            if (state.posTimer) applyPos(DOM.dragTargets.timer, state.posTimer, state.scaleTimer, state.rotTimer);
            if (state.posTrack) applyPos(DOM.dragTargets.track, state.posTrack, state.scaleTrack, state.rotTrack);
            
        } else {
            DOM.app.classList.remove('custom-layout');
            Object.values(DOM.dragTargets).forEach(el => el.classList.remove('draggable-item'));
        }
    } catch (err) {
        console.error('[UI] Error applying settings:', err);
        // Continue with defaults rather than crashing
    }
}

/**
 * Handles stateChange events from state.js
 * Applies UI updates when state changes
 */
function handleStateChange(e) {
    const { key, value } = e.detail;
    
    // Update specific UI elements based on which state changed
    if (key === 'shadowAngle' || key === 'shadowDistance' || key === 'shadowBlur' || key === 'shadowEnabled' || key === 'shadowColor') {
        const state = getState();
        applyShadowTransformation(state);
        
        // Update container visibility if shadowEnabled changed
        if (key === 'shadowEnabled') {
            if (DOM.shadowContainer) {
                if (state.shadowEnabled === 'true') {
                    DOM.shadowContainer.classList.remove('vanish');
                } else {
                    DOM.shadowContainer.classList.add('vanish');
                }
            }
        }
    }
}

export function initEventListeners() {
    // Remove existing stateChange listener to prevent stacking on reinit
    window.removeEventListener('stateChange', handleStateChange);
    window.addEventListener('stateChange', handleStateChange);

    DOM.settingsTrigger.addEventListener('click', () => DOM.settingsModal.classList.remove('hidden'));
    DOM.closeSettings.addEventListener('click', () => DOM.settingsModal.classList.add('hidden'));

    if (DOM.btnResetAll) {
        DOM.btnResetAll.addEventListener('click', async () => {
            if (await showConfirmDialog("Reset All Settings", "Are you sure? This will reset ALL settings, colors, and text to default.")) {
                // Wipe the URL parameters
                const cleanURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({}, document.title, cleanURL);
                
                // Reload the page to load defaults
                window.location.reload();
            }
        });
    }


    DOM.title.addEventListener('blur', () => {
        const cleanTitle = validateInput('title', DOM.title.textContent);
        DOM.title.textContent = cleanTitle;
        updateParam('title', cleanTitle);
    });

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
            
            // Special handling for shadow toggle to ensure immediate UI update
            if (key === 'shadowEnabled' && DOM.shadowContainer) {
                if (val === 'true') {
                    DOM.shadowContainer.classList.remove('vanish');
                } else {
                    DOM.shadowContainer.classList.add('vanish');
                }
            }
            
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
        if (key === 'title') {
            DOM.title.textContent = value;

            // Put the handles back if this element has them!
            if (DOM.title._editHandles) {
                DOM.title._editHandles.forEach(h => DOM.title.appendChild(h));
            }
        }

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
        if (key === 'colorBg') document.documentElement.style.setProperty('--main-bg-color', value);
        if (key === 'shadowColor') document.documentElement.style.setProperty('--shadow-color', value);
        
        // Handle shadow changes efficiently
        if (key === 'shadowAngle') {
            // Only angle changed - update pointer and dx/dy calculations
            let angle = Number(value);
            if (!isFinite(angle)) angle = 90;
            const state = getState();
            const dist = Number(state.shadowDistance);
            const rad = (angle - 90) * (Math.PI / 180);
            let dx = Math.cos(rad) * dist * 10;
            let dy = Math.sin(rad) * dist * 10;
            if (!isFinite(dx)) dx = 0;
            if (!isFinite(dy)) dy = 0;
            
            if (DOM.dropShadowNode) {
                DOM.dropShadowNode.setAttribute('dx', dx);
                DOM.dropShadowNode.setAttribute('dy', dy);
            }
            if (DOM.shadowPointer) {
                DOM.shadowPointer.style.transform = `rotate(${angle}deg)`;
            }
        } else if (key === 'shadowDistance') {
            // Only distance changed - recalculate dx/dy with current angle
            let distance = Number(value);
            if (!isFinite(distance)) distance = 0;
            const state = getState();
            const angle = Number(state.shadowAngle);
            const rad = (angle - 90) * (Math.PI / 180);
            let dx = Math.cos(rad) * distance * 10;
            let dy = Math.sin(rad) * distance * 10;
            if (!isFinite(dx)) dx = 0;
            if (!isFinite(dy)) dy = 0;
            
            if (DOM.dropShadowNode) {
                DOM.dropShadowNode.setAttribute('dx', dx);
                DOM.dropShadowNode.setAttribute('dy', dy);
            }
        } else if (key === 'shadowBlur') {
            // Only blur changed - update stdDeviation only
            let blur = Number(value);
            if (!isFinite(blur)) blur = 0;
            
            if (DOM.dropShadowNode) {
                DOM.dropShadowNode.setAttribute('stdDeviation', blur * 10);
            }
        } else if (['shadowColor', 'shadowEnabled'].includes(key)) {
            // Color/enabled changed - run full transformation
            const state = getState();
            applyShadowTransformation(state);
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

        // Update "You're Listening To" based on source feed
        if (e.detail.sourceFeed && e.detail.sourceFeed.includes('.json')) {
            DOM.brandLabel.textContent = "YOU'RE LISTENING TO WIDK COMMERCIALS";
        } else {
            DOM.brandLabel.textContent = "YOU'RE LISTENING TO PODCUBE™";
        }

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

    // --- SHADOW KNOB, DISTANCE, BLUR LOGIC ---
    function initKnobLogic() {
        let isDragging = false;

        const updateFromMouse = (e) => {
            if (!isDragging) return;
            const rect = DOM.shadowKnob.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const coords = e.touches ? e.touches[0] : e;
            const angle = Math.atan2(coords.clientY - centerY, coords.clientX - centerX) * (180 / Math.PI);
            let finalAngle = Math.round(angle + 90);
            if (!isFinite(finalAngle)) finalAngle = 90;
            if (finalAngle < 0) finalAngle += 360;
            updateParam('shadowAngle', String(finalAngle));
            // Note: pointer update is handled by stateChange listener for consistency
        };

        DOM.shadowKnob.addEventListener('mousedown', (e) => {
            isDragging = true;
            e.preventDefault();
        });
        window.addEventListener('mouseup', () => isDragging = false);
        window.addEventListener('mousemove', updateFromMouse);

        // Touch support for OBS Interact mode
        DOM.shadowKnob.addEventListener('touchstart', (e) => {
            isDragging = true;
            e.preventDefault();
        }, { passive: false });
        window.addEventListener('touchend', () => isDragging = false);
        window.addEventListener('touchmove', updateFromMouse, { passive: false });
    }

    // Distance slider
    if (DOM.shadowDist) {
        DOM.shadowDist.addEventListener('input', (e) => {
            let val = Number(e.target.value);
            if (!isFinite(val)) val = 0;
            updateParam('shadowDistance', String(val));
        });
    }
    // Blur slider
    if (DOM.shadowBlur) {
        DOM.shadowBlur.addEventListener('input', (e) => {
            let val = Number(e.target.value);
            if (!isFinite(val)) val = 0;
            updateParam('shadowBlur', String(val));
        });
    }

    initKnobLogic();

    DOM.btnResetLayout.addEventListener('click', async () => {
        if(await showConfirmDialog("Reset Layout", "Reset all elements to their default positions?")) {

           // Clear State
            updateParam('posTitle', '');
            updateParam('posTimer', '');
            updateParam('posTrack', '');
            
            updateParam('scaleTitle', '1.0');
            updateParam('scaleTimer', '1.0');
            updateParam('scaleTrack', '1.0');

            // Reset rotations
            updateParam('rotTitle', '0');
            updateParam('rotTimer', '0');
            updateParam('rotTrack', '0');
            
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
    const isNSFW = (state.nsfw === 'true');

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

        await Audio.loadEpisodes(isNSFW);

        // --- RETRY LOGIC FOR LONG GAPS ---
        let playlist = [];
        let playlistDuration = 0;
        let delay = 0;
        let retries = 0;
        const MAX_RETRIES = 3;
        const GAP_THRESHOLD = 60; // Seconds (can exceed 60). Used to be 90

        do {
            playlist = Audio.generatePlaylist(durationSec, isNSFW);
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


// ---------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------


/**
 * Calculates where the elements currently are in their natural layout 
 * and applies those coordinates as percentages to "lock" them for dragging.
 */

function freezeCurrentPositions() {
    Object.entries(DOM.dragTargets).forEach(([key, element]) => {
        const rect = element.getBoundingClientRect();
        
        // Calculate center relative to viewport
        const centerX = rect.left + (rect.width / 2);
        const centerY = rect.top + (rect.height / 2);
        
        const xPct = (centerX / window.innerWidth) * 100;
        const yPct = (centerY / window.innerHeight) * 100;
        
        // Initialize dataset with defaults for consistent transforms
        if (!element.dataset.scale) element.dataset.scale = "1.0";
        if (!element.dataset.rot) element.dataset.rot = "0";

        // Apply immediately
        element.style.left = `${xPct.toFixed(2)}%`;
        element.style.top = `${yPct.toFixed(2)}%`;
        
        // Force the transform to exist immediately so there's no frame-jump
        element.style.transform = `translate(-50%, -50%) scale(${element.dataset.scale}) rotate(${element.dataset.rot}deg)`;
        
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

        // Disable contenteditable so the text cursor doesn't fight dragging!
        DOM.title.setAttribute('contenteditable', 'false');
        DOM.timerMin.setAttribute('contenteditable', 'false');
        DOM.timerSec.setAttribute('contenteditable', 'false');

        // Update Button State
        if (DOM.btnToggleLayout) {
            DOM.btnToggleLayout.textContent = "Done";
            DOM.btnToggleLayout.classList.add('active-state');
        }

    } else {
        // --- STATE: LOCKED ---
        document.body.classList.remove('layout-editing');
        
        if (DOM.startBtn && !DOM.timerContainer.classList.contains('running')) {
            DOM.startBtn.classList.remove('hidden');
        }

        // Re-enable contenteditable!
        DOM.title.setAttribute('contenteditable', 'true');
        DOM.timerMin.setAttribute('contenteditable', 'true');
        DOM.timerSec.setAttribute('contenteditable', 'true');

        // Update Button State
        if (DOM.btnToggleLayout) {
            DOM.btnToggleLayout.textContent = "Unlock";
            DOM.btnToggleLayout.classList.remove('active-state');
        }
    }
}

// Updated to accept scale and rotation during initial load
function applyPos(element, posString, scaleString = "1.0", rotString = "0") {
    const [x, y] = posString.split(',');
    if (x && y) {
        element.style.left = `${x}%`;
        element.style.top = `${y}%`;
        
        // Apply transform, keeping the translation intact
        element.style.transform = `translate(-50%, -50%) scale(${scaleString}) rotate(${rotString}deg)`;
        
        // Store current values on the element for the math to read later
        element.dataset.scale = scaleString; 
        element.dataset.rot = rotString;

        // Scale the handles by the inverse so they stay the same size visually
        const inverseScale = 1 / parseFloat(scaleString);
        const handles = element.querySelectorAll('.edit-handle');
        handles.forEach(h => {
            h.style.transform = `scale(${inverseScale})`;
        });
    }
}

function makeElementDraggable(element, paramKey) {
    
    // INJECT HANDLES without destroying the inner DOM nodes!
    const scaleHandle = document.createElement('div');
    scaleHandle.className = 'edit-handle handle-scale';
    scaleHandle.title = "Drag to Scale";
    scaleHandle.setAttribute('contenteditable', 'false');

    const rotHandle = document.createElement('div');
    rotHandle.className = 'edit-handle handle-rotate';
    rotHandle.title = "Drag to Rotate";
    rotHandle.setAttribute('contenteditable', 'false');

    element.appendChild(scaleHandle);
    element.appendChild(rotHandle);

    // IMMEDIATELY INVERSE SCALE ON CREATION
    // Read the scale that was applied by applySettings, and invert it
    const currentScale = parseFloat(element.dataset.scale) || 1.0;
    const inverseScale = 1 / currentScale;
    scaleHandle.style.transform = `scale(${inverseScale})`;
    rotHandle.style.transform = `scale(${inverseScale})`;

    // store handles to restore them if they get removed during innerHTML updates
    element._editHandles = [scaleHandle, rotHandle];

    // STATE VARIABLES
    let isDragging = false;
    let isScaling = false;
    let isRotating = false;
    let startDistance, startScale;
    let startAngle, startRot;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    
    const getCoords = (e) => {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    };

    // --- MAIN DRAG LOGIC ---
    const onStartDrag = (e) => {
        if (!document.body.classList.contains('layout-editing')) return;
        // Ignore if we clicked a handle
        if (e.target.classList.contains('edit-handle')) return; 
        
        isDragging = true;
        element.style.cursor = 'grabbing';
        
        if (e.type === 'touchstart') document.body.style.overflow = 'hidden';
        if (e.cancelable) e.preventDefault();
        element.style.zIndex = 1000;

        // CALCULATE CLICK OFFSET
        const coords = getCoords(e);
        const rect = element.getBoundingClientRect();
        
        // Find the absolute pixel center of the element on the screen
        const centerX = rect.left + (rect.width / 2);
        const centerY = rect.top + (rect.height / 2);
        
        // Save the distance between the center and the mouse pointer
        dragOffsetX = coords.x - centerX;
        dragOffsetY = coords.y - centerY;
    };

    const onMoveDrag = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const coords = getCoords(e);

        // Subtract the offset so we drag the center, but relative to where we clicked
        const targetX = coords.x - dragOffsetX;
        const targetY = coords.y - dragOffsetY;

        const xPct = (targetX / window.innerWidth) * 100;
        const yPct = (targetY / window.innerHeight) * 100;
        
        element.style.left = `${xPct}%`;
        element.style.top = `${yPct}%`;
    };

    const onEndDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        element.style.cursor = 'grab';
        element.style.zIndex = '';
        document.body.style.overflow = '';

        const x = parseFloat(element.style.left).toFixed(2);
        const y = parseFloat(element.style.top).toFixed(2);
        const stateKey = `pos${paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}`;
        updateParam(stateKey, `${x},${y}`);
    };

    // --- SCALE LOGIC ---
    const onScaleStart = (e) => {
        if (!document.body.classList.contains('layout-editing')) return;
        e.stopPropagation(); // Prevent triggering main drag
        isScaling = true;
        if (e.cancelable) e.preventDefault();
        startScale = parseFloat(element.dataset.scale) || 1.0;
        
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const coords = getCoords(e);
        
        // Calculate initial distance from center to mouse/finger
        startDistance = Math.hypot(coords.x - centerX, coords.y - centerY);
        document.body.style.cursor = 'nwse-resize';
        
        if (e.type === 'touchstart') {
            document.body.style.overflow = 'hidden'; // Prevent page scrolling
        }
    };

    scaleHandle.addEventListener('mousedown', onScaleStart);
    scaleHandle.addEventListener('touchstart', onScaleStart, { passive: false });

    const onScaleMove = (e) => {
        if (!isScaling) return;
        e.preventDefault();
        
        const centerX = window.innerWidth * (parseFloat(element.style.left) / 100);
        const centerY = window.innerHeight * (parseFloat(element.style.top) / 100);
        
        const coords = getCoords(e);
        const currentDistance = Math.hypot(coords.x - centerX, coords.y - centerY);
        
        let newScale = startScale * (currentDistance / startDistance);
        newScale = Math.max(0.1, Math.min(newScale, 5.0)); // Clamp
        
        const rot = element.dataset.rot || "0";
        element.style.transform = `translate(-50%, -50%) scale(${newScale}) rotate(${rot}deg)`;
        element.dataset.scale = newScale;

        const inverseScale = 1 / newScale;
        scaleHandle.style.transform = `scale(${inverseScale})`;
        rotHandle.style.transform = `scale(${inverseScale})`;
    };

    const onScaleEnd = () => {
        if (!isScaling) return;
        isScaling = false;
        document.body.style.cursor = '';
        document.body.style.overflow = '';
        const stateKey = `scale${paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}`;
        updateParam(stateKey, parseFloat(element.dataset.scale).toFixed(2));
    };

    window.addEventListener('mousemove', onScaleMove);
    window.addEventListener('touchmove', onScaleMove, { passive: false });
    window.addEventListener('mouseup', onScaleEnd);
    window.addEventListener('touchend', onScaleEnd);

    // --- ROTATE LOGIC ---
    const onRotateStart = (e) => {
        if (!document.body.classList.contains('layout-editing')) return;
        e.stopPropagation();
        isRotating = true;
        if (e.cancelable) e.preventDefault();
        startRot = parseFloat(element.dataset.rot) || 0;
        
        const centerX = window.innerWidth * (parseFloat(element.style.left) / 100);
        const centerY = window.innerHeight * (parseFloat(element.style.top) / 100);
        
        const coords = getCoords(e);
        
        // Calculate starting angle using atan2
        startAngle = Math.atan2(coords.y - centerY, coords.x - centerX) * (180 / Math.PI);
        document.body.style.cursor = 'grabbing';
        
        if (e.type === 'touchstart') {
            document.body.style.overflow = 'hidden'; // Prevent page scrolling
        }
    };

    rotHandle.addEventListener('mousedown', onRotateStart);
    rotHandle.addEventListener('touchstart', onRotateStart, { passive: false });

    const onRotateMove = (e) => {
        if (!isRotating) return;
        e.preventDefault();
        
        const centerX = window.innerWidth * (parseFloat(element.style.left) / 100);
        const centerY = window.innerHeight * (parseFloat(element.style.top) / 100);
        
        const coords = getCoords(e);
        const currentAngle = Math.atan2(coords.y - centerY, coords.x - centerX) * (180 / Math.PI);
        
        let newRot = startRot + (currentAngle - startAngle);
        
        const scale = element.dataset.scale || "1.0";
        element.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${newRot}deg)`;
        element.dataset.rot = newRot;
    };

    const onRotateEnd = () => {
        if (!isRotating) return;
        isRotating = false;
        document.body.style.cursor = '';
        document.body.style.overflow = '';
        const stateKey = `rot${paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}`;
        updateParam(stateKey, Math.round(parseFloat(element.dataset.rot)));
    };

    window.addEventListener('mousemove', onRotateMove);
    window.addEventListener('touchmove', onRotateMove, { passive: false });
    window.addEventListener('mouseup', onRotateEnd);
    window.addEventListener('touchend', onRotateEnd);

    // --- MAIN DRAG LISTENERS ---
    element.addEventListener('mousedown', onStartDrag);
    window.addEventListener('mousemove', onMoveDrag);
    window.addEventListener('mouseup', onEndDrag);
    element.addEventListener('touchstart', onStartDrag, { passive: false });
    window.addEventListener('touchmove', onMoveDrag, { passive: false });
    window.addEventListener('touchend', onEndDrag);
}

function applyShadowTransformation(state) {
    let angle = Number(state.shadowAngle);
    let dist = Number(state.shadowDistance);
    let blur = Number(state.shadowBlur);
    const shadowOn = (state.shadowEnabled === 'true');
    const sColor = shadowOn ? state.shadowColor : 'transparent';
    const sOpacity = shadowOn ? '1' : '0';

    if (!isFinite(angle)) angle = 90;
    if (!isFinite(dist)) dist = 0;
    if (!isFinite(blur)) blur = 0;

    // Convert Polar to Cartesian
    const rad = (angle - 90) * (Math.PI / 180);
    let dx = Math.cos(rad) * dist * 10;
    let dy = Math.sin(rad) * dist * 10;
    if (!isFinite(dx)) dx = 0;
    if (!isFinite(dy)) dy = 0;

    if (DOM.dropShadowNode) {
        DOM.dropShadowNode.setAttribute('dx', dx);
        DOM.dropShadowNode.setAttribute('dy', dy);
        DOM.dropShadowNode.setAttribute('stdDeviation', blur * 10);
        DOM.dropShadowNode.setAttribute('flood-color', sColor);
        DOM.dropShadowNode.setAttribute('flood-opacity', sOpacity);
    }

    if (DOM.shadowPointer) {
        DOM.shadowPointer.style.transform = `rotate(${angle}deg)`;
    }
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