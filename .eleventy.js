// Node.js modules for file system and path handling
const { DateTime } = require("luxon");
const path = require('path');
const { MEDIA_EXTENSIONS } = require('./_includes/config/fileTypes.js');

// --- Main Eleventy Config ---
module.exports = function (eleventyConfig) {

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

    // 1. Video Shortcode
    // Usage: {% video "/path/to/my/video.mp4" %}
    eleventyConfig.addShortcode("video", function (src) {
        return `<video controls style="width: 100%;">
  <source src="${src}">
  Your browser does not support the video tag.
</video>`;
    });

    // 2. Audio Shortcode
    // Usage: {% audio "/path/to/my/audio.mp3" %}
    eleventyConfig.addShortcode("audio", function (src) {
        return `<audio controls style="width: 100%;">
  <source src="${src}">
  Your browser does not support the audio tag.
</audio>`;
    });

    // 3. Image Shortcode (with Download Overlay)
    // This replicates your custom CSS container
    // Usage: {% image "/path/to/img.jpg", "Alt text for the image" %}
    eleventyConfig.addShortcode("image", function (src, alt = "") {
        return `<div class="image-container">
  <img src="${src}" alt="${alt}">
  <a href="${src}" class="download-overlay" download>
    📥
  </a>
</div>`;
    });

    // 4. Embed Shortcode (for PDF, TXT, etc.)
    // This uses your iframe container style
    // Usage: {% embed "/path/to/document.pdf" %}
    eleventyConfig.addShortcode("embed", function (src) {
        return `<p>
  <iframe class="embed-container" src="${src}">
    <p>Your browser does not support embedded frames. <a href="${src}">Download the file</a> to view it.</p>
  </iframe>
</p>`;
    });

    // --- Passthrough Copy ---

    eleventyConfig.addPassthroughCopy("content");

    // This copies our CSS file
    eleventyConfig.addPassthroughCopy({ "_includes/css": "css" });

    // --- Collections ---
    // We removed the old 'posts' and 'tagList' collections.

    // --- Config Return ---
    return {
        dir: {
            input: "content",
            includes: "../_includes",
            data: "../_data",
            output: "_site"
        },
        // We *still* process md and njk files so that our
        // index.md pages are turned into directory listings.
        templateFormats: ["md", "njk", "html"]
    };


};