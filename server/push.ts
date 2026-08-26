import webpush from 'web-push';

// Só ativa de verdade se as 3 variáveis estiverem configuradas — sem VAPID
// configurado, o recurso fica desligado (endpoints de notificação respondem
// "indisponível" em vez de derrubar o servidor inteiro por falta de env var,
// diferente de JWT_SECRET que é obrigatório pro app funcionar no básico).
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

export const pushEnabled = !!(publicKey && privateKey && subject);

if (pushEnabled) {
  webpush.setVapidDetails(subject!, publicKey!, privateKey!);
} else {
  console.warn('[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT não configurados — notificações push desativadas.');
}

export function getVapidPublicKey(): string | null {
  return pushEnabled ? publicKey! : null;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Resultado de um envio — "gone" sinaliza que a inscrição morreu (usuário
// desinstalou, revogou permissão, trocou de navegador) e o chamador deve
// apagar a coluna push_subscription pra não tentar de novo pra sempre.
export async function sendPush(subscription: StoredSubscription, payload: PushPayload): Promise<{ ok: boolean; gone: boolean }> {
  if (!pushEnabled) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(subscription as never, JSON.stringify(payload));
    return { ok: true, gone: false };
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    // 404/410 = endpoint não existe mais (Push Service descartou a
    // inscrição) — qualquer outro erro (rede, 429, etc.) não significa que a
    // inscrição morreu, só que essa tentativa falhou.
    const gone = statusCode === 404 || statusCode === 410;
    if (!gone) console.error('[push] falha ao enviar', statusCode, err);
    return { ok: false, gone };
  }
}
