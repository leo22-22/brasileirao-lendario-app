// Mercado de transferências do Modo Carreira — redesenho de 2026-11-13
// seguindo modo-carreira-mercado-mockup.html. Regras de negócio iguais às
// de antes: proposta de compra decidida pelo clube vendedor
// (proposeTransfer/acceptanceChance), pedido de empréstimo
// (requestLoanIn/loanOutWillingness), listas de venda/empréstimo do meu
// elenco, propostas recebidas (aceitar/contrapropor/recusar), bloqueios de
// janela, orçamento (canAfford = orçamento ≥ 50% do valor) e elenco mínimo
// do vendedor. Novidades: aba Contratar (busca em todos os clubes),
// Observados (save.shortlist) e propostas agendadas com a janela fechada
// (save.queuedProposals, enviadas quando a janela abre — marketQueue.js).
import { useEffect, useMemo, useRef, useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { CAREER_CLUB_IDS } from '../../data/career-clubs.js';
import { computePlayerValue } from '../engine/pricing.js';
import { MIN_SQUAD_SIZE, acceptanceChance } from '../engine/rosterStore.js';
import { isTransferWindowOpen, nextWindowOpenDay, currentWindowCloseDay, JAN_END, WINDOW2_START, WINDOW2_END } from '../engine/calendar.js';
import { LOAN_DURATIONS, loanOutWillingness } from '../engine/loans.js';
import { decideAiListings } from '../engine/aiTransfers.js';
import { squadNeeds } from '../engine/squadDepth.js';
import { findPlayerAnywhere, isShortlisted } from '../engine/marketQueue.js';
import { dayParts } from '../engine/careerMeta.js';
import { POS_ORDER, posSector } from '../../lib/format.js';
import { displayName } from '../../lib/displayName.js';
import { Icon, TeamBadge, Modal } from '../../ui/index.jsx';
import '../components/careerShell.css';
import './careerSquad.css';
import './careerMarket.css';

const PAGE = 25;
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MLEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function money(n) {
  return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
}
function moneyShort(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000_000) return `${sign}R$ ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}B`;
  if (abs >= 10_000_000) return `${sign}R$ ${Math.round(abs / 1_000_000)}M`;
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `${sign}R$ ${Math.round(abs / 1_000)}K`;
  return `${sign}R$ ${abs}`;
}
function longDate(day) {
  let r = Math.max(1, Math.min(365, day)); let m = 0;
  while (m < 11 && r > MLEN[m]) { r -= MLEN[m]; m++; }
  return `${r} de ${MONTHS_FULL[m]}`;
}
const shortD = (day) => { const { d, m } = dayParts(day); return `${String(d).padStart(2, '0')}/${m}`; };
const clubOf = (id) => TEAMS.find(t => t.id === id);
const ovrClass = (o) => (o >= 85 ? 'sq-o-hi' : o >= 80 ? 'sq-o-md' : 'sq-o-lo');

// Chance de aceite em 5 faixas — a probabilidade vem da MESMA função que
// decide a proposta (acceptanceChance / loanOutWillingness).
function chanceBand(p) {
  if (p <= 0) return { label: 'Nenhuma', segs: 0, tone: 'danger' };
  if (p < 0.25) return { label: 'Muito baixa', segs: 1, tone: 'danger' };
  if (p < 0.5) return { label: 'Baixa', segs: 2, tone: 'warning' };
  if (p < 0.75) return { label: 'Média', segs: 3, tone: 'warning' };
  if (p < 1) return { label: 'Alta', segs: 4, tone: 'success' };
  return { label: 'Muito alta', segs: 5, tone: 'success' };
}
const TONE = { danger: 'var(--danger)', warning: 'var(--warning-ink)', success: 'var(--success)' };

function PosChip({ pos }) {
  return <span className={`sq-pos sq-${posSector(pos)}`}>{pos}</span>;
}
function Crest({ clubId, size = 30 }) {
  const t = clubOf(clubId);
  return <TeamBadge src={CLUB_LOGOS[t?.club]} name={t?.club || ''} color={t?.colors?.p || '#0D3A29'} size={size} radius={size / 2} />;
}

function Toast({ toast }) {
  if (!toast) return null;
  return <div className={`mk-toast mk-toast-${toast.tone}`} role="status" aria-live="polite"><Icon name={toast.tone === 'success' ? 'check' : toast.tone === 'danger' ? 'close' : 'info'} size={16} />{toast.text}</div>;
}

// ── Janela de transferências ───────────────────────────────────────────
function WindowCard({ day }) {
  const open = isTransferWindowOpen(day);
  const close = currentWindowCloseDay(day);
  const nextOpen = nextWindowOpenDay(day);
  const daysTo = open ? close - day : (nextOpen > day ? nextOpen - day : 365 - day + nextOpen);
  const pct = (d) => `${((d - 1) / 364) * 100}%`;
  return (
    <div className={`ch-card mk-win${open ? ' mk-win-open' : ''}`}>
      <div className="mk-win-st">
        <span className="mk-win-ico"><Icon name="calendar" size={18} /></span>
        <div>
          <b>{open ? 'Janela aberta' : 'Janela fechada'}</b>
          <div className="ch-small">{open ? `Fecha em ${longDate(close)} · falta${daysTo === 1 ? '' : 'm'} ${daysTo} dia${daysTo === 1 ? '' : 's'}` : `Abre em ${longDate(nextOpen)} · falta${daysTo === 1 ? '' : 'm'} ${daysTo} dia${daysTo === 1 ? '' : 's'}`}</div>
        </div>
      </div>
      <div className="mk-tl" role="img" aria-label={`Linha do tempo: janelas de 1 a ${JAN_END} de janeiro e de ${longDate(WINDOW2_START)} a ${longDate(WINDOW2_END)}; hoje é ${longDate(day)}`}>
        <span className="mk-tl-base" />
        <span className="mk-tl-open" style={{ left: 0, width: pct(JAN_END) }} />
        <span className="mk-tl-open" style={{ left: pct(WINDOW2_START), width: `calc(${pct(WINDOW2_END)} - ${pct(WINDOW2_START)})` }} />
        <span className="mk-tl-now" style={{ left: pct(day) }}><em>hoje</em></span>
        {[['jan', 1], ['abr', 91], ['jul', 182], ['out', 274]].map(([m, d]) => <span key={m} className="mk-tl-m" style={{ left: pct(d) }}>{m}</span>)}
        <span className="mk-tl-m" style={{ right: 0 }}>dez</span>
      </div>
      <p className="ch-small mk-win-txt">{open ? 'Pode contratar, pedir emprestado e responder propostas agora.' : 'Dá para observar, listar e agendar propostas. Elas são enviadas quando a janela abrir.'}</p>
    </div>
  );
}

// ── Painel de proposta (compra + empréstimo) ───────────────────────────
function ProposePanel({ save, row, onPropose, onRequestLoan, onQueue, onCancelQueued, onDone, notify }) {
  const { p, clubId, value } = row;
  const windowOpen = isTransferWindowOpen(save.calendarDay);
  const budget = save.clubs[save.myClubId].budget;
  const sellerRoster = save.clubs[clubId].roster.filter(x => !x.inAcademy);
  const sellerCanSell = save.clubs[clubId].roster.length > MIN_SQUAD_SIZE;
  const canAfford = budget >= value * 0.5; // mesma regra de antes
  const [amount, setAmount] = useState(() => Math.min(value, Math.max(0, budget)));
  const [loanKind, setLoanKind] = useState('1s');
  const queued = (save.queuedProposals || []).filter(q => q.playerName === p.name);
  const queuedBuy = queued.find(q => q.kind === 'buy');
  const queuedLoan = queued.find(q => q.kind === 'loan');
  const pBuy = amount > 0 ? acceptanceChance(amount, value) : 0;
  const band = chanceBand(pBuy);
  const pLoan = loanOutWillingness(sellerRoster, p);
  const loanBand = chanceBand(pLoan);
  const borrowed = !!p.onLoanFrom;
  const openDay = nextWindowOpenDay(save.calendarDay);

  const buyBlock = !sellerCanSell ? `${displayName(clubOf(clubId)?.club)} está no mínimo de ${MIN_SQUAD_SIZE} jogadores e não pode vender.`
    : !canAfford ? `Orçamento insuficiente: é preciso ter pelo menos 50% do valor (${moneyShort(value * 0.5)}).`
      : amount <= 0 ? 'Digite um valor.'
        : amount > budget ? `O valor passa do seu orçamento (${moneyShort(budget)}).`
          : null;
  const loanBlock = borrowed ? 'Jogador já está emprestado a este clube.' : !sellerCanSell ? 'O clube dono está no mínimo de elenco.' : null;

  const sendBuy = () => {
    if (buyBlock) return;
    if (!windowOpen) {
      onQueue({ kind: 'buy', playerName: p.name, clubId, amount });
      notify({ tone: 'info', text: `Proposta por ${p.name} agendada para ${shortD(openDay)}.` });
      return;
    }
    const res = onPropose(clubId, p.name, amount);
    notify(res.accepted
      ? { tone: 'success', text: `${p.name} contratado por ${money(res.price)}.` }
      : { tone: 'danger', text: res.reason === 'orçamento insuficiente' ? 'Orçamento insuficiente.' : `O ${displayName(clubOf(clubId)?.club)} recusou ${money(amount)} por ${p.name}.` });
    if (res.accepted) onDone();
  };
  const sendLoan = () => {
    if (loanBlock) return;
    if (!windowOpen) {
      onQueue({ kind: 'loan', playerName: p.name, clubId, loanKind });
      notify({ tone: 'info', text: `Pedido de empréstimo de ${p.name} agendado para ${shortD(openDay)}.` });
      return;
    }
    const res = onRequestLoan(clubId, p.name, loanKind);
    notify(res.accepted
      ? { tone: 'success', text: `${p.name} chega emprestado (${LOAN_DURATIONS.find(d => d.kind === loanKind)?.label}).` }
      : { tone: 'danger', text: `O ${displayName(clubOf(clubId)?.club)} recusou emprestar ${p.name}.` });
    if (res.accepted) onDone();
  };

  return (
    <div className="mk-prop" role="region" aria-label={`Proposta por ${p.name}`}>
      <div>
        <h5>Proposta de compra</h5>
        <label className="mk-moneyin">
          <span className="sr-only">Valor da proposta em reais</span>
          <span aria-hidden="true">R$</span>
          <input
            inputMode="numeric"
            value={amount ? Number(amount).toLocaleString('pt-BR') : ''}
            onChange={e => setAmount(Number(e.target.value.replace(/\D/g, '').slice(0, 11)) || 0)}
            aria-label="Valor da proposta"
          />
        </label>
        <div className="mk-quick">
          {[[-0.2, '−20%'], [-0.1, '−10%'], [0, 'Valor de mercado'], [0.1, '+10%']].map(([f, l]) => {
            const v = Math.round(value * (1 + f));
            return <button key={l} type="button" className={amount === v ? 'mk-on' : ''} onClick={() => setAmount(v)}>{l}</button>;
          })}
        </div>
        <div className="ch-row mk-chance"><span>Chance de o {displayName(clubOf(clubId)?.club)} aceitar</span><b style={{ color: TONE[band.tone] }}>{band.label} · {Math.round(pBuy * 100)}%</b></div>
        <div className="mk-seg5" aria-hidden="true">{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= band.segs ? `mk-on mk-${band.tone}` : ''} />)}</div>
        <div className="ch-small" style={{ marginTop: 8 }}>Valor de mercado {money(value)} · abaixo de 60% dele o clube nunca aceita.</div>
        <div className="ch-small">Depois da compra: orçamento {money(budget - amount)}</div>
      </div>
      <div>
        <h5>Ou pedir emprestado</h5>
        <div className="mk-quick" style={{ marginTop: 0 }} role="radiogroup" aria-label="Duração do empréstimo">
          {LOAN_DURATIONS.map(d => <button key={d.kind} type="button" role="radio" aria-checked={loanKind === d.kind} className={loanKind === d.kind ? 'mk-on' : ''} onClick={() => setLoanKind(d.kind)}>{d.label}</button>)}
        </div>
        <div className="ch-row mk-chance"><span>Chance de emprestar</span><b style={{ color: TONE[loanBand.tone] }}>{loanBand.label} · {Math.round(pLoan * 100)}%</b></div>
        <div className="mk-seg5" aria-hidden="true">{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= loanBand.segs ? `mk-on mk-${loanBand.tone}` : ''} />)}</div>
        <div className="ch-small" style={{ marginTop: 8 }}>O clube decide na hora. Titulares raramente são emprestados.</div>
        <div className="mk-pbtn">
          <button type="button" className="ui-btn ui-btn-dark ui-btn-md" style={{ flex: '1 1 160px' }} disabled={!!buyBlock} onClick={sendBuy} title={buyBlock || undefined}>
            {windowOpen ? 'Enviar proposta' : queuedBuy ? 'Atualizar agendamento' : 'Agendar proposta'}
          </button>
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-md" disabled={!!loanBlock} onClick={sendLoan} title={loanBlock || undefined}>
            {windowOpen ? 'Pedir empréstimo' : queuedLoan ? 'Atualizar pedido' : 'Agendar empréstimo'}
          </button>
        </div>
        {(buyBlock && amount > 0) && <div className="mk-locked mk-locked-danger"><Icon name="warning" size={16} />{buyBlock}</div>}
        {loanBlock && <div className="mk-locked mk-locked-danger"><Icon name="warning" size={16} />{loanBlock}</div>}
        {!windowOpen && <div className="mk-locked"><Icon name="calendar" size={16} />Janela fechada · a proposta fica salva e é enviada em {shortD(openDay)}</div>}
        {queued.map(q => (
          <div key={q.kind} className="mk-locked mk-locked-info">
            <Icon name="clock" size={16} />
            <span style={{ flex: 1 }}>{q.kind === 'buy' ? `Proposta de ${money(q.amount)} agendada` : `Empréstimo (${LOAN_DURATIONS.find(d => d.kind === q.loanKind)?.label}) agendado`}</span>
            <button type="button" className="ch-link" onClick={() => onCancelQueued(p.name, q.kind)}>Cancelar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tabela de jogadores de outros clubes ───────────────────────────────
function PlayerTable({ save, rows, openKey, setOpenKey, onToggleShortlist, panelProps, total, page, setPage, emptyText }) {
  const shown = rows.slice(0, page * PAGE);
  return (
    <>
      <div className="mk-th" aria-hidden="true"><span>Jogador · {total} resultado{total === 1 ? '' : 's'}</span><span>Pos</span><span className="r">Idade</span><span className="r">OVR</span><span className="r">Valor</span><span /></div>
      {shown.length === 0 && <div className="ch-empty">{emptyText}</div>}
      {shown.map(row => {
        const key = `${row.clubId}::${row.p.name}`;
        const open = openKey === key;
        const watched = isShortlisted(save, row.p.name);
        const extra = [
          displayName(clubOf(row.clubId)?.club),
          row.p.potential != null && row.p.potential > row.p.ovr ? `potencial ${row.p.potential}` : null,
          row.listed ? 'na lista do clube' : null,
          row.loanChance >= 0.5 ? 'empréstimo provável' : null,
        ].filter(Boolean).join(' · ');
        return (
          <div key={key} className={`mk-tr-wrap${open ? ' mk-open' : ''}`}>
            <div className="mk-tr">
              <div className="mk-pl"><Crest clubId={row.clubId} /><div style={{ minWidth: 0 }}><b className="cf-ell">{row.p.name}</b><small>{extra}</small></div></div>
              <PosChip pos={row.p.pos[0]} />
              <span className="sq-num mk-hide-m">{row.p.age ?? '—'}</span>
              <span className={`sq-ovr ${ovrClass(row.p.ovr)}`}>{row.p.ovr}</span>
              <span className="sq-num mk-hide-m">{moneyShort(row.value)}</span>
              <span className="mk-acts">
                <button type="button" className={`mk-icon-btn${watched ? ' mk-watch-on' : ''}`} onClick={() => onToggleShortlist(row.clubId, row.p.name)} aria-pressed={watched} aria-label={watched ? `Deixar de observar ${row.p.name}` : `Observar ${row.p.name}`} title={watched ? 'Observando · clique para remover' : 'Observar'}>
                  <Icon name={watched ? 'check' : 'eye'} size={16} />
                </button>
                <button type="button" className={`mk-act${open ? ' mk-act-on' : ''}`} onClick={() => setOpenKey(open ? null : key)} aria-expanded={open}>{open ? 'Fechar' : 'Propor'}</button>
              </span>
            </div>
            {open && (
              <div className="mk-prop-wrap">
                <div className="mk-sheet-bg" onClick={() => setOpenKey(null)} aria-hidden="true" />
                <div className="mk-prop-sheet">
                  <div className="mk-sheet-head">
                    <b>{row.p.name}</b>
                    <button type="button" className="ui-modal-close" style={{ position: 'static' }} onClick={() => setOpenKey(null)} aria-label="Fechar proposta"><Icon name="close" size={18} /></button>
                  </div>
                  <ProposePanel save={save} row={row} {...panelProps} onDone={() => setOpenKey(null)} />
                </div>
              </div>
            )}
          </div>
        );
      })}
      {shown.length < rows.length && (
        <div className="mk-more"><button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setPage(page + 1)}>Carregar mais {Math.min(PAGE, rows.length - shown.length)} · {shown.length} de {rows.length}</button></div>
      )}
    </>
  );
}

const SORTS = [
  { id: 'value-for-money', label: 'Melhor custo-benefício' },
  { id: 'ovr', label: 'OVR' },
  { id: 'value', label: 'Valor' },
  { id: 'age', label: 'Idade (mais novos)' },
  { id: 'potential', label: 'Potencial' },
];
// Custo-benefício = OVR por valor (com o OVR acima de 60 pesando ao quadrado
// pra não premiar só jogador barato e fraco).
const sortFns = {
  'value-for-money': (a, b) => ((b.p.ovr - 60) ** 2 / (b.value / 1e6 + 2)) - ((a.p.ovr - 60) ** 2 / (a.value / 1e6 + 2)),
  ovr: (a, b) => b.p.ovr - a.p.ovr || a.value - b.value,
  value: (a, b) => b.value - a.value,
  age: (a, b) => (a.p.age ?? 99) - (b.p.age ?? 99) || b.p.ovr - a.p.ovr,
  potential: (a, b) => (b.p.potential ?? b.p.ovr) - (a.p.potential ?? a.p.ovr) || b.p.ovr - a.p.ovr,
};

const EMPTY_F = { q: '', pos: [], ageMin: '', ageMax: '', ovrMin: '', valueMax: '', division: '', clubId: '', afford: false, loan: false };

function FiltersBar({ f, setF, needPos, budget, fixedClub }) {
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const num = (v, max) => v.replace(/\D/g, '').slice(0, max);
  return (
    <div className="mk-fbar">
      <div className="mk-pg" role="group" aria-label="Posições">
        {POS_ORDER.map(pos => {
          const on = f.pos.includes(pos);
          return (
            <button key={pos} type="button" aria-pressed={on} className={`${on ? 'mk-on' : ''}${needPos.has(pos) ? ' mk-need' : ''}`} onClick={() => set('pos', on ? f.pos.filter(x => x !== pos) : [...f.pos, pos])} title={needPos.has(pos) ? 'Posição carente no seu elenco' : undefined}>{pos}</button>
          );
        })}
      </div>
      <label className="mk-fsel">Idade <input inputMode="numeric" value={f.ageMin} onChange={e => set('ageMin', num(e.target.value, 2))} placeholder="18" aria-label="Idade mínima" />–<input inputMode="numeric" value={f.ageMax} onChange={e => set('ageMax', num(e.target.value, 2))} placeholder="40" aria-label="Idade máxima" /></label>
      <label className="mk-fsel">OVR <input inputMode="numeric" value={f.ovrMin} onChange={e => set('ovrMin', num(e.target.value, 2))} placeholder="min" aria-label="OVR mínimo" />+</label>
      <label className="mk-fsel">Até R$ <input inputMode="numeric" value={f.valueMax ? Number(f.valueMax).toLocaleString('pt-BR') : ''} onChange={e => set('valueMax', num(e.target.value, 11))} placeholder="valor" aria-label="Valor máximo" style={{ width: 92 }} /></label>
      {!fixedClub && (
        <>
          <label className="mk-fsel"><span className="sr-only">Divisão</span>
            <select value={f.division} onChange={e => set('division', e.target.value)} aria-label="Divisão"><option value="">Série A e B</option><option value="A">Série A</option><option value="B">Série B</option></select>
          </label>
          <label className="mk-fsel"><span className="sr-only">Clube</span>
            <select value={f.clubId} onChange={e => set('clubId', e.target.value)} aria-label="Clube">
              <option value="">Todos os clubes</option>
              {CAREER_CLUB_IDS.map(id => clubOf(id)).sort((a, b) => a.club.localeCompare(b.club)).map(t => <option key={t.id} value={t.id}>{displayName(t.club)}</option>)}
            </select>
          </label>
        </>
      )}
      <label className="mk-tog"><input type="checkbox" checked={f.afford} onChange={e => set('afford', e.target.checked)} /><i aria-hidden="true" />Cabe no orçamento</label>
      <label className="mk-tog"><input type="checkbox" checked={f.loan} onChange={e => set('loan', e.target.checked)} /><i aria-hidden="true" />Empréstimo provável</label>
      {(f.pos.length || f.ageMin || f.ageMax || f.ovrMin || f.valueMax || f.division || f.clubId || f.afford || f.loan) ? (
        <button type="button" className="ch-link" onClick={() => setF(prev => ({ ...EMPTY_F, q: prev.q }))}>Limpar filtros</button>
      ) : null}
      <span className="sr-only">Orçamento atual {money(budget)}</span>
    </div>
  );
}

function applyFilters(rows, f, budget) {
  const q = normalize(f.q.trim());
  return rows.filter(r => {
    const p = r.p;
    if (q && !normalize(p.name).includes(q)) return false;
    if (f.pos.length && !f.pos.includes(p.pos[0])) return false;
    if (f.ageMin && (p.age == null || p.age < Number(f.ageMin))) return false;
    if (f.ageMax && (p.age == null || p.age > Number(f.ageMax))) return false;
    if (f.ovrMin && p.ovr < Number(f.ovrMin)) return false;
    if (f.valueMax && r.value > Number(f.valueMax)) return false;
    if (f.division && r.division !== f.division) return false;
    if (f.clubId && r.clubId !== f.clubId) return false;
    if (f.afford && !(budget >= r.value * 0.5)) return false; // mesma regra canAfford
    if (f.loan && r.loanChance < 0.5) return false;
    return true;
  });
}

function SearchTable({ save, allRows, fixedClub, f, setF, sort, setSort, needPos, panelProps, onToggleShortlist }) {
  const budget = save.clubs[save.myClubId].budget;
  const [openKey, setOpenKey] = useState(null);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const base = fixedClub ? allRows.filter(r => r.clubId === fixedClub) : allRows;
  const rows = useMemo(() => applyFilters(base, f, budget).sort(sortFns[sort]), [base, f, budget, sort]);
  useEffect(() => { setPage(1); }, [f, sort, fixedClub]);
  const activeCount = f.pos.length + ['ageMin', 'ageMax', 'ovrMin', 'valueMax', 'division', 'clubId', 'afford', 'loan'].filter(k => f[k]).length;
  return (
    <div className="ch-card mk-res">
      <div className="mk-top">
        <label className="sq-search" style={{ flex: '1 1 220px' }}>
          <Icon name="search" size={16} />
          <input value={f.q} onChange={e => setF(prev => ({ ...prev, q: e.target.value }))} placeholder={fixedClub ? 'Buscar jogador neste clube…' : 'Buscar jogador em todos os clubes…'} aria-label="Buscar jogador" />
        </label>
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm mk-only-m" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">Filtros{activeCount ? ` · ${activeCount}` : ''}</button>
        <label className="sq-sort"><span className="sr-only">Ordenar por</span>
          <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Ordenar por">{SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </label>
      </div>
      <div className="mk-hide-m-block"><FiltersBar f={f} setF={setF} needPos={needPos} budget={budget} fixedClub={fixedClub} /></div>
      {filtersOpen && (
        <Modal onClose={() => setFiltersOpen(false)} maxWidth={560} labelledBy="mk-f-title">
          <h3 id="mk-f-title" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 22, margin: '0 0 12px' }}>Filtros</h3>
          <FiltersBar f={f} setF={setF} needPos={needPos} budget={budget} fixedClub={fixedClub} />
          <button type="button" className="ui-btn ui-btn-dark ui-btn-md ui-btn-block" style={{ marginTop: 14 }} onClick={() => setFiltersOpen(false)}>Ver {rows.length} resultado{rows.length === 1 ? '' : 's'}</button>
        </Modal>
      )}
      <PlayerTable
        save={save} rows={rows} total={rows.length} openKey={openKey} setOpenKey={setOpenKey}
        onToggleShortlist={onToggleShortlist} panelProps={panelProps} page={page} setPage={setPage}
        emptyText="Nenhum jogador com esses filtros."
      />
    </div>
  );
}

// ── Meu elenco ─────────────────────────────────────────────────────────
function MyRosterTab({ save, onToggleListed, onToggleLoanList }) {
  const [q, setQ] = useState('');
  const roster = save.clubs[save.myClubId].roster.filter(p => !p.inAcademy);
  const transferList = save.transferList || [];
  const loanList = save.loanList || [];
  const nq = normalize(q.trim());
  const rows = roster.filter(p => !nq || normalize(p.name).includes(nq)).sort((a, b) => POS_ORDER.indexOf(a.pos[0]) - POS_ORDER.indexOf(b.pos[0]) || b.ovr - a.ovr);
  return (
    <div className="ch-card mk-res">
      <div className="mk-top">
        <label className="sq-search" style={{ flex: '1 1 220px' }}><Icon name="search" size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar no meu elenco…" aria-label="Buscar no meu elenco" /></label>
        <span className="ch-small">{transferList.filter(n => roster.some(p => p.name === n)).length} à venda · {loanList.filter(n => roster.some(p => p.name === n)).length} para empréstimo</span>
      </div>
      {roster.length <= MIN_SQUAD_SIZE && <div className="mk-locked" style={{ margin: '12px 18px 0' }}><Icon name="warning" size={16} />Elenco no mínimo de {MIN_SQUAD_SIZE}: mesmo com proposta, não dá para vender ou emprestar.</div>}
      <div className="mk-th mk-th-mine" aria-hidden="true"><span>Jogador</span><span>Pos</span><span className="r">Idade</span><span className="r">OVR</span><span className="r">Valor</span><span className="r">Venda · Empréstimo</span></div>
      {rows.map(p => {
        const listed = transferList.includes(p.name);
        const loanListed = loanList.includes(p.name);
        const borrowed = !!p.onLoanFrom;
        return (
          <div key={p.name} className="mk-tr mk-tr-mine">
            <div className="mk-pl" style={{ minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <b className="cf-ell">{p.name}</b>
                <small>{p.pos.join(' · ')}{borrowed ? ` · emprestado pelo ${displayName(clubOf(p.onLoanFrom)?.club)}` : ''}</small>
              </div>
            </div>
            <PosChip pos={p.pos[0]} />
            <span className="sq-num mk-hide-m">{p.age ?? '—'}</span>
            <span className={`sq-ovr ${ovrClass(p.ovr)}`}>{p.ovr}</span>
            <span className="sq-num mk-hide-m">{moneyShort(computePlayerValue(p, save.myClubId))}</span>
            <span className="mk-toggles">
              <button type="button" className={`mk-sw${listed ? ' mk-sw-on' : ''}`} aria-pressed={listed} onClick={() => onToggleListed(p.name)} aria-label={`${listed ? 'Tirar' : 'Colocar'} ${p.name} na lista de venda`}>
                <i aria-hidden="true" />Venda
              </button>
              <button type="button" className={`mk-sw${loanListed ? ' mk-sw-on mk-sw-info' : ''}`} aria-pressed={loanListed} disabled={borrowed} onClick={() => onToggleLoanList(p.name)} title={borrowed ? 'Jogador emprestado não pode ser reemprestado' : undefined} aria-label={`${loanListed ? 'Tirar' : 'Colocar'} ${p.name} na lista de empréstimo`}>
                <i aria-hidden="true" />Empréstimo
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Propostas recebidas ────────────────────────────────────────────────
function OfferCard({ save, offer, idx, onRespond, onCounterOffer, notify }) {
  const [countering, setCountering] = useState(false);
  const [counter, setCounter] = useState(0);
  const buyer = clubOf(offer.fromClubId);
  const isLoan = offer.type === 'loan';
  const loanLabel = isLoan ? LOAN_DURATIONS.find(d => d.kind === offer.kind)?.label : null;
  const player = save.clubs[save.myClubId].roster.find(p => p.name === offer.playerName);
  const market = player ? computePlayerValue(player, save.myClubId) : null;
  const diff = !isLoan && market ? Math.round(((offer.amount - market) / market) * 100) : null;
  const accept = () => {
    onRespond(idx, true);
    notify({ tone: 'success', text: isLoan ? `${offer.playerName} emprestado ao ${displayName(buyer?.club)} (${loanLabel}).` : `${offer.playerName} vendido ao ${displayName(buyer?.club)} por ${money(offer.amount)}.` });
  };
  const reject = () => { onRespond(idx, false); notify({ tone: 'info', text: `Proposta por ${offer.playerName} recusada.` }); };
  const sendCounter = () => {
    if (counter <= offer.amount) return;
    const res = onCounterOffer(idx, counter);
    notify(res?.accepted ? { tone: 'success', text: `Contraproposta aceita: ${offer.playerName} vendido por ${money(counter)}.` } : { tone: 'danger', text: `O ${displayName(buyer?.club)} não topou ${money(counter)} e desistiu.` });
  };
  return (
    <div className="mk-offer">
      <div className="mk-offer-head">
        <Crest clubId={offer.fromClubId} size={40} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <b>{displayName(buyer?.club)}</b> quer <b>{offer.playerName}</b>
          <div className="ch-small">{player ? `${player.pos[0]} · ${player.age ?? '—'} anos · OVR ${player.ovr}` : ''}</div>
        </div>
        <span className={`ch-tag ${isLoan ? 'ch-t-info' : 'ch-t-gold'}`}>{isLoan ? `Empréstimo · ${loanLabel}` : 'Compra'}</span>
      </div>
      {!isLoan && (
        <div className="mk-offer-vals">
          <div><small>Oferta</small><b>{money(offer.amount)}</b></div>
          <div><small>Valor de mercado</small><b>{market != null ? money(market) : '—'}</b></div>
          <div><small>Diferença</small><b style={{ color: diff >= 0 ? 'var(--success)' : 'var(--danger)' }}>{diff != null ? `${diff > 0 ? '+' : ''}${diff}%` : '—'}</b></div>
        </div>
      )}
      {countering ? (
        <div className="mk-counter">
          <label className="mk-moneyin"><span aria-hidden="true">R$</span><input inputMode="numeric" value={counter ? counter.toLocaleString('pt-BR') : ''} onChange={e => setCounter(Number(e.target.value.replace(/\D/g, '').slice(0, 11)) || 0)} aria-label="Valor da contraproposta" /></label>
          <div className="mk-quick">
            {[0.05, 0.1, 0.15, 0.2].map(f => { const v = Math.round(offer.amount * (1 + f)); return <button key={f} type="button" className={counter === v ? 'mk-on' : ''} onClick={() => setCounter(v)}>+{Math.round(f * 100)}%</button>; })}
            {market && <button type="button" className={counter === market ? 'mk-on' : ''} onClick={() => setCounter(market)}>Valor de mercado</button>}
          </div>
          <div className="ch-small" style={{ margin: '8px 0 10px' }}>Se passar do que o clube topa pagar, ele desiste e a proposta cai.</div>
          <div className="mk-pbtn" style={{ marginTop: 0 }}>
            <button type="button" className="ui-btn ui-btn-dark ui-btn-md" disabled={counter <= offer.amount} onClick={sendCounter}>Enviar contraproposta</button>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-md" onClick={() => setCountering(false)}>Voltar</button>
          </div>
        </div>
      ) : (
        <div className="mk-pbtn">
          <button type="button" className="ui-btn ui-btn-dark ui-btn-md" onClick={accept} style={{ flex: '1 1 140px' }}>Aceitar</button>
          {!isLoan && <button type="button" className="ui-btn ui-btn-ghost ui-btn-md" onClick={() => { setCounter(Math.round(offer.amount * 1.1)); setCountering(true); }}>Contraproposta</button>}
          <button type="button" className="ui-btn ui-btn-danger ui-btn-md" onClick={reject}>Recusar</button>
        </div>
      )}
    </div>
  );
}

function OffersTab({ save, onRespond, onCounterOffer, notify, goMine, onCancelQueued }) {
  const offers = save.pendingOffers || [];
  const queued = save.queuedProposals || [];
  return (
    <div className="mk-col">
      {offers.length === 0 ? (
        <div className="ch-card mk-empty">
          <span className="mk-empty-ico"><Icon name="chat" size={26} /></span>
          <b>Nenhuma proposta recebida</b>
          <p className="ch-small">Elas chegam com a janela aberta. Listar jogadores aumenta a chance.</p>
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={goMine}>Listar jogadores</button>
        </div>
      ) : offers.map((o, i) => <OfferCard key={`${o.fromClubId}-${o.playerName}-${i}`} save={save} offer={o} idx={i} onRespond={onRespond} onCounterOffer={onCounterOffer} notify={notify} />)}
      {queued.length > 0 && (
        <div className="ch-card" style={{ overflow: 'hidden' }}>
          <div className="ch-head"><h3>Agendadas por você</h3><span className="ch-small">enviadas em {shortD(nextWindowOpenDay(save.calendarDay))}</span></div>
          {queued.map(q => (
            <div key={`${q.kind}-${q.playerName}`} className="ch-al">
              <Crest clubId={q.clubId} size={32} />
              <div style={{ minWidth: 0, flex: 1 }}><b>{q.playerName}</b><p>{q.kind === 'buy' ? `Compra · ${money(q.amount)}` : `Empréstimo · ${LOAN_DURATIONS.find(d => d.kind === q.loanKind)?.label}`} · {displayName(clubOf(q.clubId)?.club)}</p></div>
              <button type="button" className="ch-act ch-link" onClick={() => onCancelQueued(q.playerName, q.kind)}>Cancelar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Clubes ─────────────────────────────────────────────────────────────
function ClubsTab({ save, clubStats, onOpenClub }) {
  const [division, setDivision] = useState('A');
  const [q, setQ] = useState('');
  const [adv, setAdv] = useState({ sMin: '', sMax: '', vMin: '', vMax: '' });
  const nq = normalize(q.trim());
  const ids = CAREER_CLUB_IDS.filter(id => id !== save.myClubId && save.clubs[id].division === division)
    .filter(id => !nq || normalize(clubOf(id).club).includes(nq))
    .filter(id => {
      const s = clubStats[id];
      if (adv.sMin && s.strength < Number(adv.sMin)) return false;
      if (adv.sMax && s.strength > Number(adv.sMax)) return false;
      if (adv.vMin && s.value < Number(adv.vMin) * 1e6) return false;
      if (adv.vMax && s.value > Number(adv.vMax) * 1e6) return false;
      return true;
    })
    .sort((a, b) => clubOf(a).club.localeCompare(clubOf(b).club));
  const set = (k) => (e) => setAdv(prev => ({ ...prev, [k]: e.target.value.replace(/\D/g, '').slice(0, 5) }));
  return (
    <div className="ch-card mk-res">
      <div className="mk-top">
        <div className="cf-seg" role="tablist" aria-label="Divisão">
          {['A', 'B'].map(d => <button key={d} type="button" role="tab" aria-selected={division === d} className={division === d ? 'cf-on' : ''} onClick={() => setDivision(d)}>Série {d}</button>)}
        </div>
        <label className="sq-search" style={{ flex: '1 1 200px' }}><Icon name="search" size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar clube…" aria-label="Buscar clube" /></label>
      </div>
      <div className="mk-fbar">
        <label className="mk-fsel">Força <input inputMode="numeric" value={adv.sMin} onChange={set('sMin')} placeholder="min" aria-label="Força mínima" />–<input inputMode="numeric" value={adv.sMax} onChange={set('sMax')} placeholder="max" aria-label="Força máxima" /></label>
        <label className="mk-fsel">Valor R$ <input inputMode="numeric" value={adv.vMin} onChange={set('vMin')} placeholder="min" aria-label="Valor mínimo em milhões" />–<input inputMode="numeric" value={adv.vMax} onChange={set('vMax')} placeholder="max" aria-label="Valor máximo em milhões" />M</label>
      </div>
      {ids.length === 0 && <div className="ch-empty">Nenhum clube com esses filtros.</div>}
      <div className="mk-clubs">
        {ids.map(id => {
          const s = clubStats[id];
          return (
            <button key={id} type="button" className="mk-club" onClick={() => onOpenClub(id)}>
              <Crest clubId={id} size={40} />
              <b className="cf-ell">{displayName(clubOf(id).club)}</b>
              <span className="mk-club-stats"><span><small>Força</small>{s.strength}</span><span><small>Valor</small>{moneyShort(s.value)}</span><span><small>Na lista</small>{s.listed}</span></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Histórico ──────────────────────────────────────────────────────────
const HIST_TYPES = {
  'user-buy': { label: 'Compra', tone: 'gold', sign: -1 },
  'user-sell': { label: 'Venda', tone: 'success', sign: 1 },
  'loan-out': { label: 'Empréstimo', tone: 'info', sign: 0 },
  'loan-in': { label: 'Empréstimo', tone: 'info', sign: 0 },
  'loan-return': { label: 'Retorno', tone: 'mute', sign: 0 },
  retired: { label: 'Aposentadoria', tone: 'mute', sign: 0 },
};
const HISTORY_FILTERS = [
  { id: '', label: 'Todos' },
  { id: 'user-buy', label: 'Comprados' },
  { id: 'user-sell', label: 'Vendidos' },
  { id: 'loan-out', label: 'Emprestados' },
  { id: 'loan-in', label: 'Pegos emprestado' },
  { id: 'loan-return', label: 'Retornos' },
  { id: 'retired', label: 'Aposentados' },
];
const myLog = (save) => (save.transferLog || []).filter(e => e.fromClubId === save.myClubId || e.toClubId === save.myClubId);

function HistoryTab({ save }) {
  const [filter, setFilter] = useState('');
  const mine = myLog(save);
  const list = (filter ? mine.filter(e => e.type === filter) : mine).slice().reverse();
  const seasons = [...new Set(list.map(e => e.season))];
  return (
    <div className="ch-card mk-res">
      <div className="ch-chips" style={{ padding: '14px 18px' }} role="tablist" aria-label="Filtrar histórico">
        {HISTORY_FILTERS.map(f => {
          const n = f.id ? mine.filter(e => e.type === f.id).length : mine.length;
          return <button key={f.id || 'all'} type="button" role="tab" aria-selected={filter === f.id} className={`ch-chip${filter === f.id ? ' ch-on' : ''}`} onClick={() => setFilter(f.id)}>{f.label} <em style={{ fontStyle: 'normal', opacity: 0.6 }}>{n}</em></button>;
        })}
      </div>
      {list.length === 0 && <div className="ch-empty">Nenhum registro {filter ? 'desse tipo ' : ''}ainda.</div>}
      {seasons.map(season => (
        <div key={season}>
          <div className="sq-grp">Temporada {season}</div>
          {list.filter(e => e.season === season).map((e, i) => {
            const t = HIST_TYPES[e.type] || { label: e.type, tone: 'mute', sign: 0 };
            const incoming = e.toClubId === save.myClubId;
            const otherId = incoming ? e.fromClubId : e.toClubId;
            const sign = e.type === 'user-buy' ? -1 : e.type === 'user-sell' ? 1 : 0;
            return (
              <div key={`${season}-${i}`} className="mk-hr">
                <span className="mk-hr-date">d{e.day ?? '—'}<small>{e.day ? shortD(e.day) : ''}</small></span>
                <span className={`ch-tag ch-t-${t.tone === 'gold' ? 'gold' : t.tone}`}>{e.type === 'loan-in' ? 'Pego emprestado' : t.label}</span>
                <span className="mk-hr-pl"><b className="cf-ell">{e.playerName}</b></span>
                <span className="mk-hr-club">{e.type !== 'retired' && otherId ? <><span className="ch-small">{incoming ? 'do' : 'para o'}</span><Crest clubId={otherId} size={22} /><span className="cf-ell">{displayName(clubOf(otherId)?.club)}</span></> : <span className="ch-small">—</span>}</span>
                <span className="mk-hr-v" style={{ color: sign > 0 ? 'var(--success)' : sign < 0 ? 'var(--danger)' : 'var(--muted)' }}>{sign ? `${sign > 0 ? '+' : '−'}${moneyShort(e.amount).replace('R$ ', '')}` : e.durationLabel || '—'}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Observados ─────────────────────────────────────────────────────────
function ShortlistTab({ save, allRows, onToggleShortlist, panelProps }) {
  const [openKey, setOpenKey] = useState(null);
  const list = save.shortlist || [];
  if (!list.length) {
    return (
      <div className="ch-card mk-empty">
        <span className="mk-empty-ico"><Icon name="eye" size={26} /></span>
        <b>Nenhum jogador observado</b>
        <p className="ch-small">Use o botão de olho em Contratar ou Clubes para acompanhar OVR e valor.</p>
      </div>
    );
  }
  return (
    <div className="ch-card mk-res">
      <div className="mk-th mk-th-watch" aria-hidden="true"><span>Jogador</span><span>Pos</span><span className="r">OVR</span><span className="r">Valor</span><span /></div>
      {list.map(s => {
        const row = allRows.find(r => r.p.name === s.playerName);
        const found = row || findPlayerAnywhere(save, s.playerName);
        const atMine = found && found.clubId === save.myClubId;
        const p = row?.p || found?.player;
        if (!p) {
          return (
            <div key={s.playerName} className="mk-tr mk-tr-watch">
              <div className="mk-pl"><div><b>{s.playerName}</b><small>Não está mais em nenhum clube (aposentado)</small></div></div>
              <span /><span /><span />
              <button type="button" className="ch-link" onClick={() => onToggleShortlist(s.clubId, s.playerName)}>Remover</button>
            </div>
          );
        }
        const value = row ? row.value : computePlayerValue(p, found.clubId);
        const dOvr = p.ovr - s.ovr;
        const dVal = s.value ? Math.round(((value - s.value) / s.value) * 100) : 0;
        const key = `${row?.clubId}::${p.name}`;
        const open = openKey === key;
        return (
          <div key={s.playerName} className={`mk-tr-wrap${open ? ' mk-open' : ''}`}>
            <div className="mk-tr mk-tr-watch">
              <div className="mk-pl"><Crest clubId={found.clubId} /><div style={{ minWidth: 0 }}><b className="cf-ell">{p.name}</b><small>{displayName(clubOf(found.clubId)?.club)}{atMine ? ' · já é seu' : ''}{found.clubId !== s.clubId ? ` · trocou de clube` : ''} · observado em {shortD(s.day)}</small></div></div>
              <PosChip pos={p.pos[0]} />
              <span className="mk-delta"><span className={`sq-ovr ${ovrClass(p.ovr)}`}>{p.ovr}</span>{dOvr !== 0 && <small style={{ color: dOvr > 0 ? 'var(--success)' : 'var(--danger)' }}>{dOvr > 0 ? '+' : ''}{dOvr}</small>}</span>
              <span className="mk-delta mk-hide-m"><span className="sq-num">{moneyShort(value)}</span>{dVal !== 0 && <small style={{ color: dVal > 0 ? 'var(--success)' : 'var(--danger)' }}>{dVal > 0 ? '+' : ''}{dVal}%</small>}</span>
              <span className="mk-acts">
                <button type="button" className="mk-icon-btn mk-watch-on" onClick={() => onToggleShortlist(s.clubId, s.playerName)} aria-label={`Deixar de observar ${p.name}`} title="Deixar de observar"><Icon name="close" size={15} /></button>
                {row && <button type="button" className={`mk-act${open ? ' mk-act-on' : ''}`} onClick={() => setOpenKey(open ? null : key)} aria-expanded={open}>{open ? 'Fechar' : 'Propor'}</button>}
              </span>
            </div>
            {open && row && (
              <div className="mk-prop-wrap">
                <div className="mk-sheet-bg" onClick={() => setOpenKey(null)} aria-hidden="true" />
                <div className="mk-prop-sheet">
                  <div className="mk-sheet-head"><b>{p.name}</b><button type="button" className="ui-modal-close" style={{ position: 'static' }} onClick={() => setOpenKey(null)} aria-label="Fechar proposta"><Icon name="close" size={18} /></button></div>
                  <ProposePanel save={save} row={row} {...panelProps} onDone={() => setOpenKey(null)} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Lateral ────────────────────────────────────────────────────────────
function SideColumn({ save, onSeekPos, onOpenHistory }) {
  const roster = save.clubs[save.myClubId].roster.filter(p => !p.inAcademy);
  const { thin, veterans } = squadNeeds(roster);
  const log = myLog(save);
  const season = log.filter(e => e.season === save.season);
  const sells = season.filter(e => e.type === 'user-sell');
  const buys = season.filter(e => e.type === 'user-buy');
  const sellT = sells.reduce((s, e) => s + (e.amount || 0), 0);
  const buyT = buys.reduce((s, e) => s + (e.amount || 0), 0);
  const recent = log.slice(-4).reverse();
  return (
    <div className="mk-side">
      <div className="ch-card" style={{ overflow: 'hidden' }}>
        <div className="ch-head"><h3>Carências</h3></div>
        {thin.length === 0 && veterans.length === 0 && <div className="ch-empty">Elenco sem posição carente.</div>}
        {thin.map(d => (
          <div key={d.id} className="mk-need">
            <span className="mk-k">{d.id}</span>
            <div style={{ minWidth: 0, flex: 1 }}><b>{d.count === 0 ? 'Nenhum jogador' : 'Só 1 jogador'}</b><small>{d.best ? `Melhor: ${d.best.name}, ${d.best.ovr}${(save.transferList || []).includes(d.best.name) ? ' (na lista)' : ''}` : 'Posição descoberta'}</small></div>
            <button type="button" className="ch-link" onClick={() => onSeekPos(d.pos)}>Buscar</button>
          </div>
        ))}
        {veterans.length > 0 && (
          <div className="mk-need">
            <span className="mk-k mk-k-mute">32+</span>
            <div style={{ minWidth: 0, flex: 1 }}><b>{veterans.length} jogador{veterans.length > 1 ? 'es' : ''} veterano{veterans.length > 1 ? 's' : ''}</b><small className="cf-ell">{veterans.slice(0, 3).map(p => p.name).join(', ')}{veterans.length > 3 ? '…' : ''}</small></div>
          </div>
        )}
      </div>
      <div className="ch-card">
        <div className="ch-head"><h3>Balanço da temporada</h3></div>
        <div className="mk-bal">
          <div className="ch-row"><span>Vendas · {sells.length}</span><b style={{ color: 'var(--success)' }}>+ {moneyShort(sellT)}</b></div>
          <div className="ch-row"><span>Compras · {buys.length}</span><b style={{ color: 'var(--danger)' }}>− {moneyShort(buyT)}</b></div>
          <div className="ch-row"><span><b style={{ fontFamily: 'var(--font-body)' }}>Saldo</b></span><b style={{ color: sellT - buyT >= 0 ? 'var(--success)' : 'var(--danger)' }}>{sellT - buyT >= 0 ? '+ ' : '− '}{moneyShort(Math.abs(sellT - buyT))}</b></div>
        </div>
      </div>
      <div className="ch-card" style={{ overflow: 'hidden' }}>
        <div className="ch-head"><h3>Movimentações</h3><button type="button" className="ch-link" onClick={onOpenHistory}>Histórico</button></div>
        {recent.length === 0 && <div className="ch-empty">Nenhuma movimentação ainda.</div>}
        {recent.map((e, i) => {
          const incoming = e.toClubId === save.myClubId;
          const other = clubOf(incoming ? e.fromClubId : e.toClubId);
          const sign = e.type === 'user-buy' ? -1 : e.type === 'user-sell' ? 1 : 0;
          return (
            <div key={i} className="mk-hist">
              <span className={`mk-ar ${incoming ? 'mk-in' : 'mk-out'}`} aria-label={incoming ? 'entrada' : 'saída'}><Icon name="arrowRight" size={14} style={{ transform: `rotate(${incoming ? 135 : -45}deg)` }} /></span>
              <div style={{ minWidth: 0, flex: 1 }}><b className="cf-ell">{e.playerName}</b><small>{e.type === 'retired' ? 'aposentou' : `${incoming ? 'do' : 'para o'} ${displayName(other?.club)}`} · dia {e.day ?? '—'}</small></div>
              <span className="mk-v" style={{ color: sign > 0 ? 'var(--success)' : sign < 0 ? 'var(--danger)' : 'var(--muted)' }}>{sign ? `${sign > 0 ? '+' : '−'}${moneyShort(e.amount).replace('R$ ', '')}` : HIST_TYPES[e.type]?.label || ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tela ───────────────────────────────────────────────────────────────
export function CareerTransferMarket({ save, onPropose, onRespondOffer, onCounterOffer, onToggleListed, onToggleLoanList, onRequestLoan, onToggleShortlist, onQueueProposal, onCancelQueued }) {
  const [tab, setTab] = useState(save.pendingOffers?.length ? 'offers' : 'buy');
  const [club, setClub] = useState(null);
  const [f, setF] = useState(EMPTY_F);
  const [clubF, setClubF] = useState(EMPTY_F);
  const [sort, setSort] = useState('value-for-money');
  const [toast, setToast] = useState(null);
  const [howOpen, setHowOpen] = useState(false);
  const toastTimer = useRef(null);
  const notify = (t) => { setToast(t); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 4000); };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const team = clubOf(save.myClubId);
  const myRoster = save.clubs[save.myClubId].roster.filter(p => !p.inAcademy);
  const budget = save.clubs[save.myClubId].budget;

  // Todos os jogadores de outros clubes, com valor, "na lista do clube"
  // (decideAiListings, mesma regra que a IA usa) e chance de empréstimo.
  const { allRows, clubStats } = useMemo(() => {
    const rows = [];
    const stats = {};
    for (const id of CAREER_CLUB_IDS) {
      if (id === save.myClubId) continue;
      const roster = save.clubs[id].roster.filter(p => !p.inAcademy);
      const listed = new Set(decideAiListings(roster));
      let valueSum = 0;
      for (const p of roster) {
        const value = computePlayerValue(p, id);
        valueSum += value;
        rows.push({ p, clubId: id, value, listed: listed.has(p.name), loanChance: loanOutWillingness(roster, p), division: save.clubs[id].division });
      }
      stats[id] = { strength: roster.length ? Math.round(roster.reduce((s, p) => s + p.ovr, 0) / roster.length) : 0, value: valueSum, listed: listed.size };
    }
    return { allRows: rows, clubStats: stats };
  }, [save.clubs, save.myClubId]);

  const needPos = useMemo(() => {
    const { thin } = squadNeeds(myRoster);
    return new Set(thin.flatMap(d => d.pos));
  }, [myRoster]);

  const log = myLog(save).filter(e => e.season === save.season);
  const windowBalance = log.reduce((s, e) => s + (e.type === 'user-sell' ? e.amount || 0 : e.type === 'user-buy' ? -(e.amount || 0) : 0), 0);
  const listedCount = (save.transferList || []).filter(n => myRoster.some(p => p.name === n)).length;
  const offerCount = save.pendingOffers?.length || 0;
  const shortCount = (save.shortlist || []).length;

  const panelProps = { onPropose, onRequestLoan, onQueue: onQueueProposal, onCancelQueued, notify };
  const tabs = [
    { id: 'buy', label: 'Contratar', icon: 'search' },
    { id: 'mine', label: 'Meu elenco', icon: 'shirt', badge: listedCount ? `${listedCount} listado${listedCount > 1 ? 's' : ''}` : null },
    { id: 'offers', label: 'Propostas', icon: 'chat', badge: String(offerCount), hot: offerCount > 0 },
    { id: 'clubs', label: 'Clubes', icon: 'cup' },
    { id: 'history', label: 'Histórico', icon: 'calendar' },
    { id: 'watch', label: 'Observados', icon: 'eye', badge: shortCount ? String(shortCount) : null, hot: shortCount > 0 },
  ];
  const seekPos = (positions) => { setF({ ...EMPTY_F, pos: positions }); setTab('buy'); setClub(null); };

  return (
    <div className="ch-main mk-main">
      <div className="mk-ph">
        <div style={{ minWidth: 0 }}>
          <span className="ch-mono">{displayName(team.club)} · Temporada {save.season} · {longDate(save.calendarDay)}</span>
          <h1>Mercado</h1>
        </div>
        <div className="mk-budget">
          <div><small>Orçamento</small><b>{moneyShort(budget)}</b></div>
          <div><small>Saldo na temporada</small><b style={{ color: windowBalance > 0 ? 'var(--success)' : windowBalance < 0 ? 'var(--danger)' : undefined }}>{windowBalance > 0 ? '+ ' : windowBalance < 0 ? '− ' : ''}{moneyShort(Math.abs(windowBalance))}</b></div>
          <div><small>Elenco</small><b>{myRoster.length} <span className="ch-small" style={{ fontFamily: 'var(--font-body)' }}>mín. {MIN_SQUAD_SIZE}</span></b></div>
        </div>
      </div>

      <WindowCard day={save.calendarDay} />

      <div className="mk-tabs-row">
        <div className="mk-tabs" role="tablist" aria-label="Seções do mercado">
          {tabs.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'mk-on' : ''} onClick={() => { setTab(t.id); setClub(null); }}>
              <Icon name={t.icon} size={16} />{t.label}{t.badge && <em className={t.hot ? 'mk-hot' : ''}>{t.badge}</em>}
            </button>
          ))}
        </div>
        <span className="mk-how-wrap">
          <button type="button" className="ch-link" onClick={() => setHowOpen(o => !o)} aria-expanded={howOpen}><Icon name="info" size={15} /> Como funciona</button>
          {howOpen && (
            <span className="mk-how" role="dialog" aria-label="Como funciona o mercado">
              <b>Comprar:</b> o clube vendedor decide. Abaixo de 60% do valor de mercado ele nunca aceita; a partir do valor cheio, sempre aceita.<br />
              <b>Vender:</b> não existe venda direta. Coloque o jogador na lista de venda (+50% de chance de proposta) e responda na aba Propostas.<br />
              <b>Emprestar:</b> funciona igual, pela lista de empréstimo; a duração vem na proposta.<br />
              <b>Janela fechada:</b> dá para agendar propostas; elas são enviadas no dia em que a janela abrir.
              <button type="button" className="ch-link" style={{ display: 'block', marginTop: 6 }} onClick={() => setHowOpen(false)}>Fechar</button>
            </span>
          )}
        </span>
      </div>

      <div className="mk-lay">
        <div className="mk-col" style={{ minWidth: 0 }}>
          {tab === 'buy' && <SearchTable save={save} allRows={allRows} f={f} setF={setF} sort={sort} setSort={setSort} needPos={needPos} panelProps={panelProps} onToggleShortlist={onToggleShortlist} />}
          {tab === 'mine' && <MyRosterTab save={save} onToggleListed={onToggleListed} onToggleLoanList={onToggleLoanList} />}
          {tab === 'offers' && <OffersTab save={save} onRespond={onRespondOffer} onCounterOffer={onCounterOffer} notify={notify} goMine={() => setTab('mine')} onCancelQueued={onCancelQueued} />}
          {tab === 'clubs' && !club && <ClubsTab save={save} clubStats={clubStats} onOpenClub={(id) => { setClub(id); setClubF(EMPTY_F); }} />}
          {tab === 'clubs' && club && (
            <>
              <div className="ch-card mk-clubhead">
                <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setClub(null)}><Icon name="arrowLeft" size={15} />Clubes</button>
                <Crest clubId={club} size={44} />
                <div style={{ minWidth: 0 }}><h2>{displayName(clubOf(club).club)}</h2><span className="ch-small">Série {save.clubs[club].division} · força {clubStats[club].strength} · {moneyShort(clubStats[club].value)} · {clubStats[club].listed} na lista</span></div>
              </div>
              <SearchTable save={save} allRows={allRows} fixedClub={club} f={clubF} setF={setClubF} sort={sort} setSort={setSort} needPos={needPos} panelProps={panelProps} onToggleShortlist={onToggleShortlist} />
            </>
          )}
          {tab === 'history' && <HistoryTab save={save} />}
          {tab === 'watch' && <ShortlistTab save={save} allRows={allRows} onToggleShortlist={onToggleShortlist} panelProps={panelProps} />}
        </div>
        <SideColumn save={save} onSeekPos={seekPos} onOpenHistory={() => { setTab('history'); setClub(null); }} />
      </div>
      <Toast toast={toast} />
    </div>
  );
}
