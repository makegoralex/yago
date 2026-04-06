import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

const buildMarker = process.env.VITE_BUILD_MARKER ?? new Date().toISOString();

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'Safari >= 13', 'iOS >= 13'],
      modernPolyfills: false,
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

          if (id.includes('/src/pages/Admin') || id.includes('/src/pages/SuperAdmin') || id.includes('/src/components/admin')) {
            return 'admin';
          }

          if (id.includes('/src/pages/Blog') || id.includes('/src/pages/News') || id.includes('/src/pages/Docs')) {
            return 'blog-news';
          }

          if (
            id.includes('/src/pages/POS') ||
            id.includes('/src/store/order') ||
            id.includes('/src/store/catalog') ||
            id.includes('/src/components/ui/OrderPanel')
          ) {
            return 'pos-core';
          }

          if (id.includes('/src/pages/Landing') || id.includes('/src/components/ui/LandingHeader')) {
            return 'landing';
          }

          return undefined;
        },
      },
    },
  },
});
