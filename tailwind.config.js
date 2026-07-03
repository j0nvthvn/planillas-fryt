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
      colors: {
        brand: {
          DEFAULT: '#5C3317',
          hover:   '#4A2810',
          tint:    '#F5EAD4',
        },
        cash:    '#1E7A4F',
        wire:    '#33518C',
        canvas:    '#FBF6EC',
        card:      '#FFFFFF',
        hairline:  '#F0E7D6',
        soft:      '#F6EFE1',
        ink:       '#2A211A',
        ink2:      '#5F5245',
        muted:     '#9C8B78',
        muted2:    '#B3A48F',
        pos:   { DEFAULT: '#1E7A4F', tint: '#E6F1EA' },
        neg:   { DEFAULT: '#B91C1C', tint: '#FBE9E9' },
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
