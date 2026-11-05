// Copa do Brasil do Modo Carreira — fase atual, confrontos dela (com o
// clube do usuário destacado) e banner de campeão quando termina. Não
// guarda histórico de rodadas já jogadas (só a fase ATUAL, que vai sendo
// substituída pela próxima a cada avanço — ver copaEngine.js); decisão de
// simplicidade, igual a calendário da Copa não existir ainda na vida real
// deste save antes da fase ser jogada.
import { TEAMS } from '../../data/teams.js';
import { formatCalendarDay } from '../engine/calendar.js';
import { COPA_ROUND_LABELS } from '../engine/copaEngine.js';
import { backButtonStyle } from '../components/styles.js';

export function CareerCopaScreen({ save, onBack }) {
  const copa = save.copa;
  const myClubId = save.myClubId;
  const roundLabel = COPA_ROUND_LABELS[copa.round];

  if (copa.phase === 'done') {
    const championTeam = TEAMS.find(t => t.id === copa.champion);
    const iAmChampion = copa.champion === myClubId;
    return (
      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
        <button onClick={onBack} style={backButtonStyle}>← Voltar</button>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 16 }}>Copa do Brasil</h2>
        <div style={{ textAlign: 'center', padding: '32px 16px', borderRadius: 14, background: iAmChampion ? 'rgba(212,162,60,0.1)' : 'rgba(255,255,255,0.03)', border: iAmChampion ? '1px solid rgba(212,162,60,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{championTeam?.club}</div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            {iAmChampion ? 'Você é o campeão da Copa do Brasil desta temporada!' : 'Campeão da Copa do Brasil desta temporada.'}
          </div>
        </div>
      </div>
    );
  }

  const myInBye = copa.round === 0 && copa.byeIds?.includes(myClubId);
  const myTie = copa.ties.find(t => t.aId === myClubId || t.bId === myClubId);
  const stillIn = myInBye || !!myTie;

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={backButtonStyle}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 4 }}>Copa do Brasil</h2>
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>{roundLabel} · {formatCalendarDay(copa.calendar[copa.round])}</p>

      {!stillIn && (
        <p style={{ fontSize: 12.5, color: '#e05050', marginBottom: 12 }}>Seu clube já foi eliminado nessa edição da Copa.</p>
      )}
      {myInBye && (
        <p style={{ fontSize: 12.5, color: '#7fd99a', marginBottom: 12 }}>Seu clube folga nessa fase — entra direto na fase seguinte.</p>
      )}

      <div style={{ display: 'grid', gap: 6 }}>
        {copa.ties.map((tie, i) => {
          const isMine = tie.aId === myClubId || tie.bId === myClubId;
          const aTeam = TEAMS.find(t => t.id === tie.aId);
          const bTeam = TEAMS.find(t => t.id === tie.bId);
          return (
            <div key={i} style={{
              padding: '9px 12px', borderRadius: 10, fontSize: 13, fontWeight: isMine ? 700 : 400,
              border: isMine ? '1px solid rgba(212,162,60,0.5)' : '1px solid rgba(255,255,255,0.08)',
              background: isMine ? 'rgba(212,162,60,0.1)' : 'rgba(255,255,255,0.03)',
            }}>
              {aTeam?.club} <span style={{ opacity: 0.5, fontWeight: 400 }}>x</span> {bTeam?.club}
            </div>
          );
        })}
      </div>
    </div>
  );
}
