// Fim de jogo — ÚNICA versão (simulador-2026-fim-de-jogo-mockup.html): placar
// final com a situação dos times depois do jogo e os autores dos gols, craque
// da partida, impacto na tabela e notas dos dois lados. Usado pelo Simulador
// 2026, pelo Brasileirão clássico e pelo Brasileirão Atual (MatchSummaryModal).
// Só apresentação; partes sem dado ficam escondidas.
import { Modal, Icon } from '../../ui/index.jsx';
import { posSector } from '../../lib/format.js';
import './matchSummary.css';

const fmt1 = (n) => n.toFixed(1).replace('.', ',');
const avg = (list) => (list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : null);

/**
 * eyebrow / eyebrowRight: textos do topo. home/away: { id, name, crest, miniCrest, sub }.
 * score: { home, away }. events: lances (para autores dos gols e números do craque).
 * ratings: [{ name, teamId, pos?, rating }]. impact: [{ key, name, text, tone: 'up'|'down'|null }] | null.
 * secondary: { label, onClick } | null. nextText: texto ao lado. primary: { label, onClick, icon }.
 * onClose: Esc / fechar (padrão = primary.onClick).
 */
export function MatchSummary({ eyebrow = 'Fim de jogo', eyebrowRight, home, away, score, events = [], ratings = [], impact = null, secondary = null, nextText, primary, onClose }) {
  const goals = events.filter(ev => ev.type === 'goal');
  const goalLine = (teamId) => goals.filter(g => g.teamId === teamId).map(g => `${g.scorer}${g.isOwnGoal ? ' (contra)' : g.isPenalty ? ' (pên.)' : ''} ${g.minute}'`).join(', ');
  const homeRatings = ratings.filter(r => r.teamId === home.id).sort((a, b) => b.rating - a.rating);
  const awayRatings = ratings.filter(r => r.teamId === away.id).sort((a, b) => b.rating - a.rating);
  const all = [...ratings].sort((a, b) => b.rating - a.rating);
  const best = all[0] || null;
  const worst = all.length > 1 ? all[all.length - 1] : null;
  const motmTeam = best ? (best.teamId === home.id ? home : away) : null;
  const motmGoals = best ? goals.filter(g => !g.isOwnGoal && g.scorer === best.name && g.teamId === best.teamId).length : 0;
  const motmAssists = best ? goals.filter(g => g.assist === best.name && g.teamId === best.teamId).length : 0;
  const motmBits = best ? [motmTeam?.name, best.pos, motmGoals ? `${motmGoals} gol${motmGoals > 1 ? 's' : ''}` : null, motmAssists ? `${motmAssists} assist.` : null].filter(Boolean).join(' · ') : '';
  const close = onClose || primary?.onClick;

  const col = (team, list) => {
    const m = avg(list);
    return (
      <div className="ms-col">
        <div className="ms-col-h">{team.miniCrest}<span className="ms-ell">{team.name}{m != null ? ` · média ${fmt1(m)}` : ''}</span></div>
        {list.map((r, i) => {
          const isBest = best && r === best;
          const isWorst = worst && r === worst;
          const pct = Math.max(0, Math.min(100, r.rating * 10));
          return (
            <div key={`${r.name}-${i}`} className={`ms-pl${isBest ? ' ms-best' : ''}`} aria-label={`${r.name}${r.pos ? `, ${r.pos}` : ''}, nota ${fmt1(r.rating)}`}>
              {r.pos ? <span className={`ms-pos ms-${posSector(r.pos)}`}>{r.pos}</span> : <span />}
              <span className="ms-nm">{r.name}</span>
              <span className="ms-bar" aria-hidden="true"><i style={{ width: `${pct}%`, background: isBest ? 'var(--success)' : isWorst ? '#E3B3B3' : 'var(--line-strong)' }} /></span>
              <span className={`ms-v${isBest ? ' ms-hi' : isWorst ? ' ms-lo' : ''}`}>{fmt1(r.rating)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Modal onClose={close} maxWidth={860} labelledBy="ms-title" className="ms-modal">
      <div className="ms-head">
        <span className="ms-ring" aria-hidden="true" />
        <div className="ms-k"><span className="ms-mono">{eyebrow}</span>{eyebrowRight && <span className="ms-mono">{eyebrowRight}</span>}</div>
        <div className="ms-score" id="ms-title" aria-label={`Final: ${home.name} ${score.home} × ${score.away} ${away.name}`}>
          <div className="ms-side">{home.crest}<b>{home.name}</b>{home.sub && <small>{home.sub}</small>}</div>
          <div className="ms-mid"><div className="ms-nums">{score.home}<span>–</span>{score.away}</div><span className="ms-ft">Final</span></div>
          <div className="ms-side">{away.crest}<b>{away.name}</b>{away.sub && <small>{away.sub}</small>}</div>
        </div>
        {goals.length > 0 && (
          <div className="ms-goals"><div>{goalLine(home.id)}</div><div /><div>{goalLine(away.id)}</div></div>
        )}
      </div>
      <div className="ms-body">
        <div className="ms-lft">
          {best && (
            <div className="ms-motm">
              <span className="ms-mono">Craque da partida</span>
              <b>{best.name}</b>
              <div className="ms-motm-r"><span>{motmBits}</span><span className="ms-motm-n">{fmt1(best.rating)}</span></div>
            </div>
          )}
          {impact && impact.length > 0 && (
            <div className="ms-imp">
              <h4>Impacto na tabela</h4>
              {impact.map(it => <div key={it.key} className="ms-ir"><b className="ms-ell">{it.name}</b><span className={it.tone === 'up' ? 'ms-up' : it.tone === 'down' ? 'ms-dn' : undefined}>{it.text}</span></div>)}
            </div>
          )}
        </div>
        <div className="ms-rt">
          <h4>Notas dos jogadores</h4>
          {ratings.length ? <div className="ms-cols">{col(home, homeRatings)}{col(away, awayRatings)}</div> : <p className="ms-empty">Sem notas para esta partida.</p>}
        </div>
      </div>
      <div className="ms-foot">
        {secondary && <button type="button" className="ms-btn" onClick={secondary.onClick}>{secondary.label}</button>}
        {nextText && <span className="ms-next">{nextText}</span>}
        {primary && <button type="button" className="ms-btn ms-pri" onClick={primary.onClick} autoFocus>{primary.label}<Icon name={primary.icon || 'chevronRight'} size={16} /></button>}
      </div>
    </Modal>
  );
}
