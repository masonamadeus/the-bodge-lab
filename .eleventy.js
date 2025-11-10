// .eleventy.js

// Node.js modules for file system and path handling
const { DateTime } = require("luxon");
const path = require('path');
const { MEDIA_EXTENSIONS } = require('./_11ty/fileTypes.js');
const { generateFileTreeData } = require('./_11ty/filetree.js');
const gitCommitDate = require("eleventy-plugin-git-commit-date");

const markdownIt = require("markdown-it");
const mdLinkAttributes = require("markdown-it-link-attributes");

const mdLib = markdownIt({
    html: true, // Allow HTML in markdown
    breaks: true, // Convert newlines to <br>
    linkify: true // Automatically find links and make them clickable
  })
  .use(mdLinkAttributes, {
    // This adds these attributes to *all* links
    attrs: {
      target: "_blank",
      rel: "noopener noreferrer"
    }
  });

  
let fileTreeCache = null;

// --- Main Eleventy Config ---
module.exports = function (eleventyConfig) {

  // --- Markdown Configuration ---
  eleventyConfig.setLibrary("md", mdLib);

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

 /**
   * Helper function to resolve relative paths.
   * "this" is the Eleventy shortcode context.
   */
  const contentDir = path.join(__dirname, 'content');
  function resolveSrc(src) {
    if (src.startsWith('http') || src.startsWith('/')) {
      return src; // It's already an absolute URL or root-relative path
    }

    // It's a relative path. Resolve it based on the current page's input path.
    const pagePath = path.dirname(this.page.inputPath);
    const resolvedPath = path.resolve(pagePath, src);
    
    // Make it a root-relative web path
    const webPath = path.relative(contentDir, resolvedPath);
    
    // Convert Windows backslashes to web forward slashes
    return '/' + webPath.replace(/\\/g, '/');
  }

  //  Video Shortcode
  eleventyConfig.addShortcode("video", function (src) {
    const resolvedSrc = resolveSrc.call(this, src); // Resolve the path
    const filename = path.basename(resolvedSrc);
    return `<div class="media-embed-wrapper">
  <video controls style="width: 100%;">
    <source src="${resolvedSrc}">
    Your browser does not support the video tag.
  </video>
  <p class="download-btn-container"><a href="${resolvedSrc}" class="page-download-btn" download>DOWNLOAD "${filename}" ⤓</a></p></div>`;
  });

  // Audio Shortcode
  eleventyConfig.addShortcode("audio", function (src) {
    const resolvedSrc = resolveSrc.call(this, src); // Resolve the path
    const filename = path.basename(resolvedSrc);
    return `<div class="media-embed-wrapper">
  <audio controls style="width: 100%;">
    <source src="${resolvedSrc}">
    Your browser does not support the audio tag.
  </audio>
  <p class="download-btn-container"><a href="${resolvedSrc}" class="page-download-btn" download>DOWNLOAD "${filename}" ⤓</a></p></div>`;
  });

  // Image Shortcode
  eleventyConfig.addShortcode("image", function (src, alt = "") {
    const resolvedSrc = resolveSrc.call(this, src); // Resolve the path
    const filename = path.basename(resolvedSrc);
    return `<div class="media-embed-wrapper">
  <div class="image-container">
    <img src="${resolvedSrc}" alt="${alt}">
  </div>
  <p class="download-btn-container"><a href="${resolvedSrc}" class="page-download-btn" download>DOWNLOAD "${filename}" ⤓</a></p></div>`;
  });

  // Embed Shortcode
  eleventyConfig.addShortcode("embed", function (src) {
    const resolvedSrc = resolveSrc.call(this, src); // Resolve the path
    const filename = path.basename(resolvedSrc);
    return `<div class="media-embed-wrapper">
  <p>
    <iframe class="embed-container" style="background-color:light-dark(#FFFFFF,#000000);" src="${resolvedSrc}">
      <p>Your browser does not support embedded frames. <a href="${resolvedSrc}">Download the file</a> to view it.</p>
    </iframe>
  </p>
  <p class="download-btn-container"><a href="${resolvedSrc}" class="page-download-btn" download>DOWNLOAD "${filename}" ⤓</a></p></div>`;
  });

  // 3D Model Shortcode
    eleventyConfig.addShortcode("3d", function (src) {
      const resolvedSrc = resolveSrc.call(this, src); // Resolve the path
      const filename = path.basename(resolvedSrc);
      return `<div class="media-embed-wrapper">
  <model-viewer 
    src="${resolvedSrc}" 
    camera-controls 
    auto-rotate 
    poster="/config/3dloading.svg" 
    style="width: 100%; height: 400px; background-color: var(--bg-muted);">
  </model-viewer>
  <p class="download-btn-container"><a href="${resolvedSrc}" class="page-download-btn" download>DOWNLOAD "${filename}" ⤓</a></p>
</div>`;
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
    const videoLink = `https://www.youtube.com/watch?v=${videoID}`;

    // We wrap it in a div for responsive styling
    return `<div class="media-embed-wrapper">
  <div class="video-embed-container">
    <iframe
      src="https://www.youtube.com/embed/${videoID}"
      title="YouTube video player"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      loading="lazy">
    </iframe>
  </div>
  <p class="download-btn-container"><a href="${videoLink}" class="page-download-btn" target="_blank" rel="noopener noreferrer">VIEW ON YOUTUBE</a></p>
</div>`;
  });


  // Layout Row (Flex Container)
  // Usage: {% row %} ... {% endrow %}
  eleventyConfig.addPairedShortcode("row", function (content) {
    // This creates the flexbox container
    return `<div class="layout-row">${content}</div>`;
  });

  // Layout Column (Flex Item)
  // Usage: {% col %} or {% col "half" %}
  eleventyConfig.addPairedShortcode("col", function (content, width) {
    let className = 'layout-col';
    if (width) {
      // Creates classes like "layout-col-half", "layout-col-one-third"
      className += ` layout-col-${width}`;
    }
    return `<div class="${className}">${content}</div>`;
  });

  // "Grid" Shortcode (The *easy* way)
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

  // Entire content folder passthrough so that we can easily download any file
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
    //templateFormats: ["md", "njk", "html"]
  };


};