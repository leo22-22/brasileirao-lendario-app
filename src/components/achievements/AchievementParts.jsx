// Peças da galeria de conquistas (tema creme). Componentes só de exibição:
// recebem a conquista do catálogo e o progresso já calculado por
// getAchievementProgress. Os emojis do catálogo nunca são renderizados.
import { Icon } from '../../ui/icons.jsx';
import { compact, fmt, iconForAchievement, medalToneFor } from './achievementModel.js';
import './achievements.css';

export function MedalBadge({ tone = 'gold', icon = 'trophy', size = 44 }) {
  return (
    <span className={`ach-md ach-md-${tone}`} style={{ width: size, height: size }} aria-hidden="true">
      <Icon name={icon} size={Math.round(size * 0.45)} />
    </span>
  );
}

export function AchievementBar({ current, target, label }) {
  const pct = target > 0 ? Math.min(100, Math.round((Math.max(0, current) / target) * 100)) : 0;
  return (
    <div className="ach-pb" role="progressbar" aria-valuenow={Math.min(current, target)} aria-valuemin={0} aria-valuemax={target} aria-label={label}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Conquista única/binária: ícone em medalha, label, descrição e tag de estado. */
export function AchievementMedal({ id, achievement, unlocked, tone }) {
  if (!achievement) return null;
  const t = tone || medalToneFor(id, unlocked);
  return (
    <div className={`ach-mc${unlocked ? ' got' : ' locked'}`}>
      <MedalBadge tone={unlocked ? t : 'locked'} icon={iconForAchievement(id)} />
      <div className="ach-mc-body">
        <b>{achievement.label}</b>
        <p>{achievement.desc}</p>
        <span className={`ach-tg ${unlocked ? 'ok' : 'lk'}`}>{unlocked ? 'Desbloqueada' : 'Bloqueada'}</span>
      </div>
    </div>
  );
}

/** Conquista ainda bloqueada com contador: barra dourada, "current / target" e %. */
export function AchievementNearCard({ id, achievement, categoryLabel, progress }) {
  if (!achievement || !progress) return null;
  const pct = progress.target > 0 ? Math.min(100, Math.round((progress.current / progress.target) * 100)) : 0;
  return (
    <div className="ach-nc">
      <div className="ach-nc-top">
        <MedalBadge tone="locked" icon={iconForAchievement(id)} />
        <div className="ach-nc-txt">
          <b>{achievement.label}</b>
          {categoryLabel && <small>{categoryLabel}</small>}
        </div>
      </div>
      <AchievementBar current={progress.current} target={progress.target} label={`Progresso de ${achievement.label}`} />
      <div className="ach-pv">
        <span>{fmt(Math.min(progress.current, progress.target))} / {fmt(progress.target)}</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

// Janela de marcos visíveis: os `max - 1` mais próximos do próximo marco e um
// círculo "+N" com os que ficaram de fora.
function visibleMilestones(milestones, nextIdx, max) {
  const total = milestones.length;
  if (total <= max) return { items: milestones.map((m, i) => ({ ...m, i })), more: null };
  const k = max - 1;
  const anchor = nextIdx === -1 ? total : nextIdx;
  const start = Math.max(0, Math.min(anchor - Math.floor(k / 2), total - k));
  const items = milestones.slice(start, start + k).map((m, j) => ({ ...m, i: start + j }));
  const after = total - (start + k);
  if (after > 0) return { items, more: { count: after, position: 'end' } };
  return { items, more: { count: start, position: 'start' } };
}

function trackTone(track) {
  if (track.doneCount === 0) return 'locked';
  const r = track.doneCount / track.milestones.length;
  if (r >= 2 / 3) return 'gold';
  if (r >= 1 / 3) return 'silver';
  return 'bronze';
}

/** Família de níveis num card só, com trilho horizontal de marcos. */
export function AchievementTrack({ track, maxVisible = 8 }) {
  const { items, more } = visibleMilestones(track.milestones, track.nextIdx, maxVisible);
  const next = track.nextIdx === -1 ? null : track.milestones[track.nextIdx];
  const cells = [];
  if (more?.position === 'start') cells.push({ kind: 'more', count: more.count, done: true });
  items.forEach(m => cells.push({ kind: 'm', ...m, state: m.done ? 'done' : (m.i === track.nextIdx ? 'next' : 'lock') }));
  if (more?.position === 'end') cells.push({ kind: 'more', count: more.count, done: false });
  const n = cells.length;
  const pos = i => ((i + 0.5) / n) * 100;
  let lastDone = -1;
  cells.forEach((c, i) => { if (c.state === 'done' || (c.kind === 'more' && c.done)) lastDone = i; });
  const remaining = next ? Math.max(0, next.n - track.progressCurrent) : 0;
  const curText = track.current == null ? null : `${track.signed && track.current > 0 ? '+' : ''}${fmt(track.current)}`;

  return (
    <div className="ach-trk">
      <div className="ach-trk-hd">
        <MedalBadge tone={trackTone(track)} icon={track.icon} />
        <div className="ach-trk-ttl">
          <h3>{track.title}</h3>
          {track.desc && <small>{track.desc}</small>}
        </div>
        {curText != null && (
          <div className="ach-trk-cur"><b>{curText}</b><small>{track.unit}</small></div>
        )}
      </div>
      <div className="ach-rail" style={{ '--cell': `${100 / n}%` }}>
        <div className="ach-rail-ln" style={{ left: `${pos(0)}%`, right: `${100 - pos(n - 1)}%` }} />
        {lastDone > 0 && <div className="ach-rail-fl" style={{ left: `${pos(0)}%`, width: `${pos(lastDone) - pos(0)}%` }} />}
        {cells.map((c, i) => (
          <div key={c.kind === 'more' ? `more-${c.count}` : c.id} className="ach-st" style={{ left: `${pos(i)}%` }}
            title={c.kind === 'm' ? c.label : `${c.count} marcos ${c.done ? 'anteriores' : 'seguintes'}`}>
            {c.kind === 'more'
              ? <><i className={c.done ? 'done' : 'lock'}>+{c.count}</i><span>{c.done ? 'anteriores' : 'mais'}</span></>
              : <>
                  <i className={c.state}>{compact(c.n)}</i>
                  <span className={c.state === 'next' ? 'n' : ''}>{c.state === 'next' ? 'próximo' : (c.manual ? c.label : fmt(c.n))}</span>
                </>}
          </div>
        ))}
      </div>
      <div className="ach-trk-nx">
        {next
          ? <><span>Próximo marco: <b>{next.label}</b></span>{remaining > 0 && <span className="ach-mono ach-gold">faltam {fmt(remaining)}</span>}</>
          : <span className="ach-done-all"><Icon name="check" size={15} /> Trilha completa</span>}
      </div>
    </div>
  );
}
