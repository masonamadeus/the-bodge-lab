// content/content.11tydata.js
const { execSync } = require("child_process");
const fs = require('fs');
const path = require('path');
const fileTree = require('../_data/filetree.js');

// --- This is your original Git function. We keep it! ---
function getGitLastModified(inputPath) {
  try {
    const cmd = `git log -1 --format=%cI "${inputPath}"`;
    const date = execSync(cmd).toString().trim();
    if (date) {
      return new Date(date);
    }
  } catch (e) {
    // ...
  }
  return new Date();
}

/**
 * Helper function to find a node in the filetree by its webPath.
 * This was fixed in the previous step and is correct.
 */
function findNodeByWebPath(webPath, node) {
    if (!node) return null;
    let cleanWebPath = path.normalize(webPath).replace(/\\/g, '/');
    let cleanNodePath = path.normalize(node.webPath).replace(/\\/g, '/');
    if (cleanWebPath.length > 1 && cleanWebPath.endsWith('/')) {
        cleanWebPath = cleanWebPath.slice(0, -1);
    }
    if (cleanNodePath.length > 1 && cleanNodePath.endsWith('/')) {
        cleanNodePath = cleanNodePath.slice(0, -1);
    }
    if (cleanNodePath === cleanWebPath) {
        return node;
    }
    if (node.isDirectory && node.children) {
        for (const child of node.children) {
            const found = findNodeByWebPath(webPath, child);
            if (found) return found;
        }
    }
    return null;
}

module.exports = {
  layout: "layout.njk",
  download: true,
  directory: true, 

  eleventyComputed: {

    date: data => {
      return data.date || getGitLastModified(data.page.inputPath);
    },

    directoryTitle: data => {
        // --- FIX #1: DECODE THE URL ---
        const pageUrl = decodeURIComponent(data.page.url.replace(/&amp;/g, '&'));
        let dirNode = null;

        if (pageUrl.endsWith('.html')) {
            const parentUrl = path.dirname(pageUrl) + '/';
            dirNode = findNodeByWebPath(parentUrl, fileTree);
        } else {
            dirNode = findNodeByWebPath(pageUrl, fileTree);
        }

        if (dirNode && dirNode.title) {
            return dirNode.title;
        } else if (dirNode) {
            return dirNode.name;
        }
        
        return data.title || "Directory";
    },

    directoryContents: data => {
      let directoryUrl;

      if (data.physicalPath) {
        directoryUrl = data.physicalPath;
      } else if (data.page.url.endsWith('.html')) {
        directoryUrl = path.dirname(data.page.url) + '/';
      } else {
        directoryUrl = data.page.url;
      }
      
      // --- FIX #2: DECODE THE URL ---
      const cleanUrl = decodeURIComponent(directoryUrl.replace(/&amp;/g, '&'));
      
      const dirNode = findNodeByWebPath(cleanUrl, fileTree); // This will now work

      if (!dirNode || !dirNode.children) {
        return { directories: [], files: [], pages: [] };
      }

      let directories = [];
      let files = [];
      let pages = [];

      for (const item of dirNode.children) {
        const itemUrl = cleanUrl.endsWith('/') ? cleanUrl : cleanUrl + '/';

        if (item.isDirectory) {
            directories.push({ name: item.name, url: `${itemUrl}${item.name}/` });
        } 
        else if (item.isTemplate && !item.isIndex) {
            const baseName = path.basename(item.name, item.ext);
            pages.push({ name: item.name, url: `${itemUrl}${baseName}/` });
        } 
        else if (item.isMedia) {
            files.push({ name: item.name, url: `${itemUrl}${item.name}.html` });
        }
      }

      return { directories, files, pages };
    }
  }
};