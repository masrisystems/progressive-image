import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { buildFilename } from './naming.mjs';
import { buildMetadata, clearInheritedMetadata, copyMetadata, writeMetadata } from './metadata.mjs';

const SOURCE_PATTERN = /\.(jpe?g|png|tiff?|webp|avif)$/i;

export function findImages(target, { recursive = true } = {}) {
    const full = path.resolve(target);
    if (!fs.existsSync(full)) return [];

    if (fs.statSync(full).isFile()) {
        return SOURCE_PATTERN.test(full) ? [full] : [];
    }

    const out = [];
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
        const entryPath = path.join(full, entry.name);
        if (entry.isDirectory()) {
            // Never recurse into the thumbnail output, or each run re-shrinks its own output.
            if (recursive && entry.name !== 'thumbnails') out.push(...findImages(entryPath, { recursive }));
        } else if (SOURCE_PATTERN.test(entry.name)) {
            out.push(entryPath);
        }
    }
    return out;
}

function resizeOptions(spec) {
    if (!spec.width && !spec.height) return null;
    return {
        width: spec.width,
        height: spec.height,
        fit: spec.fit || 'cover',
        withoutEnlargement: true,
    };
}

async function renderVariant(sourcePath, targetPath, format, spec) {
    let pipeline = sharp(sourcePath).withMetadata();

    const resize = resizeOptions(spec);
    if (resize) pipeline = pipeline.resize(resize);

    pipeline =
        format === 'webp'
            ? pipeline.webp({ quality: spec.quality ?? 85, effort: spec.effort ?? 6 })
            : pipeline.jpeg({ quality: spec.quality ?? 92, mozjpeg: true });

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await pipeline.toFile(targetPath);
}

async function renderThumbnail(sourcePath, targetPath, spec) {
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

    let pipeline = sharp(sourcePath).resize({ width: spec.width ?? 60, withoutEnlargement: true });
    if (spec.blur) pipeline = pipeline.blur(spec.blur);

    // Strip metadata: a 60px placeholder carrying full IPTC/GPS can be larger
    // than the pixels it describes, and it is served on every page load.
    pipeline =
        (spec.format ?? 'webp') === 'webp'
            ? pipeline.webp({ quality: spec.quality ?? 60 })
            : pipeline.jpeg({ quality: spec.quality ?? 60, mozjpeg: true });

    await pipeline.toFile(targetPath);
}

const kb = (bytes) => Number((bytes / 1024).toFixed(1));

/**
 * Process one source image into its configured derivatives.
 *
 * @returns {Promise<{source: string, outputs: Array, skipped: boolean}>}
 */
export async function processImage(sourcePath, options) {
    const {
        config,
        exiftool,
        keyword,
        segments = [],
        title,
        description,
        keywords = [],
        outputDir,
        dryRun = false,
        force = false,
    } = options;

    const destDir = path.resolve(outputDir || config.outputDir);
    const sourceExt = path.extname(sourcePath);

    const stem = config.naming?.enabled && keyword
        ? buildFilename({ keyword, segments, extension: '', config: config.naming })
        : path.basename(sourcePath, sourceExt);

    const tags = buildMetadata({
        config,
        title: title ?? keyword ?? stem,
        description: description ?? title ?? keyword ?? stem,
        keywords: keywords.length ? keywords : keyword ? [keyword] : [],
    });

    const outputs = [];
    const variants = [
        ['webp', config.formats?.webp],
        ['jpeg', config.formats?.jpeg],
    ];

    for (const [format, spec] of variants) {
        if (!spec?.enabled) continue;

        const ext = format === 'jpeg' ? 'jpg' : format;
        const targetPath = path.join(destDir, `${stem}.${ext}`);

        if (!force && fs.existsSync(targetPath) && path.resolve(targetPath) !== path.resolve(sourcePath)) {
            outputs.push({ format, path: targetPath, skipped: true, reason: 'exists' });
            continue;
        }

        if (dryRun) {
            outputs.push({ format, path: targetPath, dryRun: true });
            continue;
        }

        await renderVariant(sourcePath, targetPath, format, spec);

        // Sharp's withMetadata() preserves much but not all; ExifTool guarantees
        // the full tag set survives the format change.
        if (config.preserveSourceMetadata !== false) {
            await copyMetadata(exiftool, sourcePath, targetPath).catch(() => {});
        }
        // That copy also brings the source's ownership and location. Clear those
        // before stamping ours, or a stock photo keeps its photographer's
        // copyright and a client's image keeps their address.
        await clearInheritedMetadata(exiftool, targetPath, config).catch(() => {});
        await writeMetadata(exiftool, targetPath, tags);

        outputs.push({
            format,
            path: targetPath,
            sourceKb: kb(fs.statSync(sourcePath).size),
            outputKb: kb(fs.statSync(targetPath).size),
        });
    }

    if (config.thumbnails?.enabled) {
        const thumbExt = config.thumbnails.format === 'jpeg' ? 'jpg' : (config.thumbnails.format ?? 'webp');
        const thumbPath = path.join(path.resolve(config.thumbnailDir), `${stem}.${thumbExt}`);

        if (dryRun) {
            outputs.push({ format: 'thumbnail', path: thumbPath, dryRun: true });
        } else if (force || !fs.existsSync(thumbPath)) {
            await renderThumbnail(sourcePath, thumbPath, config.thumbnails);
            outputs.push({ format: 'thumbnail', path: thumbPath, outputKb: kb(fs.statSync(thumbPath).size) });
        } else {
            outputs.push({ format: 'thumbnail', path: thumbPath, skipped: true, reason: 'exists' });
        }
    }

    return { source: sourcePath, outputs, skipped: outputs.every((o) => o.skipped) };
}
