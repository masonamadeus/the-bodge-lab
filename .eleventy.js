// MODULES AND PLUGINS
const { DateTime } = require("luxon");
const path = require('path');
const { TEMPLATE_EXTENSIONS, PASSTHROUGH_EXTENSIONS } = require('./_11ty/fileTypes.js');
const { generateFileTreeData } = require('./_11ty/filetree.js');
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const fs = require('fs');
const markdownIt = require("markdown-it");
const { Fountain } = require("fountain-js");

// CONSTANTS
const contentDir = path.join(__dirname, 'content');
const cleanTemplateFormats = TEMPLATE_EXTENSIONS.map(ext => ext.substring(1)); // Removing the . from the filetype (eleventy quirk)
const cleanPassthroughFormats = PASSTHROUGH_EXTENSIONS.map(ext => ext.substring(1));

//#region UTILITIES

// --- STANDALONE APP SCANNER ---
// Helper to find folders containing a ".standalone" file
function findStandaloneApps(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (fs.existsSync(path.join(fullPath, ".standalone"))) {
        
        // FIX: Convert to Relative Path (e.g., "content/PodCube/PocketPal")
        const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
        results.push(relativePath); 
        
      } else {
        results = results.concat(findStandaloneApps(fullPath));
      }
    }
  });
  return results;
}

/**
 * MARKDOWN IMAGE RENDERER
 * This forces standard markdown images ![alt](src) to look exactly like
 * {% image %} shortcodes (Wrappers, Download Link, Styling).
 */
function bodgeMarkdownImage(tokens, idx, options, env, self) {
  const token = tokens[idx];
  const srcIndex = token.attrIndex('src');
  let src = token.attrs[srcIndex][1];
  const alt = token.content || ""; // Use the alt text as caption/alt

  // Resolve Relative Paths (Logic borrowed from Shortcode)
  //    If it's not a URL or root path, resolve it relative to the current file.
  if (!src.startsWith('http') && !src.startsWith('/') && env.page && env.page.inputPath) {
    try {
      const pagePath = path.dirname(env.page.inputPath);
      const resolvedPath = path.resolve(pagePath, src);
      const webPath = path.relative(contentDir, resolvedPath);
      src = '/' + webPath.replace(/\\/g, '/');
    } catch(e) {
      console.warn("Failed to resolve markdown image path:", src);
    }
  }

  const filename = decodeURI(path.basename(src));
  // Return the "Bodge Card" HTML
  // Use a <span> wrapper with display:block to be (mostly) valid inside <p> tags
  return `<span class="media-embed-wrapper" style="display: block;">
    <span class="image-container" style="display: block;">
      <img src="${src}" alt="${alt}">
    </span>
    <span class="download-btn-container" style="display: flex;">
      <a href="${src}" class="page-download-btn" download>DOWNLOAD "${filename}" ⤓</a>
    </span>
  </span>`;
}

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
  mdLib.renderer.rules.image = bodgeMarkdownImage; // Make .md Images look like shortcode ones

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

// #endregion


module.exports = function (eleventyConfig) {

  // #region PASSTHROUGHS


  // Convert ['.jpg', '.png'] -> "jpg,png"
  const passthroughGlob = cleanPassthroughFormats.join(',');
  
  // Create a glob pattern: "content/**/*.{jpg,png,webp,...}"
  const passthroughPath = `content/**/*.{${passthroughGlob}}`;
  
  // Tell Eleventy to copy them!
  eleventyConfig.addPassthroughCopy(passthroughPath);

  // CSS file
  eleventyConfig.addPassthroughCopy({ "_includes/css": "css" });

  // Theme JS Script
  eleventyConfig.addPassthroughCopy({ "_includes/js": "js" });

  // MiniSearch Library (This rename feels like it might bite me later.)
  eleventyConfig.addPassthroughCopy({
    "node_modules/minisearch/dist/umd/index.js": "js/lib/minisearch.js"
  });

  // STANDALONE APPS
  // Scans content for folders with a ".standalone" file.
  // Automatically adds them to Passthrough AND Ignores.
  const standaloneApps = findStandaloneApps(contentDir);
  
  standaloneApps.forEach(appPath => {
    // Calculate Destination (Strip "content/" prefix)
    // Source: "content/PodCube/PocketPal" -> Dest: "PodCube/PocketPal"
    const destPath = appPath.replace(/^content\//, '');

    // Copy with Mapping
    // { "source": "destination" }
    eleventyConfig.addPassthroughCopy({ [appPath]: destPath });
    
    // Ignore files inside so Eleventy doesn't process them
    eleventyConfig.ignores.add(appPath + "/**");
    
    console.log(`[BodgeLab] 🕹️  Linked Standalone App: ${appPath} -> ${destPath}`);
  });

  //#endregion
  
  // #region ELEVENTY CONFIG

  // --- GENERATOR TEMPLATES ---
  const generatorsDir = path.join(__dirname, '_generators');
  if (fs.existsSync(generatorsDir)) {
    const templateFiles = fs.readdirSync(generatorsDir);
    templateFiles.forEach(file => {
      if (file.endsWith('.njk')) {
        const content = fs.readFileSync(path.join(generatorsDir, file), 'utf8');
        eleventyConfig.addTemplate(file, content);
      }
    });
  }

  // Make sure we watch the generators for changes during dev
  eleventyConfig.addWatchTarget("./_generators/");

  // --- Markdown Configuration ---

  eleventyConfig.setLibrary("md", mdLib);

  // --- Plugins & Extensions ---

  eleventyConfig.addPlugin(syntaxHighlight);

  eleventyConfig.addExtension("fountain", {
    isLiquid: true, // Use Liquid/Nunjucks for front matter and layout support
    compile: async () => {
      return async (data) => {
        const rawScriptText = data.page.rawInput;

        // Parse the script, requesting the tokens with `true`
        const fountain = new Fountain();
        const output = fountain.parse(rawScriptText, true);

        // Render the tokens to custom HTML
        const scriptHTML = renderFountainTokens(output.tokens);

        // Return the Title Page + Custom Rendered Script, wrapped in the container
        return output.html.title_page +
          `<div class="fountain-script-container notilt">${scriptHTML}</div>`;
      };
    }
  });

  // --- Global Data: Filetree ---
  eleventyConfig.addGlobalData("filetree", async () => {
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
  function resolveSrc(src) {
    if (src.startsWith('http') || src.startsWith('/')) {
      return src.replace(/ /g, '%20'); // It's already an absolute URL or root-relative path + encode spaces
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
    const srcWithHash = resolvedSrc + "#t=0.001";

    return `<div class="media-embed-wrapper">
      <video controls preload="metadata" playsinline style="width: 100%; height: auto;">
        <source src="${srcWithHash}">
        Your browser does not support the video tag.
      </video>
      <p class="download-btn-container">
        <a href="${resolvedSrc}" class="page-download-btn" download>DOWNLOAD "${filename}" ⤓</a>
      </p>
    </div>`;
  });

  // Audio Shortcode (Refactored for Unified Player)
  eleventyConfig.addShortcode("audio", function (src, title) {
    const resolvedSrc = resolveSrc.call(this, src); 
    // Allow manual title, or fallback to filename
    const displayTitle = title || path.basename(resolvedSrc);
    
    // We add 'Single-track' to help CSS hide the playlist
    return `<div class="bodge-rss-player single-track" data-src="${resolvedSrc}" data-title="${displayTitle}">
        <div class="rss-loading">
             <img src="/.config/loading.svg" alt="Loading..." style="width: 50px; height: 50px;">
             <p>Loading Audio...</p>
        </div>
    </div><script src="/js/bodge-player.js" defer></script>`; 
  });

  // AUDIO PLAYLIST FROM ADJACENT FILES
  eleventyConfig.addShortcode("playlist", function (title) {
    const validExtensions = ['.mp3', '.m4a', '.wav', '.ogg', '.aac'];
    
    // Identify the folder where this page lives
    const pageDir = path.dirname(this.page.inputPath);
    
    // Scan that specific folder
    let allFiles = [];
    if (fs.existsSync(pageDir)) {
        const files = fs.readdirSync(pageDir);
        files.forEach(file => {
           if (validExtensions.includes(path.extname(file).toLowerCase())) {
             allFiles.push(file); // Store just the filename
           }
        });
    }

    // Sort Naturally (e.g. "Track 1", "Track 2", "Track 10")
    allFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (allFiles.length === 0) return "";

    // Build JSON Data
    const playlistData = allFiles.map(filename => {
        // We reuse your existing resolveSrc function to generate the correct URL
        // (This ensures consistency with how single audio files are handled)
        const src = resolveSrc.call(this, filename);
        
        return {
            title: filename.replace(path.extname(filename), ""), // Title = Filename without ext
            src: src
        };
    });

    const jsonString = JSON.stringify(playlistData).replace(/"/g, '&quot;');
    const displayTitle = title || "Folder Index";
    
    // If only 1 file is found, mark it single-track to hide the list UI
    const modeClass = playlistData.length === 1 ? 'single-track' : '';

    return `<div class="bodge-rss-player ${modeClass}" data-playlist="${jsonString}" data-title="${displayTitle}"><div class="rss-loading"><img src="/.config/loading.svg" alt="Loading..." style="width: 50px; height: 50px;"><p>Indexing...</p></div></div><script src="/js/bodge-player.js" defer></script>`;
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

  // Embed Shortcode (Smart: Supports "16/9" OR "my-custom-class")
  eleventyConfig.addShortcode("embed", function (src, ratioOrClass) {
    const resolvedSrc = resolveSrc.call(this, src);
    const filename = decodeURIComponent(path.basename(resolvedSrc));
    const ext = path.extname(filename).toLowerCase();
    
    let customStyle = "";
    let customClass = "";
    
    if (ratioOrClass) {
      if (/^\d+(\.\d+)?\/\d+(\.\d+)?$/.test(ratioOrClass)) {
        customStyle = `aspect-ratio: ${ratioOrClass}; height: auto;`;
      } else {
        customClass = ratioOrClass;
      }
    } else {
        customStyle = `background-color:light-dark(#FFFFFF,#000000);`;
    }

    // Detect if this is a text file we can copy
    const copyableExts = ['.txt', '.md', '.json', '.js', '.css', '.html', '.bat', '.sh', '.xml', '.yml', '.ini', '.cfg'];
    let copyButton = "";
    
    if (copyableExts.includes(ext)) {
        // We add a button that JS will hook onto later
        copyButton = `<button class="text-copy-btn" title="Copy text content">COPY TEXT</button>`;
    }

    return `<div class="media-embed-wrapper">
  <p>
    <iframe class="embed-container ${customClass}" style="${customStyle}" src="${resolvedSrc}" onload="if(window.BodgeLab && window.BodgeLab.resizeIframe) window.BodgeLab.resizeIframe(this)">
      <p>Your browser does not support embedded frames. <a href="${resolvedSrc}">Download the file</a> to view it.</p>
    </iframe>
  </p>
  <p class="download-btn-container">
    <a href="${resolvedSrc}" class="page-download-btn" download>DOWNLOAD "${filename}" ⤓</a>
    ${copyButton}
  </p></div>`;
  });

  // 3D Model Shortcode
  // Usage: {% 3d "path/to/model.glb" %}
  eleventyConfig.addShortcode("3d", function (src) {
    const resolvedSrc = resolveSrc.call(this, src); // Resolve the path
    const filename = path.basename(resolvedSrc);
    return `<div class="media-embed-wrapper">
  <model-viewer 
    src="${resolvedSrc}" 
    camera-controls 
    auto-rotate 
    poster="/.config/3dloading.svg" 
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

  // PODCAST WIDGET
  // Usage: {% rss "https://feed.url" %} OR {% rss "https://feed.url", "asc" %}
  eleventyConfig.addShortcode("rss", function(url, sortOrder = "desc") {
    const uid = "rss-" + Math.random().toString(36).substr(2, 9);
    // We verify if the user explicitly asked for 'asc' (Oldest First)
    // Default is 'desc' (Newest First)
    const orderAttr = (sortOrder && sortOrder.toLowerCase() === 'asc') ? 'asc' : 'desc';
    
    return `<div id="${uid}" class="bodge-rss-player" data-rss-url="${url}" data-sort-order="${orderAttr}">
        <div class="rss-loading">
             <img src="/.config/loading.svg" alt="Loading..." style="width: 50px; height: 50px;">
             <p>Tuning in...</p>
        </div>
      </div><script src="/js/bodge-player.js" defer></script>`;
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

    // Split the content at our '' separator
    const columns = content.split("``");

    // Split the widths string into an array
    //    "half, half" -> ["half", "half"]
    const widthArray = (widths || "half, half").split(',').map(s => s.trim());

    // Build the HTML for each column
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

    // Wrap all columns in the "layout-row" container
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

  // Hide/Reveal Shortcode (Accordion)
  // Usage: {% toggle "Read More..." %} ...content... {% endtoggle %}
  eleventyConfig.addPairedShortcode("toggle", function(content, summary="Read More...") {
    // 1. Render the Markdown inside the block
    const renderedContent = mdLib.render(content);
    
    // 2. Return the <details> wrapper
    return `
      <details class="bodge-accordion"><summary>${summary}</summary><div class="bodge-accordion-content">${renderedContent}</div></details>`;
  });

  // Reveal Shortcode (Arbitrary Distance)
  // Usage: {% reveal "Trigger Text", "Hidden Content" %} Text between... {% endreveal %}
  eleventyConfig.addPairedShortcode("reveal", function(content, trigger, hidden) {
    const uid = "reveal-" + Math.random().toString(36).substr(2, 9);
    // 1. The Trigger
    const btnHtml = `<button class="bodge-reveal-btn" data-reveal-id="${uid}" aria-expanded="false" aria-controls="${uid}">${trigger}</button>`;
    
    // 2. The Hidden Content (Starts hidden)
    const hiddenHtml = `<span id="${uid}" class="bodge-reveal-content" hidden>${hidden}</span>`;
    
    // 3. Return: Trigger + The Distance (content) + The Reveal
    return `${btnHtml}${content}${hiddenHtml}`;
  });
 


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
      // Only include items where uid is actually set (not null/undefined)
      return item.data.uid; 
    });
  });
  
  return {
    dir: {
      input: "content",
      includes: "../_includes",
      data: "../_data",
      output: "_site"
    },

    // Feed Eleventy the "clean" lists.
    templateFormats: [
      ...cleanTemplateFormats,
      ...cleanPassthroughFormats
    ]
  };

};

//#endregion