// Envelhecimento de fim de temporada — agora pra TODO jogador com idade
// conhecida (real ou da base), não só pra categoria de base como antes
// (ver antiga applyYouthGrowth, substituída por este arquivo). Cobre:
// aposentadoria (chance crescente a partir de 35, praticamente certa aos
// 41), queda de overall pra quem está envelhecendo, e crescimento de
// overall ligado a QUANTO o jogador jogou na temporada (`stats.matches`,
// ver seasonStats.js) — pedido explícito do usuário (2026-11-11: "tem
// que evoluir principalmente que joga muito ou mais jovens, se ele for
// jovem e jogar muito evoluir mais"). Antes o crescimento era só um proxy
// fraco ligado à idade (25% de +1 pra ≤23, nada pra 24-29); agora quem
// joga bastante tem chance real de subir em qualquer idade abaixo dos 30,
// e jovem+joga-muito é o caso com a MAIOR chance (inclusive de +2 de
// uma vez, não só +1).
//
// Jogador da base (isYouth) que ainda não bateu o potencial continua
// crescendo pela própria curva de youth.js (growthPerSeason até
// `potential`) em vez da regra genérica abaixo — só passa a usar a regra
// genérica depois de bater o teto do potencial, como qualquer outro
// jogador adulto.

const RETIRE_CHANCE_BY_AGE = {
  35: 0.05, 36: 0.12, 37: 0.22, 38: 0.35, 39: 0.55, 40: 0.8,
};

function retirementChance(age) {
  if (age < 35) return 0;
  if (age >= 41) return 1;
  return RETIRE_CHANCE_BY_AGE[age] ?? 0.9;
}

// 3 níveis de quanto o jogador jogou na temporada (de 38 rodadas
// possíveis) — "baixo" é só banco/pouco uso, "alto" é praticamente
// titular absoluto. Quem mal joga não ganha chance de crescer nenhuma:
// sem minutos, sem desenvolvimento, igual na vida real.
function playTier(matches) {
  if (matches >= 20) return 'alto';
  if (matches >= 8) return 'medio';
  return 'baixo';
}

// Chance de +1 de overall por idade × quanto jogou. `null`/0 em "baixo"
// pra qualquer idade = sem chance de crescer nenhuma (só queda, se a
// idade já cair nessa faixa). 24-29 "baixo" também é 0 — antes essa faixa
// inteira nunca crescia, mesmo jogando bastante; agora só não cresce se
// realmente não jogou.
const GROWTH_CHANCE = {
  jovem: { baixo: 0.10, medio: 0.30, alto: 0.55 }, // ≤23
  adulto: { baixo: 0, medio: 0.08, alto: 0.18 }, // 24-29
};
// Tamanho do ganho de overall quando o jogador cresce — antes sempre +1
// (só jovem+alto tinha 15% de virar +2). Pedido explícito do usuário
// (2026-11-13): "o jogador pode subir 2 3 4 de overall dependendo da
// temporada/idade" — cada tier agora tem uma distribuição de pesos pro
// tamanho do salto; saltos de +3/+4 continuam raros, praticamente só pra
// jovem que foi titular absoluto (tier "alto").
const GROWTH_GAIN_WEIGHTS = {
  jovem: {
    baixo: [[1, 1]],
    medio: [[1, 0.8], [2, 0.2]],
    alto: [[1, 0.45], [2, 0.33], [3, 0.17], [4, 0.05]],
  },
  adulto: {
    baixo: [[1, 1]], // nunca entra aqui de verdade (chance 0 em GROWTH_CHANCE.adulto.baixo), mantido defensivo
    medio: [[1, 1]],
    alto: [[1, 0.7], [2, 0.3]],
  },
};

function pickGain(weights, rand) {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = rand() * total;
  for (const [gain, w] of weights) {
    roll -= w;
    if (roll <= 0) return gain;
  }
  return weights[weights.length - 1][0];
}

// Queda de overall ao envelhecer — antes só olhava a idade, ignorando
// quanto o jogador jogou. Pedido explícito do usuário: "se ele jogou
// muito mas é mais velho não faz sentido descer tanto o overall dele" —
// agora quem foi titular de verdade (tier "alto") numa idade avançada cai
// MENOS (em chance e em tamanho) que quem mal jogou (tier "baixo", que
// mantém exatamente o mesmo comportamento de antes — pior cenário/sem
// dado de uso real é o fallback mais seguro).
const DECLINE_34_BY_TIER = {
  alto: { chance2: 0.15, chance1: 0.30 },
  medio: { chance2: 0.30, chance1: 0.30 },
  baixo: { chance2: 0.50, chance1: 0.30 },
};
const DECLINE_30_CHANCE_BY_TIER = { alto: 0.10, medio: 0.20, baixo: 0.30 };

// Devolve o jogador já envelhecido (+1 ano, overall ajustado) OU `null` se
// ele se aposentou nesta temporada — quem chama deve filtrar os `null`s
// fora do elenco. Jogador sem `age` nenhuma (não deveria mais acontecer
// depois do backfill de idade real/sintética, mas mantido defensivo) só
// passa direto, sem aposentar nem crescer/decair. `stats` (opcional,
// shape de seasonStats.js) é quantas partidas ele jogou NESTA temporada
// — sem isso (chamada antiga, ou save sem seasonPlayerStats ainda) cai no
// nível "baixo", mantendo o comportamento antigo como fallback seguro.
export function applySeasonAging(player, rand, stats) {
  if (player.age == null) return player;
  const age = player.age + 1;
  if (rand() < retirementChance(age)) return null;

  const tier = playTier(stats?.matches || 0);
  let ovr = player.ovr;
  if (player.isYouth && ovr < player.potential) {
    ovr = Math.min(player.potential, ovr + player.growthPerSeason);
  } else if (age <= 23) {
    if (rand() < GROWTH_CHANCE.jovem[tier]) {
      ovr = Math.min(94, ovr + pickGain(GROWTH_GAIN_WEIGHTS.jovem[tier], rand));
    }
  } else if (age >= 34) {
    const d = DECLINE_34_BY_TIER[tier];
    const roll = rand();
    if (roll < d.chance2) ovr -= 2;
    else if (roll < d.chance2 + d.chance1) ovr -= 1;
  } else if (age >= 30) {
    if (rand() < DECLINE_30_CHANCE_BY_TIER[tier]) ovr -= 1;
  } else if (rand() < GROWTH_CHANCE.adulto[tier]) {
    ovr = Math.min(94, ovr + pickGain(GROWTH_GAIN_WEIGHTS.adulto[tier], rand));
  }
  ovr = Math.max(40, ovr);

  return { ...player, age, ovr };
}
