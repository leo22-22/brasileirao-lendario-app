// Calendário do Modo Carreira — dia-do-ano (1-365, ano fictício sem ano
// bissexto) usado só pra ritmo/janela, não pra data real (o motor não
// modela dia-da-semana, só dia-do-ano). Datas EXATAS da Série A 2026
// (pedido explícito do usuário 2026-11-11, cronograma fim-de-semana a
// fim-de-semana colado pelo usuário, mais preciso que a versão anterior
// por interpolação): rodada 1 no domingo 1º/fev (dia 32), rodadas 2-22
// cada uma num fim de semana até 28/jun (dia 179), PARADA TOTAL em julho
// pra Copa do Mundo 2026 (nem Brasileirão nem Copa do Brasil joga nesse
// buraco), rodada 23 retoma em 2/ago (dia 214), rodada 38 (última) em
// 15/nov (dia 319). Cada rodada usa o domingo do fim de semana (ou o
// próprio domingo único da rodada 1) como "o dia" dela — o motor só
// grava um dia por rodada, não o fim de semana inteiro.
// A Série B usa o MESMO calendário/índice de rodada que a Série A — o
// motor sempre fez as duas divisões andarem juntas (ver playRound em
// seasonEngine.js) e, na prática, as duas realmente pausam juntas.
//
// Duas janelas de transferência: janeiro inteiro (pré-temporada, fecha
// na véspera da rodada 1) e a PRÓPRIA pausa da Copa do Mundo (julho
// inteiro, dias 180-213) — período real em que os clubes mexeriam no
// elenco com o campeonato parado. Fora delas o mercado fica fechado.
export const JAN_END = 31;
export const WINDOW2_START = 180; // 1º de julho — início da pausa da Copa do Mundo 2026
export const WINDOW2_END = 213; // 1º de agosto — véspera da retomada (rodada 23 em 2/ago)

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

// Dia-do-ano de cada uma das 38 rodadas, EXATO (não interpolado) — direto
// do cronograma fim-de-semana a fim-de-semana que o usuário colou
// (2026-11-11). Domingo de cada fim de semana (ou o próprio domingo único
// da rodada 1); pulo total de julho inteiro (dias 180-213) pra Copa do
// Mundo 2026.
const SEASON_DAYS = [
  32, 39, 46, 53, 60, 67, 74, 81, 88, 95, 102, 109, 116, 123, 130, 137, 144,
  151, 158, 165, 172, 179, 214, 221, 228, 235, 242, 249, 256, 263, 270, 277,
  284, 291, 298, 305, 312, 319,
];

// Array de 38 posições: seasonCalendar[roundIdx] = dia-do-ano em que essa
// rodada acontece. Sempre chamado com numRounds=38 (Série A e B têm 20
// clubes cada, 38 rodadas) — o parâmetro fica só por compatibilidade de
// assinatura.
export function buildSeasonCalendar(numRounds) {
  if (numRounds === SEASON_DAYS.length) return [...SEASON_DAYS];
  // Fallback defensivo (nunca deveria disparar — só entra aqui se um dia
  // o motor passar a jogar com um número de clubes diferente de 20):
  // espalha uniformemente entre o primeiro e o último dia da temporada.
  const start = SEASON_DAYS[0];
  const end = SEASON_DAYS[SEASON_DAYS.length - 1];
  if (numRounds <= 1) return [start];
  const days = [];
  let prev = 0;
  for (let i = 0; i < numRounds; i++) {
    let day = Math.round(start + ((end - start) * i) / (numRounds - 1));
    if (day <= prev) day = prev + 1;
    days.push(day);
    prev = day;
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
