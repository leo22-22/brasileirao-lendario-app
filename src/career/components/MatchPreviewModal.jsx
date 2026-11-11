// Prévia do próximo jogo (Modo Carreira) — pedido explícito do usuário
// (2026-11-12): clicar no card "Próximo jogo" do hub abre isso, com força
// de elenco (já considerando moral/fase, ver teamForSim em simHelpers.js),
// posição na tabela, sequência dos últimos 5 jogos e o time titular
// previsto de cada lado (mesma seleção que entraria em campo se a rodada
// fosse jogada agora — reaproveita teamForSim de verdade, não um cálculo
// à parte, pra nunca divergir do que a simulação realmente usaria).
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { posColor, ovrColor, posOrderIndex } from '../../lib/format.js';
import { teamForSim, clubForm } from '../engine/simHelpers.js';

// Cópia local de TeamCrest/FormDots (CareerHub.jsx) — evita import
// circular entre a tela e este modal (o hub é quem abre o modal).
const RESULT_COLORS = { V: '#7fd99a', D: '#e05050', E: 'rgba(244,241,234,0.6)' };

function TeamCrest({ teamId, size }) {
  const team = TEAMS.find(t => t.id === teamId);
  const logo = team && CLUB_LOGOS[team.club];
  return logo
    ? <img src={logo} alt={team.club} style={{ width: size, height: size, objectFit: 'contain' }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />;
}

function FormDots({ form }) {
  if (!form.length) return <span style={{ fontSize: 9.5, opacity: 0.35 }}>sem jogos</span>;
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {form.map((r, i) => (
        <span key={i} style={{
          width: 14, height: 14, borderRadius: 4, fontSize: 8.5, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: RESULT_COLORS[r], color: '#0B1A12',
        }}>{r}</span>
      ))}
    </div>
  );
}

function LineupColumn({ label, players, mc }) {
  const sorted = [...players].sort((a, b) => posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]));
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ display: 'grid', gap: 5 }}>
        {sorted.map(p => (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
            <span style={{ width: 26, flexShrink: 0, fontSize: 9.5, fontWeight: 700, color: posColor(p.pos[0]), fontFamily: "'Space Mono', monospace" }}>{p.pos[0]}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: ovrColor(p.ovr), fontSize: 11, flexShrink: 0 }}>{p.ovr}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchPreviewModal({ save, division, homeId, awayId, onClose }) {
  const mc = '#d4a23c';
  const homeTeam = TEAMS.find(t => t.id === homeId);
  const awayTeam = TEAMS.find(t => t.id === awayId);
  const homeSim = teamForSim(save, homeId);
  const awaySim = teamForSim(save, awayId);
  const total = homeSim.ovr + awaySim.ovr;
  const homePct = total > 0 ? Math.round((homeSim.ovr / total) * 100) : 50;
  const homeForm = clubForm(division, homeId, 5);
  const awayForm = clubForm(division, awayId, 5);
  const homePos = division.table.findIndex(r => r.id === homeId) + 1;
  const awayPos = division.table.findIndex(r => r.id === awayId) + 1;
  const homeStarters = homeSim.players.filter(p => !p.isBench);
  const awayStarters = awaySim.players.filter(p => !p.isBench);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 10000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px' }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 620, background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 18, padding: '24px 22px', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        }}
      >
        <button
          onClick={onClose}
          title="Fechar"
          style={{
            position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#F4F1EA',
            fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>

        <div style={{ fontSize: 10.5, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 14 }}>Prévia do confronto</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 18 }}>
          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
            <TeamCrest teamId={homeId} size={56} />
            <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{homeTeam.club}</div>
            <div style={{ fontSize: 10.5, opacity: 0.5, marginTop: 1 }}>{homePos}º lugar · Casa</div>
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center' }}><FormDots form={homeForm} /></div>
          </div>
          <div style={{ fontSize: 13, opacity: 0.4, fontWeight: 700, flexShrink: 0 }}>×</div>
          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
            <TeamCrest teamId={awayId} size={56} />
            <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{awayTeam.club}</div>
            <div style={{ fontSize: 10.5, opacity: 0.5, marginTop: 1 }}>{awayPos}º lugar · Fora</div>
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center' }}><FormDots form={awayForm} /></div>
          </div>
        </div>

        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 600, opacity: 0.7, marginBottom: 6 }}>
            <span>Força ({homePct}%){homeSim.ovr > awaySim.ovr * 1.001 ? ' 📈' : ''}</span>
            <span>Força ({100 - homePct}%){awaySim.ovr > homeSim.ovr * 1.001 ? ' 📈' : ''}</span>
          </div>
          <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${homePct}%`, background: 'rgba(255,255,255,0.35)' }} />
            <div style={{ width: `${100 - homePct}%`, background: 'linear-gradient(90deg, #d4a23c, #f0c868)' }} />
          </div>
          <div style={{ fontSize: 10, opacity: 0.4, marginTop: 6, textAlign: 'center' }}>Força de elenco já considera a fase recente de cada time (sequência de resultados).</div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          <LineupColumn label={`${homeTeam.club} — titulares previstos`} players={homeStarters} mc={mc} />
          <LineupColumn label={`${awayTeam.club} — titulares previstos`} players={awayStarters} mc={mc} />
        </div>
      </div>
    </div>
  );
}
