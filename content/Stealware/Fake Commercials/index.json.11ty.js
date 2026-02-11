const fs = require('fs');
const path = require('path');

module.exports = class {
    data() {
        return {
            permalink: "/widkads.json", 
            eleventyExcludeFromCollections: true,
            layout: false,
        };
    }

   async render(data) {
        // IMPORT MUSIC-METADATA PACKAGE DYNAMICALLY
        // Since music-metadata is a modern ESM module and this file is CommonJS,
        // we import it dynamically inside the async function.
        const { parseFile } = await import('music-metadata');

        // Find the physical directory this script is currently sitting in
        const dir = path.join(__dirname);
        
        // Find all MP3s sitting next to it
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp3'));
        
        // DYNAMIC WEB PATH
        // Get the directory of the filePathStem
        let webFolder = path.dirname(data.page.filePathStem).replace(/\\/g, '/');
        
        // Ensure it ends with a trailing slash
        if (!webFolder.endsWith('/')) {
            webFolder += '/';
        }

        // BUILD JSON ASYNCHRONOUSLY
        // We use Promise.all to process all files in parallel
        const json = await Promise.all(files.map(async f => {
            // Construct the full relative web path
            const rawUrl = `${webFolder}${f}`;
            
            // Construct the physical file path so Node can read it
            const physicalPath = path.join(dir, f);

            // Fetch the duration!
            let duration = 0;
            try {
                const metadata = await parseFile(physicalPath);
                // Round to nearest second to save bytes, matching client logic
                duration = Math.round(metadata.format.duration || 0);
            } catch (err) {
                console.warn(`[11ty] Could not read duration for ${f}:`, err.message);
            }

            return {
                title: f.replace('.mp3', '').replace(/_/g, ' '), 
                
                // Encode spaces for the browser
                url: encodeURI(rawUrl),
                
                // The new magic property
                duration: duration
            };
        }));

        return JSON.stringify(json, null, 2);
    }
};