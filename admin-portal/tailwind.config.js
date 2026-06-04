/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Soft warm palette for FP portal
        cream: {
          50: '#FFFDF8',
          100: '#FEF9F0',
          200: '#FDF3E3',
          300: '#FAECD4',
          400: '#F5DFC0',
        },
        warmstone: {
          50: '#FAF9F7',
          100: '#F5F3F0',
          200: '#E8E4DE',
          300: '#D6D0C7',
          400: '#B8AFA3',
          500: '#9A8F80',
          600: '#7A7066',
        },
        softgold: {
          50: '#FFFCF5',
          100: '#FEF7E8',
          200: '#FCEDC8',
          300: '#F9DFA3',
          400: '#E8C97A',
          500: '#D4AF5C',
          600: '#B8944A',
          700: '#96763B',
        },
        sage: {
          50: '#F6F7F5',
          100: '#EEF0EC',
          200: '#DFE4DB',
          300: '#C5CFBD',
          400: '#A3B296',
          500: '#839474',
          600: '#6B7A5E',
        },
        dustyrose: {
          50: '#FBF8F8',
          100: '#F7F1F1',
          200: '#EFE5E5',
          300: '#E3D4D4',
          400: '#D1BABA',
          500: '#B89A9A',
        },
        softslate: {
          50: '#F8F9FA',
          100: '#F1F3F5',
          200: '#E4E8EB',
          300: '#CED4DA',
          400: '#ADB5BD',
          500: '#868E96',
          600: '#6C757D',
        }
      }
    },
  },
  plugins: [],
}
