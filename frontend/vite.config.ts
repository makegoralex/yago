import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'iOS >= 10', 'Safari >= 10'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      modernPolyfills: true,
    }),
  ],
  server: {
    port: 5173,
  },
  build: {
    target: 'es2015',
  },
});
