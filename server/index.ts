import './env.js';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import leaderboardRoutes from './routes/leaderboard.js';
import { ensureSchema } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// Atrás de proxy reverso (Hostinger, Nginx, etc.) o socket que chega no Node
// é sempre o do proxy — sem isso, req.ip vira sempre o mesmo IP pra todo
// mundo, e o rate limiter abaixo bloquearia o site inteiro de uma vez em vez
// de só quem está de fato abusando.
app.set('trust proxy', 1);

// Headers de segurança padrão (X-Content-Type-Options, HSTS, X-Frame-Options,
// Referrer-Policy, etc.). CSP e COEP ficam desligados aqui de propósito: o
// site embute iframes do YouTube (hino do clube) e carrega fontes do Google,
// analytics e imagens de terceiros (escudos/troféus) — uma CSP/COEP padrão
// quebraria isso, e calibrar uma lista de origens com precisão exigiria
// testar no navegador de verdade, não só por código.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Autenticação é via Bearer token (não usa cookies), então CORS aberto não
// expõe a nada a mais — em produção front e API rodam na mesma origem de
// qualquer forma (Express servindo o build do React abaixo). ALLOWED_ORIGIN
// deixa restringir em produção se quiser (ex.: bloquear scraping de outro
// domínio); sem a env var, mantém aberto (comportamento de sempre/dev).
app.use(cors(process.env.ALLOWED_ORIGIN ? { origin: process.env.ALLOWED_ORIGIN } : undefined));
app.use(express.json({ limit: '2mb' }));

// Limitador simples em memória (sem dependência nova) — protege login/
// cadastro de força bruta e spam de bot assim que o site fica público.
// Não sobrevive a restart do processo nem é distribuído entre instâncias,
// mas isso é suficiente pro tamanho desse app (uma instância só).
function rateLimiter(maxRequests: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits) {
      if (timestamps.every(t => now - t >= windowMs)) hits.delete(key);
    }
  }, 10 * 60 * 1000).unref();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const timestamps = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco antes de tentar de novo.' });
    }
    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}
app.use('/api/auth', rateLimiter(10, 15 * 60 * 1000));

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// Serve o front-end buildado (vite build → dist/ na raiz do repo) e cai no
// index.html para qualquer rota que não seja da API (SPA client-side routing).
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// main() em vez de top-level await: o loader Node da Hostinger carrega esse
// arquivo com require(), que quebra num grafo ESM com await solto no topo
// (ERR_REQUIRE_ASYNC_MODULE). Dentro de uma função normal isso não importa.
async function main() {
  await ensureSchema();
  app.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}`);
  });
}
main().catch(err => {
  console.error('[boot] falha ao iniciar o servidor:', err);
  process.exit(1);
});
