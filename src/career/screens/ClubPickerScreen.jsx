// Escolha do clube pra começar uma carreira nova — grade dos 40 clubes
// reais de 2026 (Série A + B), por divisão. Tela isolada, não reaproveita
// nem modifica o TeamPickerModal usado pelos outros modos.
import { useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { SERIE_A_2026_TEAM_IDS, SERIE_B_2026_TEAM_IDS, CAREER_CLUB_META } from '../../data/career-clubs.js';
import { startingBudgetFor } from '../engine/economy.js';

const TIER_LABEL = { elite: 'Elite', grande: 'Grande', medio: 'Médio', pequeno: 'Pequeno' };
const TIER_COLOR = { elite: '#d4a23c', grande: '#7fd99a', medio: '#9fb3a8', pequeno: '#8a8a8a' };

function formatMoney(n) {
  return 'R$ ' + (n / 1_000_000).toFixed(0) + 'M';
}

function ClubCard({ clubId, onPick }) {
  const team = TEAMS.find(t => t.id === clubId);
  const meta = CAREER_CLUB_META[clubId];
  const logo = CLUB_LOGOS[team.club];
  return (
    <button
      onClick={() => onPick(clubId)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
        color: '#F4F1EA', cursor: 'pointer', textAlign: 'left', width: '100%',
      }}
      className="mode-card-hover"
    >
      {logo ? (
        <img src={logo} alt={team.club} style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <div style={{ width: 32, height: 32, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.club}</div>
        <div style={{ fontSize: 11, opacity: 0.6, fontFamily: "'Space Mono', monospace" }}>{formatMoney(startingBudgetFor(clubId))}</div>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
        padding: '3px 7px', borderRadius: 999, flexShrink: 0,
        color: TIER_COLOR[meta.tier], border: `1px solid ${TIER_COLOR[meta.tier]}55`,
      }}>{TIER_LABEL[meta.tier]}</span>
    </button>
  );
}

export function ClubPickerScreen({ onPick, onBack }) {
  const [division, setDivision] = useState('A');
  const ids = division === 'A' ? SERIE_A_2026_TEAM_IDS : SERIE_B_2026_TEAM_IDS;
  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#d4a23c', fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: 0 }}>← Voltar</button>
      <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, marginBottom: 6 }}>Escolha seu clube</h1>
      <p style={{ fontSize: 13, opacity: 0.65, marginBottom: 16, lineHeight: 1.5 }}>
        Comece o Modo Carreira num dos 40 clubes reais da Série A ou B de 2026. Orçamento inicial e qualidade da categoria de base variam pelo tamanho do clube — mas uma joia rara pode sair em qualquer um.
      </p>
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
      <div style={{ display: 'grid', gap: 8 }}>
        {ids.map(id => <ClubCard key={id} clubId={id} onPick={onPick} />)}
      </div>
    </div>
  );
}
