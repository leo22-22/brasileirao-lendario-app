// Persistência do Modo Carreira — chave PRÓPRIA e separada de `brl_save`
// (a do modo clássico/Atual 2026/Copa), seguindo a convenção `brl_<feature>`
// já usada no projeto. Nunca lida por nenhum outro modo; nunca escreve em
// `brl_save`.
import { buildSeasonCalendar } from '../engine/calendar.js';

const KEY = 'brl_career_save';

// Preenche campos que saves antigos (de antes do calendário dia a dia)
// não tinham — evita quebrar um save salvo numa versão anterior do Modo
// Carreira em vez de forçar o jogador a começar de novo.
function backfill(save) {
  if (!save) return save;
  if (save.calendarDay != null && save.seasonCalendar) return save;
  return { ...save, calendarDay: save.calendarDay ?? 32, seasonCalendar: save.seasonCalendar ?? buildSeasonCalendar(38) };
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
