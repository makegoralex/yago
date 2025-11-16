import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    react(),

    // Полный набор для старых браузеров + iOS 10 + Safari 10
    legacy({
      targets: [
        'defaults',
        'Chrome >= 49',
        'iOS >= 10',
        'Safari >= 10'
      ],
      modernPolyfills: true,

      // Критично: добавляет Intl и другие полифиллы,
      // без которых ломается toLocaleString
      additionalLegacyPolyfills: [
        'regenerator-runtime/runtime',
        'core-js/stable',
        'core-js/features/intl',
        'core-js/features/array/includes',
        'core-js/features/object/assign'
      ],

      renderLegacyChunks: true,
    }),
  ],

  build: {
    target: 'es2015',   // обязательно
    sourcemap: false,
  },

  server: {
    port: 5173,
  },
});
