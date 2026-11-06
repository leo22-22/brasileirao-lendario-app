// Elenco mutável de cada clube dentro de UM save de carreira. `TEAMS`
// (teams.js) nunca é alterado — é só a fonte inicial, clonada uma vez na
// criação da carreira. Toda venda/compra/chegada de jovem da base daqui
// em diante só muda a cópia dentro do save (estado React, serializado em
// brl_career_save), nunca o dado compartilhado com os outros modos.
import { TEAMS } from '../../data/teams.js';
import { CAREER_CLUB_IDS, careerClubDivision } from '../../data/career-clubs.js';
import { startingBudgetFor } from './economy.js';
import { computePlayerValue } from './pricing.js';

export const MIN_SQUAD_SIZE = 16;

// Histórico de transferências da carreira inteira (todos os 40 clubes, não
// só o do usuário) — alimenta o painel "Top Transferências" da home e a
// futura aba de histórico do usuário (filtra por fromClubId/toClubId ===
// myClubId lá). Persiste de temporada em temporada (nunca é resetado).
export function appendTransferLog(save, entry) {
  const log = save.transferLog || [];
  return [...log, { day: save.calendarDay, season: save.season, ...entry }];
}

export function canSell(roster) {
  return roster.length > MIN_SQUAD_SIZE;
}

// Clona o elenco dos 40 clubes a partir de TEAMS — chamado uma única vez,
// na criação da carreira.
export function cloneAllRosters() {
  const clubs = {};
  for (const id of CAREER_CLUB_IDS) {
    const team = TEAMS.find(t => t.id === id);
    clubs[id] = {
      roster: team.players.map(p => ({ ...p })),
      budget: startingBudgetFor(id),
      division: careerClubDivision(id),
    };
  }
  return clubs;
}

// Todas as funções abaixo são puras: recebem o save e devolvem
// { save, ok, ... } — nunca mutam o objeto recebido. Em caso de falha
// (trava de 16, orçamento insuficiente, jogador não encontrado), devolvem
// `save` inalterado com `ok: false` e um `reason` legível pra UI.

export function buyPlayer(save, buyerId, sellerId, playerName) {
  const buyer = save.clubs[buyerId];
  const seller = save.clubs[sellerId];
  if (!buyer || !seller) return { save, ok: false, reason: 'clube inválido' };
  if (!canSell(seller.roster)) return { save, ok: false, reason: `elenco do vendedor no mínimo de ${MIN_SQUAD_SIZE} jogadores` };
  const player = seller.roster.find(p => p.name === playerName);
  if (!player) return { save, ok: false, reason: 'jogador não encontrado' };
  const price = computePlayerValue(player, sellerId);
  if (buyer.budget < price) return { save, ok: false, reason: 'orçamento insuficiente' };
  const newSave = {
    ...save,
    clubs: {
      ...save.clubs,
      [sellerId]: { ...seller, roster: seller.roster.filter(p => p.name !== playerName), budget: seller.budget + price },
      [buyerId]: { ...buyer, roster: [...buyer.roster, player], budget: buyer.budget - price },
    },
    transferLog: appendTransferLog(save, { type: 'ai', playerName, fromClubId: sellerId, toClubId: buyerId, amount: price }),
  };
  return { save: newSave, ok: true, price, player };
}

// Curva de aceitação de proposta do usuário por um jogador de OUTRO
// clube — estilo FIFA/Football Manager: abaixo de 60% do valor calculado,
// o clube NUNCA aceita (impede uma proposta "absurda" tipo R$1M por um
// jogador de R$100M); de 60% a 100%, a chance cresce suavemente (não é um
// degrau seco); a partir de 100%, aceita sempre.
function acceptanceChance(offeredAmount, askingValue) {
  const ratio = offeredAmount / askingValue;
  if (ratio >= 1) return 1;
  if (ratio < 0.6) return 0;
  const t = (ratio - 0.6) / 0.4; // 0..1
  return 0.05 + t * 0.85; // 5%-90% dentro da faixa
}

// Usuário propõe um valor por um jogador de outro clube — diferente de
// `buyPlayer` (compra instantânea ao preço calculado, usada só entre
// clubes de IA), aqui o clube vendedor DECIDE aceitar ou não com base em
// quão perto a proposta está do valor real do jogador. `rand` é a chance
// de aceitar sendo sorteada — não precisa ser determinística (é uma ação
// direta do usuário, não um passo do calendário).
export function proposeTransfer(save, buyerId, sellerId, playerName, offeredAmount, rand = Math.random) {
  const buyer = save.clubs[buyerId];
  const seller = save.clubs[sellerId];
  if (!buyer || !seller) return { save, accepted: false, reason: 'clube inválido' };
  if (!canSell(seller.roster)) return { save, accepted: false, reason: `elenco do vendedor no mínimo de ${MIN_SQUAD_SIZE} jogadores` };
  const player = seller.roster.find(p => p.name === playerName);
  if (!player) return { save, accepted: false, reason: 'jogador não encontrado' };
  if (offeredAmount <= 0 || buyer.budget < offeredAmount) return { save, accepted: false, reason: 'orçamento insuficiente' };

  const askingValue = computePlayerValue(player, sellerId);
  const accepted = rand() < acceptanceChance(offeredAmount, askingValue);
  if (!accepted) return { save, accepted: false, reason: 'proposta recusada', askingValue };

  const newSave = {
    ...save,
    clubs: {
      ...save.clubs,
      [sellerId]: { ...seller, roster: seller.roster.filter(p => p.name !== playerName), budget: seller.budget + offeredAmount },
      [buyerId]: { ...buyer, roster: [...buyer.roster, player], budget: buyer.budget - offeredAmount },
    },
    transferLog: appendTransferLog(save, {
      type: buyerId === save.myClubId ? 'user-buy' : 'ai',
      playerName, fromClubId: sellerId, toClubId: buyerId, amount: offeredAmount,
    }),
  };
  return { save: newSave, accepted: true, price: offeredAmount, player };
}

// Entrada da categoria de base (sem custo) e crédito de premiação —
// usados só pelo motor de fim de temporada (seasonEngine.js).
export function addPlayersToClub(save, clubId, players) {
  const club = save.clubs[clubId];
  if (!club) return save;
  return { ...save, clubs: { ...save.clubs, [clubId]: { ...club, roster: [...club.roster, ...players] } } };
}

export function creditBudget(save, clubId, amount) {
  const club = save.clubs[clubId];
  if (!club) return save;
  return { ...save, clubs: { ...save.clubs, [clubId]: { ...club, budget: club.budget + amount } } };
}

export function debitBudget(save, clubId, amount) {
  return creditBudget(save, clubId, -amount);
}

export function replaceRoster(save, clubId, roster) {
  const club = save.clubs[clubId];
  if (!club) return save;
  return { ...save, clubs: { ...save.clubs, [clubId]: { ...club, roster } } };
}
