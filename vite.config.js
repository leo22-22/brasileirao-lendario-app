import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa as libs de terceiros (mudam raramente) do código do jogo
        // (App.jsx, que muda a cada feature/fix) — assim o navegador do
        // jogador reaproveita o cache dessas duas em quase todo deploy novo,
        // baixando de novo só o chunk do app.
        manualChunks: {
          vendor: ['react', 'react-dom'],
          peerjs: ['peerjs'],
        },
      },
    },
  },
})
