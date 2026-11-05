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
  };
  return { save: newSave, ok: true, price, player };
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
