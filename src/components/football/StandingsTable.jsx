// Tabela de classificação compartilhada (carreira + liga clássica).
// Extraída de CareerTableScreen sem mudar markup nem classes (tb-*), para a
// Tabela da carreira continuar idêntica. Não calcula nada: recebe as linhas
// já ordenadas (mesmos critérios de desempate de quem chama) e funções que
// dizem a zona, o movimento e a forma de cada clube.
import './standingsTable.css';

const DEFAULT_CRITERIA = 'Critérios: pontos, vitórias, saldo, gols pró';

// Chips V/E/D. `describe(f)` → { title, label } (texto do tooltip e do leitor de tela).
export function FormChips({ form, describe }) {
  return (
    <span className="tb-frm">
      {form.map((f, i) => {
        const d = describe ? describe(f) : null;
        return <i key={i} className={`tb-f${f.res}`} title={d?.title} aria-label={d?.label}>{f.res}</i>;
      })}
    </span>
  );
}

function Movement({ move }) {
  if (move > 0) return <span className="tb-mv tb-up" aria-label={`subiu ${move}`}>▲{move}</span>;
  if (move < 0) return <span className="tb-mv tb-dn" aria-label={`caiu ${-move}`}>▼{-move}</span>;
  return <span className="tb-mv tb-eq" aria-label="manteve">–</span>;
}

/**
 * rows: [{ id, pj, v, e, d, gp, gc, pts }] já ordenadas.
 * zoneFor(pos, total) → { key, color, label } | null — barra lateral de 3px e separadores nomeados.
 * prevPositions: Map/objeto id → posição antes da última rodada (movimento). Sem ele, tudo "–".
 * getForm(id) → [{ res: 'V'|'E'|'D', ... }]; describeForm(f) → { title, label }.
 * highlightIds: clubes do usuário (linha dourada). selectedId: linha aberta.
 * isPosDanger(row, pos): pinta a posição de vermelho.
 * compact: só # · clube · PJ · SG · Pts.
 */
export function StandingsTable({
  rows,
  zoneFor = null,
  separators = true,
  prevPositions = null,
  showMovement = true,
  getForm = null,
  describeForm = null,
  showForm = true,
  highlightIds = [],
  selectedId = null,
  onRowClick = null,
  renderTeamName = (row) => row.id,
  renderCrest = null,
  rowLabel = null,
  isPosDanger = null,
  highlightRowRef = null,
  caption = 'Classificação',
  moreCols = false,
  compact = false,
  legend = null,
  legendNote = null,
  criteria = DEFAULT_CRITERIA,
}) {
  const total = rows.length;
  const hl = new Set(highlightIds);
  const prevPos = (id) => {
    if (!prevPositions) return null;
    return prevPositions instanceof Map ? prevPositions.get(id) : prevPositions[id];
  };
  const withMove = showMovement && !compact;
  const withForm = showForm && !compact && !!getForm;
  const cols = 3 + (withMove ? 1 : 0) + 5 + (withForm ? 1 : 0) + 2;

  const lines = [];
  let lastZone;
  rows.forEach((row, i) => {
    const pos = i + 1;
    const zone = zoneFor ? zoneFor(pos, total) : null;
    const zKey = zone?.key || null;
    if (separators && zone && zKey !== lastZone) lines.push({ sep: true, zone, key: `sep-${pos}` });
    lastZone = zKey;
    const p = prevPos(row.id);
    lines.push({ row, pos, zone, move: p ? p - pos : 0 });
  });

  const activate = (id) => { if (onRowClick) onRowClick(id); };

  return (
    <>
      <div className="tb-scroll">
        <table className={`tb-table${moreCols ? ' tb-more' : ''}${compact ? ' tb-compact' : ''}`}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="tb-c-pos">#</th>
              {withMove && <th scope="col" className="tb-c-mv"><span className="sr-only">Movimento</span></th>}
              <th scope="col" className="tb-c-club">Clube</th>
              <th scope="col">PJ</th>
              <th scope="col" className="tb-x">V</th>
              <th scope="col" className="tb-x">E</th>
              <th scope="col" className="tb-x">D</th>
              <th scope="col" className="tb-x">GP</th>
              <th scope="col" className="tb-x">GC</th>
              <th scope="col">SG</th>
              <th scope="col">Pts</th>
              {withForm && <th scope="col" className="tb-c-frm">Últimos 5</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map(l => {
              if (l.sep) {
                return <tr key={l.key} className={`tb-sep${l.zone.key === 'z4' ? ' tb-sep-red' : ''}`}><td colSpan={cols}><span>{l.zone.label}</span></td></tr>;
              }
              const { row, pos, zone, move } = l;
              const isMe = hl.has(row.id);
              const sg = row.gp - row.gc;
              return (
                <tr
                  key={row.id}
                  ref={isMe && highlightRowRef ? highlightRowRef : undefined}
                  className={`tb-tr${isMe ? ' tb-me' : ''}${selectedId === row.id ? ' tb-open' : ''}`}
                  style={{ '--zone': zone?.color || 'transparent' }}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => activate(row.id) : undefined}
                  onKeyDown={onRowClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(row.id); } } : undefined}
                  aria-label={rowLabel ? rowLabel(row, pos, zone) : undefined}
                >
                  <td className="tb-c-pos"><span className="tb-ps" style={isPosDanger && isPosDanger(row, pos) ? { color: 'var(--danger)' } : undefined}>{pos}</span></td>
                  {withMove && <td className="tb-c-mv"><Movement move={move} /></td>}
                  <th scope="row" className="tb-c-club"><span className="tb-cl">{renderCrest ? renderCrest(row.id) : null}<b className="cf-ell">{renderTeamName(row)}</b></span></th>
                  <td className="tb-n">{row.pj}</td>
                  <td className="tb-n tb-x">{row.v}</td>
                  <td className="tb-n tb-x">{row.e}</td>
                  <td className="tb-n tb-x">{row.d}</td>
                  <td className="tb-n tb-x">{row.gp}</td>
                  <td className="tb-n tb-x">{row.gc}</td>
                  <td className="tb-n">{sg > 0 ? `+${sg}` : sg}</td>
                  <td className="tb-pts">{row.pts}</td>
                  {withForm && <td className="tb-c-frm"><FormChips form={getForm(row.id)} describe={describeForm} /></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(legend || legendNote || criteria) && (
        <div className="tb-leg">
          {(legend || []).map(([c, t]) => <span key={t}><i style={{ background: c }} aria-hidden="true" />{t}</span>)}
          {legendNote && <span>{legendNote}</span>}
          {criteria && <span className="tb-crit">{criteria}</span>}
        </div>
      )}
    </>
  );
}

/**
 * Tabela resumida (# · movimento · clube · J · Pts), com linhas de "…".
 * rows: [{ row, pos, move?, zone?, label } | { gap: true, key }]
 */
export function MiniStandings({ rows, myId, title, showMovement = true, renderCrest = null, onRowClick = null }) {
  return (
    <table className="tb-mini">
      <caption className="sr-only">{title}</caption>
      <thead><tr><th scope="col">#</th>{showMovement && <th scope="col"><span className="sr-only">Movimento</span></th>}<th scope="col" className="tb-mini-cl">Clube</th><th scope="col">J</th><th scope="col">Pts</th></tr></thead>
      <tbody>
        {rows.map(r => r.gap ? (
          <tr key={r.key} className="tb-mini-gap"><td colSpan={showMovement ? 5 : 4}>…</td></tr>
        ) : (
          <tr
            key={r.row.id}
            className={`${r.row.id === myId ? 'tb-mini-me' : ''}${onRowClick ? ' tb-mini-click' : ''}`}
            style={{ '--zone': r.zone?.color || 'transparent' }}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(r.row.id) : undefined}
            onKeyDown={onRowClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(r.row.id); } } : undefined}
          >
            <td className="tb-mini-ps">{r.pos}</td>
            {showMovement && <td className="tb-mini-mv"><Movement move={r.move || 0} /></td>}
            <th scope="row" className="tb-mini-cl"><span className="tb-mini-nm">{renderCrest ? renderCrest(r.row.id) : null}<span className="tb-mini-ell">{r.label}</span></span></th>
            <td className="tb-mini-n">{r.row.pj}</td>
            <td className="tb-mini-p">{r.row.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
