const fs = require('fs');
const path = require('path');

// --- IMPORT our config ---
// This path should be correct, as you said.
const {
    TEMPLATE_EXTENSIONS,
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    AUDIO_EXTENSIONS
} = require('../_includes/config/fileTypes.js');

// Helper function to get the media type from an extension
function getMediaType(ext) {
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
    return 'other';
}

function scanDir(dir, webPath, contentDir) {
    let assets = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
        const itemPath = path.join(dir, item);
        const relativePath = path.relative(contentDir, itemPath);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
            assets = assets.concat(scanDir(itemPath, `${webPath}/${item}`, contentDir));
        } else {
            const ext = path.extname(item).toLowerCase();
            if (TEMPLATE_EXTENSIONS.includes(ext)) {
                continue;
            }

            const mediaType = getMediaType(ext);

            assets.push({
                name: item,
                ext: ext,
                type: mediaType,
                url: `/${relativePath.replace(/\\/g, '/')}`
            });
            
        }
    }
    return assets;
}

// --- THIS IS THE NEW PART ---
module.exports = () => {
    try {
        // Use path.join for more predictable path building.
        // __dirname is [PROJECT_ROOT]/_data
        // '..' goes to [PROJECT_ROOT]
        // 'content' goes to [PROJECT_ROOT]/content
        const contentDir = path.join(__dirname, '..', 'content');
        
        // Check if the content directory actually exists
        if (!fs.existsSync(contentDir)) {
            console.warn(`[assets.js] Warning: 'content' directory not found at ${contentDir}`);
            return []; // Return empty array
        }
        
        return scanDir(contentDir, '', contentDir);

    } catch (err) {
        // If *anything* went wrong, log the real error
        console.error("--- Eleventy: ERROR in _data/assets.js ---");
        console.error(err);
        console.error("--------------------------------------------");
        
        // Return an empty array so Eleventy doesn't crash
        // The build will succeed, but you'll see the error.
        return [];
    }
};