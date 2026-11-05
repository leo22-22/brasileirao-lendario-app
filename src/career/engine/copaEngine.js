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
import { teamForSim, resolveTwoLegTieAuto } from './simHelpers.js';

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

// Agregado de ida+volta de um confronto já resolvido, no formato que o
// histórico do CALENDÁRIO guarda (ties:[{aId,bId,winnerId,aggA,aggB}]) —
// só usado pela Primeira Fase (as fases do chaveamento fixo guardam leg1/leg2
// separados, ver `resolveBracketTieAuto`/`advanceBracketRound`).
function tieAggregate(tie, aId, bId) {
  if (tie.aggA != null) return tie;
  return {
    aId, bId, winnerId: tie.winnerId,
    aggA: tie.leg1.homeGoals + tie.leg2.awayGoals,
    aggB: tie.leg1.awayGoals + tie.leg2.homeGoals,
  };
}

// Confronto do chaveamento fixo (16avos em diante) entre dois clubes de IA —
// ida+volta SEPARADAS (pro chaveamento clássico desenhar certinho) e empate
// no agregado decidido nos pênaltis (sem jogo extra) — igual o modo clássico
// faz (ver `cupMatchOutcome`/`penaltyResults` em App.jsx).
function resolveBracketTieAuto(save, aId, bId, rand) {
  const leg1 = simAiMatch(teamForSim(save, aId), teamForSim(save, bId), rand);
  const leg2 = simAiMatch(teamForSim(save, bId), teamForSim(save, aId), rand);
  const aggA = leg1.homeGoals + leg2.awayGoals;
  const aggB = leg1.awayGoals + leg2.homeGoals;
  let winnerId, onPens = false;
  if (aggA !== aggB) {
    winnerId = aggA > aggB ? aId : bId;
  } else {
    onPens = true;
    winnerId = rand() < 0.5 ? aId : bId;
  }
  return {
    aId, bId, winnerId, onPens,
    leg1: { homeGoals: leg1.homeGoals, awayGoals: leg1.awayGoals },
    leg2: { homeGoals: leg2.homeGoals, awayGoals: leg2.awayGoals },
  };
}

// Sorteia a Copa do Brasil inteira pra uma temporada nova. `leagueCalendar`
// é o `seasonCalendar` do Brasileirão já sorteado pra essa temporada — as
// 6 datas da Copa (Primeira Fase + 5 fases nomeadas) caem 3 dias depois
// das 6 primeiras rodadas dele, o que nunca colide e já pula o buraco de
// julho-agosto de graça (decisão de simplicidade: a Copa termina rápido,
// dentro do primeiro terço da temporada, em vez de se espalhar pelo ano
// inteiro como na vida real).
export function drawCopaBracket(save, rand, leagueCalendar) {
  const serieAIds = CAREER_CLUB_IDS.filter(id => careerClubDivision(id) === 'A');
  const serieBSorted = CAREER_CLUB_IDS
    .filter(id => careerClubDivision(id) === 'B')
    .sort((a, b) => clubStrength(save, a) - clubStrength(save, b));
  const weakest16SerieB = serieBSorted.slice(0, 16);
  const strongest4SerieB = serieBSorted.slice(16);
  const calendar = leagueCalendar.slice(0, COPA_ROUND_LABELS.length).map(day => day + 3);
  return {
    round: 0,
    calendar,
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
    copa: { ...copa, round: 1, ties, byeIds: [], pendingRoundTieResults: null },
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
  const day = copa.calendar[copa.round];
  const isFinalRound = copa.round === COPA_ROUND_LABELS.length - 1;

  // A final é jogo único no modo clássico (CupBracketModal detecta
  // `matches.length===1` e lê só `results[0]`, sem leg1) — guardamos o
  // AGREGADO ida+volta ali mesmo, pra mostrar o placar certo sem precisar
  // mudar o motor (o Modo Carreira continua jogando a final em ida+volta,
  // igual toda outra fase).
  const roundEntry = isFinalRound
    ? {
        name: COPA_ROUND_LABELS[copa.round],
        matches: [{ homeId: results[0].aId, awayId: results[0].bId }],
        leg1Results: [],
        results: [{
          homeGoals: results[0].leg1.homeGoals + results[0].leg2.awayGoals,
          awayGoals: results[0].leg1.awayGoals + results[0].leg2.homeGoals,
        }],
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

  const historyTies = results.map(r => ({
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
    copa: { ...copa, round: copa.round + 1, ties: nextTies, pendingRoundTieResults: null, rounds, history },
  };
}

// Resolve a fase ATUAL da Copa (chamada por advanceDay quando bate a data
// dela): paga a entrada pra quem disputa, resolve todo confronto que não
// envolve o usuário, e PAUSA (devolve `pendingUserCopaTie`) se o clube do
// usuário tem jogo nessa fase — nesse caso não avança a fase ainda; quem
// termina o trabalho é `finalizeCopaUserTie`, depois que a tela do Modo
// Carreira decidir o resultado do confronto do usuário.
export function playCopaRound(save, rand) {
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

  const isPrimeiraFase = copa.round === 0;
  const myTieIdx = copa.ties.findIndex(t => t.aId === next.myClubId || t.bId === next.myClubId);
  const myTie = myTieIdx >= 0 ? copa.ties[myTieIdx] : null;

  // Resultados na MESMA ordem de `copa.ties` (posição fixa do chaveamento) —
  // `null` no slot do usuário, preenchido depois por `finalizeCopaUserTie`.
  const results = copa.ties.map((t, i) => {
    if (i === myTieIdx) return null;
    return isPrimeiraFase
      ? tieAggregate(resolveTwoLegTieAuto(next, t.aId, t.bId, rand), t.aId, t.bId)
      : resolveBracketTieAuto(next, t.aId, t.bId, rand);
  });

  if (myTie) {
    return {
      save: { ...next, copa: { ...copa, pendingRoundTieResults: results } },
      pendingUserCopaTie: { aId: myTie.aId, bId: myTie.bId, leg1Match: { homeId: myTie.aId, awayId: myTie.bId } },
      event: 'copa-tie',
      roundLabel: COPA_ROUND_LABELS[copa.round],
    };
  }

  const finishedSave = isPrimeiraFase
    ? advancePrimeiraFase(next, results.map(r => r.winnerId), rand)
    : advanceBracketRound(next, results);
  return { save: finishedSave, pendingUserCopaTie: null, event: 'copa-round', roundLabel: COPA_ROUND_LABELS[copa.round] };
}

// Chamada pela tela do Modo Carreira depois que o usuário jogou os 2 jogos
// do próprio confronto da Copa — combina o resultado dele com os confrontos
// de IA já resolvidos na mesma fase (ver playCopaRound, no slot certo do
// chaveamento) e termina o trabalho de avançar a fase (ou fechar o
// campeonato).
export function finalizeCopaUserTie(save, iWon, result) {
  const tie = save.pendingUserCopaTie;
  if (!tie) return save;
  const myWinnerId = iWon ? save.myClubId : (tie.aId === save.myClubId ? tie.bId : tie.aId);
  const isPrimeiraFase = save.copa.round === 0;
  const myIsA = tie.aId === save.myClubId;

  // `leg1`/`leg2` de `prepareTwoLegTieForUser` já vêm na ordem aId-casa/
  // bId-casa (ver simulateUserCopaTie em seasonEngine.js, que chama
  // `prepareTwoLegTieForUser(save, tie.aId, tie.bId, ...)`) — mesma
  // convenção que `resolveBracketTieAuto` usa pros confrontos de IA, sem
  // precisar inverter nada aqui.
  const myTieResult = isPrimeiraFase
    ? {
        aId: tie.aId, bId: tie.bId, winnerId: myWinnerId,
        aggA: result ? (myIsA ? result.myAggGoals : result.oppAggGoals) : null,
        aggB: result ? (myIsA ? result.oppAggGoals : result.myAggGoals) : null,
      }
    : {
        aId: tie.aId, bId: tie.bId, winnerId: myWinnerId, onPens: !!result?.wentToPenalties,
        leg1: { homeGoals: result.leg1.sim.homeGoals, awayGoals: result.leg1.sim.awayGoals },
        leg2: { homeGoals: result.leg2.sim.homeGoals, awayGoals: result.leg2.sim.awayGoals },
      };

  const myTieIdx = save.copa.ties.findIndex(t => t.aId === tie.aId && t.bId === tie.bId);
  const results = [...(save.copa.pendingRoundTieResults || [])];
  results[myTieIdx] = myTieResult;

  const rand = makePrng(hashSeed(`${save.seed}|copa-advance|${save.season}|${save.copa.round}`));
  const advanced = isPrimeiraFase
    ? advancePrimeiraFase(save, results.map(r => r.winnerId), rand)
    : advanceBracketRound(save, results);
  return { ...advanced, pendingUserCopaTie: null };
}
