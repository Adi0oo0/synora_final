import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser never talks to NVIDIA directly — every model call goes through
// the FastAPI backend (../zenhealth-backend) so the nvapi key stays server-side.
// SSE (chat + vitals streams) passes through this proxy unmodified.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_ORIGIN || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: { router: ['react-router-dom'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.js'],
  },
});
