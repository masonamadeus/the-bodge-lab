const fs = require('fs');
const path = require('path');

// --- IMPORT our config ---
const { TEMPLATE_EXTENSIONS } = require('../_includes/config/fileTypes.js');

// Get the list of what we consider 'index' files
const INDEX_FILES = TEMPLATE_EXTENSIONS.map(ext => `index${ext}`);

function scanForMissingIndexes(dir, webPath, contentDir) {
    let missing = [];
    
    // Check if the current directory *itself* has an index file
    let hasIndex = false;
    for (const indexFile of INDEX_FILES) {
        if (fs.existsSync(path.join(dir, indexFile))) {
            hasIndex = true;
            break;
        }
    }

    // If it DOES NOT have an index, add it to our list
    // (We skip the root 'content' folder itself)
    if (!hasIndex && webPath) {
        missing.push({
            webPath: webPath.replace(/\\/g, '/')
        });
    }

    // --- Now, recurse into subdirectories ---
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory()) {
            missing = missing.concat(
                scanForMissingIndexes(
                    path.join(dir, item.name),
                    `${webPath}/${item.name}`,
                    contentDir
                )
            );
        }
    }

    return missing;
}

module.exports = () => {
    try {
        const contentDir = path.join(__dirname, '..', 'content');
        if (!fs.existsSync(contentDir)) {
            console.warn("[directories.js] 'content' directory not found.");
            return [];
        }
        return scanForMissingIndexes(contentDir, '', contentDir);
    } catch (err) {
        console.error("[directories.js] Failed to scan directories:", err);
        return [];
    }
};