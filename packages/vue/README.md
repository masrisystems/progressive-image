# @masrisystems/progressive-image-vue

Vue 3 progressive image component: blur-up LQIP placeholder, cross-fade, CDN→origin retry, accessible error state. No CSS framework required.

```bash
npm install @masrisystems/progressive-image-vue
```

```vue
<script setup>
import { ProgressiveImage } from '@masrisystems/progressive-image-vue';
</script>

<template>
  <ProgressiveImage
    src="/images/office.webp"
    thumbnail-src="/images/thumbnails/office.webp"
    alt="Our studio in Berlin"
    :width="1200" :height="675"
  />
</template>
```

Generate the matching thumbnail with [`@masrisystems/image-pipeline`](../cli).

Full prop table, theming variables and behaviour notes: [repository README](../../README.md).

MIT
