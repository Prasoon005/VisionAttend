import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Read the single repository-root .env. Vite only exposes VITE_* variables
  // to browser code, so server secrets in the same file never reach the bundle.
  envDir: '../../',
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin API calls in development: no CORS preflight, and the
    // refresh-token cookie (Phase 2) behaves exactly as in production.
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
});
