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
    // 1. THIS IS THE BIG FIX for your download button.
    // Instead of just copying ".md" files, we copy the *entire* content directory.
    // Eleventy is smart: it will *still* process your templates (md, njk, html, txt)
    // but will ALSO copy all *other* files (png, zip, blend, etc.)
    eleventyConfig.addPassthroughCopy("content");

    // 2. This copies our new external CSS file
    eleventyConfig.addPassthroughCopy("_includes/css");

    // --- Collections ---

    // 'posts' collection
    eleventyConfig.addCollection("posts", function (collectionApi) {
        return collectionApi.getFilteredByGlob("./content/**/*.md")
            .filter(item => {
                return !item.inputPath.endsWith('index.md') &&
                       !item.inputPath.endsWith('categories.md') &&
                       !item.inputPath.endsWith('.txt'); // 3. Exclude .txt from 'posts'
            });
    });

    // 'tagList' collection
    eleventyConfig.addCollection("tagList", function(collectionApi) {
        const tags = new Set();
        collectionApi.getAll().forEach(item => {
            if (!item.data.tags) return;
            item.data.tags.forEach(tag => tags.add(tag));
        });
        return Array.from(tags);
    });

    // --- Config Return ---
    return {
        dir: {
            input: "content",
            includes: "../_includes",
            output: "_site"
        },
        // 4. THIS IS THE FIX for test.txt.
        // Tell Eleventy to treat .txt files as templates.
        // Now they will be added to `collections.all` and our macro will find them.
        templateFormats: ["md", "njk", "html", "txt"]
    };
};