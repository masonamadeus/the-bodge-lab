---
layout: layout.njk
title: "My First Page"
---

This is my very first page!

I can make **bold text** and *italic text*.

### How to Add Hyperlinks

This is a [link to Google](https://www.google.com).

### How to Embed Images

First, upload an image (e.g., `my-image.png`) to a new folder named `assets`.

Then, edit your `.eleventy.js` config file **one time** to tell 11ty to copy that folder:

```javascript
// Inside your .eleventy.js
module.exports = function(eleventyConfig) {
  
  // Add this line to copy the assets folder
  eleventyConfig.addPassthroughCopy("assets");

  // ... the rest of your config ...
};