// Formação do Modo Carreira — reaproveita autoFillSquadFromTeam (já
// exportado de App.jsx) pra calcular automaticamente a melhor formação e
// escalação possível pro elenco atual do clube. Não reaproveita o editor
// Squad/Pitch interativo (drag-and-drop) — aqui é uma tela de confirmação
// simples: o jogo sugere o XI matematicamente ótimo, o usuário confirma.
// A escalação confirmada (save.myStarters) passa a valer de verdade nas
// partidas simuladas (ver teamForSim em seasonEngine.js).
import { useMemo } from 'react';
import { autoFillSquadFromTeam, FORMATIONS } from '../../App.jsx';
import { posOrderIndex, ovrColor } from '../../lib/format.js';

function PlayerRow({ player }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', marginBottom: 4 }}>
      <span style={{ width: 34, fontSize: 11, opacity: 0.6, fontFamily: "'Space Mono', monospace" }}>{player.pos?.[0]}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
      {player.isYouth && <span style={{ fontSize: 10, opacity: 0.5 }}>🌱</span>}
      <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: ovrColor(player.ovr), fontSize: 13 }}>{player.ovr}</span>
    </div>
  );
}

// Fallback pra quando NENHUMA formação fecha com o elenco (acontece com
// elencos cuja distribuição de posições não bate com nenhum dos ~20
// esquemas prontos — ex.: time sem nenhum PE/ME cadastrado — a correspondência
// de `autoFillSquadFromTeam` é exata por posição, sem substituição). Em vez
// de travar a tela, escala os 11 de maior overall, na ordem de posição que
// existir, sem exigir um esquema tático específico.
function fallbackBestXI(roster) {
  const byOvrDesc = [...roster].sort((a, b) => b.ovr - a.ovr);
  const goalkeepers = byOvrDesc.filter(p => p.pos[0] === 'GOL');
  const outfield = byOvrDesc.filter(p => p.pos[0] !== 'GOL');
  const bestGol = goalkeepers[0] ? [goalkeepers[0]] : [];
  const starters = [...bestGol, ...outfield.slice(0, 11 - bestGol.length)]
    .sort((a, b) => posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]) || b.ovr - a.ovr);
  const starterNames = new Set(starters.map(p => p.name));
  const bench = byOvrDesc.filter(p => !starterNames.has(p.name));
  const totalOvr = starters.reduce((s, p) => s + p.ovr, 0);
  return { starters, bench, totalOvr, formationLabel: 'Escalação livre (por overall)' };
}

export function CareerFormationScreen({ save, onConfirm, onBack }) {
  const built = useMemo(() => {
    const roster = save.clubs[save.myClubId].roster;
    return autoFillSquadFromTeam({ id: save.myClubId, players: roster }, { fullBench: true });
  }, [save.clubs, save.myClubId]);

  const fallback = useMemo(() => {
    if (built) return null;
    return fallbackBestXI(save.clubs[save.myClubId].roster);
  }, [built, save.clubs, save.myClubId]);

  const starterSlots = built ? built.pitchSlots.filter(s => !s.isBench).sort((a, b) => posOrderIndex(a.realPos) - posOrderIndex(b.realPos)) : [];
  const benchSlots = built ? built.pitchSlots.filter(s => s.isBench) : [];
  const formationLabel = built ? (FORMATIONS[built.formationKey]?.label || built.formationKey) : fallback.formationLabel;
  const avgOvr = built ? (built.totalOvr ? Math.round(built.totalOvr / 11) : '-') : Math.round(fallback.totalOvr / 11);

  const handleConfirm = () => {
    const myStarters = built
      ? starterSlots.map(s => built.pitch[s.key]?.name).filter(Boolean)
      : fallback.starters.map(p => p.name);
    onConfirm({ myStarters, myFormationLabel: formationLabel });
  };

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#d4a23c', fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: 0 }}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 4 }}>{formationLabel}</h2>
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>Melhor combinação de esquema + titulares pro elenco atual — OVR titular médio {avgOvr}.</p>

      <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Titulares</div>
      {built
        ? starterSlots.map(s => built.pitch[s.key] && <PlayerRow key={s.key} player={built.pitch[s.key]} />)
        : fallback.starters.map(p => <PlayerRow key={p.name} player={p} />)}

      <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1, margin: '14px 0 6px' }}>Banco</div>
      {built
        ? benchSlots.map(s => built.pitch[s.key] && <PlayerRow key={s.key} player={built.pitch[s.key]} />)
        : fallback.bench.map(p => <PlayerRow key={p.name} player={p} />)}

      <button onClick={handleConfirm} style={{ width: '100%', marginTop: 20, padding: '14px 0', borderRadius: 10, border: 'none', background: '#d4a23c', color: '#0B1A12', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
        Confirmar escalação →
      </button>
    </div>
  );
}
