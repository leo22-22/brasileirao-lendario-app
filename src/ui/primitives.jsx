// Primitivas sem conhecimento de futebol (padrão creme). Estilos em
// primitives.css. Reexportadas por ui/index.jsx.
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import './primitives.css';

const cx = (...c) => c.filter(Boolean).join(' ');

// Botão só com ícone — sempre com nome acessível (label).
export function IconButton({ icon, label, size = 38, tone, badge, className, ...rest }) {
  return (
    <button type="button" className={cx('ui-ibtn', tone && `ui-ibtn-${tone}`, className)} aria-label={label} title={label} style={{ width: size, height: size }} {...rest}>
      <Icon name={icon} size={Math.round(size * 0.47)} />
      {badge && <i className="ui-ibtn-dot" aria-hidden="true" />}
    </button>
  );
}

// Controle segmentado. options: [{ id, label, disabled?, title? }]. tone 'dark' para usar sobre verde.
export function Segmented({ options, value, onChange, label, tone, size = 'md', className, role = 'tablist' }) {
  return (
    <div className={cx('ui-seg', tone === 'dark' && 'ui-seg-dark', size === 'sm' && 'ui-seg-sm', className)} role={role === 'tablist' ? 'tablist' : 'group'} aria-label={label}>
      {options.map(o => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            className={on ? 'ui-seg-on' : undefined}
            disabled={o.disabled}
            title={o.title}
            {...(role === 'tablist' ? { role: 'tab', 'aria-selected': on } : { 'aria-pressed': on })}
            onClick={() => onChange(o.id)}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

// Chips de filtro. options: [{ id, label, count? }]. multi: valor é array.
export function FilterChips({ options, value, onChange, multi = false, label, className }) {
  const isOn = (id) => (multi ? (value || []).includes(id) : value === id);
  const toggle = (id) => {
    if (!multi) return onChange(id);
    const cur = value || [];
    return onChange(cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  };
  return (
    <div className={cx('ui-chips', className)} role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" className={cx('ui-chip', isOn(o.id) && 'ui-chip-on')} aria-pressed={isOn(o.id)} onClick={() => toggle(o.id)}>
          {o.label}{o.count != null && <em>{o.count}</em>}
        </button>
      ))}
    </div>
  );
}

// Pílula (Tag já existe em index.jsx; Pill é a versão maior de cabeçalho).
export function Pill({ tone, children, title, className }) {
  return <span className={cx('ui-pill', tone && `ui-pill-${tone}`, className)} title={title}>{children}</span>;
}

export function EmptyState({ icon = 'info', title, children, action, className }) {
  return (
    <div className={cx('ui-empty', className)}>
      <span className="ui-empty-ic" aria-hidden="true"><Icon name={icon} size={20} /></span>
      {title && <b>{title}</b>}
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

// Barra em células (ex.: progresso de rodadas). cells: [{ tone: 'done'|'now'|'win'|'loss'|'draw'|undefined, title }]
export function ProgressCells({ cells, label, className }) {
  return (
    <div className={cx('ui-cells', className)} role="img" aria-label={label}>
      {cells.map((c, i) => <i key={i} className={c.tone ? `ui-cell-${c.tone}` : undefined} title={c.title} />)}
    </div>
  );
}

// Passos de um fluxo. steps: ['Esquema', 'Draft', ...]; current: índice.
export function Stepper({ steps, current, className, label = 'Etapas' }) {
  return (
    <ol className={cx('ui-stepper', className)} aria-label={label}>
      {steps.map((s, i) => (
        <li key={s} className={i < current ? 'ui-step-done' : i === current ? 'ui-step-now' : undefined} aria-current={i === current ? 'step' : undefined}>
          <span className="ui-step-n">{i < current ? <Icon name="check" size={12} /> : i + 1}</span>{s}
        </li>
      ))}
    </ol>
  );
}

// Confirmação em linha (sem modal): "Tem certeza? [Cancelar] [Confirmar]".
export function ConfirmInline({ text, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'danger', onConfirm, onCancel }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="ui-confirm" role="alertdialog" aria-label={text}>
      <span>{text}</span>
      <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={onCancel}>{cancelLabel}</button>
      <button ref={ref} type="button" className={cx('ui-btn ui-btn-sm', tone === 'danger' ? 'ui-btn-danger' : 'ui-btn-dark')} onClick={onConfirm}>{confirmLabel}</button>
    </div>
  );
}

// Dica ao passar o mouse / focar. Conteúdo também vira aria-describedby.
export function Tooltip({ text, children, side = 'top' }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="ui-tip-wrap" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} aria-describedby={id}>
      {children}
      <span id={id} role="tooltip" className={cx('ui-tip', `ui-tip-${side}`, open && 'ui-tip-on')}>{text}</span>
    </span>
  );
}

// Foco preso dentro de um contêiner enquanto aberto; devolve o foco ao sair.
export function useFocusTrap(ref, active = true) {
  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const prev = document.activeElement;
    const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const first = ref.current.querySelector(sel);
    if (first && !ref.current.contains(document.activeElement)) first.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll(sel)].filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const a = items[0];
      const z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, [ref, active]);
}

// Painel lateral (desktop) que vira bottom sheet no celular.
export function Drawer({ open, onClose, title, children, side = 'right', className, labelledBy }) {
  const ref = useRef(null);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ui-drawer-bg" onClick={onClose} role="presentation">
      <aside ref={ref} className={cx('ui-drawer', `ui-drawer-${side}`, className)} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : title}>
        <div className="ui-drawer-h">
          {title && <h3>{title}</h3>}
          <IconButton icon="close" label="Fechar" size={34} onClick={onClose} />
        </div>
        <div className="ui-drawer-b">{children}</div>
      </aside>
    </div>
  );
}

// Popover ancorado num botão (abre por clique, fecha com Esc/clique fora).
export function Popover({ trigger, children, label, align = 'start', className }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <span className="ui-pop-wrap" ref={wrap}>
      {trigger({ open, toggle: () => setOpen(o => !o), props: { 'aria-expanded': open, 'aria-controls': id, 'aria-haspopup': 'dialog' } })}
      {open && <div id={id} role="dialog" aria-label={label} className={cx('ui-pop', `ui-pop-${align}`, className)}>{typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}</div>}
    </span>
  );
}

// Toast simples controlado por quem chama (some sozinho em `ms`).
export function Toast({ message, tone = 'dark', onDone, ms = 3200 }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => onDone?.(), ms);
    return () => clearTimeout(t);
  }, [message, ms, onDone]);
  if (!message) return null;
  return <div className={cx('ui-toast', `ui-toast-${tone}`)} role="status" aria-live="polite">{message}</div>;
}
