// .eleventy.js

// Node.js modules for file system and path handling
const { DateTime } = require("luxon");
const path = require('path');
const { MEDIA_EXTENSIONS } = require('./_11ty/fileTypes.js');
const { generateFileTreeData } = require('./_11ty/filetree.js');
const gitCommitDate = require("eleventy-plugin-git-commit-date");

let fileTreeCache = null;

// --- Main Eleventy Config ---
module.exports = function (eleventyConfig) {

  // --- Plugins ---
  eleventyConfig.addPlugin(gitCommitDate);

  // --- Global Data: Filetree ---
  eleventyConfig.addGlobalData("filetree", async () => {
    if (fileTreeCache) {
      // Return cached data on subsequent builds (e.g., in watch mode)
      return fileTreeCache;
    }


    const contentDir = path.join(__dirname, 'content');
    fileTreeCache = generateFileTreeData(contentDir);
    return fileTreeCache;
  });

  // --- Filters ---
  eleventyConfig.addFilter("readableDate", dateObj => {
    return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat("LLLL dd, yyyy");
  });
  eleventyConfig.addFilter("split", (str, separator) => str.split(separator));
  eleventyConfig.addFilter("slice", (arr, start, end) => Array.isArray(arr) ? arr.slice(start, end) : []);
  eleventyConfig.addFilter("getPreviousCollectionItem", (collection, page) => {
    if (!collection || !collection.length) return null;
    const currentIndex = collection.findIndex(item => item.url === page.url);
    if (currentIndex === -1 || currentIndex === 0) return null;
    return collection[currentIndex - 1];
  });
  eleventyConfig.addFilter("getNextCollectionItem", (collection, page) => {
    if (!collection || !collection.length) return null;
    const currentIndex = collection.findIndex(item => item.url === page.url);
    if (currentIndex === -1 || currentIndex === collection.length - 1) return null;
    return collection[currentIndex + 1];
  });
  eleventyConfig.addFilter("length", arr => arr ? arr.length : 0);
  eleventyConfig.addFilter("size", arr => arr ? arr.length : 0);
  eleventyConfig.addFilter("sortBy", (array, key) => array.sort((a, b) => (a[key] > b[key] ? 1 : -1)));
  eleventyConfig.addFilter("dirname", p => path.dirname(p));
  eleventyConfig.addFilter("basename", p => path.basename(p));

  // --- Shortcodes ---

  //  Video Shortcode
  // Usage: {% video "/path/to/my/video.mp4" %}
  eleventyConfig.addShortcode("video", function (src) {
    return `<video controls style="width: 100%;">
  <source src="${src}">
  Your browser does not support the video tag.
</video>`;
  });

  // Audio Shortcode
  // Usage: {% audio "/path/to/my/audio.mp3" %}
  eleventyConfig.addShortcode("audio", function (src) {
    return `<audio controls style="width: 100%;">
  <source src="${src}">
  Your browser does not support the audio tag.
</audio>`;
  });

  // Image Shortcode (with Download Overlay)
  // Usage: {% image "/path/to/img.jpg", "Alt text for the image" %}
  eleventyConfig.addShortcode("image", function (src, alt = "") {
    return `<div class="image-container">
  <img src="${src}" alt="${alt}">
  <a href="${src}" class="download-overlay" download>
    📥
  </a>
</div>`;
  });

  // Embed Shortcode (for PDF, TXT, etc.)
  // Usage: {% embed "/path/to/document.pdf" %}
  eleventyConfig.addShortcode("embed", function (src) {
    return `<p>
  <iframe class="embed-container" src="${src}">
    <p>Your browser does not support embedded frames. <a href="${src}">Download the file</a> to view it.</p>
  </iframe>
</p>`;
  });

  // 3D Model Shortcode
    // Usage: {% model "/path/to/my-model.glb" %}
    eleventyConfig.addShortcode("3d", function (src) {
      return `<model-viewer 
  src="${src}" 
  camera-controls 
  auto-rotate 
  style="width: 100%; height: 400px; background-color: var(--bg-muted);">
</model-viewer>`;
    });

  // YouTube Shortcode
  // Usage: {% yt "VIDEO_ID" %} or {% yt "https://www.youtube.com/watch?v=..." %}
  eleventyConfig.addShortcode("yt", function (videoUrl) {
    // Helper function to extract the ID
    function getYouTubeID(url) {
      let ID = '';
      url = url.replace(/(>|<)/gi, '').split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/);
      if (url[2] !== undefined) {
        ID = url[2].split(/[^0-9a-z_\-]/i);
        ID = ID[0];
      } else {
        ID = url;
      }
      return ID;
    }

    const videoID = getYouTubeID(videoUrl);

    // We wrap it in a div for responsive styling
    return `<div class="video-embed-container">
  <iframe
    src="https://www.youtube.com/embed/${videoID}"
    title="YouTube video player"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
    loading="lazy">
  </iframe>
</div>`;
  });

  // 6. NEW: Layout Row (Flex Container)
  // Usage: {% row %} ... {% endrow %}
  eleventyConfig.addPairedShortcode("row", function (content) {
    // This creates the flexbox container
    return `<div class="layout-row">${content}</div>`;
  });

  // 7. NEW: Layout Column (Flex Item)
  // Usage: {% col %} or {% col "half" %}
  eleventyConfig.addPairedShortcode("col", function (content, width) {
    let className = 'layout-col';
    if (width) {
      // Creates classes like "layout-col-half", "layout-col-one-third"
      className += ` layout-col-${width}`;
    }
    return `<div class="${className}">${content}</div>`;
  });

  // 8. NEW: "Grid" Shortcode (The *easy* way)
  //    Usage: {% grid "half, half" %} ...content... ...content... {% endgrid %}
  eleventyConfig.addPairedShortcode("grid", function (content, widths) {

    // 1. Split the content at our '' separator
    const columns = content.split("``");

    // 2. Split the widths string into an array
    //    "half, half" -> ["half", "half"]
    const widthArray = (widths || "half, half").split(',').map(s => s.trim());

    // 3. Build the HTML for each column
    const columnHtml = columns.map((colContent, i) => {
      // Get the width for this column, or use the last one if undefined
      const width = widthArray[i] || widthArray[widthArray.length - 1] || '';

      let className = 'layout-col';
      if (width) {
        className += ` layout-col-${width}`;
      }

      // Return the column, wrapping the user's content
      return `<div class="${className}">${colContent}</div>`;
    }).join('');

    // 4. Wrap all columns in the "layout-row" container
    return `<div class="layout-row">${columnHtml}</div>`;
  });

  // --- Passthrough Copy ---

  // Entire content folder. NECESSARY
  eleventyConfig.addPassthroughCopy("content");

  // CSS file
  eleventyConfig.addPassthroughCopy({ "_includes/css": "css" });

  // Theme JS Script
  eleventyConfig.addPassthroughCopy({ "_includes/js": "js" });

  // --- Collections ---

  // Creates a list of all tags
  eleventyConfig.addCollection("tagList", function (collectionApi) {
    let tagSet = new Set();
    collectionApi.getAll().forEach(item => {
      (item.data.tags || []).forEach(tag => tagSet.add(tag));
    });
    return [...tagSet].sort();
  });

  // --- Config Return ---
  return {
    dir: {
      input: "content",
      includes: "../_includes",
      data: "../_data",
      output: "_site"
    },
    // Still process md and njk files so that our
    // index.md pages are turned into directory listings.
    templateFormats: ["md", "njk", "html"]
  };


};