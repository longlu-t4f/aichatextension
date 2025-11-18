import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 允许通过IP访问
    port: 5173
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      input: resolve(__dirname, 'index.html')
    }
  }
});

