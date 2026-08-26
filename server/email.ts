// Envio de email via Resend (API HTTP simples, sem SDK — só fetch nativo do
// Node 18+) em vez de SMTP: hospedagem compartilhada como a Hostinger costuma
// bloquear as portas de SMTP de saída, enquanto uma chamada HTTPS na 443
// sempre passa. Precisa de um domínio verificado no painel da Resend pro
// remetente (EMAIL_FROM) — sem isso a Resend rejeita o envio.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

export const emailEnabled = !!(RESEND_API_KEY && EMAIL_FROM);

if (!emailEnabled) {
  console.warn('[email] RESEND_API_KEY/EMAIL_FROM não configurados — envio de email desativado.');
}

const SITE_URL = 'https://brasileiraolendario.com.br';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Template escuro combinando com a identidade visual do jogo (verde #0B1A12
// de fundo, dourado #d4a23c de destaque, Fraunces pro título) — usa a cor do
// time do próprio destinatário como faixa de acento quando disponível, o que
// é a parte "personalizada" de verdade (não só o nome no topo).
export function buildNewsEmailHtml(params: {
  username: string;
  teamColor?: string | null;
  teamLogo?: string | null;
  title: string;
  desc: string;
}): string {
  const accent = /^#[0-9a-fA-F]{6}$/.test(params.teamColor || '') ? params.teamColor! : '#d4a23c';
  const username = escapeHtml(params.username);
  const title = escapeHtml(params.title);
  const desc = escapeHtml(params.desc);
  const logoImg = params.teamLogo && /^https?:\/\//.test(params.teamLogo)
    ? `<img src="${params.teamLogo}" width="36" height="36" alt="" style="display:block;border-radius:8px;background:rgba(255,255,255,0.08);" />`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#070f0a;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070f0a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f1f15;border:1px solid rgba(212,162,60,0.25);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg, ${accent}, #d4a23c);line-height:0;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#d4a23c;font-weight:700;">
                    ⚽ Brasileirão Lendário
                  </td>
                  ${logoImg ? `<td align="right">${logoImg}</td>` : ''}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 4px 28px;color:#F4F1EA;font-size:14px;">
              Olá, <b>${username}</b>! Novidade fresquinha no jogo:
            </td>
          </tr>
          <tr>
            <td style="padding:10px 28px 0 28px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:700;color:#F4F1EA;line-height:1.35;">
                ${title}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 0 28px;color:rgba(244,241,234,0.75);font-size:14px;line-height:1.65;">
              ${desc}
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px 28px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:999px;background:${accent};">
                    <a href="${SITE_URL}" style="display:inline-block;padding:11px 22px;font-size:13.5px;font-weight:700;color:#0B1A12;text-decoration:none;border-radius:999px;">
                      Ver no jogo →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px 28px;border-top:1px solid rgba(255,255,255,0.08);">
              <p style="margin:16px 0 0 0;color:rgba(244,241,234,0.4);font-size:11px;line-height:1.6;">
                Você recebeu este email porque tem conta no Brasileirão Lendário. Pra parar de receber avisos de novidade, entre no jogo → Minha Conta → Notificações.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendNewsEmail(to: string, params: {
  username: string;
  teamColor?: string | null;
  teamLogo?: string | null;
  title: string;
  desc: string;
}): Promise<boolean> {
  if (!emailEnabled) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to,
        subject: `⚽ ${params.title}`,
        html: buildNewsEmailHtml(params),
      }),
    });
    if (!res.ok) {
      console.error('[email] Resend respondeu', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] falha ao enviar', err);
    return false;
  }
}
