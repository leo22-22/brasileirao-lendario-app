// Aba Partida da liga clássica — liga-partida-mockup.html. Só apresentação:
// recebe o estado do jogo pronto do App.jsx (eventos já revelados pelo
// tick, placar, minuto, resultados da rodada) e devolve as ações pelos
// mesmos handlers. Nada aqui simula ou decide resultado.
import { Icon } from '../../ui/index.jsx';
import { ClubCrest } from '../../components/football/ClubCrest.jsx';
import './matchTab.css';

const FORM_CLASS = { V: 'lg-fv', E: 'lg-fe', D: 'lg-fd' };
const pct = (x) => `${Math.round(x * 100)}%`;

// Texto principal / secundário de cada lance (mesmas regras do placar antigo).
export function eventMainText(ev) {
  if (ev.type === 'goal') return `${ev.scorer}${ev.isOwnGoal ? ' (contra)' : ev.isPenalty ? ' (pênalti)' : ''}`;
  if (ev.type === 'substitution') return `Entra ${ev.playerIn}`;
  return ev.player;
}
export function eventSubText(ev) {
  if (ev.type === 'goal') {
    if (ev.isOwnGoal) return `Gol contra · ${ev.ownGoalTeamLabel}`;
    if (ev.isPenalty) return 'Gol de pênalti';
    return ev.assist ? `Gol · assistência de ${ev.assist}` : 'Gol';
  }
  if (ev.type === 'yellow') return 'Cartão amarelo';
  if (ev.type === 'red') return ev.secondYellow ? 'Segundo amarelo, expulso' : 'Cartão vermelho';
  if (ev.type === 'substitution') return `Sai ${ev.playerOut}`;
  if (ev.type === 'penalty_miss') return `Pênalti perdido, defendido por ${ev.gkName || 'goleiro'}`;
  return 'Lesionado, sai de campo';
}

function EvIcon({ ev }) {
  if (ev.type === 'goal') return <span className={`lg-fi-ic lg-ic-g${ev.isOwnGoal ? ' lg-ic-og' : ''}`} aria-hidden="true">G</span>;
  if (ev.type === 'yellow') return <span className="lg-fi-ic lg-ic-y" aria-hidden="true" />;
  if (ev.type === 'red') return <span className="lg-fi-ic lg-ic-r" aria-hidden="true" />;
  if (ev.type === 'substitution') return <span className="lg-fi-ic lg-ic-n" aria-hidden="true"><Icon name="swap" size={14} /></span>;
  if (ev.type === 'penalty_miss') return <span className="lg-fi-ic lg-ic-d" aria-hidden="true"><Icon name="close" size={14} /></span>;
  return <span className="lg-fi-ic lg-ic-d" aria-hidden="true"><Icon name="warning" size={14} /></span>;
}

function FormDots({ form }) {
  if (!form?.length) return <span className="lg-form-empty">sem jogos</span>;
  return (
    <span className="lg-form" aria-label={`Últimos jogos: ${form.join(' ')}`}>
      {form.map((r, i) => <i key={i} className={FORM_CLASS[r]}>{r}</i>)}
    </span>
  );
}

function Side({ t, onViewTeam, big }) {
  const clickable = !t.mine && onViewTeam;
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag type={clickable ? 'button' : undefined} className={`lg-side${clickable ? ' lg-side-btn' : ''}`} onClick={clickable ? () => onViewTeam(t.raw) : undefined} title={clickable ? 'Ver elenco' : undefined}>
      <ClubCrest logo={t.logo} badge={t.badge} name={t.label} color={t.color} size={big ? 72 : 64} frame scale={0.68} frameClass={`fb-crest-frame lg-crest-big${t.mine ? ' lg-crest-mine' : ''}`} />
      <b className="lg-side-nm">{t.label}</b>
      <small>{t.sub}</small>
    </Tag>
  );
}

function Timeline({ events, minute, homeId }) {
  const fill = Math.min(100, Math.max(0, (minute / 90) * 100));
  const marks = events.filter(ev => ev.type === 'goal' || ev.type === 'yellow' || ev.type === 'red');
  return (
    <div className="lg-tl" aria-hidden="true">
      <div className="lg-tl-bar">
        <div className="lg-tl-t" />
        <div className="lg-tl-f" style={{ width: `${fill}%` }} />
        <div className="lg-tl-ht" />
        {marks.map((ev, i) => {
          const left = `${Math.min(100, Math.max(0, (ev.minute / 90) * 100))}%`;
          if (ev.type === 'goal') return <span key={i} className={`lg-ev ${ev.teamId === homeId ? 'lg-ev-g' : 'lg-ev-go'}`} style={{ left }}>G</span>;
          return <span key={i} className={`lg-ev ${ev.type === 'red' ? 'lg-ev-r' : 'lg-ev-y'}`} style={{ left }} />;
        })}
      </div>
      <div className="lg-tl-l"><span>0'</span><span>intervalo</span><span>90'</span></div>
    </div>
  );
}

// Feed: mais recente no topo, separador do intervalo com o placar do 1º tempo.
function Feed({ events, homeId, home, away, minute, status }) {
  if (!events.length) {
    return <div className="lg-empty">{status === 'done' ? 'Jogo sem gols nem cartões.' : status === 'pre' ? 'Os lances aparecem aqui, minuto a minuto.' : 'Nenhum lance ainda.'}</div>;
  }
  const passedHalf = status === 'done' || minute > 45;
  const firstHalf = events.filter(ev => ev.minute <= 45);
  const lastFirst = firstHalf[firstHalf.length - 1];
  const htHome = lastFirst ? lastFirst.homeScore : 0;
  const htAway = lastFirst ? lastFirst.awayScore : 0;
  const rows = [];
  let htPlaced = false;
  [...events].map((ev, i) => ({ ev, i })).reverse().forEach(({ ev, i }) => {
    if (passedHalf && !htPlaced && ev.minute <= 45) {
      rows.push(<div key="ht" className="lg-fi lg-fi-ht">Intervalo · {home.label} {htHome} × {htAway} {away.label}</div>);
      htPlaced = true;
    }
    const isHome = ev.teamId === homeId;
    const body = (
      <div className={`lg-fi-s${isHome ? '' : ' lg-fi-r'}`}>
        <EvIcon ev={ev} />
        <div className="lg-fi-t"><b>{eventMainText(ev)}</b><small>{eventSubText(ev)}</small></div>
      </div>
    );
    rows.push(
      <div key={i} className="lg-fi">
        <div className="lg-fi-c">{isHome && body}</div>
        <div className="lg-fi-m"><b>{ev.minute}'</b>{ev.homeScore}–{ev.awayScore}</div>
        <div className="lg-fi-c">{!isHome && body}</div>
      </div>
    );
  });
  if (passedHalf && !htPlaced) rows.push(<div key="ht" className="lg-fi lg-fi-ht">Intervalo · {home.label} {htHome} × {htAway} {away.label}</div>);
  return <div className="lg-feed">{rows}</div>;
}

/**
 * status: 'pre' | 'live' | 'paused' | 'done'
 * home/away: { id, label, logo, badge, color, mine, sub, form, raw }
 * otherGames: [{ key, home, away, score: { h, a } | null }] (home/away: { label, logo, color })
 * liveTable: { rows: [{ row, pos, move, zone, label, logo, color } | { gap, key }], myId, title, note }
 */
export function MatchTab({
  roundNumber, venueText, isClassic, home, away, status, score, minute, events = [], probs,
  simMode, onSetSimMode, simSpeed, onSetSpeed, onPause, onResume, onStart, startLabel, autoCountdown, onSimulateAll, onViewTeam,
  subPanel, children, otherGames = [], otherNote, liveTable, onOpenTable,
}) {
  const live = status === 'live' || status === 'paused';
  const lastGoal = [...events].reverse().find(ev => ev.type === 'goal');
  return (
    <div className="lg-lay">
      <div className="lg-lc">
        <section className="lg-sb" aria-label="Placar">
          <div className="lg-ring" aria-hidden="true" />
          <div className="lg-sb-k">
            <span className="lg-mono-l">Rodada {roundNumber}{venueText ? ` · ${venueText}` : ''}</span>
            <span className="lg-sb-st">
              {isClassic && <span className="lg-classic">Clássico</span>}
              {live && <span className={`lg-livepill${status === 'paused' ? ' lg-paused' : ''}`}><i />{status === 'paused' ? 'Pausado' : 'Ao vivo'}</span>}
              {status === 'done' && <span className="lg-mono-l">Fim de jogo</span>}
            </span>
          </div>
          <div className="lg-score">
            <Side t={home} onViewTeam={onViewTeam} />
            <div className="lg-score-mid">
              {status === 'pre' ? (
                <span className="lg-vs">×</span>
              ) : (
                <>
                  <div className="lg-nums" aria-live="polite" aria-atomic="true">{score.home}<span>–</span>{score.away}</div>
                  <span className="lg-min">{status === 'done' ? 'Final' : `${minute}'`}</span>
                </>
              )}
            </div>
            <Side t={away} onViewTeam={onViewTeam} />
          </div>

          {status === 'pre' ? (
            <>
              <div className="lg-forms">
                <FormDots form={home.form} />
                <span className="lg-mono-l">últimos 5</span>
                <FormDots form={away.form} />
              </div>
              {probs && (
                <div className="lg-prob">
                  <div className="lg-prob-l"><span>{home.label.split(' (')[0]} {pct(probs.homeWin)}</span><span>Empate {pct(probs.draw)}</span><span>{away.label.split(' (')[0]} {pct(probs.awayWin)}</span></div>
                  <div className="lg-prob-bar" aria-hidden="true">
                    <i style={{ width: pct(probs.homeWin), background: 'var(--gold)' }} />
                    <i style={{ width: pct(probs.draw), background: 'rgba(255,255,255,.35)' }} />
                    <i style={{ width: pct(probs.awayWin), background: 'rgba(255,255,255,.7)' }} />
                  </div>
                  <small>Pela força dos elencos, antes da forma recente.</small>
                </div>
              )}
              <div className="lg-ctrl">
                <div className="lg-seg" role="group" aria-label="Modo de avanço">
                  {['manual', 'auto'].map(m => <button key={m} type="button" aria-pressed={simMode === m} className={simMode === m ? 'lg-seg-on' : undefined} onClick={() => onSetSimMode(m)}>{m === 'manual' ? 'Manual' : 'Auto'}</button>)}
                </div>
                {simMode !== 'auto' && <button type="button" className="lg-cb lg-cb-g lg-cb-grow" onClick={onStart}><Icon name="play" size={15} />{startLabel}</button>}
                {simMode === 'auto' && autoCountdown !== null && <span className="lg-cd" role="status">Começa em <b>{autoCountdown}s</b></span>}
              </div>
              {onSimulateAll && (
                <button type="button" className="lg-cb lg-cb-o lg-cb-full" onClick={onSimulateAll} title="Avança todas as rodadas restantes, inclusive as suas, sem parar para jogar cada uma">
                  <Icon name="forward" size={15} />Simulação direta — ir até o fim
                </button>
              )}
            </>
          ) : (
            <>
              <Timeline events={events} minute={status === 'done' ? 90 : minute} homeId={home.id} />
              <div className="lg-ctrl lg-ctrl-scroll">
                <div className="lg-seg" role="group" aria-label="Modo de avanço">
                  {['manual', 'auto'].map(m => <button key={m} type="button" aria-pressed={simMode === m} className={simMode === m ? 'lg-seg-on' : undefined} onClick={() => onSetSimMode(m)}>{m === 'manual' ? 'Manual' : 'Auto'}</button>)}
                </div>
                {live && (
                  <div className="lg-seg" role="group" aria-label="Velocidade">
                    {[1, 1.5, 2].map(sp => <button key={sp} type="button" aria-pressed={simSpeed === sp} className={simSpeed === sp ? 'lg-seg-on' : undefined} onClick={() => onSetSpeed(sp)}>{String(sp).replace('.', ',')}x</button>)}
                  </div>
                )}
                {status === 'live' && <button type="button" className="lg-cb lg-cb-g" onClick={onPause}><Icon name="clock" size={15} />Pausar</button>}
                {status === 'paused' && <button type="button" className="lg-cb lg-cb-g" onClick={onResume}><Icon name="play" size={15} />Continuar</button>}
              </div>
            </>
          )}
          <span className="sr-only" aria-live="assertive">
            {status === 'done' ? `Fim de jogo: ${home.label} ${score.home} × ${score.away} ${away.label}` : lastGoal ? `Gol aos ${lastGoal.minute}': ${lastGoal.scorer}. ${home.label} ${lastGoal.homeScore} × ${lastGoal.awayScore} ${away.label}` : ''}
          </span>
        </section>

        {subPanel}

        {status !== 'pre' && (
          <section className="lg-card">
            <div className="lg-ch"><h3>Lance a lance</h3><span className="lg-small">mais recente no topo</span></div>
            <Feed events={events} homeId={home.id} home={home} away={away} minute={minute} status={status} />
          </section>
        )}

        {children}
      </div>

      <div className="lg-side-col">
        {otherGames.length > 0 && (
          <section className="lg-card">
            <div className="lg-ch"><h3>Outros jogos</h3><span className="lg-small">{otherNote}</span></div>
            {otherGames.map(g => {
              const hw = g.score && g.score.h > g.score.a;
              const aw = g.score && g.score.a > g.score.h;
              return (
                <div key={g.key} className="lg-gm">
                  <span className={`lg-gm-h${hw ? ' lg-win' : ''}`}><span className="lg-ell">{g.home.label}</span><ClubCrest logo={g.home.logo} badge={g.home.badge} name={g.home.label} color={g.home.color} size={18} /></span>
                  <span className="lg-gm-sc">{g.score ? `${g.score.h} – ${g.score.a}` : '×'}</span>
                  <span className={`lg-gm-a${aw ? ' lg-win' : ''}`}><ClubCrest logo={g.away.logo} badge={g.away.badge} name={g.away.label} color={g.away.color} size={18} /><span className="lg-ell">{g.away.label}</span></span>
                </div>
              );
            })}
          </section>
        )}

        {liveTable && (
          <section className="lg-card">
            <div className="lg-ch"><h3>{liveTable.title}</h3>{onOpenTable && <button type="button" className="lg-link" onClick={onOpenTable}>Completa</button>}</div>
            <table className="lg-mt">
              <caption className="sr-only">{liveTable.title}</caption>
              <thead><tr><th scope="col">#</th><th scope="col"><span className="sr-only">Movimento</span></th><th scope="col" className="lg-mt-cl">Clube</th><th scope="col">J</th><th scope="col" className="lg-mt-p">Pts</th></tr></thead>
              <tbody>
                {liveTable.rows.map(r => r.gap ? (
                  <tr key={r.key} className="lg-mt-gap"><td colSpan={5}>…</td></tr>
                ) : (
                  <tr key={r.row.id} className={r.row.id === liveTable.myId ? 'lg-mt-me' : undefined} style={{ '--zone': r.zone?.color || 'transparent' }}>
                    <td className="lg-mt-ps">{r.pos}</td>
                    <td className="lg-mt-mv">{r.move > 0 ? <span className="lg-up" aria-label={`subiu ${r.move}`}>▲{r.move}</span> : r.move < 0 ? <span className="lg-dn" aria-label={`caiu ${-r.move}`}>▼{-r.move}</span> : <span className="lg-eq" aria-label="manteve">–</span>}</td>
                    <th scope="row" className="lg-mt-cl"><span className="lg-ell">{r.label}</span></th>
                    <td className="lg-mt-n">{r.row.pj}</td>
                    <td className="lg-mt-p">{r.row.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {liveTable.note && <div className="lg-note">{liveTable.note}</div>}
          </section>
        )}
      </div>
    </div>
  );
}
