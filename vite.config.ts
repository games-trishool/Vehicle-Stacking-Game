import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    rollupOptions: {
      output: { manualChunks: { 'three-engine': ['three'], 'physics': ['cannon-es'] } },
    },
  },
});
