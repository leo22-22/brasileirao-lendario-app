// Helpers de simulação compartilhados entre seasonEngine.js (Brasileirão +
// acesso/queda) e copaEngine.js (Copa do Brasil) — extraídos pra um módulo
// próprio pra evitar import circular entre os dois motores de competição
// (cada um tem sua própria lógica de avanço de fase, mas a matemática de
// "ida + volta + agregado + decisão de empate" é a mesma em todo o Modo
// Carreira, e repeti-la em cada motor seria a mesma causa de bug duas
// vezes se um dia precisar mudar).
import { TEAMS } from '../../data/teams.js';
import { simAiMatch, teamStrength, buildLiveMatchEvents, makePrng, hashSeed } from '../../App.jsx';
import { playerSeasonStats } from './seasonStats.js';
import { POS_ORDER } from '../../lib/format.js';

const OUTFIELD_POS = POS_ORDER.filter(p => p !== 'GOL');
// Tamanho do banco pra QUALQUER clube (meu ou de IA) — titular(11) +
// banco(12) = 23 no elenco de jogo; o resto do elenco é "reserva dos
// reservas", nem entra como repositor de lesão (pedido explícito do
// usuário 2026-11-11).
const BENCH_SIZE = 12;

// Retrospecto real das últimas N rodadas JÁ JOGADAS de um clube (mais
// recente primeiro) — movido pra cá (antes vivia só em CareerHub.jsx,
// pra alimentar os indicadores V/E/D do card de próximo jogo) porque
// `clubMoraleBonus` (motor) precisa da mesma sequência; um lugar só evita
// duas implementações da mesma busca em division.results.
export function clubForm(division, clubId, count = 3) {
  const form = [];
  for (let r = division.round - 1; r >= 0 && form.length < count; r--) {
    const m = (division.results?.[r] || []).find(x => x.homeId === clubId || x.awayId === clubId);
    if (!m) continue;
    const isHome = m.homeId === clubId;
    const gf = isHome ? m.homeGoals : m.awayGoals;
    const ga = isHome ? m.awayGoals : m.homeGoals;
    form.push(gf > ga ? 'V' : gf < ga ? 'D' : 'E');
  }
  return form;
}

// Bônus/penalidade de moral na força do time, pela sequência de resultados
// do Brasileirão (não conta jogo de Copa do Brasil, que fica num histórico
// separado) — pedido explícito do usuário (2026-11-11): time embalado joga
// um pouco acima do seu nível de elenco, time afundado um pouco abaixo,
// sem contar mais que a força de elenco em si (ainda o fator principal).
// Regras checadas nessa ordem, a primeira que bater vale (não acumula):
// invicto nos últimos 10 (V/E, nenhum D) = +10%; últimos 2 as duas vitórias
// = +4%; últimos 5 sem nenhuma vitória = -5%; senão 0%.
export function clubMoraleBonus(save, clubId) {
  const divisionKey = save.clubs[clubId].division === 'A' ? 'divisionA' : 'divisionB';
  const division = save[divisionKey];
  const last10 = clubForm(division, clubId, 10);
  if (last10.length === 10 && last10.every(r => r !== 'D')) return 0.10;
  const last2 = clubForm(division, clubId, 2);
  if (last2.length === 2 && last2.every(r => r === 'V')) return 0.04;
  const last5 = clubForm(division, clubId, 5);
  if (last5.length === 5 && last5.every(r => r !== 'V')) return -0.05;
  return 0;
}

// Rotação de titulares dos clubes de IA — dá minuto pra quem joga pouco
// ao longo da temporada (pedido explícito do usuário 2026-11-11: "fazer a
// simulação substituir jogadores automaticamente... no final da
// temporada jogadores reservas terem partidas também", citando o caso de
// tirar um titular fixo e colocar o reserva que nunca jogou). Só pra IA —
// o MEU time usa exatamente a escalação+banco que o usuário confirmou na
// Formação, sem interferência nenhuma (ele decide quando/se rotaciona).
// Cada tentativa troca 1 titular por 1 do banco NA MESMA posição
// primária, sempre tirando quem já jogou MAIS partidas na temporada e
// colocando quem jogou MENOS — nunca mexe no goleiro (convenção: time
// real raramente roda o gol). Se não achar um par na mesma posição pra
// aquela tentativa, pula ela (não força troca de posição diferente).
const ROTATION_CHANCE = 0.3;
const MAX_ROTATIONS = 3;

function rotateLineup(starters, bench, save, clubId, rand) {
  if (rand() >= ROTATION_CHANCE) return { starters, bench };
  const matchesOf = (p) => playerSeasonStats(save.seasonPlayerStats, clubId, p.name).matches || 0;
  let nextStarters = starters;
  let nextBench = bench;
  const attempts = 1 + Math.floor(rand() * MAX_ROTATIONS);
  for (let i = 0; i < attempts; i++) {
    const posGroup = OUTFIELD_POS[Math.floor(rand() * OUTFIELD_POS.length)];
    const starterIdx = nextStarters.reduce((best, p, idx) => (
      p.pos[0] === posGroup && (best === -1 || matchesOf(p) > matchesOf(nextStarters[best])) ? idx : best
    ), -1);
    const benchIdx = nextBench.reduce((best, p, idx) => (
      p.pos[0] === posGroup && (best === -1 || matchesOf(p) < matchesOf(nextBench[best])) ? idx : best
    ), -1);
    if (starterIdx === -1 || benchIdx === -1) continue;
    const outPlayer = nextStarters[starterIdx];
    const inPlayer = nextBench[benchIdx];
    nextStarters = nextStarters.map((p, idx) => (idx === starterIdx ? inPlayer : p));
    nextBench = nextBench.map((p, idx) => (idx === benchIdx ? outPlayer : p));
  }
  return { starters: nextStarters, bench: nextBench };
}

// Monta o "time pra simular" de um clube a partir do save — nunca lê
// team.players de TEAMS, só save.clubs[id].roster (a cópia mutável).
// Titular(11) + banco(até 12) = elenco de jogo; o resto do elenco não
// entra nem como repositor de lesão ("reserva dos reservas"). Pro
// PRÓPRIO clube do usuário, titulares E banco são exatamente o que foi
// confirmado na tela de Formação (save.myStarters/save.myBench); pros
// outros 39, titular/banco são os melhores por OVR, com rotação (ver
// `rotateLineup`) só pra eles.
export function teamForSim(save, clubId) {
  const base = TEAMS.find(t => t.id === clubId);
  // Jogador da categoria de base nunca entra em campo (nem como reserva) —
  // só depois de promovido ou completar 20 anos (ver inAcademy, youth.js/
  // rosterStore.js/seasonEngine.js). Rede de segurança: a Formação já não
  // oferece esses jogadores pra escalar, isso aqui cobre qualquer save
  // antigo ou caminho que não passe por lá.
  const roster = save.clubs[clubId].roster.filter(p => !p.inAcademy);
  const isMine = clubId === save.myClubId;

  let starters, bench;
  if (isMine && save.myStarters?.length) {
    const starterSet = new Set(save.myStarters);
    starters = save.myStarters.map(name => roster.find(p => p.name === name)).filter(Boolean);
    bench = (save.myBench || [])
      .map(name => roster.find(p => p.name === name))
      .filter(p => p && !starterSet.has(p.name));
  } else {
    const sorted = [...roster].sort((a, b) => b.ovr - a.ovr);
    starters = sorted.slice(0, 11);
    bench = sorted.slice(11, 11 + BENCH_SIZE);
    if (!isMine) {
      const rand = makePrng(hashSeed(`${save.seed}|rotation|${clubId}|${save.calendarDay}`));
      ({ starters, bench } = rotateLineup(starters, bench, save, clubId, rand));
    }
  }

  const players = [...starters, ...bench].map((p, i) => ({ ...p, club: base.club, isBench: i >= starters.length }));
  const baseOvr = teamStrength(Object.fromEntries(players.map((p, i) => [i, p])));
  return {
    id: clubId,
    label: base.label,
    club: base.club,
    color: base.colors?.p,
    ovr: Math.round(baseOvr * (1 + clubMoraleBonus(save, clubId)) * 10) / 10,
    players,
  };
}

// Resolve um confronto de ida+volta inteiro ENTRE DOIS CLUBES DE IA (nunca
// visto pelo usuário) — decide com uma partida extra em campo neutro se
// empatar no agregado (decisão de simplicidade, documentada: sem pênaltis
// de verdade aqui, já que ninguém vê). `homeId1`/`awayId1` definem quem
// joga a ida em casa; a volta inverte automaticamente.
export function resolveTwoLegTieAuto(save, homeId1, awayId1, rand) {
  const leg1 = simAiMatch(teamForSim(save, homeId1), teamForSim(save, awayId1), rand);
  const leg2 = simAiMatch(teamForSim(save, awayId1), teamForSim(save, homeId1), rand);
  const aggHome1 = leg1.homeGoals + leg2.awayGoals;
  const aggAway1 = leg1.awayGoals + leg2.homeGoals;
  let winnerId;
  if (aggHome1 !== aggAway1) {
    winnerId = aggHome1 > aggAway1 ? homeId1 : awayId1;
  } else {
    const decider = simAiMatch(teamForSim(save, homeId1), teamForSim(save, awayId1), rand);
    winnerId = decider.homeGoals >= decider.awayGoals ? homeId1 : awayId1;
  }
  return { winnerId, loserId: winnerId === homeId1 ? awayId1 : homeId1, leg1, leg2 };
}

// Monta UMA perna (ida ou volta) com o timeline minuto a minuto pronto pra
// animar — mesmo formato que `pendingUserMatch` já usa pro jogo comum do
// Brasileirão (ver advanceDay em seasonEngine.js), reaproveitado aqui pra
// cada perna de um confronto eliminatório (e pra PARTIDA ÚNICA da final da
// Copa do Brasil, ver copaEngine.js — a final não tem volta).
export function legPackage(save, homeId, awayId, rand) {
  const homeTeamFull = teamForSim(save, homeId);
  const awayTeamFull = teamForSim(save, awayId);
  const sim = simAiMatch(homeTeamFull, awayTeamFull, rand);
  const events = buildLiveMatchEvents(sim, homeTeamFull, homeTeamFull.players.slice(0, 11), awayTeamFull, awayTeamFull.players.slice(0, 11));
  return {
    homeTeam: { id: homeTeamFull.id, label: homeTeamFull.label, club: homeTeamFull.club, color: homeTeamFull.color },
    awayTeam: { id: awayTeamFull.id, label: awayTeamFull.label, club: awayTeamFull.club, color: awayTeamFull.color },
    sim: { homeGoals: sim.homeGoals, awayGoals: sim.awayGoals, ratings: sim.ratings, events, homeGkName: sim.homeGkName, awayGkName: sim.awayGkName },
  };
}

// Prepara (sem aplicar nada no save) o confronto de ida+volta do PRÓPRIO
// usuário pra ser jogado ao vivo, perna por perna — igual o usuário pediu
// explicitamente ("não é jogar os dois jogos, tem que ser igual o modo
// Copa do Brasil"): cada perna vem com o timeline minuto a minuto pronto
// (mesmo motor do jogo comum do Brasileirão), não só o placar final.
// Devolve tudo pronto pra tela mostrar antes de quem chamou aplicar o
// resultado de verdade no save.
export function prepareTwoLegTieForUser(save, homeId1, awayId1, myId, rand) {
  const leg1 = legPackage(save, homeId1, awayId1, rand);
  const leg2 = legPackage(save, awayId1, homeId1, rand);
  const oppId = myId === homeId1 ? awayId1 : homeId1;
  const myLeg1IsHome = homeId1 === myId;
  const myAggGoals = myLeg1IsHome ? leg1.sim.homeGoals + leg2.sim.awayGoals : leg1.sim.awayGoals + leg2.sim.homeGoals;
  const oppAggGoals = myLeg1IsHome ? leg1.sim.awayGoals + leg2.sim.homeGoals : leg1.sim.homeGoals + leg2.sim.awayGoals;
  const penaltyWinnerIsMe = myAggGoals === oppAggGoals ? rand() < 0.5 : null;
  return {
    myId, oppId, leg1, leg2, myAggGoals, oppAggGoals, penaltyWinnerIsMe,
    wentToPenalties: myAggGoals === oppAggGoals,
  };
}
