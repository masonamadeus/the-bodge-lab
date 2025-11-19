const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const crypto = require('crypto');

// Simple recursive file walker
function getFiles(dir, ext) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(file, ext));
        } else {
            if (path.extname(file).toLowerCase() === ext) results.push(file);
        }
    });
    return results;
}

(async () => {
    // Pointing to the 'content' folder relative to this script
    const contentDir = path.resolve(__dirname, '../content');
    const files = getFiles(contentDir, '.md');
    let modifiedCount = 0;

    console.log(`[STAMPER] Scanning ${files.length} files...`);

    for (const filepath of files) {
        const fileContent = fs.readFileSync(filepath, 'utf8');
        // Parse front matter
        const parsed = matter(fileContent);

        // If 'uid' is missing, add it
        if (!parsed.data.uid) {
            parsed.data.uid = crypto.randomUUID().split('-')[0]; // Short ID
            
            // Rebuild the file string
            const newContent = matter.stringify(parsed.content, parsed.data);
            fs.writeFileSync(filepath, newContent);
            
            console.log(`[STAMPED] ${parsed.data.uid} -> ${path.basename(filepath)}`);
            modifiedCount++;
        }
    }

    if (modifiedCount > 0) console.log(`[SUCCESS] Stamped ${modifiedCount} files.`);
    else console.log("[OK] All files have IDs.");
})();