// Escudo de time — ÚNICA versão para todo o app (carreira, liga clássica,
// Copa, Simulador, calendários, resultado). Por cima do TeamBadge (ui/):
// logo → emblema escolhido pelo jogador → iniciais na cor do clube.
// Aceita o clube por `id` (TEAMS), por objeto de time (`team`, com clubLogo/
// logo/badge/colors) ou por props diretas.
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { TeamBadge } from '../../ui/index.jsx';
import './clubCrest.css';

const byId = new Map(TEAMS.map(t => [t.id, t]));

function resolve({ id, team, logo, badge, name, color }) {
  const t = team || (id ? byId.get(id) : null);
  return {
    known: !!(t || logo || badge || name),
    logo: logo ?? t?.clubLogo ?? t?.logo ?? (t?.club ? CLUB_LOGOS[t.club] : null) ?? null,
    badge: badge ?? t?.badge ?? null,
    name: name ?? t?.club ?? t?.label ?? '',
    color: color ?? t?.colors?.p ?? t?.color ?? '#0D3A29',
  };
}

/**
 * size: diâmetro total. radius: raio (padrão = círculo).
 * frame: envolve num círculo creme (escudo menor dentro) — `frameClass` troca o
 *   estilo do aro (ex.: 'sm-crest-ring'), `scale` o tamanho do escudo dentro.
 * ringColor: borda colorida (ex.: resultado V/E/D no calendário).
 * unknown: o que mostrar se o clube não existe: 'q' (interrogação) ou 'blank'.
 */
export function ClubCrest({ id, team, logo, badge, name, color, size = 22, radius, ring = false, frame = false, frameClass, scale = 0.7, innerRadius, frameRadius, ringColor, unknown = null, unknownClass, title }) {
  const r = resolve({ id, team, logo, badge, name, color });
  if (!r.known && unknown) {
    return <span className={unknownClass || 'fb-crest-q'} style={{ width: size, height: size }} aria-hidden="true">{unknown === 'q' ? '?' : null}</span>;
  }
  if (frame || ringColor) {
    const inner = Math.round(size * scale);
    return (
      <span className={frameClass || 'fb-crest-frame'} style={{ width: size, height: size, ...(frameRadius != null ? { borderRadius: frameRadius } : null), ...(ringColor ? { boxShadow: `inset 0 0 0 2px ${ringColor}` } : null) }} title={title}>
        <TeamBadge src={r.logo} badge={r.badge} name={r.name} color={r.color} size={inner} radius={innerRadius ?? inner / 2} />
      </span>
    );
  }
  return <TeamBadge src={r.logo} badge={r.badge} name={r.name} color={r.color} size={size} radius={radius ?? size / 2} ring={ring} />;
}
