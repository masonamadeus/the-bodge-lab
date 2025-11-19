---
title: randomize theme
download: false
directory: true
uid: d31fdb3b
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

When you first visited The Bodge Lab, I created a custom theme just for you - based on a bunch of your device and browser data!

If you don't like the theme I made for you, you can get a new random theme here! This new theme will be saved locally and used on all subsequent visits.

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
          // Disable any custom theme
          localStorage.removeItem('customThemeFull');
          
          // Generate a new random seed
          const newSeed = Math.floor(Math.random() * 99999999);
          localStorage.setItem('themeSeed', newSeed.toString());
          
          location.reload();
        });

        // 2. Reset Button
        resetButton.addEventListener('click', () => {
          // Disable any custom theme
          localStorage.removeItem('customThemeFull');

          // Remove the custom seed
          localStorage.removeItem('themeSeed');
          
          location.reload();
        });
      }
    })();
});
</script>
