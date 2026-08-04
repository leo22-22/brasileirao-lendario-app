import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import pool from '../db.js';
import { BRAZIL_UFS } from './me.js';

const router = Router();

// Ranking público — não precisa de login pra ver, só pra entrar nele
// (entrar exige jogar logado, via POST /api/me/season-result). Paginado (não
// devolve todo mundo de uma vez) + filtro opcional por UF, pra dar pra ver o
// ranking inteiro (não só um top 20 fixo) e por região.
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const rawUf = typeof req.query.uf === 'string' ? req.query.uf.trim().toUpperCase() : '';
    const uf = BRAZIL_UFS.includes(rawUf) ? rawUf : null;

    // `limit`/`offset` já validados/limitados acima — interpolados direto na
    // query (não como placeholder) porque o protocolo de prepared statement
    // do MySQL não aceita parâmetro nas cláusulas LIMIT/OFFSET de forma confiável.
    const whereClause = uf ? 'WHERE team_uf = ?' : '';
    const params = uf ? [uf] : [];
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT username, team_uf, titles_brasileirao, titles_copa, seasons_played, best_position, ranking_points
       FROM users
       ${whereClause}
       ORDER BY ranking_points DESC, titles_brasileirao DESC, titles_copa DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM users ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    // Estatísticas globais da comunidade (sempre sem filtro de UF, é sobre o
    // jogo inteiro) — só busca na primeira página pra não repetir a query
    // toda vez que o cliente pede "carregar mais".
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

export default router;
