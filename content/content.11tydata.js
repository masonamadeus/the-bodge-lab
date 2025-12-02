const path = require('path');
const MarkdownIt = require('markdown-it');

const md = new MarkdownIt;

/**
 * Normalizes a web path from data.page.url to be used as a consistent lookup key.
 * - Decodes URL-encoded characters (e.g., /Bug%20&%20Moss/ -> /Bug & Moss/)
 * - Replaces backslashes
 * - Removes trailing slash (unless it's the root)
 */
function normalizeLookupKey(webPath) {
  let key = path.normalize(decodeURIComponent(webPath.replace(/&amp;/g, '&'))).replace(/\\/g, '/');
  if (key.length > 1 && key.endsWith('/')) {
    key = key.slice(0, -1);
  }
  // Handle the root path, which might become an empty string
  return key || '/';
}

/**
 * Creates a URL-friendly "slug" from a string.
 */
function slugify(str) {
  if (!str) return 'page';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace to -
    .replace(/-+/g, '-'); // collapse dashes
}

/**
 * Generates a simple hash from a string (for collision-proofing).
 */
function getSeed(str) {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * correctly finds the directory node that should be listed.
 */
function getDirectoryNode(data) {
  const pageKey = normalizeLookupKey(data.page.url);

  // CASE 1: This is an auto-generated directory page.
  // We can reliably identify it by its inputPath.
  if (data.page.inputPath.endsWith("autoDirectory.njk")) {
    // We want to list *this* directory's children.
    return data.filetree.lookupByPath[pageKey];
  }

  // CASE 2: This is an index.md page.
  // It also functions as the index for its own directory.
  if (data.page.inputPath.endsWith("index.md")) {
    // We also want to list *this* directory's children.
    return data.filetree.lookupByPath[pageKey];
  }

  // CASE 3: This is a "File" page (e.g., categories.md or any-post.md)
  // We want to list its *parent's* children.
  const parentKey = normalizeLookupKey(path.dirname(pageKey));
  return data.filetree.lookupByPath[parentKey];
}

/**
 *  Extracts H1, Excerpt and Image using Markdown Tokens
 */
function parseMarkdownData(content, page) {
  if (!content) return { h1: null, image: null, excerpt: null, media: null };

  const tokens = md.parse(content, {});
  
  let h1 = null;
  let imagePath = null;
  let mediaPath = null;
  let textContent = "";

  // Extensions we consider "Playable" for Open Graph
  const mediaExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.mp4', '.mov', '.mkv', '.webm'];

  // 1. TOKEN SCAN (Standard Markdown)
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // FIND H1
    if (!h1 && t.type === 'heading_open' && t.tag === 'h1') {
      if (tokens[i+1] && tokens[i+1].type === 'inline') {
        h1 = tokens[i+1].content;
      }
    }

    // FIND IMAGE (Standard ![alt](src))
    if (t.type === 'image') {
      const src = t.attrGet('src');
      if (src) {
          // Priority 1: Is this the first image? (Cover Art)
          if (!imagePath) imagePath = src;
          
          // Priority 2: Is this actually a video/audio file? (Rare but possible in some parsers)
          if (!mediaPath) {
              const ext = path.extname(src).toLowerCase();
              if (mediaExtensions.includes(ext)) mediaPath = src;
          }
      }
    }

    // FIND LINKS (Standard [Text](src))
    // This catches hotlinked media files
    if (t.type === 'link_open') {
        const href = t.attrGet('href');
        if (href && !mediaPath) {
            const ext = path.extname(href).toLowerCase();
            if (mediaExtensions.includes(ext)) {
                mediaPath = href; 
            }
        }
    }
    
    // BUILD EXCERPT
    if (t.type === 'inline' && tokens[i-1] && tokens[i-1].type === 'paragraph_open') {
        textContent += t.content + " ";
    }
  }

  // 2. REGEX FALLBACKS (Shortcodes)
  
  // Fallback A: Image Shortcode {% image "..." %}
  // Critical for posts that use the shortcode instead of markdown syntax
  if (!imagePath) {
    const imgMatch = content.match(/\{%\s*image\s*["']([^"']+)["']/);
    if (imgMatch) imagePath = imgMatch[1];
  }

  // Fallback B: Media Shortcodes {% video "..." %} or {% audio "..." %}
  if (!mediaPath) {
    const mediaMatch = content.match(/\{%\s*(video|audio)\s*["']([^"']+)["']/);
    if (mediaMatch) mediaPath = mediaMatch[2];
  }

  // 3. PATH RESOLUTION (Relative -> Absolute)
  // Helper to resolve paths relative to the content folder
  const resolve = (p) => {
      try {
        if (!p.startsWith('http') && !p.startsWith('/')) {
            const pageDir = path.dirname(page.inputPath);
            const contentDir = path.resolve(__dirname);
            const physicalPath = path.resolve(pageDir, p);
            return '/' + path.relative(contentDir, physicalPath).replace(/\\/g, '/');
        }
      } catch (e) {}
      return p;
  };

  if (imagePath) imagePath = resolve(imagePath);
  if (mediaPath) mediaPath = resolve(mediaPath);

  // Process Excerpt
  const excerpt = textContent.slice(0, 155).trim() + (textContent.length > 155 ? "..." : "");

  return { h1, image: imagePath, excerpt, media: mediaPath };
}

module.exports = {
  layout: "layout.njk",
  download: true,
  directory: true,

  eleventyComputed: {

    // --- Parse content once ---
    _pageData: data => {
      // Skip running on special pages that don't have markdown content to parse
      if (data.page.inputPath.endsWith("media.njk") ||
        data.page.inputPath.endsWith("autoDirectory.njk") ||
        !data.page.rawInput ||
        !data.page.rawInput.trim()) {
        return null;
      }

      // Run the expensive parsing once
      return parseMarkdownData(data.page.rawInput, data.page);
    },

    uid: data => {
      // 1. Use existing UID if present in front matter
      if (data.uid) return slugify(data.uid);

      // 2. Ignore system files
      if (data.page.url === "/" ||
        (data.page.inputPath.endsWith("media.njk") && data.media) ||
        data.page.inputPath.endsWith("autoDirectory.njk") ||
        data.page.inputPath.includes("tags.njk") ||
        data.page.inputPath.includes("share.njk") ||
        data.page.inputPath.includes("search.json") ||
        data.page.inputPath.includes("shortlinks.json") ||
        data.page.inputPath.includes("404")) { // Added shortlinks.json exclusion
        return null;
      }

      // 3. Generate Short UID: Filename + Hash
      // Example: "my-cool-post" + "a1b2c" = "my-cool-post-a1b2c"
      const filename = path.basename(data.page.inputPath, path.extname(data.page.inputPath));
      const slug = slugify(filename); // Ensure it's URL safe

      // Generate hash from the input path to keep it stable for this file location
      const hash = getSeed(data.page.inputPath).toString(36).slice(-5);

      return `${slug}-${hash}`;
    },

    permalink: data => {
      // This checks if a permalink is set in a page's front matter.
      if (data.permalink) {
        // If it is, return that value, giving it top priority.
        return data.permalink;
      }
      // If not, return 'undefined' to let Eleventy use its
      // default file-based URL logic.
      return undefined;
    },

    title: data => {
      // 1. Check for a hard-coded title in front matter.
      if (data.title) {
        return data.title;
      }

      // 2. Check if this is a MEDIA PAGE (from media.njk)
      if (data.page.inputPath.endsWith("media.njk") && data.media) {
        return data.media.name;
      }

      // 3. Check if this is an AUTO-DIRECTORY PAGE (from autoDirectory.njk)
      if (data.page.inputPath.endsWith("autoDirectory.njk")) {
        const dirNode = getDirectoryNode(data);
        if (dirNode) {
          return dirNode.title || dirNode.name;
        }
        return "Directory"; // Fallback for dir
      }

      // 4. Use the pre-calculated H1
      if (data._pageData && data._pageData.h1) {
        return data._pageData.h1;
      }

      // 5. As a last resort, use the site default.
      return "The Bodge Lab";
    },

    directoryTitle: data => {
      const dirNode = getDirectoryNode(data);
      if (dirNode) {
        return dirNode.title || dirNode.name;
      }
      return "Directory"; // Fallback
    },

    parentUrl: data => {
      // The root page has no parent
      if (data.page.url === "/") {
        return null;
      }

      let my_url = data.page.url;

      // Strip trailing slash if it exists
      if (my_url.length > 1 && my_url.endsWith('/')) {
        my_url = my_url.substring(0, my_url.length - 1);
      }

      // Find the last slash and get everything before it
      return my_url.substring(0, my_url.lastIndexOf('/')) + '/';
    },
    
    directoryParentUrl: data => {
      // 1. Get the directory node we are currently listing
      const dirNode = getDirectoryNode(data);
      
      // If we are at root or can't find the node, no parent exists
      if (!dirNode || dirNode.webPath === '/' || dirNode.webPath === '') {
        return null;
      }

      // 2. Calculate the parent of the LISTED directory
      // (Not necessarily the parent of the current page)
      let my_url = dirNode.webPath;
      
      // Ensure we treat it as a directory path
      if (my_url.length > 1 && my_url.endsWith('/')) {
        my_url = my_url.slice(0, -1);
      }
      
      // Return the path up to the last slash
      return my_url.substring(0, my_url.lastIndexOf('/')) + '/';
    },

    directoryContents: data => {
      // Use the helper to find the correct directory node
      const dirNode = getDirectoryNode(data);

      if (!dirNode || !dirNode.children) {
        return { directories: [], files: [], pages: [] };
      }

      // Use the dirNode's webPath as the base for link URLs
      const cleanUrl = dirNode.webPath === '/' ? '/' : `${dirNode.webPath}/`;

      let directories = [];
      let files = [];
      let pages = [];

      // Get the normalized URL of the current page for comparison
      const mainPageUrl = normalizeLookupKey(data.page.url);

      for (const item of dirNode.children) {
        // FOR DIRECTORY PAGES
        if (item.isDirectory) {
          directories.push({ name: item.name, url: `${cleanUrl}${item.name}/` });
        }

        // FOR TEMPLATE PAGES
        else if (item.isTemplate) {
          const baseName = path.basename(item.name, item.ext);

          // 1. Get the URL
          let itemUrl;
          if (item.isIndex) {
            // An index file's URL is its directory's canonical URL.
            itemUrl = dirNode.webPath;

            // Apply the same trailing slash logic as template URL generation in filetree.js
            if (itemUrl === '') itemUrl = '/'; // Fix root path
            if (itemUrl !== '/' && !itemUrl.endsWith('/')) {
              itemUrl += '/'; // Add trailing slash
            }
          } else {
            // A regular template page
            itemUrl = item.permalink || `${cleanUrl}${baseName}/`;
          }

          // 2. Get the Name
          const itemName = item.title || baseName;

          // 3. Check if it's the current page
          const isCurrent = (normalizeLookupKey(itemUrl) === mainPageUrl);

          pages.push({
            name: `» ${itemName}`, // Use the title
            url: itemUrl,
            isCurrent: isCurrent
          });
        }

        // FOR MEDIA FILES
        else if (item.isMedia) {
          // Link to the media *page*, not the raw file
          files.push({ 
            name: item.name, 
            url: `${cleanUrl}${item.name}.html`,
            downloadUrl: `${cleanUrl}${item.name}`,
         });
        }
      }

      return { directories, files, pages };
    },

    // set download filename
    download_filename: data => {

      // 1. Media Page (Highest Priority)
      if (data.media && data.media.url) {
        return path.basename(data.media.url);
      }

      // Only proceed if we have a templated content file
      if (data.page && data.page.inputPath) {
        const ext = path.extname(data.page.inputPath);
        let baseName;

        // 2. Front Matter Title (Highest priority for content filename)
        if (data.title) {
          baseName = data.title;
        }
        // 3. H1 Extraction Fallback (Uses pre-calculated _pageData)
        else if (data._pageData && data._pageData.h1) {
          baseName = data._pageData.h1;
        }
        // 4. Filename Fallback (e.g., "my-post")
        else {
          baseName = path.basename(data.page.inputPath, ext);
        }

        // Clean the baseName (relying on browser to URL-encode) and append the original file extension
        return baseName.trim().replace(/[/\\]/g, '-') + ext;
      }

      // Final fallback
      return "file";
    },

    // open graph and SEO metadata
    seo: data => {
      // data.meta is from _data/meta.js
      // data.page is the current page
      const meta = data.meta;
      const page = data.page;

      // Get Description - Use the pre-calculated excerpt
      const seoDescription = data.description ||
        (data._pageData && data._pageData.excerpt) ||
        meta.defaultDescription;

      // Get Image - Use the pre-calculated image path
      let imagePath = data.image ||
        (data._pageData && data._pageData.image) ||
        meta.defaultImage;

      // Build absolute URLs
      const seoImage = new URL(imagePath, meta.url).href;
      const seoUrl = new URL(page.url, meta.url).href;

      return {
        description: seoDescription,
        image: seoImage,
        url: seoUrl
      };
    },
  }

};