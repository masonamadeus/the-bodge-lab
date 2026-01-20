/**
 * Represents a podcast episode with all its metadata and audio information.
 * This class handles the structured data for each episode including location hierarchy,
 * recording details, and playback information.
 */
export class Episode {
    /**
     * List of all properties that define an episode's data structure.
     * Each property is documented with its purpose and usage within the application.
     * @type {string[]}
     */
    static propertyList = [
        // Core Identification
        "id",           // Unique identifier for database/cache operations
        "title",        // Cleaned and formatted episode title
        "shortcode",    // Episode reference code
        "rawTitle",     // Original unprocessed title
        
        // Temporal Information
        "rawDate",      // Internal Date object for recording date
        "date",         // Formatted short date string
        "longDate",     // Full formatted date with weekday
        "published",    // Publication timestamp
        
        // Recording Information
        "model",        // Recording device model identifier
        "integrityFloat", // Raw integrity value (0-100)
        "integrity",    // Formatted integrity with % symbol
        
        // Location Hierarchy
        "origin",       // Primary recording location
        "locale",       // Specific area within origin
        "region",       // Broader geographical region
        "zone",         // Administrative or geological zone
        "planet",       // Planetary body identifier
        
        // Content Metadata
        "tags",         // Array of categorical tags
        "description",  // Full episode description/notes
        
        // Audio Properties
        "audioUrl",     // Direct link to audio file
        "duration",     // Length in seconds
        "size",         // File size in bytes
    ];
    
    /**
     * Creates a new Episode instance from raw data.
     * @param {Object} data - Raw episode data
     * @param {string} [data.id] - Unique episode identifier
     * @param {string} [data.title] - Episode title
     * @param {string} [data.shortcode] - Episode reference code
     * @param {string} [data.rawTitle] - Original unprocessed title
     * @param {string|Date} [data.date] - Recording date
     * @param {string|Date} [data.published] - Publication date
     * @param {string} [data.model] - Recording device model
     * @param {number|string} [data.integrity] - Data integrity percentage
     * @param {string} [data.origin] - Primary recording location
     * @param {string} [data.locale] - Specific area
     * @param {string} [data.region] - Geographical region
     * @param {string} [data.zone] - Administrative zone
     * @param {string} [data.planet] - Planetary body
     * @param {string[]} [data.tags] - Episode tags
     * @param {string} [data.audioUrl] - Audio file URL
     * @param {number} [data.duration] - Duration in seconds
     * @param {number} [data.size] - File size in bytes
     * @param {string} [data.description] - Episode description
     */    
    
    constructor(data) {
        // Core Identification
        this.id = data.id || null;
        this.title = data.title || "Untitled";
        this.shortcode = data.shortcode || "";
        this.rawTitle = data.rawTitle || "";
        
        // Temporal Information
        this.rawDate = data.date ? new PodCube.Class.PodCubeDate(data.date) : null;
        this.published = data.published ? new Date(data.published) : null;
        
        // Recording Information
        this.model = data.model || "Unknown";
        this.integrityFloat = parseFloat(data.integrity) || 0;
        
        // Location Hierarchy
        this.origin = data.origin || "Unknown";
        this.locale = data.locale || "";
        this.region = data.region || "";
        this.zone = data.zone || "";
        this.planet = data.planet || "";
        
        // Content Metadata
        this.tags = Array.isArray(data.tags) ? data.tags : [];
        this.description = data.description || "";
        
        // Audio Properties
        this.audioUrl = data.audioUrl || null;
        this.rawDuration = data.duration || 0;
        this.size = data.size || 0;
    }

    /**
     * Gets the full hierarchical location string.
     * Combines origin, locale, region, zone, and planet into a comma-separated string,
     * filtering out any empty values.
     * @returns {string} Formatted location string
     */
    get location() {
        return [this.origin, this.locale, this.region, this.zone, this.planet]
            .filter(Boolean)
            .join(", ");
    }

    get locationNewLines() {
        return [
            this.origin, 
            this.locale, 
            this.region, 
            this.zone, 
            this.planet
        ]
        .filter(Boolean)
        .join("\n");
    }

    get longDate() {
        return this.rawDate ? this.rawDate.toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        }) : "";
    }

    get date() { 
        return this.rawDate ? this.rawDate.toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }) : "";
    }

        get tillToday() {
        if (!this.rawDate) {
            return "Unknown";
        }

        const todayNative = new Date();
        const todayPodCube = new PodCube.Class.PodCubeDate(
            todayNative.getFullYear(),
            todayNative.getMonth(), // 0-indexed
            todayNative.getDate()
        );

        const episodeDate = this.rawDate;

        // Determine if episodeDate is in the past or future relative to today
        // Compare values based on year, month, day for robust ordering
        const episodeValue = episodeDate.getFullYear() * 10000 + (episodeDate.getMonth() + 1) * 100 + episodeDate.getDate();
        const todayValue = todayPodCube.getFullYear() * 10000 + (todayPodCube.getMonth() + 1) * 100 + todayPodCube.getDate();

        const isPast = episodeValue < todayValue;

        // Normalize dates so that the earlier date is `start` and the later is `end`
        let startDate = isPast ? episodeDate : todayPodCube;
        let endDate = isPast ? todayPodCube : episodeDate;

        let years = 0;
        let months = 0;
        let days = 0;

        // Calculate initial year difference
        years = endDate.getFullYear() - startDate.getFullYear();

        // Adjust months and days based on the current month and day of the year
        // We'll advance startDate to match endDate's month/day in the current `years` span
        let tempStartDate = new PodCube.Class.PodCubeDate(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate()
        );

        // Advance tempStartDate year by `years` calculated
        tempStartDate.year += years;

        // If tempStartDate (now in endDate's year) is after endDate, decrement years
        // This is the core logic for calculating full years correctly
        if (tempStartDate.getMonth() > endDate.getMonth() ||
            (tempStartDate.getMonth() === endDate.getMonth() && tempStartDate.getDate() > endDate.getDate())) {
            years--;
            // tempStartDate.year--; // No need to roll back tempStartDate, as we don't use it directly again after this comparison
        }

        // Now calculate remaining months and days
        // Calculate difference from the 'true' anniversary date (startDate with `years` added, potentially rolled back)
        // to endDate.
        let actualStartForMonthDayCalc = new PodCube.Class.PodCubeDate(
            startDate.getFullYear() + years,
            startDate.getMonth(),
            startDate.getDate()
        );

        // Month difference
        months = endDate.getMonth() - actualStartForMonthDayCalc.getMonth();
        if (months < 0) {
            months += 12;
        }

        // Day difference
        days = endDate.getDate() - actualStartForMonthDayCalc.getDate();
        if (days < 0) {
            months--; // Borrow a month
            // Get the number of days in the month *before* endDate's current month, but for endDate's year
            // This is the number of days we add to `days` to make it positive.
            let daysInPreviousMonthOfEndDate = PodCube.Class.PodCubeDate.getDaysInMonth(endDate.getFullYear(), endDate.getMonth() === 0 ? 11 : endDate.getMonth() - 1);
            days += daysInPreviousMonthOfEndDate;
        }

        // Final check for negative months after day adjustment (edge case)
        if (months < 0) {
            // This should ideally not happen if years were calculated correctly,
            // but is a safeguard.
            years--;
            months += 12;
        }

        const parts = [];

        if (years > 0) {
            parts.push(`${years} year${years === 1 ? '' : 's'}`);
        }
        if (months > 0) {
            parts.push(`${months} month${months === 1 ? '' : 's'}`);
        }
        // Only include days if it's positive, or if it's 'today' and there are no other parts
        if (days > 0) { // Only push positive days
            parts.push(`${days} day${days === 1 ? '' : 's'}`);
        }

        // Handle cases where the difference is exactly 0 (same date)
        if (parts.length === 0) {
            return "today";
        }

        // Join parts with commas and "and" for the last element
        let result = "";
        if (parts.length === 1) {
            result = parts[0];
        } else if (parts.length === 2) {
            result = `${parts[0]} and ${parts[1]}`;
        } else {
            result = `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
        }

        return `${result} ${isPast ? 'ago' : 'from now'}`;
    }

    get integrity() {
        return this.integrityFloat.toString() + "%";
    }

    get duration() {
        const minutes = Math.floor(this.rawDuration / 60);
        const fractions = (this.rawDuration % 60) / 60;
        const weirdMinutes = (minutes + fractions).toFixed(2);

        // 1% chance to append something weird
        const suffixPool = ["ish", "?", "approx.", "give or take", "in frog time", "🤷‍♂️"];
        const suffix = Math.random() < 0.01
            ? suffixPool[Math.floor(Math.random() * suffixPool.length)]
            : "";

        return `${weirdMinutes}${suffix}`;

    }

    get minutesSeconds() {
        const minutes = Math.floor(this.rawDuration / 60);
        const secs = Math.floor(this.rawDuration % 60);
        return `${minutes < 10 ? '0': ''}${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    /**
     * Creates a JSON representation of the episode.
     * Useful for serialization and data transfer.
     * @returns {Object} JSON-compatible object with all episode properties
     */    toJSON() {
        return {
            // Core Identification
            id: this.id,
            title: this.title,
            shortcode: this.shortcode,
            rawTitle: this.rawTitle,
            
            // Temporal Information
            rawDate: this.rawDate,
            date: this.date,
            longDate: this.longDate,
            published: this.published?.toISOString(),
            
            // Recording Information
            model: this.model,
            integrityFloat: this.integrityFloat,
            integrity: this.integrity,
            
            // Location Hierarchy
            origin: this.origin,
            locale: this.locale,
            region: this.region,
            zone: this.zone,
            planet: this.planet,
            
            // Content Metadata
            tags: [...this.tags],
            description: this.description,
            
            // Audio Properties
            audioUrl: this.audioUrl,
            duration: this.duration,
            size: this.size
        };
    }
}

