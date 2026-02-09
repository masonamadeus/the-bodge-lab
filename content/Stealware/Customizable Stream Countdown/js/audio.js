import { CONFIG } from './config.js';

let allEpisodes = []; 
let currentAudio = new Audio();
currentAudio.preload = "none"; // Strict analytics safety
let playlistQueue = []; 
let currentTrackIndex = 0;

/* =========================================
   PART 1: DATA INGESTION
   ========================================= */
export async function loadEpisodes() {
    if (allEpisodes.length > 0) return allEpisodes;
    const feedPromises = CONFIG.RSS_FEEDS.map(url => fetchAndParseFeed(url));
    const results = await Promise.allSettled(feedPromises);
    allEpisodes = results.filter(r => r.status === 'fulfilled').map(r => r.value).flat();
    return allEpisodes;
}

async function fetchAndParseFeed(url) {
    try {
        const response = await fetch(url);
        const str = await response.text();
        const data = new window.DOMParser().parseFromString(str, "text/xml");
        const items = data.querySelectorAll("item");
        return Array.from(items).map(item => {
            const enclosure = item.querySelector("enclosure");
            const durationRaw = item.querySelector("itunes\\:duration, duration")?.textContent;
            return {
                title: item.querySelector("title").textContent,
                url: enclosure ? enclosure.getAttribute("url") : null,
                duration: parseDuration(durationRaw),
                source_feed: url 
            };
        }).filter(ep => ep.url && ep.duration > 0); 
    } catch (err) {
        console.warn(`[Audio] Failed to load feed: ${url}`, err);
        return []; 
    }
}

function parseDuration(raw) {
    if (!raw) return 0;
    if (!raw.includes(':')) return parseInt(raw, 10);
    const parts = raw.split(':').reverse();
    let seconds = 0;
    if (parts[0]) seconds += parseInt(parts[0], 10);
    if (parts[1]) seconds += parseInt(parts[1], 10) * 60;
    if (parts[2]) seconds += parseInt(parts[2], 10) * 3600;
    return seconds;
}

/* =========================================
   PART 2: LOGIC (Smart Fill + Double Shuffle)
   ========================================= */
export function generatePlaylist(totalTimeSeconds) {
    if (allEpisodes.length === 0) return [];

    let pool = [...allEpisodes];
    
    // 1. Shuffle Pool: Ensures we pick different episodes every time
    shuffleArray(pool);

    const queue = [];
    let currentFill = 0;

    // 2. Greedy Fill: Packs the time efficiently
    // (This tends to put long tracks first and short filler tracks last)
    for (let ep of pool) {
        if (currentFill + ep.duration <= totalTimeSeconds + CONFIG.BUFFER_SECONDS) {
            queue.push(ep);
            currentFill += ep.duration;
        }
    }

    // 3. Shuffle Queue: Distributes the short "filler" tracks randomly
    // so they don't all clump at the end.
    shuffleArray(queue);

    console.log(`[Audio] Generated playlist with ${queue.length} tracks, total duration: ${currentFill}s`);
    return queue;
}

/**
 * Standard Fisher-Yates Shuffle
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

export function getQueueDuration(queue) {
    return queue.reduce((total, track) => total + track.duration, 0);
}

/* =========================================
   PART 3: PLAYBACK
   ========================================= */

export function setVolume(vol) {
    currentAudio.volume = vol;
}

export function stopAudio() {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.src = ""; 
}

export function playQueue(queue) {
    if (!queue || queue.length === 0) return;
    playlistQueue = queue;
    currentTrackIndex = 0;
    playTrack(playlistQueue[0]);
}

function playTrack(track) {
    if (!track) return;

    window.dispatchEvent(new CustomEvent('trackChange', { detail: { title: track.title } }));

    currentAudio.src = track.url;
    currentAudio.play().catch(e => console.warn("Autoplay blocked/failed:", e));

    currentAudio.ontimeupdate = () => {
        const pct = (currentAudio.currentTime / currentAudio.duration) * 100;
        if (currentAudio.duration) {
            window.dispatchEvent(new CustomEvent('audioProgress', { detail: { percent: pct } }));
        }
    };

    currentAudio.onended = () => {
        currentTrackIndex++;
        if (currentTrackIndex < playlistQueue.length) {
            playTrack(playlistQueue[currentTrackIndex]);
        } else {
            console.log("[Audio] Queue finished.");
        }
    };
}