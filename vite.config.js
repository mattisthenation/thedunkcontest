// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Project root directory
  root: 'public',
  
  // Base public path when served
  base: '/',
  
  // Build options
  build: {
    // Output directory for production build
    outDir: '../dist',
    
    // Empty the outDir on build
    emptyOutDir: true,
    
    // Configure rollup options
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/vite-index.html')
      }
    }
  },
  
  // Server options
  server: {
    port: 3000,
    open: true, // Open browser on server start
    cors: true
  },
  
  // Optimizations
  optimizeDeps: {
    include: ['three']
  }
});
