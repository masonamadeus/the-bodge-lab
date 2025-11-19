const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const crypto = require('crypto');

// Helper to clean strings for URLs (e.g. "My Cool Post!" -> "my-cool-post")
function slugify(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove invalid chars
        .replace(/\s+/g, '-')         // Replace spaces with -
        .replace(/-+/g, '-');         // Collapse multiple -
}

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
    const contentDir = path.resolve(__dirname, '../content');
    const files = getFiles(contentDir, '.md');
    let modifiedCount = 0;

    console.log(`[STAMPER] Scanning ${files.length} files...`);

    for (const filepath of files) {
        const fileContent = fs.readFileSync(filepath, 'utf8');
        const parsed = matter(fileContent);

        // Only stamp if missing
        if (!parsed.data.uid) {
            // 1. Get Filename
            const filename = path.basename(filepath, path.extname(filepath));
            
            // 2. Make it URL safe
            const slug = slugify(filename);
            
            // 3. Generate short hash (5 chars is plenty for uniqueness per-file)
            const hash = crypto.randomUUID().split('-')[0].substring(0, 5);
            
            // 4. Combine
            parsed.data.uid = `${slug}-${hash}`;
            
            const newContent = matter.stringify(parsed.content, parsed.data);
            fs.writeFileSync(filepath, newContent);
            
            console.log(`[STAMPED] ${parsed.data.uid} -> ${path.basename(filepath)}`);
            modifiedCount++;
        }
    }

    if (modifiedCount > 0) console.log(`[SUCCESS] Stamped ${modifiedCount} files.`);
    else console.log("[OK] All files have IDs.");
})();