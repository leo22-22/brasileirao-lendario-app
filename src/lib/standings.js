// Classificação — funções puras usadas por TODOS os modos (clássico, carreira,
// Simulador). Uma única ordenação (desempate oficial da CBF), uma única
// conta de pontos e uma única config de zonas por divisão.

// Desempate oficial da CBF: pontos → vitórias → saldo → gols pró (conferido
// contra a planilha real do Brasileirão 2026). Nome por último é só para a
// ordem ser estável se alguém empatar em tudo.
export function compareStandings(a, b) {
  return b.pts - a.pts || b.v - a.v || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp || (a.label || '').localeCompare(b.label || '');
}

export function sortStandings(rows) {
  return [...rows].sort(compareStandings);
}

function addResult(tbl, res, sign) {
  const h = tbl.find(t => t.id === res.homeId);
  const a = tbl.find(t => t.id === res.awayId);
  if (!h || !a) return;
  h.pj += sign; a.pj += sign;
  h.gp += sign * res.homeGoals; h.gc += sign * res.awayGoals;
  a.gp += sign * res.awayGoals; a.gc += sign * res.homeGoals;
  if (res.homeGoals > res.awayGoals) { h.v += sign; h.pts += 3 * sign; a.d += sign; }
  else if (res.homeGoals < res.awayGoals) { a.v += sign; a.pts += 3 * sign; h.d += sign; }
  else { h.e += sign; h.pts += sign; a.e += sign; a.pts += sign; }
}

// Aplica resultados (3/1/0) numa cópia e reordena.
export function applyResults(table, results) {
  const tbl = table.map(r => ({ ...r }));
  (results || []).forEach(r => addResult(tbl, r, 1));
  return sortStandings(tbl);
}

// Desfaz resultados já aplicados (para saber a posição antes da rodada).
export function revertResults(table, results) {
  const tbl = table.map(r => ({ ...r }));
  (results || []).forEach(r => addResult(tbl, r, -1));
  return sortStandings(tbl);
}

// id → posição (1-based)
export function positionsOf(table) {
  return new Map(table.map((r, i) => [r.id, i + 1]));
}

// ── Zonas ──────────────────────────────────────────────────────────────
// Série A: G4 Libertadores, 5º–6º pré-Libertadores, 7º–12º Sul-Americana,
// 4 últimos rebaixados. Série B: 1º–2º sobem direto, 3º–6º mata-mata de
// acesso; ninguém cai da Série B (resolveDivisionEnd). Cores = paleta da
// Tabela da carreira (decisão de 2026-11-13).
export const ZONE_COLORS = { g4: '#1F7A4D', g6: '#6FB28E', sa: '#4E86C2', z4: '#B23B3B', up: '#1F7A4D', po: '#B7791F' };
export const RELEGATION_SPOTS = 4;

/**
 * division: 'A' | 'B'. opts.copaChampionInG4: o 5º também vai à Libertadores.
 * Devolve { key, color, label, short, title } ou null.
 */
export function zoneFor(division, pos, total, opts = {}) {
  if (division === 'B') {
    if (pos <= 2) return { key: 'up', color: ZONE_COLORS.up, label: 'Acesso direto à Série A', short: 'Acesso', title: 'Acesso direto à Série A' };
    if (pos <= 6) return { key: 'po', color: ZONE_COLORS.po, label: 'Mata-mata de acesso', short: 'Playoff', title: 'Mata-mata de acesso' };
    return null;
  }
  if (pos <= 4 || (opts.copaChampionInG4 && pos === 5)) return { key: 'g4', color: ZONE_COLORS.g4, label: 'Libertadores · fase de grupos', short: 'G4', title: 'Libertadores - Fase de Grupos' };
  if (pos <= 6) return { key: 'g6', color: ZONE_COLORS.g6, label: 'Pré-Libertadores', short: 'G6', title: 'Libertadores - Pré' };
  if (pos <= 12) return { key: 'sa', color: ZONE_COLORS.sa, label: 'Sul-Americana', short: 'SA', title: 'Sul-Americana' };
  if (pos > total - RELEGATION_SPOTS) return { key: 'z4', color: ZONE_COLORS.z4, label: 'Zona de rebaixamento', short: 'Z4', title: 'Rebaixamento' };
  return null;
}

export const ZONE_LEGEND = {
  A: [[ZONE_COLORS.g4, 'G4 · Libertadores'], [ZONE_COLORS.g6, '5º–6º · Pré-Libertadores'], [ZONE_COLORS.sa, '7º–12º · Sul-Americana'], [ZONE_COLORS.z4, 'Z4 · Rebaixamento']],
  B: [[ZONE_COLORS.up, '1º–2º · Acesso direto'], [ZONE_COLORS.po, '3º–6º · Mata-mata de acesso']],
};

export const CRITERIA_TEXT = 'Critérios: pontos, vitórias, saldo, gols pró';

// Linhas da tabela resumida: top 6 ou top 3 + vizinhança do meu time.
export function compactRows(table, myId) {
  const me = table.findIndex(r => r.id === myId);
  if (me < 6) return table.slice(0, 6).map((r, i) => ({ row: r, pos: i + 1 }));
  const idx = [0, 1, 2, me - 1, me, me + 1].filter(i => i >= 0 && i < table.length);
  const out = [];
  idx.forEach((i, k) => {
    if (k > 0 && i - idx[k - 1] > 1) out.push({ gap: true, key: `gap-${i}` });
    out.push({ row: table[i], pos: i + 1 });
  });
  return out;
}

// Forma (V/E/D) de um clube numa lista de resultados, mais antigo → mais recente.
export function formFromResults(results, clubId, count = 5) {
  return (results || []).filter(m => m.homeId === clubId || m.awayId === clubId).slice(-count).map(m => {
    const home = m.homeId === clubId;
    const gf = home ? m.homeGoals : m.awayGoals;
    const ga = home ? m.awayGoals : m.homeGoals;
    return gf > ga ? 'V' : gf < ga ? 'D' : 'E';
  });
}
