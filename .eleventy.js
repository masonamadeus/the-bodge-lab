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

// Helper to read simple frontmatter from the .standalone flag
// Helper to read simple frontmatter from the .standalone flag
function parseStandaloneFlag(filePath) {
  const meta = { uid: null, title: path.basename(path.dirname(filePath)), description: "Standalone App", image: null };
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract values (handles optional quotes and spacing)
    const uidMatch = content.match(/^uid:\s*(.*)$/m);
    if (uidMatch) meta.uid = uidMatch[1].trim().replace(/^['"](.*)['"]$/, '$1');
    
    const titleMatch = content.match(/^title:\s*(.*)$/m);
    if (titleMatch) meta.title = titleMatch[1].trim().replace(/^['"](.*)['"]$/, '$1');

    const descMatch = content.match(/^description:\s*(.*)$/m);
    if (descMatch) meta.description = descMatch[1].trim().replace(/^['"](.*)['"]$/, '$1');

    // NEW: Extract Image
    const imgMatch = content.match(/^image:\s*(.*)$/m);
    if (imgMatch) meta.image = imgMatch[1].trim().replace(/^['"](.*)['"]$/, '$1');

  } catch (e) {}
  return meta;
}

// Helper to find folders containing a ".standalone" file
// Helper to find folders containing a ".standalone" file
function findStandaloneApps(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const flagPath = path.join(fullPath, ".standalone");
      
      if (fs.existsSync(flagPath)) {
        // Convert to Relative Path (e.g., "content/PodCube/PocketPal")
        const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
        const destPath = relativePath.replace(/^content\//, '');
        let webUrl = `/${destPath}/`.replace(/\/\//g, '/');

        // Parse the .standalone file for metadata!
        const meta = parseStandaloneFlag(flagPath);

        results.push({
          sourcePath: relativePath,
          destPath: destPath,
          url: webUrl,
          meta: meta
        }); 
        
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

  //Decode URI Components
  let cleanSrc = decodeURI(src);

  // Resolve Relative Paths (Logic borrowed from Shortcode)
  //    If it's not a URL or root path, resolve it relative to the current file.
  if (!src.startsWith('http') && !src.startsWith('/') && env.page && env.page.inputPath) {
    try {
      const pagePath = path.dirname(env.page.inputPath);
      const resolvedPath = path.resolve(pagePath, cleanSrc);
      const webPath = path.relative(contentDir, resolvedPath);
      src = '/' + webPath.replace(/\\/g, '/');
      src = encodeURI(src);
    } catch(e) {
      console.warn("Failed to resolve markdown image path:", src);
    }
  }

  const filename = path.basename(cleanSrc)
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

  /**
   * Smartly renders markdown.
   * - If the result is a single paragraph, it strips the <p> tags (Inline Mode).
   * - Otherwise, it returns the full rendered HTML (Block Mode).
   * * @param {string} content - Raw markdown content
   * @returns {Object} { html: string, isInline: boolean }
   */
  function renderSmart(content) {
    const rendered = mdLib.render(content, {page: this.page}).trim();
    
    // Regex to detect a single <p> wrapper (ignoring attributes)
    const pattern = /^<p(?:\s[^>]*)?>(.*?)<\/p>$/s;
    const match = rendered.match(pattern);
    const pCount = (rendered.match(/<p(?:\s[^>]*)?>/g) || []).length;

    if (match && pCount === 1) {
      // INLINE MODE: Return the content inside the <p>
      return { html: match[1], isInline: true };
    } else {
      // BLOCK MODE: Return everything
      return { html: rendered, isInline: false };
    }
  }

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
  
  standaloneApps.forEach(app => {
    // Copy with Mapping
    eleventyConfig.addPassthroughCopy({ [app.sourcePath]: app.destPath });
    
    // Ignore files inside so Eleventy doesn't process them
    eleventyConfig.ignores.add(app.sourcePath + "/**");
    
    console.log(`[BodgeLab] 🕹️  Linked Standalone App: ${app.sourcePath} -> ${app.destPath}`);
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

  // Embed Shortcode (Smart: Inlines Text/Code, Iframes Apps/HTML)
  eleventyConfig.addShortcode("embed", function (src, ratioOrClass) {
    
    // 1. Resolve Paths (Web URL vs File System Path)
    let webUrl = resolveSrc.call(this, src);
    let fileSystemPath;

    if (src.startsWith('/') || src.startsWith('http')) {
      // Absolute path relative to content dir
      // We strip the leading slash to join it with current directory
      const cleanSrc = src.startsWith('/') ? src.substring(1) : src;
      fileSystemPath = path.join(contentDir, cleanSrc);
    } else {
      // Relative path: Resolve against the current page's folder
      const pageDir = path.dirname(this.page.inputPath);
      fileSystemPath = path.resolve(pageDir, src);
    }

    const filename = path.basename(fileSystemPath);
    const ext = path.extname(filename).toLowerCase();

    // 2. Define "Inline-able" Text Formats
    const textExtensions = [
      '.txt', '.md', '.json', '.js', '.css', '.html', 
      '.bat', '.sh', '.xml', '.yml', '.ini', '.cfg', '.csv', 
      '.lua', '.py', '.java', '.c', '.cpp', '.h', '.rb', '.php', '.rs', '.go', '.swift',
      '.cmd', '.ps1', '.log', '.eel'
    ];
    
    // Exception: We usually want to IFRAME .html "apps", but INLINE .html "snippets".
    const isText = textExtensions.includes(ext) && ext !== '.html'; 

    // 3. Handle Custom Classes/Ratio
    let customStyle = "";
    let customClass = "";
    if (ratioOrClass) {
      if (/^\d+(\.\d+)?\/\d+(\.\d+)?$/.test(ratioOrClass)) {
        customStyle = `aspect-ratio: ${ratioOrClass}; height: auto;`;
      } else {
        customClass = ratioOrClass;
      }
    }

    // --- BRANCH A: INLINE TEXT (Respects Theme) ---
    if (isText && fs.existsSync(fileSystemPath)) {
        try {
            // Read file content
            const fileContent = fs.readFileSync(fileSystemPath, 'utf8');
            
            // Escape HTML (Crucial for displaying code like <stdio.h>)
            const escapedContent = fileContent
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");

            // Render as a native code block
            // Your main.js will automatically attach the "COPY" button to this <pre>!
            return `<div class="media-embed-wrapper ${customClass}">
                      <pre class="language-${ext.substring(1)}"><code class="language-${ext.substring(1)}">${escapedContent}</code></pre>
                      <p class="download-btn-container">
                        <a href="${webUrl}" class="page-download-btn" download>DOWNLOAD "${filename}" ⤓</a>
                      </p>
                    </div>`;
        } catch (e) {
            console.warn(`[BodgeLab] Failed to inline embed: ${src}`, e);
            // Fallthrough to iframe if read fails
        }
    }

    // --- BRANCH B: IFRAME (Apps, PDFs, HTML) ---
    if (!customStyle && !customClass) {
        // Default style for iframes (light/dark bg handled by browser or internal css)
        customStyle = `background-color:var(--bg-muted);`; 
    }

    return `<div class="media-embed-wrapper">
      <iframe class="embed-container ${customClass}" style="${customStyle}" src="${webUrl}" onload="if(window.BodgeLab && window.BodgeLab.resizeIframe) window.BodgeLab.resizeIframe(this)">
        <p>Your browser does not support embedded frames. <a href="${webUrl}">Download the file</a> to view it.</p>
      </iframe>
      <p class="download-btn-container">
        <a href="${webUrl}" class="page-download-btn" download>DOWNLOAD "${filename}" ⤓</a>
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
  eleventyConfig.addPairedShortcode("row", function (content) {
    // Render markdown content before wrapping
    return `<div class="layout-row">${mdLib.render(content, {page: this.page })}</div>`;
  });

  // Layout Column (Flex Item)
  eleventyConfig.addPairedShortcode("col", function (content, width) {
    let className = 'layout-col';
    if (width) {
      className += ` layout-col-${width}`;
    }
    // Render markdown content before wrapping
    return `<div class="${className}">${mdLib.render(content, {page: this.page})}</div>`;
  });

  // "Grid" Shortcode (The *easy* way)
  //    Usage: {% grid "half, half" %} ...content... ...content... {% endgrid %}
  eleventyConfig.addPairedShortcode("grid", function (content, widths) {

    // Split the content at our '' separator
    const columns = content.split("``");

    // Split the widths string into an array
    const widthArray = (widths || "half, half").split(',').map(s => s.trim());

    // Build the HTML for each column
    const columnHtml = columns.map((colContent, i) => {
      // Get the width for this column, or use the last one if undefined
      const width = widthArray[i] || widthArray[widthArray.length - 1] || '';

      let className = 'layout-col';
      if (width) {
        className += ` layout-col-${width}`;
      }

      
      const renderedItem = mdLib.render(colContent, {page: this.page});
      
      return `<div class="${className}">${renderedItem}</div>`;
    }).join('');

    // Wrap all columns in the "layout-row" container
    return `<div class="layout-row">${columnHtml}</div>`;
  });

 // Text alignment shortcode. {%align "center"} {% endalign %}
  eleventyConfig.addPairedShortcode("align", function (content, alignment = 'left') {
    const validAlignments = ['left', 'right', 'center', 'justify'];

    // Use 'left' as a safe default if an invalid value is passed
    const safeAlignment = validAlignments.includes(alignment) ? alignment : 'left';

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return '';
    }

    // Render the content so markdown works inside the div
    return `<div class="text-${safeAlignment}">\n${mdLib.render(trimmedContent, {page: this.page})}\n</div>`;
  });

  // Mono: Simple helper to use mono font on a whim
 eleventyConfig.addPairedShortcode("mono", function(content) {
    const { html, isInline } = renderSmart(content);
    
    if (isInline) {
      return `<span class="font-mono">${html}</span>`;
    } else {
      return `<div class="font-mono">${html}</div>`;
    }
  });

  // Hide/Reveal Shortcode (Accordion)
  // Usage: {% toggle "Read More..." %} ...content... {% endtoggle %}
  eleventyConfig.addPairedShortcode("toggle", function(content, summary="Read More...") {
    // 1. Render the Markdown inside the block
    const renderedContent = mdLib.render(content, {page: this.page});
    
    // 2. Return the <details> wrapper
    return `<details class="bodge-accordion"><summary>${summary}</summary><div class="bodge-accordion-content">${renderedContent}</div></details>`;
  });

  eleventyConfig.addPairedShortcode("note", function(content, color="bg-muted"){

    const rendered = mdLib.render(content, {page: this.page}).trim();
    const style = `background-color:var(--${color})`;
    
    // 2. Detect: Is this just simple text (one paragraph)?
    // Logic: Starts with <p>, ends with </p>, and contains no other <p> tags.
    const isSinglePara = rendered.startsWith('<p>') && 
                         rendered.endsWith('</p>') && 
                         (rendered.indexOf('<p>', 3) === -1);

    if (isSinglePara) {
      // INLINE MODE: Strip the outer <p> tags and use a <span>
      // This allows it to sit inside other text without breaking the line.
      const inlineContent = rendered.substring(3, rendered.length - 4);
      return `<span style=${style} class="font-mono note">${inlineContent}</span>`;
    } else {
      // BLOCK MODE: Keep the structure and use a <div>
      // This allows headings, lists, and multiple paragraphs.
      return `<div style=${style} class="font-mono note">${rendered}</div>`;
    }

  });

  // --- CLICKABLE EASTER-EGG SYSTEM ---

  function slugify(text) {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')     // Replace spaces with -
      .replace(/[^\w\-]+/g, '') // Remove all non-word chars
      .replace(/\-\-+/g, '-')   // Replace multiple - with single -
      .replace(/^-+/, '')       // Trim - from start of text
      .replace(/-+$/, '');      // Trim - from end of text
  }

  // 1. The Trigger
  // Usage: I walked down the {% trigger "stinky, wet road" %}...
  eleventyConfig.addShortcode("trigger", function(text) {
    // 1. Generate ID from the RAW text
    const id = slugify(text);
    
    // 2. FORCE Inline Rendering.
    // mdLib.renderInline() parses markdown but prevents <p> tags.
    // This ensures the button stays an inline element.
    const html = mdLib.renderInline(text, {page: this.page});

    // 3. Generate random animation delay
    const randomDelay = (Math.random() * -10).toFixed(2);

    return `<button class="bodge-trigger notilt" 
                    style="animation-delay: ${randomDelay}s;" 
                    data-trigger-id="${id}" 
                    title="Reveal Note">${html}</button>`;
  });

  // 2. The Reaction
  // Usage: {% react "stinky, wet road" %} ...content... {% endreact %}
  eleventyConfig.addPairedShortcode("react", function(content, idOrText) {
    const id = slugify(idOrText);
    const { html, isInline } = renderSmart(content);

    if (isInline) {
      return `<span class="bodge-reaction notilt" data-react-id="${id}" hidden>${html}</span>`;
    } else {
      return `<div class="bodge-reaction" data-react-id="${id}" hidden>${html}</div>`;
    }
  });
 
  // Book Style Wrapper
  // Usage: {% book %} ... paragraphs ... {% endbook %}
  eleventyConfig.addPairedShortcode("book", function(content) {
    // Render the markdown inside, then wrap it
    const rendered = mdLib.render(content, {page: this.page});
    return `<div class="book-style">${rendered}</div>`;
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
    // Get standard pages
    const standardPages = collectionApi.getAll().filter(function (item) {
      return item.data.uid; 
    });

    // Inject Standalone Apps that have a UID
    // This allows share.njk to dynamically generate shortlink pages for them
    const standaloneNodes = standaloneApps
      .filter(app => app.meta.uid)
      .map(app => {
        // Build the Absolute Image URL
        let resolvedImage = null;
        if (app.meta.image) {
           if (app.meta.image.startsWith('http')) {
               resolvedImage = app.meta.image;
           } else {
               // Append the image filename to the absolute URL of the app
               // Note: When I make this a universal site template, this needs to be dynamic based on the site's domain, not hardcoded.
               const SITE_URL = "https://bodgelab.com"; 
               resolvedImage = `${SITE_URL}${app.url}${app.meta.image}`;
           }
        }

        return {
          url: app.url,
          data: {
            uid: app.meta.uid,
            title: app.meta.title,
            seo: {
              title: app.meta.title,
              description: app.meta.description,
              url: `https://bodgelab.com${app.url}`, // Full URL required for OG
              type: "website",
              image: resolvedImage 
            }
          }
        };
      });

    return standardPages.concat(standaloneNodes);
  });

  // --- BODGE OG INJECTOR ---
  // Runs after Eleventy finishes building the site.
  // Finds standalone apps in the output folder and injects OG tags into their index.html!
  eleventyConfig.on('eleventy.after', async ({ dir }) => {
    
    standaloneApps.forEach(app => {
      // We only care about apps that have a UID and an index.html
      if (!app.meta.uid) return;

      const indexPath = path.join(dir.output, app.destPath, 'index.html');

      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf8');

        // Using a meta tag as our safety check
        if (!html.includes('<meta name="bodge-og-injected" content="true">')) {

          // 1. Resolve Image URL
          let resolvedImage = "";
          if (app.meta.image) {
             if (app.meta.image.startsWith('http')) {
                 resolvedImage = app.meta.image;
             } else {
                 resolvedImage = `https://bodgelab.com${app.url}${app.meta.image}`;
             }
          }

          // 2. Build the exact Meta Tags we want (WITH CONDITIONALS)
          let ogTags = `\n    <meta name="bodge-og-injected" content="true">\n`;
          ogTags += `    <meta property="og:type" content="website">\n`;
          ogTags += `    <meta property="og:url" content="https://bodgelab.com${app.url}">\n`;
          ogTags += `    <meta property="og:title" content="${app.meta.title}">\n`;
          
          if (app.meta.description) {
              ogTags += `    <meta property="og:description" content="${app.meta.description}">\n`;
          }
          
          if (resolvedImage) {
              ogTags += `    <meta property="og:image" content="${resolvedImage}">\n`;
              ogTags += `    <meta name="twitter:image" content="${resolvedImage}">\n`;
          }
          
          ogTags += `    <meta name="twitter:card" content="summary_large_image">\n`;
          ogTags += `</head>`;

          // 3. Inject them right before the closing </head> tag
          html = html.replace(/<\/head>/i, ogTags);
          
          // 4. Save the file back to the _site directory
          fs.writeFileSync(indexPath, html);
          console.log(`[BodgeLab] 💉 Injected OG tags into: ${app.destPath}/index.html`);
        }
      }
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