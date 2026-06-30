/* js/main.js */
import { getState } from './state.js';
import * as UI from './ui.js'; 
import * as Audio from './audio.js';

let hasStarted = false;

async function init() {
    // Initial Render (Visuals)
    const initialState = getState();
    UI.applySettings(initialState);
    UI.initEventListeners();
    
    // Load Branding (PodCube Logo)
    await UI.loadBranding();

    // Check Autoplay Mode
    const autoplayMode = initialState.autoplay;
    const isOBS = !!window.obsstudio;

    // SCENARIO 1: Autoplay On Load
    // (Only triggers if we are actually in OBS, to prevent annoying desktop users)
    if (autoplayMode === 'onload' && isOBS) {
        console.log("[Main] Autoplay On Load detected. Warming up audio...");
        setTimeout(() => {
            triggerStart();
        }, 1000);
    } 
    // SCENARIO 2: Autoplay On Stream Start
    // (We listen for the OBS event)
    else if (autoplayMode === 'onstream' && isOBS) {
        console.log("[Main] Waiting for OBS Stream Start event...");
        
        // This is the magical OBS event listener!
        window.addEventListener('obsStreamingStarted', () => {
            console.log("[Main] OBS Stream Started! Launching countdown.");
            triggerStart();
        });

        // Also allow manual start just in case they change their mind
        setupManualStart();
    } 
    // SCENARIO 3: Manual Start (or not in OBS)
    else {
        setupManualStart();
    }
}

// Helper to fire the start sequence safely
// Helper to fire the start sequence safely
function triggerStart() {
    // Check if the timer container already has the 'running' class
    const timerContainer = document.getElementById('timer-container');
    if (timerContainer && timerContainer.classList.contains('running')) {
        return; // Prevent double-firing
    }
    
    // Unlock audio context and fetch fresh state
    Audio.unlockAudio();
    const currentState = getState(); 
    UI.startExperience(currentState);
}

// Helper to attach the click listener to the big start button
function setupManualStart() {
    const startBtn = document.getElementById('main-start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            triggerStart();
        });
    }
}

// Start the app
init();

// Expose debug function globally
window.debugExportEpisodes = Audio.debugExportEpisodes;