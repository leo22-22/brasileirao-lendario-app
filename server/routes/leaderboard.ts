import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import pool from '../db.js';

const router = Router();

// Ranking público — não precisa de login pra ver, só pra entrar nele
// (entrar exige jogar logado, via POST /api/me/season-result).
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    // `limit` já é um número validado/limitado acima — interpolado direto na
    // query (não como placeholder) porque o protocolo de prepared statement
    // do MySQL não aceita parâmetro na cláusula LIMIT de forma confiável.
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT username, titles_brasileirao, titles_copa, seasons_played, best_position, ranking_points
       FROM users
       ORDER BY ranking_points DESC, titles_brasileirao DESC, titles_copa DESC
       LIMIT ${limit}`
    );
    res.json({ leaderboard: rows });
  } catch (err) {
    console.error('[leaderboard]', err);
    res.status(500).json({ error: 'Erro interno ao buscar o ranking.' });
  }
});

export default router;
