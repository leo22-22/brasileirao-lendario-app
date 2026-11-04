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

// Premiação por posição final (índice 0 = 1º lugar). Série B recebe 35%
// do valor equivalente da Série A — menos dinheiro em jogo, mas ainda
// relevante pra disputa de acesso.
export const PRIZE_MONEY_SERIE_A = [
  12_000_000, 9_000_000, 7_000_000, 6_000_000, 5_000_000, 4_200_000, 3_600_000, 3_100_000,
  2_700_000, 2_300_000, 2_000_000, 1_700_000, 1_450_000, 1_250_000, 1_050_000, 900_000,
  750_000, 650_000, 550_000, 450_000,
];
export const PRIZE_MONEY_SERIE_B = PRIZE_MONEY_SERIE_A.map(v => Math.round(v * 0.35));

// `position` é 1-based (1º, 2º, ...).
export function computePrizeMoney(position, division) {
  const table = division === 'A' ? PRIZE_MONEY_SERIE_A : PRIZE_MONEY_SERIE_B;
  return table[position - 1] ?? 0;
}
