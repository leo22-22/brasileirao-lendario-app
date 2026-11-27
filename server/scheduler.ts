// Avisos automáticos por push (Fase 8). Roda DENTRO do processo do servidor
// (que já fica ligado o tempo todo — é ele que mantém o registro de salas),
// sem depender de cron na hospedagem. Cada aviso diário é registrado em
// `notification_runs` (UNIQUE kind+date_key) ANTES de enviar: se o servidor
// reiniciar no meio do dia, o mesmo aviso nunca sai duas vezes.
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db.js';
import { sendPush, pushEnabled, type StoredSubscription } from './push.js';

const CHECK_EVERY_MS = 5 * 60 * 1000;
const DAILY_HOUR = 10; // 10h de Brasília: missão do dia + Supercopa
const STREAK_HOUR = 19; // 19h: sequência da Supercopa em risco
const QUICK_COOLDOWN_HOURS = 6;

// Hora de Brasília (UTC-3, sem horário de verão desde 2019).
function brasilia(now = new Date()) {
  const d = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), weekday: d.getUTCDay(), date: d };
}
// Mesmo formato do jogo: "AAAA-M-D".
const keyOf = (b: { year: number; month: number; day: number }) => `${b.year}-${b.month}-${b.day}`;
function yesterdayKey(now = new Date()) {
  const b = brasilia(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  return keyOf(b);
}

interface SubRow extends RowDataPacket { id: number; push_subscription: string | null; daily_streak?: number }

async function claimRun(kind: string, dateKey: string): Promise<boolean> {
  const [res] = await pool.query<ResultSetHeader>('INSERT IGNORE INTO notification_runs (kind, date_key) VALUES (?, ?)', [kind, dateKey]);
  return res.affectedRows > 0;
}

async function pushTo(rows: SubRow[], payload: (r: SubRow) => { title: string; body: string; url?: string }) {
  let sent = 0;
  await Promise.all(rows.map(async (r) => {
    if (!r.push_subscription) return;
    let sub: StoredSubscription;
    try { sub = JSON.parse(r.push_subscription); } catch { return; }
    const result = await sendPush(sub, payload(r));
    if (result.ok) sent++;
    if (result.gone) await pool.query('UPDATE users SET push_subscription = NULL WHERE id = ?', [r.id]).catch(() => {});
  }));
  return sent;
}

async function runDaily(now: Date) {
  const b = brasilia(now);
  if (b.hour < DAILY_HOUR || b.hour >= DAILY_HOUR + 4) return; // só de manhã — reinício à noite não manda o aviso da manhã
  if (!(await claimRun('daily', keyOf(b)))) return;
  const [rows] = await pool.query<SubRow[]>('SELECT id, push_subscription FROM users WHERE push_subscription IS NOT NULL AND notify_daily = 1');
  const sunday = b.weekday === 0;
  const sent = await pushTo(rows, () => ({
    title: sunday ? 'Domingo é dia de chefão' : 'Desafios de hoje no ar',
    body: sunday
      ? 'A Supercopa de hoje é contra um dos times mais fortes da história: vencer vale +100. A missão do dia do Brasileirão Atual também já está liberada.'
      : 'A Supercopa de hoje e a nova missão do Brasileirão Atual (+500 se cumprir) já estão liberadas.',
    url: '/',
  }));
  console.log(`[scheduler] daily ${keyOf(b)}: ${sent} push`);
}

async function runStreak(now: Date) {
  const b = brasilia(now);
  if (b.hour < STREAK_HOUR || b.hour >= STREAK_HOUR + 4) return;
  if (!(await claimRun('streak', keyOf(b)))) return;
  // Jogou ontem (sequência viva) e ainda não jogou hoje.
  const [rows] = await pool.query<SubRow[]>(
    'SELECT id, push_subscription, daily_streak FROM users WHERE push_subscription IS NOT NULL AND notify_daily = 1 AND daily_streak >= 2 AND last_daily_played_date = ?',
    [yesterdayKey(now)],
  );
  const sent = await pushTo(rows, (r) => ({
    title: 'Sua sequência acaba hoje',
    body: `Você está em ${r.daily_streak} dias seguidos na Supercopa. Jogue até a meia-noite para não perder.`,
    url: '/',
  }));
  console.log(`[scheduler] streak ${keyOf(b)}: ${sent} push`);
}

const QUICK_LABEL: Record<string, string> = { duelo: 'X1', serieab: 'Brasileirão', copa: 'Copa do Brasil' };

// Partida rápida: sala nova esperando gente → avisa quem pediu esse aviso
// (opt-in, `notify_quick`), no máximo 1 vez a cada 6h por pessoa, e nunca
// quem abriu a sala. Chamado pelo registro de salas (routes/rooms.ts).
export async function notifyQuickQueue(gameMode: string, creatorUserId: number | null) {
  if (!pushEnabled) return;
  try {
    const [rows] = await pool.query<SubRow[]>(
      `SELECT id, push_subscription FROM users
       WHERE push_subscription IS NOT NULL AND notify_quick = 1 AND id <> ?
         AND (last_quick_notify_at IS NULL OR last_quick_notify_at < (NOW() - INTERVAL ${QUICK_COOLDOWN_HOURS} HOUR))
       LIMIT 300`,
      [creatorUserId ?? 0],
    );
    if (!rows.length) return;
    await pool.query(`UPDATE users SET last_quick_notify_at = NOW() WHERE id IN (${rows.map(() => '?').join(',')})`, rows.map(r => r.id));
    const label = QUICK_LABEL[gameMode] || 'partida rápida';
    await pushTo(rows, () => ({
      title: 'Tem gente esperando para jogar',
      body: `Uma sala de ${label} acabou de abrir na partida rápida. Entre agora para jogar junto.`,
      url: `/?quick=${encodeURIComponent(gameMode)}`,
    }));
  } catch (err) {
    console.error('[scheduler] quick notify', err);
  }
}

export function startScheduler() {
  if (!pushEnabled) {
    console.warn('[scheduler] push desativado — avisos automáticos não vão rodar.');
    return;
  }
  const tick = async () => {
    const now = new Date();
    try { await runDaily(now); } catch (err) { console.error('[scheduler] daily', err); }
    try { await runStreak(now); } catch (err) { console.error('[scheduler] streak', err); }
  };
  setTimeout(tick, 30_000).unref?.();
  setInterval(tick, CHECK_EVERY_MS).unref?.();
}
