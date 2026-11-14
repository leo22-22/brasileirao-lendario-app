// Prévia do próximo jogo (Modo Carreira) — aberta pelo card "Próximo jogo"
// da Visão geral. Força de elenco já considerando moral/fase (teamForSim, o
// mesmo que a simulação usa), posição, últimos 5 e o time titular previsto
// de cada lado. Visual: Modal + MatchPreviewCard + PlayerList (unificação).
import { TEAMS } from '../../data/teams.js';
import { posOrderIndex } from '../../lib/format.js';
import { teamForSim, clubForm } from '../engine/simHelpers.js';
import { matchOutcomeProbabilities } from '../../lib/probability.js';
import { displayName } from '../../lib/displayName.js';
import { Modal } from '../../ui/index.jsx';
import { ClubCrest } from '../../components/football/ClubCrest.jsx';
import { MatchPreviewCard } from '../../components/football/MatchPreviewCard.jsx';
import { PlayerList } from '../../components/football/PlayerList.jsx';

export function MatchPreviewModal({ save, division, homeId, awayId, onClose }) {
  const homeTeam = TEAMS.find(t => t.id === homeId);
  const awayTeam = TEAMS.find(t => t.id === awayId);
  const homeSim = teamForSim(save, homeId);
  const awaySim = teamForSim(save, awayId);
  const odds = matchOutcomeProbabilities(homeSim, awaySim);
  const homePos = division.table.findIndex(r => r.id === homeId) + 1;
  const awayPos = division.table.findIndex(r => r.id === awayId) + 1;
  const starters = (sim) => [...sim.players.filter(p => !p.isBench)].sort((a, b) => posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]));
  const lineup = (team, sim) => (
    <div style={{ minWidth: 0 }}>
      <PlayerList
        className="pl-compact"
        groups={[{ key: team.id, label: `${displayName(team.club)} · titulares previstos`, dot: team.colors?.p || 'var(--green)', players: starters(sim) }]}
        showHeader={false}
        getSub={null}
        ariaLabel={`Titulares previstos do ${displayName(team.club)}`}
      />
    </div>
  );
  return (
    <Modal onClose={onClose} maxWidth={660} labelledBy="mpv-title">
      <MatchPreviewCard
        id="mpv-title"
        size="md"
        eyebrow="Prévia do confronto"
        home={{ crest: <ClubCrest id={homeId} size={60} frame frameClass="fb-crest-ring" scale={0.72} />, name: displayName(homeTeam.club), sub: `${homePos}º lugar · em casa`, form: clubForm(division, homeId, 5) }}
        away={{ crest: <ClubCrest id={awayId} size={60} frame frameClass="fb-crest-ring" scale={0.72} />, name: displayName(awayTeam.club), sub: `${awayPos}º lugar · fora`, form: clubForm(division, awayId, 5) }}
        probs={{ home: odds.homeWin, draw: odds.draw, away: odds.awayWin }}
        probsNote="Calculada pela força de cada elenco (já com fase recente e moral) e pelo fator casa."
      />
      <div className="mpv-lineups">
        {lineup(homeTeam, homeSim)}
        {lineup(awayTeam, awaySim)}
      </div>
    </Modal>
  );
}
