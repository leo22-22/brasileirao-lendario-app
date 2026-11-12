// Confronto de ida+volta do próprio usuário (mata-mata de acesso OU Copa
// do Brasil) — jogado perna por perna, cada uma com a MESMA simulação ao
// vivo minuto a minuto do jogo comum do Brasileirão, igual o usuário
// pediu explicitamente ("não é jogar os dois jogos, tem que ser igual o
// modo Copa do Brasil"). Antes era um botão só ("Jogar os 2 jogos") que
// resolvia tudo de uma vez — agora: tela da Ida (ao vivo) → tela da Volta
// (ao vivo) → resumo com agregado/pênaltis.
import { useState } from 'react';
import { LiveMatchScreen, wrapStyle, primaryBtnStyle } from '../components/liveMatchUI.jsx';

// Uma perna (ida OU volta) — reaproveita a mesma tela centralizada de
// partida ao vivo (LiveMatchScreen, com pausa+troca) do jogo comum do
// Brasileirão (CareerMatchDayScreen), só trocando o rótulo do topo e o
// texto do botão final. `key` no uso abaixo garante que o estado
// (minuto/eventos/fase) reseta sozinho ao trocar de perna.
export function LegMatch({ leg, legLabel, continueLabel, onDone, save, onApplyLineupChange }) {
  const { homeTeam, awayTeam, sim } = leg;
  return (
    <LiveMatchScreen
      sim={sim} homeTeam={homeTeam} awayTeam={awayTeam}
      label={legLabel} continueLabel={continueLabel} onFinish={onDone}
      save={save} onApplyLineupChange={onApplyLineupChange}
    />
  );
}

export function CareerTwoLegScreen({ title, subtitle, winLabel, loseLabel, prepare, onContinue, save, onApplyLineupChange }) {
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
        save={save} onApplyLineupChange={onApplyLineupChange}
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
        save={save} onApplyLineupChange={onApplyLineupChange}
      />
    );
  }

  const iWon = tieData.myAggGoals !== tieData.oppAggGoals ? tieData.myAggGoals > tieData.oppAggGoals : !!tieData.penaltyWinnerIsMe;
  return (
    <div style={{ ...wrapStyle, textAlign: 'center' }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, marginBottom: 10 }}>{title}</h2>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 20 }}>{subtitle}</p>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>Ida: {tieData.leg1.sim.homeGoals} x {tieData.leg1.sim.awayGoals}</div>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>Volta: {tieData.leg2.sim.homeGoals} x {tieData.leg2.sim.awayGoals}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Agregado: {tieData.myAggGoals} x {tieData.oppAggGoals}</div>
      {tieData.wentToPenalties && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Empate no agregado — decidido nos pênaltis.</div>}
      <div style={{ fontSize: 15, fontWeight: 700, color: iWon ? 'var(--success)' : 'var(--danger)', marginBottom: 20 }}>
        {iWon ? winLabel : loseLabel}
      </div>
      <button onClick={() => onContinue(tieData)} style={primaryBtnStyle}>Continuar →</button>
    </div>
  );
}
