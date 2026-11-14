// Modal "Escolha um time histórico" (redesenho de 2026-11-13,
// jogo-time-pronto-mockup.html). Substitui o TeamPickerModal de App.jsx com
// as MESMAS props: onClose, onPick(team), onlyIds (Brasileirão Atual e
// multiplayer restringem aos 20 clubes de 2026) e title. Só escolhe o time —
// quem monta o elenco continua sendo o App (useReadyMadeSquad /
// startSerieAtual / multiUpdateMyTeam).
import { useEffect, useMemo, useRef, useState } from 'react';
import { TEAMS } from '../data/teams.js';
import { CLUB_LOGOS } from '../data/club-logos.js';
import { parseTeamLabel, posSector, posOrderIndex } from '../lib/format.js';
import { displayName } from '../lib/displayName.js';
import { teamStrength, autoFillSquadFromTeam, FORMATIONS } from '../App.jsx';
import { Icon, TeamBadge } from '../ui/index.jsx';
import './readyMadeTeam.css';

const PAGE = 30;
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Conquistas detectadas por palavra-chave no rótulo do time (normalizado).
const ACHIEVEMENTS = [
  { id: 'br', label: 'Campeões brasileiros', test: (l) => /(brasileir|taca brasil|robertao)/.test(l) && !/vice/.test(l) },
  { id: 'lib', label: 'Libertadores', test: (l) => /libertadores/.test(l) && !/vice da libertadores/.test(l) },
  { id: 'mun', label: 'Mundial', test: (l) => /(mundial|campeao do mundo)/.test(l) },
  { id: 'cdb', label: 'Copa do Brasil', test: (l) => /copa do brasil/.test(l) && !/vice da copa do brasil/.test(l) },
];
const ERAS = [
  { id: '50', label: '50', test: (y) => y < 1960 },
  { id: '60', label: '60', test: (y) => y >= 1960 && y < 1970 },
  { id: '70', label: '70', test: (y) => y >= 1970 && y < 1980 },
  { id: '80', label: '80', test: (y) => y >= 1980 && y < 1990 },
  { id: '90', label: '90', test: (y) => y >= 1990 && y < 2000 },
  { id: '2000', label: '2000', test: (y) => y >= 2000 && y < 2010 },
  { id: '2010', label: '2010', test: (y) => y >= 2010 && y < 2020 },
  { id: '2020', label: '2020+', test: (y) => y >= 2020 },
];

// OVR do time: média dos 11 melhores (teamStrength, a mesma conta do jogo).
function teamOvr(team) {
  const top = [...team.players].sort((a, b) => b.ovr - a.ovr).slice(0, 11);
  return teamStrength(Object.fromEntries(top.map((p, i) => [i, p])));
}

// Cores da faixa: primária/secundária do clube; se as duas forem quase
// iguais (ou faltarem), a secundária vira um tom mais escuro da primária.
function bandColors(team) {
  const p = team.colors?.p || '#0D3A29';
  let s = team.colors?.s || '';
  if (!s || s.toLowerCase() === p.toLowerCase()) s = shade(p, -0.25);
  return [p, s];
}
function shade(hex, amt) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (c) => Math.max(0, Math.min(255, Math.round(c + c * amt)));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

function sectorStrength(team) {
  const by = { at: [], md: [], df: [], gk: [] };
  team.players.forEach(p => by[posSector(p.pos[0])].push(p.ovr));
  const take = { at: 3, md: 4, df: 4, gk: 1 };
  const avg = (k) => {
    const arr = by[k].sort((a, b) => b - a).slice(0, take[k]);
    return arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : null;
  };
  return { at: avg('at'), md: avg('md'), df: avg('df'), gk: avg('gk') };
}

// multi: { max, initial: [ids], formats: [{ id, label, sub }], initialFormat, onConfirm(ids, format) }
// — seleção de vários times (Modo Livre). Sem `multi`, seleção única (onPick).
export function ReadyMadeTeamModal({ onClose, onPick, onlyIds = null, title, multi = null }) {
  const restricted = !!onlyIds;
  const base = useMemo(() => {
    const list = restricted ? TEAMS.filter(t => onlyIds.includes(t.id)) : TEAMS.filter(t => t.year !== 2026);
    return list.map(t => {
      const { baseName, achievement } = parseTeamLabel(t.label);
      return { team: t, baseName: displayName(baseName.replace(/\s+\d{4}$/, '')) || displayName(t.club), achievement, ovr: teamOvr(t), key: norm(`${t.label} ${t.club} ${t.year}`) };
    });
  }, [onlyIds, restricted]);

  const [query, setQuery] = useState('');
  const [era, setEra] = useState('all');
  const [club, setClub] = useState('all');
  const [ach, setAch] = useState(null);
  const [sort, setSort] = useState('recent');
  const [limit, setLimit] = useState(PAGE);
  const [selId, setSelId] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [picked, setPicked] = useState(() => new Set(multi?.initial || []));
  const [format, setFormat] = useState(() => (multi?.formats?.some(f => f.id === multi.initialFormat) ? multi.initialFormat : multi?.formats?.[0]?.id));
  const togglePick = (id) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else if (next.size < (multi?.max || Infinity)) next.add(id);
    return next;
  });
  const searchRef = useRef(null);

  useEffect(() => { searchRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { if (sheet) setSheet(false); else onClose?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sheet]);
  useEffect(() => { setLimit(PAGE); }, [query, era, club, ach, sort]);

  const clubs = useMemo(() => [...new Set(base.map(x => x.baseName))].sort((a, b) => a.localeCompare(b)), [base]);
  const erasShown = useMemo(() => ERAS.filter(e => base.some(x => e.test(x.team.year))), [base]);
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    let list = base.filter(x =>
      (!q || x.key.includes(q))
      && (era === 'all' || ERAS.find(e => e.id === era)?.test(x.team.year))
      && (club === 'all' || x.baseName === club)
      && (!ach || ACHIEVEMENTS.find(a => a.id === ach).test(norm(x.team.label))));
    list = [...list].sort((a, b) => (sort === 'old' ? a.team.year - b.team.year : sort === 'ovr' ? b.ovr - a.ovr : b.team.year - a.team.year) || b.ovr - a.ovr);
    return list;
  }, [base, query, era, club, ach, sort]);
  const shown = filtered.slice(0, limit);
  const sel = base.find(x => x.team.id === selId) || null;

  // Esquema que o atalho usaria (autoFillSquadFromTeam é puro: só calcula).
  // No Brasileirão Atual/multiplayer a formação é escolhida depois — não mostra.
  const selFormation = useMemo(() => {
    if (!sel || restricted) return null;
    const built = autoFillSquadFromTeam(sel.team);
    return built ? (FORMATIONS[built.formationKey]?.label.match(/^[\d-]+/)?.[0] || null) : null;
  }, [sel, restricted]);
  const selSectors = useMemo(() => (sel ? sectorStrength(sel.team) : null), [sel]);
  const selTop = useMemo(() => (sel ? [...sel.team.players].sort((a, b) => b.ovr - a.ovr || posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0])).slice(0, 4) : []), [sel]);

  const select = (id) => { if (multi) { togglePick(id); setSelId(id); return; } setSelId(id); setSheet(true); };
  const confirm = (x) => { if (multi) return; onPick((x || sel).team); };
  const heading = multi ? `Escolha ${multi.max} times` : title && title !== 'Escolha um time pronto' ? title : restricted ? 'Escolha seu clube' : 'Escolha um time histórico';
  const pickedList = multi ? base.filter(x => picked.has(x.team.id)) : [];
  const multiPanel = multi ? (
    <div className="rm-multi">
      <div className="rm-sec">
        <h4>Seleção · {picked.size} de {multi.max}</h4>
        <div className="rm-mcells" role="img" aria-label={`${picked.size} de ${multi.max} times escolhidos`}>
          {Array.from({ length: multi.max }, (_, i) => <i key={i} className={i < picked.size ? 'rm-mc-on' : undefined} />)}
        </div>
      </div>
      {multi.formats?.length > 1 && (
        <div className="rm-sec">
          <h4>Campeonato</h4>
          <div className="rm-fmt" role="radiogroup" aria-label="Campeonato">
            {multi.formats.map(f => (
              <button key={f.id} type="button" role="radio" aria-checked={format === f.id} className={`rm-fmt-b${format === f.id ? ' rm-on' : ''}`} onClick={() => setFormat(f.id)}>
                <b>{f.label}</b><small>{f.sub}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="rm-sec rm-msel">
        <h4>Escolhidos</h4>
        {pickedList.length === 0 && <p className="rm-small">Toque nos cards para escolher.</p>}
        {pickedList.map(x => (
          <button key={x.team.id} type="button" className="rm-mitem" onClick={() => togglePick(x.team.id)} aria-label={`Tirar ${x.baseName} ${x.team.year}`}>
            <span className="rm-ell">{x.baseName} {x.team.year}</span><Icon name="close" size={13} />
          </button>
        ))}
      </div>
      <div className="rm-pv-ft">
        <button type="button" className="rm-go" disabled={picked.size !== multi.max} onClick={() => multi.onConfirm([...picked], format)}>
          {picked.size === multi.max ? <>Confirmar {multi.max} times<Icon name="chevronRight" size={16} /></> : `Escolha mais ${multi.max - picked.size} (${picked.size}/${multi.max})`}
        </button>
      </div>
    </div>
  ) : null;

  const preview = sel ? (() => {
    const [p, s] = bandColors(sel.team);
    return (
      <>
        <div className="rm-pv-top" style={{ background: `linear-gradient(135deg, ${p} 0 55%, ${s} 55%)` }}>
          <span className="rm-pv-crest"><TeamBadge src={CLUB_LOGOS[sel.team.club]} name={sel.team.club} color={p} size={58} radius={29} /></span>
          <span className="rm-mono-l">Selecionado</span>
          <h3 id="rm-pv-h">{sel.baseName} {sel.team.year}</h3>
          <small>{[sel.achievement, sel.team.coach ? `técnico ${sel.team.coach}` : null].filter(Boolean).join(' · ')}</small>
        </div>
        <div className="rm-facts">
          <div><small>OVR</small><b>{Math.round(sel.ovr)}</b></div>
          <div><small>Elenco</small><b>{sel.team.players.length}</b></div>
          {selFormation && <div><small>Esquema</small><b className="rm-f-sm">{selFormation}</b></div>}
        </div>
        <div className="rm-sec">
          <h4>Força por setor</h4>
          <div className="rm-sbx">
            {[['at', 'ATA'], ['md', 'MEI'], ['df', 'DEF'], ['gk', 'GOL']].map(([k, l]) => <span key={k}><small>{l}</small><b>{selSectors[k] ?? '—'}</b></span>)}
          </div>
        </div>
        <div className="rm-sec">
          <h4>Destaques</h4>
          {selTop.map(pl => (
            <div key={pl.name} className="rm-pl">
              <span className={`rm-o${pl.ovr >= 85 ? '' : ' rm-o-m'}`}>{pl.ovr}</span><b className="rm-ell">{pl.name}</b>
              <span className={`rm-pos rm-p-${posSector(pl.pos[0])}`}>{pl.pos[0]}</span>
            </div>
          ))}
        </div>
        <div className="rm-pv-ft">
          <button type="button" className="rm-go" onClick={() => confirm()}>Jogar com o {sel.baseName} {sel.team.year}<Icon name="chevronRight" size={16} /></button>
        </div>
      </>
    );
  })() : (
    <div className="rm-pv-empty">
      <Icon name="shirt" size={26} />
      <p>Selecione um time para ver o elenco.</p>
    </div>
  );

  return (
    <div className="rm-overlay" onClick={onClose} role="presentation">
      <div className="rm-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="rm-h">
        {onClose && <button type="button" className="rm-x" onClick={onClose} aria-label="Fechar"><Icon name="close" size={16} /></button>}
        <div className="rm-lf">
          <div className="rm-mh">
            <span className="rm-mono">{multi ? 'Modo Livre · monte a sua liga' : restricted ? 'Brasileirão Atual · elencos reais de 2026' : 'Elenco pronto · pula o sorteio'}</span>
            <h2 id="rm-h">{heading}</h2>
            <p>{multi ? 'O seu elenco é montado no draft a partir destes times, que também formam a liga.' : restricted ? 'Você joga com o elenco real do clube e escolhe a formação depois.' : 'Você joga com o elenco completo do time. Dá para trocar a formação depois.'}</p>
          </div>
          <div className="rm-flt">
            <label className="rm-search">
              <Icon name="search" size={16} />
              <span className="sr-only">Buscar</span>
              <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder={restricted ? 'Buscar clube…' : 'Buscar por clube, ano ou conquista…'} />
            </label>
            {!restricted && (
              <div className="rm-row">
                <div className="rm-chips" role="group" aria-label="Era">
                  <button type="button" className={`rm-chip${era === 'all' ? ' rm-on' : ''}`} aria-pressed={era === 'all'} onClick={() => setEra('all')}>Todas as eras</button>
                  {erasShown.map(e => <button key={e.id} type="button" className={`rm-chip${era === e.id ? ' rm-on' : ''}`} aria-pressed={era === e.id} onClick={() => setEra(v => (v === e.id ? 'all' : e.id))}>{e.label}</button>)}
                </div>
                <label className="rm-sel" style={{ marginLeft: 'auto' }}>
                  <span className="sr-only">Clube</span>
                  <select value={club} onChange={e => setClub(e.target.value)}>
                    <option value="all">Clube: todos</option>
                    {clubs.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>
            )}
            <div className="rm-row">
              {!restricted && (
                <div className="rm-chips" role="group" aria-label="Conquista">
                  {ACHIEVEMENTS.map(a => <button key={a.id} type="button" className={`rm-chip${ach === a.id ? ' rm-on' : ''}`} aria-pressed={ach === a.id} onClick={() => setAch(v => (v === a.id ? null : a.id))}>{a.label}</button>)}
                </div>
              )}
              <label className="rm-sel" style={{ marginLeft: 'auto' }}>
                <span className="sr-only">Ordenar</span>
                <select value={sort} onChange={e => setSort(e.target.value)}>
                  <option value="recent">Mais recentes</option>
                  <option value="old">Mais antigos</option>
                  <option value="ovr">Maior OVR</option>
                </select>
              </label>
              <span className="rm-small" aria-live="polite">{filtered.length} time{filtered.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div className="rm-scroll">
            {filtered.length === 0 && <div className="rm-empty">Nenhum time encontrado.</div>}
            <div className="rm-grid">
              {shown.map(x => {
                const [p, s] = bandColors(x.team);
                const on = multi ? picked.has(x.team.id) : x.team.id === selId;
                return (
                  <button
                    key={x.team.id} type="button" className={`rm-tc${on ? ' rm-sel-on' : ''}`}
                    onClick={() => select(x.team.id)} onDoubleClick={() => confirm(x)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (on) confirm(x); else select(x.team.id); } }}
                    aria-pressed={on}
                    aria-label={`${x.baseName} ${x.team.year}${x.achievement ? `, ${x.achievement}` : ''}, OVR ${Math.round(x.ovr)}. ${on ? 'Enter para jogar' : 'Selecionar'}`}
                  >
                    <span className="rm-band" style={{ background: `linear-gradient(135deg, ${p} 0 55%, ${s} 55%)` }}>
                      <span className="rm-yr">{x.team.year}</span>
                      <span className="rm-ovr">{Math.round(x.ovr)}</span>
                    </span>
                    <span className="rm-bd">
                      <b className="rm-ell">{x.baseName}</b>
                      <small className="rm-ell">{x.achievement || (restricted ? 'Série A 2026' : '—')}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            {filtered.length > shown.length && (
              <div className="rm-more"><button type="button" className="rm-chip" onClick={() => setLimit(l => l + PAGE)}>Carregar mais ({filtered.length - shown.length})</button></div>
            )}
          </div>
        </div>
        {multi ? (
          <aside className="rm-pv rm-pv-multi" aria-label="Times escolhidos">{multiPanel}</aside>
        ) : (
          <aside className={`rm-pv${sel && sheet ? ' rm-pv-open' : ''}`} aria-labelledby={sel ? 'rm-pv-h' : undefined}>
            {sel && <button type="button" className="rm-sheet-x" onClick={() => setSheet(false)} aria-label="Fechar prévia"><Icon name="close" size={16} /></button>}
            {preview}
          </aside>
        )}
      </div>
    </div>
  );
}
