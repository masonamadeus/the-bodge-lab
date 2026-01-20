---
download: false
uid: home
title: Home
contentHash: ac18f826
date: '2026-01-20T16:51:15.455Z'
---
# Welcome to The Bodge Lab!

### My name is Mason Amadeus (he/him)! 

This is my folder on the internet. You're free to {%trigger "poke"%} around here and take anything you'd like with you.

{%react "poke"%} Be sure to click anything that seems eminently {%trigger "clickable"%}. I like to tuck things into corners like this. {%endreact%}

{% react "clickable"%} If you want to get in touch, you should listen to the [Bug & Moss Morning Telephone Show](/s/bug-and-moss-morning-telephone) or [The FAIK Files](</s/faikfiles>).

Or, shoot me an email at: Mason@8thLayerMedia.com {%endreact%}

Explore! I hope you find joy and utility amongst my {% trigger "nonsense"%}.

##### NOTE: There's a lot of placeholder content up here right now as I build out the site. Make sure you come back later!

{%react "nonsense" %}### GOAL FOR 2026: BE LESS SCRUTABLE

Maybe, if I do it just right, I can become the kind of artist whom everyone suspects is part of an ARG{%endreact%}

!



___

<h3 id="random-page-container">SCRIPTS NOT RUNNING</h3>


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
        container.innerHTML = `<p><i>${e}</i></p>`;
      }
    }
  });
</script>
