// Node.js modules for file system and path handling
const { DateTime } = require("luxon");
const path = require('path');

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

    // --- Passthrough Copy ---
    // This copies *everything* from "content" to "_site"
    eleventyConfig.addPassthroughCopy("content");
    // This copies our CSS file
    eleventyConfig.addPassthroughCopy("_includes/css");

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