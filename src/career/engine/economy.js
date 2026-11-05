// Economia do Modo Carreira: renda de público (só jogos em casa) e
// premiação de fim de temporada. Números fixos por tier — de propósito
// simples e previsíveis, pra o jogador conseguir planejar o orçamento sem
// precisar adivinhar uma fórmula escondida.
import { CAREER_CLUB_META, careerClubTier } from '../../data/career-clubs.js';

export const STARTING_BUDGET_BY_TIER = {
  elite: 60_000_000,
  grande: 28_000_000,
  medio: 12_000_000,
  pequeno: 5_000_000,
};

export const TICKET_PRICE_BY_TIER = { elite: 80, grande: 55, medio: 35, pequeno: 22 };
export const OCCUPANCY_BY_TIER = { elite: 0.70, grande: 0.60, medio: 0.50, pequeno: 0.45 };

export function startingBudgetFor(clubId) {
  return STARTING_BUDGET_BY_TIER[careerClubTier(clubId)] ?? STARTING_BUDGET_BY_TIER.pequeno;
}

// Renda de um jogo — só quando o clube joga em casa; times visitantes não
// recebem nada deste jogo (bilheteria sempre vai pro dono do estádio).
export function computeMatchdayRevenue(clubId, isHome) {
  if (!isHome) return 0;
  const meta = CAREER_CLUB_META[clubId];
  if (!meta) return 0;
  const tier = meta.tier;
  const occupancy = OCCUPANCY_BY_TIER[tier] ?? OCCUPANCY_BY_TIER.pequeno;
  const ticketPrice = TICKET_PRICE_BY_TIER[tier] ?? TICKET_PRICE_BY_TIER.pequeno;
  return Math.round(meta.stadiumCapacity * occupancy * ticketPrice);
}

// Premiação por posição final (índice 0 = 1º lugar) — valores de
// referência reais da CBF (2026-11-05, dados passados pelo usuário).
// Série A: só o 1º-16º recebe prêmio por posição; 17º-20º (Z-4) não leva
// nada além das cotas fixas de participação (já embutidas no orçamento
// inicial/renda de bilheteria, não nesta tabela).
export const PRIZE_MONEY_SERIE_A = [
  48_100_000, 45_700_000, 43_300_000, 40_900_000, 38_500_000, 36_100_000, 33_700_000, 31_300_000,
  28_900_000, 26_500_000, 20_500_000, 19_200_000, 17_600_000, 17_200_000, 16_700_000, 16_200_000,
  0, 0, 0, 0,
];
// Série B: só o G-4 (quem sobe) recebe prêmio extra da CBF por posição —
// 5º-20º fica só com a cota fixa de participação (mesma lógica do Z-4 da
// Série A, fora desta tabela).
export const PRIZE_MONEY_SERIE_B = [
  3_500_000, 1_500_000, 1_500_000, 1_500_000,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

// `position` é 1-based (1º, 2º, ...).
export function computePrizeMoney(position, division) {
  const table = division === 'A' ? PRIZE_MONEY_SERIE_A : PRIZE_MONEY_SERIE_B;
  return table[position - 1] ?? 0;
}
