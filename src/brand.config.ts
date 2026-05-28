/**
 * Brand configuration — single source of truth for every name, colour,
 * logo and API coordinate that differs between deploy targets.
 *
 * All values are driven by Vite env vars so the same code can be built
 * for generic, FFIS, or any future white-label deployment by pointing at
 * a different .env file at build time. No code changes required.
 */
export const brand = {
  // App identity
  name:        import.meta.env.VITE_BRAND_NAME        ?? 'ARB AI Agent',
  shortName:   import.meta.env.VITE_BRAND_SHORT_NAME  ?? 'ARB',
  tagline:     import.meta.env.VITE_BRAND_TAGLINE      ?? 'Architecture Review Board',
  description: import.meta.env.VITE_BRAND_DESCRIPTION ?? 'Intelligent Architecture Governance',
  company:     import.meta.env.VITE_BRAND_COMPANY      ?? '',

  // Visual — prepend BASE_URL so paths work under any Vite base (e.g. /arb-ai-agent/)
  logoUrl:      import.meta.env.VITE_BRAND_LOGO
                  ? `${import.meta.env.BASE_URL}${(import.meta.env.VITE_BRAND_LOGO as string).replace(/^\//, '')}`
                  : null,
  primaryColor: import.meta.env.VITE_BRAND_COLOR       ?? '#1E4A82', // navy-700 (brand blue)
  footerText:   import.meta.env.VITE_BRAND_FOOTER      ?? '© 2026 ARB AI Agent',

  // API coordinates — stable-v1 pins to v1; new-ui-v1 targets v2
  apiBase:    import.meta.env.VITE_API_BASE_URL  ?? 'http://localhost:8000',
  apiVersion: import.meta.env.VITE_API_VERSION   ?? 'v1',

  // Derived helper — used everywhere an endpoint URL is built
  get apiRoot() {
    return `${this.apiBase}/api/${this.apiVersion}`
  },
} as const
