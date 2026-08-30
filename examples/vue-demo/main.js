import { createApp, h } from 'vue';
import { ProgressiveImage } from '../../packages/vue/src/index.ts';

createApp({
  render: () => h('div', { class: 'grid' }, [
    h(ProgressiveImage, { src: '/images/demo.webp', thumbnailSrc: '/images/thumbnails/demo.webp',
      alt: 'Studio photo with LQIP placeholder', containerClass: 'card', lazy: false, width: 1200, height: 675 }),
    h(ProgressiveImage, { src: '/images/does-not-exist.webp', alt: 'Broken image example',
      containerClass: 'card', localFallback: false }),
    h(ProgressiveImage, { src: '/images/demo.webp', alt: 'No thumbnail supplied',
      containerClass: 'card', width: 1200, height: 675 }),
  ]),
}).mount('#app');
