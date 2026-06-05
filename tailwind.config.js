/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#5C3317',
          hover:   '#4A2810',
          tint:    '#F5EAD4',
        },
        cash: '#1E7A4F',   // efectivo / verde
        wire: '#33518C',   // transferencia / azul navy
      },
    },
  },
  plugins: [],
}
