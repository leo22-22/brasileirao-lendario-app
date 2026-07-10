# Copa Lendária (7x0 mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third game mode, "Copa Lendária" — 32 teams, 8 groups of 4 (3 group matches) + single-leg knockout to the final (4 matches) = exactly 7 matches — so players can chase the literal "7 a 0 perfeito" (champion, unbeaten, zero goals conceded across all 7).

**Architecture:** A new pure, framework-free module `src/engine/copaLendaria.js` holds group assignment, group-table computation, and knockout-bracket resolution (unit-tested with Vitest). `App.jsx` gets a third `gameMode` branch (`'lendaria'`) added alongside the existing `'brasileirao'` and `'copa'` branches in `startSeason`, `startRound`, and `goNextRound` — the existing branches are copied through unchanged, only new branches and new state are added. Live match simulation (the minute-by-minute tick, `generateMatchGoals`, `simAiMatch`) is fully reused as-is; only scheduling and round-advancement are new. Critically, once the user is eliminated (didn't qualify from groups, or lost a knockout round), the rest of the bracket is resolved instantly in the background (`resolveBracket`) rather than requiring the player to click through matches they're not part of — this avoids a dead-end that exists in a similar spot in the current two-legged Copa do Brasil flow (out of scope to fix here; noted so this plan doesn't repeat it).

**Tech Stack:** Vitest (already added by the Achievements plan — if that plan hasn't run yet, Task 1 Step 1 below adds it). Plain JS + React, matching the existing codebase.

## Global Constraints

- This is part of a larger 3-plan initiative (this plan, Achievements/Carteirinha, and PWA installability). Task 6 of this plan has a hard dependency on the Achievements plan already being implemented (it modifies the `useEffect` that plan adds to `App.jsx`) — if the Achievements plan hasn't run yet, do Tasks 1–5 and 7 here, then come back to Task 6 once it has. Tasks 1–5 and 7 have no dependency on the other two plans.
- Total matches for a Copa Lendária run: exactly 7 (3 group + 4 knockout) for any run that reaches the final. A run where the user is eliminated has fewer.
- Do not modify the existing `'brasileirao'` or `'copa'` branches' behavior in `startSeason`, `startRound`, or `goNextRound` — copy them through byte-for-byte, only adding new branches and new dependency-array entries.
- Knockout round names (single-leg, 16 → final): `['Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Final']`.
- Team pool size for this mode: 32 (same as today's Copa do Brasil) — 1 user team + 31 AI opponents.

---

### Task 1: `src/engine/copaLendaria.js` — group and bracket engine

**Files:**
- Create: `src/engine/copaLendaria.js`
- Create: `src/engine/copaLendaria.test.js`
- Modify: `package.json` (add `vitest` devDependency + `"test"` script — **skip this step if the Achievements plan already ran**, it does the same thing)

**Interfaces:**
- Produces:
  - `assignGroups(teams: Team[], myTeamId: string) → { groups: Team[][], userGroupIndex: number }` — `teams` must have length 32; throws otherwise.
  - `computeGroupStandings(teamIds: string[], results: MatchResult[]) → StandingsRow[]` where `MatchResult = { homeId, awayId, homeGoals, awayGoals }` and `StandingsRow = { id, pts, pj, v, e, d, gp, gc }`, sorted by points, then goal difference, then goals scored.
  - `resolveBracket(firstRoundMatches: {homeId,awayId}[], simulateMatch: (homeId, awayId) => {homeGoals, awayGoals}) → championId: string` — walks a single-elimination bracket to completion given a match-simulation callback; draws are resolved by a coin flip (penalties).
  - `isSevenZeroEligible({ isChampion: boolean, matchesPlayed: number, goalsConceded: number }) → boolean`
  - `LENDARIA_TOTAL_MATCHES = 7`

- [ ] **Step 1: Ensure Vitest is set up**

If `vitest.config.js` doesn't exist yet (i.e., the Achievements plan hasn't run), run:

```bash
npm install -D vitest
```

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

And add to `package.json` `"scripts"`: `"test": "vitest run"`. If `vitest.config.js` already exists, skip this step entirely.

- [ ] **Step 2: Write the failing tests**

Create `src/engine/copaLendaria.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { assignGroups, computeGroupStandings, resolveBracket, isSevenZeroEligible, LENDARIA_TOTAL_MATCHES } from './copaLendaria.js';

function makeTeams(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `t${i}`, label: `Team ${i}`, ovr: 70 + i }));
}

describe('assignGroups', () => {
  it('throws when given anything other than 32 teams', () => {
    expect(() => assignGroups(makeTeams(31), 't0')).toThrow();
    expect(() => assignGroups(makeTeams(33), 't0')).toThrow();
  });

  it('splits 32 teams into 8 groups of 4', () => {
    const { groups } = assignGroups(makeTeams(32), 't0');
    expect(groups).toHaveLength(8);
    groups.forEach(g => expect(g).toHaveLength(4));
  });

  it('includes every team exactly once across all groups', () => {
    const teams = makeTeams(32);
    const { groups } = assignGroups(teams, 't0');
    const allIds = groups.flat().map(t => t.id).sort();
    expect(allIds).toEqual(teams.map(t => t.id).sort());
  });

  it('reports the correct group index for the user team', () => {
    const { groups, userGroupIndex } = assignGroups(makeTeams(32), 't7');
    expect(groups[userGroupIndex].some(t => t.id === 't7')).toBe(true);
  });
});

describe('computeGroupStandings', () => {
  const ids = ['a', 'b', 'c', 'd'];
  // Round robin of 4: a beats everyone, b beats c and d, c beats d, d loses all.
  const results = [
    { homeId: 'a', awayId: 'b', homeGoals: 2, awayGoals: 0 },
    { homeId: 'c', awayId: 'd', homeGoals: 1, awayGoals: 0 },
    { homeId: 'a', awayId: 'c', homeGoals: 3, awayGoals: 1 },
    { homeId: 'b', awayId: 'd', homeGoals: 2, awayGoals: 0 },
    { homeId: 'a', awayId: 'd', homeGoals: 1, awayGoals: 0 },
    { homeId: 'b', awayId: 'c', homeGoals: 1, awayGoals: 0 },
  ];

  it('sorts by points, undefeated team first', () => {
    const table = computeGroupStandings(ids, results);
    expect(table[0].id).toBe('a');
    expect(table[0]).toMatchObject({ pts: 9, v: 3, e: 0, d: 0, gp: 6, gc: 1 });
  });

  it('ranks the rest correctly', () => {
    const table = computeGroupStandings(ids, results);
    expect(table.map(r => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(table[3]).toMatchObject({ pts: 0, v: 0, e: 0, d: 3 });
  });
});

describe('resolveBracket', () => {
  it('resolves a 4-team bracket to a single champion using the injected simulator', () => {
    // "home" always wins 1-0, so the bracket should always favor whoever ends up home.
    const alwaysHomeWins = () => ({ homeGoals: 1, awayGoals: 0 });
    const first = [{ homeId: 'a', awayId: 'b' }, { homeId: 'c', awayId: 'd' }];
    const champion = resolveBracket(first, alwaysHomeWins);
    expect(champion).toBe('a');
  });

  it('resolves an 8-team bracket to a single champion', () => {
    const alwaysHomeWins = () => ({ homeGoals: 2, awayGoals: 1 });
    const first = [
      { homeId: 'a', awayId: 'b' }, { homeId: 'c', awayId: 'd' },
      { homeId: 'e', awayId: 'f' }, { homeId: 'g', awayId: 'h' },
    ];
    const champion = resolveBracket(first, alwaysHomeWins);
    expect(champion).toBe('a');
  });

  it('produces one of the two finalists when a match is drawn (penalties)', () => {
    const alwaysDraw = () => ({ homeGoals: 1, awayGoals: 1 });
    const first = [{ homeId: 'a', awayId: 'b' }];
    const champion = resolveBracket(first, alwaysDraw);
    expect(['a', 'b']).toContain(champion);
  });
});

describe('isSevenZeroEligible', () => {
  it('is true only for an unbeaten, undefeated, goal-free champion of all 7 matches', () => {
    expect(isSevenZeroEligible({ isChampion: true, matchesPlayed: 7, goalsConceded: 0 })).toBe(true);
  });

  it('is false if not champion', () => {
    expect(isSevenZeroEligible({ isChampion: false, matchesPlayed: 7, goalsConceded: 0 })).toBe(false);
  });

  it('is false if any goal was conceded', () => {
    expect(isSevenZeroEligible({ isChampion: true, matchesPlayed: 7, goalsConceded: 1 })).toBe(false);
  });

  it('is false if fewer than 7 matches were played (should not happen for a champion, but defensive)', () => {
    expect(isSevenZeroEligible({ isChampion: true, matchesPlayed: 6, goalsConceded: 0 })).toBe(false);
  });

  it('exposes the total match count as a constant', () => {
    expect(LENDARIA_TOTAL_MATCHES).toBe(7);
  });
});
```

- [ ] **Step 3: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './copaLendaria.js'`.

- [ ] **Step 4: Implement `src/engine/copaLendaria.js`**

```js
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function assignGroups(teams, myTeamId) {
  if (teams.length !== 32) throw new Error('assignGroups requires exactly 32 teams');
  const shuffled = shuffleArray(teams);
  const groups = [];
  for (let i = 0; i < 8; i++) groups.push(shuffled.slice(i * 4, i * 4 + 4));
  const userGroupIndex = groups.findIndex(g => g.some(t => t.id === myTeamId));
  return { groups, userGroupIndex };
}

export function computeGroupStandings(teamIds, results) {
  const table = teamIds.map(id => ({ id, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }));
  const byId = Object.fromEntries(table.map(r => [r.id, r]));
  results.forEach(res => {
    const h = byId[res.homeId], a = byId[res.awayId];
    if (!h || !a) return;
    h.pj++; a.pj++;
    h.gp += res.homeGoals; h.gc += res.awayGoals;
    a.gp += res.awayGoals; a.gc += res.homeGoals;
    if (res.homeGoals > res.awayGoals) { h.v++; h.pts += 3; a.d++; }
    else if (res.homeGoals < res.awayGoals) { a.v++; a.pts += 3; h.d++; }
    else { h.e++; h.pts++; a.e++; a.pts++; }
  });
  return [...table].sort((x, y) => y.pts - x.pts || (y.gp - y.gc) - (x.gp - x.gc) || y.gp - x.gp);
}

export function resolveBracket(firstRoundMatches, simulateMatch) {
  let currentMatches = firstRoundMatches;
  let championId = null;
  while (championId === null) {
    const winners = currentMatches.map(m => {
      const { homeGoals, awayGoals } = simulateMatch(m.homeId, m.awayId);
      if (homeGoals !== awayGoals) return homeGoals > awayGoals ? m.homeId : m.awayId;
      return Math.random() < 0.5 ? m.homeId : m.awayId; // empate → pênaltis
    });
    if (winners.length === 1) {
      championId = winners[0];
    } else {
      const next = [];
      for (let i = 0; i + 1 < winners.length; i += 2) next.push({ homeId: winners[i], awayId: winners[i + 1] });
      currentMatches = next;
    }
  }
  return championId;
}

export const LENDARIA_TOTAL_MATCHES = 7;

export function isSevenZeroEligible({ isChampion, matchesPlayed, goalsConceded }) {
  return isChampion && matchesPlayed === LENDARIA_TOTAL_MATCHES && goalsConceded === 0;
}
```

- [ ] **Step 5: Run the tests and verify they pass**

```bash
npm test
```

Expected: all `copaLendaria.test.js` tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/engine/copaLendaria.js src/engine/copaLendaria.test.js package.json package-lock.json vitest.config.js
git commit -m "feat: add Copa Lendária engine (group assignment, standings, bracket resolution)"
```

---

### Task 2: Wire `gameMode: 'lendaria'` into `App.jsx`'s state machine

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `assignGroups`, `computeGroupStandings`, `resolveBracket`, `isSevenZeroEligible`, `LENDARIA_TOTAL_MATCHES` from `./engine/copaLendaria.js`.
- Produces: new state — `lendariaGroups`, `lendariaUserGroupIndex`, `lendariaGroupResults`, `lendariaStage`, `lendariaKnockoutRounds`, `lendariaKnockoutIdx`, `userInLendaria`, `lendariaChampionId`, `lendariaGoalsConceded`, `lendariaMatchesPlayed` — all read by Tasks 4–6.

- [ ] **Step 1: Import the engine module**

At the top of `src/App.jsx`, after `import Peer from 'peerjs';` (line 2), add:

```js
import { assignGroups, computeGroupStandings, resolveBracket, isSevenZeroEligible, LENDARIA_TOTAL_MATCHES } from './engine/copaLendaria.js';
```

- [ ] **Step 2: Add the knockout round-name constant**

Right after `const CUP_ROUND_NAMES = ['16 Avos de Final', 'Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Final'];` (line 1764), add:

```js
const LENDARIA_KNOCKOUT_ROUND_NAMES = ['Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Final'];
```

- [ ] **Step 3: Add Copa Lendária state**

Right after `const [cupWinnerId, setCupWinnerId] = useState(null);` (around line 1966), before the `// Partida ao vivo` comment, add:

```js
  // Copa Lendária (32 times · 8 grupos de 4 · mata-mata sem ida/volta · objetivo 7 a 0)
  const [lendariaGroups, setLendariaGroups] = useState([]); // Team[][8][4]
  const [lendariaUserGroupIndex, setLendariaUserGroupIndex] = useState(0);
  const [lendariaGroupResults, setLendariaGroupResults] = useState([]); // resultados das rodadas de grupo já concluídas
  const [lendariaStage, setLendariaStage] = useState('grupos'); // 'grupos' | 'mata-mata'
  const [lendariaKnockoutRounds, setLendariaKnockoutRounds] = useState([]); // [{name, matches, results}]
  const [lendariaKnockoutIdx, setLendariaKnockoutIdx] = useState(0);
  const [userInLendaria, setUserInLendaria] = useState(true);
  const [lendariaChampionId, setLendariaChampionId] = useState(null);
  const [lendariaGoalsConceded, setLendariaGoalsConceded] = useState(0);
  const [lendariaMatchesPlayed, setLendariaMatchesPlayed] = useState(0);
```

- [ ] **Step 4: Replace `startSeason` with the version that adds the `'lendaria'` branch**

Replace the entire `startSeason` function (currently around lines 2118–2179) with:

```js
  const startSeason = () => {
    // Aplica +2 OVR ao capitão antes de calcular o time
    const pitchWithCaptain = captainSlot && pitch[captainSlot]
      ? { ...pitch, [captainSlot]: { ...pitch[captainSlot], ovr: pitch[captainSlot].ovr + 2, isCaptain: true } }
      : pitch;
    const userOvr = teamStrength(pitchWithCaptain);
    const userPlayers = Object.values(pitchWithCaptain);

    const neededAI = gameMode === 'brasileirao' ? 19 : 31;
    // Gera pool com repetição se necessário
    let pool = [];
    while (pool.length < neededAI) pool = [...pool, ...shuffle2([...TEAMS])];
    const opps = pool.slice(0, neededAI).map((t, idx) => {
      // Adiciona club/year/nat para que o entrosamento seja calculado corretamente
      const playersWithMeta = t.players.map(p => ({ ...p, club: t.club, year: t.year, nat: p.nat || 'BRA' }));
      return {
        id: `${t.id}_${idx}`,
        label: t.label,
        club: t.club,
        clubLogo: CLUB_LOGOS[t.club] || null,
        ovr: teamStrength(Object.fromEntries(playersWithMeta.map((p, i) => [i, p]))),
        players: playersWithMeta,
      };
    });

    const myTeamObj = { id: MY_TEAM_ID, label: myTeamName || 'Meu Time', badge: myTeamBadge, color: myTeamColor, logo: myTeamLogo, ovr: userOvr, players: userPlayers };
    const allTeams = [myTeamObj, ...opps];

    setLeagueTeams(allTeams);
    setClockMinute(0);
    setIsSimulating(false);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setRoundResults(null);
    setActiveUserMatch(null);

    if (gameMode === 'brasileirao') {
      const rounds = generateDoubleRoundRobin(allTeams.map(t => t.id));
      const table = allTeams.map(t => ({ id: t.id, label: t.label, clubLogo: t.clubLogo || null, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }));
      setFixtures(rounds);
      setLeagueTable(table);
      setCurrentRound(0);
      setCupRounds([]);
      setCupRoundIdx(0);
      setCupLeg(1);
      setUserInCup(true);
      setCupWinnerId(null);
      setLendariaGroups([]);
      setLendariaGroupResults([]);
      setLendariaStage('grupos');
      setLendariaKnockoutRounds([]);
      setLendariaKnockoutIdx(0);
      setUserInLendaria(true);
      setLendariaChampionId(null);
      setLendariaGoalsConceded(0);
      setLendariaMatchesPlayed(0);
    } else if (gameMode === 'lendaria') {
      const { groups, userGroupIndex } = assignGroups(allTeams, MY_TEAM_ID);
      const groupRounds = generateRoundRobin(groups[userGroupIndex].map(t => t.id)); // 3 rodadas
      setLendariaGroups(groups);
      setLendariaUserGroupIndex(userGroupIndex);
      setLendariaGroupResults([]);
      setLendariaStage('grupos');
      setLendariaKnockoutRounds([]);
      setLendariaKnockoutIdx(0);
      setUserInLendaria(true);
      setLendariaChampionId(null);
      setLendariaGoalsConceded(0);
      setLendariaMatchesPlayed(0);
      setFixtures(groupRounds);
      setCurrentRound(0);
      setLeagueTable([]);
      setCupRounds([]);
      setCupRoundIdx(0);
      setCupLeg(1);
      setUserInCup(true);
      setCupWinnerId(null);
    } else {
      // Copa do Brasil
      const firstMatches = generateCupFirstRound(allTeams.map(t => t.id));
      const firstRound = { name: CUP_ROUND_NAMES[0], matches: firstMatches, leg1Results: [], results: [] };
      setCupRounds([firstRound]);
      setCupRoundIdx(0);
      setCupLeg(1);
      setUserInCup(true);
      setCupWinnerId(null);
      setFixtures([firstMatches]);
      setCurrentRound(0);
      setLeagueTable([]);
      setLendariaGroups([]);
      setLendariaGroupResults([]);
      setLendariaStage('grupos');
      setLendariaKnockoutRounds([]);
      setLendariaKnockoutIdx(0);
      setUserInLendaria(true);
      setLendariaChampionId(null);
      setLendariaGoalsConceded(0);
      setLendariaMatchesPlayed(0);
    }
    setPhase('playing');
  };
```

(Only the `else if (gameMode === 'lendaria')` block and the cross-resets in the other two branches are new — the `'brasileirao'` and copa branches' original logic is unchanged.)

- [ ] **Step 5: Replace `startRound` with the version that adds the `'lendaria'` branch**

Replace the entire `startRound` function (currently around lines 2181–2292) with:

```js
  const startRound = useCallback(() => {
    if (isSimulating) return;
    const round = fixtures[currentRound];
    const um = round.find(m => m.homeId === MY_TEAM_ID || m.awayId === MY_TEAM_ID);
    if (!um) return;

    const homeTeam = leagueTeams.find(t => t.id === um.homeId);
    const awayTeam = leagueTeams.find(t => t.id === um.awayId);
    const events = generateMatchGoals(homeTeam, awayTeam);

    setActiveUserMatch(um);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setClockMinute(0);
    setRoundResults(null);
    setIsSimulating(true);

    const SPEED_MS = { 1: 250, 1.5: 125, 2: 55 };

    let minute = 0;
    let evIdx = 0;
    let hs = 0;
    let as_ = 0;
    const shown = [];

    const tick = () => {
      minute++;

      while (evIdx < events.length && events[evIdx].minute <= minute) {
        const ev = events[evIdx];
        if (ev.teamId === um.homeId) hs++;
        else as_++;
        shown.push({ ...ev, homeScore: hs, awayScore: as_ });
        evIdx++;
      }

      setClockMinute(minute);
      setLiveScore({ home: hs, away: as_ });
      if (shown.length > 0) setLiveEvents([...shown]);

      if (minute >= 90) {
        setIsSimulating(false);

        const finalHs = hs;
        const finalAs = as_;

        // Simular todos os jogos da rodada
        const results = round.map(m => {
          if (m.homeId === um.homeId && m.awayId === um.awayId)
            return { homeId: m.homeId, awayId: m.awayId, homeGoals: finalHs, awayGoals: finalAs };
          const h = leagueTeams.find(t => t.id === m.homeId);
          const a = leagueTeams.find(t => t.id === m.awayId);
          const sim = simAiMatch(h, a);
          return { homeId: m.homeId, awayId: m.awayId, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
        });

        setRoundResults(results);

        if (gameMode === 'brasileirao') {
          setLeagueTable(prev => {
            const tbl = prev.map(r => ({ ...r }));
            results.forEach(res => {
              const h = tbl.find(t => t.id === res.homeId);
              const a = tbl.find(t => t.id === res.awayId);
              if (!h || !a) return;
              h.pj++; a.pj++;
              h.gp += res.homeGoals; h.gc += res.awayGoals;
              a.gp += res.awayGoals; a.gc += res.homeGoals;
              if (res.homeGoals > res.awayGoals) { h.v++; h.pts += 3; a.d++; }
              else if (res.homeGoals < res.awayGoals) { a.v++; a.pts += 3; h.d++; }
              else { h.e++; h.pts++; a.e++; a.pts++; }
            });
            return [...tbl].sort((a, b) =>
              b.pts - a.pts || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp
            );
          });
        } else if (gameMode === 'lendaria') {
          const userGoalsAgainst = um.homeId === MY_TEAM_ID ? finalAs : finalHs;
          setLendariaGoalsConceded(prev => prev + userGoalsAgainst);
          setLendariaMatchesPlayed(prev => prev + 1);

          if (lendariaStage === 'grupos') {
            setLendariaGroupResults(prev => [...prev, results]);
          } else {
            setLendariaKnockoutRounds(prev =>
              prev.map((r, i) => (i === lendariaKnockoutIdx ? { ...r, results } : r))
            );
          }
        } else {
          // Copa: registrar resultado da rodada
          setCupRounds(prev => {
            const updated = prev.map((r, i) => i === cupRoundIdx ? { ...r, results } : r);
            // Leg 2: verificar eliminação por agregado imediatamente
            if (cupLegRef.current === 2) {
              const round = updated[cupRoundIdx];
              const leg1Res = round?.leg1Results || [];
              const userMatchIdx = round?.matches?.findIndex(m => m.homeId === MY_TEAM_ID || m.awayId === MY_TEAM_ID) ?? -1;
              if (userMatchIdx >= 0) {
                const match = round.matches[userMatchIdx];
                const l1 = leg1Res[userMatchIdx] || { homeGoals: 0, awayGoals: 0 };
                const l2 = results[userMatchIdx] || { homeGoals: 0, awayGoals: 0 };
                const isHome = match.homeId === MY_TEAM_ID;
                const userAgg = isHome ? (l1.homeGoals + l2.awayGoals) : (l1.awayGoals + l2.homeGoals);
                const oppAgg  = isHome ? (l1.awayGoals + l2.homeGoals) : (l1.homeGoals + l2.awayGoals);
                if (userAgg < oppAgg) {
                  setUserInCup(false);
                } else if (userAgg === oppAgg) {
                  const userAway = isHome ? l2.awayGoals : l1.awayGoals;
                  const oppAway  = isHome ? l1.awayGoals : l2.awayGoals;
                  if (userAway < oppAway || (userAway === oppAway && Math.random() >= 0.5)) setUserInCup(false);
                }
              }
            }
            return updated;
          });
        }
      } else {
        clockRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
      }
    };

    clockRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
  }, [fixtures, currentRound, leagueTeams, isSimulating, gameMode, cupRoundIdx, lendariaStage, lendariaKnockoutIdx]);
```

(Only the `else if (gameMode === 'lendaria')` block and the two new dependency-array entries — `lendariaStage`, `lendariaKnockoutIdx` — are new.)

- [ ] **Step 6: Replace `goNextRound` with the version that adds the `'lendaria'` branch**

Replace the entire `goNextRound` function (currently around lines 2294–2376) with:

```js
  const goNextRound = useCallback(() => {
    const next = currentRound + 1;

    if (gameMode === 'brasileirao') {
      if (next >= fixtures.length) {
        setPhase('results');
      } else {
        setCurrentRound(next);
        setRoundResults(null);
        setLiveEvents([]);
        setLiveScore({ home: 0, away: 0 });
        setClockMinute(0);
        setActiveUserMatch(null);
      }
      return;
    }

    if (gameMode === 'lendaria') {
      const reset = () => {
        setRoundResults(null);
        setLiveEvents([]);
        setLiveScore({ home: 0, away: 0 });
        setClockMinute(0);
        setActiveUserMatch(null);
      };

      const simulateMatchById = (homeId, awayId) => {
        const h = leagueTeams.find(t => t.id === homeId);
        const a = leagueTeams.find(t => t.id === awayId);
        return simAiMatch(h, a);
      };

      if (lendariaStage === 'grupos') {
        const updatedGroupResults = [...lendariaGroupResults, roundResults || []];

        if (next < 3) {
          setLendariaGroupResults(updatedGroupResults);
          setCurrentRound(next);
          reset();
          return;
        }

        // Fase de grupos terminou — calcula a classificação do grupo do
        // usuário e simula os outros 7 grupos em segundo plano pra montar
        // as Oitavas de Final com os 2 primeiros de cada um dos 8 grupos.
        const userGroupIds = lendariaGroups[lendariaUserGroupIndex].map(t => t.id);
        const userGroupTable = computeGroupStandings(userGroupIds, updatedGroupResults.flat());

        const otherGroupsQualifiers = lendariaGroups.flatMap((group, idx) => {
          if (idx === lendariaUserGroupIndex) return [];
          const groupIds = group.map(t => t.id);
          const groupRounds = generateRoundRobin(groupIds);
          const groupResults = groupRounds.flatMap(round => round.map(m => {
            const sim = simulateMatchById(m.homeId, m.awayId);
            return { homeId: m.homeId, awayId: m.awayId, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
          }));
          const table = computeGroupStandings(groupIds, groupResults);
          return [table[0].id, table[1].id];
        });

        const qualifiers = shuffle2([userGroupTable[0].id, userGroupTable[1].id, ...otherGroupsQualifiers]);
        const knockoutMatches = generateCupFirstRound(qualifiers);

        setLendariaGroupResults(updatedGroupResults);
        setLendariaStage('mata-mata');

        if (!qualifiers.includes(MY_TEAM_ID)) {
          // Usuário não avançou — resolve o resto do chaveamento sem exigir
          // telas de partida (ele não vai jogar mais nenhuma rodada) e vai
          // direto pro resultado.
          const championId = resolveBracket(knockoutMatches, simulateMatchById);
          setLendariaKnockoutRounds([]);
          setUserInLendaria(false);
          setLendariaChampionId(championId);
          reset();
          setPhase('results');
          return;
        }

        const firstKnockoutRound = { name: LENDARIA_KNOCKOUT_ROUND_NAMES[0], matches: knockoutMatches, results: [] };
        setLendariaKnockoutRounds([firstKnockoutRound]);
        setLendariaKnockoutIdx(0);
        setFixtures(f => [...f, knockoutMatches]);
        setCurrentRound(next);
        reset();
        return;
      }

      // Mata-mata (jogo único, sem ida/volta)
      const currentKnockoutRound = lendariaKnockoutRounds[lendariaKnockoutIdx];
      const results = roundResults || [];
      const winners = currentKnockoutRound.matches.map((m, i) => {
        const r = results[i];
        if (!r) return m.homeId;
        if (r.homeGoals !== r.awayGoals) return r.homeGoals > r.awayGoals ? m.homeId : m.awayId;
        return Math.random() < 0.5 ? m.homeId : m.awayId; // empate → pênaltis
      });

      if (!winners.includes(MY_TEAM_ID)) {
        // Usuário foi eliminado nesta rodada — resolve o restante do
        // chaveamento sem exigir mais telas de partida e vai direto pro resultado.
        let championId;
        if (winners.length === 1) {
          championId = winners[0];
        } else {
          const nextMatches = [];
          for (let i = 0; i + 1 < winners.length; i += 2) nextMatches.push({ homeId: winners[i], awayId: winners[i + 1] });
          championId = resolveBracket(nextMatches, simulateMatchById);
        }
        setUserInLendaria(false);
        setLendariaChampionId(championId);
        reset();
        setPhase('results');
        return;
      }

      if (winners.length === 1) {
        setLendariaChampionId(winners[0]);
        reset();
        setPhase('results');
        return;
      }

      const nextMatches = [];
      for (let i = 0; i + 1 < winners.length; i += 2) nextMatches.push({ homeId: winners[i], awayId: winners[i + 1] });

      const nextRoundName = LENDARIA_KNOCKOUT_ROUND_NAMES[lendariaKnockoutIdx + 1] || 'Final';
      const newRound = { name: nextRoundName, matches: nextMatches, results: [] };

      setLendariaKnockoutRounds(prev => [...prev, newRound]);
      setLendariaKnockoutIdx(idx => idx + 1);
      setFixtures(f => [...f, nextMatches]);
      setCurrentRound(next);
      reset();
      return;
    }

    // Copa — jogo de ida → jogo de volta → próxima fase
    setCupRounds(prev => {
      const currentCupRound = prev[cupRoundIdx];
      if (!currentCupRound) return prev;

      const reset = () => {
        setRoundResults(null);
        setLiveEvents([]);
        setLiveScore({ home: 0, away: 0 });
        setClockMinute(0);
        setActiveUserMatch(null);
      };

      if (cupLeg === 1) {
        const leg1Res = roundResults || [];
        const leg2Matches = currentCupRound.matches.map(m => ({ homeId: m.awayId, awayId: m.homeId }));
        setFixtures(f => [...f, leg2Matches]);
        setCupLeg(2);
        setCurrentRound(next);
        reset();
        return prev.map((r, i) => i === cupRoundIdx ? { ...r, leg1Results: leg1Res } : r);
      }

      const leg1Res = currentCupRound.leg1Results || [];
      const leg2Res = roundResults || [];

      const aggregateWinners = currentCupRound.matches.map((match, i) => {
        const l1 = leg1Res[i] || { homeGoals: 0, awayGoals: 0 };
        const l2 = leg2Res[i] || { homeGoals: 0, awayGoals: 0 };
        const aggA = l1.homeGoals + l2.awayGoals;
        const aggB = l1.awayGoals + l2.homeGoals;
        if (aggA !== aggB) return aggA > aggB ? match.homeId : match.awayId;
        const awayA = l2.awayGoals;
        const awayB = l1.awayGoals;
        if (awayA !== awayB) return awayA > awayB ? match.homeId : match.awayId;
        return Math.random() < 0.5 ? match.homeId : match.awayId;
      });

      const nextMatches = [];
      for (let i = 0; i + 1 < aggregateWinners.length; i += 2)
        nextMatches.push({ homeId: aggregateWinners[i], awayId: aggregateWinners[i + 1] });

      if (nextMatches.length === 0) {
        setCupWinnerId(aggregateWinners[0] || null);
        setPhase('results');
        return prev;
      }

      const nextRoundName = CUP_ROUND_NAMES[cupRoundIdx + 1] || 'Final';
      const newRound = { name: nextRoundName, matches: nextMatches, leg1Results: [], results: [] };
      const updated = [...prev, newRound];

      setFixtures(f => [...f, nextMatches]);
      setCupRoundIdx(r => r + 1);
      setCupLeg(1);
      setCurrentRound(next);
      reset();

      return updated;
    });
  }, [currentRound, fixtures, gameMode, cupRoundIdx, cupLeg, roundResults, lendariaStage, lendariaGroupResults, lendariaGroups, lendariaUserGroupIndex, lendariaKnockoutRounds, lendariaKnockoutIdx, leagueTeams]);
```

(The Copa do Brasil block at the bottom is byte-for-byte unchanged from the original — only the new `if (gameMode === 'lendaria') { ... }` block above it, and the new dependency-array entries, are new.)

- [ ] **Step 7: Add lendaria resets to `restart()`**

In `src/App.jsx`, inside `const restart = () => { ... }` (around line 2411), add these lines right after the existing `setCupWinnerId(null);` at the end of the function body:

```js
    setLendariaGroups([]);
    setLendariaUserGroupIndex(0);
    setLendariaGroupResults([]);
    setLendariaStage('grupos');
    setLendariaKnockoutRounds([]);
    setLendariaKnockoutIdx(0);
    setUserInLendaria(true);
    setLendariaChampionId(null);
    setLendariaGoalsConceded(0);
    setLendariaMatchesPlayed(0);
```

- [ ] **Step 8: Manual smoke test**

```bash
npm run dev
```

There's no UI to select this mode yet (Task 3 adds it) — for now, confirm the app still builds and the existing Brasileirão/Copa do Brasil modes still work exactly as before (draft → simulate a round → see results). This proves the additive changes didn't break the existing paths.

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire Copa Lendária mode into the game state machine"
```

---

### Task 3: Intro screen — add the Copa Lendária mode card

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add the third mode card**

In `src/App.jsx`, update the mode-selector array inside `Intro` (around lines 3238–3250):

```jsx
          {[
            {
              id: 'brasileirao',
              trophy: 'https://r2.thesportsdb.com/images/media/league/trophy/02ftjh1684945323.png',
              title: 'Brasileirão',
              sub: '20 times · 38 rodadas · Pontos corridos',
            },
            {
              id: 'copa',
              trophy: 'https://r2.thesportsdb.com/images/media/league/trophy/jv27c41776553182.png',
              title: 'Copa do Brasil',
              sub: '32 times · Mata-mata · Ida e volta',
            },
            {
              id: 'lendaria',
              trophy: 'https://r2.thesportsdb.com/images/media/league/trophy/jv27c41776553182.png',
              title: 'Copa Lendária',
              sub: '32 times · 7 jogos · Busque o 7 a 0 perfeito',
            },
          ].map(m => (
```

Also change the grid from two columns to a responsive layout that fits three cards, updating the wrapping `<div>` (around line 3237):

```jsx
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
```

- [ ] **Step 2: Update the CTA button label**

In `src/App.jsx`, update the final button in `Intro` (around line 3290–3292):

```jsx
      <button style={{ ...styles.btnIntro, background: myTeamColor, color: '#0B1A12' }} onClick={onStart}>
        {gameMode === 'copa' ? 'Escolher formação — Copa →' : gameMode === 'lendaria' ? 'Escolher formação — Copa Lendária →' : 'Escolher formação — Brasileirão →'}
      </button>
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

On the Home screen, confirm three mode cards render side by side (or wrap to a second row on narrow screens), the "Copa Lendária" card is selectable, and selecting it updates the CTA button text.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Copa Lendária mode card to Home screen"
```

---

### Task 4: Playing screen — Copa Lendária branch

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: all lendaria state from Task 2, plus `computeGroupStandings` from `./engine/copaLendaria.js` (already imported by Task 2).

- [ ] **Step 1: Compute the live group table in `App()`**

In `src/App.jsx`, add a `useMemo` for the live-updating group standings. Place it right after the `filledSlots`/`remainingSlots` declarations (around line 1994-1995) — it's fine this early since it only reads state, not other derived values:

```js
  const lendariaGroupTable = useMemo(() => {
    if (!lendariaGroups[lendariaUserGroupIndex]) return [];
    const ids = lendariaGroups[lendariaUserGroupIndex].map(t => t.id);
    const includeLive = lendariaStage === 'grupos' && roundResults ? [roundResults] : [];
    return computeGroupStandings(ids, [...lendariaGroupResults, ...includeLive].flat());
  }, [lendariaGroups, lendariaUserGroupIndex, lendariaGroupResults, roundResults, lendariaStage]);
```

- [ ] **Step 2: Pass the new props into `<Playing />`**

Find the `<Playing .../>` call in `src/App.jsx` (search for `gameMode={gameMode}` near the other `Playing` props) and add:

```jsx
            lendariaStage={lendariaStage}
            lendariaGroupTable={lendariaGroupTable}
            lendariaKnockoutRounds={lendariaKnockoutRounds}
            lendariaKnockoutIdx={lendariaKnockoutIdx}
            userInLendaria={userInLendaria}
            lendariaGoalsConceded={lendariaGoalsConceded}
            lendariaMatchesPlayed={lendariaMatchesPlayed}
```

- [ ] **Step 3: Accept the new props and add the branch in `Playing`**

Update the `Playing` function signature (around line 4209) to append the new params:

```js
function Playing({ myTeamId, fixtures, currentRound, leagueTeams, leagueTable, clockMinute, isSimulating, liveEvents, liveScore, roundResults, activeUserMatch, myTeamColor, myTeamBadge, myTeamLogo, gameMode, cupRounds, cupRoundIdx, cupLeg, userInCup, simSpeed, onSetSpeed, simMode, onSetSimMode, autoCountdown, onStartRound, onNextRound, lendariaStage, lendariaGroupTable, lendariaKnockoutRounds, lendariaKnockoutIdx, userInLendaria, lendariaGoalsConceded, lendariaMatchesPlayed }) {
```

Then, right after the existing `// ── COPA DO BRASIL ──────────────────────────────────────────` branch's closing brace (i.e., right before the line `function LiveMatchBox(...)` that follows `Playing`, but still *inside* `Playing` — insert this as a new `if` block immediately after the line `if (gameMode === 'copa') { ... }` closes, so it runs before the generic Brasileirão fallback code at the bottom of `Playing`):

```jsx
  // ── COPA LENDÁRIA ────────────────────────────────────────────
  if (gameMode === 'lendaria') {
    const progressLabel = `⚽ ${lendariaMatchesPlayed}/${LENDARIA_TOTAL_MATCHES} · ${lendariaGoalsConceded} sofrido${lendariaGoalsConceded === 1 ? '' : 's'}`;

    if (lendariaStage === 'mata-mata') {
      const round = lendariaKnockoutRounds[lendariaKnockoutIdx] || {};
      const roundName = round.name || LENDARIA_KNOCKOUT_ROUND_NAMES[lendariaKnockoutIdx] || 'Copa Lendária';

      return (
        <div style={styles.card} className="card-mob">
          <div style={styles.draftTopRow}>
            <div>
              <div style={styles.eyebrow}>Copa Lendária · Mata-mata</div>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, marginTop: 2 }}>{roundName}</div>
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#d4a23c' }}>{progressLabel}</div>
          </div>

          {roundDoneAndManual(roundResults, simMode) && (
            <button style={{ ...styles.btnSmall, background: mc, color: '#0B1A12' }} onClick={onNextRound}>
              {lendariaKnockoutIdx >= LENDARIA_KNOCKOUT_ROUND_NAMES.length - 1 ? '🏆 Ver campeão →' : 'Próxima fase →'}
            </button>
          )}

          <LiveMatchBox
            um={um} homeTeam={homeTeam} awayTeam={awayTeam}
            myTeamId={myTeamId} myTeamBadge={myTeamBadge} mc={mc}
            liveScore={liveScore} clockDisplay={clockDisplay}
            isSimulating={isSimulating} roundDone={roundDone}
            liveEvents={liveEvents} simSpeed={simSpeed}
            onSetSpeed={onSetSpeed} simMode={simMode} onSetSimMode={onSetSimMode}
            autoCountdown={autoCountdown} onStartRound={onStartRound}
            roundLabel={`Jogar — ${roundName}`}
          />

          {roundDone && (
            <div style={styles.otherMatchesBox}>
              <div style={styles.sectionLabel}>Outros jogos — {roundName}</div>
              {(roundResults || []).filter(r => r.homeId !== myTeamId && r.awayId !== myTeamId).map((r, i) => {
                const h = leagueTeams.find(t => t.id === r.homeId);
                const a = leagueTeams.find(t => t.id === r.awayId);
                const winH = r.homeGoals > r.awayGoals, winA = r.awayGoals > r.homeGoals;
                return (
                  <div key={i} style={styles.otherMatchRow}>
                    <span style={{ ...styles.otherTeam, fontWeight: winH ? 700 : 400, color: winH ? '#7fd99a' : undefined }}>{h?.label}</span>
                    <span style={styles.otherScore}>{r.homeGoals} – {r.awayGoals}</span>
                    <span style={{ ...styles.otherTeam, textAlign: 'left', fontWeight: winA ? 700 : 400, color: winA ? '#7fd99a' : undefined }}>{a?.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <div style={styles.sectionLabel}>Chaveamento</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {LENDARIA_KNOCKOUT_ROUND_NAMES.map((name, idx) => (
                <div key={idx} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 999,
                  background: idx < lendariaKnockoutIdx ? hexToRgba(mc, 0.2) : idx === lendariaKnockoutIdx ? hexToRgba(mc, 0.35) : 'rgba(255,255,255,0.05)',
                  color: idx <= lendariaKnockoutIdx ? mc : 'rgba(255,255,255,0.3)',
                  border: `1px solid ${idx === lendariaKnockoutIdx ? mc : 'transparent'}`,
                  fontFamily: "'Space Mono', monospace",
                }}>
                  {idx < lendariaKnockoutIdx ? '✓ ' : ''}{name}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Fase de grupos
    return (
      <div style={styles.card} className="card-mob">
        <div style={styles.draftTopRow}>
          <div>
            <div style={styles.eyebrow}>Copa Lendária · Fase de Grupos</div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, marginTop: 2 }}>Rodada {currentRound + 1} de 3</div>
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#d4a23c' }}>{progressLabel}</div>
        </div>

        {roundDoneAndManual(roundResults, simMode) && (
          <button style={{ ...styles.btnSmall, background: mc, color: '#0B1A12' }} onClick={onNextRound}>
            {currentRound + 1 >= 3 ? 'Ver chaveamento →' : 'Próxima rodada →'}
          </button>
        )}

        <LiveMatchBox
          um={um} homeTeam={homeTeam} awayTeam={awayTeam}
          myTeamId={myTeamId} myTeamBadge={myTeamBadge} mc={mc}
          liveScore={liveScore} clockDisplay={clockDisplay}
          isSimulating={isSimulating} roundDone={roundDone}
          liveEvents={liveEvents} simSpeed={simSpeed}
          onSetSpeed={onSetSpeed} simMode={simMode} onSetSimMode={onSetSimMode}
          autoCountdown={autoCountdown} onStartRound={onStartRound}
          roundLabel={`Jogar — Rodada ${currentRound + 1}`}
        />

        <div className="table-scroll">
          <div style={{ ...styles.sectionLabel, marginTop: 20 }}>Classificação do Grupo</div>
          <div style={styles.tableHeaderRow}>
            <span style={styles.tablePos}>#</span>
            <span style={{ flex: 1 }}>Time</span>
            <span style={styles.tableCell}>PJ</span>
            <span style={styles.tableCell}>V</span>
            <span style={styles.tableCell}>E</span>
            <span style={styles.tableCell}>D</span>
            <span style={{ ...styles.tableCell, color: '#d4a23c', fontWeight: 700 }}>PTS</span>
          </div>
          {lendariaGroupTable.map((row, i) => {
            const team = leagueTeams.find(t => t.id === row.id);
            const isMe = row.id === myTeamId;
            const qualifying = i < 2;
            return (
              <div key={row.id} style={{
                ...styles.tableRow,
                background: isMe ? hexToRgba(mc, 0.1) : i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
                borderLeft: qualifying ? '3px solid #7fd99a' : '3px solid transparent',
              }}>
                <span style={styles.tablePos}>{i + 1}</span>
                <span style={{ flex: 1, fontWeight: isMe ? 700 : 400, color: isMe ? mc : '#F4F1EA', fontSize: 13 }}>{team?.label}</span>
                <span style={styles.tableCell}>{row.pj}</span>
                <span style={styles.tableCell}>{row.v}</span>
                <span style={styles.tableCell}>{row.e}</span>
                <span style={styles.tableCell}>{row.d}</span>
                <span style={{ ...styles.tableCell, fontWeight: 700, color: '#d4a23c' }}>{row.pts}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

```

- [ ] **Step 4: Add the small `roundDoneAndManual` helper this branch uses**

Right above the `Playing` function declaration (around line 4209), add:

```js
function roundDoneAndManual(roundResults, simMode) {
  return roundResults !== null && simMode === 'manual';
}
```

(This mirrors the exact condition already repeated inline for the Copa do Brasil branch's continue button — it's used here to keep the new JSX above readable. Not applied retroactively to the existing Copa do Brasil code, to keep this plan's diff minimal.)

- [ ] **Step 5: Manual verification**

```bash
npm run dev
```

Select "Copa Lendária" on Home, draft a full XI, and play through the group stage: confirm the group table appears and updates after each of the 3 rounds, the progress label shows `N/7` and goals conceded, and after round 3 a "Ver chaveamento →" button appears. Continue into the knockout stage and confirm the bracket-progress pills update each round.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Copa Lendária screens (group table, bracket progress, 7x0 counter)"
```

---

### Task 5: Results screen — Copa Lendária branch

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Pass the new props into `<Results />`**

Update the `<Results .../>` call (around line 2860) to add:

```jsx
lendariaChampionId={lendariaChampionId} userInLendaria={userInLendaria} lendariaGoalsConceded={lendariaGoalsConceded} lendariaMatchesPlayed={lendariaMatchesPlayed}
```

- [ ] **Step 2: Add the branch in `Results`**

Update the `Results` function signature (around line 4561) to accept the new props:

```js
function Results({ leagueTable, myTeamId, myTeamColor, myTeamBadge, myTeamLogo, gameMode, cupWinnerId, leagueTeams, onRestart, justUnlocked, lendariaChampionId, userInLendaria, lendariaGoalsConceded, lendariaMatchesPlayed }) {
  const mc = myTeamColor || '#d4a23c';
```

Then, right after the existing `if (gameMode === 'copa') { ... }` block closes (around line 4594), add a new block:

```jsx
  // ── COPA LENDÁRIA ───────────────────────────────────────────
  if (gameMode === 'lendaria') {
    const winner = leagueTeams?.find(t => t.id === lendariaChampionId);
    const userWon = lendariaChampionId === myTeamId;
    const champClub = winner?.club || getMostCommonClub(winner?.players);
    const isSevenZero = userWon && lendariaMatchesPlayed === LENDARIA_TOTAL_MATCHES && lendariaGoalsConceded === 0;

    return (
      <div style={styles.card} className="card-mob">
        <div style={{ textAlign: 'center', padding: '12px 0 28px' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{isSevenZero ? '⭐' : userWon ? '🏆' : userInLendaria ? '⚽' : '😔'}</div>
          <div style={styles.eyebrow}>Copa Lendária — Resultado Final</div>
          <h1 style={{ ...styles.h1, color: userWon ? mc : '#F4F1EA', marginTop: 8 }}>
            {isSevenZero ? '7 a 0 PERFEITO!' : userWon ? 'CAMPEÃO!' : 'Copa encerrada'}
          </h1>
          <div style={{ fontSize: 15, opacity: 0.7, marginBottom: 20 }}>
            {userWon
              ? 'Seu time conquistou a Copa Lendária!'
              : <>Campeão: <b style={{ color: '#d4a23c' }}>{winner?.label ?? '—'}</b></>
            }
          </div>
          {isSevenZero && (
            <div style={{ ...styles.badge, background: 'rgba(255,215,0,0.15)', border: '1px solid #FFD700', color: '#FFD700' }}>
              ⭐ 7 a 0 Perfeito — invicto e sem sofrer gols nas 7 partidas!
            </div>
          )}
          {userWon && !isSevenZero && (
            <div style={styles.badge}>🏆 Copa Lendária conquistada — {lendariaGoalsConceded} gol{lendariaGoalsConceded === 1 ? '' : 's'} sofrido{lendariaGoalsConceded === 1 ? '' : 's'} no caminho.</div>
          )}
          {!userWon && (
            <div style={styles.badgeMuted}>
              {userInLendaria
                ? 'Sua run terminou antes da final.'
                : `Você caiu no jogo ${lendariaMatchesPlayed} — ${lendariaGoalsConceded} gol${lendariaGoalsConceded === 1 ? '' : 's'} sofrido${lendariaGoalsConceded === 1 ? '' : 's'}. Tente de novo!`
              }
            </div>
          )}
        </div>
        <AnthemPlayer club={champClub} />
        {(justUnlocked || []).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={styles.sectionLabel}>Novas conquistas</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {justUnlocked.map(id => {
                const b = ACHIEVEMENTS.find(a => a.id === id);
                if (!b) return null;
                return (
                  <div key={id} style={{ ...styles.badge, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{b.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{b.title}</div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>{b.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <button style={{ ...styles.btnPrimary, marginTop: 20, width: '100%', background: mc, color: '#0B1A12' }} onClick={onRestart}>
          Jogar de novo →
        </button>
      </div>
    );
  }

```

Note: this block reads `ACHIEVEMENTS` and `justUnlocked` — both already available in `Results`'s scope once the Achievements plan's Task 4/5 have run (which import `ACHIEVEMENTS` at the top of `App.jsx` and pass `justUnlocked` into `Results`). If the Achievements plan hasn't run yet when this task is executed, temporarily drop the "Novas conquistas" block (Task 6 below re-adds equivalent wiring once that dependency exists) rather than leaving a reference to an undefined variable.

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

Play a full Copa Lendária run to the final and win it — confirm the Results screen shows "CAMPEÃO!" (or "7 a 0 PERFEITO!" in gold if you didn't concede any goals). Play another run and lose early — confirm it shows "Você caiu no jogo N — M gols sofridos."

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Copa Lendária result screen with 7x0 seal"
```

---

### Task 6: Wire the `sete_a_zero` achievement (requires the Achievements plan)

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `isSevenZeroEligible` from `./engine/copaLendaria.js` (already imported by Task 2); `buildRunResult`, `checkAchievements` from `./achievements.js` and `loadCarteirinha`, `recordRun` from `./carteirinha.js` (imported by the Achievements plan's Task 4).

**Precondition:** the Achievements plan's Task 4 (which adds the `useEffect` recording run results on `phase === 'results'`) must already be implemented. If it isn't yet, stop here and come back to this task after it lands.

- [ ] **Step 1: Update the run-recording effect**

In `src/App.jsx`, find the `useEffect` added by the Achievements plan (it starts with `if (phase !== 'results') {`). Replace it entirely with:

```js
  useEffect(() => {
    if (phase !== 'results') {
      resultRecordedRef.current = false;
      return;
    }
    if (resultRecordedRef.current) return;
    resultRecordedRef.current = true;

    const winnerId = gameMode === 'lendaria' ? lendariaChampionId : cupWinnerId;
    const sevenZeroEligible = gameMode === 'lendaria'
      ? isSevenZeroEligible({
          isChampion: lendariaChampionId === MY_TEAM_ID,
          matchesPlayed: lendariaMatchesPlayed,
          goalsConceded: lendariaGoalsConceded,
        })
      : false;

    const runResult = buildRunResult({
      mode: gameMode,
      myTeamId: MY_TEAM_ID,
      leagueTable,
      cupWinnerId: winnerId,
      leagueTeams,
      sevenZeroEligible,
    });
    const { newlyUnlocked } = checkAchievements(runResult, loadCarteirinha().unlocked);
    const updated = recordRun(runResult, newlyUnlocked);
    setCarteirinha(updated);
    setJustUnlocked(newlyUnlocked);
  }, [phase, gameMode, leagueTable, cupWinnerId, leagueTeams, lendariaChampionId, lendariaMatchesPlayed, lendariaGoalsConceded]);
```

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```

Play a full Copa Lendária run, winning every match 1–0 or better (never conceding). On the Results screen, confirm "⭐ 7 a 0 Perfeito" shows both in the main result panel (Task 5) and in the "Novas conquistas" list. Open the Carteirinha screen and confirm the "7 a 0 Perfeito" badge is now unlocked and colored.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire sete_a_zero achievement to Copa Lendária results"
```

---

### Task 7: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the automated suite**

```bash
npm test
```

Expected: all tests pass, including `src/engine/copaLendaria.test.js`.

- [ ] **Step 2: Full manual playthrough — win the whole thing**

```bash
npm run dev
```

Pick Copa Lendária, draft the strongest XI you can, and play through all 7 matches winning every one (retry if you draw the group or lose — this is meant to be rare, per the spec). Confirm:
- The group table updates after each of the 3 group rounds and you finish top of your group.
- You advance through Oitavas → Quartas → Semifinal → Final without any dead screens (no round where there's no button to progress).
- The Results screen shows the gold "7 a 0 PERFEITO!" seal if you conceded zero goals, or the plain "CAMPEÃO!" state if you conceded any.

- [ ] **Step 3: Full manual playthrough — get eliminated early**

Play a second run with a deliberately weak XI (low OVR players) and lose in the group stage or an early knockout round. Confirm:
- The run does not get stuck — either the group-stage-elimination path or the knockout-elimination path takes you straight to the Results screen.
- The Results screen's "Você caiu no jogo N — M gols sofridos" message shows plausible numbers (N between 1 and 6, since 7 would mean you won the final).

- [ ] **Step 4: Regression-check the existing modes**

Play one full Brasileirão season and one full Copa do Brasil run to completion. Confirm both behave exactly as they did before this plan (scoring, round advancement, results screens) — this plan should not have changed their behavior at all.

- [ ] **Step 5: Record the outcome**

No commit needed for this task — it's a verification checkpoint. If any step fails, return to the relevant task above and fix before considering this plan complete.
