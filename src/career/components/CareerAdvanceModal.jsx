// Modal animado mostrado enquanto o "Avançar"/"Simular temporada até o
// fim" avança o calendário — substitui o overlay de texto simples por um
// calendário de verdade (mesma grade de mês de CareerCalendarScreen.jsx),
// com um cursor dourado que anda dia a dia de `fromDay` até `toDay`,
// trocando de mês sozinho quando preciso — pedido explícito do usuário
// ("sempre que clicar em avançar tem que abrir o calendário e passar dia
// a dia no calendário"), inspirado no SeasonCalendarModal do modo
// clássico (App.jsx). Os dias em si já foram todos calculados de uma vez
// só (advanceDay/simulateRestOfSeason não são interrompíveis dia a dia de
// verdade) — essa tela só anima visualmente o cursor andando por cima do
// que já foi decidido. Some sozinha ao terminar (`onDone`); se o clique
// mudar de tela no meio (ex.: caiu numa proposta), quem a renderiza
// desmonta e a animação é cortada, sem problema.
import { useEffect, useMemo, useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { formatCalendarDay } from '../engine/calendar.js';
import { COPA_ROUND_LABELS } from '../engine/copaEngine.js';
import {
  MONTH_NAMES, WEEKDAY_LABELS, RESULT_COLORS, TinyCrest, navArrowStyle,
  dayOfYearToMonthDay, dayOfYearFor, monthMatrix,
} from './monthCalendar.jsx';

// Pedido explícito do usuário (2026-11-06: "nunca pular tudo"): o cursor
// anda UM dia de cada vez, sempre — nunca interpola/pula dias pra encurtar
// um pulo grande (ex.: "Simular temporada até o fim"). STEP_MS pequeno o
// bastante pra um pulo de temporada inteira (~300 dias) não demorar mais
// que uns 10s, mas ainda dar pra ver cada card virando.
const STEP_MS = 32;

export function CareerAdvanceModal({ save, fromDay, toDay, eventLines, onDone }) {
  const [cursorDay, setCursorDay] = useState(fromDay);
  const [eventsVisible, setEventsVisible] = useState(false);
  const [viewMonth, setViewMonth] = useState(dayOfYearToMonthDay(fromDay).month);

  const myDivisionKey = save.clubs[save.myClubId].division === 'A' ? 'divisionA' : 'divisionB';
  const division = save[myDivisionKey];
  const myTeam = TEAMS.find(t => t.id === save.myClubId);
  const copa = save.copa;

  const dayToRound = useMemo(() => {
    const map = {};
    save.seasonCalendar.forEach((day, idx) => { map[day] = idx; });
    return map;
  }, [save.seasonCalendar]);

  const dayToCopaRound = useMemo(() => {
    const map = {};
    (copa?.calendar || []).forEach((day, idx) => { map[day] = idx; });
    return map;
  }, [copa]);

  const roundOpponent = useMemo(() => {
    const map = {};
    division.fixtures.forEach((matches, r) => {
      const m = (matches || []).find(x => x.homeId === save.myClubId || x.awayId === save.myClubId);
      if (!m) return;
      const isHome = m.homeId === save.myClubId;
      map[r] = { team: TEAMS.find(t => t.id === (isHome ? m.awayId : m.homeId)), isHome };
    });
    return map;
  }, [division.fixtures, save.myClubId]);

  function userRoundResult(roundResults) {
    const m = (roundResults || []).find(r => r.homeId === save.myClubId || r.awayId === save.myClubId);
    if (!m) return null;
    const isHome = m.homeId === save.myClubId;
    const gf = isHome ? m.homeGoals : m.awayGoals;
    const ga = isHome ? m.awayGoals : m.homeGoals;
    return { res: gf > ga ? 'V' : gf < ga ? 'D' : 'E', gf, ga };
  }

  function copaUserResult(roundIdx) {
    const entry = (copa?.history || []).find(h => h.round === roundIdx);
    const myTie = entry?.ties?.find(t => t.aId === save.myClubId || t.bId === save.myClubId);
    if (!myTie?.winnerId) return null;
    return myTie.winnerId === save.myClubId ? 'V' : 'D';
  }

  // Cursor anda de fromDay até toDay UM DIA DE CADA VEZ, sempre — nunca
  // pula/interpola (pedido explícito do usuário) — trocando de mês sozinho
  // quando cruza a fronteira.
  useEffect(() => {
    if (toDay <= fromDay) {
      setCursorDay(toDay);
      setViewMonth(dayOfYearToMonthDay(toDay).month);
      setEventsVisible(true);
      return;
    }
    let day = fromDay;
    const interval = setInterval(() => {
      day += 1;
      setCursorDay(day);
      setViewMonth(dayOfYearToMonthDay(day).month);
      if (day >= toDay) {
        clearInterval(interval);
        setEventsVisible(true);
      }
    }, STEP_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDay, toDay]);

  useEffect(() => {
    if (!eventsVisible) return;
    const t = setTimeout(onDone, eventLines.length ? 900 + eventLines.length * 150 : 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsVisible]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,10,8,0.9)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ fontSize: 11, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 10 }}>📅 Calendário avançando</div>

        <div style={{ padding: '14px 12px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
            <span style={{ ...navArrowStyle, opacity: 0.25, cursor: 'default' }}>‹</span>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 700, minWidth: 130, textAlign: 'center' }}>{MONTH_NAMES[viewMonth]}</div>
            <span style={{ ...navArrowStyle, opacity: 0.25, cursor: 'default' }}>›</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
            {WEEKDAY_LABELS.map(w => (
              <div key={w} style={{ textAlign: 'center', fontSize: 10, fontFamily: "'Space Mono', monospace", opacity: 0.45, letterSpacing: 0.5 }}>{w}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {monthMatrix(viewMonth).flat().map((dayOfMonth, i) => {
              if (!dayOfMonth) return <div key={`e${i}`} />;
              const dayOfYear = dayOfYearFor(dayOfMonth, viewMonth);
              const round = dayToRound[dayOfYear];
              const copaRound = dayToCopaRound[dayOfYear];
              const hasRound = round !== undefined;
              const hasCopa = copaRound !== undefined;
              const hasAny = hasRound || hasCopa;
              const isCursor = dayOfYear === cursorDay;
              // Pedido explícito do usuário: o card do dia atual fica
              // AMARELO; assim que o cursor passa pra frente, o card do dia
              // anterior vira CINZA (não só "sem destaque" — visivelmente
              // marcado como já percorrido).
              const isPast = dayOfYear < cursorDay;
              const played = hasRound && round < division.round;
              const result = played ? userRoundResult(division.results?.[round]) : null;
              const copaResult = hasCopa ? copaUserResult(copaRound) : null;
              const opponent = hasRound ? roundOpponent[round] : null;
              return (
                <div
                  key={i}
                  title={hasRound ? `Rodada ${round + 1}${opponent?.team ? ` · ${opponent.team.club}` : ''}` : hasCopa ? `Copa do Brasil · ${COPA_ROUND_LABELS[copaRound]}` : undefined}
                  style={{
                    minHeight: 56, padding: '4px 2px', borderRadius: 8, textAlign: 'center',
                    border: `1px solid ${isCursor ? 'rgba(212,162,60,0.8)' : isPast ? 'rgba(255,255,255,0.14)' : hasAny ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'}`,
                    background: isCursor ? 'rgba(212,162,60,0.22)' : isPast ? 'rgba(255,255,255,0.08)' : hasAny ? 'rgba(255,255,255,0.04)' : 'transparent',
                    boxShadow: isCursor ? '0 0 10px rgba(212,162,60,0.4)' : 'none',
                    color: '#F4F1EA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                    transition: 'background 0.12s, border 0.12s',
                  }}
                >
                  <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", fontWeight: isCursor ? 700 : 400, color: isCursor ? '#d4a23c' : isPast ? 'rgba(244,241,234,0.4)' : '#F4F1EA', opacity: hasAny || isCursor ? 0.95 : isPast ? 0.6 : 0.3 }}>{dayOfMonth}</span>
                  {hasRound && <TinyCrest team={opponent?.team} ring={result ? RESULT_COLORS[result.res] : null} />}
                  {hasRound && !result && (
                    <span style={{ fontSize: 8.5, color: '#d4a23c', fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>R{round + 1}</span>
                  )}
                  {result && (
                    <span style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", display: 'flex', gap: 2 }}>
                      <span style={{ fontWeight: 800, color: RESULT_COLORS[result.res] }}>{result.res}</span>
                      <span style={{ opacity: 0.6 }}>{result.gf}-{result.ga}</span>
                    </span>
                  )}
                  {hasCopa && <TinyCrest emoji="🏆" ring={copaResult ? RESULT_COLORS[copaResult] : null} />}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ textAlign: 'center', fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#d4a23c', fontWeight: 700, marginBottom: eventsVisible && eventLines.length ? 12 : 0 }}>
          {formatCalendarDay(cursorDay)}
        </div>

        {eventsVisible && eventLines.length > 0 && (
          <div style={{ display: 'grid', gap: 6 }}>
            {eventLines.map((line, i) => (
              <div key={i} style={{
                fontSize: 12.5, opacity: 0, padding: '6px 10px', borderRadius: 8, textAlign: 'center',
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
