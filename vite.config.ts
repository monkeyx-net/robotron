import { defineConfig } from 'vite';
import { cpSync } from 'node:fs';

// Production is served from the root of its domain (deploy.sh);
// the dev server keeps the /robotron/ path.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/' : '/robotron/',
  plugins: [{
    // sprites/ and sounds/ are fetched at runtime (not imported), so Vite
    // doesn't bundle them — copy them into dist explicitly.
    name: 'copy-runtime-assets',
    closeBundle() {
      cpSync('sprites', 'dist/sprites', { recursive: true });
      cpSync('sounds', 'dist/sounds', { recursive: true });
    },
  }],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'pixi': ['pixi.js'],
          'howler': ['howler']
        }
      }
    }
  },
  server: {
    port: 5173,
    open: true
  }
}));
