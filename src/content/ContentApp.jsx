// Shell leve pro load "frio" de uma rota de conteúdo (índice de times, time
// individual, ou página institucional) — ver src/main.jsx, que decide entre
// importar este arquivo ou o jogo (App.jsx) ANTES de baixar qualquer um dos
// dois. Não tem estado de partida nenhum: quem chega aqui direto do Google
// só está lendo uma escalação ou "Como Jogar"; "Jogar agora"/"Voltar pro
// app" leva pra home de verdade (carrega o bundle do jogo do zero lá).
import { useState, useEffect } from 'react';
import { TEAMS } from '../data/teams.js';
import { INFO_ROUTES } from '../data/info-content.js';
import { canonicalPathFor, canonicalTeamsPath, parseTeamsPathname } from '../lib/routes.js';
import { InfoPage, TeamsIndexPage, TeamDetailPage } from './ContentPages.jsx';

function goHome() {
  window.location.href = '/';
}

export default function ContentApp() {
  const [infoPage, setInfoPage] = useState(() => INFO_ROUTES[window.location.pathname] || null);
  const [teamsPage, setTeamsPage] = useState(() => parseTeamsPathname(window.location.pathname));

  useEffect(() => {
    const onPopState = () => {
      setInfoPage(INFO_ROUTES[window.location.pathname] || null);
      setTeamsPage(parseTeamsPathname(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateToInfo = (tab) => {
    window.history.pushState(null, '', canonicalPathFor(tab));
    setInfoPage(tab);
    setTeamsPage(null);
  };
  const navigateToTeamsIndex = () => {
    window.history.pushState(null, '', '/times');
    setTeamsPage('index');
    setInfoPage(null);
  };
  const navigateToTeam = (id) => {
    window.history.pushState(null, '', canonicalTeamsPath(id));
    setTeamsPage(id);
    setInfoPage(null);
  };

  if (infoPage) {
    return <InfoPage tab={infoPage} onNavigate={navigateToInfo} onClose={goHome} />;
  }
  if (teamsPage === 'index') {
    return <TeamsIndexPage onBack={goHome} onOpenTeam={navigateToTeam} />;
  }
  if (teamsPage) {
    const team = TEAMS.find(t => t.id === teamsPage);
    return (
      <TeamDetailPage
        team={team}
        onBack={goHome}
        onOpenIndex={navigateToTeamsIndex}
        onPlayWithTeam={goHome}
      />
    );
  }
  // main.jsx só carrega este bundle pra rotas de conteúdo conhecidas — não
  // deveria cair aqui, mas por segurança volta pra home em vez de tela em branco.
  goHome();
  return null;
}
