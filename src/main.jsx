import React from 'react'
import ReactDOM from 'react-dom/client'
import { TEAMS } from './data/teams.js'
import { INFO_ROUTES } from './data/info-content.js'

// Code splitting real: rotas de conteúdo (índice de times, time individual,
// institucionais) baixam um bundle PRÓPRIO e pequeno (src/content/), sem
// nada do jogo (draft/simulador/multiplayer/PeerJS). Essa decisão precisa
// acontecer AQUI, antes de importar qualquer um dos dois — se App.jsx fosse
// importado incondicionalmente (mesmo só pra decidir depois se mostra ou
// não), o bundle gigante do jogo já teria sido baixado de qualquer forma,
// e nada teria sido "splitado" de verdade.
//
// O HTML que chega aqui já tem o conteúdo real pré-renderizado pelo
// servidor (ver scripts/generate-seo.mjs) — então não tem problema o
// import() ser assíncrono; a pessoa já está vendo a página completa antes
// do JS decidir qual bundle interativo carregar.
const pathname = window.location.pathname
const isKnownTeamPage = pathname.startsWith('/times/') && TEAMS.some(t => t.id === pathname.slice('/times/'.length))
const isContentRoute = pathname === '/times' || isKnownTeamPage || !!INFO_ROUTES[pathname]

const root = ReactDOM.createRoot(document.getElementById('root'))

const mount = (Component) => {
  root.render(
    <React.StrictMode>
      <Component />
    </React.StrictMode>,
  )
}

if (isContentRoute) {
  import('./content/ContentApp.jsx').then(m => mount(m.default))
} else {
  import('./App.jsx').then(m => mount(m.default))
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
