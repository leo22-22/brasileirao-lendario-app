// Envelhecimento de fim de temporada — agora pra TODO jogador com idade
// conhecida (real ou da base), não só pra categoria de base como antes
// (ver antiga applyYouthGrowth, substituída por este arquivo). Cobre:
// aposentadoria (chance crescente a partir de 35, praticamente certa aos
// 41), queda de overall pra quem está envelhecendo, e um ganho MODESTO de
// overall pra jogador jovem — simplificação deliberada e documentada: o
// motor não tem "desempenho de temporada" de verdade por jogador (só
// resultado agregado do time), então o crescimento é um proxy ligado só à
// idade, não abusivo (chance baixa, +1 de cada vez), pra não inflar o
// elenco inteiro ano após ano.
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

// Devolve o jogador já envelhecido (+1 ano, overall ajustado) OU `null` se
// ele se aposentou nesta temporada — quem chama deve filtrar os `null`s
// fora do elenco. Jogador sem `age` nenhuma (não deveria mais acontecer
// depois do backfill de idade real/sintética, mas mantido defensivo) só
// passa direto, sem aposentar nem crescer/decair.
export function applySeasonAging(player, rand) {
  if (player.age == null) return player;
  const age = player.age + 1;
  if (rand() < retirementChance(age)) return null;

  let ovr = player.ovr;
  if (player.isYouth && ovr < player.potential) {
    ovr = Math.min(player.potential, ovr + player.growthPerSeason);
  } else if (age <= 23) {
    if (rand() < 0.25) ovr = Math.min(94, ovr + 1);
  } else if (age >= 34) {
    const roll = rand();
    if (roll < 0.5) ovr -= 2;
    else if (roll < 0.8) ovr -= 1;
  } else if (age >= 30) {
    if (rand() < 0.3) ovr -= 1;
  }
  ovr = Math.max(40, ovr);

  return { ...player, age, ovr };
}
