// scripts/r2-manager.js
// USAGE: node scripts/r2-manager.js [push|pull]
// STRATEGY: "Inventory First" to minimize API calls.

const fs = require('fs');
const path = require('path');
const { 
    S3Client, 
    PutObjectCommand, 
    ListObjectsV2Command, 
    GetObjectCommand 
} = require("@aws-sdk/client-s3");
const mime = require('mime-types');

// --- CONFIGURATION ---
const LOCAL_ROOT = path.resolve(__dirname, '../large_media');
const ENV_FILE = path.resolve(__dirname, '../.env');

// --- HELPERS ---
function loadEnv() {
    if (!fs.existsSync(ENV_FILE)) return {};
    return fs.readFileSync(ENV_FILE, 'utf8').split('\n').reduce((acc, line) => {
        const [k, ...v] = line.split('=');
        if (k && v) acc[k.trim()] = v.join('=').trim();
        return acc;
    }, {});
}

function getLocalFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) results = results.concat(getLocalFiles(file));
        else results.push(file);
    });
    return results;
}

function ensureDir(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) return;
    ensureDir(dirname);
    fs.mkdirSync(dirname);
}

// Fetches ALL objects from R2 and returns a Map: { "filename": size_in_bytes }
// This costs 1 API call per 1000 files.
async function getBucketInventory(s3, bucketName) {
    const inventory = new Map();
    let continuationToken;
    
    try {
        do {
            const response = await s3.send(new ListObjectsV2Command({
                Bucket: bucketName,
                ContinuationToken: continuationToken
            }));
            
            (response.Contents || []).forEach(obj => {
                inventory.set(obj.Key, obj.Size);
            });

            continuationToken = response.NextContinuationToken;
        } while (continuationToken);
    } catch (e) {
        // If bucket is empty or new, just return empty inventory
    }
    return inventory;
}

// --- MAIN LOGIC ---
(async () => {
    const mode = process.argv[2];
    if (!['push', 'pull'].includes(mode)) {
        console.error(" [ERROR] Usage: node scripts/r2-manager.js [push|pull]");
        process.exit(1);
    }

    const env = loadEnv();
    if (!env.R2_BUCKET_NAME) {
        console.error(" [ERROR] Missing .env config.");
        process.exit(1);
    }

    const S3 = new S3Client({
        region: "auto",
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
    });

    // ============================================================
    // PUSH: Local -> R2 (Inventory Optimized)
    // ============================================================
    if (mode === 'push') {
        console.log(` [R2] Fetching remote inventory...`);
        const remoteInventory = await getBucketInventory(S3, env.R2_BUCKET_NAME);
        console.log(` [R2] Remote has ${remoteInventory.size} files. Comparing with local...`);

        const files = getLocalFiles(LOCAL_ROOT);
        if (files.length === 0) {
            console.log(" [INFO] No local files to sync.");
            return;
        }

        let uploadCount = 0;
        let skipCount = 0;

        for (const file of files) {
            // Normalize path to use forward slashes for R2 keys
            const relativePath = path.relative(LOCAL_ROOT, file).replace(/\\/g, '/');
            const localSize = fs.statSync(file).size;
            const remoteSize = remoteInventory.get(relativePath);

            // DECISION LOGIC:
            // If remoteSize matches localSize, we skip.
            // If remoteSize is undefined (new file) or different (changed file), we upload.
            if (remoteSize === localSize) {
                skipCount++;
                // process.stdout.write('.'); // Uncomment for dots
                continue;
            }

            console.log(`  ^ Uploading: ${relativePath} (${localSize} bytes)`);
            const contentType = mime.lookup(file) || 'application/octet-stream';
            
            try {
                await S3.send(new PutObjectCommand({
                    Bucket: env.R2_BUCKET_NAME,
                    Key: relativePath,
                    Body: fs.readFileSync(file),
                    ContentType: contentType
                }));
                uploadCount++;
            } catch (err) {
                console.error(`  ! FAILED: ${relativePath}`, err.message);
            }
        }
        console.log(`\n [DONE] Uploaded: ${uploadCount} | Skipped: ${skipCount}`);
    }

    // ============================================================
    // PULL: R2 -> Local (Inventory Optimized)
    // ============================================================
    if (mode === 'pull') {
        console.log(` [R2] checking remote inventory...`);
        // We iterate directly here since we need the list anyway
        
        try {
            let continuationToken;
            let downloadCount = 0;
            let skipCount = 0;

            do {
                const response = await S3.send(new ListObjectsV2Command({
                    Bucket: env.R2_BUCKET_NAME,
                    ContinuationToken: continuationToken
                }));

                if (!response.Contents || response.Contents.length === 0) {
                    console.log(" [INFO] Bucket is empty.");
                    break;
                }

                for (const obj of response.Contents) {
                    const localPath = path.join(LOCAL_ROOT, obj.Key);
                    let shouldDownload = true;

                    if (fs.existsSync(localPath)) {
                        const localSize = fs.statSync(localPath).size;
                        if (localSize === obj.Size) {
                            shouldDownload = false;
                            skipCount++;
                        }
                    }

                    if (shouldDownload) {
                        console.log(`  v Downloading: ${obj.Key}`);
                        const data = await S3.send(new GetObjectCommand({
                            Bucket: env.R2_BUCKET_NAME,
                            Key: obj.Key
                        }));

                        ensureDir(localPath);
                        const byteArray = await data.Body.transformToByteArray();
                        fs.writeFileSync(localPath, Buffer.from(byteArray));
                        downloadCount++;
                    }
                }
                continuationToken = response.NextContinuationToken;

            } while (continuationToken);

            console.log(`\n [DONE] Downloaded: ${downloadCount} | Skipped: ${skipCount}`);

        } catch (err) {
            console.error(" [ERROR] Download failed:", err.message);
        }
    }
})();