// Funções puras da tabela da liga clássica, só para APRESENTAÇÃO (movimento,
// tabela ao vivo, zonas). O motor continua aplicando os resultados no
// App.jsx; aqui se usa exatamente o mesmo critério de ordenação dele
// (pontos, saldo, gols pró) para que a "tabela ao vivo" bata com a oficial.

export function sortLeagueTable(rows) {
  return [...rows].sort((a, b) => b.pts - a.pts || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp);
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

// Tabela com resultados aplicados (cópia) e reordenada.
export function applyResults(table, results) {
  const tbl = table.map(r => ({ ...r }));
  (results || []).forEach(r => addResult(tbl, r, 1));
  return sortLeagueTable(tbl);
}

// Tabela antes de uma rodada já aplicada (desfaz os resultados numa cópia).
export function revertResults(table, results) {
  const tbl = table.map(r => ({ ...r }));
  (results || []).forEach(r => addResult(tbl, r, -1));
  return sortLeagueTable(tbl);
}

// id → posição (1-based)
export function positionsOf(table) {
  return new Map(table.map((r, i) => [r.id, i + 1]));
}

// Zonas por divisão — mesmas faixas do motor (getZoneInfo na Série A;
// DIRECT_PROMOTION_SPOTS / PLAYOFF_ZONE na Série B) e
// as mesmas cores da Tabela da carreira.
export function leagueZoneFor(division, pos, total) {
  if (division === 'B') {
    if (pos <= 2) return { key: 'up', color: '#1F7A4D', label: 'Acesso direto à Série A' };
    if (pos <= 6) return { key: 'po', color: '#B7791F', label: 'Mata-mata de acesso' };
    // Na liga clássica não existe Série C: ninguém cai da Série B.
    return null;
  }
  if (pos <= 4) return { key: 'g4', color: '#1F7A4D', label: 'Libertadores · fase de grupos' };
  if (pos <= 6) return { key: 'g6', color: '#6FB28E', label: 'Pré-Libertadores' };
  if (pos <= 12) return { key: 'sa', color: '#4E86C2', label: 'Sul-Americana' };
  if (pos >= total - 3) return { key: 'z4', color: '#B23B3B', label: 'Zona de rebaixamento' };
  return null;
}

export const LEAGUE_LEGEND = {
  A: [['#1F7A4D', 'G4 · Libertadores'], ['#6FB28E', '5º–6º · Pré-Libertadores'], ['#4E86C2', '7º–12º · Sul-Americana'], ['#B23B3B', 'Z4 · Rebaixamento']],
  B: [['#1F7A4D', '1º–2º · Acesso direto'], ['#B7791F', '3º–6º · Mata-mata de acesso']],
};

// Linhas mostradas na tabela resumida: top 6 ou top 3 + vizinhança do meu time.
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
