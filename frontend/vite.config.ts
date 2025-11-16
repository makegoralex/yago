import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: [
        'defaults',
        'iOS >= 10',
        'Safari >= 10'
      ],
      modernPolyfills: true,   // включает Intl частично
      additionalLegacyPolyfills: [
        'regenerator-runtime/runtime',  // нужен React
      ],
      renderLegacyChunks: true,
    }),
  ],

  build: {
    target: 'es2015',
    sourcemap: false,
  },

  // Подгрузим Intl вручную
  define: {
    'process.env': {},
  },
});
