// Categoria de base do Modo Carreira — pedido explícito do usuário
// (2026-11-06): uma tela própria pros jovens gerados a cada temporada
// (youth.js), separados do elenco profissional (Elenco/Formação/Mercado
// já filtram `inAcademy`, ver teamForSim em simHelpers.js) até o usuário
// promover ou o jogador completar 20 anos (graduação automática, ver o
// laço de envelhecimento em seasonEngine.js). O potencial é mostrado como
// uma FAIXA ("65 → 75-82"), não um teto fixo — o motor internamente usa um
// número só (`potential`, aging.js), mas pro jogador isso é sempre
// incerto, igual olheiro nenhum garante nada.
import { backButtonStyle } from '../components/styles.js';
import { ovrColor, posOrderIndex, posColor } from '../../lib/format.js';

function potentialRange(p) {
  if (!p.growthPerSeason) return null; // sem chance de crescer sorteada — potencial = overall atual
  const low = Math.max(p.ovr, p.potential - 5);
  const high = Math.min(99, p.potential + 3);
  return { low, high };
}

function PosBadge({ pos }) {
  const c = posColor(pos);
  return (
    <span style={{
      width: 34, flexShrink: 0, textAlign: 'center', fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3,
      fontFamily: 'var(--font-mono)', padding: '3px 0', borderRadius: 6,
      color: c, background: `${c}22`, border: `1px solid ${c}55`,
    }}>{pos}</span>
  );
}

export function CareerYouthScreen({ save, onPromote, onBack }) {
  const roster = save.clubs[save.myClubId].roster;
  const academy = roster.filter(p => p.inAcademy).sort((a, b) => posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]) || b.ovr - a.ovr);

  return (
    <div style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={backButtonStyle}>← Voltar</button>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginBottom: 4 }}>🌱 Categoria de Base</h2>
      <p style={{ fontSize: 11.5, opacity: 0.55, marginBottom: 16, lineHeight: 1.4 }}>
        Jovens revelados pela base ficam aqui — não entram em campo nem podem ser negociados até você promover pro elenco profissional, ou automaticamente quando completam 20 anos.
      </p>

      {academy.length === 0 && (
        <p style={{ fontSize: 12.5, opacity: 0.5, textAlign: 'center', padding: '24px 0' }}>Nenhum jovem na base agora — todo fim de temporada o clube revela 2 ou 3 novos.</p>
      )}

      {academy.map(p => {
        const range = potentialRange(p);
        return (
          <div key={p.name} style={{
            padding: '12px 14px', borderRadius: 10, marginBottom: 8,
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderLeft: `3px solid ${posColor(p.pos[0])}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <PosBadge pos={p.pos[0]} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}{p.isStar && <span title="Joia rara" style={{ marginLeft: 5 }}>💎</span>}
                </div>
                <div style={{ fontSize: 11, opacity: 0.55 }}>{p.age} anos</div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: ovrColor(p.ovr), fontSize: 15 }}>{p.ovr}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11.5, opacity: 0.75 }}>
                {range ? <>Potencial: <b style={{ color: 'var(--gold-ink)' }}>{range.low}-{range.high}</b></> : 'Sem potencial de crescimento'}
              </span>
              <button
                onClick={() => onPromote(p.name)}
                style={{ padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(31,122,77,0.5)', background: 'rgba(31,122,77,0.12)', color: 'var(--success)' }}
              >⬆️ Promover</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
