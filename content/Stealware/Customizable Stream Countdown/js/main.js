import { getState } from './state.js';
import * as UI from './ui.js'; 

function init() {
    // 1. Initial Render (Visuals)
    const initialState = getState();
    UI.applySettings(initialState);
    UI.initEventListeners();

    // 2. Check for Autoplay (OBS Mode)
    const params = new URLSearchParams(window.location.search);
    const isAutoplay = params.has('autoplay') && params.get('autoplay') === '1';

    if (isAutoplay) {
        // OBS Mode: Start immediately
        console.log("Autoplay detected. Starting experience...");
        UI.startExperience(initialState);
    } else {
        // Desktop Mode: Attach Listener to the static button
        const startBtn = document.getElementById('main-start-btn');
        
        startBtn.addEventListener('click', () => {
            // Fetch FRESH state (in case user changed minutes/audio settings)
            const currentState = getState(); 
            UI.startExperience(currentState);
        });
    }
}

init();