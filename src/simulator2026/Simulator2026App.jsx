// Simulador do Brasileirão 2026 — sub-app própria (igual o Modo Carreira),
// montada por App.jsx no lugar do corpo normal do jogo (ver `simulator2026Open`
// em App.jsx). Pedido explícito do usuário (2026-11-12): "a ideia é simular
// literalmente TODOS OS JOGOS QUE FALTAM um por um, não de um só time" — bem
// diferente do Brasileirão Atual (que segue a perspectiva de UM clube
// escolhido): aqui não tem clube nenhum, é a liga inteira, JOGO POR JOGO
// (não rodada por rodada), cada um pela MESMA simulação ao vivo minuto a
// minuto do resto do jogo ("simula o jogo como nossa simulação padrão") —
// reaproveita `useLiveMatchPlayer`/`MatchSpeedPicker`/etc. do Modo Carreira
// (liveMatchUI.jsx), que já são 100% genéricos (só precisam de
// sim/homeTeam/awayTeam, nada de save de carreira). Começa EXATAMENTE de
// onde o Brasileirão real está agora: primeiro jogo é o adiado da rodada 21
// (Chapecoense x Vasco, nunca saiu placar real até a planilha que o usuário
// passou ser gerada — ver src/data/brasileirao-2026-real-results.js), depois
// a rodada 35 inteira, jogo a jogo, até a 38.
import { useState } from 'react';
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
import { teamStrength, simAiMatch, applyRoundToTable, matchPrng, buildLiveMatchEvents } from '../App.jsx';
import {
  eventIcon, eventText, TeamBadge, RatingsList, useLiveMatchPlayer, MatchSpeedPicker,
  wrapStyle, cardStyle, labelStyle, primaryBtnStyle, secondaryBtnStyle,
} from '../career/components/liveMatchUI.jsx';

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

// Estado inicial: tabela já com os 339 placares reais das rodadas 1-34
// aplicados (mesma applyRoundToTable que qualquer jogo simulado usa, pra
// nunca divergir do motor por um número copiado à mão) — o jogo adiado da
// rodada 21 ainda NÃO entra aqui: ele é o primeiro item de
// REMAINING_MATCHES, resolvido só quando o usuário jogar ele de verdade.
function buildInitialState(teams) {
  const zeroedTable = teams.map(emptyTableRow);
  const table = applyRoundToTable(zeroedTable, REAL_RESULTS_2026_THROUGH_R34);
  return { seed: 'simulador-2026', matchIdx: 0, table, log: [] };
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
    : <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />;
}

// Monta o pacote de UMA partida (placar + timeline minuto a minuto já
// prontos, mesmo formato que `legPackage`/CareerMatchDayScreen usam) — o
// placar sai da MESMA seed determinística (matchPrng) que "Até o fim" usa
// pra esse jogo, então assistir ao vivo ou pular pro resultado final nunca
// diverge.
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

// Tela de partida ao vivo — mesmíssimo visual/motor do Modo Carreira
// (CareerMatchDayScreen), só que sem perspectiva de clube nenhuma (os dois
// lados são só "o time da casa" e "o time de fora").
function LiveMatchScreen({ pending, roundLabel, onFinish }) {
  const { homeTeam, awayTeam, sim } = pending;
  const { phase, minute, homeGoals, awayGoals, shownEvents, startPlaying, skipToEnd, motm, speedKey, changeSpeed } = useLiveMatchPlayer(sim, homeTeam, awayTeam);

  if (phase === 'intro') {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <div style={labelStyle}>{roundLabel}</div>
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
        <div style={labelStyle}>{roundLabel}</div>
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

  // "Até o fim" continua instantâneo (sem animação) — jogar os 41 jogos um
  // por um ao vivo seria muito repetitivo pra quem só quer ver a tabela
  // final, mesmo padrão do Modo Carreira ("Simular temporada até o fim").
  const handleSimulateToEnd = () => setSave(prev => {
    let next = prev;
    while (next.matchIdx < totalMatches) {
      const m = REMAINING_MATCHES[next.matchIdx];
      const { result } = prepareMatch(next.seed, teamById, m);
      next = applyResult(next, result);
    }
    return next;
  });

  const handleReset = () => {
    setPendingMatch(null);
    setSave(buildInitialState(teams));
  };

  if (pendingMatch) {
    const roundLabel = pendingMatch.result.postponed ? 'Jogo atrasado — Rodada 21' : `Brasileirão 2026 · Rodada ${pendingMatch.result.round}`;
    return <LiveMatchScreen pending={pendingMatch} roundLabel={roundLabel} onFinish={handleFinishMatch} />;
  }

  const lastResults = [...save.log].reverse().slice(0, 12);

  return (
    <div style={{ width: '100%', maxWidth: 680, margin: '0 auto', padding: '24px 16px', fontFamily: "'Inter', sans-serif", color: '#F4F1EA' }}>
      <button
        onClick={onExit}
        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#F4F1EA', padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', marginBottom: 16 }}
      >← Voltar ao menu</button>

      <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, marginBottom: 4 }}>📡 Simulador do Brasileirão 2026</h1>
      <p style={{ fontSize: 12.5, opacity: 0.6, marginBottom: 18 }}>
        {seasonOver
          ? 'Temporada encerrada — campeão definido.'
          : `Jogo ${save.matchIdx + 1} de ${totalMatches} — tabela real até a rodada 34, simulando o resto jogo por jogo a partir daqui.`}
      </p>

      {!seasonOver && nextMatch && (
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(212,162,60,0.08)', border: '1px solid rgba(212,162,60,0.3)', marginBottom: 14 }}>
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <button
            onClick={handlePlayMatch}
            style={{ flex: 1, padding: '13px 0', borderRadius: 10, border: 'none', background: '#d4a23c', color: '#0B1A12', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >▶ Jogar este jogo</button>
          <button
            onClick={handleSimulateToEnd}
            style={{ padding: '13px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.04)', color: '#F4F1EA', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >⏩ Até o fim</button>
        </div>
      )}
      {seasonOver && (
        <button
          onClick={handleReset}
          style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.04)', color: '#F4F1EA', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 18 }}
        >↺ Recomeçar simulação (volta pra rodada 34)</button>
      )}

      {lastResults.length > 0 && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Últimos resultados
          </div>
          <div style={{ display: 'grid', gap: 5 }}>
            {lastResults.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                <span style={{ fontSize: 9, opacity: 0.4, width: 44, flexShrink: 0 }}>{r.postponed ? 'R21 (atr.)' : `R${r.round}`}</span>
                <TeamCrest team={teamById[r.homeId]} size={18} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teamById[r.homeId].club}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13.5 }}>{r.homeGoals} x {r.awayGoals}</span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teamById[r.awayId].club}</span>
                <TeamCrest team={teamById[r.awayId]} size={18} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Classificação</div>
      <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 28px 28px 28px 28px 36px 36px', gap: 4, padding: '6px 10px', fontSize: 9.5, opacity: 0.5, fontWeight: 700, background: 'rgba(255,255,255,0.03)' }}>
          <span>#</span><span>Time</span><span style={{ textAlign: 'center' }}>PJ</span><span style={{ textAlign: 'center' }}>V</span><span style={{ textAlign: 'center' }}>E</span><span style={{ textAlign: 'center' }}>D</span><span style={{ textAlign: 'center' }}>SG</span><span style={{ textAlign: 'center' }}>PTS</span>
        </div>
        {save.table.map((row, i) => {
          const zoneColor = i < 4 ? '#7fd99a' : i < 6 ? '#5dade2' : i < 12 ? '#9fb3a8' : i >= 16 ? '#e05050' : 'transparent';
          return (
            <div key={row.id} style={{
              display: 'grid', gridTemplateColumns: '24px 1fr 28px 28px 28px 28px 36px 36px', gap: 4, alignItems: 'center',
              padding: '7px 10px', fontSize: 12, borderTop: '1px solid rgba(255,255,255,0.05)',
              borderLeft: `3px solid ${zoneColor}`, background: i === 0 ? 'rgba(212,162,60,0.08)' : 'transparent',
            }}>
              <span style={{ opacity: 0.6, fontFamily: "'Space Mono', monospace" }}>{i + 1}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                <TeamCrest team={row} size={18} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: i === 0 ? 700 : 400 }}>{row.club}</span>
              </span>
              <span style={{ textAlign: 'center', opacity: 0.8 }}>{row.pj}</span>
              <span style={{ textAlign: 'center', opacity: 0.8 }}>{row.v}</span>
              <span style={{ textAlign: 'center', opacity: 0.8 }}>{row.e}</span>
              <span style={{ textAlign: 'center', opacity: 0.8 }}>{row.d}</span>
              <span style={{ textAlign: 'center', opacity: 0.8 }}>{row.gp - row.gc}</span>
              <span style={{ textAlign: 'center', fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>{row.pts}</span>
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
