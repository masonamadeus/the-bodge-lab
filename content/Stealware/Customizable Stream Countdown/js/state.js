/**
 * State Management Module
 * The URL is the Source of Truth.
 */

const DEFAULTS = {
    title: "Click to Edit",
    minutes: 15,
    seconds: 0,
    font: "Roboto",
    colorText: "#ffffff",
    colorBg: "#676767",
    bgTransparent: "false",
    audioEnabled: "true",
    volume: "0.8",
    autoplay: "onstream",
    nsfw: "false",

    shadowEnabled: "true",
    shadowColor: "#000000",
    shadowAngle: "130",      // Angle in degrees (as string for URL param consistency)
    shadowDistance: "0.2",  // Distance from text (as string for URL param consistency)
    shadowBlur: "0.3",      // Blur radius (as string for URL param consistency)

    posTitle: "",      
    posTimer: "",
    posTrack: "",
    
    // Default scales (1.0 = 100%)
    scaleTitle: "1.0",
    scaleTimer: "1.0",
    scaleTrack: "1.0",

    // Default rotations (degrees)
    rotTitle: "0",
    rotTimer: "0",
    rotTrack: "0",

    layoutMode: "auto"
};

/**
 * Returns the current state object derived from URL params + Defaults
 * @returns {Object}
 */
export function getState() {
    const params = new URLSearchParams(window.location.search);
    const state = {};

    // Iterate over DEFAULTS keys to determine what to fetch
    for (const [key, defaultVal] of Object.entries(DEFAULTS)) {
        if (params.has(key)) {
            state[key] = params.get(key);
        } else {
            state[key] = defaultVal;
        }
    }
    return state;
}

/**
 * Updates a single parameter in the URL without reloading page.
 * The stateChange event fires immediately for snappy UI updates.
 * The URL history is debounced to prevent spamming the address bar.
 */
let debounceTimer = null;
let pendingUrl = null;

export function updateParam(key, value) {
    // 1. Update the pending URL object immediately so getState() is always accurate
    const url = new URL(window.location);
    url.searchParams.set(key, value);
    pendingUrl = url;

    // 2. Fire stateChange event IMMEDIATELY for snappy UI response
    window.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));

    // 3. Clear the timer to reset the debounce window
    if (debounceTimer) clearTimeout(debounceTimer);

    // 4. Debounce only the browser history update (to stop spamming the address bar)
    // Use a closure to capture the current URL, preventing stale data
    const urlToApply = url;
    debounceTimer = setTimeout(() => {
        window.history.replaceState({}, '', urlToApply);
    }, 250);
}

/**
 * Generates the full URL for copying to clipboard, forcing autoplay param
 */
export function getShareableURL() {
    const url = new URL(window.location.href);
    return url.toString();
}