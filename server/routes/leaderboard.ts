import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import pool from '../db.js';
import { BRAZIL_UFS } from './me.js';
import { requireAuth } from '../auth.js';

const router = Router();

// Janela de cada período, em dias — "geral" não usa isso (é o
// `ranking_points` vitalício da própria conta, já pronto). Os outros somam
// `ranking_events` (um registro por temporada, com os pontos daquela hora)
// dentro da janela, o que é o que dá pra montar um "ranking da semana" sem
// nunca ter guardado nada com data antes dessa leva — quem não pontuou
// nada na janela simplesmente não aparece (é assim que ranking por período
// funciona em qualquer jogo: só quem jogou aquela semana entra na lista).
const PERIOD_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };
type Period = 'geral' | 'daily' | 'weekly' | 'monthly';

function parsePeriod(raw: unknown): Period {
  return raw === 'daily' || raw === 'weekly' || raw === 'monthly' ? raw : 'geral';
}

// Ranking público — não precisa de login pra ver, só pra entrar nele
// (entrar exige jogar logado, via POST /api/me/season-result). Paginado (não
// devolve todo mundo de uma vez) + filtros opcionais por UF e por escudo
// oficial escolhido, pra dar pra ver o ranking inteiro (não só um top fixo)
// fatiado do jeito que o jogador quiser. `period` escolhe geral (padrão,
// `ranking_points` vitalício) ou diário/semanal/mensal (soma de eventos
// dentro da janela).
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const rawUf = typeof req.query.uf === 'string' ? req.query.uf.trim().toUpperCase() : '';
    const uf = BRAZIL_UFS.includes(rawUf) ? rawUf : null;
    // O valor de `logo` é a URL do escudo oficial (o cliente já sabe o
    // mapeamento clube -> URL) — não precisa validar contra uma lista aqui,
    // é só um filtro de leitura pública, um valor que não bate com nada só
    // devolve uma lista vazia (sem risco, é parametrizado).
    const rawLogo = typeof req.query.logo === 'string' ? req.query.logo.trim() : '';
    const logo = rawLogo || null;
    const period = parsePeriod(req.query.period);

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (uf) { conditions.push('u.team_uf = ?'); params.push(uf); }
    if (logo) { conditions.push('u.team_logo = ?'); params.push(logo); }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    let rows: RowDataPacket[];
    let total: number;

    if (period === 'geral') {
      // `limit`/`offset` já validados/limitados acima — interpolados direto na
      // query (não como placeholder) porque o protocolo de prepared statement
      // do MySQL não aceita parâmetro nas cláusulas LIMIT/OFFSET de forma confiável.
      // team_logo NUNCA entra no SELECT — pode ser um data URL de vários KB
      // (logo customizado), inviável repetir em toda linha de uma lista.
      const [geralRows] = await pool.query<RowDataPacket[]>(
        `SELECT u.username, u.team_uf, u.titles_brasileirao, u.titles_copa, u.seasons_played, u.best_position, u.ranking_points
         FROM users u
         ${whereClause}
         ORDER BY u.ranking_points DESC, u.titles_brasileirao DESC, u.titles_copa DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      );
      rows = geralRows;
      const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM users u ${whereClause}`, params);
      total = Number(countRows[0]?.total || 0);
    } else {
      // Períodos: soma os `ranking_events` de cada usuário dentro da janela
      // (INNER JOIN — quem não tem nenhum evento na janela não pontuou nada
      // esse período, então nem aparece, em vez de poluir a lista com zeros).
      const days = PERIOD_DAYS[period];
      const periodParams = [days, ...params];
      const [periodRows] = await pool.query<RowDataPacket[]>(
        `SELECT u.username, u.team_uf, u.titles_brasileirao, u.titles_copa, u.seasons_played, u.best_position,
                SUM(re.points) AS ranking_points
         FROM users u
         JOIN ranking_events re ON re.user_id = u.id AND re.created_at >= NOW() - INTERVAL ? DAY
         ${whereClause}
         GROUP BY u.id
         ORDER BY ranking_points DESC, u.titles_brasileirao DESC, u.titles_copa DESC
         LIMIT ${limit} OFFSET ${offset}`,
        periodParams
      );
      rows = periodRows;
      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM (
           SELECT u.id FROM users u
           JOIN ranking_events re ON re.user_id = u.id AND re.created_at >= NOW() - INTERVAL ? DAY
           ${whereClause}
           GROUP BY u.id
         ) t`,
        periodParams
      );
      total = Number(countRows[0]?.total || 0);
    }

    // Estatísticas globais da comunidade (sempre sem filtro nem período, é
    // sobre o jogo inteiro) — só busca na primeira página pra não repetir a
    // query toda vez que o cliente pede "carregar mais".
    let stats: { totalPlayers: number; activePlayers30d: number } | undefined;
    if (offset === 0) {
      const [statsRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS totalPlayers,
                SUM(last_active_at >= NOW() - INTERVAL 30 DAY) AS activePlayers30d
         FROM users`
      );
      stats = {
        totalPlayers: Number(statsRows[0]?.totalPlayers || 0),
        activePlayers30d: Number(statsRows[0]?.activePlayers30d || 0),
      };
    }

    res.json({ leaderboard: rows, total, hasMore: offset + rows.length < total, stats });
  } catch (err) {
    console.error('[leaderboard]', err);
    res.status(500).json({ error: 'Erro interno ao buscar o ranking.' });
  }
});

// Posição do jogador autenticado no ranking (geral ou de um período) —
// alimenta o botão "Ver minha classificação". No geral, conta quantos
// jogadores ficam à frente pelo mesmo critério de desempate da listagem
// principal. No período, se o jogador não tiver nenhum evento na janela,
// ele simplesmente não está classificado ainda (`rank: null`) — não faz
// sentido inventar uma posição pra quem não pontuou nada essa semana/mês.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const period = parsePeriod(req.query.period);

    if (period === 'geral') {
      const [meRows] = await pool.query<RowDataPacket[]>(
        'SELECT ranking_points, titles_brasileirao, titles_copa FROM users WHERE id = ?',
        [req.userId]
      );
      const me = meRows[0];
      if (!me) return res.status(404).json({ error: 'Conta não encontrada.' });

      const [aheadRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS ahead FROM users
         WHERE ranking_points > ?
            OR (ranking_points = ? AND titles_brasileirao > ?)
            OR (ranking_points = ? AND titles_brasileirao = ? AND titles_copa > ?)`,
        [me.ranking_points, me.ranking_points, me.titles_brasileirao, me.ranking_points, me.titles_brasileirao, me.titles_copa]
      );
      const [totalRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM users');

      return res.json({
        rank: Number(aheadRows[0]?.ahead || 0) + 1,
        total: Number(totalRows[0]?.total || 0),
      });
    }

    const days = PERIOD_DAYS[period];
    const [meRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(points), 0) AS points, COUNT(*) AS eventCount
       FROM ranking_events WHERE user_id = ? AND created_at >= NOW() - INTERVAL ? DAY`,
      [req.userId, days]
    );
    const me = meRows[0];
    const [totalRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM (
         SELECT user_id FROM ranking_events WHERE created_at >= NOW() - INTERVAL ? DAY GROUP BY user_id
       ) t`,
      [days]
    );
    const total = Number(totalRows[0]?.total || 0);
    if (!me || Number(me.eventCount) === 0) {
      return res.json({ rank: null, total });
    }
    const [aheadRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS ahead FROM (
         SELECT user_id, SUM(points) AS pts FROM ranking_events WHERE created_at >= NOW() - INTERVAL ? DAY GROUP BY user_id
       ) t WHERE t.pts > ?`,
      [days, me.points]
    );
    return res.json({ rank: Number(aheadRows[0]?.ahead || 0) + 1, total });
  } catch (err) {
    console.error('[leaderboard/me]', err);
    res.status(500).json({ error: 'Erro interno ao buscar sua classificação.' });
  }
});

export default router;
