// Tela de entrada do Modo Carreira quando já existe uma carreira salva —
// "Continuar" (resume exatamente de onde parou) ou "Nova carreira" (apaga
// a atual pra sempre e manda pra escolha de clube). Sem essa tela, não
// tinha nenhum jeito de recomeçar: toda entrada no Modo Carreira (card da
// home, pill do cabeçalho) carregava direto a carreira salva, sem opção.
import { useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';

function formatMoney(n) {
  return 'R$ ' + n.toLocaleString('pt-BR');
}

export function CareerStartScreen({ save, onContinue, onNewCareer, onBack }) {
  const [confirmingNew, setConfirmingNew] = useState(false);
  const team = TEAMS.find(t => t.id === save.myClubId);
  const logo = CLUB_LOGOS[team.club];
  const club = save.clubs[save.myClubId];

  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#d4a23c', fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>← Voltar ao menu</button>
      <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, marginBottom: 20, textAlign: 'center' }}>Modo Carreira</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, background: 'rgba(212,162,60,0.08)', border: '1px solid rgba(212,162,60,0.3)', marginBottom: 20 }}>
        {logo && <img src={logo} alt={team.club} style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{team.club}</div>
          <div style={{ fontSize: 12, opacity: 0.65 }}>Temporada {save.season} · {formatMoney(club.budget)}</div>
        </div>
      </div>

      <button onClick={onContinue} style={{ width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', background: '#d4a23c', color: '#0B1A12', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
        ▶ Continuar carreira
      </button>

      {!confirmingNew ? (
        <button
          onClick={() => setConfirmingNew(true)}
          style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(244,241,234,0.7)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
        >
          🆕 Começar uma carreira nova
        </button>
      ) : (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(224,80,80,0.08)', border: '1px solid rgba(224,80,80,0.3)' }}>
          <p style={{ fontSize: 12.5, marginBottom: 10 }}>Isso apaga a carreira do {team.club} pra sempre. Tem certeza?</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onNewCareer} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: '#e05050', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
              Sim, apagar e recomeçar
            </button>
            <button onClick={() => setConfirmingNew(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#F4F1EA', fontSize: 12.5, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
