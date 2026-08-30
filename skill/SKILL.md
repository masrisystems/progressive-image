---
name: image-pipeline
description: "Optimizes, renames, geotags and publishes images for web and local SEO. Produces a WebP for the site, a JPG for Google Business Profile and social (which reject WebP), and a tiny blurred LQIP thumbnail for progressive loading. Embeds GPS coordinates and IPTC/EXIF authorship from the project's own config. Activates when the user says optimize image, tag image, geotag, convert to webp, image seo, prepare image for blog/GBP/social, or supplies an image to publish."
license: MIT
metadata:
  author: "Masri Systems"
  version: "0.1.0"
---

# Image Pipeline Skill

Drives [`@masrisystems/image-pipeline`](https://github.com/masrisystems/progressive-image). Every value that identifies a business or a place comes from the **project's** `image-pipeline.config.js` — never from this file, and never from memory.

## When to activate

`optimize image` · `tag image` · `geotag` · `convert to webp` · `image seo` · or the user hands over an image to prepare for a blog post, Google Business Profile, or social.

## Before doing anything

```bash
npx image-pipeline doctor
```

This prints the resolved config and validates it. Read the output before processing:

- **"Geotagging: off"** — no location configured. Do **not** invent coordinates. Ask the user, or proceed without geotagging and say so.
- **"Branding: off"** — same for authorship. Never substitute a brand name from another project or from memory.
- **No config found** — run `npx image-pipeline init`, then ask the user to fill it in. Do not fill it in for them from guesswork.

If the command is missing, install it: `npm install -D @masrisystems/image-pipeline`.

## The one-liner

```bash
npx image-pipeline optimize <path> \
  -k "<primary keyword>" \
  -s <section> \
  -t "<short title>" \
  -d "<descriptive alt text>" \
  --keywords "<kw1>,<kw2>"
```

Produces three files:

| Output | Purpose |
|---|---|
| `<name>.webp` | The website. Reference this in blog bodies and `<img>` tags. |
| `<name>.jpg` | Google Business Profile, Apple Business Connect, social CSVs. |
| `thumbnails/<name>.webp` | The `thumbnailSrc` for a progressive image component. |

## Rules

**GBP rejects WebP.** Anything going to Google Business Profile, Apple Business Connect, or a social scheduler must be the `.jpg`. Handing over a `.webp` fails at upload time. The website gets the `.webp`.

**One copy per file.** Write each output exactly once, to the configured `outputDir`. Copying the same image into a second directory "so it is also available there" is how duplicate trees start — and how assets end up published under a prefix that consumers do not read.

**Inherited metadata is cleared automatically.** When the config supplies `brand` or `location`, the pipeline wipes the source image's own copyright, creator and location first. This matters for stock photos and client hand-offs — without it the output keeps the previous owner's name and address.

**Never invent metadata.** Coordinates, addresses, phone numbers and brand names come from the config. If it is not configured, it does not get written. A wrong geotag is worse than none: it puts a real business at a location it is not.

**Alt text is not optional.** `-d` becomes the IPTC description and should read as real alt text — what is in the image, containing the keyword naturally. Not a keyword list.

**Check the filename before committing to it.** `image-pipeline name -k "…"` prints what a keyword produces without touching any files.

## Publishing

Only if `upload.enabled` is true in the config:

```bash
npx image-pipeline upload
```

Then verify before handing the URL to anything else:

```bash
curl -sI <url>    # expect 200 and content-type: image/webp or image/jpeg
```

A URL that has not been verified should not go into a blog post or a CSV. A broken image in a scheduled social post is discovered by the audience, not by you.

## Using the result

```vue
<ProgressiveImage
  src="/images/<name>.webp"
  thumbnail-src="/images/thumbnails/<name>.webp"
  alt="<the same descriptive text>"
  :width="1200" :height="675"
/>
```

For a hero or any above-the-fold image add `:lazy="false"` — lazy-loading the LCP element delays it.

In markdown, use standard image syntax with the full URL:

```markdown
![Descriptive alt text](https://cdn.example.com/images/<name>.webp)
```

Never use Obsidian embed syntax (`![[...]]`) for a remote URL — it resolves against vault files only and renders as a broken wikilink, not an image.

## Flags worth knowing

| Flag | Use |
|---|---|
| `--dry-run` | Show what would be written, touch nothing. Use when unsure. |
| `--force` | Overwrite existing outputs. Needed when regenerating under the same name. |
| `-c <path>` | Non-default config location. |
| `-o <dir>` | Override the output directory for one run. |

Without `--force`, existing files are skipped. If a previous run failed midway it may have left a partial output that a later run then skips — rerun with `--force` if results look stale.
