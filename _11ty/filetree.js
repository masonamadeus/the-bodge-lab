// _11ty/filetree.js
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// --- THIS IS THE IMPORT FIX ---
// We now import all the types we need
const {
    TEMPLATE_EXTENSIONS,
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    AUDIO_EXTENSIONS
} = require('./fileTypes.js');
// --- END FIX ---

const SYSTEM_FILES = [
    'media.njk',
    'autoDirectory.njk',
    'content.11tydata.js',
    'tags.njk',
    '404.njk',
    'search.njk',
    'share'
];

const INDEX_FILES = TEMPLATE_EXTENSIONS.map(ext => `index${ext}`);

function getMediaType(ext) {
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
    return 'other';
}

function normalizeMapKey(webPath) {
    let key = path.normalize(webPath).replace(/\\/g, '/');
    if (key.length > 1 && key.endsWith('/')) {
        key = key.slice(0, -1);
    }
    return key;
}

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

        // --- LOGIC CLEANUP ---
        // These are defined once per item in the loop
        const itemPhysicalPath = path.join(dirPath, item.name);
        const itemWebPath = (webPath === '/' ? '' : webPath) + '/' + item.name;
        const ext = path.extname(item.name).toLowerCase();
        // --- END CLEANUP ---

        if (item.isDirectory()) {
            // Recurse and add the child directory node
            const childNode = scanDir(itemPhysicalPath, itemWebPath, collector);
            node.children.push(childNode);

            if (!childNode.hasIndex) {
                collector.directories.push({ webPath: childNode.webPath });
            }
        } else { 
            // This is the file-handling logic, no more redundant definitions
            const isTemplate = TEMPLATE_EXTENSIONS.includes(ext);
            const isMedia = !isTemplate; // This is now correct!
            const isIndex = INDEX_FILES.includes(item.name);
            let title = null;

            if (isTemplate) {
                try {
                    const fileContent = fs.readFileSync(itemPhysicalPath, 'utf8');
                    const { data } = matter(fileContent);
                    if (data.title) {
                        title = data.title;
                    }
                } catch (e) {
                    console.warn(`[filetree.js] Could not read front matter from ${itemPhysicalPath}`);
                }
            }

            if (isIndex) {
                node.hasIndex = true;
                node.indexFile = item.name;
                if (title) {
                    node.title = title;
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
                mediaType: getMediaType(ext), // This now works
                title: title
            };

            node.children.push(fileNode);

            const fileMapKey = normalizeMapKey(fileNode.webPath);
            collector.lookupByPath[fileMapKey] = fileNode;

            if (isMedia) {
                collector.assets.push({
                    name: fileNode.name,
                    ext: fileNode.ext,
                    type: fileNode.mediaType,
                    url: fileNode.webPath
                });
            }

            if (isTemplate && !isIndex) {
                const pageUrl = fileNode.webPath.replace(new RegExp(ext + '$'), '/');
                collector.allPages.push({
                    url: pageUrl,
                    title: title || path.basename(fileNode.name, ext)
                });
            }
        }
    }

    if (node.title === null) {
        node.title = node.name === 'content' ? 'The Bodge Lab' : node.name;
    }

    node.children.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    const dirMapKey = normalizeMapKey(node.webPath);
    collector.lookupByPath[dirMapKey] = node;

    return node;
}

function generateFileTreeData(contentDir) {
    const collector = {
        tree: {},
        lookupByPath: {},
        assets: [],
        directories: [],
        allPages: [],
    };

    collector.tree = scanDir(contentDir, '/', collector);
    return collector;
}

module.exports = {
    generateFileTreeData
};