// Tela de partida ao vivo do Modo Carreira — mostrada sempre que
// `save.pendingUserMatch` existe (ver advanceDay/resolveUserMatch em
// seasonEngine.js). O resultado já vem pré-calculado (mesma seed que a
// rodada usaria) — essa tela só ANIMA os eventos minuto a minuto, igual a
// simulação ao vivo dos outros modos, e no fim mostra as notas dos
// jogadores. "Continuar" chama `onFinish`, que resolve a rodada inteira
// (esse jogo + todos os outros) e aplica no save de verdade.
import { useEffect, useRef, useState } from 'react';
import { CLUB_LOGOS } from '../../data/club-logos.js';

const SIM_STEP_MS = 55;
const SIM_MINUTES_PER_TICK = 2;

function eventIcon(ev) {
  if (ev.type === 'goal') return ev.isOwnGoal ? '⚽ contra' : ev.isPenalty ? '⚽ pênalti' : '⚽';
  if (ev.type === 'yellow') return '🟨';
  if (ev.type === 'red') return '🟥';
  if (ev.type === 'injury') return '🩼';
  return '•';
}

function eventText(ev) {
  if (ev.type === 'goal') return `${ev.scorer}${ev.assist ? ` (assist. ${ev.assist})` : ''} — ${ev.teamLabel}`;
  if (ev.type === 'yellow') return `${ev.player} — ${ev.teamLabel}`;
  if (ev.type === 'red') return `${ev.player}${ev.secondYellow ? ' (2º amarelo)' : ''} — ${ev.teamLabel}`;
  if (ev.type === 'injury') return `${ev.player} sentiu uma lesão (${ev.teamLabel}) — entra ${ev.replacementName || 'um reserva'}`;
  return '';
}

function TeamBadge({ team }) {
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

function RatingsList({ ratings, homeTeam, awayTeam }) {
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

export function CareerMatchDayScreen({ save, onFinish }) {
  const pending = save.pendingUserMatch;
  const [phase, setPhase] = useState('intro'); // intro | playing | done
  const [minute, setMinute] = useState(0);
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  const [shownEvents, setShownEvents] = useState([]);
  const [showRatings, setShowRatings] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  if (!pending) return null;
  const { homeTeam, awayTeam, sim } = pending;
  const division = save.clubs[save.myClubId].division;
  const competitionLabel = `Campeonato Brasileiro · Série ${division}`;

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

  if (phase === 'intro') {
    return (
      <div style={wrapStyle}>
        <div style={labelStyle}>{competitionLabel}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '28px 0 32px' }}>
          <TeamBadge team={homeTeam} />
          <div style={{ fontSize: 13, opacity: 0.4, fontWeight: 700 }}>x</div>
          <TeamBadge team={awayTeam} />
        </div>
        <button onClick={startPlaying} style={primaryBtnStyle}>▶ Jogar partida</button>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={labelStyle}>{competitionLabel}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 4 }}>
        <TeamBadge team={homeTeam} />
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 30, fontWeight: 700 }}>{homeGoals} - {awayGoals}</div>
        <TeamBadge team={awayTeam} />
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, opacity: 0.6, margin: '6px 0 16px', fontFamily: "'Space Mono', monospace" }}>
        {phase === 'playing' ? `${minute}'` : 'Fim de jogo'}
      </div>

      <div style={{ minHeight: 140, marginBottom: 16, display: 'grid', gap: 6 }}>
        {shownEvents.length === 0 && phase === 'playing' && (
          <div style={{ textAlign: 'center', fontSize: 12, opacity: 0.4, padding: '20px 0' }}>Bola rolando...</div>
        )}
        {[...shownEvents].reverse().map((ev, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, padding: '5px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
            <span style={{ width: 28, opacity: 0.5, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{ev.minute}'</span>
            <span>{eventIcon(ev)}</span>
            <span style={{ flex: 1 }}>{eventText(ev)}</span>
          </div>
        ))}
      </div>

      {phase === 'playing' && (
        <button onClick={skipToEnd} style={secondaryBtnStyle}>⏭ Pular pro resultado</button>
      )}

      {phase === 'done' && (
        <>
          <button onClick={() => setShowRatings(s => !s)} style={secondaryBtnStyle}>
            {showRatings ? 'Ocultar notas' : '📋 Ver notas dos jogadores'}
          </button>
          {showRatings && <RatingsList ratings={sim.ratings} homeTeam={homeTeam} awayTeam={awayTeam} />}
          <button onClick={onFinish} style={{ ...primaryBtnStyle, marginTop: 4 }}>Continuar →</button>
        </>
      )}
    </div>
  );
}

const wrapStyle = { width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px' };
const labelStyle = { fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 4 };
const primaryBtnStyle = { width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: '#d4a23c', color: '#0B1A12', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
const secondaryBtnStyle = { width: '100%', padding: '11px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(244,241,234,0.8)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 8 };
