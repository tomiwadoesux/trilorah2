import { guideIndex } from './scripts/guideIndex'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import { resolve } from 'node:path'

// Native modules and heavy SDKs stay external — they resolve from
// node_modules at runtime (electron-builder packs them).
const external = [
  'electron',
  '@deepgram/sdk',
  '@supabase/supabase-js',
  'better-sqlite3',
  'dotenv',
  'electron-store',
  'obs-websocket-js',
  'onnxruntime-node',
  'pdfkit',
  'qrcode',
  'tesseract.js',
  'whisper-node',
  'ws',
  'yauzl',
  // optional on-device notes model — installed only by user opt-in,
  // imported lazily behind try/catch in notesProvider.ts
  '@xenova/transformers',
  /^node:/,
]

export default defineConfig({
  plugins: [
    guideIndex(__dirname),
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { external },
          },
        },
      },
      preload: {
        input: resolve(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { external },
          },
        },
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        output: resolve(__dirname, 'output.html'),
        // The design sandbox — createDesignWindow() loads dist/design.html
        // in production, so it has to be emitted alongside the app.
        design: resolve(__dirname, 'design.html'),
        emptyPreview: resolve(__dirname, 'empty-preview.html'),
      },
    },
  },
})
