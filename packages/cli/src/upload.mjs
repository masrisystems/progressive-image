import fs from 'node:fs';
import path from 'node:path';

/**
 * Optional S3-compatible upload (Cloudflare R2, AWS S3, MinIO).
 *
 * @aws-sdk/client-s3 is an optional peer dependency: projects that only want
 * local optimization should not have to install it.
 */

const MIME_TYPES = {
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
};

export function contentTypeFor(filePath) {
    return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

async function loadS3() {
    try {
        return await import('@aws-sdk/client-s3');
    } catch {
        throw new Error(
            'Uploading needs @aws-sdk/client-s3. Install it:\n  npm install @aws-sdk/client-s3',
        );
    }
}

export async function createClient(upload) {
    const { S3Client } = await loadS3();
    return new S3Client({
        region: upload.region || 'auto',
        endpoint: upload.endpoint || undefined,
        credentials: {
            accessKeyId: process.env[upload.accessKeyIdEnv],
            secretAccessKey: process.env[upload.secretAccessKeyEnv],
        },
    });
}

async function exists(client, bucket, key) {
    const { HeadObjectCommand } = await loadS3();
    try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
    } catch {
        return false;
    }
}

/**
 * Mirror `files` into the bucket, preserving their path relative to `baseDir`.
 * Skips objects already present unless `force` is set.
 */
export async function uploadFiles(files, { config, baseDir, force = false, dryRun = false, onProgress } = {}) {
    const { upload } = config;
    const { PutObjectCommand } = await loadS3();
    const client = await createClient(upload);

    const prefix = upload.prefix ? upload.prefix.replace(/\/*$/, '/') : '';
    const results = { uploaded: [], skipped: [], failed: [] };

    for (const file of files) {
        const relative = path.relative(path.resolve(baseDir), path.resolve(file)).split(path.sep).join('/');
        const key = `${prefix}${relative}`;
        const url = upload.publicBaseUrl ? `${upload.publicBaseUrl.replace(/\/$/, '')}/${key}` : null;

        try {
            if (dryRun) {
                results.uploaded.push({ file, key, url, dryRun: true });
            } else if (!force && (await exists(client, upload.bucket, key))) {
                results.skipped.push({ file, key, url });
            } else {
                await client.send(
                    new PutObjectCommand({
                        Bucket: upload.bucket,
                        Key: key,
                        Body: fs.createReadStream(file),
                        ContentType: contentTypeFor(file),
                    }),
                );
                results.uploaded.push({ file, key, url });
            }
        } catch (error) {
            results.failed.push({ file, key, error: error.message });
        }

        onProgress?.(results);
    }

    return results;
}
