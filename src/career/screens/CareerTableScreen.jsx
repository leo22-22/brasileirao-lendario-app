// Tabela do Modo Carreira — Série A e B lado a lado por abas, com o
// clube do usuário destacado e a zona de acesso/queda marcada.
import { useState } from 'react';
import { TEAMS } from '../../data/teams.js';

function zoneColor(pos, division) {
  if (division === 'A' && pos > 16) return '#e05050'; // 17-20: zona de rebaixamento
  if (division === 'B') {
    if (pos <= 2) return '#7fd99a'; // acesso direto
    if (pos <= 6) return '#d4a23c'; // zona de playoff de acesso
  }
  return 'transparent';
}

export function CareerTableScreen({ save, onBack }) {
  const myDivision = save.clubs[save.myClubId].division;
  const [division, setDivision] = useState(myDivision);
  const data = division === 'A' ? save.divisionA : save.divisionB;

  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#d4a23c', fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: 0 }}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 12 }}>Tabela</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['A', 'B'].map(d => (
          <button
            key={d}
            onClick={() => setDivision(d)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${division === d ? '#d4a23c' : 'rgba(255,255,255,0.15)'}`,
              background: division === d ? 'rgba(212,162,60,0.12)' : 'transparent',
              color: division === d ? '#d4a23c' : 'rgba(244,241,234,0.6)',
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
              return (
                <tr key={row.id} style={{ background: isMe ? 'rgba(212,162,60,0.1)' : 'transparent', fontWeight: isMe ? 700 : 400 }}>
                  <td style={{ padding: '6px', borderLeft: `3px solid ${zoneColor(pos, division)}` }}>{pos}</td>
                  <td style={{ padding: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{team?.club || row.label}</td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{row.pj}</td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{row.v}</td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{row.e}</td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{row.d}</td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>{row.gp - row.gc}</td>
                  <td style={{ padding: '6px', textAlign: 'center', color: '#d4a23c' }}>{row.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {division === 'B' && (
        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 10 }}>🟢 1º-2º sobem direto · 🟡 3º-6º disputam o acesso</p>
      )}
      {division === 'A' && (
        <p style={{ fontSize: 11, opacity: 0.5, marginTop: 10 }}>🔴 17º-20º caem pra Série B</p>
      )}
    </div>
  );
}
