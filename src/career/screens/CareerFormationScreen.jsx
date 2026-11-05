// Formação do Modo Carreira — campinho visual de verdade, igual os outros
// modos: escolhe o esquema tático, clica numa vaga vazia do campinho pra
// escolher quem joga ali (lista filtrada pelo elenco), clica numa vaga
// ocupada pra tirar o jogador de lá. Sem arrastar (clique só, de
// propósito — mais simples e funciona igual em touch/mouse). Editável
// quantas vezes quiser durante a temporada, reaberto a qualquer momento
// pelo hub. A escalação confirmada (save.myStarters) passa a valer de
// verdade nas partidas simuladas (ver teamForSim em seasonEngine.js) — só
// os 11 titulares importam pro motor; o banco é sempre "o resto do
// elenco, por overall", automático, sem precisar gerenciar vaga de banco
// aqui.
import { useMemo, useState } from 'react';
import { ovrColor, posColor, posOrderIndex } from '../../lib/format.js';
import { FORMATIONS, buildPitchSlots } from '../engine/formations.js';
import { backButtonStyle } from '../components/styles.js';

const DEFAULT_FORMATION = '4-3-3-misto';

// Escala os 11 titulares a partir de um "pool" preferido (em ordem) pras
// vagas do esquema atual — 1ª passada tenta bater a posição exata de cada
// vaga; 2ª passada preenche o que sobrar com o melhor jogador disponível,
// seja qual for a posição dele (garante sempre 11/11 preenchidos de
// largada, pro usuário editar a partir daí em vez de começar do zero).
function autoFillFromPool(pool, slots) {
  const used = new Set();
  const starters = {};
  for (const slot of slots) {
    const match = pool.find(p => !used.has(p.name) && p.pos[0] === slot.realPos);
    if (match) { starters[slot.key] = match.name; used.add(match.name); }
  }
  for (const slot of slots) {
    if (starters[slot.key]) continue;
    const any = pool.find(p => !used.has(p.name));
    if (any) { starters[slot.key] = any.name; used.add(any.name); }
  }
  return starters;
}

function initialStarters(roster, preferredNames, slots) {
  const preferred = (preferredNames || []).map(n => roster.find(p => p.name === n)).filter(Boolean);
  const rest = [...roster].filter(p => !preferred.some(q => q.name === p.name)).sort((a, b) => b.ovr - a.ovr);
  return autoFillFromPool([...preferred, ...rest], slots);
}

function PitchSlotCircle({ slot, player, pending, onClick }) {
  const c = posColor(slot.realPos);
  const filled = !!player;
  return (
    <div
      onClick={onClick}
      title={player ? `${player.name} — clique pra tirar do time titular` : `Vazio (${slot.label}) — clique pra escolher quem joga aqui`}
      style={{
        position: 'absolute', left: `${slot.x}%`, top: `${slot.y}%`, transform: 'translate(-50%,-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', zIndex: filled ? 2 : 1,
        width: 56,
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, fontFamily: "'Space Mono', monospace",
        background: pending ? 'rgba(212,162,60,0.35)' : filled ? c : 'rgba(255,255,255,0.08)',
        border: pending ? '2.5px solid #d4a23c' : filled ? '2px solid rgba(255,255,255,0.65)' : `1.5px dashed ${c}88`,
        color: filled ? '#0B1A12' : pending ? '#d4a23c' : `${c}cc`,
        boxShadow: pending ? '0 0 14px rgba(212,162,60,0.5)' : filled ? '0 3px 8px rgba(0,0,0,0.5)' : 'none',
      }}>
        {filled ? player.ovr : slot.label}
      </div>
      {filled && (
        <div style={{
          fontSize: 9.5, fontWeight: 600, color: '#F4F1EA', textAlign: 'center', lineHeight: 1.1,
          textShadow: '0 1px 3px rgba(0,0,0,0.9)', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{player.name}</div>
      )}
    </div>
  );
}

function PitchField({ slots, starters, roster, pendingSlotKey, onSlotClick }) {
  const byName = useMemo(() => Object.fromEntries(roster.map(p => [p.name, p])), [roster]);
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '0.68', borderRadius: 12, overflow: 'hidden',
      background: '#124d27',
      backgroundImage: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0.07) 0%, rgba(0,0,0,0.07) 14.3%, transparent 14.3%, transparent 28.6%)',
      border: '1px solid rgba(255,255,255,0.1)', marginBottom: 12,
    }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(255,255,255,0.3)' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 60, height: 60, border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '50%', transform: 'translate(-50%,-50%)' }} />
      <div style={{ position: 'absolute', top: 0, left: '18%', width: '64%', height: '15%', border: '1.5px solid rgba(255,255,255,0.3)', borderTop: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: '18%', width: '64%', height: '15%', border: '1.5px solid rgba(255,255,255,0.3)', borderBottom: 'none' }} />
      {slots.map(slot => (
        <PitchSlotCircle
          key={slot.key}
          slot={slot}
          player={starters[slot.key] ? byName[starters[slot.key]] : null}
          pending={pendingSlotKey === slot.key}
          onClick={() => onSlotClick(slot.key)}
        />
      ))}
    </div>
  );
}

function PlayerPoolPicker({ pos, pool, onPick, onCancel }) {
  const sorted = [...pool].sort((a, b) => (a.pos[0] === pos ? -1 : 1) - (b.pos[0] === pos ? -1 : 1) || b.ovr - a.ovr);
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(212,162,60,0.08)', border: '1px solid rgba(212,162,60,0.3)', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#d4a23c' }}>Quem joga em {pos}?</div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'rgba(244,241,234,0.6)', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
      </div>
      {sorted.length === 0 && <p style={{ fontSize: 12, opacity: 0.5 }}>Todo mundo já tá escalado em outra vaga.</p>}
      <div style={{ display: 'grid', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
        {sorted.map(p => (
          <button
            key={p.name}
            onClick={() => onPick(p.name)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
              background: p.pos[0] === pos ? 'rgba(127,217,154,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${p.pos[0] === pos ? 'rgba(127,217,154,0.3)' : 'rgba(255,255,255,0.08)'}`, color: '#F4F1EA',
            }}
          >
            <span style={{ width: 28, fontSize: 10, fontWeight: 700, color: posColor(p.pos[0]), fontFamily: "'Space Mono', monospace" }}>{p.pos[0]}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: ovrColor(p.ovr), fontSize: 12.5 }}>{p.ovr}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CareerFormationScreen({ save, onConfirm, onBack }) {
  const roster = save.clubs[save.myClubId].roster;
  const [formationKey, setFormationKey] = useState(() => (FORMATIONS[save.myFormationKey] ? save.myFormationKey : DEFAULT_FORMATION));
  const slots = useMemo(() => buildPitchSlots(formationKey), [formationKey]);
  const [starters, setStarters] = useState(() => initialStarters(roster, save.myStarters, slots));
  const [pendingSlotKey, setPendingSlotKey] = useState(null);

  const byName = useMemo(() => Object.fromEntries(roster.map(p => [p.name, p])), [roster]);
  const placedNames = new Set(Object.values(starters).filter(Boolean));
  const bench = [...roster].filter(p => !placedNames.has(p.name)).sort((a, b) => b.ovr - a.ovr);
  const filledCount = Object.values(starters).filter(Boolean).length;
  const avgOvr = filledCount ? Math.round(Object.values(starters).filter(Boolean).reduce((s, n) => s + (byName[n]?.ovr || 0), 0) / filledCount) : 0;

  const handleSlotClick = (slotKey) => {
    if (starters[slotKey]) {
      setStarters(prev => { const next = { ...prev }; delete next[slotKey]; return next; });
      setPendingSlotKey(null);
    } else {
      setPendingSlotKey(prev => (prev === slotKey ? null : slotKey));
    }
  };

  const handlePick = (playerName) => {
    if (!pendingSlotKey) return;
    setStarters(prev => ({ ...prev, [pendingSlotKey]: playerName }));
    setPendingSlotKey(null);
  };

  const handleFormationChange = (nextKey) => {
    const nextSlots = buildPitchSlots(nextKey);
    // Troca de esquema tenta reaproveitar quem já tava escalado (preferência
    // por bater a posição na vaga nova); quem não encaixa volta pro banco.
    const currentNames = slots.map(s => starters[s.key]).filter(Boolean);
    const pool = [...currentNames.map(n => byName[n]), ...roster.filter(p => !currentNames.includes(p.name))];
    setFormationKey(nextKey);
    setStarters(autoFillFromPool(pool, nextSlots));
    setPendingSlotKey(null);
  };

  const handleSuggest = () => {
    setStarters(autoFillFromPool([...roster].sort((a, b) => b.ovr - a.ovr), slots));
    setPendingSlotKey(null);
  };

  const canConfirm = filledCount === 11;
  const handleConfirm = () => {
    const myStarters = slots.map(s => starters[s.key]).filter(Boolean);
    onConfirm({ myStarters, myFormationLabel: FORMATIONS[formationKey].label, myFormationKey: formationKey });
  };

  const pendingPos = pendingSlotKey ? slots.find(s => s.key === pendingSlotKey)?.realPos : null;

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={backButtonStyle}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 4 }}>Formação</h2>
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>Clique numa vaga do campinho pra escalar ou tirar um jogador — edite quantas vezes quiser durante a temporada. OVR titular médio {avgOvr}.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select
          value={formationKey}
          onChange={e => handleFormationChange(e.target.value)}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.04)', color: '#F4F1EA', fontSize: 12.5, outline: 'none', colorScheme: 'dark',
          }}
        >
          {Object.entries(FORMATIONS).map(([key, f]) => (
            <option key={key} value={key} style={{ background: '#13241a', color: '#F4F1EA' }}>{f.label}</option>
          ))}
        </select>
        <button onClick={handleSuggest} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '0 12px', fontSize: 11, color: 'rgba(244,241,234,0.7)', cursor: 'pointer' }}>
          🪄 Sugerir
        </button>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: filledCount === 11 ? '#7fd99a' : '#d4a23c', marginBottom: 8 }}>Titulares: {filledCount}/11</div>

      <PitchField slots={slots} starters={starters} roster={roster} pendingSlotKey={pendingSlotKey} onSlotClick={handleSlotClick} />

      {pendingSlotKey && (
        <PlayerPoolPicker pos={pendingPos} pool={bench} onPick={handlePick} onCancel={() => setPendingSlotKey(null)} />
      )}

      <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Banco ({bench.length})</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {bench
          .slice()
          .sort((a, b) => posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]) || b.ovr - a.ovr)
          .map(p => (
            <div key={p.name} style={{
              padding: '5px 9px', borderRadius: 999, fontSize: 11, background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${posColor(p.pos[0])}44`, color: 'rgba(244,241,234,0.75)',
            }}>
              <span style={{ color: posColor(p.pos[0]), fontWeight: 700 }}>{p.pos[0]}</span> {p.name} <span style={{ opacity: 0.6 }}>{p.ovr}</span>
            </div>
          ))}
      </div>

      <button onClick={handleConfirm} disabled={!canConfirm} style={{
        width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', cursor: canConfirm ? 'pointer' : 'default',
        background: canConfirm ? '#d4a23c' : 'rgba(212,162,60,0.3)', color: '#0B1A12', fontSize: 15, fontWeight: 700,
      }}>
        {canConfirm ? 'Confirmar escalação →' : `Escolha mais ${11 - filledCount} titular${11 - filledCount > 1 ? 'es' : ''}`}
      </button>
    </div>
  );
}
