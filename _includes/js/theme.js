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
  
  // A list of safe, minimalist font stacks
  const fontPalettes = [
    'system-ui, -apple-system, sans-serif',
    '"Merriweather", "Georgia", serif',
    '"Inconsolata", "Menlo", monospace',
    '"Palatino", "Book Antiqua", serif'
  ];
  
  // --- Generate Unique Theme ---
  
  // Create the deterministic seed from the user agent
  const seed = getSeed(navigator.userAgent);
  
  // "Roll the dice" for the hue (0-359)
  const baseHue = seed % 360;
  
  // Pick a font palette from the list
  const bodyFont = fontPalettes[seed % fontPalettes.length];
  
  // Set the mono font (if body is already mono, use it, else default)
  const monoFont = bodyFont.includes('monospace') ? bodyFont : 'monospace';

  // --- 3. Apply the Theme as CSS Variables ---
  
  // We apply these to the <html> tag (document.documentElement)
  // This must run *before* the body renders to prevent a flash of
  // unstyled content.
  const root = document.documentElement;
  
  // Set the font variables
  root.style.setProperty('--body-font', bodyFont);
  root.style.setProperty('--mono-font', monoFont);

  // Set the *entire* color palette based on the single generated hue
  root.style.setProperty('--accent-hue', baseHue);
  root.style.setProperty('--bg-color', `hsl(${baseHue}, 20%, 89%)`);
  root.style.setProperty('--text-color', `hsl(${baseHue}, 50%, 10%)`);
  root.style.setProperty('--text-muted', `hsl(${baseHue}, 10%, 30%)`);
  root.style.setProperty('--border-color', `hsl(${baseHue}, 20%, 90%)`);
  root.style.setProperty('--bg-muted', `hsl(${baseHue}, 20%, 95%)`);
  root.style.setProperty('--accent-color', `hsl(${baseHue}, 70%, 35%)`);
})();