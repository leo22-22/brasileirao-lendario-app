// Confronto do próprio usuário na Copa do Brasil — perna por perna EM DIAS
// DE CALENDÁRIO DIFERENTES (pedido explícito do usuário, 2026-11-09: "ta
// simulando os dois um seguinte do outro e nao e assim na pratica"). Cada
// visita aqui mostra UMA perna só (ida OU volta, nunca as duas na mesma
// sessão) — diferente de CareerTwoLegScreen.jsx (mata-mata de acesso, que
// continua ida→volta→resumo numa visita só, fora de escopo desse pedido).
// Reaproveita o mesmo `LegMatch` (simulação ao vivo minuto a minuto) de lá.
import { useState } from 'react';
import { LegMatch } from './CareerTwoLegScreen.jsx';
import { wrapStyle, primaryBtnStyle } from '../components/liveMatchUI.jsx';

export function CareerCopaLegScreen({ title, leg, leg1Result, prepare, onDoneIda, onDoneVolta, save, onApplyLineupChange }) {
  const [legData] = useState(prepare);
  const [showSummary, setShowSummary] = useState(false);

  if (leg === 'ida') {
    return (
      <LegMatch
        key="copa-ida"
        leg={legData}
        legLabel={`${title} · Jogo de Ida`}
        continueLabel="Voltar ao clube →"
        onDone={() => onDoneIda(legData)}
        save={save} onApplyLineupChange={onApplyLineupChange}
      />
    );
  }

  // volta — depois da partida ao vivo, mostra o resumo do confronto (ida +
  // volta + agregado + pênaltis se empatou) antes de aplicar o resultado,
  // igual o mata-mata de acesso já mostra (CareerTwoLegScreen.jsx).
  if (!showSummary) {
    return (
      <LegMatch
        key="copa-volta"
        leg={legData}
        legLabel={`${title} · Jogo de Volta`}
        continueLabel="Ver resultado do confronto →"
        onDone={() => setShowSummary(true)}
        save={save} onApplyLineupChange={onApplyLineupChange}
      />
    );
  }

  const leg2 = { homeGoals: legData.sim.homeGoals, awayGoals: legData.sim.awayGoals };
  const aggA = leg1Result.homeGoals + leg2.awayGoals;
  const aggB = leg1Result.awayGoals + leg2.homeGoals;
  const wentToPenalties = aggA === aggB;

  return (
    <div style={{ ...wrapStyle, textAlign: 'center' }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, marginBottom: 10 }}>{title}</h2>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>Ida: {leg1Result.homeGoals} x {leg1Result.awayGoals}</div>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>Volta: {leg2.homeGoals} x {leg2.awayGoals}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Agregado: {aggA} x {aggB}</div>
      {wentToPenalties && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Empate no agregado — decidido nos pênaltis.</div>}
      <button onClick={() => onDoneVolta(legData)} style={{ ...primaryBtnStyle, marginTop: 4 }}>Continuar →</button>
    </div>
  );
}
