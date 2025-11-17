import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        'sidepanel/index': resolve(__dirname, 'src/sidepanel/index.html'),
        'options/index': resolve(__dirname, 'src/options/index.html'),
        background: resolve(__dirname, 'src/background.ts'),
        'content/selection': resolve(__dirname, 'src/content/selection.ts')
      },
      output: {
        // 保持入口文件名结构，方便在 manifest 中引用
        entryFileNames: (chunkInfo) => {
          // Keep nested entry names so manifest can reference predictable paths
          return `${chunkInfo.name}.js`;
        },
        // 将 CSS 放到与 HTML 同级目录，其余静态资源归档到 assets
        assetFileNames: (assetInfo) => {
          // Keep css alongside html for readability
          if (assetInfo.name?.endsWith('.css')) {
            return `${assetInfo.name}`;
          }
          return 'assets/[name][extname]';
        }
      }
    }
  }
});


