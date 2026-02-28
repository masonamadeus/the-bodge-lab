export class Feed {
    // Constants for filter thresholds
    static MIN_CATEGORY_THRESHOLD = 2; // For tags, models, origins, locations
    static MIN_YEAR_GROUP_THRESHOLD = 5; // This threshold will now guide episode grouping, not year counts

    constructor(metadata, episodes) {
        this.metadata = {
            title: metadata?.title || "PodCube Feed",
            description: metadata?.description || "",
            icon: metadata?.icon || "",
            author: metadata?.author || null,
            total: episodes?.length || 0
        };
        this._allEpisodes = episodes || []; // Store the original, complete list

        // Pre-calculated filter options (populated dynamically)
        this._availableFilterOptions = {
            tags: [],
            models: [],
            origins: [],
            zones: [],
            locales: [],
            regions: [],
            years: [] // This will hold the formatted year strings now
        };

        console.log("Feed constructor called. Calling _generateFilterOptions..."); // Added log
        this._generateFilterOptions(); // Populate available options based on initial data
        console.log("Feed constructor finished. Available years:", this._availableFilterOptions.years); // Added log
    }

    get Episodes() {
        return this._allEpisodes;
    }

    /**
     * Sets the initial list of all episodes.
     * Use this when the raw feed data is loaded or updated.
     * @param {Episode[]} episodes - An array of Episode objects.
     */
    setAllEpisodes(episodes) {
        this._allEpisodes = episodes;
        this.metadata.total = episodes.length;
        console.log("setAllEpisodes called. Re-generating filter options..."); // Added log
        this._generateFilterOptions(); // Re-generate options if base episode data changes
        // No re-application of filters needed as internal state for applied filters is gone
        console.log("setAllEpisodes finished. New available years:", this._availableFilterOptions.years); // Added log
    }

    /**
     * Helper to normalize a tag for comparison (lowercase, remove common plural 's').
     * @param {string} tag - The tag to normalize.
     * @returns {string} The normalized tag.
     * @private
     */
    _normalizeTag(tag) {
        if (typeof tag !== 'string' || !tag) return ''; // Handle non-string or empty inputs
        let normalized = tag.toLowerCase();
        // Basic pluralization: remove trailing 's' unless it's a single 's' or ends with 'ss'
        if (normalized.endsWith('s') && normalized.length > 1 && !normalized.endsWith('ss')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }

    /**
     * Gathers and groups all unique tags, models, origins, and other location fields
     * from the _allEpisodes. This method now populates *all* unique options
     * without applying thresholds or "Misc" categories here.
     * "Misc" handling and thresholding happens in the getEpisodesBy... methods.
     * This method should be called whenever _allEpisodes changes.
     * @private
     */
    _generateFilterOptions() {
        console.log("Entering _generateFilterOptions..."); // Added log
        const uniqueValues = {
            tags: new Set(),
            models: new Set(),
            origins: new Set(),
            zones: new Set(),
            locales: new Set(),
            regions: new Set(),
            years: new Set()
        };

        this._allEpisodes.forEach(ep => {
            if (ep.tags) {
                ep.tags.forEach(tag => uniqueValues.tags.add(this._normalizeTag(tag)));
            }
            if (ep.model) uniqueValues.models.add(ep.model);
            if (ep.origin) uniqueValues.origins.add(ep.origin);
            if (ep.zone) uniqueValues.zones.add(ep.zone);
            if (ep.locale) uniqueValues.locales.add(ep.locale);
            if (ep.region) uniqueValues.regions.add(ep.region);
            if (ep.rawDate) {
                // Ensure rawDate exists and is a valid Date object before calling getFullYear
                const year = ep.rawDate.getFullYear();
                if (!isNaN(year)) { // Check if year is a valid number
                    uniqueValues.years.add(year);
                }
            }
        });

        this._availableFilterOptions.tags = Array.from(uniqueValues.tags).sort();
        this._availableFilterOptions.models = Array.from(uniqueValues.models).sort();
        this._availableFilterOptions.origins = Array.from(uniqueValues.origins).sort();
        this._availableFilterOptions.zones = Array.from(uniqueValues.zones).sort();
        this._availableFilterOptions.locales = Array.from(uniqueValues.locales).sort();
        this._availableFilterOptions.regions = Array.from(uniqueValues.regions).sort();
        const sortedRawYears = Array.from(uniqueValues.years).sort((a, b) => a - b);
        console.log("Unique and sorted raw years:", [...sortedRawYears]); // Added log

        // Pass the raw unique numerical years for chronological grouping
        this._availableFilterOptions.years = this._groupYearsByEpisodeSequence(
            sortedRawYears, // Sorted raw internal numerical years
            Feed.MIN_YEAR_GROUP_THRESHOLD
        );
        console.log("Exiting _generateFilterOptions."); // Added log
    }

    /**
     * Helper to format an internal numerical year (including 0 for 1 BCE, -1 for 2 BCE)
     * into a display string (e.g., "1971", "1 BCE", "132975 BCE").
     * Does NOT add "CE" suffix.
     * @param {number} year - The internal numerical year.
     * @returns {string} The formatted year string for display.
     * @private
     */
    _formatYearForDisplay(year) {
        if (year > 0) {
            return year.toString(); // e.g., 1971
        } else if (year === 0) {
            return "1 BCE"; // Astronomical year 0 is 1 BCE
        } else {
            return `${Math.abs(year) + 1} BCE`; // Astronomical year -1 is 2 BCE, -2 is 3 BCE, etc.
        }
    }

    /**
     * Helper to parse a year string (e.g., "1971", "1 BCE", "1990-2000", "132975-1 BCE")
     * into its internal numerical start and end years.
     * @param {string} yearStr - The year string.
     * @returns {{start: number, end: number}} An object with internal numerical start and end years.
     * @private
     */
    _parseYearString(yearStr) {
        const parseSingleYearInternal = (str) => {
            str = str.trim();
            if (str.endsWith('BCE')) {
                const bceYearNum = parseInt(str.slice(0, -4)); // e.g., "1" from "1 BCE"
                // Convert BCE display year to internal numerical year:
                // 1 BCE (display 1) -> internal 0
                // 2 BCE (display 2) -> internal -1
                // X BCE (display X) -> internal -(X - 1)
                return -(bceYearNum - 1);
            }
            // For standard years (e.g., "1971"), parse directly
            return parseInt(str);
        };

        if (yearStr.includes('-')) {
            const parts = yearStr.split('-').map(part => part.trim());
            const start = parseSingleYearInternal(parts[0]);
            const end = parseSingleYearInternal(parts[1]);
            // Ensure start is always chronologically earlier (smaller internal number) than end
            return { start: Math.min(start, end), end: Math.max(start, end) };
        }
        const year = parseSingleYearInternal(yearStr);
        return { start: year, end: year };
    }


    /**
     * Helper to get episodes for a single year efficiently (with caching).
     * Uses internal numerical years.
     * @param {number} year - The internal numerical year to get episodes for.
     * @returns {Episode[]} An array of episodes for that year.
     * @private
     */
    _getEpisodesForYear(year) {
        // console.log(`_getEpisodesForYear called for year: ${year}`); // Log for debugging
        if (!this._episodeCacheByYear) { // Simple cache for performance
            // console.log("Initializing _episodeCacheByYear..."); // Log for debugging
            this._episodeCacheByYear = new Map();
            this._allEpisodes.forEach(ep => {
                if (ep.rawDate) {
                    const epYear = ep.rawDate.getFullYear(); // This is the internal numerical year
                    if (!this._episodeCacheByYear.has(epYear)) {
                        this._episodeCacheByYear.set(epYear, []);
                    }
                    this._episodeCacheByYear.get(epYear).push(ep);
                }
            });
            // console.log("Episode cache populated:", this._episodeCacheByYear); // Log for debugging
        }
        return this._episodeCacheByYear.get(year) || [];
    }

    /**
     * Groups years based on collecting all episodes from a chronological sequence
     * of years until the minGroupThreshold is met for that chunk.
     * This method does NOT include "All Years".
     *
     * @param {number[]} sortedUniqueYears - An array of unique, chronologically sorted internal numerical years.
     * @param {number} minGroupThreshold - The minimum number of episodes to attempt to include in a group.
     * @returns {string[]} An array of chronologically sorted year display strings (e.g., "2020", "1990-2000", "132975-1 BCE").
     * @private
     */
    _groupYearsByEpisodeSequence(sortedUniqueYears, minGroupThreshold) {
        console.log("Entering _groupYearsByEpisodeSequence with sortedUniqueYears:", sortedUniqueYears); // Added log

        if (sortedUniqueYears.length === 0) {
            console.log("No unique years, returning empty array."); // Added log
            return [];
        }

        // Step 1: Create initial groups based on the minimum threshold
        // Each element will store internal numerical year range and its episode count
        const initialNumericalGroups = [];
        let currentGroupYears = [];
        let currentGroupEpisodeCount = 0;

        for (let i = 0; i < sortedUniqueYears.length; i++) {
            const year = sortedUniqueYears[i];
            const episodesInThisYear = this._getEpisodesForYear(year);

            currentGroupEpisodeCount += episodesInThisYear.length;
            currentGroupYears.push(year);

            // If threshold met OR this is the last year, finalize the current group
            if (currentGroupEpisodeCount >= minGroupThreshold || i === sortedUniqueYears.length - 1) {
                initialNumericalGroups.push({
                    start: currentGroupYears[0],
                    end: currentGroupYears[currentGroupYears.length - 1],
                    episodeCount: currentGroupEpisodeCount
                });
                // Reset for the next group
                currentGroupYears = [];
                currentGroupEpisodeCount = 0;
            }
        }
        console.log("Initial numerical groups:", initialNumericalGroups); // Added log

        // Step 2: Consolidate / Merge adjacent groups into final display strings.
        const finalDisplayGroups = [];
        if (initialNumericalGroups.length === 0) {
            return [];
        }

        let currentConsolidatedStart = initialNumericalGroups[0].start;
        let currentConsolidatedEnd = initialNumericalGroups[0].end;

        for (let i = 1; i < initialNumericalGroups.length; i++) {
            const nextGroup = initialNumericalGroups[i];

            // Check if the next group is directly consecutive to the current consolidated range
            if (nextGroup.start === currentConsolidatedEnd + 1) {
                // They are consecutive, so extend the current consolidated range
                currentConsolidatedEnd = nextGroup.end;
            } else {
                // Not consecutive, so finalize the current consolidated group's string
                const formattedStart = this._formatYearForDisplay(currentConsolidatedStart);
                const formattedEnd = this._formatYearForDisplay(currentConsolidatedEnd);
                finalDisplayGroups.push(currentConsolidatedStart === currentConsolidatedEnd ?
                    formattedStart : `${formattedStart}-${formattedEnd}`);

                // Start a new consolidated group with the current `nextGroup`'s values
                currentConsolidatedStart = nextGroup.start;
                currentConsolidatedEnd = nextGroup.end;
            }
        }

        // Add the very last consolidated group after the loop finishes
        const formattedStart = this._formatYearForDisplay(currentConsolidatedStart);
        const formattedEnd = this._formatYearForDisplay(currentConsolidatedEnd);
        finalDisplayGroups.push(currentConsolidatedStart === currentConsolidatedEnd ?
            formattedStart : `${formattedStart}-${formattedEnd}`);

        console.log("Before final sort, finalDisplayGroups:", [...finalDisplayGroups]); // Added log

        // **FIX STARTS HERE: Re-sort the final display strings to ensure chronological order.**
        // This is the most robust way to guarantee the displayed order,
        // especially if subtle edge cases in consolidation lead to misplacements.
        finalDisplayGroups.sort((a, b) => {
            const { start: aStart } = this._parseYearString(a);
            const { start: bStart } = this._parseYearString(b);

            console.log(`Comparing: "${a}" (start: ${aStart}) vs "${b}" (start: ${bStart}). Result: ${aStart - bStart}`); // Added log

            return aStart - bStart;
        });

        console.log("After final sort, finalDisplayGroups:", [...finalDisplayGroups]); // Added log

        return finalDisplayGroups;
    }


    // --- Accessors for available filter options  ---
    getAvailableFilterOptions() {
        return Object.keys(this._availableFilterOptions);
    }

    getAvailableTags() { return [...this._availableFilterOptions.tags]; }
    getAvailableModels() { return [...this._availableFilterOptions.models]; }
    getAvailableOrigins() { return [...this._availableFilterOptions.origins]; }
    getAvailableZones() { return [...this._availableFilterOptions.zones]; }
    getAvailableLocales() { return [...this._availableFilterOptions.locales]; }
    getAvailableRegions() { return [...this._availableFilterOptions.regions]; }
    getAvailableYears() {return [...this._availableFilterOptions.years]; }

    // --- NEW/RETAINED METHODS FOR ORGANIZED GROUPINGS ---

    /**
     * Returns an object where keys are normalized tags and values are arrays of episodes
     * belonging to that normalized tag. Includes 'Misc Tags' if applicable.
     * Groups are sorted descending by episode count.
     * Episodes within each group are sorted chronologically (earliest to latest by rawDate).
     * @returns {Object.<string, Episode[]>}
     */
    getEpisodesByTag() {
        const tempTagGroups = new Map();

        this._allEpisodes.forEach(ep => {
            if (ep.tags) {
                ep.tags.forEach(tag => {
                    const normalizedTag = this._normalizeTag(tag);
                    if (!tempTagGroups.has(normalizedTag)) {
                        tempTagGroups.set(normalizedTag, []);
                    }
                    tempTagGroups.get(normalizedTag).push(ep);
                });
            }
        });

        const finalGroupsArray = [];
        let miscTagsEpisodes = [];

        // Distribute episodes into explicit and "Misc Tags" groups based on MIN_CATEGORY_THRESHOLD
        for (const [tag, episodes] of tempTagGroups.entries()) {
            if (episodes.length >= Feed.MIN_CATEGORY_THRESHOLD) {
                finalGroupsArray.push({ key: tag, episodes: episodes });
            } else {
                miscTagsEpisodes = miscTagsEpisodes.concat(episodes);
            }
        }

        // Sort explicit tags by count (descending), then alphabetically
        finalGroupsArray.sort((a, b) => {
            const countA = a.episodes.length;
            const countB = b.episodes.length;
            if (countA === countB) {
                return a.key.localeCompare(b.key); // Alphabetical if counts are equal
            }
            return countB - countA; // Descending by count
        });

        const finalOrderedGroups = {};

        // Add "Misc Tags" if there are any episodes in it
        if (miscTagsEpisodes.length > 0) {
            // Sort "Misc Tags" episodes chronologically
            miscTagsEpisodes.sort((a, b) => {
                const dateA = a.rawDate ? a.rawDate.getTime() : 0;
                const dateB = b.rawDate ? b.rawDate.getTime() : 0;
                return dateA - dateB;
            });
            // Place "Misc Tags" at the end of the list
            finalGroupsArray.push({ key: "Misc Tags", episodes: miscTagsEpisodes });
        }


        // Convert the sorted array back into an object
        finalGroupsArray.forEach(group => {
            // Ensure episodes within each group are sorted chronologically
            group.episodes.sort((a, b) => {
                const dateA = a.rawDate ? a.rawDate.getTime() : 0;
                const dateB = b.rawDate ? b.rawDate.getTime() : 0;
                return dateA - dateB; // Ascending order (earliest first)
            });
            finalOrderedGroups[group.key] = group.episodes;
        });

        return finalOrderedGroups;
    }


    /**
     * Returns an array of objects, where each object represents a year group
     * with its corresponding episodes. The array is chronologically sorted (BCE first).
     *
     * @returns {Array<{year: string, episodes: Episode[]}>} An array of year group objects.
     */
    getEpisodesByYear() {
        console.log("Entering getEpisodesByYear...");
        const yearGroupsMap = new Map();

        const sortedYearKeys = this.getAvailableYears();
        const allEpisodes = this._allEpisodes;

        console.log("getEpisodesByYear - sortedYearKeys from getAvailableYears():", sortedYearKeys);

        for (const yearKey of sortedYearKeys) {
            const { start: internalStartYear, end: internalEndYear } = this._parseYearString(yearKey);
            console.log(`Processing yearKey: "${yearKey}" -> internal years: start=${internalStartYear}, end=${internalEndYear}`);

            let episodesForGroup = allEpisodes.filter(ep =>
                ep.rawDate && ep.rawDate.getFullYear() >= internalStartYear && ep.rawDate.getFullYear() <= internalEndYear
            );

            episodesForGroup.sort((a, b) => {
                const dateA = a.rawDate ? a.rawDate.getTime() : 0;
                const dateB = b.rawDate ? b.rawDate.getTime() : 0;
                return dateA - dateB;
            });

            if (episodesForGroup.length > 0) {
                yearGroupsMap.set(yearKey, episodesForGroup);
            }
        }
        console.log("getEpisodesByYear - yearGroupsMap populated. Keys:", Array.from(yearGroupsMap.keys()));

        // Convert the Map to an array of { year, episodes } objects
        const finalOrderedGroupsArray = Array.from(yearGroupsMap.entries()).map(([year, episodes]) => ({
            year,
            episodes
        }));

        console.log("Exiting getEpisodesByYear. Final ordered groups (array of objects):", finalOrderedGroupsArray.map(g => g.year));

        return finalOrderedGroupsArray;
    }


    /**
     * Provides a direct way to get a filtered and sorted list of episodes based on a specific criteria object.
     * This method does *not* change the internal state or notify listeners.
     * It's for ad-hoc requests for filtered lists where the default grouping methods are not sufficient.
     *
     * @param {object} criteria - An object containing filtering and sorting instructions.
     * @param {string} [criteria.searchQuery] - Text to search titles, descriptions, locations, or tags.
     * @param {string} [criteria.tag] - Filter by a specific tag (or "Misc Tags").
     * @param {string} [criteria.model] - Filter by a specific model.
     * @param {string} [criteria.origin] - Filter by a specific origin.
     * @param {string} [criteria.zone] - Filter by a specific zone.
     * @param {string} [criteria.locale] - Filter by a specific locale.
     * @param {string} [criteria.region] - Filter by a specific region.
     * @param {string} [criteria.year] - Filter by a specific year or year range string (e.g., "1971", "132975-1 BCE"). "All Years" returns all episodes.
     * @param {'published'|'rawDate'|'title'|'duration'|'integrity'} [criteria.sortBy='published'] - The property to sort by. 'rawDate' for episode date, 'published' for release date.
     * @param {boolean} [criteria.sortAscending=false] - Whether to sort in ascending order. (Default `false` means newest-first for dates, Z-A for titles, etc.)
     * @returns {Episode[]} An array of episodes matching the criteria.
     */
    getFilteredAndSortedList(criteria = {}) {
        let currentWorkingList = [...this._allEpisodes];

        // Ensure yearRange is correctly derived for this ad-hoc request
        let yearRange = { start: null, end: null };
        if (criteria.year === "All Years" || !criteria.year) {
            yearRange = { start: null, end: null }; // No year filtering
        } else if (criteria.year) {
            // Use the _parseYearString to handle both single and range display strings
            yearRange = this._parseYearString(criteria.year);
        }

        // 1. Apply Filters
        if (criteria.searchQuery) {
            const query = criteria.searchQuery.toLowerCase();
            const normalizedQueryForTags = this._normalizeTag(criteria.searchQuery); // For fuzzy tag matching

            currentWorkingList = currentWorkingList.filter(ep =>
                ep.title.toLowerCase().includes(query) ||
                ep.description.toLowerCase().includes(query) ||
                (ep.location && ep.location.toLowerCase().includes(query)) ||
                // Fuzzy tag search using normalization for the episode's tags
                (ep.tags && ep.tags.some(t => this._normalizeTag(t).includes(normalizedQueryForTags)))
            );
        }

        if (criteria.tag) {
            const normalizedSelectedTag = this._normalizeTag(criteria.tag);
            // Re-evaluate 'Misc Tags' logic for filtering as it's not in _availableFilterOptions directly
            const tagsWithCounts = new Map();
            this._allEpisodes.forEach(ep => {
                if (ep.tags) {
                    ep.tags.forEach(tag => tagsWithCounts.set(this._normalizeTag(tag), (tagsWithCounts.get(this._normalizeTag(tag)) || 0) + 1));
                }
            });
            const explicitTagsForFiltering = Array.from(tagsWithCounts.entries())
                .filter(([, count]) => count >= Feed.MIN_CATEGORY_THRESHOLD)
                .map(([tag]) => tag);

            if (normalizedSelectedTag === this._normalizeTag("Misc Tags")) {
                currentWorkingList = currentWorkingList.filter(ep =>
                    ep.tags && ep.tags.some(tag => {
                        const normalizedEpisodeTag = this._normalizeTag(tag);
                        // An episode belongs to "Misc Tags" if it has *any* tag that isn't explicitly listed
                        // as meeting the threshold for a named category.
                        return !explicitTagsForFiltering.includes(normalizedEpisodeTag);
                    }) && ep.tags.length > 0 // Ensure it actually has tags
                );
            } else {
                currentWorkingList = currentWorkingList.filter(ep =>
                    ep.tags && ep.tags.some(t => this._normalizeTag(t) === normalizedSelectedTag)
                );
            }
        }

        const adHocApplyCategoricalFilter = (list, prop, selectedValue) => {
            if (!selectedValue) return list;
            return list.filter(ep => ep[prop] === selectedValue);
        };

        currentWorkingList = adHocApplyCategoricalFilter(currentWorkingList, 'model', criteria.model);
        currentWorkingList = adHocApplyCategoricalFilter(currentWorkingList, 'origin', criteria.origin);
        currentWorkingList = adHocApplyCategoricalFilter(currentWorkingList, 'zone', criteria.zone);
        currentWorkingList = adHocApplyCategoricalFilter(currentWorkingList, 'locale', criteria.locale);
        currentWorkingList = adHocApplyCategoricalFilter(currentWorkingList, 'region', criteria.region);

        if (criteria.year && criteria.year !== "All Years" && yearRange.start !== null) {
            currentWorkingList = currentWorkingList.filter(ep => {
                if (!ep.rawDate) return false;
                const episodeYear = ep.rawDate.getFullYear();
                const { start, end } = yearRange; // These are already internal numerical years
                return episodeYear >= start && episodeYear <= end;
            });
        }

        // 2. Apply Sorting
        const sortBy = criteria.sortBy || 'published';
        const sortAscending = criteria.sortAscending || false; // Default: false (descending/newest first)

        currentWorkingList.sort((a, b) => {
            let valA, valB;
            switch (sortBy) {
                case 'published': // For "most recently released" content
                    valA = a.published ? a.published.getTime() : 0;
                    valB = b.published ? b.published.getTime() : 0;
                    break;
                case 'rawDate': // For episode chronological date
                case 'date': // Alias for rawDate
                    valA = a.rawDate ? a.rawDate.getTime() : 0;
                    valB = b.rawDate ? b.rawDate.getTime() : 0;
                    break;
                case 'title':
                    valA = a.title ? a.title.toLowerCase() : '';
                    valB = b.title ? b.title.toLowerCase() : '';
                    break;
                case 'duration':
                    valA = a.rawDuration || 0;
                    valB = b.rawDuration || 0;
                    break;
                case 'integrity':
                    valA = a.integrityFloat || 0;
                    valB = b.integrityFloat || 0;
                    break;
                default:
                    return 0;
            }

            if (valA < valB) {
                return sortAscending ? -1 : 1;
            }
            if (valA > valB) {
                return sortAscending ? 1 : -1;
            }
            return 0; // Equal
        });

        return currentWorkingList;
    }
}