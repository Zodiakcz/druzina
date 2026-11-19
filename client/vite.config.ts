import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    // API_PORT lets a second checkout (a worktree) run its own server next to the main one.
    proxy: {
      '/api': { target: `http://localhost:${process.env.API_PORT ?? 3000}`, changeOrigin: true },
    },
  },
})
