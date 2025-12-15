// This script runs after all the HTML has loaded
document.addEventListener('DOMContentLoaded', () => {
  window.BodgeLab = window.BodgeLab || {};

/* =========================================
   DIRECTORY BAR (Sentinel + Click Outside + Safety Lock)
   ========================================= */
(function() {
  const dir = document.querySelector('.directory-container');
  const sentinel = document.getElementById('dir-sentinel');
  
  // SAFETY LOCK: Prevents "double-tap" accidents when menu pops up
  let linkLock = false;
  
  if (!dir) return;

  // 1. SCROLL OBSERVER (Dock/Undock Logic)
  const observer = new IntersectionObserver((entries) => {
    // Destructure the first entry (we only have one sentinel)
    const [entry] = entries;

    if (entry.isIntersecting) {
      // ARRIVED AT BOTTOM: Release to Static
      dir.classList.add('is-static');
      dir.classList.remove('open');
    } else {
      // SENTINEL IS GONE. But where did it go?
      
      // If the sentinel is BELOW the viewport (top > 0), it means we scrolled UP into the content.
      // In that case, we should Dock.
      if (entry.boundingClientRect.top > 0) {
         // SCROLLING UP: Dock to HUD
         dir.classList.add('no-transition');
         
         dir.classList.remove('is-static');
         
         // Force browser reflow
         void dir.offsetWidth; 
         
         setTimeout(() => {
           dir.classList.remove('no-transition');
         }, 50);
      }
      
      // If (top < 0), it means the sentinel is ABOVE us. 
      // We are scrolling down inside the tall directory. 
      // Do nothing. Keep it Static.
    }
  }, {
    rootMargin: "0px 0px 0px 0px"
  });

  if (sentinel) {
    observer.observe(sentinel);
  } else {
    dir.classList.add('is-static');
  }

  // 2. INTERACTION LOGIC
  document.addEventListener('click', (e) => {
    // A. Ignore clicks if we are in Static/Block mode
    if (dir.classList.contains('is-static')) return;

    const clickedInside = dir.contains(e.target);
    const clickedHeader = e.target.closest('.directory-header');
    const clickedLink = e.target.closest('a');

    // --- NEW: SAFETY CHECK ---
    // If the safety lock is ON, and you tried to click a link inside the directory...
    if (linkLock && clickedInside) {
      e.preventDefault(); // Stop the link
      e.stopImmediatePropagation(); // Stop other scripts
      return; // Do nothing
    }

    // B. HEADER CLICK: Toggle Open/Close
    if (clickedHeader && !clickedLink) {
      dir.classList.toggle('open');
      e.stopPropagation(); 
      
      // IF WE JUST OPENED IT: Engage the Safety Lock
      if (dir.classList.contains('open')) {
        linkLock = true;
        // Release lock after 400ms (enough time to lift finger)
        setTimeout(() => {
          linkLock = false;
        }, 600); 
      }
      return;
    }

    // C. CLICK OUTSIDE: Close if Open
    if (!clickedInside && dir.classList.contains('open')) {
      dir.classList.remove('open');
    }
  });

})();


  // RANDOM TILT
  (function () {

    // Set the maximum tilt (e.g., 0.5 means -0.5deg to +0.5deg)
    const maxTilt = 0.6;

    
    // For all the other stuff
    const elements = document.querySelectorAll('header, p, button, section, div, h1, h2, h3, h4, h5, h6');
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

    // For the MAIN CONTENT area only
    const content = document.querySelector('.main-content');
    if (content) {
      // Calculate a random STARTING rotation (e.g., between -6deg and +6deg)
      const randomAngle = (Math.random() * 12 - 6).toFixed(2);

      // Set the variable
      content.style.setProperty('--start-rotation', `${randomAngle}deg`);
    }

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
        } else {
          // Switch to Light
          newTheme = 'light';
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

  // --- IFRAME AUTO-RESIZE FUNCTION ---
  window.BodgeLab.resizeIframe = (iframe) => {
    try {
      // Only works for same-origin files (which your passthrough apps are!)
      const doc = iframe.contentWindow.document;
      const body = doc.body;
      const html = doc.documentElement;

      // Calculate the max height of the content
      const height = Math.max(
        body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight
      );

      // Safety Check:
      // If the app is trying to be 100% height (like PocketPal), scrollHeight might equal clientHeight.
      // In that case, we DON'T auto-resize because it would create a loop or collapse.
      // We only resize if the content is LARGER than the frame, or if it's clearly a text document.

      // Heuristic: If it has a scrollbar, expand it.
      if (doc.body.scrollHeight > doc.body.clientHeight) {
        iframe.style.height = height + 'px';
      }
    } catch (e) {
      // Cross-origin or error: do nothing, fall back to CSS default
      console.log("Cannot auto-resize iframe:", e);
    }
  };

  // --- CODE BLOCK COPY BUTTONS ---
  (function () {
    // Target the PRE, because that is the relative container
    const codeBlocks = document.querySelectorAll('pre');

    codeBlocks.forEach(pre => {
      // 1. Create the button
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.textContent = 'COPY';
      btn.title = "Copy code to clipboard";

      // 2. Add Click Logic
      btn.addEventListener('click', () => {
        // Find the code inside this pre
        const code = pre.querySelector('code');
        if (!code) return;

        // Copy text
        navigator.clipboard.writeText(code.innerText).then(() => {
          btn.textContent = 'COPIED!';
          btn.classList.add('copied');

          // Reset after 2s
          setTimeout(() => {
            btn.textContent = 'COPY';
            btn.classList.remove('copied');
          }, 2000);
        }).catch(err => {
          console.error('Copy failed', err);
          btn.textContent = 'ERROR';
        });
      });

      // 3. Inject it into the PRE (which is position:relative)
      pre.appendChild(btn);
    });
  })();

  // --- IFRAME TEXT COPY (For .txt, .md, etc) ---
  (function () {
    const copyBtns = document.querySelectorAll('.text-copy-btn');

    copyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // 1. Find the wrapper and the iframe
        const wrapper = btn.closest('.media-embed-wrapper');
        const iframe = wrapper ? wrapper.querySelector('iframe') : null;

        if (!iframe) return;

        try {
          // 2. Reach into the iframe to get the text
          // Note: This works because the files are hosted on the same domain (Same Origin)
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          const textContent = doc.body.innerText; // Grabs visible text only

          // 3. Copy to Clipboard
          navigator.clipboard.writeText(textContent).then(() => {
            const originalText = btn.textContent;
            btn.textContent = "COPIED!";
            btn.style.backgroundColor = "var(--accent-color)";
            btn.style.color = "white";

            setTimeout(() => {
              btn.textContent = originalText;
              btn.style.backgroundColor = "";
              btn.style.color = "";
            }, 2000);
          });
        } catch (e) {
          console.error("Copy failed (likely cross-origin restriction):", e);
          btn.textContent = "ERROR";
        }
      });
    });
  })();

  // --- EASTER EGG TRIGGER/REACTION LOGIC ---
  (function () {
    document.body.addEventListener('click', (e) => {
      // 1. Did we click a Trigger?
      // (We use .closest so it works even if you wrap an image or bold text)
      const trigger = e.target.closest('.bodge-trigger');
      if (!trigger) return;

      // 2. Get the ID
      const id = trigger.dataset.triggerId;
      if (!id) return;

      // 3. Mark Trigger as "Found" (Visual Feedback)
      trigger.classList.remove('bodge-trigger');
      trigger.classList.add('found');
      trigger.setAttribute('disabled', 'true'); // Prevent double-clicking

      // 4. Find all Reactions waiting for this ID
      const reactions = document.querySelectorAll(`.bodge-reaction[data-react-id="${id}"]`);

      reactions.forEach(block => {
        // 5. Reveal them
        block.hidden = false;

        // 6. Optional: Scroll hint? 
        // If the reaction is huge, we might want to highlight it.
        block.classList.add('revealed');
      });

    });
  })();

  // --- SMART INDENT (No indent for single lines) ---
  (function () {
    function handleIndents() {
      // 1. Select all paragraphs in the main content
      const paras = document.querySelectorAll('.main-content p');

      paras.forEach(p => {
        // Reset (in case of resize)
        p.classList.remove('is-single-line');

        // 2. Measure
        // We use a buffer (1.2x) to account for sub-pixel rendering differences
        const lineHeight = parseFloat(window.getComputedStyle(p).lineHeight);
        const height = p.clientHeight;

        // 3. Compare: If height is essentially one line, tag it
        if (height < (lineHeight * 1.5)) {
          p.classList.add('is-single-line');
        }
      });
    }

    // Run on load
    handleIndents();

    // Run on resize (using your existing debounce utility)
    if (window.BodgeLab && window.BodgeLab.debounce) {
      window.addEventListener('resize', window.BodgeLab.debounce(handleIndents, 200));
    } else {
      window.addEventListener('resize', handleIndents);
    }
  })();

  // --- AUTO-SCROLL BREADCRUMBS (Mobile Safe) ---
  (function() {
    let resizeTimer;
    
    function initBreadcrumbs() {
      const container = document.querySelector('.breadcrumb-nav');
      const mover = document.querySelector('.breadcrumb-mover');

      if (!container || !mover) return;

      // 1. Reset everything
      mover.classList.remove('is-scrolling');
      mover.style.removeProperty('--scroll-dist');
      mover.style.removeProperty('--scroll-duration');
      mover.style.transform = ''; // Clear manual transforms
      container.scrollLeft = 0;   // Reset scroll

      // 2. Measure
      const containerWidth = container.clientWidth;
      const contentWidth = mover.scrollWidth;

      // 3. Only animate if there is overflow
      if (contentWidth > containerWidth) {
        const overflow = contentWidth - containerWidth;
        const dist = overflow + 20; // Buffer
        const duration = Math.max(dist / 40, 5); // Speed logic

        // Set CSS vars
        mover.style.setProperty('--scroll-dist', `-${dist}px`);
        mover.style.setProperty('--scroll-duration', `${duration}s`);
        mover.classList.add('is-scrolling');

        // --- NEW: THE "CATCH" LOGIC ---
        // If user touches the bar, stop animation and hand over to native scroll
        const stopAnimation = () => {
          if (!mover.classList.contains('is-scrolling')) return;

          // A. Get the current visual position (where the animation is right now)
          const style = window.getComputedStyle(mover);
          const matrix = new DOMMatrix(style.transform);
          const currentX = matrix.m41; // The X translation (negative number)

          // B. Swap: Set the scroll position to match the animation
          // We flip the sign (Animation -50px = Scroll Left 50px)
          container.scrollLeft = Math.abs(currentX);

          // C. Kill the animation class
          mover.classList.remove('is-scrolling');
          
          // D. Remove the transform so it doesn't double-apply
          mover.style.transform = 'none';
        };

        // Listen for touch or mouse click
        container.addEventListener('pointerdown', stopAnimation, { once: true });
        container.addEventListener('touchstart', stopAnimation, { passive: true, once: true });
      }
    }

    // Run on load
    setTimeout(initBreadcrumbs, 100);

    // Run on resize
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(initBreadcrumbs, 200);
    });
  })();





  /*
  ==============================================================================
   SITE SEARCH (using MiniSearch now)
  ==============================================================================
  */

  // Load MiniSearch if needed
  if (typeof MiniSearch === 'undefined') {
    const script = document.createElement('script');
    script.src = '/js/lib/minisearch.js'; // Corrected path
    script.onload = () => { window.BodgeLab.searchReady = true; };
    document.head.appendChild(script);
  } else {
    window.BodgeLab.searchReady = true;
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

    if (!window.BodgeLab.searchReady) {
      console.log("Search library loading...");
      return []; // Or implement a retry/wait logic here
    }

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

