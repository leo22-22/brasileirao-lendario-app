// Calendário da temporada — ÚNICA apresentação (referência: Calendário da
// carreira): faixa de rodadas, grade do mês e selo de resultado. Cada modo
// monta as células/rodadas com os próprios dados (carreira: dia do ano;
// liga clássica: datas reais da temporada). Sem datas reais, use só a faixa.
import { Icon } from '../../ui/index.jsx';
import './seasonCalendar.css';

export const COMP_COLORS = { br: '#1F7A4D', cb: '#4E86C2' };
export const WEEKDAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Selo do jogo: resultado (V/E/D + placar), "jogado", "Próximo" ou um rótulo (R12, ida…). */
export function ResultChip({ result, played, next, label }) {
  if (result) {
    const cls = result.res === 'V' ? 'cl-r-v' : result.res === 'D' ? 'cl-r-d' : 'cl-r-e';
    return <span className={`cl-res ${cls}`}>{result.res} {result.gf}–{result.ga}{result.pens ? ' p' : ''}</span>;
  }
  if (played) return <span className="cl-res cl-r-up">jogado</span>;
  if (next) return <span className="cl-res cl-r-nx">Próximo</span>;
  return <span className="cl-res cl-r-up">{label}</span>;
}

/**
 * Faixa de rodadas da temporada. rounds: [{ key, label, res: 'V'|'E'|'D'|null, next, turn, selected, aria, title, onClick }]
 * children: marcadores sob a faixa (opcional).
 */
export function RoundStrip({ rounds, children }) {
  return (
    <div className="cl-strip-inner">
      <div className="cl-rounds" style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr))` }}>
        {rounds.map(r => {
          const cls = r.res ? `cl-rd-${r.res.toLowerCase()}` : r.next ? 'cl-rd-nx' : '';
          return (
            <button key={r.key} type="button" className={`cl-rd ${cls}${r.turn ? ' cl-rd-turn' : ''}${r.selected ? ' cl-rd-sel' : ''}`} onClick={r.onClick} aria-label={r.aria} title={r.title} disabled={r.disabled}>
              {r.label}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}

/**
 * Grade de um mês. cells: [{ key, out, dom, today, selected, win, ev: { color, crest, abbr, side, chip } | null,
 *   aria, onClick, onFocus, tabIndex, doy }]
 */
export function MonthGrid({ title, onPrev, onNext, prevDisabled, nextDisabled, headerExtra, cells, gridRef, onKeyDown, ariaLabel, legend, todayLabel = 'hoje' }) {
  return (
    <>
      <div className="cl-nav2">
        <button type="button" className="cl-arw" onClick={onPrev} disabled={prevDisabled} aria-label="Mês anterior"><Icon name="chevronLeft" size={16} /></button>
        <h3 aria-live="polite">{title}</h3>
        <button type="button" className="cl-arw" onClick={onNext} disabled={nextDisabled} aria-label="Próximo mês"><Icon name="chevronRight" size={16} /></button>
        {headerExtra}
      </div>
      <div className="cl-wd" aria-hidden="true">{WEEKDAYS_SHORT.map(w => <span key={w}>{w}</span>)}</div>
      <div className="cl-grid" ref={gridRef} role="grid" aria-label={ariaLabel} onKeyDown={onKeyDown}>
        {cells.map(c => {
          if (c.out) return <div key={c.key} className="cl-dc cl-out" aria-hidden="true"><span className="cl-dn">{c.dom}</span></div>;
          const cls = ['cl-dc', c.win ? 'cl-win' : '', c.today ? 'cl-td' : '', c.selected ? 'cl-sel' : '', c.ev ? 'cl-has' : ''].filter(Boolean).join(' ');
          return (
            <button key={c.key} type="button" className={cls} data-doy={c.doy} tabIndex={c.tabIndex} aria-label={c.aria} aria-pressed={!!c.selected} onClick={c.onClick} onFocus={c.onFocus}>
              <span className="cl-dn">{c.dom}{c.today && <em> {todayLabel}</em>}</span>
              {c.ev && <i className="cl-comp" style={{ background: c.ev.color }} aria-hidden="true" />}
              {c.ev && (
                <span className="cl-m">
                  <span className="cl-op">{c.ev.crest}{c.ev.abbr} <small>{c.ev.side}</small></span>
                  {c.ev.chip}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {legend && (
        <div className="cl-lg">
          {legend.map(l => <span key={l.label}><i className={l.dot ? 'cl-lg-dot' : undefined} style={l.style} />{l.label}</span>)}
        </div>
      )}
    </>
  );
}
