// "Seu time está pronto" — fase 'squad' do jogo clássico (redesenho de
// 2026-11-13, jogo-capitao-mockup.html). Mesmas props do Squad de App.jsx
// (pitch, captainSlot, trocas via onUnplacePlayer/onClickPitchSlot, arrastar
// via onSlotPointerDown, onRedo, onConfirm) + contexto só de texto (modo,
// passos, dificuldade). Regras intactas: capitão +2 de OVR, trocas validadas
// por movePlayerBetweenSlots no App, capitão obrigatório para começar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseTeamLabel, posSector, posOrderIndex } from '../lib/format.js';
import { displayName } from '../lib/displayName.js';
import { Icon } from '../ui/index.jsx';
import './squadReady.css';

const SECTOR_LABEL = { gk: 'goleiro', df: 'defensor', md: 'meio-campista', at: 'atacante' };
const fmt1 = (x) => x.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ovrTier = (o) => (o >= 85 ? 'sr-o-hi' : o >= 78 ? 'sr-o-md' : 'sr-o-lo');
const lastName = (n) => { const parts = (n || '').trim().split(/\s+/); return parts.length > 1 ? parts[parts.length - 1] : n; };
function originOf(p) {
  if (!p?.teamLabel) return { club: displayName(p?.club || ''), achievement: null };
  const { baseName, achievement } = parseTeamLabel(p.teamLabel);
  return { club: displayName(baseName), achievement };
}
function decadeOf(year) {
  if (!year) return null;
  if (year < 1970) return { key: '60', label: 'Anos 60 e antes', color: '#8C6D3A' };
  if (year < 1980) return { key: '70', label: 'Anos 70', color: '#B08A3E' };
  if (year < 1990) return { key: '80', label: 'Anos 80', color: '#C2513F' };
  if (year < 2000) return { key: '90', label: 'Anos 90', color: '#2F8A5E' };
  if (year < 2010) return { key: '2000', label: 'Anos 2000', color: '#3F74AE' };
  return { key: '2010', label: '2010 em diante', color: '#6B4FA0' };
}

export function SquadReadyScreen({
  pitch, pitchSlots, formationLabel, captainSlot, onSetCaptain, onConfirm, onRedo,
  selectedPlayer, repositioningSlot, eligibleSlotsForPlayer, onClickPitchSlot, onUnplacePlayer,
  confirmLabel = 'Disputar', onSlotPointerDown, dragOverKey,
  modeLabel, steps, difficultyText,
}) {
  const [menu, setMenu] = useState(null); // { key, x, y }
  const [announce, setAnnounce] = useState('');
  const downRef = useRef(null);
  const starterSlots = useMemo(() => pitchSlots.filter(s => !s.isBench).sort((a, b) => posOrderIndex(a.realPos) - posOrderIndex(b.realPos)), [pitchSlots]);
  const benchSlots = pitchSlots.filter(s => s.isBench);
  const starters = starterSlots.map(s => pitch[s.key]).filter(Boolean);
  const n = starters.length;
  const base = n ? starters.reduce((s, p) => s + p.ovr, 0) / n : 0;
  const capOn = !!(captainSlot && pitch[captainSlot] && !pitch[captainSlot].isBench);
  const effective = base + (capOn && n ? 2 / n : 0);
  const capPlayer = capOn ? pitch[captainSlot] : null;
  const repositioning = repositioningSlot !== null && repositioningSlot !== undefined;
  const targets = useMemo(() => new Set(selectedPlayer ? eligibleSlotsForPlayer(selectedPlayer).map(s => s.key) : []), [selectedPlayer, eligibleSlotsForPlayer]);

  // Anúncios: capitão e trocas.
  const prevCap = useRef(captainSlot);
  const prevPitch = useRef(pitch);
  useEffect(() => {
    if (prevCap.current !== captainSlot) {
      setAnnounce(capPlayer ? `${capPlayer.name} agora é o capitão. OVR efetivo ${fmt1(effective)}.` : 'Sem capitão.');
      prevCap.current = captainSlot;
    }
  }, [captainSlot]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (prevPitch.current !== pitch && !repositioning) setAnnounce('Troca feita.');
    prevPitch.current = pitch;
  }, [pitch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (menu) setMenu(null);
      else if (repositioning) { onClickPitchSlot(repositioningSlot); setAnnounce('Troca cancelada.'); }
    };
    const onDoc = (e) => { if (menu && !e.target.closest?.('.sr-menu') && !e.target.closest?.('[data-sr-player]')) setMenu(null); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDoc); };
  }, [menu, repositioning, repositioningSlot, onClickPitchSlot]);

  // Clique num jogador (campo, banco ou lista). Arraste continua via
  // onSlotPointerDown — um clique depois de arrastar é ignorado.
  const onDown = (e) => { downRef.current = { x: e.clientX, y: e.clientY }; };
  const wasDrag = (e) => { const d = downRef.current; downRef.current = null; return d && e.clientX && (Math.abs(e.clientX - d.x) > 5 || Math.abs(e.clientY - d.y) > 5); };
  const activate = (key, e) => {
    // Clique que fecha um arraste: o App marcou "ignore o próximo clique";
    // onClickPitchSlot só consome essa marca (sem seleção ativa, não faz nada).
    if (e && wasDrag(e)) { if (!repositioning) onClickPitchSlot(key); return; }
    const slot = pitchSlots.find(s => s.key === key);
    if (repositioning) {
      if (key === repositioningSlot) { onClickPitchSlot(key); setAnnounce('Troca cancelada.'); return; }
      if (targets.has(key)) { onClickPitchSlot(key); return; }
      setAnnounce('Troca inválida: esse jogador não joga nessa posição.');
      return;
    }
    if (!pitch[key]) return;
    if (slot?.isBench) { setMenu(null); onUnplacePlayer(key); setAnnounce(`Escolha para onde ${pitch[key].name} vai.`); return; }
    const r = e?.currentTarget?.getBoundingClientRect?.();
    setMenu({ key, x: r ? r.left + r.width / 2 : window.innerWidth / 2, y: r ? r.bottom + 6 : window.innerHeight / 2 });
  };
  const makeCaptain = (key) => { onSetCaptain(key); setMenu(null); };
  const startSwap = (key) => { setMenu(null); onUnplacePlayer(key); setAnnounce(`Escolha com quem ${pitch[key].name} troca.`); };

  // Força por setor (titulares, pela vaga ocupada).
  const sectors = ['at', 'md', 'df', 'gk'].map(k => {
    const vals = starterSlots.filter(s => posSector(s.realPos) === k && pitch[s.key]).map(s => pitch[s.key].ovr);
    return { k, label: { at: 'Ataque', md: 'Meio', df: 'Defesa', gk: 'Goleiro' }[k], v: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  });
  const suggestions = [...starterSlots].filter(s => pitch[s.key]).sort((a, b) => pitch[b.key].ovr - pitch[a.key].ovr).slice(0, 4);

  // De onde veio o time.
  const all = Object.values(pitch).filter(Boolean);
  const teamLabels = [...new Set(all.map(p => p.teamLabel).filter(Boolean))];
  const singleOrigin = teamLabels.length === 1 ? teamLabels[0] : null;
  const decades = {};
  all.forEach(p => { const d = decadeOf(p.year); if (d) (decades[d.key] ||= { ...d, count: 0 }).count++; });
  const decadeList = ['60', '70', '80', '90', '2000', '2010'].map(k => decades[k]).filter(Boolean);
  const byClub = {};
  all.forEach(p => { const c = displayName(p.club || originOf(p).club); (byClub[c] ||= []).push(p.name); });
  const clubRank = Object.entries(byClub).sort((a, b) => b[1].length - a[1].length);
  const originSentence = (() => {
    const [top, ...rest] = clubRank;
    if (!top || top[1].length < 2) return 'Cada jogador veio de um clube diferente.';
    let s = `${top[0]} cedeu ${top[1].length} jogadores (${top[1].slice(0, 3).join(', ')}${top[1].length > 3 ? '…' : ''}).`;
    const second = rest.filter(r => r[1].length >= 2 && r[1].length === (rest[0]?.[1].length));
    if (second.length) s += ` ${second.slice(0, 2).map(r => r[0]).join(' e ')}${second.length === 1 ? ` cedeu ${second[0][1].length}` : `, ${second[0][1].length} cada`}.`;
    return s;
  })();
  const elencoCount = new Set(all.map(p => p.teamLabel)).size;

  const playerAria = (p, slot, isCap) => `${p.name}, ${SECTOR_LABEL[posSector(slot.isBench ? p.pos[0] : slot.realPos)]} ${slot.isBench ? `${p.pos[0]} no banco` : slot.realPos}, OVR ${isCap ? p.ovr + 2 : p.ovr}${isCap ? ', capitão' : ''}${repositioning ? (targets.has(slot.key) ? '. Trocar aqui' : slot.key === repositioningSlot ? '. Cancelar troca' : '') : ''}`;

  const confirmDisabled = !capOn || repositioning;
  const confirmReason = repositioning ? 'Termine a troca primeiro' : !capOn ? 'Escolha um capitão para começar' : '';

  const renderRow = (slot) => {
    const p = pitch[slot.key];
    if (!p) return null;
    const isCap = slot.key === captainSlot && !slot.isBench;
    const pos = slot.isBench ? p.pos[0] : slot.realPos;
    const o = originOf(p);
    const sel = slot.key === repositioningSlot;
    return (
      <button key={slot.key} type="button" className={`sr-pr${isCap ? ' sr-cp' : ''}${sel ? ' sr-pr-sel' : ''}${repositioning && targets.has(slot.key) ? ' sr-pr-t' : ''}`} data-sr-player onClick={(e) => activate(slot.key, e)} aria-label={playerAria(p, slot, isCap)}>
        <span className={`sr-pos sr-p-${posSector(pos)}`}>{pos}</span>
        <span className="sr-pr-mid"><b className="sr-ell">{p.name}{isCap && <span className="sr-tgc">C</span>}</b><small className="sr-ell">{[o.club, o.achievement].filter(Boolean).join(' · ')}</small></span>
        <span className={`sr-o ${ovrTier(isCap ? p.ovr + 2 : p.ovr)}`}>{isCap ? p.ovr + 2 : p.ovr}</span>
      </button>
    );
  };

  const menuPlayer = menu ? pitch[menu.key] : null;

  return (
    <div className="sr-wrap">
      <div className="sr-top">
        <div style={{ minWidth: 0 }}>
          <span className="sr-mono">{modeLabel} · {formationLabel} · {singleOrigin ? 'time pronto' : 'draft completo'}</span>
          <h1>Seu time está pronto</h1>
          <p>Escolha o capitão e ajuste as posições antes de entrar no campeonato.</p>
        </div>
        {steps && (
          <ol className="sr-steps" aria-label="Etapas do novo jogo">
            {steps.map((s, i) => (
              <li key={s} className={`sr-sp${i < 2 ? ' sr-dn' : i === 2 ? ' sr-on' : ''}`} aria-current={i === 2 ? 'step' : undefined}>
                {i > 0 && <span className="sr-sline" aria-hidden="true" />}
                <i>{i < 2 ? '✓' : i + 1}</i>{s}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="sr-lay">
        <div className="sr-card sr-pc">
          <div className={`sr-hint${repositioning ? ' sr-hint-sw' : ''}`} aria-live="polite">
            <Icon name="star" size={16} />
            {repositioning
              ? <span>Trocando <b>{selectedPlayer?.name}</b>: toque numa vaga dourada. Toque nele de novo ou Esc para cancelar.</span>
              : <span>Toque num titular e escolha <b>Capitão</b> ou <b>Trocar</b> com outro jogador do campo ou do banco.</span>}
          </div>
          <div className="sr-pitch">
            <svg className="sr-marks" viewBox="0 0 508 620" preserveAspectRatio="none" aria-hidden="true"><rect x="10" y="10" width="488" height="600" rx="4" /><line x1="10" y1="310" x2="498" y2="310" /><circle cx="254" cy="310" r="54" /><rect x="134" y="10" width="240" height="84" /><rect x="134" y="526" width="240" height="84" /></svg>
            {starterSlots.map(slot => {
              const p = pitch[slot.key];
              const isCap = slot.key === captainSlot;
              const isTarget = repositioning && targets.has(slot.key);
              const isSrc = slot.key === repositioningSlot;
              const cls = `sr-sl sr-r-${posSector(slot.realPos)}${p ? '' : ' sr-sl-e'}${isCap && p ? ' sr-sl-cp' : ''}${isTarget ? ' sr-sl-t' : ''}${isSrc ? ' sr-sl-src' : ''}${dragOverKey === slot.key ? ' sr-sl-drop' : ''}`;
              return (
                <button
                  key={slot.key} type="button" className={cls} data-slot-key={slot.key} data-sr-player
                  style={{ left: `${slot.x}%`, top: `${slot.y}%`, touchAction: p ? 'none' : undefined }}
                  onPointerDown={(e) => { onDown(e); if (p && onSlotPointerDown && !repositioning) onSlotPointerDown(slot.key)(e); }}
                  onClick={(e) => activate(slot.key, e)}
                  aria-label={p ? playerAria(p, slot, isCap) : `Vaga de ${slot.realPos}${isTarget ? ', disponível' : ''}`}
                  disabled={!p && !isTarget}
                >
                  <span className="sr-c">{p ? (isCap ? p.ovr + 2 : p.ovr) : slot.realPos}{isCap && p && <i className="sr-cap" aria-hidden="true">C</i>}</span>
                  {p && <span className="sr-n"><span className="sr-n-full">{p.name}</span><span className="sr-n-short">{lastName(p.name)}</span></span>}
                  {p && <span className="sr-ps">{slot.realPos}</span>}
                </button>
              );
            })}
          </div>
          <div className="sr-bench" role="group" aria-label="Banco">
            {benchSlots.map((slot, i) => {
              const p = pitch[slot.key];
              const isTarget = repositioning && targets.has(slot.key);
              return (
                <button
                  key={slot.key} type="button" data-slot-key={slot.key} data-sr-player
                  className={`sr-bs${p ? '' : ' sr-bs-e'}${isTarget ? ' sr-bs-t' : ''}${slot.key === repositioningSlot ? ' sr-bs-src' : ''}${dragOverKey === slot.key ? ' sr-bs-drop' : ''}`}
                  onPointerDown={(e) => { onDown(e); if (p && onSlotPointerDown && !repositioning) onSlotPointerDown(slot.key)(e); }}
                  onClick={(e) => activate(slot.key, e)}
                  disabled={!p && !isTarget}
                  aria-label={p ? playerAria(p, slot, false) : `Banco ${i + 1} vazio${isTarget ? ', disponível' : ''}`}
                  style={{ touchAction: p ? 'none' : undefined }}
                >
                  {p ? <><b>{p.ovr}</b><span className="sr-ell">{p.name}</span><small>{p.pos[0]}</small></> : <small>Banco {i + 1}</small>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sr-rc">
          <div className="sr-card">
            <div className="sr-sum">
              <div><small>OVR base</small><b>{fmt1(base)}</b><span className="sr-small">média dos {n} titulares</span></div>
              <div><small>OVR efetivo</small><b>{fmt1(effective)}</b>{capOn ? <span className="sr-up">+{fmt1(effective - base)} com o capitão</span> : <span className="sr-small">sem capitão</span>}</div>
            </div>
            <div className="sr-secs">
              {sectors.map(s => (
                <div key={s.k} className="sr-s">
                  <small>{s.label} <b>{s.v == null ? '—' : fmt1(s.v)}</b></small>
                  <div className="sr-bar" role="img" aria-label={`${s.label}: ${s.v == null ? 'sem jogadores' : fmt1(s.v)}`}><i className={`sr-bar-${s.k}`} style={{ width: `${Math.max(0, Math.min(100, s.v || 0))}%` }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="sr-card">
            {capPlayer ? (
              <div className="sr-capc">
                <span className="sr-bd" aria-hidden="true">C</span>
                <div style={{ minWidth: 0 }}>
                  <span className="sr-mono">Capitão · +2 de OVR</span>
                  <h4 className="sr-ell">{capPlayer.name}</h4>
                  <small className="sr-ell">{originOf(capPlayer).club} · {pitchSlots.find(s => s.key === captainSlot)?.realPos} · {capPlayer.ovr} → {capPlayer.ovr + 2}</small>
                </div>
                <button type="button" className="sr-chg" onClick={() => onSetCaptain(null)}>Trocar</button>
              </div>
            ) : (
              <div className="sr-capc sr-capc-empty">
                <span className="sr-bd sr-bd-e" aria-hidden="true">C</span>
                <div><span className="sr-mono">Capitão obrigatório</span><h4>Escolha um capitão para ganhar +2 de OVR</h4><small>Toque num titular ou numa sugestão abaixo.</small></div>
              </div>
            )}
            <div className="sr-sug">
              <span className="sr-small">Sugestões:</span>
              {suggestions.map(s => (
                <button key={s.key} type="button" className={`sr-chip${s.key === captainSlot ? ' sr-on' : ''}`} aria-pressed={s.key === captainSlot} onClick={() => onSetCaptain(s.key)}>{pitch[s.key].name} {pitch[s.key].ovr}</button>
              ))}
            </div>
          </div>

          <div className="sr-card">
            <div className="sr-ch"><h3>De onde veio o seu time</h3><span className="sr-small">{singleOrigin ? 'time pronto' : `${all.length} jogadores de ${elencoCount} elencos`}</span></div>
            {singleOrigin ? (
              <div className="sr-orig"><p className="sr-small" style={{ margin: 0 }}>Elenco completo do {displayName(parseTeamLabel(singleOrigin).baseName)}{parseTeamLabel(singleOrigin).achievement ? ` (${parseTeamLabel(singleOrigin).achievement})` : ''}.</p></div>
            ) : (
              <div className="sr-orig">
                <div className="sr-eras" role="img" aria-label={decadeList.map(d => `${d.label}: ${d.count}`).join(', ')}>
                  {decadeList.map(d => <span key={d.key} style={{ width: `${(d.count / all.length) * 100}%`, background: d.color }}>{d.count / all.length > 0.09 ? d.key : ''}</span>)}
                </div>
                <div className="sr-ol">{decadeList.map(d => <span key={d.key}><i style={{ background: d.color }} />{d.label} · {d.count}</span>)}</div>
                <p className="sr-small" style={{ margin: '10px 0 0' }}>{originSentence}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sr-list">
        <div className="sr-card">
          <div className="sr-ch"><h3>Titulares</h3><span className="sr-small">{n} · OVR {fmt1(base)}</span></div>
          {starterSlots.map(renderRow)}
        </div>
        <div className="sr-card">
          <div className="sr-ch"><h3>Banco</h3><span className="sr-small">{benchSlots.filter(s => pitch[s.key]).length} de {benchSlots.length}</span></div>
          {benchSlots.map(renderRow)}
        </div>
      </div>

      <div className="sr-sticky">
        <div className="sr-in">
          <span className="sr-small">OVR efetivo</span><b>{fmt1(effective)}</b>
          <span className="sr-small sr-meta">· Capitão: {capPlayer ? capPlayer.name : 'nenhum'}{difficultyText ? ` · ${difficultyText}` : ''}</span>
          {onRedo && <button type="button" className="sr-btn" style={{ marginLeft: 'auto' }} onClick={onRedo}>Trocar formação</button>}
          <button type="button" className="sr-btn sr-pri" style={onRedo ? undefined : { marginLeft: 'auto' }} onClick={onConfirm} disabled={confirmDisabled} title={confirmReason || undefined}>
            {repositioning ? 'Termine a troca' : !capOn ? 'Escolha um capitão' : <>{confirmLabel}<Icon name="chevronRight" size={16} /></>}
          </button>
        </div>
      </div>

      {menu && menuPlayer && (
        <div className="sr-menu" role="menu" aria-label={`Ações para ${menuPlayer.name}`} style={{ left: menu.x, top: menu.y }}>
          <div className="sr-menu-h"><b className="sr-ell">{menuPlayer.name}</b><small>OVR {menuPlayer.ovr}</small></div>
          <button type="button" role="menuitem" autoFocus onClick={() => makeCaptain(menu.key)} disabled={menu.key === captainSlot}><span className="sr-cap-i">C</span>{menu.key === captainSlot ? 'Já é o capitão' : 'Tornar capitão'}</button>
          <button type="button" role="menuitem" onClick={() => startSwap(menu.key)}><Icon name="swap" size={15} />Trocar</button>
        </div>
      )}
      <div className="sr-only" aria-live="polite">{announce}</div>
    </div>
  );
}
