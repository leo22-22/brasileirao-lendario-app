// Helpers de simulação compartilhados entre seasonEngine.js (Brasileirão +
// acesso/queda) e copaEngine.js (Copa do Brasil) — extraídos pra um módulo
// próprio pra evitar import circular entre os dois motores de competição
// (cada um tem sua própria lógica de avanço de fase, mas a matemática de
// "ida + volta + agregado + decisão de empate" é a mesma em todo o Modo
// Carreira, e repeti-la em cada motor seria a mesma causa de bug duas
// vezes se um dia precisar mudar).
import { TEAMS } from '../../data/teams.js';
import { simAiMatch, teamStrength } from '../../App.jsx';

// Monta o "time pra simular" de um clube a partir do save — nunca lê
// team.players de TEAMS, só save.clubs[id].roster (a cópia mutável).
// Titulares = os 11 de maior OVR (sem se preocupar com formação/posição) —
// EXCETO pro próprio clube do usuário, que usa a escalação de verdade
// escolhida na tela de Formação (save.myStarters).
export function teamForSim(save, clubId) {
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

// Simula (sem aplicar nada no save) o confronto de ida+volta do PRÓPRIO
// usuário — a experiência de jogar os 2 jogos minuto a minuto, como o modo
// `serieab` já faz, fica pra uma atualização futura; por ora o resultado é
// decidido pela força real dos elencos + aleatoriedade, igual qualquer
// outra partida do motor. Devolve o placar pra tela mostrar antes de quem
// chamou aplicar o resultado de verdade no save.
export function simulateTwoLegTieForUser(save, homeId1, awayId1, myId, rand) {
  const leg1 = simAiMatch(teamForSim(save, homeId1), teamForSim(save, awayId1), rand);
  const leg2 = simAiMatch(teamForSim(save, awayId1), teamForSim(save, homeId1), rand);
  const oppId = myId === homeId1 ? awayId1 : homeId1;
  const myLeg1IsHome = homeId1 === myId;
  const myAggGoals = myLeg1IsHome ? leg1.homeGoals + leg2.awayGoals : leg1.awayGoals + leg2.homeGoals;
  const oppAggGoals = myLeg1IsHome ? leg1.awayGoals + leg2.homeGoals : leg1.homeGoals + leg2.awayGoals;
  const penaltyWinnerIsMe = myAggGoals === oppAggGoals ? rand() < 0.5 : null;
  return {
    myId, oppId, leg1, leg2, myAggGoals, oppAggGoals, penaltyWinnerIsMe,
    wentToPenalties: myAggGoals === oppAggGoals,
  };
}
