import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// SPA build -> dist/ (published by Netlify). During `vite dev` there is no
// Netlify Functions runtime, so the app falls back to static JSON in public/data.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
})
