import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'forest-green': {
          DEFAULT: '#0B6B3A',
          dark: '#094F2B',
          light: '#1A8F4F',
        },
        'earth-gold': {
          DEFAULT: '#D4A574',
          dark: '#B88A50',
          light: '#E8C7A0',
        },
        'rust-orange': '#D2691E',
        cream: {
          DEFAULT: '#FAF9F6',
          dark: '#F0EDE5',
        },
        brand: {
          primary: '#0B6B3A',
          accent: '#D4A574',
          cream: '#FAF9F6',
        },
        primary: {
          DEFAULT: '#0B6B3A',
          foreground: '#FAF9F6',
        },
        accent: {
          DEFAULT: '#D4A574',
          foreground: '#FAF9F6',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
    },
  },
  plugins: [],
};

export default config;
