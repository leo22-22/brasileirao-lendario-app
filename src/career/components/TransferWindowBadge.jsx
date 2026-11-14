// Selo de status da janela de transferências — verde quando aberta (com a
// data real de fechamento), vermelho quando fechada (com a data real da
// próxima abertura, seja janeiro ou julho, o que vier primeiro). Usado no
// Hub e no Mercado pra manter o mesmo visual nos dois lugares.
import { isTransferWindowOpen, currentWindowCloseDay, nextWindowOpenDay, formatCalendarDay } from '../engine/calendar.js';
import { Icon } from '../../ui/index.jsx';

export function TransferWindowBadge({ day, style }) {
  const open = isTransferWindowOpen(day);
  const dateLabel = open ? formatCalendarDay(currentWindowCloseDay(day)) : formatCalendarDay(nextWindowOpenDay(day));
  const color = open ? '#1F7A4D' : '#B23B3B';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10,
      background: `${color}1a`, border: `1px solid ${color}4d`, fontSize: 12, color, fontWeight: 600,
      ...style,
    }}>
      <Icon name="swap" size={15} />
      <span>
        {open ? 'Janela de transferências aberta' : 'Janela de transferências fechada'}
        {' — '}
        {open ? `fecha em ${dateLabel}` : `abre em ${dateLabel}`}
      </span>
    </div>
  );
}
