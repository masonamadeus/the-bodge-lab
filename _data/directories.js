// _data/directories.js

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

module.exports = (configData) => {
    try {
        return findMissingIndexes(configData.filetree);
    } catch (err) {
        console.error("[directories.js] Failed to process configData.filetree:", err);
        return [];
    }
};