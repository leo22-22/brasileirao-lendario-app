// Sistema de empréstimo do Modo Carreira — pedido explícito do usuário
// (2026-11-06): emprestar um jogador meu (geralmente jovem ou que não
// joga) pra outro clube, ou pedir emprestado um jogador de outro clube.
// Nas duas direções quem decide é o clube DONO do jogador no momento do
// pedido — sem dinheiro envolvido (decisão de simplicidade: empréstimo
// real às vezes tem taxa, mas o pedido do usuário foi só "emprestar"/
// "pedir emprestado", sem mencionar valor).
//
// O jogador MUDA DE ELENCO de verdade enquanto dura o empréstimo (sai do
// roster de quem empresta, entra no de quem recebe, com `onLoanFrom`
// marcando o dono original) — não um registro paralelo. Isso faz ele jogar
// de verdade pelo clube que recebeu (teamForSim já usa `clubs[id].roster`
// direto) sem precisar de nenhum código extra em lugar nenhum do motor de
// simulação; só a volta precisa de lógica própria (ver returnDueLoans/
// returnSeasonLoans, chamadas por seasonEngine.js).
import { CAREER_CLUB_IDS } from '../../data/career-clubs.js';
import { addPlayersToClub, replaceRoster, appendTransferLog, canSell, MIN_SQUAD_SIZE } from './rosterStore.js';

export const LOAN_DURATIONS = [
  { kind: '6m', label: '6 meses', days: 180 },
  { kind: '1s', label: '1 temporada', seasons: 1 },
  { kind: '2s', label: '2 temporadas', seasons: 2 },
];

function tagLoan(player, fromClubId, kind, calendarDay) {
  const duration = LOAN_DURATIONS.find(d => d.kind === kind);
  const loan = kind === '6m'
    ? { kind, returnDay: Math.min(365, calendarDay + duration.days) }
    : { kind, seasonsRemaining: duration.seasons };
  return { ...player, onLoanFrom: fromClubId, loan };
}

function untag(player) {
  const { onLoanFrom, loan, ...clean } = player;
  return clean;
}

// Quão disposto um clube está a EMPRESTAR DE VOLTA um jogador que já é
// dele — mais disposto se for jovem ou se tiver gente melhor na mesma
// posição (sobra de elenco), menos disposto se for o melhor da posição
// (não quer abrir mão do titular).
function loanOutWillingness(clubRoster, player) {
  const samePos = clubRoster.filter(p => p.pos[0] === player.pos[0]);
  const betterCount = samePos.filter(p => p.ovr > player.ovr).length;
  let chance = 0.35;
  if (player.age != null && player.age < 23) chance += 0.25;
  if (betterCount >= 2) chance += 0.25;
  if (betterCount === 0) chance -= 0.3;
  return Math.max(0.05, Math.min(0.9, chance));
}

// Quão disposto um clube está a RECEBER um jogador emprestado — mais
// disposto se o jogador reforça uma posição carente ou é melhor que a
// média do que o clube já tem ali.
function loanInWillingness(clubRoster, player) {
  const samePos = clubRoster.filter(p => p.pos[0] === player.pos[0]);
  const avgOvr = samePos.length ? samePos.reduce((s, p) => s + p.ovr, 0) / samePos.length : 60;
  let chance = 0.3;
  if (player.ovr >= avgOvr) chance += 0.3;
  if (samePos.length < 2) chance += 0.2;
  if (player.ovr > avgOvr + 10) chance += 0.15;
  return Math.max(0.1, Math.min(0.85, chance));
}

// Usuário oferece um jogador DO PRÓPRIO elenco por empréstimo pra outro
// clube — o clube de destino decide aceitar com base em `loanInWillingness`
// (quer reforçar com esse jogador ou não).
export function loanPlayerOut(save, myClubId, targetClubId, playerName, kind, rand = Math.random) {
  const mine = save.clubs[myClubId];
  const target = save.clubs[targetClubId];
  if (!mine || !target) return { save, accepted: false, reason: 'clube inválido' };
  if (!canSell(mine.roster)) return { save, accepted: false, reason: `elenco no mínimo de ${MIN_SQUAD_SIZE} jogadores` };
  const player = mine.roster.find(p => p.name === playerName);
  if (!player) return { save, accepted: false, reason: 'jogador não encontrado' };

  const accepted = rand() < loanInWillingness(target.roster, player);
  if (!accepted) return { save, accepted: false, reason: 'clube recusou o empréstimo' };

  const tagged = tagLoan(player, myClubId, kind, save.calendarDay);
  let next = replaceRoster(save, myClubId, mine.roster.filter(p => p.name !== playerName));
  next = addPlayersToClub(next, targetClubId, [tagged]);
  next = {
    ...next,
    transferLog: appendTransferLog(next, {
      type: 'loan-out', playerName, fromClubId: myClubId, toClubId: targetClubId, amount: 0,
      durationLabel: LOAN_DURATIONS.find(d => d.kind === kind)?.label,
    }),
  };
  return { save: next, accepted: true };
}

// Usuário pede emprestado um jogador de OUTRO clube — o clube dono decide
// aceitar com base em `loanOutWillingness` (abre mão do jogador ou não).
export function requestLoanIn(save, myClubId, ownerClubId, playerName, kind, rand = Math.random) {
  const mine = save.clubs[myClubId];
  const owner = save.clubs[ownerClubId];
  if (!mine || !owner) return { save, accepted: false, reason: 'clube inválido' };
  if (!canSell(owner.roster)) return { save, accepted: false, reason: 'clube dono no mínimo de elenco' };
  const player = owner.roster.find(p => p.name === playerName);
  if (!player) return { save, accepted: false, reason: 'jogador não encontrado' };

  const accepted = rand() < loanOutWillingness(owner.roster, player);
  if (!accepted) return { save, accepted: false, reason: 'clube recusou emprestar' };

  const tagged = tagLoan(player, ownerClubId, kind, save.calendarDay);
  let next = replaceRoster(save, ownerClubId, owner.roster.filter(p => p.name !== playerName));
  next = addPlayersToClub(next, myClubId, [tagged]);
  next = {
    ...next,
    transferLog: appendTransferLog(next, {
      type: 'loan-in', playerName, fromClubId: ownerClubId, toClubId: myClubId, amount: 0,
      durationLabel: LOAN_DURATIONS.find(d => d.kind === kind)?.label,
    }),
  };
  return { save: next, accepted: true };
}

// Devolve pro dono original todo empréstimo de 6 meses cujo prazo já
// bateu — chamada DIA A DIA dentro de advanceDay (seasonEngine.js), igual
// a janela de transferências; silenciosa (não pausa o avanço, só acontece
// nos bastidores igual uma transferência de IA).
export function returnDueLoans(save, day) {
  let next = save;
  for (const clubId of CAREER_CLUB_IDS) {
    const roster = next.clubs[clubId].roster;
    const due = roster.filter(p => p.loan?.kind === '6m' && p.loan.returnDay <= day);
    if (due.length === 0) continue;
    next = replaceRoster(next, clubId, roster.filter(p => !due.includes(p)));
    for (const p of due) next = addPlayersToClub(next, p.onLoanFrom, [untag(p)]);
  }
  return next;
}

// Desconta 1 temporada de todo empréstimo de 1/2 temporadas e devolve quem
// chegou a 0 — chamada na virada de temporada (startNextSeason, antes de
// reconstruir as divisões; não importa a ordem exata).
export function returnSeasonLoans(save) {
  let next = save;
  for (const clubId of CAREER_CLUB_IDS) {
    const roster = next.clubs[clubId].roster;
    const staying = [];
    const returning = [];
    for (const p of roster) {
      if (p.loan && p.loan.kind !== '6m') {
        const seasonsRemaining = p.loan.seasonsRemaining - 1;
        if (seasonsRemaining <= 0) returning.push(p);
        else staying.push({ ...p, loan: { ...p.loan, seasonsRemaining } });
      } else {
        staying.push(p);
      }
    }
    if (returning.length === 0) continue;
    next = replaceRoster(next, clubId, staying);
    for (const p of returning) next = addPlayersToClub(next, p.onLoanFrom, [untag(p)]);
  }
  return next;
}
