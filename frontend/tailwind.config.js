/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg0: '#070b16', card: 'rgba(14, 23, 45, 0.78)', cyan: '#00f5d4',
        lime: '#a3ff12', warning: '#ffb703', danger: '#ff4d6d',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Rajdhani', 'sans-serif'],
      },
      boxShadow: { neon: '0 0 28px rgba(0, 245, 212, 0.12)' },
    },
  },
  plugins: [],
};
