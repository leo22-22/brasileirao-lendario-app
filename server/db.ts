import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'data.db'));

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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

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
    created_at: row.created_at,
  };
}

// Letras, números, ponto/underscore/hífen, 3 a 20 caracteres — sem espaço.
export const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;

export default db;
