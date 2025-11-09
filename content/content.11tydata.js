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
 * This is the new helper function.
 * It correctly finds the directory node that should be listed.
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


module.exports = {
  layout: "layout.njk",
  download: true,
  directory: true, 

  eleventyComputed: {

    directoryTitle: data => {
        // Use the helper to find the correct directory node
        const dirNode = getDirectoryNode(data);
        if (dirNode) {
            return dirNode.title || dirNode.name;
        }
        // Fallback
        return data.title || "Directory";
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
            // This is the URL for the item in the list
            const itemUrl = `${cleanUrl}${baseName}/`;
            
            // This is the URL of the page we're currently on
            const mainPageUrl = normalizeLookupKey(data.page.url) + '/';

            // Compare them!
            const isCurrent = (itemUrl === mainPageUrl);

            pages.push({ 
                name: `» ${baseName}`, 
                url: itemUrl,
                isCurrent: isCurrent  // Add the new property
            });
        }

        // FOR MEDIA FILES
        else if (item.isMedia) {
            // Link to the media *page*, not the raw file
            files.push({ name: item.name, url: `${cleanUrl}${item.name}.html` });
        }
      }

      return { directories, files, pages };
    }
  }
};