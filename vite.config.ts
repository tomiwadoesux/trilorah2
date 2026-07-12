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
  'pdfkit',
  'qrcode',
  'tesseract.js',
  'whisper-node',
  'ws',
  /^node:/,
]

export default defineConfig({
  plugins: [
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
      },
    },
  },
})
