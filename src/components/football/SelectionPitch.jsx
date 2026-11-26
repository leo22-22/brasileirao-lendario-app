// Campo da Seleção da Rodada — ÚNICA versão (card da home e WeeklyTeamModal).
// Pílulas com escudo, nome e nota Sofascore (quando houver). O rótulo de cada
// pílula é escolhido pelo espaço que ela tem no card (ResizeObserver no campo,
// não na janela). Ordem (pedido do usuário 2026-11-26): nome completo →
// "Primeiro S." → reticências. Se nem assim cabe em linha (linha de 3 ou 4
// jogadores), a pílula vira um cartão vertical — escudo e nota em cima, nome
// embaixo — que ocupa bem menos largura. Nunca duas pílulas da mesma altura
// se encostam.
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
// "Thiago Silva" → "Thiago S."; nome de uma palavra fica como está.
const abbrevName = (name) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
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
    const sample = el.querySelector('.fb-sp-n');
    const ratingEl = el.querySelector('.fb-sp-r');
    if (!sample) return;
    const font = getComputedStyle(sample).font;
    const vFont = font.replace(/\d+(\.\d+)?px/, '11.5px');
    const rFont = ratingEl ? getComputedStyle(ratingEl).font : font;
    const px = (pct) => (pct * width) / 100;
    const next = {};
    // Agrupa por altura (mesma linha visual) pra achar os vizinhos.
    const rows = [];
    [...placed].sort((a, b) => a.y - b.y || a.x - b.x).forEach(p => {
      const row = rows.find(r => Math.abs(r[0].y - p.y) < 3);
      if (row) row.push(p); else rows.push([p]);
    });
    rows.forEach(row => {
      row.sort((a, b) => a.x - b.x);
      row.forEach((p, i) => {
        const left = row[i - 1];
        const right = row[i + 1];
        // Espaço de cada lado: metade da distância até o vizinho, ou até a borda.
        let x = p.x;
        let lSpace = left ? px(x - left.x) / 2 - GAP / 2 : px(x) - 4;
        let rSpace = right ? px(right.x - x) / 2 - GAP / 2 : px(100 - x) - 4;
        // Ponta da linha com espaço sobrando pra dentro: anda pra dentro até
        // equilibrar (mover d desloca o ponto médio com o vizinho em d/2).
        if (!left && right && lSpace < rSpace) {
          const d = Math.min(((rSpace - lSpace) * 2) / 3, px(40 - x));
          if (d > 0) { x += (d / width) * 100; lSpace += d; rSpace -= d / 2; }
        } else if (!right && left && rSpace < lSpace) {
          const d = Math.min(((lSpace - rSpace) * 2) / 3, px(x - 60));
          if (d > 0) { x -= (d / width) * 100; rSpace += d; lSpace -= d / 2; }
        }
        const avail = 2 * Math.min(lSpace, rSpace);
        const ratingW = p.rating != null ? textWidth(fmtRating(p.rating), rFont) + 12 : 0;
        const hFixed = 4 + 24 + 7 + (ratingW ? ratingW + 7 : 0) + 9;
        const vTop = 24 + (ratingW ? ratingW + 5 : 0);
        const full = displayName(p.name);
        const abbr = displayName(abbrevName(p.name));
        const fitsH = (t) => hFixed + textWidth(t, font) <= avail;
        const fitsV = (t) => Math.max(vTop, textWidth(t, vFont)) + 14 <= avail;
        const boxW = (t, v) => (v ? Math.max(vTop, textWidth(t, vFont)) + 14 : hFixed + textWidth(t, font));
        let lab;
        if (fitsH(full)) lab = { text: full, x };
        else if (fitsV(full)) lab = { text: full, x, v: true };
        else if (fitsH(abbr)) lab = { text: abbr, x };
        else if (fitsV(abbr)) lab = { text: abbr, x, v: true };
        else lab = { text: abbr, x, v: true, maxW: Math.max(24, Math.floor(avail - 14)) };
        lab.w = Math.min(boxW(lab.text, lab.v), lab.maxW ? lab.maxW + 14 : Infinity);
        lab.y = p.y;
        next[p.key] = lab;
      });
    });
    // Cartão vertical é mais alto: se encostar numa pílula de outra linha,
    // afasta o cartão na vertical (pra longe dela), no máximo 6%.
    const height = el.getBoundingClientRect().height || width;
    const H = { v: 46, h: 32 };
    const keys = Object.keys(next);
    for (let i = 0; i < keys.length; i++) {
      for (let j = 0; j < keys.length; j++) {
        const a = next[keys[i]]; const b = next[keys[j]];
        if (i === j || !a.v || Math.abs(a.y - b.y) < 3) continue;
        const ax = px(a.x), bx = px(b.x);
        if (Math.abs(ax - bx) >= (a.w + b.w) / 2 + 2) continue;
        const need = (H.v + (b.v ? H.v : H.h)) / 2 + 3;
        const dist = Math.abs(((a.y - b.y) * height) / 100);
        if (dist >= need) continue;
        const shift = Math.min(6, (((need - dist) / height) * 100));
        a.y += a.y < b.y ? -shift : shift;
      }
    }
    setLabels(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [width, placed]);

  return (
    <PitchSurface ref={ref} className={`fb-sp ${className}`} role="img" aria-label={ariaLabel}>
      {placed.map(p => {
        const lab = labels[p.key];
        return (
          <div key={p.key} data-sp={p.key} className={`fb-sp-pill${p.craque ? ' fb-sp-gold' : ''}${lab?.v ? ' fb-sp-v' : ''}`} style={{ left: `${lab?.x ?? p.x}%`, top: `${lab?.y ?? p.y}%` }} title={displayName(p.name)}>
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
