// Tabela do Modo Carreira — redesenho de 2026-11-13 seguindo
// modo-carreira-tabela-mockup.html. A classificação é recalculada dos
// placares salvos com a MESMA função do motor (engine/standings.js →
// applyRoundToTable), então os critérios de desempate não mudam. Zonas da
// Série A (getZoneInfo, com a vaga extra quando o campeão da Copa do
// Brasil já está no G4) e da Série B (acesso/playoff/rebaixamento) iguais
// às de antes.
import { useEffect, useMemo, useRef, useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { zoneFor as standingsZoneFor, ZONE_LEGEND } from '../../lib/standings.js';
import { standingsAfter, clubFormDetailed, nextFixtures } from '../engine/standings.js';
import { computeBoard } from '../engine/careerMeta.js';
import { displayName } from '../../lib/displayName.js';
import { Icon, Modal } from '../../ui/index.jsx';
import { StandingsTable, FormChips } from '../../components/football/StandingsTable.jsx';
import '../components/careerShell.css';
import './careerSquad.css';
import './careerTable.css';
import { ClubCrest } from '../../components/football/ClubCrest.jsx';

const clubOf = (id) => TEAMS.find(t => t.id === id);
const nameOf = (id) => displayName(clubOf(id)?.club || '');

// Zonas e legenda: lib/standings (Série B: acesso direto e mata-mata; não
// existe rebaixamento da Série B no motor).
const zoneFor = (division, pos, total, copaChampionInG4) => standingsZoneFor(division, pos, total, { copaChampionInG4 });
const LEGEND = ZONE_LEGEND;
const VIEWS = [
  { id: 'all', label: 'Geral' }, { id: 'home', label: 'Mandante' }, { id: 'away', label: 'Visitante' }, { id: 'last5', label: 'Últimos 5' },
];

const Crest = ({ id, size = 22 }) => <ClubCrest id={id} size={size} />;

const describeForm = (f) => ({
  title: `Rodada ${f.round}: ${f.home ? '' : '@ '}${nameOf(f.oppId)} ${f.gf}–${f.ga}`,
  label: `Rodada ${f.round}, ${f.res === 'V' ? 'vitória' : f.res === 'D' ? 'derrota' : 'empate'} ${f.gf} a ${f.ga} ${f.home ? 'contra' : 'fora contra'} ${nameOf(f.oppId)}`,
});

export function CareerTableScreen({ save, onNavigate, onOpenClubInMarket }) {
  const myDivision = save.clubs[save.myClubId].division;
  const [division, setDivision] = useState(myDivision);
  const data = division === 'A' ? save.divisionA : save.divisionB;
  const played = data.round;
  const [view, setView] = useState('all');
  const [afterRound, setAfterRound] = useState(played);
  const [moreCols, setMoreCols] = useState(false);
  const [openClub, setOpenClub] = useState(null);
  const [showAllFixtures, setShowAllFixtures] = useState(false);
  useEffect(() => { setAfterRound(data.round); }, [division, data.round]);
  const n = Math.min(afterRound, played);

  const table = useMemo(() => standingsAfter(data, n, view), [data, n, view]);
  const prevTable = useMemo(() => (n > 0 ? standingsAfter(data, n - 1, view) : null), [data, n, view]);
  const total = table.length;
  const copaChampionId = save.copa?.phase === 'done' ? save.copa.champion : null;
  const copaChampionInG4 = division === 'A' && copaChampionId && view === 'all'
    ? table.slice(0, 4).some(r => r.id === copaChampionId) : false;

  // ── Minha linha fixa no rodapé (mobile) quando sai da área visível ──
  const myRowRef = useRef(null);
  const [myRowHidden, setMyRowHidden] = useState(false);
  useEffect(() => {
    const el = myRowRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setMyRowHidden(!e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, [division, view, n]);

  // ── Lateral: meu clube (sempre na minha divisão, classificação atual) ──
  const myData = myDivision === 'A' ? save.divisionA : save.divisionB;
  const myTable = myData.table;
  const myIdx = myTable.findIndex(r => r.id === save.myClubId);
  const myRow = myTable[myIdx];
  const myPos = myIdx + 1;
  const myN = myTable.length;
  const board = computeBoard(save);
  const ptsAt = (pos) => myTable[pos - 1]?.pts ?? 0;
  const gaps = [];
  if (myData.round > 0) {
    if (myPos > myN - 4) gaps.push({ label: `Para sair do Z4 (${myN - 4}º)`, v: ptsAt(myN - 4) - myRow.pts, danger: true });
    else gaps.push({ label: `Folga para o Z4 (${myN - 3}º)`, v: myRow.pts - ptsAt(myN - 3), lead: true });
    if (myDivision === 'A' && myPos > 12) gaps.push({ label: 'Para a Sul-Americana (12º)', v: ptsAt(12) - myRow.pts });
    if (myDivision === 'B' && myPos > 6) gaps.push({ label: 'Para o playoff (6º)', v: ptsAt(6) - myRow.pts });
    if (myPos > board.target) gaps.push({ label: `Para a meta da diretoria (${board.target}º)`, v: ptsAt(board.target) - myRow.pts });
    else gaps.push({ label: `Meta da diretoria (${board.short})`, v: null, ok: true });
    if (myPos > 1) gaps.push({ label: 'Para o líder', v: ptsAt(1) - myRow.pts });
  }
  const rounds = myData.fixtures.length;
  const remaining = rounds - myData.round;
  const projection = myRow?.pj ? Math.round((myRow.pts / myRow.pj) * rounds) : null;
  const targetRow = myTable[board.target - 1];
  const targetPace = targetRow?.pj ? Math.round((targetRow.pts / targetRow.pj) * rounds) : null;
  const needPerGame = targetPace != null && remaining > 0 ? Math.max(0, (targetPace - myRow.pts) / remaining) : null;
  const aprov = myRow?.pj ? Math.round((myRow.pts / (myRow.pj * 3)) * 100) : 0;
  const myZone = myData.round > 0 ? zoneFor(myDivision, myPos, myN, false) : null;

  // ── Próxima rodada da série vista ──
  const nextRoundIdx = data.round;
  const nextMatches = data.fixtures[nextRoundIdx] || [];
  const curIdx = data.table.findIndex(r => r.id === save.myClubId);
  const rivals = new Set(curIdx >= 0 && data.round > 0 ? data.table.filter((r, i) => r.id !== save.myClubId && (Math.abs(i - curIdx) <= 3 || Math.abs(r.pts - data.table[curIdx].pts) <= 3)).map(r => r.id) : []);
  const orderedNext = [...nextMatches].sort((a, b) => {
    const score = (m) => (m.homeId === save.myClubId || m.awayId === save.myClubId ? 0 : rivals.has(m.homeId) && rivals.has(m.awayId) ? 1 : 2);
    return score(a) - score(b);
  });
  const shownNext = showAllFixtures ? orderedNext : orderedNext.slice(0, 5);

  // ── Artilharia da série (só Brasileirão quando o save já separa) ──
  const statsSource = save.leaguePlayerStats || save.seasonPlayerStats || {};
  const leagueOnly = !!save.leaguePlayerStats;
  const divisionIds = new Set(data.table.map(r => r.id));
  const scorers = Object.entries(statsSource)
    .map(([k, s]) => { const [clubId, ...rest] = k.split('::'); return { clubId, name: rest.join('::'), goals: s.goals || 0 }; })
    .filter(x => x.goals > 0 && divisionIds.has(x.clubId))
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
    .slice(0, 5);

  // Posição de cada clube antes da rodada vista (seta de movimento)
  const prevPositions = useMemo(() => (prevTable ? new Map(prevTable.map((r, i) => [r.id, i + 1])) : null), [prevTable]);

  const openRow = openClub ? table.find(r => r.id === openClub) : null;
  const openPos = openClub ? table.findIndex(r => r.id === openClub) + 1 : null;

  const MyStickyRow = () => {
    const i = table.findIndex(r => r.id === save.myClubId);
    if (i < 0) return null;
    const r = table[i];
    return (
      <div className="tb-sticky-me" aria-hidden="true">
        <span className="tb-ps">{i + 1}º</span><Crest id={r.id} /><b className="cf-ell">{nameOf(r.id)}</b>
        <span className="sq-num">{r.pj} J</span><span className="sq-num">{r.gp - r.gc > 0 ? '+' : ''}{r.gp - r.gc}</span><span className="tb-pts">{r.pts}</span>
      </div>
    );
  };

  return (
    <div className="ch-main tb-main">
      <div className="sq-ph">
        <div style={{ minWidth: 0 }}>
          <span className="ch-mono">Brasileirão {2025 + save.season} · Temporada {save.season} · {played} de {data.fixtures.length} rodadas</span>
          <h1>Tabela</h1>
        </div>
        <div className="cf-seg" role="tablist" aria-label="Divisão">
          {['A', 'B'].map(d => <button key={d} type="button" role="tab" aria-selected={division === d} className={division === d ? 'cf-on' : ''} onClick={() => { setDivision(d); setOpenClub(null); }}>Série {d}</button>)}
        </div>
      </div>

      <div className="tb-lay">
        <div className="ch-card tb-card">
          <div className="tb-tt">
            <div className="cf-seg tb-views" role="tablist" aria-label="Visão da tabela">
              {VIEWS.map(v => <button key={v.id} type="button" role="tab" aria-selected={view === v.id} className={view === v.id ? 'cf-on' : ''} onClick={() => setView(v.id)} disabled={played === 0 && v.id !== 'all'} title={played === 0 && v.id !== 'all' ? 'Disponível depois da primeira rodada' : undefined}>{v.label}</button>)}
            </div>
            <label className="tb-rsel">
              <span>Após a</span>
              <select value={n} onChange={e => setAfterRound(Number(e.target.value))} disabled={played === 0} aria-label="Classificação após a rodada">
                {played === 0 && <option value={0}>rodada 0</option>}
                {Array.from({ length: played }, (_, i) => played - i).map(r => <option key={r} value={r}>rodada {r}</option>)}
              </select>
            </label>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm tb-more-cols" onClick={() => setMoreCols(m => !m)} aria-pressed={moreCols}>{moreCols ? 'Menos colunas' : 'Mais colunas'}</button>
          </div>

          {played === 0 && <div className="mk-locked" style={{ margin: '12px 18px 0' }}><Icon name="info" size={16} />A temporada ainda não começou: todos com 0 ponto, em ordem alfabética.</div>}
          {view !== 'all' && <div className="ch-small" style={{ padding: '10px 18px 0' }}>{view === 'home' ? 'Só jogos como mandante' : view === 'away' ? 'Só jogos como visitante' : 'Só os últimos 5 jogos de cada clube'} · mesmos critérios de desempate. Zonas valem só na visão Geral.</div>}

          <StandingsTable
            rows={table}
            zoneFor={view === 'all' && n > 0 ? (pos) => zoneFor(division, pos, total, copaChampionInG4) : null}
            prevPositions={prevPositions}
            getForm={(id) => clubFormDetailed(data, id, n, 5)}
            describeForm={describeForm}
            highlightIds={[save.myClubId]}
            highlightRowRef={myRowRef}
            selectedId={openClub}
            onRowClick={setOpenClub}
            renderTeamName={(row) => nameOf(row.id)}
            renderCrest={(id) => <Crest id={id} />}
            rowLabel={(row, pos, zone) => `${pos}º ${nameOf(row.id)}, ${row.pts} pontos${zone ? `, ${zone.label}` : ''}. Ver detalhes do clube`}
            isPosDanger={(row) => row.id === save.myClubId && myZone?.key === 'z4' && view === 'all'}
            caption={`Classificação da Série ${division} após a rodada ${n}${view !== 'all' ? ` (${VIEWS.find(v => v.id === view).label})` : ''}`}
            moreCols={moreCols}
            legend={LEGEND[division]}
            legendNote={copaChampionInG4 ? 'O campeão da Copa do Brasil está no G4: o 5º também vai à Libertadores.' : null}
          />
          {myRowHidden && <MyStickyRow />}
        </div>

        <div className="tb-side">
          <div className="ch-card tb-me-card">
            <span className="ch-mono">{nameOf(save.myClubId)} na tabela</span>
            <div className="tb-big">
              <b style={{ color: myData.round === 0 ? 'var(--ink)' : myZone?.key === 'z4' ? 'var(--danger)' : (myZone?.key === 'g4' || myZone?.key === 'g6' || myZone?.key === 'up') ? 'var(--success)' : 'var(--ink)' }}>{myData.round === 0 ? '—' : `${myPos}º`}</b>
              <span className="ch-small">{myRow?.pts ?? 0} pts · {aprov}% de aproveitamento</span>
            </div>
            {myData.round === 0 ? (
              <p className="ch-small" style={{ margin: '8px 0 0' }}>As distâncias aparecem depois da primeira rodada.</p>
            ) : (
              <>
                {gaps.map(g => (
                  <div key={g.label} className="tb-gap"><span>{g.label}</span><b style={{ color: g.danger ? 'var(--danger)' : g.ok || g.lead ? 'var(--success)' : undefined }}>{g.ok ? 'dentro' : g.v <= 0 ? (g.lead ? `${Math.max(0, g.v)} pts` : 'empatado') : `${g.v} pt${g.v === 1 ? '' : 's'}`}</b></div>
                ))}
                <div className="tb-pace">
                  No ritmo atual o {nameOf(save.myClubId)} termina com <b>{projection} pontos</b>.
                  {myPos > board.target && targetPace != null && needPerGame != null
                    ? <> Para acompanhar o ritmo do {board.target}º colocado ({targetPace} pts), precisa de <b>{needPerGame.toFixed(1).replace('.', ',')} pontos por jogo</b> nas {remaining} rodadas restantes.</>
                    : <> Está dentro da meta ({board.short}){remaining ? `, com ${remaining} rodadas pela frente` : ''}.</>}
                </div>
              </>
            )}
          </div>

          <div className="ch-card" style={{ overflow: 'hidden' }}>
            <div className="ch-head"><h3>{nextRoundIdx < data.fixtures.length ? `Rodada ${nextRoundIdx + 1}` : 'Temporada encerrada'}</h3><button type="button" className="ch-link" onClick={() => onNavigate('calendar')}>Calendário</button></div>
            {shownNext.map((m, i) => {
              const mine = m.homeId === save.myClubId || m.awayId === save.myClubId;
              const key = !mine && rivals.has(m.homeId) && rivals.has(m.awayId);
              return (
                <div key={i} className={`tb-fx${mine ? ' tb-fx-mine' : ''}${key ? ' tb-fx-key' : ''}`}>
                  <span className="tb-fx-h"><span className="cf-ell">{nameOf(m.homeId)}</span><Crest id={m.homeId} size={18} /></span>
                  <span className="tb-fx-x" aria-label={key ? 'jogo entre rivais diretos' : 'contra'}>×</span>
                  <span className="tb-fx-a"><Crest id={m.awayId} size={18} /><span className="cf-ell">{nameOf(m.awayId)}</span></span>
                </div>
              );
            })}
            {orderedNext.length > 0 && (
              <div className="ch-small" style={{ padding: '10px 20px 16px', borderTop: '1px solid var(--line)' }}>
                <b style={{ color: 'var(--warning)' }}>×</b> jogos de rivais diretos{orderedNext.length > 5 && <> · <button type="button" className="ch-link" style={{ padding: 0 }} onClick={() => setShowAllFixtures(s => !s)}>{showAllFixtures ? 'mostrar menos' : `ver os ${orderedNext.length} jogos`}</button></>}
              </div>
            )}
          </div>

          <div className="ch-card" style={{ overflow: 'hidden' }}>
            <div className="ch-head"><h3>Artilharia</h3><span className="ch-small">Série {division}{leagueOnly ? '' : ' · inclui Copa'}</span></div>
            {scorers.length === 0 && <div className="ch-empty">Ninguém marcou ainda.</div>}
            {scorers.map((s, i) => (
              <div key={`${s.clubId}-${s.name}`} className={`tb-sc${s.clubId === save.myClubId ? ' tb-sc-me' : ''}`}>
                <span className="tb-rk">{i + 1}</span>
                <Crest id={s.clubId} size={24} />
                <div style={{ minWidth: 0 }}><b className="cf-ell">{s.name}</b><small>{nameOf(s.clubId)}</small></div>
                <span className="tb-g">{s.goals}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {openRow && (
        <Modal onClose={() => setOpenClub(null)} maxWidth={420} labelledBy="tb-club-title">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
            <Crest id={openRow.id} size={52} />
            <div style={{ minWidth: 0 }}>
              <h3 id="tb-club-title" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 24, margin: 0 }}>{nameOf(openRow.id)}</h3>
              <span className="ch-small">{openPos}º na Série {division} · {openRow.pts} pts · {openRow.v}V {openRow.e}E {openRow.d}D</span>
            </div>
          </div>
          <div className="ui-label" style={{ marginBottom: 6 }}>Forma</div>
          {n > 0 ? <FormChips form={clubFormDetailed(data, openRow.id, n, 5)} describe={describeForm} /> : <span className="ch-small">Sem jogos ainda.</span>}
          <div className="ui-label" style={{ margin: '16px 0 6px' }}>Próximos jogos</div>
          {nextFixtures(data, openRow.id, data.round, 2).map(f => (
            <div key={f.round} className="tb-gap"><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Crest id={f.oppId} size={20} />{f.home ? '' : '@ '}{nameOf(f.oppId)}</span><b>Rodada {f.round}</b></div>
          ))}
          {nextFixtures(data, openRow.id, data.round, 2).length === 0 && <span className="ch-small">Sem jogos restantes.</span>}
          {openRow.id !== save.myClubId && onOpenClubInMarket && (
            <button type="button" className="ui-btn ui-btn-dark ui-btn-md ui-btn-block" style={{ marginTop: 18 }} onClick={() => onOpenClubInMarket(openRow.id)}><Icon name="shirt" size={16} />Ver elenco no Mercado</button>
          )}
          {openRow.id === save.myClubId && (
            <button type="button" className="ui-btn ui-btn-dark ui-btn-md ui-btn-block" style={{ marginTop: 18 }} onClick={() => onNavigate('squad')}><Icon name="shirt" size={16} />Ver meu elenco</button>
          )}
        </Modal>
      )}
    </div>
  );
}
