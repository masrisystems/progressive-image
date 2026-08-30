# Examples

## Vue + Vite

```vue
<script setup>
import { ProgressiveImage } from '@masrisystems/progressive-image-vue';

const photos = [
  { src: '/images/office.webp', thumb: '/images/thumbnails/office.webp', alt: 'Our studio' },
  { src: '/images/team.webp',   thumb: '/images/thumbnails/team.webp',   alt: 'The team at work' },
];
</script>

<template>
  <div class="gallery">
    <ProgressiveImage
      v-for="(p, i) in photos"
      :key="p.src"
      :src="p.src"
      :thumbnail-src="p.thumb"
      :alt="p.alt"
      :lazy="i > 0"
      :width="1200"
      :height="675"
      container-class="card"
    />
  </div>
</template>

<style>
.gallery { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); }
.card { aspect-ratio: 16 / 9; border-radius: 0.75rem; --pi-placeholder-bg: #eef2f7; }
@media (prefers-color-scheme: dark) { .card { --pi-placeholder-bg: #1e293b; } }
</style>
```

`:lazy="i > 0"` loads the first image eagerly — lazy-loading your LCP element delays it.

## Batch a directory

```bash
npx image-pipeline optimize ./public/images --dry-run   # preview
npx image-pipeline optimize ./public/images             # run
```

`--keyword` renames a single image, so it is rejected when the path matches more than one file. Batch runs keep existing filenames and only add formats and thumbnails.

## Programmatic use

```js
import { findImages, processImage, loadConfig } from '@masrisystems/image-pipeline';
import { exiftool } from 'exiftool-vendored';

const { config } = await loadConfig();
for (const file of findImages('./raw')) {
  await processImage(file, { config, exiftool });
}
await exiftool.end();   // otherwise a stayopen child process lingers
```
