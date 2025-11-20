// This script runs after all the HTML has loaded
document.addEventListener('DOMContentLoaded', () => {

  // RANDOM TILT
  (function () {

    // Set the maximum tilt (e.g., 0.5 means -0.5deg to +0.5deg)
    const maxTilt = 0.4;

    // get all the main page containers
    const elements = document.querySelectorAll('header, p, button, main, section, div, h1, h2, h3, h4, h5, h6');
    // Map to store the final, cumulative rotation (in degrees) for every element.
    // This is the key to counteracting inherited rotation.
    const rotationMap = new Map();

    // Loop through each element
    elements.forEach(el => {
      const parent = el.parentElement;
      let parentRotation = 0;

      // Get the parent's *total visual rotation* from the map
      if (parent && rotationMap.has(parent)) {
        parentRotation = rotationMap.get(parent);
      }

      // Check for the exclusion class
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

      // If NOT excluded:

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
 SITE SEARCH (using MiniSearch now)
=========================================
*/

  // Load MiniSearch if needed
  if (typeof MiniSearch === 'undefined') {
    const script = document.createElement('script');
    script.src = '/js/lib/minisearch.js'; // Corrected path
    document.head.appendChild(script);
  }

  window.BodgeLab = window.BodgeLab || {};
  let miniSearchEngine = null;
  let searchDataCache = null;

  // 1. EXPOSED UTILITY: Debounce
  window.BodgeLab.debounce = (func, wait) => {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  // EXPOSED UTILITY: Get All Search Data
  window.BodgeLab.getSearchData = async () => {
    if (searchDataCache) return searchDataCache;

    try {
      const response = await fetch('/search.json');
      searchDataCache = await response.json();
      return searchDataCache;
    } catch (err) {
      console.error('Could not load search data:', err);
      return [];
    }
  };

  // LOGIC: Get Results (Async & Discriminatory)
  window.BodgeLab.getResults = async (query) => {
    if (!query) return [];

    // Initialize engine once
    if (!miniSearchEngine) {
      try {
        const response = await fetch('/search.json');
        const data = await response.json();

        miniSearchEngine = new MiniSearch({
          fields: ['title', 'url'],
          storeFields: ['title', 'url'],
          searchOptions: {
            prefix: true,
            fuzzy: 0.2,
            combineWith: 'OR',
            // Heavy boost on Title to create "Winner" separation
            boost: { title: 4, url: 1 }
          }
        });
        miniSearchEngine.addAll(data);
      } catch (err) {
        console.error('Search Index Failed:', err);
        return [];
      }
    }

    // Run the search
    const rawResults = miniSearchEngine.search(query);

    // --- DISCRIMINATORY FILTER LOGIC ---
    if (rawResults.length > 0) {
      //  Find the best score (MiniSearch sorts by score desc by default)
      const maxScore = rawResults[0].score;

      //    Define Threshold (0.6 means results must be 60% as good as the winner)
      //    If the top match is EXACT, its score will be huge (thanks to boost).
      //    Partial matches will have low scores and fall below this line.
      const STRICT_RATIO = 0.6;

      const filteredResults = rawResults.filter(r => r.score >= maxScore * STRICT_RATIO);

      return filteredResults;
    }

    return [];
  };

  // UI: Render Results
  window.BodgeLab.render = (results, container, query) => {
    if (!container) return;
    container.innerHTML = '';

    if (results.length > 0) {
      const ul = document.createElement('ul');
      // Limit to 10 results for speed
      results.slice(0, 10).forEach(result => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = result.url;
        a.textContent = result.title;

        const small = document.createElement('small');
        small.textContent = result.url;
        small.style.display = 'block';
        small.style.color = 'var(--text-muted)';

        li.appendChild(a);
        li.appendChild(small);
        ul.appendChild(li);
      });
      container.appendChild(ul);
    } else {
      container.innerHTML = query
        ? `<p><i>No matches for "${query}"</i></p>`
        : `<p><i>Waiting for input...</i></p>`;
    }
  };

  // Ready signal
  document.dispatchEvent(new CustomEvent('bodgelab:searchready'));
});