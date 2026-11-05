// Calendário da temporada do Modo Carreira — as 38 rodadas da divisão do
// usuário, data de cada uma, adversário e placar (já jogadas) ou "a
// jogar" (ainda não chegou a vez). Complementa a tabela: a tabela mostra
// a classificação acumulada, aqui mostra rodada a rodada, igual o
// calendário que os outros modos já têm pro Brasileirão/Copa do Brasil.
import { TEAMS } from '../../data/teams.js';
import { formatCalendarDay } from '../engine/calendar.js';
import { backButtonStyle } from '../components/styles.js';

export function CareerCalendarScreen({ save, onBack }) {
  const myDivisionKey = save.clubs[save.myClubId].division === 'A' ? 'divisionA' : 'divisionB';
  const division = save[myDivisionKey];
  const myTeam = TEAMS.find(t => t.id === save.myClubId);

  const rounds = division.fixtures.map((matches, roundIdx) => {
    const myMatch = matches.find(m => m.homeId === save.myClubId || m.awayId === save.myClubId);
    if (!myMatch) return null;
    const isHome = myMatch.homeId === save.myClubId;
    const oppId = isHome ? myMatch.awayId : myMatch.homeId;
    const oppTeam = TEAMS.find(t => t.id === oppId);
    const played = roundIdx < division.round;
    // `results` só existe em saves criados depois dessa tela — saves
    // antigos (de antes dela) não têm o histórico das rodadas já
    // jogadas, então só o placar fica indisponível, sem quebrar a tela.
    const result = played ? (division.results?.[roundIdx] || []).find(r => r.homeId === myMatch.homeId && r.awayId === myMatch.awayId) : null;
    return { roundIdx, day: save.seasonCalendar[roundIdx], isHome, oppTeam, played, result, isNext: roundIdx === division.round };
  }).filter(Boolean);

  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={backButtonStyle}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 4 }}>Calendário da temporada {save.season}</h2>
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>Série {save.clubs[save.myClubId].division} · {rounds.filter(r => r.played).length}/{rounds.length} rodadas jogadas.</p>

      <div style={{ display: 'grid', gap: 6 }}>
        {rounds.map(r => (
          <div key={r.roundIdx} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10,
            border: r.isNext ? '1px solid rgba(212,162,60,0.5)' : '1px solid rgba(255,255,255,0.08)',
            background: r.isNext ? 'rgba(212,162,60,0.1)' : 'rgba(255,255,255,0.03)',
          }}>
            <div style={{ width: 54, fontSize: 11, opacity: 0.55, fontFamily: "'Space Mono', monospace" }}>{formatCalendarDay(r.day)}</div>
            <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.isHome ? myTeam?.club : r.oppTeam?.club} <span style={{ opacity: 0.5, fontWeight: 400 }}>x</span> {r.isHome ? r.oppTeam?.club : myTeam?.club}
            </div>
            {r.played && r.result ? (
              <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, color: '#d4a23c' }}>{r.result.homeGoals} - {r.result.awayGoals}</div>
            ) : r.played ? (
              <div style={{ fontSize: 11, opacity: 0.4 }}>jogada</div>
            ) : r.isNext ? (
              <div style={{ fontSize: 11, fontWeight: 700, color: '#d4a23c' }}>próxima</div>
            ) : (
              <div style={{ fontSize: 11, opacity: 0.4 }}>a jogar</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
