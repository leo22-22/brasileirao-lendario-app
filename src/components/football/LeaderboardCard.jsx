// Card de ranking — ÚNICA versão (referência: Estatísticas da liga): 1º em
// destaque (verde; dourado se for do meu time), top 5 e "Ver top 20", meus
// jogadores em dourado. rows vêm de lib/leaders.buildLeaderboards.
import { useState } from 'react';
import './leaderboard.css';

export function LeaderboardCard({ title, unit, rows, crestOf, myIds = [], emptyText = 'Nada ainda.', limit = 5, expandTo = 20 }) {
  const [all, setAll] = useState(false);
  const mine = new Set(myIds);
  const shown = rows.slice(0, all ? expandTo : limit);
  const Value = ({ r }) => (
    <span className="fb-ld-v">{r.display}{r.red > 0 && <small className="fb-ld-red">{r.red} verm.</small>}</span>
  );
  return (
    <section className="fb-ld">
      <div className="fb-ld-h"><h3>{title}</h3>{unit && <span className="fb-ld-unit">{unit}</span>}</div>
      {rows.length === 0 && <div className="fb-ld-empty">{emptyText}</div>}
      {shown.map((r, i) => (
        <div key={r.key} className={`${i === 0 ? 'fb-ld-lead' : 'fb-ld-rw'}${mine.has(r.teamId) ? ' fb-ld-mine' : ''}`}>
          <span className="fb-ld-rk">{i + 1}</span>
          {crestOf ? crestOf(r.teamId, i === 0 ? 36 : 20) : null}
          <div className="fb-ld-t"><b>{r.name}</b><small>{r.team}</small></div>
          <Value r={r} />
        </div>
      ))}
      {rows.length > limit && (
        <button type="button" className="fb-ld-more" onClick={() => setAll(a => !a)} aria-expanded={all}>
          {all ? `Ver só o top ${limit}` : `Ver top ${Math.min(expandTo, rows.length)}`}
        </button>
      )}
    </section>
  );
}

// Grade com os 5 rankings padrão (artilharia, assistências, goleiros, notas, cartões).
export function LeaderboardGrid({ boards, crestOf, myIds = [], minGames = 3, children }) {
  return (
    <div className="fb-ld-grid">
      <LeaderboardCard title="Artilheiros" unit="gols" rows={boards.goals} crestOf={crestOf} myIds={myIds} emptyText="Ninguém marcou ainda." />
      <LeaderboardCard title="Assistências" unit="assist." rows={boards.assists} crestOf={crestOf} myIds={myIds} emptyText="Nenhuma assistência ainda." />
      <LeaderboardCard title="Jogos sem sofrer gol" unit="jogos" rows={boards.clean} crestOf={crestOf} myIds={myIds} emptyText="Nenhum goleiro passou em branco ainda." />
      <LeaderboardCard title="Nota média" unit={`nota · mín. ${minGames} jogos`} rows={boards.ratings} crestOf={crestOf} myIds={myIds} emptyText={`Ninguém tem ${minGames} jogos com nota ainda.`} />
      <LeaderboardCard title="Cartões" unit="amarelos + vermelhos" rows={boards.cards} crestOf={crestOf} myIds={myIds} emptyText="Nenhum cartão ainda." />
      {children}
    </div>
  );
}
