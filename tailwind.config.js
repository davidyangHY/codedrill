/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark theme palette
        base: {
          900: '#0d1117',
          850: '#111722',
          800: '#161b22',
          750: '#1c2333',
          700: '#21262d',
          600: '#30363d',
          500: '#484f58',
        },
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          soft: '#1e3a8a',
        },
        good: '#22c55e',
        bad: '#ef4444',
        warn: '#f59e0b',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        blink: 'blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
};
