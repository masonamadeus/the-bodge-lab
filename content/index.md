---
title: "The Bodge Lab"
download: false
---
# Welcome to The Bodge Lab!

My name is Mason Amadeus (he/him)! 

This is my folder on the internet. You're free to poke around here and take anything you'd like with you.

If you want to get in touch, you should listen to the [Bug & Moss Morning Telephone Show](/s/bug-and-moss-morning-telephone).

Explore! I hope you find joy and utility amongst my nonsense.

___

<h3 id="random-page-container">RANDOM FILE</h3>


<script>
  // 1. Listen for the 'bodgelab:searchready' event.
  // This is dispatched by main.js when all helper functions are loaded.
  document.addEventListener('bodgelab:searchready', async () => {
    const container = document.getElementById('random-page-container');
    
    try {
      // 2. Fetch the search data (or get it from the cache)
      const allPages = await window.BodgeLab.getSearchData();

      // 3. Filter out the homepage itself
      const pagesWithoutHome = allPages.filter(page => page.url !== '/');

      if (pagesWithoutHome.length > 0) {
        // 4. Pick a random page from the list
        const randomIndex = Math.floor(Math.random() * pagesWithoutHome.length);
        const randomPage = pagesWithoutHome[randomIndex];

        // 5. Create the link using the data from search.json
        const link = document.createElement('a');
        link.href = randomPage.url;
        link.textContent = randomPage.title;
        
        const content = document.createElement('p');
        content.appendChild(link);

        // 6. Clear the "loading" text and add the new link
        container.innerHTML = 'FOR YOU: ';
        container.appendChild(link);

      } else {
        container.innerHTML = '<p><i>Could not find a random page.</i></p>';
      }
    } catch (e) {
      console.error('Error loading random page widget:', e);
      if (container) {
        container.innerHTML = '<p><i>Error loading widget.</i></p>';
      }
    }
  });
</script>