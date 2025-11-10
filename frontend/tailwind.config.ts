import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#10B981',
          light: '#34D399',
          dark: '#059669',
        },
        secondary: '#3B82F6',
      },
      fontFamily: {
        sans: ['"SF Pro Display"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0px 8px 24px rgba(15, 23, 42, 0.08)',
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
