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
        // Color roles (not just hex — the ROLE each color plays):
        // indigo: structural/trust — navigation, hero cards, primary chrome
        // ochre:  single sparing accent — ONE primary action/highlight per screen
        // loam:   everyday positive/growth — positive amounts, success, secondary buttons
        // clay:   negative amounts and alerts
        // parchment/paper: neutral backgrounds — money always sits on these
        // ink:    text colors

        indigo: {
          DEFAULT: '#1B5E20',
          deep: '#123D15',
          light: '#2E7D32',
        },
        ochre: {
          DEFAULT: '#BBDC12',
          light: '#D4F042',
          dim: '#9CB810',
        },
        loam: {
          DEFAULT: '#3E8E2F',
          light: '#5BAD4A',
          dim: '#2D6B22',
        },
        clay: {
          DEFAULT: '#B23A2E',
          light: '#D55648',
          dim: '#8A2D24',
        },
        parchment: '#F5F1E8',
        paper: '#FFFEF9',
        ink: {
          DEFAULT: '#1C1B17',
          soft: '#6B6B5F',
        },
        track: '#E8E4D9',

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
        xl: '1.25rem',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-ibm-plex-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
