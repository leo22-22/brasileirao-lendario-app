// Escudo de time na liga clássica: logo primeiro; sem logo, o emblema que o
// jogador escolheu para o próprio time (o mesmo do placar); sem nenhum dos
// dois, as iniciais na cor do time (TeamBadge).
import { useEffect, useState } from 'react';
import { TeamBadge } from '../../ui/index.jsx';

export function Crest({ logo, badge, name = '', color = '#0D3A29', size = 40, radius, ring = false, className = '' }) {
  const [failed, setFailed] = useState(!logo);
  useEffect(() => { setFailed(!logo); }, [logo]);
  const r = radius ?? size / 2;
  const style = { width: size, height: size, borderRadius: r, boxShadow: ring ? '0 0 0 2px var(--gold)' : undefined };
  if (logo && !failed) {
    return (
      <span className={`lg-crest-c ${className}`} style={style}>
        <img src={logo} alt="" onError={() => setFailed(true)} style={{ width: '68%', height: '68%' }} />
      </span>
    );
  }
  if (badge) {
    return <span className={`lg-crest-c ${className}`} style={{ ...style, fontSize: Math.round(size * 0.44) }} aria-hidden="true">{badge}</span>;
  }
  return <TeamBadge name={name} color={color} size={size} radius={r} />;
}
