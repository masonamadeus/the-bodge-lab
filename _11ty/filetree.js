// _11ty/filetree.js
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const {
    TEMPLATE_EXTENSIONS,
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    AUDIO_EXTENSIONS
} = require('./fileTypes.js');

const SYSTEM_FILES = [
    'media.njk', 
    'autoDirectory.njk', 
    'content.11tydata.js',
    'tags.njk'
];

const INDEX_FILES = TEMPLATE_EXTENSIONS.map(ext => `index${ext}`);

function getMediaType(ext) {
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
    return 'other';
}

/**
 * Normalizes a web path to be used as a consistent lookup key.
 * - Replaces backslashes with forward slashes
 * - Removes trailing slash (unless it's the root)
 */
function normalizeMapKey(webPath) {
    let key = path.normalize(webPath).replace(/\\/g, '/');
    if (key.length > 1 && key.endsWith('/')) {
        key = key.slice(0, -1);
    }
    return key;
}

// This is your main function, now modified to be an
// internal, recursive helper.
function scanDir(dirPath, webPath, collector) {
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
            // Recurse and add the child directory node
            const childNode = scanDir(itemPhysicalPath, itemWebPath, collector);
            node.children.push(childNode);
            
            // --- NEW: Add directory to directories list if it needs a page ---
            if (!childNode.hasIndex) {
                collector.directories.push({ webPath: childNode.webPath });
            }

        } else {
            const isTemplate = TEMPLATE_EXTENSIONS.includes(ext);
            const isMedia = !isTemplate;
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
            
            const fileNode = {
                name: item.name,
                physicalPath: itemPhysicalPath,
                webPath: itemWebPath.replace(/\\/g, '/'),
                isDirectory: false,
                ext: ext,
                isTemplate: isTemplate,
                isMedia: isMedia,
                isIndex: isIndex,
                mediaType: getMediaType(ext)
            };

            node.children.push(fileNode);

            // --- NEW: Add file node to lookup map ---
            const fileMapKey = normalizeMapKey(fileNode.webPath);
            collector.lookupByPath[fileMapKey] = fileNode;

            // --- NEW: Add file to assets list ---
            if (isMedia) {
                collector.assets.push({
                    name: fileNode.name,
                    ext: fileNode.ext,
                    type: fileNode.mediaType,
                    url: fileNode.webPath
                });
            }
        }
    }
    
    if (node.title === null) {
        node.title = node.name === 'content' ? 'The Bodge Lab' : node.name;
    }

    node.children.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1; // Directories first
        }
        return a.name.localeCompare(b.name); // Then sort alphabetically
    });
    
    // --- NEW: Add this directory node to the lookup map ---
    const dirMapKey = normalizeMapKey(node.webPath);
    collector.lookupByPath[dirMapKey] = node;

    return node;
}

// --- NEW: This is now the main exported function ---
function generateFileTreeData(contentDir) {
    // This collector object will be populated by scanDir
    const collector = {
        tree: {},
        lookupByPath: {},
        assets: [],
        directories: []
    };

    // Run the scan, which mutates the collector object
    collector.tree = scanDir(contentDir, '/', collector);

    // Return the single, comprehensive object
    return collector;
}

module.exports = {
    generateFileTreeData
};