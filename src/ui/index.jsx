// Componentes base do tema claro. Estilo em ui.css (importado no main.jsx).
import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';

export { Icon } from './icons.jsx';

const cx = (...c) => c.filter(Boolean).join(' ');

export function Button({ variant = 'dark', size = 'md', block, icon, iconRight, children, className, ...rest }) {
  return (
    <button type="button" className={cx('ui-btn', `ui-btn-${variant}`, `ui-btn-${size}`, block && 'ui-btn-block', className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 17} />}
    </button>
  );
}

export function Card({ as: As = 'div', raised, dark, className, children, ...rest }) {
  return <As className={cx('ui-card', raised && 'ui-card-raised', dark && 'ui-card-dark on-dark', className)} {...rest}>{children}</As>;
}

export function Tag({ tone, icon, children, className, ...rest }) {
  return (
    <span className={cx('ui-tag', tone && `ui-tag-${tone}`, className)} {...rest}>
      {icon && <Icon name={icon} size={12} />}{children}
    </span>
  );
}

// tabs: [{ id, label, icon?, badge? }]
export function Tabs({ tabs, value, onChange, className, style }) {
  return (
    <div className={cx('ui-tabs', className)} role="tablist" style={style}>
      {tabs.map(t => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className="ui-tab" onClick={() => onChange(t.id)}>
          {t.icon && <Icon name={t.icon} size={16} />}{t.label}{t.badge}
        </button>
      ))}
    </div>
  );
}

export function Modal({ onClose, maxWidth = 520, children, labelledBy, className, style }) {
  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="ui-overlay" onClick={onClose} role="presentation">
      <div className={cx('ui-modal', className)} style={{ maxWidth, ...style }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {onClose && (
          <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Fechar"><Icon name="close" size={18} /></button>
        )}
        {children}
      </div>
    </div>
  );
}

// title aceita uma palavra em itálico dourado via `accent` (ex.: title="Escolha seu" accent="clube")
export function SectionHeader({ eyebrow, title, accent, after, size = 'md', desc, right, as: As = 'h2', style }) {
  return (
    <div className="ui-sh" style={style}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <span className="ui-eyebrow"><i />{eyebrow}</span>}
        <As className={cx('ui-title', `ui-title-${size}`)}>
          {title}{accent && <> <em>{accent}</em></>}{after}
        </As>
        {desc && <p>{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function Input({ label, icon, className, style, ...rest }) {
  const input = <input className={cx('ui-input', className)} {...rest} />;
  return (
    <label className="ui-field" style={style}>
      {label && <span className="ui-label">{label}</span>}
      {icon ? <span className="ui-input-wrap"><Icon name={icon} size={17} />{input}</span> : input}
    </label>
  );
}

export function Select({ label, children, className, style, ...rest }) {
  return (
    <label className="ui-field" style={style}>
      {label && <span className="ui-label">{label}</span>}
      <select className={cx('ui-select', className)} {...rest}>{children}</select>
    </label>
  );
}

export function StatTile({ label, value, sub, valueColor, style }) {
  return (
    <div className="ui-stat" style={style}>
      <div className="ui-stat-k">{label}</div>
      <div className="ui-stat-v" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      {sub && <div className="ui-stat-s">{sub}</div>}
    </div>
  );
}

export function PlayerRow({ lead, name, sub, right, onClick, style, className }) {
  const As = onClick ? 'button' : 'div';
  return (
    <As className={cx('ui-prow', className)} onClick={onClick} style={{ textAlign: 'left', width: '100%', cursor: onClick ? 'pointer' : undefined, ...style }}>
      <div>{lead}</div>
      <div style={{ minWidth: 0 }}>
        <div className="ui-prow-name">{name}</div>
        {sub && <div className="ui-prow-sub">{sub}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>
    </As>
  );
}

// Escudo com fallback: se a imagem falhar some (sem alt text visível) e
// mostra as iniciais sobre a cor do clube.
export function TeamBadge({ src, name = '', color = '#0D3A29', size = 32, radius = 10, style }) {
  const [failed, setFailed] = useState(!src);
  useEffect(() => { setFailed(!src); }, [src]);
  const initials = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  if (failed) {
    return (
      <span className="ui-badge ui-badge-fallback" style={{ width: size, height: size, borderRadius: radius, background: color, fontSize: Math.max(9, size * 0.34), ...style }} aria-hidden="true">
        {initials}
      </span>
    );
  }
  return (
    <span className="ui-badge" style={{ width: size, height: size, borderRadius: radius, ...style }}>
      <img src={src} alt="" onError={() => setFailed(true)} loading="lazy" />
    </span>
  );
}

export function Alert({ tone = 'warning', icon, children, onClick, style }) {
  const As = onClick ? 'button' : 'div';
  return (
    <As className={cx('ui-alert', `ui-alert-${tone}`)} onClick={onClick} style={style} role={onClick ? undefined : 'status'}>
      <Icon name={icon || (tone === 'success' ? 'check' : tone === 'info' ? 'info' : 'warning')} size={18} />
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {onClick && <Icon name="arrowRight" size={16} />}
    </As>
  );
}

export function BrandMark({ size = 20 }) {
  return (
    <span className="ui-brand-mark"><Icon name="trophy" size={size} /></span>
  );
}

export const FOOTER_LINKS = [['como-jogar', 'Como Jogar'], ['termos', 'Termos de Uso'], ['privacidade', 'Política de Privacidade'], ['contato', 'Contato']];

export function SiteFooter({ onNavigateInfo, onNavigateTeams }) {
  return (
    <footer className="ui-footer">
      <span>© {new Date().getFullYear()} Brasileirão Lendário</span>
      <nav>
        {FOOTER_LINKS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => onNavigateInfo(id)}>{label}</button>
        ))}
        <button type="button" onClick={onNavigateTeams}>Elencos</button>
      </nav>
    </footer>
  );
}
