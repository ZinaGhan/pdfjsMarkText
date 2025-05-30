import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      external: ['pdfjs-dist']
    }
  },
  publicDir: 'public',
  optimizeDeps: {
    exclude: ['pdfjs-dist']
  },
  define: {
    global: 'globalThis'
  }
}) 