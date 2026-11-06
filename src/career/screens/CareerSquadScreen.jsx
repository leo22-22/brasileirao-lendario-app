// Elenco do Modo Carreira — painel de gestão em largura cheia, seguindo o
// mesmo padrão visual da home (2026-11-06: usuário pediu explicitamente
// "estilo Football Manager/FUT", full width, cards de resumo, filtro por
// setor, alternância tabela/cards, linhas com glassmorphism) — mesmo
// mecanismo inline-style/<style> do resto do Modo Carreira (sem Tailwind).
// Só com dados reais: sem pé preferencial/moral/energia (o jogo não tem
// esses atributos) nem botões "Vender"/"Renovar" (vender só acontece
// aceitando uma proposta recebida no Mercado — não existe venda direta
// nem sistema de contrato aqui) — a ação rápida real disponível é marcar/
// desmarcar o jogador na lista de transferências, a mesma do Mercado.
import { useState } from 'react';
import { posOrderIndex, ovrColor, posColor } from '../../lib/format.js';
import { computePlayerValue } from '../engine/pricing.js';
import { backButtonStyle } from '../components/styles.js';

const POS_GROUP_LABEL = {
  GOL: 'Goleiros', ZAG: 'Zagueiros', LD: 'Laterais', LE: 'Laterais',
  VOL: 'Volantes', MC: 'Meio-campo', MD: 'Meio-campo', ME: 'Meio-campo', MEI: 'Meias',
  PD: 'Pontas/Atacantes', PE: 'Pontas/Atacantes', ATA: 'Pontas/Atacantes',
};

// Setores do filtro rápido pedido pelo usuário (Todos/Goleiros/Defensores/
// Meias/Atacantes) — cada posição real do jogo (POS_ORDER) cai em exatamente
// um desses 4 baldes.
const SECTORS = [
  { id: '', label: 'Todos' },
  { id: 'GOL', label: 'Goleiros', positions: ['GOL'] },
  { id: 'DEF', label: 'Defensores', positions: ['ZAG', 'LD', 'LE'] },
  { id: 'MEI', label: 'Meias', positions: ['VOL', 'MC', 'MD', 'ME', 'MEI'] },
  { id: 'ATA', label: 'Atacantes', positions: ['PD', 'PE', 'ATA'] },
];

function formatMoney(n) {
  return 'R$ ' + n.toLocaleString('pt-BR');
}
function formatMoneyShort(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}K`;
  return `R$ ${n}`;
}
function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const cardStyle = {
  padding: '14px', borderRadius: 14,
  background: 'rgba(20,28,22,0.55)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.09)',
};

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="squad-card" style={cardStyle}>
      <div style={{ fontSize: 10, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent || '#F4F1EA', fontFamily: "'Space Mono', monospace", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, opacity: 0.55, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function PosBadge({ pos }) {
  const c = posColor(pos);
  return (
    <span style={{
      width: 36, flexShrink: 0, textAlign: 'center', fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3,
      fontFamily: "'Space Mono', monospace", padding: '4px 0', borderRadius: 7, color: c, background: `${c}22`, border: `1px solid ${c}55`,
    }}>{pos}</span>
  );
}

function OvrBadge({ ovr }) {
  const c = ovrColor(ovr);
  return (
    <span style={{
      width: 34, height: 34, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 800, fontFamily: "'Space Mono', monospace", color: c,
      background: `${c}18`, border: `1.5px solid ${c}`, boxShadow: `0 0 8px ${c}55`,
    }}>{ovr}</span>
  );
}

function PlayerDetail({ p, clubId }) {
  const value = computePlayerValue(p, clubId);
  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 4, fontSize: 11.5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ opacity: 0.6 }}>Posições</span>
        <span>{p.pos.join(' / ')}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ opacity: 0.6 }}>Valor de mercado</span>
        <span style={{ fontFamily: "'Space Mono', monospace", color: '#d4a23c' }}>{formatMoney(value)}</span>
      </div>
      {p.age != null ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ opacity: 0.6 }}>Idade</span>
            <span>{p.age} anos</span>
          </div>
          {p.potential != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: 0.6 }}>Potencial</span>
              <span style={{ color: p.potential > p.ovr ? '#7fd99a' : undefined }}>{p.potential > p.ovr ? `até ${p.potential}` : 'já no teto'}</span>
            </div>
          )}
          {p.isStar && <div style={{ color: '#d4a23c', fontWeight: 600 }}>⭐ Joia da categoria de base</div>}
        </>
      ) : (
        <div style={{ opacity: 0.45, fontStyle: 'italic' }}>Idade ainda não cadastrada pra esse jogador.</div>
      )}
    </div>
  );
}

function PlayerRow({ p, clubId, listed, expanded, onToggleExpand, onToggleListed }) {
  const c = posColor(p.pos[0]);
  return (
    <div className="squad-row" style={{
      padding: '10px 12px', borderRadius: 12,
      background: expanded ? `${c}14` : 'rgba(127,217,154,0.03)',
      border: `1px solid ${expanded ? `${c}55` : 'rgba(127,217,154,0.08)'}`,
      borderLeft: `3px solid ${c}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PosBadge pos={p.pos[0]} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
            {p.isYouth && <span title="Veio da categoria de base">🌱</span>}
            {p.isStar && <span title="Joia">⭐</span>}
            {p.name}
          </div>
          <div style={{ fontSize: 10.5, opacity: 0.55, marginTop: 1 }}>
            {p.age != null ? `${p.age} anos · ` : ''}{p.pos.join('/')}
          </div>
        </div>
        <span style={{ fontSize: 11, opacity: 0.6, fontFamily: "'Space Mono', monospace", display: 'none' }} className="squad-value-wide">{formatMoneyShort(computePlayerValue(p, clubId))}</span>
        <OvrBadge ovr={p.ovr} />
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={onToggleExpand} title="Ver detalhes" style={iconBtnStyle}>👁</button>
          <button
            onClick={onToggleListed}
            title={listed ? 'Tirar da lista de transferências' : 'Colocar na lista de transferências'}
            style={{ ...iconBtnStyle, color: listed ? '#d4a23c' : iconBtnStyle.color, borderColor: listed ? 'rgba(212,162,60,0.5)' : iconBtnStyle.borderColor }}
          >📋</button>
        </div>
      </div>
      {expanded && <PlayerDetail p={p} clubId={clubId} />}
    </div>
  );
}

function PlayerMiniCard({ p, clubId, listed, expanded, onToggleListed, onExpand }) {
  const c = posColor(p.pos[0]);
  const value = computePlayerValue(p, clubId);
  return (
    <div className="squad-card" style={{ ...cardStyle, borderTop: `3px solid ${c}`, cursor: 'pointer' }} onClick={onExpand}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <PosBadge pos={p.pos[0]} />
        <OvrBadge ovr={p.ovr} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
        {p.isYouth && '🌱'}{p.isStar && '⭐'} {p.name}
      </div>
      <div style={{ fontSize: 10.5, opacity: 0.55, marginTop: 2 }}>{p.age != null ? `${p.age} anos · ` : ''}{p.pos.join('/')}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: '#d4a23c' }}>{formatMoneyShort(value)}</span>
        <button
          onClick={e => { e.stopPropagation(); onToggleListed(); }}
          title={listed ? 'Tirar da lista de transferências' : 'Colocar na lista de transferências'}
          style={{ ...iconBtnStyle, color: listed ? '#d4a23c' : iconBtnStyle.color, borderColor: listed ? 'rgba(212,162,60,0.5)' : iconBtnStyle.borderColor }}
        >📋</button>
      </div>
      {expanded && <PlayerDetail p={p} clubId={clubId} />}
    </div>
  );
}

const iconBtnStyle = {
  width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.04)', color: 'rgba(244,241,234,0.7)', fontSize: 13, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};

export function CareerSquadScreen({ save, onToggleListed, onBack }) {
  // Jogador da categoria de base não aparece aqui — tem tela própria (ver
  // CareerYouthScreen.jsx) até ser promovido ou completar 20 anos.
  const roster = save.clubs[save.myClubId].roster.filter(p => !p.inAcademy);
  const transferList = save.transferList || [];
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('');
  const [view, setView] = useState('table'); // 'table' | 'cards'
  const [expandedName, setExpandedName] = useState(null);

  const sectorDef = SECTORS.find(s => s.id === sector);
  const q = normalize(query.trim());
  const filtered = roster
    .filter(p => !q || normalize(p.name).includes(q))
    .filter(p => !sectorDef?.positions || sectorDef.positions.includes(p.pos[0]));
  const sorted = [...filtered].sort((a, b) => posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]) || b.ovr - a.ovr);

  const avgOvr = roster.length ? (roster.reduce((s, p) => s + p.ovr, 0) / roster.length).toFixed(1) : '0.0';
  const starPlayer = roster.length ? [...roster].sort((a, b) => computePlayerValue(b, save.myClubId) - computePlayerValue(a, save.myClubId))[0] : null;
  const academyCount = save.clubs[save.myClubId].roster.filter(p => p.inAcademy).length;

  // Agrupa por LABEL (não por sequência) — "Laterais" junta LD e LE, que
  // não ficam lado a lado em POS_ORDER (tem ZAG entre os dois).
  const groupOrder = [];
  const groupMap = new Map();
  for (const p of sorted) {
    const label = POS_GROUP_LABEL[p.pos[0]] || 'Outros';
    if (!groupMap.has(label)) {
      groupMap.set(label, { label, color: posColor(p.pos[0]), players: [] });
      groupOrder.push(label);
    }
    groupMap.get(label).players.push(p);
  }
  const groups = groupOrder.map(label => groupMap.get(label));

  const toggleExpand = (name) => setExpandedName(prev => (prev === name ? null : name));

  return (
    <div className="squad-wrap">
      <style>{`
        .squad-wrap { width: 98%; max-width: none; margin: 0 auto; padding: 24px 12px; box-sizing: border-box; }
        .squad-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 14px 0; }
        .squad-card { transition: border-color 0.18s ease, transform 0.18s ease; }
        .squad-card:hover { border-color: rgba(212,162,60,0.3); }
        .squad-row { transition: border-color 0.15s ease; }
        .squad-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 14px; }
        .squad-tab { padding: 7px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,0.15); background: transparent; color: rgba(244,241,234,0.6); transition: all 0.15s ease; }
        .squad-tab:hover { border-color: rgba(212,162,60,0.4); }
        .squad-tab.active { border-color: #d4a23c; background: rgba(212,162,60,0.12); color: #d4a23c; }
        .squad-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
        .squad-group-grid { display: grid; gap: 6px; }
        @media (min-width: 720px) {
          .squad-value-wide { display: inline-block !important; }
        }
        @media (max-width: 720px) {
          .squad-stats { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <button onClick={onBack} style={backButtonStyle}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, margin: '4px 0 0' }}>👕 Elenco</h2>

      <div className="squad-stats">
        <StatCard label="Total de jogadores" value={roster.length} />
        <StatCard label="Média de overall" value={avgOvr} accent="#d4a23c" />
        <StatCard label="Jogador mais valioso" value={starPlayer ? starPlayer.ovr : '—'} sub={starPlayer?.name} accent={ovrColor(starPlayer?.ovr || 0)} />
        <StatCard label="Categoria de base" value={`${academyCount} 🌱`} sub="promessas" accent="#7fd99a" />
      </div>

      <div className="squad-controls">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="🔍 Buscar jogador pelo nome..."
          style={{
            flex: '1 1 280px', maxWidth: 360, boxSizing: 'border-box', padding: '8px 12px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#F4F1EA', fontSize: 12.5, outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SECTORS.map(s => (
            <button key={s.id} onClick={() => setSector(s.id)} className={`squad-tab${sector === s.id ? ' active' : ''}`}>{s.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button onClick={() => setView('table')} className={`squad-tab${view === 'table' ? ' active' : ''}`}>☰ Lista</button>
          <button onClick={() => setView('cards')} className={`squad-tab${view === 'cards' ? ' active' : ''}`}>▦ Cards</button>
        </div>
      </div>

      {groups.length === 0 && <p style={{ fontSize: 12.5, opacity: 0.5, textAlign: 'center', padding: '24px 0' }}>Nenhum jogador encontrado com esse filtro.</p>}

      {groups.map(g => (
        <div key={g.label} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color }} />
            <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>{g.label}</div>
            <div style={{ fontSize: 10.5, opacity: 0.4 }}>({g.players.length})</div>
          </div>
          {view === 'table' ? (
            <div className="squad-group-grid">
              {g.players.map(p => (
                <PlayerRow
                  key={p.name} p={p} clubId={save.myClubId}
                  listed={transferList.includes(p.name)}
                  expanded={expandedName === p.name}
                  onToggleExpand={() => toggleExpand(p.name)}
                  onToggleListed={() => onToggleListed(p.name)}
                />
              ))}
            </div>
          ) : (
            <div className="squad-cards-grid">
              {g.players.map(p => (
                <PlayerMiniCard
                  key={p.name} p={p} clubId={save.myClubId}
                  listed={transferList.includes(p.name)}
                  expanded={expandedName === p.name}
                  onToggleListed={() => onToggleListed(p.name)}
                  onExpand={() => toggleExpand(p.name)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
