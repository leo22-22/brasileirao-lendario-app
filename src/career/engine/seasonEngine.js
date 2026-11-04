// Motor de temporada do Modo Carreira: avança rodadas, resolve o fim de
// temporada (acesso/queda pros 40 clubes, premiação, categoria de base,
// janela de transferências da IA) e prepara a temporada seguinte.
//
// Reaproveita sem alterar: applyRoundToTable, resolveDivisionEnd,
// simAiMatch, generateDoubleRoundRobin, matchPrng, hashSeed, makePrng,
// teamStrength (todos exportados de App.jsx nesta sessão). `resolveDivisionEnd`
// só resolve o destino de UM time por vez — por isso chamamos ela uma vez
// pra cada um dos 40 clubes (ver resolveDivisionMovements abaixo) em vez de
// reescrever a lógica de posição/playoff que já existe lá.
import { TEAMS } from '../../data/teams.js';
import {
  applyRoundToTable, resolveDivisionEnd, simAiMatch, generateDoubleRoundRobin,
  matchPrng, hashSeed, makePrng, teamStrength,
} from '../../App.jsx';
import { CAREER_CLUB_IDS, SERIE_A_2026_TEAM_IDS, SERIE_B_2026_TEAM_IDS, careerClubTier } from '../../data/career-clubs.js';
import { cloneAllRosters, addPlayersToClub, creditBudget, buyPlayer, replaceRoster, canSell, MIN_SQUAD_SIZE } from './rosterStore.js';
import { computePrizeMoney } from './economy.js';
import { generateClubYouthBatch, applyYouthGrowth } from './youth.js';
import { decideAiListings, decideAiOffers } from './aiTransfers.js';
import { buildSeasonCalendar, isTransferWindowOpen } from './calendar.js';

export { isTransferWindowOpen } from './calendar.js';

function emptyTableRow(clubId) {
  const team = TEAMS.find(t => t.id === clubId);
  return { id: clubId, label: team.label, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 };
}

function buildDivision(teamIds, rand) {
  const shuffled = [...teamIds].sort(() => rand() - 0.5);
  return {
    teamIdsInOrder: shuffled,
    table: shuffled.map(emptyTableRow),
    fixtures: generateDoubleRoundRobin(shuffled),
    round: 0,
    // results[roundIdx] = placares daquela rodada — guardado pra tela de
    // calendário mostrar o que já foi jogado, não só a tabela acumulada.
    results: [],
  };
}

// Save inicial de uma carreira nova — clona os 40 elencos a partir de
// TEAMS (nunca mais lê TEAMS pra mutar nada depois disso) e sorteia o
// calendário das duas divisões.
export function createCareerSave(myClubId, seedOverride) {
  const seed = seedOverride || `career-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const rand = makePrng(hashSeed(`${seed}|setup`));
  return {
    version: 1,
    seed,
    season: 1,
    myClubId,
    clubs: cloneAllRosters(),
    divisionA: buildDivision(SERIE_A_2026_TEAM_IDS, rand),
    divisionB: buildDivision(SERIE_B_2026_TEAM_IDS, rand),
    pendingUserTie: null,
    pendingOffers: [],
    // Começa em 1º de janeiro — dentro da janela de pré-temporada, de
    // propósito (dá pra reforçar o elenco antes da temporada começar).
    calendarDay: 1,
    seasonCalendar: buildSeasonCalendar(38),
    screen: 'hub',
  };
}

// Monta o "time pra simular" de um clube a partir do save — nunca lê
// team.players de TEAMS, só save.clubs[id].roster (a cópia mutável).
// Titulares = os 11 de maior OVR (sem se preocupar com formação/posição) —
// EXCETO pro próprio clube do usuário, que usa a escalação de verdade
// escolhida na tela de Formação (save.myStarters, nomes na ordem titular
// → banco, calculada por autoFillSquadFromTeam em CareerFormationScreen).
// Sem isso, a tela de Formação seria só cosmética.
function teamForSim(save, clubId) {
  const base = TEAMS.find(t => t.id === clubId);
  const roster = save.clubs[clubId].roster;
  let ordered;
  if (clubId === save.myClubId && save.myStarters?.length) {
    const starterSet = new Set(save.myStarters);
    const starters = save.myStarters.map(name => roster.find(p => p.name === name)).filter(Boolean);
    const rest = roster.filter(p => !starterSet.has(p.name)).sort((a, b) => b.ovr - a.ovr);
    ordered = [...starters, ...rest];
  } else {
    ordered = [...roster].sort((a, b) => b.ovr - a.ovr);
  }
  const players = ordered.map((p, i) => ({ ...p, club: base.club, isBench: i >= 11 }));
  return {
    id: clubId,
    label: base.label,
    club: base.club,
    color: base.colors?.p,
    ovr: teamStrength(Object.fromEntries(players.map((p, i) => [i, p]))),
    players,
  };
}

// Resolve todas as partidas de uma rodada de uma divisão. `userMatch`
// (opcional) é o resultado já pronto da partida do usuário (vinda do
// fluxo normal de partida ao vivo ou de "simular") — substitui a
// simulação automática só pra esse confronto específico daquela rodada.
function playDivisionRound(save, divisionKey, roundIdx, userMatch) {
  const division = save[divisionKey];
  const matches = division.fixtures[roundIdx] || [];
  const roundResults = matches.map(m => {
    if (userMatch && m.homeId === userMatch.homeId && m.awayId === userMatch.awayId) {
      return { homeId: m.homeId, awayId: m.awayId, homeGoals: userMatch.homeGoals, awayGoals: userMatch.awayGoals };
    }
    const home = teamForSim(save, m.homeId);
    const away = teamForSim(save, m.awayId);
    const rand = matchPrng(save.seed, `s${save.season}-r${roundIdx}`, m.homeId, m.awayId);
    const sim = simAiMatch(home, away, rand);
    return { homeId: m.homeId, awayId: m.awayId, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
  });
  const newTable = applyRoundToTable(division.table, roundResults);
  return {
    ...division,
    table: newTable,
    round: roundIdx + 1,
    results: [...(division.results || []), roundResults],
  };
}

// Avança UMA rodada nas duas divisões de uma vez (elas sempre andam
// juntas, mesmo a divisão onde o usuário não joga precisa existir de
// verdade — os 40 clubes são persistentes). `userMatch` só tem efeito na
// divisão onde `save.myClubId` está.
export function playRound(save, roundIdx, userMatch) {
  const myDivisionKey = save.clubs[save.myClubId].division === 'A' ? 'divisionA' : 'divisionB';
  const divisionA = playDivisionRound(save, 'divisionA', roundIdx, myDivisionKey === 'divisionA' ? userMatch : null);
  const divisionB = playDivisionRound(save, 'divisionB', roundIdx, myDivisionKey === 'divisionB' ? userMatch : null);
  return { ...save, divisionA, divisionB };
}

// Chance de surgir uma sondagem por um jogador do usuário em cada dia
// dentro de uma janela aberta — baixa o bastante pra não virar uma
// proposta por dia, alta o bastante pra aparecer algumas vezes em 31+62
// dias de janela por temporada.
const DAILY_OFFER_CHANCE = 0.08;

// Sonda se algum dos outros 39 clubes quer comprar um jogador do usuário
// hoje — reaproveita decideAiOffers tratando o elenco do usuário inteiro
// como "disponível pra sondagem" (diferente de decideAiListings, que só
// marca a gordura de elenco das IAs entre si; aqui qualquer jogador do
// usuário pode receber uma oferta, já que é o próprio jogador quem decide
// vender ou não — ver respondToOffer).
// Quantas das últimas propostas recentes (pelo jogador do usuário) ficam
// em "cooldown" — mesmo quando um jogador é consistentemente o candidato
// mais barato/mais procurado pra uma posição carente (ex.: um titular
// barato numa posição que falta em vários elencos), isso sozinho fazia a
// proposta cair sempre nele. O cooldown garante variedade de verdade ao
// longo da janela, não só no mesmo dia.
const OFFER_COOLDOWN_SIZE = 3;

function generateUserOffer(save, rand, recentNames) {
  const myRoster = save.clubs[save.myClubId].roster;
  if (myRoster.length <= MIN_SQUAD_SIZE) return null;
  const clubsForOffers = {};
  const listingsByClub = {};
  for (const clubId of CAREER_CLUB_IDS) {
    clubsForOffers[clubId] = { roster: save.clubs[clubId].roster, budget: save.clubs[clubId].budget, tier: careerClubTier(clubId) };
    listingsByClub[clubId] = clubId === save.myClubId ? myRoster.map(p => p.name) : decideAiListings(save.clubs[clubId].roster);
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
    const division = current[myDivisionKey];
    const nextRoundIdx = division.round;
    if (nextRoundIdx >= division.fixtures.length) {
      return { save: { ...current, calendarDay: day, lastDayEvents: events }, event: 'season-end' };
    }
    if (day === current.seasonCalendar[nextRoundIdx]) {
      const played = playRound(current, nextRoundIdx, null);
      const myMatch = findMyMatchResult(played, nextRoundIdx);
      if (myMatch) events.push({ type: 'match', day, ...myMatch });
      return { save: { ...played, calendarDay: day, lastDayEvents: events }, event: 'match', roundIdx: nextRoundIdx };
    }
    if (isTransferWindowOpen(day)) {
      const offerRand = makePrng(hashSeed(`${current.seed}|offer-check|${day}`));
      if (offerRand() < DAILY_OFFER_CHANCE) {
        const offer = generateUserOffer(current, offerRand, current.recentOfferNames);
        if (offer) {
          events.push({ type: 'offer', day, ...offer });
          const recentOfferNames = [...(current.recentOfferNames || []), offer.playerName].slice(-OFFER_COOLDOWN_SIZE);
          return { save: { ...current, calendarDay: day, pendingOffers: [...(current.pendingOffers || []), offer], recentOfferNames, lastDayEvents: events }, event: 'offer' };
        }
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
  const home1 = teamForSim(save, tie.leg1Match.homeId);
  const away1 = teamForSim(save, tie.leg1Match.awayId);
  const leg1 = simAiMatch(home1, away1, rand);
  const home2 = teamForSim(save, tie.leg1Match.awayId); // volta: inverte casa/fora
  const away2 = teamForSim(save, tie.leg1Match.homeId);
  const leg2 = simAiMatch(home2, away2, rand);
  // Agregado na perspectiva de quem jogou a ida em casa (leg1Match.homeId).
  const aggHome1 = leg1.homeGoals + leg2.awayGoals;
  const aggAway1 = leg1.awayGoals + leg2.homeGoals;
  let winnerId;
  if (aggHome1 !== aggAway1) {
    winnerId = aggHome1 > aggAway1 ? tie.leg1Match.homeId : tie.leg1Match.awayId;
  } else {
    // Empate no agregado: decide com uma partida extra em campo neutro
    // (sem pênaltis aqui — é um par de IA, nunca visto pelo usuário;
    // decisão de simplicidade, documentada).
    const decider = simAiMatch(teamForSim(save, tie.aId), teamForSim(save, tie.bId), rand);
    winnerId = decider.homeGoals >= decider.awayGoals ? tie.aId : tie.bId;
  }
  const loserId = winnerId === tie.aId ? tie.bId : tie.aId;
  return { winnerId, loserId };
}

// Simula o mata-mata de acesso do PRÓPRIO usuário com o time real dos
// dois lados (nada de o jogador escolher o resultado) — a experiência de
// jogar os 2 jogos minuto a minuto, como o modo `serieab` já faz, fica
// pra uma atualização futura; por ora, o resultado é decidido pela força
// real dos elencos + aleatoriedade, igual a qualquer outra partida do
// motor. Não aplica nada no save — só devolve o placar pra tela mostrar
// antes de chamar finalizeSeasonAfterUserTie.
export function simulateUserTie(save) {
  const tie = save.pendingUserTie;
  if (!tie) return null;
  const rand = makePrng(hashSeed(`${save.seed}|user-tie|${save.season}`));
  const home1 = teamForSim(save, tie.leg1Match.homeId);
  const away1 = teamForSim(save, tie.leg1Match.awayId);
  const leg1 = simAiMatch(home1, away1, rand);
  const home2 = teamForSim(save, tie.leg1Match.awayId);
  const away2 = teamForSim(save, tie.leg1Match.homeId);
  const leg2 = simAiMatch(home2, away2, rand);
  const iAmA = tie.aId === save.myClubId;
  const myId = iAmA ? tie.aId : tie.bId;
  const oppId = iAmA ? tie.bId : tie.aId;
  const myLeg1IsHome = tie.leg1Match.homeId === myId;
  const myAggGoals = myLeg1IsHome ? leg1.homeGoals + leg2.awayGoals : leg1.awayGoals + leg2.homeGoals;
  const oppAggGoals = myLeg1IsHome ? leg1.awayGoals + leg2.homeGoals : leg1.homeGoals + leg2.awayGoals;
  const penaltyWinnerIsMe = myAggGoals === oppAggGoals ? rand() < 0.5 : null;
  return {
    myId, oppId, leg1, leg2, myAggGoals, oppAggGoals, penaltyWinnerIsMe,
    wentToPenalties: myAggGoals === oppAggGoals,
  };
}

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

  // 2) Categoria de base: 2-3 jovens por clube, idade/overall/potencial
  //    sorteados; jovens já existentes envelhecem e crescem até o potencial.
  for (const clubId of CAREER_CLUB_IDS) {
    const grown = next.clubs[clubId].roster.map(applyYouthGrowth);
    next = replaceRoster(next, clubId, grown);
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
  //    fica pendente.
  const { direct, ties } = resolveDivisionMovements(next);
  const pendingUserTie = ties.find(t => t.aId === next.myClubId || t.bId === next.myClubId) || null;
  const resolvedTies = ties.filter(t => t !== pendingUserTie);

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
  }
  if (pendingUserTie) {
    // Mantém os dois na divisão atual até o usuário jogar o mata-mata —
    // quem decide o resultado final é finalizeSeasonAfterUserTie.
    divisionById[pendingUserTie.aId] = next.clubs[pendingUserTie.aId].division;
    divisionById[pendingUserTie.bId] = next.clubs[pendingUserTie.bId].division;
  }
  for (const clubId of CAREER_CLUB_IDS) {
    if (next.clubs[clubId].division !== divisionById[clubId]) {
      next = { ...next, clubs: { ...next.clubs, [clubId]: { ...next.clubs[clubId], division: divisionById[clubId] } } };
    }
  }

  if (pendingUserTie) {
    return { ...next, pendingUserTie, screen: 'playoff-tie' };
  }
  return startNextSeason(next);
}

// Chamada pela tela do Modo Carreira depois que o usuário jogou os dois
// jogos do próprio mata-mata de acesso. `myAggGoals`/`oppAggGoals` já vêm
// somados (ida + volta); em caso de empate no agregado, `penaltyWinnerIsMe`
// decide (a UI resolve os pênaltis como preferir — este motor só aplica
// o resultado final).
export function finalizeSeasonAfterUserTie(save, myAggGoals, oppAggGoals, penaltyWinnerIsMe) {
  const tie = save.pendingUserTie;
  if (!tie) return startNextSeason(save);
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
  return startNextSeason(next);
}

// Usuário aceita ou rejeita uma proposta recebida (save.pendingOffers[i])
// pelo próprio jogador — `offer.toClubId` é sempre o clube do usuário (só
// ofertas assim entram em pendingOffers, ver endOfSeason). Rejeitar só
// remove da lista; aceitar vende pelo valor exato que foi oferecido
// (pode ser até 10% acima do valor calculado — ver aiTransfers.js) desde
// que o comprador realmente tenha o dinheiro (a oferta foi gerada
// checando o valor BASE, não o valor com o acréscimo de até 10%, então
// esse recheck evita o comprador de IA ficar com orçamento negativo) e o
// elenco do usuário continue com pelo menos 16 jogadores.
export function respondToOffer(save, offerIndex, accept) {
  const offer = save.pendingOffers[offerIndex];
  if (!offer) return save;
  const remaining = save.pendingOffers.filter((_, i) => i !== offerIndex);
  if (!accept) return { ...save, pendingOffers: remaining };

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
  };
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
    for (const ev of afterDay.lastDayEvents || []) {
      if (ev.type === 'match') matches++;
      if (ev.type === 'transfer-ai') aiTransfers++;
    }
    if (event === 'season-end') {
      current = endOfSeason(current);
      break;
    }
  }
  return { save: current, daySummary: { matches, aiTransfers } };
}

// Reconstrói as duas divisões (membros, tabela zerada, calendário novo)
// a partir de `clubs[].division` já atualizado, e avança a temporada.
function startNextSeason(save) {
  const rand = makePrng(hashSeed(`${save.seed}|setup|${save.season + 1}`));
  const aIds = CAREER_CLUB_IDS.filter(id => save.clubs[id].division === 'A');
  const bIds = CAREER_CLUB_IDS.filter(id => save.clubs[id].division === 'B');
  return {
    ...save,
    season: save.season + 1,
    divisionA: buildDivision(aIds, rand),
    divisionB: buildDivision(bIds, rand),
    pendingUserTie: null,
    calendarDay: 1,
    seasonCalendar: buildSeasonCalendar(38),
    screen: 'hub',
  };
}
