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
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { teamStrength, aiSquadPlayers, simAiMatch, applyRoundToTable, matchPrng, buildLiveMatchEvents, MatchSummaryModal } from '../App.jsx';
import { matchOutcomeProbabilities } from '../lib/probability.js';
import { zoneOf, formOf, remainingByClub, stakesFor, disputes, realBaselinePositions } from '../lib/insights.js';
import { Icon, Modal, ConfirmInline } from '../ui/index.jsx';
import { LiveScoreboard, LiveFeed, LiveSeg, LiveButton } from '../components/football/LiveMatchView.jsx';
import { CLUB_STADIUMS } from '../data/info-content.js';
import '../game/league/matchTab.css';
import '../game/league/league.css';
import './simulator2026.css';
import { displayName } from '../lib/displayName.js';
import { ClubCrest } from '../components/football/ClubCrest.jsx';
import { StandingsTable } from '../components/football/StandingsTable.jsx';
import { zoneFor, ZONE_LEGEND } from '../lib/standings.js';
import { MatchPreviewCard, RoundGames } from '../components/football/MatchPreviewCard.jsx';
import { SeasonEndSummary } from '../components/football/SeasonEndSummary.jsx';

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
    const playersWithMeta = aiSquadPlayers(t);
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

// Escudo do clube; sem logo, um círculo com a cor do clube. `ring` põe o
// escudo num círculo branco (cards escuros do redesenho de 2026-11-13).
const TeamCrest = ({ team, size = 22, ring = false }) => (ring
  ? <ClubCrest team={team} size={size} frame frameClass="fb-crest-ring" scale={0.72} />
  : <ClubCrest team={team} size={size} />);

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
  const [paused, setPaused] = useState(false);
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
    setPaused(false);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [pending?.key]);

  if (!pending) return { phase: 'intro', minute: 0, score, shownEvents, speed, setSpeed, paused, start: () => {}, skipToEnd: () => {}, pause: () => {}, resume: () => {} };

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

  // Pausar só segura o relógio: o resultado e os eventos já saíram prontos de prepareMatch.
  const pause = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setPaused(true);
  };
  const resume = () => {
    setPaused(false);
    timerRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
  };

  const skipToEnd = () => {
    setPaused(false);
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

  return { phase, minute, score, shownEvents, speed, setSpeed, paused, start, skipToEnd, pause, resume };
}

// Tela de partida ao vivo — mesmo motor/feed "tradicional" e o mesmo
// MatchSummaryModal do Brasileirão clássico/Atual; o redesenho de
// 2026-11-13 só troca cores e componentes para o padrão creme (estrutura,
// velocidades 1x/1.5x/2x e "Pular pro resultado" iguais).
function LiveMatchScreen({ pending, matchNo, totalMatches, table, upcoming, teamById, nameOf, onFinish, onBack, onQuick, isLast, seasonLeftAfter }) {
  const { homeTeam, awayTeam, result } = pending;
  const { phase, minute, score, shownEvents, speed, setSpeed, paused, start, skipToEnd, pause, resume } = useTraditionalLiveMatch(pending);
  const [confirmBack, setConfirmBack] = useState(false);
  const posOf = (t, id) => t.findIndex(r => r.id === id) + 1;
  const rowOf = (t, id) => t.find(r => r.id === id);
  const status = phase === 'intro' ? 'pre' : phase === 'done' ? 'done' : paused ? 'paused' : 'live';
  const title = result.postponed ? 'Jogo atrasado · Rodada 21' : `Rodada ${result.round}`;
  const hp = posOf(table, homeTeam.id), ap = posOf(table, awayTeam.id);
  const stadium = CLUB_STADIUMS[homeTeam.club];

  // "Se terminar assim": placar parcial aplicado numa CÓPIA da tabela
  // (mesma conta do simulador). Recalcula só quando o placar muda.
  const partial = useMemo(() => applyRoundToTable(table, [{ homeId: homeTeam.id, awayId: awayTeam.id, homeGoals: score.home, awayGoals: score.away }]), [table, score.home, score.away, homeTeam.id, awayTeam.id]);
  const moves = useMemo(() => table.map(r => ({ id: r.id, b: posOf(table, r.id), a: posOf(partial, r.id) })).filter(m => m.b !== m.a && m.id !== homeTeam.id && m.id !== awayTeam.id), [table, partial, homeTeam.id, awayTeam.id]);
  const finalTable = useMemo(() => applyRoundToTable(table, [result]), [table, result]);
  const decidedAfter = useMemo(() => disputes(finalTable, seasonLeftAfter, nameOf), [finalTable, seasonLeftAfter, nameOf]);

  const crest = (t, size) => <TeamCrest team={t} size={size} ring />;
  const side = (t) => {
    const r = rowOf(table, t.id);
    return { id: t.id, raw: t, name: displayName(t.club), crest: crest(t, 72), sub: `${posOf(table, t.id)}º · ${r?.pts ?? 0} pts` };
  };
  const odds = matchOutcomeProbabilities(homeTeam, awayTeam);
  const SPEEDS = [{ id: 1, label: '1x' }, { id: 1.5, label: '1,5x' }, { id: 2, label: '2x' }];
  const afterSub = (id) => {
    const p2 = posOf(finalTable, id);
    const r = rowOf(finalTable, id);
    if (decidedAfter.title.decided && decidedAfter.title.leader === id) return `${p2}º · campeão`;
    if (decidedAfter.z4.relegated.includes(id)) return `${p2}º · rebaixado`;
    return `${p2}º · ${r?.pts ?? 0} pts`;
  };
  const impact = table.map(r => ({ id: r.id, b: posOf(table, r.id), a: posOf(finalTable, r.id) }))
    .filter(m => m.b !== m.a || m.id === homeTeam.id || m.id === awayTeam.id)
    .sort((x, y) => (y.b - y.a) - (x.b - x.a))
    .slice(0, 6)
    .map(m => ({
      key: m.id, name: nameOf(m.id),
      text: decidedAfter.z4.relegated.includes(m.id) && m.b === m.a ? 'rebaixado' : m.b === m.a ? `segue ${m.a}º` : `${m.b}º → ${m.a}º`,
      tone: m.a < m.b ? 'up' : m.a > m.b || decidedAfter.z4.relegated.includes(m.id) ? 'down' : null,
    }));

  const header = (
    <div className="sl-h">
      <div className="sl-mono-crest" aria-hidden="true">2026</div>
      <div style={{ minWidth: 0 }}>
        <span className="ng-mono">Simulador do Brasileirão 2026 · jogo {matchNo} de {totalMatches}</span>
        <h1>{title}</h1>
        <div className="lg-tags">
          <span className="lg-tag">{displayName(homeTeam.club)} {hp}º × {displayName(awayTeam.club)} {ap}º</span>
          {status === 'live' && <span className="lg-tag lg-tag-gold">Ao vivo</span>}
          {status === 'paused' && <span className="lg-tag lg-tag-gold">Pausado</span>}
        </div>
      </div>
      <button type="button" className="lg-btn sl-back" onClick={() => (status === 'live' || status === 'paused' ? setConfirmBack(true) : onBack())}><Icon name="chevronLeft" size={14} />Voltar ao simulador</button>
    </div>
  );

  return (
    <div className="sl-wrap">
      {header}
      {confirmBack && (
        <ConfirmInline
          text="Voltar agora não muda o placar: o resultado deste jogo já está definido e volta igual quando você jogar de novo."
          confirmLabel="Voltar ao simulador" tone="dark"
          onConfirm={() => { setConfirmBack(false); onBack(); }} onCancel={() => setConfirmBack(false)}
        />
      )}
      <div className="sl-lay">
        <div className="sl-lc">
          {status === 'pre' ? (
            <MatchPreviewCard
              size="md"
              eyebrow={`Mando do ${displayName(homeTeam.club)}${stadium ? ` · ${stadium}` : ''}`}
              home={{ crest: crest(homeTeam, 72), name: displayName(homeTeam.club), sub: `${hp}º · ${rowOf(table, homeTeam.id)?.pts ?? 0} pts`, form: formOf(homeTeam.id, REAL_RESULTS_2026_THROUGH_R34, upcoming.log) }}
              away={{ crest: crest(awayTeam, 72), name: displayName(awayTeam.club), sub: `${ap}º · ${rowOf(table, awayTeam.id)?.pts ?? 0} pts`, form: formOf(awayTeam.id, REAL_RESULTS_2026_THROUGH_R34, upcoming.log) }}
              probs={{ home: odds.homeWin, draw: odds.draw, away: odds.awayWin }}
              actions={(
                <>
                  <button type="button" className="sm-b-o" onClick={onQuick}><Icon name="forward" size={16} />Só o resultado</button>
                  <button type="button" className="sm-b-g" onClick={start}><Icon name="play" size={16} />Jogar ao vivo</button>
                </>
              )}
            />
          ) : (
            <LiveScoreboard
              eyebrow={`Mando do ${displayName(homeTeam.club)}${stadium ? ` · ${stadium}` : ''}`}
              status={status}
              home={side(homeTeam)}
              away={side(awayTeam)}
              score={score}
              minute={minute}
              events={shownEvents}
              controls={status === 'done' ? null : (
                <>
                  <LiveSeg label="Velocidade" options={SPEEDS} value={speed} onChange={setSpeed} />
                  <LiveButton tone="ghost" icon="forward" onClick={skipToEnd}>Pular para o resultado</LiveButton>
                  {status === 'live' ? <LiveButton icon="clock" onClick={pause}>Pausar</LiveButton> : <LiveButton icon="play" onClick={resume}>Continuar</LiveButton>}
                </>
              )}
            />
          )}
          {status !== 'pre' && <LiveFeed events={shownEvents} homeId={homeTeam.id} homeName={displayName(homeTeam.club)} awayName={displayName(awayTeam.club)} minute={minute} status={status} />}
        </div>
        <div className="sl-side">
          {status !== 'pre' && (
            <section className="lg-card">
              <div className="lg-ch"><h3>Se terminar assim</h3><span className="lg-small">impacto na tabela</span></div>
              {[homeTeam, awayTeam].map(t => {
                const b = posOf(table, t.id), a2 = posOf(partial, t.id);
                return (
                  <div key={t.id} className="sl-imp">
                    <TeamCrest team={t} size={20} />
                    <div style={{ minWidth: 0 }}><b>{displayName(t.club)}</b><small>{rowOf(table, t.id)?.pts ?? 0} → {rowOf(partial, t.id)?.pts ?? 0} pts</small></div>
                    <span className={a2 < b ? 'tb-up' : a2 > b ? 'tb-dn' : 'sl-eq'}>{a2 === b ? `segue ${a2}º` : `${b}º → ${a2}º`}</span>
                  </div>
                );
              })}
              {moves.slice(0, 4).map(m => (
                <div key={m.id} className="sl-imp">
                  <TeamCrest team={teamById[m.id]} size={20} />
                  <div style={{ minWidth: 0 }}><b>{nameOf(m.id)}</b><small>{rowOf(table, m.id)?.pts ?? 0} pts</small></div>
                  <span className={m.a < m.b ? 'tb-up' : 'tb-dn'}>{m.b}º → {m.a}º</span>
                </div>
              ))}
            </section>
          )}
          <section className="lg-card">
            <div className="lg-ch"><h3>O que está em jogo</h3></div>
            {[homeTeam, awayTeam].map(t => (
              <div key={t.id} className="sl-imp sl-stk"><div><b>{displayName(t.club)}</b><small>{stakesFor(table, result, t.id, nameOf)}</small></div></div>
            ))}
          </section>
          {upcoming.next.length > 0 && (
            <section className="lg-card">
              <div className="lg-ch"><h3>Na sequência</h3><span className="lg-small">{upcoming.next[0].m.postponed ? 'R21' : `Rodada ${upcoming.next[0].m.round}`}</span></div>
              {upcoming.next.map(({ m, no }) => (
                <div key={no} className="sl-imp">
                  <TeamCrest team={teamById[m.homeId]} size={20} />
                  <div style={{ minWidth: 0 }}><b>{nameOf(m.homeId)} × {nameOf(m.awayId)}</b><small>jogo {no} de {totalMatches}</small></div>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>

      {status === 'done' && (
        <MatchSummaryModal
          ratings={pending.sim.ratings}
          match={{ homeId: homeTeam.id, awayId: awayTeam.id }}
          score={{ homeGoals: score.home, awayGoals: score.away }}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homeName={displayName(homeTeam.club)}
          awayName={displayName(awayTeam.club)}
          myTeamId={null}
          myTeamColor="#C29A45"
          events={shownEvents}
          eyebrow={`Fim de jogo · ${result.postponed ? 'jogo atrasado da rodada 21' : `rodada ${result.round}`}`}
          eyebrowRight={`jogo ${matchNo} de ${totalMatches}`}
          homeSub={afterSub(homeTeam.id)}
          awaySub={afterSub(awayTeam.id)}
          impact={impact}
          secondary={{ label: 'Ver tabela', onClick: () => onFinish('table') }}
          nextText={upcoming.next[0] ? `Próximo: ${nameOf(upcoming.next[0].m.homeId)} × ${nameOf(upcoming.next[0].m.awayId)} · ${upcoming.next[0].m.postponed ? 'R21' : `Rodada ${upcoming.next[0].m.round}`}` : null}
          primaryLabel={isLast ? 'Ver campeão' : 'Próximo jogo'}
          primaryIcon={isLast ? 'trophy' : 'chevronRight'}
          onDismiss={() => onFinish(isLast ? 'end' : 'next')}
        />
      )}
    </div>
  );
}

// Agrupamento da faixa de progresso: o jogo atrasado da R21 e as rodadas 35–38.
const ROUND_GROUPS = (() => {
  const groups = [];
  REMAINING_MATCHES.forEach((m, idx) => {
    const key = m.postponed ? 'r21' : `r${m.round}`;
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, round: m.round, postponed: !!m.postponed, idxs: [] }; groups.push(g); }
    g.idxs.push(idx);
  });
  return groups;
})();
const groupLabel = (g) => (g.postponed ? 'R21 · atr.' : `Rodada ${g.round}`);


export function Simulator2026App({ onExit }) {
  const [teams] = useState(buildTeams);
  const [save, setSave] = useState(() => {
    const saved = loadSave();
    if (saved) return saved;
    // Grava a seed já na criação: sem isso, recarregar antes do 1º resultado
    // sorteava outra seed e o mesmo jogo saía com outro placar.
    const fresh = buildInitialState(teams);
    persistSave(fresh);
    return fresh;
  });
  const [pendingMatch, setPendingMatch] = useState(null); // { key, ...prepareMatch() } | null
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState(null);
  const [viewGroup, setViewGroup] = useState(null);
  const roundCardRef = useRef(null);

  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
  const nameOf = (id) => displayName(teamById[id]?.club || '');
  const totalMatches = REMAINING_MATCHES.length;
  const seasonOver = save.matchIdx >= totalMatches;
  const nextMatch = seasonOver ? null : REMAINING_MATCHES[save.matchIdx];

  // Classificação real ao fim da rodada 34 (base das setas de movimento).
  const baseline = useMemo(() => realBaselinePositions(buildInitialState(teams, 'baseline').table), [teams]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function applyResult(current, result) {
    const table = applyRoundToTable(current.table, [result]);
    const next = { ...current, table, matchIdx: current.matchIdx + 1, log: [...current.log, result] };
    persistSave(next);
    return next;
  }

  const resultText = (r) => `${r.postponed ? 'R21 atrasado' : `R${r.round}`}: ${nameOf(r.homeId)} ${r.homeGoals} × ${r.awayGoals} ${nameOf(r.awayId)}`;

  const handlePlayMatch = () => {
    if (!nextMatch) return;
    const packaged = prepareMatch(save.seed, teamById, nextMatch);
    setPendingMatch({ key: save.matchIdx, ...packaged });
  };

  // "Só o resultado": o MESMO pacote do ao vivo (mesma seed/prepareMatch),
  // aplicado direto, sem tela de partida.
  const handleQuickResult = () => {
    if (!nextMatch) return;
    const { result } = prepareMatch(save.seed, teamById, nextMatch);
    setSave(prev => applyResult(prev, result));
    setToast(resultText(result));
  };

  // mode: 'next' (já abre o próximo jogo), 'table' (volta e rola até a
  // classificação), 'end' (último jogo: volta para o campeão).
  const handleFinishMatch = (mode) => {
    if (!pendingMatch) return;
    const r = pendingMatch.result;
    const nextSave = applyResult(save, r);
    setSave(nextSave);
    setToast(resultText(r));
    const nm = REMAINING_MATCHES[nextSave.matchIdx];
    if (mode === 'next' && nm) {
      setPendingMatch({ key: nextSave.matchIdx, ...prepareMatch(nextSave.seed, teamById, nm) });
      window.scrollTo?.(0, 0);
      return;
    }
    setPendingMatch(null);
    if (mode === 'table') requestAnimationFrame(() => document.getElementById('sm-tbl-h')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Reseta para a rodada 34 com uma seed NOVA (aleatória).
  const handleSimulateAgain = () => {
    setPendingMatch(null);
    setConfirmReset(false);
    setViewGroup(null);
    // Grava já o recomeço — antes só a tela zerava e, ao recarregar, voltava o save antigo.
    const fresh = buildInitialState(teams);
    persistSave(fresh);
    setSave(fresh);
  };

  if (pendingMatch) {
    const idx = pendingMatch.key;
    const next = [idx + 1, idx + 2].filter(i => i < totalMatches).map(i => ({ m: REMAINING_MATCHES[i], no: i + 1 }));
    return (
      <LiveMatchScreen
        pending={pendingMatch}
        matchNo={idx + 1}
        totalMatches={totalMatches}
        table={save.table}
        upcoming={{ next, log: save.log }}
        seasonLeftAfter={remainingByClub(REMAINING_MATCHES, idx + 1)}
        teamById={teamById}
        nameOf={nameOf}
        isLast={idx + 1 >= totalMatches}
        onFinish={handleFinishMatch}
        onBack={() => setPendingMatch(null)}
        onQuick={() => { const r = pendingMatch.result; setSave(prev => applyResult(prev, r)); setPendingMatch(null); setToast(resultText(r)); }}
      />
    );
  }

  const table = save.table;
  const left = remainingByClub(REMAINING_MATCHES, save.matchIdx);
  const dsp = disputes(table, left, nameOf);
  const pos = (id) => table.findIndex(r => r.id === id) + 1;
  const curGroup = nextMatch ? ROUND_GROUPS.find(g => g.idxs.includes(save.matchIdx)) : ROUND_GROUPS[ROUND_GROUPS.length - 1];
  const shownGroup = ROUND_GROUPS.find(g => g.key === viewGroup) || curGroup;
  const logByIdx = (idx) => (idx < save.matchIdx ? save.log[idx] : null);
  const playedInShown = shownGroup.idxs.filter(i => i < save.matchIdx).length;
  const lastResults = [...save.log].reverse().slice(0, 3);
  const hl = nextMatch ? new Set([nextMatch.homeId, nextMatch.awayId]) : new Set();

  const openGroup = (g) => {
    setViewGroup(g.key);
    requestAnimationFrame(() => roundCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // ── Card do próximo jogo / encerramento ──
  let hero;
  if (nextMatch) {
    const h = teamById[nextMatch.homeId], a = teamById[nextMatch.awayId];
    const odds = matchOutcomeProbabilities(h, a);
    const side = (t) => {
      const p = pos(t.id);
      const z = zoneOf(p);
      return {
        crest: <TeamCrest team={t} size={76} ring />,
        name: displayName(t.club),
        sub: `${p}º · ${table[p - 1].pts} pts${z && (z.key === 'g4' || z.key === 'z4') ? ` · ${z.label}` : ''}`,
        form: formOf(t.id, REAL_RESULTS_2026_THROUGH_R34, save.log),
      };
    };
    hero = (
      <MatchPreviewCard
        id="sm-next-h"
        eyebrow={nextMatch.postponed ? `Jogo atrasado · Rodada 21 · jogo ${save.matchIdx + 1} de ${totalMatches}` : `Próximo jogo · Rodada ${nextMatch.round} · jogo ${save.matchIdx + 1} de ${totalMatches}`}
        eyebrowRight={`Mando do ${displayName(h.club)}`}
        home={side(h)}
        away={side(a)}
        probs={{ home: odds.homeWin, draw: odds.draw, away: odds.awayWin }}
        stakes={[h, a].map(t => ({ title: displayName(t.club), text: stakesFor(table, nextMatch, t.id, nameOf) }))}
        actions={(
          <>
            <button type="button" className="sm-b-o" onClick={handleQuickResult}><Icon name="forward" size={16} />Só o resultado</button>
            <button type="button" className="sm-b-g" onClick={handlePlayMatch}><Icon name="play" size={16} />Jogar ao vivo</button>
          </>
        )}
      />
    );
  } else {
    const champ = table[0];
    const rel = table.slice(-4);
    hero = (
      <SeasonEndSummary
        id="sm-end-h"
        eyebrow="Brasileirão 2026 · simulação encerrada"
        crest={<TeamCrest team={teamById[champ.id]} size={92} ring />}
        championName={nameOf(champ.id)}
        championSub={`${champ.pts} pts · ${champ.v} vitórias · saldo ${champ.gp - champ.gc > 0 ? '+' : ''}${champ.gp - champ.gc}`}
        facts={[
          { title: 'Libertadores (G4)', text: table.slice(0, 4).map(r => nameOf(r.id)).join(', ') },
          { title: 'Rebaixados', text: rel.map(r => nameOf(r.id)).join(', ') },
        ]}
        actions={<button type="button" className="sm-b-g" onClick={handleSimulateAgain}><Icon name="forward" size={16} />Simular tudo novamente</button>}
      />
    );
  }

  return (
    <div className={`sm-wrap${nextMatch ? ' sm-has-next' : ''}`}>
      <div className="sm-top">
        <div style={{ minWidth: 0 }}>
          <button type="button" className="ng-back" style={{ marginBottom: 14 }} onClick={onExit}><Icon name="chevronLeft" size={14} />Voltar ao menu</button>
          <span className="ng-mono" style={{ display: 'block' }}>Tabela real até a rodada 34 · o resto é simulado jogo a jogo</span>
          <h1>Simulador do <em>Brasileirão 2026</em></h1>
        </div>
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-md" onClick={() => setConfirmReset(true)} disabled={save.matchIdx === 0}><Icon name="forward" size={16} />Recomeçar da rodada 34</button>
      </div>

      <div className="ng-card sm-strip">
        <div className="sm-big">{save.matchIdx} <small>de {totalMatches} jogos</small></div>
        <div className="sm-rds-scroll">
          <div className="sm-rds" style={{ gridTemplateColumns: ROUND_GROUPS.map(g => (g.postponed ? '84px' : 'minmax(120px, 1fr)')).join(' ') }}>
            {ROUND_GROUPS.map(g => {
              const isCur = g === curGroup && !!nextMatch;
              const done = g.idxs.filter(i => i < save.matchIdx).length;
              return (
                <button key={g.key} type="button" className="sm-rd" onClick={() => openGroup(g)} aria-label={`${groupLabel(g)}: ${done} de ${g.idxs.length} jogados. Ver jogos`}>
                  <small>{isCur ? <b>{groupLabel(g)}</b> : groupLabel(g)}{isCur && !g.postponed ? ` · ${done}/${g.idxs.length}` : ''}</small>
                  <span className="sm-cells">{g.idxs.map(i => <i key={i} className={i < save.matchIdx ? 'sm-cf' : i === save.matchIdx ? 'sm-cn' : ''} />)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <span className="ng-small">{totalMatches - save.matchIdx} jogo{totalMatches - save.matchIdx === 1 ? '' : 's'} restante{totalMatches - save.matchIdx === 1 ? '' : 's'}</span>
      </div>

      <div className="sm-lay">
        <div className="sm-lc">
          {hero}
          <div className="sm-two">
            <section className="ng-card" ref={roundCardRef} aria-labelledby="sm-round-h" style={{ overflow: 'hidden', scrollMarginTop: 16 }}>
              <div className="ng-ch">
                <h3 id="sm-round-h">{shownGroup.postponed ? 'Jogo atrasado · R21' : `Rodada ${shownGroup.round}`}</h3>
                <span className="ng-small">{playedInShown} de {shownGroup.idxs.length} jogado{shownGroup.idxs.length === 1 ? '' : 's'}</span>
              </div>
              <RoundGames games={shownGroup.idxs.map(i => {
                const m = REMAINING_MATCHES[i];
                const r = logByIdx(i);
                return {
                  key: i,
                  home: { name: nameOf(m.homeId), crest: <TeamCrest team={teamById[m.homeId]} size={20} /> },
                  away: { name: nameOf(m.awayId), crest: <TeamCrest team={teamById[m.awayId]} size={20} /> },
                  score: r ? { h: r.homeGoals, a: r.awayGoals } : null,
                  status: r ? 'played' : i === save.matchIdx ? 'now' : 'pending',
                };
              })} />
              {shownGroup !== curGroup && <div className="sm-more"><button type="button" className="ch-link" onClick={() => setViewGroup(null)}>Voltar para a rodada atual</button></div>}
            </section>

            <section className="ng-card" aria-labelledby="sm-disp-h" style={{ overflow: 'hidden' }}>
              <div className="ng-ch"><h3 id="sm-disp-h">Disputas</h3><span className="ng-small">{dsp.maxLeft ? `até ${dsp.maxLeft} pts em jogo por time` : 'tudo decidido'}</span></div>
              <div className="sm-race">
                <div className="sm-rr"><span><b>{dsp.title.decided ? 'Campeão' : 'Título'}</b> · {nameOf(dsp.title.leader)}{dsp.title.decided ? '' : ` × ${nameOf(dsp.title.second)}`}</span><b className="sm-num">{dsp.title.decided ? '✓' : `${dsp.title.gap} pts`}</b></div>
                {!dsp.title.decided && dsp.title.pointsLeft > 0 && (
                  <div className="sm-bar2" role="img" aria-label={`O líder precisa de ${dsp.title.need} dos ${dsp.title.pointsLeft} pontos restantes`}>
                    <i style={{ left: 0, width: '100%', background: 'var(--success-soft)' }} />
                    <i style={{ left: 0, width: `${Math.min(100, (dsp.title.need / dsp.title.pointsLeft) * 100)}%`, background: 'var(--green-2)' }} />
                  </div>
                )}
                <small>{dsp.title.text}</small>
              </div>
              <div className="sm-race">
                <div className="sm-rr"><span><b>G4</b> · {nameOf(dsp.g4.a)} × {nameOf(dsp.g4.b)}</span><b className="sm-num">{dsp.g4.gap} pt{dsp.g4.gap === 1 ? '' : 's'}</b></div>
                <small>{dsp.g4.text}</small>
              </div>
              <div className="sm-race">
                <div className="sm-rr"><span><b>Z4</b> · {dsp.z4.open ? `${dsp.z4.count} times em 4 pts` : 'definido'}</span><b className="sm-num" style={{ color: dsp.z4.open ? 'var(--danger)' : 'var(--ink-2)' }}>{dsp.z4.open ? 'Aberto' : 'Definido'}</b></div>
                <small>{dsp.z4.text}</small>
              </div>
              <div className="sm-race">
                <div className="sm-rr"><span><b>Últimos resultados</b></span></div>
                <small>{lastResults.length ? lastResults.map((r, i) => <span key={i} style={{ display: 'block' }}>{resultText(r)}</span>) : 'Nenhum jogo simulado ainda.'}</small>
              </div>
            </section>
          </div>
        </div>

        <section className="ng-card sm-tbl" aria-labelledby="sm-tbl-h">
          <div className="sm-tbl-hd"><h3 id="sm-tbl-h">Classificação</h3><span className="ng-small">setas: posição em relação à tabela real</span></div>
          <StandingsTable
            rows={table}
            zoneFor={(pos, total) => zoneFor('A', pos, total)}
            prevPositions={baseline}
            showForm={false}
            highlightIds={[...hl]}
            renderCrest={(id) => <TeamCrest team={teamById[id]} size={18} />}
            renderTeamName={(row) => nameOf(row.id)}
            caption={`Classificação do Brasileirão 2026 após ${save.matchIdx} jogos simulados`}
            legend={ZONE_LEGEND.A}
            legendNote={nextMatch ? 'Em destaque: os dois times do próximo jogo' : null}
          />
        </section>
      </div>

      {nextMatch && (
        <div className="sm-mobile-cta">
          <button type="button" className="sm-b-g" onClick={handlePlayMatch}><Icon name="play" size={16} />Jogar ao vivo</button>
        </div>
      )}

      <div className="sr-only" aria-live="polite">{toast ? `Fim de jogo. ${toast}` : ''}</div>
      {toast && <div className="sm-toast" role="status"><Icon name="check" size={16} /><span>{toast}</span><button type="button" onClick={() => setToast(null)} aria-label="Fechar aviso"><Icon name="close" size={14} /></button></div>}

      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)} maxWidth={420} labelledBy="sm-reset-h">
          <h3 id="sm-reset-h" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 24, margin: '0 0 8px' }}>Recomeçar da rodada 34?</h3>
          <p style={{ color: 'var(--muted)', margin: '0 0 18px', lineHeight: 1.5 }}>Os {save.matchIdx} jogo{save.matchIdx === 1 ? '' : 's'} já simulado{save.matchIdx === 1 ? '' : 's'} são apagados e a simulação recomeça com novos resultados.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-md" style={{ flex: 1 }} onClick={() => setConfirmReset(false)} autoFocus>Cancelar</button>
            <button type="button" className="ui-btn ui-btn-danger ui-btn-md" style={{ flex: 1 }} onClick={handleSimulateAgain}>Recomeçar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
