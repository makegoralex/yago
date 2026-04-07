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
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router-dom') || id.includes('/react/') || id.includes('/react-dom/')) {
              return 'react-vendor';
            }

            if (id.includes('recharts')) return 'charts';
            if (id.includes('/xlsx/')) return 'xlsx';
            if (id.includes('lucide-react')) return 'icons';
          }
          return undefined;
        },
      },
    },
  },
});
