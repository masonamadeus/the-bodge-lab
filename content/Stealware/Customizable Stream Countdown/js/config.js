export const CONFIG = {
    // Array of Feed Objects
    FEEDS: [
        { 
            url: 'https://pinecast.com/feed/pc', 
            type: 'rss', 
            isNSFW: false 
        },
        { 
            url: '/widkads.json', 
            type: 'json', 
            isNSFW: true 
        }
    ],

    // Audio Logic Settings
    FADE_TIME: 0,         
    BUFFER_SECONDS: 0,   
    TRACK_GAP_SECONDS: 0, 
};