// _data/assets.js
function getAssets(node) {
    let assets = [];
    if (!node || !node.children) {
        return [];
    }
    for (const child of node.children) {
        if (child.isDirectory) {
            assets = assets.concat(getAssets(child));
        } else if (!child.isTemplate) { // Any file that's not a template
            assets.push({
                name: child.name,
                ext: child.ext,
                type: child.mediaType,
                url: child.webPath
            });
        }
    }
    return assets;
}

module.exports = (configData) => {
    try {
        return getAssets(configData.filetree);
    } catch (err) {
        console.error("[assets.js] Failed to process configData.filetree:", err);
        return [];
    }
};