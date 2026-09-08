// Roteamento das páginas institucionais e de time histórico — sem lib de
// rotas, é só History API direta (pushState/popstate). Compartilhado entre
// o jogo (App.jsx, navegação client-side sem reload) e o bundle de
// conteúdo (src/content/ContentApp.jsx, usado no load "frio" dessas rotas).
import { TEAMS } from '../data/teams.js';
import { INFO_ROUTES } from '../data/info-content.js';

// Caminho canônico de cada aba institucional — o inverso de INFO_ROUTES.
export function canonicalPathFor(infoPage) {
  if (!infoPage) return '/';
  return Object.entries(INFO_ROUTES).find(([, v]) => v === infoPage)?.[0] || '/';
}

// '/times' -> 'index'; '/times/{id}' -> id (só se existir em TEAMS); outra
// coisa -> null.
export function parseTeamsPathname(pathname) {
  if (pathname === '/times') return 'index';
  if (pathname.startsWith('/times/')) {
    const id = pathname.slice('/times/'.length);
    return TEAMS.some(t => t.id === id) ? id : null;
  }
  return null;
}

export function canonicalTeamsPath(teamsPage) {
  if (!teamsPage) return '/';
  return teamsPage === 'index' ? '/times' : `/times/${teamsPage}`;
}
