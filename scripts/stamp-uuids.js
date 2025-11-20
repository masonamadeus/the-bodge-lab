const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const crypto = require('crypto');

// Helper to clean strings for URLs
function slugify(str) {
    if (!str) return '';
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
    
    let updatedCount = 0;
    let stampedCount = 0;
    let migratedCount = 0;
    let sanitizedCount = 0;

    console.log(`[STAMPER] Scanning ${files.length} files...`);

    for (const filepath of files) {
        const fileContent = fs.readFileSync(filepath, 'utf8');
        const parsed = matter(fileContent);
        let isModified = false;

        // --- 0. MIGRATION: URI -> UID ---
        if (parsed.data.uri && !parsed.data.uid) {
            parsed.data.uid = parsed.data.uri; // Move raw value first
            delete parsed.data.uri;
            
            console.log(`[MIGRATED] ${path.basename(filepath)}`);
            isModified = true;
            migratedCount++;
        } 
        else if (parsed.data.uri && parsed.data.uid) {
            delete parsed.data.uri;
            isModified = true;
        }

        // --- 0.5. SANITIZE UID ---
        // Ensure any UID (newly migrated or existing) is a valid URL slug
        if (parsed.data.uid) {
            const cleanUid = slugify(parsed.data.uid);
            if (parsed.data.uid !== cleanUid) {
                console.log(`[SANITIZED] "${parsed.data.uid}" -> "${cleanUid}"`);
                parsed.data.uid = cleanUid;
                isModified = true;
                sanitizedCount++;
            }
        }

        // --- 1. UID CHECK (New Files) ---
        if (!parsed.data.uid) {
            const filename = path.basename(filepath, path.extname(filepath));
            const slug = slugify(filename);
            const hash = crypto.randomUUID().split('-')[0].substring(0, 5);
            parsed.data.uid = `${slug}-${hash}`;
            
            console.log(`[NEW UID] ${path.basename(filepath)}`);
            isModified = true;
            stampedCount++;
        }

        // --- 2. DATE & HASH CHECK ---
        const currentBody = (parsed.content || "").trim();
        const currentHash = crypto.createHash('md5').update(currentBody).digest("hex").substring(0, 8);
        const storedHash = parsed.data.contentHash || "";

        if (currentHash !== storedHash) {
            parsed.data.contentHash = currentHash;
            parsed.data.date = new Date().toISOString();

            if (!isModified) console.log(`[UPDATED] ${path.basename(filepath)}`);
            isModified = true;
            updatedCount++;
        }

        // --- 3. WRITE IF NEEDED ---
        if (isModified) {
            const newContent = matter.stringify(parsed.content, parsed.data);
            fs.writeFileSync(filepath, newContent);
        }
    }

    console.log(`[DONE] Stamped: ${stampedCount} | Updated: ${updatedCount} | Migrated: ${migratedCount} | Sanitized: ${sanitizedCount}`);
})();