---
title: "Theme Roller"
download: false
directory: true
---
<style>
    /* --- 7. Theme Roller Styles --- */
.theme-roller-button {
  background: var(--bg-muted);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 0.5em 1em;
  cursor: pointer;
  font-size: 1em;
  font-family: var(--body-font);
  margin: 0.5em 0.5em 0.5em 0;
}
.theme-roller-button:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}
.theme-roller-button.reset {
  background: none;
  border-color: transparent;
  color: var(--text-muted);
}
.theme-roller-button.reset:hover {
  color: var(--text-color);
  text-decoration: underline;
}
</style>
## Re-roll Your Theme

Your current theme is generated from a unique "seed" based on your browser.

If you don't like it, you can get a new random one here. This new theme will be saved locally and used on all subsequent visits.

<button id="theme-reroll" class="theme-roller-button">🎲 Re-roll Theme</button>
<button id="theme-reset" class="theme-roller-button reset">Reset to Default</button>

<script>
document.addEventListener('DOMContentLoaded', () => {
    (function() {
      const rerollButton = document.getElementById('theme-reroll');
      const resetButton = document.getElementById('theme-reset');

      if (rerollButton) {
        // 1. Re-roll Button
        rerollButton.addEventListener('click', () => {
          // Generate a new random seed
          const newSeed = Math.floor(Math.random() * 99999999);
          
          // Store it in localStorage
          localStorage.setItem('themeSeed', newSeed.toString());
          
          // Reload the page to see the new theme
          location.reload();
        });

        // 2. Reset Button
        resetButton.addEventListener('click', () => {
          // Remove the custom seed
          localStorage.removeItem('themeSeed');
          
          // Reload the page to get the default fingerprint theme
          location.reload();
        });
      }
    })();

});
</script>