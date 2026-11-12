// Formação do Modo Carreira — redesenho de 2026-11-13 seguindo o mockup
// modo-carreira-formacao-mockup.html (campo à esquerda, painel à direita).
//
// A lógica é a mesma de antes (ver histórico): esquema + 11 titulares por
// vaga + banco de até 12 + capitão (+2 OVR) + cobrador de pênalti, presets
// em save.savedFormations, suspenso não entra nem no banco, e o payload de
// onConfirm não mudou. O que mudou foi a apresentação e os itens novos:
// resumo por setor, comparação com o próximo adversário, alertas com ação
// de 1 clique, "Poupar pendurados", "Preencher banco" e a lista "Fora da
// lista". Clicar numa vaga agora SELECIONA a vaga e abre a lista de
// jogadores (antes, clicar numa vaga ocupada tirava o jogador direto) —
// "Tirar da vaga" virou um botão dentro dessa lista.
import { useEffect, useMemo, useRef, useState } from 'react';
import { posColor, posOrderIndex, posSector } from '../../lib/format.js';
import { FORMATIONS, buildPitchSlots, autoFillFromPool } from '../engine/formations.js';
import { teamForSim } from '../engine/simHelpers.js';
import { upcomingFixtures, dayParts } from '../engine/careerMeta.js';
import { matchOutcomeProbabilities } from '../../App.jsx';
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { displayName } from '../../lib/displayName.js';
import { Icon, TeamBadge, Modal } from '../../ui/index.jsx';
import '../components/careerShell.css';
import './careerFormation.css';

const DEFAULT_FORMATION = '4-3-3-misto';
const BENCH_MAX = 12;
const YELLOWS_FOR_SUSPENSION = 3; // mesmo valor de seasonEngine.js

const SECTOR_RING = { gk: '#C29A45', df: '#4E86C2', md: '#3FA372', at: '#D2604F' };
const SECTOR_LABEL = { at: 'Ataque', md: 'Meio-campo', df: 'Defesa', gk: 'Goleiro' };
const SECTOR_FILTERS = [
  { id: 'all', label: 'Todos' }, { id: 'gk', label: 'Goleiros' }, { id: 'df', label: 'Defesa' }, { id: 'md', label: 'Meio' }, { id: 'at', label: 'Ataque' },
];

const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
const clubOf = (id) => TEAMS.find(t => t.id === id);

// Reconstrói o titular de cada vaga ao abrir a tela. Se o esquema salvo
// bate com o atual, reaproveita a vaga EXATA de cada titular — mesma
// ordem slots[i] <-> save.myStarters[i] que handleConfirm usa pra
// gravar — em vez de reembaralhar tudo via autoFillFromPool. Só cai pro
// preenchimento automático pras vagas que sobrarem vazias (esquema mudou,
// ou o titular daquela vaga não existe mais no elenco).
function initialStarters(roster, save, slots, formationKey) {
  const rosterNames = new Set(roster.map(p => p.name));
  const starters = {};
  const usedNames = new Set();
  if (save.myFormationKey === formationKey && save.myStarters?.length === slots.length) {
    slots.forEach((slot, i) => {
      const name = save.myStarters[i];
      if (name && rosterNames.has(name) && !usedNames.has(name)) {
        starters[slot.key] = name;
        usedNames.add(name);
      }
    });
  }
  const emptySlots = slots.filter(s => !starters[s.key]);
  if (emptySlots.length > 0) {
    const preferred = (save.myStarters || [])
      .filter(n => rosterNames.has(n) && !usedNames.has(n))
      .map(n => roster.find(p => p.name === n))
      .filter(Boolean);
    const rest = [...roster].filter(p => !usedNames.has(p.name) && !preferred.some(q => q.name === p.name)).sort((a, b) => b.ovr - a.ovr);
    Object.assign(starters, autoFillFromPool([...preferred, ...rest], emptySlots));
  }
  return starters;
}

// Reconstrói a seleção de banco (até 12) ao abrir a tela — reaproveita
// `save.myBench` filtrando quem já saiu do elenco ou virou titular.
function initialBench(roster, save, starterNames) {
  const rosterNames = new Set(roster.map(p => p.name));
  const starterSet = new Set(starterNames);
  return (save.myBench || []).filter(n => rosterNames.has(n) && !starterSet.has(n)).slice(0, BENCH_MAX);
}

// ── Campo ──────────────────────────────────────────────────────────────
function PitchSlot({ slot, player, selected, suspended, hanging, isCap, isPen, onClick }) {
  const sector = posSector(slot.realPos);
  const outOfPos = player && !player.pos.includes(slot.realPos);
  const label = player
    ? `${slot.realPos}: ${player.name}, OVR ${player.ovr}${isCap ? ', capitão' : ''}${isPen ? ', cobrador de pênalti' : ''}${suspended ? ', suspenso' : hanging ? ', pendurado' : ''}${outOfPos ? ', fora de posição' : ''}`
    : `${slot.realPos}: vaga vazia — escolher jogador`;
  return (
    <button
      type="button"
      className={`cf-pl${selected ? ' cf-sel' : ''}${player ? '' : ' cf-empty'}`}
      style={{ left: `${slot.x}%`, top: `${slot.y}%`, '--ring': SECTOR_RING[sector] }}
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      title={label}
    >
      <span className="cf-c" style={suspended ? { borderColor: 'var(--danger)' } : undefined}>
        {player ? player.ovr : slot.label}
        {isCap && <i className="cf-bdg cf-cap" aria-hidden="true">C</i>}
        {isPen && <i className="cf-bdg cf-pen" aria-hidden="true">P</i>}
        {(suspended || hanging || outOfPos) && <i className={`cf-bdg cf-warn${suspended ? ' cf-red' : ''}`} aria-hidden="true">!</i>}
      </span>
      {player && <span className="cf-n" style={suspended ? { background: 'rgba(178,59,59,.85)' } : undefined}>{player.name}</span>}
      <span className="cf-p">{slot.realPos}{suspended ? ' · suspenso' : hanging ? ' · pendurado' : outOfPos ? ' · improvisado' : ''}</span>
    </button>
  );
}

function PitchField({ slots, starters, byName, selectedSlot, suspendedSet, hangingSet, captain, penalty, onSlotClick }) {
  return (
    <div className="cf-pitch on-dark">
      <svg className="cf-lines" viewBox="0 0 528 720" preserveAspectRatio="none" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" aria-hidden="true">
        <rect x="14" y="14" width="500" height="692" rx="4" /><line x1="14" y1="360" x2="514" y2="360" /><circle cx="264" cy="360" r="62" />
        <rect x="144" y="14" width="240" height="96" /><rect x="204" y="14" width="120" height="38" />
        <rect x="144" y="610" width="240" height="96" /><rect x="204" y="668" width="120" height="38" />
      </svg>
      {slots.map(slot => {
        const name = starters[slot.key];
        const p = name ? byName[name] : null;
        return (
          <PitchSlot
            key={slot.key}
            slot={slot}
            player={p}
            selected={selectedSlot === slot.key}
            suspended={!!name && suspendedSet.has(name)}
            hanging={!!name && hangingSet.has(name)}
            isCap={!!name && captain === name}
            isPen={!!name && penalty === name}
            onClick={() => onSlotClick(slot.key)}
          />
        );
      })}
    </div>
  );
}

// ── Lista de jogadores pra uma vaga (drawer ao lado do campo) ─────────
// Mesma regra de antes: filtra pela posição clicada (qualquer posição de
// p.pos qualifica) e mostra os compatíveis primeiro; suspenso não entra.
function PlayerPoolPicker({ slot, occupant, pool, benchSet, suspendedSet, hangingSet, onPick, onRemove, onCancel }) {
  const pos = slot.realPos;
  const compatible = pool.filter(p => p.pos.includes(pos)).sort((a, b) => b.ovr - a.ovr);
  const others = pool.filter(p => !p.pos.includes(pos)).sort((a, b) => b.ovr - a.ovr);
  const row = (p, ok) => {
    const susp = suspendedSet.has(p.name);
    return (
      <button
        key={p.name}
        type="button"
        className="cf-pick"
        onClick={() => !susp && onPick(p.name)}
        disabled={susp}
        aria-label={`${p.pos[0]}: ${p.name}, OVR ${p.ovr}${susp ? ', suspenso' : ''}`}
      >
        <span className="cf-o">{p.ovr}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <b className="cf-ell">{p.name}</b>
          <small>{p.pos.join(' / ')}{benchSet.has(p.name) ? ' · no banco' : ''}{!ok ? ' · improvisado' : ''}</small>
        </span>
        {susp && <span className="ch-tag ch-t-danger">Suspenso</span>}
        {!susp && hangingSet.has(p.name) && <span className="ch-tag ch-t-warning">Pendurado</span>}
      </button>
    );
  };
  return (
    <div className="cf-picker" role="dialog" aria-label={`Escolher jogador para ${pos}`}>
      <div className="ch-row" style={{ padding: '16px 18px 10px' }}>
        <div>
          <span className="ch-mono">Vaga selecionada</span>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 20, margin: '4px 0 0' }}>Quem joga de {pos}?</h3>
        </div>
        <button type="button" className="ui-modal-close" style={{ position: 'static' }} onClick={onCancel} aria-label="Fechar seleção"><Icon name="close" size={18} /></button>
      </div>
      {occupant && (
        <div className="cf-occupant">
          <span>Na vaga: <b>{occupant.name}</b> ({occupant.ovr})</span>
          <button type="button" className="ch-link" style={{ color: 'var(--danger)' }} onClick={onRemove}>Tirar da vaga</button>
        </div>
      )}
      <div className="cf-pick-list">
        {compatible.length > 0 && <div className="cf-pick-h">Jogam de {pos}</div>}
        {compatible.map(p => row(p, true))}
        {others.length > 0 && <div className="cf-pick-h">Outras posições</div>}
        {others.map(p => row(p, false))}
        {pool.length === 0 && <p className="ch-small" style={{ padding: '8px 18px' }}>Todo mundo já está escalado em outra vaga.</p>}
      </div>
    </div>
  );
}

// ── Presets (mesmo comportamento do SavePresetPanel/LoadPresetPanel) ──
function SavePresetPanel({ onSave, onCancel }) {
  const [name, setName] = useState('');
  return (
    <Modal onClose={onCancel} maxWidth={420} labelledBy="cf-save-title">
      <h3 id="cf-save-title" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 22, margin: '0 0 6px' }}>Salvar como preset</h3>
      <p className="ch-small" style={{ margin: '0 0 14px' }}>Guarda o esquema, os titulares e o banco atuais da tela.</p>
      <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }}>
        <input
          className="ui-input"
          value={name}
          autoFocus
          onChange={e => setName(e.target.value.slice(0, 40))}
          placeholder="Nome (ex.: Time reserva)"
          aria-label="Nome do preset"
          style={{ marginBottom: 14 }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-md" onClick={onCancel}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn-dark ui-btn-md" disabled={!name.trim()}>Salvar</button>
        </div>
      </form>
    </Modal>
  );
}

function LoadPresetPanel({ presets, avgOf, onLoad, onDelete, onRename, onCancel }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  return (
    <Modal onClose={onCancel} maxWidth={520} labelledBy="cf-load-title">
      <h3 id="cf-load-title" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 22, margin: '0 0 6px' }}>Presets de formação</h3>
      <p className="ch-small" style={{ margin: '0 0 14px' }}>Carregar troca a tela; ainda é preciso confirmar a escalação.</p>
      {presets.length === 0 && <p className="ch-small">Nenhum preset salvo ainda — use "Salvar como preset".</p>}
      <div style={{ display: 'grid', gap: 8 }}>
        {presets.map(preset => (
          <div key={preset.id} className="cf-preset-row">
            <span className="cf-k">{(FORMATIONS[preset.formationKey]?.label || preset.formationKey).split(' ')[0].split('-').slice(0, 2).join('-')}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editing === preset.id ? (
                <form onSubmit={e => { e.preventDefault(); if (draft.trim()) { onRename(preset.id, draft.trim()); setEditing(null); } }} style={{ display: 'flex', gap: 6 }}>
                  <input className="ui-input" style={{ minHeight: 36 }} value={draft} autoFocus onChange={e => setDraft(e.target.value.slice(0, 40))} aria-label="Novo nome" />
                  <button type="submit" className="ui-btn ui-btn-dark ui-btn-sm">OK</button>
                </form>
              ) : (
                <>
                  <b className="cf-ell" style={{ display: 'block' }}>{preset.name}</b>
                  <small className="ch-small">{FORMATIONS[preset.formationKey]?.label || preset.formationKey} · {fmt1(avgOf(preset.starters))}</small>
                </>
              )}
            </div>
            {editing !== preset.id && (
              <>
                <button type="button" className="ch-link" onClick={() => onLoad(preset)}>Carregar</button>
                <button type="button" className="ui-hbtn ui-hbtn-icon" title="Renomear" aria-label={`Renomear ${preset.name}`} onClick={() => { setEditing(preset.id); setDraft(preset.name); }}><Icon name="edit" size={15} /></button>
                <button type="button" className="ui-hbtn ui-hbtn-icon" style={{ color: 'var(--danger)' }} title="Apagar" aria-label={`Apagar ${preset.name}`} onClick={() => onDelete(preset.id)}><Icon name="close" size={15} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

// Lista de titulares pra escolher capitão / cobrador ("Trocar").
function RolePicker({ title, starters, current, onPick, onClose }) {
  return (
    <Modal onClose={onClose} maxWidth={420} labelledBy="cf-role-title">
      <h3 id="cf-role-title" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 22, margin: '0 0 12px' }}>{title}</h3>
      <div style={{ display: 'grid', gap: 6, maxHeight: '60vh', overflowY: 'auto' }}>
        {starters.map(p => (
          <button key={p.name} type="button" className="cf-pick" aria-pressed={current === p.name} onClick={() => { onPick(p.name); onClose(); }} style={current === p.name ? { borderColor: 'var(--gold)', background: 'var(--gold-tint)' } : undefined}>
            <span className="cf-o">{p.ovr}</span>
            <span style={{ flex: 1, minWidth: 0 }}><b className="cf-ell">{p.name}</b><small>{p.pos[0]}</small></span>
            {current === p.name && <Icon name="check" size={16} />}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function CareerFormationScreen({ save, onConfirm, onSaveFormationPreset, onDeleteFormationPreset, onRenameFormationPreset }) {
  // Jogador da categoria de base não pode ser escalado até ser promovido.
  const roster = useMemo(() => save.clubs[save.myClubId].roster.filter(p => !p.inAcademy), [save.clubs, save.myClubId]);
  const [formationKey, setFormationKey] = useState(() => (FORMATIONS[save.myFormationKey] ? save.myFormationKey : DEFAULT_FORMATION));
  const slots = useMemo(() => buildPitchSlots(formationKey), [formationKey]);
  const [starters, setStarters] = useState(() => initialStarters(roster, save, slots, formationKey));
  const [pendingSlotKey, setPendingSlotKey] = useState(null);
  const [benchSelected, setBenchSelected] = useState(() => initialBench(roster, save, Object.values(starters)));
  const [presetPanel, setPresetPanel] = useState(null); // null | 'save' | 'load'
  const [rolePicker, setRolePicker] = useState(null); // null | 'cap' | 'pen'
  const [captainName, setCaptainName] = useState(() => {
    const names = new Set(Object.values(starters));
    return save.myCaptain && names.has(save.myCaptain) ? save.myCaptain : null;
  });
  const [penaltyTakerName, setPenaltyTakerName] = useState(() => {
    const names = new Set(Object.values(starters));
    return save.myPenaltyTaker && names.has(save.myPenaltyTaker) ? save.myPenaltyTaker : null;
  });
  const [line, setLine] = useState(() => (FORMATIONS[save.myFormationKey] ? save.myFormationKey : DEFAULT_FORMATION)[0]);
  const [poolFilter, setPoolFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const toastTimer = useRef(null);
  const poolRef = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (!confirmClear) return undefined;
    const t = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  // Suspenso (applyUserDiscipline em seasonEngine.js) não entra nem no banco.
  const suspendedSet = useMemo(() => new Set(Object.entries(save.suspensions || {}).filter(([, left]) => left > 0).map(([name]) => name)), [save.suspensions]);
  // Pendurado: um amarelo da suspensão (save.cardTally, mesmo contador do motor).
  const hangingSet = useMemo(() => new Set(Object.entries(save.cardTally || {}).filter(([, n]) => n === YELLOWS_FOR_SUSPENSION - 1).map(([name]) => name)), [save.cardTally]);
  const hasSuspendedStarter = Object.values(starters).some(name => suspendedSet.has(name));
  const hasSuspendedBench = benchSelected.some(name => suspendedSet.has(name));

  const byName = useMemo(() => Object.fromEntries(roster.map(p => [p.name, p])), [roster]);
  const placedNames = new Set(Object.values(starters).filter(Boolean));
  const benchSet = new Set(benchSelected);
  const notPlaced = [...roster].filter(p => !placedNames.has(p.name)).sort((a, b) => b.ovr - a.ovr);
  const outOfList = notPlaced.filter(p => !benchSet.has(p.name));
  const filledCount = Object.values(starters).filter(Boolean).length;
  const validCaptain = captainName && placedNames.has(captainName) ? captainName : null;
  const validPenaltyTaker = penaltyTakerName && placedNames.has(penaltyTakerName) ? penaltyTakerName : null;
  const starterPlayers = slots.map(s => starters[s.key]).filter(Boolean).map(n => byName[n]).filter(Boolean)
    .sort((a, b) => posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]));

  // ── Resumo: OVR titular e força por setor ──
  const xiOvrs = slots.map(s => starters[s.key] && byName[starters[s.key]] ? byName[starters[s.key]].ovr + (starters[s.key] === validCaptain ? 2 : 0) : null).filter(v => v != null);
  const avgXi = xiOvrs.length ? xiOvrs.reduce((a, b) => a + b, 0) / xiOvrs.length : 0;
  const sectorAvg = (pairs) => {
    const acc = { gk: [], df: [], md: [], at: [] };
    pairs.forEach(([sector, ovr]) => acc[sector].push(ovr));
    return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, v.length ? v.reduce((a, b) => a + b, 0) / v.length : null]));
  };
  const mySectors = sectorAvg(slots.filter(s => starters[s.key] && byName[starters[s.key]]).map(s => [posSector(s.realPos), byName[starters[s.key]].ovr]));

  // ── Próximo jogo e comparação (mesmo cálculo da Visão geral) ──
  const next = useMemo(() => upcomingFixtures(save, 1)[0] || null, [save]);
  const draftSave = useMemo(() => ({
    ...save,
    myStarters: slots.map(s => starters[s.key]).filter(Boolean),
    myBench: benchSelected,
    myCaptain: validCaptain,
    myPenaltyTaker: validPenaltyTaker,
  }), [save, slots, starters, benchSelected, validCaptain, validPenaltyTaker]);
  let vs = null;
  if (next) {
    const opp = teamForSim(save, next.oppId);
    const mine = teamForSim(draftSave, save.myClubId);
    const iAmHome = next.isHome !== false;
    const odds = matchOutcomeProbabilities(iAmHome ? mine : opp, iAmHome ? opp : mine);
    const winPct = Math.round((iAmHome ? odds.homeWin : odds.awayWin) * 100);
    const oppSectors = sectorAvg(opp.players.slice(0, 11).map(p => [posSector(p.pos[0]), p.ovr]));
    const oppXi = opp.players.slice(0, 11);
    const oppAvg = oppXi.reduce((s, p) => s + p.ovr, 0) / (oppXi.length || 1);
    const diffs = ['at', 'md', 'df', 'gk']
      .filter(k => mySectors[k] != null && oppSectors[k] != null)
      .map(k => ({ k, d: mySectors[k] - oppSectors[k] }));
    let sentence = 'Escale os 11 titulares para comparar os setores.';
    if (diffs.length) {
      const best = [...diffs].sort((a, b) => b.d - a.d)[0];
      const worst = [...diffs].sort((a, b) => a.d - b.d)[0];
      const nm = { at: 'ataque', md: 'meio-campo', df: 'defesa', gk: 'goleiro' };
      const art = (k) => (k === 'gk' || k === 'at' || k === 'md' ? 'o' : 'a');
      const parts = [];
      if (best.d >= 0.5) parts.push(`seu ${nm[best.k]} é melhor (+${fmt1(best.d)})`);
      if (worst.d <= -0.5) parts.push(`${art(worst.k)} ${nm[worst.k]} deles leva vantagem (+${fmt1(-worst.d)})`);
      sentence = parts.length ? parts.join('; ') : 'setores equilibrados entre os dois times';
      sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    }
    vs = { opp, oppAvg, winPct, sentence, next };
  }

  // ── Handlers (mesma lógica de antes, com seleção de vaga) ──
  const handleSlotClick = (slotKey) => {
    setPendingSlotKey(prev => (prev === slotKey ? null : slotKey));
  };

  // Coloca `playerName` na vaga selecionada. Quem estava na vaga troca de
  // lugar: se o novo veio do banco, o antigo assume o lugar dele no banco.
  const placeInSlot = (slotKey, playerName) => {
    const prevOccupant = starters[slotKey];
    setStarters(prev => ({ ...prev, [slotKey]: playerName }));
    setBenchSelected(prev => {
      const wasOnBench = prev.includes(playerName);
      let nextBench = prev.filter(n => n !== playerName);
      if (prevOccupant && wasOnBench && !suspendedSet.has(prevOccupant)) {
        const idx = prev.indexOf(playerName);
        nextBench = [...nextBench.slice(0, idx), prevOccupant, ...nextBench.slice(idx)];
      }
      return nextBench.slice(0, BENCH_MAX);
    });
  };

  const handlePick = (playerName) => {
    if (!pendingSlotKey) return;
    placeInSlot(pendingSlotKey, playerName);
    setPendingSlotKey(null);
  };

  const handleRemoveFromSlot = () => {
    if (!pendingSlotKey) return;
    setStarters(prev => { const next = { ...prev }; delete next[pendingSlotKey]; return next; });
    setPendingSlotKey(null);
  };

  const handleToggleBench = (playerName) => {
    if (suspendedSet.has(playerName)) return;
    setBenchSelected(prev => {
      if (prev.includes(playerName)) return prev.filter(n => n !== playerName);
      if (prev.length >= BENCH_MAX) return prev;
      return [...prev, playerName];
    });
  };

  // Jogador do banco ou da lista com uma vaga selecionada = troca direta.
  const handleBenchOrPoolClick = (playerName, from) => {
    if (pendingSlotKey) {
      if (suspendedSet.has(playerName)) return;
      handlePick(playerName);
      return;
    }
    if (from === 'bench') handleToggleBench(playerName);
  };

  const handleFormationChange = (nextKey) => {
    const nextSlots = buildPitchSlots(nextKey);
    // Troca de esquema tenta reaproveitar quem já tava escalado (preferência
    // por bater a posição na vaga nova); quem sobra vai pro banco se couber.
    const currentNames = slots.map(s => starters[s.key]).filter(Boolean);
    const pool = [...currentNames.map(n => byName[n]), ...roster.filter(p => !currentNames.includes(p.name))];
    const nextStarters = autoFillFromPool(pool, nextSlots);
    const nextStarterSet = new Set(Object.values(nextStarters));
    const dropped = currentNames.filter(n => !nextStarterSet.has(n));
    setFormationKey(nextKey);
    setStarters(nextStarters);
    const kept = benchSelected.filter(n => !nextStarterSet.has(n));
    const add = dropped.filter(n => !suspendedSet.has(n) && !kept.includes(n)).slice(0, Math.max(0, BENCH_MAX - kept.length));
    const movedToBench = add.length;
    setBenchSelected([...kept, ...add]);
    setPendingSlotKey(null);
    if (dropped.length) {
      showToast(movedToBench
        ? `${movedToBench} jogador${movedToBench > 1 ? 'es foram' : ' foi'} para o banco${dropped.length > movedToBench ? `, ${dropped.length - movedToBench} ficou fora da lista` : ''}.`
        : `${dropped.length} jogador${dropped.length > 1 ? 'es saíram' : ' saiu'} do time titular (banco cheio).`);
    }
  };

  const suggest = (exclude = new Set()) => {
    const sorted = [...roster].filter(p => !exclude.has(p.name)).sort((a, b) => b.ovr - a.ovr);
    const nextStarters = autoFillFromPool(sorted, slots);
    setStarters(nextStarters);
    const nextStarterSet = new Set(Object.values(nextStarters).filter(Boolean));
    setBenchSelected(sorted.filter(p => !nextStarterSet.has(p.name) && !suspendedSet.has(p.name)).slice(0, BENCH_MAX).map(p => p.name));
    setPendingSlotKey(null);
    return nextStarters;
  };
  // Sugerir: igual antes (melhores por OVR, banco com os 12 melhores que
  // sobraram) — agora sem suspensos, que não podem nem ser relacionados.
  const handleSuggest = () => suggest(suspendedSet);
  // Poupar pendurados: o mesmo Sugerir, sem quem está a um amarelo da suspensão.
  const handleSparingSuggest = () => {
    suggest(new Set([...suspendedSet, ...hangingSet]));
    showToast(hangingSet.size ? `${hangingSet.size} pendurado${hangingSet.size > 1 ? 's' : ''} poupado${hangingSet.size > 1 ? 's' : ''}.` : 'Nenhum jogador pendurado agora.');
  };

  const handleClear = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setStarters({});
    setBenchSelected([]);
    setPendingSlotKey(null);
    setConfirmClear(false);
  };

  // Banco: completa por melhor OVR garantindo 1 goleiro e cada setor.
  const handleFillBench = () => {
    const available = notPlaced.filter(p => !suspendedSet.has(p.name));
    let nextBench = benchSelected.filter(n => !suspendedSet.has(n));
    const has = (sector) => nextBench.some(n => byName[n] && posSector(byName[n].pos[0]) === sector);
    for (const sector of ['gk', 'df', 'md', 'at']) {
      if (nextBench.length >= BENCH_MAX) break;
      if (!has(sector)) {
        const cand = available.find(p => posSector(p.pos[0]) === sector && !nextBench.includes(p.name));
        if (cand) nextBench = [...nextBench, cand.name];
      }
    }
    for (const p of available) {
      if (nextBench.length >= BENCH_MAX) break;
      if (!nextBench.includes(p.name)) nextBench = [...nextBench, p.name];
    }
    setBenchSelected(nextBench);
  };

  // Criar/Carregar formação — mesma lógica de antes.
  const handleSavePreset = (name) => {
    const myStarters = slots.map(s => starters[s.key]).filter(Boolean);
    onSaveFormationPreset({ name, formationKey, starters: myStarters, bench: benchSelected });
    setPresetPanel(null);
    showToast(`Preset "${name}" salvo.`);
  };

  const handleLoadPreset = (preset) => {
    const nextSlots = buildPitchSlots(preset.formationKey);
    const rosterNames = new Set(roster.map(p => p.name));
    const nextStarters = {};
    nextSlots.forEach((slot, i) => {
      const name = preset.starters[i];
      if (name && rosterNames.has(name)) nextStarters[slot.key] = name;
    });
    const nextStarterNames = new Set(Object.values(nextStarters));
    setFormationKey(preset.formationKey);
    setLine(preset.formationKey[0]);
    setStarters(nextStarters);
    setBenchSelected((preset.bench || []).filter(n => rosterNames.has(n) && !nextStarterNames.has(n)).slice(0, BENCH_MAX));
    setPendingSlotKey(null);
    setPresetPanel(null);
    showToast(`Preset "${preset.name}" carregado — confirme a escalação para valer.`);
  };

  const canConfirm = filledCount === 11 && !hasSuspendedStarter && !hasSuspendedBench && !!validCaptain && !!validPenaltyTaker;
  const confirmReason = canConfirm ? null
    : filledCount < 11 ? `Escolha mais ${11 - filledCount} titular${11 - filledCount > 1 ? 'es' : ''}`
      : hasSuspendedStarter ? 'Tire o suspenso da escalação'
        : hasSuspendedBench ? 'Tire o suspenso do banco'
          : !validCaptain ? 'Escolha um capitão'
            : 'Escolha um cobrador de pênalti';
  const handleConfirm = () => {
    if (!canConfirm) return;
    const myStarters = slots.map(s => starters[s.key]).filter(Boolean);
    onConfirm({
      myStarters, myBench: benchSelected, myFormationLabel: FORMATIONS[formationKey].label, myFormationKey: formationKey,
      myCaptain: validCaptain, myPenaltyTaker: validPenaltyTaker,
    });
  };

  // Alterações não confirmadas: compara a tela com o que está salvo.
  const currentOrder = slots.map(s => starters[s.key] || '');
  const dirty = formationKey !== save.myFormationKey
    || currentOrder.join('|') !== (save.myStarters || []).join('|')
    || benchSelected.join('|') !== (save.myBench || []).join('|')
    || (validCaptain || null) !== (save.myCaptain || null)
    || (validPenaltyTaker || null) !== (save.myPenaltyTaker || null);

  // ── Alertas com ação de 1 clique ──
  const bestFor = (slot, exclude = new Set()) => notPlaced
    .filter(p => !suspendedSet.has(p.name) && !exclude.has(p.name) && p.pos.includes(slot.realPos))
    .sort((a, b) => hangingSet.has(a.name) - hangingSet.has(b.name) || (b.pos[0] === slot.realPos) - (a.pos[0] === slot.realPos) || b.ovr - a.ovr)[0];
  const alerts = [];
  slots.forEach(slot => {
    const name = starters[slot.key];
    const p = name && byName[name];
    if (!p) return;
    if (suspendedSet.has(name)) {
      const sub = bestFor(slot);
      alerts.push({ key: `s-${slot.key}`, tone: 'danger', icon: 'warning', text: <><b>{name} está suspenso.</b> Não pode jogar a próxima rodada.</>, action: sub ? { label: `Trocar por ${sub.name}`, run: () => placeInSlot(slot.key, sub.name) } : null });
    } else if (hangingSet.has(name)) {
      const sub = bestFor(slot, hangingSet);
      alerts.push({ key: `h-${slot.key}`, tone: 'warning', icon: 'list', text: <><b>{name} está pendurado.</b> Mais um amarelo e ele cumpre suspensão.</>, action: sub ? { label: `Trocar por ${sub.name}`, run: () => placeInSlot(slot.key, sub.name) } : null });
    } else if (!p.pos.includes(slot.realPos)) {
      const sub = bestFor(slot);
      alerts.push({ key: `o-${slot.key}`, tone: 'info', icon: 'swap', text: <><b>{name} está fora de posição</b> ({p.pos.join('/')} jogando de {slot.realPos}).</>, action: sub ? { label: `Trocar por ${sub.name}`, run: () => placeInSlot(slot.key, sub.name) } : null });
    }
  });
  benchSelected.filter(n => suspendedSet.has(n)).forEach(n => alerts.push({ key: `sb-${n}`, tone: 'danger', icon: 'warning', text: <><b>{n} está suspenso</b> e não pode ficar no banco.</>, action: { label: 'Tirar do banco', run: () => setBenchSelected(prev => prev.filter(x => x !== n)) } }));
  if (filledCount > 0 && !benchSelected.some(n => byName[n]?.pos[0] === 'GOL')) {
    const gk = notPlaced.find(p => p.pos[0] === 'GOL' && !suspendedSet.has(p.name) && !benchSet.has(p.name));
    alerts.push({
      key: 'gk', tone: 'warning', icon: 'shirt', text: <><b>Banco sem goleiro reserva.</b> Se o titular sair, ninguém cobre o gol.</>,
      action: gk ? {
        label: `Adicionar ${gk.name}`,
        run: () => setBenchSelected(prev => {
          if (prev.length < BENCH_MAX) return [...prev, gk.name];
          const worst = [...prev].sort((a, b) => (byName[a]?.ovr || 0) - (byName[b]?.ovr || 0))[0];
          return prev.map(n => (n === worst ? gk.name : n));
        }),
      } : null,
    });
  }

  const ALERT_ORDER = { danger: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => ALERT_ORDER[a.tone] - ALERT_ORDER[b.tone]);
  const presets = save.savedFormations || [];
  const avgOf = (names) => {
    const ovrs = (names || []).map(n => byName[n]?.ovr).filter(Boolean);
    return ovrs.length ? ovrs.reduce((a, b) => a + b, 0) / ovrs.length : 0;
  };

  const pendingSlot = pendingSlotKey ? slots.find(s => s.key === pendingSlotKey) : null;
  const formationOptions = Object.entries(FORMATIONS).filter(([key]) => key[0] === line);
  const lineCounts = { 4: 0, 3: 0, 5: 0 };
  Object.keys(FORMATIONS).forEach(k => { lineCounts[k[0]] = (lineCounts[k[0]] || 0) + 1; });
  const filteredPool = outOfList.filter(p => poolFilter === 'all' || posSector(p.pos[0]) === poolFilter);
  const oppTeam = vs ? clubOf(vs.next.oppId) : null;
  const [schemeNum, ...schemeStyle] = FORMATIONS[formationKey].label.split(' ');

  return (
    <div className="ch-main cf-main">
      {/* ── Cabeçalho ── */}
      <div className="cf-ph">
        <div style={{ minWidth: 0 }}>
          <span className="ch-mono">
            {vs ? `${vs.next.comp === 'Brasileirão' ? vs.next.detail : vs.next.comp} · próximo: ${displayName(oppTeam?.club)} (${vs.next.isHome === null ? 'neutro' : vs.next.isHome ? 'casa' : 'fora'}) · ${dayParts(vs.next.day).d} ${dayParts(vs.next.day).m}` : 'Sem próximo jogo marcado'}
          </span>
          <h1>Formação</h1>
          <p>Toque numa posição do campo para trocar o jogador. As mudanças só valem depois de confirmar.</p>
          {dirty && <span className="ch-tag ch-t-warning" style={{ marginTop: 10 }} role="status"><Icon name="info" size={13} />Alterações não confirmadas</span>}
        </div>
        <div className="cf-acts">
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-md" onClick={() => setPresetPanel('save')}><Icon name="edit" size={16} />Salvar como preset</button>
          <span title={confirmReason || 'Salvar esta escalação para os próximos jogos'} className="cf-confirm-wrap">
            <button type="button" className="ui-btn ui-btn-dark ui-btn-md" onClick={handleConfirm} disabled={!canConfirm} aria-describedby={confirmReason ? 'cf-confirm-reason' : undefined}>
              <Icon name="play" size={15} />{canConfirm ? 'Confirmar escalação' : confirmReason}
            </button>
          </span>
          {confirmReason && <span id="cf-confirm-reason" className="sr-only">{confirmReason}</span>}
        </div>
      </div>

      {/* ── Barra de ferramentas ── */}
      <div className="ch-card cf-tool">
        <label className="cf-select">
          <Icon name="formation" size={18} />
          <span className="sr-only">Esquema tático</span>
          <select value={formationKey} onChange={e => handleFormationChange(e.target.value)} aria-label="Esquema tático">
            {!formationOptions.some(([k]) => k === formationKey) && <option value={formationKey}>{FORMATIONS[formationKey].label}</option>}
            {formationOptions.map(([key, f]) => <option key={key} value={key}>{f.label}</option>)}
          </select>
          <span className="cf-select-face" aria-hidden="true"><b>{schemeNum}</b> <small>{schemeStyle.join(' ')}</small></span>
          <Icon name="chevronDown" size={15} style={{ marginLeft: 'auto' }} />
        </label>
        <div className="cf-seg" role="tablist" aria-label="Filtrar esquemas pela linha de defesa">
          {['4', '3', '5'].map(n => (
            <button key={n} type="button" role="tab" aria-selected={line === n} className={line === n ? 'cf-on' : ''} onClick={() => setLine(n)} title={`${lineCounts[n]} esquemas`}>Linha de {n}</button>
          ))}
        </div>
        <span className="cf-vsep" aria-hidden="true" />
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={handleSuggest}><Icon name="bolt" size={15} />Sugerir</button>
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={handleSparingSuggest} title="Sugerir sem os jogadores pendurados (2 amarelos)">Poupar pendurados{hangingSet.size ? ` · ${[...hangingSet].filter(n => byName[n]).length}` : ''}</button>
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm cf-push" onClick={() => setPresetPanel('load')}><Icon name="calendar" size={15} />Presets · {presets.length}</button>
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" style={{ color: 'var(--danger)', borderColor: confirmClear ? 'var(--danger)' : undefined }} onClick={handleClear}>{confirmClear ? 'Confirmar limpar?' : 'Limpar'}</button>
      </div>

      <div className="cf-grid">
        {/* ── Campo ── */}
        <div className="ch-card cf-pitchwrap">
          <PitchField
            slots={slots} starters={starters} byName={byName} selectedSlot={pendingSlotKey}
            suspendedSet={suspendedSet} hangingSet={hangingSet} captain={validCaptain} penalty={validPenaltyTaker}
            onSlotClick={handleSlotClick}
          />
          <div className="cf-legend">
            <span><i style={{ background: SECTOR_RING.gk }} />Goleiro</span>
            <span><i style={{ background: SECTOR_RING.df }} />Defesa</span>
            <span><i style={{ background: SECTOR_RING.md }} />Meio</span>
            <span><i style={{ background: SECTOR_RING.at }} />Ataque</span>
            <span><b style={{ color: 'var(--gold-ink)' }}>C</b> capitão · <b>P</b> pênalti · <b style={{ color: 'var(--warning-ink)' }}>!</b> alerta</span>
          </div>
        </div>

        {/* ── Painel ── */}
        <div className="cf-right">
          {pendingSlot && (
            <>
              <div className="cf-sheet-bg" onClick={() => setPendingSlotKey(null)} aria-hidden="true" />
              <PlayerPoolPicker
                slot={pendingSlot}
                occupant={starters[pendingSlot.key] ? byName[starters[pendingSlot.key]] : null}
                pool={notPlaced}
                benchSet={benchSet}
                suspendedSet={suspendedSet}
                hangingSet={hangingSet}
                onPick={handlePick}
                onRemove={handleRemoveFromSlot}
                onCancel={() => setPendingSlotKey(null)}
              />
            </>
          )}

          <div className="ch-card">
            <div className="cf-sum">
              <div className="cf-big">
                <span className="ch-mono">OVR titular</span>
                <b>{avgXi ? fmt1(avgXi) : '—'}</b>
                <span className="ch-small">{validCaptain ? <><span style={{ color: 'var(--success)', fontWeight: 600 }}>+2</span> com capitão · </> : 'sem capitão · '}{filledCount}/11 escalados</span>
              </div>
              <div className="cf-sectors">
                {['at', 'md', 'df', 'gk'].map(k => (
                  <div key={k}>
                    <div className="ch-row" style={{ fontSize: 13, marginBottom: 6 }}><span>{SECTOR_LABEL[k]}</span><b style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{mySectors[k] != null ? fmt1(mySectors[k]) : '—'}</b></div>
                    <div className="ch-bar"><i style={{ width: `${mySectors[k] != null ? Math.max(4, Math.min(100, (mySectors[k] - 55) * 2.5)) : 0}%`, background: SECTOR_RING[k] }} /></div>
                  </div>
                ))}
              </div>
            </div>
            {vs && (
              <div className="cf-vsopp">
                <TeamBadge src={CLUB_LOGOS[oppTeam?.club]} name={oppTeam?.club || ''} color={oppTeam?.colors?.p} size={32} radius={16} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b>vs. {displayName(oppTeam?.club)} · OVR {fmt1(vs.oppAvg)}</b>
                  <div className="ch-small">{vs.sentence}</div>
                </div>
                <span className="ch-tag ch-t-mute">Vitória {vs.winPct}%</span>
              </div>
            )}
          </div>

          {alerts.length > 4 && <div className="ch-small" style={{ marginBottom: -8 }}>{alerts.length} alertas · mostrando os 4 primeiros</div>}
          {alerts.slice(0, 4).map(a => (
            <div key={a.key} className={`cf-hint cf-h-${a.tone}`} role="status">
              <Icon name={a.icon} size={18} />
              <span style={{ flex: 1, minWidth: 0 }}>{a.text}</span>
              {a.action && <button type="button" className="ch-link" style={{ color: 'inherit' }} onClick={a.action.run}>{a.action.label}</button>}
            </div>
          ))}

          <div className="cf-two">
            <div className="ch-card" style={{ overflow: 'hidden' }}>
              <div className="ch-head"><h3>Funções</h3></div>
              <div className="cf-role">
                <span className="cf-k" style={{ background: 'var(--gold)', color: '#fff' }}>C</span>
                <div style={{ minWidth: 0, flex: 1 }}><b className="cf-ell">{validCaptain || 'Sem capitão'}</b><small>Capitão · +2 OVR</small></div>
                <button type="button" className="ch-link" onClick={() => setRolePicker('cap')} disabled={!filledCount}>{validCaptain ? 'Trocar' : 'Escolher'}</button>
              </div>
              <div className="cf-role">
                <span className="cf-k" style={{ background: 'var(--surface-2)' }}>P</span>
                <div style={{ minWidth: 0, flex: 1 }}><b className="cf-ell">{validPenaltyTaker || 'Sem cobrador'}</b><small>Cobrador de pênalti</small></div>
                <button type="button" className="ch-link" onClick={() => setRolePicker('pen')} disabled={!filledCount}>{validPenaltyTaker ? 'Trocar' : 'Escolher'}</button>
              </div>
            </div>
            <div className="ch-card" style={{ overflow: 'hidden' }}>
              <div className="ch-head"><h3>Presets</h3><button type="button" className="ch-link" onClick={() => setPresetPanel('load')}>Gerenciar</button></div>
              {presets.length === 0 && <div className="ch-empty">Nenhum preset salvo.</div>}
              {presets.slice(-3).reverse().map(p => (
                <div key={p.id} className="cf-role">
                  <span className="cf-k" style={{ background: 'var(--surface-2)', fontSize: 10 }}>{(p.formationKey || '').split('-').slice(0, 2).join('-')}</span>
                  <div style={{ minWidth: 0, flex: 1 }}><b className="cf-ell">{p.name}</b><small>{FORMATIONS[p.formationKey]?.label || p.formationKey} · {fmt1(avgOf(p.starters))}</small></div>
                  <button type="button" className="ch-link" onClick={() => handleLoadPreset(p)}>Carregar</button>
                </div>
              ))}
            </div>
          </div>

          <div className="ch-card">
            <div className="ch-head">
              <h3>Banco <span className="ch-small" style={{ fontFamily: 'var(--font-body)' }}>{benchSelected.length} de {BENCH_MAX}</span></h3>
              <button type="button" className="ch-link" onClick={handleFillBench} disabled={benchSelected.length >= BENCH_MAX}>Preencher automaticamente</button>
            </div>
            <div className="cf-bench">
              {Array.from({ length: BENCH_MAX }).map((_, i) => {
                const name = benchSelected[i];
                const p = name && byName[name];
                if (!p) {
                  return (
                    <button key={`e${i}`} type="button" className="cf-bs cf-bs-empty" aria-label="Vaga vazia no banco — escolher da lista" onClick={() => poolRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>+</button>
                  );
                }
                const susp = suspendedSet.has(name);
                return (
                  <button
                    key={name}
                    type="button"
                    className={`cf-bs${susp ? ' cf-bs-susp' : ''}`}
                    onClick={() => handleBenchOrPoolClick(name, 'bench')}
                    aria-label={`${p.pos[0]}: ${name}, OVR ${p.ovr}${susp ? ', suspenso' : ''} — ${pendingSlotKey ? 'colocar na vaga selecionada' : 'tirar do banco'}`}
                    title={pendingSlotKey ? 'Colocar na vaga selecionada' : 'Tirar do banco'}
                  >
                    <b>{p.ovr}</b><span>{name}</span><small style={{ color: posColor(p.pos[0]) }}>{p.pos[0]}{hangingSet.has(name) ? ' · !' : ''}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ch-card" ref={poolRef}>
            <div className="ch-head"><h3>Fora da lista</h3><span className="ch-small">{outOfList.length} jogador{outOfList.length === 1 ? '' : 'es'}</span></div>
            <div className="ch-chips" role="tablist" aria-label="Filtrar por setor">
              {SECTOR_FILTERS.map(f => {
                const n = f.id === 'all' ? outOfList.length : outOfList.filter(p => posSector(p.pos[0]) === f.id).length;
                return <button key={f.id} type="button" role="tab" aria-selected={poolFilter === f.id} className={`ch-chip${poolFilter === f.id ? ' ch-on' : ''}`} onClick={() => setPoolFilter(f.id)}>{f.label}{f.id === 'all' ? ` ${n}` : ''}</button>;
              })}
            </div>
            {filteredPool.length === 0 && <div className="ch-empty">Ninguém fora da lista nesse setor.</div>}
            {filteredPool.map(p => {
              const susp = suspendedSet.has(p.name);
              const benchFull = benchSelected.length >= BENCH_MAX;
              return (
                <div key={p.name} className={`cf-pr${susp ? ' cf-dim' : ''}`}>
                  <span className="cf-o">{p.ovr}</span>
                  <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b className="cf-ell">{p.name}</b>
                    {susp && <span className="ch-tag ch-t-danger" style={{ height: 20 }}>Suspenso</span>}
                    {!susp && hangingSet.has(p.name) && <span className="ch-tag ch-t-warning" style={{ height: 20 }}>Pendurado</span>}
                  </span>
                  <span className="cf-pos">{p.pos[0]}</span>
                  <span className="ch-small">{p.age != null ? `${p.age} anos` : '—'}</span>
                  {susp ? (
                    <span className="ch-small" style={{ justifySelf: 'end' }}>Indisponível</span>
                  ) : pendingSlotKey ? (
                    <button type="button" className="ch-link" style={{ justifySelf: 'end' }} onClick={() => handleBenchOrPoolClick(p.name, 'pool')} aria-label={`Escalar ${p.name} na vaga ${pendingSlot?.realPos}`}>Escalar</button>
                  ) : (
                    <button type="button" className="ch-link" style={{ justifySelf: 'end' }} disabled={benchFull} title={benchFull ? 'Banco cheio (12)' : undefined} onClick={() => handleToggleBench(p.name)} aria-label={`Adicionar ${p.name} ao banco`}>+ Banco</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rodapé fixo com o botão principal no celular */}
      <div className="cf-mobile-confirm">
        <button type="button" className="ui-btn ui-btn-dark ui-btn-lg ui-btn-block" onClick={handleConfirm} disabled={!canConfirm}>
          <Icon name="play" size={15} />{canConfirm ? 'Confirmar escalação' : confirmReason}
        </button>
      </div>

      {toast && <div className="cf-toast" role="status" aria-live="polite">{toast}</div>}
      {presetPanel === 'save' && <SavePresetPanel onSave={handleSavePreset} onCancel={() => setPresetPanel(null)} />}
      {presetPanel === 'load' && (
        <LoadPresetPanel presets={presets} avgOf={avgOf} onLoad={handleLoadPreset} onDelete={onDeleteFormationPreset} onRename={onRenameFormationPreset} onCancel={() => setPresetPanel(null)} />
      )}
      {rolePicker && (
        <RolePicker
          title={rolePicker === 'cap' ? 'Escolher capitão (+2 OVR)' : 'Escolher cobrador de pênalti'}
          starters={starterPlayers}
          current={rolePicker === 'cap' ? validCaptain : validPenaltyTaker}
          onPick={(name) => (rolePicker === 'cap' ? setCaptainName(name) : setPenaltyTakerName(name))}
          onClose={() => setRolePicker(null)}
        />
      )}
    </div>
  );
}
