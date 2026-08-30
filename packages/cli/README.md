# @masrisystems/image-pipeline

Config-driven image pipeline: WebP + JPEG variants, LQIP thumbnails, GPS/IPTC/EXIF geotagging, keyword-based SEO filenames, optional S3/R2 upload.

```bash
npm install -D @masrisystems/image-pipeline
npx image-pipeline init
npx image-pipeline doctor
npx image-pipeline optimize ./raw/office.png -k "web design berlin"
```

> **Your config file will hold your address, phone number and GPS coordinates**, and they are embedded into every processed image. Add `image-pipeline.config.js` to `.gitignore` if your repo is public. With no config, geotagging and branding stay off.

Requires Node 18+. `@aws-sdk/client-s3` is an optional peer dependency, needed only for `upload`.

Full documentation: [repository README](../../README.md).

MIT
