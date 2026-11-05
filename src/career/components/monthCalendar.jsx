// Utilitários de grade de mês compartilhados entre CareerCalendarScreen.jsx
// (calendário clicável da temporada) e CareerAdvanceModal.jsx (modal animado
// do "Avançar") — extraído pra não duplicar a matemática de dia-do-ano vs
// dia-do-mês/dia-da-semana entre os dois.
import { CLUB_LOGOS } from '../../data/club-logos.js';

export const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const WEEKDAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
export const RESULT_COLORS = { V: '#7fd99a', D: '#e05050', E: 'rgba(255,255,255,0.45)' };
// Ano fictício fixo só pra matemática de dia-da-semana da grade — o Modo
// Carreira usa dia-do-ano (1-365) sem ano real, não precisa bater com
// nenhum calendário de verdade.
export const GRID_YEAR = 2026;

export function dayOfYearToMonthDay(day) {
  let remaining = Math.max(1, Math.min(365, day));
  for (let m = 0; m < 12; m++) {
    if (remaining <= MONTH_LENGTHS[m]) return { month: m, dayOfMonth: remaining };
    remaining -= MONTH_LENGTHS[m];
  }
  return { month: 11, dayOfMonth: 31 };
}

export function dayOfYearFor(dayOfMonth, month) {
  let total = dayOfMonth;
  for (let m = 0; m < month; m++) total += MONTH_LENGTHS[m];
  return total;
}

export function monthMatrix(month) {
  const first = new Date(GRID_YEAR, month, 1);
  const daysInMonth = MONTH_LENGTHS[month];
  const lead = (first.getDay() + 6) % 7; // seg=0 … dom=6
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function TinyCrest({ team, ring, emoji }) {
  const logo = team ? CLUB_LOGOS[team.club] : null;
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: ring ? `2px solid ${ring}` : '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', flexShrink: 0,
    }}>
      {emoji ? <span style={{ fontSize: 11 }}>{emoji}</span> : logo ? <img src={logo} alt="" style={{ width: '72%', height: '72%', objectFit: 'contain' }} /> : <span style={{ fontSize: 9, opacity: 0.4 }}>?</span>}
    </div>
  );
}

export const navArrowStyle = {
  background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#F4F1EA',
  width: 28, height: 28, cursor: 'pointer',
};
