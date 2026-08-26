import { Router } from 'express';
import crypto from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import pool from '../db.js';
import { sendPush, pushEnabled, type StoredSubscription } from '../push.js';
import { sendNewsEmail, emailEnabled } from '../email.js';

const router = Router();

const ADMIN_SECRET = process.env.ADMIN_SECRET;

// Comparação em tempo constante (evita timing attack) — hasheia os dois
// lados pra sempre comparar buffers do mesmo tamanho, já que
// timingSafeEqual lança erro se os tamanhos forem diferentes (o que um
// segredo errado normalmente é).
function safeEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function requireAdmin(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  const provided = req.headers['x-admin-secret'];
  if (!ADMIN_SECRET) {
    return res.status(503).json({ error: 'Endpoint administrativo não configurado (ADMIN_SECRET ausente).' });
  }
  if (typeof provided !== 'string' || !safeEqual(provided, ADMIN_SECRET)) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
  next();
}

router.use(requireAdmin);

interface NotifyRow extends RowDataPacket {
  id: number;
  email: string;
  username: string;
  team_color: string | null;
  team_logo: string | null;
  push_subscription: string | null;
  email_notifications_enabled: number;
}

// Dispara push + email de uma novidade pra toda a base cadastrada. Chamado
// manualmente (POST autenticado por ADMIN_SECRET) sempre que uma entrada
// nova entra no WHATS_NEW do cliente — não há gatilho automático porque o
// changelog vive só no bundle do front, o servidor não tem como saber
// sozinho quando uma entrada nova foi publicada.
router.post('/notify-news', async (req, res) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const desc = typeof req.body?.desc === 'string' ? req.body.desc.trim() : '';
    if (!title || !desc) {
      return res.status(400).json({ error: 'Informe title e desc.' });
    }
    if (!pushEnabled && !emailEnabled) {
      return res.status(503).json({ error: 'Nem push nem email estão configurados no servidor.' });
    }

    const [rows] = await pool.query<NotifyRow[]>(
      'SELECT id, email, username, team_color, team_logo, push_subscription, email_notifications_enabled FROM users'
    );

    let pushSent = 0, pushFailed = 0, emailSent = 0, emailFailed = 0;

    // Push primeiro, em paralelo — mais rápido e cada envio é independente.
    // Falha "gone" limpa a inscrição morta pra não tentar de novo pra sempre.
    if (pushEnabled) {
      await Promise.all(rows.filter(r => r.push_subscription).map(async (r) => {
        let sub: StoredSubscription;
        try {
          sub = JSON.parse(r.push_subscription!);
        } catch {
          return;
        }
        const result = await sendPush(sub, { title, body: desc, url: '/' });
        if (result.ok) pushSent++; else pushFailed++;
        if (result.gone) {
          await pool.query('UPDATE users SET push_subscription = NULL WHERE id = ?', [r.id]).catch(() => {});
        }
      }));
    }

    // Email em série com um respiro pequeno entre lotes — a maioria dos
    // provedores (Resend incluso) tem limite de requisições por segundo, e
    // essa base ainda é pequena o bastante pra não precisar de fila de verdade.
    if (emailEnabled) {
      const recipients = rows.filter(r => r.email_notifications_enabled);
      const BATCH_SIZE = 5;
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(r => sendNewsEmail(r.email, {
          username: r.username,
          teamColor: r.team_color,
          teamLogo: r.team_logo,
          title,
          desc,
        })));
        results.forEach(ok => { if (ok) emailSent++; else emailFailed++; });
        if (i + BATCH_SIZE < recipients.length) await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    res.json({ pushSent, pushFailed, emailSent, emailFailed, totalUsers: rows.length });
  } catch (err) {
    console.error('[admin/notify-news]', err);
    res.status(500).json({ error: 'Erro interno ao disparar as notificações.' });
  }
});

export default router;
