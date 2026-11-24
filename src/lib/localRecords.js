// Recordes guardados no aparelho, pra quem joga sem conta (quem está logado
// usa o servidor — ver api.submitDailyChallengeResult / submitCopaCampaign).
// Tudo em try/catch: modo anônimo e storage bloqueado não podem quebrar o jogo.

const DAILY_KEY = 'brl_daily_streak';
const COPA_KEY = 'brl_copa_record';

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sem storage */ }
};

// dateKey no formato do jogo: "AAAA-M-D" (hora local).
export function previousDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
}

/** Sequência de dias seguidos jogando a Supercopa (qualquer resultado). */
export function recordLocalDailyPlay(dateKey) {
  const cur = read(DAILY_KEY, { last: null, streak: 0, best: 0 });
  if (cur.last === dateKey) return cur;
  const streak = cur.last === previousDateKey(dateKey) ? cur.streak + 1 : 1;
  const next = { last: dateKey, streak, best: Math.max(cur.best || 0, streak) };
  write(DAILY_KEY, next);
  return next;
}

export function readLocalDailyStreak(todayKey) {
  const cur = read(DAILY_KEY, { last: null, streak: 0, best: 0 });
  // Sequência "viva" só se jogou hoje ou ontem.
  const alive = cur.last === todayKey || cur.last === previousDateKey(todayKey);
  return { ...cur, streak: alive ? cur.streak : 0 };
}

// Copa: stage 0 = 16 avos … 3 = semifinal, 4 = vice, 5 = campeão.
export const COPA_STAGE_LABELS = ['16 avos de final', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'Vice-campeão', 'Campeão'];

// O que a tela disse na PRIMEIRA vez que viu cada campanha ("nova melhor
// campanha", "igualou"…). Reabrir a tela (ou o React montar duas vezes) não
// pode transformar "nova melhor campanha" em "igualou seu recorde".
const OUTCOME_KEY = 'brl_copa_outcomes';
export function rememberCopaOutcome(campaignKey, outcome) {
  const all = read(OUTCOME_KEY, {});
  if (all[campaignKey]) return all[campaignKey];
  const keys = Object.keys(all);
  if (keys.length >= 50) delete all[keys[0]];
  all[campaignKey] = { isNewRecord: !!outcome.isNewRecord, previousBest: outcome.previousBest ?? null };
  write(OUTCOME_KEY, all);
  return all[campaignKey];
}

/** Registra a campanha (uma vez por campaignKey) e devolve recorde + histórico. */
export function recordLocalCopaCampaign({ campaignKey, stage, teamLabel }) {
  const cur = read(COPA_KEY, { best: null, history: [], keys: [], total: 0 });
  const previousBest = cur.best?.stage ?? null;
  if (cur.keys.includes(campaignKey)) {
    const first = rememberCopaOutcome(campaignKey, { isNewRecord: false, previousBest });
    return { best: cur.best, history: cur.history, total: cur.total, counted: false, ...first };
  }
  const entry = { stage, teamLabel, at: new Date().toISOString() };
  const isNewRecord = previousBest == null || stage > previousBest;
  const next = {
    best: isNewRecord ? entry : cur.best,
    history: [entry, ...cur.history].slice(0, 10),
    keys: [campaignKey, ...cur.keys].slice(0, 50),
    total: (cur.total || 0) + 1,
  };
  write(COPA_KEY, next);
  rememberCopaOutcome(campaignKey, { isNewRecord, previousBest });
  return { best: next.best, history: next.history, total: next.total, counted: true, isNewRecord, previousBest };
}
