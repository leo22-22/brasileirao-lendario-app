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
// nomeadas da Copa real, com a premiação exata da tabela oficial. Os
// nomes das fases são repetidos aqui (em vez de importados de App.jsx,
// que já tem `CUP_ROUND_NAMES` igual pro modo Copa clássico) de
// propósito: `App.jsx` importa `CareerApp.jsx` (pra montar o Modo
// Carreira), que importa este arquivo — importar uma `const` de volta de
// App.jsx nesse ciclo quebra com "Cannot access before initialization"
// (TDZ), diferente de importar uma function declaration (hoisted, por
// isso `teamStrength`/`makePrng`/`hashSeed` abaixo funcionam sem
// problema).
import { teamStrength, makePrng, hashSeed } from '../../App.jsx';
import { CAREER_CLUB_IDS, careerClubDivision } from '../../data/career-clubs.js';
import { creditBudget } from './rosterStore.js';
import { resolveTwoLegTieAuto } from './simHelpers.js';

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
// histórico guarda — aceita tanto o resultado cru de resolveTwoLegTieAuto
// (winnerId/leg1/leg2, confrontos de IA) quanto um objeto já pronto com
// aggA/aggB (confronto do próprio usuário, montado em finalizeCopaUserTie
// a partir do resultado que a tela de ida+volta devolve).
function tieAggregate(tie, aId, bId) {
  if (tie.aggA != null) return tie;
  return {
    aId, bId, winnerId: tie.winnerId,
    aggA: tie.leg1.homeGoals + tie.leg2.awayGoals,
    aggB: tie.leg1.awayGoals + tie.leg2.homeGoals,
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
    pendingRoundWinners: null,
    pendingRoundTieResults: null,
    // Fases já resolvidas — [{ round, roundLabel, day, ties: [{aId,bId,
    // winnerId,aggA,aggB}] }] — só pro calendário mostrar o confronto e o
    // agregado de uma fase passada (ver CareerCalendarScreen.jsx).
    history: [],
    champion: null,
    phase: 'active',
  };
}

// Aplica os vencedores de uma fase já totalmente decidida (todo mundo,
// inclusive o usuário se jogou) — ou fecha o campeonato (premiando
// campeão/vice) se essa era a Final, ou sorteia os confrontos da próxima
// fase entre os vencedores (mais os clubes de bye, só na transição da
// Primeira Fase pra "16 Avos de Final").
function advanceCopaRound(save, winners, rand, tieResults) {
  const copa = save.copa;
  const historyEntry = { round: copa.round, roundLabel: COPA_ROUND_LABELS[copa.round], day: copa.calendar[copa.round], ties: tieResults || [] };
  const history = [...(copa.history || []), historyEntry];
  const isFinalRound = copa.round === COPA_ROUND_LABELS.length - 1;
  if (isFinalRound) {
    const championId = winners[0];
    const finalTie = copa.ties[0];
    const runnerUpId = finalTie.aId === championId ? finalTie.bId : finalTie.aId;
    let next = creditBudget(save, championId, COPA_CHAMPION_PRIZE);
    next = creditBudget(next, runnerUpId, COPA_RUNNER_UP_PRIZE);
    return { ...next, copa: { ...copa, champion: championId, phase: 'done', history, pendingRoundTieResults: null } };
  }
  const pool = copa.round === 0 ? [...winners, ...(copa.byeIds || [])] : winners;
  return {
    ...save,
    copa: { ...copa, round: copa.round + 1, ties: pairConsecutive(shuffle(pool, rand)), byeIds: [], pendingRoundWinners: null, pendingRoundTieResults: null, history },
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

  const myTie = copa.ties.find(t => t.aId === next.myClubId || t.bId === next.myClubId);
  const aiTies = copa.ties.filter(t => t !== myTie);
  const aiResults = aiTies.map(t => tieAggregate(resolveTwoLegTieAuto(next, t.aId, t.bId, rand), t.aId, t.bId));
  const aiWinners = aiResults.map(r => r.winnerId);

  if (myTie) {
    return {
      save: { ...next, copa: { ...copa, pendingRoundWinners: aiWinners, pendingRoundTieResults: aiResults } },
      pendingUserCopaTie: { aId: myTie.aId, bId: myTie.bId, leg1Match: { homeId: myTie.aId, awayId: myTie.bId } },
      event: 'copa-tie',
      roundLabel: COPA_ROUND_LABELS[copa.round],
    };
  }

  return {
    save: advanceCopaRound(next, aiWinners, rand, aiResults),
    pendingUserCopaTie: null,
    event: 'copa-round',
    roundLabel: COPA_ROUND_LABELS[copa.round],
  };
}

// Chamada pela tela do Modo Carreira depois que o usuário jogou os 2 jogos
// do próprio confronto da Copa — combina o resultado dele com os
// confrontos de IA já resolvidos na mesma fase (ver playCopaRound) e
// termina o trabalho de avançar a fase (ou fechar o campeonato).
export function finalizeCopaUserTie(save, iWon, result) {
  const tie = save.pendingUserCopaTie;
  if (!tie) return save;
  const myWinnerId = iWon ? save.myClubId : (tie.aId === save.myClubId ? tie.bId : tie.aId);
  const winners = [...(save.copa.pendingRoundWinners || []), myWinnerId];
  const myIsA = tie.aId === save.myClubId;
  const userTieResult = {
    aId: tie.aId, bId: tie.bId, winnerId: myWinnerId,
    aggA: result ? (myIsA ? result.myAggGoals : result.oppAggGoals) : null,
    aggB: result ? (myIsA ? result.oppAggGoals : result.myAggGoals) : null,
  };
  const tieResults = [...(save.copa.pendingRoundTieResults || []), userTieResult];
  const rand = makePrng(hashSeed(`${save.seed}|copa-advance|${save.season}|${save.copa.round}`));
  const advanced = advanceCopaRound(save, winners, rand, tieResults);
  return { ...advanced, pendingUserCopaTie: null };
}
