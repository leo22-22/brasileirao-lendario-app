// Motor de temporada do Modo Carreira: avança rodadas, resolve o fim de
// temporada (acesso/queda pros 40 clubes, premiação, categoria de base,
// janela de transferências da IA, Copa do Brasil) e prepara a temporada
// seguinte.
//
// Reaproveita sem alterar: applyRoundToTable, resolveDivisionEnd,
// simAiMatch, generateDoubleRoundRobin, matchPrng, hashSeed, makePrng
// (todos exportados de App.jsx nesta sessão). `resolveDivisionEnd`
// só resolve o destino de UM time por vez — por isso chamamos ela uma vez
// pra cada um dos 40 clubes (ver resolveDivisionMovements abaixo) em vez de
// reescrever a lógica de posição/playoff que já existe lá.
import { TEAMS } from '../../data/teams.js';
import {
  applyRoundToTable, resolveDivisionEnd, simAiMatch, generateDoubleRoundRobin,
  matchPrng, hashSeed, makePrng, buildLiveMatchEvents,
} from '../../App.jsx';
import { CAREER_CLUB_IDS, SERIE_A_2026_TEAM_IDS, SERIE_B_2026_TEAM_IDS, careerClubTier } from '../../data/career-clubs.js';
import { cloneAllRosters, addPlayersToClub, creditBudget, buyPlayer, replaceRoster, canSell, MIN_SQUAD_SIZE, appendTransferLog } from './rosterStore.js';
import { computePrizeMoney } from './economy.js';
import { generateClubYouthBatch } from './youth.js';
import { applySeasonAging } from './aging.js';
import { decideAiListings, decideAiOffers } from './aiTransfers.js';
import { buildSeasonCalendar, isTransferWindowOpen } from './calendar.js';
import { teamForSim, resolveTwoLegTieAuto, prepareTwoLegTieForUser, legPackage } from './simHelpers.js';
import { drawCopaBracket, playCopaRoundIda, playCopaRoundVolta, finalizeCopaUserTieLeg1, finalizeCopaUserTieLeg2, copaCurrentDay, COPA_ROUND_LABELS } from './copaEngine.js';
import { accumulateMatchStats, playerSeasonStats } from './seasonStats.js';
import { buildSeasonReport } from './seasonReport.js';
import { returnDueLoans, returnSeasonLoans, generateUserLoanOffer, acceptLoanOffer, LOAN_OFFER_CHANCE } from './loans.js';

export { isTransferWindowOpen } from './calendar.js';
export { teamForSim } from './simHelpers.js';
export { resolveCopaFinalUserMatch } from './copaEngine.js';

function emptyTableRow(clubId) {
  const team = TEAMS.find(t => t.id === clubId);
  return { id: clubId, label: team.label, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 };
}

function buildDivision(teamIds, rand) {
  const shuffled = [...teamIds].sort(() => rand() - 0.5);
  // A tabela em si (diferente do sorteio de confrontos em `shuffled`) abre
  // em ordem alfabética — pedido explícito do usuário 2026-11-11: "nas
  // tabelas no início colocar por ordem alfabetica". `applyRoundToTable`
  // (App.jsx) também desempata por nome, então isso só importa de verdade
  // na rodada 0 (todo mundo 0 a 0) — dali em diante quem decide é o jogo.
  const alphabetical = [...teamIds].sort((a, b) =>
    TEAMS.find(t => t.id === a).club.localeCompare(TEAMS.find(t => t.id === b).club));
  return {
    teamIdsInOrder: shuffled,
    table: alphabetical.map(emptyTableRow),
    fixtures: generateDoubleRoundRobin(shuffled),
    round: 0,
    // results[roundIdx] = placares daquela rodada — guardado pra tela de
    // calendário mostrar o que já foi jogado, não só a tabela acumulada.
    results: [],
  };
}

// Save inicial de uma carreira nova — clona os 40 elencos a partir de
// TEAMS (nunca mais lê TEAMS pra mutar nada depois disso) e sorteia o
// calendário das duas divisões. `customBudget` (opcional, `null`/`undefined`
// = "use o padrão do tier") sobrescreve só o orçamento inicial do PRÓPRIO
// clube do usuário — os outros 39 sempre usam o padrão por tier, pra não
// desequilibrar a economia da IA. `0` é um valor válido de propósito
// (pedido explícito do usuário 2026-11-09: começar sem orçamento nenhum é
// uma escolha real, não "esqueceu de preencher") — por isso o teste é
// `!= null`, não `> 0`.
export function createCareerSave(myClubId, customBudget, seedOverride) {
  const seed = seedOverride || `career-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const rand = makePrng(hashSeed(`${seed}|setup`));
  const clubs = cloneAllRosters();
  if (customBudget != null) {
    clubs[myClubId] = { ...clubs[myClubId], budget: customBudget };
  }
  const seasonCalendar = buildSeasonCalendar(38);
  return {
    version: 1,
    seed,
    season: 1,
    myClubId,
    clubs,
    divisionA: buildDivision(SERIE_A_2026_TEAM_IDS, rand),
    divisionB: buildDivision(SERIE_B_2026_TEAM_IDS, rand),
    pendingUserTie: null,
    pendingUserCopaTie: null,
    pendingOffers: [],
    // Jogadores que o usuário colocou "na vitrine" (ver toggleTransferList)
    // — aumenta a chance de vir proposta por eles especificamente, sem
    // impedir que um jogador fora da lista receba uma sondagem rara.
    transferList: [],
    // Jogadores que o usuário colocou na lista de empréstimo (ver
    // toggleLoanList em loans.js) — mesma ideia da lista de transferências,
    // só que pra empréstimo: não empresta nada sozinho, só sinaliza que
    // pode vir proposta de empréstimo por eles (ver LOAN_OFFER_CHANCE).
    loanList: [],
    // Histórico de TODA transferência da carreira (os 40 clubes, não só o
    // do usuário) — nunca resetado entre temporadas (ver appendTransferLog
    // em rosterStore.js). Alimenta o painel "Top Transferências" da home e
    // a aba de histórico de transferências do usuário.
    transferLog: [],
    // Começa em 1º de janeiro — dentro da janela de pré-temporada, de
    // propósito (dá pra reforçar o elenco antes da temporada começar).
    calendarDay: 1,
    seasonCalendar,
    copa: drawCopaBracket({ clubs }, rand),
    // Gols/assistências/cartões/jogos sem sofrer gol por jogador NESTA
    // temporada (zerado a cada advanceToNextSeason) — alimenta o relatório
    // de fim de temporada (seasonStats.js/seasonReport.js).
    seasonPlayerStats: {},
    lastSeasonReport: null,
    pendingSeasonReportData: null,
    screen: 'hub',
  };
}

// Resolve todas as partidas de uma rodada de uma divisão. `userMatch`
// (opcional) é o resultado já pronto da partida do usuário (vinda do
// fluxo normal de partida ao vivo ou de "simular") — substitui a
// simulação automática só pra esse confronto específico daquela rodada.
// Devolve a divisão atualizada + a lista de `sims` de cada partida (pra
// `playRound` acumular em `seasonPlayerStats`, ver seasonStats.js).
function playDivisionRound(save, divisionKey, roundIdx, userMatch) {
  const division = save[divisionKey];
  const matches = division.fixtures[roundIdx] || [];
  const sims = [];
  const roundResults = matches.map(m => {
    if (userMatch && m.homeId === userMatch.homeId && m.awayId === userMatch.awayId) {
      sims.push(userMatch);
      return { homeId: m.homeId, awayId: m.awayId, homeGoals: userMatch.homeGoals, awayGoals: userMatch.awayGoals };
    }
    const home = teamForSim(save, m.homeId);
    const away = teamForSim(save, m.awayId);
    const rand = matchPrng(save.seed, `s${save.season}-r${roundIdx}`, m.homeId, m.awayId);
    const sim = simAiMatch(home, away, rand);
    sims.push({ homeId: m.homeId, awayId: m.awayId, ...sim, events: [...(sim.discipline || []), ...(sim.goals || []).map(g => ({ ...g, type: 'goal' }))] });
    return { homeId: m.homeId, awayId: m.awayId, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
  });
  const newTable = applyRoundToTable(division.table, roundResults);
  return {
    division: {
      ...division,
      table: newTable,
      round: roundIdx + 1,
      results: [...(division.results || []), roundResults],
    },
    sims,
  };
}

// Avança UMA rodada nas duas divisões de uma vez (elas sempre andam
// juntas, mesmo a divisão onde o usuário não joga precisa existir de
// verdade — os 40 clubes são persistentes). `userMatch` só tem efeito na
// divisão onde `save.myClubId` está.
export function playRound(save, roundIdx, userMatch) {
  const myDivisionKey = save.clubs[save.myClubId].division === 'A' ? 'divisionA' : 'divisionB';
  const a = playDivisionRound(save, 'divisionA', roundIdx, myDivisionKey === 'divisionA' ? userMatch : null);
  const b = playDivisionRound(save, 'divisionB', roundIdx, myDivisionKey === 'divisionB' ? userMatch : null);
  let seasonPlayerStats = save.seasonPlayerStats || {};
  for (const sim of [...a.sims, ...b.sims]) seasonPlayerStats = accumulateMatchStats(seasonPlayerStats, sim);
  return { ...save, divisionA: a.division, divisionB: b.division, seasonPlayerStats };
}

// Chance BASE de surgir uma sondagem por um jogador do usuário em cada
// dia dentro de uma janela aberta — vale pro elenco inteiro (inclusive
// jogador fora da lista de transferências, que ainda pode ser sondado,
// só que mais raro). Subida de 0.08 pra 0.14 (pedido explícito do usuário
// 2026-11-11: "ta chegando muito pouca proposta") — o valor antigo
// deixava a janela inteira (31+21 dias de verdade, depois do calendário
// real da Fase 7) quase sempre sem nenhuma oferta.
const DAILY_OFFER_CHANCE = 0.14;

// Chance EXTRA, só pra quem está na lista de transferências (ver
// toggleTransferList) — soma com a chance base só pra esse grupo, então
// um jogador listado tem 0.14+0.08 = 0.22 de chance total por dia de
// janela aberta. É um rolamento INDEPENDENTE do geral (ver advanceDay),
// não um multiplicador — assim dá pra sair proposta tanto pelo
// rolamento geral quanto por este no mesmo dia, inclusive por
// jogadores diferentes. Subida de 0.04 pra 0.08 junto com a chance base
// acima (mesmo pedido) — listar continua valendo bem mais a pena
// (quase o dobro da chance total de quem não tá listado).
const LISTED_OFFER_BONUS_CHANCE = 0.08;

// Quantas das últimas propostas recentes (pelo jogador do usuário) ficam
// em "cooldown" — mesmo quando um jogador é consistentemente o candidato
// mais barato/mais procurado pra uma posição carente (ex.: um titular
// barato numa posição que falta em vários elencos), isso sozinho fazia a
// proposta cair sempre nele. O cooldown garante variedade de verdade ao
// longo da janela, não só no mesmo dia.
const OFFER_COOLDOWN_SIZE = 3;

// Sonda se algum dos outros 39 clubes quer comprar um jogador do usuário
// hoje — reaproveita decideAiOffers. `pool` (opcional) restringe quais
// dos meus jogadores entram como candidatos nessa sondagem específica —
// usado pra rolar separadamente "qualquer jogador" (pool cheio) e "só os
// da lista de transferências" (pool = transferList), cada um com sua
// própria chance (ver advanceDay). Sem `pool`, todo o elenco é candidato
// — igual era antes de existir a lista de transferências.
function generateUserOffer(save, rand, recentNames, restrictTo) {
  const myRoster = save.clubs[save.myClubId].roster;
  if (myRoster.length <= MIN_SQUAD_SIZE) return null;
  const candidateNames = restrictTo?.length ? restrictTo : myRoster.map(p => p.name);
  const clubsForOffers = {};
  const listingsByClub = {};
  for (const clubId of CAREER_CLUB_IDS) {
    clubsForOffers[clubId] = { roster: save.clubs[clubId].roster, budget: save.clubs[clubId].budget, tier: careerClubTier(clubId) };
    listingsByClub[clubId] = clubId === save.myClubId ? candidateNames : decideAiListings(save.clubs[clubId].roster);
  }
  const offers = decideAiOffers(clubsForOffers, listingsByClub, rand);
  // Pega TODAS as propostas pro usuário e sorteia uma — usar sempre a
  // primeira encontrada era uma causa real do "só vem proposta pelo mesmo
  // jogador" (decideAiOffers já embaralha a ordem dos clubes, mas pegar
  // só a primeira ainda cortava a variedade quando houvesse mais de um
  // comprador interessado no mesmo dia). Evita repetir um nome que já
  // apareceu nas últimas OFFER_COOLDOWN_SIZE propostas, quando houver
  // outra opção — sem isso, um jogador "barato demais" pra posição
  // continuava sendo a escolha certa pra qualquer comprador, dia após dia.
  const myOffers = offers.filter(o => o.toClubId === save.myClubId);
  if (myOffers.length === 0) return null;
  const fresh = myOffers.filter(o => !recentNames?.includes(o.playerName));
  const pool = fresh.length > 0 ? fresh : myOffers;
  return pool[Math.floor(rand() * pool.length)];
}

// Chance de um clube de IA fechar uma transferência com outro clube de IA
// num dia qualquer dentro de uma janela aberta — baixa de propósito (é só
// pra dar vida ao mercado enquanto o usuário avança, não uma simulação de
// mercado completa). Nunca envolve o clube do usuário (ver tryAiToAiTransfer).
const DAILY_AI_TRANSFER_CHANCE = 0.06;

// Fecha no máximo 1 negócio entre dois clubes de IA (nunca o do usuário)
// num dia — reaproveita decideAiOffers já embaralhado e sorteia 1 proposta
// entre as que não envolvem o usuário, executando de verdade via buyPlayer.
function tryAiToAiTransfer(save, rand) {
  const clubsForOffers = {};
  const listingsByClub = {};
  for (const clubId of CAREER_CLUB_IDS) {
    clubsForOffers[clubId] = { roster: save.clubs[clubId].roster, budget: save.clubs[clubId].budget, tier: careerClubTier(clubId) };
    listingsByClub[clubId] = clubId === save.myClubId ? [] : decideAiListings(save.clubs[clubId].roster);
  }
  const offers = decideAiOffers(clubsForOffers, listingsByClub, rand)
    .filter(o => o.fromClubId !== save.myClubId && o.toClubId !== save.myClubId);
  if (offers.length === 0) return null;
  const picked = offers[Math.floor(rand() * offers.length)];
  const result = buyPlayer(save, picked.fromClubId, picked.toClubId, picked.playerName);
  if (!result.ok) return null;
  return { save: result.save, event: { type: 'transfer-ai', fromClubId: picked.fromClubId, toClubId: picked.toClubId, playerName: picked.playerName, amount: picked.amount } };
}

// Acha o jogo do usuário numa rodada já resolvida — usado só pra registrar
// o evento de "partida" no dia em que ela acontece.
function findMyMatchResult(save, roundIdx) {
  const myDivisionKey = save.clubs[save.myClubId].division === 'A' ? 'divisionA' : 'divisionB';
  const results = save[myDivisionKey].results[roundIdx] || [];
  return results.find(r => r.homeId === save.myClubId || r.awayId === save.myClubId) || null;
}

// Avança o calendário dia a dia dentro de UM clique: pula em silêncio os
// dias sem nada (registrando qualquer transferência de IA que aconteça
// nesse meio-tempo) e só para (devolve o save pra UI reagir) quando bate
// um dia de jogo, surge uma proposta nova, ou a temporada regular termina.
// Nunca avança com uma proposta sem resposta pendente — o usuário precisa
// decidir antes do tempo seguir (aceitar/rejeitar na aba Propostas).
// `lastDayEvents` no save devolvido é a lista do que aconteceu nesse
// avanço — a UI (CareerHub) mostra como feed "o que aconteceu".
export function advanceDay(save) {
  if (save.pendingOffers?.length) return { save, event: 'offers-pending' };
  const myDivisionKey = save.clubs[save.myClubId].division === 'A' ? 'divisionA' : 'divisionB';
  let current = save;
  let day = save.calendarDay;
  const events = [];
  while (day < 365) {
    day += 1;
    current = returnDueLoans(current, day);
    const division = current[myDivisionKey];
    const nextRoundIdx = division.round;
    if (nextRoundIdx >= division.fixtures.length) {
      return { save: { ...current, calendarDay: day, lastDayEvents: events }, event: 'season-end' };
    }
    if (day === current.seasonCalendar[nextRoundIdx]) {
      const matches = division.fixtures[nextRoundIdx] || [];
      const myFixture = matches.find(m => m.homeId === current.myClubId || m.awayId === current.myClubId);
      // Jogo do PRÓPRIO usuário: pára aqui sem resolver a rodada ainda — a
      // tela de partida ao vivo (CareerMatchDayScreen) anima esse confronto
      // minuto a minuto; só quando o usuário confirmar (resolveUserMatch)
      // é que a rodada inteira (esse jogo + todos os outros 9 de cada
      // divisão) é de fato resolvida, igual sempre foi. O resultado já sai
      // pré-calculado aqui (mesma seed/chave que playDivisionRound usaria
      // pra esse confronto) só pra a tela ter o que animar.
      if (myFixture) {
        const homeTeamFull = teamForSim(current, myFixture.homeId);
        const awayTeamFull = teamForSim(current, myFixture.awayId);
        const rand = matchPrng(current.seed, `s${current.season}-r${nextRoundIdx}`, myFixture.homeId, myFixture.awayId);
        const sim = simAiMatch(homeTeamFull, awayTeamFull, rand);
        const liveEvents = buildLiveMatchEvents(sim, homeTeamFull, homeTeamFull.players.slice(0, 11), awayTeamFull, awayTeamFull.players.slice(0, 11));
        const pendingUserMatch = {
          roundIdx: nextRoundIdx, day,
          homeId: myFixture.homeId, awayId: myFixture.awayId,
          homeTeam: { id: homeTeamFull.id, label: homeTeamFull.label, club: homeTeamFull.club, color: homeTeamFull.color },
          awayTeam: { id: awayTeamFull.id, label: awayTeamFull.label, club: awayTeamFull.club, color: awayTeamFull.color },
          sim: { homeGoals: sim.homeGoals, awayGoals: sim.awayGoals, ratings: sim.ratings, events: liveEvents, homeGkName: sim.homeGkName, awayGkName: sim.awayGkName },
        };
        return { save: { ...current, calendarDay: day, pendingUserMatch, lastDayEvents: events }, event: 'user-match' };
      }
      const played = playRound(current, nextRoundIdx, null);
      const myMatch = findMyMatchResult(played, nextRoundIdx);
      if (myMatch) events.push({ type: 'match', day, ...myMatch });
      return { save: { ...played, calendarDay: day, lastDayEvents: events }, event: 'match', roundIdx: nextRoundIdx };
    }
    if (current.copa?.phase !== 'done' && day === copaCurrentDay(current.copa)) {
      const copaRand = makePrng(hashSeed(`${current.seed}|copa-round|${day}|${current.copa.leg}`));
      // A Final nunca tem `leg:'volta'` (jogo único, ver copaEngine.js) —
      // só as fases de ida+volta alternam entre as duas funções.
      const isFinal = current.copa.round === COPA_ROUND_LABELS.length - 1;
      const result = (current.copa.leg === 'volta' && !isFinal) ? playCopaRoundVolta(current, copaRand) : playCopaRoundIda(current, copaRand);
      if (result.pendingUserCopaTie) {
        return {
          save: { ...result.save, calendarDay: day, pendingUserCopaTie: result.pendingUserCopaTie, lastDayEvents: events },
          event: 'copa-tie',
        };
      }
      if (result.event === 'copa-round') {
        events.push({ type: 'copa-round', day, roundLabel: result.roundLabel });
        return { save: { ...result.save, calendarDay: day, lastDayEvents: events }, event: 'copa-round' };
      }
      // Ida silenciosa (sem confronto do usuário nessa fase) — so guardou
      // leg1Results e virou pra 'volta', a fase continua aberta. Nao para o
      // avanco do calendario: segue o loop normal pros outros gatilhos do
      // dia (ou pro dia seguinte).
      current = result.save;
    }
    if (isTransferWindowOpen(day)) {
      // Dois rolamentos INDEPENDENTES: o geral (qualquer jogador do
      // elenco, chance base) e o bônus (só quem está na lista de
      // transferências, chance extra) — podem gerar até 2 propostas no
      // mesmo dia, inclusive por jogadores diferentes.
      const dayOffers = [];
      const offerRand = makePrng(hashSeed(`${current.seed}|offer-check|${day}`));
      if (offerRand() < DAILY_OFFER_CHANCE) {
        const offer = generateUserOffer(current, offerRand, current.recentOfferNames);
        if (offer) dayOffers.push(offer);
      }
      if (current.transferList?.length) {
        const listedRand = makePrng(hashSeed(`${current.seed}|offer-check-listed|${day}`));
        if (listedRand() < LISTED_OFFER_BONUS_CHANCE) {
          const recentPlusToday = [...(current.recentOfferNames || []), ...dayOffers.map(o => o.playerName)];
          const offer = generateUserOffer(current, listedRand, recentPlusToday, current.transferList);
          if (offer && !dayOffers.some(o => o.playerName === offer.playerName)) dayOffers.push(offer);
        }
      }
      // Propostas de empréstimo (ver loans.js) — rolamento INDEPENDENTE,
      // igual a lista de transferências: só pra quem está na lista de
      // empréstimo (nunca pro elenco inteiro, diferente da compra).
      if (current.loanList?.length) {
        const loanRand = makePrng(hashSeed(`${current.seed}|offer-check-loan|${day}`));
        if (loanRand() < LOAN_OFFER_CHANCE) {
          const recentPlusToday = [...(current.recentOfferNames || []), ...dayOffers.map(o => o.playerName)];
          const offer = generateUserLoanOffer(current, loanRand, recentPlusToday);
          if (offer && !dayOffers.some(o => o.playerName === offer.playerName)) dayOffers.push(offer);
        }
      }
      if (dayOffers.length > 0) {
        // `type: 'offer'` por último de propósito: `offer.type` já carrega
        // 'loan' pra proposta de empréstimo (ver loans.js) e, se viesse
        // antes do spread, seria sobrescrito — o evento do feed sempre
        // precisa ser 'offer' (é o que eventLine reconhece), a distinção
        // buy/loan vai em `offerKind`.
        events.push(...dayOffers.map(offer => ({ day, ...offer, type: 'offer', offerKind: offer.type || 'buy' })));
        let recentOfferNames = current.recentOfferNames || [];
        for (const offer of dayOffers) recentOfferNames = [...recentOfferNames, offer.playerName].slice(-OFFER_COOLDOWN_SIZE);
        return {
          save: { ...current, calendarDay: day, pendingOffers: [...(current.pendingOffers || []), ...dayOffers], recentOfferNames, lastDayEvents: events },
          event: 'offer',
        };
      }
      const aiRand = makePrng(hashSeed(`${current.seed}|ai-transfer|${day}`));
      if (aiRand() < DAILY_AI_TRANSFER_CHANCE) {
        const result = tryAiToAiTransfer(current, aiRand);
        if (result) {
          current = result.save;
          events.push({ day, ...result.event });
        }
      }
    }
  }
  return { save: { ...current, calendarDay: 365, lastDayEvents: events }, event: 'season-end' };
}

// Chamada pela tela de partida ao vivo (CareerMatchDayScreen) depois que o
// usuário termina de assistir/pular o próprio jogo — só agora a rodada
// INTEIRA (o jogo do usuário, já decidido, + os outros 9 de cada divisão,
// simulados aqui igual sempre foi) é de fato aplicada na tabela.
export function resolveUserMatch(save) {
  const pending = save.pendingUserMatch;
  if (!pending) return save;
  const userMatch = {
    homeId: pending.homeId, awayId: pending.awayId, homeGoals: pending.sim.homeGoals, awayGoals: pending.sim.awayGoals,
    events: pending.sim.events, ratings: pending.sim.ratings, homeGkName: pending.sim.homeGkName, awayGkName: pending.sim.awayGkName,
  };
  const played = playRound(save, pending.roundIdx, userMatch);
  const myMatch = findMyMatchResult(played, pending.roundIdx);
  return {
    ...played,
    pendingUserMatch: null,
    lastDayEvents: myMatch ? [{ type: 'match', day: pending.day, ...myMatch }] : [],
  };
}

// Pra cada um dos 40 clubes, pergunta pro resolveDivisionEnd já existente
// (App.jsx) qual o destino DELE — reaproveita a lógica de posição/playoff
// 1:1, só chamando 40 vezes em vez de reescrever. Devolve os movimentos
// diretos + as (até) 2 duplas de playoff já deduplicadas.
function resolveDivisionMovements(save) {
  const direct = []; // { clubId, move: 'promoted'|'relegated'|'stayed' }
  const tiesByKey = new Map(); // key = par ordenado de ids -> { aId, bId, aPos, bPos, leg1Match }
  for (const clubId of SERIE_A_2026_TEAM_IDS) {
    const { move } = resolveDivisionEnd(save.divisionA.table, clubId, 'A');
    direct.push({ clubId, move });
  }
  for (const clubId of SERIE_B_2026_TEAM_IDS) {
    const { move, tie } = resolveDivisionEnd(save.divisionB.table, clubId, 'B');
    if (move) { direct.push({ clubId, move }); continue; }
    if (tie) {
      const key = [clubId, tie.opponentId].sort().join('|');
      if (!tiesByKey.has(key)) {
        tiesByKey.set(key, { aId: clubId, bId: tie.opponentId, aPos: tie.myPos, bPos: tie.oppPos, leg1Match: tie.leg1Match });
      }
    }
  }
  return { direct, ties: [...tiesByKey.values()] };
}

// Resolve um mata-mata inteiro (ida + volta, decisor em campo neutro se
// empatar no agregado) só com simAiMatch — usado pro par de playoff que
// NÃO envolve o clube do usuário. O par do usuário fica pendente (ver
// endOfSeason) pra ser jogado pelas telas do Modo Carreira.
function resolvePlayoffTieAuto(save, tie, rand) {
  return resolveTwoLegTieAuto(save, tie.leg1Match.homeId, tie.leg1Match.awayId, rand);
}

// Prepara o mata-mata de acesso do PRÓPRIO usuário com o time real dos
// dois lados (nada de o jogador escolher o resultado) — cada perna (ida/
// volta) vem com o timeline minuto a minuto pronto pra animar, igual o
// jogo comum do Brasileirão, não mais um botão só resolvendo os 2 jogos
// de uma vez. Não aplica nada no save — só devolve os dados pra tela
// jogar antes de chamar finalizeSeasonAfterUserTie.
export function simulateUserTie(save) {
  const tie = save.pendingUserTie;
  if (!tie) return null;
  const rand = makePrng(hashSeed(`${save.seed}|user-tie|${save.season}`));
  const myId = tie.aId === save.myClubId ? tie.aId : tie.bId;
  return prepareTwoLegTieForUser(save, tie.leg1Match.homeId, tie.leg1Match.awayId, myId, rand);
}

// Confronto do PRÓPRIO usuário na Copa do Brasil (ver copaEngine.js) — AGORA
// perna por perna, em dias de calendário diferentes (nunca mais ida+volta
// na mesma visita, ver copaEngine.js/COPA_DAYS): `simulateUserCopaTieLeg1`
// monta só a ida (chamada quando `pendingUserCopaTie.leg==='ida'`),
// `simulateUserCopaTieLeg2` monta só a volta (quando `leg==='volta'`) —
// devolvem o pacote de UMA perna (mesmo formato de `legPackage`, igual o
// jogo comum do Brasileirão) pra tela jogar antes de chamar
// finalizeCopaUserTieLeg1/Leg2 (reexportadas abaixo).
export function simulateUserCopaTieLeg1(save) {
  const tie = save.pendingUserCopaTie;
  if (!tie || tie.leg !== 'ida') return null;
  const rand = makePrng(hashSeed(`${save.seed}|copa-user-tie-ida|${save.season}|${save.copa.round}`));
  return legPackage(save, tie.leg1Match.homeId, tie.leg1Match.awayId, rand);
}

export function simulateUserCopaTieLeg2(save) {
  const tie = save.pendingUserCopaTie;
  if (!tie || tie.leg !== 'volta') return null;
  const rand = makePrng(hashSeed(`${save.seed}|copa-user-tie-volta|${save.season}|${save.copa.round}`));
  return legPackage(save, tie.leg2Match.homeId, tie.leg2Match.awayId, rand);
}

export { finalizeCopaUserTieLeg1, finalizeCopaUserTieLeg2 } from './copaEngine.js';

// Fim de temporada: prêmios, categoria de base e janela de transferências
// da IA sempre acontecem (não dependem de nenhum mata-mata). Acesso/queda
// é aplicado pra todo clube que não está no par do usuário; esse par fica
// pendente em `save.pendingUserTie` pras telas do Modo Carreira resolverem
// (ver finalizeSeasonAfterUserTie). Se o usuário não está em nenhum par
// de playoff (ou nem está na Série B), a temporada é fechada e a próxima
// já começa aqui mesmo.
export function endOfSeason(save) {
  const rand = makePrng(hashSeed(`${save.seed}|end-of-season|${save.season}`));
  let next = save;

  // 1) Premiação por posição final (independe de acesso/queda).
  for (const [table, division] of [[save.divisionA.table, 'A'], [save.divisionB.table, 'B']]) {
    table.forEach((row, idx) => {
      const prize = computePrizeMoney(idx + 1, division);
      next = creditBudget(next, row.id, prize);
    });
  }

  // 2) Envelhecimento de TODO jogador com idade conhecida (real ou da
  //    base) — aposenta quem a sorte mandar aposentar (35+, praticamente
  //    certo aos 41) e ajusta overall (cresce quem é jovem, decai quem tá
  //    envelhecendo; jovem da base ainda em crescimento usa a curva
  //    própria até o potencial — ver aging.js). Depois, a categoria de
  //    base de sempre: 2-3 jovens novos por clube.
  //
  //    `myClubDeltas` captura o antes/depois de CADA jogador do PRÓPRIO
  //    clube do usuário (os outros 39 não interessam pro relatório de fim
  //    de temporada) — alimenta a aba "Elenco" do relatório (overall
  //    subiu/desceu quanto, ou se aposentou).
  const myClubDeltas = [];
  for (const clubId of CAREER_CLUB_IDS) {
    const agingRand = makePrng(hashSeed(`${save.seed}|aging|${clubId}|${save.season}`));
    const roster = next.clubs[clubId].roster;
    const survivors = [];
    const retiredNames = [];
    for (const p of roster) {
      const stats = playerSeasonStats(next.seasonPlayerStats, clubId, p.name);
      const aged = applySeasonAging(p, agingRand, stats);
      const isMine = clubId === next.myClubId;
      if (!aged) {
        if (p.age != null) retiredNames.push(p.name);
        if (isMine) myClubDeltas.push({ name: p.name, pos: p.pos, beforeOvr: p.ovr, afterOvr: null, retired: true });
        continue; // null por aposentadoria (não por falta de idade)
      }
      if (isMine && p.ovr !== aged.ovr) {
        myClubDeltas.push({ name: p.name, pos: p.pos, beforeOvr: p.ovr, afterOvr: aged.ovr, retired: false });
      }
      // Graduação automática da categoria de base aos 20 anos — a outra
      // forma de sair é o usuário promover manualmente (ver
      // promoteYouthPlayer em rosterStore.js).
      survivors.push(aged.inAcademy && aged.age >= 20 ? { ...aged, inAcademy: false } : aged);
    }
    next = replaceRoster(next, clubId, survivors);
    // Histórico só registra a aposentadoria de jogador do PRÓPRIO usuário —
    // pros outros 39 clubes isso seria ruído sem utilidade nenhuma pra aba
    // de histórico (que é sobre o elenco do usuário, não da liga inteira).
    if (clubId === next.myClubId) {
      for (const name of retiredNames) {
        next = { ...next, transferLog: appendTransferLog(next, { type: 'retired', playerName: name, fromClubId: clubId, toClubId: null, amount: 0 }) };
      }
    }
    const batch = generateClubYouthBatch(makePrng, hashSeed, save.seed, clubId, save.season);
    next = addPlayersToClub(next, clubId, batch);
  }

  // 3) Arrumação de elenco da IA (entre os OUTROS 39 clubes, nunca
  //    envolvendo o usuário) — acontece nos bastidores no fim de cada
  //    temporada, fora das janelas de verdade (que agora são só
  //    janeiro/julho-agosto, dia a dia — ver advanceDay abaixo). Propostas
  //    pelo jogador do usuário só surgem durante uma janela aberta, uma
  //    por vez, através de advanceDay — nunca aqui. No máximo 1 proposta
  //    por clube comprador; se um jogador já foi vendido antes nesta mesma
  //    leva, buyPlayer simplesmente falha (ok:false) e a oferta é ignorada.
  const listingsByClub = {};
  for (const clubId of CAREER_CLUB_IDS) {
    listingsByClub[clubId] = clubId === next.myClubId ? [] : decideAiListings(next.clubs[clubId].roster);
  }
  const clubsForOffers = {};
  for (const clubId of CAREER_CLUB_IDS) {
    clubsForOffers[clubId] = { roster: next.clubs[clubId].roster, budget: next.clubs[clubId].budget, tier: careerClubTier(clubId) };
  }
  const offers = decideAiOffers(clubsForOffers, listingsByClub, rand);
  for (const offer of offers) {
    if (offer.fromClubId === next.myClubId || offer.toClubId === next.myClubId) continue;
    const result = buyPlayer(next, offer.fromClubId, offer.toClubId, offer.playerName);
    if (result.ok) next = result.save;
  }

  // 4) Acesso/queda — resolve os 40 clubes; o par do usuário (se houver)
  //    fica pendente. `divisionMoves` junta os movimentos diretos + os
  //    mata-matas de IA já resolvidos — vira a aba "Acesso e Queda" do
  //    relatório de fim de temporada.
  const { direct, ties } = resolveDivisionMovements(next);
  const pendingUserTie = ties.find(t => t.aId === next.myClubId || t.bId === next.myClubId) || null;
  const resolvedTies = ties.filter(t => t !== pendingUserTie);
  const divisionMoves = direct.filter(d => d.move !== 'stayed').map(d => ({ clubId: d.clubId, move: d.move }));

  const divisionById = {};
  for (const clubId of SERIE_A_2026_TEAM_IDS) divisionById[clubId] = 'A';
  for (const clubId of SERIE_B_2026_TEAM_IDS) divisionById[clubId] = 'B';
  for (const { clubId, move } of direct) {
    if (move === 'promoted') divisionById[clubId] = 'A';
    else if (move === 'relegated') divisionById[clubId] = 'B';
  }
  for (const tie of resolvedTies) {
    const { winnerId, loserId } = resolvePlayoffTieAuto(next, tie, rand);
    divisionById[winnerId] = 'A';
    divisionById[loserId] = 'B';
    divisionMoves.push({ clubId: winnerId, move: 'promoted' }, { clubId: loserId, move: 'relegated' });
  }
  if (pendingUserTie) {
    // Mantém os dois na divisão atual até o usuário jogar o mata-mata —
    // quem decide o resultado final é finalizeSeasonAfterUserTie (que
    // também fecha o relatório, com o resultado desse mata-mata já
    // incluído em divisionMoves).
    divisionById[pendingUserTie.aId] = next.clubs[pendingUserTie.aId].division;
    divisionById[pendingUserTie.bId] = next.clubs[pendingUserTie.bId].division;
  }
  for (const clubId of CAREER_CLUB_IDS) {
    if (next.clubs[clubId].division !== divisionById[clubId]) {
      next = { ...next, clubs: { ...next.clubs, [clubId]: { ...next.clubs[clubId], division: divisionById[clubId] } } };
    }
  }

  if (pendingUserTie) {
    return { ...next, pendingUserTie, screen: 'playoff-tie', pendingSeasonReportData: { myClubDeltas, divisionMoves } };
  }
  const lastSeasonReport = buildSeasonReport(next, myClubDeltas, divisionMoves);
  return { ...next, lastSeasonReport, screen: 'season-report' };
}

// Chamada pela tela do Modo Carreira depois que o usuário jogou os dois
// jogos do próprio mata-mata de acesso. `myAggGoals`/`oppAggGoals` já vêm
// somados (ida + volta); em caso de empate no agregado, `penaltyWinnerIsMe`
// decide (a UI resolve os pênaltis como preferir — este motor só aplica
// o resultado final).
export function finalizeSeasonAfterUserTie(save, myAggGoals, oppAggGoals, penaltyWinnerIsMe) {
  const tie = save.pendingUserTie;
  if (!tie) return save;
  const iAmA = tie.aId === save.myClubId;
  const myId = iAmA ? tie.aId : tie.bId;
  const oppId = iAmA ? tie.bId : tie.aId;
  const iWon = myAggGoals !== oppAggGoals ? myAggGoals > oppAggGoals : !!penaltyWinnerIsMe;
  const winnerId = iWon ? myId : oppId;
  const loserId = iWon ? oppId : myId;
  const next = {
    ...save,
    pendingUserTie: null,
    clubs: {
      ...save.clubs,
      [winnerId]: { ...save.clubs[winnerId], division: 'A' },
      [loserId]: { ...save.clubs[loserId], division: 'B' },
    },
  };
  // Fecha a aba "Acesso e Queda" do relatório com o resultado do próprio
  // mata-mata do usuário, somado ao que endOfSeason já tinha resolvido pro
  // resto da liga (ver pendingSeasonReportData acima).
  const { myClubDeltas, divisionMoves } = next.pendingSeasonReportData || { myClubDeltas: [], divisionMoves: [] };
  const fullDivisionMoves = [...divisionMoves, { clubId: winnerId, move: 'promoted' }, { clubId: loserId, move: 'relegated' }];
  const lastSeasonReport = buildSeasonReport(next, myClubDeltas, fullDivisionMoves);
  return { ...next, pendingSeasonReportData: null, lastSeasonReport, screen: 'season-report' };
}

// Usuário aceita ou rejeita uma proposta recebida (save.pendingOffers[i])
// pelo próprio jogador — `offer.toClubId` é sempre o clube do usuário (só
// ofertas assim entram em pendingOffers, ver endOfSeason). Rejeitar só
// remove da lista; aceitar vende pelo valor exato que foi oferecido
// (normalmente 70%-100% do valor calculado, só 20% das vezes vem acima,
// até 115% — ver aiTransfers.js) desde que o comprador realmente tenha o
// dinheiro e o elenco do usuário continue com pelo menos 16 jogadores.
export function respondToOffer(save, offerIndex, accept) {
  const offer = save.pendingOffers[offerIndex];
  if (!offer) return save;
  const remaining = save.pendingOffers.filter((_, i) => i !== offerIndex);
  if (!accept) return { ...save, pendingOffers: remaining };
  if (offer.type === 'loan') return acceptLoanOffer(save, offer, remaining);

  const seller = save.clubs[offer.toClubId];
  const buyer = save.clubs[offer.fromClubId];
  if (!seller || !buyer) return { ...save, pendingOffers: remaining };
  if (!canSell(seller.roster)) return { ...save, pendingOffers: remaining };
  const player = seller.roster.find(p => p.name === offer.playerName);
  if (!player || buyer.budget < offer.amount) return { ...save, pendingOffers: remaining };

  return {
    ...save,
    pendingOffers: remaining,
    clubs: {
      ...save.clubs,
      [offer.toClubId]: { ...seller, roster: seller.roster.filter(p => p.name !== offer.playerName), budget: seller.budget + offer.amount },
      [offer.fromClubId]: { ...buyer, roster: [...buyer.roster, player], budget: buyer.budget - offer.amount },
    },
    transferLog: appendTransferLog(save, { type: 'user-sell', playerName: offer.playerName, fromClubId: offer.toClubId, toClubId: offer.fromClubId, amount: offer.amount }),
  };
}

// Quanto acima da proposta original o clube comprador ainda topa pagar
// numa contraproposta — acima disso, desiste do negócio (igual numa
// negociação de verdade: pedir demais pode fazer o comprador sair de
// cena, não só "recusar e manter a oferta original").
const COUNTER_ACCEPT_CEILING = 1.15;

// Usuário manda uma contraproposta (valor maior que o oferecido) pra uma
// proposta pendente. O comprador aceita se o valor pedido estiver dentro
// do que ainda topa pagar (até COUNTER_ACCEPT_CEILING da proposta
// original) E ele tiver orçamento —nesse caso a venda se fecha nesse
// valor. Senão, o comprador desiste e a proposta é removida (contestar
// tem risco de perder o negócio, não só de ficar na mesma). Devolve
// `{ save, accepted }` pra UI poder avisar o resultado.
export function counterOffer(save, offerIndex, counterAmount) {
  const offer = save.pendingOffers[offerIndex];
  if (!offer || offer.type === 'loan') return { save, accepted: false }; // empréstimo não tem valor, não dá pra contrapropor
  const remaining = save.pendingOffers.filter((_, i) => i !== offerIndex);

  const seller = save.clubs[offer.toClubId];
  const buyer = save.clubs[offer.fromClubId];
  const player = seller?.roster.find(p => p.name === offer.playerName);
  const willingCeiling = offer.amount * COUNTER_ACCEPT_CEILING;
  const buyerWalksAway = !seller || !buyer || !player || !canSell(seller.roster)
    || counterAmount > willingCeiling || counterAmount > buyer.budget;
  if (buyerWalksAway) return { save: { ...save, pendingOffers: remaining }, accepted: false };

  return {
    save: {
      ...save,
      pendingOffers: remaining,
      clubs: {
        ...save.clubs,
        [offer.toClubId]: { ...seller, roster: seller.roster.filter(p => p.name !== offer.playerName), budget: seller.budget + counterAmount },
        [offer.fromClubId]: { ...buyer, roster: [...buyer.roster, player], budget: buyer.budget - counterAmount },
      },
      transferLog: appendTransferLog(save, { type: 'user-sell', playerName: offer.playerName, fromClubId: offer.toClubId, toClubId: offer.fromClubId, amount: counterAmount }),
    },
    accepted: true,
  };
}

// Liga/desliga um jogador na lista de transferências (ver
// LISTED_OFFER_BONUS_CHANCE) — não vende nada, só sinaliza disponibilidade
// pra aumentar a chance de vir proposta por ele especificamente.
export function toggleTransferList(save, playerName) {
  const list = save.transferList || [];
  const next = list.includes(playerName) ? list.filter(n => n !== playerName) : [...list, playerName];
  return { ...save, transferList: next };
}

// "Simular até o fim da temporada" — avança dia a dia sem parar pra
// perguntar nada ao usuário até bater o fim da temporada regular (ou um
// mata-mata de acesso do PRÓPRIO usuário, que fica pendente pra ele jogar
// nas telas normais). Qualquer proposta de compra pelo jogador do usuário
// que surgir no meio do caminho é automaticamente REJEITADA (mantém o
// elenco intacto) — decisão de simplicidade: vender é algo que o usuário
// deveria decidir com calma, não no meio de um "fast forward". Devolve
// `daySummary` com a contagem de partidas/transferências que aconteceram,
// pra UI mostrar um resumo em vez do feed dia a dia.
export function simulateRestOfSeason(save) {
  let current = save;
  let matches = 0;
  let aiTransfers = 0;
  let guard = 0;
  while (guard < 400) {
    guard++;
    if (current.pendingOffers?.length) {
      current = { ...current, pendingOffers: [] };
      continue;
    }
    const { save: afterDay, event } = advanceDay(current);
    current = afterDay;
    // Jogo do próprio usuário dentro de um "simular até o fim" — ao vivo
    // só faz sentido quando o usuário está acompanhando; aqui resolve na
    // hora (igual sempre foi antes da tela de partida ao vivo existir) e
    // segue o laço sem parar, só contando como mais uma partida simulada.
    if (event === 'user-match') {
      current = resolveUserMatch(current);
      matches++;
      continue;
    }
    for (const ev of afterDay.lastDayEvents || []) {
      if (ev.type === 'match') matches++;
      if (ev.type === 'transfer-ai') aiTransfers++;
    }
    // Confronto do próprio usuário na Copa — não dá pra decidir isso
    // automaticamente (igual o mata-mata de acesso já não deixa), então
    // o "simular até o fim" para aqui e devolve o controle pra UI.
    if (event === 'copa-tie') break;
    if (event === 'season-end') {
      current = endOfSeason(current);
      break;
    }
  }
  return { save: current, daySummary: { matches, aiTransfers } };
}

// Reconstrói as duas divisões (membros, tabela zerada, calendário novo)
// a partir de `clubs[].division` já atualizado, e avança a temporada.
// Chamada SÓ pelo botão do relatório de fim de temporada
// (CareerSeasonReportScreen.jsx) — antes era a última etapa automática de
// endOfSeason/finalizeSeasonAfterUserTie; agora o relatório fica parado
// até o usuário clicar, e só então a temporada seguinte começa de verdade
// (ver `screen: 'season-report'` nos dois lugares acima).
export function advanceToNextSeason(save) {
  const afterLoans = returnSeasonLoans(save); // devolve empréstimo de 1/2 temporadas que bateu o prazo
  const rand = makePrng(hashSeed(`${save.seed}|setup|${save.season + 1}`));
  const aIds = CAREER_CLUB_IDS.filter(id => afterLoans.clubs[id].division === 'A');
  const bIds = CAREER_CLUB_IDS.filter(id => afterLoans.clubs[id].division === 'B');
  const seasonCalendar = buildSeasonCalendar(38);
  return {
    ...afterLoans,
    season: afterLoans.season + 1,
    divisionA: buildDivision(aIds, rand),
    divisionB: buildDivision(bIds, rand),
    pendingUserTie: null,
    pendingUserCopaTie: null,
    calendarDay: 1,
    seasonCalendar,
    copa: drawCopaBracket(afterLoans, rand),
    seasonPlayerStats: {},
    lastSeasonReport: null,
    pendingSeasonReportData: null,
    screen: 'hub',
  };
}
