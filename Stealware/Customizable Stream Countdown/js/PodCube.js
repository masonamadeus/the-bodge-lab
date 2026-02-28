
/**
 * PodCube.js - The Complete Engine
 * Middleware between raw podcast feeds and public-facing applications.
 * Normalizes RSS and JSON feeds, extracts lore metadata, and provides querying APIs.
 */

const CONFIG = {
    FEED_URL_RSS: "https://pinecast.com/feed/pc",
    FEED_URL_JSON: "https://pinecast.com/jsonfeed/pc",
    FEED_TYPE: "rss", // "rss" or "json" - can be toggled at runtime
    SKIP_FORWARD: 20,
    SKIP_BACK: 7,
    DEBUG: (typeof window !== 'undefined' && localStorage.getItem('podcube_debug') === 'true') || false
};

// Episode Type Constants
const EPISODE_TYPES = {
    TRANSMISSION: "transmission",            // 🅿️ Standard PodCube transmissions (has lore data)
    PODCUBE_HQ: "podcube_hq",      // 🔸 Direct messages from PodCube HQ (has lore data)
    TWIBBIE_ONDEMAND: "twibbie_ondemand", // 💠 Twibbie™ On-Demand broadcasts (no lore)
    NONE: "none"                   // No special emoji (title only + publish date)
};

const EMOJI_PATTERNS = { 
    PODCUBE: /\u{1F17F}\u{FE0F}?/u,          // 🅿️ P button
    PODCUBE_HQ: /\u{1F538}\u{FE0F}?/u,       // 🔸 Small Orange Diamond
    TWIBBIE_ONDEMAND: /\u{1F4A0}\u{FE0F}?/u  // 💠 Diamond with a Dot
};

// Utility: Safe logging with pipe to window if wanted
const log = {
    info: (msg, data) => {
        if (CONFIG.DEBUG) {
            console.log(`[PodCube]`, msg, data || "");
            if (window.pipeToConsole) window.pipeToConsole(`${msg} ${data ? JSON.stringify(data) : ''}`, 'info');
        }
    },
    warn: (msg, data) => {
        console.warn(`[PodCube WARN]`, msg, data || "");
        if (window.pipeToConsole) window.pipeToConsole(`${msg} ${data ? JSON.stringify(data) : ''}`, 'warn');
    },
    error: (msg, data) => {
        console.error(`[PodCube ERROR]`, msg, data || "");
        if (window.pipeToConsole) window.pipeToConsole(`${msg} ${data ? JSON.stringify(data) : ''}`, 'error');
    }
};

// ==========================================
// UTILITY HELPERS
// ==========================================

// FNV-1a Hash Implementation: Reduces collision risk for short IDs
function fnv1aHash(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    // Return unsigned 32-bit hex, truncated to 5 chars (20 bits)
    return (hash >>> 0).toString(16).padStart(8, '0').substring(0, 5);
}


// ===========================================
// PODCUBE CUSTOM DATE OBJECT
// ===========================================

class PodCubeDate {
    constructor(input) {
        this.year = 0;
        this.month = 0;
        this.day = 1;

        if (typeof input === 'string') this._parse(input);
        else if (input instanceof Date) {
            this.year = input.getFullYear();
            this.month = input.getMonth();
            this.day = input.getDate();
        }
        else if (typeof input === 'object' && input !== null) Object.assign(this, input);
    }

    _parse(str) {
        //  Handle ISO: "-134999-01-01"
        const isoMatch = str.match(/^(-?\d+)-(\d{2})-(\d{2})$/);
        if (isoMatch) {
            this.year = parseInt(isoMatch[1]);
            this.month = parseInt(isoMatch[2]) - 1;
            this.day = parseInt(isoMatch[3]);
            return;
        }

        //  Handle US Format with Era: "06/02/132975 BCE" or "11/27/2066"
        const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d+)(?:\s*(BCE|BC))?$/i);
        if (usMatch) {
            this.month = parseInt(usMatch[1]) - 1;
            this.day = parseInt(usMatch[2]);
            let y = parseInt(usMatch[3]);
            if (usMatch[4]) y = -y + 1; // ASTRONOMICAL YEAR NUMBERING IS NONSENSE JUST TRUST THIS
            this.year = y;
            return;
        }

        //  Fallback to standard JS Date
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            this.year = d.getFullYear();
            this.month = d.getMonth();
            this.day = d.getDate();
        } else {
            log.warn(`Unrecognized date format: "${str}". `);
            this.year = 0;
            this.month = 0;
            this.day = 0;
        }
    }

    get displayYear() {
        if (this.year > 0) return this.year.toString();
        if (this.year === 0) return "1 BCE";
        return `${Math.abs(this.year) + 1} BCE`;
    }

    toString() {
        const m = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${m[this.month]} ${this.day}, ${this.displayYear}`;
    }

    static isLeapYear(year) {
        // Proleptic Gregorian leap year rules
        if (year % 400 === 0) return true;
        if (year % 100 === 0) return false;
        return year % 4 === 0;
    }

    static daysInMonth(year, month) {
        const monthLengths = [
            31,
            PodCubeDate.isLeapYear(year) ? 29 : 28,
            31,
            30,
            31,
            30,
            31,
            31,
            30,
            31,
            30,
            31
        ];
        return monthLengths[month];
    }

    static toAbsoluteDayNumber({ year, month, day }) {
        // Convert date to number of days since a fixed origin (Gregorian)
        let days = 0;

        // Add days from full years
        const y = year - 1;
        days += y * 365;
        days += Math.floor(y / 4);
        days -= Math.floor(y / 100);
        days += Math.floor(y / 400);

        // Add days from months in current year
        for (let m = 0; m < month; m++) {
            days += PodCubeDate.daysInMonth(year, m);
        }

        // Add days in current month
        days += day;

        return days;
    }
}

// ==========================================
// FEED NORMALIZATION
// ==========================================

/**
 * FeedNormalizer: Converts raw RSS/JSON feed items into a common format
 * This is the heart of the middleware - normalizes diverse feed formats
 */
class FeedNormalizer {
    static parseTimeStr(str) {
        if (!str) return null;
        try {
            // Handle "300" (raw seconds)
            // need to check for NaN

            if (!str.includes(':')) {
                const seconds = parseInt(str, 10);
                return seconds > 0 ? seconds : null;
            }

            // Handle "05:00" or "01:30:25"
            const parts = str.split(':').reverse();
            let seconds = 0;
            if (parts[0]) seconds += parseInt(parts[0], 10); // ss
            if (parts[1]) seconds += parseInt(parts[1], 10) * 60; // mm
            if (parts[2]) seconds += parseInt(parts[2], 10) * 3600; // hh
            return seconds > 0 ? seconds : null;
        } catch (e) {
            log.warn(`Failed to parse duration string: "${str}"`, e);
            return null;
        }
    }

    static stripHtml(html) {
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return doc.body.textContent || "";
        } catch (e) {
            return html.replace(/<[^>]*>?/gm, '');
        }
    }

    static parseMetaLines(text) {
        try {
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith(":: "));
            const data = {};

            for (const line of lines) {
                const match = line.match(/^::\s*([^:]+):\s*(.+)$/);
                if (!match) continue;

                const key = match[1].toLowerCase().replace(/ /g, '_');
                let value = match[2].trim();

                if (key === "tags") {
                    value = value.split(',').map(t => t.trim()).filter(t => t);
                }

                data[key] = value;
            }
            return data;
        } catch (e) {
            log.warn("Failed to parse metadata lines:", e);
            return {};
        }
    }

    /**
     * Determine episode type and extract common properties from title
     * E.g. "🅿️ 04.01.2050_STOVE'S_DESK⚠️UNINTENTIONAL_TRANSMISSION⚠️
     * Episode Type: PODCUBE (because of 🅿️)
     * Therefore we take everything before the first underscore as "Shortcode"
     * Shortcode: "04.01.2050"
     * And everything after as "Clean Title"
     * Clean Title: "STOVE'S DESK⚠️UNINTENTIONAL_TRANSMISSION⚠️"
     * 
     */
    static analyzeTitle(rawTitle) {
    let episodeType = EPISODE_TYPES.NONE;
    let cleanTitle = rawTitle;
    let shortcode = "";

    // 1. Define strictly what identifies a functional PodCube type
    const matchers = [
        { type: EPISODE_TYPES.TRANSMISSION, pattern: EMOJI_PATTERNS.PODCUBE },
        { type: EPISODE_TYPES.PODCUBE_HQ, pattern: EMOJI_PATTERNS.PODCUBE_HQ },
        { type: EPISODE_TYPES.TWIBBIE_ONDEMAND, pattern: EMOJI_PATTERNS.TWIBBIE_ONDEMAND }
    ];

    // 2. Find the first functional match
    let firstMatch = null;
    for (const m of matchers) {
        const result = rawTitle.match(m.pattern);
        if (result && (firstMatch === null || result.index < firstMatch.index)) {
            firstMatch = { ...m, index: result.index, length: result[0].length };
        }
    }

    // 3. Process based on the first match found
    if (firstMatch) {
        episodeType = firstMatch.type;
        
        if (episodeType === EPISODE_TYPES.TRANSMISSION) {
            // TRANSMISSIONS: Strip everything before and including the 🅿️
            const startIndex = firstMatch.index + firstMatch.length;
            let loreContent = rawTitle.substring(startIndex).trim();
            
            // Handle the shortcode split (e.g., "04.01.2050_Title")
            const parts = loreContent.split('_');
            if (parts.length > 1) {
                shortcode = parts[0].trim();
                cleanTitle = parts.slice(1).join(" ").trim();
            } else {
                cleanTitle = loreContent;
            }
        } 
        else if (episodeType === EPISODE_TYPES.PODCUBE_HQ || episodeType === EPISODE_TYPES.TWIBBIE_ONDEMAND) {
            // HQ/TWIBBIE: We keep the decorative start if it exists, 
            // but we classify the type based on the first functional emoji found.
            // "Everything INCLUDING that emoji is the title" per requirements.
            cleanTitle = rawTitle.trim();
        }
    }

    // 4. Final Cleanup: Strip trailing decorative diamonds/punctuation
    cleanTitle = cleanTitle.replace(/[🔸💠\s;{}]+$/gu, "");

    return { episodeType, cleanTitle, shortcode };
}

    /**
     * Filter and extract episode metadata, based on the episode type
     * For instance Podcube has :: KEY: VALUE lines in the description,
     * Twibbie does not.
     */
    static extractMetadata(episodeType, descriptionText) {
        let meta = {};

        if (episodeType === EPISODE_TYPES.TRANSMISSION || episodeType === EPISODE_TYPES.PODCUBE_HQ) {
            // Parse lore from metadata structure
            const plainText = this.stripHtml(descriptionText);
            meta = this.parseMetaLines(plainText);
        } else if (episodeType === EPISODE_TYPES.TWIBBIE_ONDEMAND) {
            // Populate Twibbie metadata
            meta = {
                model: "Twibbie On-Demand",
                origin: "Twibbie On-Demand",
                region: "Twibbie On-Demand",
                zone: "Twibbie On-Demand",
                locale: "Twibbie On-Demand",
                planet: "Twibbie On-Demand",
                integrity: 0,
            };
        }

        return meta;
    }

    static extractGUID(rawId) {
        if (!rawId) return null;
        try {
            // 1. Split query params if any
            const noQuery = rawId.split('?')[0];
            // 2. Split path and take last segment
            const segment = noQuery.split('/').pop();
            // 3. Return segment if valid, otherwise fallback to raw
            return (segment && segment.trim().length > 0) ? segment.trim() : rawId;
        } catch (e) {
            return rawId;
        }
    }

    /**
     * Normalize a raw feed item (from either RSS or JSON) into a common format
     */
    static normalizeItem(rawItem, format = 'rss') {
        try {
            // Extract format-specific fields with fallbacks
            let rawId = rawItem.id || rawItem.guid || null;
            const id = this.extractGUID(rawId);
            const title = rawItem.title || "";
            const description = format === 'json'
                ? (rawItem.content_html || null)
                : (rawItem.description || null);
            const pubDate = rawItem.date_published || rawItem.pubDate || null;

            // Format-specific audio extraction
            let audioUrl = null;
            let duration = null;
            let sizeBytes = null;

            if (format === 'json') {
                const attachment = rawItem.attachments?.[0];
                audioUrl = attachment?.url || null;
                duration = attachment?.duration_in_seconds || null;
                sizeBytes = attachment?.size_in_bytes || null;
            } else {
                // RSS format
                audioUrl = rawItem.enclosure?.url || null;
                duration = this.parseTimeStr(rawItem.duration || null);
                sizeBytes = rawItem.enclosure?.length ? parseInt(rawItem.enclosure.length) : null;
            }

            // Analyze title for type and shortcode
            const { episodeType, cleanTitle, shortcode } = this.analyzeTitle(title);

            // Extract metadata based on type
            const meta = this.extractMetadata(episodeType, description || "");

            return {
                id,
                title: cleanTitle,
                shortcode,
                episodeType,
                pubDate,
                description,
                audioUrl,
                duration,
                sizeBytes,
                metadata: meta
            };
        } catch (e) {
            log.error(`Failed to normalize ${format} item:`, e);
            return null;
        }
    }
}

// ==========================================
// EPISODE DATA MODEL
// ==========================================

class Episode {
    constructor(normalized) {
        if (!normalized) {
            log.error("Episode constructor received null data");
            throw new Error("Episode data cannot be null");
        }

        try {
            // Identifiers
            this.id = normalized.id || null;
            this.nanoId = this.id ? fnv1aHash(this.id) : "00000";
            this.title = normalized.title || null;
            this.shortcode = normalized.shortcode || null;
            this.episodeType = normalized.episodeType || EPISODE_TYPES.NONE;
            

            // Dates
            this.date = normalized.metadata?.date
                ? new PodCubeDate(normalized.metadata.date)
                : "Unknown Date";
            this.published = normalized.pubDate ? new Date(normalized.pubDate) : null;

            // Lore Properties (from metadata)
            this.model = normalized.metadata?.podcube_model || normalized.metadata?.model || null;
            this.origin = normalized.metadata?.origin || null; // Most specific, e.g. "Martha's Vineyard"
            this.locale = normalized.metadata?.locale || null; // General Area, e.g. "Dukes County"
            this.region = normalized.metadata?.region || null; // Wide Area, e.g. "Massachusetts"
            this.zone = normalized.metadata?.zone || null; // National/Geographic bounds, e.g. "USA"
            this.planet = normalized.metadata?.planet || null; // The Planet (probably always "Earth" but who knows)

            // File Integrity (A joke property, fake percentage. Don't validate.)
            if (this.episodeType === EPISODE_TYPES.TWIBBIE_ONDEMAND || this.episodeType === EPISODE_TYPES.NONE) {
                this.integrityValue = 0;
                this.integrity = "0.0";
            } else {
                const rawIntegrity = normalized.metadata?.integrity;
                const parsedIntegrity = parseFloat(rawIntegrity);
                // LOGIC LIFTED FROM UI: Default to 0 if missing/invalid
                this.integrityValue = !isNaN(parsedIntegrity) ? parsedIntegrity : 0;
                this.integrity = rawIntegrity || "0";
            }

            // Content
            this.tags = Array.isArray(normalized.metadata?.tags) ? normalized.metadata.tags : [];
            this.description = normalized.description || null;

            // Audio
            this.audioUrl = normalized.audioUrl || null;
            this.duration = normalized.duration || null;
            this.sizeBytes = normalized.sizeBytes || null;

            // Validation
            if (!this.audioUrl) {
                log.warn(`Episode "${this.title}" has no audio URL`);
            }
            if (!this.duration) {
                log.warn(`Episode "${this.title}" (ID: ${this.id}) has missing or zero duration`);
            }
        } catch (e) {
            log.error(`Failed to construct Episode:`, e);
            throw e;
        }
    }

    get location() {
        return [this.origin, this.locale, this.region, this.zone, this.planet]
            .filter(Boolean)
            .join(", ");
    }

    get weirdDuration() {
        if (!this.duration) return "IDK?";
        const m = Math.floor(this.duration / 60);
        const f = ((this.duration % 60) / 60).toFixed(2).substring(1);
        const suffixes = ["ish minutes", " or so minutes", " minutes (+/- a bit)", " minutes and change", " minutes (sorta)", "96722.13 minutes", "-esque minutes"];
        const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        return `${m}${f}${suffix}`;
    }

    get timestamp() {
        if (!this.duration) return "0:00";
        const m = Math.floor(this.duration / 60);
        const s = Math.floor(this.duration % 60);
        return `${m}:${s < 10 ? '0' + s : s}`;
    }

    get hasIssues() {
        // Flag episodes with missing critical data (Audio, Duration, Date)
        return !this.audioUrl || !this.duration || !this.date || !this.date.year;
    }

    get anniversary() {
        if (!this.date) return null;

        const today = new Date();
        const current = new PodCubeDate(today);

        const a = PodCubeDate.toAbsoluteDayNumber(current);
        const b = PodCubeDate.toAbsoluteDayNumber(this.date);

        if (a === b) return "today";

        const inPast = a > b;

        // Determine direction
        const start = inPast ? this.date : current;
        const end = inPast ? current : this.date;

        let years = end.year - start.year;
        let months = end.month - start.month;
        let days = end.day - start.day;

        // Borrow days if needed
        if (days < 0) {
            months--;
            const prevMonth = (end.month - 1 + 12) % 12;
            const prevYear = prevMonth === 11 ? end.year - 1 : end.year;
            days += PodCubeDate.daysInMonth(prevYear, prevMonth);
        }

        // Borrow months if needed
        if (months < 0) {
            years--;
            months += 12;
        }

        const format = (value, unit) => {
            const plural = value === 1 ? unit : unit + "s";
            return inPast
                ? `${value} ${plural} ago`
                : `${value} ${plural} from now`;
        };

        if (years > 0) return format(years, "year");
        if (months > 0) return format(months, "month");

        const weeks = Math.floor(days / 7);
        if (weeks > 0) return format(weeks, "week");

        return format(days, "day");
    }


}

// ==========================================
// THE ENGINE (Singleton API)
// ==========================================
/**
   * Events emitted by PodCubeEngine:
   * 
   * @event feed:loading - Feed fetch started
   * @event feed:loaded - Feed loaded successfully, {episodes: Episode[]}
   * @event feed:error - Feed loading failed, {error: Error}
   * 
   * @event playback:play - Playback started, {episode: Episode}
   * @event playback:pause - Playback paused
   * @event playback:ended - Track ended
   * @event playback:error - Playback error, {error: Error}
   * @event playback:timeupdate - Time updated, {currentTime: number, duration: number}
   * @event playback:seeked - Seek completed, {position: number}
   * 
   * @event queue:changed - Queue modified, {queue: Episode[], index: number}
   */

class PodCubeEngine {
    constructor() {
        this.episodes = [];
        this.logo = null;
        this.isReady = false;
        this.lastSave = 0;
        

        // Feed Cache
        this._lastFetchedUrl = null; 
        this._lastFetchTime = null; 

        // Audio Cache
        this._currentObjectUrl = null; // Track current URL to revoke it later

        // Audio State
        this._audio = new Audio();
        this._audio.preload = "metadata";
        this._preloader = null;
        this._loadingToken = 0;
        this._isLoading = false;
        this._hasPreloadedNext = false;


        this._queue = [];
        this._queueIndex = -1;
        this._stopAfterCurrent = false;
        this._volume = 1.0;
        this._radioMode = false;
        this._listeners = {};

        this._audio.addEventListener('ended', () => {
            const finishedEp = this.nowPlaying;
            const isLastTrack = this._queueIndex >= this._queue.length - 1;

            // Radio Mode Logic
            // NEED TO CHANGE THIS SO THAT IT ONLY ADDS THE NEXT TRACK 30 SECONDS BEFORE THE END OF THE CURRENT ONE??
            if (isLastTrack && this._radioMode) {
                log.info("Radio Mode: Auto-queueing random track.");
                const nextTrack = this.random;
                if (nextTrack) {
                    this.addToQueue(nextTrack, false);
                    this.next();
                    if (finishedEp) this._emit('ended', finishedEp);
                    return; // Skip standard session clearing
                }
            }

            if (isLastTrack) {
                // At end of queue - clear the session
                this._clearSession();
            } else {
                // Moving to next track - preserve session
                this._saveSession();
            }

            if (finishedEp){
                this._emit('ended',finishedEp);
            }

            this.next();
        });

        this._audio.addEventListener('play', () => {
            this._emit('play', this.nowPlaying)
        });

        this._audio.addEventListener('pause', () => {
            this._saveSession(); // Force save on pause
            this._emit('pause', this.nowPlaying);
        });
        
        // Throttled save for timeupdate (every ~5 seconds)
        this._audio.addEventListener('timeupdate', () => {
            const now = Date.now();
            if (now - this.lastSave > 5000) {
                this._saveSession();
                this.lastSave = now;
            }

            // Media session lock screen scrubber
            if ('mediaSession' in navigator && this._audio.duration) {
                try {
                    navigator.mediaSession.setPositionState({
                        duration: this._audio.duration,
                        playbackRate: this._audio.playbackRate,
                        position: this._audio.currentTime
                    });
                } catch (e) {
                    // Ignore errors (some browsers throw if duration isn't fully resolved yet)
                }
            }

            // Emit status as usual
            this._emit('timeupdate', this.status);

            // Only run if we haven't preloaded yet
            if (this._audio.duration && !this._hasPreloadedNext) {
                const remaining = this._audio.duration - this._audio.currentTime;

                // Trigger Preload once we hit the threshold
                if (remaining <= 5) {
                    this._preloadNext();
                    this._hasPreloadedNext = true;
                }
            }
        });

        this._audio.addEventListener('error', () => {
            const error = this._audio.error;
            log.error("Audio element error:", error);
            this._emit('error', {
                event: 'audio_error',
                error: error,
                code: error?.code,
                message: error?.message,
                episode: this.nowPlaying
            });
        });
    }

    async init(force = false) {
        // Early exit with no side effects
        if (this.isReady && !force) {
            log.info("PodCube already initialized, using cached data");
            return this;
        }

        // Check if we already have this feed type loaded
        const feedUrl = CONFIG.FEED_TYPE === "json" ? CONFIG.FEED_URL_JSON : CONFIG.FEED_URL_RSS;
        if (this.isReady && this._lastFetchedUrl === feedUrl && !force) {
            
            log.info("Feed already loaded for this type, using cached data");
            return this;
        }

        try {
            log.info(`Fetching ${CONFIG.FEED_TYPE.toUpperCase()} feed:`, feedUrl);
            const res = await fetch(feedUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

            // Track what we fetched
            this._lastFetchedUrl = feedUrl;
            this._lastFetchTime = Date.now();

            const rawFeed = await res.text();
            const format = CONFIG.FEED_TYPE === "json" ? "json" : "rss";

            await this._loadFromFeed(rawFeed, format);

            // Media session setup
            if ('mediaSession' in navigator) {
                // Bind native OS controls directly to the engine's methods
                navigator.mediaSession.setActionHandler('play', () => this.play());
                navigator.mediaSession.setActionHandler('pause', () => this.pause());
                navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
                navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
                navigator.mediaSession.setActionHandler('seekbackward', () => this.skipBack());
                navigator.mediaSession.setActionHandler('seekforward', () => this.skipForward());
            }

            this.isReady = true;
            log.info(`Ready. Loaded ${this.episodes.length} episodes via ${CONFIG.FEED_TYPE.toUpperCase()}.`);
            return this;
        } catch (e) {
            log.error("Init failed:", e);
            throw e;
        }
    }

    /**
     * Robustly find an episode by ID, handling URL drift and fuzzy matches.
     * Returns Episode object or null.
     */
    findEpisode(id) {
        if (!id) return null;
        if (typeof id === 'object') return id; // Already an object

        // 1. Try exact match (Fastest)
        let match = this.episodes.find(e => e.id === id);
        if (match) return match;

        // 2. Try fuzzy match (Handles RSS URL vs JSON UUID differences)
        const clean = FeedNormalizer.extractGUID(id);
        if (clean) {
            match = this.episodes.find(e => e.id.includes(clean));
        }
        
        return match || null;
    }

    /**
     * Unified feed loading - handles both RSS and JSON
     */
    async _loadFromFeed(rawFeed, format) {
        try {
            let items = [];

            if (format === 'json') {
                const json = JSON.parse(rawFeed);
                if (!json.items || !Array.isArray(json.items)) {
                    throw new Error("JSON feed missing items array");
                }
                this.logo = json.icon || null;
                items = json.items;
            } else {
                const parser = new DOMParser();
                const xml = parser.parseFromString(rawFeed, "text/xml");

                if (xml.querySelector("parsererror")) {
                    throw new Error(`XML Parse Error: ${xml.querySelector("parsererror").textContent}`);
                }

                // Helper: safely get text content from potentially namespaced tags
                const getText = (parent, tagName) => {
                    // 1. Try exact match first
                    let tags = parent.getElementsByTagName(tagName);
                    if (tags.length > 0) return tags[0].textContent;

                    // 2. Try case-insensitive local name match
                    const localName = tagName.includes(':') ? tagName.split(':')[1] : tagName;
                    const allChildren = parent.children;
                    for (let child of allChildren) {
                        if (child.localName && child.localName.toLowerCase() === localName.toLowerCase()) {
                            return child.textContent;
                        }
                    }
                    return null;
                };

                // Extract Logo
                // Note: We still use querySelector for complex paths, but simpler is better
                const imgNode = xml.querySelector("channel > image > url");
                this.logo = imgNode ? imgNode.textContent : getText(xml.querySelector("channel"), "itunes:image")?.getAttribute("href");

                // Convert XML nodes to normalized objects
                items = Array.from(xml.querySelectorAll("item")).map(node => {
                    const enclosure = node.getElementsByTagName("enclosure")[0];
                    return {
                        id: getText(node, "guid"),
                        title: getText(node, "title"),
                        description: getText(node, "description") || getText(node, "content:encoded"), // Fallback for some feeds
                        pubDate: getText(node, "pubDate"),
                        // This line is now much safer:
                        duration: getText(node, "itunes:duration") || getText(node, "duration"),
                        enclosure: {
                            url: enclosure?.getAttribute("url"),
                            length: enclosure?.getAttribute("length")
                        }
                    };
                });
            }

            // Normalize all items and create Episode objects
            this.episodes = items
                .map(item => {
                    try {
                        const normalized = FeedNormalizer.normalizeItem(item, format);
                        if (!normalized) {
                            log.warn("Failed to normalize item:", item.title || item.id);
                            return null;
                        }

                        // Validate critical fields
                        if (!normalized.id || !normalized.title) {
                            log.warn("Episode missing required fields:", normalized);
                            return null;
                        }

                        return new Episode(normalized);
                    } catch (e) {
                        log.error("Error creating episode:", e, item);
                        return null;
                    }
                })
                .filter(ep => ep !== null);

            // Validate we got something
            if (this.episodes.length === 0) {
                throw new Error(`No valid episodes found in ${format.toUpperCase()} feed`);
            }

            log.info(`Parsed ${this.episodes.length} episodes from ${format.toUpperCase()} feed`);
        } catch (e) {
            log.error(`Failed to load ${format.toUpperCase()} feed:`, e);
            throw e;
        }
    }
    // Feed switching utility
    setFeedType(type) {
        if (!["rss", "json"].includes(type)) {
            log.error(`Invalid feed type: ${type}. Use "rss" or "json".`);
            return false;
        }
        CONFIG.FEED_TYPE = type;
        log.info(`Feed type switched to: ${type}`);
        return true;
    }

    setDebug(enabled) {
        // Safety check for SSR
        if (typeof window === 'undefined') return;

        const isEnabled = !!enabled; // Force boolean
        CONFIG.DEBUG = isEnabled;

        // Save to LocalStorage
        localStorage.setItem('podcube_debug', isEnabled.toString());

        log.info(`Debug mode set to ${isEnabled}. Reloading page to capture init logs...`);

        // Reload after a brief delay so you can see the confirmation message
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }

    // --- ACCESSORS ---
    get FEED_TYPE() { return CONFIG.FEED_TYPE; }
    get DEBUG() { return CONFIG.DEBUG; }
    get isLoading() { return this._isLoading; }
    get hasPreloadedNext() { return this._hasPreloadedNext; }
    get all() { return this.episodes; }
    get latest() { return this.getByReleaseOrder()[0] || null; }

    get random() {
        if (this.episodes.length === 0) return null;
        return this.episodes[Math.floor(Math.random() * this.episodes.length)];
    }

    get models() {
        const models = this.episodes
            .filter(e => e.model)
            .map(e => e.model);
        return [...new Set(models)].sort();
    }

    get origins() {
        const origins = this.episodes
            .filter(e => e.origin)
            .map(e => e.origin);
        return [...new Set(origins)].sort();
    }

    get tags() {
        const tags = new Set();
        this.episodes.forEach(e => {
            if (Array.isArray(e.tags)) {
                e.tags.forEach(tag => tags.add(tag));
            }
        });
        return [...tags].sort();
    }

    getNearestToToday() {
        try {
            const today = new PodCubeDate(new Date());
            const todayAbs = PodCubeDate.toAbsoluteDayNumber(today);

            let closestDistance = Infinity;
            let matches = [];

            for (const ep of this.episodes) {
                if (!ep.date) continue;

                const epAbs = PodCubeDate.toAbsoluteDayNumber(ep.date);
                const distance = Math.abs(todayAbs - epAbs);

                if (distance < closestDistance) {
                    closestDistance = distance;
                    matches = [ep];
                } else if (distance === closestDistance) {
                    matches.push(ep);
                }
            }

            return matches;
        } catch (e) {
            log.error("Failed to find episode nearest to today:", e);
            return [];
        }
    }

    getYearGroups(threshold = 5) {
        try {
            const years = [...new Set(
                this.episodes
                    .filter(e => e.date && e.date.year)
                    .map(e => e.date.year)
            )].sort((a, b) => a - b);

            if (years.length === 0) return [];

            // Recursive subdivision helper
            const subdivide = (startIdx, endIdx, targetSize) => {
                const yearsSlice = years.slice(startIdx, endIdx + 1);
                const startYear = yearsSlice[0];
                const endYear = yearsSlice[yearsSlice.length - 1];

                const episodesInRange = this.episodes.filter(
                    e => e.date && e.date.year >= startYear && e.date.year <= endYear
                );
                const count = episodesInRange.length;

                // If it's a single year or below threshold, return as-is
                if (yearsSlice.length === 1 || count <= targetSize) {
                    return [{
                        start: startYear,
                        end: endYear,
                        count: count
                    }];
                }

                // If it spans multiple years and exceeds threshold, subdivide
                if (yearsSlice.length > 1 && count > targetSize) {
                    const midIdx = startIdx + Math.floor((endIdx - startIdx) / 2);

                    const leftGroups = subdivide(startIdx, midIdx, targetSize);
                    const rightGroups = subdivide(midIdx + 1, endIdx, targetSize);

                    return [...leftGroups, ...rightGroups];
                }

                return [{
                    start: startYear,
                    end: endYear,
                    count: count
                }];
            };

            const groups = subdivide(0, years.length - 1, threshold);

            // Merge adjacent single-year groups if they're below threshold
            const merged = [];
            let accumulator = null;

            for (const group of groups) {
                if (group.start === group.end) {
                    // Single year
                    if (accumulator === null) {
                        accumulator = { ...group };
                    } else if (accumulator.end === group.start - 1 && accumulator.count + group.count <= threshold) {
                        // Adjacent and can merge
                        accumulator.end = group.end;
                        accumulator.count += group.count;
                    } else {
                        // Can't merge, flush accumulator
                        merged.push(accumulator);
                        accumulator = { ...group };
                    }
                } else {
                    // Multi-year group
                    if (accumulator !== null) {
                        merged.push(accumulator);
                        accumulator = null;
                    }
                    merged.push(group);
                }
            }
            if (accumulator !== null) {
                merged.push(accumulator);
            }

            return merged.map(g => {
                const label = (g.start === g.end)
                    ? this._formatYear(g.start)
                    : `${this._formatYear(g.start)} - ${this._formatYear(g.end)}`;

                return {
                    label: label,
                    start: g.start,
                    end: g.end,
                    count: g.count,
                    episodes: this.where({ year: [g.start, g.end] })
                };
            });
        } catch (e) {
            log.error("Failed to generate year groups:", e);
            return [];
        }
    }

    where(filters = {}, sort = null) {
        try {
            let results = this.episodes;

            // --- 1. FILTERING ---
            // Only iterate if we actually have filters
            if (filters && Object.keys(filters).length > 0) {
                results = results.filter(e => {
                    for (const key in filters) {
                        const value = filters[key];
                        // Skip empty values (e.g. from empty UI selects)
                        if (value === "" || value === null || value === undefined) continue;

                        // A. Special: "Issues" Flag
                        if (key === 'episodeType' && value === 'issues') {
                            if (!e.hasIssues) return false;
                        }
                        // B. Special: Full-Text Search
                        else if (key === 'search') {
                            const q = value.toLowerCase();
                            const match = (e.title && e.title.toLowerCase().includes(q)) ||
                                          (e.description && e.description.toLowerCase().includes(q)) ||
                                          (e.tags && e.tags.some(t => t.toLowerCase().includes(q)));
                            if (!match) return false;
                        }
                        // C. Special: Year Ranges (Array [min, max])
                        else if ((key === 'year' || key === 'yearRange') && Array.isArray(value)) {
                            const [min, max] = value;
                            if (!e.date || !e.date.year || e.date.year < min || e.date.year > max) return false;
                        }
                        // D. Special: Tags (Exact Match in Array)
                        else if (key === 'tag' || key === 'tags') {
                            const searchTags = Array.isArray(value) ? value : [value];
                            if (!searchTags.some(t => e.tags && e.tags.includes(t))) return false;
                        }
                        // E. Standard Properties
                        else {
                            // If filter value is an array, check if episode property is IN that array
                            if (Array.isArray(value)) {
                                if (!value.includes(e[key])) return false;
                            } 
                            // Otherwise strict equality
                            else if (e[key] !== value) {
                                return false;
                            }
                        }
                    }
                    return true;
                });
            }

            // --- 2. SORTING ---
            if (sort) {
                const [field, direction] = sort.split('_'); // e.g. "release_desc"
                const isDesc = direction === 'desc';

                results.sort((a, b) => {
                    let valA, valB;

                    // Map UI sort keys to data properties
                    switch(field) {
                        case 'release': valA = a.published; valB = b.published; break;
                        case 'lore': 
                            valA = a.date ? a.date.year : -999999; 
                            valB = b.date ? b.date.year : -999999; 
                            break;
                        case 'duration': valA = a.duration || 0; valB = b.duration || 0; break;
                        case 'integrity': valA = a.integrityValue || 0; valB = b.integrityValue || 0; break;
                        default: valA = a[field]; valB = b[field]; break;
                    }

                    if (valA < valB) return isDesc ? 1 : -1;
                    if (valA > valB) return isDesc ? -1 : 1;
                    return 0;
                });
            }

            return results;
        } catch (e) {
            log.error("PodCube.where() failed:", e);
            return [];
        }
    }

    _formatYear(y) {
        if (y > 0) return y.toString();
        if (y === 0) return "1 BCE";
        return `${Math.abs(y) + 1} BCE`;
    }

    search(query) {
        try {
            if (!query) return [];
            const q = query.toLowerCase();
            return this.episodes.filter(e => {
                const titleMatch = e.title && e.title.toLowerCase().includes(q);
                const descMatch = e.description && e.description.toLowerCase().includes(q);
                const tagMatch = e.tags && e.tags.some(t => t.toLowerCase().includes(q));
                const modelMatch = e.model && e.model.toLowerCase().includes(q);
                const originMatch = e.origin && e.origin.toLowerCase().includes(q);
                const yearMatch = e.date && e.date.year && e.date.year.toString().includes(q);
                // Check the full formatted date string (e.g. searching for "BCE")
                const dateStringMatch = e.date && e.date.toString().toLowerCase().includes(q);

                return titleMatch || descMatch || tagMatch || modelMatch || originMatch || yearMatch || dateStringMatch;
            });
        } catch (e) {
            log.error("Search failed:", e);
            return [];
        }
    }

    get nowPlaying() {
        return this._queue.length > 0 && this._queueIndex >= 0 && this._queueIndex < this._queue.length
            ? this._queue[this._queueIndex]
            : null;
    }

    get status() {
        const duration = this._audio.duration;
        const percent = duration && isFinite(duration)
            ? (this._audio.currentTime / duration) * 100
            : 0;

        return {
            // Playback State
            playing: !this._audio.paused,
            loading: this._isLoading,
            time: this._audio.currentTime,
            duration: duration || 0,
            remaining: Math.max(0, (duration || 0) - this._audio.currentTime),
            percent: percent,
            playbackRate: this._audio.playbackRate || 1,
            volume: this._volume,

            // Current Track
            episode: this.nowPlaying,
            episodeId: this.nowPlaying?.id || null,
            episodeTitle: this.nowPlaying?.title || null,

            // Queue State
            queueLength: this._queue.length,
            queuePosition: this._queueIndex + 1, // 1-indexed for humans
            queueIndex: this._queueIndex,
            queueRemaining: Math.max(0, this._queue.length - this._queueIndex - 1),
            queueDuration: this.queueDuration,
            nextEpisode: this._queue[this._queueIndex + 1] || null,
            stopAfterCurrent: this._stopAfterCurrent,

            // Buffer/Network State
            networkState: this._audio.networkState,
            readyState: this._audio.readyState,
            buffered: this._audio.buffered.length > 0
                ? Array.from({ length: this._audio.buffered.length }, (_, i) => ({
                    start: this._audio.buffered.start(i),
                    end: this._audio.buffered.end(i)
                }))
                : [],
            seeking: this._audio.seeking,

            // System State
            initialized: this.isReady,
            feedType: CONFIG.FEED_TYPE,
            feedUrl: this._lastFetchedUrl || null,
            lastFetchTime: this._lastFetchTime || null,
            debug: CONFIG.DEBUG,

            // Statistics
            totalEpisodes: this.episodes.length,
            hasSession: !!localStorage.getItem('podcube_session'),

            // Timestamps
            timestamp: Date.now(),
            currentTimeFormatted: this._formatTime(this._audio.currentTime),
            durationFormatted: this._formatTime(duration),
            remainingFormatted: this._formatTime(Math.max(0, (duration || 0) - this._audio.currentTime))
        };
    }

    // Helper method
    _formatTime(seconds) {
        if (!seconds || !isFinite(seconds)) return "0:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // --- PLAYBACK CONTROLS ---

    async _loadAndPlay(autoPlay = true) {
        try {
            const ep = this.nowPlaying;
            if (!ep || !ep.audioUrl) {
                log.warn("No playable episode.");
                return;
            }

            // Race Condition Protection: Increment token to invalidate previous requests
            const token = ++this._loadingToken;
            this._isLoading = true;
            this._hasPreloadedNext = false;
            
            // Clean up any previous object URLs if they exist
            if (this._currentObjectUrl) {
                URL.revokeObjectURL(this._currentObjectUrl);
                this._currentObjectUrl = null;
            }

            // Direct stream assignment
            this._audio.src = ep.audioUrl;
            this._audio.volume = this._volume;
            
            // We do not await 'canplay' here to keep the UI responsive.
            // HTML5 audio handles buffering automatically.

            // Check token again before playing
            if (token !== this._loadingToken) return; 

            if ('mediaSession' in navigator && ep) {
                // Determine artwork: use feed image if parsed, otherwise fallback to local asset
                const artworkUrl = this.logo || './PODCUBE.png';

                navigator.mediaSession.metadata = new MediaMetadata({
                    title: ep.title,
                    artist: ep.model || 'PodCube™ Transmission',
                    album: ep.location || 'Unknown Origin',
                    artwork: [
                        { src: artworkUrl, sizes: '512x512', type: 'image/png' },
                        { src: artworkUrl, sizes: '192x192', type: 'image/png' }
                    ]
                });
            }

            if (autoPlay) {
                try {
                    await this._audio.play();
                } catch (playErr) {
                    log.warn("Auto-play blocked or failed:", playErr);
                    this._emit('error', { episode: ep, error: playErr });
                }
            }
            
            this._isLoading = false;
            this._emit('track', ep);
        } catch (e) {
            this._isLoading = false;
            log.error("Load/play failed:", e);
            this._emit('error', { episode: this.nowPlaying, error: e });
        }
    }

    _preloadNext() {
        // NOTE: MAYBE IMPLEMENT GHOST PLAYER SWAPPING FOR GAPLESS PLAYBACK SUPPORT
        return;
    }

    _cancelPreload() {
        this._hasPreloadedNext = false; // Allow preloading again for the NEW next track
    }

    async play(episode) {
        try {
            if (episode) {
                this.addToQueue(episode, true);
                return;
            }

            // If empty but in Radio Mode, fetch a track before failing
            if (!this.nowPlaying && this._radioMode) {
                const nextTrack = this.random;
                if (nextTrack) {
                    this.addToQueue(nextTrack, true);
                    return;
                }
            }

            if (!this.nowPlaying) {
                log.warn("Cannot play: Queue is empty.");
                return;
            }

            // Guard: If we have a track but audio isn't loaded yet (e.g. stopped state)
            if (!this._audio.src || this._audio.src === '' || this._audio.src === window.location.href) {
                await this._loadAndPlay();
            } else {
                await this._audio.play();
            }
        } catch (e) {
            log.error("Play failed:", e);
            this._emit('error', { episode: this.nowPlaying, error: e });
        }
    }

    pause() {
        try {
            this._audio.pause();
        } catch (e) {
            log.error("Pause failed:", e);
        }
    }

    toggle() {
        try {
            // Case 1: Audio is already loaded (Paused or Playing)
            if (this._audio.hasAttribute('src')) {
                this._audio.paused ? this.play() : this.pause();
                return;
            }

            // Case 2: No track loaded, but Queue has items
            if (this._queue.length > 0) {
                // If we haven't started the queue yet (index -1), start at the beginning
                if (this._queueIndex === -1) {
                    this._queueIndex = 0;
                }
                
                // If we have a valid track now, play it
                if (this.nowPlaying) {
                    log.info("Toggle: Starting playback from queue");
                    this.play(); // play() handles _loadAndPlay() automatically
                    return;
                }
            }

            // Case 3: Nothing to do
            log.warn("Toggle failed: No track loaded and queue is empty");
        } catch (e) {
            log.error("Toggle failed:", e);
        }
    }

    

    next() {
        try {
            //  Check Soft Stop
            if (this._stopAfterCurrent) {
                log.info("Soft stop reached. Halting playback.");
                this.pause();
                this._stopAfterCurrent = false; // Reset flag
                return;
            }

            //  Normal Advance
            if (this._queueIndex < this._queue.length - 1) {
                this._queueIndex++;
                this._loadAndPlay();
            } else {
                log.info("Queue finished");

                // If we're in Radio Mode, pick another track at random.
                if (this._radioMode){
                    const nextTrack = this.random;
                    if (nextTrack) {
                        this.addToQueue(nextTrack, false);
                        this.next();
                        return;
                    }
                }
                this.pause();
                this._emit('queueEnd'); // Optional: new event
            }
        } catch (e) {
            log.error("Next failed:", e);
        }
    }

    prev() {
        try {
            // If we have played more than 3 seconds, just restart the track
            if (this._audio.currentTime > 3) {
                this._audio.currentTime = 0;
            }
            // If we are at the start, go to previous track
            else if (this._queueIndex > 0) {
                this._queueIndex--;
                this._loadAndPlay();
            }
            // Edge case: First track, start of track -> Restart anyway to be responsive
            else if (this._queueIndex === 0) {
                this._audio.currentTime = 0;
                // Optionally play if paused?
                if (this._audio.paused) this.play();
            }
        } catch (e) {
            log.error("Previous failed:", e);
        }
    }

    seek(seconds) {
        try {
            this._audio.currentTime = Math.max(0, seconds);
        } catch (e) {
            log.error("Seek failed:", e);
        }
    }

    skipForward() {
        try {
            const newTime = this._audio.currentTime + CONFIG.SKIP_FORWARD;
            this._audio.currentTime = Math.min(newTime, this._audio.duration || Infinity);
            log.info(`Skipped forward ${CONFIG.SKIP_FORWARD}s`);
        } catch (e) {
            log.error("Skip forward failed:", e);
        }
    }

    skipBack() {
        try {
            const newTime = this._audio.currentTime - CONFIG.SKIP_BACK;
            this._audio.currentTime = Math.max(0, newTime);
            log.info(`Skipped back ${CONFIG.SKIP_BACK}s`);
        } catch (e) {
            log.error("Skip back failed:", e);
        }
    }

    stopAfterCurrent() {
        this._stopAfterCurrent = true;
        log.info("Engine will stop after current track");
    }

    cancelStopAfterCurrent() {
        this._stopAfterCurrent = false;
        log.info("Soft stop cancelled");
    }

    setRadioMode(enabled) {
        this._radioMode = !!enabled;
        log.info(`Radio Mode set to: ${this._radioMode}`);

        // Check if queue is empty or finished
        const isQueueEmpty = this._queue.length === 0;
        const isQueueFinished = this._queueIndex >= this._queue.length - 1;

        if (this._radioMode && (isQueueEmpty || isQueueFinished)) {
            const nextTrack = this.random;
            
            if (nextTrack) {
                // Add track to queue (this emits queue:changed with the OLD index)
                this.addToQueue(nextTrack, false);

                if (this._queueIndex === -1) {
                    this._queueIndex = 0;
                    
                    // Passing 'false' prevents it from blasting audio immediately.
                    this._loadAndPlay(false); 
                    
                    // Sync the session immediately
                    this._saveSession();
                } 
                // If we were just at the end of the list, we don't auto-load 
            }
        }
    }
    setPlaybackRate(rate) {
        try {
            if (rate < 0.02 || rate > 16) {
                log.warn(`Playback rate ${rate} outside supported range (0-16)`);
                return false;
            }
            this._audio.playbackRate = rate;
            log.info(`Playback rate set to ${rate}x`);
            return true;
        } catch (e) {
            log.error("Set playback rate failed:", e);
            return false;
        }
    }

    getPlaybackRate() {
        return this._audio.playbackRate || 1;
    }

    setVolume(level) {
        // Clamp between 0.0 and 1.0
        const vol = Math.max(0, Math.min(1, parseFloat(level)));
        this._volume = vol;

        if (this._audio) {
            this._audio.volume = vol;
        }
        return vol;
    }

    getVolume() {
        return this._volume;
    }

    // --- QUEUE MANAGEMENT ---

    get queueItems() {
        return [...this._queue]; // Return a copy to prevent direct mutation
    }

    get queueIndex() {
        return this._queueIndex;
    }

    get queueDuration() {
        if (this._queue.length === 0) return 0;

        let total = 0;

        // Add remaining time of current track
        const currentEp = this._queue[this._queueIndex];
        if (currentEp) {
            if (this._audio.duration && !this._audio.paused) {
                // If playing, use actual remaining time
                total += Math.max(0, this._audio.duration - this._audio.currentTime);
            } else {
                // If paused/stopped, use full duration
                total += currentEp.duration || 0;
            }
        }

        // Add duration of all future tracks
        for (let i = this._queueIndex + 1; i < this._queue.length; i++) {
            total += this._queue[i].duration || 0;
        }

        return total;
    }

    addToQueue(input, playNow = false) {
        try {
            // 1. Normalize input to an array
            const inputs = Array.isArray(input) ? input : [input];

            // 2. Validate inputs are Episodes (Clean API: Expects Objects)
            const validEpisodes = inputs.filter(ep => ep instanceof Episode);
            
            // If caller passed IDs or something else, warn them
            if (validEpisodes.length < inputs.length) {
                log.warn("addToQueue: Some inputs were not valid Episode objects.");
            }

            if (validEpisodes.length === 0) return;

            if (playNow) {
                if (this._queueIndex === -1) {
                    // If nothing is playing, just replace/start the queue
                    this._queue = [...validEpisodes];
                    this.next();
                } else {
                    // Insert new episodes immediately after the current one
                    this._queue.splice(this._queueIndex + 1, 0, ...validEpisodes);
                    this.next();
                }
            } else {
                // Standard append to the end
                this._queue.push(...validEpisodes);
            }

            // --- ROTATING BUFFER LOGIC ---
            const MAX_QUEUE_SIZE = 400; //
            if (this._queue.length > MAX_QUEUE_SIZE) {
                const overflow = this._queue.length - MAX_QUEUE_SIZE;
                // Remove from the start of the queue
                this._queue.splice(0, overflow);
                // Adjust current index so playback doesn't skip
                this._queueIndex = Math.max(-1, this._queueIndex - overflow);
                log.info(`Queue rotated: removed ${overflow} oldest tracks.`);
            }

            this._emit('queue:changed', { queue: this._queue, index: this._queueIndex });
            this._saveSession(); // Save queue to session

            return {
                count: validEpisodes.length,
                queueLength: this._queue.length
            };
        } catch (e) {
            log.error("addToQueue failed:", e);
        }
    }

    addNextInQueue(episode) {
        if (!episode) return;
        // If nothing is playing, just play it
        if (this._queueIndex === -1) {
            return this.play(episode);
        }
        // Insert immediately after the current index
        this._queue.splice(this._queueIndex + 1, 0, episode);
        this._emit('queue:changed', { queue: this._queue, index: this._queueIndex });
        this._saveSession();
        log.info(`Enqueued next: ${episode.title}`);
    }

    shuffleQueue() {
    try {
        // Fisher-Yates shuffle
        const current = this._queueIndex;
        const currentEp = this.nowPlaying;
        
        // Remove current episode temporarily
        if (current >= 0) {
            this._queue.splice(current, 1);
        }
        
        // Shuffle remaining
        for (let i = this._queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this._queue[i], this._queue[j]] = [this._queue[j], this._queue[i]];
        }
        
        // Put current episode back at front
        if (currentEp) {
            this._queue.unshift(currentEp);
            this._queueIndex = 0;
        } else {
            this._queueIndex = -1;
        }
        
        this._emit('queue:changed', {queue: this._queue, index: this._queueIndex});
        this._saveSession(); // Save queue to session
        log.info("Queue shuffled");
    } catch (e) {
        log.error("Shuffle failed:", e);
    }
}

    clearQueue() {
        this._queue = [];
        this._queueIndex = -1;
        
        this._cancelPreload();
        this._stopAfterCurrent = false;
        this.pause();
        
        this._clearSession(); 

        if (this._currentObjectUrl) {
            URL.revokeObjectURL(this._currentObjectUrl);
            this._currentObjectUrl = null;
        }
        this._audio.removeAttribute('src');

        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = null;
        }

        this._emit('queue:changed', {queue: [], index: -1});

        log.info("Queue cleared");
    }

    removeFromQueue(index) {
        if (index < 0 || index >= this._queue.length) {
            throw new Error(`Invalid queue index: ${index}`);
        }

        const isCurrentTrack = (index === this._queueIndex);
        const wasPlaying = isCurrentTrack && !this._audio.paused;

        // Clean preload if removing next track
        if (index === this._queueIndex + 1) {
            this._cancelPreload();
        }

        this._queue.splice(index, 1);

        // Adjust index BEFORE loading new track
        if (index < this._queueIndex) {
            this._queueIndex--;
        } else if (isCurrentTrack) {
            // Current track was removed
            if (this._queue.length === 0) {
                this._queueIndex = -1;
                this.pause();
                this._audio.removeAttribute('src');
            } else if (this._queueIndex >= this._queue.length) {
                this._queueIndex = this._queue.length - 1;
            }
            // Index stays same, new track shifted into position
        }

        // Load new track if we removed current
        if (isCurrentTrack && this._queue.length > 0 && this._queueIndex >= 0) {
            this._loadAndPlay(wasPlaying);
        } else if (isCurrentTrack) {
            this._emit('track', null);
        }

        this._emit('queue:changed', { queue: this._queue, index: this._queueIndex });
        this._saveSession();
    }


    /**
      * Move a track from one position to another in the queue
      */
    moveInQueue(fromIndex, toIndex) {
        try {
            // Validate indices
            if (fromIndex < 0 || fromIndex >= this._queue.length ||
                toIndex < 0 || toIndex >= this._queue.length) {
                log.warn(`Invalid indices: ${fromIndex} → ${toIndex}`);
                return false;
            }

            if (fromIndex === toIndex) return true;

            // Track if we are moving the currently playing song
            const isMovingCurrent = (fromIndex === this._queueIndex);

            // Remove track from old position
            const [track] = this._queue.splice(fromIndex, 1);

            // Insert at new position
            this._queue.splice(toIndex, 0, track);

            // --- INDEX CORRECTION ---
            if (isMovingCurrent) {
                // If we moved the active track, the index simply becomes the new position
                this._queueIndex = toIndex;
            } else {
                // If we moved a DIFFERENT track, we might need to shift the pointer
                // 1. Moved from ABOVE current to BELOW current -> Pointer must go DOWN (-1)
                if (fromIndex < this._queueIndex && toIndex >= this._queueIndex) {
                    this._queueIndex--;
                }
                // 2. Moved from BELOW current to ABOVE current -> Pointer must go UP (+1)
                else if (fromIndex > this._queueIndex && toIndex <= this._queueIndex) {
                    this._queueIndex++;
                }
            }

            this._emit('queue:changed', { queue: this._queue, index: this._queueIndex });
            this._saveSession(); // Save queue to session
            log.info(`Moved track from ${fromIndex} to ${toIndex}`);
            return true;
        } catch (e) {
            log.error("Move failed:", e);
            return false;
        }
    }

    /**
     * Jump to a specific index in the queue
     */
    skipTo(index) {
        if (index < 0 || index >= this._queue.length) return;
        this._queueIndex = index;
        this._loadAndPlay();
    }

  

    // --- PLAYLIST CREATION AND MANAGEMENT ---

    savePlaylist(name, episodes) {

        const saveableEpisodes = episodes.filter(ep => !ep._excludeFromImport);
        const playlist = {
            name,
            created: new Date().toISOString(),
            episodes: saveableEpisodes.map(ep => ep.id),
            totalDuration: saveableEpisodes.reduce((acc, ep) => acc + (ep.duration || 0), 0)
        };
        localStorage.setItem(`podcube_playlist_${name}`, JSON.stringify(playlist));
        return playlist;
    }

    /**
     * Load playlist by name.
     * Uses centralized findEpisode() for robustness.
     */
    loadPlaylist(name) {
        const data = localStorage.getItem(`podcube_playlist_${name}`);
        if (!data) return null;

        const playlist = JSON.parse(data);
        
        // Map stored IDs back to full Episode objects using central helper
        const episodes = playlist.episodes
            .map(id => this.findEpisode(id))
            .filter(Boolean);

        return { ...playlist, episodes };
    }

    getPlaylists() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('podcube_playlist_'));
        return keys.map(k => {
            const name = k.replace('podcube_playlist_', '');
            return { name, ...this.loadPlaylist(name) };
        });
    }

    deletePlaylist(name) {
        const key = `podcube_playlist_${name}`;
        if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            return true;
        }
        return false;
    }

    renamePlaylist(oldName, newName) {
        if (!newName || newName.trim() === "" || oldName === newName) return false;

        const data = this.loadPlaylist(oldName);
        if (data) {
            // Save the existing episodes under the new name
            this.savePlaylist(newName, data.episodes);
            // Delete the old record
            this.deletePlaylist(oldName);
            log.info(`Playlist "${oldName}" renamed to "${newName}"`);
            return true;
        }
        return false;
    }

    playPlaylist(name) {
        const pl = this.loadPlaylist(name);
        if (!pl || !pl.episodes.length) return false;

        this.clearQueue();
        this.addToQueue(pl.episodes, true);
        return true;
    }

    queuePlaylist(input) {
        let episodes = [];

        // Case 1: Input is a string (a playlist name)
        if (typeof input === 'string') {
            const pl = this.loadPlaylist(input);
            if (!pl || !pl.episodes.length) return false;
            episodes = pl.episodes;
        }
        // Case 2: Input is a playlist data object (from export or import)
        else if (typeof input === 'object' && input !== null && Array.isArray(input.episodes)) {
            episodes = input.episodes;
        }
        else {
            log.error("Invalid playlist input provided to queuePlaylist");
            return false;
        }

        if (episodes.length === 0) return false;

        // Add episodes to queue without clearing or immediate playback
        this.addToQueue(episodes, false);
        return true;
    }

    // --- PLAYLIST SHARING / EXPORT ---

    /**
     * COMPRESS: Nano-GUID v7 (20-bit Stream)
     * Packs 5 hex chars (20 bits) per episode into a continuous byte stream.
     * Safety: 1,048,576 combinations (0.4% collision risk @ 100 eps).
     * Efficiency: ~3.5 chars per episode.
     */
    _compressPlaylist(name, episodes) {
        if (!name || !episodes || episodes.length === 0) return null;
        try {
            // 1. Enforce 32 char limit
            const safeName = name.trim().substring(0, 32); 

            // 2. Plaintext Encoding (URL Safe)
            // We MUST escape dots (.) because we use dot as the delimiter in the final string
            // encodeURIComponent leaves dots alone, so we handle them manually.
            const encodedName = encodeURIComponent(safeName).replace(/\./g, '%2E');

            // 3. Build Hex Stream (ID Packing)
            let hexStream = episodes
                .filter(ep => ep && ep.nanoId)
                .map(ep => ep.nanoId)
                .join('');
            if (hexStream.length === 0) return null;

            if (hexStream.length % 2 !== 0) hexStream += '0';
            
            const bytes = new Uint8Array(hexStream.length / 2);
            for (let i = 0; i < hexStream.length; i += 2) {
                bytes[i / 2] = parseInt(hexStream.substr(i, 2), 16);
            }

            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            
            // ID payload uses Base64URL
            const ids64 = btoa(binary)
                .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

            return `${encodedName}.${ids64}`;

        } catch (e) {
            log.error("Compression failed:", e);
            return null;
        }
    }

    

    /**
     * DECOMPRESS: Unpacks 20-bit stream & Plaintext Titles
     */
    _decompressPlaylist(code) {
        if (!code) return null;
        try {
            const parts = code.split('.');
            if (parts.length !== 2) return null;

            const [namePayload, ids64] = parts;
            
            // 1. Decode Name (Plaintext)
            let name = namePayload;
            try {
                name = decodeURIComponent(namePayload);
            } catch (e) {
                // If decoding fails (rare), keep the raw string
                console.warn("Name decode failed, using raw");
            }

            // 2. Decode IDs
            const binary = atob(ids64.replace(/-/g, '+').replace(/_/g, '/'));
            let hexStream = "";
            for (let i = 0; i < binary.length; i++) {
                hexStream += binary.charCodeAt(i).toString(16).padStart(2, '0');
            }

            const shortIds = [];
            const CHUNK = 5;
            for (let i = 0; i < hexStream.length; i += CHUNK) {
                const chunk = hexStream.substr(i, CHUNK);
                if (chunk.length === CHUNK) shortIds.push(chunk);
            }

            return { name, shortIds };
        } catch (e) {
            console.error('Failed to decompress:', e);
            return null;
        }
    }

    /**
     * Import a playlist from a share code
     */
    importPlaylist(code) {
        const cleanCode = code.trim();
        const data = this._decompressPlaylist(cleanCode);
        
        if (!data) return null;

        const foundEpisodes = [];
        data.shortIds.forEach(shortId => {
            // O(1) Lookup speed improvement
            // We match against the pre-calculated nanoId instead of regexing on the fly
            const match = this.episodes.find(ep => ep.nanoId === shortId.toLowerCase());
            if (match) foundEpisodes.push(match);
        });

        return { 
            name: data.name, 
            episodes: foundEpisodes, 
            totalDuration: foundEpisodes.reduce((acc, ep) => acc + (ep.duration || 0), 0),
            missingCount: data.shortIds.length - foundEpisodes.length 
        };
    }

    /**
     * Export a playlist for sharing
     */
    exportPlaylist(name) {
        // 1. Load the playlist
        const pl = this.loadPlaylist(name);
        if (!pl || !pl.episodes || pl.episodes.length === 0) {
            console.error(`Export failed: Playlist "${name}" empty or not found.`);
            return null;
        }

        const exportableEpisodes = pl.episodes.filter(ep => !ep._excludeFromExport);

        // 2. Compress
        const code = this._compressPlaylist(name, exportableEpisodes);
        if (!code) {
            console.error("Export failed: Compression error.");
            return null;
        }

        // 3. Generate URL with Domain Detection
        let baseUrl;
        // Check if we are running on the main lab domain
        if (window.location.hostname === "bodgelab.com") {
            baseUrl = "https://bodgelab.com/s/podcube/";
        } else {
            // Fallback for local testing or poweredbypodcube.com
            baseUrl = window.location.origin + window.location.pathname;
        }

        const url = new URL(baseUrl);
        url.searchParams.set('importPlaylist', code);

        return {
            name,
            episodes: exportableEpisodes,
            code,
            totalDuration: pl.totalDuration,
            url: url.toString()
        };
    }

    getImportCodeFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const url = new URL(window.location.href);
        url.searchParams.delete('importPlaylist');
        window.history.replaceState({}, document.title, url.toString());
        return params.get('importPlaylist') || null;
    }

    // --- DISCOVERY & BROWSING ---

    sortBy(field, reverse = false) {
        const sorted = [...this.episodes].sort((a, b) => {
            const aVal = a[field];
            const bVal = b[field];

            if (aVal < bVal) return reverse ? 1 : -1;
            if (aVal > bVal) return reverse ? -1 : 1;
            return 0;
        });
        return sorted;
    }

    /**
     * Find episodes related to a given episode by shared metadata (fuzzy)
     */
    findRelated(episode, limit = 10) {
        if (!episode) return [];

        const targetTags = new Set(episode.tags || []);
        const modelPrefix = episode.model ? episode.model.substring(0, 3).toLowerCase() : null;

        // Minimum score required to be considered "related" (prevents broad/random matches)
        const MIN_RELATED_THRESHOLD = 7;

        return this.episodes
            .filter(e => e !== episode)
            .map(e => {
                let score = 0;
                const basis = {}; // Debugging object

                // 1. Model Matching
                if (e.model === episode.model && e.model) {
                    score += 12; basis.model = "Exact Match (+12)";
                } else if (modelPrefix && e.model && e.model.toLowerCase().startsWith(modelPrefix)) {
                    score += 4; basis.model = "Series Prefix (+4)";
                }

                // 2. Geographic Tier Matching (The "Baraboo" Logic)
                if (e.origin === episode.origin && e.origin) {
                    score += 10; basis.origin = "Origin Match (+10)";
                }
                if (e.locale === episode.locale && e.locale) {
                    score += 6; basis.locale = "Locale Match (+6)";
                }
                if (e.region === episode.region && e.region) {
                    score += 4; basis.region = "Region Match (+4)";
                }
                // Planet is excluded or set to 0 to prevent "Everything on Earth" from matching
                if (e.zone === episode.zone && e.zone && e.zone !== "USA") {
                    score += 2; basis.zone = "Zone Match (+2)";
                }

                // 3. Shared Tags
                let tagMatches = 0;
                if (e.tags) {
                    e.tags.forEach(t => {
                        if (targetTags.has(t)) {
                            score += 3;
                            tagMatches++;
                        }
                    });
                }
                if (tagMatches > 0) basis.tags = `${tagMatches} tags (+${tagMatches * 3})`;

                // 4. Temporal Proximity
                if (e.date && episode.date && e.date.year === episode.date.year && e.date.year !== 0) {
                    score += 5; basis.time = "Same Lore Year (+5)";
                }

                return { ep: e, score, basis };
            })
            .filter(item => item.score >= MIN_RELATED_THRESHOLD) // Remove weak matches
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(item => {
                // Attach debug info to a non-enumerable property for the Inspector
                item.ep._scoreBasis = item.basis;
                item.ep._totalScore = item.score;
                return item.ep;
            });
    }

    /**
     * Get episodes in release order (newest first by default)
     */
    getByReleaseOrder(reverse = false) {
        try {
            const sorted = [...this.episodes];
            sorted.sort((a, b) => b.published - a.published);
            if (reverse) {
                return sorted.reverse();
            }
            return sorted;
        } catch (e) {
            log.error("Failed to sort by release order:", e);
            return this.episodes;
        }
    }

    /**
     * Get episodes in chronological order (by lore date, oldest first)
     * Filters out episodes without lore dates
     */
    getByChronologicalOrder(reverse = false) {
        try {
            const withDates = this.episodes.filter(e => e.date && e.date.year);
            const sorted = withDates.sort((a, b) => {
                const yearDiff = a.date.year - b.date.year;
                if (yearDiff !== 0) return yearDiff;
                const monthDiff = a.date.month - b.date.month;
                if (monthDiff !== 0) return monthDiff;
                return a.date.day - b.date.day;
            });

            if (reverse) {
                return sorted.reverse();
            }
            return sorted;
        } catch (e) {
            log.error("Failed to sort by chronological order:", e);
            return [];
        }
    }

    // Convenience methods
    getByTitle(reverse = false) {
        return this.sortBy('title', reverse);
    }

    getByDuration(reverse = false) {
        return this.sortBy('duration', reverse);
    }

    getByIntegrity(reverse = false) {
        return this.sortBy('integrityValue', reverse);
    }

    // Lists all episodes flagged as having problematic metadata
    getIssues() {
        return this.where({ hasIssues: true });
    }

    /**
     * Get all unique combinations of metadata for browsing
     * Single-pass aggregation of all faceted data
     */
    getDistribution() {
        try {
            const keys = ['model', 'origin', 'region', 'zone', 'planet', 'locale'];
            const data = { tags: {} };
            
            // Initialize counters
            keys.forEach(k => data[k] = {});

            // Single pass aggregation (O(N))
            for (const ep of this.episodes) {
                // Count Standard Keys
                keys.forEach(k => {
                    if (ep[k]) data[k][ep[k]] = (data[k][ep[k]] || 0) + 1;
                });

                // Count Tags
                if (Array.isArray(ep.tags)) {
                    for (const tag of ep.tags) {
                        data.tags[tag] = (data.tags[tag] || 0) + 1;
                    }
                }
            }

            // Helper: Convert {Key: Count} object to [{name, count}] array
            const toArray = (obj) => Object.entries(obj)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => a.name.localeCompare(b.name));

            // Return aggregated object
            const result = {};
            keys.forEach(k => result[k + 's'] = toArray(data[k])); // e.g. model -> models
            result.tags = toArray(data.tags);
            
            return result;
        } catch (e) {
            log.error("Failed to generate distribution:", e);
            return { models: [], origins: [], tags: [], regions: [], zones: [], planets: [], locales: [] };
        }
    }
    
    getStatistics() {
        const withDuration = this.episodes.filter(e => e.duration);
        const totalDuration = withDuration.reduce((sum, e) => sum + e.duration, 0);

        const withDates = this.episodes.filter(e => e.date && e.date.year);
        const years = withDates.map(e => e.date.year);
        const yearRange = years.length > 0
            ? { min: Math.min(...years), max: Math.max(...years) }
            : null;

        const withIntegrity = this.episodes.filter(e => e.integrityValue !== null);
        const avgIntegrity = withIntegrity.length > 0 
            ? Math.round(withIntegrity.reduce((sum, e) => sum + e.integrityValue, 0) / withIntegrity.length) 
            : 0;

        return {
            totalEpisodes: this.episodes.length,
            totalDuration,
            averageDuration: withDuration.length > 0 ? totalDuration / withDuration.length : 0,
            averageIntegrity: avgIntegrity,
            episodesWithDates: withDates.length,
            episodesWithAudio: this.episodes.filter(e => e.audioUrl).length,
            episodesWithIntegrity: withIntegrity.length,
            yearRange,
            models: this.models.length,
            origins: this.origins.length,
            types: [...new Set(this.episodes.map(e => e.episodeType))].length
        };
    }

    /**
     * Get episode index in the episode array (release order)
     */
    getEpisodeIndex(episode) {
        return this.episodes.indexOf(episode);
    }

    /**
     * Get next episode in release order
     */
    getNextEpisode(episode) {
        try {
            const index = this.getEpisodeIndex(episode);
            if (index === -1 || index >= this.episodes.length - 1) {
                return null;
            }
            return this.episodes[index + 1];
        } catch (e) {
            log.error("Failed to get next episode:", e);
            return null;
        }
    }

    /**
     * Get previous episode in release order
     */
    getPreviousEpisode(episode) {
        try {
            const index = this.getEpisodeIndex(episode);
            if (index <= 0) {
                return null;
            }
            return this.episodes[index - 1];
        } catch (e) {
            log.error("Failed to get previous episode:", e);
            return null;
        }
    }



    // --- EVENT BUS STUFF ---

    once(event, cb) {
        const wrapper = (data) => {
            this.off(event, wrapper); // This is correct, but...
            cb(data);
        };
        wrapper._originalCallback = cb; // Tag for cleanup
        this.on(event, wrapper);
        return () => this.off(event, wrapper);
    }

    
    on(event, cb) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(cb);

        return () => this.off(event, cb);
    }

    off(event, cb) {
        if (!this._listeners[event]) return;

        if (!cb) {
            delete this._listeners[event];
            return;
        }

        // Remove by reference OR by tagged original
        this._listeners[event] = this._listeners[event].filter(
            listener => listener !== cb && listener._originalCallback !== cb
        );

        if (this._listeners[event].length === 0) {
            delete this._listeners[event];
        }
    }


    _emit(event, data) {
        try {
            if (this._listeners[event]) {
                // COPY the array via [...spread] before iterating
                // This prevents crashes if a listener removes itself during execution
                [...this._listeners[event]].forEach(cb => {
                    try {
                        cb(data);
                    } catch (e) {
                        log.error(`Event handler for "${event}" failed:`, e);
                    }
                });
            }
        } catch (e) {
            log.error("Event emission failed:", e);
        }
    }
// --- SESSION MANAGEMENT (LOCAL CACHE) ---

    _saveSession() {
        // Save if we have a queue, regardless of whether something is playing
        if (this._queue.length === 0) {
            this._clearSession();
            return;
        }

        const state = {
            version: 1,
            timestamp: Date.now(),
            queue: this._queue.map(ep => ep.id),
            queueIndex: this._queueIndex,
            currentTime: this.nowPlaying ? this._audio.currentTime : 0,
            epID: this.nowPlaying ? this.nowPlaying.id : null,
            isPlaying: this.nowPlaying ? !this._audio.paused : false
        };

        try {
            localStorage.setItem('podcube_session', JSON.stringify(state));
        } catch (e) {
            // Quota exceeded or disabled
        }
    }

    _clearSession() {
        localStorage.removeItem('podcube_session');
    }

    /**
 * Attempt to restore the previous session.
 */
async restoreSession() {
    try {
        const raw = localStorage.getItem('podcube_session');
        if (!raw) return false;

        const state = JSON.parse(raw);

        // Validate session structure
        if (!state.version || state.version !== 1) {
            log.warn("Incompatible session version, clearing");
            this._clearSession();
            return false;
        }

        // Check for stale sessions (older than 7 days)
        const age = Date.now() - state.timestamp;
        const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (age > MAX_AGE) {
            log.warn("Session is stale (>7 days), clearing");
            this._clearSession();
            return false;
        }

        // Validate queue data
        if (!Array.isArray(state.queue) || state.queue.length === 0) {
            log.warn("Invalid queue data, clearing session");
            this._clearSession();
            return false;
        }

        // Reconstruct Queue
        const queue = state.queue
            .map(id => this.episodes.find(e => e.id === id))
            .filter(Boolean);

        if (queue.length === 0) {
            log.warn("None of the queued episodes exist anymore");
            this._clearSession();
            return false;
        }

        // Restore State
        this._queue = queue;
        this._queueIndex = Math.min(state.queueIndex, queue.length - 1);

        this._emit('queue:changed', { queue: this._queue, index: this._queueIndex });

        if (!state.epID) {
            log.info(`Session restored: ${queue.length} items (nothing playing)`);
            return true;
        }

        const currentEp = this._queue[this._queueIndex];

        // More graceful handling of episode mismatch
        if (!currentEp || currentEp.id !== state.epID) {
            log.warn("Episode mismatch, restoring queue only");
            this._queueIndex = 0; // Reset to start of queue
            this._emit('queue:changed', { queue: this._queue, index: this._queueIndex });
            return true; // Partial success
        }

        const shouldPlay = state.isPlaying;
        log.info(`Restoring session... AutoResume: ${shouldPlay}`);

        await this._loadAndPlay(false);

        // Instead of immediately setting currentTime, wait for loadedmetadata event
        await new Promise((resolve) => {
            const audio = this._audio;
            const timeoutId = setTimeout(handleMetadataLoaded, 3000); // 3 second safety timeout
            
            function handleMetadataLoaded() {
                audio.removeEventListener('loadedmetadata', handleMetadataLoaded);
                clearTimeout(timeoutId);
                
                // Now safe to set currentTime
                if (state.currentTime && state.currentTime > 0) {
                    // Ensure we don't exceed duration
                    const safeTime = Math.min(state.currentTime, audio.duration || state.currentTime);
                    audio.currentTime = safeTime;
                    log.info(`Session: Restored playback position to ${safeTime.toFixed(2)}s`);
                }
                
                resolve();
            }
            
            // If metadata is already loaded, call immediately
            if (audio.readyState >= audio.HAVE_METADATA) {
                handleMetadataLoaded();
            } else {
                // Otherwise wait for the event
                audio.addEventListener('loadedmetadata', handleMetadataLoaded, { once: true });
            }
        });

        // Now resume playback if needed
        if (shouldPlay) {
            try {
                await this._audio.play();
                log.info(`Session: Auto-resume playback`);
            } catch (e) {
                log.warn("Auto-resume blocked:", e);
                // Don't clear session just because autoplay was blocked
            }
        }

        log.info(`Session fully restored: "${currentEp.title}"`);
        return true;
    } catch (e) {
        log.error("Session restoration failed:", e);
        this._clearSession();
        return false;
    }
}


    // DESTROY AND CLEAN UP EVERYTHING
    destroy() {

        this._clearSession();

        // Stop playback
        this.pause();

        // Clear queue
        this.clearQueue();

        // Remove all event listeners
        this._listeners = {};

        // Clear audio
        if (this._audio) {
            this._audio.src = '';
            this._audio = null;
        }

        if (this._preloader) {
            this._preloader.src = '';
            this._preloader = null;
        }

        log.info("PodCube destroyed");
    }
}


const PodCubeInstance = new PodCubeEngine();
PodCubeInstance.Episode = Episode;


if (typeof window !== 'undefined') {
    window.PodCube = PodCubeInstance;

    // Dispatch a custom event so non-module scripts know we are ready
    window.dispatchEvent(new CustomEvent('PodCube:Ready', {
        detail: PodCubeInstance
    }));

    console.log("%cPodCube API is ready! Access it via window.PodCube", "font-weight: bold;");
}


export const PodCube = PodCubeInstance;