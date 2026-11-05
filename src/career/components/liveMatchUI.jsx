// Peças visuais e motor de estado compartilhados entre a partida ao vivo
// de um jogo só (CareerMatchDayScreen) e a de ida+volta (CareerTwoLegScreen)
// — extraído pra não duplicar ~100 linhas entre as duas telas.
import { useEffect, useRef, useState } from 'react';
import { CLUB_LOGOS } from '../../data/club-logos.js';

const SIM_STEP_MS = 55;
const SIM_MINUTES_PER_TICK = 2;

export function eventIcon(ev) {
  if (ev.type === 'goal') return ev.isOwnGoal ? '⚽ contra' : ev.isPenalty ? '⚽ pênalti' : '⚽';
  if (ev.type === 'yellow') return '🟨';
  if (ev.type === 'red') return '🟥';
  if (ev.type === 'injury') return '🩼';
  return '•';
}

export function eventText(ev) {
  if (ev.type === 'goal') return `${ev.scorer}${ev.assist ? ` (assist. ${ev.assist})` : ''} — ${ev.teamLabel}`;
  if (ev.type === 'yellow') return `${ev.player} — ${ev.teamLabel}`;
  if (ev.type === 'red') return `${ev.player}${ev.secondYellow ? ' (2º amarelo)' : ''} — ${ev.teamLabel}`;
  if (ev.type === 'injury') return `${ev.player} sentiu uma lesão (${ev.teamLabel}) — entra ${ev.replacementName || 'um reserva'}`;
  return '';
}

export function TeamBadge({ team }) {
  const logo = CLUB_LOGOS[team.club];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 96 }}>
      {logo ? (
        <img src={logo} alt={team.club} style={{ width: 42, height: 42, objectFit: 'contain' }} />
      ) : (
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: team.color || '#333' }} />
      )}
      <div style={{ fontSize: 11.5, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{team.club}</div>
    </div>
  );
}

export function RatingsList({ ratings, homeTeam, awayTeam }) {
  const ratingColor = r => (r >= 8 ? '#7fd99a' : r >= 6.5 ? '#d4a23c' : r >= 5 ? '#e0b050' : '#e05050');
  const Col = ({ team }) => {
    const list = ratings.filter(r => r.teamId === team.id).sort((a, b) => b.rating - a.rating);
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.club}</div>
        {list.map(p => (
          <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 11.5, marginBottom: 3 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: ratingColor(p.rating), flexShrink: 0 }}>{p.rating.toFixed(1)}</span>
          </div>
        ))}
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <Col team={homeTeam} />
      <Col team={awayTeam} />
    </div>
  );
}

// Motor de estado da simulação ao vivo de UM jogo (intro -> minuto a
// minuto -> fim) — usado tanto pro jogo isolado do Brasileirão quanto
// pra cada perna (ida/volta) de um confronto eliminatório. Quem usa deve
// remontar o componente (via `key`) ao trocar de jogo/perna, pra esse
// estado resetar sozinho em vez de arrastar o minuto/eventos do jogo
// anterior.
export function useLiveMatchPlayer(sim, homeTeam, awayTeam) {
  const [phase, setPhase] = useState('intro'); // intro | playing | done
  const [minute, setMinute] = useState(0);
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  const [shownEvents, setShownEvents] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  function skipToEnd() {
    clearInterval(timerRef.current);
    setMinute(90);
    setHomeGoals(sim.homeGoals);
    setAwayGoals(sim.awayGoals);
    setShownEvents(sim.events);
    setPhase('done');
  }

  function startPlaying() {
    setPhase('playing');
    timerRef.current = setInterval(() => {
      setMinute(m => {
        const next = Math.min(90, m + SIM_MINUTES_PER_TICK);
        const due = sim.events.filter(ev => ev.minute <= next);
        setShownEvents(due);
        setHomeGoals(due.filter(ev => ev.type === 'goal' && ev.teamId === homeTeam.id).length);
        setAwayGoals(due.filter(ev => ev.type === 'goal' && ev.teamId === awayTeam.id).length);
        if (next >= 90) {
          clearInterval(timerRef.current);
          setPhase('done');
        }
        return next;
      });
    }, SIM_STEP_MS);
  }

  const motm = [...sim.ratings].sort((a, b) => b.rating - a.rating)[0];

  return { phase, minute, homeGoals, awayGoals, shownEvents, startPlaying, skipToEnd, motm };
}

export const wrapStyle = { width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px' };
export const cardStyle = { padding: '14px 12px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' };
export const labelStyle = { fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 4 };
export const primaryBtnStyle = { width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: '#d4a23c', color: '#0B1A12', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
export const secondaryBtnStyle = { width: '100%', padding: '11px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(244,241,234,0.8)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 8 };
