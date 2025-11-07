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
  download: true,

  eleventyComputed: {

    date: data => {
      return data.date || getGitLastModified(data.page.inputPath);
    },

    directoryContents: data => {
      let dirPath;
      let directoryUrl;

      // 1. Get the correct, UN-ESCAPED directory URL.
      if (data.physicalPath) {
        // Case 1: Auto-generated page. data.physicalPath is already raw.
        directoryUrl = data.physicalPath;

      } else if (data.page.url.endsWith('.html')) {
        // Case 2: File page. Get the parent URL and un-escape it.
        let escapedUrl = data.page.url.substring(0, data.page.url.lastIndexOf('/')) + '/';
        directoryUrl = escapedUrl.replace(/&amp;/g, '&');

      } else {
        // Case 3: Manual directory page. Get the URL and un-escape it.
        directoryUrl = data.page.url.replace(/&amp;/g, '&');
      }

      // 2. Use the clean, un-escaped URL to find the physical folder.
      dirPath = path.join(__dirname, directoryUrl);

      // 3. Use the clean, un-escaped URL as the base for all new links.
      const webPathRoot = directoryUrl;

      let directories = [];
      let files = [];

      try {
        if (!fs.existsSync(dirPath)) {
          console.warn(`[11tydata] Directory not found, skipping: ${dirPath}`);
          return { directories: [], files: [] };
        }

        const items = fs.readdirSync(dirPath);
        for (const item of items) {

          if (item === 'media.njk' || item === 'autoDirectory.njk' || item === 'content.11tydata.js') continue;

          const itemPath = path.join(dirPath, item);
          const stat = fs.statSync(itemPath);
          const ext = path.extname(item).toLowerCase();

          // 1. Handle Directories
          if (stat.isDirectory()) {
            // webPathRoot is now un-escaped, so this link is correct.
            directories.push({ name: item, url: `${webPathRoot}${item}/` });
            continue;
          }

          // 2. Handle Templates
          if (TEMPLATE_EXTENSIONS.includes(ext)) {
            if (item === 'index.md' || item === 'index.njk') continue;
            const baseName = path.basename(item, ext);
            files.push({ name: item, url: `${webPathRoot}${baseName}/` });

            // 3. Handle ALL OTHER Files (as Media Pages)
          } else {
            // webPathRoot is now un-escaped, so this link is correct.
            files.push({ name: item, url: `${webPathRoot}${item}.html` });
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