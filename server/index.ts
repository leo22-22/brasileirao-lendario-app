import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// Autenticação é via Bearer token (não usa cookies), então CORS aberto não
// expõe a nada a mais — em produção front e API rodam na mesma origem de
// qualquer forma (Express servindo o build do React abaixo).
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);

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

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
