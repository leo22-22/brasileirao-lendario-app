// Mercado do Modo Carreira — duas coisas novas do redesign de 2026-11-13:
//
// 1. Observados (`save.shortlist`): lista de jogadores de outros clubes que
//    o usuário quer acompanhar. Guarda o OVR/valor do momento em que foi
//    observado, pra tela mostrar a variação.
// 2. Propostas agendadas (`save.queuedProposals`): com a janela FECHADA, a
//    proposta (compra ou pedido de empréstimo) fica salva e é enviada no
//    primeiro dia em que a janela abrir — a decisão do clube usa as mesmas
//    funções de sempre (proposeTransfer / requestLoanIn), só que na data
//    da abertura, com o elenco e o orçamento daquele dia.
//
// Os dois campos têm padrão [] (ver ensureMarketDefaults, chamado pela
// migração em careerStorage.js).
import { proposeTransfer } from './rosterStore.js';
import { requestLoanIn, LOAN_DURATIONS } from './loans.js';
import { computePlayerValue } from './pricing.js';
import { isTransferWindowOpen } from './calendar.js';
import { TEAMS } from '../../data/teams.js';

const clubName = (id) => TEAMS.find(t => t.id === id)?.club || '';
const money = (n) => `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;

export function ensureMarketDefaults(save) {
  if (!save) return save;
  if (Array.isArray(save.shortlist) && Array.isArray(save.queuedProposals)) return save;
  return {
    ...save,
    shortlist: Array.isArray(save.shortlist) ? save.shortlist : [],
    queuedProposals: Array.isArray(save.queuedProposals) ? save.queuedProposals : [],
  };
}

// Acha um jogador pelo nome em qualquer clube (ele pode ter trocado de
// clube desde que foi observado).
export function findPlayerAnywhere(save, playerName) {
  for (const [clubId, club] of Object.entries(save.clubs)) {
    const p = club.roster.find(x => x.name === playerName && !x.inAcademy);
    if (p) return { clubId, player: p };
  }
  return null;
}

export function isShortlisted(save, playerName) {
  return (save.shortlist || []).some(s => s.playerName === playerName);
}

export function toggleShortlist(save, clubId, playerName) {
  const list = save.shortlist || [];
  if (list.some(s => s.playerName === playerName)) {
    return { ...save, shortlist: list.filter(s => s.playerName !== playerName) };
  }
  const p = save.clubs[clubId]?.roster.find(x => x.name === playerName);
  if (!p) return save;
  return {
    ...save,
    shortlist: [...list, { playerName, clubId, ovr: p.ovr, value: computePlayerValue(p, clubId), season: save.season, day: save.calendarDay }],
  };
}

// kind: 'buy' (amount) | 'loan' (loanKind)
export function queueProposal(save, proposal) {
  const list = (save.queuedProposals || []).filter(q => !(q.playerName === proposal.playerName && q.kind === proposal.kind));
  return { ...save, queuedProposals: [...list, { ...proposal, season: save.season, day: save.calendarDay }] };
}

export function cancelQueuedProposal(save, playerName, kind) {
  return { ...save, queuedProposals: (save.queuedProposals || []).filter(q => !(q.playerName === playerName && q.kind === kind)) };
}

// Chamado depois de cada mudança de save (CareerApp): se a janela abriu e
// há propostas agendadas, envia todas. Idempotente: com fila vazia ou
// janela fechada devolve o mesmo save. Resultados vão pra caixa de entrada.
export function processQueuedProposals(save, rand = Math.random) {
  const queue = save?.queuedProposals || [];
  if (!queue.length || !isTransferWindowOpen(save.calendarDay)) return save;
  let next = { ...save, queuedProposals: [] };
  const inbox = [];
  for (const q of queue) {
    const found = findPlayerAnywhere(next, q.playerName);
    const id = `queued-${q.season}-${q.day}-${q.kind}-${q.playerName}-${next.calendarDay}`;
    if (!found || found.clubId === next.myClubId) {
      inbox.push({ id, cat: 'mercado', title: `Proposta agendada por ${q.playerName} cancelada`, text: 'O jogador não está mais disponível.' });
      continue;
    }
    if (q.kind === 'loan') {
      const res = requestLoanIn(next, next.myClubId, found.clubId, q.playerName, q.loanKind, rand);
      if (res.accepted) next = res.save;
      const label = LOAN_DURATIONS.find(d => d.kind === q.loanKind)?.label || '';
      inbox.push({ id, cat: 'mercado', action: 'market', title: res.accepted ? `${q.playerName} chega emprestado` : `${clubName(found.clubId)} recusou emprestar ${q.playerName}`, text: res.accepted ? `Pedido agendado aceito · ${label}` : `Pedido agendado · ${res.reason || 'recusado'}` });
    } else {
      const res = proposeTransfer(next, next.myClubId, found.clubId, q.playerName, q.amount, rand);
      if (res.accepted) next = res.save;
      inbox.push({ id, cat: 'mercado', action: 'market', title: res.accepted ? `${q.playerName} contratado` : `Proposta por ${q.playerName} recusada`, text: res.accepted ? `Proposta agendada aceita · ${money(q.amount)}` : `Proposta agendada de ${money(q.amount)} · ${res.reason || 'recusada'}` });
    }
  }
  const items = inbox.map(m => ({ ...m, day: next.calendarDay, season: next.season, read: false }));
  return { ...next, inbox: [...items, ...(next.inbox || [])] };
}
