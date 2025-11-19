// This script runs after all the HTML has loaded
document.addEventListener('DOMContentLoaded', () => {

  // RANDOM TILT
  (function () {

    // Set the maximum tilt (e.g., 0.5 means -0.5deg to +0.5deg)
    const maxTilt = 0.5;

    // get all the main page containers
    const elements = document.querySelectorAll('header, main, section, div, h1, h2, h3, h4, h5, h6');
    // Map to store the final, cumulative rotation (in degrees) for every element.
    // This is the key to counteracting inherited rotation.
    const rotationMap = new Map();

    // 2. Loop through each element
    elements.forEach(el => {
      const parent = el.parentElement;
      let parentRotation = 0;

      // 1. Get the parent's *total visual rotation* from the map
      if (parent && rotationMap.has(parent)) {
        parentRotation = rotationMap.get(parent);
      }

      // 2. Check for the exclusion class
      if (el.closest('.notilt')) {
        // --- ABSOLUTE CANCELLATION LOGIC ---

        // If excluded, apply the exact inverse rotation of the parent's tilt.
        // This results in a final visual rotation of 0 degrees relative to the viewport.
        el.style.transform = `rotate(${-parentRotation}deg)`;

        // Store 0 rotation for this element. Any children of this element 
        // will now look up 0 and remain straight.
        rotationMap.set(el, 0);
        return;
      }

      // 3. If NOT excluded:

      // Generate a new random tilt (e.g., 0.3 deg)
      const randomTilt = (Math.random() * (maxTilt * 2)) - maxTilt;

      // Calculate the required relative rotation: 
      // (Parent's inverse tilt) + (New random tilt)
      el.style.transform = `rotate(${-parentRotation + randomTilt}deg)`;

      // Store the new total VISUAL rotation for its children to use.
      const newVisualRotation = parentRotation + randomTilt;
      rotationMap.set(el, newVisualRotation);
    });
  })();


  // LIGHT / DARK MODE TOGGLE
  (function () {
    const toggleButton = document.getElementById('theme-toggle');
    if (toggleButton) {

      // The toggle button's click listener
      toggleButton.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        let newTheme;

        if (currentTheme === 'light') {
          // Switch to Dark
          newTheme = 'dark';
          toggleButton.innerText = "Light Mode";
        } else {
          // Switch to Light
          newTheme = 'light';
          toggleButton.innerText = "Dark Mode";
        }

        // Call the global function from theme.js
        if (window.applyTheme) {
          window.applyTheme(newTheme);
        }

        // Dispatch an event so the customizer page knows we toggled
        const event = new CustomEvent('theme:toggled', {
          detail: { newTheme: newTheme }
        });
        document.dispatchEvent(event);
      });

      // Set initial button text
      const currentTheme = document.documentElement.getAttribute('data-theme');
      if (currentTheme === 'dark') {
        toggleButton.innerText = "Light Mode";
      } else {
        toggleButton.innerText = "Dark Mode";
      }
    }
  })();



  // --- SHARE BUTTON: COPY TO CLIPBOARD ---
  (function () {
    // 1. Find all share buttons on the page
    const allShareButtons = document.querySelectorAll('.page-share-btn');

    allShareButtons.forEach(button => {
      // 2. Add a click listener to each one
      button.addEventListener('click', (event) => {
        // 3. Stop the link from its default (navigating)
        event.preventDefault();

        // 4. Get the relative path from the link's href
        const relativePath = button.getAttribute('href');

        // 5. Build the full, absolute URL (e.g., https://bodgelab.com/share/uid)
        const absoluteUrl = window.location.origin + relativePath;

        // 6. Use the modern Clipboard API to copy
        navigator.clipboard.writeText(absoluteUrl).then(() => {
          // 7. On success, give visual feedback!
          const originalText = button.innerHTML;
          button.innerHTML = "LINK COPIED!";

          // 8. Change it back after 2 seconds
          setTimeout(() => {
            button.innerHTML = originalText;
          }, 2000);

        }).catch(err => {
          // Optional: handle errors (e.g., on very old browsers)
          console.error('Failed to copy link: ', err);
          button.innerHTML = "ERROR";
        });
      });
    });
  })();

  /*
  =========================================
   SITE SEARCH
  =========================================
  */

  // Create a global object to hold our functions
  window.BodgeLab = window.BodgeLab || {};
  let searchDataCache = null; // This is our new client-side cache

  /**
   * Fetches search data from the .json file, or returns cached data.
   */
  window.BodgeLab.getSearchData = async () => {
    if (searchDataCache) {
      return searchDataCache; // Return data from cache
    }

    try {
      const response = await fetch('/search.json');
      const data = await response.json();
      searchDataCache = data; // Store data in cache
      return data;
    } catch (err) {
      console.error('Error fetching search data:', err);
      return []; // Return empty on error
    }
  };

  /**
   * decodes HTML and shit
   */
  function decodeSearchString(str) {
    if (!str) return '';

    // 1. Decode URL encoding (%20 -> space, %26 -> &, etc.)
    // We use try/catch in case the string is partially malformed.
    try {
      str = decodeURIComponent(str);
    } catch (e) {
      // If it fails, proceed with the original string, letting the HTML decoder handle what it can.
    }

    // 2. Decode ALL HTML entities using a temporary DOM element.
    // This is the most reliable way to handle &amp;, &quot;, etc.
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    str = textarea.value;

    return str;
  }

  /**
     * Calculates the Levenshtein distance between two strings.
     * (a.k.a. "edit distance")
     */
  const getLevenshteinDistance = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) == a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };
  // --- End Helper ---

  /**
     * Runs a search query against a list of pages.
     * @param {string} query - The user's search text.
     * @param {Array} allPages - The full list of pages from filetree.
     * @returns {Array} - A sorted array of matched pages.
     */
  window.BodgeLab.runSearch = (query, allPages) => {

    // (NEW) These are your "preset range numbers", now as ratios.
    // 0.5 = 50% of the top score
    // 0.2 = 20% of the top score
    const STRICT_RATIO = 0.5;
    const LOOSE_RATIO = 0.2;

    // 1. Decode and clean the user's query
    const decodedQuery = decodeSearchString(query);
    const keywords = [...new Set( // Use a Set to get unique keywords
      decodedQuery.toLowerCase()
        .replace(/[\/\-]/g, ' ')
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(k => k.length > 0 && k !== 'index')
    )];

    if (keywords.length === 0) {
      return [];
    }

    // 2. Calculate Inverse Document Frequency (IDF) Weights
    const totalPages = allPages.length;
    const keywordWeights = {};

    keywords.forEach(keyword => {
      let pagesWithKeyword = 0;
      for (const page of allPages) {
        const cleanTitle = decodeSearchString(page.title || "").toLowerCase();
        const cleanUrl = decodeSearchString(page.url).toLowerCase();
        if (cleanTitle.includes(keyword) || cleanUrl.includes(keyword)) {
          pagesWithKeyword++;
        }
      }

      const frequency = pagesWithKeyword / totalPages;
      keywordWeights[keyword] = 1 - frequency; // 1.0 = very rare, 0.0 = very common
    });

    // 3. Score all pages
    const scoredResults = allPages.map(page => {
      let baseScore = 0;
      let keywordsFound = 0;

      const decodedUrl = decodeSearchString(page.url);
      const decodedTitle = decodeSearchString(page.title || "");
      const cleanUrl = decodedUrl.toLowerCase().replace(/[\/\-]/g, ' ').replace(/[^a-z0-9\s]/g, '');
      const cleanTitle = decodedTitle.toLowerCase().replace(/[\/\-]/g, ' ').replace(/[^a-z0-9\s]/g, '');

      const titleWords = cleanTitle.split(/\s+/);
      const urlWords = cleanUrl.split(/\s+/);

      // 4. Get Base Score for each keyword
      keywords.forEach(keyword => {
        const weight = keywordWeights[keyword] || 0.5;
        let found = false;
        let titleScore = 0;
        let urlScore = 0;

        // 1. Check Title (High Score)
        if (cleanTitle.includes(keyword)) {
          titleScore = 3 * weight; // Exact (or partial) match
          found = true;
        } else {
          const hasFuzzyTitleMatch = titleWords.some(w => getLevenshteinDistance(w, keyword) === 1);
          if (hasFuzzyTitleMatch) {
            titleScore = 1.5 * weight; // Half score for fuzzy
            found = true;
          }
        }

        // 2. Check URL (Low Score)
        if (cleanUrl.includes(keyword)) {
          urlScore = 0.5 * weight;
          found = true;
        } else {
          const hasFuzzyUrlMatch = urlWords.some(w => getLevenshteinDistance(w, keyword) === 1);
          if (hasFuzzyUrlMatch) {
            urlScore = 0.25 * weight;
            found = true;
          }
        }

        if (found) {
          keywordsFound++;
        }

        baseScore += (titleScore + urlScore);
      });

      // 5. Apply Bonuses to the Base Score
      if (baseScore > 0) {
        if (cleanTitle === keywords.join(' ')) {
          baseScore += 10;
        }
        if (keywords.every(k => cleanTitle.includes(k))) {
          baseScore += 5;
        }
      }

      // 6. Calculate Match Ratio (our "scaling deduction")
      const matchRatio = (keywords.length > 0) ? (keywordsFound / keywords.length) : 0;

      // 7. Calculate Final Score
      let finalScore = baseScore * matchRatio;

      return { ...page, score: finalScore };
    })
      .filter(page => page.score > 0); // Only keep pages that matched at all


    // --- (NEW) 8. Apply Dynamic Threshold ---

    if (scoredResults.length === 0) {
      return []; // No results, just quit
    }

    // Sort *once* to find the best score
    scoredResults.sort((a, b) => b.score - a.score);

    // Find the single best score
    const maxScore = scoredResults[0].score;

    // Calculate our dynamic thresholds
    const highDynamicThreshold = maxScore * STRICT_RATIO;
    const lowDynamicThreshold = maxScore * LOOSE_RATIO;

    // First, try to get results with the HIGH threshold
    let finalResults = scoredResults.filter(page => page.score >= highDynamicThreshold);

    // If that returned 0 results, fall back to the LOW threshold
    if (finalResults.length === 0) {
      finalResults = scoredResults.filter(page => page.score >= lowDynamicThreshold);
    }

    // Return the (already sorted) results
    return finalResults;
  };

  /**
   * Renders search results into a container element.
   * @param {Array} results - The array from BodgeLab.runSearch.
   * @param {HTMLElement} container - The DOM element to render into.
   * @param {string} query - The original query (for "no results" message).
   */
  window.BodgeLab.renderResults = (results, container, query) => {
    if (!container) return; // Safety check

    if (results.length > 0) {
      let html = '<ul>';
      results.slice(0, 20).forEach(page => { // Show top 20 matches
        html += `<li><a href="${page.url}">${page.title}</a><br><small><code>${page.url}</code></small></li>`;
      });
      html += '</ul>';
      container.innerHTML = html;
    } else {
      // Show a different message if there's a query vs. no query
      if (query && query.length > 0) {
        container.innerHTML = `<p><i>No matches found for "${query}".</i></p>`;
      } else {
        container.innerHTML = `<p><i>Waiting for input...</i></p>`;
      }
    }
  };

  const event = new CustomEvent('bodgelab:searchready');
  document.dispatchEvent(event);
});