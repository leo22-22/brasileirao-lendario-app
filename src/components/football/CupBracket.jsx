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

// Animação de classificação (por confronto DECIDIDO, nunca na ida):
// 0–450ms o vencedor acende · 450–1150ms o traço percorre o conector até a
// vaga seguinte · 1150–1600ms o time aparece na vaga. Tudo × `k` (1 / velocidade).
const T_LIT = 450;
const T_LINE = 1150;
const T_STEP = 1600;
const STAGGER = 90;
const tieKey = (phase, idx) => `${phase}-${idx}`;
const pathLen = (x1, y1, mx, y2, x2) => Math.abs(mx - x1) + Math.abs(y2 - y1) + Math.abs(x2 - mx);

/**
 * ties: { [phase]: [tie | null] } — tie: { aId, bId, aggA, aggB, decided, winnerId, onPens, justDecided, landing }
 * nameOf(id), crestOf(id, size). myId: meu time (destaque).
 * myKeys: { mine: Set('fase-idx'), pathK: Set } — meu confronto e meu caminho até a final.
 * mySide: 'left' | 'right' | null. renderPopover(tie, phase, close) → conteúdo do popover.
 * tieAria(tie, phase). finalPlaceholder: nó do bloco da final ainda vazio. nextPathKey: 'fase-idx' do meu próximo jogo.
 * emptyNote: aviso quando a 1ª fase ainda não foi sorteada. legend: nó. title: nó do cabeçalho.
 * initialMobilePhase: fase aberta no celular.
 */
export function CupBracket({ ties, nameOf, crestOf, myId, myKeys = { mine: new Set(), pathK: new Set() }, mySide = null, renderPopover, tieAria = () => undefined, finalPlaceholder, nextPathKey, emptyNote, legend, title = 'Chaveamento', initialMobilePhase = 1, onTieClick, animSpeed = 1, instant = false }) {
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

  // ── Animação ─────────────────────────────────────────────
  // shownRef: confrontos decididos que já foram exibidos (só o NOVO anima).
  // Ao montar, tudo que já estava decidido aparece pronto — exceto o que o
  // modo marcou como `justDecided` (fase que acabou de terminar).
  const reduced = isMq('(prefers-reduced-motion: reduce)');
  const k = 1 / Math.max(0.25, animSpeed || 1);
  const shownRef = useRef(null);
  const busyUntilRef = useRef(0);
  const clearRef = useRef(null);
  const [anim, setAnim] = useState({ tie: {}, land: {}, path: {}, k: 1 });
  const decidedNow = () => {
    const m = new Map();
    Object.entries(ties || {}).forEach(([ph, list]) => (list || []).forEach((t, i) => { if (t?.decided && t.winnerId != null) m.set(tieKey(+ph, i), { t, phase: +ph, idx: i }); }));
    return m;
  };
  if (shownRef.current === null) {
    shownRef.current = new Set();
    decidedNow().forEach(({ t }, key) => { if (!t.justDecided) shownRef.current.add(key); });
  }
  // layout effect: as classes de animação entram antes da pintura (sem
  // "piscar" o estado final antes de animar).
  useLayoutEffect(() => {
    const now = decidedNow();
    const fresh = [...now.entries()].filter(([key]) => !shownRef.current.has(key));
    if (!fresh.length) return;
    fresh.forEach(([key]) => shownRef.current.add(key));
    if (instant || reduced) { setAnim({ tie: {}, land: {}, path: {}, k: 1 }); return; }
    // Fase por fase (a seguinte só depois da anterior); dentro da fase, cada
    // lado de cima pra baixo com 90ms; o meu confronto por último.
    const byPhase = {};
    fresh.forEach(([key, v]) => { (byPhase[v.phase] ||= []).push({ key, ...v }); });
    const t0 = performance.now();
    let start = Math.max(0, busyUntilRef.current - t0);
    const next = { tie: {}, land: {}, path: {}, k };
    Object.keys(byPhase).map(Number).sort((a, b) => a - b).forEach(phase => {
      const list = byPhase[phase].sort((a, b) => a.idx - b.idx);
      const half = (16 >> (phase - 1)) / 2;
      const mine = list.filter(x => x.t.aId === myId || x.t.bId === myId);
      const others = list.filter(x => !mine.includes(x));
      let maxD = 0;
      ['L', 'R'].forEach(sd => {
        others.filter(x => (phase === FINAL_PHASE ? sd === 'L' : (sd === 'L' ? x.idx < half : x.idx >= half))).forEach((x, i) => {
          x.d = start + i * STAGGER * k; maxD = Math.max(maxD, x.d);
        });
      });
      mine.forEach(x => { x.d = (others.length ? maxD + STAGGER * k : start); x.mine = true; maxD = Math.max(maxD, x.d); });
      list.forEach(x => {
        const champion = phase === FINAL_PHASE;
        next.tie[x.key] = { d: x.d, mine: !!x.mine, champion, winnerId: x.t.winnerId };
        if (!champion) {
          next.path[x.key] = { d: x.d + T_LIT * k, mine: x.t.winnerId === myId };
          next.land[`${tieKey(phase + 1, x.idx >> 1)}|${x.t.winnerId}`] = { d: x.d + T_LINE * k };
        }
      });
      start = maxD + (T_STEP + (mine.length ? 450 : 0) + (phase === FINAL_PHASE ? 900 : 0)) * k;
    });
    busyUntilRef.current = t0 + start;
    setAnim(prev => ({ tie: { ...prev.tie, ...next.tie }, land: { ...prev.land, ...next.land }, path: { ...prev.path, ...next.path }, k }));
    clearTimeout(clearRef.current);
    clearRef.current = setTimeout(() => setAnim({ tie: {}, land: {}, path: {}, k: 1 }), start + 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ties]);
  // "Parar"/instantâneo: termina tudo na hora (estado final).
  useEffect(() => { if (instant) { clearTimeout(clearRef.current); busyUntilRef.current = 0; setAnim({ tie: {}, land: {}, path: {}, k: 1 }); } }, [instant]);
  useEffect(() => () => clearTimeout(clearRef.current), []);
  const ms = (v) => `${Math.round(v)}ms`;

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
            const fromKey = `${q - 1}-${f}`;
            const hl = myKeys.pathK.has(`${q}-${j}`) && (myKeys.mine.has(fromKey) || myKeys.pathK.has(fromKey));
            const ft = ties?.[q - 1]?.[f];
            const lit = !!ft?.decided;
            out.push({ key: fromKey, d: `M${x1},${y1} H${mx} V${y2} H${x2}`, len: pathLen(x1, y1, mx, y2, x2), hl, lit, mineWin: lit && ft.winnerId === myId });
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
    let t = ties?.[phase]?.[idx] || null;
    const key = `${phase}-${idx}`;
    const mine = myKeys.mine.has(key);
    const inPath = myKeys.pathK.has(key);
    // Vaga ainda sem confronto, mas com classificado(s) já decidido(s) nas
    // fases anteriores: mostra quem já chegou (o resto "a definir").
    if (!t && phase > 1) {
      const fa = ties?.[phase - 1]?.[2 * idx];
      const fb = ties?.[phase - 1]?.[2 * idx + 1];
      const wa = fa?.decided ? fa.winnerId : null;
      const wb = fb?.decided ? fb.winnerId : null;
      if (wa != null || wb != null) t = { aId: wa, bId: wb, aggA: null, aggB: null, decided: false, partial: true };
    }
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
    const ta = anim.tie[key];
    const row = (id, goals) => {
      if (id == null) return <span className="cp-tm cp-tm-tbd"><span className="cp-tm-n">a definir</span></span>;
      const won = t.decided && t.winnerId === id;
      const lost = t.decided && t.winnerId !== id;
      const land = anim.land[`${key}|${id}`];
      const lit = ta && won;
      const style = lit ? { '--d': ms(ta.d), '--dur': ms(T_LIT * anim.k), '--n': ta.champion ? 2 : ta.mine ? 2 : 1 } : land ? { '--d': ms(land.d), '--dur': ms((T_STEP - T_LINE) * anim.k) } : undefined;
      return (
        <span className={`cp-tm${id === myId ? ' cp-me' : ''}${won ? ' cp-won' : ''}${lost ? ' cp-lost' : ''}${lit ? ' cp-win-anim' : ''}${land ? ' cp-land-anim' : ''}`} style={style}>
          {crestOf(id, 15)}<span className="cp-tm-n">{nameOf(id)}</span>
          {goals != null && <span className="cp-tm-g">{goals}{won && t.onPens ? '*' : ''}</span>}
        </span>
      );
    };
    const champ = phase === FINAL_PHASE && t.decided;
    return (
      <button
        key={key} type="button"
        className={`cp-tie${mine ? ' cp-mine' : ''}${phase === FINAL_PHASE ? ' cp-final-t' : ''}${pop?.key === key ? ' cp-open' : ''}${t.partial ? ' cp-partial' : ''}${champ ? ' cp-champ' : ''}${champ && ta ? ' cp-champ-anim' : ''}`}
        style={champ && ta ? { '--d': ms(ta.d), '--dur': ms(T_STEP * anim.k) } : undefined}
        data-tie={key} aria-label={tieAria(t.partial ? null : t, phase)} onClick={(e) => (t.partial ? undefined : openPop(e, t, phase, key))}
      >
        {phase === FINAL_PHASE && <span className="cp-final-h"><Icon name="trophy" size={14} />{champ ? 'Campeão' : 'Final'}</span>}
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
                {lines.map(l => {
                  const a = anim.path[l.key];
                  // percorrida: dourado no meu caminho, neutro escuro nos outros
                  const cls = l.lit && !a ? (l.mineWin ? 'cp-ln-mine' : 'cp-ln-won') : l.hl ? 'cp-ln-hl' : 'cp-ln-pend';
                  return (
                    <g key={l.key}>
                      <path d={l.d} className={a ? 'cp-ln-pend' : cls} />
                      {a && (
                        <>
                          <path
                            d={l.d} className={`cp-ln-anim${a.mine ? ' cp-ln-anim-mine' : ''}`}
                            style={{ strokeDasharray: l.len, strokeDashoffset: l.len, '--len': l.len, '--d': ms(a.d), '--dur': ms((T_LINE - T_LIT) * anim.k), '--d2': ms(a.d + (T_LINE - T_LIT) * anim.k), '--dur2': ms((T_STEP - T_LINE) * anim.k) }}
                          />
                          <circle r="4.5" className="cp-ln-dot" style={{ offsetPath: `path('${l.d}')`, '--d': ms(a.d), '--dur': ms((T_LINE - T_LIT) * anim.k) }} />
                        </>
                      )}
                    </g>
                  );
                })}
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
