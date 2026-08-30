import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// Imports the component from source, so the demo runs on a fresh clone
// without building the package first.
export default defineConfig({ plugins: [vue()] });
