// .eleventy.js

// Node.js modules for file system and path handling
const { DateTime } = require("luxon");
const path = require('path');
const { MEDIA_EXTENSIONS, TEMPLATE_EXTENSIONS, PASSTHROUGH_EXTENSIONS } = require('./_11ty/fileTypes.js');
const { generateFileTreeData } = require('./_11ty/filetree.js');
const gitCommitDate = require("eleventy-plugin-git-commit-date");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

// extensions
const markdownIt = require("markdown-it");
const mdLinkAttributes = require("markdown-it-link-attributes");
const { Fountain } = require("fountain-js");

/**
 * A custom rule for markdown-it's renderer to add target="_blank" and rel="..." 
 * ONLY to links that start with http:// or https://.
 */
function markdownLinkExternal(md) {
  // Save the original link_open rule
  const defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  // Replace the link_open rule with our custom function
  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    // Find the index of the 'href' attribute
    const hrefIndex = token.attrIndex('href');

    if (hrefIndex >= 0) {
      const href = token.attrs[hrefIndex][1];

      if (href.includes(' ') && !href.startsWith('http') && !href.startsWith('mailto:')) {
        // URL-encode the spaces
        href = href.replace(/ /g, '%20');
        // Update the href attribute
        token.attrs[hrefIndex][1] = href;
      }

      // Check if the link starts with http:// or https:// (is external)
      if (href.startsWith('http://') || href.startsWith('https://')) {

        // Add target="_blank"
        token.attrPush(['target', '_blank']);

        // Add rel="noopener noreferrer" for security
        token.attrPush(['rel', 'noopener noreferrer']);
      }
      // If the link is internal (e.g., starts with /, #, or a relative path), we do nothing,
      // which keeps it opening in the same window/tab.
    }

    // Call the original renderer function to maintain other behaviors
    return defaultRender(tokens, idx, options, env, self);
  };
}

const mdLib = markdownIt({
  html: true, // Allow HTML in markdown
  breaks: true, // Convert newlines to <br>
  linkify: true // Automatically find links and make them clickable
})
  .use(markdownLinkExternal);

function renderFountainTokens(tokens) {
  let html = '';
  tokens.forEach(token => {

    // 1. IGNORE Structural Tokens (which don't have text and are not for display)
    if ([
      'dialogue_begin',
      'dialogue_end',
      'dual_dialogue_begin', // Added this one for robustness
      'dual_dialogue_end',
      'section',
      'synopsis',
      'title_page',
      'credit'
    ].includes(token.type)) {
      return; // Skip these tokens entirely
    }

    // 2. Handle specific structural tokens that should be visual
    if (token.type === 'page_break') {
      html += '<hr class="page-break">\n';
      return;
    }

    // 3. Use textContent: ensure null/undefined text becomes an empty string
    const textContent = token.text || '';

    switch (token.type) {
      case 'scene_heading':
        html += `<h2 class="scene-heading">${textContent}</h2>\n`;
        break;
      case 'character':
        html += `<p class="character">${textContent}</p>\n`;
        break;
      case 'parenthetical':
        html += `<p class="parenthetical">${textContent}</p>\n`;
        break;
      case 'dialogue':
        html += `<div class="dialogue">${textContent}</div>\n`;
        break;
      case 'transition':
        html += `<p class="transition">${textContent}</h2>\n`; // Changed to p tag
        break;
      case 'action':
      case 'general':
      default:
        // This covers all action lines and anything else that falls through.
        // It uses a <p> tag with the action class for layout control.
        html += `<p class="action">${textContent}</p>\n`;
        break;
    }
  });
  return html;
}

let fileTreeCache = null;

// #region ELEVENTY CONFIG
module.exports = function (eleventyConfig) {

  // --- Markdown Configuration ---
  eleventyConfig.setLibrary("md", mdLib);

  // --- Plugins & Extensions ---
  eleventyConfig.addPlugin(gitCommitDate);
  eleventyConfig.addPlugin(syntaxHighlight);

  eleventyConfig.addExtension("fountain", {
    isLiquid: true, // Use Liquid/Nunjucks for front matter and layout support
    compile: async () => { 
      return async (data) => {
        const rawScriptText = data.page.rawInput;
        
        // 1. Parse the script, requesting the tokens with `true`
        const fountain = new Fountain();
        const output = fountain.parse(rawScriptText, true); 
        
        // 2. Render the tokens to custom HTML
        const scriptHTML = renderFountainTokens(output.tokens);

        // 3. Return the Title Page + Custom Rendered Script, wrapped in the container
        return output.html.title_page + 
               `<div class="fountain-script-container notilt">${scriptHTML}</div>`;
      };
    }
  });

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

  // #region FILTERS
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

  // #endregion

  // #region EMBED SHORTCODES

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

  //#endregion

  // #region LAYOUT SHORTCODES
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

  // Text alignment shortcode. {%align "center"} {% endalign %}
  eleventyConfig.addPairedShortcode("align", function (content, alignment = 'left') {
    const validAlignments = ['left', 'right', 'center', 'justify'];

    // Use 'left' as a safe default if an invalid value is passed
    const safeAlignment = validAlignments.includes(alignment) ? alignment : 'left';

    // The 'content' variable contains the already-rendered HTML
    // (e.g., from Markdown) from inside the shortcode block.
    // We trim to avoid outputting empty divs if there's only whitespace.
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return '';
    }

    return `<div class="text-${safeAlignment}">\n${trimmedContent}\n</div>`;
  });


  //#endregion

  // #region PASSTHROUGHS

  // Entire content folder passthrough so that we can easily download any file
  //eleventyConfig.addPassthroughCopy("content");

  // CSS file
  eleventyConfig.addPassthroughCopy({ "_includes/css": "css" });

  // Theme JS Script
  eleventyConfig.addPassthroughCopy({ "_includes/js": "js" });

  //#endregion

  // #region COLLECTIONS

  // Creates a list of all tags
  eleventyConfig.addCollection("tagList", function (collectionApi) {
    let tagSet = new Set();
    collectionApi.getAll().forEach(item => {
      (item.data.tags || []).forEach(tag => tagSet.add(tag));
    });
    return [...tagSet].sort();
  });

  // Collection of "permanent" pages (with page_id in front matter)
  eleventyConfig.addCollection("permanent_pages", function (collectionApi) {
    return collectionApi.getAll().filter(function (item) {
      // Return pages that have 'page_id' in their data
      return "uid" in item.data;
    });
  });
  // We need to remove the leading dot from each item.
  const cleanTemplateFormats = TEMPLATE_EXTENSIONS.map(ext => ext.substring(1));
  const cleanPassthroughFormats = PASSTHROUGH_EXTENSIONS.map(ext => ext.substring(1));

  return {
    dir: {
      input: "content",
      includes: "../_includes",
      data: "../_data",
      output: "_site"
    },

    // 2. Feed Eleventy the "clean" lists.
    templateFormats: [
      ...cleanTemplateFormats,
      ...cleanPassthroughFormats
    ]
  };

};

//#endregion