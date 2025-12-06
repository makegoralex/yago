import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7C3AED',
          light: '#8B5CF6',
          dark: '#6D28D9',
        },
        secondary: '#6D28D9',
        info: '#475569',
        danger: '#EF4444',
        border: '#E2E8F0',
        background: '#F6F7FB',
        card: '#FFFFFF',
        text: '#0F172A',
        nav: '#475569',
        navHover: '#0F172A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 25px 70px rgba(0, 0, 0, 0.35)',
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
