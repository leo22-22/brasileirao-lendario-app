import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../auth.js';
import { getVapidPublicKey } from '../push.js';

const router = Router();
router.use(requireAuth);

// Chave pública VAPID que o front usa pra criar a inscrição de push
// (pushManager.subscribe). null quando o recurso não está configurado no
// servidor — o front trata isso escondendo o botão de ativar notificação.
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

// Salva a inscrição de push do navegador (endpoint + chaves p256dh/auth) —
// chamado depois que o front já pediu permissão e criou a inscrição via
// PushManager. Sobrescreve a anterior se já existia (ex.: trocou de aba/perfil).
router.post('/subscribe', async (req, res) => {
  try {
    const sub = req.body?.subscription;
    if (!sub || typeof sub.endpoint !== 'string' || !sub.keys?.p256dh || !sub.keys?.auth) {
      return res.status(400).json({ error: 'Inscrição de push inválida.' });
    }
    await pool.query('UPDATE users SET push_subscription = ? WHERE id = ?', [JSON.stringify(sub), req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[notify/subscribe]', err);
    res.status(500).json({ error: 'Erro interno ao ativar notificações.' });
  }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    await pool.query('UPDATE users SET push_subscription = NULL WHERE id = ?', [req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[notify/unsubscribe]', err);
    res.status(500).json({ error: 'Erro interno ao desativar notificações.' });
  }
});

// Opt-out de email de novidade — separado do push porque são canais
// independentes (dá pra querer só um dos dois).
router.put('/preferences', async (req, res) => {
  try {
    // Cada preferência é opcional: só atualiza o que vier (boolean).
    const map: Record<string, string> = { emailNotifications: 'email_notifications_enabled', notifyDaily: 'notify_daily', notifyQuick: 'notify_quick' };
    const sets: string[] = [];
    const values: number[] = [];
    for (const [key, col] of Object.entries(map)) {
      if (typeof req.body?.[key] === 'boolean') { sets.push(`${col} = ?`); values.push(req.body[key] ? 1 : 0); }
    }
    if (!sets.length) return res.status(400).json({ error: 'Preferência inválida.' });
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...values, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[notify/preferences]', err);
    res.status(500).json({ error: 'Erro interno ao salvar preferência.' });
  }
});

export default router;
