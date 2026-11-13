// Aba Elenco da liga clássica — usa a PlayerList compartilhada (a mesma do
// Elenco da carreira). Só apresentação: titulares/banco/desfalques chegam
// prontos do App.jsx (buildSquadView, mesma troca automática da simulação).
import { PlayerList } from '../../components/football/PlayerList.jsx';
import { Icon } from '../../ui/index.jsx';
import { splitTeamLabel } from './TableTab.jsx';

const fmt1 = (n) => n.toFixed(1).replace('.', ',');

/**
 * starters/bench/unavailable: jogadores do meu time (unavailable com reason/replacementName/shortOnSubs).
 * assignedPosOf(p) → posição da vaga em que ele joga (titulares) | null.
 * statsOf(p) → { j, g, a, avg } (null quando o modo não tem o dado).
 * captainBonus: bônus do capitão já somado no OVR do motor.
 */
export function SquadTab({ starters, bench, unavailable, assignedPosOf, statsOf, captainBonus = 2, hasStats }) {
  const understaffed = unavailable.some(p => p.shortOnSubs);
  const tagsOf = (p) => {
    const t = [];
    if (p.isCaptain) t.push({ id: 'cap', label: `Capitão +${captainBonus}` });
    if (p.reason === 'suspenso') t.push({ id: 'susp', label: 'Suspenso' });
    if (p.reason === 'lesionado') t.push({ id: 'susp', label: 'Lesionado' });
    return t;
  };
  const posOf = (p) => (p.isBench || p.reason ? null : assignedPosOf(p)) || p.pos?.[0] || '-';
  const subOf = (p) => {
    const bits = [];
    const assigned = p.isBench || p.reason ? null : assignedPosOf(p);
    const all = (p.pos || []).join(' · ');
    if (all) bits.push(assigned && assigned !== p.pos?.[0] ? `${all} · joga de ${assigned}` : all);
    if (p.isCaptain) bits.push(`OVR base ${p.ovr - captainBonus}`);
    if (p.replacementName) bits.push(`entra ${p.replacementName}`);
    if (p.shortOnSubs) bits.push('sem reserva na posição');
    return bits.join(' · ');
  };
  const origin = (p) => {
    if (p.teamLabel) return splitTeamLabel(p.teamLabel).name;
    return [p.club, p.year].filter(Boolean).join(' ') || '—';
  };
  const columns = [
    { key: 'orig', label: 'Origem', className: 'lg-sq-orig', hideMobile: true, render: (p) => <span className="lg-ell" title={p.teamLabel || undefined}>{origin(p)}</span> },
    ...(hasStats ? [
      { key: 'j', label: 'J', align: 'r', className: 'sq-num', hideMobile: true, render: (p) => statsOf(p).j },
      { key: 'g', label: 'G', align: 'r', className: 'sq-num', hideMobile: true, render: (p) => statsOf(p).g },
      { key: 'a', label: 'A', align: 'r', className: 'sq-num', hideMobile: true, render: (p) => statsOf(p).a },
      { key: 'avg', label: 'Nota', align: 'r', className: 'sq-num', hideMobile: true, render: (p) => { const s = statsOf(p); return s.avg == null ? '—' : fmt1(s.avg); } },
    ] : []),
  ];
  const groups = [
    { key: 'tit', label: 'Titulares', dot: 'var(--green)', players: starters },
    { key: 'res', label: 'Banco', dot: 'var(--gold)', players: bench },
    { key: 'out', label: 'Desfalques', dot: 'var(--danger)', players: unavailable },
  ].filter(g => g.players.length > 0);

  return (
    <div className="lg-card lg-sq">
      <div className="lg-tb-h">
        <div style={{ minWidth: 0 }}>
          <span className="lg-mono">Meu elenco · {starters.length + bench.length + unavailable.length} jogadores</span>
          <h2>Elenco</h2>
          <p>Titulares já com a troca automática de suspensos e lesionados, igual à simulação da rodada. O capitão joga com +{captainBonus} de OVR.</p>
        </div>
      </div>
      {understaffed && (
        <div className="lg-sq-alert" role="status"><Icon name="warning" size={16} />Time desfalcado: não há reserva disponível para uma posição.</div>
      )}
      <PlayerList
        className="lg-sq-list"
        groups={groups}
        columns={columns}
        getId={(p) => `${p.name}-${p.reason || (p.isBench ? 'b' : 't')}`}
        getPos={posOf}
        getSub={subOf}
        getTags={tagsOf}
        rowLabel={(p) => `${posOf(p)}: ${p.name}, OVR ${p.ovr}${p.isCaptain ? `, capitão (+${captainBonus})` : ''}${p.reason ? `, ${p.reason}` : ''}`}
        ariaLabel="Jogadores do meu elenco"
      />
    </div>
  );
}
