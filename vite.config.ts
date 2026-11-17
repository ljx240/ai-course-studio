import { defineConfig } from 'vite'

export default defineConfig({
  root: 'apps/studio',
  envDir: false,
  base: './',
  esbuild: { jsx: 'automatic' },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  build: { emptyOutDir: false },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
})
