// _includes/js/theme.js
(function () {

  // --- A. HELPER FUNCTIONS ---

  function getSeed(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  function getSeededRandomInRange(seed, offset, min, max) {
    const range = max - min + 1;
    return ((seed >> offset) % range) + min;
  }

  /* --- CONTRAST CHECKING FUNCTIONS --- */

  /**
   * Converts an HSL color value to RGB.
   * Assumes h, s, and l are in the set [0, 360], [0, 100], [0, 100].
   * Returns [r, g, b] in the set [0, 255].
   */
  function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [255 * f(0), 255 * f(8), 255 * f(4)];
  }

  /**
   * Calculates the relative luminance of an RGB color.
   */
  function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  /**
   * Calculates the contrast ratio between two HSL colors.
   */
  function getContrast(hsl1, hsl2) {
    const rgb1 = hslToRgb(hsl1.h, hsl1.s, hsl1.l);
    const rgb2 = hslToRgb(hsl2.h, hsl2.s, hsl2.l);

    const lum1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
    const lum2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);

    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);

    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * Deterministically adjusts a foreground color's lightness to meet a target contrast ratio.
   * @param {object} fgHsl - Foreground {h, s, l}
   * @param {object} bgHsl - Background {h, s, l}
   * @param {number} targetRatio - e.g., 4.5
   * @returns {number} The new, corrected lightness (l) value for the foreground.
   */
  function ensureContrast(fgHsl, bgHsl, targetRatio = 4.5) {
    let currentL = fgHsl.l;
    let currentContrast = getContrast({ ...fgHsl, l: currentL }, bgHsl);

    // Get background luminance to see if it's light or dark
    const bgRgb = hslToRgb(bgHsl.h, bgHsl.s, bgHsl.l);
    const bgLum = getLuminance(bgRgb[0], bgRgb[1], bgRgb[2]);

    const isBgLight = bgLum > 0.5;

    if (isBgLight) {
      // Background is light, so darken foreground
      while (currentContrast < targetRatio && currentL > 0) {
        currentL--;
        currentContrast = getContrast({ ...fgHsl, l: currentL }, bgHsl);
      }
    } else {
      // Background is dark, so lighten foreground
      while (currentContrast < targetRatio && currentL < 100) {
        currentL++;
        currentContrast = getContrast({ ...fgHsl, l: currentL }, bgHsl);
      }
    }
    return currentL;
  }

  // --- B. GATHER ALL USER DATA (EVEN MORE) ---

  const uniqueString = [
    navigator.userAgent,
    navigator.language || (navigator.languages && navigator.languages[0]),
    (screen.width || 0) + 'x' + (screen.height || 0),
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 1,
    navigator.deviceMemory || 0,
    window.devicePixelRatio || 0,
    (navigator.plugins || []).length,
    (navigator.mimeTypes || []).length,
    navigator.platform || "",
    navigator.vendor || "",
    screen.colorDepth || 0,

    // --- HERE ARE THE NEW DATA POINTS ---
    navigator.webdriver || false, // Is the user a bot/automation?
    (screen.availWidth || 0) + 'x' + (screen.availHeight || 0), // Available screen (minus taskbars)
    navigator.maxTouchPoints || 0, // Are they on a touchscreen?
    navigator.doNotTrack || "unspecified", // Do Not Track setting
    Intl.DateTimeFormat().resolvedOptions().timeZone || "" // IANA Timezone (e.g., "America/New_York")
    // --- END NEW DATA ---

  ].join('|');

  const seed = getSeed(uniqueString);


  // --- C. GENERATE THE UNIQUE "BODGE" PALETTE ---

  // 1. Generate 3 Independent Hues
  const baseUIHue = seed % 360;
  const accent1Hue = (seed >> 8) % 360;
  const accent2Hue = (seed >> 16) % 360;

  // 2. Generate Randomized S/L Values (using your CSS as baseline)
  // (These are now the *initial* values)
  const light_bg_s = getSeededRandomInRange(seed, 2, 55, 85);
  const light_bg_l = getSeededRandomInRange(seed, 4, 88, 92);
  const light_text_s = getSeededRandomInRange(seed, 6, 25, 65);
  const light_text_l = getSeededRandomInRange(seed, 8, 18, 22);
  const light_text_muted_s = getSeededRandomInRange(seed, 10, 5, 30);
  const light_text_muted_l = getSeededRandomInRange(seed, 12, 33, 37);
  const accent1_s = getSeededRandomInRange(seed, 14, 45, 75);
  const accent1_l = getSeededRandomInRange(seed, 16, 42, 48);
  const accent2_border_s = getSeededRandomInRange(seed, 18, 5, 65);
  const accent2_border_l = getSeededRandomInRange(seed, 20, 18, 25);
  const accent2_muted_s = getSeededRandomInRange(seed, 22, 25, 35);
  const accent2_muted_l = getSeededRandomInRange(seed, 24, 78, 82);

  // --- 3. VALIDATE AND CORRECT CONTRAST ---

// WCAG AA requires 4.5:1 for normal text and 3:1 for large/UI components.
const RATIO_TEXT = 4.5;
const RATIO_ACCENT = 3.0;

// Define the base HSL objects
const light_bg_obj =       { h: baseUIHue,  s: light_bg_s,         l: light_bg_l };
const light_text_obj =     { h: baseUIHue,  s: light_text_s,       l: light_text_l };
const light_text_muted_obj = { h: baseUIHue,  s: light_text_muted_s, l: light_text_muted_l };
const light_accent_obj =   { h: accent1Hue, s: accent1_s,          l: accent1_l };
const light_bg_muted_obj = { h: accent2Hue, s: accent2_muted_s,    l: accent2_muted_l };

const dark_bg_obj =        { h: baseUIHue,  s: light_text_s,       l: light_text_l };
const dark_text_muted_obj =  { h: baseUIHue,  s: light_text_muted_s, l: 100 - light_text_muted_l };
const dark_accent_obj =    { h: accent1Hue, s: accent1_s,          l: Math.min(100, accent1_l + 20) };
const dark_bg_muted_obj =  { h: accent2Hue, s: accent2_border_s,   l: accent2_border_l };


// Run corrections and get the *final* lightness values
// --- Light Theme Corrections ---
const final_light_text_l = ensureContrast(light_text_obj, light_bg_obj, RATIO_TEXT);
const final_light_text_muted_l = ensureContrast(light_text_muted_obj, light_bg_obj, RATIO_TEXT);
// Check text on the *other* background
const final_light_text_on_muted_l = ensureContrast({ ...light_text_obj, l: final_light_text_l }, light_bg_muted_obj, RATIO_TEXT);

// Check accent against the main background
const l_accent_vs_bg = ensureContrast(light_accent_obj, light_bg_obj, RATIO_ACCENT);
// Check accent against the muted background
const l_accent_vs_muted = ensureContrast(light_accent_obj, light_bg_muted_obj, RATIO_ACCENT);
// In light mode, a lower 'l' is darker. We need the darkest 'l' to pass both checks.
const final_light_accent_l = Math.min(l_accent_vs_bg, l_accent_vs_muted);

// --- Dark Theme Corrections ---
const final_dark_text_muted_l = ensureContrast(dark_text_muted_obj, dark_bg_obj, RATIO_TEXT);
// We also need to check dark text on the dark muted bg
const final_dark_text_on_muted_l = ensureContrast({ h: baseUIHue, s: light_bg_s, l: light_bg_l }, dark_bg_muted_obj, RATIO_TEXT);

// Check accent against the main background
const l_dark_accent_vs_bg = ensureContrast(dark_accent_obj, dark_bg_obj, RATIO_ACCENT);
// Check accent against the muted background
const l_dark_accent_vs_muted = ensureContrast(dark_accent_obj, dark_bg_muted_obj, RATIO_ACCENT);
// In dark mode, a higher 'l' is lighter. We need the lightest 'l' to pass both checks.
const final_dark_accent_l = Math.max(l_dark_accent_vs_bg, l_dark_accent_vs_muted);

  // 4. Define BOTH Light and Dark Palettes based on these *corrected* values
  const lightPalette = {
    '--bg-color': `hsl(${baseUIHue}, ${light_bg_s}%, ${light_bg_l}%)`,
    '--bg-color-bright': `hsl(${baseUIHue}, ${light_bg_s}%, ${Math.min(100, light_bg_l + 16)}%)`,
    '--text-color': `hsl(${baseUIHue}, ${light_text_s}%, ${final_light_text_on_muted_l}%)`, // Use the most-corrected value
    '--text-muted': `hsl(${baseUIHue}, ${light_text_muted_s}%, ${final_light_text_muted_l}%)`,
    '--accent-color': `hsl(${accent1Hue}, ${accent1_s}%, ${final_light_accent_l}%)`,
    '--border-color': `hsl(${accent2Hue}, ${accent2_border_s}%, ${accent2_border_l}%)`,
    '--bg-muted': `hsl(${accent2Hue}, ${accent2_muted_s}%, ${accent2_muted_l}%)`
  };

  const darkPalette = {
    '--bg-color': `hsl(${baseUIHue}, ${light_text_s}%, ${light_text_l}%)`,
    '--bg-color-bright': `hsl(${baseUIHue}, ${light_text_s}%, ${Math.min(100, light_text_l - 8)}%)`,
    '--text-color': `hsl(${baseUIHue}, ${light_bg_s}%, ${final_dark_text_on_muted_l}%)`, // Use the most-corrected value
    '--text-muted': `hsl(${baseUIHue}, ${light_text_muted_s}%, ${final_dark_text_muted_l}%)`,
    '--accent-color': `hsl(${accent1Hue}, ${accent1_s}%, ${final_dark_accent_l}%)`,
    '--border-color': `hsl(${accent2Hue}, ${accent2_muted_s}%, ${accent2_muted_l}%)`,
    '--bg-muted': `hsl(${accent2Hue}, ${accent2_border_s}%, ${accent2_border_l}%)`
  };

  // 5. Store palettes for the toggle script to use later
  window.__THEME__ = {
    light: lightPalette,
    dark: darkPalette
  };

  // --- D. DETERMINE AND APPLY THEME ---

  let currentTheme = localStorage.getItem('theme');
  if (!currentTheme) {
    currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // 5. Apply the chosen theme
  const palette = currentTheme === 'dark' ? darkPalette : lightPalette;

  const root = document.documentElement;
  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(key, value);
  }

  // 6. Set the data-theme for CSS and the toggle script
  root.setAttribute('data-theme', currentTheme);

  // 7. Apply font theme
  const bodyFont = fontPalettes[seed % fontPalettes.length];
  const monoFont = bodyFont.includes('monospace') ? bodyFont : 'monospace';
  root.style.setProperty('--body-font', bodyFont);
  root.style.setProperty('--mono-font', monoFont);

})();