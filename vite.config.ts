import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { rollupOptions: { output: { manualChunks(id) {
    if (!id.includes('node_modules')) return;
    if (id.includes('@xyflow') || id.includes('d3-')) return 'graph';
    if (id.includes('react-dom') || /[\\/]react[\\/]/.test(id) || id.includes('scheduler')) return 'react';
  } } } }
});
