# progressive-image

Two small pieces that solve one problem: **shipping fast, well-described images**.

| Package | What it does |
|---|---|
| [`@masrisystems/progressive-image-vue`](packages/vue) | Vue 3 component. Blur-up LQIP placeholder, cross-fade, CDN→origin retry, accessible error state. No CSS framework required. |
| [`@masrisystems/image-pipeline`](packages/cli) | Node CLI + library. WebP + JPEG variants, LQIP thumbnails, GPS/IPTC/EXIF geotagging, keyword-based SEO filenames, optional S3/R2 upload. |

They are usable independently, but they meet in one place: **the CLI generates exactly the thumbnails the component consumes.**

```
image-pipeline optimize hero.png -k "web design berlin"
   ├── public/images/acme-web-design-berlin.webp        ← :src
   ├── public/images/acme-web-design-berlin.jpg         ← social / GBP
   └── public/images/thumbnails/acme-...-berlin.webp    ← :thumbnail-src
```

```vue
<ProgressiveImage
  src="/images/acme-web-design-berlin.webp"
  thumbnail-src="/images/thumbnails/acme-web-design-berlin.webp"
  alt="Web design studio in Berlin"
  :width="1200" :height="675"
/>
```

## Why

**Progressive loading.** A 234-byte blurred placeholder paints immediately and cross-fades into the full image. The layout never shifts, because `width`/`height` reserve the box up front.

**Two formats, deliberately.** WebP is ~35–65% smaller and is what browsers should load. JPEG exists because **Google Business Profile, Apple Business Connect and several social schedulers reject WebP outright** — if you publish locally, you need both.

**Metadata is SEO.** Descriptive filenames, IPTC captions, and GPS coordinates are signals for image and local search. Doing this by hand across a few hundred images is not realistic; doing it at build time is.

## Install

```bash
npm install @masrisystems/progressive-image-vue
npm install -D @masrisystems/image-pipeline
```

The CLI needs Node 18+. `sharp` and `exiftool-vendored` come with it; `@aws-sdk/client-s3` is optional and only needed for `upload`.

## Quick start

```bash
npx image-pipeline init      # writes image-pipeline.config.js
npx image-pipeline doctor    # shows resolved config and any problems
npx image-pipeline optimize ./raw/office.png -k "web design berlin" -s services
```

## Configuration

Everything is driven by `image-pipeline.config.js`. See [the annotated example](packages/cli/image-pipeline.config.example.js).

> [!IMPORTANT]
> **Your config file will contain your street address, phone number and exact GPS coordinates**, and the pipeline embeds them into every image it processes. That is the point for local SEO — but anyone who downloads an image can read them back out.
>
> Decide deliberately what goes in, and add `image-pipeline.config.js` to `.gitignore` if your repository is public. This repo ships **no** location or identity of its own: with no config, geotagging and branding stay off and nothing personal is written.

## Commands

| Command | Purpose |
|---|---|
| `optimize <path>` | WebP + JPEG variants and an LQIP thumbnail |
| `thumbnails <path>` | Only the LQIP thumbnails |
| `upload [path]` | Mirror to S3-compatible storage (R2, S3, MinIO) |
| `name -k <keyword>` | Print the filename a keyword would produce |
| `init` | Write a config file into the current directory |
| `doctor` | Report resolved config and validate it |

Useful flags: `--dry-run` (write nothing), `--force` (overwrite existing outputs), `-c` (config path), `-o` (output directory).

## Filenames

`<prefix>-<segments>-<keyword>-<suffix>.<ext>`, slugified with German and Nordic transliteration:

```bash
$ image-pipeline name -k "Webdesign Größe & Qualität" -s services
acme-services-webdesign-groesse-qualitaet-berlin.webp
acme-services-webdesign-groesse-qualitaet-berlin.jpg
```

`ä ö ü ß å æ ø ð þ ł đ ı œ` transliterate rather than being stripped, so `Größe` becomes `groesse`, not `groe` or `grosse`. Repeated parts collapse, so a `prefix` already present in the keyword is not doubled.

## What lands in which format

Verified with ExifTool on real output:

| | WebP | JPEG | Thumbnail |
|---|:--:|:--:|:--:|
| GPS coordinates | ✅ | ✅ | — |
| City / country | ✅ | ✅ | — |
| Street (`Sub-location`) | via XMP `LocationShown` | ✅ | — |
| Creator / copyright | ✅ | ✅ | — |
| Title / description | ✅ | ✅ | — |
| Keywords | via XMP `Subject` | ✅ IPTC + XMP | — |

WebP cannot store IPTC IIM records, so keywords travel as XMP `dc:subject` — the field search engines actually read. Both are written; each container keeps what it supports.

Thumbnails are stripped on purpose: full IPTC/GPS on a 60px placeholder can exceed the image data itself, and it ships on every page load.

### Inherited metadata is cleared

Source images arrive carrying other people's metadata — a stock photo has its photographer's copyright, a client hand-off has their address, a previously branded asset has the old brand. Copying tags across a format change preserves all of it, so an image can silently end up claiming the wrong owner or the wrong location.

When you configure `brand` or `location`, the pipeline wipes the inherited identity and location fields before writing yours. The entire IPTC IIM block is cleared rather than a list of named tags: IIM uses different spellings from XMP/EXIF for the same concept (`By-line` vs `Creator`, `CopyrightNotice` vs `Rights`), and guessing that list is exactly how a previous owner's name survives. Everything needed is rewritten immediately after.

Set `preserveSourceMetadata: false` to skip the copy entirely and keep only what Sharp carries (ICC profile, orientation).

## Component reference

| Prop | Type | Default | Notes |
|---|---|---|---|
| `src` | `string` | — | Full-resolution image |
| `alt` | `string` | `''` | Empty string marks it decorative |
| `thumbnailSrc` | `string` | — | LQIP placeholder |
| `lazy` | `boolean` | `true` | Set `false` for your LCP image |
| `width` / `height` | `string \| number` | — | Supply both to prevent layout shift |
| `fit` | `'cover' \| 'contain' \| …` | `'cover'` | `object-fit` |
| `duration` | `number` | `500` | Cross-fade ms |
| `localFallback` | `boolean` | `true` | Retry a failed remote load against the origin path |
| `containerClass` / `imgClass` | `string` | `''` | Your classes |
| `errorText` | `string` | — | Defaults to `alt` |

Emits `load` and `error`.

### Theming

Plain CSS custom properties — no Tailwind or design system required:

```css
.my-gallery {
  --pi-placeholder-bg: #1e293b;
  --pi-thumb-blur: 16px;
  --pi-error-bg: #7f1d1d;
  --pi-error-fg: #fecaca;
}
```

`prefers-reduced-motion` is respected: the pulse stops and transitions collapse to 1ms, keeping the fade without the movement.

## Agent skill

[`skill/SKILL.md`](skill/SKILL.md) drives this pipeline from Claude Code, Codex, or Gemini CLI. Copy it into your agent's skills directory.

## Development

```bash
npm install
npm run build --workspaces
```

## License

Masri Systems Non-Commercial Source-Available License (MS-NC-1.1) — see [LICENSE](LICENSE). Personal and academic use only; business and commercial environments are prohibited without a separate commercial license (`hallo@masrisystems.com`).
