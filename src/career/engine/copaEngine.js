// Copa do Brasil dentro do Modo Carreira — competição eliminatória
// paralela ao Brasileirão, com a premiação real da CBF (valores passados
// pelo usuário em 2026-11-05: R$2M pra entrar na fase de 32, R$3M nas
// oitavas, R$4M nas quartas, R$9M na semifinal, R$34M pro vice e R$78M pro
// campeão).
//
// O universo do Modo Carreira só tem 40 clubes (não os ~92 da Copa de
// verdade, que inclui times de Série C/D/estaduais que não existem aqui).
// Adaptação (pedida pelo usuário): a "Primeira Fase" — SÓ NOSSA, sem
// prêmio — é só entre os 16 clubes de SÉRIE B com elenco atual mais
// fraco (por `teamStrength`); os 4 de Série B mais fortes folgam direto
// pros 16avos, junto com os 20 de Série A inteiros (sempre folgam —
// 20+4+8=32, fechando o chaveamento que a Copa de verdade já tem pronto
// pra "Fase 5"). A partir daí, 32 clubes jogam exatamente as 5 fases
// nomeadas da Copa real, com a premiação exata da tabela oficial.
//
// Chaveamento FIXO desde o sorteio (pedido explícito do usuário, 2026-11-05:
// "literalmente é pra ser idêntico" ao modo Copa do Brasil clássico) — assim
// que os 32 classificados pros 16avos são conhecidos (vencedores da
// Primeira Fase + os clubes de bye), o chaveamento INTEIRO até a final é
// sorteado de uma vez: quem ganha o confronto de 16avos já sabe que, se o
// lado dele for até o fim, pega quem vier do outro lado da mesma metade —
// nada é resorteado fase a fase. É o que permite desenhar o chaveamento
// clássico (CupBracketModal, App.jsx, hoje exportado) com as linhas ligando
// um bloco ao próximo; um chaveamento resorteado toda fase (como este
// arquivo fazia antes) não tem posição fixa pra desenhar como árvore.
// `copa.rounds` guarda esse chaveamento no MESMO formato que
// `cupMatchOutcome`/`CupBracketModal` esperam — rounds[0..4] = 16avos..Final
// (índice clássico = `copa.round - 1`); `copa.history` continua existindo,
// em paralelo, só pro calendário (CareerCalendarScreen.jsx/CareerAdvanceModal.jsx),
// que também cobre a Primeira Fase (sem equivalente no chaveamento clássico).
//
// Os nomes das fases são repetidos aqui (em vez de importados de App.jsx,
// que já tem `CUP_ROUND_NAMES` igual pro modo Copa clássico) de propósito:
// `App.jsx` importa `CareerApp.jsx` (pra montar o Modo Carreira), que
// importa este arquivo — importar uma `const` de volta de App.jsx nesse
// ciclo quebra com "Cannot access before initialization" (TDZ), diferente
// de importar uma function declaration (hoisted, por isso
// `teamStrength`/`makePrng`/`hashSeed`/`simAiMatch` abaixo funcionam sem
// problema).
import { teamStrength, makePrng, hashSeed, simAiMatch } from '../../App.jsx';
import { CAREER_CLUB_IDS, careerClubDivision } from '../../data/career-clubs.js';
import { creditBudget } from './rosterStore.js';
import { teamForSim, legPackage } from './simHelpers.js';

export const COPA_ROUND_LABELS = ['Primeira Fase', '16 Avos de Final', 'Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Final'];

// Prêmio por ENTRAR em cada fase (não por ganhar) — bate com "prêmio por
// disputar a fase" dos dados reais da CBF pras fases iniciais, e com
// "todos os classificados" das fases finais (quem chegou lá já ganhou o
// direito de jogar, então já recebe). A Final não tem taxa de entrada
// própria — só premia campeão/vice depois de decidida.
export const COPA_ENTRY_PRIZE_BY_ROUND = [0, 2_000_000, 3_000_000, 4_000_000, 9_000_000, 0];
export const COPA_CHAMPION_PRIZE = 78_000_000;
export const COPA_RUNNER_UP_PRIZE = 34_000_000;

function shuffle(ids, rand) {
  return [...ids].sort(() => rand() - 0.5);
}

function pairConsecutive(ids) {
  const ties = [];
  for (let i = 0; i + 1 < ids.length; i += 2) ties.push({ aId: ids[i], bId: ids[i + 1] });
  return ties;
}

function clubStrength(save, clubId) {
  const ordered = [...save.clubs[clubId].roster].sort((a, b) => b.ovr - a.ovr);
  return teamStrength(Object.fromEntries(ordered.map((p, i) => [i, p])));
}

// Simula só a IDA de um confronto de IA (clube `aId` manda) — devolve só o
// placar dessa perna, pra guardar em `copa.leg1Results` até a volta
// acontecer (dias de calendário separados, ver COPA_DAYS abaixo).
function simLegIda(save, aId, bId, rand) {
  const sim = simAiMatch(teamForSim(save, aId), teamForSim(save, bId), rand);
  return { homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
}

// Simula a VOLTA (clube `bId` manda) e decide o confronto combinando com o
// placar da ida já guardado. Empate no agregado: a Primeira Fase decide com
// uma partida extra em campo neutro (decisão de simplicidade de sempre —
// ninguém vê esse confronto, documentado desde a versão anterior); 16avos
// em diante decide nos pênaltis (`onPens`), igual o chaveamento clássico
// (`cupMatchOutcome`/`penaltyResults` em App.jsx).
function simLegVoltaAndDecide(save, aId, bId, leg1, rand, isPrimeiraFase) {
  const sim = simAiMatch(teamForSim(save, bId), teamForSim(save, aId), rand);
  const leg2 = { homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
  const aggA = leg1.homeGoals + leg2.awayGoals;
  const aggB = leg1.awayGoals + leg2.homeGoals;
  let winnerId, onPens = false;
  if (aggA !== aggB) {
    winnerId = aggA > aggB ? aId : bId;
  } else if (isPrimeiraFase) {
    const decider = simAiMatch(teamForSim(save, aId), teamForSim(save, bId), rand);
    winnerId = decider.homeGoals >= decider.awayGoals ? aId : bId;
  } else {
    onPens = true;
    winnerId = rand() < 0.5 ? aId : bId;
  }
  return { aId, bId, winnerId, onPens, leg1, leg2 };
}

// A FINAL é jogo único (pedido explícito do usuário, 2026-11-06: "final da
// copa do brasil é jogo único") — sem volta, decide nos pênaltis se empatar
// (sem jogo extra), igual toda outra fase.
function resolveFinalMatchAuto(save, aId, bId, rand) {
  const sim = simAiMatch(teamForSim(save, aId), teamForSim(save, bId), rand);
  let winnerId, onPens = false;
  if (sim.homeGoals !== sim.awayGoals) {
    winnerId = sim.homeGoals > sim.awayGoals ? aId : bId;
  } else {
    onPens = true;
    winnerId = rand() < 0.5 ? aId : bId;
  }
  return { aId, bId, winnerId, onPens, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
}

// Dias (dia-do-ano, 1-365) de cada fase da Copa — espalhados mês sim, mês
// não ao longo da temporada inteira (pedido do usuário, 2026-11-06: "copa
// do brasil geralmente acontece mes sim e mes nao"), em vez de amontoados
// nas primeiras semanas como antes. Fixos (não derivados de
// `seasonCalendar`) porque a estrutura do calendário da temporada já é
// sempre a mesma (38 rodadas semanais a partir de 1º de fevereiro, pulando
// julho-agosto) independente do sorteio — só os CONFRONTOS de cada rodada
// mudam, nunca os dias.
//
// Cada fase de mata-mata (todas menos a Final) agora tem DOIS dias — ida e
// volta, ~1 semana de calendário apart — em vez de resolver as duas pernas
// no mesmo dia (pedido explícito do usuário, 2026-11-09: "ta simulando os
// dois um seguinte do outro e nao e assim na pratica"). A Final continua
// jogo único, um dia só. Conferido um a um (todos os 11 dias) pra nenhum
// cair em cima de uma rodada do Brasileirão nem de outro dia da Copa —
// `advanceDay` só trata UM evento por dia.
export const COPA_DAYS = [
  [40, 47], // Primeira Fase
  [100, 107], // 16avos de Final
  [160, 167], // Oitavas de Final
  [220, 227], // Quartas de Final (dentro do buraco jul-ago, sem Brasileirão)
  [280, 287], // Semifinal
  [340], // Final — jogo único, sem volta
];

// Dia-do-ano em que a fase ATUAL da Copa deve ser resolvida — ida ou volta,
// conforme `copa.leg` (a Final não tem leg, sempre usa o único dia dela).
export function copaCurrentDay(copa) {
  const pair = COPA_DAYS[copa.round];
  return copa.leg === 'volta' && pair.length > 1 ? pair[1] : pair[0];
}

// Sorteia a Copa do Brasil inteira pra uma temporada nova.
export function drawCopaBracket(save, rand) {
  const serieAIds = CAREER_CLUB_IDS.filter(id => careerClubDivision(id) === 'A');
  const serieBSorted = CAREER_CLUB_IDS
    .filter(id => careerClubDivision(id) === 'B')
    .sort((a, b) => clubStrength(save, a) - clubStrength(save, b));
  const weakest16SerieB = serieBSorted.slice(0, 16);
  const strongest4SerieB = serieBSorted.slice(16);
  const calendar = COPA_DAYS;
  return {
    round: 0,
    calendar,
    // 'ida' | 'volta' — qual perna falta resolver na fase atual (ver
    // COPA_DAYS/copaCurrentDay acima). A Final não usa isso (sempre
    // resolvida de uma vez, jogo único).
    leg: 'ida',
    // Placar da ida de cada confronto da fase atual, mesma ordem de `ties`
    // — preenchido na ida (playCopaRoundIda/finalizeCopaUserTieLeg1) e lido
    // na volta pra decidir o confronto (playCopaRoundVolta/
    // finalizeCopaUserTieLeg2). `null` até a ida acontecer.
    leg1Results: null,
    ties: pairConsecutive(shuffle(weakest16SerieB, rand)),
    // Os 20 clubes de Série A SEMPRE folgam da Primeira Fase (ela é só
    // entre times de Série B), junto com os 4 de Série B mais fortes —
    // 20+4+8(vencedores da Primeira Fase)=32, fechando o chaveamento que
    // a Copa de verdade já tem pronto. Só importa na transição da rodada
    // 0 pra 1; nas rodadas seguintes fica vazio.
    byeIds: [...serieAIds, ...strongest4SerieB],
    pendingRoundTieResults: null,
    // Fases já resolvidas — [{ round, roundLabel, day, ties: [{aId,bId,
    // winnerId,aggA,aggB}] }] — pro calendário mostrar o confronto e o
    // agregado de uma fase passada (CareerCalendarScreen.jsx), cobrindo
    // TODAS as fases (inclusive a Primeira Fase).
    history: [],
    // Chaveamento fixo, SÓ 16avos em diante (sem equivalente clássico pra
    // Primeira Fase) — rounds[0..4] = 16avos..Final, cada um
    // {name,matches,leg1Results,results,penaltyResults} no formato exato
    // que `cupMatchOutcome`/`CupBracketModal` (App.jsx) esperam. Preenchido
    // aos poucos — fase futura ainda não existe no array (índice undefined),
    // o próprio CupBracketModal já sabe desenhar isso como "a definir".
    rounds: [],
    champion: null,
    phase: 'active',
  };
}

// Pareamento fixo da próxima fase do chaveamento, a partir dos resultados
// (na mesma ordem de `copa.ties`, ou seja, na ordem de bloco esquerda→
// direita que o chaveamento já tinha) da fase que terminou — metade
// esquerda e metade direita continuam separadas (pares 0+1, 2+3... de cada
// metade avançam pro mesmo lado), EXCETO a transição semifinal→final, que
// junta os dois vencedores das semis (um de cada lado) num confronto só.
function nextFixedPairing(results, isSemiToFinal) {
  if (isSemiToFinal) return [{ aId: results[0].winnerId, bId: results[1].winnerId }];
  const half = results.length / 2;
  const pairUp = (offset) => {
    const out = [];
    for (let i = 0; i + 1 < half; i += 2) out.push({ aId: results[offset + i].winnerId, bId: results[offset + i + 1].winnerId });
    return out;
  };
  return [...pairUp(0), ...pairUp(half)];
}

// Fecha a Primeira Fase (nossa, só Série B) e sorteia o chaveamento FIXO
// inteiro dos 16avos a partir daqui — essa é a ÚNICA vez que o chaveamento
// tem aleatoriedade; dali pra frente só os resultados em campo decidem quem
// joga com quem (ver `nextFixedPairing`).
function advancePrimeiraFase(save, winners, rand) {
  const copa = save.copa;
  const pool = [...winners, ...(copa.byeIds || [])];
  const ties = pairConsecutive(shuffle(pool, rand));
  return {
    ...save,
    copa: { ...copa, round: 1, leg: 'ida', leg1Results: null, ties, byeIds: [], pendingRoundTieResults: null },
  };
}

// Aplica os resultados (IA + usuário, na mesma ordem de `copa.ties`) de uma
// fase do chaveamento fixo (16avos em diante): grava a entrada dessa fase em
// `copa.rounds` (pro chaveamento visual) e em `copa.history` (pro
// calendário), credita premiação se for a final, e sorteia os confrontos da
// próxima fase (ou fecha o campeonato).
function advanceBracketRound(save, results) {
  const copa = save.copa;
  const classicIdx = copa.round - 1; // copa.round 1..5 (16avos..Final) ↔ índice clássico 0..4
  const day = copaCurrentDay(copa); // dia da VOLTA (ou único dia, na Final) — quando o confronto foi de fato decidido
  const isFinalRound = copa.round === COPA_ROUND_LABELS.length - 1;

  // A final é jogo único (sem leg1 — `cupMatchOutcome` no modo clássico já
  // detecta isso sozinho via `matches.length===1` e lê só `results[0]`).
  const roundEntry = isFinalRound
    ? {
        name: COPA_ROUND_LABELS[copa.round],
        matches: [{ homeId: results[0].aId, awayId: results[0].bId }],
        leg1Results: [],
        results: [{ homeGoals: results[0].homeGoals, awayGoals: results[0].awayGoals }],
        penaltyResults: results[0].onPens ? [{ matchIdx: 0, winner: results[0].winnerId }] : [],
      }
    : {
        name: COPA_ROUND_LABELS[copa.round],
        matches: results.map(r => ({ homeId: r.aId, awayId: r.bId })),
        leg1Results: results.map(r => r.leg1),
        results: results.map(r => r.leg2),
        penaltyResults: results.map((r, i) => (r.onPens ? { matchIdx: i, winner: r.winnerId } : null)).filter(Boolean),
      };

  const rounds = [...(copa.rounds || [])];
  rounds[classicIdx] = roundEntry;

  const historyTies = isFinalRound
    ? results.map(r => ({ aId: r.aId, bId: r.bId, winnerId: r.winnerId, aggA: r.homeGoals, aggB: r.awayGoals }))
    : results.map(r => ({
        aId: r.aId, bId: r.bId, winnerId: r.winnerId,
        aggA: r.leg1.homeGoals + r.leg2.awayGoals,
        aggB: r.leg1.awayGoals + r.leg2.homeGoals,
      }));
  const history = [...(copa.history || []), { round: copa.round, roundLabel: COPA_ROUND_LABELS[copa.round], day, ties: historyTies }];

  if (isFinalRound) {
    const championId = results[0].winnerId;
    const runnerUpId = championId === results[0].aId ? results[0].bId : results[0].aId;
    let next = creditBudget(save, championId, COPA_CHAMPION_PRIZE);
    next = creditBudget(next, runnerUpId, COPA_RUNNER_UP_PRIZE);
    return { ...next, copa: { ...copa, champion: championId, phase: 'done', rounds, history, pendingRoundTieResults: null } };
  }

  const nextTies = nextFixedPairing(results, classicIdx === 3); // 3 = semifinal (BK_SIDE_ROUNDS-1 no modo clássico)
  return {
    ...save,
    copa: { ...copa, round: copa.round + 1, leg: 'ida', leg1Results: null, ties: nextTies, pendingRoundTieResults: null, rounds, history },
  };
}

// Resolve a IDA da fase atual da Copa (chamada por advanceDay quando bate o
// dia de ida dela — ver copaCurrentDay): paga a entrada pra quem disputa,
// resolve a ida de todo confronto que não envolve o usuário (guarda em
// `copa.leg1Results`), e PAUSA com `pendingUserCopaTie` se o clube do
// usuário tem jogo nessa fase — a fase só avança de verdade na VOLTA
// (playCopaRoundVolta/finalizeCopaUserTieLeg2), dias de calendário depois.
//
// A Final é exceção: continua jogo único, resolvida inteira aqui mesmo (sem
// leg/volta), exatamente como sempre foi.
export function playCopaRoundIda(save, rand) {
  const copa = save.copa;
  if (!copa || copa.phase === 'done') return { save, event: 'copa-none' };

  const entryPrize = COPA_ENTRY_PRIZE_BY_ROUND[copa.round] || 0;
  let next = save;
  if (entryPrize > 0) {
    for (const tie of copa.ties) {
      next = creditBudget(next, tie.aId, entryPrize);
      next = creditBudget(next, tie.bId, entryPrize);
    }
  }

  const isFinal = copa.round === COPA_ROUND_LABELS.length - 1;
  const myTieIdx = copa.ties.findIndex(t => t.aId === next.myClubId || t.bId === next.myClubId);
  const myTie = myTieIdx >= 0 ? copa.ties[myTieIdx] : null;

  if (isFinal) {
    const results = copa.ties.map((t, i) => (i === myTieIdx ? null : resolveFinalMatchAuto(next, t.aId, t.bId, rand)));
    if (myTie) {
      return {
        save: { ...next, copa: { ...copa, pendingRoundTieResults: results } },
        pendingUserCopaTie: { aId: myTie.aId, bId: myTie.bId, isFinal: true, finalMatch: legPackage(next, myTie.aId, myTie.bId, rand) },
        event: 'copa-tie',
        roundLabel: COPA_ROUND_LABELS[copa.round],
      };
    }
    const finishedSave = advanceBracketRound(next, results);
    return { save: finishedSave, pendingUserCopaTie: null, event: 'copa-round', roundLabel: COPA_ROUND_LABELS[copa.round] };
  }

  const isPrimeiraFase = copa.round === 0;
  const leg1Results = copa.ties.map((t, i) => (i === myTieIdx ? null : simLegIda(next, t.aId, t.bId, rand)));

  if (myTie) {
    return {
      save: { ...next, copa: { ...copa, leg1Results } }, // `leg` só vira 'volta' quando a ida do usuário for resolvida (finalizeCopaUserTieLeg1)
      pendingUserCopaTie: { aId: myTie.aId, bId: myTie.bId, leg: 'ida', leg1Match: { homeId: myTie.aId, awayId: myTie.bId } },
      event: 'copa-tie',
      roundLabel: COPA_ROUND_LABELS[copa.round],
    };
  }

  return {
    save: { ...next, copa: { ...copa, leg1Results, leg: 'volta' } },
    pendingUserCopaTie: null,
    event: 'copa-leg-ida', // ida silenciosa (sem confronto do usuário) — nao fecha a fase, so passa pra volta
    roundLabel: COPA_ROUND_LABELS[copa.round],
  };
}

// Resolve a VOLTA da fase atual (chamada quando bate o dia da volta —
// `copa.leg === 'volta'`): simula a volta de cada confronto de IA
// combinando com o placar da ida já guardado em `copa.leg1Results`, decide
// o confronto, e só então fecha a fase (`advancePrimeiraFase`/
// `advanceBracketRound`) — ou pausa de novo se o usuário tiver confronto
// nessa fase, pra ele jogar a própria volta.
export function playCopaRoundVolta(save, rand) {
  const copa = save.copa;
  const isPrimeiraFase = copa.round === 0;
  const myTieIdx = copa.ties.findIndex(t => t.aId === save.myClubId || t.bId === save.myClubId);
  const myTie = myTieIdx >= 0 ? copa.ties[myTieIdx] : null;

  const results = copa.ties.map((t, i) => {
    if (i === myTieIdx) return null;
    return simLegVoltaAndDecide(save, t.aId, t.bId, copa.leg1Results[i], rand, isPrimeiraFase);
  });

  if (myTie) {
    return {
      save: { ...save, copa: { ...copa, pendingRoundTieResults: results } },
      pendingUserCopaTie: { aId: myTie.aId, bId: myTie.bId, leg: 'volta', leg2Match: { homeId: myTie.bId, awayId: myTie.aId } },
      event: 'copa-tie',
      roundLabel: COPA_ROUND_LABELS[copa.round],
    };
  }

  const finishedSave = isPrimeiraFase
    ? advancePrimeiraFase(save, results.map(r => r.winnerId), rand)
    : advanceBracketRound(save, results);
  return { save: finishedSave, pendingUserCopaTie: null, event: 'copa-round', roundLabel: COPA_ROUND_LABELS[copa.round] };
}

// Chamada depois que o usuário joga A IDA do próprio confronto da Copa —
// só guarda o placar em `copa.leg1Results` e vira pra `leg: 'volta'`; a
// fase NÃO avança ainda (quem termina é finalizeCopaUserTieLeg2, no dia da
// volta). `legResult` é o objeto de `legPackage` (mesmo formato que
// LegMatch/CareerCopaLegScreen já usam) — `aId` manda a ida, então
// `legResult.sim.home/awayGoals` já está na ordem certa sem inverter nada.
export function finalizeCopaUserTieLeg1(save, legResult) {
  const tie = save.pendingUserCopaTie;
  if (!tie) return save;
  const myTieIdx = save.copa.ties.findIndex(t => t.aId === tie.aId && t.bId === tie.bId);
  const leg1Results = [...(save.copa.leg1Results || [])];
  leg1Results[myTieIdx] = { homeGoals: legResult.sim.homeGoals, awayGoals: legResult.sim.awayGoals };
  return { ...save, copa: { ...save.copa, leg1Results, leg: 'volta' }, pendingUserCopaTie: null };
}

// Chamada depois que o usuário joga A VOLTA — combina com a ida guardada
// (`copa.leg1Results`), decide o confronto nos pênaltis se empatar no
// agregado (mesma regra de sempre pro confronto do usuário, independente
// da fase), combina com os confrontos de IA já resolvidos na mesma fase
// (`copa.pendingRoundTieResults`, preenchidos por playCopaRoundVolta) e
// termina o trabalho de avançar a fase (ou fechar o campeonato).
export function finalizeCopaUserTieLeg2(save, legResult) {
  const tie = save.pendingUserCopaTie;
  if (!tie) return save;
  const myTieIdx = save.copa.ties.findIndex(t => t.aId === tie.aId && t.bId === tie.bId);
  const leg1 = save.copa.leg1Results[myTieIdx];
  // `bId` manda a volta (ver leg2Match em playCopaRoundVolta) — home/away
  // aqui já são bId/aId, mesma convenção que simLegVoltaAndDecide usa.
  const leg2 = { homeGoals: legResult.sim.homeGoals, awayGoals: legResult.sim.awayGoals };
  const aggA = leg1.homeGoals + leg2.awayGoals;
  const aggB = leg1.awayGoals + leg2.homeGoals;
  const rand = makePrng(hashSeed(`${save.seed}|copa-user-tie-pens|${save.season}|${save.copa.round}`));
  let winnerId, onPens = false;
  if (aggA !== aggB) {
    winnerId = aggA > aggB ? tie.aId : tie.bId;
  } else {
    onPens = true;
    winnerId = rand() < 0.5 ? tie.aId : tie.bId;
  }
  const myTieResult = { aId: tie.aId, bId: tie.bId, winnerId, onPens, leg1, leg2 };

  const results = [...(save.copa.pendingRoundTieResults || [])];
  results[myTieIdx] = myTieResult;

  const isPrimeiraFase = save.copa.round === 0;
  const advRand = makePrng(hashSeed(`${save.seed}|copa-advance|${save.season}|${save.copa.round}`));
  const advanced = isPrimeiraFase
    ? advancePrimeiraFase(save, results.map(r => r.winnerId), advRand)
    : advanceBracketRound(save, results);
  return { ...advanced, pendingUserCopaTie: null };
}

// Chamada pela tela de partida única (CareerMatchDayScreen reaproveitada,
// ver CareerApp.jsx) depois que o usuário jogou a FINAL da Copa do Brasil —
// o placar já saiu pronto em `pendingUserCopaTie.finalMatch.sim` (mesma
// convenção de `resolveUserMatch` pro jogo comum do Brasileirão: só aplica
// o que já foi decidido, sem pedir nenhum resultado de volta).
export function resolveCopaFinalUserMatch(save) {
  const tie = save.pendingUserCopaTie;
  if (!tie?.isFinal) return save;
  const { homeGoals, awayGoals } = tie.finalMatch.sim;
  const rand = makePrng(hashSeed(`${save.seed}|copa-final-pens|${save.season}`));
  let winnerId, onPens = false;
  if (homeGoals !== awayGoals) {
    winnerId = homeGoals > awayGoals ? tie.aId : tie.bId;
  } else {
    onPens = true;
    winnerId = rand() < 0.5 ? tie.aId : tie.bId;
  }
  const myResult = { aId: tie.aId, bId: tie.bId, winnerId, onPens, homeGoals, awayGoals };

  const myTieIdx = save.copa.ties.findIndex(t => t.aId === tie.aId && t.bId === tie.bId);
  const results = [...(save.copa.pendingRoundTieResults || [])];
  results[myTieIdx] = myResult;

  const advanced = advanceBracketRound(save, results);
  return { ...advanced, pendingUserCopaTie: null };
}
