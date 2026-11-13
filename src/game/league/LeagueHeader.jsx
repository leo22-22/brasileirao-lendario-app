// Cabeçalho + abas da liga clássica (Brasileirão Lendário, Atual, Modo Livre,
// multiplayer e Supercopa) — liga-partida-mockup.html. Só apresentação: o
// estado (aba ativa, rodada, botões) continua no App.jsx.
import { useRef } from 'react';
import { Icon } from '../../ui/index.jsx';
import './league.css';

/**
 * crest: nó do escudo (TeamBadge). eyebrow/title: textos. tags: [{ label, tone: 'ok'|'gold'|'danger'|undefined, title }].
 * actions: nó à direita (botões). tabs: [{ id, label, icon, badge, live }]. activeTab/onTab.
 */
export function LeagueHeader({ crest, eyebrow, title, tags = [], actions, tabs = [], activeTab, onTab, panelId = 'lg-panel' }) {
  const tabRefs = useRef([]);
  const onKey = (e, i) => {
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j == null) return;
    e.preventDefault();
    onTab(tabs[j].id);
    tabRefs.current[j]?.focus();
  };
  return (
    <>
      <div className="lg-head">
        {crest && <div className="lg-crest">{crest}</div>}
        <div className="lg-head-txt">
          {eyebrow && <span className="lg-mono">{eyebrow}</span>}
          <h1>{title}</h1>
          {tags.length > 0 && (
            <div className="lg-tags">
              {tags.map(t => <span key={t.label} className={`lg-tag${t.tone ? ` lg-tag-${t.tone}` : ''}`} title={t.title}>{t.label}</span>)}
            </div>
          )}
        </div>
        {actions && <div className="lg-head-act">{actions}</div>}
      </div>
      {tabs.length > 0 && (
        <div className="lg-tabs" role="tablist" aria-label="Seções da temporada">
          {tabs.map((t, i) => {
            const on = activeTab === t.id;
            return (
              <button
                key={t.id}
                ref={el => { tabRefs.current[i] = el; }}
                type="button"
                role="tab"
                id={`lg-tab-${t.id}`}
                aria-selected={on}
                aria-controls={panelId}
                tabIndex={on ? 0 : -1}
                className={on ? 'lg-on' : undefined}
                onClick={() => onTab(t.id)}
                onKeyDown={e => onKey(e, i)}
              >
                {t.icon && <Icon name={t.icon} size={16} />}
                <span>{t.label}</span>
                {t.badge && <em className={t.live ? 'lg-live' : undefined}>{t.badge}</em>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
