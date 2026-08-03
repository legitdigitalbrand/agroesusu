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
        // ─── Agriqcap Design System ─────────────────────────────
        // All values must match the mockup tokens EXACTLY.
        // loam-light, ochre-light, clay-light, indigo-deep, line are
        // used throughout — they must be defined here.

        indigo: {
          DEFAULT: '#1B5E20',
          deep: '#123D15',
          light: '#2E7D32',
        },
        ochre: {
          DEFAULT: '#BBDC12',
          light: '#EEF6C4',   // very pale ochre — chip backgrounds
          dim: '#9CB810',
        },
        loam: {
          DEFAULT: '#3E8E2F',
          light: '#DCEEDC',   // pale loam — icon bg, success tint
          dim: '#2D6B22',
        },
        clay: {
          DEFAULT: '#B23A2E',
          light: '#F3DCD8',   // pale clay — error tint
          dim: '#8A2D24',
        },
        parchment: '#E8F5E9', // lightest green-tinted bg
        paper: '#FBFDF9',     // near-white surface
        ink: {
          DEFAULT: '#1A2417', // very dark green-black — high contrast
          soft: '#4A5A44',    // mid-tone muted text — darkened for WCAG AA on small text
        },
        track: '#D9E9D2',     // progress ring track, subtle dividers
        line: '#D6E8D2',      // border/separator

        // shadcn/ui CSS variable mappings (kept for compatibility)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontSize: {
        'xs': ['13px', { lineHeight: '1.4' }],
        'sm': ['15px', { lineHeight: '1.5' }],
        'base': ['16px', { lineHeight: '1.6' }],
        'lg': ['18px', { lineHeight: '1.6' }],
        'xl': ['22px', { lineHeight: '1.4' }],
        '2xl': ['26px', { lineHeight: '1.3' }],
        '3xl': ['30px', { lineHeight: '1.2' }],
      },
      fontFamily: {
        display: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-ibm-plex-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
