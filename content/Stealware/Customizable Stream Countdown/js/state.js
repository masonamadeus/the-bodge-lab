/**
 * State Management Module
 * The URL is the Source of Truth.
 */

const DEFAULTS = {
    title: "Stream Starting Soon",
    minutes: 5,
    font: "Roboto",
    colorText: "#ffffff",
    colorBg: "#000000",
    audioEnabled: "false",
    volume: 0.5
};

/**
 * Returns the current state object derived from URL params + Defaults
 * @returns {Object}
 */
export function getState() {
    const params = new URLSearchParams(window.location.search);
    const state = {};

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
 * Updates a single parameter in the URL without reloading page
 */
export function updateParam(key, value) {
    const url = new URL(window.location);
    url.searchParams.set(key, value);
    window.history.pushState({}, '', url);
    
    // Dispatch event so other modules know state changed
    window.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
}

/**
 * Generates the full URL for copying to clipboard, forcing autoplay param
 */
export function getShareableURL() {
    const url = new URL(window.location.href);
    url.searchParams.set('autoplay', '1'); // Ensure OBS knows to start automatically
    return url.toString();
}