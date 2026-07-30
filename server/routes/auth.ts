import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool, { toPublicUser, USERNAME_RE, type UserRow } from '../db.js';
import { signToken } from '../auth.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Nome de usuário, email e senha são obrigatórios.' });
    }
    const normalizedUsername = username.trim();
    if (!USERNAME_RE.test(normalizedUsername)) {
      return res.status(400).json({ error: 'Nome de usuário deve ter de 3 a 20 caracteres (letras, números, ponto, hífen ou underscore).' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
    }

    const [existingUsername] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE username = ?', [normalizedUsername]);
    if (existingUsername.length > 0) {
      return res.status(409).json({ error: 'Esse nome de usuário já está em uso.' });
    }
    const [existingEmail] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existingEmail.length > 0) {
      return res.status(409).json({ error: 'Já existe uma conta com esse email.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [info] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (username, email, password_hash, achievements) VALUES (?, ?, ?, ?)',
      [normalizedUsername, normalizedEmail, passwordHash, '[]']
    );

    const [rows] = await pool.query<(UserRow & RowDataPacket)[]>('SELECT * FROM users WHERE id = ?', [info.insertId]);
    const row = rows[0];
    const token = signToken(row.id);
    return res.status(201).json({ token, user: toPublicUser(row) });
  } catch (err) {
    console.error('[signup]', err);
    return res.status(500).json({ error: 'Erro interno ao criar conta.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const [rows] = await pool.query<(UserRow & RowDataPacket)[]>('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    const row = rows[0];
    if (!row) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }

    const token = signToken(row.id);
    return res.json({ token, user: toPublicUser(row) });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: 'Erro interno ao entrar.' });
  }
});

export default router;
