// Calendário do Modo Carreira — dia-do-ano (1-365, ano fictício sem ano
// bissexto) usado só pra ritmo/janela, não pra data real. Duas janelas de
// transferência: janeiro inteiro (pré-temporada) e julho-agosto (metade
// da temporada) — fora delas o mercado fica fechado. As 38 rodadas da
// temporada são distribuídas 1x por semana nos meses que sobram
// (fevereiro-junho e setembro-dezembro), pulando o buraco de julho-agosto.
export const JAN_END = 31;
export const JUL_START = 182; // 31(jan)+28(fev)+31(mar)+30(abr)+31(mai)+30(jun)+1
export const AUG_END = 243; // JUL_START + 31(jul) + 31(ago) - 1

export function isTransferWindowOpen(day) {
  return day <= JAN_END || (day >= JUL_START && day <= AUG_END);
}

// Dia em que a janela ATUAL fecha (null se já estiver fechada).
export function currentWindowCloseDay(day) {
  if (day <= JAN_END) return JAN_END;
  if (day >= JUL_START && day <= AUG_END) return AUG_END;
  return null;
}

// Dia em que a PRÓXIMA janela abre — janeiro ou julho, o que vier
// primeiro a partir de hoje (se já estiver aberta, devolve o próprio dia).
// Depois de agosto, só reabre em janeiro da temporada seguinte (o
// calendário sempre reinicia em 1 a cada nova temporada).
export function nextWindowOpenDay(day) {
  if (isTransferWindowOpen(day)) return day;
  if (day < JUL_START) return JUL_START;
  return 1;
}

// Array de 38 posições: seasonCalendar[roundIdx] = dia-do-ano em que essa
// rodada acontece. Pula o buraco de julho-agosto se uma rodada cair nele.
export function buildSeasonCalendar(numRounds) {
  const days = [];
  let day = JAN_END + 1; // 1º de fevereiro
  for (let i = 0; i < numRounds; i++) {
    if (day >= JUL_START && day <= AUG_END) day = AUG_END + 1; // pula pro 1º de setembro
    days.push(day);
    day += 7;
  }
  return days;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function formatCalendarDay(day) {
  let remaining = Math.max(1, Math.min(365, day));
  for (let m = 0; m < 12; m++) {
    if (remaining <= MONTH_LENGTHS[m]) return `${remaining} de ${MONTH_NAMES[m]}`;
    remaining -= MONTH_LENGTHS[m];
  }
  return `${day}`;
}
