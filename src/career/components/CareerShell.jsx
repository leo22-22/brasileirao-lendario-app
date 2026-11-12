// Casca das telas do Modo Carreira: menu lateral fixo (248px) no desktop,
// só ícones até 1200px, e barra inferior com 5 itens + "Mais" no celular.
// Substitui os tiles de navegação que ficavam no meio do hub.
import { useState, useEffect } from 'react';
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { Icon, TeamBadge } from '../../ui/index.jsx';
import { displayName } from '../../lib/displayName.js';
import { isTransferWindowOpen } from '../engine/calendar.js';
import { myDivision, myCopaStatus } from '../engine/careerMeta.js';
import './careerShell.css';

const SHORT_COPA = {
  'Primeira Fase': '1ª fase', '16 Avos de Final': '16 avos', 'Oitavas de Final': 'oitavas',
  'Quartas de Final': 'quartas', Semifinal: 'semi', Final: 'final',
};

export function careerNavItems(save) {
  const club = save.clubs[save.myClubId];
  const { key, data: division } = myDivision(save);
  const n = division.table.length;
  const pos = division.table.findIndex(r => r.id === save.myClubId) + 1;
  const roster = club.roster.filter(p => !p.inAcademy).length;
  const academy = club.roster.filter(p => p.inAcademy).length;
  const copa = myCopaStatus(save);
  const copaBase = copa.label.split(' (')[0];
  const copaBadge = copa.alive ? (SHORT_COPA[copaBase] || copaBase.toLowerCase()) : copa.label.toLowerCase();
  const started = division.round > 0;
  const unread = (save.inbox || []).filter(m => !m.read).length;
  const windowOpen = isTransferWindowOpen(save.calendarDay);
  const roundLabel = division.round >= division.fixtures.length ? 'fim' : `R${division.round + 1}`;
  return [
    { id: 'hub', label: 'Visão geral', icon: 'home' },
    { id: 'squad', label: 'Elenco', icon: 'shirt', badge: String(roster) },
    { id: 'formation', label: 'Formação', icon: 'formation', badge: save.myFormationLabel ? save.myFormationLabel.split(' ')[0] : 'definir', badgeTone: save.myFormationLabel ? null : 'warn' },
    { id: 'market', label: 'Mercado', icon: 'market', badge: (save.pendingOffers?.length ? `${save.pendingOffers.length} prop.` : windowOpen ? 'aberto' : 'fechado'), badgeTone: save.pendingOffers?.length ? 'pill' : windowOpen ? 'ok' : null },
    { id: 'table', label: 'Tabela', icon: 'table', badge: started ? `${pos}º` : `Série ${key}`, badgeTone: started && pos > n - 4 ? 'danger' : null },
    { id: 'calendar', label: 'Calendário', icon: 'calendar', badge: roundLabel },
    { id: 'copa', label: 'Copa do Brasil', icon: 'cup', badge: copaBadge },
    { id: 'youth', label: 'Base', icon: 'sprout', badge: academy ? `${academy} ${academy > 1 ? 'novas' : 'nova'}` : null, badgeTone: academy ? 'pill' : null },
    { id: 'finance', label: 'Finanças', icon: 'money' },
    { sep: true, id: 'sep' },
    { id: 'inbox', label: 'Caixa de entrada', icon: 'chat', badge: unread ? String(unread) : null, badgeTone: unread ? 'pill' : null },
  ];
}

const MOBILE_MAIN = ['hub', 'squad', 'formation', 'market', 'table'];

export function CareerShell({ save, active, onNavigate, onExit, children }) {
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { setMoreOpen(false); }, [active]);
  const team = TEAMS.find(t => t.id === save.myClubId);
  const { key, data: division } = myDivision(save);
  const pos = division.table.findIndex(r => r.id === save.myClubId) + 1;
  const items = careerNavItems(save);
  const navItems = items.filter(i => !i.sep);
  const go = (id) => { onNavigate(id); window.scrollTo?.({ top: 0 }); };

  return (
    <div className="cs-shell">
      <aside className="cs-side" aria-label="Menu do Modo Carreira">
        <div className="cs-club" title={`${displayName(team.club)} · Série ${key} · ${pos}º lugar`}>
          <TeamBadge src={CLUB_LOGOS[team.club]} name={team.club} color={team.colors?.p} size={40} radius={20} />
          <div className="cs-txt">
            <b>{displayName(team.club)}</b>
            <small>Série {key}{division.round > 0 ? ` · ${pos}º lugar` : ' · pré-temporada'}</small>
          </div>
        </div>
        <nav className="cs-nav">
          {items.map(it => it.sep ? <div key={it.id} className="cs-sep" /> : (
            <button
              key={it.id}
              type="button"
              className={`cs-item${active === it.id ? ' cs-on' : ''}`}
              onClick={() => go(it.id)}
              aria-current={active === it.id ? 'page' : undefined}
              title={it.badge ? `${it.label} · ${it.badge}` : it.label}
              aria-label={it.badge ? `${it.label} (${it.badge})` : it.label}
            >
              <Icon name={it.icon} size={18} />
              <span className="cs-txt">{it.label}</span>
              {it.badge && <span className={`cs-badge cs-txt${it.badgeTone ? ` cs-b-${it.badgeTone}` : ''}`}>{it.badge}</span>}
              {it.badge && (it.badgeTone === 'pill' || it.badgeTone === 'danger') && <span className="cs-dot" aria-hidden="true" />}
            </button>
          ))}
        </nav>
        <button type="button" className="cs-item cs-exit" onClick={onExit} title="Sair da carreira" aria-label="Sair da carreira">
          <Icon name="logout" size={18} />
          <span className="cs-txt">Sair da carreira</span>
        </button>
      </aside>

      <div className="cs-main">{children}</div>

      <nav className="cs-bottom" aria-label="Menu do Modo Carreira">
        {MOBILE_MAIN.map(id => {
          const it = navItems.find(x => x.id === id);
          return (
            <button key={id} type="button" className={`cs-bitem${active === id ? ' cs-on' : ''}`} onClick={() => go(id)} aria-current={active === id ? 'page' : undefined} aria-label={it.label}>
              <Icon name={it.icon} size={20} />
              <span>{id === 'hub' ? 'Início' : it.label}</span>
            </button>
          );
        })}
        <button type="button" className={`cs-bitem${!MOBILE_MAIN.includes(active) ? ' cs-on' : ''}`} onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen} aria-label="Mais opções">
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <Icon name="menu" size={20} />
            {navItems.some(i => !MOBILE_MAIN.includes(i.id) && (i.badgeTone === 'pill' || i.badgeTone === 'danger')) && <span className="cs-dot" style={{ top: -2, right: -4 }} />}
          </span>
          <span>Mais</span>
        </button>
      </nav>
      {moreOpen && (
        <div className="cs-sheet-wrap" onClick={() => setMoreOpen(false)} role="presentation">
          <div className="cs-sheet" onClick={e => e.stopPropagation()} role="menu">
            {navItems.filter(i => !MOBILE_MAIN.includes(i.id)).map(it => (
              <button key={it.id} type="button" role="menuitem" className={`cs-item${active === it.id ? ' cs-on' : ''}`} onClick={() => go(it.id)}>
                <Icon name={it.icon} size={18} />
                <span>{it.label}</span>
                {it.badge && <span className={`cs-badge${it.badgeTone ? ` cs-b-${it.badgeTone}` : ''}`}>{it.badge}</span>}
              </button>
            ))}
            <div className="cs-sep" />
            <button type="button" role="menuitem" className="cs-item" onClick={onExit}>
              <Icon name="logout" size={18} /><span>Sair da carreira</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
