import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    react(),
    legacy({ targets: ['safari >= 13', 'ios >= 13'] }),
  ],

  server: {
    port: 5173,
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2017',
  },
})
