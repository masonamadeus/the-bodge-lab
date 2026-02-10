/**
 * Global Configuration
 * Central place for URLs and constants.
 */
export const CONFIG = {
    // Array of RSS Feed URLs.
    // The app will aggregate audio from all sources into one pool.
    RSS_FEEDS: [
        'https://pinecast.com/feed/pc',
        // Example Future Expansion:
        // 'https://mysite.com/fake-commercials/rss.xml',
    ],

    // Audio Logic Settings
    FADE_TIME: 0,         // Seconds to fade out audio when timer ends
    BUFFER_SECONDS: 0,   // Safety buffer: Don't pick a track if it ends <10s before timer
    TRACK_GAP_SECONDS: 0, // Seconds of silence between tracks (to prevent abrupt cuts)
};