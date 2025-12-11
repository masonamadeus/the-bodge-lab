// _includes/js/theme.js
(function () {

  /**
   * Dynamically loads Google Fonts by creating a <link> tag.
   * Now accepts two font names to load in one request.
   */
  function loadGoogleFont(bodyFont, monoFont) {
    const fonts = [];
    
    // Add body font if it's not a system font
    if (bodyFont && bodyFont !== 'system-ui') {
      fonts.push(bodyFont.replace(/ /g, '+'));
    }
    // Add mono font if it's not a system font
    if (monoFont && monoFont !== 'monospace') {
      fonts.push(monoFont.replace(/ /g, '+'));
    }

    // If no Google fonts to load, just exit
    if (fonts.length === 0) return;

    // Create a single <link> tag for all fonts
    // e.g., family=Roboto&family=Roboto+Mono
    const formattedQuery = fonts.map(f => `family=${f}:wght@400;700`).join('&');
    
    const fontLink = document.createElement('link');
    fontLink.href = `https://fonts.googleapis.com/css2?${formattedQuery}&display=swap`;
    fontLink.rel = 'stylesheet';
    
    // Remove any old Google Font links
    document.querySelectorAll('link[href^="https://fonts.googleapis.com"]').forEach(el => el.remove());
    
    document.head.appendChild(fontLink);
  }

  // --- HELPER FUNCTIONS ---

  const BODY_FONT_PALETTE = [
    "Open Sans",
    "Lato",
    "Montserrat", 
    "Noto Sans", 
    "Poppins", 
    "Merriweather", 
    "PT Serif", 
    "Lora", 
    "Playfair Display",
    "Galindo",
    "M PLUS Rounded 1c",
    "Quantico",
    "Roboto",
    "Saira",
    "Signika Negative",
    "Spectral",
    "Wellfleet"
  ];
  
  const MONO_FONT_PALETTE = [
    "Roboto Mono",
    "Source Code Pro",
    "Inconsolata", "Fira Mono", 
    "Ubuntu Mono",
    "Space Mono",
    "JetBrains Mono",
    "DM Mono",
    "Kode Mono",
    "Overpass Mono",
    "Reddit Mono"
  ];

  function getSeed(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  function getSeededRandomInRange(seed, offset, min, max) {
    const range = max - min + 1;
    return ((seed >> offset) % range) + min;
  }

  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [255 * f(0), 255 * f(8), 255 * f(4)];
  }

  function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function getContrast(hsl1, hsl2) {
    const rgb1 = hslToRgb(hsl1.h, hsl1.s, hsl1.l);
    const rgb2 = hslToRgb(hsl2.h, hsl2.s, hsl2.l);
    const lum1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
    const lum2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  function ensureContrast(fgHsl, bgHsl, targetRatio = 4.5) {
    let currentL = fgHsl.l;
    let currentContrast = getContrast({ ...fgHsl, l: currentL }, bgHsl);
    const bgRgb = hslToRgb(bgHsl.h, bgHsl.s, bgHsl.l);
    const bgLum = getLuminance(bgRgb[0], bgRgb[1], bgRgb[2]);
    const isBgLight = bgLum > 0.5;
    if (isBgLight) {
      while (currentContrast < targetRatio && currentL > 0) {
        currentL--;
        currentContrast = getContrast({ ...fgHsl, l: currentL }, bgHsl);
      }
    } else {
      while (currentContrast < targetRatio && currentL < 100) {
        currentL++;
        currentContrast = getContrast({ ...fgHsl, l: currentL }, bgHsl);
      }
    }
    return currentL;
  }

  /**
   * This is the theme generation "pipeline".
   * It takes 5 HSL inputs and generates a contrast-checked 7-variable palette.
   */
  function generatePalette(inputs, isDark = false) {
    const { bg_obj, text_obj, text_muted_obj, accent_obj, bg_muted_obj } = inputs;
    
    // Checking text contrast against the backgrounds
    const check_bg_obj = bg_obj;
    const check_muted_bg_obj = { 
        h: bg_muted_obj.h, 
        s: bg_muted_obj.border_s || bg_muted_obj.s, 
        l: bg_muted_obj.border_l || bg_muted_obj.l 
    };

    const RATIO_TEXT = 4.5;
    const RATIO_ACCENT = 3.0;

    // Run corrections
    const l_text_vs_bg = ensureContrast(text_obj, check_bg_obj, RATIO_TEXT);
    const l_text_vs_muted = ensureContrast(text_obj, check_muted_bg_obj, RATIO_TEXT);
    const final_text_l = isDark ? Math.max(l_text_vs_bg, l_text_vs_muted) : Math.min(l_text_vs_bg, l_text_vs_muted);
    
    const final_text_muted_l = ensureContrast(text_muted_obj, check_bg_obj, RATIO_TEXT);
    
    const l_accent_vs_bg = ensureContrast(accent_obj, check_bg_obj, RATIO_ACCENT);
    const l_accent_vs_muted = ensureContrast(accent_obj, check_muted_bg_obj, RATIO_ACCENT);
    const final_accent_l = isDark ? Math.max(l_accent_vs_bg, l_accent_vs_muted) : Math.min(l_accent_vs_bg, l_accent_vs_muted);

    // Build the 7-variable palette
    return {
      '--bg-color': `hsl(${bg_obj.h}, ${bg_obj.s}%, ${bg_obj.l}%)`,
      '--bg-color-bright': `hsl(${bg_obj.h}, ${bg_obj.s}%, ${isDark ? Math.min(100, bg_obj.l - 8) : Math.min(100, bg_obj.l + 9)}%)`,
      '--text-color': `hsl(${text_obj.h}, ${text_obj.s}%, ${final_text_l}%)`,
      '--text-muted': `hsl(${text_muted_obj.h}, ${text_muted_obj.s}%, ${final_text_muted_l}%)`,
      '--accent-color': `hsl(${accent_obj.h}, ${accent_obj.s}%, ${final_accent_l}%)`,
      '--border-color': `hsl(${bg_muted_obj.h}, ${bg_muted_obj.border_s || bg_muted_obj.s}%, ${bg_muted_obj.border_l || bg_muted_obj.l}%)`,
      '--bg-muted': `hsl(${bg_muted_obj.h}, ${bg_muted_obj.s}%, ${bg_muted_obj.l}%)`
    };
  }

  /**
   * Applies a specific palette (light or dark) to the root.
   */
  function applyPalette(palette) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(palette)) {
      root.style.setProperty(key, value);
    }
  }

  /**
   * This function runs ONCE on page load to get the
   * initial inputs from either localStorage or the bodge seed.
   */
  function getInitialInputs() {
    const customThemeJSON = localStorage.getItem('customThemeFull');
    if (customThemeJSON) {
      try {
        const theme = JSON.parse(customThemeJSON);
        if (theme.bodyFont && theme.light && theme.dark) {
          theme.monoFont = theme.monoFont || 'monospace';
          return theme; 
        } else {
          localStorage.removeItem('customThemeFull');
        }
      } catch (e) {
        localStorage.removeItem('customThemeFull');
      }
    }


    // --- BODGE MODE ---
    let seed;
    const existingSeed = localStorage.getItem('themeSeed');
    if (existingSeed) {
      seed = parseInt(existingSeed, 10);
    } else {
      const uniqueString = [
        navigator.userAgent, navigator.language || (navigator.languages && navigator.languages[0]),
        (screen.width || 0) + 'x' + (screen.height || 0), new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 1, navigator.deviceMemory || 0,
        window.devicePixelRatio || 0, screen.colorDepth || 0,
        navigator.webdriver || false, (screen.availWidth || 0) + 'x' + (screen.availHeight || 0),
        navigator.maxTouchPoints || 0, navigator.doNotTrack || "unspecified",
        Intl.DateTimeFormat().resolvedOptions().timeZone || ""
      ].join('|');
      seed = getSeed(uniqueString);
      localStorage.setItem('themeSeed', seed.toString());
    }

    // Bodge Hues
    const baseUIHue = seed % 360;
    const accent1Hue = (seed >> 8) % 360;
    const accent2Hue = (seed >> 16) % 360;
    
    // Bodge Light S/L
    const light_bg_s = getSeededRandomInRange(seed, 2, 15, 85);
    const light_bg_l = getSeededRandomInRange(seed, 4, 88, 92);
    const light_text_s = getSeededRandomInRange(seed, 6, 15, 65);
    const light_text_l = getSeededRandomInRange(seed, 8, 18, 22);
    const light_text_muted_s = getSeededRandomInRange(seed, 10, 5, 30);
    const light_text_muted_l = getSeededRandomInRange(seed, 12, 33, 37);
    const accent1_s = getSeededRandomInRange(seed, 14, 15, 75);
    const accent1_l = getSeededRandomInRange(seed, 16, 42, 48);
    const accent2_border_s = getSeededRandomInRange(seed, 18, 5, 65);
    const accent2_border_l = getSeededRandomInRange(seed, 20, 18, 25);
    const accent2_muted_s = getSeededRandomInRange(seed, 22, 5, 45);
    const accent2_muted_l = getSeededRandomInRange(seed, 24, 78, 82);
    
    const bodyFont = BODY_FONT_PALETTE[getSeededRandomInRange(seed, 0, 0, BODY_FONT_PALETTE.length - 1)];
    const monoFont = MONO_FONT_PALETTE[getSeededRandomInRange(seed, 1, 0, MONO_FONT_PALETTE.length - 1)];

    // Create Light Inputs
    const lightInputs = {
      bg_obj: { h: baseUIHue, s: light_bg_s, l: light_bg_l },
      text_obj: { h: baseUIHue, s: light_text_s, l: light_text_l },
      text_muted_obj: { h: baseUIHue, s: light_text_muted_s, l: light_text_muted_l },
      accent_obj: { h: accent1Hue, s: accent1_s, l: accent1_l },
      bg_muted_obj: { h: accent2Hue, s: accent2_muted_s, l: accent2_muted_l, border_s: accent2_border_s, border_l: accent2_border_l }
    };

    // Create Dark Inputs (Correctly)
    const darkInputs = {
      bg_obj: { h: baseUIHue, s: light_text_s, l: light_text_l },
      text_obj: { h: baseUIHue, s: light_bg_s, l: light_bg_l },
      text_muted_obj: { h: baseUIHue, s: light_text_muted_s, l: 100 - light_text_muted_l },
      accent_obj: { h: accent1Hue, s: accent1_s, l: Math.min(100, accent1_l + 20) },
      bg_muted_obj: { 
        h: accent2Hue, 
        s: accent2_border_s, 
        l: accent2_border_l, 
        border_s: accent2_muted_s, 
        border_l: accent2_muted_l 
      }
    };
    
    
    const bodgeTheme = { 
      bodyFont: bodyFont, 
      monoFont: monoFont, 
      light: lightInputs, 
      dark: darkInputs 
    };
    localStorage.setItem('customThemeFull', JSON.stringify(bodgeTheme));
    
    return bodgeTheme;
  }

  // --- INITIAL PAGE LOAD ---
  const allInputs = getInitialInputs();
  const lightPalette = generatePalette(allInputs.light, false);
  const darkPalette = generatePalette(allInputs.dark, true);
  
  window.__THEME__ = { light: lightPalette, dark: darkPalette };
  
  let currentTheme = localStorage.getItem('theme');
  if (!currentTheme) {
    currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  applyPalette(currentTheme === 'dark' ? darkPalette : lightPalette);
  
  document.documentElement.setAttribute('data-theme', currentTheme);
  loadGoogleFont(allInputs.bodyFont, allInputs.monoFont);

  const finalBodyFont = allInputs.bodyFont || 'system-ui';
  const finalMonoFont = allInputs.monoFont || 'monospace';
  document.documentElement.style.setProperty('--body-font', `"${finalBodyFont}", system-ui, sans-serif`);
  document.documentElement.style.setProperty('--mono-font', `"${finalMonoFont}", monospace`);

  // --- EXPOSE FUNCTIONS for customizer & toggle ---
  
  window.updateThemePalette = function(mode, inputs) {
    allInputs[mode] = inputs;
    
    const newPalette = generatePalette(inputs, mode === 'dark');
    window.__THEME__[mode] = newPalette;
    
    if (document.documentElement.getAttribute('data-theme') === mode) {
      applyPalette(newPalette);
    }
  }
  
  window.applyTheme = function(theme) {
    applyPalette(window.__THEME__[theme]);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

})();