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
import { cloneAllRosters, addPlayersToClub, creditBudget, buyPlayer, replaceRoster } from './rosterStore.js';
import { computePrizeMoney } from './economy.js';
import { generateClubYouthBatch, applyYouthGrowth } from './youth.js';
import { decideAiListings, decideAiOffers } from './aiTransfers.js';

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
    screen: 'hub',
  };
}

// Monta o "time pra simular" de um clube a partir do save — nunca lê
// team.players de TEAMS, só save.clubs[id].roster (a cópia mutável).
// Titulares = os 11 de maior OVR (sem se preocupar com formação/posição;
// isso só importa pro elenco do próprio usuário, tratado em telas
// separadas — aqui é só pra alimentar simAiMatch dos outros 39 clubes).
function teamForSim(save, clubId) {
  const base = TEAMS.find(t => t.id === clubId);
  const roster = save.clubs[clubId].roster;
  const ordered = [...roster].sort((a, b) => b.ovr - a.ovr);
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
  const results = matches.map(m => {
    if (userMatch && m.homeId === userMatch.homeId && m.awayId === userMatch.awayId) {
      return { homeId: m.homeId, awayId: m.awayId, homeGoals: userMatch.homeGoals, awayGoals: userMatch.awayGoals };
    }
    const home = teamForSim(save, m.homeId);
    const away = teamForSim(save, m.awayId);
    const rand = matchPrng(save.seed, `s${save.season}-r${roundIdx}`, m.homeId, m.awayId);
    const sim = simAiMatch(home, away, rand);
    return { homeId: m.homeId, awayId: m.awayId, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
  });
  const newTable = applyRoundToTable(division.table, results);
  return {
    ...division,
    table: newTable,
    round: roundIdx + 1,
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

  // 3) Janela de transferências da IA — no máximo 1 proposta por clube,
  //    aplicada direto (sem o usuário participar; os clubes de IA entre
  //    si não perguntam pra ninguém). Se um jogador já foi vendido antes
  //    nesta mesma janela, buyPlayer simplesmente falha (ok:false) e a
  //    oferta é ignorada — sem lógica extra de "remover da lista".
  const listingsByClub = {};
  for (const clubId of CAREER_CLUB_IDS) listingsByClub[clubId] = decideAiListings(next.clubs[clubId].roster);
  const clubsForOffers = {};
  for (const clubId of CAREER_CLUB_IDS) {
    clubsForOffers[clubId] = { roster: next.clubs[clubId].roster, budget: next.clubs[clubId].budget, tier: careerClubTier(clubId) };
  }
  const offers = decideAiOffers(clubsForOffers, listingsByClub, rand);
  for (const offer of offers) {
    if (offer.fromClubId === next.myClubId || offer.toClubId === next.myClubId) continue; // o usuário decide o próprio caso na aba Propostas, não aqui
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
    screen: 'hub',
  };
}
