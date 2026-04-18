/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      colors: {
        rx: {
          blue: '#1a3a5c',
          gold: '#b8860b',
          light: '#f0f4f8',
        },
      },
    },
  },
  plugins: [],
}
