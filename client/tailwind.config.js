/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        blurple: {
          DEFAULT: '#5865F2',
          50: '#e8eafd',
          100: '#d1d5fb',
          200: '#a3abf7',
          300: '#7581f3',
          400: '#5865F2',
          500: '#3b4aef',
          600: '#2e3ce8',
          700: '#1f2ddb',
          800: '#1824b8',
          900: '#111b96',
        },
        discord: {
          bg: '#313338',
          sidebar: '#2b2d31',
          channels: '#1e1f22',
          dark: '#111214',
          surface: '#383a40',
          'surface-hover': '#404249',
          'surface-active': '#454750',
          accent: '#5865F2',
          muted: '#949ba4',
          'muted-more': '#6d6f78',
          divider: '#3f4147',
          header: '#f2f3f5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      width: {
        'community-bar': '72px',
        'channel-sidebar': '240px',
      },
      minWidth: {
        'community-bar': '72px',
        'channel-sidebar': '240px',
      },
    },
  },
  plugins: [],
};