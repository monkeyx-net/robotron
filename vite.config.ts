import { defineConfig } from 'vite';

export default defineConfig({
  base: '/robotron/',
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
});
