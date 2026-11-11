// Calendário do Modo Carreira — dia-do-ano (1-365, ano fictício sem ano
// bissexto) usado só pra ritmo/janela, não pra data real (o motor não
// modela dia-da-semana, só dia-do-ano). Datas reais da Série A 2026
// (pedido explícito do usuário 2026-11-11, calendário real colado):
// rodada 1 em 28/jan, rodada 18 em 31/mai, PARADA TOTAL de 1º/jun a
// 21/jul pra Copa do Mundo 2026 (nem Brasileirão nem Copa do Brasil joga
// nesse buraco), rodada 19 retoma em 22/jul, rodada 38 (última) em 2/dez.
// A Série B usa o MESMO calendário/índice de rodada que a Série A — o
// motor sempre fez as duas divisões andarem juntas (ver playRound em
// seasonEngine.js) e, na prática, as duas realmente pausam juntas.
//
// Duas janelas de transferência: janeiro inteiro (pré-temporada, ainda
// aberta quando a rodada 1 já rolou em 28/jan) e a PRÓPRIA pausa da Copa
// do Mundo (1º/jun-21/jul) — período real em que os clubes mexeriam no
// elenco com o campeonato parado. Fora delas o mercado fica fechado.
export const JAN_END = 31;
export const WINDOW2_START = 152; // 1º de junho — início da pausa da Copa do Mundo 2026
export const WINDOW2_END = 202; // 21 de julho — véspera da retomada (rodada 19 em 22/jul)

export function isTransferWindowOpen(day) {
  return day <= JAN_END || (day >= WINDOW2_START && day <= WINDOW2_END);
}

// Dia em que a janela ATUAL fecha (null se já estiver fechada).
export function currentWindowCloseDay(day) {
  if (day <= JAN_END) return JAN_END;
  if (day >= WINDOW2_START && day <= WINDOW2_END) return WINDOW2_END;
  return null;
}

// Dia em que a PRÓXIMA janela abre — janeiro ou a pausa da Copa do Mundo,
// o que vier primeiro a partir de hoje (se já estiver aberta, devolve o
// próprio dia). Depois da 2ª janela, só reabre em janeiro da temporada
// seguinte (o calendário sempre reinicia em 1 a cada nova temporada).
export function nextWindowOpenDay(day) {
  if (isTransferWindowOpen(day)) return day;
  if (day < WINDOW2_START) return WINDOW2_START;
  return 1;
}

const FIRST_HALF_ROUNDS = 18;
const FIRST_HALF_START = 28; // 28 de janeiro — rodada 1
const FIRST_HALF_END = 151; // 31 de maio — rodada 18 (fim da 1ª janela, antes da pausa)
const SECOND_HALF_START = 203; // 22 de julho — rodada 19 (retomada pós-Copa do Mundo)
const SECOND_HALF_END = 336; // 2 de dezembro — rodada 38 (última)

// Espalha `count` rodadas entre startDay e endDay (inclusive nas pontas),
// o mais uniforme possível (~1 rodada por semana) — sem round caindo no
// mesmo dia de outro (nunca deveria acontecer com a folga real que cada
// janela tem, mas a garantia fica aqui mesmo assim).
function spreadDays(startDay, endDay, count) {
  if (count <= 1) return [startDay];
  const days = [];
  let prev = 0;
  for (let i = 0; i < count; i++) {
    let day = Math.round(startDay + ((endDay - startDay) * i) / (count - 1));
    if (day <= prev) day = prev + 1;
    days.push(day);
    prev = day;
  }
  return days;
}

// Array de 38 posições: seasonCalendar[roundIdx] = dia-do-ano em que essa
// rodada acontece — rodadas 1-18 espalhadas entre 28/jan e 31/mai, pulo
// total pra pausa da Copa do Mundo, rodadas 19-38 espalhadas entre 22/jul
// e 2/dez.
export function buildSeasonCalendar(numRounds) {
  const firstHalf = Math.round((numRounds * FIRST_HALF_ROUNDS) / 38);
  const secondHalf = numRounds - firstHalf;
  return [
    ...spreadDays(FIRST_HALF_START, FIRST_HALF_END, firstHalf),
    ...spreadDays(SECOND_HALF_START, SECOND_HALF_END, secondHalf),
  ];
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
