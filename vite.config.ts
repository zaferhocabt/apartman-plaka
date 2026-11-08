import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' : GitHub Pages'te depo alt yolunda (kullanici.github.io/depo/) da çalışır.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 900 },
})
