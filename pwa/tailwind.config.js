/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Оптимизация под Poco X6 Pro: 1080x2400, ~412x915 CSS px
      screens: {
        tall: '750px'
      }
    }
  },
  plugins: []
}
