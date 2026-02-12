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

    btnUpdate: document.getElementById('btn-preset-update'),
    presetStatus: document.getElementById('preset-modified-status'),
    presetSelect: document.getElementById('preset-select'),
    btnLoad: document.getElementById('btn-preset-load'),
    btnSave: document.getElementById('btn-preset-save'),
    btnRename: document.getElementById('btn-preset-rename'),
    btnDelete: document.getElementById('btn-preset-delete'),
    
    // The draggable targets
    dragTargets: {
        title: document.getElementById('stream-title'),
        timer: document.getElementById('timer-container'),
        track: document.getElementById('now-playing')
    }
};

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

/**
 * Shows a custom prompt dialog with keyboard support
 * @returns {Promise<string|null>} - The text entered, or null if cancelled
 */
function showPromptDialog(title, message, defaultValue = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('prompt-modal');
        const titleEl = document.getElementById('prompt-title');
        const messageEl = document.getElementById('prompt-message');
        const inputEl = document.getElementById('prompt-input');
        const okBtn = document.getElementById('prompt-ok');
        const cancelBtn = document.getElementById('prompt-cancel');

        titleEl.textContent = title;
        messageEl.textContent = message;
        inputEl.value = defaultValue;

        const cleanup = () => {
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKeyDown);
            modal.classList.add('hidden');
        };

        const onOk = () => {
            const val = inputEl.value;
            cleanup();
            resolve(val);
        };

        const onCancel = () => {
            cleanup();
            resolve(null);
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
        
        // Focus the input box and select the text automatically
        setTimeout(() => {
            inputEl.focus();
            inputEl.select();
        }, 0);
    });
}


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

    // Sync UI controls to state (robust)
    if (DOM.shadowDist) DOM.shadowDist.value = String(Number(state.shadowDistance) || 0);
    if (DOM.shadowBlur) DOM.shadowBlur.value = String(Number(state.shadowBlur) || 0);
    if (DOM.shadowKnob && DOM.shadowPointer) {
        let angle = Number(state.shadowAngle);
        if (!isFinite(angle)) angle = 90;
        DOM.shadowPointer.style.transform = `rotate(${angle}deg)`;
    }

    // Apply CSS drop-shadow to all elements
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
            // Updated title and message to be clearer about what is resetting
            if (await showConfirmDialog("Reset Current Layout", "Are you sure? This will reset the active layout, colors, and text to default. (Any saved presets will NOT be affected).")) {
                // Wipe the URL parameters
                const cleanURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({}, document.title, cleanURL);
                
                // Reload the page to load defaults
                window.location.reload();
            }
        });
    }


    DOM.title.addEventListener('blur', () => {
        const cleanTitle = validateInput('title', DOM.title.innerText);
        DOM.title.innerText = cleanTitle;
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
            
            // --- Block non-numbers for the timer fields ---
            if (el === DOM.timerMin || el === DOM.timerSec) {
                // Allow control keys (Backspace, Tab, Arrows, etc) or Ctrl/Cmd shortcuts
                const isControlKey = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key);
                const isShortcut = e.ctrlKey || e.metaKey;
                
                // If it's a single typed character, not a number, and not a control key... block it!
                if (e.key.length === 1 && /\D/.test(e.key) && !isControlKey && !isShortcut) {
                    e.preventDefault();
                }
            }

            // --- EXISTING ENTER KEY LOGIC ---
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
        
        // Handle shadow changes - update CSS drop-shadow on all elements
        if (key === 'shadowAngle') {
            let angle = Number(value);
            if (!isFinite(angle)) angle = 90;
            const state = getState();
            
            // Update knob pointer
            if (DOM.shadowPointer) {
                DOM.shadowPointer.style.transform = `rotate(${angle}deg)`;
            }
            
            // Update CSS shadows on all draggable elements
            Object.values(DOM.dragTargets).forEach(el => {
                applyCSSDropShadow(
                    el, 
                    angle, 
                    Number(state.shadowDistance) || 0, 
                    Number(state.shadowBlur) || 0, 
                    state.shadowColor, 
                    state.shadowEnabled
                );
            });
        } else if (key === 'shadowDistance') {
            let distance = Number(value);
            if (!isFinite(distance)) distance = 0;
            const state = getState();
            
            // Update CSS shadows on all draggable elements
            Object.values(DOM.dragTargets).forEach(el => {
                applyCSSDropShadow(
                    el, 
                    Number(state.shadowAngle) || 90, 
                    distance, 
                    Number(state.shadowBlur) || 0, 
                    state.shadowColor, 
                    state.shadowEnabled
                );
            });
        } else if (key === 'shadowBlur') {
            let blur = Number(value);
            if (!isFinite(blur)) blur = 0;
            const state = getState();
            
            // Update CSS shadows on all draggable elements
            Object.values(DOM.dragTargets).forEach(el => {
                applyCSSDropShadow(
                    el, 
                    Number(state.shadowAngle) || 90, 
                    Number(state.shadowDistance) || 0, 
                    blur, 
                    state.shadowColor, 
                    state.shadowEnabled
                );
            });
        } else if (['shadowColor', 'shadowEnabled'].includes(key)) {
            // Color/enabled changed - update all shadows
            const state = getState();
            applyShadowTransformation(state);
            
            // Update container visibility when shadowEnabled changes
            if (key === 'shadowEnabled' && DOM.shadowContainer) {
                if (state.shadowEnabled === 'true') {
                    DOM.shadowContainer.classList.remove('vanish');
                } else {
                    DOM.shadowContainer.classList.add('vanish');
                }
            }
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

        // AUTO-RESET AFTER 5 MINUTES (300,000 milliseconds)
        setTimeout(() => {
            // Programmatically click the hidden Stop button to run its exact reset logic!
            DOM.stopBtn.click();
            
        }, 5 * 60 * 1000);

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
    initPresets();
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

        // CONTINGENCY IF WE CANNOT GENERATE A PLAYLIST
        if (playlist.length === 0) {
            console.warn("[UI] Playlist generation failed.");
            
            // Update UI to inform the user
            DOM.trackName.textContent = "Timer too short for PodCube™ Audio";
            DOM.brandLabel.textContent = "Audio Unavailable";
            
            // Ensure progress bar is hidden/reset
            DOM.progressBar.style.width = '0%';
            
            // Exit function so we don't try to sync or play nothing
            return; 
        }

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
 * Applies drop shadow using CSS filter instead of SVG
 * Compensates for element rotation to keep shadow angle consistent
 */
function applyCSSDropShadow(element, shadowAngle, shadowDistance, shadowBlur, shadowColor, shadowEnabled) {
    if (shadowEnabled !== 'true') {
        element.style.filter = 'none';
        return;
    }
    
    // Get current element rotation
    const elementRotation = parseFloat(element.dataset.rot) || 0;
    
    // Compensate for element rotation to keep shadow direction consistent
    const compensatedAngle = shadowAngle - elementRotation;
    
    // Convert to radians and calculate offset
    const rad = (compensatedAngle - 90) * (Math.PI / 180);
    const dx = Math.cos(rad) * shadowDistance * 10;
    const dy = Math.sin(rad) * shadowDistance * 10;
    
    // Apply CSS drop-shadow filter
    element.style.filter = `drop-shadow(${dx}px ${dy}px ${shadowBlur * 10}px ${shadowColor})`;
}


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
        
        // Apply CSS drop-shadow with rotation compensation for Safari compatibility
        const state = getState();
        applyCSSDropShadow(
            element,
            Number(state.shadowAngle) || 90,
            Number(state.shadowDistance) || 0,
            Number(state.shadowBlur) || 0,
            state.shadowColor || '#000000',
            state.shadowEnabled
        );
        
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
        
        // Apply CSS drop-shadow with rotation compensation for Safari compatibility
        const state = getState();
        applyCSSDropShadow(
            element,
            Number(state.shadowAngle) || 90,
            Number(state.shadowDistance) || 0,
            Number(state.shadowBlur) || 0,
            state.shadowColor || '#000000',
            state.shadowEnabled
        );

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
        
        // Live-update CSS shadow during rotation for smooth feedback
        const state = getState();
        applyCSSDropShadow(
            element,
            Number(state.shadowAngle) || 90,
            Number(state.shadowDistance) || 0,
            Number(state.shadowBlur) || 0,
            state.shadowColor || '#000000',
            state.shadowEnabled
        );
    };

    const onRotateEnd = () => {
        if (!isRotating) return;
        isRotating = false;
        document.body.style.cursor = '';
        document.body.style.overflow = '';
        const stateKey = `rot${paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}`;
        updateParam(stateKey, Math.round(parseFloat(element.dataset.rot)));
        
        // Reapply CSS shadow with new rotation compensation
        const state = getState();
        applyCSSDropShadow(
            element,
            Number(state.shadowAngle) || 90,
            Number(state.shadowDistance) || 0,
            Number(state.shadowBlur) || 0,
            state.shadowColor || '#000000',
            state.shadowEnabled
        );
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
    const sColor = state.shadowColor || '#000000';

    if (!isFinite(angle)) angle = 90;
    if (!isFinite(dist)) dist = 0;
    if (!isFinite(blur)) blur = 0;

    // Update the knob pointer visual
    if (DOM.shadowPointer) {
        DOM.shadowPointer.style.transform = `rotate(${angle}deg)`;
    }
    
    // Apply CSS drop-shadow to all draggable target elements
    Object.values(DOM.dragTargets).forEach(el => {
        applyCSSDropShadow(el, angle, dist, blur, sColor, state.shadowEnabled);
    });
}

function isPresetModified(presetName) {
    const presets = JSON.parse(localStorage.getItem('countdown_presets')) || {};
    const savedState = presets[presetName];
    if (!savedState) return false;

    const currentState = getState();
    const keysToCompare = Object.keys(currentState).filter(k => k !== 'presetName');
    
    for (const key of keysToCompare) {
        // Coerce both to strings for safe comparison (e.g., 1 vs "1")
        const savedVal = savedState[key] !== undefined ? String(savedState[key]) : "";
        const currentVal = currentState[key] !== undefined ? String(currentState[key]) : "";
        
        if (savedVal !== currentVal) {
            return true;
        }
    }
    return false;
}

function updatePresetUI() {
    const dropdownValue = DOM.presetSelect.value;
    const activePresetInUrl = getState().presetName;
    
    // Reset base states to avoid lingering classes
    DOM.presetStatus.classList.add('hidden');
    DOM.btnUpdate.classList.add('hidden');
    DOM.settingsTrigger.classList.remove('preset-modified');
    DOM.btnLoad.classList.remove('primary-btn');
    DOM.btnLoad.classList.add('secondary-btn');

    // STATE 1: Nothing Selected
    if (!dropdownValue) {
        return; 
    }

    // STATE 2: Dropdown does NOT match the active loaded preset
    if (dropdownValue !== activePresetInUrl) {
        // Highlight the Load button to say "Hey, click me to load this!"
        DOM.btnLoad.classList.remove('secondary-btn');
        DOM.btnLoad.classList.add('primary-btn');

        // Show the update button, but make it clear this is an OVERWRITE
        DOM.btnUpdate.classList.remove('hidden');
        DOM.btnUpdate.textContent = "Overwrite Preset";
        
        // We DO NOT show the "Modified" dot because they aren't modifying 
        // the selected preset, they just haven't loaded it yet.
        return;
    }

    // STATE 3: Dropdown matches the active loaded preset
    if (isPresetModified(dropdownValue)) {
        // The user is actively tweaking the loaded preset
        DOM.presetStatus.classList.remove('hidden');
        DOM.btnUpdate.classList.remove('hidden');
        DOM.btnUpdate.textContent = "Save Changes"; // Clear context
        DOM.settingsTrigger.classList.add('preset-modified');
    }
}

function initPresets() {
    const PRESETS_KEY = 'countdown_presets';
    if (!DOM.presetSelect) return;

    function getPresets() {
        try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || {}; } 
        catch { return {}; }
    }

    function savePresets(presets) {
        localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
        renderDropdown();
    }

    function renderDropdown() {
        const presets = getPresets();
        const currentVal = DOM.presetSelect.value;
        DOM.presetSelect.innerHTML = '<option value="">== No Preset ==</option>';
        
        for (const name in presets) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            DOM.presetSelect.appendChild(opt);
        }
        if (presets[currentVal]) DOM.presetSelect.value = currentVal;
    }

    // Initial Render & Import Logic
    renderDropdown();
    const currentState = getState();
    const activePresetInUrl = currentState.presetName;

    if (activePresetInUrl) {
        const presets = getPresets();
        // Silent import if missing
        if (!presets[activePresetInUrl]) {
            presets[activePresetInUrl] = currentState;
            savePresets(presets);
        }
        DOM.presetSelect.value = activePresetInUrl;
    }

    // Set Initial Status
    updatePresetUI();

    // EVENT LISTENERS

    // SAVE AS PRESET
    DOM.btnSave.addEventListener('click', async () => {
        const name = await showPromptDialog("Save Preset", "Enter a name for this layout:");
        if (!name || name.trim() === "") return;
        const trimmedName = name.trim();

        const presets = getPresets();
        if (presets[trimmedName]) {
            const confirmed = await showConfirmDialog("Overwrite Preset?", `Replace "${trimmedName}"?`);
            if (!confirmed) return;
        }

        presets[trimmedName] = getState();
        savePresets(presets);
        
        DOM.presetSelect.value = trimmedName;
        updateParam('presetName', trimmedName);
        updatePresetUI(); // Sync UI
    });

    // LOAD PRESET
    DOM.btnLoad.addEventListener('click', () => {
        const name = DOM.presetSelect.value;
        if (!name) return;
        
        const presets = getPresets();
        if (presets[name]) {
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(presets[name])) {
                params.set(k, v);
            }
            params.set('presetName', name);
            window.location.search = params.toString(); 
        }
    });

    // RENAME PRESET
    DOM.btnRename.addEventListener('click', async () => {
        const name = DOM.presetSelect.value;
        if (!name) return;
        
        const newName = await showPromptDialog("Rename Preset", `Rename "${name}" to:`, name);
        if (!newName || newName.trim() === "" || newName === name) return;
        
        const presets = getPresets();
        presets[newName.trim()] = presets[name];
        delete presets[name];
        savePresets(presets);
        
        DOM.presetSelect.value = newName.trim();
        if (getState().presetName === name) {
            updateParam('presetName', newName.trim());
        }
    });

    // DELETE PRESET
    DOM.btnDelete.addEventListener('click', async () => {
        const name = DOM.presetSelect.value;
        if (!name) return alert("Please select a preset to delete.");
        
        if (await showConfirmDialog("Delete Preset", `Delete the preset "${name}"?`)) {
            const presets = getPresets();
            delete presets[name];
            savePresets(presets);
            
            DOM.presetSelect.value = '';
            if (getState().presetName === name) {
                updateParam('presetName', '');
            }
            updatePresetUI();
        }
    });
    
    // SAVE CHANGES / OVERWRITE BUTTON
    DOM.btnUpdate.addEventListener('click', async () => {
        const name = DOM.presetSelect.value;
        if (!name) return;

        const currentState = getState();
        const activePresetInUrl = currentState.presetName;

        // If this is an Overwrite (names don't match)
        if (name !== activePresetInUrl) {
            const confirmed = await showConfirmDialog(
                "Overwrite Preset?", 
                `You are about to overwrite the saved settings for "${name}" with your current layout. Are you sure?`
            );
            if (!confirmed) return; // Stop if they click Cancel
        }

        const presets = getPresets();
        presets[name] = getState(); // Capture current state
        savePresets(presets);
        
        // Lock the URL to the newly saved preset name
        updateParam('presetName', name);
        updatePresetUI(); 
        
        // Provide visual feedback
        const originalText = DOM.btnUpdate.textContent;
        DOM.btnUpdate.textContent = "Saved!";
        setTimeout(() => {
            // Re-run the UI check after the timeout to restore the correct button text
            updatePresetUI(); 
        }, 1500);
    });


    //  WATCH FOR CHANGES
    window.addEventListener('stateChange', (e) => {
        if (e.detail.key === 'presetName') return;
        updatePresetUI();
    });

    // MANUAL DROPDOWN UPDATES
    DOM.presetSelect.addEventListener('change', () => {
        const selectedValue = DOM.presetSelect.value;
        
        if (selectedValue === "") {
            // User explicitly chose "no preset".
            // Detach the current settings from the preset by clearing the URL param.
            updateParam('presetName', '');
        }
        
        updatePresetUI();
    });
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