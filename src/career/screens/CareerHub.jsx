// Painel principal do Modo Carreira — escudo/orçamento/posição/próximo
// jogo + atalhos pras outras telas (Elenco, Formação, Mercado, Tabela).
// "Avançar" pula os dias sem nada sozinho e só para num dia de jogo, numa
// proposta de negociação nova, ou no fim da temporada.
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { formatCalendarDay } from '../engine/calendar.js';
import { TransferWindowBadge } from '../components/TransferWindowBadge.jsx';

function formatMoney(n) {
  return 'R$ ' + n.toLocaleString('pt-BR');
}

function myDivisionData(save) {
  const division = save.clubs[save.myClubId].division;
  return { key: division, data: division === 'A' ? save.divisionA : save.divisionB };
}

function eventLine(ev, myClubId) {
  if (ev.type === 'match') {
    const isHome = ev.homeId === myClubId;
    const oppId = isHome ? ev.awayId : ev.homeId;
    const oppTeam = TEAMS.find(t => t.id === oppId);
    const myTeam = TEAMS.find(t => t.id === myClubId);
    const myGoals = isHome ? ev.homeGoals : ev.awayGoals;
    const oppGoals = isHome ? ev.awayGoals : ev.homeGoals;
    const result = myGoals > oppGoals ? '🟢' : myGoals < oppGoals ? '🔴' : '🟡';
    return `${result} ${myTeam?.club || ''} ${myGoals} x ${oppGoals} ${oppTeam?.club || ''}`;
  }
  if (ev.type === 'transfer-ai') {
    const from = TEAMS.find(t => t.id === ev.fromClubId);
    const to = TEAMS.find(t => t.id === ev.toClubId);
    return `🔄 ${from?.club} comprou ${ev.playerName} do ${to?.club} por ${formatMoney(ev.amount)}`;
  }
  if (ev.type === 'offer') {
    return `📨 Proposta recebida pelo ${ev.playerName}`;
  }
  if (ev.type === 'copa-round') {
    return `🏆 Copa do Brasil — ${ev.roundLabel} resolvida`;
  }
  return null;
}

export function CareerHub({ save, onNavigate, onAdvanceDay, onSimulateSeason, onExit }) {
  const team = TEAMS.find(t => t.id === save.myClubId);
  const club = save.clubs[save.myClubId];
  const logo = CLUB_LOGOS[team.club];
  const { key: divisionKey, data: division } = myDivisionData(save);
  const myPos = division.table.findIndex(r => r.id === save.myClubId) + 1;
  const nextMatches = division.fixtures[division.round] || [];
  const nextMatch = nextMatches.find(m => m.homeId === save.myClubId || m.awayId === save.myClubId);
  const seasonOver = division.round >= division.fixtures.length;
  const offerCount = save.pendingOffers?.length || 0;
  const dayEvents = (save.lastDayEvents || []).map(ev => eventLine(ev, save.myClubId)).filter(Boolean);

  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onExit} style={{ background: 'none', border: 'none', color: '#d4a23c', fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: 0 }}>← Sair da carreira</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        {logo && <img src={logo} alt={team.club} style={{ width: 48, height: 48, objectFit: 'contain' }} />}
        <div>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20 }}>{team.club}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>{formatCalendarDay(save.calendarDay)} · Temporada {save.season} · Série {divisionKey} · {myPos}º lugar</div>
        </div>
      </div>

      <TransferWindowBadge day={save.calendarDay} style={{ marginBottom: 12 }} />

      {dayEvents.length > 0 && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>O que aconteceu</div>
          {dayEvents.map((line, i) => (
            <div key={i} style={{ fontSize: 12.5, marginBottom: i < dayEvents.length - 1 ? 4 : 0, lineHeight: 1.4 }}>{line}</div>
          ))}
        </div>
      )}

      {offerCount > 0 && (
        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(212,162,60,0.1)', border: '1px solid rgba(212,162,60,0.3)', marginBottom: 12, fontSize: 12, color: '#d4a23c', fontWeight: 600, cursor: 'pointer' }} onClick={() => onNavigate('market')}>
          📨 {offerCount} proposta{offerCount > 1 ? 's' : ''} esperando resposta — toque pra ver
        </div>
      )}

      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(212,162,60,0.08)', border: '1px solid rgba(212,162,60,0.3)', marginBottom: 16 }}>
        <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Orçamento</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#d4a23c', fontFamily: "'Space Mono', monospace" }}>{formatMoney(club.budget)}</div>
      </div>

      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
        {seasonOver ? (
          <div style={{ fontSize: 13, opacity: 0.8 }}>Temporada {save.season} terminada — confira a tabela e avance pro fim de temporada.</div>
        ) : nextMatch ? (
          <>
            <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Rodada {division.round + 1} · {formatCalendarDay(save.seasonCalendar[division.round])}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {TEAMS.find(t => t.id === nextMatch.homeId)?.club}
              {' vs '}
              {TEAMS.find(t => t.id === nextMatch.awayId)?.club}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.6 }}>Sem jogo seu nesta rodada.</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        <button onClick={() => onNavigate('squad')} style={navBtnStyle}>👕 Elenco</button>
        <button onClick={() => onNavigate('formation')} style={navBtnStyle}>🧩 Formação</button>
        <button onClick={() => onNavigate('market')} style={navBtnStyle}>💰 Mercado{offerCount > 0 ? ` (${offerCount})` : ''}</button>
        <button onClick={() => onNavigate('table')} style={navBtnStyle}>📊 Tabela</button>
        <button onClick={() => onNavigate('calendar')} style={navBtnStyle}>📅 Calendário</button>
        <button onClick={() => onNavigate('copa')} style={navBtnStyle}>🏆 Copa do Brasil</button>
      </div>

      <button onClick={onAdvanceDay} disabled={offerCount > 0} style={{
        width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', cursor: offerCount > 0 ? 'default' : 'pointer',
        background: offerCount > 0 ? 'rgba(212,162,60,0.3)' : '#d4a23c', color: '#0B1A12', fontSize: 15, fontWeight: 700, marginBottom: 8,
      }}>
        {offerCount > 0 ? 'Responda as propostas primeiro' : seasonOver ? 'Encerrar temporada →' : 'Avançar →'}
      </button>
      {!seasonOver && (
        <button onClick={onSimulateSeason} disabled={offerCount > 0} style={{
          width: '100%', padding: '11px 0', borderRadius: 10, cursor: offerCount > 0 ? 'default' : 'pointer',
          border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(244,241,234,0.7)', fontSize: 12.5, fontWeight: 600,
        }}>
          ⏩ Simular temporada até o fim
        </button>
      )}
    </div>
  );
}

const navBtnStyle = {
  padding: '14px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.03)', color: '#F4F1EA', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
