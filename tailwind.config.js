/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      // Tokens semánticos vía CSS variables. Los valores en :root y html.dark (index.css)
      // son tripletas R G B (sin "rgb()") para que Tailwind pueda inyectar alpha.
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          hover:   'rgb(var(--brand-hover-rgb) / <alpha-value>)',
          tint:    'rgb(var(--brand-tint-rgb) / <alpha-value>)',
        },
        cash:    '#1E7A4F',
        wire:    '#33518C',
        canvas:    'rgb(var(--canvas-rgb) / <alpha-value>)',
        card:      'rgb(var(--card-rgb) / <alpha-value>)',
        hairline:  'rgb(var(--hairline-rgb) / <alpha-value>)',
        soft:      'rgb(var(--soft-rgb) / <alpha-value>)',
        ink:       'rgb(var(--ink-rgb) / <alpha-value>)',
        ink2:      'rgb(var(--ink2-rgb) / <alpha-value>)',
        muted:     'rgb(var(--muted-rgb) / <alpha-value>)',
        muted2:    'rgb(var(--muted2-rgb) / <alpha-value>)',
        pos:   { DEFAULT: 'rgb(var(--pos-rgb) / <alpha-value>)', tint: 'rgb(var(--pos-tint-rgb) / <alpha-value>)', border: 'rgb(var(--pos-border-rgb) / <alpha-value>)' },
        neg:   { DEFAULT: 'rgb(var(--neg-rgb) / <alpha-value>)', tint: 'rgb(var(--neg-tint-rgb) / <alpha-value>)' },
        warn:  { DEFAULT: 'rgb(var(--warn-rgb) / <alpha-value>)', tint: 'rgb(var(--warn-tint-rgb) / <alpha-value>)' },
        info:  { DEFAULT: 'rgb(var(--info-rgb) / <alpha-value>)', tint: 'rgb(var(--info-tint-rgb) / <alpha-value>)' },
        wirec: { DEFAULT: '#33518C', tint: '#E8EDF6' },
      },
      borderRadius: {
        xl2: '20px',
        '3xl': '24px',
      },
      boxShadow: {
        card: '0 6px 20px -14px rgba(92,51,23,.20)',
        hero: '0 8px 24px -14px rgba(92,51,23,.28)',
      },
    },
  },
  plugins: [],
}
