import mysql from 'mysql2/promise';

// MySQL gerenciado da Hostinger, não SQLite — a hospedagem "Web App" refaz o
// diretório do app do zero a cada deploy (checkout novo do git), então um
// arquivo local (SQLite) não sobrevive entre deploys. O banco gerenciado é
// externo a esse ciclo e persiste normalmente.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Banco novo (sem instalação anterior pra migrar) — schema completo direto,
// sem o histórico de ALTER TABLE incremental que a versão SQLite precisava.
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
    created_at: row.created_at,
  };
}

// Letras, números, ponto/underscore/hífen, 3 a 20 caracteres — sem espaço.
export const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;

export default pool;
