// Header ÚNICO do site (jogo, carreira, Simulador e páginas de conteúdo):
// marca, breadcrumb e ações. Só apresentação — quem chama passa as ações
// (o jogo passa conta/sons/notificações; as páginas de conteúdo, links).
// No celular fica numa linha: marca + ação principal + menu (HeaderMenu).
import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { BrandMark } from './index.jsx';

// crumb: { root, current } | null
export function AppHeader({ onBrand, brandTitle = 'Voltar ao início', showSub = true, wide = false, crumb, children }) {
  return (
    <header className="ui-header">
      <div className="ui-header-inner" style={wide ? { maxWidth: 'none', padding: '12px 28px' } : undefined}>
        <button type="button" className="ui-brand" onClick={onBrand} title={brandTitle} aria-label={`Brasileirão Lendário — ${brandTitle.toLowerCase()}`}>
          <BrandMark />
          <span style={{ minWidth: 0 }}>
            <span className="ui-brand-name">Brasileirão Lendário</span>
            {showSub && <span className="ui-brand-sub">monte · escale · seja campeão</span>}
          </span>
        </button>
        {crumb && (
          <nav className="ui-crumb ui-hide-mobile" aria-label="Você está em">
            <span>{crumb.root}</span>
            <Icon name="chevronRight" size={14} />
            <b>{crumb.current}</b>
          </nav>
        )}
        <div className="ui-header-actions">{children}</div>
      </div>
    </header>
  );
}

// Menu do cabeçalho no celular — junta as ações secundárias para o
// cabeçalho caber numa linha só. items: [{ icon, label, onClick }]
export function HeaderMenu({ items, badge }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey); };
  }, [open]);
  if (!items.length) return null;
  return (
    <div className="ui-hmenu-wrap ui-only-mobile">
      <button type="button" className="ui-hbtn ui-hbtn-icon" aria-label="Mais opções" aria-haspopup="menu" aria-expanded={open} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
        <Icon name="menu" size={18} />
        {badge && <span className="ui-dot" style={{ minWidth: 10, height: 10, top: -2, right: -2, padding: 0 }} />}
      </button>
      {open && (
        <div className="ui-hmenu" role="menu" onClick={e => e.stopPropagation()}>
          {items.map(it => (
            <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onClick(); }}>
              <Icon name={it.icon} size={17} />{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
