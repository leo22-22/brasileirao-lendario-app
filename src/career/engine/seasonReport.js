// Monta o relatório de fim de temporada do PRÓPRIO clube do usuário —
// chamado por endOfSeason/finalizeSeasonAfterUserTie (seasonEngine.js)
// assim que a temporada termina de verdade (incluindo o mata-mata de
// acesso do usuário, se houver), ANTES de advanceToNextSeason resetar
// tabelas/estatísticas pra temporada seguinte. Guardado em
// `save.lastSeasonReport` até o usuário clicar em avançar
// (CareerSeasonReportScreen.jsx).
import { TEAMS } from '../../data/teams.js';
import { playerSeasonStats } from './seasonStats.js';

export function buildSeasonReport(save, myClubDeltas, divisionMoves) {
  const myClubId = save.myClubId;
  // Procura nas duas tabelas: quando o relatório é montado o acesso/queda já
  // mudou `clubs[].division`, e o clube que subiu ou caiu não estava na
  // tabela da divisão nova — o "Resumo do time" saía vazio pra ele.
  const row = save.divisionA.table.find(r => r.id === myClubId)
    || save.divisionB.table.find(r => r.id === myClubId) || null;

  const myKeyPrefix = `${myClubId}::`;
  const cleanSheets = Object.entries(save.seasonPlayerStats || {})
    .filter(([key]) => key.startsWith(myKeyPrefix))
    .reduce((sum, [, s]) => sum + (s.cleanSheets || 0), 0);

  const teamStats = row ? {
    played: row.pj, wins: row.v, draws: row.e, losses: row.d,
    goalsFor: row.gp, goalsAgainst: row.gc, cleanSheets,
  } : null;

  const deltaByName = new Map(myClubDeltas.map(d => [d.name, d]));
  const playerRows = (save.clubs[myClubId].roster || []).map(p => ({
    name: p.name, pos: p.pos, ovr: p.ovr, age: p.age,
    stats: playerSeasonStats(save.seasonPlayerStats, myClubId, p.name),
    delta: deltaByName.get(p.name) || null,
  }));

  const myTeam = TEAMS.find(t => t.id === myClubId);
  const movesWithLabels = divisionMoves.map(m => ({ ...m, club: TEAMS.find(t => t.id === m.clubId) }));

  return {
    season: save.season,
    teamLabel: myTeam?.club,
    teamColor: myTeam?.colors?.p,
    teamStats,
    playerRows,
    retired: myClubDeltas.filter(d => d.retired),
    divisionMoves: movesWithLabels,
    // Fase 5: veredito da diretoria e quem saiu por fim de contrato.
    board: save.seasonEndExtras?.board || null,
    contractExits: save.seasonEndExtras?.contractExits || [],
    autoRenewed: save.seasonEndExtras?.autoRenewed || [],
  };
}
