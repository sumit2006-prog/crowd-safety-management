/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: { colors: { ink: '#101827', navy: '#111c2d', signal: '#ef4e4e', mint: '#1bbf9b' }, fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] } } },
  plugins: []
};
