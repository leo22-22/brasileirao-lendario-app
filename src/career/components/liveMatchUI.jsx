// Peças visuais e motor de estado compartilhados entre a partida ao vivo
// de um jogo só (CareerMatchDayScreen) e a de ida+volta (CareerTwoLegScreen)
// — extraído pra não duplicar ~100 linhas entre as duas telas.
import { useEffect, useMemo, useRef, useState } from 'react';
import { posColor, posOrderIndex, ovrColor } from '../../lib/format.js';
import { buildPitchSlots } from '../engine/formations.js';
import { teamForSim } from '../engine/simHelpers.js';
import { displayName } from '../../lib/displayName.js';
import { ClubCrest } from '../../components/football/ClubCrest.jsx';

const SIM_MINUTES_PER_TICK = 2;
// Velocidade da simulação ao vivo (pedido explícito do usuário 2026-11-11,
// mesmo padrão 1x/2x/4x já usado no calendário avançando) — 1x = 1s/tick,
// 2x = 0,5s/tick, 4x = 0,25s/tick (valores exatos pedidos pelo usuário),
// lembrado entre partidas via localStorage.
const SPEEDS = { '1x': 1000, '2x': 500, '4x': 250 };
const SPEED_KEY = 'brl_career_matchspeed';
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

// Seletor de velocidade — mesmo visual do calendário avançando
// (CareerAdvanceModal.jsx), reaproveitado aqui pras 3 telas de partida ao
// vivo que usam `useLiveMatchPlayer` (CareerMatchDayScreen,
// CareerTwoLegScreen, CareerCopaLegScreen).
export function MatchSpeedPicker({ speedKey, onChange, style }) {
  return (
    <div style={{ display: 'flex', borderRadius: 999, border: '1px solid var(--line-strong)', overflow: 'hidden', ...style }}>
      {Object.keys(SPEEDS).map(k => (
        <button
          key={k}
          onClick={() => onChange(k)}
          style={{
            fontSize: 10.5, fontWeight: 700, padding: '4px 10px', border: 'none', cursor: 'pointer',
            background: speedKey === k ? 'rgba(194,154,69,0.2)' : 'var(--surface)',
            color: speedKey === k ? 'var(--gold-ink)' : 'var(--ink)',
          }}
        >{k}</button>
      ))}
    </div>
  );
}

export function eventIcon(ev) {
  if (ev.type === 'goal') return ev.isOwnGoal ? '⚽ contra' : ev.isPenalty ? '⚽ pênalti' : '⚽';
  if (ev.type === 'yellow') return '🟨';
  if (ev.type === 'red') return '🟥';
  if (ev.type === 'injury') return '🩼';
  if (ev.type === 'substitution') return '🔄';
  return '•';
}

export function eventText(ev) {
  if (ev.type === 'goal') return `${ev.scorer}${ev.assist ? ` (assist. ${ev.assist})` : ''} — ${ev.teamLabel}`;
  if (ev.type === 'yellow') return `${ev.player} — ${ev.teamLabel}`;
  if (ev.type === 'red') return `${ev.player}${ev.secondYellow ? ' (2º amarelo)' : ''} — ${ev.teamLabel}`;
  if (ev.type === 'injury') return `${ev.player} sentiu uma lesão (${ev.teamLabel}) — entra ${ev.replacementName || 'um reserva'}`;
  if (ev.type === 'substitution') return `Sai ${ev.playerOut}, entra ${ev.playerIn} — ${ev.teamLabel}`;
  return '';
}

export function TeamBadge({ team }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 96 }}>
      <ClubCrest team={team} size={42} />
      <div style={{ fontSize: 11.5, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{displayName(team.club)}</div>
    </div>
  );
}

export function RatingsList({ ratings, homeTeam, awayTeam }) {
  const ratingColor = r => (r >= 8 ? '#1F7A4D' : r >= 6.5 ? '#8A6A24' : r >= 5 ? '#8F5D14' : '#B23B3B');
  const Col = ({ team }) => {
    const list = ratings.filter(r => r.teamId === team.id).sort((a, b) => b.rating - a.rating);
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(team.club)}</div>
        {list.map(p => (
          <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 11.5, marginBottom: 3 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: ratingColor(p.rating), flexShrink: 0 }}>{p.rating.toFixed(1)}</span>
          </div>
        ))}
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <Col team={homeTeam} />
      <Col team={awayTeam} />
    </div>
  );
}

// Motor de estado da simulação ao vivo de UM jogo (intro -> minuto a
// minuto -> fim) — usado tanto pro jogo isolado do Brasileirão quanto
// pra cada perna (ida/volta) de um confronto eliminatório. Quem usa deve
// remontar o componente (via `key`) ao trocar de jogo/perna, pra esse
// estado resetar sozinho em vez de arrastar o minuto/eventos do jogo
// anterior.
// `extraEvents` (ref, não state) guarda substituições cosméticas que o
// usuário aplica durante a pausa (ver `pushExtraEvent`/LiveMatchScreen
// mais abaixo) — somadas aos eventos oficiais de `sim.events` em TODO
// recálculo de `shownEvents` (tick ou pular pro fim), senão o próximo
// tick sobrescrevia `shownEvents` com a lista antiga e a troca sumia do
// feed (mesmo cuidado que o Brasileirão clássico já toma em App.jsx).
export function useLiveMatchPlayer(sim, homeTeam, awayTeam) {
  const [phase, setPhase] = useState('intro'); // intro | playing | done
  const [isPaused, setIsPaused] = useState(false);
  const [minute, setMinute] = useState(0);
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  const [shownEvents, setShownEvents] = useState([]);
  const [speedKey, setSpeedKey] = useState(loadSpeed);
  const extraEventsRef = useRef([]);

  function allEventsUpTo(min) {
    return [...sim.events, ...extraEventsRef.current]
      .filter(ev => ev.minute <= min)
      .sort((a, b) => a.minute - b.minute);
  }

  function skipToEnd() {
    setMinute(90);
    setHomeGoals(sim.homeGoals);
    setAwayGoals(sim.awayGoals);
    setShownEvents(allEventsUpTo(90));
    setPhase('done');
  }

  function startPlaying() {
    setPhase('playing');
  }

  function pause() { setIsPaused(true); }
  function resume() { setIsPaused(false); }

  // Empurra uma substituição/reposicionamento cosmético no feed, no
  // minuto atual — NUNCA muda `homeGoals`/`awayGoals` (o placar já saiu
  // pronto de `sim`, a troca só é visual + persiste pra próxima partida
  // via quem chamar isso, ver LiveMatchScreen).
  function pushExtraEvent(ev) {
    extraEventsRef.current = [...extraEventsRef.current, ev];
    setShownEvents(prev => [...prev, ev]);
  }

  // Reinicia o intervalo sempre que a fase, a velocidade ou a pausa
  // mudarem — trocar 1x/2x/4x no meio do jogo já reflete no próximo tick,
  // sem perder o minuto atual (o cleanup do efeito anterior derruba o
  // intervalo velho antes deste rodar); pausado simplesmente não agenda
  // nenhum intervalo novo.
  useEffect(() => {
    if (phase !== 'playing' || isPaused) return;
    const id = setInterval(() => {
      setMinute(m => {
        const next = Math.min(90, m + SIM_MINUTES_PER_TICK);
        const due = allEventsUpTo(next);
        setShownEvents(due);
        setHomeGoals(due.filter(ev => ev.type === 'goal' && ev.teamId === homeTeam.id).length);
        setAwayGoals(due.filter(ev => ev.type === 'goal' && ev.teamId === awayTeam.id).length);
        if (next >= 90) setPhase('done');
        return next;
      });
    }, SPEEDS[speedKey]);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, speedKey, isPaused]);

  const changeSpeed = (key) => {
    setSpeedKey(key);
    saveSpeed(key);
  };

  const motm = [...sim.ratings].sort((a, b) => b.rating - a.rating)[0];

  return {
    phase, minute, homeGoals, awayGoals, shownEvents, startPlaying, skipToEnd, motm, speedKey, changeSpeed,
    isPaused, pause, resume, pushExtraEvent,
  };
}

export const wrapStyle = { width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px' };
export const cardStyle = { padding: '14px 12px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)' };
export const labelStyle = { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 4 };
export const primaryBtnStyle = { width: '100%', padding: '13px 0', borderRadius: 999, border: 'none', background: 'var(--green)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
export const secondaryBtnStyle = { width: '100%', padding: '11px 0', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 8 };
const pauseBtnStyle = { width: '100%', padding: '11px 0', borderRadius: 10, border: '1px solid rgba(183,121,31,0.5)', background: 'rgba(183,121,31,0.1)', color: 'var(--warning-ink)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginBottom: 8 };

// Painel de troca mostrado quando o usuário pausa a partida ao vivo
// (pedido explícito do usuário 2026-11-13: "coloque comigo se eu quiser
// trocar eu pauso o jogo e faço as substituições seja de formação ou de
// jogador igual é no outros modos"). Clique-só (sem arrastar), mesmo
// padrão de interação que CareerFormationScreen.jsx já usa: toca num
// titular pra selecionar quem sai, depois toca no banco (substituição) ou
// em outro titular compatível (reposicionamento tático) pra efetivar.
function SubPanel({ slots, myPitchBySlot, myBench, subbedOutNames, onApplySub, onReposition, onResume }) {
  const [selectedSlotKey, setSelectedSlotKey] = useState(null);
  const selectedSlot = slots.find(s => s.key === selectedSlotKey);
  const selectedPlayer = selectedSlotKey ? myPitchBySlot[selectedSlotKey] : null;

  const eligibleBench = selectedSlot
    ? myBench.filter(p => !subbedOutNames.includes(p.name) && p.pos.includes(selectedSlot.realPos))
    : [];
  const eligibleStarterSlots = selectedSlot
    ? slots.filter(s => s.key !== selectedSlotKey && myPitchBySlot[s.key]
        && myPitchBySlot[s.key].pos.includes(selectedSlot.realPos) && selectedPlayer.pos.includes(s.realPos))
    : [];

  const orderedSlots = [...slots].sort((a, b) => posOrderIndex(a.realPos) - posOrderIndex(b.realPos));

  return (
    <div style={{ ...cardStyle, marginBottom: 10 }}>
      <div style={{ ...labelStyle, textAlign: 'left', marginBottom: 8 }}>⏸ Partida pausada — toque em quem vai sair</div>
      <div style={{ display: 'grid', gap: 4, marginBottom: 10, maxHeight: 260, overflowY: 'auto' }}>
        {orderedSlots.map(slot => {
          const p = myPitchBySlot[slot.key];
          if (!p) return null;
          const isSelected = selectedSlotKey === slot.key;
          return (
            <button
              key={slot.key}
              onClick={() => setSelectedSlotKey(prev => (prev === slot.key ? null : slot.key))}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                background: isSelected ? 'rgba(194,154,69,0.15)' : 'var(--surface)',
                border: `1px solid ${isSelected ? 'rgba(194,154,69,0.6)' : 'var(--line)'}`, color: 'var(--ink)',
              }}
            >
              <span style={{ width: 26, fontSize: 10, fontWeight: 700, color: posColor(p.pos[0]), fontFamily: 'var(--font-mono)' }}>{p.pos[0]}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11.5, color: ovrColor(p.ovr) }}>{p.ovr}</span>
            </button>
          );
        })}
      </div>

      {selectedSlot && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Banco — toque pra substituir por {selectedPlayer.name}</div>
          {eligibleBench.length === 0 && <p style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>Ninguém do banco joga em {selectedSlot.realPos}.</p>}
          <div style={{ display: 'grid', gap: 4, marginBottom: eligibleStarterSlots.length > 0 ? 10 : 0 }}>
            {eligibleBench.map(p => (
              <button
                key={p.name}
                onClick={() => onApplySub(selectedSlotKey, p.name)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, textAlign: 'left', cursor: 'pointer', background: 'rgba(31,122,77,0.1)', border: '1px solid rgba(31,122,77,0.4)', color: 'var(--ink)' }}
              >
                <span style={{ width: 26, fontSize: 10, fontWeight: 700, color: posColor(p.pos[0]), fontFamily: 'var(--font-mono)' }}>{p.pos[0]}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11.5, color: ovrColor(p.ovr) }}>{p.ovr}</span>
              </button>
            ))}
          </div>
          {eligibleStarterSlots.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Ou reposicionar (troca de posição, sem mexer no banco)</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {eligibleStarterSlots.map(s => (
                  <button
                    key={s.key}
                    onClick={() => onReposition(selectedSlotKey, s.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, textAlign: 'left', cursor: 'pointer', background: 'rgba(47,111,168,0.1)', border: '1px solid rgba(47,111,168,0.4)', color: 'var(--ink)' }}
                  >
                    <span style={{ width: 26, fontSize: 10, fontWeight: 700, color: posColor(myPitchBySlot[s.key].pos[0]), fontFamily: 'var(--font-mono)' }}>{myPitchBySlot[s.key].pos[0]}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{myPitchBySlot[s.key].name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <button onClick={onResume} style={{ ...primaryBtnStyle, marginTop: 12 }}>▶ Retomar partida</button>
    </div>
  );
}

// Tela de partida ao vivo centralizada — antes era JSX quase idêntica
// duplicada entre CareerMatchDayScreen.jsx e `LegMatch` (CareerTwoLegScreen.jsx),
// agora uma implementação só. `save`/`onApplyLineupChange` são opcionais
// (sem eles a tela funciona igual antes, só sem o botão de pausa) — mas
// as 3 telas de partida do Modo Carreira sempre passam os dois agora.
export function LiveMatchScreen({ sim, homeTeam, awayTeam, label, continueLabel = 'Continuar →', onFinish, save, onApplyLineupChange }) {
  const {
    phase, minute, homeGoals, awayGoals, shownEvents, startPlaying, skipToEnd, motm, speedKey, changeSpeed,
    isPaused, pause, resume, pushExtraEvent,
  } = useLiveMatchPlayer(sim, homeTeam, awayTeam);

  const mySide = !save ? null : homeTeam.id === save.myClubId ? 'home' : awayTeam.id === save.myClubId ? 'away' : null;
  const myTeamFull = useMemo(() => (mySide && save ? teamForSim(save, save.myClubId) : null), [mySide, save]);
  const mySlots = useMemo(() => (save?.myFormationKey ? buildPitchSlots(save.myFormationKey) : []), [save?.myFormationKey]);

  const [liveStarters, setLiveStarters] = useState(null);
  const [liveBench, setLiveBench] = useState([]);
  const [subbedOutNames, setSubbedOutNames] = useState([]);

  // Reconstrói a escalação ao vivo (titular+banco de verdade, com
  // posição/OVR) a partir de `teamForSim` — reaproveita o MESMO motor que
  // monta o time pra simular, nunca inventa dado novo. Roda de novo
  // sempre que o jogo muda (nova partida/perna, `sim` troca de
  // referência) pra resetar as trocas feitas na partida anterior.
  useEffect(() => {
    if (!myTeamFull) return;
    const nextStarters = {};
    mySlots.forEach((slot, i) => { if (myTeamFull.players[i]) nextStarters[slot.key] = myTeamFull.players[i]; });
    setLiveStarters(nextStarters);
    setLiveBench(myTeamFull.players.slice(mySlots.length));
    setSubbedOutNames([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim]);

  const myTeamObj = mySide === 'home' ? homeTeam : mySide === 'away' ? awayTeam : null;

  const applySub = (slotKey, benchPlayerName) => {
    if (!liveStarters) return;
    const outPlayer = liveStarters[slotKey];
    const inPlayer = liveBench.find(p => p.name === benchPlayerName);
    if (!outPlayer || !inPlayer) return;
    setLiveStarters(prev => ({ ...prev, [slotKey]: inPlayer }));
    setLiveBench(prev => prev.map(p => (p.name === inPlayer.name ? outPlayer : p)));
    setSubbedOutNames(prev => [...prev, outPlayer.name]);
    pushExtraEvent({ type: 'substitution', minute, teamId: myTeamObj.id, teamLabel: myTeamObj.club, playerOut: outPlayer.name, playerIn: inPlayer.name });
    onApplyLineupChange?.({ type: 'sub', slotKey, outName: outPlayer.name, inName: inPlayer.name });
  };

  const reposition = (sourceKey, targetKey) => {
    if (!liveStarters) return;
    const a = liveStarters[sourceKey];
    const b = liveStarters[targetKey];
    if (!a || !b) return;
    setLiveStarters(prev => ({ ...prev, [sourceKey]: b, [targetKey]: a }));
    onApplyLineupChange?.({ type: 'reposition', sourceKey, targetKey });
  };

  if (phase === 'intro') {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          <div style={labelStyle}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '20px 0 24px' }}>
            <TeamBadge team={homeTeam} />
            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>x</div>
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
        <div style={labelStyle}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '8px 0 4px' }}>
          <TeamBadge team={homeTeam} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 700 }}>{homeGoals} - {awayGoals}</div>
          <TeamBadge team={awayTeam} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            {phase === 'playing' ? (isPaused ? 'Pausado' : `${minute}'`) : 'Fim de jogo'}
          </div>
          {phase === 'playing' && !isPaused && <MatchSpeedPicker speedKey={speedKey} onChange={changeSpeed} />}
        </div>
      </div>

      <div style={{ minHeight: 140, marginBottom: 16, display: 'grid', gap: 6, padding: 10, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)' }}>
        {shownEvents.length === 0 && phase === 'playing' && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', padding: '20px 0' }}>Bola rolando...</div>
        )}
        {[...shownEvents].reverse().map((ev, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, padding: '5px 8px', borderRadius: 8, background: 'var(--surface)' }}>
            <span style={{ width: 28, color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{ev.minute}'</span>
            <span>{eventIcon(ev)}</span>
            <span style={{ flex: 1 }}>{eventText(ev)}</span>
          </div>
        ))}
      </div>

      {phase === 'playing' && isPaused && liveStarters && (
        <SubPanel
          slots={mySlots}
          myPitchBySlot={liveStarters}
          myBench={liveBench}
          subbedOutNames={subbedOutNames}
          onApplySub={applySub}
          onReposition={reposition}
          onResume={resume}
        />
      )}

      {phase === 'playing' && !isPaused && (
        <>
          <button onClick={skipToEnd} style={secondaryBtnStyle}>⏭ Pular pro resultado</button>
          {mySide && liveStarters && <button onClick={pause} style={pauseBtnStyle}>⏸ Pausar e trocar</button>}
        </>
      )}

      {phase === 'done' && (
        <>
          {motm && (
            <div style={{ textAlign: 'center', background: 'rgba(194,154,69,0.1)', border: '1px solid var(--gold)', borderRadius: 10, padding: '8px 12px', marginBottom: 14, fontSize: 13 }}>
              🌟 Craque da partida: <b style={{ color: 'var(--gold-ink)' }}>{motm.name}</b>{' '}
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{motm.rating.toFixed(1)}</span>
            </div>
          )}
          <RatingsList ratings={sim.ratings} homeTeam={homeTeam} awayTeam={awayTeam} />
          <button onClick={onFinish} style={{ ...primaryBtnStyle, marginTop: 4 }}>{continueLabel}</button>
        </>
      )}
    </div>
  );
}
