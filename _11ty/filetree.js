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

            if (!childNode.hasIndex) {
                collector.directories.push({ webPath: childNode.webPath });

                // Also add it to the pages list because we'll autogenerate an index
                /*  Commented out for now, I'll see if I change my mind later.
                collector.allPages.push({
                    url: childNode.webPath + '/', // Add trailing slash
                    title: childNode.title // This is set to node.name by default
                });
                //*/
            }

            
        } else { // This is the file-handling logic
            
            const isTemplate = TEMPLATE_EXTENSIONS.includes(ext);
            const isMedia = !isTemplate;
            const isIndex = INDEX_FILES.includes(item.name);
            
            let frontMatterData = {}; // Initialize an empty object

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
                
                // Our calculated properties (will override any conflicts)
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
                    // An index file's URL is its parent directory's webPath
                    pageUrl = webPath; // e.g., "/" or "/Bug & Moss"
                    
                    // Use front matter title, fallback to directory name
                    pageTitle = frontMatterData.title || node.name;
                    
                    // Handle the root "content" name
                    if (pageTitle === 'content') pageTitle = 'The Bodge Lab'; 
                } else {
                    // A regular page's URL
                    pageUrl = fileNode.webPath.replace(new RegExp(ext + '$'), '/');
                    pageTitle = frontMatterData.title || path.basename(fileNode.name, ext);
                }
                
                if (pageUrl === '') pageUrl = '/'; // Fix root path
                
                // Add trailing slash consistently
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