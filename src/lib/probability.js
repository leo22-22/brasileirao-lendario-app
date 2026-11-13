// Probabilidade de resultado e constantes de mando/rivalidade — usadas pela
// simulação (simAiMatch, App.jsx) e por TODAS as prévias de jogo. Uma só
// fonte: carreira, Simulador 2026 e modos clássicos chamam daqui.

export const HOME_ADVANTAGE = 1.05;

// Clássicos/rivalidades históricas — jogo mais aberto e disputado quando os
// dois times se enfrentam (leve boost pros dois lados, não só um favorito).
export function rivalryKey(a, b) { return [a, b].sort().join('|'); }
export const RIVALRY_PAIRS = [
  ['Flamengo', 'Fluminense'], ['Flamengo', 'Vasco'], ['Flamengo', 'Botafogo'],
  ['Vasco', 'Botafogo'], ['Vasco', 'Fluminense'], ['Fluminense', 'Botafogo'],
  ['Corinthians', 'Palmeiras'], ['Corinthians', 'Sao Paulo'], ['Sao Paulo', 'Palmeiras'],
  ['Santos', 'Corinthians'], ['Santos', 'Sao Paulo'], ['Santos', 'Palmeiras'],
  ['Gremio', 'Internacional'],
  ['Cruzeiro', 'Atletico-MG'],
  ['Bahia', 'Vitoria'],
  ['Athletico-PR', 'Coritiba'],
  ['Fortaleza', 'Ceara'],
];
const RIVALRIES = new Set(RIVALRY_PAIRS.map(([a, b]) => rivalryKey(a, b)));
export function isRivalryMatch(clubA, clubB) {
  if (!clubA || !clubB) return false;
  return RIVALRIES.has(rivalryKey(clubA, clubB));
}
export const RIVALRY_BOOST = 1.05;

export function poissonPmf(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

// Chance de vitória/empate/derrota ANTES da partida rolar — mesma fórmula
// exata de `simAiMatch` (diff*0.042, vantagem de casa, rivalidade), só que
// somando a distribuição de Poisson dos dois times (gols 0-10 cada) pra
// cada resultado possível, em vez de sortear UMA amostra. Só pra exibir
// uma prévia informativa (ex. Modo Carreira) — a simulação de verdade
// continua usando poissonSample normalmente, isso nunca decide nada.
export function matchOutcomeProbabilities(homeTeam, awayTeam) {
  const diff = homeTeam.ovr - awayTeam.ovr;
  let homeExp = Math.max(0.2, 1.3 + diff * 0.042) * HOME_ADVANTAGE;
  let awayExp = Math.max(0.2, 1.3 - diff * 0.042);
  if (isRivalryMatch(homeTeam.club, awayTeam.club)) { homeExp *= RIVALRY_BOOST; awayExp *= RIVALRY_BOOST; }
  const MAX_GOALS = 10;
  let homeWin = 0, draw = 0, awayWin = 0;
  for (let h = 0; h <= MAX_GOALS; h++) {
    const ph = poissonPmf(h, homeExp);
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = ph * poissonPmf(a, awayExp);
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
    }
  }
  const total = homeWin + draw + awayWin;
  return { homeWin: homeWin / total, draw: draw / total, awayWin: awayWin / total };
}
