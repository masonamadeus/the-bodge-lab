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
});