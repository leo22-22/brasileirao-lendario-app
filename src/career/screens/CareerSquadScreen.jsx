// Elenco do Modo Carreira — lista completa do clube do usuário, agrupada
// por posição, com indicadores de jogador da base (idade/potencial) e
// joia rara. Tela de consulta (vender é feito no Mercado).
import { posOrderIndex, ovrColor } from '../../lib/format.js';

const POS_GROUP_LABEL = {
  GOL: 'Goleiros', ZAG: 'Zagueiros', LD: 'Laterais', LE: 'Laterais',
  VOL: 'Volantes', MC: 'Meio-campo', MD: 'Meio-campo', ME: 'Meio-campo', MEI: 'Meias',
  PD: 'Pontas/Atacantes', PE: 'Pontas/Atacantes', ATA: 'Pontas/Atacantes',
};

export function CareerSquadScreen({ save, onBack }) {
  const roster = save.clubs[save.myClubId].roster;
  const sorted = [...roster].sort((a, b) => posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]) || b.ovr - a.ovr);

  const groups = [];
  let lastGroup = null;
  for (const p of sorted) {
    const label = POS_GROUP_LABEL[p.pos[0]] || 'Outros';
    if (label !== lastGroup) { groups.push({ label, players: [] }); lastGroup = label; }
    groups[groups.length - 1].players.push(p);
  }

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#d4a23c', fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: 0 }}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 4 }}>Elenco</h2>
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>{roster.length} jogadores · 🌱 = da categoria de base</p>

      {groups.map(g => (
        <div key={g.label} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{g.label}</div>
          {g.players.map(p => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', marginBottom: 4 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.isYouth && '🌱 '}{p.isStar && '⭐ '}{p.name}
              </span>
              {p.isYouth && <span style={{ fontSize: 11, opacity: 0.5, fontFamily: "'Space Mono', monospace" }}>{p.age} anos</span>}
              {p.isYouth && p.potential > p.ovr && <span style={{ fontSize: 11, color: '#7fd99a', fontFamily: "'Space Mono', monospace" }}>pot. {p.potential}</span>}
              <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: ovrColor(p.ovr), fontSize: 13, minWidth: 20, textAlign: 'right' }}>{p.ovr}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
