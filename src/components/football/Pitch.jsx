// Campo — ÚNICA superfície para todo o app: gramado listrado + marcações
// (referência: Formação da carreira). Os slots são posicionados por quem
// usa (cálculo de slots já existente: buildPitchSlots / formação da carreira).
// PlayerDot é o jogador no campo (OVR no círculo com anel do setor, nome em
// pílula com reticências, selos C / P / !).
import { forwardRef } from 'react';
import { posSector } from '../../lib/format.js';
import './pitch.css';

export const SECTOR_RING = { gk: '#C29A45', df: '#4E86C2', md: '#3FA372', at: '#D2604F' };

/**
 * variant: 'full' (padrão) | 'mini' (card de esquema, sem área penal detalhada).
 * className/style: tamanho de cada tela (altura, aspect-ratio, raio).
 */
export const PitchSurface = forwardRef(function PitchSurface({ variant = 'full', className = '', style, children, ...rest }, ref) {
  return (
    <div ref={ref} className={`fb-pitch on-dark${variant === 'mini' ? ' fb-pitch-mini' : ''}${className ? ` ${className}` : ''}`} style={style} {...rest}>
      <svg className="fb-pitch-lines" viewBox="0 0 528 720" preserveAspectRatio="none" aria-hidden="true">
        <rect x="14" y="14" width="500" height="692" rx="4" /><line x1="14" y1="360" x2="514" y2="360" /><circle cx="264" cy="360" r="62" />
        {variant !== 'mini' && (
          <>
            <rect x="144" y="14" width="240" height="96" /><rect x="204" y="14" width="120" height="38" />
            <rect x="144" y="610" width="240" height="96" /><rect x="204" y="668" width="120" height="38" />
          </>
        )}
      </svg>
      {children}
    </div>
  );
});

/**
 * slot: { key, x, y, realPos, label }. player: { name, ovr, pos[] } | null.
 * badges: { cap, pen, warn: 'warning'|'danger'|null }. note: texto após a posição.
 */
export function PlayerDot({ slot, player, selected, badges = {}, note, dangerName, onClick, label, title }) {
  const sector = posSector(slot.realPos);
  return (
    <button
      type="button"
      className={`fb-dot${selected ? ' fb-dot-sel' : ''}${player ? '' : ' fb-dot-empty'}`}
      style={{ left: `${slot.x}%`, top: `${slot.y}%`, '--ring': SECTOR_RING[sector] }}
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      title={title ?? label}
    >
      <span className="fb-dot-c" style={badges.warn === 'danger' ? { borderColor: 'var(--danger)' } : undefined}>
        {player ? player.ovr : slot.label}
        {badges.cap && <i className="fb-bdg fb-cap" aria-hidden="true">C</i>}
        {badges.pen && <i className="fb-bdg fb-pen" aria-hidden="true">P</i>}
        {badges.warn && <i className={`fb-bdg fb-warn${badges.warn === 'danger' ? ' fb-red' : ''}`} aria-hidden="true">!</i>}
      </span>
      {player && <span className="fb-dot-n" style={dangerName ? { background: 'rgba(178,59,59,.85)' } : undefined}>{player.name}</span>}
      <span className="fb-dot-p">{slot.realPos}{note ? ` · ${note}` : ''}</span>
    </button>
  );
}
