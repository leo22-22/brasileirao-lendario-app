// Classificação do Brasileirão da carreira recalculada a partir dos
// placares salvos (division.results[rodada]) — SEMPRE com a mesma função
// do motor (applyRoundToTable, App.jsx), então os critérios de desempate
// são exatamente os da tabela oficial (pontos → vitórias → saldo → gols
// pró). Visões parciais (mandante, visitante, últimos 5) usam a mesma
// função aplicada a um subconjunto de jogos: o adversário vira uma linha
// "fantasma" que é descartada no fim — assim só o lado que interessa soma.
import { TEAMS } from '../../data/teams.js';
import { applyRoundToTable } from '../../App.jsx';

const GHOST = '__ghost__';

function emptyRow(clubId) {
  const team = TEAMS.find(t => t.id === clubId);
  return { id: clubId, label: team?.label || clubId, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 };
}

export function clubIdsOf(division) {
  return division.table.map(r => r.id);
}

// view: 'all' | 'home' | 'away' | 'last5'
export function standingsAfter(division, roundsPlayed, view = 'all') {
  const ids = clubIdsOf(division);
  const rounds = (division.results || []).slice(0, Math.max(0, roundsPlayed));
  let table = [...ids].sort((a, b) => (TEAMS.find(t => t.id === a)?.club || '').localeCompare(TEAMS.find(t => t.id === b)?.club || '')).map(emptyRow);
  if (view === 'all') {
    for (const r of rounds) table = applyRoundToTable(table, r);
    return table;
  }
  const ghostRows = [];
  const matches = [];
  if (view === 'home' || view === 'away') {
    rounds.forEach((r, ri) => r.forEach((m, mi) => {
      const g = `${GHOST}${ri}-${mi}`;
      ghostRows.push({ ...emptyRow(g), id: g, label: g });
      matches.push(view === 'home' ? { ...m, awayId: g } : { ...m, homeId: g });
    }));
  } else if (view === 'last5') {
    for (const id of ids) {
      let found = 0;
      for (let ri = rounds.length - 1; ri >= 0 && found < 5; ri--) {
        const m = rounds[ri].find(x => x.homeId === id || x.awayId === id);
        if (!m) continue;
        found++;
        const g = `${GHOST}${id}-${ri}`;
        ghostRows.push({ ...emptyRow(g), id: g, label: g });
        matches.push(m.homeId === id ? { ...m, awayId: g } : { ...m, homeId: g });
      }
    }
  }
  table = applyRoundToTable([...table, ...ghostRows], matches);
  return table.filter(r => !String(r.id).startsWith(GHOST));
}

// Últimos `count` jogos de um clube até a rodada `roundsPlayed`, do mais
// antigo para o mais recente, com adversário e placar (para tooltip).
export function clubFormDetailed(division, clubId, roundsPlayed, count = 5) {
  const out = [];
  const rounds = (division.results || []).slice(0, roundsPlayed);
  for (let ri = rounds.length - 1; ri >= 0 && out.length < count; ri--) {
    const m = rounds[ri].find(x => x.homeId === clubId || x.awayId === clubId);
    if (!m) continue;
    const home = m.homeId === clubId;
    const gf = home ? m.homeGoals : m.awayGoals;
    const ga = home ? m.awayGoals : m.homeGoals;
    out.push({ round: ri + 1, home, oppId: home ? m.awayId : m.homeId, gf, ga, res: gf > ga ? 'V' : gf < ga ? 'D' : 'E' });
  }
  return out.reverse();
}

// Próximos `count` jogos de um clube a partir da rodada `fromRound`.
export function nextFixtures(division, clubId, fromRound, count = 2) {
  const out = [];
  for (let r = fromRound; r < division.fixtures.length && out.length < count; r++) {
    const m = (division.fixtures[r] || []).find(x => x.homeId === clubId || x.awayId === clubId);
    if (m) out.push({ round: r + 1, home: m.homeId === clubId, oppId: m.homeId === clubId ? m.awayId : m.homeId });
  }
  return out;
}
