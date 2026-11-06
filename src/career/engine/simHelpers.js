// Helpers de simulação compartilhados entre seasonEngine.js (Brasileirão +
// acesso/queda) e copaEngine.js (Copa do Brasil) — extraídos pra um módulo
// próprio pra evitar import circular entre os dois motores de competição
// (cada um tem sua própria lógica de avanço de fase, mas a matemática de
// "ida + volta + agregado + decisão de empate" é a mesma em todo o Modo
// Carreira, e repeti-la em cada motor seria a mesma causa de bug duas
// vezes se um dia precisar mudar).
import { TEAMS } from '../../data/teams.js';
import { simAiMatch, teamStrength, buildLiveMatchEvents } from '../../App.jsx';

// Monta o "time pra simular" de um clube a partir do save — nunca lê
// team.players de TEAMS, só save.clubs[id].roster (a cópia mutável).
// Titulares = os 11 de maior OVR (sem se preocupar com formação/posição) —
// EXCETO pro próprio clube do usuário, que usa a escalação de verdade
// escolhida na tela de Formação (save.myStarters).
export function teamForSim(save, clubId) {
  const base = TEAMS.find(t => t.id === clubId);
  // Jogador da categoria de base nunca entra em campo (nem como reserva) —
  // só depois de promovido ou completar 20 anos (ver inAcademy, youth.js/
  // rosterStore.js/seasonEngine.js). Rede de segurança: a Formação já não
  // oferece esses jogadores pra escalar, isso aqui cobre qualquer save
  // antigo ou caminho que não passe por lá.
  const roster = save.clubs[clubId].roster.filter(p => !p.inAcademy);
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
    sim: { homeGoals: sim.homeGoals, awayGoals: sim.awayGoals, ratings: sim.ratings, events },
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
