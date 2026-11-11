// Tela de entrada do Modo Carreira quando já existe uma carreira ativa —
// "Continuar" (resume exatamente de onde parou), "Nova carreira" (cria
// mais uma carreira do zero, num slot próprio — pedido explícito do
// usuário 2026-11-12: "permita criar mais de uma carreira", NUNCA MAIS
// apaga a atual) ou "Carregar outra carreira" (troca pra qualquer uma já
// salva, ver CareerLoadScreen.jsx). Sem essa tela, não tinha nenhum jeito
// de recomeçar: toda entrada no Modo Carreira (card da home, pill do
// cabeçalho) carregava direto a carreira ativa, sem opção.
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { backButtonStyle } from '../components/styles.js';

function formatMoney(n) {
  return 'R$ ' + n.toLocaleString('pt-BR');
}

export function CareerStartScreen({ save, onContinue, onNewCareer, onOpenLoad, onBack }) {
  const team = TEAMS.find(t => t.id === save.myClubId);
  const logo = CLUB_LOGOS[team.club];
  const club = save.clubs[save.myClubId];

  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={{ ...backButtonStyle, marginBottom: 20 }}>← Voltar ao menu</button>
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

      <button
        onClick={onOpenLoad}
        style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: '1px solid rgba(111,184,224,0.35)', background: 'rgba(111,184,224,0.08)', color: '#6fb8e0', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}
      >
        📂 Carregar outra carreira
      </button>

      <button
        onClick={onNewCareer}
        style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(244,241,234,0.7)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
      >
        🆕 Começar uma carreira nova
      </button>
    </div>
  );
}
