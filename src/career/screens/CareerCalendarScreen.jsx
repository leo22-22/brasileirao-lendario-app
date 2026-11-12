// Calendário do Modo Carreira — redesenho de 2026-11-13 seguindo
// modo-carreira-calendario-mockup.html. Só LÊ o save: datas do
// Brasileirão vêm de save.seasonCalendar (calendar.js), as da Copa do
// Brasil de copa.calendar (COPA_DAYS, copaEngine.js, pares ida/volta),
// placares de division.results (os mesmos que a Tabela usa) e, na Copa,
// de copa.rounds (ida/volta por confronto, 16 avos em diante) /
// copa.leg1Results (ida da fase atual) / copa.history (agregado — a 1ª
// fase só guarda o agregado). Nenhuma data ou regra muda aqui.
import { useEffect, useMemo, useRef, useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { matchOutcomeProbabilities } from '../../App.jsx';
import {
  formatCalendarDay, isTransferWindowOpen, currentWindowCloseDay, nextWindowOpenDay,
  WINDOW2_START, WINDOW2_END, JAN_END,
} from '../engine/calendar.js';
import { COPA_ROUND_LABELS } from '../engine/copaEngine.js';
import { upcomingFixtures, myCopaStatus } from '../engine/careerMeta.js';
import { teamForSim } from '../engine/simHelpers.js';
import { displayName } from '../../lib/displayName.js';
import { Icon, TeamBadge } from '../../ui/index.jsx';
import { MONTH_NAMES, MONTH_LENGTHS, GRID_YEAR, dayOfYearToMonthDay, dayOfYearFor } from '../components/monthCalendar.jsx';
import '../components/careerShell.css';
import './careerSquad.css';
import './careerCalendar.css';

const COMP = {
  br: { label: 'Brasileirão', color: '#1F7A4D' },
  cb: { label: 'Copa do Brasil', color: '#4E86C2' },
};
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const WEEKDAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const clubOf = (id) => TEAMS.find(t => t.id === id);
const nameOf = (id) => displayName(clubOf(id)?.club || '');
const ddmm = (day) => { const { month, dayOfMonth } = dayOfYearToMonthDay(day); return `${dayOfMonth}/${MONTH_SHORT[month]}`; };
const weekdayOf = (day) => { const { month, dayOfMonth } = dayOfYearToMonthDay(day); return WEEKDAY_FULL[new Date(GRID_YEAR, month, dayOfMonth).getDay()]; };

// Sigla de 3 letras (o jogo não tem uma): "São Paulo" → SAO,
// "Atlético-MG" → AMG, "Athletico-PR" → APR.
export function clubAbbr(id) {
  const name = (clubOf(id)?.club || id || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const [base, suffix] = name.split('-');
  if (suffix && suffix.trim().length === 2) return (base.trim()[0] + suffix.trim()).toUpperCase();
  return base.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
}

function Crest({ id, size = 18 }) {
  const t = clubOf(id);
  if (!t) return <span className="cl-crest-q" style={{ width: size, height: size }} aria-hidden="true">?</span>;
  return <TeamBadge src={CLUB_LOGOS[t.club]} name={t.club} color={t.colors?.p || '#0D3A29'} size={size} radius={size / 2} />;
}

const outcome = (gf, ga) => (gf > ga ? 'V' : gf < ga ? 'D' : 'E');

// ── Todos os jogos do meu clube na temporada (Brasileirão + Copa) ──
function buildEvents(save) {
  const me = save.myClubId;
  const division = save.clubs[me].division === 'A' ? save.divisionA : save.divisionB;
  const events = [];
  division.fixtures.forEach((round, r) => {
    const m = (round || []).find(x => x.homeId === me || x.awayId === me);
    if (!m) return;
    const isHome = m.homeId === me;
    let result = null;
    if (r < division.round) {
      const res = (division.results?.[r] || []).find(x => x.homeId === m.homeId && x.awayId === m.awayId);
      if (res) {
        const gf = isHome ? res.homeGoals : res.awayGoals;
        const ga = isHome ? res.awayGoals : res.homeGoals;
        result = { res: outcome(gf, ga), gf, ga };
      }
    }
    events.push({
      key: `br${r}`, day: save.seasonCalendar[r], comp: 'br', round: r, label: `Rodada ${r + 1}`,
      oppId: isHome ? m.awayId : m.homeId, isHome, homeId: m.homeId, awayId: m.awayId, played: r < division.round, result,
    });
  });

  const copa = save.copa;
  if (copa?.calendar) {
    const status = myCopaStatus(save);
    copa.calendar.forEach((daysRaw, idx) => {
      const days = Array.isArray(daysRaw) ? daysRaw : [daysRaw];
      const isFinal = idx === COPA_ROUND_LABELS.length - 1;
      const hist = (copa.history || []).find(h => h.round === idx);
      const current = copa.phase === 'active' && copa.round === idx;
      const tie = hist ? hist.ties.find(t => t.aId === me || t.bId === me)
        : current ? (copa.ties || []).find(t => t.aId === me || t.bId === me) : null;
      if (!tie) {
        // Fase futura, ainda sem sorteio — só se o clube segue vivo.
        if (status.alive && idx > copa.round) {
          days.forEach((day, li) => events.push({
            key: `cb${idx}-${li}`, day, comp: 'cb', copaRound: idx, label: `${COPA_ROUND_LABELS[idx]}${isFinal ? '' : li === 0 ? ' · ida' : ' · volta'}`,
            leg: isFinal ? null : li === 0 ? 'ida' : 'volta', oppId: null, isHome: null, played: false, result: null, tbd: true,
          }));
        }
        return;
      }
      const oppId = tie.aId === me ? tie.bId : tie.aId;
      const entry = hist && idx >= 1 ? copa.rounds?.[idx - 1] : null;
      const ti = entry ? entry.matches.findIndex(m => m.homeId === tie.aId && m.awayId === tie.bId) : -1;
      const myIdxCurrent = current ? copa.ties.indexOf(tie) : -1;
      days.forEach((day, li) => {
        const leg = isFinal ? null : li === 0 ? 'ida' : 'volta';
        const homeTeam = isFinal || leg === 'ida' ? tie.aId : tie.bId;
        let score = null, played = false, agg = false;
        if (hist) {
          played = true;
          if (entry && ti >= 0) score = isFinal ? entry.results?.[0] : leg === 'ida' ? entry.leg1Results?.[ti] : entry.results?.[ti];
          else if (leg !== 'ida') { // 1ª fase: só o agregado guardado
            agg = true;
            score = tie.aId === homeTeam ? { homeGoals: tie.aggA, awayGoals: tie.aggB } : { homeGoals: tie.aggB, awayGoals: tie.aggA };
          }
        } else if (current && leg === 'ida' && copa.leg === 'volta') {
          played = true;
          score = copa.leg1Results?.[myIdxCurrent] || null;
        }
        let result = null;
        if (score) {
          const gf = homeTeam === me ? score.homeGoals : score.awayGoals;
          const ga = homeTeam === me ? score.awayGoals : score.homeGoals;
          let res = outcome(gf, ga);
          const decided = (isFinal || leg === 'volta') && tie.winnerId;
          const pens = decided && res === 'E' && isFinal;
          if (agg && tie.winnerId) res = tie.winnerId === me ? 'V' : 'D';
          if (pens) res = tie.winnerId === me ? 'V' : 'D';
          result = { res, gf, ga, agg, pens };
        }
        events.push({
          key: `cb${idx}-${li}`, day, comp: 'cb', copaRound: idx, leg, label: `${COPA_ROUND_LABELS[idx]}${leg ? ` · ${leg}` : ''}`,
          oppId, isHome: isFinal ? null : homeTeam === me, homeId: homeTeam, awayId: homeTeam === tie.aId ? tie.bId : tie.aId,
          played, result,
        });
      });
    });
  }
  return events.sort((a, b) => a.day - b.day);
}

function ResChip({ ev, isNext }) {
  if (ev.result) {
    const cls = ev.result.res === 'V' ? 'cl-r-v' : ev.result.res === 'D' ? 'cl-r-d' : 'cl-r-e';
    return <span className={`cl-res ${cls}`}>{ev.result.res} {ev.result.gf}–{ev.result.ga}{ev.result.pens ? ' p' : ''}</span>;
  }
  if (ev.played) return <span className="cl-res cl-r-up">jogado</span>;
  if (isNext) return <span className="cl-res cl-r-nx">Próximo</span>;
  if (ev.comp === 'br') return <span className="cl-res cl-r-up">R{ev.round + 1}</span>;
  return <span className="cl-res cl-r-up">{ev.leg === 'volta' ? 'volta' : ev.leg === 'ida' ? 'ida' : 'final'}</span>;
}

export function CareerCalendarScreen({ save, onNavigate, onPlayNext }) {
  const me = save.myClubId;
  const myDiv = save.clubs[me].division;
  const division = myDiv === 'A' ? save.divisionA : save.divisionB;
  const today = save.calendarDay || 1;
  const cal = save.seasonCalendar;
  const totalRounds = division.fixtures.length;

  const allEvents = useMemo(() => buildEvents(save), [save]);
  const next = useMemo(() => upcomingFixtures(save, 1)[0] || null, [save]);
  const isNextEv = (ev) => !!next && !ev.played && ev.day === next.day && ((next.comp === 'Brasileirão') === (ev.comp === 'br'));

  const isMobileQ = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches;
  const [isMobile, setIsMobile] = useState(isMobileQ);
  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 768px)');
    if (!mq) return undefined;
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  const [filter, setFilter] = useState('all');
  const [mode, setMode] = useState(() => (isMobileQ() ? 'list' : 'month'));
  const initialDay = next?.day ?? today;
  const [selDay, setSelDay] = useState(initialDay);
  const [viewMonth, setViewMonth] = useState(dayOfYearToMonthDay(initialDay).month);
  const [focusDay, setFocusDay] = useState(initialDay);
  const [allFixtures, setAllFixtures] = useState(false);
  const [sheet, setSheet] = useState(false);
  const gridRef = useRef(null);
  const listRef = useRef(null);
  const stripRef = useRef(null);
  const focusPending = useRef(false);

  const events = allEvents.filter(e => filter === 'all' || e.comp === filter);
  const eventsByDay = useMemo(() => {
    const map = {};
    for (const e of events) (map[e.day] ||= []).push(e);
    return map;
  }, [events]);
  const hasCopaEvents = allEvents.some(e => e.comp === 'cb');

  const selectDay = (day, { openSheet = false } = {}) => {
    setSelDay(day); setFocusDay(day); setAllFixtures(false);
    setViewMonth(dayOfYearToMonthDay(day).month);
    if (openSheet && isMobile) setSheet(true);
  };

  // Teclado na grade: setas andam pelo dia (±1 / ±7), atravessando meses.
  const onGridKey = (e) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const target = e.key === 'Home' ? dayOfYearFor(1, viewMonth) : dayOfYearFor(MONTH_LENGTHS[viewMonth], viewMonth);
      focusPending.current = true; setFocusDay(target); return;
    }
    if (!delta) return;
    e.preventDefault();
    const target = Math.max(1, Math.min(365, focusDay + delta));
    focusPending.current = true;
    setFocusDay(target);
    setViewMonth(dayOfYearToMonthDay(target).month);
  };
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    gridRef.current?.querySelector(`[data-doy="${focusDay}"]`)?.focus();
  }, [focusDay, viewMonth]);

  // Lista: rola até o próximo jogo ao abrir.
  useEffect(() => {
    if (mode !== 'list') return;
    // Depois do scroll-ao-topo do CareerApp (efeito do pai roda depois).
    const t = setTimeout(() => {
      const box = listRef.current;
      const el = box?.querySelector('.cl-li-next');
      if (!box || !el) return;
      if (box.scrollHeight > box.clientHeight + 4) box.scrollTop = el.offsetTop - box.clientHeight / 2;
      else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2 });
    }, 60);
    return () => clearTimeout(t);
  }, [mode]);
  // Faixa: próxima rodada centralizada quando há scroll (celular).
  useEffect(() => {
    const box = stripRef.current;
    const el = box?.querySelector('.cl-rd-nx');
    if (box && el && box.scrollWidth > box.clientWidth) box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
  }, []);

  // ── Faixa da temporada ──
  const brEvents = allEvents.filter(e => e.comp === 'br');
  const tally = brEvents.reduce((acc, e) => { if (e.result) acc[e.result.res]++; return acc; }, { V: 0, E: 0, D: 0 });
  const pctForDay = (day) => {
    if (day <= cal[0]) return 0.5 / totalRounds * 100;
    if (day >= cal[cal.length - 1]) return (cal.length - 0.5) / totalRounds * 100;
    let i = 0;
    while (i < cal.length - 1 && cal[i + 1] <= day) i++;
    const frac = (day - cal[i]) / (cal[i + 1] - cal[i]);
    return (i + 0.5 + frac) / totalRounds * 100;
  };
  const markers = (() => {
    const list = [];
    (save.copa?.calendar || []).forEach((d, idx) => {
      if (idx === 0) return; // 1ª fase é em janeiro, antes da faixa
      const day = Array.isArray(d) ? d[0] : d;
      list.push({ day, text: `Copa · ${COPA_ROUND_LABELS[idx].replace(' de Final', '').replace('16 Avos', '16 avos')}`, cb: true });
    });
    list.push({ day: WINDOW2_START, text: `Janela · ${ddmm(WINDOW2_START)}–${ddmm(WINDOW2_END)}` });
    if (cal[18]) list.push({ day: cal[18], text: 'Fim do 1º turno' });
    list.push({ day: cal[cal.length - 1], text: 'Última rodada' });
    const placed = list.map(m => ({ ...m, pct: pctForDay(m.day) })).sort((a, b) => a.pct - b.pct);
    const lastInRow = [-100, -100, -100];
    for (const m of placed) {
      const row = lastInRow.findIndex(p => m.pct - p >= 11);
      m.row = row === -1 ? 2 : row;
      lastInRow[m.row] = m.pct;
    }
    return placed;
  })();
  const markerRows = Math.max(1, ...markers.map(m => m.row + 1));

  // ── Grade do mês ──
  const gridCells = (() => {
    const first = new Date(GRID_YEAR, viewMonth, 1);
    const lead = (first.getDay() + 6) % 7;
    const prevLen = MONTH_LENGTHS[(viewMonth + 11) % 12];
    const cells = [];
    for (let i = lead; i > 0; i--) cells.push({ out: true, dom: prevLen - i + 1 });
    for (let d = 1; d <= MONTH_LENGTHS[viewMonth]; d++) cells.push({ dom: d, doy: dayOfYearFor(d, viewMonth) });
    let k = 1;
    while (cells.length % 7 !== 0) cells.push({ out: true, dom: k++ });
    return cells;
  })();
  const focusInMonth = dayOfYearToMonthDay(focusDay).month === viewMonth ? focusDay : dayOfYearFor(1, viewMonth);

  const dayAria = (doy, evs) => {
    const base = formatCalendarDay(doy);
    if (!evs?.length) return `${base}${doy === today ? ', hoje' : ''}, sem jogos`;
    return [base, ...evs.map(ev => {
      const h = ev.oppId ? (ev.isHome === false ? `${nameOf(ev.oppId)} x ${nameOf(me)}` : `${nameOf(me)} x ${nameOf(ev.oppId)}`) : 'adversário a definir';
      const st = ev.result ? `${ev.result.res === 'V' ? 'vitória' : ev.result.res === 'D' ? 'derrota' : 'empate'} ${ev.result.gf} a ${ev.result.ga}` : isNextEv(ev) ? 'próximo jogo' : ev.played ? 'jogado' : 'a jogar';
      return `${h}, ${ev.comp === 'br' ? `rodada ${ev.round + 1}` : `Copa do Brasil, ${ev.label}`}, ${st}`;
    }), doy === today ? 'hoje' : null].filter(Boolean).join(', ');
  };

  // ── Dia selecionado ──
  const selEvents = (eventsByDay[selDay] || []);
  const selEv = selEvents[0] || null;
  const nextFrom = events.find(e => e.day > selDay && !e.played) || null;

  const posInfo = (id) => {
    const d = save.clubs[id]?.division;
    const tbl = d === 'B' ? save.divisionB.table : save.divisionA.table;
    const p = tbl.findIndex(r => r.id === id) + 1;
    return p ? `${p}º${d !== myDiv ? ` · Série ${d}` : ''}` : '';
  };

  const odds = (() => {
    if (!selEv || selEv.played || !selEv.oppId) return null;
    const h = selEv.isHome === false ? selEv.oppId : me;
    const a = selEv.isHome === false ? me : selEv.oppId;
    try {
      const o = matchOutcomeProbabilities(teamForSim(save, h), teamForSim(save, a));
      const pH = Math.round(o.homeWin * 100), pD = Math.round(o.draw * 100);
      return { homeId: h, awayId: a, pH, pD, pA: Math.max(0, 100 - pH - pD) };
    } catch { return null; }
  })();

  const leftId = selEv ? (selEv.isHome === false ? selEv.oppId : me) : null;
  const rightId = selEv ? (selEv.isHome === false ? me : selEv.oppId) : null;
  const sideLabel = (id) => {
    if (!selEv) return '';
    const where = selEv.isHome == null ? 'neutro' : (id === me) === selEv.isHome ? 'casa' : 'fora';
    return `${where}${id ? ` · ${posInfo(id)}` : ''}`;
  };

  const DayCard = () => {
    const { month, dayOfMonth } = dayOfYearToMonthDay(selDay);
    if (!selEv) {
      return (
        <div className="ch-card cl-day-empty">
          <span className="ch-mono">{weekdayOf(selDay)} · {dayOfMonth} de {MONTH_NAMES[month].toLowerCase()}{selDay === today ? ' · hoje' : ''}</span>
          <h3>Sem jogos</h3>
          {isTransferWindowOpen(selDay) && <p className="ch-small" style={{ margin: '0 0 10px' }}>Janela de transferências aberta neste dia.</p>}
          {nextFrom ? (
            <button type="button" className="cl-nextfrom" onClick={() => selectDay(nextFrom.day)}>
              <span className="ch-small">Próximo jogo</span>
              <span className="cl-nf-row">
                <i className="cl-dot" style={{ background: COMP[nextFrom.comp].color }} aria-hidden="true" />
                <b>{nextFrom.oppId ? `${nextFrom.isHome === false ? '@ ' : ''}${nameOf(nextFrom.oppId)}` : 'Adversário a definir'}</b>
                <span className="ch-small">{formatCalendarDay(nextFrom.day)} · {nextFrom.comp === 'br' ? nextFrom.label : `Copa · ${nextFrom.label}`}</span>
              </span>
            </button>
          ) : <p className="ch-small" style={{ margin: 0 }}>Nenhum jogo depois desta data nesta temporada.</p>}
        </div>
      );
    }
    const nextOne = isNextEv(selEv);
    const blocked = (save.pendingOffers?.length || 0) > 0 ? 'market'
      : !save.myStarters?.length || save.myStarters.some(n => (save.suspensions?.[n] || 0) > 0) ? 'formation' : null;
    return (
      <div className="cl-day">
        <div className="cl-ring" aria-hidden="true" />
        <span className="ch-mono">{weekdayOf(selDay)} · {dayOfMonth} de {MONTH_NAMES[month].toLowerCase()}{selDay === today ? ' · hoje' : ''}</span>
        <h3>{selEv.comp === 'br' ? `Brasileirão · Rodada ${selEv.round + 1}` : `Copa do Brasil · ${selEv.label}`}</h3>
        <div className="cl-vs">
          <div><Crest id={leftId} size={56} /><b>{leftId ? nameOf(leftId) : 'A definir'}</b><small>{sideLabel(leftId)}</small></div>
          <div className="cl-vs-x">{selEv.result ? <span className="cl-score">{selEv.isHome === false ? `${selEv.result.ga}–${selEv.result.gf}` : `${selEv.result.gf}–${selEv.result.ga}`}</span> : '×'}</div>
          <div><Crest id={rightId} size={56} /><b>{rightId ? nameOf(rightId) : 'A definir'}</b><small>{sideLabel(rightId)}</small></div>
        </div>
        {selEv.result?.agg && <p className="cl-day-note">Placar agregado — a 1ª fase só guarda o agregado dos dois jogos.</p>}
        {selEv.result?.pens && <p className="cl-day-note">Decidido nos pênaltis.</p>}
        {selEv.tbd && <p className="cl-day-note">O adversário sai do sorteio depois da fase atual.</p>}
        {odds && (
          <>
            <div className="cl-pr"><span>{nameOf(odds.homeId)} {odds.pH}%</span><span>Empate {odds.pD}%</span><span>{nameOf(odds.awayId)} {odds.pA}%</span></div>
            <div className="cl-pbar" role="img" aria-label={`Probabilidades: ${nameOf(odds.homeId)} ${odds.pH}%, empate ${odds.pD}%, ${nameOf(odds.awayId)} ${odds.pA}%`}>
              <i style={{ width: `${odds.pH}%`, background: 'var(--gold)' }} /><i style={{ width: `${odds.pD}%`, background: 'rgba(255,255,255,.35)' }} /><i style={{ width: `${odds.pA}%`, background: '#C24747' }} />
            </div>
          </>
        )}
        <div className="cl-dbtn">
          {selEv.played ? (
            <button type="button" className="cl-b-o" onClick={() => onNavigate(selEv.comp === 'br' ? 'table' : 'copa')}>{selEv.comp === 'br' ? 'Ver tabela' : 'Ver chaveamento'}</button>
          ) : (
            <>
              <button type="button" className="cl-b-o" onClick={() => onNavigate('formation')}>Escalação</button>
              <button
                type="button" className="cl-b-g" disabled={!nextOne}
                title={nextOne ? undefined : 'Só dá para jogar o próximo jogo'}
                onClick={() => (blocked ? onNavigate(blocked) : onPlayNext())}
              ><Icon name="play" size={15} />{selEv.comp === 'br' ? `Jogar rodada ${selEv.round + 1}` : 'Jogar'}</button>
            </>
          )}
        </div>
        {nextOne && blocked && <p className="cl-day-note" style={{ marginTop: 10 }}>{blocked === 'market' ? 'Antes, responda as propostas pendentes no Mercado.' : 'Antes, acerte a escalação (falta formação ou há suspenso).'}</p>}
      </div>
    );
  };

  // ── Jogos da rodada / fase do dia selecionado ──
  const RoundCard = () => {
    const copaIdx = selEv?.comp === 'cb' ? selEv.copaRound
      : (save.copa?.calendar || []).findIndex(d => (Array.isArray(d) ? d : [d]).includes(selDay));
    if (copaIdx != null && copaIdx >= 0 && !(cal.includes(selDay))) {
      const hist = (save.copa.history || []).find(h => h.round === copaIdx);
      const current = save.copa.phase === 'active' && save.copa.round === copaIdx;
      const ties = hist ? hist.ties : current ? save.copa.ties : [];
      const sorted = [...ties].sort((a, b) => ((b.aId === me || b.bId === me) - (a.aId === me || a.bId === me)));
      const shown = allFixtures ? sorted : sorted.slice(0, 6);
      return (
        <div className="ch-card" style={{ overflow: 'hidden' }}>
          <div className="ch-head"><h3>Copa · {COPA_ROUND_LABELS[copaIdx]}</h3><span className="ch-small">{ties.length ? `${ties.length} confrontos` : 'a definir'}</span></div>
          {!ties.length && <div className="ch-empty">Os confrontos saem do sorteio depois da fase anterior.</div>}
          {shown.map(t => {
            const mine = t.aId === me || t.bId === me;
            return (
              <div key={`${t.aId}-${t.bId}`} className={`tb-fx${mine ? ' tb-fx-mine' : ''}`}>
                <span className="tb-fx-h"><span className="cf-ell" style={t.winnerId === t.aId ? { color: 'var(--success)' } : undefined}>{nameOf(t.aId)}</span><Crest id={t.aId} /></span>
                <span className="tb-fx-x cl-fx-score">{t.winnerId ? `${t.aggA}–${t.aggB}` : '×'}</span>
                <span className="tb-fx-a"><Crest id={t.bId} /><span className="cf-ell" style={t.winnerId === t.bId ? { color: 'var(--success)' } : undefined}>{nameOf(t.bId)}</span></span>
              </div>
            );
          })}
          {sorted.length > 6 && <div className="cl-more"><button type="button" className="ch-link" onClick={() => setAllFixtures(s => !s)}>{allFixtures ? 'Mostrar menos' : `Ver os ${sorted.length} confrontos`}</button></div>}
          {hist && <div className="ch-small" style={{ padding: '0 20px 14px' }}>Placar agregado (ida + volta).</div>}
        </div>
      );
    }
    let r = cal.indexOf(selDay);
    let upcoming = false;
    if (r < 0) { r = cal.findIndex(d => d > selDay); upcoming = true; }
    if (r < 0) return null;
    const fixtures = division.fixtures[r] || [];
    const results = r < division.round ? (division.results?.[r] || []) : [];
    const sorted = [...fixtures].sort((a, b) => ((b.homeId === me || b.awayId === me) - (a.homeId === me || a.awayId === me)));
    const shown = allFixtures ? sorted : sorted.slice(0, 6);
    return (
      <div className="ch-card" style={{ overflow: 'hidden' }}>
        <div className="ch-head"><h3>Jogos da rodada {r + 1}</h3><span className="ch-small">{upcoming ? formatCalendarDay(cal[r]) : `${fixtures.length} jogos`}</span></div>
        {shown.map(m => {
          const mine = m.homeId === me || m.awayId === me;
          const res = results.find(x => x.homeId === m.homeId && x.awayId === m.awayId);
          return (
            <div key={`${m.homeId}-${m.awayId}`} className={`tb-fx${mine ? ' tb-fx-mine' : ''}`}>
              <span className="tb-fx-h"><span className="cf-ell">{nameOf(m.homeId)}</span><Crest id={m.homeId} /></span>
              <span className="tb-fx-x cl-fx-score">{res ? `${res.homeGoals}–${res.awayGoals}` : '×'}</span>
              <span className="tb-fx-a"><Crest id={m.awayId} /><span className="cf-ell">{nameOf(m.awayId)}</span></span>
            </div>
          );
        })}
        {sorted.length > 6 && <div className="cl-more"><button type="button" className="ch-link" onClick={() => setAllFixtures(s => !s)}>{allFixtures ? 'Mostrar menos' : `Ver os ${sorted.length} jogos`}</button></div>}
      </div>
    );
  };

  // ── Datas importantes (a partir de hoje) ──
  const keyDates = (() => {
    const out = [];
    const status = myCopaStatus(save);
    const copa = save.copa;
    if (copa && status.alive) {
      const nextCopa = allEvents.find(e => e.comp === 'cb' && !e.played && e.day >= today);
      if (nextCopa) out.push({
        day: nextCopa.day, kind: 'cb', title: `Copa do Brasil · ${COPA_ROUND_LABELS[nextCopa.copaRound]}`,
        sub: `${nextCopa.leg ? `${nextCopa.leg === 'ida' ? 'Ida' : 'Volta'} · ` : 'Jogo único · '}${nextCopa.oppId ? `${nextCopa.isHome === false ? 'fora contra' : nextCopa.isHome ? 'em casa contra' : 'contra'} ${nameOf(nextCopa.oppId)}` : 'adversário a definir'}`,
      });
    } else if (copa) {
      out.push({ day: null, kind: 'cb', title: 'Copa do Brasil', sub: copa.phase === 'done' ? (copa.champion === me ? 'Campeão nesta temporada' : 'Encerrada nesta temporada') : 'Seu clube foi eliminado' });
    }
    const closeDay = currentWindowCloseDay(today);
    if (closeDay != null) out.push({ day: closeDay, kind: 'win', title: 'Janela de transferências fecha', sub: 'Último dia para negociar' });
    if (closeDay === JAN_END) out.push({ day: WINDOW2_START, kind: 'win', title: 'Janela de transferências abre', sub: `Fica aberta até ${formatCalendarDay(WINDOW2_END)}` });
    const openDay = nextWindowOpenDay(today);
    if (closeDay == null && openDay > today) out.push({ day: openDay, kind: 'win', title: 'Janela de transferências abre', sub: `Fica aberta até ${formatCalendarDay(openDay === WINDOW2_START ? WINDOW2_END : JAN_END)}` });
    if (closeDay == null && openDay <= today) out.push({ day: null, monthLabel: 'jan', kind: 'win', title: 'Janela de transferências abre', sub: 'Em janeiro, na próxima temporada' });
    if (cal[18] && cal[18] >= today) out.push({ day: cal[18], kind: 'turn', title: 'Fim do 1º turno', sub: 'Rodada 19' });
    if (cal[cal.length - 1] >= today) out.push({ day: cal[cal.length - 1], kind: 'end', title: 'Última rodada', sub: 'Relatório da temporada logo depois' });
    return out.sort((a, b) => (a.day ?? 999) - (b.day ?? 999));
  })();
  const KD_ICON = { cb: ['cup', 'var(--info-soft)', 'var(--info)'], win: ['market', 'var(--success-soft)', 'var(--success)'], turn: ['table', 'var(--surface-2)', 'var(--ink-2)'], end: ['trophy', 'var(--gold-soft)', 'var(--gold-ink)'] };

  // ── Lista ──
  const listGroups = (() => {
    const g = [];
    for (const e of events) {
      const m = dayOfYearToMonthDay(e.day).month;
      if (!g.length || g[g.length - 1].m !== m) g.push({ m, items: [] });
      g[g.length - 1].items.push(e);
    }
    return g;
  })();

  const { month: tMonth, dayOfMonth: tDom } = dayOfYearToMonthDay(today);

  return (
    <div className="ch-main cl-main">
      <div className="sq-ph cl-ph">
        <div style={{ minWidth: 0 }}>
          <span className="ch-mono">{nameOf(me)} · Temporada {save.season} · hoje, {tDom} de {MONTH_NAMES[tMonth].toLowerCase()}</span>
          <h1>Calendário</h1>
        </div>
        <div className="cl-ctrls">
          <div className="cl-chips" role="group" aria-label="Filtrar competição">
            <button type="button" className={`cl-chip${filter === 'all' ? ' cl-on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todos</button>
            <button type="button" className={`cl-chip${filter === 'br' ? ' cl-on' : ''}`} aria-pressed={filter === 'br'} onClick={() => setFilter('br')}><i style={{ background: COMP.br.color }} aria-hidden="true" />Brasileirão</button>
            <button type="button" className={`cl-chip${filter === 'cb' ? ' cl-on' : ''}`} aria-pressed={filter === 'cb'} onClick={() => setFilter('cb')} disabled={!hasCopaEvents} title={hasCopaEvents ? undefined : 'Seu clube não tem jogos da Copa do Brasil nesta temporada'}><i style={{ background: COMP.cb.color }} aria-hidden="true" />Copa do Brasil</button>
          </div>
          <div className="cf-seg" role="tablist" aria-label="Visualização">
            <button type="button" role="tab" aria-selected={mode === 'month'} className={mode === 'month' ? 'cf-on' : ''} onClick={() => setMode('month')}>Mês</button>
            <button type="button" role="tab" aria-selected={mode === 'list'} className={mode === 'list' ? 'cf-on' : ''} onClick={() => setMode('list')}>Lista</button>
          </div>
        </div>
      </div>

      {/* ── Faixa da temporada ── */}
      <div className="ch-card cl-strip">
        <div className="cl-strip-hd">
          <span className="ch-mono">Brasileirão · {division.round} de {totalRounds} rodadas · {tally.V}V {tally.E}E {tally.D}D</span>
          <span className="ch-small cl-strip-hint">Toque numa rodada para ir até a data</span>
        </div>
        <div className="cl-strip-scroll" ref={stripRef}>
          <div className="cl-strip-inner">
            <div className="cl-rounds" style={{ gridTemplateColumns: `repeat(${totalRounds}, minmax(0, 1fr))` }}>
              {brEvents.map(e => {
                const nx = isNextEv(e);
                const cls = e.result ? `cl-rd-${e.result.res.toLowerCase()}` : nx ? 'cl-rd-nx' : '';
                const turn = e.round === 18 || e.round === totalRounds - 1;
                return (
                  <button
                    key={e.key} type="button" className={`cl-rd ${cls}${turn ? ' cl-rd-turn' : ''}${selDay === e.day ? ' cl-rd-sel' : ''}`}
                    onClick={() => selectDay(e.day)}
                    aria-label={`Rodada ${e.round + 1}, ${formatCalendarDay(e.day)}, ${e.isHome ? 'em casa contra' : 'fora contra'} ${nameOf(e.oppId)}${e.result ? `, ${e.result.res === 'V' ? 'vitória' : e.result.res === 'D' ? 'derrota' : 'empate'} ${e.result.gf} a ${e.result.ga}` : nx ? ', próximo jogo' : ''}`}
                    title={`R${e.round + 1} · ${ddmm(e.day)} · ${e.isHome ? '' : '@ '}${nameOf(e.oppId)}${e.result ? ` · ${e.result.gf}–${e.result.ga}` : ''}`}
                  >{e.round + 1}</button>
                );
              })}
            </div>
            <div className="cl-marks" style={{ height: markerRows * 18 + 6 }} aria-hidden="true">
              {markers.map(m => (
                <span key={m.text} style={{ left: `${m.pct}%`, top: m.row * 18, transform: m.pct > 92 ? 'translateX(-100%)' : m.pct < 6 ? 'none' : undefined }} className={m.cb ? 'cl-mk-cb' : ''}>{m.text}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="cl-lay">
        {mode === 'month' ? (
          <div className="ch-card cl-cal">
            <div className="cl-nav2">
              <button type="button" className="cl-arw" onClick={() => setViewMonth(m => Math.max(0, m - 1))} disabled={viewMonth === 0} aria-label="Mês anterior"><Icon name="chevronLeft" size={16} /></button>
              <h3 aria-live="polite">{MONTH_NAMES[viewMonth]} {GRID_YEAR + save.season - 1}</h3>
              <button type="button" className="cl-arw" onClick={() => setViewMonth(m => Math.min(11, m + 1))} disabled={viewMonth === 11} aria-label="Próximo mês"><Icon name="chevronRight" size={16} /></button>
              <button type="button" className="cl-chip cl-today-btn" onClick={() => { selectDay(today); focusPending.current = true; }}>Ir para hoje</button>
            </div>
            <div className="cl-wd" aria-hidden="true">{WEEKDAYS.map(w => <span key={w}>{w}</span>)}</div>
            <div className="cl-grid" ref={gridRef} role="grid" aria-label={`${MONTH_NAMES[viewMonth]}: dias da temporada`} onKeyDown={onGridKey}>
              {gridCells.map((c, i) => {
                if (c.out) return <div key={`o${i}`} className="cl-dc cl-out" aria-hidden="true"><span className="cl-dn">{c.dom}</span></div>;
                const evs = eventsByDay[c.doy] || [];
                const ev = evs[0];
                const cls = [
                  'cl-dc',
                  isTransferWindowOpen(c.doy) ? 'cl-win' : '',
                  c.doy === today ? 'cl-td' : '',
                  c.doy === selDay ? 'cl-sel' : '',
                  ev ? 'cl-has' : '',
                ].filter(Boolean).join(' ');
                return (
                  <button
                    key={c.doy} type="button" className={cls} data-doy={c.doy}
                    tabIndex={c.doy === focusInMonth ? 0 : -1}
                    aria-label={dayAria(c.doy, evs)} aria-pressed={c.doy === selDay}
                    onClick={() => selectDay(c.doy, { openSheet: true })}
                    onFocus={() => setFocusDay(c.doy)}
                  >
                    <span className="cl-dn">{c.dom}{c.doy === today && <em> hoje</em>}</span>
                    {ev && <i className="cl-comp" style={{ background: COMP[ev.comp].color }} aria-hidden="true" />}
                    {ev && (
                      <span className="cl-m">
                        <span className="cl-op">{ev.oppId ? <Crest id={ev.oppId} size={16} /> : <span className="cl-crest-q" style={{ width: 16, height: 16 }}>?</span>}{ev.oppId ? clubAbbr(ev.oppId) : 'A DEF.'} <small>{ev.isHome == null ? (ev.oppId ? 'neutro' : '') : ev.isHome ? 'casa' : 'fora'}</small></span>
                        <ResChip ev={ev} isNext={isNextEv(ev)} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="cl-lg">
              <span><i className="cl-lg-dot" style={{ background: COMP.br.color }} />Brasileirão</span>
              <span><i className="cl-lg-dot" style={{ background: COMP.cb.color }} />Copa do Brasil</span>
              <span><i style={{ background: '#EEF5F0', border: '1px solid var(--line-strong)' }} />Janela de transferências aberta</span>
              <span><i style={{ border: '2px solid var(--ink)' }} />Hoje</span>
              <span><i style={{ background: '#F6EEDB', border: '2px solid var(--gold)' }} />Selecionado</span>
            </div>
          </div>
        ) : (
          <div className="ch-card cl-list" ref={listRef}>
            {listGroups.length === 0 && <div className="ch-empty">Nenhum jogo para este filtro.</div>}
            {listGroups.map(g => (
              <section key={g.m} aria-label={MONTH_NAMES[g.m]}>
                <h3 className="cl-li-month">{MONTH_NAMES[g.m]}</h3>
                <ul>
                  {g.items.map(e => {
                    const nx = isNextEv(e);
                    const { dayOfMonth } = dayOfYearToMonthDay(e.day);
                    return (
                      <li key={e.key}>
                        <button type="button" className={`cl-li${nx ? ' cl-li-next' : ''}${selDay === e.day ? ' cl-li-sel' : ''}`} onClick={() => selectDay(e.day, { openSheet: true })} aria-label={dayAria(e.day, [e])}>
                          <span className="cl-li-dt"><b>{dayOfMonth}</b><span>{WEEKDAY_FULL[new Date(GRID_YEAR, g.m, dayOfMonth).getDay()].slice(0, 3)}</span></span>
                          <span className="cl-li-comp"><i className="cl-dot" style={{ background: COMP[e.comp].color }} />{e.comp === 'br' ? `Brasileirão · R${e.round + 1}` : `Copa · ${e.label}`}</span>
                          <span className="cl-li-opp">{e.oppId ? <Crest id={e.oppId} size={20} /> : <span className="cl-crest-q" style={{ width: 20, height: 20 }}>?</span>}<b className="cf-ell">{e.oppId ? nameOf(e.oppId) : 'A definir'}</b></span>
                          <span className="cl-li-ha">{e.isHome == null ? (e.oppId ? 'neutro' : '—') : e.isHome ? 'casa' : 'fora'}</span>
                          <span className="cl-li-res">{e.result || e.played || nx ? <ResChip ev={e} isNext={nx} /> : <span className="ch-small">a jogar</span>}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="cl-side">
          {!isMobile && <DayCard />}
          {!isMobile && <RoundCard />}
          <div className="ch-card" style={{ overflow: 'hidden' }}>
            <div className="ch-head"><h3>Datas importantes</h3></div>
            {keyDates.length === 0 && <div className="ch-empty">Nada mais nesta temporada.</div>}
            {keyDates.map(k => {
              const md = k.day ? dayOfYearToMonthDay(k.day) : null;
              const [ic, bg, fg] = KD_ICON[k.kind];
              return (
                <button key={k.title + (k.day || '')} type="button" className="cl-ev" onClick={() => k.day && selectDay(k.day)} disabled={!k.day}>
                  <span className="cl-ev-dt"><b>{md ? String(md.dayOfMonth).padStart(2, '0') : '—'}</b><span>{md ? MONTH_SHORT[md.month] : (k.monthLabel || '')}</span></span>
                  <span className="cl-ev-ic" style={{ background: bg, color: fg }}><Icon name={ic} size={16} /></span>
                  <span style={{ minWidth: 0 }}><b>{k.title}</b><small>{k.sub}</small></span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isMobile && sheet && (
        <div className="cl-sheet-ov" role="presentation" onClick={() => setSheet(false)}>
          <div className="cl-sheet" role="dialog" aria-modal="true" aria-label={`Detalhes de ${formatCalendarDay(selDay)}`} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setSheet(false); }}>
            <div className="cl-sheet-bar"><span aria-hidden="true" /><button type="button" className="ui-modal-close" style={{ position: 'static' }} onClick={() => setSheet(false)} aria-label="Fechar" autoFocus><Icon name="close" size={18} /></button></div>
            <DayCard />
            <RoundCard />
          </div>
        </div>
      )}
    </div>
  );
}
