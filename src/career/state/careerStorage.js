// Persistência do Modo Carreira — chave PRÓPRIA e separada de `brl_save`
// (a do modo clássico/Atual 2026/Copa), seguindo a convenção `brl_<feature>`
// já usada no projeto. Nunca lida por nenhum outro modo; nunca escreve em
// `brl_save`.
import { buildSeasonCalendar } from '../engine/calendar.js';
import { drawCopaBracket } from '../engine/copaEngine.js';
import { makePrng, hashSeed } from '../../App.jsx';

const KEY = 'brl_career_save';

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
