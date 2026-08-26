#!/usr/bin/env node
// Dispara POST /api/admin/notify-news pra avisar (push + email) quem tem
// conta sobre uma novidade nova — roda uma vez, manualmente, depois de
// publicar uma entrada nova em WHATS_NEW (src/App.jsx) e fazer o deploy.
//
// Uso:
//   ADMIN_SECRET=xxx node server/scripts/notify-news.mjs "Título" "Descrição" [baseUrl]
//
// baseUrl é opcional, default https://brasileiraolendario.com.br — passe
// http://localhost:4000 pra testar contra o servidor local.

const [title, desc, baseUrlArg] = process.argv.slice(2);
const baseUrl = baseUrlArg || 'https://brasileiraolendario.com.br';
const secret = process.env.ADMIN_SECRET;

if (!title || !desc) {
  console.error('Uso: ADMIN_SECRET=xxx node notify-news.mjs "Título" "Descrição" [baseUrl]');
  process.exit(1);
}
if (!secret) {
  console.error('Defina ADMIN_SECRET no ambiente (o mesmo valor configurado no servidor).');
  process.exit(1);
}

const res = await fetch(`${baseUrl}/api/admin/notify-news`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
  body: JSON.stringify({ title, desc }),
});
const data = await res.json().catch(() => null);
if (!res.ok) {
  console.error(`Falhou (${res.status}):`, data);
  process.exit(1);
}
console.log('OK:', data);
