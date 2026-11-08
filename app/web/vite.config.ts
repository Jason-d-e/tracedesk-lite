import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Express server (../server.js) serves the built files from ./dist and the /api routes.
// During `npm run dev`, API calls are proxied to that server on port 3000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
})
