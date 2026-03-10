import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Polyfill Buffer for @react-pdf/renderer (uses Node.js Buffer API internally)
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@react-pdf/renderer'],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-core': ['@tanstack/react-query', 'axios', 'lucide-react'],
          'pdf-libs': ['@react-pdf/renderer'],
          'radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-tooltip'
          ],
        },
      },
    },
  },
});
