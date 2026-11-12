// Simulador do Brasileirão 2026 — sub-app própria (igual o Modo Carreira),
// montada por App.jsx no lugar do corpo normal do jogo (ver `simulator2026Open`
// em App.jsx). Pedido explícito do usuário (2026-11-12): "a ideia é simular
// literalmente TODOS OS JOGOS QUE FALTAM um por um, não de um só time" — bem
// diferente do Brasileirão Atual (que segue a perspectiva de UM clube
// escolhido): aqui não tem clube nenhum, é a liga inteira, JOGO POR JOGO
// (não rodada por rodada), cada um pela MESMA simulação ao vivo minuto a
// minuto do resto do jogo ("simula o jogo como nossa simulação padrão"). O
// motor/visual é o "tradicional" (o mesmo placar/feed de eventos ao vivo e
// o MatchSummaryModal do Brasileirão clássico/Atual) — NÃO o reconstruído
// pro Modo Carreira (liveMatchUI.jsx), que o usuário rejeitou explicitamente
// ("não dá pra colocar a simulação tradicional sem ser a do modo carreira").
// Começa EXATAMENTE de onde o Brasileirão real está agora: primeiro jogo é
// o adiado da rodada 21 (Chapecoense x Vasco, nunca saiu placar real até a
// planilha que o usuário passou ser gerada — ver
// src/data/brasileirao-2026-real-results.js), depois a rodada 35 inteira,
// jogo a jogo, até a 38.
import { useEffect, useRef, useState } from 'react';
import { TEAMS } from '../data/teams.js';
import { CLUB_LOGOS } from '../data/club-logos.js';
// SERIE_A_2026_TEAM_IDS existe tanto aqui (career-clubs.js, ordem diferente
// mas os mesmos 20 ids) quanto em App.jsx — usa a daqui de propósito: é um
// módulo-folha (zero risco de import circular), diferente da versão de
// App.jsx, que é quem MONTA esta sub-app (mesmo motivo documentado em
// copaEngine.js/simHelpers.js pra só importar função — não `const` — de
// volta de App.jsx).
import { SERIE_A_2026_TEAM_IDS } from '../data/career-clubs.js';
import { SERIE_A_2026_FIXTURES } from '../data/serie-a-2026-fixtures.js';
import { REAL_RESULTS_2026_THROUGH_R34 } from '../data/brasileirao-2026-real-results.js';
import { teamStrength, simAiMatch, applyRoundToTable, matchPrng, buildLiveMatchEvents, MatchSummaryModal } from '../App.jsx';
import { traditionalMatchStyles as ts } from './traditionalMatchStyles.js';

const SAVE_KEY = 'brl_simulator2026_save';
// Índice 0-based da rodada 35 em SERIE_A_2026_FIXTURES (rodada 1 = índice 0).
const FIRST_SIMULATED_ROUND_IDX = 34;
const TOTAL_ROUNDS = 38;

// Lista ACHATADA de todo jogo que falta, um por um (não agrupado por rodada
// — pedido explícito do usuário 2026-11-12: "simular jogo por jogo não
// rodada por rodada"): o jogo adiado da rodada 21 (Chapecoense x Vasco)
// entra como o PRIMEIRO da lista ("então tem que começar do Vasco x
// Chapecoense" — pedido explícito do usuário), seguido das rodadas 35-38
// inteiras, 10 jogos cada — 41 jogos no total. Fixa (não muda depois de
// montada), então vive fora do componente.
const REMAINING_MATCHES = [
  { round: 21, homeId: 'chapecoense2026', awayId: 'vasco2026', postponed: true },
  ...Array.from({ length: TOTAL_ROUNDS - FIRST_SIMULATED_ROUND_IDX }, (_, i) => {
    const roundIdx = FIRST_SIMULATED_ROUND_IDX + i;
    return SERIE_A_2026_FIXTURES[roundIdx].map(m => ({ round: roundIdx + 1, homeId: m.homeId, awayId: m.awayId }));
  }).flat(),
];

function buildTeams() {
  return SERIE_A_2026_TEAM_IDS.map(id => {
    const t = TEAMS.find(tm => tm.id === id);
    const playersWithMeta = t.players.map(p => ({ ...p, club: t.club, year: t.year, nat: p.nat || 'BRA' }));
    return {
      id: t.id, label: t.label, club: t.club, clubLogo: CLUB_LOGOS[t.club] || null, color: t.colors?.p,
      ovr: teamStrength(Object.fromEntries(playersWithMeta.map((p, i) => [i, p]))),
      players: playersWithMeta,
    };
  });
}

function emptyTableRow(t) {
  return { id: t.id, label: t.label, club: t.club, clubLogo: t.clubLogo, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 };
}

// Seed aleatória por rodada de simulação — antes era fixa ('simulador-2026'),
// o que fazia "recomeçar"/um save novo sempre produzir exatamente os mesmos
// 41 resultados (pedido do usuário 2026-11-13: "ta dando apenas um resultado
// sempre"). A seed fica salva no `save`, então dentro da MESMA rodada de
// simulação o resultado de cada jogo continua determinístico (ver
// `prepareMatch`), só varia entre uma rodada de simulação e outra.
function randomSeed() {
  return `sim2026-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Estado inicial: tabela já com os 339 placares reais das rodadas 1-34
// aplicados (mesma applyRoundToTable que qualquer jogo simulado usa, pra
// nunca divergir do motor por um número copiado à mão) — o jogo adiado da
// rodada 21 ainda NÃO entra aqui: ele é o primeiro item de
// REMAINING_MATCHES, resolvido só quando o usuário jogar ele de verdade.
function buildInitialState(teams, seed = randomSeed()) {
  const zeroedTable = teams.map(emptyTableRow);
  const table = applyRoundToTable(zeroedTable, REAL_RESULTS_2026_THROUGH_R34);
  return { seed, matchIdx: 0, table, log: [] };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    // Save de antes de virar "jogo por jogo" (tinha roundIdx/history, não
    // matchIdx/log) — descarta e recomeça em vez de quebrar.
    if (parsed && typeof parsed.matchIdx !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // ignora
  }
}

function TeamCrest({ team, size = 22 }) {
  return team?.clubLogo
    ? <img src={team.clubLogo} alt={team.club} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none'; }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface-2)', flexShrink: 0 }} />;
}

// Monta o pacote de UMA partida (placar + timeline minuto a minuto já
// prontos) — o placar sai de uma seed determinística (matchPrng) derivada
// da seed da rodada de simulação (`save.seed`), então assistir ao vivo ou
// pular pro resultado final desse jogo nunca diverge.
function prepareMatch(seed, teamById, m) {
  const homeTeam = teamById[m.homeId];
  const awayTeam = teamById[m.awayId];
  const rand = matchPrng(seed, m.round, m.homeId, m.awayId);
  const sim = simAiMatch(homeTeam, awayTeam, rand);
  const homeXI = homeTeam.players.slice(0, 11);
  const awayXI = awayTeam.players.slice(0, 11);
  const events = buildLiveMatchEvents(sim, homeTeam, homeXI, awayTeam, awayXI);
  return {
    homeTeam, awayTeam,
    sim: { homeGoals: sim.homeGoals, awayGoals: sim.awayGoals, ratings: sim.ratings, events, homeGkName: sim.homeGkName, awayGkName: sim.awayGkName },
    result: { round: m.round, homeId: m.homeId, awayId: m.awayId, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals, postponed: !!m.postponed },
  };
}

const SPEED_MS = { 1: 250, 1.5: 125, 2: 55 };

// Ícone/texto de um evento do feed — cópia literal do mapeamento usado pelo
// LiveMatchBox (App.jsx) pra render idêntico ao do Brasileirão clássico/Atual.
function eventIcon(ev) {
  return ev.type === 'yellow' ? '🟨'
    : ev.type === 'red' ? (ev.secondYellow ? '🟨🟥' : '🟥')
    : ev.type === 'injury' ? '🩹'
    : ev.type === 'substitution' ? '🔄'
    : ev.type === 'penalty_miss' ? '❌'
    : (ev.isOwnGoal ? '⚽🔴' : '⚽');
}
function eventMainText(ev) {
  return ev.type === 'goal' ? `${ev.scorer}${ev.isOwnGoal ? ' (contra)' : ev.isPenalty ? ' (pênalti)' : ''}`
    : ev.type === 'substitution' ? `Entrando: ${ev.playerIn}`
    : ev.type === 'penalty_miss' ? ev.player
    : ev.player;
}
function eventSubText(ev) {
  return ev.type === 'goal'
    ? (ev.isOwnGoal ? `contra, ${ev.ownGoalTeamLabel}` : ev.isPenalty ? `pênalti convertido · ${ev.teamLabel}` : ev.assist ? `assist: ${ev.assist}` : ev.teamLabel)
    : ev.type === 'yellow' ? `cartão amarelo · ${ev.teamLabel}`
    : ev.type === 'red' ? (ev.secondYellow ? `segundo amarelo, expulso · ${ev.teamLabel}` : `expulso · ${ev.teamLabel}`)
    : ev.type === 'substitution' ? `Saindo: ${ev.playerOut} · ${ev.teamLabel}`
    : ev.type === 'penalty_miss' ? `pênalti perdido, defendido por ${ev.gkName || 'goleiro'} · ${ev.teamLabel}`
    : `lesionado, sai de campo · ${ev.teamLabel}`;
}

// Processa todo evento cujo minuto já passou, acumulando placar/feed em `st`
// (mutável) — mesma lógica do `tick()` do LiveMatchBox (App.jsx): cartão/
// lesão entram no feed sem mexer no placar; lesão com substituto automático
// também gera uma entrada cosmética de substituição (sem afetar o resultado,
// que já saiu pronto do `sim`); gol soma no lado certo.
function advanceEvents(st, events, homeId) {
  while (st.evIdx < events.length && events[st.evIdx].minute <= st.minute) {
    const ev = events[st.evIdx];
    st.evIdx++;
    if (ev.type !== 'goal') {
      st.shown.push({ ...ev, homeScore: st.hs, awayScore: st.as });
      if (ev.type === 'injury' && ev.replacementName) {
        st.shown.push({ type: 'substitution', minute: ev.minute, teamId: ev.teamId, teamLabel: ev.teamLabel, playerOut: ev.player, playerIn: ev.replacementName, homeScore: st.hs, awayScore: st.as });
      }
      continue;
    }
    if (ev.teamId === homeId) st.hs++; else st.as++;
    st.shown.push({ ...ev, homeScore: st.hs, awayScore: st.as });
  }
}

// Motor de partida ao vivo "tradicional" — mesmo ritmo minuto a minuto
// (SPEED_MS) do LiveMatchBox do Brasileirão clássico/Atual, só que
// autocontido (sem o resto do estado de rodada/substituição/tática do jogo
// principal, que não existe aqui — não tem "meu time" nem escalação).
function useTraditionalLiveMatch(pending) {
  const [phase, setPhase] = useState('intro');
  const [minute, setMinute] = useState(0);
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [shownEvents, setShownEvents] = useState([]);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  const timerRef = useRef(null);
  const stateRef = useRef({ minute: 0, evIdx: 0, hs: 0, as: 0, shown: [] });

  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stateRef.current = { minute: 0, evIdx: 0, hs: 0, as: 0, shown: [] };
    setPhase('intro');
    setMinute(0);
    setScore({ home: 0, away: 0 });
    setShownEvents([]);
    setSpeed(1);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [pending?.key]);

  if (!pending) return { phase: 'intro', minute: 0, score, shownEvents, speed, setSpeed, start: () => {}, skipToEnd: () => {} };

  const homeId = pending.homeTeam.id;
  const events = pending.sim.events;

  const tick = () => {
    const st = stateRef.current;
    st.minute++;
    advanceEvents(st, events, homeId);
    setMinute(st.minute);
    setScore({ home: st.hs, away: st.as });
    if (st.shown.length > 0) setShownEvents([...st.shown]);
    if (st.minute >= 90) {
      setScore({ home: pending.sim.homeGoals, away: pending.sim.awayGoals });
      setPhase('done');
      return;
    }
    timerRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
  };

  const start = () => {
    setPhase('playing');
    timerRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
  };

  const skipToEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const st = stateRef.current;
    st.minute = 1000;
    advanceEvents(st, events, homeId);
    st.minute = 90;
    setMinute(90);
    setShownEvents([...st.shown]);
    setScore({ home: pending.sim.homeGoals, away: pending.sim.awayGoals });
    setPhase('done');
  };

  return { phase, minute, score, shownEvents, speed, setSpeed, start, skipToEnd };
}

// Tela de partida ao vivo — mesmo placar/feed de eventos ao vivo e o mesmo
// MatchSummaryModal (placar + notas + craque da partida) do Brasileirão
// clássico/Atual ("nossa simulação padrão"), sem perspectiva de clube (os
// dois lados são só "o time da casa" e "o time de fora").
function LiveMatchScreen({ pending, roundLabel, onFinish }) {
  const { homeTeam, awayTeam } = pending;
  const { phase, minute, score, shownEvents, speed, setSpeed, start, skipToEnd } = useTraditionalLiveMatch(pending);
  const hColor = homeTeam.color || '#3a85d9';
  const aColor = awayTeam.color || '#c94040';

  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '24px 16px', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <div style={{ fontSize: 10.5, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 10 }}>{roundLabel}</div>
      <div style={ts.liveMatchBox}>
        <div style={ts.liveTeamsRow}>
          <div style={{ ...ts.liveTeamName, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{homeTeam.label}</span>
            <TeamCrest team={homeTeam} size={28} />
          </div>
          <div style={ts.liveScoreBlock}>
            <span style={ts.liveScoreNum}>{phase === 'intro' ? '–' : score.home}</span>
            <span style={ts.liveScoreDash}>–</span>
            <span style={ts.liveScoreNum}>{phase === 'intro' ? '–' : score.away}</span>
          </div>
          <div style={{ ...ts.liveTeamName, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 6, minWidth: 0 }}>
            <TeamCrest team={awayTeam} size={28} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{awayTeam.label}</span>
          </div>
        </div>

        {phase !== 'intro' && (
          <div style={ts.clockRow}>
            <div style={{ ...ts.clock, color: phase === 'playing' ? 'var(--success)' : 'var(--ink)' }}>{minute}'</div>
            {phase === 'playing' && <div style={ts.clockPulse} />}
            {phase === 'playing' && (
              <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
                {[1, 1.5, 2].map(sp => (
                  <button key={sp} onClick={() => setSpeed(sp)} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: speed === sp ? 700 : 400,
                    padding: '3px 8px', borderRadius: 6, border: '1px solid', cursor: 'pointer',
                    borderColor: speed === sp ? 'var(--gold)' : 'var(--line-strong)',
                    background: speed === sp ? 'rgba(194,154,69,0.15)' : 'transparent',
                    color: speed === sp ? 'var(--gold-ink)' : 'var(--ink-2)',
                  }}>{sp}x</button>
                ))}
              </div>
            )}
            {phase === 'done' && <div style={ts.clockFull}>Tempo encerrado</div>}
          </div>
        )}

        {shownEvents.length > 0 && (
          <div style={ts.matchCenter}>
            {shownEvents.map((ev, i) => {
              const isHomeSide = ev.teamId === homeTeam.id;
              const sideColor = isHomeSide ? hColor : aColor;
              const content = (
                <div style={{ ...ts.matchCenterCard, borderColor: `${sideColor}55`, background: `${sideColor}14`, flexDirection: isHomeSide ? 'row' : 'row-reverse' }}>
                  <span style={{ fontSize: 15 }}>{eventIcon(ev)}</span>
                  <div style={{ ...ts.matchCenterInfo, textAlign: isHomeSide ? 'left' : 'right' }}>
                    <span style={ts.goalScorer}>{eventMainText(ev)}</span>
                    <span style={ts.goalTeam}>{eventSubText(ev)}</span>
                  </div>
                </div>
              );
              return (
                <div key={i} style={ts.matchCenterRow}>
                  <div style={{ ...ts.matchCenterSide, justifyContent: 'flex-end' }}>{isHomeSide && content}</div>
                  <div style={ts.matchCenterMinuteCol}>
                    <span style={ts.goalMinute}>{ev.minute}'</span>
                    <span style={ts.goalScore}>{ev.homeScore}–{ev.awayScore}</span>
                  </div>
                  <div style={{ ...ts.matchCenterSide, justifyContent: 'flex-start' }}>{!isHomeSide && content}</div>
                </div>
              );
            })}
          </div>
        )}
        {shownEvents.length === 0 && phase === 'done' && <div style={ts.noGoalsMsg}>Sem gols — 0 × 0</div>}
      </div>

      {phase === 'intro' && (
        <button onClick={start} style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: 'var(--gold)', color: 'var(--ink)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>▶ Jogar partida</button>
      )}
      {phase === 'playing' && (
        <button onClick={skipToEnd} style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>⏭ Pular pro resultado</button>
      )}

      {phase === 'done' && (
        <MatchSummaryModal
          ratings={pending.sim.ratings}
          match={{ homeId: homeTeam.id, awayId: awayTeam.id }}
          score={{ homeGoals: score.home, awayGoals: score.away }}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          myTeamId={null}
          myTeamColor="#C29A45"
          onDismiss={onFinish}
        />
      )}
    </div>
  );
}

export function Simulator2026App({ onExit }) {
  const [teams] = useState(buildTeams);
  const [save, setSave] = useState(() => loadSave() || buildInitialState(teams));
  const [pendingMatch, setPendingMatch] = useState(null); // { key, ...prepareMatch() } | null

  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
  const totalMatches = REMAINING_MATCHES.length;
  const seasonOver = save.matchIdx >= totalMatches;
  const nextMatch = seasonOver ? null : REMAINING_MATCHES[save.matchIdx];

  function applyResult(current, result) {
    const table = applyRoundToTable(current.table, [result]);
    const next = { ...current, table, matchIdx: current.matchIdx + 1, log: [...current.log, result] };
    persistSave(next);
    return next;
  }

  const handlePlayMatch = () => {
    if (!nextMatch) return;
    const packaged = prepareMatch(save.seed, teamById, nextMatch);
    setPendingMatch({ key: save.matchIdx, ...packaged });
  };

  const handleFinishMatch = () => {
    if (!pendingMatch) return;
    setSave(prev => applyResult(prev, pendingMatch.result));
    setPendingMatch(null);
  };

  // Reseta pra rodada 34 com uma seed NOVA (aleatória) — sem isso, recomeçar
  // sempre dava os mesmos 41 resultados (seed fixa). Disponível a qualquer
  // momento, não só quando a temporada termina.
  const handleSimulateAgain = () => {
    setPendingMatch(null);
    setSave(buildInitialState(teams));
  };

  if (pendingMatch) {
    const roundLabel = pendingMatch.result.postponed ? 'Jogo atrasado — Rodada 21' : `Brasileirão 2026 · Rodada ${pendingMatch.result.round}`;
    return <LiveMatchScreen pending={pendingMatch} roundLabel={roundLabel} onFinish={handleFinishMatch} />;
  }

  const lastResults = [...save.log].reverse().slice(0, 12);

  return (
    <div style={{ width: '100%', maxWidth: 680, margin: '0 auto', padding: '24px 16px', fontFamily: "'Inter', sans-serif", color: 'var(--ink)' }}>
      <button
        onClick={onExit}
        style={{ background: 'none', border: '1px solid var(--line-strong)', borderRadius: 8, color: 'var(--ink)', padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', marginBottom: 16 }}
      >← Voltar ao menu</button>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, marginBottom: 4 }}>📡 Simulador do Brasileirão 2026</h1>
      <p style={{ fontSize: 12.5, opacity: 0.6, marginBottom: 18 }}>
        {seasonOver
          ? 'Temporada encerrada — campeão definido.'
          : `Jogo ${save.matchIdx + 1} de ${totalMatches} — tabela real até a rodada 34, simulando o resto jogo por jogo a partir daqui.`}
      </p>

      {!seasonOver && nextMatch && (
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(194,154,69,0.1)', border: '1px solid var(--gold)', marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', marginBottom: 8 }}>
            {nextMatch.postponed ? 'Jogo atrasado — Rodada 21' : `Rodada ${nextMatch.round}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <TeamCrest team={teamById[nextMatch.homeId]} size={28} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>{teamById[nextMatch.homeId].club}</span>
            <span style={{ fontSize: 12, opacity: 0.5 }}>×</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{teamById[nextMatch.awayId].club}</span>
            <TeamCrest team={teamById[nextMatch.awayId]} size={28} />
          </div>
        </div>
      )}

      {!seasonOver && (
        <button
          onClick={handlePlayMatch}
          style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: 'var(--gold)', color: 'var(--ink)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}
        >▶ Jogar este jogo</button>
      )}
      <button
        onClick={handleSimulateAgain}
        style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 18 }}
      >🔁 Simular tudo novamente{seasonOver ? '' : ' (recomeça da rodada 34)'}</button>

      {lastResults.length > 0 && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Últimos resultados
          </div>
          <div style={{ display: 'grid', gap: 5 }}>
            {lastResults.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                <span style={{ fontSize: 9, opacity: 0.4, width: 44, flexShrink: 0 }}>{r.postponed ? 'R21 (atr.)' : `R${r.round}`}</span>
                <TeamCrest team={teamById[r.homeId]} size={18} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teamById[r.homeId].club}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13.5 }}>{r.homeGoals} x {r.awayGoals}</span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teamById[r.awayId].club}</span>
                <TeamCrest team={teamById[r.awayId]} size={18} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Classificação</div>
      <div style={{ borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 28px 28px 28px 28px 36px 36px', gap: 4, padding: '6px 10px', fontSize: 9.5, opacity: 0.5, fontWeight: 700, background: 'var(--surface)' }}>
          <span>#</span><span>Time</span><span style={{ textAlign: 'center' }}>PJ</span><span style={{ textAlign: 'center' }}>V</span><span style={{ textAlign: 'center' }}>E</span><span style={{ textAlign: 'center' }}>D</span><span style={{ textAlign: 'center' }}>SG</span><span style={{ textAlign: 'center' }}>PTS</span>
        </div>
        {save.table.map((row, i) => {
          const zoneColor = i < 4 ? '#1F7A4D' : i < 6 ? '#2F6FA8' : i < 12 ? '#9AA39D' : i >= 16 ? '#B23B3B' : 'transparent';
          return (
            <div key={row.id} style={{
              display: 'grid', gridTemplateColumns: '24px 1fr 28px 28px 28px 28px 36px 36px', gap: 4, alignItems: 'center',
              padding: '7px 10px', fontSize: 12, borderTop: '1px solid var(--line)',
              borderLeft: `3px solid ${zoneColor}`, background: i === 0 ? 'rgba(194,154,69,0.1)' : 'transparent',
            }}>
              <span style={{ opacity: 0.6, fontFamily: 'var(--font-mono)' }}>{i + 1}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                <TeamCrest team={row} size={18} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: i === 0 ? 700 : 400 }}>{row.club}</span>
              </span>
              <span style={{ textAlign: 'center', opacity: 0.8 }}>{row.pj}</span>
              <span style={{ textAlign: 'center', opacity: 0.8 }}>{row.v}</span>
              <span style={{ textAlign: 'center', opacity: 0.8 }}>{row.e}</span>
              <span style={{ textAlign: 'center', opacity: 0.8 }}>{row.d}</span>
              <span style={{ textAlign: 'center', opacity: 0.8 }}>{row.gp - row.gc}</span>
              <span style={{ textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{row.pts}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 10, opacity: 0.5, marginTop: 8 }}>
        <span>🟩 G4 — Libertadores (grupos)</span>
        <span>🟦 G6 — Libertadores (pré)</span>
        <span>🟥 Z4 — Rebaixamento</span>
      </div>
    </div>
  );
}
