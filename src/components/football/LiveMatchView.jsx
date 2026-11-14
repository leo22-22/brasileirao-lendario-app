// Jogo ao vivo — ÚNICA apresentação (referência: aba Partida da liga):
// placar, linha do tempo 0–90' com eventos, controles e lance a lance.
// Só apresentação: cada motor (tradicional, carreira) entrega os eventos
// já revelados, o placar e o minuto; os controles chegam como props.
import { Icon } from '../../ui/index.jsx';
import './liveMatch.css';

// Texto principal / secundário de cada lance (mesmas regras de antes).
export function eventMainText(ev) {
  if (ev.type === 'goal') return `${ev.scorer}${ev.isOwnGoal ? ' (contra)' : ev.isPenalty ? ' (pênalti)' : ''}`;
  if (ev.type === 'substitution') return `Entra ${ev.playerIn}`;
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
  if (ev.type === 'substitution') return `Sai ${ev.playerOut}`;
  if (ev.type === 'penalty_miss') return `Pênalti perdido, defendido por ${ev.gkName || 'goleiro'}`;
  return 'Lesionado, sai de campo';
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
  if (ev.type === 'substitution') return <span className="fb-lv-ic fb-lv-ic-n" aria-hidden="true"><Icon name="swap" size={14} /></span>;
  if (ev.type === 'penalty_miss') return <span className="fb-lv-ic fb-lv-ic-d" aria-hidden="true"><Icon name="close" size={14} /></span>;
  return <span className="fb-lv-ic fb-lv-ic-d" aria-hidden="true"><Icon name="warning" size={14} /></span>;
}

function Side({ t, onViewTeam }) {
  const clickable = !t.mine && onViewTeam && t.raw;
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag type={clickable ? 'button' : undefined} className={`fb-lv-side${clickable ? ' fb-lv-side-btn' : ''}`} onClick={clickable ? () => onViewTeam(t.raw) : undefined} title={clickable ? 'Ver elenco' : undefined}>
      {t.crest}
      <b className="fb-lv-nm">{t.name}</b>
      {t.sub && <small>{t.sub}</small>}
    </Tag>
  );
}

export function LiveTimeline({ events, minute, homeId }) {
  const fill = Math.min(100, Math.max(0, (minute / 90) * 100));
  const marks = events.filter(ev => ev.type === 'goal' || ev.type === 'yellow' || ev.type === 'red');
  return (
    <div className="fb-lv-tl" aria-hidden="true">
      <div className="fb-lv-tl-bar">
        <div className="fb-lv-tl-t" />
        <div className="fb-lv-tl-f" style={{ width: `${fill}%` }} />
        <div className="fb-lv-tl-ht" />
        {marks.map((ev, i) => {
          const left = `${Math.min(100, Math.max(0, (ev.minute / 90) * 100))}%`;
          if (ev.type === 'goal') return <span key={i} className={`fb-lv-ev ${ev.teamId === homeId ? 'fb-lv-ev-g' : 'fb-lv-ev-go'}`} style={{ left }}>G</span>;
          return <span key={i} className={`fb-lv-ev ${ev.type === 'red' ? 'fb-lv-ev-r' : 'fb-lv-ev-y'}`} style={{ left }} />;
        })}
      </div>
      <div className="fb-lv-tl-l"><span>0'</span><span>intervalo</span><span>90'</span></div>
    </div>
  );
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
      <div className="fb-lv-score">
        <Side t={home} onViewTeam={onViewTeam} />
        <div className="fb-lv-mid">
          {status === 'pre' ? <span className="fb-lv-vs">×</span> : (
            <>
              <div className="fb-lv-nums" aria-live="polite" aria-atomic="true">{score.home}<span>–</span>{score.away}</div>
              <span className="fb-lv-min">{status === 'done' ? finalLabel : `${minute}'`}</span>
            </>
          )}
        </div>
        <Side t={away} onViewTeam={onViewTeam} />
      </div>
      {timeline && status !== 'pre' && <LiveTimeline events={events} minute={status === 'done' ? 90 : minute} homeId={home.id} />}
      {children}
      {controls && <div className="fb-lv-ctrl fb-lv-ctrl-scroll">{controls}</div>}
      <span className="sr-only" aria-live="assertive">
        {status === 'done' ? `Fim de jogo: ${home.name} ${score.home} × ${score.away} ${away.name}` : lastGoal ? `Gol aos ${lastGoal.minute}': ${lastGoal.scorer}. ${home.name} ${lastGoal.homeScore} × ${lastGoal.awayScore} ${away.name}` : ''}
      </span>
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
        <div className="fb-lv-fi-t"><b>{eventMainText(ev)}</b><small>{eventSubText(ev)}</small></div>
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
