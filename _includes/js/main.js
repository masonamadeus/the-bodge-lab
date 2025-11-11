// This script runs after all the HTML has loaded
document.addEventListener('DOMContentLoaded', () => {

  // Set the maximum tilt (e.g., 0.5 means -0.5deg to +0.5deg)
  const maxTilt = 0.5;

  // get all the main page containers
  const elements = document.querySelectorAll('header, main, section, div, h1, h2, h3, h4, h5, h6, p');

  // 2. Loop through each one
  elements.forEach(el => {
    // 3. Generate a unique random tilt
    const randomTilt = (Math.random() * (maxTilt * 2)) - maxTilt;

    // 4. Apply the rotation
    el.style.transform = `rotate(${randomTilt}deg)`;
  });

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
   * Runs a search query against a list of pages.
   * @param {string} query - The user's search text.
   * @param {Array} allPages - The full list of pages from filetree.
   * @returns {Array} - A sorted array of matched pages.
   */
 window.BodgeLab.runSearch = (query, allPages) => {
  
  // --- THIS IS THE FIX ---
  // 1. Decode the incoming query string FIRST. This ensures %20 becomes a space.
  const decodedQuery = decodeSearchString(query);
  // --- END FIX ---
  
  // 2. Clean the user's query into keywords
  // We now use the already decoded query string here:
  const keywords = decodedQuery.toLowerCase()
    .replace(/[\/\-]/g, ' ')          // Treat slashes and hyphens as spaces
    .replace(/[^a-z0-9\s]/g, '')   // Remove all other punctuation (which is now just spaces)
    .split(/\s+/)                  
    .filter(k => k.length > 0 && k !== 'index');

  if (keywords.length === 0) {
    return []; // Return empty array if no query
  }

  // 3. Run the search with new scoring
  const results = allPages.map(page => {
    let score = 0;
    
    // These strings are already decoded inside the map function
    const decodedUrl = decodeSearchString(page.url);
    const decodedTitle = decodeSearchString(page.title || "");

    // Normalize URL and Title in the same way as the query
    const cleanUrl = decodedUrl.toLowerCase()
      .replace(/[\/\-]/g, ' ')
      .replace(/[^a-z0-9\s]/g, '');
      
    const cleanTitle = decodedTitle.toLowerCase()
      .replace(/[\/\-]/g, ' ')
      .replace(/[^a-z0-9\s]/g, '');

    // Bonus for an exact title match
    if (cleanTitle === keywords.join(' ')) {
      score += 10;
    }

    keywords.forEach(keyword => {
      // High score for each keyword in the title
      if (cleanTitle.includes(keyword)) {
        score += 3;
      }
      
      // Low score for each keyword in the URL
      if (cleanUrl.includes(keyword)) {
        score += 1;
      }
    });

    return { ...page, score };
  })
    .filter(page => page.score > 0)
    .sort((a, b) => b.score - a.score); // Sort by highest score

  return results;
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