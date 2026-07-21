/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        plum: '#754B4D',
        copper: '#A86A65',
        dusty: '#AB8882',
        rosewater: '#D8A694',
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        hand: ['Caveat', 'cursive'],
      },
    },
  },
  plugins: [],
}
