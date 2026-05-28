/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── shadcn tokens (unchanged structure; see index.css for HSL values) ──
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary:     { DEFAULT: "hsl(var(--primary))",     foreground: "hsl(var(--primary-foreground))" },
        secondary:   { DEFAULT: "hsl(var(--secondary))",   foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted:       { DEFAULT: "hsl(var(--muted))",       foreground: "hsl(var(--muted-foreground))" },
        accent:      { DEFAULT: "hsl(var(--accent))",      foreground: "hsl(var(--accent-foreground))" },
        popover:     { DEFAULT: "hsl(var(--popover))",     foreground: "hsl(var(--popover-foreground))" },
        card:        { DEFAULT: "hsl(var(--card))",        foreground: "hsl(var(--card-foreground))" },

        // ── Brand palette ──────────────────────────────────────────────────
        brand: {
          black: '#0A0F14',          // near-black for text emphasis
        },

        navy: {
          900: '#14366B',            // deepest supporting
          800: '#173E78',
          700: '#1E4A82',            // PRIMARY brand blue
          600: '#2A5FA0',
          500: '#4078BD',
        },

        // renamed from `teal` — global sed: teal- → turquoise-
        turquoise: {
          700: '#0E8FA8',
          600: '#14A8BF',
          500: '#1FBCD4',            // PRIMARY accent
          400: '#4FCFE2',
          200: '#B8ECF3',
          100: '#E2F6FA',
          50:  '#F1FAFC',
        },

        // (NO gold block — retired)

        // ── RAG semantics (unchanged) ──────────────────────────────────────
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

        // ── Neutrals (unchanged) ───────────────────────────────────────────
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
          2:       '#EEF2F6',
        },
        line: {
          DEFAULT: '#D9E2EA',
          soft:    '#E7EDF2',
        },
      },

      fontFamily: {
        sans: ['Barlow', 'system-ui', '-apple-system', 'sans-serif'],
        cond: ['Barlow Condensed', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'ui-monospace', 'monospace'],
      },

      borderRadius: {
        sm:      '6px',
        md:      '10px',
        lg:      '14px',
        xl:      '20px',
        DEFAULT: 'var(--radius)',
      },

      boxShadow: {
        'sh-sm': '0 1px 0 rgba(20,54,107,0.04), 0 1px 2px rgba(20,54,107,0.05)',
        'sh-md': '0 1px 0 rgba(20,54,107,0.04), 0 4px 14px rgba(20,54,107,0.06)',
        'sh-lg': '0 2px 0 rgba(20,54,107,0.04), 0 18px 40px -10px rgba(20,54,107,0.18)',
      },
    },
  },
  plugins: [],
}
