import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Renomeado de "public" pra fugir da convenção do Passenger/LiteSpeed
  // (hospedagem Node da Hostinger): uma pasta chamada exatamente "public"
  // na raiz do app e servida em ESTATICO direto pelo servidor web, sem
  // passar pelo processo Node - isso fazia /sitemap.xml e /robots.txt
  // sempre responderem com o arquivo-fonte (nunca regenerado pelo
  // generate-seo.mjs), ignorando por completo o dist/ buildado. O
  // conteudo continua indo pra dist/ normalmente, só muda o nome da
  // pasta de origem.
  publicDir: 'static-src',
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa o React (usado por TODAS as entradas — jogo e páginas de
        // conteúdo) do resto, pra reaproveitar cache entre deploys. peerjs
        // (WebRTC do multiplayer) SAIU daqui de propósito: como vendor chunk
        // à parte, o cálculo de preload do Rollup pra um import() dinâmico
        // (main.jsx escolhendo entre App.jsx e content/ContentApp.jsx, ver
        // src/main.jsx) colocava peerjs na lista de preload dos DOIS lados,
        // baixando o WebRTC do multiplayer até em página de time — sem
        // isolar peerjs, ele vira parte do chunk de quem importa de verdade
        // (só App.jsx), então só quem carrega o jogo baixa esse peso.
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
})
