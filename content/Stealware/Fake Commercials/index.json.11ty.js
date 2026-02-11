const fs = require('fs');
const path = require('path');

module.exports = class {
    data() {
        return {
            // Adjust this path to wherever you want the JSON to live!
            permalink: "/widkads.json", 
            eleventyExcludeFromCollections: true,
            layout: false,
        };
    }

   render(data) {
        // Find the physical directory this script is currently sitting in
        const dir = path.join(__dirname);
        
        // Find all MP3s sitting next to it
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp3'));
        
        // 2. DYNAMIC WEB PATH
        // Get the directory of the filePathStem (e.g. "/Stealware/Fake Commercials")
        // We force forward slashes just to be safe across different operating systems.
        let webFolder = path.dirname(data.page.filePathStem).replace(/\\/g, '/');
        
        // Ensure it ends with a trailing slash
        if (!webFolder.endsWith('/')) {
            webFolder += '/';
        }

        // Build the JSON array
        const json = files.map(f => {
            // Construct the full relative web path
            const rawUrl = `${webFolder}${f}`;

            return {
                title: f.replace('.mp3', '').replace(/_/g, ' '), 
                // 3. ENCODE SPACES
                // Since your folder has a space ("Fake Commercials"), we MUST encode it
                // so the browser sees ".../Fake%20Commercials/..."
                url: encodeURI(rawUrl)
            };
        });

        return JSON.stringify(json, null, 2);
    }
};
