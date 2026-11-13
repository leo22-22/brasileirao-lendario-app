// Aba Estatísticas da liga clássica — liga-estatisticas-mockup.html. Só
// apresentação: lê os acumulados que o motor já mantém (artilheiros,
// assistências, jogos sem sofrer gol, notas, cartões, tabela e resultados
// de cada rodada) e monta os rankings.
import { useState } from 'react';
import { splitTeamLabel } from './TableTab.jsx';
import './matchTab.css';
import { LeaderboardGrid } from '../../components/football/LeaderboardCard.jsx';
import { buildLeaderboards, splitPlayerKey as splitKey, MIN_GAMES_FOR_RATING } from '../../lib/leaders.js';

const fmt1 = (n) => n.toFixed(1).replace('.', ',');


/**
 * Tudo no formato do motor: scorers {key:{goals,teamLabel}}, assisters {key:{assists}},
 * cleanSheets {key:{clean}}, seasonRatings {key:{sum,count}}, cardCounts {key:n}, redCards {key:n}.
 * table: classificação da minha divisão. results: [{homeId,awayId,homeGoals,awayGoals}] de todas as rodadas jogadas.
 */
export function StatsTab({ scorers, assisters, cleanSheets, seasonRatings, cardCounts, redCards, table, results, myId, myLabel, teamLabelOf, crestOf, playedRounds }) {
  const [scope, setScope] = useState('all');
  const inLeague = new Set(table.map(r => r.id));
  const teamName = (id, fallback) => (id === myId ? myLabel : splitTeamLabel(teamLabelOf(id) || fallback || '').name);
  const keep = (teamId) => inLeague.has(teamId) && (scope === 'all' || teamId === myId);

  const boards = buildLeaderboards({ scorers, assisters, cleanSheets, seasonRatings, cardCounts, redCards, keep, teamName });
  const { goals, assists, clean, ratings, cards } = boards;
  const empty = playedRounds === 0 || !table.some(r => r.pj > 0);
  if (empty) {
    return (
      <section className="lg-card lg-st-empty">
        <h3>As estatísticas aparecem depois da primeira rodada</h3>
        <p>Artilharia, assistências, goleiros, notas e cartões da liga começam a ser contados no primeiro jogo.</p>
      </section>
    );
  }

  // ── Seu time ──
  const rankBy = (val, desc = true) => {
    const sorted = [...table].sort((a, b) => (desc ? val(b) - val(a) : val(a) - val(b)));
    const me = table.find(r => r.id === myId);
    if (!me) return null;
    return sorted.filter(r => (desc ? val(r) > val(me) : val(r) < val(me))).length + 1;
  };
  const me = table.find(r => r.id === myId);
  const myScorer = goals.find(r => r.teamId === myId) || null;
  const leagueGoals = Object.entries(scorers || {}).map(([key, d]) => ({ ...splitKey(key), goals: d.goals })).filter(r => inLeague.has(r.teamId)).sort((a, b) => b.goals - a.goals);
  const scorerRank = myScorer ? leagueGoals.filter(r => r.goals > myScorer.v).length + 1 : null;
  const leagueRatings = Object.entries(seasonRatings || {}).map(([key, d]) => ({ ...splitKey(key), avg: d.sum / d.count, count: d.count })).filter(r => inLeague.has(r.teamId) && r.count >= MIN_GAMES_FOR_RATING);
  const myBest = leagueRatings.filter(r => r.teamId === myId).sort((a, b) => b.avg - a.avg)[0] || null;
  const ratingRank = myBest ? leagueRatings.filter(r => r.avg > myBest.avg).length + 1 : null;
  const myYellows = Object.entries(cardCounts || {}).filter(([k]) => k.startsWith(`${myId}::`)).reduce((s, [, n]) => s + n, 0);
  const myReds = Object.entries(redCards || {}).filter(([k]) => k.startsWith(`${myId}::`)).reduce((s, [, n]) => s + n, 0);
  const atkRank = rankBy(r => r.gp);
  const defRank = rankBy(r => r.gc, false);

  // ── Times da liga ──
  const top = (val, desc = true) => [...table].sort((a, b) => (desc ? val(b) - val(a) : val(a) - val(b)))[0];
  const bestAtk = top(r => r.gp);
  const bestDef = top(r => r.gc, false);
  const mostWins = top(r => r.v);
  const teamCards = {};
  Object.entries(cardCounts || {}).forEach(([k, n]) => { const { teamId } = splitKey(k); teamCards[teamId] = (teamCards[teamId] || 0) + n; });
  Object.entries(redCards || {}).forEach(([k, n]) => { const { teamId } = splitKey(k); teamCards[teamId] = (teamCards[teamId] || 0) + n; });
  const cardsTeam = Object.entries(teamCards).filter(([id]) => inLeague.has(id)).sort((a, b) => b[1] - a[1])[0];
  const blowout = (results || []).filter(r => inLeague.has(r.homeId) && inLeague.has(r.awayId))
    .sort((a, b) => Math.abs(b.homeGoals - b.awayGoals) - Math.abs(a.homeGoals - a.awayGoals) || (b.homeGoals + b.awayGoals) - (a.homeGoals + a.awayGoals))[0];
  const tl = (row, value) => <b className={row?.id === myId ? 'lg-gold' : undefined}>{teamName(row.id, row.label)} · {value}</b>;

  return (
    <div className="lg-st">
      <div className="lg-st-bar">
        <div className="lg-seg2" role="group" aria-label="Recorte">
          <button type="button" aria-pressed={scope === 'all'} className={scope === 'all' ? 'lg-on2' : undefined} onClick={() => setScope('all')}>Liga toda</button>
          <button type="button" aria-pressed={scope === 'mine'} className={scope === 'mine' ? 'lg-on2' : undefined} onClick={() => setScope('mine')}>Só {myLabel}</button>
        </div>
        <span className="lg-small lg-st-note">Após {playedRounds} rodada{playedRounds === 1 ? '' : 's'} · jogadores do seu time em dourado</span>
      </div>

      {me && (
        <section className="lg-card lg-mine">
          <div className="lg-mine-id">{crestOf(myId, 44)}<div><small>Seu time</small><b className="lg-ell">{myLabel}</b></div></div>
          <div><small>Gols marcados</small><b>{me.gp}</b><em>{atkRank === 1 ? 'melhor ataque' : `${atkRank}º da liga`}</em></div>
          <div><small>Gols sofridos</small><b>{me.gc}</b><em>{defRank === 1 ? 'melhor defesa' : `${defRank}º da liga`}</em></div>
          <div><small>Artilheiro</small><b className="lg-mine-sm lg-ell">{myScorer ? `${myScorer.name} · ${myScorer.v}` : '—'}</b><em>{myScorer ? `${scorerRank}º da liga` : 'sem gols ainda'}</em></div>
          <div><small>Melhor nota</small><b className="lg-mine-sm lg-ell">{myBest ? `${myBest.name} · ${fmt1(myBest.avg)}` : '—'}</b><em>{myBest ? `${ratingRank}º da liga` : `mínimo de ${MIN_GAMES_FOR_RATING} jogos`}</em></div>
          <div><small>Cartões</small><b>{myYellows + myReds}</b><em>{myReds} vermelho{myReds === 1 ? '' : 's'}</em></div>
        </section>
      )}

      <LeaderboardGrid boards={boards} crestOf={crestOf} myIds={[myId]} minGames={MIN_GAMES_FOR_RATING}>
        <section className="lg-card lg-teams">
          <h3>Times da liga</h3>
          <div className="lg-trow"><span>Melhor ataque</span>{tl(bestAtk, bestAtk.gp)}</div>
          <div className="lg-trow"><span>Melhor defesa</span>{tl(bestDef, bestDef.gc)}</div>
          <div className="lg-trow"><span>Mais vitórias</span>{tl(mostWins, mostWins.v)}</div>
          {cardsTeam && <div className="lg-trow"><span>Mais cartões</span><b className={cardsTeam[0] === myId ? 'lg-gold' : undefined}>{teamName(cardsTeam[0])} · {cardsTeam[1]}</b></div>}
          {blowout && blowout.homeGoals !== blowout.awayGoals && (
            <div className="lg-trow"><span>Maior goleada</span><b>{blowout.homeGoals > blowout.awayGoals ? `${teamName(blowout.homeId)} ${blowout.homeGoals} × ${blowout.awayGoals} ${teamName(blowout.awayId)}` : `${teamName(blowout.awayId)} ${blowout.awayGoals} × ${blowout.homeGoals} ${teamName(blowout.homeId)} (fora)`}</b></div>
          )}
        </section>
      </LeaderboardGrid>
    </div>
  );
}
