import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// The renderer is loaded from the embedded local server (production) or from the
// Vite dev server (development). Both serve it from the origin root, so relative
// asset paths keep working in either mode.
export default defineConfig({
  root: rootDir,
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    target: 'chrome128',
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5273,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5274',
        changeOrigin: false,
      },
    },
  },
});
