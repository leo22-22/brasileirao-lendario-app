// Situação do Brasileirão 2026 real a partir dos placares já cadastrados
// (REAL_RESULTS_2026) — sem React e sem App.jsx, pra home e o Simulador
// lerem o mesmo número. Quando o último jogo real entra, `finished` vira
// true e o Simulador trava na tela de temporada encerrada (decisão do
// usuário: "quando acabar só bloqueamos"; o 2027 vem com a tabela nova).
import { REAL_RESULTS_2026 } from '../data/brasileirao-2026-real-results.js';
import { SERIE_A_2026_FIXTURES } from '../data/serie-a-2026-fixtures.js';

const played = new Set(REAL_RESULTS_2026.map(r => `${r.round}|${r.homeId}|${r.awayId}`));
const pending = [];
SERIE_A_2026_FIXTURES.forEach((round, i) => round.forEach(m => {
  if (!played.has(`${i + 1}|${m.homeId}|${m.awayId}`)) pending.push({ round: i + 1, ...m });
}));

export const SIM_2026 = {
  finished: pending.length === 0,
  pendingCount: pending.length,
  // Primeira rodada que ainda tem jogo sem placar real.
  nextRound: pending.length ? Math.min(...pending.map(m => m.round)) : null,
};
