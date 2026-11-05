// Calendário da temporada do Modo Carreira — grade de mês de verdade
// (igual o calendário do modo clássico, SeasonCalendarModal em App.jsx),
// não mais uma lista simples de rodadas. Clica num dia com jogo pra ver
// os confrontos daquela rodada embaixo (inclusive os outros jogos, não só
// o do usuário — todos já ficam guardados em `division.results` desde a
// Fase 6). Reimplementado aqui (não importado de App.jsx) porque o
// original depende do estado de simulação-ao-vivo do modo clássico
// (simActive/cursorDate/onSimulateTo), que não existe no Modo Carreira —
// só a parte visual (grade + célula com escudo do adversário + resultado)
// faz sentido reaproveitar, então foi recriada do zero.
import { useMemo, useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { formatCalendarDay } from '../engine/calendar.js';
import { backButtonStyle } from '../components/styles.js';

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const RESULT_COLORS = { V: '#7fd99a', D: '#e05050', E: 'rgba(255,255,255,0.45)' };
// Ano fictício fixo só pra matemática de dia-da-semana da grade — o Modo
// Carreira usa dia-do-ano (1-365) sem ano real, não precisa bater com
// nenhum calendário de verdade.
const GRID_YEAR = 2026;

function dayOfYearToMonthDay(day) {
  let remaining = Math.max(1, Math.min(365, day));
  for (let m = 0; m < 12; m++) {
    if (remaining <= MONTH_LENGTHS[m]) return { month: m, dayOfMonth: remaining };
    remaining -= MONTH_LENGTHS[m];
  }
  return { month: 11, dayOfMonth: 31 };
}

function monthMatrix(month) {
  const first = new Date(GRID_YEAR, month, 1);
  const daysInMonth = MONTH_LENGTHS[month];
  const lead = (first.getDay() + 6) % 7; // seg=0 … dom=6
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function TinyCrest({ team, ring }) {
  const logo = team ? CLUB_LOGOS[team.club] : null;
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: ring ? `2px solid ${ring}` : '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', flexShrink: 0,
    }}>
      {logo ? <img src={logo} alt="" style={{ width: '72%', height: '72%', objectFit: 'contain' }} /> : <span style={{ fontSize: 9, opacity: 0.4 }}>?</span>}
    </div>
  );
}

const navArrowStyle = {
  background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#F4F1EA',
  width: 28, height: 28, cursor: 'pointer',
};

export function CareerCalendarScreen({ save, onBack }) {
  const myDivisionKey = save.clubs[save.myClubId].division === 'A' ? 'divisionA' : 'divisionB';
  const division = save[myDivisionKey];
  const myTeam = TEAMS.find(t => t.id === save.myClubId);

  const dayToRound = useMemo(() => {
    const map = {};
    save.seasonCalendar.forEach((day, idx) => { map[day] = idx; });
    return map;
  }, [save.seasonCalendar]);

  const initialRound = Math.min(division.round, division.fixtures.length - 1);
  const initialMonth = dayOfYearToMonthDay(save.seasonCalendar[initialRound] ?? 32).month;
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [selectedRound, setSelectedRound] = useState(initialRound);

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

  const shiftMonth = (delta) => setViewMonth(m => Math.max(0, Math.min(11, m + delta)));

  function dayOfYearFor(dayOfMonth, month) {
    let total = dayOfMonth;
    for (let m = 0; m < month; m++) total += MONTH_LENGTHS[m];
    return total;
  }

  const handleDayClick = (dayOfMonth) => {
    const round = dayToRound[dayOfYearFor(dayOfMonth, viewMonth)];
    if (round !== undefined) setSelectedRound(round);
  };

  const selectedMatches = division.fixtures[selectedRound] || [];
  const selectedResults = division.results?.[selectedRound] || null;
  const selectedDay = save.seasonCalendar[selectedRound];

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={backButtonStyle}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 4 }}>Calendário da temporada {save.season}</h2>
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>Série {save.clubs[save.myClubId].division} · {division.round}/{division.fixtures.length} rodadas jogadas.</p>

      <div style={{ padding: '14px 12px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
          <button onClick={() => shiftMonth(-1)} disabled={viewMonth === 0} style={{ ...navArrowStyle, opacity: viewMonth === 0 ? 0.3 : 1 }}>‹</button>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 700, minWidth: 130, textAlign: 'center' }}>{MONTH_NAMES[viewMonth]}</div>
          <button onClick={() => shiftMonth(1)} disabled={viewMonth === 11} style={{ ...navArrowStyle, opacity: viewMonth === 11 ? 0.3 : 1 }}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
          {WEEKDAY_LABELS.map(w => (
            <div key={w} style={{ textAlign: 'center', fontSize: 10, fontFamily: "'Space Mono', monospace", opacity: 0.45, letterSpacing: 0.5 }}>{w}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {monthMatrix(viewMonth).flat().map((dayOfMonth, i) => {
          if (!dayOfMonth) return <div key={`e${i}`} />;
          const round = dayToRound[dayOfYearFor(dayOfMonth, viewMonth)];
          const hasRound = round !== undefined;
          const played = hasRound && round < division.round;
          const result = played ? userRoundResult(division.results?.[round]) : null;
          const isSelected = hasRound && round === selectedRound;
          const opponent = hasRound ? roundOpponent[round] : null;
          return (
            <button
              key={i}
              onClick={() => handleDayClick(dayOfMonth)}
              disabled={!hasRound}
              title={hasRound ? `Rodada ${round + 1}${opponent?.team ? ` · ${opponent.isHome ? 'em casa contra' : 'fora contra'} ${opponent.team.club}` : ''}` : 'Sem jogo'}
              style={{
                minHeight: 64, padding: '4px 2px', borderRadius: 8, textAlign: 'center', cursor: hasRound ? 'pointer' : 'default',
                border: `1px solid ${isSelected ? 'rgba(212,162,60,0.6)' : hasRound ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'}`,
                background: isSelected ? 'rgba(212,162,60,0.12)' : hasRound ? 'rgba(255,255,255,0.04)' : 'transparent',
                color: '#F4F1EA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
              }}
            >
              <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", opacity: hasRound ? 0.85 : 0.3 }}>{dayOfMonth}</span>
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
            </button>
          );
        })}
        </div>
      </div>

      <div style={{ padding: '12px 12px 4px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.45, marginBottom: 6 }}>
          Jogos da rodada {selectedRound + 1}{selectedDay ? ` · ${formatCalendarDay(selectedDay)}` : ''}
        </div>
        {selectedMatches.map((m, i) => {
          const r = selectedResults?.[i];
          const isMine = m.homeId === save.myClubId || m.awayId === save.myClubId;
          const homeTeam = TEAMS.find(t => t.id === m.homeId);
          const awayTeam = TEAMS.find(t => t.id === m.awayId);
          const isLast = i === selectedMatches.length - 1;
          return (
            <div key={`${m.homeId}-${m.awayId}`} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', fontSize: 11.5, borderRadius: 6,
              borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
              background: isMine ? 'rgba(212,162,60,0.08)' : 'transparent', fontWeight: isMine ? 700 : 400,
            }}>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {homeTeam?.id === myTeam?.id ? myTeam.club : homeTeam?.club}
              </span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, minWidth: 44, textAlign: 'center' }}>
                {r ? `${r.homeGoals} - ${r.awayGoals}` : 'x'}
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {awayTeam?.id === myTeam?.id ? myTeam.club : awayTeam?.club}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
