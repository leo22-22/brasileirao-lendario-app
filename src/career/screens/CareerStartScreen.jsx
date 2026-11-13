// Entrada do Modo Carreira — redesenho de 2026-11-13
// (modo-carreira-inicio-mockup.html). Junta o antigo "Continuar / Carregar
// outra / Começar nova" com a lista de carreiras (ex-CareerLoadScreen) numa
// página só, sem o menu lateral (ainda não entrou numa carreira). A lógica
// de slots continua a mesma (careerStorage.js): carregar troca a ativa,
// "Escolher clube" cria uma carreira nova sem apagar as outras e apagar
// pede confirmação no próprio card.
import { useEffect, useRef, useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { timeAgo } from '../engine/careerSummary.js';
import { formatMoneyShort } from './CareerHub.jsx';
import { displayName } from '../../lib/displayName.js';
import { Icon, TeamBadge } from '../../ui/index.jsx';
import { dayOfYearToMonthDay } from '../components/monthCalendar.jsx';
import '../components/careerShell.css';
import './careerStart.css';

const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const clubOf = (id) => TEAMS.find(t => t.id === id);
const nameOf = (id) => displayName(clubOf(id)?.club || '');

function Crest({ id, logo, name, color, size }) {
  const t = id ? clubOf(id) : null;
  return <TeamBadge src={logo ?? CLUB_LOGOS[t?.club]} name={name ?? t?.club ?? ''} color={color ?? t?.colors?.p ?? '#0D3A29'} size={size} radius={size / 2} />;
}

function OtherCareer({ c, onLoad, onDelete }) {
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => { if (confirming) cancelRef.current?.focus(); }, [confirming]);
  useEffect(() => {
    if (!menu && !confirming) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setMenu(false); setConfirming(false); } };
    const onDoc = (e) => { if (menu && !menuRef.current?.contains(e.target)) setMenu(false); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDoc); };
  }, [menu, confirming]);
  const ago = timeAgo(c.updatedAt);
  const label = `Carregar carreira do ${c.name}, temporada ${c.season}`;
  return (
    <article className={`st-sv${confirming ? ' st-confirm' : ''}`}>
      <button type="button" className="st-sv-main" onClick={() => onLoad(c.seed)} aria-label={label}>
        <span className="st-band" style={{ background: `linear-gradient(135deg, ${c.colorP} 0 55%, ${c.colorS} 55%)` }} aria-hidden="true">
          <span className="st-band-crest"><Crest id={c.clubId} logo={c.logo} name={c.name} color={c.colorP} size={46} /></span>
        </span>
        <span className="st-bd">
          <b className="st-sv-name">{c.name}</b>
          <span className="st-meta">Temporada {c.season} · {c.dateText}</span>
          <span className="st-pills">
            <span className={`st-pill${c.zone.tone === 'ok' ? ' st-p-ok' : c.zone.tone === 'bad' ? ' st-p-bad' : ''}`}>{c.zone.short}</span>
            <span className="st-pill">{formatMoneyShort(c.budget)}</span>
          </span>
        </span>
      </button>
      <div className="st-menu-wrap" ref={menuRef}>
        <button type="button" className="st-menu-btn" aria-label={`Opções da carreira do ${c.name}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(m => !m)}>⋯</button>
        {menu && (
          <div className="st-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenu(false); onLoad(c.seed); }}><Icon name="play" size={15} />Carregar</button>
            <button type="button" role="menuitem" className="st-menu-del" onClick={() => { setMenu(false); setConfirming(true); }}><Icon name="close" size={15} />Apagar</button>
          </div>
        )}
      </div>
      {confirming ? (
        <div className="st-ft st-ft-confirm" role="alertdialog" aria-label={`Apagar a carreira do ${c.name} de vez?`}>
          <span>Apagar de vez?</span>
          <span className="st-ft-acts">
            <button type="button" ref={cancelRef} className="st-cancel" onClick={() => setConfirming(false)}>Cancelar</button>
            <button type="button" className="st-del" onClick={() => onDelete(c.seed)}>Apagar</button>
          </span>
        </div>
      ) : (
        <div className="st-ft">
          <span>{ago ? `Jogada ${ago}` : ''}</span>
          <button type="button" className="st-load" onClick={() => onLoad(c.seed)} tabIndex={-1} aria-hidden="true">Carregar →</button>
        </div>
      )}
    </article>
  );
}

export function CareerStartScreen({ careers, activeSeed, onContinue, onNewCareer, onLoad, onDelete, onBack }) {
  const active = careers.find(c => c.seed === activeSeed) || null;
  const others = careers.filter(c => c.seed !== active?.seed);
  const n = careers.length;
  const ago = active ? timeAgo(active.updatedAt) : null;
  const nextDate = active?.next ? (() => { const { month, dayOfMonth } = dayOfYearToMonthDay(active.next.day); return `${dayOfMonth} ${MONTH_SHORT[month]}`; })() : null;

  const NewCard = (
    <section className={`st-new${n === 0 ? ' st-new-solo' : ''}`} aria-labelledby="st-new-h">
      <span className="st-new-ic" aria-hidden="true"><Icon name="star" size={24} /></span>
      <h3 id="st-new-h">Nova carreira</h3>
      <p>{n === 0 ? 'Escolha um clube real e comece sua história no Modo Carreira.' : 'Comece do zero num clube real. As carreiras atuais continuam salvas.'}</p>
      <ul>
        <li>40 clubes da Série A e B de 2026</li>
        <li>Elencos e valores atualizados</li>
        <li>Orçamento inicial do clube ou o seu</li>
      </ul>
      <button type="button" className="st-pri" onClick={onNewCareer}>Escolher clube</button>
    </section>
  );

  return (
    <div className={`st-wrap${active ? ' st-has-active' : ''}`}>
      <button type="button" className="st-back" onClick={onBack}><Icon name="chevronLeft" size={14} />Voltar ao início</button>
      <div className="st-intro">
        <span className="ch-mono">Modo Carreira · {n === 0 ? 'nenhuma carreira salva' : `${n} carreira${n === 1 ? '' : 's'} salva${n === 1 ? '' : 's'}`}</span>
        {n === 0
          ? <h1>Comece sua primeira <em>carreira</em>.</h1>
          : <h1>Bem-vindo de volta, <em>treinador</em>.</h1>}
        <p>{n === 0 ? 'Escolha um clube, monte o elenco e dispute o Brasileirão e a Copa do Brasil.' : 'Continue de onde parou, troque de clube ou comece uma história nova.'}</p>
      </div>

      {n === 0 ? NewCard : (
        <div className="st-top2">
          {active ? (
            <section className="st-act" aria-labelledby="st-act-h">
              <span className="st-ring" aria-hidden="true" /><span className="st-ring st-r2" aria-hidden="true" />
              <span className="ch-mono st-k">Carreira ativa{ago ? ` · salva ${ago}` : ''}</span>
              <div className="st-idn">
                <span className="st-idn-crest"><Crest id={active.clubId} logo={active.logo} name={active.name} color={active.colorP} size={76} /></span>
                <div style={{ minWidth: 0 }}>
                  <h2 id="st-act-h">{active.name}</h2>
                  <div className="st-sub">Temporada {active.season} · {active.dateText} · Série {active.division}</div>
                  <div className="st-tags">
                    <span className={`st-tg${active.zone.tone === 'bad' ? ' st-tg-red' : active.zone.tone === 'ok' ? ' st-tg-ok' : ''}`}>{active.zone.label}</span>
                    {active.copa && <span className="st-tg">{active.copa}</span>}
                  </div>
                </div>
              </div>
              <dl className="st-stats">
                <div><dt>Orçamento</dt><dd>{formatMoneyShort(active.budget)}</dd></div>
                <div><dt>Valor do elenco</dt><dd>{formatMoneyShort(active.squadValue)}</dd></div>
                <div><dt>Temporadas</dt><dd>{active.season}</dd></div>
              </dl>
              {active.next ? (
                <div className="st-next">
                  <Crest id={active.next.oppId} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <small>Próximo jogo · {active.next.comp === 'Brasileirão' ? active.next.detail : `Copa · ${active.next.detail}`} · {nextDate}</small>
                    <b>{nameOf(active.next.homeId)} × {nameOf(active.next.awayId)}</b>
                  </div>
                  {active.form.length > 0 && (
                    <span className="st-form" aria-label={`Últimos ${active.form.length} jogos: ${active.form.join(', ')}`}>
                      {active.form.map((f, i) => <i key={i} className={`st-f${f}`}>{f}</i>)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="st-next"><div><small>Temporada</small><b>Sem jogos pela frente nesta temporada</b></div></div>
              )}
              <div className="st-cta">
                <button type="button" className="st-go" onClick={onContinue}><Icon name="play" size={18} />Continuar carreira</button>
              </div>
            </section>
          ) : <div />}
          {NewCard}
        </div>
      )}

      {others.length > 0 && (
        <section aria-labelledby="st-others-h">
          <div className="st-sh"><h3 id="st-others-h">Outras carreiras</h3><span className="ch-small">Ordenadas pela última vez que você jogou</span></div>
          <div className="st-saves">
            {others.map(c => <OtherCareer key={c.seed} c={c} onLoad={onLoad} onDelete={onDelete} />)}
          </div>
        </section>
      )}
    </div>
  );
}
