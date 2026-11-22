import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Trilorah Stage Timer's window (timerapp.html → src/timerapp), on its own:
// the separate small app's renderer. scripts/build-timerapp.mjs runs this and
// then builds electron/timerapp/main.ts + preload.ts next to it.
//
// Deliberately no vite-plugin-electron here: a plain `vite` with that plugin
// starts `electron .`, which is the main app on the owner's real data.
export default defineConfig({
  plugins: [react()],
  // The packaged window loads this from file://, so every path is relative.
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist-timerapp/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: { timerapp: resolve(__dirname, 'timerapp.html') },
    },
  },
})
