// scripts/r2-manager.js
// USAGE: node scripts/r2-manager.js [push|pull]
// STRATEGY: "Inventory First" to minimize API calls.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

function getFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
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
                // R2 ETags are wrapped in quotes like "5d41402abc4b2a76b9719d911017c592"
                // We strip them for comparison.
                const cleanETag = obj.ETag ? obj.ETag.replace(/"/g, '') : '';
                inventory.set(obj.Key, { size: obj.Size, etag: cleanETag });
            });
            continuationToken = response.NextContinuationToken;
        } while (continuationToken);
    } catch (e) {}
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
    // PUSH: Local -> R2 (Size + ETag Optimized)
    // ============================================================
    if (mode === 'push') {
        console.log(` [R2] Fetching remote inventory...`);
        const remoteInventory = await getBucketInventory(S3, env.R2_BUCKET_NAME);
        
        const files = getLocalFiles(LOCAL_ROOT);
        let uploadCount = 0;
        let skipCount = 0;

        for (const file of files) {
            const relativePath = path.relative(LOCAL_ROOT, file).replace(/\\/g, '/');
            const localSize = fs.statSync(file).size;
            const remoteFile = remoteInventory.get(relativePath);

            let shouldUpload = false;

            if (!remoteFile) {
                // File doesn't exist remote
                shouldUpload = true;
            } else if (remoteFile.size !== localSize) {
                // Sizes differ (Fastest check)
                shouldUpload = true;
            } else {
                // Sizes match, check ETag (Robustness check)
                // Note: If ETag has a dash (multipart upload), we skip hash check and trust size
                // to avoid re-uploading large videos unnecessarily.
                if (!remoteFile.etag.includes('-')) {
                    const localHash = getFileHash(file);
                    if (localHash !== remoteFile.etag) {
                        shouldUpload = true;
                    }
                }
            }

            if (!shouldUpload) {
                skipCount++;
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