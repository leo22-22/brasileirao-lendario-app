// Utilitários de grade de mês compartilhados entre CareerCalendarScreen.jsx
// (calendário clicável da temporada) e CareerAdvanceModal.jsx (modal animado
// do "Avançar") — extraído pra não duplicar a matemática de dia-do-ano vs
// dia-do-mês/dia-da-semana entre os dois.
import { ClubCrest } from '../../components/football/ClubCrest.jsx';
import { Icon } from '../../ui/index.jsx';

export const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const WEEKDAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
export const RESULT_COLORS = { V: '#1F7A4D', D: '#B23B3B', E: '#8A938C' };
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

export function TinyCrest({ team, ring, icon }) {
  if (icon) {
    return <span className="fb-crest-frame" style={{ width: 22, height: 22, ...(ring ? { boxShadow: `inset 0 0 0 2px ${ring}` } : null) }} aria-hidden="true"><Icon name={icon} size={12} /></span>;
  }
  return <ClubCrest team={team} size={22} frame scale={0.72} ringColor={ring || undefined} unknown="q" />;
}

export const navArrowStyle = {
  background: 'none', border: '1px solid var(--line-strong)', borderRadius: 8, color: 'var(--ink)',
  width: 28, height: 28, cursor: 'pointer',
};
