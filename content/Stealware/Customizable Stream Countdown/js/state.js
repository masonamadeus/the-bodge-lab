/**
 * State Management Module
 * The URL is the Source of Truth.
 */

const DEFAULTS = {
    title: "Click to Edit",
    minutes: 5,
    seconds: 0, // <--- CRITICAL FIX: This was missing!
    font: "Roboto",
    colorText: "#ffffff",
    colorBg: "#000000",
    bgTransparent: "false",
    audioEnabled: "true",
    volume: 0.8,
    autoplay:"true",

    shadowEnabled: "true",
    shadowColor: "#000000",
    shadowX: 0.2,    // Horizontal offset (vmin)
    shadowY: 0.2,    // Vertical offset (vmin)
    shadowBlur: 0.4,  // Blur radius (vmin)

    posTitle: "",      
    posTimer: "",
    posTrack: "",
    layoutMode: "auto" // 'auto' (flex) or 'custom' (absolute)
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
    return url.toString();
}