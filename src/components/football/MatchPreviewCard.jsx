// Prévia de jogo — ÚNICA versão (referência: herói do Simulador 2026):
// card verde com escudos, situação, forma, probabilidades, "o que está em
// jogo" e ações. Só apresentação; os números chegam prontos.
import { FormChips } from './StandingsTable.jsx';
import './matchPreview.css';

const RES = { V: 'vitória', E: 'empate', D: 'derrota' };
const describe = (f) => ({ title: RES[f.res], label: RES[f.res] });
const pct = (x) => Math.round(x * 100);

/**
 * eyebrow / eyebrowRight: textos do topo. home/away: { crest (nó), name, sub, form: ['V','E',...] | null }.
 * probs: { home, draw, away } (0–1) | null. probsLabel: [mandante, visitante] para o texto.
 * stakes: [{ title, text }]. actions: nó. middle: texto abaixo do × (ex.: "casa · fora").
 * center: nó no lugar do × (ex.: data do jogo). onOpen: o confronto vira botão (abre a prévia completa).
 * size: 'lg' (herói) | 'md' (cards menores, modais).
 */
export function MatchPreviewCard({ eyebrow, eyebrowRight, home, away, middle = 'casa · fora', center, onOpen, openTitle, probs, probsNote, stakes = [], actions, size = 'lg', id, className = '', children }) {
  let pH = null, pD = null, pA = null;
  if (probs) {
    pH = pct(probs.home); pD = pct(probs.draw); pA = Math.max(0, 100 - pH - pD);
  }
  const side = (t) => (
    <div className="fb-mp-side">
      {t.crest}
      <b>{t.name}</b>
      {t.sub && <small>{t.sub}</small>}
      {t.form && (t.form.length
        ? <span className="fb-mp-form"><FormChips form={t.form.map(res => ({ res }))} describe={describe} /></span>
        : <span className="fb-mp-noform">sem jogos ainda</span>)}
    </div>
  );
  return (
    <section className={`fb-mp fb-mp-${size}${className ? ` ${className}` : ''}`} aria-labelledby={id}>
      <span className="fb-mp-ring" aria-hidden="true" />
      {(eyebrow || eyebrowRight) && (
        <div className="fb-mp-k">
          {eyebrow && <span className="fb-mp-mono" id={id}>{eyebrow}</span>}
          {eyebrowRight && <span className="fb-mp-mono">{eyebrowRight}</span>}
        </div>
      )}
      {(() => {
        const inner = (
          <>
            {side(home)}
            {center ? <div className="fb-mp-vs fb-mp-center">{center}</div> : <div className="fb-mp-vs" aria-hidden="true">×{middle && <small>{middle}</small>}</div>}
            {side(away)}
          </>
        );
        return onOpen
          ? <button type="button" className="fb-mp-duel fb-mp-duel-btn" onClick={onOpen} title={openTitle}>{inner}</button>
          : <div className="fb-mp-duel">{inner}</div>;
      })()}
      {probs && (
        <>
          <div className="fb-mp-pr"><span>{home.name} {pH}%</span><span>Empate {pD}%</span><span>{away.name} {pA}%</span></div>
          <div className="fb-mp-pb" role="img" aria-label={`Probabilidades: ${home.name} ${pH}%, empate ${pD}%, ${away.name} ${pA}%`}>
            <i style={{ width: `${pH}%`, background: 'var(--gold)' }} /><i style={{ width: `${pD}%`, background: 'rgba(255,255,255,.35)' }} /><i style={{ width: `${pA}%`, background: '#C24747' }} />
          </div>
          {probsNote && <small className="fb-mp-note">{probsNote}</small>}
        </>
      )}
      {stakes.length > 0 && (
        <div className={`fb-mp-stakes${stakes.length === 1 ? ' fb-mp-stakes-1' : ''}`}>
          {stakes.map(s => <div key={s.title} className="fb-mp-stk"><b>{s.title}</b>{s.text}</div>)}
        </div>
      )}
      {children}
      {actions && <div className="fb-mp-acts">{actions}</div>}
    </section>
  );
}

/**
 * Jogos de uma rodada / fase. games: [{ key, home: { name, crest }, away: { name, crest },
 *   score: { h, a } | null, status: 'played'|'now'|'pending', mine, rival }]
 */
export function RoundGames({ games, emptyText = 'Sem jogos.' }) {
  if (!games.length) return <div className="fb-rg-empty">{emptyText}</div>;
  return (
    <div className="fb-rg" role="list">
      {games.map(g => {
        const hw = g.score && g.score.h > g.score.a;
        const aw = g.score && g.score.a > g.score.h;
        return (
          <div key={g.key} role="listitem" className={`fb-rg-gm${g.status === 'now' || g.mine ? ' fb-rg-now' : ''}${g.rival ? ' fb-rg-key' : ''}`}>
            <span className={`fb-rg-h${hw ? ' fb-rg-win' : ''}`}><span className="fb-rg-ell">{g.home.name}</span>{g.home.crest}</span>
            {g.score
              ? <span className="fb-rg-sc">{g.score.h} – {g.score.a}</span>
              : g.status === 'now'
                ? <span className="fb-rg-sc fb-rg-nx">agora</span>
                : <span className="fb-rg-sc fb-rg-pd" aria-label={g.rival ? 'jogo entre rivais diretos' : 'a jogar'}>×</span>}
            <span className={`fb-rg-a${aw ? ' fb-rg-win' : ''}`}>{g.away.crest}<span className="fb-rg-ell">{g.away.name}</span></span>
          </div>
        );
      })}
    </div>
  );
}
