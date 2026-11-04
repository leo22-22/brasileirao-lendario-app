// Decisões de transferência dos clubes de IA no Modo Carreira — de
// propósito uma heurística enxuta, não uma "IA" nova de verdade: nada de
// negociação em várias rodadas, nada de memória entre janelas, no máximo
// 1 proposta por clube por janela. O objetivo é só manter os outros 39
// clubes vivos (sem elenco apodrecer, sem ficar rico parado) sem custar
// complexidade desproporcional ao resto do recurso.
import { computePlayerValue } from './pricing.js';
import { POS_ORDER } from '../../lib/format.js';

// Overall médio "esperado" por tier — usado só pra decidir se uma posição
// está fraca pros padrões do clube (não é um alvo de contratação real).
const TIER_EXPECTED_OVR = { elite: 82, grande: 76, medio: 70, pequeno: 64 };

function bestOvrByPosition(roster) {
  const best = {};
  for (const p of roster) {
    const pos = p.pos[0];
    if (!best[pos] || p.ovr > best[pos]) best[pos] = p.ovr;
  }
  return best;
}

// Jogadores "gordura de elenco": fora do top-16 por overall do próprio
// clube E abaixo de (médiaTop16 - 5). Nunca lista o suficiente pra deixar
// o elenco com menos de 16 (a trava real de venda já impede isso na hora
// de vender; isto aqui é só a sugestão de quem entra na lista).
export function decideAiListings(roster) {
  if (roster.length <= 16) return [];
  const sorted = [...roster].sort((a, b) => b.ovr - a.ovr);
  const top16 = sorted.slice(0, 16);
  const avgTop16 = top16.reduce((s, p) => s + p.ovr, 0) / top16.length;
  const rest = sorted.slice(16);
  return rest.filter(p => p.ovr < avgTop16 - 5).map(p => p.name);
}

// Pra cada clube, decide a posição mais fraca pros padrões do próprio
// tier e, se achar um reforço mais barato que o orçamento disponível
// entre os jogadores listados de outros clubes, faz 1 proposta.
// `clubs` = { [clubId]: { roster, budget, tier } }, `listingsByClub` =
// { [clubId]: string[] } (nomes já sinalizados por decideAiListings).
export function decideAiOffers(clubs, listingsByClub, rand = Math.random) {
  const offers = []; // { fromClubId, toClubId, playerName, amount }
  // Ordem dos clubes embaralhada A CADA CHAMADA (seed do dia) — sem isso,
  // o mesmo clube sempre "ganhava" a vaga de comprador de uma posição
  // fraca compartilhada por vários, e como o elenco do usuário quase
  // nunca muda de um dia pro outro, a proposta acabava sendo sempre pelo
  // mesmo jogador (bug real reportado: "só vinha proposta pelo mesmo
  // jogador").
  const clubIds = [...Object.keys(clubs)].sort(() => rand() - 0.5);
  for (const buyerId of clubIds) {
    const buyer = clubs[buyerId];
    const expected = TIER_EXPECTED_OVR[buyer.tier] ?? TIER_EXPECTED_OVR.pequeno;
    const bestByPos = bestOvrByPosition(buyer.roster);
    // Sorteia entre TODAS as posições fracas do comprador, não só a
    // primeira na ordem fixa de POS_ORDER — um time pode ter várias
    // carências ao mesmo tempo, e sempre atacar a mesma primeiro (dia
    // após dia, já que o elenco dele não muda) era outra causa da mesma
    // proposta se repetir.
    const weakPositions = POS_ORDER.filter(pos => (bestByPos[pos] ?? 0) < expected - 3);
    if (weakPositions.length === 0) continue;
    const weakPos = weakPositions[Math.floor(rand() * weakPositions.length)];

    const candidates = []; // { sellerId, player, price }
    for (const sellerId of clubIds) {
      if (sellerId === buyerId) continue;
      const listedNames = listingsByClub[sellerId] || [];
      if (listedNames.length === 0) continue;
      const seller = clubs[sellerId];
      for (const player of seller.roster) {
        if (player.pos[0] !== weakPos) continue;
        if (!listedNames.includes(player.name)) continue;
        const price = computePlayerValue(player, sellerId);
        if (price > buyer.budget) continue;
        candidates.push({ sellerId, player, price });
      }
    }
    if (candidates.length === 0) continue;
    // 70% das vezes pega o mais barato (decisão "econômica" razoável),
    // 30% sorteia entre os candidatos qualificados — garante variedade
    // mesmo quando o mesmo comprador aparece de novo em dias seguidos.
    const picked = rand() < 0.7
      ? candidates.reduce((min, c) => (c.price < min.price ? c : min))
      : candidates[Math.floor(rand() * candidates.length)];
    const amount = Math.round(picked.price * (1 + rand() * 0.1)); // 100%-110%
    offers.push({
      fromClubId: buyerId,
      toClubId: picked.sellerId,
      playerName: picked.player.name,
      amount,
    });
  }
  return offers;
}

// Decide se um clube de IA aceita uma oferta pelo seu próprio jogador —
// regra fixa, sem negociação: aceita se a oferta cobre pelo menos 90% do
// valor calculado. Usada tanto pra ofertas entre clubes de IA quanto pras
// propostas que o usuário recebe (aceitar/rejeitar na aba Propostas).
export function decideAiAcceptance(offerAmount, askingValue) {
  return offerAmount >= askingValue * 0.9;
}
