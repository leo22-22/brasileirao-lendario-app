// Elenco do Modo Carreira — redesenho de 2026-11-13 seguindo o mockup
// modo-carreira-elenco-mockup.html: cabeçalho com Lista/Cards e atalhos,
// 5 KPIs, profundidade por posição, destaques da temporada, tabela
// agrupada por setor e painel de detalhes do jogador selecionado.
//
// Mesma lógica de antes (busca com normalize, filtro por setor, Lista/
// Cards, detalhes, lista de transferências via onToggleListed, valor por
// computePlayerValue, idade/potencial/isYouth/isStar). Só dado real: sem
// pé preferencial, moral individual, contrato ou salário (o motor não tem).
import { useEffect, useMemo, useRef, useState } from 'react';
import { posOrderIndex, posSector } from '../../lib/format.js';
import { computePlayerValue } from '../engine/pricing.js';
import { playerSeasonStats } from '../engine/seasonStats.js';
import { transferWindowText } from '../engine/careerMeta.js';
import { squadDepth, DEPTH_GROUPS, VETERAN_AGE } from '../engine/squadDepth.js';
import { TEAMS } from '../../data/teams.js';
import { displayName } from '../../lib/displayName.js';
import { Icon } from '../../ui/index.jsx';
import '../components/careerShell.css';
import './careerSquad.css';

const YELLOWS_FOR_SUSPENSION = 3; // mesmo valor de seasonEngine.js

const SECTORS = [
  { id: 'all', label: 'Todos' },
  { id: 'gk', label: 'Goleiros' },
  { id: 'df', label: 'Defesa' },
  { id: 'md', label: 'Meio' },
  { id: 'at', label: 'Ataque' },
];
const SECTOR_GROUP = { gk: 'Goleiros', df: 'Defesa', md: 'Meio-campo', at: 'Ataque' };
const SECTOR_DOT = { gk: '#B08A3E', df: '#3F74AE', md: '#2F8A5E', at: '#C2513F' };
const SECTOR_ORDER = ['gk', 'df', 'md', 'at'];
const POS_NAME = {
  GOL: 'Goleiro', ZAG: 'Zagueiro', LD: 'Lateral-direito', LE: 'Lateral-esquerdo', VOL: 'Volante', MC: 'Meio-campista',
  MD: 'Meia-direita', ME: 'Meia-esquerda', MEI: 'Meia ofensivo', PD: 'Ponta-direita', PE: 'Ponta-esquerda', ATA: 'Atacante',
};
const SORTS = [
  { id: 'ovr', label: 'OVR' }, { id: 'age', label: 'Idade' }, { id: 'value', label: 'Valor' },
  { id: 'potential', label: 'Potencial' }, { id: 'goals', label: 'Gols' }, { id: 'matches', label: 'Jogos' },
];

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function formatMoneyShort(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `R$ ${(n / 1_000_000_000).toFixed(1).replace('.', ',')}B`;
  if (abs >= 10_000_000) return `R$ ${Math.round(n / 1_000_000)}M`;
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `R$ ${Math.round(n / 1_000)}K`;
  return `R$ ${n}`;
}
const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
const ovrClass = (o) => (o >= 85 ? 'sq-o-hi' : o >= 80 ? 'sq-o-md' : 'sq-o-lo');

// Nota de evolução — só as faixas que o próprio motor usa no fim de
// temporada (applySeasonAging em aging.js), sem regra nova.
function evolutionNote(p) {
  if (p.age == null) return null;
  if (p.isYouth && p.potential != null && p.ovr < p.potential) return { text: `em evolução · +${p.growthPerSeason || 0} por temporada até ${p.potential}`, tone: 'up' };
  const next = p.age + 1;
  if (next <= 23) return { text: 'pode evoluir — quanto mais joga, mais chance', tone: 'up' };
  if (next >= 34) return { text: `tende a cair após os ${Math.max(34, p.age)}`, tone: 'down' };
  if (next >= 30) return { text: 'pode perder 1 ponto por temporada', tone: 'down' };
  return { text: 'estável', tone: 'flat' };
}

function PosChip({ pos, small }) {
  return <span className={`sq-pos sq-${posSector(pos)}${small ? ' sq-pos-sm' : ''}`}>{pos}</span>;
}

function Tags({ tags }) {
  return tags.map(t => <span key={t.id} className={`sq-tg sq-tg-${t.id}`}>{t.label}</span>);
}

function RowMenu({ open, onToggle, onClose, items, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  return (
    <span className="sq-more-wrap" ref={ref} onClick={e => e.stopPropagation()}>
      <button type="button" className="sq-more" aria-haspopup="menu" aria-expanded={open} aria-label={`Ações para ${label}`} onClick={onToggle}>⋯</button>
      {open && (
        <span className="sq-menu" role="menu">
          {items.map(it => (
            <button key={it.label} type="button" role="menuitem" onClick={() => { it.run(); onClose(); }} autoFocus={it === items[0]}>{it.label}</button>
          ))}
        </span>
      )}
    </span>
  );
}

function DetailPanel({ p, clubId, stats, tags, listed, loanListed, onToggleListed, onToggleLoanList, onOpenFormation, onClose, bestOvr }) {
  if (!p) return null;
  const value = computePlayerValue(p, clubId);
  const evo = evolutionNote(p);
  const hasPot = p.potential != null;
  const potText = !hasPot ? '—' : p.potential > p.ovr ? `até ${p.potential}` : 'Já no teto';
  const capTag = tags.find(t => t.id === 'cap');
  const headTags = tags.filter(t => t.id !== 'cap');
  if (p.ovr === bestOvr) headTags.push({ id: 'best', label: 'Melhor OVR' });
  return (
    <>
      <div className="sq-dr-top on-dark">
        <span className="sq-ring" aria-hidden="true" />
        <div className="ch-row" style={{ alignItems: 'flex-start', position: 'relative' }}>
          <span className="sq-bigo">{p.ovr}</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {capTag && <span className="ch-tag" style={{ background: 'var(--gold)', color: '#fff' }}>Capitão</span>}
            {onClose && <button type="button" className="sq-dr-close" onClick={onClose} aria-label="Fechar detalhes"><Icon name="close" size={18} /></button>}
          </span>
        </div>
        <h2>{p.name}</h2>
        <div className="sq-sub">{p.age != null ? `${p.age} anos · ` : ''}{POS_NAME[p.pos[0]] || p.pos[0]}</div>
        {headTags.length > 0 && <div className="sq-dr-tags">{headTags.map(t => <span key={t.id}>{t.label}</span>)}</div>}
      </div>
      <div className="sq-facts">
        <div><small>Valor</small><b>{formatMoneyShort(value)}</b></div>
        <div><small>Potencial</small><b style={hasPot && p.potential > p.ovr ? { color: 'var(--success)' } : undefined}>{potText}</b></div>
        <div><small>Jogos</small><b>{stats.matches}</b></div>
        <div><small>{p.pos[0] === 'GOL' ? 'Sem sofrer gol' : 'Gols · Assist.'}</small><b>{p.pos[0] === 'GOL' ? stats.cleanSheets : `${stats.goals} · ${stats.assists}`}</b></div>
      </div>
      <div className="sq-dsec">
        <h4>Posições</h4>
        <div className="sq-posmap">{p.pos.map(x => <PosChip key={x} pos={x} />)}</div>
      </div>
      {evo && (
        <div className="sq-dsec">
          <h4>Evolução</h4>
          <div className="ch-row" style={{ fontSize: 12.5, marginBottom: 6 }}><span>OVR atual {p.ovr}</span><span className="ch-small" style={{ color: evo.tone === 'up' ? 'var(--success)' : undefined }}>{evo.text}</span></div>
          <div className="sq-potbar">
            {hasPot && p.potential > p.ovr && <i style={{ width: `${p.potential}%`, background: 'var(--gold-soft)' }} />}
            <i style={{ width: `${p.ovr}%`, background: evo.tone === 'up' ? 'var(--success)' : 'var(--gold)' }} />
          </div>
        </div>
      )}
      <div className="sq-drbtns">
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-md ui-btn-block" onClick={onOpenFormation}><Icon name="formation" size={17} />Ver na formação</button>
        <button type="button" className={`ui-btn ui-btn-md ui-btn-block ${listed ? 'ui-btn-danger' : 'ui-btn-ghost'}`} onClick={onToggleListed}><Icon name="market" size={17} />{listed ? 'Tirar da lista de venda' : 'Listar para venda'}</button>
        {onToggleLoanList && (
          <button type="button" className={`ui-btn ui-btn-md ui-btn-block ${loanListed ? 'ui-btn-danger' : 'ui-btn-ghost'}`} onClick={onToggleLoanList}><Icon name="loan" size={17} />{loanListed ? 'Tirar da lista de empréstimo' : 'Listar para empréstimo'}</button>
        )}
      </div>
    </>
  );
}

export function CareerSquadScreen({ save, onToggleListed, onToggleLoanList, onOpenFormation, onOpenMarket }) {
  const clubId = save.myClubId;
  const team = TEAMS.find(t => t.id === clubId);
  const fullRoster = save.clubs[clubId].roster;
  // Jogador da base continua fora daqui (tela própria, CareerYouthScreen).
  const roster = useMemo(() => fullRoster.filter(p => !p.inAcademy), [fullRoster]);
  const transferList = save.transferList || [];
  const loanList = save.loanList || [];
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('all');
  const [posFilter, setPosFilter] = useState(null); // id do bloco de profundidade
  const [sortBy, setSortBy] = useState('ovr');
  const [view, setView] = useState('table'); // 'table' | 'cards'
  const [selectedName, setSelectedName] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuFor, setMenuFor] = useState(null);

  const starters = new Set(save.myStarters || []);
  const bench = new Set(save.myBench || []);
  const statsOf = (p) => playerSeasonStats(save.seasonPlayerStats, clubId, p.name);
  const valueOf = (p) => computePlayerValue(p, clubId);
  const hanging = (name) => (save.cardTally?.[name] || 0) >= YELLOWS_FOR_SUSPENSION - 1;

  const tagsOf = (p) => {
    const t = [];
    if (save.myCaptain === p.name) t.push({ id: 'cap', label: 'Capitão' });
    else if (starters.has(p.name)) t.push({ id: 'tit', label: 'Titular' });
    if ((save.suspensions?.[p.name] || 0) > 0) t.push({ id: 'susp', label: 'Suspenso' });
    else if (hanging(p.name)) t.push({ id: 'yel', label: 'Pendurado' });
    if (transferList.includes(p.name)) t.push({ id: 'lst', label: 'Na lista' });
    if (loanList.includes(p.name)) t.push({ id: 'llst', label: 'Lista de empréstimo' });
    if (p.onLoanFrom && p.onLoanFrom !== clubId) t.push({ id: 'loan', label: 'Emprestado' });
    if (p.isStar) t.push({ id: 'star', label: 'Joia' });
    if (p.isYouth) t.push({ id: 'base', label: 'Base' });
    return t;
  };

  // ── KPIs ──
  const n = roster.length;
  const nStart = roster.filter(p => starters.has(p.name)).length;
  const nBench = roster.filter(p => bench.has(p.name) && !starters.has(p.name)).length;
  const avgOvr = n ? roster.reduce((s, p) => s + p.ovr, 0) / n : 0;
  const startersList = roster.filter(p => starters.has(p.name));
  const avgStart = startersList.length ? startersList.reduce((s, p) => s + p.ovr, 0) / startersList.length : null;
  const squadValue = roster.reduce((s, p) => s + valueOf(p), 0);
  const withAge = roster.filter(p => p.age != null);
  const avgAge = withAge.length ? withAge.reduce((s, p) => s + p.age, 0) / withAge.length : null;
  const veterans = withAge.filter(p => p.age >= VETERAN_AGE).length;
  const listedCount = roster.filter(p => transferList.includes(p.name)).length;
  const loanListedCount = roster.filter(p => loanList.includes(p.name)).length;
  const loanedIn = roster.filter(p => p.onLoanFrom && p.onLoanFrom !== clubId).length;
  const academyCount = fullRoster.filter(p => p.inAcademy).length;
  const windowInfo = transferWindowText(save.calendarDay);

  // ── Profundidade ──
  const depth = squadDepth(roster).map(d => ({ ...d, best: d.bestOvr }));

  // ── Destaques ──
  const statRows = roster.map(p => ({ p, s: statsOf(p) }));
  const top = (key, filter = () => true) => statRows.filter(x => filter(x.p) && x.s[key] > 0).sort((a, b) => b.s[key] - a.s[key] || b.p.ovr - a.p.ovr)[0] || null;
  const leaders = [
    { key: 'goals', label: 'Artilheiro · gols', row: top('goals') },
    { key: 'assists', label: 'Garçom · assistências', row: top('assists') },
    { key: 'matches', label: 'Mais jogos', row: top('matches') },
    { key: 'cleanSheets', label: 'Jogos sem sofrer gol', row: top('cleanSheets', p => p.pos[0] === 'GOL') },
  ];
  const anyGames = statRows.some(x => x.s.matches > 0);

  // ── Filtro, ordenação e grupos ──
  const q = normalize(query.trim());
  const depthDef = posFilter ? DEPTH_GROUPS.find(d => d.id === posFilter) : null;
  const filtered = roster
    .filter(p => !q || normalize(p.name).includes(q))
    .filter(p => sector === 'all' || posSector(p.pos[0]) === sector)
    .filter(p => !depthDef || depthDef.pos.includes(p.pos[0]));
  const sortKey = {
    ovr: p => p.ovr, age: p => p.age ?? -1, value: p => valueOf(p), potential: p => p.potential ?? p.ovr,
    goals: p => statsOf(p).goals, matches: p => statsOf(p).matches,
  }[sortBy];
  const sorted = [...filtered].sort((a, b) => sortKey(b) - sortKey(a) || posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]) || b.ovr - a.ovr);
  const groups = SECTOR_ORDER.map(s => ({ s, players: sorted.filter(p => posSector(p.pos[0]) === s) })).filter(g => g.players.length);
  const sectorCount = (id) => (id === 'all' ? roster.length : roster.filter(p => posSector(p.pos[0]) === id).length);

  // Primeiro jogador selecionado por padrão (o primeiro da lista atual).
  const flat = groups.flatMap(g => g.players);
  const selected = roster.find(p => p.name === selectedName) || flat[0] || null;
  const bestOvr = n ? Math.max(...roster.map(p => p.ovr)) : 0;

  const select = (name) => { setSelectedName(name); setDrawerOpen(true); };
  const menuItems = (p) => [
    { label: 'Ver detalhes', run: () => select(p.name) },
    { label: transferList.includes(p.name) ? 'Tirar da lista de venda' : 'Listar para venda', run: () => onToggleListed(p.name) },
    ...(onToggleLoanList ? [{ label: loanList.includes(p.name) ? 'Tirar da lista de empréstimo' : 'Listar para empréstimo', run: () => onToggleLoanList(p.name) }] : []),
  ];

  const detailProps = selected ? {
    p: selected, clubId, stats: statsOf(selected), tags: tagsOf(selected), bestOvr,
    listed: transferList.includes(selected.name), loanListed: loanList.includes(selected.name),
    onToggleListed: () => onToggleListed(selected.name),
    onToggleLoanList: onToggleLoanList ? () => onToggleLoanList(selected.name) : null,
    onOpenFormation,
  } : null;

  return (
    <div className="ch-main sq-main">
      {/* ── Cabeçalho ── */}
      <div className="sq-ph">
        <div style={{ minWidth: 0 }}>
          <span className="ch-mono">{displayName(team.club)} · Temporada {save.season} · {windowInfo.text.toLowerCase()}</span>
          <h1>Elenco</h1>
        </div>
        <div className="sq-acts">
          <div className="cf-seg" role="tablist" aria-label="Visualização">
            <button type="button" role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'cf-on' : ''} onClick={() => setView('table')}><Icon name="list" size={15} /> Lista</button>
            <button type="button" role="tab" aria-selected={view === 'cards'} className={view === 'cards' ? 'cf-on' : ''} onClick={() => setView('cards')}><Icon name="grid" size={15} /> Cards</button>
          </div>
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-md" onClick={onOpenFormation}><Icon name="formation" size={17} />Abrir formação</button>
          <button type="button" className="ui-btn ui-btn-dark ui-btn-md" onClick={onOpenMarket}><Icon name="market" size={17} />Ir ao mercado</button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <section className="ch-kpis" aria-label="Resumo do elenco">
        <div className="ch-card ch-kpi"><span className="ch-mono">Jogadores</span><b>{n}</b><span className="ch-d">{nStart} titulares · {nBench} banco · {n - nStart - nBench} fora</span></div>
        <div className="ch-card ch-kpi"><span className="ch-mono">OVR médio</span><b>{fmt1(avgOvr)}</b><span className="ch-d">{avgStart != null ? `Titulares ${fmt1(avgStart)}` : 'Sem titulares definidos'}</span></div>
        <div className="ch-card ch-kpi"><span className="ch-mono">Valor do elenco</span><b>{formatMoneyShort(squadValue)}</b><span className="ch-d">Soma do valor de mercado</span></div>
        <div className="ch-card ch-kpi"><span className="ch-mono">Idade média</span><b>{avgAge != null ? fmt1(avgAge) : '—'}</b><span className="ch-d">{veterans} jogador{veterans === 1 ? '' : 'es'} com 32+</span></div>
        <div className="ch-card ch-kpi"><span className="ch-mono">Na lista</span><b>{listedCount}</b><span className="ch-d">{loanListedCount} p/ empréstimo · {loanedIn ? `${loanedIn} emprestado${loanedIn > 1 ? 's' : ''} · ` : ''}{academyCount} na base</span></div>
      </section>

      {/* ── Insights ── */}
      <section className="sq-ins">
        <div className="ch-card">
          <div className="ch-head">
            <h3>Profundidade por posição</h3>
            <span className="ch-small">{posFilter ? <button type="button" className="ch-link" onClick={() => setPosFilter(null)}>Limpar filtro {posFilter}</button> : 'bolinha = jogador · número = melhor OVR'}</span>
          </div>
          <div className="sq-depth">
            {depth.map(d => (
              <button
                key={d.id}
                type="button"
                className={`sq-dp${d.count <= 1 ? ' sq-thin' : ''}${posFilter === d.id ? ' sq-dp-on' : ''}`}
                onClick={() => { setPosFilter(prev => (prev === d.id ? null : d.id)); setSector('all'); }}
                aria-pressed={posFilter === d.id}
                aria-label={`${d.id}: ${d.count} jogador${d.count === 1 ? '' : 'es'}${d.best != null ? `, melhor OVR ${d.best}` : ''}${d.count <= 1 ? ', posição carente' : ''}`}
              >
                <span className="sq-ps">{d.label || d.id}</span>
                <b>{d.best ?? '—'}</b>
                <small>{d.count} jog.</small>
                <span className="sq-dots" aria-hidden="true">{Array.from({ length: Math.min(6, Math.max(1, d.count)) }).map((_, i) => <i key={i} className={i < d.count ? 'sq-on' : ''} />)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ch-card">
          <div className="ch-head"><h3>Destaques da temporada</h3></div>
          {!anyGames ? (
            <div className="ch-empty">Os destaques aparecem depois da primeira rodada.</div>
          ) : (
            <div className="sq-lead">
              {leaders.map(l => (
                <button key={l.key} type="button" className="sq-ld" disabled={!l.row} onClick={() => l.row && select(l.row.p.name)}>
                  <span className="sq-v">{l.row ? l.row.s[l.key] : '—'}</span>
                  <span style={{ minWidth: 0 }}><b className="cf-ell">{l.row ? l.row.p.name : 'Ninguém ainda'}</b><small>{l.label}</small></span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Tabela + painel ── */}
      <section className="sq-split">
        <div className="ch-card" style={{ overflow: 'visible' }}>
          <div className="sq-tb">
            <label className="sq-search">
              <Icon name="search" size={16} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar jogador…" aria-label="Buscar jogador pelo nome" />
            </label>
            {SECTORS.map(s => (
              <button key={s.id} type="button" className={`ch-chip${sector === s.id && !posFilter ? ' ch-on' : ''}`} onClick={() => { setSector(s.id); setPosFilter(null); }} aria-pressed={sector === s.id && !posFilter}>
                {s.label} <em>{sectorCount(s.id)}</em>
              </button>
            ))}
            <label className="sq-sort">
              <span className="sr-only">Ordenar por</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Ordenar por">
                {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {groups.length === 0 && <div className="ch-empty">Nenhum jogador encontrado com esse filtro.</div>}

          {view === 'table' ? (
            <div role="listbox" aria-label="Jogadores do elenco">
              <div className="sq-th" aria-hidden="true"><span>Pos</span><span>Jogador</span><span className="r">Idade</span><span>Potencial</span><span className="r">J</span><span className="r">G</span><span className="r">A</span><span className="r">Valor</span><span className="r">OVR</span><span /></div>
              {groups.map(g => (
                <div key={g.s} role="group" aria-label={`${SECTOR_GROUP[g.s]}, ${g.players.length}`}>
                  <div className="sq-grp"><i style={{ background: SECTOR_DOT[g.s] }} />{SECTOR_GROUP[g.s]} · {g.players.length}</div>
                  {g.players.map(p => {
                    const s = statsOf(p);
                    const sel = selected?.name === p.name;
                    const hasPot = p.potential != null && p.potential > p.ovr;
                    return (
                      <div
                        key={p.name}
                        role="option"
                        aria-selected={sel}
                        tabIndex={0}
                        className={`sq-tr${sel ? ' sq-sel' : ''}`}
                        onClick={() => select(p.name)}
                        onKeyDown={e => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(p.name); } }}
                        aria-label={`${p.pos[0]}: ${p.name}, OVR ${p.ovr}`}
                      >
                        <PosChip pos={p.pos[0]} />
                        <span className="sq-nm"><span className="sq-nm-l"><b>{p.name}</b><Tags tags={tagsOf(p)} /></span><small>{p.pos.join(' · ')}</small></span>
                        <span className="sq-num sq-hide-m">{p.age ?? '—'}</span>
                        <span className="sq-pot sq-hide-m">
                          {p.potential == null ? <span className="ch-small">—</span> : (
                            <><span className="ch-bar" style={{ height: 6, flex: 1 }}><i style={{ width: `${hasPot ? Math.round((p.ovr / p.potential) * 100) : 100}%`, background: hasPot ? 'var(--green-2)' : 'var(--line-strong)' }} /></span>{hasPot ? p.potential : 'teto'}</>
                          )}
                        </span>
                        <span className="sq-num sq-hide-m">{s.matches}</span>
                        <span className="sq-num sq-hide-m">{s.goals}</span>
                        <span className="sq-num sq-hide-m">{s.assists}</span>
                        <span className="sq-num sq-hide-m">{formatMoneyShort(valueOf(p))}</span>
                        <span className={`sq-ovr ${ovrClass(p.ovr)}`}>{p.ovr}</span>
                        <RowMenu open={menuFor === p.name} onToggle={() => setMenuFor(m => (m === p.name ? null : p.name))} onClose={() => setMenuFor(null)} items={menuItems(p)} label={p.name} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="sq-cards" role="listbox" aria-label="Jogadores do elenco">
              {flat.map(p => {
                const sel = selected?.name === p.name;
                return (
                  <button key={p.name} type="button" role="option" aria-selected={sel} className={`sq-card${sel ? ' sq-sel' : ''}`} onClick={() => select(p.name)} aria-label={`${p.pos[0]}: ${p.name}, OVR ${p.ovr}`}>
                    <span className="ch-row"><PosChip pos={p.pos[0]} /><span className={`sq-ovr ${ovrClass(p.ovr)}`}>{p.ovr}</span></span>
                    <b className="cf-ell" style={{ marginTop: 10 }}>{p.name}</b>
                    <small className="ch-small">{p.age != null ? `${p.age} anos · ` : ''}{p.pos.join(' · ')}</small>
                    <span className="sq-card-tags"><Tags tags={tagsOf(p)} /></span>
                    <span className="sq-card-foot"><span>{formatMoneyShort(valueOf(p))}</span><span className="ch-small">{statsOf(p).matches} J · {statsOf(p).goals} G</span></span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="sq-foot"><span>Mostrando {flat.length} de {n}</span><span>Toque num jogador para ver os detalhes</span></div>
        </div>

        <aside className={`ch-card sq-dr${drawerOpen ? ' sq-dr-open' : ''}`} aria-label="Detalhes do jogador">
          {detailProps && <DetailPanel {...detailProps} onClose={() => setDrawerOpen(false)} />}
        </aside>
        {drawerOpen && <div className="sq-dr-bg" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
      </section>
    </div>
  );
}
