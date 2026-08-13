import { Router } from 'express';

const router = Router();

// Servidores de retransmissão (TURN) pro multiplayer.
//
// Por que isso existe: WebRTC só fecha conexão direta quando pelo menos um dos
// dois lados é alcançável de fora. Quem está no 4G/5G fica atrás de CGNAT (a
// operadora compartilha um IP entre milhares de clientes) e quem está no Wi-Fi
// de faculdade/empresa costuma ter UDP bloqueado por completo. Nesses dois
// casos NÃO EXISTE caminho direto — o tráfego precisa passar por um servidor
// TURN no meio. STUN não resolve: ele só descobre o endereço público, não
// retransmite nada.
//
// Até aqui o app dependia do TURN gratuito que vinha embutido no PeerJS. Esse
// serviço foi descontinuado e os hostnames (eu-0/us-0.turn.peerjs.com) saíram
// do DNS — ou seja, na prática o jogo estava rodando com ZERO relay, e todo
// jogador em 4G ou Wi-Fi de faculdade falhava sem exceção.
//
// As credenciais ficam no servidor de propósito. O token da Cloudflare é um
// segredo de longo prazo; o que vai pro navegador é uma credencial derivada,
// que expira sozinha. Colocar o segredo numa variável VITE_* o embutiria no
// bundle, à vista de qualquer um.

const CLOUDFLARE_ENDPOINT = 'https://rtc.live.cloudflare.com/v1/turn/keys';
// Validade da credencial entregue ao navegador. Precisa cobrir uma sessão de
// jogo inteira com folga (a credencial é checada na hora de abrir a conexão,
// não a cada pacote), mas curta o bastante pra que uma que vaze não valha
// muito tempo.
const TTL_SECONDS = 4 * 60 * 60;
// Reaproveita a mesma credencial entre jogadores enquanto ela for válida, com
// margem pra ninguém receber uma que expira em seguida. Sem isso, cada entrada
// em sala viraria uma chamada à API da Cloudflare.
const CACHE_MARGIN_MS = 30 * 60 * 1000;

type IceServer = { urls: string | string[]; username?: string; credential?: string };
let cache: { iceServers: IceServer[]; expiresAt: number } | null = null;

// Alternativa a um provedor: um coturn próprio, com credencial fixa. Aceita
// vários endereços separados por vírgula — vale a pena listar o de TCP/443,
// que é o único que atravessa rede de faculdade que só libera tráfego web.
function staticServers(): IceServer[] {
  const urls = (process.env.TURN_URL || '').split(',').map(u => u.trim()).filter(Boolean);
  if (urls.length === 0) return [];
  return [{ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL }];
}

async function cloudflareServers(): Promise<IceServer[]> {
  const keyId = process.env.TURN_KEY_ID;
  const token = process.env.TURN_KEY_API_TOKEN;
  if (!keyId || !token) return [];

  if (cache && cache.expiresAt > Date.now()) return cache.iceServers;

  // Se a Cloudflare estiver fora do ar ou o token estiver errado, o jogo tem
  // que continuar de pé (quem está em rede normal joga sem relay). Por isso
  // todo erro aqui vira lista vazia + log, nunca uma exceção que derrube a
  // criação de sala.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(`${CLOUDFLARE_ENDPOINT}/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TTL_SECONDS }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      console.error(`[turn] Cloudflare devolveu ${r.status} ${r.statusText} — seguindo sem relay`);
      return [];
    }
    const data = await r.json() as { iceServers?: IceServer | IceServer[] };
    // A API devolve `iceServers` como objeto único; aceitar os dois formatos
    // evita quebrar se isso mudar.
    const raw = data.iceServers;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (list.length === 0) {
      console.error('[turn] Cloudflare respondeu sem iceServers — seguindo sem relay');
      return [];
    }
    cache = { iceServers: list, expiresAt: Date.now() + TTL_SECONDS * 1000 - CACHE_MARGIN_MS };
    return list;
  } catch (e) {
    console.error('[turn] falha ao gerar credenciais na Cloudflare:', (e as Error).message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Público de propósito: quem entra em sala não precisa estar logado, e a
// credencial já é curta e descartável. O rate limit fica no index.ts.
router.get('/', async (_req, res) => {
  const iceServers = [...await cloudflareServers(), ...staticServers()];
  // `relay: false` deixa o front avisar a pessoa de forma honesta ("essa rede
  // pode não funcionar") em vez de só girar até dar timeout.
  res.json({ iceServers, relay: iceServers.length > 0 });
});

export default router;
