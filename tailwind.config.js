/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ── Shadcn / existing tokens (kept for admin pages) ───────────────────
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ── FFIS brand palette ─────────────────────────────────────────────
        navy: {
          900: '#0B1B2E',
          800: '#122A45',
          700: '#1A2D45',
          600: '#243E5C',
          500: '#34557A',
        },
        teal: {
          700: '#007D6E',
          600: '#009B89',
          500: '#00B09C',
          200: '#9FE6DC',
          100: '#DFF5F2',
          50:  '#EEF9F7',
        },
        gold: {
          600: '#B97300',
          500: '#D98A00',
          200: '#F5D38A',
          100: '#FEF3DC',
        },
        // RAG semantics (use as rag-green-500, rag-amber-100, etc.)
        rag: {
          'green-700': '#15784D',
          'green-500': '#1FA567',
          'green-100': '#DDF3E5',
          'amber-700': '#A36500',
          'amber-500': '#E59500',
          'amber-100': '#FCEED0',
          'red-700':   '#B0322B',
          'red-500':   '#D74A40',
          'red-100':   '#FBE3E0',
        },
        ink: {
          900: '#0E1B2C',
          700: '#1A2D45',
          600: '#2F4865',
          500: '#4A6480',
          400: '#7A95AE',
          300: '#A6BAC9',
          200: '#C9D4DE',
          100: '#DEE6ED',
        },
        paper: {
          DEFAULT: '#F4F7FA',
          2: '#EEF2F6',
        },
        line: {
          DEFAULT: '#D9E2EA',
          soft: '#E7EDF2',
        },
      },

      // ── Typography ─────────────────────────────────────────────────────────
      fontFamily: {
        sans: ['Barlow', 'system-ui', '-apple-system', 'sans-serif'],
        cond: ['Barlow Condensed', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'ui-monospace', 'monospace'],
      },

      // ── Border radii ───────────────────────────────────────────────────────
      borderRadius: {
        sm:  '6px',
        md:  '10px',
        lg:  '14px',
        xl:  '20px',
        // keep shadcn alias for backward-compat
        DEFAULT: 'var(--radius)',
      },

      // ── Shadows ────────────────────────────────────────────────────────────
      boxShadow: {
        'sh-sm': '0 1px 0 rgba(11,27,46,0.04), 0 1px 2px rgba(11,27,46,0.05)',
        'sh-md': '0 1px 0 rgba(11,27,46,0.04), 0 4px 14px rgba(11,27,46,0.06)',
        'sh-lg': '0 2px 0 rgba(11,27,46,0.04), 0 18px 40px -10px rgba(11,27,46,0.18)',
      },
    },
  },
  plugins: [],
}
