// Abas Tabela e Série B da liga clássica — usam a StandingsTable compartilhada
// (a mesma da Tabela da carreira). Só apresentação: as linhas, a forma e as
// posições anteriores chegam prontas do App.jsx.
import { useState } from 'react';
import { Icon, Modal } from '../../ui/index.jsx';
import { StandingsTable, FormChips } from '../../ui/StandingsTable.jsx';
import { leagueZoneFor, LEAGUE_LEGEND } from './leagueTable.js';

const RES_TEXT = { V: 'vitória', E: 'empate', D: 'derrota' };
const describeForm = (f) => ({ title: RES_TEXT[f.res], label: RES_TEXT[f.res] });

// "Clube Ano (Conquista)" → { name: "Clube Ano", conquest: "Conquista" }
export function splitTeamLabel(label = '') {
  const m = label.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return m ? { name: m[1], conquest: m[2] } : { name: label, conquest: null };
}

/**
 * rows: tabela ordenada [{ id, label, pj, v, e, d, gp, gc, pts }]
 * division: 'A' | 'B' (zonas). myId: meu time (pode não estar na tabela).
 * prevPositions: Map id → posição antes da última rodada (ou null: sem movimento).
 * formOf(id) → ['V','E','D',...] | null (null em todos: coluna escondida).
 * crestOf(id, size) → nó do escudo. nextGameOf(id) → { oppLabel, home, round } | null.
 */
export function TableTab({ eyebrow, title, note, rows, division, myId, prevPositions, formOf, crestOf, nextGameOf, onViewTeam, teamOf, criteria, zonesActive = true }) {
  const [moreCols, setMoreCols] = useState(false);
  const [openId, setOpenId] = useState(null);
  const hasForm = !!formOf && rows.some(r => (formOf(r.id) || []).length > 0);
  const getForm = (id) => (formOf(id) || []).map(res => ({ res }));
  const open = openId ? rows.find(r => r.id === openId) : null;
  const openPos = open ? rows.findIndex(r => r.id === openId) + 1 : null;
  const openZone = open && zonesActive ? leagueZoneFor(division, openPos, rows.length) : null;
  const openSplit = open ? splitTeamLabel(open.label) : null;
  const next = open && nextGameOf ? nextGameOf(open.id) : null;
  const openTeam = open && teamOf ? teamOf(open.id) : null;

  return (
    <div className="lg-card lg-tb">
      <div className="lg-tb-h">
        <div style={{ minWidth: 0 }}>
          {eyebrow && <span className="lg-mono">{eyebrow}</span>}
          <h2>{title}</h2>
          {note && <p>{note}</p>}
        </div>
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm lg-tb-more" onClick={() => setMoreCols(m => !m)} aria-pressed={moreCols}>{moreCols ? 'Menos colunas' : 'Mais colunas'}</button>
      </div>
      <StandingsTable
        rows={rows}
        zoneFor={zonesActive ? (pos, total) => leagueZoneFor(division, pos, total) : null}
        prevPositions={prevPositions}
        showMovement={!!prevPositions}
        getForm={hasForm ? getForm : null}
        describeForm={describeForm}
        showForm={hasForm}
        highlightIds={myId ? [myId] : []}
        selectedId={openId}
        onRowClick={setOpenId}
        renderCrest={(id) => crestOf(id, 22)}
        renderTeamName={(row) => {
          const { name, conquest } = splitTeamLabel(row.label);
          return <>{name}{conquest && <small className="lg-conq">{conquest}</small>}</>;
        }}
        rowLabel={(row, pos, zone) => `${pos}º ${row.label}, ${row.pts} pontos${zone ? `, ${zone.label}` : ''}. Ver detalhes do clube`}
        isPosDanger={(row, pos) => row.id === myId && zonesActive && leagueZoneFor(division, pos, rows.length)?.key === 'z4'}
        caption={title}
        moreCols={moreCols}
        legend={zonesActive ? LEAGUE_LEGEND[division] : null}
        criteria={criteria}
      />

      {open && (
        <Modal onClose={() => setOpenId(null)} maxWidth={420} labelledBy="lg-club-title">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
            {crestOf(open.id, 52)}
            <div style={{ minWidth: 0 }}>
              <h3 id="lg-club-title" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 24, margin: 0 }}>{openSplit.name}</h3>
              {openSplit.conquest && <span className="lg-conq-b">{openSplit.conquest}</span>}
              <div className="lg-small" style={{ marginTop: 4 }}>{openPos}º · {open.pts} pts · {open.v}V {open.e}E {open.d}D · saldo {open.gp - open.gc > 0 ? '+' : ''}{open.gp - open.gc}</div>
            </div>
          </div>
          {openZone && <div className="lg-zone-pill" style={{ '--zone': openZone.color }}>{openZone.label}</div>}
          {hasForm && (
            <>
              <div className="ui-label" style={{ margin: '14px 0 6px' }}>Forma</div>
              {getForm(open.id).length ? <FormChips form={getForm(open.id)} describe={describeForm} /> : <span className="lg-small">Sem jogos ainda.</span>}
            </>
          )}
          {next && (
            <>
              <div className="ui-label" style={{ margin: '16px 0 6px' }}>Próximo jogo</div>
              <div className="lg-next"><span>{next.home ? '' : '@ '}{next.oppLabel}</span><b>Rodada {next.round}</b></div>
            </>
          )}
          {open.id !== myId && onViewTeam && openTeam && (
            <button type="button" className="ui-btn ui-btn-dark ui-btn-md ui-btn-block" style={{ marginTop: 18 }} onClick={() => { setOpenId(null); onViewTeam(openTeam); }}><Icon name="shirt" size={16} />Ver elenco</button>
          )}
        </Modal>
      )}
    </div>
  );
}
