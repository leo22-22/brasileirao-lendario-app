// Tabela do Modo Carreira — Série A e B lado a lado por abas, com o
// clube do usuário destacado. Série A usa as mesmas zonas coloridas de
// classificação continental que o modo clássico já tem (getZoneInfo,
// App.jsx) — Libertadores/pré-Libertadores/Sul-Americana/rebaixamento —
// mesmo sem existir um torneio de Libertadores jogável aqui (decisão de
// escopo confirmada com o usuário: só informação visual na tabela,
// inclusive a regra de vaga extra quando o campeão da Copa do Brasil já
// está no G4). Série B mantém sua própria zona (acesso direto/playoff/
// rebaixamento), que é sobre promoção, não sobre competição continental.
import { useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { getZoneInfo } from '../../App.jsx';
import { backButtonStyle } from '../components/styles.js';

function serieBZone(pos, total) {
  if (pos <= 2) return { color: 'var(--success)', label: 'Acesso', title: 'Acesso direto à Série A' };
  if (pos <= 6) return { color: 'var(--gold-ink)', label: 'Playoff', title: 'Disputa o acesso via playoff' };
  if (pos >= total - 3) return { color: 'var(--danger)', label: 'Z4', title: 'Rebaixamento' };
  return null;
}

const SERIE_A_LEGEND = [
  { color: 'var(--success)', text: 'G4 — Libertadores (fase de grupos)' },
  { color: 'var(--success)', text: 'G6 — Libertadores (pré)' },
  { color: 'var(--info)', text: 'até 12º — Sul-Americana' },
  { color: 'var(--danger)', text: 'Z4 — rebaixamento' },
];
const SERIE_B_LEGEND = [
  { color: 'var(--success)', text: '1º-2º — acesso direto à Série A' },
  { color: 'var(--gold-ink)', text: '3º-6º — disputam o acesso (playoff)' },
  { color: 'var(--danger)', text: 'Z4 — rebaixamento (sem acesso, segue/cai de divisão)' },
];

export function CareerTableScreen({ save, onBack }) {
  const myDivision = save.clubs[save.myClubId].division;
  const [division, setDivision] = useState(myDivision);
  const data = division === 'A' ? save.divisionA : save.divisionB;

  // Se o campeão da Copa do Brasil (desta carreira) já terminou a Série A
  // no G4, uma vaga extra de Libertadores abre pro 5º colocado — igual na
  // vida real. Só efeito visual (vira G4 também), sem torneio de verdade.
  const copaChampionId = save.copa?.phase === 'done' ? save.copa.champion : null;
  const copaChampionInG4 = division === 'A' && copaChampionId
    ? save.divisionA.table.slice(0, 4).some(r => r.id === copaChampionId)
    : false;

  const getZone = (pos) => {
    if (division === 'B') return serieBZone(pos, data.table.length);
    if (copaChampionInG4 && pos === 5) {
      return { color: 'var(--success)', label: 'G4', title: 'Libertadores — vaga extra (campeão da Copa do Brasil já está no G4)' };
    }
    return getZoneInfo(pos, data.table.length);
  };

  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={backButtonStyle}>← Voltar</button>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, letterSpacing: '-0.02em', fontSize: 28, marginBottom: 12 }}>Tabela</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['A', 'B'].map(d => (
          <button
            key={d}
            onClick={() => setDivision(d)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${division === d ? 'var(--gold)' : 'var(--line-strong)'}`,
              background: division === d ? 'rgba(194,154,69,0.12)' : 'transparent',
              color: division === d ? 'var(--gold-ink)' : 'var(--ink-2)',
            }}
          >Série {d}</button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ opacity: 0.5, textAlign: 'left' }}>
              <th style={{ padding: '4px 6px', fontWeight: 500 }}>#</th>
              <th style={{ padding: '4px 6px', fontWeight: 500 }}>Clube</th>
              <th style={{ padding: '4px 6px', fontWeight: 500, textAlign: 'center' }}>PJ</th>
              <th style={{ padding: '4px 6px', fontWeight: 500, textAlign: 'center' }}>V</th>
              <th style={{ padding: '4px 6px', fontWeight: 500, textAlign: 'center' }}>E</th>
              <th style={{ padding: '4px 6px', fontWeight: 500, textAlign: 'center' }}>D</th>
              <th style={{ padding: '4px 6px', fontWeight: 500, textAlign: 'center' }}>SG</th>
              <th style={{ padding: '4px 6px', fontWeight: 700, textAlign: 'center' }}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {data.table.map((row, idx) => {
              const pos = idx + 1;
              const isMe = row.id === save.myClubId;
              const team = TEAMS.find(t => t.id === row.id);
              const zone = getZone(pos);
              return (
                <tr key={row.id} style={{ background: isMe ? 'rgba(194,154,69,0.1)' : 'transparent', fontWeight: isMe ? 700 : 400 }} title={zone?.title}>
                  <td style={{ padding: '6px', borderLeft: `3px solid ${zone?.color || 'transparent'}` }}>{pos}</td>
                  <td style={{ padding: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{team?.club || row.label}</td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{row.pj}</td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{row.v}</td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{row.e}</td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{row.d}</td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{row.gp - row.gc}</td>
                  <td style={{ padding: '6px', textAlign: 'center', color: 'var(--gold-ink)' }}>{row.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(division === 'A' ? SERIE_A_LEGEND : SERIE_B_LEGEND).map(l => (
          <div key={l.text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
            {l.text}
          </div>
        ))}
        {division === 'A' && copaChampionInG4 && (
          <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>
            🏆 O campeão da Copa do Brasil está no G4 — uma vaga extra de Libertadores abriu pro 5º colocado.
          </div>
        )}
      </div>
    </div>
  );
}
