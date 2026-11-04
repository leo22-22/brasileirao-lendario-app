// Painel principal do Modo Carreira — escudo/orçamento/posição/próximo
// jogo + atalhos pras outras telas (Elenco, Formação, Mercado, Tabela).
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';

function formatMoney(n) {
  return 'R$ ' + n.toLocaleString('pt-BR');
}

function myDivisionData(save) {
  const division = save.clubs[save.myClubId].division;
  return { key: division, data: division === 'A' ? save.divisionA : save.divisionB };
}

export function CareerHub({ save, onNavigate, onAdvanceRound, onExit }) {
  const team = TEAMS.find(t => t.id === save.myClubId);
  const club = save.clubs[save.myClubId];
  const logo = CLUB_LOGOS[team.club];
  const { key: divisionKey, data: division } = myDivisionData(save);
  const myPos = division.table.findIndex(r => r.id === save.myClubId) + 1;
  const nextMatches = division.fixtures[division.round] || [];
  const nextMatch = nextMatches.find(m => m.homeId === save.myClubId || m.awayId === save.myClubId);
  const seasonOver = division.round >= division.fixtures.length;

  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onExit} style={{ background: 'none', border: 'none', color: '#d4a23c', fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: 0 }}>← Sair da carreira</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        {logo && <img src={logo} alt={team.club} style={{ width: 48, height: 48, objectFit: 'contain' }} />}
        <div>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20 }}>{team.club}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>Temporada {save.season} · Série {divisionKey} · {myPos}º lugar</div>
        </div>
      </div>

      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(212,162,60,0.08)', border: '1px solid rgba(212,162,60,0.3)', marginBottom: 16 }}>
        <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Orçamento</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#d4a23c', fontFamily: "'Space Mono', monospace" }}>{formatMoney(club.budget)}</div>
      </div>

      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
        {seasonOver ? (
          <div style={{ fontSize: 13, opacity: 0.8 }}>Temporada {save.season} terminada — confira a tabela e avance pro fim de temporada.</div>
        ) : nextMatch ? (
          <>
            <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Rodada {division.round + 1}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {nextMatch.homeId === save.myClubId ? 'Você (casa)' : TEAMS.find(t => t.id === nextMatch.homeId)?.club}
              {' vs '}
              {nextMatch.awayId === save.myClubId ? 'Você (fora)' : TEAMS.find(t => t.id === nextMatch.awayId)?.club}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.6 }}>Sem jogo seu nesta rodada.</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        <button onClick={() => onNavigate('squad')} style={navBtnStyle}>👕 Elenco</button>
        <button onClick={() => onNavigate('formation')} style={navBtnStyle}>🧩 Formação</button>
        <button onClick={() => onNavigate('market')} style={navBtnStyle}>💰 Mercado</button>
        <button onClick={() => onNavigate('table')} style={navBtnStyle}>📊 Tabela</button>
      </div>

      <button onClick={onAdvanceRound} style={{
        width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: '#d4a23c', color: '#0B1A12', fontSize: 15, fontWeight: 700,
      }}>
        {seasonOver ? 'Encerrar temporada →' : 'Avançar rodada →'}
      </button>
    </div>
  );
}

const navBtnStyle = {
  padding: '14px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.03)', color: '#F4F1EA', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
