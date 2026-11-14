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
// um pulo grande (ex.: "Simular temporada até o fim"). Velocidade
// selecionável (pedido 2026-11-09): 1x/2x/4x = 1s/0,5s/0,2s por dia,
// lembrada entre usos via localStorage.
const SPEEDS = { '1x': 1000, '2x': 500, '4x': 200 };
const SPEED_KEY = 'brl_career_advance_speed';
function loadSpeed() {
  try {
    const v = localStorage.getItem(SPEED_KEY);
    return v && SPEEDS[v] ? v : '1x';
  } catch {
    return '1x';
  }
}
function saveSpeed(v) {
  try { localStorage.setItem(SPEED_KEY, v); } catch { /* ignora */ }
}

// `onStop` (pedido 2026-11-09): "Parar" não revela mais o resultado já
// calculado do pulo grande — ele ABORTA o pulo inteiro e quem chamou
// (CareerApp.jsx) refaz do zero avançando só 1 rodada a partir do dia em
// que o pulo começou, exatamente como um clique normal de "Avançar
// rodada". Evita o usuário ser jogado direto num confronto seu (ex.: Copa
// do Brasil) que estava semanas à frente dentro de um "Simular temporada
// até o fim" longo — ver CareerApp.jsx para o porquê.
export function CareerAdvanceModal({ save, fromDay, toDay, eventLines, onDone, onStop }) {
  const [cursorDay, setCursorDay] = useState(fromDay);
  const [eventsVisible, setEventsVisible] = useState(false);
  const [viewMonth, setViewMonth] = useState(dayOfYearToMonthDay(fromDay).month);
  const [speedKey, setSpeedKey] = useState(loadSpeed);
  const stepMs = SPEEDS[speedKey];

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
  // pula/interpola sozinho (pedido explícito do usuário) — trocando de mês
  // sozinho quando cruza a fronteira, no ritmo escolhido em `speedKey`.
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
    }, stepMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDay, toDay, stepMs]);

  useEffect(() => {
    if (!eventsVisible) return;
    const t = setTimeout(onDone, eventLines.length ? 900 + eventLines.length * 150 : 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsVisible]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--surface)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>Calendário avançando</div>
          {!eventsVisible && (
            <>
              <div style={{ display: 'flex', borderRadius: 999, border: '1px solid var(--line-strong)', overflow: 'hidden' }}>
                {Object.keys(SPEEDS).map(k => (
                  <button
                    key={k}
                    onClick={() => { setSpeedKey(k); saveSpeed(k); }}
                    style={{
                      fontSize: 10.5, fontWeight: 700, padding: '3px 9px', border: 'none', cursor: 'pointer',
                      background: speedKey === k ? 'rgba(194,154,69,0.2)' : 'var(--surface)',
                      color: speedKey === k ? 'var(--gold-ink)' : 'var(--ink)',
                    }}
                  >{k}</button>
                ))}
              </div>
              <button
                onClick={onStop}
                style={{
                  fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                  padding: '3px 10px', borderRadius: 999, border: '1px solid var(--line-strong)',
                  background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer',
                }}
              >Parar</button>
            </>
          )}
        </div>

        <div style={{ padding: '14px 12px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
            <span style={{ ...navArrowStyle, opacity: 0.25, cursor: 'default' }}>‹</span>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700, minWidth: 130, textAlign: 'center' }}>{MONTH_NAMES[viewMonth]}</div>
            <span style={{ ...navArrowStyle, opacity: 0.25, cursor: 'default' }}>›</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
            {WEEKDAY_LABELS.map(w => (
              <div key={w} style={{ textAlign: 'center', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', letterSpacing: 0.5 }}>{w}</div>
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
              // Os dias já foram TODOS calculados de antemão (ver comentário
              // no topo do arquivo) — sem isso, qualquer resultado futuro já
              // decidido vazaria no calendário antes do cursor chegar nele.
              // Resultado só aparece quando o cursor alcançou aquele dia.
              const reached = dayOfYear <= cursorDay;
              const played = hasRound && reached;
              const result = played ? userRoundResult(division.results?.[round]) : null;
              const copaResult = hasCopa && reached ? copaUserResult(copaRound) : null;
              const opponent = hasRound ? roundOpponent[round] : null;
              return (
                <div
                  key={i}
                  title={hasRound ? `Rodada ${round + 1}${opponent?.team ? ` · ${opponent.team.club}` : ''}` : hasCopa ? `Copa do Brasil · ${COPA_ROUND_LABELS[copaRound]}` : undefined}
                  style={{
                    minHeight: 56, padding: '4px 2px', borderRadius: 8, textAlign: 'center',
                    border: `1px solid ${isCursor ? 'var(--gold)' : isPast ? 'var(--line-strong)' : hasAny ? 'var(--line-strong)' : 'var(--line)'}`,
                    background: isCursor ? 'rgba(194,154,69,0.2)' : isPast ? 'var(--surface-2)' : hasAny ? 'var(--surface)' : 'transparent',
                    boxShadow: isCursor ? '0 0 10px rgba(194,154,69,0.35)' : 'none',
                    color: 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                    transition: 'background 0.12s, border 0.12s',
                  }}
                >
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: isCursor ? 700 : 400, color: isCursor ? 'var(--gold-ink)' : isPast ? 'var(--muted)' : 'var(--ink)', opacity: hasAny || isCursor ? 0.95 : isPast ? 0.6 : 0.3 }}>{dayOfMonth}</span>
                  {hasRound && <TinyCrest team={opponent?.team} ring={result ? RESULT_COLORS[result.res] : null} />}
                  {hasRound && !result && (
                    <span style={{ fontSize: 8.5, color: 'var(--gold-ink)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>R{round + 1}</span>
                  )}
                  {result && (
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', display: 'flex', gap: 2 }}>
                      <span style={{ fontWeight: 800, color: RESULT_COLORS[result.res] }}>{result.res}</span>
                      <span style={{ opacity: 0.6 }}>{result.gf}-{result.ga}</span>
                    </span>
                  )}
                  {hasCopa && <TinyCrest icon="trophy" ring={copaResult ? RESULT_COLORS[copaResult] : null} />}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gold-ink)', fontWeight: 700, marginBottom: eventsVisible && eventLines.length ? 12 : 0 }}>
          {formatCalendarDay(cursorDay)}
        </div>

        {eventsVisible && eventLines.length > 0 && (
          <div style={{ display: 'grid', gap: 6 }}>
            {eventLines.map((line, i) => (
              <div key={i} style={{
                fontSize: 12.5, opacity: 0, padding: '6px 10px', borderRadius: 8, textAlign: 'center',
                background: 'var(--surface)', animation: `brlAdvFadeIn 0.3s ease forwards ${i * 0.15}s`,
              }}>{line}</div>
            ))}
          </div>
        )}
      </div>
      <style>{'@keyframes brlAdvFadeIn { to { opacity: 0.9; } }'}</style>
    </div>
  );
}
