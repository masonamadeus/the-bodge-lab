(function() {
  // Simple "hash" function to get a stable number from a string (deterministic)
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

  // --- Font Palettes ---
  const fontPalettes = [
    'system-ui, -apple-system, sans-serif',
    '"Merriweather", "Georgia", serif',
    '"Inconsolata", "Menlo", monospace',
    '"Palatino", "Book Antiqua", serif'
  ];
  
  // --- 1. Generate Unique Seed ---
  
  // Combine multiple data points for a more unique ID.
  const uniqueString = [
    navigator.userAgent,
    navigator.language || (navigator.languages && navigator.languages[0]),
    (screen.width || 0) + 'x' + (screen.height || 0),
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 1
  ].join('|');
  
  const seed = getSeed(uniqueString);

  // --- 2. Generate Font Theme ---
  
  const bodyFont = fontPalettes[seed % fontPalettes.length];
  const monoFont = bodyFont.includes('monospace') ? bodyFont : 'monospace';

  // --- 3. Generate THREE Independent Hues ---
  // This is the new logic. We use bit-shifting to "roll the dice"
  // three separate times from the same seed.
  // This gives us three hues that are not mathematically related in a simple way.

  // Hue for Base UI (Text & Background)
  const baseUIHue = seed % 360; 
  
  // Hue for Primary Accents (Links, Icons)
  // We use a right-shift to get a "different" number from the seed.
  const accent1Hue = (seed >> 8) % 360;
  
  // Hue for Secondary Accents (Borders, Tags)
  // We shift by a different amount for a third, independent hue.
  const accent2Hue = (seed >> 16) % 360;

  // --- 4. Apply the Theme as CSS Variables ---
  //
  // This is how we "ensure they're complimentary."
  // We force the Lightness (the 'L' in HSL) to fixed, high-contrast values.
  // The hues (H) can be anything, but the Lightness (L) guarantees readability.
  //
  const root = document.documentElement;
  
  // Apply fonts
  root.style.setProperty('--body-font', bodyFont);
  root.style.setProperty('--mono-font', monoFont);

  // Apply Base UI (uses baseUIHue)
  // This creates a "light-color-1" and a "dark-color-1"
  // L=99% (bg) vs L=15% (text) is extremely high contrast.
  root.style.setProperty('--bg-color', `hsl(${baseUIHue}, 80%, 90%)`);
  root.style.setProperty('--text-color', `hsl(${baseUIHue}, 50%, 20%)`);
  root.style.setProperty('--text-muted', `hsl(${baseUIHue}, 25%, 35%)`);
  
  // Apply Primary Accents (uses accent1Hue)
  // This is a "bright-color-2"
  root.style.setProperty('--accent-color', `hsl(${accent1Hue}, 70%, 45%)`);
  
  // Apply Secondary Accents (uses accent2Hue)
  // This is a "light-color-3" and "very-light-color-3"
  root.style.setProperty('--border-color', `hsl(${accent2Hue}, 50%, 35%)`);
  root.style.setProperty('--bg-muted', `hsl(${accent2Hue}, 60%, 80%)`);
})();