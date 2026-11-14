// Chaveamento de copa — ÚNICA apresentação (referência: Copa do Brasil da
// carreira): chave de dois lados com linhas, "Só meu lado", popover com ida
// e volta e, no celular, abas por fase. Fases 1–4 de ida e volta (16 avos a
// semifinal) e 5 = final. Os dados chegam normalizados por um adaptador de
// cada modo (copaView na carreira, cupRounds na Copa Lendária).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon, Segmented } from '../../ui/index.jsx';
import './cupBracket.css';

export const FINAL_PHASE = 5;
export const BRACKET_PHASE_SHORT = ['Primeira fase', '16 avos', 'Oitavas', 'Quartas', 'Semifinal', 'Final'];

const isMq = (q) => typeof window !== 'undefined' && window.matchMedia?.(q).matches;

/**
 * ties: { [phase]: [tie | null] } — tie: { aId, bId, aggA, aggB, decided, winnerId, onPens, justDecided, landing }
 * nameOf(id), crestOf(id, size). myId: meu time (destaque).
 * myKeys: { mine: Set('fase-idx'), pathK: Set } — meu confronto e meu caminho até a final.
 * mySide: 'left' | 'right' | null. renderPopover(tie, phase, close) → conteúdo do popover.
 * tieAria(tie, phase). finalPlaceholder: nó do bloco da final ainda vazio. nextPathKey: 'fase-idx' do meu próximo jogo.
 * emptyNote: aviso quando a 1ª fase ainda não foi sorteada. legend: nó. title: nó do cabeçalho.
 * initialMobilePhase: fase aberta no celular.
 */
export function CupBracket({ ties, nameOf, crestOf, myId, myKeys = { mine: new Set(), pathK: new Set() }, mySide = null, renderPopover, tieAria = () => undefined, finalPlaceholder, nextPathKey, emptyNote, legend, title = 'Chaveamento', initialMobilePhase = 1, onTieClick }) {
  const [isMobile, setIsMobile] = useState(() => isMq('(max-width: 768px)'));
  const [side, setSide] = useState('all');
  const [pop, setPop] = useState(null);
  const [mobilePhase, setMobilePhase] = useState(Math.max(1, Math.min(FINAL_PHASE, initialMobilePhase)));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width: 768px)');
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  const COLS_LEFT = [1, 2, 3, 4].map(p => ({ phase: p, idxs: Array.from({ length: (16 >> (p - 1)) / 2 }, (_, i) => i) }));
  const COLS_RIGHT = [4, 3, 2, 1].map(p => ({ phase: p, idxs: Array.from({ length: (16 >> (p - 1)) / 2 }, (_, i) => i + (16 >> (p - 1)) / 2) }));
  const cols = [
    ...(side === 'mine' && mySide === 'right' ? [] : COLS_LEFT.map(c => ({ ...c, side: 'left' }))),
    { phase: FINAL_PHASE, idxs: [0], side: 'center' },
    ...(side === 'mine' && mySide === 'left' ? [] : COLS_RIGHT.map(c => ({ ...c, side: 'right' }))),
  ];
  const template = cols.map(c => (c.side === 'center' ? 'minmax(0,1.1fr)' : c.phase === 1 ? 'minmax(0,1.45fr)' : 'minmax(0,0.95fr)')).join(' ');

  const bkRef = useRef(null);
  const scrollRef = useRef(null);
  const [lines, setLines] = useState([]);
  const tiesKey = useMemo(() => JSON.stringify(Object.fromEntries(Object.entries(ties || {}).map(([p, l]) => [p, (l || []).map(t => (t ? `${t.aId}${t.bId}${t.decided ? 1 : 0}` : 0))]))), [ties]);
  useLayoutEffect(() => {
    const box = bkRef.current;
    if (!box || isMobile) return undefined;
    const compute = () => {
      const bb = box.getBoundingClientRect();
      const rect = (k) => box.querySelector(`[data-tie="${k}"]`)?.getBoundingClientRect();
      const out = [];
      for (let q = 2; q <= FINAL_PHASE; q++) {
        const n = 16 >> (q - 1);
        for (let j = 0; j < n; j++) {
          const to = rect(`${q}-${j}`);
          if (!to) continue;
          for (const f of [2 * j, 2 * j + 1]) {
            const from = rect(`${q - 1}-${f}`);
            if (!from) continue;
            const leftSide = from.left < to.left;
            const x1 = (leftSide ? from.right : from.left) - bb.left;
            const y1 = from.top + from.height / 2 - bb.top;
            const x2 = (leftSide ? to.left : to.right) - bb.left;
            const y2 = to.top + to.height / 2 - bb.top;
            const mx = (x1 + x2) / 2;
            const hl = myKeys.pathK.has(`${q}-${j}`) && (myKeys.mine.has(`${q - 1}-${f}`) || myKeys.pathK.has(`${q - 1}-${f}`));
            const lit = !!ties?.[q - 1]?.[f]?.decided;
            out.push({ d: `M${x1},${y1} H${mx} V${y2} H${x2}`, hl, lit });
          }
        }
      }
      setLines(out);
    };
    compute();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(compute) : null;
    ro?.observe(box);
    return () => ro?.disconnect();
  }, [side, isMobile, myKeys, tiesKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth) el.scrollLeft = mySide === 'right' ? el.scrollWidth : 0;
  }, [side, mySide, isMobile]);

  useEffect(() => {
    if (!pop) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setPop(null); };
    const onDoc = (e) => { if (!e.target.closest?.('.cp-pop') && !e.target.closest?.('.cp-tie')) setPop(null); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDoc); };
  }, [pop]);

  const openPop = (e, t, phase, key) => {
    if (!t) return;
    if (onTieClick) onTieClick(t, phase);
    if (!renderPopover) return;
    const box = bkRef.current?.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    if (!box) { setPop({ key, t, phase, x: 0, y: 0 }); return; }
    setPop({ key, t, phase, x: Math.min(r.left - box.left, box.width - 250), y: r.bottom - box.top + 6 });
  };

  const TieBox = (phase, idx) => {
    const t = ties?.[phase]?.[idx] || null;
    const key = `${phase}-${idx}`;
    const mine = myKeys.mine.has(key);
    const inPath = myKeys.pathK.has(key);
    if (phase === FINAL_PHASE && !t) {
      return (
        <div key={key} className={`cp-tie cp-final${inPath ? ' cp-path-k' : ''}`} data-tie={key} aria-label={tieAria(null, phase)} role="img">
          {finalPlaceholder || <><Icon name="trophy" size={20} /><span>Final</span></>}
        </div>
      );
    }
    if (!t) {
      return <div key={key} className={`cp-tie cp-tbd${inPath ? ' cp-path-k' : ''}`} data-tie={key} role="img" aria-label={tieAria(null, phase)}><span>{key === nextPathKey ? 'Seu possível jogo' : 'a definir'}</span></div>;
    }
    const row = (id, goals) => {
      const won = t.decided && t.winnerId === id;
      const lost = t.decided && t.winnerId !== id;
      return (
        <span className={`cp-tm${id === myId ? ' cp-me' : ''}${won ? ' cp-won' : ''}${lost ? ' cp-lost' : ''}`}>
          {crestOf(id, 15)}<span className="cp-tm-n">{nameOf(id)}</span>
          {goals != null && <span className="cp-tm-g">{goals}{won && t.onPens ? '*' : ''}</span>}
        </span>
      );
    };
    return (
      <button
        key={key} type="button"
        className={`cp-tie${mine ? ' cp-mine' : ''}${phase === FINAL_PHASE ? ' cp-final-t' : ''}${pop?.key === key ? ' cp-open' : ''}${t.justDecided ? ' cp-just' : ''}${t.landing ? ' bk-land' : ''}`}
        data-tie={key} aria-label={tieAria(t, phase)} onClick={(e) => openPop(e, t, phase, key)}
      >
        {phase === FINAL_PHASE && <span className="cp-final-h"><Icon name="trophy" size={14} />Final</span>}
        {row(t.aId, t.aggA)}
        {row(t.bId, t.aggB)}
      </button>
    );
  };

  const Popover = () => {
    if (!pop || !renderPopover) return null;
    return (
      <div className="cp-pop" style={{ left: Math.max(0, pop.x), top: pop.y }} role="dialog" aria-label={`Placares: ${nameOf(pop.t.aId)} x ${nameOf(pop.t.bId)}`}>
        <div className="cp-pop-h"><b>{BRACKET_PHASE_SHORT[pop.phase]}</b><button type="button" className="cp-x" onClick={() => setPop(null)} aria-label="Fechar"><Icon name="close" size={14} /></button></div>
        {renderPopover(pop.t, pop.phase)}
      </div>
    );
  };

  return (
    <div className="cp-bkc-inner">
      <div className="cp-bk-top">
        <h3>{title}</h3>
        {!isMobile && (
          <Segmented
            label="Lados da chave"
            value={side}
            onChange={setSide}
            options={[{ id: 'all', label: 'Chave completa' }, { id: 'mine', label: 'Só meu lado', disabled: !mySide, title: mySide ? undefined : 'Disponível depois do sorteio dos 16 avos' }]}
          />
        )}
      </div>
      {emptyNote}
      {isMobile ? (
        <div>
          <div className="cp-mtabs" role="tablist" aria-label="Fase do chaveamento">
            {[1, 2, 3, 4, 5].map(p => <button key={p} type="button" role="tab" aria-selected={mobilePhase === p} className={mobilePhase === p ? 'cp-on' : ''} onClick={() => setMobilePhase(p)}>{BRACKET_PHASE_SHORT[p]}</button>)}
          </div>
          <div className="cp-mlist">{Array.from({ length: 16 >> (mobilePhase - 1) }, (_, i) => TieBox(mobilePhase, i))}</div>
          {pop && <div className="cp-pop-m">{Popover()}</div>}
        </div>
      ) : (
        <div className="cp-bk-scroll" ref={scrollRef}>
          <div className={`cp-bk-inner${side === 'mine' ? ' cp-half' : ''}`} ref={bkRef}>
            <div className="cp-bk-h" style={{ gridTemplateColumns: template }}>
              {cols.map((c, i) => <span key={i} className={c.side === 'center' ? 'cp-fin' : ''}>{BRACKET_PHASE_SHORT[c.phase]}</span>)}
            </div>
            <div className="cp-bk" style={{ gridTemplateColumns: template }}>
              <svg className="cp-lines" aria-hidden="true" focusable="false">
                {lines.map((l, i) => <path key={i} d={l.d} className={l.hl ? 'cp-ln-hl' : l.lit ? 'cp-ln-lit' : ''} />)}
              </svg>
              {cols.map((c, i) => <div key={i} className="cp-col">{c.idxs.map(idx => TieBox(c.phase, idx))}</div>)}
            </div>
            {Popover()}
          </div>
        </div>
      )}
      {legend}
    </div>
  );
}

// Meu confronto e meu caminho até a final, a partir do último confronto conhecido.
export function bracketPathKeys(lastKnown, alive) {
  const mine = new Set();
  const pathK = new Set();
  if (lastKnown && lastKnown.phase >= 1) {
    mine.add(`${lastKnown.phase}-${lastKnown.idx}`);
    if (alive) for (let q = lastKnown.phase + 1; q <= FINAL_PHASE; q++) pathK.add(`${q}-${lastKnown.idx >> (q - lastKnown.phase)}`);
  }
  const mySide = lastKnown && lastKnown.phase >= 1 ? ((lastKnown.idx << (lastKnown.phase - 1)) < 8 ? 'left' : 'right') : null;
  return { myKeys: { mine, pathK }, mySide, nextPathKey: [...pathK][0] };
}
