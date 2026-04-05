import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

const buildMarker = process.env.VITE_BUILD_MARKER ?? new Date().toISOString();

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'Safari >= 13', 'iOS >= 13'],
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
  ],

  define: {
    __APP_BUILD__: JSON.stringify(buildMarker),
  },

  server: {
    port: 5173,
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2017',
  },
});
