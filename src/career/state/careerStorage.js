// Persistência do Modo Carreira — chave PRÓPRIA e separada de `brl_save`
// (a do modo clássico/Atual 2026/Copa), seguindo a convenção `brl_<feature>`
// já usada no projeto. Nunca lida por nenhum outro modo; nunca escreve em
// `brl_save`.
import { buildSeasonCalendar } from '../engine/calendar.js';
import { drawCopaBracket } from '../engine/copaEngine.js';
import { makePrng, hashSeed } from '../../App.jsx';
import { TEAMS } from '../../data/teams.js';

const KEY = 'brl_career_save';

// Idade real (`age`) foi preenchida em teams.js depois que varios saves já
// existiam — o roster de um save é um clone tirado na criação da carreira
// (rosterStore.js), então não herda automaticamente dados novos de
// teams.js. Preenche a idade que falta puxando de teams.js: primeiro tenta
// achar o jogador no mesmo clube (cobre o caso comum de ele nunca ter sido
// negociado); se não achar (foi vendido/emprestado), cai pra uma busca
// pelo nome em qualquer clube — mas só aplica se o nome for inequívoco
// (existem jogadores reais homônimos entre clubes nesse elenco; melhor
// deixar sem idade do que arriscar atribuir a de outra pessoa).
function backfillAges(save) {
  const needsBackfill = Object.values(save.clubs).some(c => c.roster.some(p => p.age == null));
  if (!needsBackfill) return save;
  const ageByName = new Map();
  const ambiguous = new Set();
  for (const team of TEAMS) {
    for (const p of team.players) {
      if (p.age == null) continue;
      if (ageByName.has(p.name) && ageByName.get(p.name) !== p.age) ambiguous.add(p.name);
      else ageByName.set(p.name, p.age);
    }
  }
  const clubs = {};
  for (const [id, club] of Object.entries(save.clubs)) {
    const masterTeam = TEAMS.find(t => t.id === id);
    const roster = club.roster.map(p => {
      if (p.age != null) return p;
      const sameClubMatch = masterTeam?.players.find(tp => tp.name === p.name && tp.age != null);
      if (sameClubMatch) return { ...p, age: sameClubMatch.age };
      if (!ambiguous.has(p.name) && ageByName.has(p.name)) return { ...p, age: ageByName.get(p.name) };
      return p;
    });
    clubs[id] = { ...club, roster };
  }
  return { ...save, clubs };
}

// Preenche campos que saves antigos (de antes do calendário dia a dia, da
// lista de transferências, ou da Copa do Brasil) não tinham — evita
// quebrar um save salvo numa versão anterior do Modo Carreira em vez de
// forçar o jogador a começar de novo.
function backfill(save) {
  if (!save) return save;
  let next = save;
  if (next.calendarDay == null || !next.seasonCalendar) {
    next = { ...next, calendarDay: next.calendarDay ?? 32, seasonCalendar: next.seasonCalendar ?? buildSeasonCalendar(38) };
  }
  // `transferList` (lista de transferências) é mais recente que o
  // calendário — saves que já tinham calendário mas não essa lista caíam
  // no `return save` acima antes desse campo existir.
  if (!next.transferList) next = { ...next, transferList: [] };
  // Copa do Brasil é mais recente ainda — save antigo sem ela ganha uma
  // Copa nova sorteada na hora, a partir do elenco atual (o calendário
  // dela usa `next.seasonCalendar`, que já existe nesse ponto).
  if (!next.copa) {
    const rand = makePrng(hashSeed(`${next.seed}|copa-backfill|${next.season}`));
    next = { ...next, copa: drawCopaBracket(next, rand, next.seasonCalendar), pendingUserCopaTie: next.pendingUserCopaTie ?? null };
  }
  next = backfillAges(next);
  return next;
}

export function loadCareerSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? backfill(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveCareerSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // localStorage indisponível/cheio — ignora, igual ao padrão já usado
    // pelo resto do app (brl_save, brl_difficulty etc.).
  }
}

export function clearCareerSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}

export function hasCareerSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}
