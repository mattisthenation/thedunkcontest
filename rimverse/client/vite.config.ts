import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/rimverse/', // served under v3's Express mount (and the same path in dev)
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        preview: resolve(__dirname, 'preview.html'),
      },
    },
  },
});
