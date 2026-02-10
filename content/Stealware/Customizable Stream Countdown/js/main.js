/* js/main.js */
import { getState } from './state.js';
import * as UI from './ui.js'; 
import * as Audio from './audio.js';

async function init() {
    // Initial Render (Visuals)
    const initialState = getState();
    UI.applySettings(initialState);
    UI.initEventListeners();
    
    // Load Branding (PodCube Logo)
    await UI.loadBranding();

    // Autoplay Determination
    const params = new URLSearchParams(window.location.search);
    const isAutoplay = (initialState.autoplay === 'true') && !!window.obsstudio;

    if (isAutoplay) {
        // OBS/Autoplay Mode
        console.log("[Main] Autoplay detected. Warming up audio...");
        
        /**
         * Wait 1 second to ensure OBS Browser Source 
         * has initialized its internal audio context.
         */
        setTimeout(() => {
            UI.startExperience(initialState);
        }, 1000);

    } else {
        // Desktop Mode: Manual Start
        const startBtn = document.getElementById('main-start-btn');
        
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                // Fetch FRESH state in case the user edited the 
                // timer minutes while the modal was open.
                Audio.unlockAudio();
                const currentState = getState(); 
                UI.startExperience(currentState);
            });
        }
    }
}

// Start the app
init();