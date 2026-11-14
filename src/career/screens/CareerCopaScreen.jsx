// Copa do Brasil do Modo Carreira — redesenho de 2026-11-13 seguindo
// modo-carreira-copa-mockup.html. O chaveamento saiu do modal
// (CupBracketModal, App.jsx — continua lá para o modo clássico) e virou
// parte da página. Só LÊ o save: fases, confrontos, placares e vencedores
// vêm de copaEngine.js via engine/copaView.js. Nenhuma regra/sorteio muda.
import { useMemo, useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { formatCalendarDay } from '../engine/calendar.js';
import { COPA_ROUND_LABELS } from '../engine/copaEngine.js';
import { upcomingFixtures } from '../engine/careerMeta.js';
import { teamForSim } from '../engine/simHelpers.js';
import {
  FINAL_PHASE, PHASE_SHORT, COPA_DAYS, COPA_ENTRY_PRIZE_BY_ROUND, COPA_CHAMPION_PRIZE, COPA_RUNNER_UP_PRIZE,
  myCopaRun, pathAhead, qualifyChance, tieRuleText, copaScorers, hasClub,
} from '../engine/copaView.js';
import { formatMoneyShort } from './CareerHub.jsx';
import { displayName } from '../../lib/displayName.js';
import { Icon } from '../../ui/index.jsx';
import { dayOfYearToMonthDay, GRID_YEAR } from '../components/monthCalendar.jsx';
import '../components/careerShell.css';
import './careerSquad.css';
import './careerCopa.css';
import { ClubCrest } from '../../components/football/ClubCrest.jsx';
import { CupBracket, bracketPathKeys } from '../../components/football/CupBracket.jsx';

const clubOf = (id) => TEAMS.find(t => t.id === id);
const nameOf = (id) => displayName(clubOf(id)?.club || '');
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const shortDay = (day) => { const { month, dayOfMonth } = dayOfYearToMonthDay(day); return `${dayOfMonth} ${MONTH_SHORT[month]}`; };
const wdDay = (day) => { const { month, dayOfMonth } = dayOfYearToMonthDay(day); return `${WD[new Date(GRID_YEAR, month, dayOfMonth).getDay()]}, ${dayOfMonth} ${MONTH_SHORT[month]}`; };
const phaseDays = (p) => (Array.isArray(COPA_DAYS[p]) ? COPA_DAYS[p] : [COPA_DAYS[p]]);

const Crest = ({ id, size = 18 }) => <ClubCrest id={id} size={size} unknown="blank" unknownClass="cp-q" />;

const score = (s) => (s ? `${s.homeGoals}–${s.awayGoals}` : null);
const aggText = (t) => (t.aggA == null ? null : `${t.aggA}–${t.aggB}${t.onPens ? '*' : ''}`);

function tieAria(t, phase) {
  const label = PHASE_SHORT[phase];
  if (!t) return `${label}: a definir`;
  const base = `${label}: ${nameOf(t.aId)} x ${nameOf(t.bId)}`;
  if (t.aggA == null) return `${base}, a jogar`;
  const agg = `${phase === FINAL_PHASE ? 'placar' : 'agregado'} ${t.aggA} a ${t.aggB}`;
  return `${base}, ${agg}${t.decided ? `, classificado ${nameOf(t.winnerId)}${t.onPens ? ' nos pênaltis' : ''}` : ''}`;
}

export function CareerCopaScreen({ save, onNavigate, onPlayNext }) {
  const copa = save.copa;
  const me = save.myClubId;
  const run = useMemo(() => myCopaRun(save), [save]);
  const { T } = run;
  const path = useMemo(() => pathAhead(run), [run]);
  const scorers = useMemo(() => copaScorers(save), [save]);
  const next = useMemo(() => upcomingFixtures(save, 1)[0] || null, [save]);


  const [tab, setTab] = useState('bracket');
  const [phaseView, setPhaseView] = useState(() => (copa?.phase === 'active' ? copa.round : FINAL_PHASE));

  const curPhase = copa.phase === 'active' ? copa.round : null;
  const curLeg = curPhase != null && curPhase !== FINAL_PHASE ? copa.leg : null;
  const curDay = curPhase != null ? phaseDays(curPhase)[curLeg === 'volta' ? 1 : 0] : null;

  // ── Cabeçalho ──
  const eyebrow = copa.phase === 'done'
    ? `Temporada ${save.season} · encerrada · campeão ${nameOf(copa.champion)}`
    : `Temporada ${save.season} · ${PHASE_SHORT[curPhase].toLowerCase()}${curPhase === FINAL_PHASE ? ' · jogo único' : ''} · ${curLeg || 'jogo'} em ${formatCalendarDay(curDay)}`;

  // ── Stepper ──
  const steps = COPA_ROUND_LABELS.map((_, p) => {
    const st = run.steps[p];
    const t = st.tie;
    const days = phaseDays(p);
    if (run.eliminatedAt != null && p > run.eliminatedAt) return { p, cls: 'cp-st-off', sub: '—' };
    if (p === 0 && run.eliminatedAt === 0 && !t) return { p, cls: 'cp-st-out', sub: 'Eliminado' };
    if (p === 0 && run.byeFirst === null) return { p, cls: 'cp-st-done', sub: 'Classificado' };
    if (p === 0 && run.byeFirst) return { p, cls: (copa.round > 0 || copa.phase === 'done') ? 'cp-st-done' : 'cp-st-cur', sub: `Folga · ${shortDay(days[0])}` };
    if (t?.decided) {
      const won = t.winnerId === me;
      const myAgg = t.aId === me ? `${t.aggA}×${t.aggB}` : `${t.aggB}×${t.aggA}`;
      const how = t.onPens ? ' (pênaltis)' : t.decider ? ' (jogo extra)' : '';
      if (p === FINAL_PHASE) return { p, cls: won ? 'cp-st-done' : 'cp-st-out', sub: won ? `Campeão · ${myAgg}${how}` : `Vice · ${myAgg}${how}` };
      return { p, cls: won ? 'cp-st-done' : 'cp-st-out', sub: `${won ? 'Passou' : 'Caiu'} ${myAgg} no agregado${how}` };
    }
    if (t) return { p, cls: 'cp-st-cur', sub: `vs ${nameOf(t.aId === me ? t.bId : t.aId)} · ${shortDay(days[t.leg1 && p !== FINAL_PHASE ? 1 : 0])}` };
    if (p === curPhase && run.live) return { p, cls: 'cp-st-cur', sub: `${shortDay(days[0])}` };
    if (copa.phase === 'done' || run.eliminatedAt != null) return { p, cls: 'cp-st-off', sub: '—' };
    return { p, cls: '', sub: p === FINAL_PHASE ? `jogo único · ${shortDay(days[0])}` : 'a definir' };
  });

  // ── Meu confronto ──
  const tie = run.curTie;
  const isNextCopa = !!next && next.comp === 'Copa do Brasil';
  const blocked = (save.pendingOffers?.length || 0) > 0 ? 'market'
    : !save.myStarters?.length || save.myStarters.some(n => (save.suspensions?.[n] || 0) > 0) ? 'formation' : null;
  const posLine = (id) => {
    const d = save.clubs[id]?.division;
    const tbl = d === 'B' ? save.divisionB.table : save.divisionA.table;
    const p = tbl.findIndex(r => r.id === id) + 1;
    return `Série ${d}${p ? ` · ${p}º` : ''}`;
  };

  const TieCard = () => {
    // Campanha encerrada (eliminado ou campeão) ou Copa acabou
    if (!run.live || (!tie && !(curPhase === 0 && run.byeFirst))) {
      const played = run.steps.filter(s => s.tie);
      const ELIM = ['na primeira fase', 'nos 16 avos', 'nas oitavas', 'nas quartas', 'na semifinal', 'na final'];
      const title = run.champion ? 'Campeão da Copa do Brasil' : run.eliminatedAt === FINAL_PHASE ? 'Vice-campeão da Copa do Brasil' : run.eliminatedAt != null ? `Eliminado ${ELIM[run.eliminatedAt]}` : 'Campanha';
      const prize = run.champion ? COPA_CHAMPION_PRIZE : run.eliminatedAt === FINAL_PHASE ? COPA_RUNNER_UP_PRIZE : null;
      return (
        <div className={`cp-tiec${run.champion ? ' cp-champ' : ''}`}>
          <div className="cp-ring" aria-hidden="true" />
          <span className="ch-mono cp-k">Sua campanha · Temporada {save.season}</span>
          <h2 className="cp-camp-title">{run.champion && <Icon name="trophy" size={26} />}{title}</h2>
          {copa.phase === 'done' && !run.champion && <p className="cp-note">Campeão: <b>{nameOf(copa.champion)}</b></p>}
          <div className="cp-camp">
            {run.byeFirst && <div className="cp-camp-row"><span>Primeira fase</span><span /><b>Folga</b></div>}
            {run.byeFirst === null && <div className="cp-camp-row"><span>Primeira fase</span><span /><b>Classificado</b></div>}
            {run.eliminatedAt === 0 && !run.steps[0].tie && <div className="cp-camp-row"><span>Primeira fase</span><span /><b className="cp-l">Eliminado</b></div>}
            {played.map(s => {
              const t = s.tie;
              const opp = t.aId === me ? t.bId : t.aId;
              const my = t.aggA == null ? '—' : t.aId === me ? `${t.aggA}×${t.aggB}` : `${t.aggB}×${t.aggA}`;
              const won = t.decided ? t.winnerId === me : null;
              return (
                <div key={s.phase} className="cp-camp-row">
                  <span>{PHASE_SHORT[s.phase]}</span>
                  <span className="cp-camp-opp"><Crest id={opp} size={18} />{nameOf(opp)}</span>
                  <b className={won == null ? '' : won ? 'cp-w' : 'cp-l'}>{my}{t.onPens ? ' (pên.)' : t.decider ? ' (extra)' : ''}</b>
                </div>
              );
            })}
          </div>
          {prize != null && <p className="cp-note">Premiação recebida: <b>{formatMoneyShort(prize)}</b></p>}
          <div className="cp-btns"><button type="button" className="cp-b-o" onClick={() => onNavigate('calendar')}><Icon name="calendar" size={16} />Ver no calendário</button></div>
        </div>
      );
    }
    if (!tie) {
      // Folga na 1ª fase, esperando o sorteio dos 16 avos
      const d16 = phaseDays(1);
      return (
        <div className="cp-tiec">
          <div className="cp-ring" aria-hidden="true" />
          <span className="ch-mono cp-k">Primeira fase · folga</span>
          <h2 className="cp-camp-title">{nameOf(me)} estreia nos 16 avos</h2>
          <p className="cp-note">A primeira fase é só entre os 16 clubes mais fracos da Série B. Os 16 avos são sorteados quando ela termina: ida em {formatCalendarDay(d16[0])}, volta em {formatCalendarDay(d16[1])}.</p>
          {COPA_ENTRY_PRIZE_BY_ROUND[1] > 0 && <p className="cp-note">Entrar nos 16 avos paga <b>{formatMoneyShort(COPA_ENTRY_PRIZE_BY_ROUND[1])}</b>.</p>}
          <div className="cp-btns"><button type="button" className="cp-b-o" onClick={() => onNavigate('formation')}>Escalação para a Copa</button><button type="button" className="cp-b-g" onClick={() => onNavigate('calendar')}><Icon name="calendar" size={16} />Ver no calendário</button></div>
        </div>
      );
    }
    const isFinal = tie.phase === FINAL_PHASE;
    const days = phaseDays(tie.phase);
    const legs = isFinal
      ? [{ key: 'final', label: 'Jogo único', day: days[0], home: tie.aId, away: tie.bId, s: tie.single }]
      : [{ key: 'ida', label: 'Ida', day: days[0], home: tie.aId, away: tie.bId, s: tie.leg1 }, { key: 'volta', label: 'Volta', day: days[1], home: tie.bId, away: tie.aId, s: tie.leg2 }];
    const nextLegKey = legs.find(l => !l.s)?.key;
    const chance = qualifyChance(save, tie, me);
    const nextLegIsCommitment = isNextCopa && nextLegKey && next.day === legs.find(l => l.key === nextLegKey)?.day;
    const aggA = tie.aggA ?? 0, aggB = tie.aggB ?? 0;
    return (
      <div className="cp-tiec">
        <div className="cp-ring" aria-hidden="true" />
        <span className="ch-mono cp-k">Seu confronto · {COPA_ROUND_LABELS[tie.phase]}</span>
        <div className="cp-duel">
          <div><Crest id={tie.aId} size={66} /><b>{nameOf(tie.aId)}</b><small>{posLine(tie.aId)}</small></div>
          <div className="cp-agg">{aggA} – {aggB}<small>{isFinal ? 'PLACAR' : 'AGREGADO'}</small></div>
          <div><Crest id={tie.bId} size={66} /><b>{nameOf(tie.bId)}</b><small>{posLine(tie.bId)}</small></div>
        </div>
        <div className={`cp-legs${isFinal ? ' cp-legs-1' : ''}`}>
          {legs.map(l => (
            <div key={l.key} className={`cp-leg${l.key === nextLegKey ? ' cp-leg-nx' : ''}`}>
              <small>{l.label} · {l.home === me ? 'casa' : isFinal ? 'mando do rival' : 'fora'} · {wdDay(l.day)}</small>
              <b>{nameOf(l.home)} {l.s ? <span className="cp-leg-sc">{l.s.homeGoals} × {l.s.awayGoals}</span> : '×'} {nameOf(l.away)}</b>
            </div>
          ))}
        </div>
        <div className="cp-adv">
          <div className="cp-adv-r"><span>Chance de classificação <em>(estimativa)</em></span><b>{Math.round(chance * 100)}%</b></div>
          <div className="cp-adv-bar" role="img" aria-label={`Chance estimada de classificação: ${Math.round(chance * 100)}%`}><i style={{ width: `${Math.round(chance * 100)}%` }} /></div>
        </div>
        <p className="cp-note">{tieRuleText(tie.phase)}</p>
        <div className="cp-btns">
          <button type="button" className="cp-b-o" onClick={() => onNavigate('formation')}>Escalação para a Copa</button>
          {nextLegIsCommitment ? (
            <button type="button" className="cp-b-g" onClick={() => (blocked ? onNavigate(blocked) : onPlayNext())}><Icon name="play" size={16} />{isFinal ? 'Jogar a final' : nextLegKey === 'ida' ? 'Jogar ida' : 'Jogar volta'}</button>
          ) : (
            <button type="button" className="cp-b-g" onClick={() => onNavigate('calendar')}><Icon name="calendar" size={16} />Ver no calendário</button>
          )}
        </div>
        {nextLegIsCommitment && blocked && <p className="cp-note" style={{ marginTop: 10 }}>{blocked === 'market' ? 'Antes, responda as propostas pendentes no Mercado.' : 'Antes, acerte a escalação (falta formação ou há suspenso).'}</p>}
      </div>
    );
  };

  // ── Caminho até a final ──
  const PathCard = () => {
    const prizeNext = (() => {
      if (!run.live) return null;
      const p = curPhase;
      if (p + 1 === FINAL_PHASE) return { label: 'Na final: campeão / vice', value: `${formatMoneyShort(COPA_CHAMPION_PRIZE)} / ${formatMoneyShort(COPA_RUNNER_UP_PRIZE)}` };
      if (p === FINAL_PHASE) return { label: 'Campeão / vice', value: `${formatMoneyShort(COPA_CHAMPION_PRIZE)} / ${formatMoneyShort(COPA_RUNNER_UP_PRIZE)}` };
      const v = COPA_ENTRY_PRIZE_BY_ROUND[p + 1];
      return v > 0 ? { label: `Premiação por avançar às ${PHASE_SHORT[p + 1].toLowerCase()}`.replace('às 16 avos', 'aos 16 avos').replace('às semifinal', 'à semifinal'), value: `+ ${formatMoneyShort(v)}` } : null;
    })();
    const curT = run.curTie;
    const listNames = (ids) => {
      const names = ids.map(nameOf);
      if (names.length <= 4) return names.length > 1 ? `${names.slice(0, -1).join(', ')} ou ${names[names.length - 1]}` : names[0];
      return `${names.slice(0, 3).join(', ')}…`;
    };
    return (
      <div className="ch-card cp-path">
        <div className="ch-head"><h3>Caminho até a final</h3></div>
        {!run.live && <div className="ch-empty">{run.champion ? 'Caminho completo: campeão.' : 'Seu clube não está mais na Copa.'}</div>}
        {run.live && curT && (
          <div className="cp-p cp-p-cur">
            <span className="cp-p-ph">{PHASE_SHORT[curT.phase]}</span>
            <div style={{ minWidth: 0 }}><b>{nameOf(curT.aId === me ? curT.bId : curT.aId)}</b><small>{posLine(curT.aId === me ? curT.bId : curT.aId)} · OVR {Math.round(teamForSim(save, curT.aId === me ? curT.bId : curT.aId).ovr)}</small></div>
            <span className="cp-p-ops"><Crest id={curT.aId === me ? curT.bId : curT.aId} size={22} /></span>
          </div>
        )}
        {run.live && !path && (
          COPA_ROUND_LABELS.slice(Math.max(1, (curPhase ?? 0) + (curT ? 1 : 1))).map((_, k) => {
            const p = Math.max(1, (curPhase ?? 0) + 1) + k;
            return <div key={p} className="cp-p"><span className="cp-p-ph">{PHASE_SHORT[p]}</span><div><b>A definir</b><small>{p === 1 ? 'sorteio depois da primeira fase' : 'depende do sorteio dos 16 avos'}</small></div></div>;
          })
        )}
        {run.live && path && path.map(r => (
          <div key={r.phase} className="cp-p">
            <span className="cp-p-ph">{PHASE_SHORT[r.phase]}</span>
            <div style={{ minWidth: 0 }}>
              <b className="cp-ell2">{r.opponents ? listNames(r.opponents) : 'A definir'}</b>
              <small>{r.opponents ? (r.opponents.length === 1 ? 'adversário já definido · se passar' : `${r.opponents.length} possíveis adversários · se passar`) : 'a definir'}</small>
            </div>
            {r.opponents && r.opponents.length <= 4 && <span className="cp-p-ops">{r.opponents.map(id => <Crest key={id} id={id} size={20} />)}</span>}
          </div>
        ))}
        {prizeNext && <div className="cp-prize"><span>{prizeNext.label}</span><b>{prizeNext.value}</b></div>}
      </div>
    );
  };

  // ── Chaveamento (components/football/CupBracket) ──
  const { myKeys, mySide, nextPathKey } = useMemo(() => bracketPathKeys(run.lastKnown, run.eliminatedAt == null && !run.champion), [run]);
  const popoverContent = (t, phase) => {
    const isFinal = phase === FINAL_PHASE;
    const days = phaseDays(phase);
    return (
      <>
        {isFinal ? (
          <div className="cp-pop-r"><span>Jogo único · {shortDay(days[0])}</span><b>{nameOf(t.aId)} {score(t.single) || '×'} {nameOf(t.bId)}</b></div>
        ) : t.aggOnly ? (
          <div className="cp-pop-r"><span>Ida e volta</span><b>Só o agregado foi guardado nesta fase</b></div>
        ) : (
          <>
            <div className="cp-pop-r"><span>Ida · {shortDay(days[0])}</span><b>{nameOf(t.aId)} {score(t.leg1) || '×'} {nameOf(t.bId)}</b></div>
            <div className="cp-pop-r"><span>Volta · {shortDay(days[1])}</span><b>{nameOf(t.bId)} {score(t.leg2) || '×'} {nameOf(t.aId)}</b></div>
          </>
        )}
        <div className="cp-pop-r"><span>{isFinal ? 'Resultado' : 'Agregado'}</span><b>{aggText(t) || 'a jogar'}{t.decided ? ` · passa ${nameOf(t.winnerId)}${t.onPens ? ' nos pênaltis' : t.decider ? ' no jogo extra' : ''}` : ''}</b></div>
      </>
    );
  };

  const BracketCard = () => (
    <div className="ch-card cp-bkc">
      <CupBracket
        ties={T}
        nameOf={nameOf}
        crestOf={(id, size) => <Crest id={id} size={size} />}
        myId={me}
        myKeys={myKeys}
        mySide={mySide}
        nextPathKey={nextPathKey}
        tieAria={tieAria}
        renderPopover={popoverContent}
        initialMobilePhase={copa?.round || 1}
        finalPlaceholder={<><Icon name="trophy" size={20} /><span>Final · jogo único</span><small>{shortDay(phaseDays(FINAL_PHASE)[0])}</small></>}
        emptyNote={!T[1]?.length ? <div className="mk-locked" style={{ marginBottom: 12 }}><Icon name="info" size={16} />Os 16 avos ainda não foram sorteados: o chaveamento sai quando a primeira fase terminar.</div> : null}
        legend={(
          <div className="cp-bkl">
            <span><i style={{ background: '#F6EEDB', border: '2px solid var(--gold)' }} />Seu confronto e seu caminho</span>
            <span><i style={{ border: '1px dashed var(--line-strong)' }} />A definir</span>
            <span>Eliminados ficam apagados · * decidido nos pênaltis</span>
          </div>
        )}
      />
    </div>
  );

  // ── Jogos da fase ──
  const phasesWithTies = COPA_ROUND_LABELS.map((_, p) => p).filter(p => T[p]?.length);
  const PhaseGames = () => {
    const ties = [...(T[phaseView] || [])].sort((a, b) => (hasClub(b, me) - hasClub(a, me)));
    const days = phaseDays(phaseView);
    return (
      <div className="ch-card cp-games">
        <div className="cp-bk-top">
          <h3>{COPA_ROUND_LABELS[phaseView]}</h3>
          <label className="tb-rsel" style={{ marginLeft: 0 }}>
            <span>Fase</span>
            <select value={phaseView} onChange={e => setPhaseView(Number(e.target.value))} aria-label="Escolher fase">
              {phasesWithTies.map(p => <option key={p} value={p}>{PHASE_SHORT[p]}</option>)}
            </select>
          </label>
        </div>
        {!ties.length && <div className="ch-empty">Confrontos desta fase ainda não sorteados.</div>}
        <div className="cp-ggrid">
          {ties.map(t => {
            const mine = hasClub(t, me);
            const rowT = (id, goals) => (
              <div className={`cp-g-row${t.decided && t.winnerId === id ? ' cp-won' : ''}${t.decided && t.winnerId !== id ? ' cp-lost' : ''}`}>
                <Crest id={id} size={22} /><span className="cf-ell">{nameOf(id)}</span><b>{goals ?? ''}{t.decided && t.winnerId === id && t.onPens ? '*' : ''}</b>
              </div>
            );
            return (
              <div key={`${t.aId}-${t.bId}`} className={`cp-g${mine ? ' cp-g-mine' : ''}`} aria-label={tieAria(t, phaseView)} role="group">
                {rowT(t.aId, t.aggA)}
                {rowT(t.bId, t.aggB)}
                <div className="cp-g-legs">
                  {phaseView === FINAL_PHASE ? <span>Jogo único · {shortDay(days[0])}: {score(t.single) || 'a jogar'}</span> : t.aggOnly ? <span>Só o agregado foi guardado nesta fase{t.decider ? ' · decidido no jogo extra' : ''}</span> : (
                    <>
                      <span>Ida {shortDay(days[0])}: {score(t.leg1) || 'a jogar'}</span>
                      <span>Volta {shortDay(days[1])}: {t.leg2 ? `${t.leg2.awayGoals}–${t.leg2.homeGoals}` : 'a jogar'}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {phaseView !== FINAL_PHASE && <p className="ch-small" style={{ padding: '0 20px 16px', margin: 0 }}>Placar da volta mostrado na ordem do confronto (mandante da ida primeiro). {tieRuleText(phaseView)}</p>}
      </div>
    );
  };

  const Scorers = () => (
    <div className="ch-card" style={{ overflow: 'hidden' }}>
      <div className="ch-head"><h3>Artilharia da Copa</h3><span className="ch-small">Temporada {save.season}</span></div>
      {!scorers?.length && <div className="ch-empty">Ninguém marcou ainda na Copa.</div>}
      {scorers?.slice(0, 15).map((s, i) => (
        <div key={s.key} className={`tb-sc${s.clubId === me ? ' tb-sc-me' : ''}`}>
          <span className="tb-rk">{i + 1}</span><Crest id={s.clubId} size={24} />
          <div style={{ minWidth: 0 }}><b className="cf-ell">{s.name}</b><small>{nameOf(s.clubId)}</small></div>
          <span className="tb-g">{s.goals}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="ch-main cp-main">
      <div className="sq-ph cp-ph">
        <div style={{ minWidth: 0 }}>
          <span className="ch-mono">{eyebrow}</span>
          <h1>Copa do Brasil</h1>
        </div>
        <div className="cf-seg" role="tablist" aria-label="Seções da Copa">
          <button type="button" role="tab" aria-selected={tab === 'bracket'} className={tab === 'bracket' ? 'cf-on' : ''} onClick={() => setTab('bracket')}>Chaveamento</button>
          <button type="button" role="tab" aria-selected={tab === 'games'} className={tab === 'games' ? 'cf-on' : ''} onClick={() => setTab('games')}>Jogos da fase</button>
          {scorers && <button type="button" role="tab" aria-selected={tab === 'scorers'} className={tab === 'scorers' ? 'cf-on' : ''} onClick={() => setTab('scorers')}>Artilharia</button>}
        </div>
      </div>

      <div className="ch-card cp-steps-wrap">
        <ol className="cp-steps" aria-label="Fases da Copa do Brasil">
          {steps.map(s => (
            <li key={s.p} className={`cp-st ${s.cls}`} aria-current={s.cls === 'cp-st-cur' ? 'step' : undefined}>
              <span className="cp-dot" aria-hidden="true" />
              <b>{PHASE_SHORT[s.p]}</b><small>{s.sub}</small>
            </li>
          ))}
        </ol>
      </div>

      {tab === 'bracket' && (
        <>
          <div className="cp-row1">{TieCard()}{PathCard()}</div>
          {BracketCard()}
        </>
      )}
      {tab === 'games' && PhaseGames()}
      {tab === 'scorers' && scorers && Scorers()}
    </div>
  );
}
