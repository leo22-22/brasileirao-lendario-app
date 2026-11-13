// Rankings de jogadores a partir dos acumulados do motor — puro. Usado pela
// aba Estatísticas da liga, painel da Copa, tela de resultado e carreira.
// Formato do motor (chave "timeId::nome"): scorers {goals}, assisters
// {assists}, cleanSheets {clean}, seasonRatings {sum,count}, cardCounts n
// (amarelos da temporada), redCards n.

export const MIN_GAMES_FOR_RATING = 3;

export function splitPlayerKey(key) {
  const i = key.indexOf('::');
  return { teamId: key.slice(0, i), name: key.slice(i + 2) };
}

/**
 * keep(teamId) → boolean (recorte: liga, só meu time…). teamName(teamId, fallbackLabel) → texto.
 * Devolve listas ordenadas: [{ key, teamId, name, team, v, display, red? }]
 */
export function buildLeaderboards({ scorers, assisters, cleanSheets, seasonRatings, cardCounts, redCards, keep = () => true, teamName = (id, l) => l || id, minGames = MIN_GAMES_FOR_RATING }) {
  const build = (obj, value, display, filter = () => true) => Object.entries(obj || {})
    .map(([key, d]) => ({ key, ...splitPlayerKey(key), d }))
    .filter(r => keep(r.teamId) && filter(r.d, r.key))
    .map(r => ({ key: r.key, teamId: r.teamId, name: r.name, team: teamName(r.teamId, r.d?.teamLabel), v: value(r.d, r.key), display: display(r.d, r.key), red: redCards?.[r.key] || 0 }))
    .filter(r => r.v > 0)
    .sort((a, b) => b.v - a.v || a.name.localeCompare(b.name));
  const cardKeys = { ...Object.fromEntries(Object.keys(redCards || {}).map(k => [k, 0])), ...(cardCounts || {}) };
  return {
    goals: build(scorers, d => d.goals, d => d.goals),
    assists: build(assisters, d => d.assists, d => d.assists),
    clean: build(cleanSheets, d => d.clean, d => d.clean),
    ratings: build(seasonRatings, d => d.sum / d.count, d => (d.sum / d.count).toFixed(1).replace('.', ','), d => d.count >= minGames),
    cards: build(cardKeys, (y, k) => (y || 0) + (redCards?.[k] || 0), (y, k) => (y || 0) + (redCards?.[k] || 0)),
  };
}
