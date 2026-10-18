import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { guideIndex } from './scripts/guideIndex';

// Browser-only specimen build: no Electron main process or preload bridge.
export default defineConfig({
  base: '/brand/component-preview/',
  publicDir: false,
  plugins: [guideIndex(__dirname), react(), tailwindcss()],
  build: {
    outDir: 'web/public/brand/component-preview',
    emptyOutDir: true,
    rollupOptions: { input: resolve(__dirname, 'brand-components.html') },
    chunkSizeWarningLimit: 1800,
  },
});
