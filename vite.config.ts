import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      input: resolve(__dirname, 'index.html')
    }
  }
});

