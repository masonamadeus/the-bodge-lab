import { CONFIG } from './config.js';

let allEpisodes = []; 
let loadedFeeds = new Set();
let currentAudio = new Audio();
let nextAudio = new Audio();
let playlistQueue = []; 
let currentTrackIndex = 0;
let isSoftStopping = false;

/* =========================================
   DATA INGESTION
   ========================================= */
export async function loadEpisodes(allowNSFW) {
    let urlsToFetch = [];

    // Queue feeds based on the user's NSFW preference
    CONFIG.FEEDS.forEach(feed => {
        if (!loadedFeeds.has(feed.url)) {
            // If the feed is NSFW, only add it if the user allowed it
            if (!feed.isNSFW || (feed.isNSFW && allowNSFW)) {
                urlsToFetch.push(feed);
            }
        }
    });

    if (urlsToFetch.length > 0) {
        const promises = urlsToFetch.map(feed => 
            feed.type === 'rss' ? fetchAndParseFeed(feed) : fetchAndParseJSON(feed)
        );
        const results = await Promise.allSettled(promises);
        const newEpisodes = results.filter(r => r.status === 'fulfilled').map(r => r.value).flat();
        
        // --- NEW: Blacklist Filtering ---
        const blacklist = CONFIG.BLACKLIST || [];
        const safeEpisodes = newEpisodes.filter(ep => {
            // Check if the track title or URL contains any of the blacklisted strings
            const isBlacklisted = blacklist.some(badString => 
                ep.title.toLowerCase().includes(badString.toLowerCase()) || 
                (ep.url && ep.url.toLowerCase().includes(badString.toLowerCase()))
            );
            return !isBlacklisted; // Keep it if it's NOT blacklisted
        });
        
        allEpisodes = allEpisodes.concat(safeEpisodes);
        urlsToFetch.forEach(feed => loadedFeeds.add(feed.url));
    }
    
    return allEpisodes;
}

export async function getPodcastLogoUrl() {
    if (!CONFIG.FEEDS || CONFIG.FEEDS.length === 0) return null;
    
    // Find the first RSS feed to try and pull a logo from
    const primaryFeed = CONFIG.FEEDS.find(f => f.type === 'rss');
    if (!primaryFeed) return null;

    try {
        const response = await fetch(primaryFeed.url);
        const str = await response.text();
        const data = new window.DOMParser().parseFromString(str, "text/xml");
        
        const itunesImages = data.getElementsByTagName('itunes:image');
        if (itunesImages.length > 0) return itunesImages[0].getAttribute('href');

        const channelImages = data.getElementsByTagName('image');
        if (channelImages.length > 0) {
            const urls = channelImages[0].getElementsByTagName('url');
            if (urls.length > 0) return urls[0].textContent;
        }
        return null;
    } catch (e) {
        console.warn("[Audio] Could not fetch podcast logo:", e);
        return null;
    }
}

// Notice we now pass the whole feed object so we can attach its metadata to the tracks!
async function fetchAndParseFeed(feedObj) {
    try {
        const response = await fetch(feedObj.url);
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
                source_feed: feedObj.url,
                isNSFW: feedObj.isNSFW // Attach the flag directly to the track!
            };
        }).filter(ep => ep.url && ep.duration > 0); 
    } catch (err) {
        console.warn(`[Audio] Failed to load feed: ${feedObj.url}`, err);
        return []; 
    }
}

async function fetchAndParseJSON(feedObj) {
    try {
        const response = await fetch(feedObj.url);
        const items = await response.json(); 
        
        console.log(`[Audio] Measuring durations for ${items.length} tracks from ${feedObj.url}...`);
        
        const measuredItems = await Promise.all(items.map(item => measureDuration(item, feedObj)));
        
        return measuredItems.filter(ep => ep.url && ep.duration > 0);
    } catch (err) {
        console.warn(`[Audio] Failed to load JSON feed: ${feedObj.url}`, err);
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

function measureDuration(item, feedObj) {
    return new Promise((resolve) => {
        if (item.duration) {
            resolve({ ...item, source_feed: feedObj.url, isNSFW: feedObj.isNSFW });
            return;
        }

        const audio = new Audio();
        
        audio.addEventListener('loadedmetadata', () => {
            resolve({
                title: item.title,
                url: item.url,
                duration: Math.round(audio.duration),
                source_feed: feedObj.url,
                isNSFW: feedObj.isNSFW // Attach the flag!
            });

            // Sever the connection to avoid overloading
            audio.removeAttribute('src');
            audio.load();
        });
        
        audio.addEventListener('error', () => {
            resolve({ title: item.title, url: item.url, duration: 0 }); 
            audio.removeAttribute('src');
            audio.load();
        });
        
        audio.preload = "metadata";
        audio.src = item.url;
    });
}

/* =========================================
   LOGIC (True Random Fill)
   ========================================= */

export function generatePlaylist(totalTimeSeconds, allowNSFW) {
    if (allEpisodes.length === 0) return [];

    let pool = [...allEpisodes];

    //  Filter out NSFW tracks if the user disabled them
    if (!allowNSFW) {
        pool = pool.filter(ep => ep.isNSFW === false);
    }
    
    shuffleArray(pool);

    const queue = [];
    let currentFill = 0;
    const TARGET_DURATION = totalTimeSeconds + CONFIG.BUFFER_SECONDS;
    
    let attempts = 0;
    const MAX_ATTEMPTS = 500;

    // --- LENGTH THRESHOLDS ---
    const SHORT_TRACK_MAX = 60;  // Anything under 60s is considered "Filler"
    const RESERVE_TIME = 120;    // Start using Filler when gap drops below 2 mins

    while (currentFill < TARGET_DURATION && pool.length > 0 && attempts < MAX_ATTEMPTS) {
        attempts++;
        
        const gapCost = queue.length > 0 ? CONFIG.TRACK_GAP_SECONDS : 0;
        const remainingSpace = TARGET_DURATION - (currentFill + gapCost);

        // Find all tracks that physically fit the remaining time
        let candidates = pool.filter(ep => ep.duration <= remainingSpace);

        if (candidates.length === 0) break;

        // If we still have a lot of time left to fill, temporarily hide the short tracks
        // so they don't get wasted at the beginning of the countdown.
        if (remainingSpace > RESERVE_TIME) {
            const longCandidates = candidates.filter(ep => ep.duration > SHORT_TRACK_MAX);
            
            // Safety check: Only apply this filter if we actually HAVE long tracks left!
            if (longCandidates.length > 0) {
                candidates = longCandidates;
            }
        }

        // Now just pick completely at random from whatever candidates are left
        const pickIndex = Math.floor(Math.random() * candidates.length);
        const selectedTrack = candidates[pickIndex];

        queue.push(selectedTrack);
        currentFill += (selectedTrack.duration + gapCost);
        
        // Remove from pool to prevent duplicates
        pool = pool.filter(ep => ep !== selectedTrack);
    }

    // Shuffle the final queue so if we picked multiple short tracks at the end, 
    // they get mixed into the general order a bit better
    shuffleArray(queue);

    console.log(`[Audio] Generated playlist with ${queue.length} tracks. Total: ${currentFill}s`);
    // log the queue with the order, the urls, and the durations for debugging
    queue.forEach((track, index) => {
        console.log(`  ${index + 1}. ${track.title} (${track.duration}s) [${track.url}]`);
    });
    return queue;
}

export function getQueueDuration(queue) {
    if (queue.length === 0) return 0;
    const audioTime = queue.reduce((total, track) => total + track.duration, 0);
    // (N tracks) have (N-1) gaps
    const gapTime = (queue.length - 1) * CONFIG.TRACK_GAP_SECONDS;
    return audioTime + gapTime;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/* =========================================
   PART 3: PLAYBACK (With Gaps & Soft Stop)
   ========================================= */

export function setVolume(vol) {
    currentAudio.volume = vol;
    nextAudio.volume = vol;
}

export function stopAudio() {
    isSoftStopping = false;
    [currentAudio, nextAudio].forEach(a => {
        a.pause();
        a.currentTime = 0;
        a.removeAttribute('src');
        a.onended = null;
        a.ontimeupdate = null;
        a.playbackRate = 1; // Reset speed
    });
    playlistQueue = [];
}

export function finishCurrentQueue() {
    console.log("[Audio] Soft Stop triggered. Current track will be the last.");
    isSoftStopping = true; 
    nextAudio.removeAttribute('src');
}

export function preloadFirstTrack(queue) {
    if (!queue || queue.length === 0) return;
    console.log(`[Audio] Preloading first track: ${queue[0].title}`);
    currentAudio.src = queue[0].url;
    currentAudio.preload = "auto";
    currentAudio.load();
}

export function playQueue(queue) {
    if (!queue || queue.length === 0) return;
    playlistQueue = queue;
    currentTrackIndex = 0;
    isSoftStopping = false;
    
    window.dispatchEvent(new CustomEvent('trackChange', { 
        detail: { 
            title: playlistQueue[currentTrackIndex].title,
            sourceFeed: playlistQueue[currentTrackIndex].source_feed
        } 
    }));
    
    // Safely check if src needs to be set, avoiding wiping out the preload!
    const expectedUrl = queue[0].url;
    if (!currentAudio.src || !currentAudio.src.includes(expectedUrl.substring(expectedUrl.length - 20))) {
        currentAudio.src = expectedUrl;
        currentAudio.preload = "auto";
    }
    
    attachTrackListeners(currentAudio, playlistQueue[currentTrackIndex]);
    currentAudio.play().catch(e => console.warn("Autoplay failed:", e));
}

/**
 * Decoupled listener attachment so we don't accidentally wipe .src
 */
function attachTrackListeners(audioElement, track) {
    audioElement.ontimeupdate = () => {
        if (audioElement === currentAudio && audioElement.duration) {
            const pct = (audioElement.currentTime / audioElement.duration) * 100;
            window.dispatchEvent(new CustomEvent('audioProgress', { detail: { percent: pct } }));
        }

        const remaining = audioElement.duration - audioElement.currentTime;
        
        // Check using hasAttribute so we don't get tripped up by absolute URLs
        if (remaining <= 10 && !isSoftStopping && !nextAudio.hasAttribute('src')) {
            const nextIndex = currentTrackIndex + 1;
            if (nextIndex < playlistQueue.length) {
                console.log(`[Audio] Preloading: ${playlistQueue[nextIndex].title}`);
                nextAudio.preload = "auto";
                nextAudio.src = playlistQueue[nextIndex].url;
            }
        }
    };

    audioElement.onended = () => {
        if (isSoftStopping) return;

        const nextIndex = currentTrackIndex + 1;
        if (nextIndex < playlistQueue.length) {
            swapPlayers();
        } else {
            console.log("[Audio] Queue finished.");
        }
    };
}

function swapPlayers() {
    currentTrackIndex++;
    const track = playlistQueue[currentTrackIndex];
    
    const temp = currentAudio;
    currentAudio = nextAudio;
    nextAudio = temp;

    // Reset the old player
    nextAudio.pause();
    nextAudio.removeAttribute('src'); 
    nextAudio.load(); // to dump it
    nextAudio.ontimeupdate = null;
    nextAudio.onended = null;
    nextAudio.playbackRate = 1;

    console.log(`[Audio] Swapping to: ${track.title}`);
    window.dispatchEvent(new CustomEvent('trackChange', { detail: {
         title: track.title,
         sourceFeed: track.source_feed
        } }));

    // The new currentAudio ALREADY has its src loaded, just attach listeners!
    attachTrackListeners(currentAudio, track);
    currentAudio.play().catch(e => console.error("[Audio] Gapless swap failed:", e));
}

/**
 * Rubber-Band Sync: Dynamically calculates actual audio left vs timer left 
 * and microscopically speeds up/slows down to guarantee a perfect 0:00 finish.
 */
export function syncPlaybackRate(timerSecondsLeft) {
    if (!currentAudio || currentAudio.paused || isSoftStopping || playlistQueue.length === 0) {
        return;
    }
    if (!currentAudio.duration) return; 

    const currentRemaining = currentAudio.duration - currentAudio.currentTime;
    
    let futureRemaining = 0;
    for (let i = currentTrackIndex + 1; i < playlistQueue.length; i++) {
        futureRemaining += playlistQueue[i].duration;
    }

    const totalAudioRemaining = currentRemaining + futureRemaining;

    // Return to normal speed for the final 3 seconds so the sentence sounds natural
    if (timerSecondsLeft <= 3) {
        currentAudio.playbackRate = 1;
        return;
    }

    let idealRate = totalAudioRemaining / timerSecondsLeft;
    
    // Clamp to prevent chipmunk/slow-mo distortion (15% variance max)
    idealRate = Math.max(0.85, Math.min(idealRate, 1.15));

    if (Math.abs(currentAudio.playbackRate - idealRate) > 0.01) {
        currentAudio.playbackRate = idealRate;
        console.log(`[Audio] Adjusting playback rate to ${idealRate.toFixed(3)}x (Audio Left: ${totalAudioRemaining.toFixed(1)}s, Timer Left: ${timerSecondsLeft}s)`);
    }
}

/**
 * Mobile Browser "Unlock" Trick
 */
export function unlockAudio() {
    const silentUrl = "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIAD+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+AAAAAExhdmM1OS4zNyAAAAAAAAAAAAAAAAQAAAAALgAAAAAA//OEAEAAAMgAAAAAABIAAIAgAAAAAgAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//OEAEAAAMgAAAAAABIAAIAgAAAAAgAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//OEAEAAAMgAAAAAABIAAIAgAAAAAgAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
    
    [currentAudio, nextAudio].forEach(a => {
        // Save the exact attribute, not the resolved absolute URL property
        const originalSrc = a.getAttribute('src');
        
        a.src = silentUrl;
        
        const cleanup = () => {
            // Protect against race conditions: only restore if it's still the silent URL
            if (a.src && a.src.includes("data:audio/mpeg;base64")) {
                if (originalSrc) {
                    a.src = originalSrc;
                } else {
                    a.removeAttribute('src');
                }
            }
        };

        a.play().then(() => {
            a.pause();
            cleanup();
        }).catch(e => {
            cleanup();
        });
    });
}