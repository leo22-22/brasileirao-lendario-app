// Campo da Seleção da Rodada — ÚNICA versão (card da home e WeeklyTeamModal).
// Pílulas com escudo, nome e nota Sofascore (quando houver). O rótulo de cada
// pílula é escolhido pelo espaço que ela tem no card (ResizeObserver no campo,
// não na janela): nome completo → só o sobrenome/apelido → reticências com
// largura máxima. Nunca duas pílulas da mesma altura se encostam.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { displayName } from '../../lib/displayName.js';
import { PitchSurface } from './Pitch.jsx';
import './selectionPitch.css';

export const fmtRating = (n) => Number(n).toFixed(1).replace('.', ',');
const EDGE = 12; // centro de cada pílula entre 12% e 88% da largura
const LATERAL_LIFT = 6.5; // laterais ~13% acima dos zagueiros
const GAP = 8; // folga mínima entre pílulas vizinhas (px)

// lado no campo (visto do gol de baixo): esquerda, centro, direita
const sideOf = (posLabel = '') => (/Esquerd/.test(posLabel) ? 0 : /Direit/.test(posLabel) ? 2 : 1);
const shortName = (name) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
};

/** players: [{ key, name, team, abbr, line, posLabel, craque, rating }]. lineTopPct: { [line]: top% } */
function layout(players, lineTopPct) {
  const byLine = {};
  players.forEach(p => { (byLine[p.line] ||= []).push(p); });
  const out = [];
  Object.entries(byLine).forEach(([line, list]) => {
    const sorted = [...list].sort((a, b) => sideOf(a.posLabel) - sideOf(b.posLabel));
    const n = sorted.length;
    const hasLaterals = sorted.some(p => /^Lateral/.test(p.posLabel || ''));
    // Linha de 4+: os das pontas sobem (laterais) e os de dentro ficam com a
    // largura da linha só pra eles (1/3 e 2/3 com 2 zagueiros).
    const inner = n >= 4 ? sorted.filter((p, i) => !(hasLaterals ? /^Lateral/.test(p.posLabel || '') : (i === 0 || i === n - 1))) : [];
    sorted.forEach((p, i) => {
      const k = inner.indexOf(p);
      const x = n >= 4
        ? (k === -1 ? (i < n / 2 ? EDGE : 100 - EDGE) : ((k + 1) / (inner.length + 1)) * 100)
        : Math.min(100 - EDGE, Math.max(EDGE, ((i + 1) / (n + 1)) * 100));
      let y = lineTopPct[line] ?? 50;
      if (n >= 4) {
        const isLat = hasLaterals ? /^Lateral/.test(p.posLabel || '') : (i === 0 || i === n - 1);
        y += isLat ? -LATERAL_LIFT : LATERAL_LIFT;
      }
      out.push({ ...p, x, y });
    });
  });
  return out;
}

let canvas;
function textWidth(text, font) {
  canvas ||= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  return ctx.measureText(text).width;
}

export function SelectionPitch({ players, lineTopPct, className = '', ariaLabel }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  const [labels, setLabels] = useState({}); // key -> { text, maxW }
  const placed = useMemo(() => layout(players, lineTopPct), [players, lineTopPct]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Escolhe o rótulo de cada pílula pelo espaço disponível.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !width) return;
    const next = {};
    placed.forEach(p => {
      const pill = el.querySelector(`[data-sp="${CSS.escape(p.key)}"]`);
      const nameEl = pill?.querySelector('.fb-sp-n');
      if (!pill || !nameEl) return;
      const font = getComputedStyle(nameEl).font;
      const fixed = pill.offsetWidth - nameEl.offsetWidth;
      const same = placed.filter(o => o !== p && Math.abs(o.y - p.y) < 3);
      const nearest = same.length ? Math.min(...same.map(o => Math.abs(o.x - p.x))) * width / 100 : Infinity;
      const full = displayName(p.name);
      const short = displayName(shortName(p.name));
      // Sozinho na altura dele (ex.: lateral): anda pra dentro só o
      // necessário pra caber, sem passar de 40%/60%.
      let x = p.x;
      if (!same.length && x !== 50) {
        const half = ((fixed + textWidth(full, font)) / 2 + 4) / width * 100;
        x = x < 50 ? Math.max(x, Math.min(half, 40)) : Math.min(x, Math.max(100 - half, 60));
      }
      const edge = 2 * (Math.min(x, 100 - x) * width / 100 - 4);
      const budget = Math.min(nearest - GAP, edge) - fixed;
      if (textWidth(full, font) <= budget) next[p.key] = { text: full, x };
      else if (textWidth(short, font) <= budget) next[p.key] = { text: short, x };
      else next[p.key] = { text: short, x, maxW: Math.max(18, Math.floor(budget)) };
    });
    setLabels(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [width, placed]);

  return (
    <PitchSurface ref={ref} className={`fb-sp ${className}`} role="img" aria-label={ariaLabel}>
      {placed.map(p => {
        const lab = labels[p.key];
        return (
          <div key={p.key} data-sp={p.key} className={`fb-sp-pill${p.craque ? ' fb-sp-gold' : ''}`} style={{ left: `${lab?.x ?? p.x}%`, top: `${p.y}%` }} title={displayName(p.name)}>
            <span className="fb-sp-dot">
              {p.team && CLUB_LOGOS[p.team.club] ? <img src={CLUB_LOGOS[p.team.club]} alt="" /> : p.abbr}
            </span>
            <span className="fb-sp-n" style={lab?.maxW ? { maxWidth: lab.maxW } : undefined}>{lab ? lab.text : displayName(p.name)}</span>
            {p.rating != null && <span className="fb-sp-r">{fmtRating(p.rating)}</span>}
          </div>
        );
      })}
    </PitchSurface>
  );
}

// Faixa dourada do craque da rodada (card da home e modal).
export function CraqueStrip({ craque, as: As = 'div', onClick }) {
  if (!craque) return null;
  return (
    <As type={As === 'button' ? 'button' : undefined} className="fb-sp-craque" onClick={onClick}>
      <span className="fb-sp-cq-ring" aria-hidden="true" />
      <span className="fb-sp-cq-crest">
        {craque.team && CLUB_LOGOS[craque.team.club] ? <img src={CLUB_LOGOS[craque.team.club]} alt="" /> : craque.abbr}
      </span>
      <span className="fb-sp-cq-txt">
        <span className="fb-sp-k">Craque da rodada · Sofascore</span>
        <b>{displayName(craque.name)}</b>
        <small>{[craque.team ? displayName(craque.team.club) : null, craque.posLabel].filter(Boolean).join(' · ')}</small>
      </span>
      <span className="fb-sp-cq-r">
        {craque.rating != null && <b>{fmtRating(craque.rating)}</b>}
        {craque.player?.weeklyBoost && craque.current !== false && <span>+{craque.player.weeklyBoost} OVR</span>}
      </span>
    </As>
  );
}
