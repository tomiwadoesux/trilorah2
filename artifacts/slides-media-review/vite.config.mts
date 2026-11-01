import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { guideIndex } from '../../scripts/guideIndex';

export default defineConfig({
  root: process.cwd(),
  plugins: [guideIndex(process.cwd()), react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5185, strictPort: true },
});
