// Elenco do Modo Carreira — lista completa do clube do usuário, agrupada
// por posição, com cor por setor do time (mesma paleta do Mercado e da
// Formação) e indicadores de jogador da base (idade/potencial) e joia
// rara. Clique num jogador expande os detalhes dele (posições, valor de
// mercado, e idade/potencial quando existir — ver Fase 7 do pacote
// grande, que vai dar idade a todo mundo, não só aos da base). Tela de
// consulta — vender é feito no Mercado.
import { useState } from 'react';
import { posOrderIndex, ovrColor, posColor } from '../../lib/format.js';
import { computePlayerValue } from '../engine/pricing.js';
import { backButtonStyle } from '../components/styles.js';

const POS_GROUP_LABEL = {
  GOL: 'Goleiros', ZAG: 'Zagueiros', LD: 'Laterais', LE: 'Laterais',
  VOL: 'Volantes', MC: 'Meio-campo', MD: 'Meio-campo', ME: 'Meio-campo', MEI: 'Meias',
  PD: 'Pontas/Atacantes', PE: 'Pontas/Atacantes', ATA: 'Pontas/Atacantes',
};

function formatMoney(n) {
  return 'R$ ' + n.toLocaleString('pt-BR');
}

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function PlayerCard({ p, clubId, expanded, onToggle }) {
  const c = posColor(p.pos[0]);
  const value = computePlayerValue(p, clubId);
  const edgeColor = expanded ? `${c}55` : 'rgba(255,255,255,0.07)';
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '9px 12px', borderRadius: 10, background: expanded ? `${c}14` : 'rgba(255,255,255,0.035)',
        // Longhand nos 4 lados (não `border` + `borderLeft`) — misturar o
        // shorthand com um lado sobrescrito dá warning do React entre
        // re-renders (valores de borda ficando inconsistentes).
        borderTop: `1px solid ${edgeColor}`, borderRight: `1px solid ${edgeColor}`, borderBottom: `1px solid ${edgeColor}`,
        borderLeft: `3px solid ${c}`,
        marginBottom: 5, cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 32, flexShrink: 0, textAlign: 'center', fontSize: 10, fontWeight: 800, letterSpacing: 0.3,
          fontFamily: "'Space Mono', monospace", padding: '3px 0', borderRadius: 6, color: c, background: `${c}22`,
        }}>{p.pos[0]}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.isYouth && '🌱 '}{p.isStar && '⭐ '}{p.name}
        </span>
        {p.isYouth && <span style={{ fontSize: 10.5, opacity: 0.5, fontFamily: "'Space Mono', monospace" }}>{p.age}a</span>}
        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: ovrColor(p.ovr), fontSize: 13, minWidth: 20, textAlign: 'right' }}>{p.ovr}</span>
      </div>
      {expanded && (
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
      )}
    </div>
  );
}

export function CareerSquadScreen({ save, onBack }) {
  const roster = save.clubs[save.myClubId].roster;
  const [query, setQuery] = useState('');
  const [expandedName, setExpandedName] = useState(null);

  const q = normalize(query.trim());
  const filtered = roster.filter(p => !q || normalize(p.name).includes(q));
  const sorted = [...filtered].sort((a, b) => posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]) || b.ovr - a.ovr);

  // Agrupa por LABEL (não por sequência) — "Laterais" junta LD e LE, que
  // não ficam lado a lado em POS_ORDER (tem ZAG entre os dois). Agrupar só
  // "quando o label muda" (sequencial) criava DUAS seções "Laterais"
  // separadas, cada uma com key={label} repetida — React acusava chave
  // duplicada. Um Map preserva a ordem de primeira aparição e junta tudo
  // que tem o mesmo label numa seção só, em vez de duas.
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

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={backButtonStyle}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 4 }}>Elenco</h2>
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>{roster.length} jogadores · 🌱 = da categoria de base · toque num jogador pra ver detalhes</p>

      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="🔍 Buscar jogador pelo nome..."
        style={{
          width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, marginBottom: 14,
          border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#F4F1EA', fontSize: 12.5, outline: 'none',
        }}
      />

      {groups.length === 0 && <p style={{ fontSize: 12.5, opacity: 0.5, textAlign: 'center', padding: '12px 0' }}>Nenhum jogador encontrado com esse nome.</p>}
      {groups.map(g => (
        <div key={g.label} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color }} />
            <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>{g.label}</div>
          </div>
          {g.players.map(p => (
            <PlayerCard
              key={p.name}
              p={p}
              clubId={save.myClubId}
              expanded={expandedName === p.name}
              onToggle={() => setExpandedName(prev => (prev === p.name ? null : p.name))}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
