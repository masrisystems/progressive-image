import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CONFIG_NAMES = [
    'image-pipeline.config.js',
    'image-pipeline.config.mjs',
    'image-pipeline.config.json',
];

/**
 * Defaults are deliberately brand-free and location-free.
 *
 * Nothing here identifies a person or a place. Geotagging and IPTC authorship
 * stay off until a project supplies its own `brand` and `location` blocks, so
 * this package can never stamp someone else's address onto your images.
 */
export const DEFAULT_CONFIG = {
    // Where source images are read from and derivatives are written to.
    inputDir: 'public/images',
    outputDir: 'public/images',
    thumbnailDir: 'public/images/thumbnails',

    formats: {
        // The web-facing format. Smaller, and what a progressive <img> should load.
        webp: { enabled: true, quality: 85, effort: 6, width: 1200, height: 675, fit: 'cover' },
        // Kept because Google Business Profile and several social APIs reject WebP.
        jpeg: { enabled: true, quality: 92, width: 1200, height: 675, fit: 'cover' },
    },

    // Low-quality image placeholder consumed by the ProgressiveImage component.
    thumbnails: { enabled: true, width: 60, blur: 1.5, format: 'webp', quality: 60 },

    // Carry technical tags across the format change. Ownership and location from
    // the source are always cleared when this project supplies its own.
    preserveSourceMetadata: true,

    // Filename convention: <prefix>-<segment>-<keyword>-<suffix>.<ext>
    naming: { enabled: true, prefix: '', suffix: '', separator: '-', lowercase: true, maxLength: 120 },

    // Off until configured. See image-pipeline.config.example.js.
    location: null,
    brand: null,

    // Optional S3-compatible upload (Cloudflare R2, S3, MinIO). Credentials come
    // from the environment, never from this file.
    upload: {
        enabled: false,
        provider: 's3',
        bucket: '',
        prefix: 'images/',
        publicBaseUrl: '',
        endpoint: '',
        region: 'auto',
        // env var NAMES, not values
        accessKeyIdEnv: 'S3_ACCESS_KEY_ID',
        secretAccessKeyEnv: 'S3_SECRET_ACCESS_KEY',
    },
};

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Deep merge that lets a config null out a whole block (e.g. `location: null`). */
export function mergeConfig(base, override) {
    if (override === null) return null;
    if (!isPlainObject(override)) return override ?? base;

    const out = { ...base };
    for (const [key, value] of Object.entries(override)) {
        out[key] = isPlainObject(base?.[key]) ? mergeConfig(base[key], value) : value;
    }
    return out;
}

export async function loadConfig({ cwd = process.cwd(), configPath } = {}) {
    const candidates = configPath
        ? [path.resolve(cwd, configPath)]
        : CONFIG_NAMES.map((name) => path.join(cwd, name));

    for (const candidate of candidates) {
        if (!fs.existsSync(candidate)) continue;

        const loaded = candidate.endsWith('.json')
            ? JSON.parse(fs.readFileSync(candidate, 'utf8'))
            : (await import(pathToFileURL(candidate).href)).default;

        return { config: mergeConfig(DEFAULT_CONFIG, loaded), configPath: candidate };
    }

    if (configPath) throw new Error(`Config file not found: ${candidates[0]}`);
    return { config: DEFAULT_CONFIG, configPath: null };
}

/**
 * Surface misconfiguration before ExifTool writes anything, since a half-applied
 * metadata pass is worse than a refused one.
 */
export function validateConfig(config) {
    const errors = [];
    const { location, brand, upload } = config;

    if (location) {
        const { latitude, longitude } = location;
        if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
            errors.push('location.latitude must be a number between -90 and 90.');
        }
        if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
            errors.push('location.longitude must be a number between -180 and 180.');
        }
    }

    if (brand && !brand.name) errors.push('brand.name is required when brand is set.');

    if (upload?.enabled) {
        if (!upload.bucket) errors.push('upload.bucket is required when upload.enabled is true.');
        for (const key of ['accessKeyIdEnv', 'secretAccessKeyEnv']) {
            const envName = upload[key];
            if (!envName) errors.push(`upload.${key} is required when upload.enabled is true.`);
            else if (!process.env[envName]) errors.push(`Environment variable ${envName} is not set.`);
        }
    }

    return errors;
}
