/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'system': ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Helvetica Neue', 'sans-serif'],
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Ultra-minimal Apple-inspired color palette
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
        gray: {
          25: '#fdfdfd',
          50: '#fafafa',
          75: '#f7f7f7',
          100: '#f5f5f5',
          150: '#f0f0f0',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          850: '#1f1f1f',
          900: '#171717',
          950: '#0a0a0a',
        },
        // Apple-style system colors
        system: {
          blue: '#007AFF',
          'blue-dark': '#0A84FF',
          green: '#34C759',
          'green-dark': '#30D158',
          red: '#FF3B30',
          'red-dark': '#FF453A',
          orange: '#FF9500',
          'orange-dark': '#FF9F0A',
          yellow: '#FFCC00',
          'yellow-dark': '#FFD60A',
        },
        // Refined dark mode colors
        dark: {
          bg: '#000000',
          'bg-secondary': '#1c1c1e',
          'bg-tertiary': '#2c2c2e', 
          'bg-quaternary': '#3a3a3c',
          'bg-elevated': '#1c1c1e',
          text: '#ffffff',
          'text-secondary': '#ebebf5cc',
          'text-tertiary': '#ebebf599',
          'text-quaternary': '#ebebf54d',
          separator: '#38383a',
          fill: '#787880',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-subtle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 8s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        gradient: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' },
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient': 'linear-gradient(132deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)',
        'glass': 'linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
        'glass-dark': 'linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}