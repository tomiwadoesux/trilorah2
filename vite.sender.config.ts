import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

// Trilorah Sender's window (sender.html → src/sender/SenderBar.tsx), on its
// own: the separate small app's renderer. scripts/build-sender.mjs runs this
// and then builds electron/sender/main.ts + preload.ts next to it.
//
// Deliberately no vite-plugin-electron here: a plain `vite` with that plugin
// starts `electron .`, which is the main app on the owner's real data.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The packaged window loads this from file://, so every path is relative.
  base: './',
  // public/ is the main app's (remote page, icon studies); the font licence is copied by the build script.
  publicDir: false,
  build: {
    outDir: 'dist-sender/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: { sender: resolve(__dirname, 'sender.html') },
    },
  },
})
