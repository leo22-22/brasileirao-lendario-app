// Tela de partida ao vivo do Modo Carreira — mostrada sempre que
// `save.pendingUserMatch` existe (ver advanceDay/resolveUserMatch em
// seasonEngine.js), e reaproveitada pra FINAL da Copa do Brasil (jogo
// único, ver `pendingUserCopaTie.finalMatch` em copaEngine.js/CareerApp.jsx)
// passando `pending`/`competitionLabel` por fora em vez dos valores padrão
// do Brasileirão. O resultado já vem pré-calculado (mesma seed que a
// rodada/partida usaria) — essa tela anima os eventos minuto a minuto
// (com pausa+troca, ver LiveMatchScreen) e no fim mostra as notas dos
// jogadores. "Continuar" chama `onFinish`, que resolve o que tiver que
// resolver (a rodada inteira, ou a Copa) e aplica no save de verdade.
import { LiveMatchScreen } from '../components/liveMatchUI.jsx';

export function CareerMatchDayScreen({ save, onFinish, onApplyLineupChange, pending: pendingOverride, competitionLabel: labelOverride }) {
  const pending = pendingOverride || save.pendingUserMatch;
  if (!pending) return null;
  const { homeTeam, awayTeam, sim } = pending;
  const division = save.clubs[save.myClubId].division;
  const competitionLabel = labelOverride || `Campeonato Brasileiro · Série ${division}`;

  return (
    <LiveMatchScreen
      sim={sim} homeTeam={homeTeam} awayTeam={awayTeam}
      label={competitionLabel} onFinish={onFinish}
      save={save} onApplyLineupChange={onApplyLineupChange}
    />
  );
}
