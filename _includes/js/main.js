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

  /**
   * Runs a search query against a list of pages.
   * @param {string} query - The user's search text.
   * @param {Array} allPages - The full list of pages from filetree.
   * @returns {Array} - A sorted array of matched pages.
   */
  window.BodgeLab.runSearch = (query, allPages) => {
    // 1. Clean the user's query into keywords
    const keywords = query.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ') // Replace non-alphanumeric with spaces
      .split(/\s+/)                  // Split on one or more spaces
      .filter(k => k.length > 0 && k !== 'index');

    if (keywords.length === 0) {
      return []; // Return empty array if no query
    }

    // 2. Run the search
    const results = allPages.map(page => {
      let score = 0;
      const cleanUrl = page.url.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
      const cleanTitle = (page.title || "").toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');

      keywords.forEach(keyword => {
        if (cleanUrl.includes(keyword)) score += 2;
        if (cleanTitle.includes(keyword)) score += 1;
      });

      return { ...page, score };
    })
      .filter(page => page.score > 0)
      .sort((a, b) => b.score - a.score);

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