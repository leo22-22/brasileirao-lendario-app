import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import pool from '../db.js';
import { BRAZIL_UFS } from './me.js';
import { requireAuth } from '../auth.js';

const router = Router();

// Ranking público — não precisa de login pra ver, só pra entrar nele
// (entrar exige jogar logado, via POST /api/me/season-result). Paginado (não
// devolve todo mundo de uma vez) + filtros opcionais por UF e por escudo
// oficial escolhido, pra dar pra ver o ranking inteiro (não só um top fixo)
// fatiado do jeito que o jogador quiser.
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

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (uf) { conditions.push('team_uf = ?'); params.push(uf); }
    if (logo) { conditions.push('team_logo = ?'); params.push(logo); }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // `limit`/`offset` já validados/limitados acima — interpolados direto na
    // query (não como placeholder) porque o protocolo de prepared statement
    // do MySQL não aceita parâmetro nas cláusulas LIMIT/OFFSET de forma confiável.
    // team_logo NUNCA entra no SELECT — pode ser um data URL de vários KB
    // (logo customizado), inviável repetir em toda linha de uma lista.
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

    // Estatísticas globais da comunidade (sempre sem filtro, é sobre o jogo
    // inteiro) — só busca na primeira página pra não repetir a query toda
    // vez que o cliente pede "carregar mais".
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

// Posição do jogador autenticado no ranking GLOBAL (sem filtro — é sobre o
// campeonato inteiro, não uma fatia filtrada) — alimenta o botão "Ver minha
// classificação". Conta quantos jogadores ficam à frente pelo mesmo critério
// de desempate da listagem principal, em vez de trazer a tabela inteira pro
// servidor só pra achar um índice.
router.get('/me', requireAuth, async (req, res) => {
  try {
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

    res.json({
      rank: Number(aheadRows[0]?.ahead || 0) + 1,
      total: Number(totalRows[0]?.total || 0),
    });
  } catch (err) {
    console.error('[leaderboard/me]', err);
    res.status(500).json({ error: 'Erro interno ao buscar sua classificação.' });
  }
});

export default router;
