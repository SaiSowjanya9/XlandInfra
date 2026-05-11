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
        gold: {
          50: '#FFF9E6',
          100: '#FEF3CD',
          200: '#FDE79B',
          300: '#FCDB69',
          400: '#D8B25C',
          500: '#C9A227',
          600: '#B8860B',
          700: '#996515',
          800: '#7A5014',
          900: '#5C3D0F',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        charcoal: {
          900: '#0D0D0D',
          800: '#141414',
          700: '#1A1A1A',
          600: '#222222',
          500: '#2D2D2D',
        }
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'fade-in-down': 'fadeInDown 0.6s ease-out',
        'scale-in': 'scaleIn 0.5s ease-out',
        'slide-right': 'slideRight 0.5s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(216, 178, 92, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(216, 178, 92, 0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(216, 178, 92, 0.2), 0 0 10px rgba(216, 178, 92, 0.1)' },
          '100%': { boxShadow: '0 0 20px rgba(216, 178, 92, 0.4), 0 0 30px rgba(216, 178, 92, 0.2)' },
        },
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D8B25C 0%, #C9A227 50%, #B8860B 100%)',
        'gold-shimmer': 'linear-gradient(90deg, #B89A3C, #D8B25C, #E8C26C, #D8B25C, #B89A3C)',
        'dark-gradient': 'linear-gradient(180deg, #0D0D0D 0%, #141414 50%, #0D0D0D 100%)',
        'hero-gradient': 'linear-gradient(135deg, rgba(13,13,13,0.95) 0%, rgba(20,20,20,0.9) 50%, rgba(13,13,13,0.95) 100%)',
      },
    },
  },
  plugins: [],
}
