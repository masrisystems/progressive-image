import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Inline the extracted CSS into the JS bundle.
 *
 * Without this the component ships a separate style.css that consumers have to
 * remember to import — install it, use it, and it renders unstyled. At ~1.8 kB
 * the stylesheet is small enough that injecting it on import is the better
 * trade: the component is genuinely drop-in.
 *
 * Injection is guarded for SSR (no `document`) and de-duplicated by id, so
 * importing the package more than once still yields a single <style>.
 */
function inlineCss(): Plugin {
    return {
        name: 'inline-css',
        enforce: 'post',
        generateBundle(_options, bundle) {
            let css = '';
            for (const [fileName, chunk] of Object.entries(bundle)) {
                if (chunk.type === 'asset' && fileName.endsWith('.css')) {
                    css += chunk.source;
                    delete bundle[fileName];
                }
            }
            if (!css) return;

            for (const chunk of Object.values(bundle)) {
                if (chunk.type === 'chunk' && chunk.isEntry) {
                    chunk.code =
                        `(function(){try{if(typeof document==="undefined")return;` +
                        `var id="progressive-image-vue";if(document.getElementById(id))return;` +
                        `var s=document.createElement("style");s.id=id;` +
                        `s.textContent=${JSON.stringify(css)};` +
                        `document.head.appendChild(s)}catch(e){}})();\n` +
                        chunk.code;
                    break;
                }
            }
        },
    };
}

export default defineConfig({
    plugins: [vue(), inlineCss()],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'ProgressiveImageVue',
            formats: ['es'],
            fileName: () => 'progressive-image-vue.js',
        },
        // Vue stays external so the host app supplies the single runtime copy.
        rollupOptions: { external: ['vue'], output: { globals: { vue: 'Vue' } } },
        cssCodeSplit: false,
    },
});
