// Estatísticas de jogador por temporada (Modo Carreira) — partidas, gols,
// assistências, jogos sem sofrer gol e cartões, acumulados de TODA partida
// resolvida (Brasileirão das duas divisões + Copa do Brasil, time do
// usuário e da IA) pra alimentar o relatório de fim de temporada
// (CareerSeasonReportScreen.jsx). `simAiMatch`/`legPackage` (App.jsx) já
// geram gol com artilheiro/assistência e cartão por jogador em TODA
// partida — isso só estava sendo descartado antes, guardando só o placar.
//
// Chave por clube+nome, não só nome — mesmo motivo que o modo clássico já
// usa pros rankings de artilheiro/assistência (App.jsx, playerKey): nome
// real se repete em elencos de clubes diferentes.
function playerKey(clubId, name) {
  return `${clubId}::${name}`;
}

const EMPTY_PLAYER_STATS = { matches: 0, goals: 0, assists: 0, cleanSheets: 0, yellows: 0, reds: 0 };

// `match` = {homeId, awayId, homeGoals, awayGoals, events, ratings,
// homeGkName, awayGkName}. `events` é uma lista achatada de gol+cartão
// (mesmo formato que `buildLiveMatchEvents`/`simAiMatch` já produzem —
// goal:{type:'goal',teamId,scorer,assist,isOwnGoal}, cartão:
// {type:'yellow'|'red',teamId,player}); `ratings` é a lista de quem jogou
// (mesmo formato de `computeMatchRatings`: {name,teamId,...}), usada só
// pra contar presença (jogos disputados).
export function accumulateMatchStats(stats, match) {
  const { homeId, awayId, homeGoals, awayGoals, events = [], ratings = [], homeGkName, awayGkName } = match;
  const next = { ...stats };
  const touch = (key) => {
    next[key] = next[key] ? { ...next[key] } : { ...EMPTY_PLAYER_STATS };
    return next[key];
  };
  for (const r of ratings) touch(playerKey(r.teamId, r.name)).matches += 1;
  for (const ev of events) {
    if (ev.type === 'goal') {
      if (!ev.isOwnGoal) touch(playerKey(ev.teamId, ev.scorer)).goals += 1;
      if (ev.assist) touch(playerKey(ev.teamId, ev.assist)).assists += 1;
    } else if (ev.type === 'yellow') {
      touch(playerKey(ev.teamId, ev.player)).yellows += 1;
    } else if (ev.type === 'red') {
      touch(playerKey(ev.teamId, ev.player)).reds += 1;
    }
  }
  if (homeGkName && awayGoals === 0) touch(playerKey(homeId, homeGkName)).cleanSheets += 1;
  if (awayGkName && homeGoals === 0) touch(playerKey(awayId, awayGkName)).cleanSheets += 1;
  return next;
}

export function playerSeasonStats(seasonPlayerStats, clubId, name) {
  return seasonPlayerStats?.[playerKey(clubId, name)] || EMPTY_PLAYER_STATS;
}
