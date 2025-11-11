// content/content.11tydata.js
const path = require('path');

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
 * Extracts a 155-character excerpt from raw markdown content.
 */
function extractExcerpt(content) {
  if (!content) {
    return null;
  }
  // Remove Nunjucks shortcodes, markdown links, and formatting
  let excerpt = content
    .replace(/\{%[^%]*%\}/g, '') // Remove shortcodes
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove markdown links
    .replace(/[#*_`]/g, '') // Remove markdown formatting
    .replace(/\s+/g, ' ') // Consolidate whitespace
    .trim();
  
  if (excerpt.length > 155) {
    excerpt = excerpt.substring(0, 155).trim() + '...';
  }
  return excerpt;
}

/**
 * Finds the first `{% image ... %}` shortcode and resolves its path.
 */
function extractImage(content, page) {
  if (!content) {
    return null;
  }
  
  const imageRegex = /\{%\s*image\s*\"([^\"]+)\"/;
  const match = content.match(imageRegex);

  if (match && match[1]) {
    const imagePath = match[1];
    
    try {
      const pageDir = path.dirname(page.inputPath);
      
      // --- THIS IS THE FIX ---
      // __dirname is *already* the 'content' folder.
      const contentDir = path.resolve(__dirname); 
      // --- END FIX ---
      
      // 2. Resolve the relative image path from the page's directory
      const physicalImagePath = path.resolve(pageDir, imagePath);
      
      // 3. Get the relative path from /content/ to the image
      const webPath = path.relative(contentDir, physicalImagePath);
      
      return '/' + webPath.replace(/\\/g, '/');
    } catch (e) {
      console.warn(`[SEO] Could not resolve image path: ${imagePath} in ${page.inputPath}`);
      return null;
    }
  }
  return null;
}

// this is supposed to extract the first h1 from markdown content
function extractH1(content) {
  if (!content) {
    console.log("H1: no content")
    return null;
  }
  // --- START FIX ---
  // Split the content by front matter dashes
  const parts = content.split('---');

  // Use the content *after* the front matter (if it exists)
  // parts.length > 2 means there was front matter
  const markdownContent = parts.length > 2 ? parts.slice(2).join('---') : content;
  // --- END FIX ---

  // Look for the first markdown H1 in the *actual content*
  const match = markdownContent.match(/#\s+(.+)/m);
  
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

module.exports = {
  layout: "layout.njk",
  download: true,
  directory: true,

  eleventyComputed: {

    uid: data => {
      // 1. Use existing UID if present in front matter
      if (data.uid) {
        return data.uid;
      }

      // 2. Don't generate UIDs for system pages
      if (data.page.url === "/" || 
          (data.page.inputPath.endsWith("media.njk") && data.media) ||
          data.page.inputPath.endsWith("autoDirectory.njk") ||
          data.page.inputPath.includes("tags.njk") || // Stop pagination from getting UIDs
          data.page.inputPath.includes("share.njk")) {
        return null;
      }

      // 3. Generate a dynamic UID from the file path.
      // This logic is independent of 'title' and breaks the circular dependency.
      const relativePath = path.relative(__dirname, data.page.inputPath);
      const dir = path.dirname(relativePath);
      const filename = path.basename(relativePath, path.extname(relativePath));
      
      let parts = [];
      if (dir !== '.' && dir !== '') {
         parts = dir.split(path.sep);
      }
      parts.push(filename);
      
      const dynamicUid = parts
        .map(part => slugify(part))
        .filter(part => part !== 'index' && part !== '')
        .join('-');

      // 4. Add the hash back in to ensure uniqueness if you move files
      const hash = getSeed(data.page.inputPath).toString(36).slice(-6);

      return `${dynamicUid}-${hash}`;
    },

    permalink: data => {
      // This checks if a permalink is set in a page's front matter.
      if (data.permalink) {
        // If it is, return that value, giving it top priority.
        return data.permalink;
      }
      console.log(`[permalink] No permalink set for ${data.page.inputPath}`);
      // If not, return 'undefined' to let Eleventy use its
      // default file-based URL logic.
      return undefined;
    },

    title: data => {
      // 1. Check for a hard-coded title in front matter.
      // This is always highest priority.
      if (data.title) {
        return data.title;
      }

      // 2. Check if this is a MEDIA PAGE (from media.njk)
      // If so, use the paginated media file's name.
      if (data.page.inputPath.endsWith("media.njk") && data.media) {
        return data.media.name;
      }

      // 3. Check if this is an AUTO-DIRECTORY PAGE (from autoDirectory.njk)
      // If so, use the filetree node's title.
      if (data.page.inputPath.endsWith("autoDirectory.njk")) {
        const dirNode = getDirectoryNode(data);
        if (dirNode) {
          return dirNode.title || dirNode.name;
        }
        return "Directory"; // Fallback for dir
      }
      
      // 4. For any other page, try to find the first H1 in the RAW markdown.
      const h1 = extractH1(data.page.rawInput);
      if (h1) {
        return h1;
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

      for (const item of dirNode.children) {
        // FOR DIRECTORY PAGES
        if (item.isDirectory) {
          directories.push({ name: item.name, url: `${cleanUrl}${item.name}/` });
        }

        // FOR TEMPLATE PAGES
        else if (item.isTemplate && !item.isIndex) {
          const baseName = path.basename(item.name, item.ext);
          
          // --- THIS LOGIC NOW WORKS ---
          // 'item' now has all front matter properties from filetree.js
          
          // 1. Get the URL
          const itemUrl = item.permalink || `${cleanUrl}${baseName}/`;

          // 2. Get the Name
          const itemName = item.title || baseName;
          // --- END FIX ---

          // 3. Check if it's the current page
          const mainPageUrl = normalizeLookupKey(data.page.url);
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
          files.push({ name: item.name, url: `${cleanUrl}${item.name}.html` });
        }
      }

      return { directories, files, pages };
    },
    download_filename: data => {
      if (data.media && data.media.url) {
        // This is a media page (from media.njk)
        return path.basename(data.media.url);
      }
      if (data.page && data.page.inputPath) {
        // This is a post page (e.g., .md file)
        return path.basename(data.page.inputPath);
      }
      // Fallback
      return "file";
    },

    // open graph and SEO metadata
    seo: data => {
      // data.meta is from _data/meta.js
      // data.page is the current page
      // data.content is the raw markdown content
      const meta = data.meta;
      const page = data.page;
      
      // Get Description
      //    Front Matter `description:` > Auto-excerpt > Default
      const seoDescription = data.description ||
                             extractExcerpt(data.page.rawInput) ||
                             meta.defaultDescription;
                             
      // Get Image
      //    Front Matter `image:` > First `{% image %}` > Default
      let imagePath = data.image ||
                      extractImage(data.page.rawInput, data.page) ||
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