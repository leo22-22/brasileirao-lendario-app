// Confronto de ida+volta do próprio usuário (mata-mata de acesso OU Copa
// do Brasil) — jogado perna por perna, cada uma com a MESMA simulação ao
// vivo minuto a minuto do jogo comum do Brasileirão, igual o usuário
// pediu explicitamente ("não é jogar os dois jogos, tem que ser igual o
// modo Copa do Brasil"). Antes era um botão só ("Jogar os 2 jogos") que
// resolvia tudo de uma vez — agora: tela da Ida (ao vivo) → tela da Volta
// (ao vivo) → resumo com agregado/pênaltis.
import { useState } from 'react';
import {
  eventIcon, eventText, TeamBadge, RatingsList, useLiveMatchPlayer,
  wrapStyle, cardStyle, labelStyle, primaryBtnStyle, secondaryBtnStyle,
} from '../components/liveMatchUI.jsx';

// Uma perna (ida OU volta) — reaproveita o mesmo motor/visual do jogo
// comum do Brasileirão (CareerMatchDayScreen), só trocando o rótulo do
// topo e o texto do botão final. `key` no uso abaixo garante que o estado
// (minuto/eventos/fase) reseta sozinho ao trocar de perna.
function LegMatch({ leg, legLabel, continueLabel, onDone }) {
  const { homeTeam, awayTeam, sim } = leg;
  const { phase, minute, homeGoals, awayGoals, shownEvents, startPlaying, skipToEnd, motm } = useLiveMatchPlayer(sim, homeTeam, awayTeam);

  if (phase === 'intro') {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <div style={labelStyle}>{legLabel}</div>
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
        <div style={labelStyle}>{legLabel}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '8px 0 4px' }}>
          <TeamBadge team={homeTeam} />
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 30, fontWeight: 700 }}>{homeGoals} - {awayGoals}</div>
          <TeamBadge team={awayTeam} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, opacity: 0.6, fontFamily: "'Space Mono', monospace" }}>
          {phase === 'playing' ? `${minute}'` : 'Fim de jogo'}
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
          <button onClick={onDone} style={{ ...primaryBtnStyle, marginTop: 4 }}>{continueLabel}</button>
        </>
      )}
    </div>
  );
}

export function CareerTwoLegScreen({ title, subtitle, winLabel, loseLabel, prepare, onContinue }) {
  const [tieData] = useState(prepare);
  const [legIndex, setLegIndex] = useState(0); // 0 = ida, 1 = volta, 2 = resumo

  if (legIndex === 0) {
    return (
      <LegMatch
        key="leg1"
        leg={tieData.leg1}
        legLabel={`${title} · Jogo de Ida`}
        continueLabel="Continuar pro jogo de volta →"
        onDone={() => setLegIndex(1)}
      />
    );
  }
  if (legIndex === 1) {
    return (
      <LegMatch
        key="leg2"
        leg={tieData.leg2}
        legLabel={`${title} · Jogo de Volta`}
        continueLabel="Ver resultado do confronto →"
        onDone={() => setLegIndex(2)}
      />
    );
  }

  const iWon = tieData.myAggGoals !== tieData.oppAggGoals ? tieData.myAggGoals > tieData.oppAggGoals : !!tieData.penaltyWinnerIsMe;
  return (
    <div style={{ ...wrapStyle, textAlign: 'center' }}>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, marginBottom: 10 }}>{title}</h2>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 20 }}>{subtitle}</p>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>Ida: {tieData.leg1.sim.homeGoals} x {tieData.leg1.sim.awayGoals}</div>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>Volta: {tieData.leg2.sim.homeGoals} x {tieData.leg2.sim.awayGoals}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Agregado: {tieData.myAggGoals} x {tieData.oppAggGoals}</div>
      {tieData.wentToPenalties && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Empate no agregado — decidido nos pênaltis.</div>}
      <div style={{ fontSize: 15, fontWeight: 700, color: iWon ? '#7fd99a' : '#e05050', marginBottom: 20 }}>
        {iWon ? winLabel : loseLabel}
      </div>
      <button onClick={() => onContinue(tieData)} style={primaryBtnStyle}>Continuar →</button>
    </div>
  );
}
