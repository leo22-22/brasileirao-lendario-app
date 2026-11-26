// Gestão do PRÓPRIO clube no Modo Carreira (Fase 5 do roadmap, 2026-11):
// salários e contratos, receita fixa mensal (TV/patrocínio), bilheteria
// dos jogos em casa, lesões e demissão pela diretoria.
//
// Escopo de propósito: só o clube do usuário. Os outros 39 seguem com o
// orçamento simplificado de sempre (prêmio + vendas) — ligar folha e
// bilheteria pra IA mexeria em todo o mercado de transferências de uma vez.
//
// Módulo puro, sem importar App.jsx (evita o ciclo de import — ver
// project_modo_carreira_status na memória).
import { careerClubTier, CAREER_CLUB_IDS } from '../../data/career-clubs.js';
import { TEAMS } from '../../data/teams.js';
import { computePlayerValue } from './pricing.js';
import { computeMatchdayRevenue } from './economy.js';
import { creditBudget, replaceRoster, appendTransferLog, MIN_SQUAD_SIZE } from './rosterStore.js';
import { computeBoard } from './careerMeta.js';

// ── Salários ──────────────────────────────────────────────────────────
// Salário mensal = 0,9% do valor de mercado na assinatura (≈11% ao ano).
// Calibrado simulando temporadas inteiras: com 0,6% o Flamengo lucrava
// ~R$200M por ano só com bilheteria; com 0,9% um elite paga ~R$11M/mês e
// fecha o ano com sobra pequena, um pequeno da Série B ~R$0,7M/mês, e quem
// cai de divisão (cota de TV menor) passa a apertar de verdade.
export const WAGE_RATE = 0.009;
export const MIN_WAGE = 15_000;
export function wageFor(player, clubId) {
  const v = computePlayerValue(player, clubId) || 0;
  return Math.max(MIN_WAGE, Math.round((v * WAGE_RATE) / 1000) * 1000);
}

// Receita fixa por mês (cotas de TV + patrocínio), pela divisão e porte.
export const MONTHLY_INCOME = {
  A: { elite: 3_500_000, grande: 2_800_000, medio: 1_600_000, pequeno: 1_200_000 },
  B: { elite: 900_000, grande: 900_000, medio: 600_000, pequeno: 400_000 },
};
export function monthlyIncomeFor(save) {
  const div = save.clubs[save.myClubId].division === 'A' ? 'A' : 'B';
  return MONTHLY_INCOME[div][careerClubTier(save.myClubId)] ?? MONTHLY_INCOME[div].pequeno;
}

// Dia 1 de cada mês no calendário de 365 dias da carreira.
export const MONTH_START_DAYS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

// ── Contratos ─────────────────────────────────────────────────────────
// save.contracts = { [nome]: { until: temporada final (inclusive), wage } }
// — só do clube do usuário. Elenco inicial: 1 a 4 temporadas (sorteio fixo
// pelo nome). Quem chega depois (compra, base promovida, empréstimo): 3.
const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h >>> 0; };
export const NEW_CONTRACT_SEASONS = 3;

function professionals(save) {
  return (save.clubs[save.myClubId]?.roster || []).filter(p => !p.inAcademy);
}

export function ensureContracts(save) {
  if (!save?.clubs?.[save.myClubId]) return save;
  const seeding = !save.contracts; // carreira sem contratos ainda (save antigo ou novo)
  const current = save.contracts || {};
  const next = {};
  let changed = seeding;
  for (const p of professionals(save)) {
    if (current[p.name]) { next[p.name] = current[p.name]; continue; }
    const extra = seeding ? hashStr(`${save.seed}|${p.name}`) % 4 : NEW_CONTRACT_SEASONS - 1;
    // Emprestado ao clube: o contrato acaba quando o empréstimo acaba.
    const until = p.onLoanFrom ? save.season + 1 : save.season + extra;
    next[p.name] = { until, wage: wageFor(p, save.myClubId) };
    changed = true;
  }
  if (Object.keys(current).some(n => !next[n])) changed = true; // saiu do elenco
  return changed ? { ...save, contracts: next } : save;
}

export function payrollOf(save) {
  return Object.values(save.contracts || {}).reduce((s, c) => s + (c.wage || 0), 0);
}

// Renovação: +2 temporadas a partir do fim atual (ou desta), salário +15%,
// luvas = 3 salários novos, pagas na hora.
export const RENEW_SEASONS = 2;
export function renewalTerms(save, name) {
  const c = save.contracts?.[name];
  if (!c) return null;
  const wage = Math.round((c.wage * 1.15) / 1000) * 1000;
  return { wage, bonus: wage * 3, until: Math.max(c.until, save.season) + RENEW_SEASONS };
}
export function renewContract(save, name) {
  const terms = renewalTerms(save, name);
  if (!terms) return { save, ok: false, reason: 'Jogador sem contrato no clube.' };
  const club = save.clubs[save.myClubId];
  if (club.roster.find(p => p.name === name)?.onLoanFrom) return { save, ok: false, reason: 'Jogador emprestado não renova por aqui.' };
  if (club.budget < terms.bonus) return { save, ok: false, reason: 'Orçamento não cobre as luvas.' };
  let next = creditBudget(save, save.myClubId, -terms.bonus);
  next = {
    ...next,
    contracts: { ...next.contracts, [name]: { until: terms.until, wage: terms.wage } },
    financeLog: pushFinance(next, { kind: 'luvas', amount: -terms.bonus, label: `Luvas · ${name}` }),
  };
  return { save: next, ok: true, terms };
}

// Fim de temporada: quem tem contrato terminando nesta temporada sai de
// graça. Se isso deixar o elenco abaixo do mínimo (16), os melhores entre
// os que sairiam renovam 1 temporada (+20%) automaticamente.
export function processContractExpiry(save) {
  const contracts = save.contracts || {};
  const roster = save.clubs[save.myClubId].roster;
  const expiring = roster.filter(p => !p.inAcademy && !p.onLoanFrom && contracts[p.name] && contracts[p.name].until <= save.season);
  if (!expiring.length) return { save, departures: [], autoRenewed: [] };
  const professionalsLeft = roster.filter(p => !p.inAcademy).length - expiring.length;
  const mustKeep = Math.max(0, MIN_SQUAD_SIZE - professionalsLeft);
  const sorted = [...expiring].sort((a, b) => b.ovr - a.ovr);
  const keep = new Set(sorted.slice(0, mustKeep).map(p => p.name));
  const nextContracts = { ...contracts };
  const departures = [];
  const autoRenewed = [];
  for (const p of expiring) {
    if (keep.has(p.name)) {
      nextContracts[p.name] = { until: save.season + 1, wage: Math.round((contracts[p.name].wage * 1.2) / 1000) * 1000 };
      autoRenewed.push(p.name);
    } else {
      delete nextContracts[p.name];
      departures.push(p.name);
    }
  }
  const gone = new Set(departures);
  let next = replaceRoster(save, save.myClubId, roster.filter(p => !gone.has(p.name)));
  for (const name of departures) {
    next = { ...next, transferLog: appendTransferLog(next, { type: 'contract-end', playerName: name, fromClubId: save.myClubId, toClubId: null, amount: 0 }) };
  }
  next = {
    ...next,
    contracts: nextContracts,
    myStarters: (next.myStarters || []).filter(n => !gone.has(n)),
    myBench: (next.myBench || []).filter(n => !gone.has(n)),
    myCaptain: gone.has(next.myCaptain) ? null : next.myCaptain,
    myPenaltyTaker: gone.has(next.myPenaltyTaker) ? null : next.myPenaltyTaker,
    transferList: (next.transferList || []).filter(n => !gone.has(n)),
    loanList: (next.loanList || []).filter(n => !gone.has(n)),
  };
  return { save: next, departures, autoRenewed };
}

// ── Caixa: mensal e bilheteria ────────────────────────────────────────
function pushFinance(save, entry) {
  return [...(save.financeLog || []), { season: save.season, day: save.calendarDay, ...entry }].slice(-200);
}

// Dia 1 de cada mês: paga a folha e recebe a cota fixa.
export function applyMonthlyFinances(save, day) {
  if (!MONTH_START_DAYS.includes(day)) return save;
  const withContracts = ensureContracts(save);
  const wages = payrollOf(withContracts);
  const income = monthlyIncomeFor(withContracts);
  let next = creditBudget(withContracts, save.myClubId, income - wages);
  next = { ...next, financeLog: [...pushFinance({ ...next, calendarDay: day }, { kind: 'cotas', amount: income, label: 'Cotas de TV e patrocínio' }), { season: next.season, day, kind: 'folha', amount: -wages, label: 'Folha salarial' }].slice(-200) };
  return next;
}

// Bilheteria do jogo em casa do usuário (Brasileirão).
export function applyGateRevenue(save, match, day) {
  if (!match || match.homeId !== save.myClubId) return save;
  const gate = computeMatchdayRevenue(save.myClubId, true);
  if (!gate) return save;
  const next = creditBudget(save, save.myClubId, gate);
  const opp = TEAMS.find(t => t.id === match.awayId)?.club || '';
  return { ...next, financeLog: pushFinance({ ...next, calendarDay: day ?? save.calendarDay }, { kind: 'bilheteria', amount: gate, label: `Bilheteria · x ${opp}` }) };
}

// ── Lesões ────────────────────────────────────────────────────────────
// A simulação (simAiMatch) já sorteia lesão com `rounds` — a carreira só
// passa a guardar isso pro próprio clube, igual às suspensões: o jogador
// fica fora por N rodadas do Brasileirão.
export function applyUserInjuries(save, events) {
  const injuries = {};
  Object.entries(save.injuries || {}).forEach(([name, left]) => { if (left - 1 > 0) injuries[name] = left - 1; });
  for (const ev of events || []) {
    if (ev.type !== 'injury' || ev.teamId !== save.myClubId) continue;
    const rounds = Math.max(1, Number(ev.rounds) || 1);
    injuries[ev.player] = Math.max(injuries[ev.player] || 0, rounds);
  }
  return { ...save, injuries };
}

// Fora do próximo jogo: suspenso ou lesionado.
export function unavailableReason(save, name) {
  if ((save.injuries?.[name] || 0) > 0) return { kind: 'injury', label: 'Lesionado', rounds: save.injuries[name] };
  if ((save.suspensions?.[name] || 0) > 0) return { kind: 'suspended', label: 'Suspenso', rounds: save.suspensions[name] };
  return null;
}
export function isUnavailable(save, name) {
  return !!unavailableReason(save, name);
}

// ── Diretoria: demissão ───────────────────────────────────────────────
// No meio da temporada: depois da 12ª rodada, confiança em 10% ou menos.
// No fim: confiança final abaixo de 30% (meta longe, ver computeBoard).
export const MIDSEASON_FIRE_FROM_ROUND = 12;
export const MIDSEASON_FIRE_CONFIDENCE = 10;
export const SEASON_END_FIRE_CONFIDENCE = 30;

// Carência pra quem assumiu o clube no meio da temporada (após demissão):
// a campanha ruim veio de antes, então não cai no fim desta temporada nem
// antes de 8 rodadas no cargo.
export const NEW_MANAGER_GRACE_ROUNDS = 8;
export function boardVerdict(save, { final = false } = {}) {
  const board = computeBoard(save);
  const division = save.clubs[save.myClubId].division === 'A' ? save.divisionA : save.divisionB;
  const since = save.managerSince;
  const joinedThisSeason = since && since.season === save.season && since.round > 0;
  if (final) return { fired: !joinedThisSeason && board.confidence < SEASON_END_FIRE_CONFIDENCE, board };
  const inGrace = since && since.season === save.season && division.round - since.round < NEW_MANAGER_GRACE_ROUNDS;
  return { fired: !inGrace && division.round >= MIDSEASON_FIRE_FROM_ROUND && board.confidence <= MIDSEASON_FIRE_CONFIDENCE, board };
}

const TIER_RANK = { elite: 0, grande: 1, medio: 2, pequeno: 3 };

// Convites depois de demitido: até 3 clubes do mesmo porte ou menores
// (sorteio fixo pela carreira e temporada).
export function jobOffersAfterFiring(save) {
  const myRank = TIER_RANK[careerClubTier(save.myClubId)] ?? 3;
  const pool = CAREER_CLUB_IDS.filter(id => id !== save.myClubId && (TIER_RANK[careerClubTier(id)] ?? 3) >= myRank);
  const fallback = CAREER_CLUB_IDS.filter(id => id !== save.myClubId);
  const list = (pool.length >= 3 ? pool : fallback)
    .map(id => ({ id, k: hashStr(`${save.seed}|job|${save.season}|${id}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 3)
    .map(x => x.id);
  return list;
}

export function fireManager(save, { reason, final }) {
  const board = computeBoard(save);
  return {
    ...save,
    fired: {
      season: save.season, day: save.calendarDay, final: !!final, reason,
      confidence: board.confidence, pos: board.pos, goal: board.text,
      fromClubId: save.myClubId, offers: jobOffersAfterFiring(save),
    },
  };
}

// Aceita o convite: assume o outro clube no mesmo ponto do calendário.
// Tudo que era "do treinador no clube antigo" zera (escalação, listas,
// propostas, cartões, contratos — que passam a ser os do clube novo).
export function acceptJobOffer(save, clubId) {
  if (!save.fired || !save.fired.offers.includes(clubId)) return save;
  const fromClubId = save.fired.fromClubId;
  const newDivision = save.clubs[clubId].division === 'A' ? save.divisionA : save.divisionB;
  const next = {
    ...save,
    myClubId: clubId,
    managerSince: { season: save.season, round: save.fired.final ? 0 : newDivision.round },
    fired: null,
    managerHistory: [...(save.managerHistory || []), { clubId: fromClubId, untilSeason: save.season, firedAtDay: save.fired.day }],
    myStarters: [], myBench: [], myCaptain: null, myPenaltyTaker: null, myFormationLabel: null, myFormationKey: null,
    suspensions: {}, injuries: {}, cardTally: {},
    transferList: [], loanList: [], shortlist: [], queuedProposals: [], pendingOffers: [],
    contracts: undefined,
    board: null, budgetHistory: [],
  };
  return ensureContracts(next);
}
