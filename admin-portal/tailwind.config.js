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
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        slate: {
          750: '#293548',
          850: '#172032',
        },
        // Warm beige design system (FP portal Estimates onwards)
        warm: {
          page: '#FAF7F2',
          section: '#FFF9EE',
          border: '#EADFCF',
          accent: '#D4A574',
          'accent-hover': '#C69250',
          'accent-soft': '#FEF3E2',
          text: '#1F2937',
          muted: '#6B7280',
          success: '#ECFDF5',
          info: '#EEF4FF',
          warning: '#FEF3C7',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Poppins', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'gold': '0 4px 14px 0 rgba(251, 191, 36, 0.25)',
        'gold-lg': '0 10px 25px -3px rgba(251, 191, 36, 0.25)',
        'warm': '0 3px 8px rgba(0, 0, 0, 0.04)',
        'warm-hover': '0 4px 16px rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [],
}
