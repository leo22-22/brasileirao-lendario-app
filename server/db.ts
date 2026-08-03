import mysql from 'mysql2/promise';

// MySQL gerenciado da Hostinger, não SQLite — a hospedagem "Web App" refaz o
// diretório do app do zero a cada deploy (checkout novo do git), então um
// arquivo local (SQLite) não sobrevive entre deploys. O banco gerenciado é
// externo a esse ciclo e persiste normalmente.

// Node resolve "localhost" pra IPv6 (::1) em vários ambientes, e o usuário
// MySQL da Hostinger só tinha permissão liberada pra IPv4 — trocando por um
// IP literal não rola resolução de DNS nenhuma (sem ambiguidade v4/v6),
// então força 127.0.0.1 sempre que o host vier vazio ou como "localhost".
const resolvedHost = (!process.env.DB_HOST || process.env.DB_HOST === 'localhost') ? '127.0.0.1' : process.env.DB_HOST;

const pool = mysql.createPool({
  host: resolvedHost,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// MEDIUMTEXT (não TEXT, limite de 64KB) em team_logo/goal_audio porque os
// dois guardam data URLs em base64 que podem passar de 1MB (áudio de gol).
//
// Exportado como função (chamada por index.ts antes do app.listen), não como
// top-level await aqui — o loader Node da Hostinger (lsnode.js, via
// LiteSpeed) carrega o entry file com require(), que não aceita um grafo de
// módulos ESM com top-level await ("ERR_REQUIRE_ASYNC_MODULE").
export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(20) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      team_name VARCHAR(64),
      team_color VARCHAR(32),
      team_logo MEDIUMTEXT,
      team_coach VARCHAR(64),
      team_city VARCHAR(64),
      goal_audio MEDIUMTEXT,
      titles_brasileirao INT NOT NULL DEFAULT 0,
      titles_copa INT NOT NULL DEFAULT 0,
      seasons_played INT NOT NULL DEFAULT 0,
      best_position INT,
      ranking_points INT NOT NULL DEFAULT 0,
      achievements MEDIUMTEXT,
      career_goals INT NOT NULL DEFAULT 0,
      career_assists INT NOT NULL DEFAULT 0,
      career_conceded INT NOT NULL DEFAULT 0,
      best_goal_diff INT,
      unbeaten_titles_brasileirao INT NOT NULL DEFAULT 0,
      unbeaten_titles_copa INT NOT NULL DEFAULT 0,
      multiplayer_wins INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // O banco já está em produção com conta de verdade, então "CREATE TABLE IF
  // NOT EXISTS" sozinho não basta mais pra colunas novas (não altera tabela
  // já existente) — cada uma entra por ALTER TABLE, ignorando erro de coluna
  // duplicada (equivalente ao "ensureColumn" que a versão SQLite tinha).
  const ensureColumn = async (ddl: string) => {
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN ${ddl}`);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== 'ER_DUP_FIELDNAME') throw err;
    }
  };
  await ensureColumn('career_matches_played INT NOT NULL DEFAULT 0');
  await ensureColumn('career_wins INT NOT NULL DEFAULT 0');
  await ensureColumn('career_draws INT NOT NULL DEFAULT 0');
  await ensureColumn('career_losses INT NOT NULL DEFAULT 0');
}

export interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  team_name: string | null;
  team_color: string | null;
  team_logo: string | null;
  team_coach: string | null;
  team_city: string | null;
  goal_audio: string | null;
  titles_brasileirao: number;
  titles_copa: number;
  seasons_played: number;
  best_position: number | null;
  ranking_points: number;
  achievements: string | null;
  career_goals: number;
  career_assists: number;
  career_conceded: number;
  best_goal_diff: number | null;
  unbeaten_titles_brasileirao: number;
  unbeaten_titles_copa: number;
  multiplayer_wins: number;
  career_matches_played: number;
  career_wins: number;
  career_draws: number;
  career_losses: number;
  created_at: string;
}

export interface PublicUser {
  id: number;
  username: string;
  email: string;
  team_name: string | null;
  team_color: string | null;
  team_logo: string | null;
  team_coach: string | null;
  team_city: string | null;
  goal_audio: string | null;
  titles_brasileirao: number;
  titles_copa: number;
  seasons_played: number;
  best_position: number | null;
  ranking_points: number;
  achievements: string[];
  career_goals: number;
  career_assists: number;
  career_conceded: number;
  best_goal_diff: number | null;
  unbeaten_titles_brasileirao: number;
  unbeaten_titles_copa: number;
  multiplayer_wins: number;
  career_matches_played: number;
  career_wins: number;
  career_draws: number;
  career_losses: number;
  created_at: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    team_name: row.team_name,
    team_color: row.team_color,
    team_logo: row.team_logo,
    team_coach: row.team_coach,
    team_city: row.team_city,
    goal_audio: row.goal_audio,
    titles_brasileirao: row.titles_brasileirao,
    titles_copa: row.titles_copa,
    seasons_played: row.seasons_played,
    best_position: row.best_position,
    ranking_points: row.ranking_points,
    achievements: JSON.parse(row.achievements || '[]'),
    career_goals: row.career_goals,
    career_assists: row.career_assists,
    career_conceded: row.career_conceded,
    best_goal_diff: row.best_goal_diff,
    unbeaten_titles_brasileirao: row.unbeaten_titles_brasileirao,
    unbeaten_titles_copa: row.unbeaten_titles_copa,
    multiplayer_wins: row.multiplayer_wins,
    career_matches_played: row.career_matches_played,
    career_wins: row.career_wins,
    career_draws: row.career_draws,
    career_losses: row.career_losses,
    created_at: row.created_at,
  };
}

// Letras, números, ponto/underscore/hífen, 3 a 20 caracteres — sem espaço.
export const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;

export default pool;
