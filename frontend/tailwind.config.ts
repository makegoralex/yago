import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#22C55E',
          light: '#34D399',
          dark: '#16A34A',
        },
        secondary: '#3B82F6',
        info: '#3B82F6',
        danger: '#EF4444',
        border: '#E5E7EB',
        background: '#F9FAFB',
        card: '#FFFFFF',
        text: '#111827',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 4px rgba(0, 0, 0, 0.04)',
      },
    },
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
  },
  plugins: [],
};

export default config;
