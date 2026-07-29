import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Em dev (tsx roda o .ts direto) __dirname é server/; compilado (tsc) esse
// mesmo arquivo vira server/dist/db.js e __dirname passa a ser server/dist/.
// Sem normalizar isso, o banco de produção ia parar DENTRO de dist/ — a
// mesma pasta que `tsc` recria a cada build — e sumiria a cada deploy.
// DB_PATH permite apontar pra outro lugar (ex.: um disco persistente
// específico do host) sem precisar mexer no código.
const serverRoot = path.basename(__dirname) === 'dist' ? path.join(__dirname, '..') : __dirname;
const dbPath = process.env.DB_PATH || path.join(serverRoot, 'data.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    team_name TEXT,
    team_color TEXT,
    team_logo TEXT,
    team_coach TEXT,
    team_city TEXT,
    goal_audio TEXT,
    titles_brasileirao INTEGER NOT NULL DEFAULT 0,
    titles_copa INTEGER NOT NULL DEFAULT 0,
    seasons_played INTEGER NOT NULL DEFAULT 0,
    best_position INTEGER,
    ranking_points INTEGER NOT NULL DEFAULT 0,
    achievements TEXT NOT NULL DEFAULT '[]',
    career_goals INTEGER NOT NULL DEFAULT 0,
    career_assists INTEGER NOT NULL DEFAULT 0,
    career_conceded INTEGER NOT NULL DEFAULT 0,
    best_goal_diff INTEGER,
    unbeaten_titles_brasileirao INTEGER NOT NULL DEFAULT 0,
    unbeaten_titles_copa INTEGER NOT NULL DEFAULT 0,
    multiplayer_wins INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Bancos criados antes dessas colunas existirem (CREATE TABLE IF NOT EXISTS não
// altera tabela já existente) — adiciona uma a uma, ignorando erro de coluna duplicada.
function ensureColumn(ddl: string) {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${ddl}`); } catch { /* já existe */ }
}
ensureColumn('titles_brasileirao INTEGER NOT NULL DEFAULT 0');
ensureColumn('titles_copa INTEGER NOT NULL DEFAULT 0');
ensureColumn('seasons_played INTEGER NOT NULL DEFAULT 0');
ensureColumn('best_position INTEGER');
ensureColumn('ranking_points INTEGER NOT NULL DEFAULT 0');
ensureColumn("achievements TEXT NOT NULL DEFAULT '[]'");
ensureColumn('career_goals INTEGER NOT NULL DEFAULT 0');
ensureColumn('career_assists INTEGER NOT NULL DEFAULT 0');
ensureColumn('career_conceded INTEGER NOT NULL DEFAULT 0');
ensureColumn('best_goal_diff INTEGER');
ensureColumn('unbeaten_titles_brasileirao INTEGER NOT NULL DEFAULT 0');
ensureColumn('unbeaten_titles_copa INTEGER NOT NULL DEFAULT 0');
ensureColumn('multiplayer_wins INTEGER NOT NULL DEFAULT 0');

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
  achievements: string;
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

export default db;
