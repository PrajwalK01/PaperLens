/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Polished walnut / warm wood palette ──────────────────────────
        wood: {
          50:  '#fdf8f0',
          100: '#f7edd8',
          200: '#eedab0',
          300: '#e0c080',
          400: '#cfa050',
          500: '#b8832a',
          600: '#96651a',
          700: '#724c10',
          800: '#4e3408',
          900: '#2e1e04',
          950: '#1a1006',   // deepest walnut — main bg
        },
        // ── Warm cream / parchment for text + cards ───────────────────────
        cream: {
          50:  '#fefcf8',
          100: '#fdf6e8',
          200: '#f8e8c4',
          300: '#f0d08a',
          400: '#e4b44a',
          500: '#d4953a',
          600: '#b8742a',
          700: '#94571c',
          800: '#6e3e10',
          900: '#4a2a08',
        },
        // ── Warm accent — polished copper/amber CTA ───────────────────────
        copper: {
          300: '#f4c06a',
          400: '#e8a030',
          500: '#d4821a',
          600: '#b86410',
          700: '#944e08',
        },
        // ── Keep semantic verdict colors ──────────────────────────────────
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        card:   '0 1px 4px rgba(0,0,0,0.5), 0 4px 20px rgba(0,0,0,0.4)',
        lift:   '0 6px 28px rgba(0,0,0,0.55)',
        glow:   '0 0 28px rgba(184,131,42,0.2)',
        copper: '0 0 20px rgba(212,130,26,0.25)',
        warm:   'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.35s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        shimmer:      'shimmer 1.8s infinite linear',
        'count-up':   'countUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        countUp: { from: { opacity: '0', transform: 'scale(0.85)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
}
