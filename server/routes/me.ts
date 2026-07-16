import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { toPublicUser, USERNAME_RE, type UserRow } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Colunas que o cliente pode atualizar diretamente (sem tratamento especial).
const SIMPLE_FIELDS = ['team_name', 'team_color', 'team_logo', 'team_coach', 'team_city', 'goal_audio'] as const;

function getUserOr404(userId: number, res: import('express').Response): UserRow | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Conta não encontrada.' });
    return null;
  }
  return row;
}

router.get('/', (req, res) => {
  const row = getUserOr404(req.userId!, res);
  if (!row) return;
  res.json({ user: toPublicUser(row) });
});

router.put('/', async (req, res) => {
  try {
    const userId = req.userId!;
    const current = getUserOr404(userId, res);
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

    if ('username' in body) {
      if (typeof body.username !== 'string') {
        return res.status(400).json({ error: 'Nome de usuário inválido.' });
      }
      const normalizedUsername = body.username.trim();
      if (!USERNAME_RE.test(normalizedUsername)) {
        return res.status(400).json({ error: 'Nome de usuário deve ter de 3 a 20 caracteres (letras, números, ponto, hífen ou underscore).' });
      }
      if (normalizedUsername !== current.username) {
        const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(normalizedUsername, userId);
        if (existing) {
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
        const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, userId);
        if (existing) {
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
    db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...values, userId);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
    return res.json({ user: toPublicUser(updated) });
  } catch (err) {
    console.error('[update me]', err);
    return res.status(500).json({ error: 'Erro interno ao atualizar a conta.' });
  }
});

router.delete('/', (req, res) => {
  try {
    const userId = req.userId!;
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Conta não encontrada.' });
    }
    return res.status(204).send();
  } catch (err) {
    console.error('[delete me]', err);
    return res.status(500).json({ error: 'Erro interno ao excluir a conta.' });
  }
});

export default router;
