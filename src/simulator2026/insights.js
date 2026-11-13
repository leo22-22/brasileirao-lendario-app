// Leituras da tabela para a tela do Simulador 2026 (redesenho de 2026-11-13).
// Tudo puro: recebe a tabela/listas e devolve números e frases. Não simula
// nada — o placar de cada jogo continua saindo só de prepareMatch
// (matchPrng + simAiMatch) em Simulator2026App.jsx.
import { applyRoundToTable } from '../App.jsx';

// Mesmas faixas da Tabela da carreira (getZoneInfo): G4, 5º–6º pré-Libertadores,
// 7º–12º Sul-Americana, 17º–20º Z4.
export function zoneOf(pos) {
  if (pos <= 4) return { key: 'g4', label: 'G4', color: '#1F7A4D' };
  if (pos <= 6) return { key: 'g6', label: 'Pré-Liberta', color: '#6FB28E' };
  if (pos <= 12) return { key: 'sa', label: 'Sul-Americana', color: '#4E86C2' };
  if (pos >= 17) return { key: 'z4', label: 'Z4', color: '#B23B3B' };
  return null;
}

const posOf = (table, id) => table.findIndex(r => r.id === id) + 1;

// Forma dos últimos `count` jogos (reais + simulados), mais antigo → mais recente.
export function formOf(clubId, realResults, log, count = 5) {
  const all = [...realResults].sort((a, b) => a.round - b.round);
  // jogo atrasado da rodada 21 entra na ordem em que foi jogado (no log)
  const games = [...all, ...log].filter(m => m.homeId === clubId || m.awayId === clubId);
  return games.slice(-count).map(m => {
    const home = m.homeId === clubId;
    const gf = home ? m.homeGoals : m.awayGoals;
    const ga = home ? m.awayGoals : m.homeGoals;
    return gf > ga ? 'V' : gf < ga ? 'D' : 'E';
  });
}

// Jogos que ainda faltam para cada clube (a partir do jogo atual).
export function remainingByClub(remainingMatches, fromIdx) {
  const left = {};
  for (const m of remainingMatches.slice(fromIdx)) {
    left[m.homeId] = (left[m.homeId] || 0) + 1;
    left[m.awayId] = (left[m.awayId] || 0) + 1;
  }
  return left;
}

const names = (rows, nameOf) => {
  const ns = rows.map(r => nameOf(r.id));
  if (ns.length <= 2) return ns.join(' e ');
  return `${ns.slice(0, 2).join(', ')} e mais ${ns.length - 2}`;
};

// "O que está em jogo" para um dos lados do próximo jogo: aplica uma
// vitória hipotética (1×0) com a mesma applyRoundToTable e compara posições.
// Se a vitória não muda nada de relevante, olha o risco de uma derrota.
export function stakesFor(table, match, clubId, nameOf) {
  const isHome = match.homeId === clubId;
  const win = { homeId: match.homeId, awayId: match.awayId, homeGoals: isHome ? 1 : 0, awayGoals: isHome ? 0 : 1 };
  const loss = { homeId: match.homeId, awayId: match.awayId, homeGoals: isHome ? 0 : 1, awayGoals: isHome ? 1 : 0 };
  const before = posOf(table, clubId);
  const row = table.find(r => r.id === clubId);
  const afterWinTable = applyRoundToTable(table, [win]);
  const afterWin = posOf(afterWinTable, clubId);
  const passed = table.filter((r, i) => i + 1 < before && posOf(afterWinTable, r.id) > afterWin && r.id !== clubId);
  const n = table.length;
  if (afterWin === 1 && before > 1) return 'Se vencer, assume a liderança.';
  if (before === 1) {
    const second = table[1];
    return `Se vencer, abre ${row.pts + 3 - second.pts} pts para o ${nameOf(second.id)}.`;
  }
  if (before > n - 4 && afterWin <= n - 4) return `Se vencer, sai do Z4${passed.length ? ` e passa ${names(passed, nameOf)}` : ''}.`;
  if (before > n - 4) {
    // Ainda no Z4 mesmo vencendo: a régua é o 16º, não o G4.
    const gap = table[n - 5].pts - (row.pts + 3);
    return gap > 0 ? `Mesmo vencendo, segue no Z4, a ${gap} pt${gap === 1 ? '' : 's'} do ${nameOf(table[n - 5].id)}.` : 'Se vencer, encosta no 16º e briga para sair do Z4.';
  }
  if (before > 4 && afterWin <= 4) return `Se vencer, entra no G4${passed.length ? ` e passa ${names(passed, nameOf)}` : ''}.`;
  const afterLossTable = applyRoundToTable(table, [loss]);
  const afterLoss = posOf(afterLossTable, clubId);
  if (before <= n - 4 && afterLoss > n - 4) return 'Uma derrota pode deixá-lo no Z4.';
  if (before <= 4 && afterLoss > 4) return 'Uma derrota pode tirá-lo do G4.';
  if (passed.length) return `Se vencer, chega a ${row.pts + 3} pts e passa ${names(passed, nameOf)}.`;
  if (before > 4) {
    const gap = table[3].pts - (row.pts + 3);
    if (gap > 0 && gap <= 6) return `Se vencer, fica a ${gap} pt${gap === 1 ? '' : 's'} do G4.`;
  }
  return `Se vencer, chega a ${row.pts + 3} pts.`;
}

// Blocos "Disputas": título, G4 e Z4 a partir da tabela atual e dos pontos
// ainda em jogo (3 por jogo restante de cada clube).
export function disputes(table, left, nameOf) {
  const maxPts = (r) => r.pts + 3 * (left[r.id] || 0);
  const n = table.length;
  const [leader, second] = table;
  const others = table.slice(1);
  const bestOther = Math.max(...others.map(maxPts));
  const leaderLeft = 3 * (left[leader.id] || 0);
  // Pontos que o líder precisa para ninguém mais alcançar (estritamente à
  // frente — empate em pontos iria para vitórias, então não conta como garantido).
  const need = Math.max(0, bestOther - leader.pts + 1);
  const championDecided = leader.pts > bestOther;
  const title = {
    leader: leader.id, second: second.id, gap: leader.pts - second.pts, pointsLeft: leaderLeft,
    decided: championDecided, need,
    text: championDecided
      ? `${nameOf(leader.id)} é campeão: ninguém mais alcança.`
      : need <= leaderLeft
        ? `${nameOf(second.id)} ainda alcança. Com ${need} dos ${leaderLeft} pontos o ${nameOf(leader.id)} é campeão sem depender de ninguém.`
        : `O ${nameOf(leader.id)} depende de tropeços: mesmo vencendo tudo, alguém pode chegar a ${bestOther} pts.`,
  };
  const fourth = table[3], fifth = table[4];
  const g4 = {
    a: fourth.id, b: fifth.id, gap: fourth.pts - fifth.pts,
    text: fourth.pts === fifth.pts
      ? `${nameOf(fourth.id)} e ${nameOf(fifth.id)} empatados em ${fourth.pts}. Decide no saldo de vitórias.`
      : `${nameOf(fifth.id)} é o primeiro de fora, a ${fourth.pts - fifth.pts} pt${fourth.pts - fifth.pts === 1 ? '' : 's'} do G4.`,
  };
  // Rebaixado de verdade: pelo menos 16 clubes já fora de alcance.
  const relegated = table.filter(r => table.filter(o => o.id !== r.id && o.pts > maxPts(r)).length >= n - 4).map(r => r.id);
  const safeLine = table[n - 5]; // 16º
  const z4Row = table[n - 4];    // 17º
  const nearZ4 = table.filter(r => Math.abs(r.pts - z4Row.pts) <= 4);
  const z4Open = relegated.length < 4;
  const z4 = {
    count: nearZ4.length, open: z4Open, relegated,
    text: !z4Open
      ? `Rebaixados: ${relegated.map(nameOf).join(', ')}.`
      : `${nearZ4.length} times em 4 pts do ${n - 3}º lugar, do ${nameOf(nearZ4[0].id)} (${nearZ4[0].pts}) ao ${nameOf(nearZ4[nearZ4.length - 1].id)} (${nearZ4[nearZ4.length - 1].pts}).${relegated.length ? ` Rebaixado${relegated.length > 1 ? 's' : ''}: ${relegated.map(nameOf).join(', ')}.` : ''}`,
    safeGap: safeLine.pts - z4Row.pts,
  };
  const maxLeft = Math.max(0, ...table.map(r => 3 * (left[r.id] || 0)));
  return { title, g4, z4, maxLeft };
}

// Classificação real ao fim da rodada 34 (ponto de partida das setas de movimento).
export function realBaselinePositions(initialTable) {
  return Object.fromEntries(initialTable.map((r, i) => [r.id, i + 1]));
}
