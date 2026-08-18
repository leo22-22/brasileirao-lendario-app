import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool, { toPublicUser, USERNAME_RE, type UserRow } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Colunas que o cliente pode atualizar diretamente (sem tratamento especial).
const SIMPLE_FIELDS = ['team_name', 'team_color', 'team_logo', 'team_coach', 'team_city', 'goal_audio'] as const;

// 26 estados + Distrito Federal — usado tanto pra validar team_uf quanto pro
// filtro de região do ranking global.
export const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

async function getUserOr404(userId: number, res: import('express').Response): Promise<UserRow | null> {
  const [rows] = await pool.query<(UserRow & RowDataPacket)[]>('SELECT * FROM users WHERE id = ?', [userId]);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: 'Conta não encontrada.' });
    return null;
  }
  return row;
}

router.get('/', async (req, res) => {
  const row = await getUserOr404(req.userId!, res);
  if (!row) return;
  // Chamado sempre que o app carrega com uma sessão válida — melhor sinal de
  // "jogador ativo" que login sozinho (o token fica salvo entre sessões).
  pool.query('UPDATE users SET last_active_at = NOW() WHERE id = ?', [row.id]).catch(err => console.error('[touch last_active_at]', err));
  res.json({ user: toPublicUser(row) });
});

router.put('/', async (req, res) => {
  try {
    const userId = req.userId!;
    const current = await getUserOr404(userId, res);
    if (!current) return;

    const body = req.body ?? {};
    const updates: Record<string, unknown> = {};

    for (const field of SIMPLE_FIELDS) {
      if (field in body) {
        if (body[field] !== null && typeof body[field] !== 'string') {
          return res.status(400).json({ error: `Campo ${field} inválido.` });
        }
        updates[field] = body[field];
      }
    }

    if ('team_uf' in body) {
      if (body.team_uf !== null && typeof body.team_uf !== 'string') {
        return res.status(400).json({ error: 'UF inválida.' });
      }
      const normalizedUf = body.team_uf ? body.team_uf.trim().toUpperCase() : null;
      if (normalizedUf !== null && !BRAZIL_UFS.includes(normalizedUf)) {
        return res.status(400).json({ error: 'UF inválida.' });
      }
      updates.team_uf = normalizedUf;
    }

    if ('username' in body) {
      if (typeof body.username !== 'string') {
        return res.status(400).json({ error: 'Nome de usuário inválido.' });
      }
      const normalizedUsername = body.username.trim();
      if (!USERNAME_RE.test(normalizedUsername)) {
        return res.status(400).json({ error: 'Nome de usuário deve ter de 3 a 20 caracteres (letras, números, ponto, hífen ou underscore).' });
      }
      if (normalizedUsername !== current.username) {
        const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE username = ? AND id != ?', [normalizedUsername, userId]);
        if (existing.length > 0) {
          return res.status(409).json({ error: 'Esse nome de usuário já está em uso.' });
        }
      }
      updates.username = normalizedUsername;
    }

    if ('email' in body) {
      if (typeof body.email !== 'string') {
        return res.status(400).json({ error: 'Email inválido.' });
      }
      const normalizedEmail = body.email.trim().toLowerCase();
      if (!EMAIL_RE.test(normalizedEmail)) {
        return res.status(400).json({ error: 'Email inválido.' });
      }
      if (normalizedEmail !== current.email) {
        const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ? AND id != ?', [normalizedEmail, userId]);
        if (existing.length > 0) {
          return res.status(409).json({ error: 'Já existe uma conta com esse email.' });
        }
      }
      updates.email = normalizedEmail;
    }

    if ('password' in body) {
      if (typeof body.password !== 'string' || body.password.length < 6) {
        return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
      }
      updates.password_hash = await bcrypt.hash(body.password, 10);
    }

    const columns = Object.keys(updates);
    if (columns.length === 0) {
      return res.json({ user: toPublicUser(current) });
    }

    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = columns.map(col => updates[col]);
    await pool.query(`UPDATE users SET ${setClause} WHERE id = ?`, [...values, userId]);

    const [rows] = await pool.query<(UserRow & RowDataPacket)[]>('SELECT * FROM users WHERE id = ?', [userId]);
    return res.json({ user: toPublicUser(rows[0]) });
  } catch (err) {
    console.error('[update me]', err);
    return res.status(500).json({ error: 'Erro interno ao atualizar a conta.' });
  }
});

// Registra o resultado de uma temporada encerrada (Brasileirão ou Copa) e
// atualiza títulos/pontos de ranking/conquistas da conta. Chamado pelo cliente
// ao chegar na tela de resultado, só quando o usuário está logado.
router.post('/season-result', async (req, res) => {
  try {
    const userId = req.userId!;
    const current = await getUserOr404(userId, res);
    if (!current) return;

    const body = req.body ?? {};
    // Série B (modo "serieab") entra no ranking como um Brasileirão normal —
    // títulos, posição e conquistas contam do mesmo jeito — mas os pontos de
    // campanha valem metade: é uma divisão mais fraca que a Série A.
    const gameMode = body.gameMode === 'copa' ? 'copa' : 'brasileirao';
    const isSerieB = body.gameMode === 'serieab' && body.division === 'B';
    const champion = !!body.champion;
    const position = Number.isFinite(body.position) ? Number(body.position) : null;
    const losses = Number.isFinite(body.losses) ? Number(body.losses) : null;
    const gotTopScorerAward = !!body.gotTopScorerAward;
    // V/E/D da campanha que acabou de terminar — acumulados na carreira pro
    // "Ver Clube". matchesPlayed é derivado aqui (soma dos 3), não confiado
    // direto do cliente, pra nunca ficar inconsistente com wins+draws+losses.
    const wins = Number.isFinite(body.wins) ? Math.max(0, Number(body.wins)) : 0;
    const draws = Number.isFinite(body.draws) ? Math.max(0, Number(body.draws)) : 0;
    const lossesCount = losses ?? 0;
    const matchesPlayed = wins + draws + lossesCount;
    // Estatísticas de carreira (acumuladas em todas as temporadas/copas) e
    // flags desse resultado específico — usadas pras conquistas de marcos
    // (gols/assistências/gols sofridos/saldo) e de campanha invicta/multiplayer.
    const goalsScored = Number.isFinite(body.goalsScored) ? Math.max(0, Number(body.goalsScored)) : 0;
    const goalsConceded = Number.isFinite(body.goalsConceded) ? Math.max(0, Number(body.goalsConceded)) : 0;
    const assistsMade = Number.isFinite(body.assistsMade) ? Math.max(0, Number(body.assistsMade)) : 0;
    const unbeaten = !!body.unbeaten;
    const isMultiplayer = !!body.multiplayer;
    // Overall do time (média do XI, com casa decimal) e do melhor jogador
    // individual escalado NESTA temporada — comparados com o recorde salvo
    // pra decidir se bateu marco novo (nunca diminui, só o maior dos dois).
    const teamOvr = Number.isFinite(body.teamOvr) ? Number(body.teamOvr) : null;
    const seasonBestPlayerOvr = Number.isFinite(body.bestPlayerOvr) ? Number(body.bestPlayerOvr) : null;

    let titlesBr = current.titles_brasileirao;
    let titlesCopa = current.titles_copa;
    let bestPosition = current.best_position;
    const seasonsPlayed = current.seasons_played + 1;
    let unbeatenTitlesBr = current.unbeaten_titles_brasileirao;
    let unbeatenTitlesCopa = current.unbeaten_titles_copa;
    let multiplayerWins = current.multiplayer_wins;

    if (champion) {
      if (gameMode === 'brasileirao') titlesBr += 1; else titlesCopa += 1;
      if (unbeaten) {
        if (gameMode === 'brasileirao') unbeatenTitlesBr += 1; else unbeatenTitlesCopa += 1;
      }
      if (isMultiplayer) multiplayerWins += 1;
    }
    if (gameMode === 'brasileirao' && position != null) {
      bestPosition = bestPosition == null ? position : Math.min(bestPosition, position);
    }

    const careerGoals = current.career_goals + goalsScored;
    const careerAssists = current.career_assists + assistsMade;
    const careerConceded = current.career_conceded + goalsConceded;
    const seasonGoalDiff = goalsScored - goalsConceded;
    const bestGoalDiff = current.best_goal_diff == null ? seasonGoalDiff : Math.max(current.best_goal_diff, seasonGoalDiff);

    // Pontos da temporada = campanha × dificuldade + gols feitos - gols sofridos.
    //
    // Os gols valem 1:1 em qualquer dificuldade: são o sinal de time e tática,
    // e numa temporada de 38 rodadas vêm às dezenas, então é o que mais pesa.
    // Quem marca muito sobe, quem leva goleada desce — e o saldo pode ficar
    // NEGATIVO numa campanha ruim (é essa a intenção; ranking_points é INT
    // com sinal).
    //
    // O multiplicador cai só sobre a campanha (título/colocação) porque medimos
    // que, sem ele, a regra dos gols PUNIA quem jogava difícil: no Lendário a
    // média era 16º lugar com 48 gols feitos e 61 sofridos (-7,7 pts por
    // temporada), enquanto no Fácil dava 5,5º com 62x51 (+26). Farmar o Fácil
    // rendia mais que encarar o Lendário. Com o peso, um título no Lendário
    // vale ~4x um no Fácil e uma campanha ruim lá fica perto de zero em vez de
    // negativa — arriscar a dificuldade alta deixa de ser prejuízo.
    const DIFFICULTY_WEIGHT: Record<string, number> = {
      facil: 0.5, normal: 1, dificil: 1.75, lendario: 3,
    };
    const difficulty = typeof body.difficulty === 'string' ? body.difficulty : 'normal';
    const weight = DIFFICULTY_WEIGHT[difficulty] ?? 1;

    let campaignPoints = 5; // participação
    if (champion) campaignPoints = gameMode === 'brasileirao' ? 50 : 40;
    else if (gameMode === 'brasileirao' && position != null) campaignPoints = Math.max(5, 21 - position);
    if (isSerieB) campaignPoints *= 0.5;
    // Arredonda só a campanha (o peso gera fração); os gols já são inteiros.
    const pointsEarned = Math.round(campaignPoints * weight) + goalsScored - goalsConceded;
    const rankingPoints = current.ranking_points + pointsEarned;

    const newBestTeamOvr = teamOvr != null ? Math.max(Number(current.best_team_ovr) || 0, teamOvr) : current.best_team_ovr;
    const newBestPlayerOvr = seasonBestPlayerOvr != null ? Math.max(current.best_player_ovr || 0, seasonBestPlayerOvr) : current.best_player_ovr;
    const totalMatchesPlayed = current.career_matches_played + matchesPlayed;
    const totalWins = current.career_wins + wins;

    const before = new Set(JSON.parse(current.achievements || '[]'));
    const after = new Set(before);
    const totalTitles = titlesBr + titlesCopa;
    if (totalTitles >= 1) after.add('first_title');
    if (totalTitles >= 3) after.add('dynasty');
    if (seasonsPlayed >= 10) after.add('veteran');
    if (bestPosition != null && bestPosition <= 3) after.add('podium_finish');
    if (bestPosition != null && bestPosition <= 5) after.add('top5_finish');
    if (bestPosition != null && bestPosition <= 10) after.add('top10_finish');
    if (gameMode === 'brasileirao' && losses === 0) after.add('unbeaten_season');
    if (gotTopScorerAward) after.add('golden_boot');
    // Campanha turbulenta (humor) e artilharia de uma única temporada — usam
    // o resultado DESSA temporada, não o total acumulado de carreira.
    if (lossesCount >= 15) after.add('turbulent_season');
    if (goalsScored >= 50) after.add('season_goals_50');
    if (goalsScored >= 100) after.add('season_goals_100');
    if (goalsScored >= 150) after.add('season_goals_150');
    // Título por dificuldade — o multiplicador de pontos já existia, mas
    // nenhuma conquista reconhecia especificamente ter encarado (e vencido)
    // no nível mais duro.
    if (champion) after.add(`champion_${difficulty}`);
    if (champion && unbeaten && (difficulty === 'dificil' || difficulty === 'lendario')) after.add(`unbeaten_${difficulty}`);
    // Série A/B: subiu de divisão ou foi campeão da Série B.
    if (body.divisionMove === 'promoted') after.add('serieab_promoted');
    if (champion && isSerieB) after.add('serieab_champion_b');

    // Gera os `after.add` de uma família de marcos por contador (mesmo campo
    // pra todos os thresholds) — evita repetir o mesmo `.forEach` de novo pra
    // cada família (gols, assistências, partidas, etc.), que só mudavam a
    // lista de números e o prefixo do id.
    const addTiers = (value: number, prefix: string, thresholds: number[]) => {
      thresholds.forEach(n => { if (value >= n) after.add(`${prefix}_${n}`); });
    };
    // Mesmas listas do catálogo no cliente (App.jsx, ACHIEVEMENT_CATALOG) —
    // manter os dois em sincronia é o que faz uma conquista existir E
    // conseguir ser desbloqueada.
    const CAREER_TIERS = [10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 10000, 12500, 15000, 17500, 20000, 25000, 30000, 40000, 50000, 75000, 100000];
    const VOLUME_TIERS = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000];
    const SQUAD_OVR_TIERS = Array.from({ length: 25 }, (_, i) => 75 + i); // 75..99
    const TEAM_OVR_TIERS = Array.from({ length: 20 }, (_, i) => 80 + i); // 80..99
    const GOAL_DIFF_TIERS = [10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 150, 200];
    const TITLE_TIERS = [5, 10, 15, 25, 50, 100];
    const SEASON_TIERS = [15, 20, 25, 50, 75, 100, 150, 200];
    const MP_WINS_TIERS = [5, 15, 25, 50, 100, 250];

    // Marcos de carreira (gols/assistências/gols sofridos acumulados)
    addTiers(careerGoals, 'goals', CAREER_TIERS);
    addTiers(careerAssists, 'assists', CAREER_TIERS);
    addTiers(careerConceded, 'conceded', CAREER_TIERS);

    // Saldo de gols (melhor campanha individual)
    addTiers(Math.max(0, bestGoalDiff), 'goal_diff', GOAL_DIFF_TIERS);

    // Campeão invicto (Brasileirão e/ou Copa do Brasil) e o "dose dupla" das duas
    if (champion && unbeaten && gameMode === 'brasileirao') after.add('unbeaten_league_champion');
    if (champion && unbeaten && gameMode === 'copa') after.add('unbeaten_cup_champion');
    if (unbeatenTitlesBr > 0 && unbeatenTitlesCopa > 0) after.add('perfect_double');
    addTiers(unbeatenTitlesBr, 'unbeaten_br', [5, 10]);
    addTiers(unbeatenTitlesCopa, 'unbeaten_copa', [5, 10]);

    // Multiplayer
    if (isMultiplayer && champion) after.add('multiplayer_win');
    if (multiplayerWins >= 10) after.add('multiplayer_veteran');
    addTiers(multiplayerWins, 'mpwins', MP_WINS_TIERS);

    // Elenco de encher os olhos (melhor jogador individual já escalado) e
    // time de encher os olhos (melhor overall médio do XI já alcançado)
    if (newBestPlayerOvr != null) addTiers(newBestPlayerOvr, 'squad_ovr', SQUAD_OVR_TIERS);
    if (newBestTeamOvr != null) addTiers(newBestTeamOvr, 'team_ovr', TEAM_OVR_TIERS);

    // Volume de carreira (jogos disputados, vitórias, empates e derrotas)
    const totalDraws = current.career_draws + draws;
    const totalLosses = current.career_losses + lossesCount;
    addTiers(totalMatchesPlayed, 'matches', VOLUME_TIERS);
    addTiers(totalWins, 'wins', VOLUME_TIERS);
    addTiers(totalDraws, 'draws', VOLUME_TIERS);
    addTiers(totalLosses, 'losses', VOLUME_TIERS);

    // Títulos e temporadas em maior escala (as versões "uma vez" já existem acima)
    addTiers(totalTitles, 'titles', TITLE_TIERS);
    addTiers(seasonsPlayed, 'seasons', SEASON_TIERS);

    const newlyUnlocked = [...after].filter(a => !before.has(a));

    await pool.query(
      `UPDATE users SET titles_brasileirao=?, titles_copa=?, seasons_played=?, best_position=?, ranking_points=?, achievements=?,
       career_goals=?, career_assists=?, career_conceded=?, best_goal_diff=?, unbeaten_titles_brasileirao=?, unbeaten_titles_copa=?, multiplayer_wins=?,
       career_matches_played=career_matches_played+?, career_wins=career_wins+?, career_draws=career_draws+?, career_losses=career_losses+?,
       best_team_ovr=?, best_player_ovr=?
       WHERE id=?`,
      [
        titlesBr, titlesCopa, seasonsPlayed, bestPosition, rankingPoints, JSON.stringify([...after]),
        careerGoals, careerAssists, careerConceded, bestGoalDiff, unbeatenTitlesBr, unbeatenTitlesCopa, multiplayerWins,
        matchesPlayed, wins, draws, lossesCount,
        newBestTeamOvr, newBestPlayerOvr,
        userId,
      ]
    );
    // Um evento por temporada, com os pontos ganhos NESSA hora — é o que
    // sustenta o ranking diário/semanal/mensal (soma dos eventos numa janela
    // de tempo, ver GET /api/leaderboard). Grava até quando pointsEarned é
    // zero ou negativo (campanha ruim): uma semana fraca tem que puxar a
    // soma da janela pra baixo igual puxa o total vitalício.
    await pool.query('INSERT INTO ranking_events (user_id, points) VALUES (?, ?)', [userId, pointsEarned]);

    const [rows] = await pool.query<(UserRow & RowDataPacket)[]>('SELECT * FROM users WHERE id = ?', [userId]);
    return res.json({ user: toPublicUser(rows[0]), newlyUnlocked });
  } catch (err) {
    console.error('[season-result]', err);
    return res.status(500).json({ error: 'Erro interno ao registrar o resultado da temporada.' });
  }
});

// Vitória no Desafio do Dia — pontos fixos de ranking (não passa pelas
// conquistas/estatísticas de carreira do season-result, é só uma partida
// avulsa). `dateKey` vem do cliente (mesmo usado pra sortear o confronto do
// dia, na hora local de cada um) — o servidor só usa pra travar em uma
// premiação por dia, comparando com a última data já premiada.
const DAILY_CHALLENGE_POINTS = 50;
router.post('/daily-challenge-result', async (req, res) => {
  try {
    const userId = req.userId!;
    const current = await getUserOr404(userId, res);
    if (!current) return;

    const dateKey = typeof req.body?.dateKey === 'string' ? req.body.dateKey.slice(0, 10) : null;
    if (!dateKey) {
      return res.status(400).json({ error: 'dateKey inválido.' });
    }
    if (current.last_daily_points_date === dateKey) {
      return res.json({ user: toPublicUser(current), alreadyClaimed: true });
    }

    const rankingPoints = current.ranking_points + DAILY_CHALLENGE_POINTS;
    await pool.query('UPDATE users SET ranking_points=?, last_daily_points_date=? WHERE id=?', [rankingPoints, dateKey, userId]);
    await pool.query('INSERT INTO ranking_events (user_id, points) VALUES (?, ?)', [userId, DAILY_CHALLENGE_POINTS]);

    const [rows] = await pool.query<(UserRow & RowDataPacket)[]>('SELECT * FROM users WHERE id = ?', [userId]);
    return res.json({ user: toPublicUser(rows[0]), pointsEarned: DAILY_CHALLENGE_POINTS });
  } catch (err) {
    console.error('[daily-challenge-result]', err);
    return res.status(500).json({ error: 'Erro interno ao registrar o Desafio do Dia.' });
  }
});

router.delete('/', async (req, res) => {
  try {
    const userId = req.userId!;
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Conta não encontrada.' });
    }
    return res.status(204).send();
  } catch (err) {
    console.error('[delete me]', err);
    return res.status(500).json({ error: 'Erro interno ao excluir a conta.' });
  }
});

export default router;
