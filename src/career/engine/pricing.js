// Preço de mercado de um jogador no Modo Carreira.
//
// Fonte principal: src/data/market-values.js (valor real do Transfermarkt,
// coletado um a um pros 20 clubes de Série A 2026) — esse valor está em
// EUROS (ver comentário no topo do arquivo), então é convertido pra reais
// aqui antes de virar o preço do jogo (taxa fixa aproximada, não é preciso
// ser exata pra um jogo — só não pode tratar euro como se já fosse real,
// que subvalorizava MUITO os jogadores com preço real do Transfermarkt).
//
// Fallback (jogador sem valor real — todo o resto da Série A e toda a
// Série B): PrecoFinal = 5.000.000 × FatorOverall × FatorIdade × FatorClube
// — esse `5.000.000` já é em reais desde que foi especificado (não vem do
// Transfermarkt), não precisa de conversão nenhuma.
import { MARKET_VALUES } from '../../data/market-values.js';
import { careerClubTier } from '../../data/career-clubs.js';

// Taxa EUR→BRL fixa e aproximada (câmbio real de 2026 girando entre ~5,8
// e ~6,0) — não é pra ser exata, só pra parar de tratar euro como real.
export const EUR_TO_BRL = 5.9;

const PRECO_BASE = 5_000_000;

export function computeFatorOverall(ovr) {
  return Math.pow(ovr / 75, 3.5);
}

// Boa parte do elenco-base (os ~400 de teams.js) já tem idade real (`age`)
// preenchida clube a clube pelo usuário. Clubes ainda sem essa atualização
// continuam sem o campo `age` — pra esses, trata como se estivesse na faixa
// 22-28 (fator 1.2) em vez de usar uma idade inventada. Jovens gerados pela
// categoria de base (src/career/engine/youth.js) sempre carregam `age` de
// verdade e usam a fórmula completa abaixo.
export const LEGACY_PLAYER_DEFAULT_FATOR_IDADE = 1.2;

export function computeFatorIdade(age) {
  if (age == null) return LEGACY_PLAYER_DEFAULT_FATOR_IDADE;
  if (age <= 21) return 1.4;
  if (age <= 28) return 1.2;
  if (age <= 32) return 1.0;
  return Math.pow(0.95, age - 32);
}

export function computeFatorClube(clubId) {
  return careerClubTier(clubId) === 'elite' ? 1.15 : 1.0;
}

// Preço de um jogador num clube específico (o mesmo jogador vale diferente
// dependendo de quem o vende — reflete o FatorClube). `player` é
// {name, pos, ovr, age?} — `age` só existe em jovens da base.
export function computePlayerValue(player, clubId) {
  const realValueEur = MARKET_VALUES[clubId]?.[player.name];
  if (realValueEur != null) return Math.round(realValueEur * EUR_TO_BRL);
  const fatorOverall = computeFatorOverall(player.ovr);
  const fatorIdade = computeFatorIdade(player.age);
  const fatorClube = computeFatorClube(clubId);
  return Math.round(PRECO_BASE * fatorOverall * fatorIdade * fatorClube);
}
