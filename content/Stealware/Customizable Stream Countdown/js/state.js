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

    layoutMode: "auto",
    presetName: ""  // Name of the currently loaded preset (if any)
};

/**
 * Returns the current state object derived from URL params + Defaults
 * Always reads from the most recent state (either pending or applied)
 * @returns {Object}
 */
let pendingUrl = null;

export function getState() {
    // Use pendingUrl if available (has pending changes), otherwise read from actual URL
    const urlSource = pendingUrl || window.location;
    const params = new URLSearchParams(urlSource.search);
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

export function updateParam(key, value) {
    const url = new URL(window.location);
    url.searchParams.set(key, value);

    
    pendingUrl = url;
    window.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        window.history.replaceState({}, '', url);
    }, 250);
}

/**
 * Removes the presetName parameter from the URL
 * Called when user makes manual changes to settings
 */
export function clearPresetName() {
    const url = new URL(window.location);
    if (url.searchParams.has('presetName')) {
        url.searchParams.delete('presetName');
        pendingUrl = url;
        window.history.replaceState({}, '', url);
    }
}

/**
 * Generates the full URL for copying to clipboard, forcing autoplay param
 */
export function getShareableURL() {
    const url = new URL(window.location.href);
    return url.toString();
}