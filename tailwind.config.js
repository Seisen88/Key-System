/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0D0E12',
        card:    '#16171E',
        border:  '#282A36',
        accent:  '#00ADB5',
        accent2: '#7F00FF',
        text:    '#EEEEEE',
        muted:   '#B0B3B8',
        dim:     '#6B6E7A',
      },
    },
  },
  plugins: [],
}
