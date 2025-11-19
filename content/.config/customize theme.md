---
title: customize theme
download: false
directory: true
uid: 0a85b49b
---

<style>
  .theme-editor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5em;
    margin-top: 1.5em;
  }
  .theme-editor-grid fieldset {
    border: 1px solid var(--border-color);
    padding: 1em;
  }
  .theme-editor-grid legend {
    font-weight: bold;
    color: var(--muted-text-color);
    padding: 0 0.5em;
  }
  .form-row {
    margin-bottom: 1em;
  }
  .form-row label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5em;
    color: var(--text-color);
  }
  .form-row label span {
    font-family: var(--mono-font);
    font-size: 0.9em;
    background: var(--bg-muted);
    padding: 2px 6px;
  }
  .form-row input[type="color"] {
    width: 100%;
    height: 40px;
    padding: 0;
    border: none;
    background: var(--bg-muted);
  }
  .form-row input[type="text"] {
    width: 95%;
    padding: 0.5em;
    font-family: var(--body-font);
    background: var(--bg-muted);
    border: 1px solid var(--border-color);
    color: var(--text-color);
  }
  .theme-actions {
    margin-top: 1.5em;
    display: flex;
    flex-wrap: wrap; /* Allow buttons to wrap on small screens */
    gap: 1em;
  }
  .theme-button {
    background: var(--accent-color);
    color: var(--bg-color-bright);
    border: none;
    padding: 0.75em 1.5em;
    font-size: 1em;
    cursor: pointer;
  }
  .theme-button.reset,
  .theme-button.random {
    background: var(--bg-muted);
    color: var(--text-color);
    border: 1px solid var(--border-color);
  }
  .theme-button.reset:hover,
  .theme-button.random:hover {
    border-color: var(--accent-color);
    color: var(--accent-color);
  }
  /* Helper class for JS */
  .hidden {
    display: none;
  }
</style>

## Customize Your Theme

When you first visit The Bodge Lab, it creates a unique custom theme for you based on your device data!

You can learn more about that [here](<../about the site/>).

If you don't like it, you can customize it here. **All changes save automatically.**

<hr>

<div class="form-row">
  <label for="body-font-name">Body Font Name:</label>
  <input type="text" id="body-font-name" placeholder="Open Sans">
</div>
<div class="form-row">
  <label for="mono-font-name">Monospace Font Name:</label>
  <input type="text" id="mono-font-name" placeholder="Roboto Mono">
</div>

You can use any font from [Google Fonts](https://fonts.google.com/). Just enter the name exactly as it appears on the site.

<hr>

<div class="theme-editor-grid">
  <fieldset id="editor-light">
    <legend>Light Mode</legend>
    <div class="form-row">
      <label for="light-color-bg">Page Background</label>
      <input type="color" id="light-color-bg" value="#F0F5FA" class="realtime-picker" data-mode="light">
    </div>
    <div class="form-row">
      <label for="light-color-text">Base Text</label>
      <input type="color" id="light-color-text" value="#2C3E50" class="realtime-picker" data-mode="light">
    </div>
    <div class="form-row">
      <label for="light-color-text-muted">Muted Text</label>
      <input type="color" id="light-color-text-muted" value="#7F8C8D" class="realtime-picker" data-mode="light">
    </div>
    <div class="form-row">
      <label for="light-color-accent">Accent Color</label>
      <input type="color" id="light-color-accent" value="#3498DB" class="realtime-picker" data-mode="light">
    </div>
    <div class="form-row">
      <label for="light-color-bg-muted">Muted Background</label>
      <input type="color" id="light-color-bg-muted" value="#ECF0F1" class="realtime-picker" data-mode="light">
    </div>
  </fieldset>
  
  <fieldset id="editor-dark">
    <legend>Dark Mode</legend>
    <div class="form-row">
      <label for="dark-color-bg">Page Background</label>
      <input type="color" id="dark-color-bg" value="#2C3E50" class="realtime-picker" data-mode="dark">
    </div>
    <div class="form-row">
      <label for="dark-color-text">Base Text</label>
      <input type="color" id="dark-color-text" value="#F0F5FA" class="realtime-picker" data-mode="dark">
    </div>
    <div class="form-row">
      <label for="dark-color-text-muted">Muted Text</label>
      <input type="color" id="dark-color-text-muted" value="#95A5A6" class="realtime-picker" data-mode="dark">
    </div>
    <div class="form-row">
      <label for="dark-color-accent">Accent Color</label>
      <input type="color" id="dark-color-accent" value="#5DADE2" class="realtime-picker" data-mode="dark">
    </div>
    <div class="form-row">
      <label for="dark-color-bg-muted">Muted Background</label>
      <input type="color" id="dark-color-bg-muted" value="#34495E" class="realtime-picker" data-mode="dark">
    </div>
  </fieldset>
</div>

The Bodge Theme Engine™ will attempt to adjust your color choices for proper contrast and accessibility, so they may change slightly when you save.

Now... this adjustment might also fail, and you can definitely make the site unreadable if you try. 

Up to you, do what you want!

<div class="theme-actions">
  <button id="theme-reroll" class="theme-button random">🎲 Randomize</button>
  <button id="reset-custom-theme" class="theme-button reset">Reset to Bodge Theme</button>
</div>

<script>
document.addEventListener('DOMContentLoaded', () => {
  // --- Start: Color Conversion Helpers ---
  function hexToRgb(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length == 4) {
      r = "0x" + hex[1] + hex[1]; g = "0x" + hex[2] + hex[2]; b = "0x" + hex[3] + hex[3];
    } else if (hex.length == 7) {
      r = "0x" + hex[1] + hex[2]; g = "0x" + hex[3] + hex[4]; b = "0x" + hex[5] + hex[6];
    }
    return { r: +r, g: +g, b: +b };
  }
  
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max == min) { h = s = 0; } else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  
  function getHslFromHex(hex) {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHsl(r, g, b);
  }
  
  function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  // --- End: Color Conversion Helpers ---

  // Button Elements
  const rerollBtn = document.getElementById('theme-reroll');
  const resetBtn = document.getElementById('reset-custom-theme');

  // Input Elements
  const bodyFontInput = document.getElementById('body-font-name');
  const monoFontInput = document.getElementById('mono-font-name');
  const lightFieldset = document.getElementById('editor-light');
  const darkFieldset = document.getElementById('editor-dark');
  
  const lightInputs = {
    bg: document.getElementById('light-color-bg'),
    text: document.getElementById('light-color-text'),
    textMuted: document.getElementById('light-color-text-muted'),
    accent: document.getElementById('light-color-accent'),
    bgMuted: document.getElementById('light-color-bg-muted')
  };
  
  const darkInputs = {
    bg: document.getElementById('dark-color-bg'),
    text: document.getElementById('dark-color-text'),
    textMuted: document.getElementById('dark-color-text-muted'),
    accent: document.getElementById('dark-color-accent'),
    bgMuted: document.getElementById('dark-color-bg-muted')
  };

  /**
   * Reads a set of form inputs (light or dark) and returns HSL objects
   */
  function getInputsFromForm(mode) {
    const inputs = (mode === 'light') ? lightInputs : darkInputs;
    return {
      bg_obj: getHslFromHex(inputs.bg.value),
      text_obj: getHslFromHex(inputs.text.value),
      text_muted_obj: getHslFromHex(inputs.textMuted.value),
      accent_obj: getHslFromHex(inputs.accent.value),
      bg_muted_obj: getHslFromHex(inputs.bgMuted.value)
    };
  }

  /**
   * Silently builds the theme object and saves it to localStorage.
   */
  function saveCustomTheme() {
    const finalTheme = {
      bodyFont: bodyFontInput.value || 'system-ui',
      monoFont: monoFontInput.value || 'monospace',
      light: getInputsFromForm('light'),
      dark: getInputsFromForm('dark')
    };
    
    localStorage.setItem('customThemeFull', JSON.stringify(finalTheme));
    localStorage.removeItem('themeSeed'); // Clear bodge seed
  }

  /**
   * Real-time update function (for live preview)
   */
  function updateThemePreview(e) {
    if (window.updateThemePalette) {
      const mode = e.target.dataset.mode;
      const inputs = getInputsFromForm(mode);
      window.updateThemePalette(mode, inputs);
    }
  }

  /**
   * Shows/hides the correct editor fieldset
   */
  function toggleEditor(newTheme) {
    if (newTheme === 'dark') {
      lightFieldset.classList.add('hidden');
      darkFieldset.classList.remove('hidden');
    } else {
      lightFieldset.classList.remove('hidden');
      darkFieldset.classList.add('hidden');
    }
  }

  // --- Load Initial State ---
  const currentTheme = JSON.parse(localStorage.getItem('customThemeFull'));
  if (currentTheme) {
    bodyFontInput.value = currentTheme.bodyFont;
    monoFontInput.value = currentTheme.monoFont;
    
    // Populate Light Pickers
    lightInputs.bg.value = hslToHex(currentTheme.light.bg_obj.h, currentTheme.light.bg_obj.s, currentTheme.light.bg_obj.l);
    lightInputs.text.value = hslToHex(currentTheme.light.text_obj.h, currentTheme.light.text_obj.s, currentTheme.light.text_obj.l);
    lightInputs.textMuted.value = hslToHex(currentTheme.light.text_muted_obj.h, currentTheme.light.text_muted_obj.s, currentTheme.light.text_muted_obj.l);
    lightInputs.accent.value = hslToHex(currentTheme.light.accent_obj.h, currentTheme.light.accent_obj.s, currentTheme.light.accent_obj.l);
    lightInputs.bgMuted.value = hslToHex(currentTheme.light.bg_muted_obj.h, currentTheme.light.bg_muted_obj.s, currentTheme.light.bg_muted_obj.l);
    
    // Populate Dark Pickers
    darkInputs.bg.value = hslToHex(currentTheme.dark.bg_obj.h, currentTheme.dark.bg_obj.s, currentTheme.dark.bg_obj.l);
    darkInputs.text.value = hslToHex(currentTheme.dark.text_obj.h, currentTheme.dark.text_obj.s, currentTheme.dark.text_obj.l);
    darkInputs.textMuted.value = hslToHex(currentTheme.dark.text_muted_obj.h, currentTheme.dark.text_muted_obj.s, currentTheme.dark.text_muted_obj.l);
    darkInputs.accent.value = hslToHex(currentTheme.dark.accent_obj.h, currentTheme.dark.accent_obj.s, currentTheme.dark.accent_obj.l);
    darkInputs.bgMuted.value = hslToHex(currentTheme.dark.bg_muted_obj.h, currentTheme.dark.bg_muted_obj.s, currentTheme.dark.bg_muted_obj.l);
  }

  // --- Attach Listeners ---
  
  // Font inputs auto-save on 'blur' (when user clicks away)
  bodyFontInput.addEventListener('blur', saveCustomTheme);
  monoFontInput.addEventListener('blur', saveCustomTheme);
  
  // Attach auto-save listeners to all 10 pickers
  document.querySelectorAll('.realtime-picker').forEach(picker => {
    // This listener handles the LIVE PREVIEW
    picker.addEventListener('input', updateThemePreview);
    
    // This listener handles the AUTO-SAVE
    // 'change' fires only when the user *finishes* selecting a color
    picker.addEventListener('change', saveCustomTheme);
  });
  
  // Listen for the toggle event
  document.addEventListener('theme:toggled', (e) => {
    toggleEditor(e.detail.newTheme);
  });
  
  // Set initial editor state
  toggleEditor(document.documentElement.getAttribute('data-theme'));

  // Randomize Button
  rerollBtn.addEventListener('click', () => {
    // Disable any custom theme
    localStorage.removeItem('customThemeFull');
    
    // Generate a new random seed
    const newSeed = Math.floor(Math.random() * 99999999);
    localStorage.setItem('themeSeed', newSeed.toString());
    
    location.reload();
  });

  // Reset Button
  resetBtn.addEventListener('click', () => {
    localStorage.removeItem('customThemeFull');
    localStorage.removeItem('themeSeed');
    location.reload();
  });
});
</script>
