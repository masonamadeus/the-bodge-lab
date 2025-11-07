const { execSync } = require("child_process");
const fs = require('fs');
const path = require('path');
const projectRoot = path.join(__dirname, '..');

const {
    TEMPLATE_EXTENSIONS,
    MEDIA_EXTENSIONS
} = require('../_includes/config/fileTypes.js');

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

module.exports = {

  layout: "layout.njk",

  eleventyComputed: {
    
    date: data => {
      return data.date || getGitLastModified(data.page.inputPath);
    },

    directoryContents: data => {

      let dirPath;
      // __dirname is the absolute path to the 'content' folder
      // (e.g., P:\...\the-bodge-lab\content)

      // Case 1: It's an auto-generated page
      if (data.page.inputPath.endsWith('autoDirectory.njk')) {
        // data.page.url will be something like "/empty-folder/"
        // We join it with __dirname to get the full physical path
        dirPath = path.join(__dirname, data.page.url);
      
      // Case 2: It's a manual .md file
      } else {
        
        dirPath = path.join(projectRoot, path.dirname(data.page.inputPath));
      }
      
      // This creates a clean base web path like "/" or "/posts/"
      const webPathRoot = (data.page.url === "/") ? "/" : (data.page.url.substring(0, data.page.url.lastIndexOf('/')) + "/");

      let directories = [];
      let files = [];

      try {
        if (!fs.existsSync(dirPath)) {
            console.warn(`[11tydata] Directory not found, skipping: ${dirPath}`);
            return { directories: [], files: [] };
        }
          
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          
          // Filter out our internal templates first
          if (item === 'media.njk' || item === 'autoDirectory.njk' || item === 'content.11tydata.js') continue;

          const itemPath = path.join(dirPath, item);
          const stat = fs.statSync(itemPath);
          const ext = path.extname(item).toLowerCase();

          // 1. Handle Directories
          if (stat.isDirectory()) {
            directories.push({ name: item, url: `${webPathRoot}${item}/` });
            continue; 
          }

          // 2. Handle Templates
          if (TEMPLATE_EXTENSIONS.includes(ext)) {
            if (item === 'index.md' || item === 'index.njk') continue;
            const baseName = path.basename(item, ext);
            files.push({ name: item, url: `${webPathRoot}${baseName}/` });
          
          // 3. Handle Media Files
          } else if (MEDIA_EXTENSIONS.includes(ext)) {
        // This now creates a link like /posts/my-image.png/
        files.push({ name: item, url: `${webPathRoot}${item}.html` });
          // 4. Handle Raw Files
          } else {
            files.push({ name: item, url: `${webPathRoot}${item}` });
          }
        }
      } catch (e) {
        console.warn(`Error reading directory ${dirPath} for page ${data.page.url}: ${e}`);
        return null;
      }

      directories.sort((a, b) => a.name.localeCompare(b.name));
      files.sort((a, b) => a.name.localeCompare(b.name));

      return { directories, files };
    }
  }
};