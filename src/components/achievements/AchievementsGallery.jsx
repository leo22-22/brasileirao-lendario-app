// Galeria de conquistas em painel largo (tema creme). Abre por Layer (portal +
// escala de z-index), fecha com Esc, clique fora ou "Voltar" — todos no mesmo
// onClose. Dados: catálogo/categorias/getAchievementProgress vindos de App.jsx.
import { useMemo, useState } from 'react';
import { Icon } from '../../ui/icons.jsx';
import { Layer, useMediaQuery } from '../../ui/primitives.jsx';
import { AchievementMedal, AchievementNearCard, AchievementTrack } from './AchievementParts.jsx';
import { buildAchievementModel, fmt, normalize } from './achievementModel.js';
import './achievements.css';

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'unlocked', label: 'Desbloqueadas' },
  { key: 'progress', label: 'Em progresso' },
  { key: 'locked', label: 'Bloqueadas' },
];

const has = v => v !== undefined && v !== null && !Number.isNaN(Number(v));

function heroStats(user) {
  const out = [];
  if (has(user.titles_brasileirao) || has(user.titles_copa)) out.push({ k: 'Títulos', v: fmt((Number(user.titles_brasileirao) || 0) + (Number(user.titles_copa) || 0)) });
  if (has(user.seasons_played)) out.push({ k: 'Temporadas', v: fmt(user.seasons_played) });
  if (has(user.career_goals)) out.push({ k: 'Gols', v: fmt(user.career_goals) });
  if (has(user.best_team_ovr)) out.push({ k: 'Melhor time', v: `${user.best_team_ovr} OVR` });
  if (has(user.best_goal_diff)) out.push({ k: 'Melhor saldo', v: `${user.best_goal_diff > 0 ? '+' : ''}${fmt(user.best_goal_diff)}` });
  return out.slice(0, 5);
}

export default function AchievementsGallery({ user, catalog, categories, fieldByPrefix, getProgress, onClose }) {
  const model = useMemo(
    () => buildAchievementModel({ catalog, categories, fieldByPrefix, getProgress, user }),
    [catalog, categories, fieldByPrefix, getProgress, user],
  );
  const [active, setActive] = useState(0);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const isMobile = useMediaQuery('(max-width: 640px)');
  const maxVisible = isMobile ? 5 : 8;

  const q = normalize(query.trim());
  const matchesQuery = id => !q || normalize(catalog[id].label).includes(q) || normalize(catalog[id].desc).includes(q);
  const matchesFilter = id => filter === 'all' || model.statusOf[id] === filter;
  const keep = id => matchesQuery(id) && matchesFilter(id);

  // Com busca: todas as categorias, agrupadas. Sem busca: só a ativa.
  const shownSections = (q ? model.sections : [model.sections[active]])
    .map(s => ({
      ...s,
      allMedals: s.medals,
      tracks: s.tracks.filter(t => t.milestones.some(m => keep(m.id))),
      medals: s.medals.filter(keep),
    }))
    .filter(s => !q || s.tracks.length || s.medals.length);

  const scopeIds = q ? model.sections.flatMap(s => s.ids).filter(matchesQuery) : model.sections[active].ids;
  const uniqueScope = [...new Set(scopeIds)];
  const filterCount = key => (key === 'all' ? uniqueScope.length : uniqueScope.filter(id => model.statusOf[id] === key).length);

  const stats = heroStats(user);
  const ringPct = model.total ? (model.unlockedCount / model.total) * 100 : 0;
  const teamName = (user.team_name || '').trim();

  return (
    <Layer onClose={onClose}>
      <div className="ach-overlay" onClick={onClose}>
        <div className="ach-panel" role="dialog" aria-modal="true" aria-labelledby="ach-title" onClick={e => e.stopPropagation()}>
          <div className="ach-wrap">
            <button type="button" className="ach-back" onClick={onClose}>
              <Icon name="arrowLeft" size={15} /> Voltar
            </button>

            <section className="ach-hero on-dark">
              <div className="ach-hero-ring-deco" aria-hidden="true" />
              <div className="ach-ring" style={{ '--p': ringPct }} role="img" aria-label={`${model.unlockedCount} de ${model.total} conquistas desbloqueadas`}>
                <div><b>{fmt(model.unlockedCount)}</b><small>de {fmt(model.total)}</small></div>
              </div>
              <div className="ach-hero-txt">
                <span className="ach-mono ach-eyebrow">{teamName ? `Conquistas · ${teamName}` : 'Conquistas'}</span>
                <h1 id="ach-title">Sua galeria de conquistas</h1>
                {stats.length > 0 && (
                  <div className="ach-hst">
                    {stats.map(s => <div key={s.k}><small>{s.k}</small><b>{s.v}</b></div>)}
                  </div>
                )}
              </div>
            </section>

            {model.near.length > 0 && (
              <section>
                <div className="ach-sh"><h2>Quase lá</h2><span className="ach-small">As conquistas mais perto de desbloquear</span></div>
                <div className="ach-near">
                  {model.near.map(id => (
                    <AchievementNearCard key={id} id={id} achievement={catalog[id]} categoryLabel={model.categoryOf[id]} progress={model.progressOf[id]} />
                  ))}
                </div>
              </section>
            )}

            <div className="ach-lay">
              <nav className={`ach-cats${q ? ' dim' : ''}`} role="tablist" aria-label="Categorias de conquistas">
                {model.sections.map((s, i) => (
                  <button key={s.label} type="button" role="tab" aria-selected={!q && i === active}
                    className={`ach-ct${!q && i === active ? ' on' : ''}`}
                    onClick={() => { setActive(i); setQuery(''); }}>
                    <span className="ach-ct-l">{s.label}</span>
                    <span className="ach-ct-n">{s.unlocked}/{s.ids.length}</span>
                  </button>
                ))}
              </nav>

              <div className="ach-main" role="tabpanel">
                <div className="ach-tb">
                  <div className="ach-seg" role="group" aria-label="Filtrar conquistas">
                    {FILTERS.map(f => (
                      <button key={f.key} type="button" aria-pressed={filter === f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
                        {f.label}<span className="ach-seg-n">{filterCount(f.key)}</span>
                      </button>
                    ))}
                  </div>
                  <label className="ach-search">
                    <Icon name="search" size={16} />
                    <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar conquista…" aria-label="Buscar conquista" />
                  </label>
                </div>

                {shownSections.length === 0 || shownSections.every(s => !s.tracks.length && !s.medals.length) ? (
                  <div className="ach-empty">Nenhuma conquista encontrada{q ? ` para “${query.trim()}”` : ' com esse filtro'}.</div>
                ) : shownSections.map(s => {
                  const medalUnlocked = s.allMedals.filter(id => model.unlockedSet.has(id)).length;
                  return (
                    <div key={s.label} className="ach-group">
                      {q && <h2 className="ach-group-h">{s.label}</h2>}
                      {s.tracks.map(t => <AchievementTrack key={t.prefix} track={t} maxVisible={maxVisible} />)}
                      {s.medals.length > 0 && (
                        <>
                          <div className="ach-sh ach-sh-sm"><h2>Medalhas</h2><span className="ach-small">{medalUnlocked} de {s.allMedals.length} desbloqueadas{q ? '' : ' nesta categoria'}</span></div>
                          <div className="ach-medals">
                            {s.medals.map(id => <AchievementMedal key={id} id={id} achievement={catalog[id]} unlocked={model.unlockedSet.has(id)} />)}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layer>
  );
}
