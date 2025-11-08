// _data/filetree.js
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter'); // We just installed this

const {
    TEMPLATE_EXTENSIONS,
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    AUDIO_EXTENSIONS
} = require('../_includes/config/fileTypes.js');

const MEDIA_EXTENSIONS = [
    ...IMAGE_EXTENSIONS,
    ...VIDEO_EXTENSIONS,
    ...AUDIO_EXTENSIONS
];

const SYSTEM_FILES = [
    'media.njk', 
    'autoDirectory.njk', 
    'content.11tydata.js'
];

const INDEX_FILES = TEMPLATE_EXTENSIONS.map(ext => `index${ext}`);
const contentDir = path.join(__dirname, '..', 'content');

function getMediaType(ext) {
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
    return 'other';
}

function scanDir(dirPath, webPath) {
    let node = {
        name: path.basename(dirPath) || 'content',
        physicalPath: dirPath,
        webPath: webPath || '/',
        isDirectory: true,
        hasIndex: false,
        indexFile: null,
        title: null,
        children: []
    };

    let items;
    try {
        items = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (err) {
        console.warn(`[filetree.js] Could not read directory: ${dirPath}`, err.message);
        return node;
    }

    for (const item of items) {

        if (SYSTEM_FILES.includes(item.name)) {
            continue;
        }

        const itemPhysicalPath = path.join(dirPath, item.name);
        const itemWebPath = (webPath === '/' ? '' : webPath) + '/' + item.name;
        const ext = path.extname(item.name).toLowerCase();

        if (item.isDirectory()) {
            node.children.push(scanDir(itemPhysicalPath, itemWebPath));
        } else {
            const isTemplate = TEMPLATE_EXTENSIONS.includes(ext);
            const isMedia = !isTemplate; // Simplified
            const isIndex = INDEX_FILES.includes(item.name);

            if (isIndex) {
                node.hasIndex = true;
                node.indexFile = item.name;
                try {
                    const fileContent = fs.readFileSync(itemPhysicalPath, 'utf8');
                    const { data } = matter(fileContent);
                    if (data.title) {
                        node.title = data.title;
                    }
                } catch (e) {
                    console.warn(`[filetree.js] Could not read front matter from ${itemPhysicalPath}`);
                }
            }

            node.children.push({
                name: item.name,
                physicalPath: itemPhysicalPath,
                webPath: itemWebPath.replace(/\\/g, '/'),
                isDirectory: false,
                ext: ext,
                isTemplate: isTemplate,
                isMedia: isMedia, // We can just use !isTemplate
                isIndex: isIndex,
                mediaType: getMediaType(ext)
            });
        }
    }
    
    if (node.title === null) {
        // Use "The Bodge Lab" for the root, and the folder name for everything else
        node.title = node.name === 'content' ? 'The Bodge Lab' : node.name;
    }

    node.children.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1; // Directories first
        }
        return a.name.localeCompare(b.name); // Then sort alphabetically
    });

    return node;
}

// --- Module Export ---
try {
    if (!fs.existsSync(contentDir)) {
        console.warn("[filetree.js] 'content' directory not found.");
        module.exports = {};
    } else {
        const fileTree = scanDir(contentDir, '/');
        module.exports = fileTree;
    }
} catch (err) {
    console.error("[filetree.js] Failed to scan directories:", err);
    module.exports = {};
}