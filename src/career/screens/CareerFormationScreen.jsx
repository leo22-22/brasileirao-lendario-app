// Formação do Modo Carreira — edição livre: o usuário escolhe quais 11
// jogadores do elenco começam titulares, tocando em qualquer jogador pra
// alternar entre titular/banco, livremente e quantas vezes quiser durante
// a temporada (reaberto a qualquer momento pelo hub). Reaproveita
// autoFillSquadFromTeam só pra sugerir um XI inicial automático — depois
// disso a escolha é inteiramente manual, sem exigir um esquema tático
// específico. A escalação confirmada (save.myStarters) passa a valer de
// verdade nas partidas simuladas (ver teamForSim em seasonEngine.js).
import { useMemo, useState } from 'react';
import { autoFillSquadFromTeam } from '../../App.jsx';
import { posOrderIndex, ovrColor } from '../../lib/format.js';

// Fallback pra quando NENHUMA formação fecha com o elenco (acontece com
// elencos cuja distribuição de posições não bate com nenhum dos ~20
// esquemas prontos — ex.: time sem nenhum PE/ME cadastrado — a correspondência
// de `autoFillSquadFromTeam` é exata por posição, sem substituição): sugere
// os 11 de maior overall (1 goleiro + os 10 melhores de linha) como ponto
// de partida pro usuário ajustar à vontade.
function suggestBestXINames(roster) {
  const byOvrDesc = [...roster].sort((a, b) => b.ovr - a.ovr);
  const goalkeepers = byOvrDesc.filter(p => p.pos[0] === 'GOL');
  const outfield = byOvrDesc.filter(p => p.pos[0] !== 'GOL');
  const bestGol = goalkeepers[0] ? [goalkeepers[0]] : [];
  return [...bestGol, ...outfield.slice(0, 11 - bestGol.length)].map(p => p.name);
}

function suggestedStarterNames(roster) {
  const built = autoFillSquadFromTeam({ id: 'tmp', players: roster }, { fullBench: true });
  if (built) {
    return built.pitchSlots.filter(s => !s.isBench).map(s => built.pitch[s.key]?.name).filter(Boolean);
  }
  return suggestBestXINames(roster);
}

function PlayerRow({ player, isStarter, onToggle, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, width: '100%',
        border: isStarter ? '1px solid rgba(212,162,60,0.5)' : '1px solid rgba(255,255,255,0.08)',
        background: isStarter ? 'rgba(212,162,60,0.12)' : 'rgba(255,255,255,0.03)',
        color: '#F4F1EA', marginBottom: 4, cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span style={{ width: 34, fontSize: 11, opacity: 0.6, fontFamily: "'Space Mono', monospace" }}>{player.pos?.[0]}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
      {player.isYouth && <span style={{ fontSize: 10, opacity: 0.5 }}>🌱</span>}
      <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: ovrColor(player.ovr), fontSize: 13 }}>{player.ovr}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: isStarter ? '#d4a23c' : 'rgba(244,241,234,0.4)', minWidth: 46, textAlign: 'right' }}>
        {isStarter ? 'TITULAR' : 'banco'}
      </span>
    </button>
  );
}

export function CareerFormationScreen({ save, onConfirm, onBack }) {
  const roster = save.clubs[save.myClubId].roster;
  const sortedRoster = useMemo(
    () => [...roster].sort((a, b) => posOrderIndex(a.pos?.[0]) - posOrderIndex(b.pos?.[0]) || b.ovr - a.ovr),
    [roster]
  );

  const initialStarters = useMemo(() => {
    if (save.myStarters?.length) {
      const names = new Set(roster.map(p => p.name));
      const valid = save.myStarters.filter(n => names.has(n));
      if (valid.length) return valid;
    }
    return suggestedStarterNames(roster);
  }, [save.myStarters, roster]);

  const [starters, setStarters] = useState(initialStarters);
  const avgOvr = starters.length
    ? Math.round(starters.reduce((s, n) => s + (roster.find(p => p.name === n)?.ovr || 0), 0) / starters.length)
    : '-';

  const toggle = (name) => {
    setStarters(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name);
      if (prev.length >= 11) return prev;
      return [...prev, name];
    });
  };

  const handleSuggest = () => setStarters(suggestedStarterNames(roster));
  const handleConfirm = () => onConfirm({ myStarters: starters, myFormationLabel: 'Escalação personalizada' });

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#d4a23c', fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: 0 }}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 4 }}>Escalação</h2>
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>Toque em qualquer jogador pra colocar ou tirar do time titular — edite quantas vezes quiser durante a temporada. OVR titular médio {avgOvr}.</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: starters.length === 11 ? '#7fd99a' : '#d4a23c' }}>Titulares: {starters.length}/11</div>
        <button onClick={handleSuggest} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999, padding: '5px 10px', fontSize: 11, color: 'rgba(244,241,234,0.7)', cursor: 'pointer' }}>
          🪄 Sugerir automaticamente
        </button>
      </div>

      <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Elenco completo</div>
      {sortedRoster.map(p => (
        <PlayerRow
          key={p.name}
          player={p}
          isStarter={starters.includes(p.name)}
          disabled={!starters.includes(p.name) && starters.length >= 11}
          onToggle={() => toggle(p.name)}
        />
      ))}

      <button onClick={handleConfirm} disabled={starters.length !== 11} style={{
        width: '100%', marginTop: 16, padding: '14px 0', borderRadius: 10, border: 'none', cursor: starters.length === 11 ? 'pointer' : 'default',
        background: starters.length === 11 ? '#d4a23c' : 'rgba(212,162,60,0.3)', color: '#0B1A12', fontSize: 15, fontWeight: 700,
      }}>
        {starters.length === 11 ? 'Confirmar escalação →' : `Escolha mais ${11 - starters.length} titular${11 - starters.length > 1 ? 'es' : ''}`}
      </button>
    </div>
  );
}
