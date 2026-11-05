// Overlay animado mostrado enquanto o "Avançar"/"Simular temporada até o
// fim" avança o calendário — os dias já foram todos calculados de uma vez
// só (ver advanceDay/simulateRestOfSeason em seasonEngine.js, que não são
// interrompíveis dia a dia de verdade), mas essa tela anima um contador de
// `fromDay` até `toDay` pra dar a sensação de "o calendário passando",
// igual o usuário pediu, em vez do salto instantâneo que havia antes.
// Some sozinha ao terminar (`onDone`) — se o clique mudar de tela (ex.:
// caiu numa proposta ou na tela de partida ao vivo), o componente que a
// renderiza (CareerHub) desmonta e essa animação é cortada, sem problema.
import { useEffect, useState } from 'react';
import { formatCalendarDay } from '../engine/calendar.js';

const MAX_STEPS = 22;
const STEP_MS = 55;

export function CareerAdvanceOverlay({ fromDay, toDay, eventLines, onDone }) {
  const [shownDay, setShownDay] = useState(fromDay);
  const [eventsVisible, setEventsVisible] = useState(false);

  useEffect(() => {
    if (toDay <= fromDay) {
      setShownDay(toDay);
      setEventsVisible(true);
      const t = setTimeout(onDone, eventLines.length ? 900 : 250);
      return () => clearTimeout(t);
    }
    const totalSteps = Math.min(toDay - fromDay, MAX_STEPS);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= totalSteps) {
        setShownDay(toDay);
        setEventsVisible(true);
        clearInterval(interval);
      } else {
        setShownDay(Math.round(fromDay + ((toDay - fromDay) * step) / totalSteps));
      }
    }, STEP_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDay, toDay]);

  useEffect(() => {
    if (!eventsVisible) return;
    const t = setTimeout(onDone, eventLines.length ? 900 + eventLines.length * 150 : 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsVisible]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,10,8,0.88)', backdropFilter: 'blur(2px)',
    }}>
      <div style={{ textAlign: 'center', padding: 24, width: '100%', maxWidth: 340 }}>
        <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Calendário avançando</div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 26, color: '#d4a23c', fontWeight: 700, marginBottom: eventsVisible && eventLines.length ? 16 : 0 }}>
          {formatCalendarDay(shownDay)}
        </div>
        {eventsVisible && eventLines.length > 0 && (
          <div style={{ display: 'grid', gap: 6 }}>
            {eventLines.map((line, i) => (
              <div key={i} style={{
                fontSize: 12.5, opacity: 0, padding: '6px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', animation: `brlAdvFadeIn 0.3s ease forwards ${i * 0.15}s`,
              }}>{line}</div>
            ))}
          </div>
        )}
      </div>
      <style>{'@keyframes brlAdvFadeIn { to { opacity: 0.9; } }'}</style>
    </div>
  );
}
