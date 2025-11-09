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

    // LIGHT / DARK MODE TOGGLE
    (function() {
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
  
});