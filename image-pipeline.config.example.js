/**
 * image-pipeline configuration.
 *
 * Copy to `image-pipeline.config.js` and fill in your own values:
 *   npx image-pipeline init
 *
 * ⚠️  This file will contain your business address, phone number and precise
 *     GPS coordinates. Those are embedded into every image you process, which
 *     is the point for local SEO — but it also means anyone who downloads an
 *     image can read them. Publish only what you are happy to have public, and
 *     add `image-pipeline.config.js` to .gitignore if your repo is public.
 *
 * Every block is optional. Omit `location` and no GPS is written; omit `brand`
 * and no authorship is written. Defaults ship with both off.
 */
export default {
    // --- Paths -------------------------------------------------------------
    inputDir: 'public/images',
    outputDir: 'public/images',
    // Consumed by <ProgressiveImage :thumbnail-src="..."> as the blur-up placeholder.
    thumbnailDir: 'public/images/thumbnails',

    // --- Output formats ----------------------------------------------------
    formats: {
        // What the browser should load.
        webp: { enabled: true, quality: 85, effort: 6, width: 1200, height: 675, fit: 'cover' },
        // Keep enabled if you post to Google Business Profile, Apple Business
        // Connect, or social schedulers — several reject WebP outright.
        jpeg: { enabled: true, quality: 92, width: 1200, height: 675, fit: 'cover' },
    },

    // --- LQIP thumbnails ---------------------------------------------------
    // ~60px wide and blurred: a few hundred bytes that paint instantly and are
    // cross-faded out once the full image arrives.
    thumbnails: { enabled: true, width: 60, blur: 1.5, format: 'webp', quality: 60 },

    // --- Filename convention ----------------------------------------------
    // <prefix>-<segments>-<keyword>-<suffix>.<ext>
    // e.g. { prefix: 'acme', suffix: 'berlin' } + keyword "web design"
    //      + segment "services"  ->  acme-services-web-design-berlin.webp
    naming: {
        enabled: true,
        prefix: 'acme',
        suffix: 'berlin',
        separator: '-',
        lowercase: true,
        maxLength: 120,
    },

    // --- Geotagging (optional) --------------------------------------------
    // Signals locality to Google Images and local search. Set to null to skip.
    location: {
        latitude: 52.520008,      // decimal degrees, negative = south
        longitude: 13.404954,     // decimal degrees, negative = west
        altitude: 34,             // metres, optional
        street: 'Example Street 1',
        city: 'Berlin',
        region: 'Berlin',
        postalCode: '10115',
        country: 'Germany',
        countryCode: 'DE',
    },

    // --- Brand / authorship (optional) ------------------------------------
    // Written to IPTC creator, copyright and contact fields. Set to null to skip.
    brand: {
        name: 'Acme Studio',
        creator: 'Acme Studio',
        copyright: '© Acme Studio',
        url: 'https://example.com',
        email: 'hello@example.com',
        phone: '+49 30 000000',
        // Appended to every image's keyword list.
        keywords: ['web design', 'software development', 'berlin'],
    },

    // --- Upload (optional) -------------------------------------------------
    // Works with Cloudflare R2, AWS S3 and MinIO. Credentials are read from the
    // environment by name — never put secrets in this file.
    upload: {
        enabled: false,
        provider: 's3',
        bucket: 'my-bucket',
        prefix: 'images/',
        publicBaseUrl: 'https://cdn.example.com',
        endpoint: 'https://<account-id>.r2.cloudflarestorage.com',
        region: 'auto',
        accessKeyIdEnv: 'S3_ACCESS_KEY_ID',
        secretAccessKeyEnv: 'S3_SECRET_ACCESS_KEY',
    },
};
