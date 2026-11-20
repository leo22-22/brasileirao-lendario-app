// Modelo de exibição da galeria de conquistas. Só lê o catálogo, as categorias
// e getAchievementProgress (que continuam em App.jsx). Não decide desbloqueio:
// "alcançado" é sempre o que está em user.achievements.

// Marcos escritos à mão que são o mesmo contador de uma família de níveis.
// Mapa só de UI: não muda id nem condição de nenhuma conquista.
export const MANUAL_MILESTONES = {
  titles: [{ id: 'first_title', n: 1 }, { id: 'dynasty', n: 3 }],
  seasons: [{ id: 'veteran', n: 10 }],
  mpwins: [{ id: 'multiplayer_win', n: 1 }, { id: 'multiplayer_veteran', n: 10 }],
};

// Título, descrição curta e unidade de cada trilha. `fields` são os campos de
// `user` que alimentam o contador: se nenhum existir, o número grande some.
export const TRACK_META = {
  goals: { title: 'Gols na carreira', desc: 'Todos os gols marcados com a conta', unit: 'gols', fields: ['career_goals'] },
  assists: { title: 'Assistências na carreira', desc: 'Todas as assistências com a conta', unit: 'assistências', fields: ['career_assists'] },
  conceded: { title: 'Gols sofridos', desc: 'Todos os gols sofridos com a conta', unit: 'gols sofridos', fields: ['career_conceded'] },
  matches: { title: 'Partidas disputadas', desc: 'Jogos somados de todas as temporadas', unit: 'partidas', fields: ['career_matches_played'] },
  wins: { title: 'Vitórias', desc: 'Vitórias somadas de todas as temporadas', unit: 'vitórias', fields: ['career_wins'] },
  draws: { title: 'Empates', desc: 'Empates somados de todas as temporadas', unit: 'empates', fields: ['career_draws'] },
  losses: { title: 'Derrotas', desc: 'Derrotas somadas de todas as temporadas', unit: 'derrotas', fields: ['career_losses'] },
  squad_ovr: { title: 'Craque no elenco', desc: 'Maior overall de um jogador que você escalou', unit: 'OVR', fields: ['best_player_ovr'] },
  team_ovr: { title: 'Time mais forte', desc: 'Maior overall médio de um time seu', unit: 'OVR', fields: ['best_team_ovr'] },
  goal_diff: { title: 'Saldo de gols', desc: 'Melhor saldo numa temporada ou copa', unit: 'de saldo', fields: ['best_goal_diff'], signed: true },
  titles: { title: 'Títulos na conta', desc: 'Brasileirão e Copa do Brasil somados', unit: 'títulos', fields: ['titles_brasileirao', 'titles_copa'] },
  seasons: { title: 'Temporadas jogadas', desc: 'Todas as temporadas completas', unit: 'temporadas', fields: ['seasons_played'] },
  mpwins: { title: 'Vitórias no multiplayer', desc: 'Temporadas vencidas jogando com amigos', unit: 'vitórias', fields: ['multiplayer_wins'] },
};

const ICON_BY_PREFIX = {
  goals: 'ball', season_goals: 'ball', assists: 'boot', conceded: 'shield',
  matches: 'calendar', seasons: 'calendar', wins: 'table', draws: 'table', losses: 'table', goal_diff: 'table',
  squad_ovr: 'shirt', team_ovr: 'shirt', titles: 'trophy', mpwins: 'trophy',
};
const ICON_BY_ID = {
  veteran: 'calendar', golden_boot: 'boot', podium_finish: 'podium', top5_finish: 'podium', top10_finish: 'podium',
  unbeaten_season: 'shield', perfect_double: 'shield', turbulent_season: 'lock', serieab_promoted: 'table',
};

/** Nome do ícone (src/ui/icons.jsx) para uma conquista. Fallback: troféu. */
export function iconForAchievement(id) {
  if (ICON_BY_ID[id]) return ICON_BY_ID[id];
  if (id.startsWith('unbeaten_')) return 'shield';
  const m = id.match(/^([a-z_]+?)_\d+$/);
  if (m && ICON_BY_PREFIX[m[1]]) return ICON_BY_PREFIX[m[1]];
  return 'trophy';
}

// Ouro/prata/bronze só onde a ordem é objetiva; o resto desbloqueado é dourado.
const MEDAL_TONE_BY_ID = { podium_finish: 'gold', top5_finish: 'silver', top10_finish: 'bronze' };
export function medalToneFor(id, unlocked) {
  if (!unlocked) return 'locked';
  return MEDAL_TONE_BY_ID[id] || 'gold';
}

export const fmt = n => Number(n).toLocaleString('pt-BR');
export const compact = n => (n >= 1000 ? `${String(n / 1000).replace('.', ',')}k` : String(n));
export const normalize = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const has = v => v !== undefined && v !== null && !Number.isNaN(Number(v));

/**
 * Monta tudo o que a galeria desenha a partir dos dados do jogo.
 * status de cada conquista: 'unlocked' | 'progress' (não desbloqueada, current > 0) | 'locked'.
 */
export function buildAchievementModel({ catalog, categories, fieldByPrefix, getProgress, user }) {
  const unlockedSet = new Set((user?.achievements || []).filter(id => catalog[id]));
  const ids = Object.keys(catalog);

  const progressOf = {};
  const statusOf = {};
  ids.forEach(id => {
    const p = getProgress(id, user || {});
    progressOf[id] = p;
    statusOf[id] = unlockedSet.has(id) ? 'unlocked' : (p && p.current > 0 ? 'progress' : 'locked');
  });

  const categoryOf = {};
  categories.forEach(c => c.ids.forEach(id => { if (!categoryOf[id]) categoryOf[id] = c.label; }));

  // Famílias de níveis: mesmo prefixo de ACH_FIELD_BY_PREFIX + marcos manuais.
  const prefixes = Object.keys(fieldByPrefix);
  const tierRe = new RegExp(`^(${prefixes.join('|')})_(\\d+)$`);
  const trackOfId = {};
  const tracks = {};
  ids.forEach(id => {
    const m = id.match(tierRe);
    if (!m) return;
    (tracks[m[1]] ||= []).push({ id, n: Number(m[2]) });
  });
  Object.entries(MANUAL_MILESTONES).forEach(([prefix, list]) => {
    if (!tracks[prefix]) return;
    list.forEach(ms => { if (catalog[ms.id]) tracks[prefix].push(ms); });
  });
  const trackList = Object.entries(tracks).map(([prefix, milestones]) => {
    milestones.sort((a, b) => a.n - b.n);
    milestones.forEach(ms => { trackOfId[ms.id] = prefix; });
    const meta = TRACK_META[prefix] || { title: prefix, desc: '', unit: '', fields: [] };
    const probe = getProgress(`${prefix}_${milestones.find(ms => tierRe.test(ms.id))?.n}`, user || {});
    const hasField = meta.fields.some(f => has(user?.[f]));
    const rawCurrent = meta.signed && has(user?.best_goal_diff) ? Number(user.best_goal_diff) : probe?.current;
    const states = milestones.map(ms => ({ ...ms, label: catalog[ms.id].label, manual: !tierRe.test(ms.id), done: unlockedSet.has(ms.id) }));
    const nextIdx = states.findIndex(s => !s.done);
    return {
      prefix, ...meta, icon: ICON_BY_PREFIX[prefix] || 'trophy',
      current: hasField && has(rawCurrent) ? rawCurrent : null,
      progressCurrent: probe?.current ?? 0,
      milestones: states,
      nextIdx,
      doneCount: states.filter(s => s.done).length,
    };
  });

  // Seções por categoria: trilhas (na ordem em que aparecem) e medalhas.
  const sections = categories.map(c => {
    const trackPrefixes = [];
    const medals = [];
    c.ids.forEach(id => {
      if (!catalog[id]) return;
      const t = trackOfId[id];
      if (t) { if (!trackPrefixes.includes(t)) trackPrefixes.push(t); } else medals.push(id);
    });
    const valid = c.ids.filter(id => catalog[id]);
    return {
      label: c.label,
      ids: valid,
      unlocked: valid.filter(id => unlockedSet.has(id)).length,
      tracks: trackPrefixes.map(p => trackList.find(t => t.prefix === p)).filter(Boolean),
      medals,
    };
  });

  // Um card por família (o nível mais perto), pra não repetir a mesma trilha.
  const seenFamily = new Set();
  const near = ids
    .filter(id => statusOf[id] === 'progress' && progressOf[id].target > 0)
    .map(id => ({ id, ratio: progressOf[id].current / progressOf[id].target }))
    .filter(x => x.ratio < 1) // já bateu a meta: o servidor libera no próximo resultado
    .sort((a, b) => b.ratio - a.ratio)
    .filter(x => {
      const fam = trackOfId[x.id] || x.id;
      if (seenFamily.has(fam)) return false;
      seenFamily.add(fam);
      return true;
    })
    .slice(0, 4)
    .map(x => x.id);

  return { unlockedSet, total: ids.length, unlockedCount: unlockedSet.size, progressOf, statusOf, categoryOf, sections, near };
}
