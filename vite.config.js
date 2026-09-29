import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:4000', '/socket.io': { target: 'http://localhost:4000', ws: true } } },
  build: { rollupOptions: { output: { manualChunks(id) {
    if (id.includes('/node_modules/recharts/') || id.includes('/node_modules/victory-vendor/')) return 'charts';
    if (id.includes('/node_modules/leaflet/') || id.includes('/node_modules/react-leaflet/')) return 'maps';
    if (id.includes('/node_modules/socket.io-client/') || id.includes('/node_modules/engine.io-client/')) return 'realtime';
  } } } }
});
