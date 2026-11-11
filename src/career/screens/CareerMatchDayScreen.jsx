// Tela de partida ao vivo do Modo Carreira — mostrada sempre que
// `save.pendingUserMatch` existe (ver advanceDay/resolveUserMatch em
// seasonEngine.js), e reaproveitada pra FINAL da Copa do Brasil (jogo
// único, ver `pendingUserCopaTie.finalMatch` em copaEngine.js/CareerApp.jsx)
// passando `pending`/`competitionLabel` por fora em vez dos valores padrão
// do Brasileirão. O resultado já vem pré-calculado (mesma seed que a
// rodada/partida usaria) — essa tela só ANIMA os eventos minuto a minuto,
// igual a simulação ao vivo dos outros modos, e no fim mostra as notas dos
// jogadores. "Continuar" chama `onFinish`, que resolve o que tiver que
// resolver (a rodada inteira, ou a Copa) e aplica no save de verdade.
import {
  eventIcon, eventText, TeamBadge, RatingsList, useLiveMatchPlayer, MatchSpeedPicker,
  wrapStyle, cardStyle, labelStyle, primaryBtnStyle, secondaryBtnStyle,
} from '../components/liveMatchUI.jsx';

const EMPTY_PENDING = { homeTeam: { club: '' }, awayTeam: { club: '' }, sim: { homeGoals: 0, awayGoals: 0, ratings: [], events: [] } };

export function CareerMatchDayScreen({ save, onFinish, pending: pendingOverride, competitionLabel: labelOverride }) {
  const pending = pendingOverride || save.pendingUserMatch;
  // O hook precisa ser chamado incondicionalmente (regra dos hooks) — usa
  // um "pending" vazio quando ainda não existe, e só sai de verdade DEPOIS
  // da chamada (na prática o pai só monta essa tela quando pendingUserMatch
  // já existe, então esse fallback nunca aparece pro usuário).
  const { homeTeam, awayTeam, sim } = pending || EMPTY_PENDING;
  const division = save.clubs[save.myClubId].division;
  const competitionLabel = labelOverride || `Campeonato Brasileiro · Série ${division}`;
  const { phase, minute, homeGoals, awayGoals, shownEvents, startPlaying, skipToEnd, motm, speedKey, changeSpeed } = useLiveMatchPlayer(sim, homeTeam, awayTeam);
  if (!pending) return null;

  if (phase === 'intro') {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <div style={labelStyle}>{competitionLabel}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '20px 0 24px' }}>
            <TeamBadge team={homeTeam} />
            <div style={{ fontSize: 13, opacity: 0.4, fontWeight: 700 }}>x</div>
            <TeamBadge team={awayTeam} />
          </div>
        </div>
        <button onClick={startPlaying} style={primaryBtnStyle}>▶ Jogar partida</button>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={labelStyle}>{competitionLabel}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '8px 0 4px' }}>
          <TeamBadge team={homeTeam} />
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 30, fontWeight: 700 }}>{homeGoals} - {awayGoals}</div>
          <TeamBadge team={awayTeam} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{ textAlign: 'center', fontSize: 12, opacity: 0.6, fontFamily: "'Space Mono', monospace" }}>
            {phase === 'playing' ? `${minute}'` : 'Fim de jogo'}
          </div>
          {phase === 'playing' && <MatchSpeedPicker speedKey={speedKey} onChange={changeSpeed} />}
        </div>
      </div>

      <div style={{ minHeight: 140, marginBottom: 16, display: 'grid', gap: 6, padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
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
          {motm && (
            <div style={{ textAlign: 'center', background: 'rgba(212,162,60,0.1)', border: '1px solid rgba(212,162,60,0.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 14, fontSize: 13 }}>
              🌟 Craque da partida: <b style={{ color: '#d4a23c' }}>{motm.name}</b>{' '}
              <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>{motm.rating.toFixed(1)}</span>
            </div>
          )}
          <RatingsList ratings={sim.ratings} homeTeam={homeTeam} awayTeam={awayTeam} />
          <button onClick={onFinish} style={{ ...primaryBtnStyle, marginTop: 4 }}>Continuar →</button>
        </>
      )}
    </div>
  );
}
