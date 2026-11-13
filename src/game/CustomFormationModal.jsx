// Editor de formação livre (redesenho de 2026-11-13,
// jogo-formacao-livre-mockup.html). Substitui o CustomFormationBuilder de
// App.jsx com as MESMAS props (myTeamColor, onBack, onChoose(slots, counts,
// shape)). Todas as regras continuam em App.jsx e são só lidas daqui:
// classificação por banda/faixa (classifyCustomSlots), ciclo de posições ao
// tocar (POS_CYCLE/CYCLE_TARGET_XY), validação e leitura tática.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildPitchSlots, classifyCustomSlots, customFormationShape, describeCustomFormation,
  validateCustomFormation, formationDefMidFwd, POS_CYCLE, CYCLE_TARGET_XY, WIDE_X_THRESHOLD, CUSTOM_BANDS, FORMATIONS,
} from '../App.jsx';
import { posSector } from '../lib/format.js';
import { Icon } from '../ui/index.jsx';
import './customFormation.css';

const PRESETS = ['4-3-3', '4-4-2', '3-5-2', '5-3-2', '4-2-3-1'];
const START_KEY = '4-3-3-misto';

function dotsFromFormation(key) {
  return buildPitchSlots(key).filter(s => s.realPos !== 'GOL' && !s.isBench).map((s, i) => ({ id: i, x: s.x, y: s.y }));
}
// Primeira formação de FORMATIONS cujo rótulo começa com o esquema pedido.
function presetKey(shape) {
  return Object.keys(FORMATIONS).find(k => FORMATIONS[k].label.split(' ')[0] === shape) || null;
}


export function CustomFormationModal({ onBack, onChoose }) {
  // Fronteiras entre setores: as bandas são "a mais próxima por altura", então
  // o limite fica no meio do caminho entre zaga e volante (defesa × meio) e
  // entre armação e ataque (meio × ataque). Calculado aqui dentro (não no topo
  // do módulo) porque CUSTOM_BANDS vem de App.jsx, que importa este arquivo.
  const band = (k) => CUSTOM_BANDS.find(b => b.key === k)?.y;
  const DEF_LINE = (band('zaga') + band('volante')) / 2;
  const ATT_LINE = (band('armacao') + band('ataque')) / 2;
  const fieldRef = useRef(null);
  const drag = useRef({ id: null });
  const [dots, setDots] = useState(() => dotsFromFormation(START_KEY));
  const [history, setHistory] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [announce, setAnnounce] = useState('');

  const { slots, counts } = useMemo(() => classifyCustomSlots(dots), [dots]);
  const shape = useMemo(() => customFormationShape(counts), [counts]);
  const description = useMemo(() => describeCustomFormation(counts), [counts]);
  const errors = useMemo(() => validateCustomFormation(counts), [counts]);
  const lines = formationDefMidFwd(counts);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { if (confirmReset) setConfirmReset(false); else onBack(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, confirmReset]);

  const commit = (next, msg) => { setHistory(h => [...h.slice(-49), dots]); setDots(next); if (msg) setAnnounce(msg); };
  const undo = () => {
    if (!history.length) return;
    setDots(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setAnnounce('Última mudança desfeita');
  };
  const mirror = () => commit(dots.map(d => ({ ...d, x: 100 - d.x })), 'Formação espelhada');
  const reset = () => { commit(dotsFromFormation(START_KEY), 'Formação voltou para o 4-3-3'); setConfirmReset(false); };
  const applyPreset = (s) => { const k = presetKey(s); if (k) commit(dotsFromFormation(k), `Começando do ${s}`); };

  const cycle = (id) => {
    const current = slots.find(s => s.id === id);
    const nextPos = current && POS_CYCLE[current.realPos];
    const target = nextPos && CYCLE_TARGET_XY[nextPos];
    if (target) commit(dots.map(d => (d.id === id ? { ...d, x: target.x, y: target.y } : d)), `Virou ${nextPos}`);
  };

  // Arraste (mouse e toque) — mesma regra de antes: só conta como arraste
  // depois de 5px; soltar sem arrastar troca o tipo de posição.
  const onDown = (id) => (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const d = dots.find(x => x.id === id);
    drag.current = { id, startX: e.clientX, startY: e.clientY, moved: false, before: dots };
    setOrigin({ x: d.x, y: d.y });
  };
  const onMove = (e) => {
    const st = drag.current;
    if (st.id == null || !fieldRef.current) return;
    if (!st.moved && (Math.abs(e.clientX - st.startX) > 5 || Math.abs(e.clientY - st.startY) > 5)) { st.moved = true; setDragId(st.id); }
    if (!st.moved) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(4, Math.min(96, ((e.clientY - rect.top) / rect.height) * 100));
    setDots(prev => prev.map(d => (d.id === st.id ? { ...d, x, y } : d)));
  };
  const onUp = () => {
    const st = drag.current;
    if (st.id != null) {
      if (st.moved) setHistory(h => [...h.slice(-49), st.before]);
      else cycle(st.id);
    }
    drag.current = { id: null };
    setDragId(null);
    setOrigin(null);
  };
  // Teclado: setas movem 3%, Enter/Espaço troca o tipo.
  const onKey = (id) => (e) => {
    const step = { ArrowLeft: [-3, 0], ArrowRight: [3, 0], ArrowUp: [0, -3], ArrowDown: [0, 3] }[e.key];
    if (step) {
      e.preventDefault();
      commit(dots.map(d => (d.id === id ? { ...d, x: Math.max(4, Math.min(96, d.x + step[0])), y: Math.max(4, Math.min(96, d.y + step[1])) } : d)));
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycle(id); }
  };

  // Leitura tática curta para a tag (primeira frase de describeCustomFormation).
  const firstSentence = description.split('.')[0];
  const tag = /^cuidado/i.test(firstSentence) ? { text: 'Atenção', tone: 'warn' } : /^esquema equilibrado/i.test(firstSentence) ? { text: 'Equilibrado', tone: 'ok' } : { text: firstSentence.split(',')[0], tone: 'hot' };
  const vol = counts.VOL || 0;
  const checks = [
    { ok: true, text: '11 jogadores com 1 goleiro' },
    counts.LD && counts.LE
      ? { ok: true, text: 'Laterais cobrindo os dois lados' }
      : { ok: false, text: !counts.LD && !counts.LE ? 'Sem laterais nos dois lados' : `Sem lateral ${counts.LD ? 'esquerdo' : 'direito'}` },
    ...(vol < 2 ? [{ ok: false, text: vol === 0 ? 'Nenhum volante protegendo a defesa' : 'Só 1 volante protegendo a defesa' }] : []),
  ];

  return (
    <div className="cf2-overlay" onClick={onBack} role="presentation">
      <div className="cf2-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cf2-h">
        <button type="button" className="cf2-x" onClick={onBack} aria-label="Fechar"><Icon name="close" size={16} /></button>
        <div className="cf2-lft">
          <div className="cf2-tools">
            <button type="button" className="cf2-tb" onClick={undo} disabled={!history.length}><Icon name="arrowLeft" size={14} />Desfazer</button>
            <button type="button" className="cf2-tb" onClick={mirror}>Espelhar</button>
            {confirmReset ? (
              <span className="cf2-confirm" role="alertdialog" aria-label="Resetar a formação?">
                <span>Voltar ao 4-3-3?</span>
                <button type="button" className="cf2-tb" onClick={() => setConfirmReset(false)} autoFocus>Não</button>
                <button type="button" className="cf2-tb cf2-danger-f" onClick={reset}>Resetar</button>
              </span>
            ) : (
              <button type="button" className="cf2-tb cf2-danger" style={{ marginLeft: 'auto' }} onClick={() => setConfirmReset(true)}>Resetar</button>
            )}
          </div>
          <div className="cf2-pitch" ref={fieldRef}>
            <div className="cf2-lane" style={{ width: `${WIDE_X_THRESHOLD}%` }} aria-hidden="true"><span>Lateral · ponta</span></div>
            <div className="cf2-lane cf2-lane-r" style={{ width: `${WIDE_X_THRESHOLD}%` }} aria-hidden="true"><span>Lateral · ponta</span></div>
            <svg className="cf2-marks" viewBox="0 0 476 640" preserveAspectRatio="none" aria-hidden="true"><rect x="10" y="10" width="456" height="620" rx="4" /><line x1="10" y1="320" x2="466" y2="320" /><circle cx="238" cy="320" r="52" /><rect x="128" y="10" width="220" height="86" /><rect x="128" y="544" width="220" height="86" /></svg>
            <div className="cf2-zl" style={{ top: `${ATT_LINE}%` }} aria-hidden="true"><span className="cf2-zl-up">Ataque</span><span>Meio</span></div>
            <div className="cf2-zl" style={{ top: `${DEF_LINE}%` }} aria-hidden="true"><span>Defesa</span></div>
            <div className="cf2-dt cf2-gk cf2-fixed" style={{ left: '50%', top: '92%' }} aria-label="Goleiro, fixo">GOL</div>
            {origin && dragId != null && <div className="cf2-ghost" style={{ left: `${origin.x}%`, top: `${origin.y}%` }} aria-hidden="true" />}
            {slots.map(s => (
              <button
                key={s.id} type="button"
                className={`cf2-dt cf2-${posSector(s.realPos)}${dragId === s.id ? ' cf2-drag' : ''}`}
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                onPointerDown={onDown(s.id)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                onKeyDown={onKey(s.id)}
                aria-label={`${s.realPos}. Arraste ou use as setas para mover; Enter troca o tipo de posição`}
              >{s.realPos}</button>
            ))}
          </div>
        </div>

        <div className="cf2-rt">
          <span className="cf2-mono">Formação livre</span>
          <h2 id="cf2-h">Monte seu esquema</h2>
          <ol className="cf2-steps">
            <li><i>1</i><span><b>Arraste</b> cada jogador pelo campo. A altura define o setor: defesa, meio ou ataque.</span></li>
            <li><i>2</i><span>Nas <b>faixas laterais</b> ele vira lateral ou ponta; no centro, zagueiro, volante, meia ou atacante.</span></li>
            <li><i>3</i><span><b>Toque</b> sem arrastar para trocar o tipo de posição (ex.: VOL → MC → MEI).</span></li>
          </ol>
          <div className="cf2-res" aria-live="polite">
            <div className="cf2-res-h">
              <div><span className="cf2-mono">Esquema detectado</span><div className="cf2-big">{shape}</div></div>
              <span className={`cf2-tag cf2-tag-${tag.tone}`}>{tag.text}</span>
            </div>
            {description.replace(/\.$/, '') !== tag.text && <p className="cf2-desc">{description}</p>}
            <div className="cf2-secs">
              {[['gk', 'GOL', 1], ['df', 'Def', lines.def], ['md', 'Meio', lines.mid], ['at', 'Ata', lines.fwd]].map(([k, l, v]) => <div key={k}><small><i className={`cf2-dot-${k}`} />{l}</small><b>{v}</b></div>)}
            </div>
            <ul className="cf2-chk">
              {checks.map(c => <li key={c.text}><i className={c.ok ? '' : 'cf2-w'}>{c.ok ? '✓' : '!'}</i>{c.text}</li>)}
              {errors.map(e => <li key={e} className="cf2-err"><i className="cf2-e">×</i>{e}</li>)}
            </ul>
          </div>
          <div className="cf2-pre">
            <span className="cf2-mono">Começar a partir de</span>
            <div className="cf2-row">{PRESETS.filter(presetKey).map(p => <button key={p} type="button" className="cf2-chip" onClick={() => applyPreset(p)}>{p}</button>)}</div>
          </div>
          <div className="cf2-foot">
            <button type="button" className="cf2-btn" onClick={onBack}>Cancelar</button>
            <button type="button" className="cf2-btn cf2-pri" disabled={errors.length > 0} title={errors[0]} onClick={() => errors.length === 0 && onChoose(slots, counts, shape)}>
              {errors.length ? 'Ajuste o esquema para continuar' : <>Usar esta formação<Icon name="chevronRight" size={16} /></>}
            </button>
          </div>
        </div>
        <div className="sr-only" aria-live="polite">{announce}</div>
      </div>
    </div>
  );
}
