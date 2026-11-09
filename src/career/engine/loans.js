// Sistema de empréstimo do Modo Carreira — pedido explícito do usuário
// (2026-11-06): emprestar um jogador meu (geralmente jovem ou que não
// joga) pra outro clube, ou pedir emprestado um jogador de outro clube.
// Sem dinheiro envolvido (decisão de simplicidade: empréstimo real às
// vezes tem taxa, mas o pedido do usuário foi só "emprestar"/"pedir
// emprestado", sem mencionar valor).
//
// EMPRESTAR O MEU (saída) funciona igual a lista de transferências, não
// como uma negociação direta — pedido explícito do usuário (2026-11-09:
// "é colocar na lista de empréstimo que pode chegar ou não proposta, não
// é eu emprestar, é igual o caso da transferência"): o usuário só coloca
// o jogador na `loanList` (toggleLoanList); uma proposta de empréstimo de
// um clube de IA pode ou não aparecer depois, dia a dia (ver
// generateUserLoanOffer, chamada por advanceDay em seasonEngine.js, mesmo
// pipeline de `pendingOffers` que as propostas de compra já usam — só com
// `type: 'loan'`). PEDIR EMPRESTADO (entrada, `requestLoanIn`) continua
// sendo uma ação direta do usuário (escolhe o jogador, o clube dono decide
// na hora) — isso não mudou, é o equivalente de "Fazer proposta" na
// compra, que o usuário não pediu pra mudar.
//
// O jogador MUDA DE ELENCO de verdade enquanto dura o empréstimo (sai do
// roster de quem empresta, entra no de quem recebe, com `onLoanFrom`
// marcando o dono original) — não um registro paralelo. Isso faz ele jogar
// de verdade pelo clube que recebeu (teamForSim já usa `clubs[id].roster`
// direto) sem precisar de nenhum código extra em lugar nenhum do motor de
// simulação; só a volta precisa de lógica própria (ver returnDueLoans/
// returnSeasonLoans, chamadas por seasonEngine.js).
import { CAREER_CLUB_IDS } from '../../data/career-clubs.js';
import { addPlayersToClub, replaceRoster, appendTransferLog, canSell } from './rosterStore.js';

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

// Liga/desliga um jogador na lista de empréstimo — não empresta nada
// sozinho, só sinaliza disponibilidade (mesmo padrão de
// `toggleTransferList` em seasonEngine.js, propositalmente: é o mesmo
// mecanismo, só que pro empréstimo).
export function toggleLoanList(save, playerName) {
  const list = save.loanList || [];
  const next = list.includes(playerName) ? list.filter(n => n !== playerName) : [...list, playerName];
  return { ...save, loanList: next };
}

// Chance de surgir uma proposta de empréstimo por um jogador da lista de
// empréstimo (ver toggleLoanList) num dia dentro de uma janela aberta —
// só pra quem está listado (diferente da compra, que também sonda fora da
// lista): empréstimo sem lista nunca gera proposta, por ser uma saída
// deliberada do usuário, não uma sondagem geral de mercado.
export const LOAN_OFFER_CHANCE = 0.06;

// Sonda se algum clube de IA quer pegar emprestado um jogador da lista de
// empréstimo do usuário hoje. Sorteia 1 jogador listado + 1 clube entre os
// outros 39 e rola a vontade dele de receber (`loanInWillingness`) — só
// isso, sem buscar entre todos os 39 de uma vez (ficaria quase sempre
// bem-sucedido com `loanInWillingness` alto o bastante, matando a raridade
// que faz sentido pra uma proposta). Se não der, simplesmente não sai
// proposta nesse dia — o `LOAN_OFFER_CHANCE` já é o gate principal.
export function generateUserLoanOffer(save, rand, recentNames) {
  const myRoster = save.clubs[save.myClubId].roster;
  const list = (save.loanList || []).filter(name => myRoster.some(p => p.name === name));
  if (!list.length) return null;
  const fresh = list.filter(n => !recentNames?.includes(n));
  const pool = fresh.length > 0 ? fresh : list;
  const playerName = pool[Math.floor(rand() * pool.length)];
  const player = myRoster.find(p => p.name === playerName);
  const otherClubIds = CAREER_CLUB_IDS.filter(id => id !== save.myClubId);
  const clubId = otherClubIds[Math.floor(rand() * otherClubIds.length)];
  const willing = rand() < loanInWillingness(save.clubs[clubId].roster, player);
  if (!willing) return null;
  const kind = LOAN_DURATIONS[Math.floor(rand() * LOAN_DURATIONS.length)].kind;
  return { type: 'loan', playerName, fromClubId: clubId, toClubId: save.myClubId, kind };
}

// Usuário aceita uma proposta de empréstimo recebida (save.pendingOffers[i]
// com `type: 'loan'`) — chamada por `respondToOffer` (seasonEngine.js),
// que já tirou a oferta de `pendingOffers` antes de chegar aqui (`remaining`).
// Sai da lista de empréstimo depois de emprestado (não tem como reemprestar
// quem já saiu do elenco).
export function acceptLoanOffer(save, offer, remaining) {
  const mine = save.clubs[save.myClubId];
  const target = save.clubs[offer.fromClubId];
  if (!mine || !target || !canSell(mine.roster)) return { ...save, pendingOffers: remaining };
  const player = mine.roster.find(p => p.name === offer.playerName);
  if (!player) return { ...save, pendingOffers: remaining };

  const tagged = tagLoan(player, save.myClubId, offer.kind, save.calendarDay);
  let next = replaceRoster(save, save.myClubId, mine.roster.filter(p => p.name !== offer.playerName));
  next = addPlayersToClub(next, offer.fromClubId, [tagged]);
  return {
    ...next,
    pendingOffers: remaining,
    loanList: (next.loanList || []).filter(n => n !== offer.playerName),
    transferLog: appendTransferLog(next, {
      type: 'loan-out', playerName: offer.playerName, fromClubId: save.myClubId, toClubId: offer.fromClubId, amount: 0,
      durationLabel: LOAN_DURATIONS.find(d => d.kind === offer.kind)?.label,
    }),
  };
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
