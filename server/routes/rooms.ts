import { Router } from 'express';

const router = Router();

// Registro público de salas de multiplayer — só metadados (código, nome,
// contagem de jogadores, status), NUNCA o jogo em si (que continua 100% P2P
// via PeerJS, sem nenhum servidor no meio). Fica só em memória, de propósito:
// salas são efêmeras (duram só a sessão de quem está jogando), e o app já
// roda numa instância Node só (ver comentário do rateLimiter em index.ts),
// então não precisa — e não deve — persistir isso no MySQL.
interface RoomEntry {
  code: string;
  label: string;
  gameMode: 'brasileirao' | 'copa' | 'serieab';
  playerCount: number;
  maxPlayers: number;
  status: 'lobby' | 'in_progress';
  updatedAt: number;
}

const rooms = new Map<string, RoomEntry>();

// 3x o intervalo de heartbeat do cliente (15s) — tolera 1 heartbeat perdido
// por uma rede ruim sem a sala sumir da lista à toa, mas ainda garante que
// uma sala abandonada (aba fechada, sem passar pelo DELETE) some sozinha em
// menos de 1 minuto.
const STALE_MS = 45_000;
const CODE_RE = /^[A-Z0-9]{6}$/;

function purgeStale() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.updatedAt > STALE_MS) rooms.delete(code);
  }
}

function maxPlayersFor(gameMode: 'brasileirao' | 'copa' | 'serieab') {
  return gameMode === 'copa' ? 32 : 20;
}

router.put('/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  if (!CODE_RE.test(code)) {
    return res.status(400).json({ error: 'Código de sala inválido.' });
  }

  const body = req.body ?? {};
  const gameMode: RoomEntry['gameMode'] = body.gameMode === 'copa' ? 'copa' : body.gameMode === 'serieab' ? 'serieab' : 'brasileirao';
  const maxPlayers = maxPlayersFor(gameMode);

  if (typeof body.label !== 'string' || !body.label.trim()) {
    return res.status(400).json({ error: 'Nome da sala inválido.' });
  }
  // Corta em 24 caracteres — a label vem do nome de time do próprio jogador,
  // que já é livre/curto, mas nunca confia num valor arbitrário de tamanho
  // vindo do cliente pra algo que vai aparecer numa lista pública.
  const label = body.label.trim().slice(0, 24);

  const playerCount = Math.min(maxPlayers, Math.max(0, Number(body.playerCount) || 0));
  // O cliente manda o roomSnap.phase cru ('lobby' | 'team-setup' | 'simulation')
  // — aqui reduz pra só duas fachadas pro público: ainda formando (lobby) ou
  // já em andamento (qualquer outra fase, bloqueada pra entrar).
  const status: RoomEntry['status'] = body.phase === 'lobby' ? 'lobby' : 'in_progress';

  rooms.set(code, { code, label, gameMode, playerCount, maxPlayers, status, updatedAt: Date.now() });
  res.json({ ok: true });
});

router.get('/', (req, res) => {
  purgeStale();
  const list = [...rooms.values()]
    .sort((a, b) => (a.status === b.status ? b.playerCount - a.playerCount : a.status === 'lobby' ? -1 : 1))
    .slice(0, 50);
  res.json({ rooms: list });
});

router.delete('/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  if (!CODE_RE.test(code)) {
    return res.status(400).json({ error: 'Código de sala inválido.' });
  }
  // Sem checagem de "dono" — o pior caso de alguém apagar o código de outra
  // pessoa é a sala sumir da lista por uns segundos até o próximo heartbeat
  // repor; não compensa um esquema de token só pra essa lista pública efêmera.
  rooms.delete(code);
  res.status(204).send();
});

export default router;
