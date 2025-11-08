// _data/directories.js
const fileTree = require('./filetree.js');

function findMissingIndexes(node) {
    let missing = [];
    if (!node || !node.isDirectory) {
        return [];
    }
    
    if (!node.hasIndex && node.webPath !== '/') {
        missing.push({
            webPath: node.webPath.replace(/\\/g, '/')
        });
    }

    for (const child of node.children) {
        if (child.isDirectory) {
            missing = missing.concat(findMissingIndexes(child));
        }
    }
    return missing;
}

module.exports = () => {
    try {
        return findMissingIndexes(fileTree);
    } catch (err) {
        console.error("[directories.js] Failed to process fileTree:", err);
        return [];
    }
};