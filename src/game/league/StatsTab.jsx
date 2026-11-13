// Aba Estatísticas da liga clássica — liga-estatisticas-mockup.html. Só
// apresentação: lê os acumulados que o motor já mantém (artilheiros,
// assistências, jogos sem sofrer gol, notas, cartões, tabela e resultados
// de cada rodada) e monta os rankings.
import { useState } from 'react';
import { splitTeamLabel } from './TableTab.jsx';
import './matchTab.css';

const fmt1 = (n) => n.toFixed(1).replace('.', ',');
const MIN_GAMES_FOR_RATING = 3; // mesmo corte do painel antigo

function splitKey(key) {
  const i = key.indexOf('::');
  return { teamId: key.slice(0, i), name: key.slice(i + 2) };
}

function LeaderCard({ title, unit, rows, crestOf, myId, emptyText }) {
  const [all, setAll] = useState(false);
  const shown = rows.slice(0, all ? 20 : 5);
  return (
    <section className="lg-card lg-ld">
      <div className="lg-ld-h"><h3>{title}</h3><span className="lg-small">{unit}</span></div>
      {rows.length === 0 && <div className="lg-empty">{emptyText}</div>}
      {shown.map((r, i) => {
        const mine = r.teamId === myId;
        if (i === 0) {
          return (
            <div key={r.key} className={`lg-ld-lead${mine ? ' lg-ld-mine' : ''}`}>
              <span className="lg-ld-rk">1</span>
              {crestOf(r.teamId, 36)}
              <div className="lg-ld-t"><b className="lg-ell">{r.name}</b><small className="lg-ell">{r.team}</small></div>
              <span className="lg-ld-v">{r.display}</span>
            </div>
          );
        }
        return (
          <div key={r.key} className={`lg-ld-rw${mine ? ' lg-ld-mine' : ''}`}>
            <span className="lg-ld-rk">{i + 1}</span>
            {crestOf(r.teamId, 20)}
            <div className="lg-ld-t"><b className="lg-ell">{r.name}</b><small className="lg-ell">{r.team}</small></div>
            <span className="lg-ld-v">{r.display}</span>
          </div>
        );
      })}
      {rows.length > 5 && (
        <button type="button" className="lg-ld-more" onClick={() => setAll(a => !a)} aria-expanded={all}>
          {all ? 'Ver só o top 5' : `Ver top ${Math.min(20, rows.length)}`}
        </button>
      )}
    </section>
  );
}

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

  const build = (obj, value, display, filter = () => true) => Object.entries(obj || {})
    .map(([key, d]) => ({ key, ...splitKey(key), d }))
    .filter(r => keep(r.teamId) && filter(r.d, r.key))
    .map(r => ({ key: r.key, teamId: r.teamId, name: r.name, team: teamName(r.teamId, r.d?.teamLabel), v: value(r.d, r.key), display: display(r.d, r.key) }))
    .filter(r => r.v > 0)
    .sort((a, b) => b.v - a.v || a.name.localeCompare(b.name));

  const goals = build(scorers, d => d.goals, d => d.goals);
  const assists = build(assisters, d => d.assists, d => d.assists);
  const clean = build(cleanSheets, d => d.clean, d => d.clean);
  const ratings = build(seasonRatings, d => d.sum / d.count, d => fmt1(d.sum / d.count), d => d.count >= MIN_GAMES_FOR_RATING);
  const cardKeys = { ...Object.fromEntries(Object.keys(redCards || {}).map(k => [k, 0])), ...(cardCounts || {}) };
  const cards = build(cardKeys, (y, k) => (y || 0) + (redCards?.[k] || 0), (y, k) => (redCards?.[k] ? <>{(y || 0) + redCards[k]}<small className="lg-ld-red">{redCards[k]} verm.</small></> : (y || 0)));

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

      <div className="lg-st-grid">
        <LeaderCard title="Artilheiros" unit="gols" rows={goals} crestOf={crestOf} myId={myId} emptyText="Ninguém marcou ainda." />
        <LeaderCard title="Assistências" unit="assist." rows={assists} crestOf={crestOf} myId={myId} emptyText="Nenhuma assistência ainda." />
        <LeaderCard title="Jogos sem sofrer gol" unit="jogos" rows={clean} crestOf={crestOf} myId={myId} emptyText="Nenhum goleiro passou em branco ainda." />
        <LeaderCard title="Nota média" unit={`nota · mín. ${MIN_GAMES_FOR_RATING} jogos`} rows={ratings} crestOf={crestOf} myId={myId} emptyText={`Ninguém tem ${MIN_GAMES_FOR_RATING} jogos com nota ainda.`} />
        <LeaderCard title="Cartões" unit="amarelos + vermelhos" rows={cards} crestOf={crestOf} myId={myId} emptyText="Nenhum cartão ainda." />
        <section className="lg-card lg-teams">
          <h3>Times da liga</h3>
          <div className="lg-tl"><span>Melhor ataque</span>{tl(bestAtk, bestAtk.gp)}</div>
          <div className="lg-tl"><span>Melhor defesa</span>{tl(bestDef, bestDef.gc)}</div>
          <div className="lg-tl"><span>Mais vitórias</span>{tl(mostWins, mostWins.v)}</div>
          {cardsTeam && <div className="lg-tl"><span>Mais cartões</span><b className={cardsTeam[0] === myId ? 'lg-gold' : undefined}>{teamName(cardsTeam[0])} · {cardsTeam[1]}</b></div>}
          {blowout && blowout.homeGoals !== blowout.awayGoals && (
            <div className="lg-tl"><span>Maior goleada</span><b>{blowout.homeGoals > blowout.awayGoals ? `${teamName(blowout.homeId)} ${blowout.homeGoals} × ${blowout.awayGoals} ${teamName(blowout.awayId)}` : `${teamName(blowout.awayId)} ${blowout.awayGoals} × ${blowout.homeGoals} ${teamName(blowout.homeId)} (fora)`}</b></div>
          )}
        </section>
      </div>
    </div>
  );
}
