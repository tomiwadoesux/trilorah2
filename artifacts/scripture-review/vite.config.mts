import { defineConfig } from 'vite';
import { guideIndex } from '../../scripts/guideIndex';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ root: process.cwd(), plugins: [guideIndex(process.cwd()), react(), tailwindcss()], server: { host: '127.0.0.1', port: 5177, strictPort: true } });
