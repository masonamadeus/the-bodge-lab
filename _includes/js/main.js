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

    (function() {
    const toggleButton = document.getElementById('theme-toggle');
    if (toggleButton) {
      
      // Helper function to apply a palette (no reload needed!)
      function applyTheme(theme, palette) {
        const root = document.documentElement;
        for (const [key, value] of Object.entries(palette)) {
          root.style.setProperty(key, value);
        }
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
      }
      
      toggleButton.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        
        if (currentTheme === 'light') {
          // Switch to Dark
          toggleButton.innerText = "Light Mode";
          applyTheme('dark', window.__THEME__.dark);
        } else {
          // Switch to Light
          toggleButton.innerText = "Dark Mode";
          applyTheme('light', window.__THEME__.light);
        }
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
  
});