/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        field: {
          DEFAULT: '#1F4D2C',
          dark: '#153A20',
          light: '#2E6B3F'
        },
        harvest: {
          DEFAULT: '#C89B3C',
          light: '#E0BC6C'
        },
        slate: {
          DEFAULT: '#3B6E8F'
        },
        growth: '#2F6B3F',
        rust: '#A63D2F',
        soil: '#6B4423',
        parchment: '#F7F4EC',
        ink: '#20241D'
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        DEFAULT: '4px'
      }
    }
  },
  plugins: []
};
