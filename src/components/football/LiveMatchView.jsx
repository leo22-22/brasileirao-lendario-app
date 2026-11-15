// Jogo ao vivo — ÚNICA apresentação (referência: aba Partida da liga):
// placar, linha do tempo 0–90' com eventos, controles e lance a lance.
// Só apresentação: cada motor (tradicional, carreira) entrega os eventos
// já revelados, o placar e o minuto; os controles chegam como props.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../ui/index.jsx';
import './liveMatch.css';

// Texto principal / secundário de cada lance (mesmas regras de antes).
export function eventMainText(ev) {
  if (ev.type === 'goal') return `${ev.scorer}${ev.isOwnGoal ? ' (contra)' : ev.isPenalty ? ' (pênalti)' : ''}`;
  if (ev.type === 'substitution') return 'Substituição';
  return ev.player;
}
export function eventSubText(ev) {
  if (ev.type === 'goal') {
    if (ev.isOwnGoal) return `Gol contra${ev.ownGoalTeamLabel ? ` · ${ev.ownGoalTeamLabel}` : ''}`;
    if (ev.isPenalty) return 'Gol de pênalti';
    return ev.assist ? `Gol · assistência de ${ev.assist}` : 'Gol';
  }
  if (ev.type === 'yellow') return 'Cartão amarelo';
  if (ev.type === 'red') return ev.secondYellow ? 'Segundo amarelo, expulso' : 'Cartão vermelho';
  if (ev.type === 'substitution') return `↓ ${ev.playerOut} · ↑ ${ev.playerIn}`;
  if (ev.type === 'penalty_miss') return `Pênalti perdido, defendido por ${ev.gkName || 'goleiro'}`;
  return 'Lesionado, sai de campo';
}

export const MAX_SUBS = 5;
const SUB_REASON_TEXT = { yellow: 'pendurado', tired: 'cansado' };
// Rótulo da troca: 'lesão' (forçada), 'auto' (time da IA) ou nada (manual).
export function subTag(ev) {
  if (ev.reason === 'injury') return 'lesão';
  return ev.auto ? 'auto' : null;
}
export const subsOf = (events, teamId) => events.filter(ev => ev.type === 'substitution' && ev.teamId === teamId);

// "↓ sai · ↑ entra (motivo)" com as cores do mockup.
export function SubLine({ ev }) {
  const why = SUB_REASON_TEXT[ev.reason];
  return (
    <span className="fb-lv-subl">
      <span className="fb-lv-out">↓ {ev.playerOut}</span>
      <span aria-hidden="true"> · </span>
      <span className="fb-lv-in">↑ {ev.playerIn}</span>
      {why && <span className="fb-lv-why"> ({why})</span>}
    </span>
  );
}

// Anota em cada evento o placar daquele momento (homeScore/awayScore), para
// motores que não guardam isso (carreira). Eventos já anotados ficam iguais.
export function withRunningScore(events, homeId) {
  let h = 0, a = 0;
  return events.map(ev => {
    if (ev.homeScore != null && ev.awayScore != null) { h = ev.homeScore; a = ev.awayScore; return ev; }
    if (ev.type === 'goal') { if (ev.teamId === homeId) h++; else a++; }
    return { ...ev, homeScore: h, awayScore: a };
  });
}

function EvIcon({ ev }) {
  if (ev.type === 'goal') return <span className={`fb-lv-ic fb-lv-ic-g${ev.isOwnGoal ? ' fb-lv-ic-og' : ''}`} aria-hidden="true">G</span>;
  if (ev.type === 'yellow') return <span className="fb-lv-ic fb-lv-ic-y" aria-hidden="true" />;
  if (ev.type === 'red') return <span className="fb-lv-ic fb-lv-ic-r" aria-hidden="true" />;
  if (ev.type === 'substitution') return <span className="fb-lv-ic fb-lv-ic-s" aria-hidden="true"><Icon name="swap" size={14} /></span>;
  if (ev.type === 'penalty_miss') return <span className="fb-lv-ic fb-lv-ic-d" aria-hidden="true"><Icon name="close" size={14} /></span>;
  return <span className="fb-lv-ic fb-lv-ic-d" aria-hidden="true"><Icon name="warning" size={14} /></span>;
}

function SubsCounter({ used }) {
  return (
    <span className="fb-lv-subs" aria-label={`Trocas: ${used} de ${MAX_SUBS}`}>
      Trocas {used}/{MAX_SUBS}
      <span className="fb-lv-subs-q" aria-hidden="true">{Array.from({ length: MAX_SUBS }, (_, i) => <i key={i} className={i < used ? 'on' : undefined} />)}</span>
    </span>
  );
}

function Side({ t, onViewTeam, subsUsed }) {
  const clickable = !t.mine && onViewTeam && t.raw;
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag type={clickable ? 'button' : undefined} className={`fb-lv-side${clickable ? ' fb-lv-side-btn' : ''}`} onClick={clickable ? () => onViewTeam(t.raw) : undefined} title={clickable ? 'Ver elenco' : undefined}>
      {t.crest}
      <b className="fb-lv-nm">{t.name}</b>
      {t.sub && <small>{t.sub}</small>}
      {subsUsed != null && <SubsCounter used={subsUsed} />}
    </Tag>
  );
}

export function LiveTimeline({ events, minute, homeId }) {
  const fill = Math.min(100, Math.max(0, (minute / 90) * 100));
  const marks = events.filter(ev => ev.type === 'goal' || ev.type === 'yellow' || ev.type === 'red' || ev.type === 'substitution');
  return (
    <div className="fb-lv-tl" aria-hidden="true">
      <div className="fb-lv-tl-bar">
        <div className="fb-lv-tl-t" />
        <div className="fb-lv-tl-f" style={{ width: `${fill}%` }} />
        <div className="fb-lv-tl-ht" />
        {marks.map((ev, i) => {
          const left = `${Math.min(100, Math.max(0, (ev.minute / 90) * 100))}%`;
          if (ev.type === 'goal') return <span key={i} className={`fb-lv-ev ${ev.teamId === homeId ? 'fb-lv-ev-g' : 'fb-lv-ev-go'}`} style={{ left }}>G</span>;
          if (ev.type === 'substitution') return <span key={i} className="fb-lv-ev fb-lv-ev-s" style={{ left }}><Icon name="swap" size={11} /></span>;
          return <span key={i} className={`fb-lv-ev ${ev.type === 'red' ? 'fb-lv-ev-r' : 'fb-lv-ev-y'}`} style={{ left }} />;
        })}
      </div>
      <div className="fb-lv-tl-l"><span>0'</span><span>intervalo</span><span>90'</span></div>
    </div>
  );
}

// Aviso de troca no topo do placar: cada substituição nova aparece por 4s;
// várias no mesmo minuto entram em fila. Só durante o jogo (pular pro
// resultado não dispara uma enxurrada de avisos).
function useSubToasts(events, status) {
  const subs = events.filter(ev => ev.type === 'substitution');
  const seen = useRef(subs.length);
  const [queue, setQueue] = useState([]);
  const live = status === 'live' || status === 'paused';
  useEffect(() => {
    if (subs.length > seen.current && live) setQueue(q => [...q, ...subs.slice(seen.current)]);
    seen.current = subs.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subs.length]);
  useEffect(() => { if (!live) setQueue([]); }, [live]);
  const current = queue[0] || null;
  useEffect(() => {
    if (!current) return undefined;
    const id = setTimeout(() => setQueue(q => q.slice(1)), 4000);
    return () => clearTimeout(id);
  }, [current]);
  return current;
}

/**
 * Placar ao vivo (card verde).
 * eyebrow: texto; badges: nó (ex.: selo Clássico); status: 'pre'|'live'|'paused'|'done'.
 * home/away: { id, name, crest, sub, mine, raw }. score: { home, away }. minute: número.
 * controls: nó (segmentos/botões). children: conteúdo extra no card (ex.: prévia).
 */
export function LiveScoreboard({ eyebrow, badges, status, home, away, score, minute, events = [], controls, onViewTeam, timeline = true, children, finalLabel = 'Final' }) {
  const live = status === 'live' || status === 'paused';
  const lastGoal = [...events].reverse().find(ev => ev.type === 'goal');
  const lastEv = events[events.length - 1];
  const toast = useSubToasts(events, status);
  const teamName = (id) => (id === home.id ? home.name : away.name);
  const showSubs = status !== 'pre';
  const announce = status === 'done' ? `Fim de jogo: ${home.name} ${score.home} × ${score.away} ${away.name}`
    : lastEv?.type === 'substitution' ? `Substituição no ${teamName(lastEv.teamId)} aos ${lastEv.minute}': sai ${lastEv.playerOut}, entra ${lastEv.playerIn}`
    : lastGoal ? `Gol aos ${lastGoal.minute}': ${lastGoal.scorer}. ${home.name} ${lastGoal.homeScore} × ${lastGoal.awayScore} ${away.name}` : '';
  return (
    <section className="fb-lv" aria-label="Placar">
      <div className="fb-lv-ring" aria-hidden="true" />
      <div className="fb-lv-k">
        <span className="fb-lv-mono">{eyebrow}</span>
        <span className="fb-lv-st">
          {badges}
          {live && <span className={`fb-lv-live${status === 'paused' ? ' fb-lv-paused' : ''}`}><i />{status === 'paused' ? 'Pausado' : 'Ao vivo'}</span>}
          {status === 'done' && <span className="fb-lv-mono">Fim de jogo</span>}
        </span>
      </div>
      {toast && (
        <div className="fb-lv-toast" key={`${toast.teamId}-${toast.minute}-${toast.playerIn}`}>
          <span className="fb-lv-toast-ic" aria-hidden="true"><Icon name="swap" size={14} /></span>
          <b>{teamName(toast.teamId)}</b>
          <span className="fb-lv-out">↓ {toast.playerOut}</span>
          <span className="fb-lv-in">↑ {toast.playerIn}</span>
          <span className="fb-lv-toast-m">{toast.minute}'</span>
        </div>
      )}
      <div className="fb-lv-score">
        <Side t={home} onViewTeam={onViewTeam} subsUsed={showSubs ? subsOf(events, home.id).length : null} />
        <div className="fb-lv-mid">
          {status === 'pre' ? <span className="fb-lv-vs">×</span> : (
            <>
              <div className="fb-lv-nums" aria-live="polite" aria-atomic="true">{score.home}<span>–</span>{score.away}</div>
              <span className="fb-lv-min">{status === 'done' ? finalLabel : `${minute}'`}</span>
            </>
          )}
        </div>
        <Side t={away} onViewTeam={onViewTeam} subsUsed={showSubs ? subsOf(events, away.id).length : null} />
      </div>
      {timeline && status !== 'pre' && <LiveTimeline events={events} minute={status === 'done' ? 90 : minute} homeId={home.id} />}
      {children}
      {controls && <div className="fb-lv-ctrl fb-lv-ctrl-scroll">{controls}</div>}
      <span className="sr-only" aria-live="assertive">{announce}</span>
    </section>
  );
}

// Segmento escuro (Manual/Auto, velocidades) para os controles do placar.
export function LiveSeg({ label, options, value, onChange }) {
  return (
    <div className="fb-lv-seg" role="group" aria-label={label}>
      {options.map(o => <button key={o.id} type="button" aria-pressed={value === o.id} className={value === o.id ? 'fb-lv-seg-on' : undefined} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  );
}

// Botão do placar: tone 'gold' (principal) | 'ghost'. grow ocupa o resto da linha.
export function LiveButton({ tone = 'gold', icon, grow, full, children, ...rest }) {
  return (
    <button type="button" className={`fb-lv-btn ${tone === 'gold' ? 'fb-lv-btn-g' : 'fb-lv-btn-o'}${grow ? ' fb-lv-btn-grow' : ''}${full ? ' fb-lv-btn-full' : ''}`} {...rest}>
      {icon && <Icon name={icon} size={15} />}{children}
    </button>
  );
}

/**
 * Lance a lance (mais recente no topo, separador do intervalo com o placar do 1º tempo).
 * Os eventos já trazem homeScore/awayScore do momento (todos os motores).
 */
export function LiveFeed({ events, homeId, homeName, awayName, minute, status, title = 'Lance a lance' }) {
  const passedHalf = status === 'done' || minute > 45;
  const firstHalf = events.filter(ev => ev.minute <= 45);
  const lastFirst = firstHalf[firstHalf.length - 1];
  const ht = `Intervalo · ${homeName} ${lastFirst ? lastFirst.homeScore : 0} × ${lastFirst ? lastFirst.awayScore : 0} ${awayName}`;
  const rows = [];
  let htPlaced = false;
  [...events].map((ev, i) => ({ ev, i })).reverse().forEach(({ ev, i }) => {
    if (passedHalf && !htPlaced && ev.minute <= 45) { rows.push(<div key="ht" className="fb-lv-fi fb-lv-ht">{ht}</div>); htPlaced = true; }
    const isHome = ev.teamId === homeId;
    const body = (
      <div className={`fb-lv-fi-s${isHome ? '' : ' fb-lv-fi-r'}`}>
        <EvIcon ev={ev} />
        {ev.type === 'substitution' ? (
          <div className="fb-lv-fi-t">
            <b>{eventMainText(ev)}{subTag(ev) && <span className="fb-lv-tag">{subTag(ev)}</span>}</b>
            <small><SubLine ev={ev} /></small>
          </div>
        ) : (
          <div className="fb-lv-fi-t"><b>{eventMainText(ev)}</b><small>{eventSubText(ev)}</small></div>
        )}
      </div>
    );
    rows.push(
      <div key={i} className="fb-lv-fi">
        <div className="fb-lv-fi-c">{isHome && body}</div>
        <div className="fb-lv-fi-m"><b>{ev.minute}'</b>{ev.homeScore}–{ev.awayScore}</div>
        <div className="fb-lv-fi-c">{!isHome && body}</div>
      </div>
    );
  });
  if (passedHalf && !htPlaced) rows.push(<div key="ht" className="fb-lv-fi fb-lv-ht">{ht}</div>);
  return (
    <section className="fb-lv-card">
      <div className="fb-lv-ch"><h3>{title}</h3><span>mais recente no topo</span></div>
      {events.length
        ? <div className="fb-lv-feed">{rows}</div>
        : <div className="fb-lv-empty">{status === 'done' ? 'Jogo sem gols nem cartões.' : 'Nenhum lance ainda.'}</div>}
    </section>
  );
}

/**
 * Card lateral "Substituições": trocas por time (mais recente no topo) e o
 * contador "N de 5". home/away: { id, name, crest }.
 */
export function LiveSubsCard({ events, home, away }) {
  const all = events.filter(ev => ev.type === 'substitution');
  const allAuto = all.length > 0 && all.every(ev => ev.auto);
  const block = (t) => {
    const list = subsOf(events, t.id).slice().reverse();
    return (
      <div className="fb-lv-sc-team" key={t.id}>
        <div className="fb-lv-sc-h">{t.crest}<b>{t.name}</b><span>{list.length} de {MAX_SUBS}</span></div>
        {list.length
          ? list.map((ev, i) => (
            <div className="fb-lv-sc-r" key={i}>
              <span className="fb-lv-sc-m">{ev.minute}'</span>
              <SubLine ev={ev} />
              {ev.reason === 'injury' && <span className="fb-lv-tag">lesão</span>}
            </div>
          ))
          : <div className="fb-lv-sc-r fb-lv-sc-none">Nenhuma troca ainda.</div>}
      </div>
    );
  };
  return (
    <section className="fb-lv-card fb-lv-sc" aria-label="Substituições">
      <div className="fb-lv-ch"><h3>Substituições</h3><span>{allAuto ? 'automáticas' : 'por time'}</span></div>
      {block(home)}
      {block(away)}
    </section>
  );
}
