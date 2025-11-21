// _11ty/filetree.js
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const {
    TEMPLATE_EXTENSIONS,
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    AUDIO_EXTENSIONS,
    SYSTEM_FILES
} = require('./fileTypes.js');



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
    // 1. CHECK FOR STANDALONE APP
    // If found, return NULL. This tells the parent: "Pretend I don't exist."
    // This prevents AutoDirectory from seeing it AND prevents Media pages from being built.
    if (fs.existsSync(path.join(dirPath, ".standalone"))) {
        return null; 
    }

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
            // Recurse
            const childNode = scanDir(itemPhysicalPath, itemWebPath, collector);
            
            // 2. NULL CHECK (The Fix)
            // Only add the child if it actually exists (wasn't a standalone app)
            if (childNode) {
                node.children.push(childNode);

                if (!childNode.hasIndex) {
                    collector.directories.push({ webPath: childNode.webPath });
                }
            }

        } else { 
            // ... (File handling logic remains the same) ...
            
            const isTemplate = TEMPLATE_EXTENSIONS.includes(ext);
            const isMedia = !isTemplate;
            const isIndex = (item.name === 'index.md' || item.name === 'index.njk' || item.name === 'index.html'); // Simple check or use your INDEX_FILES array
            
            let frontMatterData = {}; 

            if (isTemplate) {
                try {
                    const fileContent = fs.readFileSync(itemPhysicalPath, 'utf8');
                    frontMatterData = matter(fileContent).data;
                } catch (e) {
                    console.warn(`[filetree.js] Could not read front matter from ${itemPhysicalPath}`);
                }
            }

            if (isIndex) {
                node.hasIndex = true;
                node.indexFile = item.name;
                if (frontMatterData.title) {
                    node.title = frontMatterData.title;
                }
            }

            const fileNode = {
                ...frontMatterData, 
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

           if (isTemplate) {
                let pageUrl;
                let pageTitle;

                if (isIndex) {
                    pageUrl = webPath; 
                    pageTitle = frontMatterData.title || node.name;
                    if (pageTitle === 'content') pageTitle = 'The Bodge Lab'; 
                } else {
                    pageUrl = fileNode.webPath.replace(new RegExp(ext + '$'), '/');
                    pageTitle = frontMatterData.title || path.basename(fileNode.name, ext);
                }
                
                if (pageUrl === '') pageUrl = '/'; 
                
                if (pageUrl !== '/' && !pageUrl.endsWith('/')) {
                    pageUrl += '/';
                }

                collector.allPages.push({
                    url: pageUrl,
                    title: pageTitle
                });
            }
        }
    }

    if (node.title === null) {
        node.title = node.name === 'content' ? 'The Bodge Lab' : node.name;
    }

    // Sort children: Directories first, then A-Z
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