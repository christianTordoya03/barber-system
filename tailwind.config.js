/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <-- ESTA ES LA LÍNEA MÁGICA PARA V3
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}