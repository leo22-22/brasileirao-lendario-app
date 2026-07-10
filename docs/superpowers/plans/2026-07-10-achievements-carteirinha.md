# Achievements / Carteirinha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local (no-account) achievements system — badges unlocked by tournament outcomes, persisted in `localStorage`, viewable on a new "Carteirinha" screen.

**Architecture:** Two new pure, framework-free modules — `src/achievements.js` (badge definitions + evaluation logic) and `src/carteirinha.js` (localStorage persistence) — both unit-tested with Vitest, which this plan introduces to the repo (no test framework exists yet). `App.jsx` gets one new `useEffect` that fires once when the existing `phase` state reaches `'results'`, reading state that's already computed by the existing simulation code (`leagueTable`, `cupWinnerId`, `leagueTeams`) — no changes to the simulation engine, draft, or round-advancement logic. A new `Carteirinha` screen component and a new `phase === 'carteirinha'` route are added following the existing screen-per-phase pattern.

**Tech Stack:** Vitest (new — added by this plan), plain JS modules, `localStorage`.

## Global Constraints

- This is part of a larger 3-plan initiative (Copa Lendária mode, this Achievements plan, and a PWA plan). This plan is independent of the PWA plan. It has one soft dependency on the Copa Lendária plan: the `sete_a_zero` badge's *trigger* (passing `sevenZeroEligible: true` for a completed Copa Lendária run) is added by the Copa Lendária plan as its own final task, once `gameMode === 'lendaria'` exists — this plan defines the badge itself and evaluates it as always-false until then, so it's fully shippable on its own.
- Storage key: `bl_carteirinha_v1` (matches the spec). Do not rename.
- Do not modify `startSeason`, `startRound`, `goNextRound`, or any other function in the existing simulation/round-advancement machinery in `src/App.jsx`. All wiring in Task 4 is additive (new `useState`, new `useEffect`, new props on existing JSX calls).
- Badge thresholds (from the spec): Zebra Histórica = squad avg OVR < 75; Geração de Ouro = squad avg OVR > 90.

---

### Task 1: Set up Vitest

**Files:**
- Create: `vitest.config.js`
- Modify: `package.json` (add `vitest` devDependency, add `"test"` script)
- Create: `src/smoke.test.js`

**Interfaces:**
- Produces: `npm test` runs the Vitest suite once (CI-style, non-watch) and exits with a non-zero code on failure. Later tasks add `*.test.js` files that this config picks up automatically.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.js` (separate from `vite.config.js` so this plan has no ordering dependency on the PWA plan's changes to that file):

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 3: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 4: Write a smoke test to confirm the runner works**

Create `src/smoke.test.js`:

```js
import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

```bash
npm test
```

Expected: 1 passed test file, 1 passed test.

- [ ] **Step 6: Delete the smoke test and commit**

The smoke test's only job was proving the runner works — later tasks add real tests, so remove it now rather than leaving a placeholder test in the suite.

```bash
rm src/smoke.test.js
git add vitest.config.js package.json package-lock.json
git commit -m "chore: add Vitest test runner"
```

---

### Task 2: `src/achievements.js` — badge definitions and evaluation

**Files:**
- Create: `src/achievements.js`
- Create: `src/achievements.test.js`

**Interfaces:**
- Produces:
  - `ACHIEVEMENTS: Array<{ id, title, description, icon, tier }>`
  - `buildRunResult({ mode, myTeamId, leagueTable, cupWinnerId, leagueTeams, sevenZeroEligible? }) → RunResult`
  - `RunResult = { mode, isChampion, losses, squadAvgOvr, sevenZeroEligible }`
  - `checkAchievements(runResult: RunResult, priorUnlocked: Record<string, string>) → { newlyUnlocked: string[], allUnlockedThisRun: string[] }`
- Consumes: nothing (pure module, no imports from `App.jsx`).

- [ ] **Step 1: Write the failing tests**

Create `src/achievements.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, buildRunResult, checkAchievements } from './achievements.js';

describe('ACHIEVEMENTS', () => {
  it('has the six starter badges with unique ids', () => {
    const ids = ACHIEVEMENTS.map(a => a.id);
    expect(ids).toEqual([
      'primeira_partida', 'primeiro_titulo', 'sete_a_zero',
      'zebra_historica', 'geracao_de_ouro', 'invencivel',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildRunResult — brasileirao', () => {
  const leagueTable = [
    { id: 'me', pts: 90, v: 30, e: 0, d: 8, gp: 80, gc: 20 },
    { id: 'other', pts: 70, v: 22, e: 4, d: 12, gp: 60, gc: 40 },
  ];
  const leagueTeams = [{ id: 'me', ovr: 88 }, { id: 'other', ovr: 80 }];

  it('marks champion when in first table position', () => {
    const result = buildRunResult({ mode: 'brasileirao', myTeamId: 'me', leagueTable, cupWinnerId: null, leagueTeams });
    expect(result).toEqual({ mode: 'brasileirao', isChampion: true, losses: 8, squadAvgOvr: 88, sevenZeroEligible: false });
  });

  it('marks not champion when not in first table position', () => {
    const result = buildRunResult({ mode: 'brasileirao', myTeamId: 'other', leagueTable, cupWinnerId: null, leagueTeams });
    expect(result.isChampion).toBe(false);
  });
});

describe('buildRunResult — copa/lendaria', () => {
  const leagueTeams = [{ id: 'me', ovr: 95 }];

  it('champion means zero losses (elimination = not champion in knockout)', () => {
    const result = buildRunResult({ mode: 'copa', myTeamId: 'me', leagueTable: [], cupWinnerId: 'me', leagueTeams });
    expect(result).toEqual({ mode: 'copa', isChampion: true, losses: 0, squadAvgOvr: 95, sevenZeroEligible: false });
  });

  it('not champion means one loss (the elimination)', () => {
    const result = buildRunResult({ mode: 'copa', myTeamId: 'me', leagueTable: [], cupWinnerId: 'someone-else', leagueTeams });
    expect(result).toEqual({ mode: 'copa', isChampion: false, losses: 1, squadAvgOvr: 95, sevenZeroEligible: false });
  });

  it('passes through sevenZeroEligible only for lendaria mode', () => {
    const copaResult = buildRunResult({ mode: 'copa', myTeamId: 'me', leagueTable: [], cupWinnerId: 'me', leagueTeams, sevenZeroEligible: true });
    expect(copaResult.sevenZeroEligible).toBe(false);

    const lendariaResult = buildRunResult({ mode: 'lendaria', myTeamId: 'me', leagueTable: [], cupWinnerId: 'me', leagueTeams, sevenZeroEligible: true });
    expect(lendariaResult.sevenZeroEligible).toBe(true);
  });
});

describe('checkAchievements', () => {
  it('always unlocks primeira_partida', () => {
    const result = { mode: 'brasileirao', isChampion: false, losses: 20, squadAvgOvr: 80, sevenZeroEligible: false };
    const { newlyUnlocked } = checkAchievements(result, {});
    expect(newlyUnlocked).toContain('primeira_partida');
  });

  it('does not unlock title/invencivel/zebra/golden badges when not champion', () => {
    const result = { mode: 'brasileirao', isChampion: false, losses: 0, squadAvgOvr: 60, sevenZeroEligible: false };
    const { newlyUnlocked } = checkAchievements(result, {});
    expect(newlyUnlocked).toEqual(['primeira_partida']);
  });

  it('unlocks primeiro_titulo and invencivel for an undefeated champion', () => {
    const result = { mode: 'brasileirao', isChampion: true, losses: 0, squadAvgOvr: 82, sevenZeroEligible: false };
    const { newlyUnlocked } = checkAchievements(result, {});
    expect(newlyUnlocked).toEqual(expect.arrayContaining(['primeiro_titulo', 'invencivel']));
    expect(newlyUnlocked).not.toContain('zebra_historica');
    expect(newlyUnlocked).not.toContain('geracao_de_ouro');
  });

  it('unlocks zebra_historica for a champion with a weak squad (avg OVR < 75)', () => {
    const result = { mode: 'brasileirao', isChampion: true, losses: 3, squadAvgOvr: 70, sevenZeroEligible: false };
    const { newlyUnlocked } = checkAchievements(result, {});
    expect(newlyUnlocked).toContain('zebra_historica');
    expect(newlyUnlocked).not.toContain('invencivel');
  });

  it('unlocks geracao_de_ouro for a champion with a stacked squad (avg OVR > 90)', () => {
    const result = { mode: 'copa', isChampion: true, losses: 0, squadAvgOvr: 93, sevenZeroEligible: false };
    const { newlyUnlocked } = checkAchievements(result, {});
    expect(newlyUnlocked).toContain('geracao_de_ouro');
  });

  it('unlocks sete_a_zero only when champion and sevenZeroEligible', () => {
    const eligible = { mode: 'lendaria', isChampion: true, losses: 0, squadAvgOvr: 85, sevenZeroEligible: true };
    expect(checkAchievements(eligible, {}).newlyUnlocked).toContain('sete_a_zero');

    const notEligible = { mode: 'lendaria', isChampion: true, losses: 0, squadAvgOvr: 85, sevenZeroEligible: false };
    expect(checkAchievements(notEligible, {}).newlyUnlocked).not.toContain('sete_a_zero');
  });

  it('excludes already-unlocked badges from newlyUnlocked but keeps them in allUnlockedThisRun', () => {
    const result = { mode: 'brasileirao', isChampion: true, losses: 0, squadAvgOvr: 82, sevenZeroEligible: false };
    const priorUnlocked = { primeira_partida: '2026-01-01T00:00:00Z', primeiro_titulo: '2026-01-01T00:00:00Z' };
    const { newlyUnlocked, allUnlockedThisRun } = checkAchievements(result, priorUnlocked);
    expect(newlyUnlocked).toEqual(['invencivel']);
    expect(allUnlockedThisRun).toEqual(expect.arrayContaining(['primeira_partida', 'primeiro_titulo', 'invencivel']));
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './achievements.js'` (the module doesn't exist yet).

- [ ] **Step 3: Implement `src/achievements.js`**

```js
export const ACHIEVEMENTS = [
  { id: 'primeira_partida', title: 'Primeira Partida', description: 'Jogou a primeira partida.', icon: '🎽', tier: 'bronze' },
  { id: 'primeiro_titulo', title: 'Primeiro Título', description: 'Foi campeão em qualquer modo.', icon: '🏆', tier: 'prata' },
  { id: 'sete_a_zero', title: '7 a 0 Perfeito', description: 'Campeão da Copa Lendária, invicto e sem sofrer gols.', icon: '⭐', tier: 'ouro' },
  { id: 'zebra_historica', title: 'Zebra Histórica', description: 'Campeão com um XI de força média abaixo de 75.', icon: '🐴', tier: 'prata' },
  { id: 'geracao_de_ouro', title: 'Geração de Ouro', description: 'Campeão com um XI de força média acima de 90.', icon: '✨', tier: 'prata' },
  { id: 'invencivel', title: 'Invencível', description: 'Campeão sem nenhuma derrota.', icon: '🛡️', tier: 'prata' },
];

const ZEBRA_THRESHOLD = 75;
const GOLDEN_THRESHOLD = 90;

export function buildRunResult({ mode, myTeamId, leagueTable, cupWinnerId, leagueTeams, sevenZeroEligible = false }) {
  const squadAvgOvr = leagueTeams?.find(t => t.id === myTeamId)?.ovr ?? 0;

  if (mode === 'brasileirao') {
    const myRow = leagueTable?.find(t => t.id === myTeamId) || null;
    const isChampion = (leagueTable?.length ?? 0) > 0 && leagueTable[0].id === myTeamId;
    return {
      mode,
      isChampion,
      losses: myRow?.d ?? 0,
      squadAvgOvr,
      sevenZeroEligible: false,
    };
  }

  // 'copa' e 'lendaria': formato mata-mata — eliminação = não é campeão,
  // então "campeão sem derrota" é equivalente a "foi campeão".
  const isChampion = cupWinnerId === myTeamId;
  return {
    mode,
    isChampion,
    losses: isChampion ? 0 : 1,
    squadAvgOvr,
    sevenZeroEligible: mode === 'lendaria' ? sevenZeroEligible : false,
  };
}

export function checkAchievements(runResult, priorUnlocked) {
  const unlockedNow = new Set(['primeira_partida']);

  if (runResult.isChampion) {
    unlockedNow.add('primeiro_titulo');
    if (runResult.losses === 0) unlockedNow.add('invencivel');
    if (runResult.squadAvgOvr < ZEBRA_THRESHOLD) unlockedNow.add('zebra_historica');
    if (runResult.squadAvgOvr > GOLDEN_THRESHOLD) unlockedNow.add('geracao_de_ouro');
    if (runResult.sevenZeroEligible) unlockedNow.add('sete_a_zero');
  }

  const allUnlockedThisRun = [...unlockedNow];
  const newlyUnlocked = allUnlockedThisRun.filter(id => !priorUnlocked[id]);
  return { newlyUnlocked, allUnlockedThisRun };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm test
```

Expected: all `achievements.test.js` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/achievements.js src/achievements.test.js
git commit -m "feat: add achievements module (badge definitions + evaluation)"
```

---

### Task 3: `src/carteirinha.js` — localStorage persistence

**Files:**
- Create: `src/carteirinha.js`
- Create: `src/carteirinha.test.js`

**Interfaces:**
- Consumes: nothing from `App.jsx`.
- Produces:
  - `loadCarteirinha() → { unlocked: Record<string,string>, stats: { tournamentsPlayed: number, titlesByMode: { brasileirao: number, copa: number, lendaria: number } } }`
  - `saveCarteirinha(data)`
  - `recordRun(runResult: RunResult, newlyUnlocked: string[]) → updated carteirinha data (same shape as loadCarteirinha's return)` — reads current storage, merges in the newly unlocked badges (with an ISO timestamp) and increments `tournamentsPlayed` / `titlesByMode[runResult.mode]`, writes it back, and returns it.

- [ ] **Step 1: Write the failing tests**

Create `src/carteirinha.test.js`. This stubs `globalThis.localStorage` with a minimal in-memory implementation since the Vitest config uses the `node` environment (no real `localStorage`), which is enough to test this module without adding a `jsdom` dependency:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { loadCarteirinha, saveCarteirinha, recordRun } from './carteirinha.js';

function makeFakeLocalStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
}

beforeEach(() => {
  globalThis.localStorage = makeFakeLocalStorage();
});

describe('loadCarteirinha', () => {
  it('returns an empty carteirinha when nothing is stored', () => {
    expect(loadCarteirinha()).toEqual({
      unlocked: {},
      stats: { tournamentsPlayed: 0, titlesByMode: { brasileirao: 0, copa: 0, lendaria: 0 } },
    });
  });

  it('returns an empty carteirinha when stored JSON is corrupt', () => {
    globalThis.localStorage.setItem('bl_carteirinha_v1', '{not json');
    expect(loadCarteirinha()).toEqual({
      unlocked: {},
      stats: { tournamentsPlayed: 0, titlesByMode: { brasileirao: 0, copa: 0, lendaria: 0 } },
    });
  });

  it('round-trips data written by saveCarteirinha', () => {
    const data = {
      unlocked: { primeira_partida: '2026-01-01T00:00:00.000Z' },
      stats: { tournamentsPlayed: 3, titlesByMode: { brasileirao: 1, copa: 0, lendaria: 0 } },
    };
    saveCarteirinha(data);
    expect(loadCarteirinha()).toEqual(data);
  });
});

describe('recordRun', () => {
  it('increments tournamentsPlayed and records newly unlocked badges with a timestamp', () => {
    const runResult = { mode: 'brasileirao', isChampion: true, losses: 0, squadAvgOvr: 82, sevenZeroEligible: false };
    const updated = recordRun(runResult, ['primeira_partida', 'primeiro_titulo', 'invencivel']);

    expect(updated.stats.tournamentsPlayed).toBe(1);
    expect(updated.stats.titlesByMode.brasileirao).toBe(1);
    expect(Object.keys(updated.unlocked)).toEqual(
      expect.arrayContaining(['primeira_partida', 'primeiro_titulo', 'invencivel'])
    );
    expect(typeof updated.unlocked.primeiro_titulo).toBe('string');
  });

  it('does not increment titlesByMode when not champion', () => {
    const runResult = { mode: 'copa', isChampion: false, losses: 1, squadAvgOvr: 70, sevenZeroEligible: false };
    const updated = recordRun(runResult, ['primeira_partida']);
    expect(updated.stats.titlesByMode.copa).toBe(0);
    expect(updated.stats.tournamentsPlayed).toBe(1);
  });

  it('accumulates across multiple calls', () => {
    recordRun({ mode: 'brasileirao', isChampion: true, losses: 2, squadAvgOvr: 82, sevenZeroEligible: false }, ['primeira_partida', 'primeiro_titulo']);
    const second = recordRun({ mode: 'copa', isChampion: true, losses: 0, squadAvgOvr: 91, sevenZeroEligible: false }, ['invencivel', 'geracao_de_ouro']);

    expect(second.stats.tournamentsPlayed).toBe(2);
    expect(second.stats.titlesByMode).toEqual({ brasileirao: 1, copa: 1, lendaria: 0 });
    expect(Object.keys(second.unlocked)).toEqual(
      expect.arrayContaining(['primeira_partida', 'primeiro_titulo', 'invencivel', 'geracao_de_ouro'])
    );
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './carteirinha.js'`.

- [ ] **Step 3: Implement `src/carteirinha.js`**

```js
const STORAGE_KEY = 'bl_carteirinha_v1';

function emptyCarteirinha() {
  return {
    unlocked: {},
    stats: { tournamentsPlayed: 0, titlesByMode: { brasileirao: 0, copa: 0, lendaria: 0 } },
  };
}

export function loadCarteirinha() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCarteirinha();
    const parsed = JSON.parse(raw);
    return {
      unlocked: parsed.unlocked || {},
      stats: {
        tournamentsPlayed: parsed.stats?.tournamentsPlayed ?? 0,
        titlesByMode: { brasileirao: 0, copa: 0, lendaria: 0, ...(parsed.stats?.titlesByMode || {}) },
      },
    };
  } catch {
    return emptyCarteirinha();
  }
}

export function saveCarteirinha(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function recordRun(runResult, newlyUnlocked) {
  const current = loadCarteirinha();
  const now = new Date().toISOString();

  const unlocked = { ...current.unlocked };
  newlyUnlocked.forEach(id => { unlocked[id] = now; });

  const titlesByMode = { ...current.stats.titlesByMode };
  if (runResult.isChampion) {
    titlesByMode[runResult.mode] = (titlesByMode[runResult.mode] || 0) + 1;
  }

  const next = {
    unlocked,
    stats: { tournamentsPlayed: current.stats.tournamentsPlayed + 1, titlesByMode },
  };
  saveCarteirinha(next);
  return next;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npm test
```

Expected: all `carteirinha.test.js` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/carteirinha.js src/carteirinha.test.js
git commit -m "feat: add carteirinha localStorage persistence module"
```

---

### Task 4: Wire achievement tracking into `App.jsx`

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `buildRunResult`, `checkAchievements` from `./achievements.js`; `loadCarteirinha`, `recordRun` from `./carteirinha.js`.
- Produces: `carteirinha` and `justUnlocked` state passed into `Results` (Task 5 doesn't need this, but Task 4 delivers it now since it's the natural place); `carteirinha` state passed into the new `Carteirinha` screen (added in Task 5).

- [ ] **Step 1: Import the new modules**

At the top of `src/App.jsx`, after the existing `import Peer from 'peerjs';` line (line 2):

```js
import { ACHIEVEMENTS, buildRunResult, checkAchievements } from './achievements.js';
import { loadCarteirinha, recordRun } from './carteirinha.js';
```

- [ ] **Step 2: Add carteirinha state and the run-recording effect**

In `src/App.jsx`, inside `export default function App() {`, right after the `const [cropSrc, setCropSrc] = useState(null);` line (around line 1951), add:

```js
  // Conquistas / Carteirinha
  const [carteirinha, setCarteirinha] = useState(() => loadCarteirinha());
  const [justUnlocked, setJustUnlocked] = useState([]);
  const resultRecordedRef = useRef(false);

  useEffect(() => {
    if (phase !== 'results') {
      resultRecordedRef.current = false;
      return;
    }
    if (resultRecordedRef.current) return;
    resultRecordedRef.current = true;

    const runResult = buildRunResult({
      mode: gameMode,
      myTeamId: MY_TEAM_ID,
      leagueTable,
      cupWinnerId,
      leagueTeams,
    });
    const { newlyUnlocked } = checkAchievements(runResult, loadCarteirinha().unlocked);
    const updated = recordRun(runResult, newlyUnlocked);
    setCarteirinha(updated);
    setJustUnlocked(newlyUnlocked);
  }, [phase, gameMode, leagueTable, cupWinnerId, leagueTeams]);
```

- [ ] **Step 3: Reset `justUnlocked` on restart**

In `src/App.jsx`, inside `const restart = () => { ... }` (around line 2411), add one line anywhere in the body (e.g., right after `setCupWinnerId(null);` at the end):

```js
    setJustUnlocked([]);
```

Do not reset `carteirinha` here — it must persist across runs (it's reloaded from `localStorage` on first mount anyway via `useState(() => loadCarteirinha())`, so leaving the in-memory copy alone is correct and avoids an unnecessary re-read).

- [ ] **Step 4: Pass the new badges into `Results`**

In `src/App.jsx`, update the `<Results .../>` call (around line 2860):

```jsx
          <Results leagueTable={leagueTable} myTeamId={MY_TEAM_ID} myTeamColor={myTeamColor} myTeamBadge={myTeamBadge} myTeamLogo={myTeamLogo} gameMode={gameMode} cupWinnerId={cupWinnerId} leagueTeams={leagueTeams} onRestart={restart} justUnlocked={justUnlocked} />
```

- [ ] **Step 5: Show newly unlocked badges on the Results screen**

In `src/App.jsx`, update the `Results` function signature (around line 4561):

```js
function Results({ leagueTable, myTeamId, myTeamColor, myTeamBadge, myTeamLogo, gameMode, cupWinnerId, leagueTeams, onRestart, justUnlocked }) {
  const mc = myTeamColor || '#d4a23c';
  const unlockedBadges = (justUnlocked || []).map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean);
```

Then, in both the Copa branch and the Brasileirão branch of `Results`, render `unlockedBadges` right before the closing `</div>` of the outer `<div style={styles.card} className="card-mob">`. For the Copa branch (right after the `<AnthemPlayer club={champClub} />` line, before the "Jogar de novo" button, around line 4588):

```jsx
        {unlockedBadges.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={styles.sectionLabel}>Novas conquistas</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {unlockedBadges.map(b => (
                <div key={b.id} style={{ ...styles.badge, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{b.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{b.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{b.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
```

For the Brasileirão branch, add the same block right after the `<AnthemPlayer club={champClub} />` line (around line 4631), before the `<div className="table-scroll">` line.

- [ ] **Step 6: Manual verification**

```bash
npm run dev
```

Play a full Brasileirão or Copa do Brasil run to completion (any outcome). On the Results screen, confirm a "Novas conquistas" section appears showing at least "Primeira Partida" (and "Primeiro Título" if you won). Open DevTools → Application → Local Storage, confirm a `bl_carteirinha_v1` key exists with the expected shape. Play a second run and confirm badges already unlocked don't reappear in "Novas conquistas", but `tournamentsPlayed` in storage increments.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire achievement tracking into results flow"
```

---

### Task 5: "Carteirinha" screen and Home nav entry

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `carteirinha` state and `ACHIEVEMENTS` from Task 4 / Task 2.
- Produces: a new `phase === 'carteirinha'` route reachable from the Home screen and returning to it.

- [ ] **Step 1: Add the nav button on the Home screen**

In `src/App.jsx`, update the `Intro` function signature (around line 2984) to accept two new props:

```js
function Intro({ onStart, gameMode, onSetGameMode, myTeamName, myTeamBadge, myTeamColor, myTeamCoach, myTeamCity, myTeamLogo, onSetName, onSetBadge, onSetColor, onSetCoach, onSetCity, onSetLogo, cropSrc, onSetCropSrc, onMultiPlayer, onOpenCarteirinha, carteirinhaBadgeCount }) {
```

Then, right after the `<div style={styles.introBadge}>⚽ Futebol Brasileiro · 1959–2024</div>` line (around line 3014), add:

```jsx
      <button
        onClick={onOpenCarteirinha}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
          padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(212,162,60,0.4)',
          background: 'rgba(212,162,60,0.08)', color: '#d4a23c', fontSize: 12, fontWeight: 700,
        }}
      >
        🎖️ Minha Carteirinha {carteirinhaBadgeCount > 0 ? `(${carteirinhaBadgeCount})` : ''}
      </button>
```

- [ ] **Step 2: Pass the new props from `App()` into `<Intro />`**

In `src/App.jsx`, update the `<Intro ... />` call (around line 2781):

```jsx
          <Intro
            onStart={goToFormationPicker}
            gameMode={gameMode} onSetGameMode={setGameMode}
            myTeamName={myTeamName} myTeamBadge={myTeamBadge} myTeamColor={myTeamColor}
            myTeamCoach={myTeamCoach} myTeamCity={myTeamCity} myTeamLogo={myTeamLogo}
            onSetName={setMyTeamName} onSetBadge={setMyTeamBadge} onSetColor={setMyTeamColor}
            onSetCoach={setMyTeamCoach} onSetCity={setMyTeamCity}
            onSetLogo={setMyTeamLogo} cropSrc={cropSrc} onSetCropSrc={setCropSrc}
            onMultiPlayer={() => setMultiPhase('lobby')}
            onOpenCarteirinha={() => setPhase('carteirinha')}
            carteirinhaBadgeCount={Object.keys(carteirinha.unlocked).length}
          />
```

- [ ] **Step 3: Add the `Carteirinha` screen component**

In `src/App.jsx`, right after the `Results` function's closing brace (around line 4679, before `function Stat({ label, value }) {`), add:

```js
function Carteirinha({ carteirinha, onBack }) {
  const { unlocked, stats } = carteirinha;
  return (
    <div style={styles.card} className="card-mob">
      <div style={styles.eyebrow}>Perfil</div>
      <h1 style={styles.h1} className="h1-mob">🎖️ Carteirinha</h1>

      <div style={styles.finalStats} className="stats-grid-3">
        <Stat label="Torneios" value={stats.tournamentsPlayed} />
        <Stat label="Títulos Brasileirão" value={stats.titlesByMode.brasileirao} />
        <Stat label="Títulos Copa" value={stats.titlesByMode.copa} />
      </div>

      <div style={{ ...styles.sectionLabel, marginTop: 24 }}>Selos</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }} className="feat-grid-3">
        {ACHIEVEMENTS.map(a => {
          const unlockedAt = unlocked[a.id];
          return (
            <div
              key={a.id}
              style={{
                padding: '14px 12px', borderRadius: 12, border: '1px solid',
                borderColor: unlockedAt ? 'rgba(212,162,60,0.4)' : 'rgba(255,255,255,0.08)',
                background: unlockedAt ? 'rgba(212,162,60,0.08)' : 'rgba(255,255,255,0.02)',
                opacity: unlockedAt ? 1 : 0.45,
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 6, filter: unlockedAt ? 'none' : 'grayscale(1)' }}>{a.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: unlockedAt ? '#d4a23c' : '#F4F1EA' }}>{a.title}</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 3 }}>{a.description}</div>
              {unlockedAt && (
                <div style={{ fontSize: 10, opacity: 0.5, marginTop: 6, fontFamily: "'Space Mono', monospace" }}>
                  {new Date(unlockedAt).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button style={{ ...styles.btnPrimary, marginTop: 24, width: '100%', background: '#d4a23c', color: '#0B1A12' }} onClick={onBack}>
        ← Voltar
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Route to the new screen**

In `src/App.jsx`, right after the `{phase === 'intro' && !multiPhase && ( <Intro ... /> )}` block closes (around line 2791, right before `{phase === 'formation' && <FormationPicker onChoose={chooseFormation} />}`), add:

```jsx
        {phase === 'carteirinha' && (
          <Carteirinha carteirinha={carteirinha} onBack={() => setPhase('intro')} />
        )}
```

- [ ] **Step 5: Manual verification**

```bash
npm run dev
```

From the Home screen, click "🎖️ Minha Carteirinha" — confirm it opens the new screen showing the badge grid (all greyed out on a fresh browser profile) and stats at 0. Click "← Voltar" — confirm it returns to Home. Complete a tournament, return Home, reopen the Carteirinha — confirm the earned badge(s) now show in color with a date, and the badge count next to the nav button updated.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Carteirinha screen and Home nav entry"
```

---

### Task 6: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

```bash
npm test
```

Expected: all tests in `src/achievements.test.js` and `src/carteirinha.test.js` pass.

- [ ] **Step 2: Fresh-profile manual walkthrough**

In a private/incognito window (guarantees empty `localStorage`):
1. Open the app, go to Carteirinha — confirm every badge is greyed out and stats are all 0.
2. Play and win a Brasileirão with a weak XI (avg OVR under 75) — confirm "Primeira Partida", "Primeiro Título", and "Zebra Histórica" (and "Invencível" if you didn't lose a match) unlock on the Results screen and persist when you revisit Carteirinha.
3. Play and lose a Copa do Brasil (get eliminated) — confirm no new title-gated badges unlock, but `tournamentsPlayed` still increments.

- [ ] **Step 3: Record the outcome**

No commit needed for this task — it's a verification checkpoint. If any step fails, return to the relevant task above and fix before considering this plan complete.
