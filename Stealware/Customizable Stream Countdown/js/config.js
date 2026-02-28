export const CONFIG = {
    // Array of Feed Objects
    FEEDS: [
        { 
            url: 'https://pinecast.com/feed/pc', 
            type: 'podcube', 
            isNSFW: false 
        },
        { 
            url: 'https://bodgelab.com/widkads.json', 
            type: 'json', 
            isNSFW: true 
        }
    ],

    // Add strings here to match against track titles or URLs.
    // E.g., if the track is called "Episode 42: The 54 Second One"
    BLACKLIST: [
        "https://op3.dev/e/pinecast.com/listen/dbd4765e-66dd-4e70-b69a-d559ba4dc136.mp3?source=rss&ext=asset.mp3", // 🅿 04.01.2050_STOVE'S_DESK⚠️UNINTENTIONAL_TRANSMISSION⚠️
        "🔸😃🔸 Hello and Welcome to 🅿️odCube™ 🔸😃🔸", "🅿 12.29.1888_DUEL_RULEBOOK", "🅿 11.30.2023_CUSTOMER_TESTIMONIALS",
        "{RSS FEEJ INITIALIZATION LOG};",
        "HEAVY PETTING ZOO", "SIN ATRA", "WARONXMAS", "WHITE HOUSE HIRING", "ARTESINAL CRACK", "GUT BE GONE FINAL",

    ],

    // Audio Logic Settings
    FADE_TIME: 0,         
    BUFFER_SECONDS: 0,   
    TRACK_GAP_SECONDS: 0, 
};