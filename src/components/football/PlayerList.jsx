// Lista de jogadores compartilhada (carreira + liga clássica). Extraída do
// Elenco do Modo Carreira sem mudar markup nem classes (sq-*): grupos por
// setor com cabeçalho, chip de posição pela cor do setor, nome + tags,
// colunas configuráveis e badge de OVR em 3 faixas.
import { posSector } from '../../lib/format.js';
import './playerList.css';

export const SECTOR_GROUP = { gk: 'Goleiros', df: 'Defesa', md: 'Meio-campo', at: 'Ataque' };
export const SECTOR_DOT = { gk: '#B08A3E', df: '#3F74AE', md: '#2F8A5E', at: '#C2513F' };
export const SECTOR_ORDER = ['gk', 'df', 'md', 'at'];

// ≥85 verde · 80–84 dourado · <80 neutro
export const ovrClass = (o) => (o >= 85 ? 'sq-o-hi' : o >= 80 ? 'sq-o-md' : 'sq-o-lo');

export function PosChip({ pos, small }) {
  return <span className={`sq-pos sq-${posSector(pos)}${small ? ' sq-pos-sm' : ''}`}>{pos}</span>;
}

export function Tags({ tags }) {
  return tags.map(t => <span key={t.id} className={`sq-tg sq-tg-${t.id}`}>{t.label}</span>);
}

export function OvrBadge({ ovr, children }) {
  return <span className={`sq-ovr ${ovrClass(ovr)}`}>{children ?? ovr}</span>;
}

/**
 * groups: [{ key, label, dot, players }] — use groupBySector() para o padrão por setor.
 * columns: [{ key, label, align: 'r'|undefined, hideMobile, className, render(p) }] — entre o nome e o OVR.
 * getTags(p) → [{ id, label }]; getSub(p) → texto da segunda linha; getPos(p) → posição do chip.
 * getOvr(p) → número (badge); renderOvr(p) → conteúdo do badge (ex.: OVR com bônus).
 * selectedId + getId: linha selecionada. onRowClick(p). renderRowEnd(p): ação no fim da linha.
 * className: modificador para a tela definir o grid-template-columns.
 */
export function PlayerList({
  groups,
  columns = [],
  getId = (p) => p.name,
  getName = (p) => p.name,
  getPos = (p) => p.pos?.[0],
  getSub = (p) => (p.pos || []).join(' · '),
  getTags = null,
  getOvr = (p) => p.ovr,
  renderOvr = null,
  selectedId = null,
  onRowClick = null,
  renderRowEnd = null,
  rowLabel = (p) => `${getPos(p)}: ${getName(p)}, OVR ${getOvr(p)}`,
  ariaLabel = 'Jogadores',
  showHeader = true,
  className = '',
}) {
  return (
    <div role="listbox" aria-label={ariaLabel} className={className || undefined}>
      {showHeader && (
        <div className="sq-th" aria-hidden="true">
          <span>Pos</span><span>Jogador</span>
          {columns.map(c => <span key={c.key} className={c.align === 'r' ? 'r' : undefined}>{c.label}</span>)}
          <span className="r">OVR</span>
          {renderRowEnd && <span />}
        </div>
      )}
      {groups.map(g => (
        <div key={g.key} role="group" aria-label={`${g.label}, ${g.players.length}`}>
          <div className="sq-grp"><i style={{ background: g.dot }} />{g.label} · {g.players.length}</div>
          {g.players.map(p => {
            const id = getId(p);
            const sel = selectedId != null && selectedId === id;
            const sub = getSub ? getSub(p) : null;
            return (
              <div
                key={id}
                role="option"
                aria-selected={sel}
                tabIndex={0}
                className={`sq-tr${sel ? ' sq-sel' : ''}`}
                onClick={onRowClick ? () => onRowClick(p) : undefined}
                onKeyDown={e => { if (e.target !== e.currentTarget || !onRowClick) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(p); } }}
                aria-label={rowLabel(p)}
              >
                <PosChip pos={getPos(p)} />
                <span className="sq-nm"><span className="sq-nm-l"><b>{getName(p)}</b>{getTags && <Tags tags={getTags(p)} />}</span>{sub != null && <small>{sub}</small>}</span>
                {columns.map(c => (
                  <span key={c.key} className={[c.className, c.hideMobile ? 'sq-hide-m' : null].filter(Boolean).join(' ') || undefined}>{c.render(p)}</span>
                ))}
                <OvrBadge ovr={getOvr(p)}>{renderOvr ? renderOvr(p) : undefined}</OvrBadge>
                {renderRowEnd && renderRowEnd(p)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Agrupa por setor (Goleiros / Defesa / Meio-campo / Ataque), omitindo setores vazios.
export function groupBySector(players, getPos = (p) => p.pos?.[0]) {
  return SECTOR_ORDER
    .map(s => ({ key: s, label: SECTOR_GROUP[s], dot: SECTOR_DOT[s], players: players.filter(p => posSector(getPos(p)) === s) }))
    .filter(g => g.players.length > 0);
}
