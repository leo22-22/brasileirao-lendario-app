// Preço de mercado de um jogador no Modo Carreira.
//
// Fonte principal: src/data/market-values.js (valor real do Transfermarkt,
// coletado um a um pros 20 clubes de Série A 2026). O valor lá está em
// euros (ver comentário no topo do arquivo) — aqui ele é usado DIRETO como
// a própria unidade de moeda do jogo (sem conversão cambial) e exibido
// como "R$" na interface. Decisão de simplicidade: inventar uma taxa de
// conversão só criaria mais um número pra manter sem nenhum ganho de
// jogabilidade.
//
// Fallback (jogador sem valor real — todo o resto da Série A e toda a
// Série B): PrecoFinal = 5.000.000 × FatorOverall × FatorIdade × FatorClube.
import { MARKET_VALUES } from '../../data/market-values.js';
import { careerClubTier } from '../../data/career-clubs.js';

const PRECO_BASE = 5_000_000;

export function computeFatorOverall(ovr) {
  return Math.pow(ovr / 75, 3.5);
}

// Jogador real do elenco-base (os ~400 de teams.js) não tem idade
// conhecida — nenhum tem o campo `age`. Decisão deliberada: tratar como se
// estivesse na faixa 22-28 (fator 1.2), em vez de reescanear idade real de
// centenas de jogadores no Transfermarkt (fora de escopo). Só os jovens
// gerados pela categoria de base (src/career/engine/youth.js) carregam
// `age` de verdade e usam a fórmula completa abaixo.
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
  const realValue = MARKET_VALUES[clubId]?.[player.name];
  if (realValue != null) return realValue;
  const fatorOverall = computeFatorOverall(player.ovr);
  const fatorIdade = computeFatorIdade(player.age);
  const fatorClube = computeFatorClube(clubId);
  return Math.round(PRECO_BASE * fatorOverall * fatorIdade * fatorClube);
}
