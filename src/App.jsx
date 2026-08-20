import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Peer from 'peerjs';
import * as api from './api.js';

// Wrapper de eventos do Analytics (gtag já é carregado no index.html) — só
// eventos de conversão que interessam pra marketing, não todo clique.
// Guard pra não quebrar nada se o gtag falhar em carregar (bloqueador de
// anúncio, rede lenta, etc.) ou em dev sem o script.
function trackEvent(name, params) {
  try { window.gtag?.('event', name, params); } catch { /* analytics é bônus, nunca deve travar o jogo */ }
}

// ─── MULTIPLAYER (PeerJS — sem conta, sem backend) ────────────────────────────
// O líder vira o "servidor": peers conectam diretamente ao ID dele via WebRTC.

const MY_PID = (() => {
  let id = sessionStorage.getItem('brl_pid');
  if (!id) { id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); sessionStorage.setItem('brl_pid', id); }
  return id;
})();

// STUN sozinho (padrão do PeerJS) só resolve NAT simples — dois jogadores
// atrás de rede mais restritiva (corporativa, algumas 4G com CGNAT) não
// conseguem fechar a conexão P2P sem um servidor TURN de retransmissão.
// Configurável via .env (VITE_TURN_URL/VITE_TURN_USERNAME/VITE_TURN_CREDENTIAL)
// — sem essas variáveis, cai de volta pro STUN público (comportamento atual,
// nada quebra por não ter TURN configurado).
// ATENÇÃO: sem TURN configurado, quem estiver no 4G/5G NÃO consegue entrar em
// sala nenhuma. A operadora põe o celular atrás de CGNAT e a conexão direta
// não fecha; STUN só descobre o endereço, quem RETRANSMITE o tráfego é o TURN.
// Testado: com só os STUN abaixo, o navegador gera candidatos `host` e `srflx`
// e nenhum `relay` — que é exatamente o que falta pro celular na rede móvel.
// Preencher VITE_TURN_URL/USERNAME/CREDENTIAL (Metered, Twilio, Cloudflare ou
// um coturn próprio) resolve. Aceita lista separada por vírgula pra cobrir
// UDP e TCP/443, esse último é o que atravessa rede corporativa/escola.
// Existia aqui um fallback pro TURN gratuito do PeerJS (eu-0/us-0.turn.
// peerjs.com). Ele foi REMOVIDO porque não existe mais: o projeto descontinuou
// o serviço gratuito e tirou os hostnames do DNS. Medido: as duas máquinas
// respondem ENOTFOUND, e o Chromium só devolve erro ICE 701 ("host lookup
// received error") pra elas. Ou seja, o jogo estava rodando com relay NENHUM —
// o que explica exatamente o 4G e o Wi-Fi de faculdade nunca conectarem.
// Manter servidor morto na lista não é neutro: o navegador gasta tempo de
// gathering tentando resolvê-los antes de desistir.
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
// Compatibilidade: TURN fixo embutido no build. Continua funcionando pra quem
// já tinha .env configurado, mas o caminho recomendado agora é o /api/turn
// abaixo — credencial que expira sozinha, com o segredo ficando no servidor.
const TURN_URLS = (import.meta.env.VITE_TURN_URL || '').split(',').map(u => u.trim()).filter(Boolean);
const BUILD_TIME_TURN = TURN_URLS.length > 0 ? [{
  urls: TURN_URLS,
  username: import.meta.env.VITE_TURN_USERNAME,
  credential: import.meta.env.VITE_TURN_CREDENTIAL,
}] : [];

// Busca os servidores de retransmissão no backend. STUN sozinho não fecha
// conexão pra quem está em 4G (CGNAT) nem em rede que bloqueia UDP — nesses
// casos o tráfego PRECISA passar por um TURN, e a credencial dele é emitida
// pelo servidor porque tem prazo de validade.
// Memoizado: a credencial vale horas, não faz sentido pedir a cada sala.
// Nunca deixa a busca travar a entrada em sala — se o backend demorar ou
// estiver fora, segue com STUN (que é o que já acontecia antes) em vez de
// deixar a pessoa esperando.
let iceServersPromise = null;
let hasRelay = null; // null = ainda não sabemos
function loadIceServers() {
  if (iceServersPromise) return iceServersPromise;
  iceServersPromise = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch('/api/turn', { signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      const fromServer = Array.isArray(data.iceServers) ? data.iceServers : [];
      hasRelay = fromServer.length > 0 || BUILD_TIME_TURN.length > 0;
      return [...STUN_SERVERS, ...fromServer, ...BUILD_TIME_TURN];
    } catch {
      hasRelay = BUILD_TIME_TURN.length > 0;
      return [...STUN_SERVERS, ...BUILD_TIME_TURN];
    }
  })();
  return iceServersPromise;
}
async function peerOptions() {
  return { debug: 1, config: { iceServers: await loadIceServers() } };
}
// Tempo até desistir de entrar/criar sala. 12s era curto demais: a negociação
// WebRTC só com STUN (sem TURN) leva mais que isso em 4G e em Wi-Fi com NAT
// chato, e a pessoa via "tempo esgotado" numa conexão que ia fechar.
const MULTI_CONNECT_TIMEOUT_MS = 25000;

// Seeded PRNG (mulberry32) — garante mesmos resultados em todos os clientes
function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deriva uma seed numérica estável a partir de uma string (djb2-like)
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

// PRNG independente por partida: dado a mesma seed de sala + rodada + confronto,
// todo peer chega ao mesmo placar, mesmo que cada um simule localmente.
function matchPrng(roomSeed, roundKey, homeId, awayId) {
  if (roomSeed == null) return Math.random;
  return makePrng(hashSeed(`${roomSeed}|${roundKey}|${homeId}|${awayId}`));
}

// ============================================================
// DADOS: 100 times históricos do Brasileirão (1959-2024)
// ============================================================
const TEAMS = [
  {
    id: 'bahia1959', club: 'Bahia', year: 1959, label: 'Bahia 1959 (Taca Brasil)', coach: 'Gradim',
    colors: { p: '#003399', s: '#C8102E' },
    players: [
      { name: 'Nadinho', pos: ['GOL'], ovr: 85 },
      { name: 'Leone', pos: ['LD', 'ZAG'], ovr: 82 },
      { name: 'Henrique', pos: ['ZAG'], ovr: 84 },
      { name: 'Nenzinho', pos: ['LE', 'ZAG'], ovr: 81 },
      { name: 'Vicente', pos: ['ZAG', 'VOL'], ovr: 84 },
      { name: 'Flávio', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Mário', pos: ['MEI', 'ME'], ovr: 81 },
      { name: 'Marito', pos: ['PD', 'MD'], ovr: 86 },
      { name: 'Biriba', pos: ['PE', 'ME'], ovr: 84 },
      { name: 'Léo Briglia', pos: ['ATA'], ovr: 88 },
      { name: 'Alencar', pos: ['ATA'], ovr: 85 },
      { name: 'Hermínio', pos: ['ZAG'], ovr: 79 },
      { name: 'Florisvaldo', pos: ['LD', 'ZAG'], ovr: 74 },
      { name: 'Bacamarte', pos: ['ZAG'], ovr: 73 },
      { name: 'Beto', pos: ['MC', 'VOL'], ovr: 78 },
      { name: 'Bombeiro', pos: ['MC', 'MD'], ovr: 75 },
      { name: 'Ari', pos: ['MEI', 'MD'], ovr: 76 },
      { name: 'Carioca', pos: ['ATA', 'PD'], ovr: 75 },
      { name: 'Careca', pos: ['ATA'], ovr: 74 },
      { name: 'Jair', pos: ['GOL'], ovr: 72 },
    ]
  },
  {
    id: 'santos1961', club: 'Santos', year: 1961, label: 'Santos 1961 (Taca Brasil)', coach: 'Lula',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Laercio', pos: ['GOL'], ovr: 81 },
      { name: 'Lima', pos: ['LD', 'MC'], ovr: 82 },
      { name: 'Mauro', pos: ['ZAG'], ovr: 86 },
      { name: 'Calvet', pos: ['ZAG'], ovr: 84 },
      { name: 'Dalmo', pos: ['LE', 'ZAG'], ovr: 83 },
      { name: 'Zito', pos: ['VOL', 'MC'], ovr: 88 },
      { name: 'Mengalvio', pos: ['MC', 'VOL'], ovr: 86 },
      { name: 'Dorval', pos: ['PD', 'MD'], ovr: 85 },
      { name: 'Coutinho', pos: ['ATA'], ovr: 89 },
      { name: 'Pele', pos: ['ATA', 'MEI'], ovr: 99 },
      { name: 'Pepe', pos: ['PE', 'ME'], ovr: 88 },
      { name: 'Gylmar', pos: ['GOL'], ovr: 86 },
      { name: 'Fioti', pos: ['LD'], ovr: 73 },
      { name: 'Formiga', pos: ['ZAG', 'VOL'], ovr: 76 },
      { name: 'Getulio', pos: ['LE'], ovr: 72 },
      { name: 'Pagao', pos: ['ATA'], ovr: 80 },
      { name: 'Tite', pos: ['PE', 'ME'], ovr: 76 },
      { name: 'Sormani', pos: ['PD'], ovr: 75 },
      { name: 'Brandao', pos: ['VOL'], ovr: 72 },
      { name: 'Nene', pos: ['ATA', 'MEI'], ovr: 74 },
    ]
  },
  {
    id: 'santos1962', club: 'Santos', year: 1962, label: 'Santos 1962 (Campeao do Mundo)', coach: 'Lula',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Gylmar', pos: ['GOL'], ovr: 91 },
      { name: 'Lima', pos: ['LD', 'MC'], ovr: 86 },
      { name: 'Mauro', pos: ['ZAG'], ovr: 89 },
      { name: 'Calvet', pos: ['ZAG'], ovr: 86 },
      { name: 'Dalmo', pos: ['LE', 'ZAG'], ovr: 85 },
      { name: 'Zito', pos: ['VOL', 'MC'], ovr: 92 },
      { name: 'Mengalvio', pos: ['MC', 'VOL'], ovr: 87 },
      { name: 'Dorval', pos: ['PD', 'MD'], ovr: 88 },
      { name: 'Coutinho', pos: ['ATA'], ovr: 93 },
      { name: 'Pele', pos: ['ATA', 'MEI'], ovr: 99 },
      { name: 'Pepe', pos: ['PE', 'ME'], ovr: 91 },
      { name: 'Laercio', pos: ['GOL'], ovr: 78 },
      { name: 'Ismael', pos: ['LD', 'ZAG'], ovr: 76 },
      { name: 'Formiga', pos: ['ZAG', 'VOL'], ovr: 76 },
      { name: 'Decio Brito', pos: ['LE'], ovr: 73 },
      { name: 'Tite', pos: ['PE', 'ME'], ovr: 75 },
      { name: 'Pagao', pos: ['ATA'], ovr: 80 },
      { name: 'Toninho Guerreiro', pos: ['ATA'], ovr: 79 },
      { name: 'Oswaldo', pos: ['PD', 'ATA'], ovr: 74 },
      { name: 'Bibe', pos: ['MEI'], ovr: 73 },
    ]
  },
  {
    id: 'santos1963', club: 'Santos', year: 1963, label: 'Santos 1963 (Bicampeao do Mundo)', coach: 'Lula',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Gylmar', pos: ['GOL'], ovr: 91 },
      { name: 'Lima', pos: ['LD', 'MC'], ovr: 86 },
      { name: 'Mauro', pos: ['ZAG'], ovr: 89 },
      { name: 'Haroldo', pos: ['ZAG'], ovr: 84 },
      { name: 'Dalmo', pos: ['LE', 'ZAG'], ovr: 85 },
      { name: 'Zito', pos: ['VOL', 'MC'], ovr: 91 },
      { name: 'Mengalvio', pos: ['MC', 'VOL'], ovr: 87 },
      { name: 'Dorval', pos: ['PD', 'MD'], ovr: 88 },
      { name: 'Coutinho', pos: ['ATA'], ovr: 92 },
      { name: 'Pele', pos: ['ATA', 'MEI'], ovr: 99 },
      { name: 'Pepe', pos: ['PE', 'ME'], ovr: 90 },
      { name: 'Laercio', pos: ['GOL'], ovr: 80 },
      { name: 'Calvet', pos: ['ZAG'], ovr: 84 },
      { name: 'Fioti', pos: ['LD'], ovr: 75 },
      { name: 'Getulio', pos: ['LE'], ovr: 74 },
      { name: 'Formiga', pos: ['ZAG', 'VOL'], ovr: 77 },
      { name: 'Ismael', pos: ['VOL', 'MC'], ovr: 78 },
      { name: 'Geraldino', pos: ['MEI', 'MD'], ovr: 77 },
      { name: 'Tite', pos: ['PE', 'ME'], ovr: 76 },
      { name: 'Nene', pos: ['ATA', 'MEI'], ovr: 76 },
    ]
  },
  {
    id: 'cruzeiro1966', club: 'Cruzeiro', year: 1966, label: 'Cruzeiro 1966 (Taca Brasil)', coach: 'Ayrton Moreira',
    colors: { p: '#0033A0', s: '#ffffff' },
    players: [
      { name: 'Raul', pos: ['GOL'], ovr: 86 },
      { name: 'Pedro Paulo', pos: ['LD'], ovr: 82 },
      { name: 'Wilson Piazza', pos: ['ZAG', 'VOL'], ovr: 91 },
      { name: 'Procopio', pos: ['ZAG'], ovr: 84 },
      { name: 'Neco', pos: ['LE'], ovr: 82 },
      { name: 'Ze Carlos', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Natal', pos: ['PD', 'MD'], ovr: 83 },
      { name: 'Evaldo', pos: ['MC', 'MEI'], ovr: 84 },
      { name: 'Tostao', pos: ['ATA', 'MEI'], ovr: 95 },
      { name: 'Dirceu Lopes', pos: ['MEI', 'ATA'], ovr: 93 },
      { name: 'Hilton Oliveira', pos: ['PE', 'ATA'], ovr: 86 },
      { name: 'Loureiro', pos: ['ATA'], ovr: 82 },
      { name: 'Wanderley', pos: ['MEI', 'MC'], ovr: 80 },
      { name: 'Vanderlei', pos: ['MC', 'VOL'], ovr: 78 },
      { name: 'Willian', pos: ['ZAG'], ovr: 77 },
      { name: 'Nilton', pos: ['GOL'], ovr: 74 },
      { name: 'Djalma Dias', pos: ['ZAG'], ovr: 80 },
      { name: 'Joao Batista', pos: ['LD', 'LE'], ovr: 75 },
      { name: 'Antoninho', pos: ['PD', 'ME'], ovr: 76 },
      { name: 'Raimundinho', pos: ['VOL'], ovr: 74 },
    ]
  },
  {
    id: 'palmeiras1967', club: 'Palmeiras', year: 1967, label: 'Palmeiras 1967 (Academia)', coach: 'Filpo Nunez',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Valdir de Moraes', pos: ['GOL'], ovr: 86 },
      { name: 'Ferrari', pos: ['LD'], ovr: 83 },
      { name: 'Djalma Dias', pos: ['ZAG'], ovr: 87 },
      { name: 'Baldocchi', pos: ['ZAG'], ovr: 85 },
      { name: 'Zeca', pos: ['LE'], ovr: 83 },
      { name: 'Dudu', pos: ['MC', 'MEI'], ovr: 89 },
      { name: 'Ademir da Guia', pos: ['MEI', 'MC'], ovr: 94 },
      { name: 'Rinaldo', pos: ['PD', 'MD'], ovr: 84 },
      { name: 'Tupazinho', pos: ['ATA'], ovr: 87 },
      { name: 'Servilio', pos: ['ATA', 'MEI'], ovr: 85 },
      { name: 'Cesar Maluco', pos: ['ATA', 'PD'], ovr: 85 },
      { name: 'Reinaldo', pos: ['PE', 'ME'], ovr: 80 },
      { name: 'Alfredo Mostarda', pos: ['ZAG', 'VOL'], ovr: 81 },
      { name: 'Eurico', pos: ['LD'], ovr: 79 },
      { name: 'Emerson Leao', pos: ['GOL'], ovr: 80 },
      { name: 'Nei', pos: ['MC', 'VOL'], ovr: 78 },
      { name: 'Pio', pos: ['ATA'], ovr: 77 },
      { name: 'Edu Bala', pos: ['PE', 'ATA'], ovr: 79 },
      { name: 'Fedato', pos: ['MEI', 'MD'], ovr: 77 },
      { name: 'Marinho', pos: ['LE'], ovr: 75 },
    ]
  },
  {
    id: 'botafogo1968', club: 'Botafogo', year: 1968, label: 'Botafogo 1968 (Robertao)', coach: 'Zagallo',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Cao', pos: ['GOL'], ovr: 79 },
      { name: 'Moreira', pos: ['LD'], ovr: 80 },
      { name: 'Ze Carlos', pos: ['ZAG'], ovr: 83 },
      { name: 'Leonidas', pos: ['ZAG'], ovr: 81 },
      { name: 'Waltencir', pos: ['LE'], ovr: 81 },
      { name: 'Carlos Roberto', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Gerson', pos: ['MEI', 'VOL'], ovr: 94 },
      { name: 'Rogerio', pos: ['PD', 'MD'], ovr: 82 },
      { name: 'Roberto', pos: ['ATA'], ovr: 84 },
      { name: 'Jairzinho', pos: ['ATA', 'PD'], ovr: 94 },
      { name: 'Paulo Cezar Caju', pos: ['PE', 'ME'], ovr: 89 },
      { name: 'Ubirajara Motta', pos: ['GOL'], ovr: 77 },
      { name: 'Chiquinho Pastor', pos: ['ZAG'], ovr: 75 },
      { name: 'Dimas', pos: ['ZAG', 'LE'], ovr: 74 },
      { name: 'Nei Conceicao', pos: ['VOL', 'MC'], ovr: 79 },
      { name: 'Zequinha', pos: ['PD', 'MD'], ovr: 77 },
      { name: 'Ferretti', pos: ['ATA'], ovr: 82 },
      { name: 'Humberto', pos: ['ATA'], ovr: 74 },
      { name: 'Afonsinho', pos: ['MC', 'VOL'], ovr: 78 },
      { name: 'Torino', pos: ['PE', 'ATA'], ovr: 75 },
    ]
  },
  {
    id: 'santos1968', club: 'Santos', year: 1968, label: 'Santos 1968 (Robertao)', coach: 'Antoninho',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Cejas', pos: ['GOL'], ovr: 84 },
      { name: 'Carlos Alberto Torres', pos: ['LD', 'ZAG'], ovr: 93 },
      { name: 'Joel Camargo', pos: ['ZAG'], ovr: 85 },
      { name: 'Ramos Delgado', pos: ['ZAG'], ovr: 86 },
      { name: 'Rildo', pos: ['LE'], ovr: 86 },
      { name: 'Clodoaldo', pos: ['VOL', 'MC'], ovr: 89 },
      { name: 'Lima', pos: ['MC', 'LD'], ovr: 85 },
      { name: 'Abel', pos: ['MEI', 'MC'], ovr: 83 },
      { name: 'Toninho Guerreiro', pos: ['ATA'], ovr: 88 },
      { name: 'Pele', pos: ['ATA', 'MEI'], ovr: 98 },
      { name: 'Edu', pos: ['PE', 'ATA'], ovr: 88 },
      { name: 'Claudio', pos: ['ATA', 'PD'], ovr: 81 },
      { name: 'Zito', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Mengalvio', pos: ['MC'], ovr: 83 },
      { name: 'Laercio', pos: ['GOL'], ovr: 78 },
      { name: 'Oberdan', pos: ['ZAG'], ovr: 77 },
      { name: 'Dorval', pos: ['PD', 'MD'], ovr: 82 },
      { name: 'Newton', pos: ['LE'], ovr: 75 },
      { name: 'Manoel Maria', pos: ['PE', 'ATA'], ovr: 79 },
      { name: 'Turcao', pos: ['VOL'], ovr: 76 },
    ]
  },
  {
    id: 'fluminense1970', club: 'Fluminense', year: 1970, label: 'Fluminense 1970', coach: 'Paulo Amaral',
    colors: { p: '#7A1921', s: '#006633' },
    players: [
      { name: 'Felix', pos: ['GOL'], ovr: 88 },
      { name: 'Oliveira', pos: ['LD'], ovr: 79 },
      { name: 'Galhardo', pos: ['ZAG'], ovr: 80 },
      { name: 'Assis', pos: ['ZAG'], ovr: 81 },
      { name: 'Marco Antonio', pos: ['LE', 'ME'], ovr: 85 },
      { name: 'Denilson', pos: ['VOL', 'ZAG'], ovr: 84 },
      { name: 'Didi', pos: ['MC', 'VOL'], ovr: 86 },
      { name: 'Samarone', pos: ['MEI'], ovr: 83 },
      { name: 'Cafuringa', pos: ['PD', 'MD'], ovr: 81 },
      { name: 'Flavio Minuano', pos: ['ATA'], ovr: 85 },
      { name: 'Lula', pos: ['PE', 'ME'], ovr: 82 },
      { name: 'Jorge Vitorio', pos: ['GOL'], ovr: 73 },
      { name: 'Toninho', pos: ['LD', 'MC'], ovr: 74 },
      { name: 'Silveira', pos: ['ZAG', 'VOL'], ovr: 78 },
      { name: 'Lulinha', pos: ['MEI', 'MD'], ovr: 72 },
      { name: 'Claudio Garcia', pos: ['PD', 'MEI'], ovr: 76 },
      { name: 'Wilton', pos: ['PD'], ovr: 74 },
      { name: 'Mickey', pos: ['ATA'], ovr: 83 },
      { name: 'Gilson Nunes', pos: ['PE', 'ME'], ovr: 76 },
      { name: 'Jair', pos: ['ATA', 'MC'], ovr: 71 },
    ]
  },
  {
    id: 'atleticomg1971', club: 'Atletico-MG', year: 1971, label: 'Atletico-MG 1971 (1o Brasileirao)', coach: 'Telê Santana',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Renato', pos: ['GOL'], ovr: 82 },
      { name: 'Humberto Monteiro', pos: ['LD'], ovr: 79 },
      { name: 'Grapete', pos: ['ZAG'], ovr: 81 },
      { name: 'Vantuir', pos: ['ZAG'], ovr: 83 },
      { name: 'Oldair', pos: ['LE', 'ZAG'], ovr: 83 },
      { name: 'Vanderlei Paiva', pos: ['VOL'], ovr: 83 },
      { name: 'Ronaldo Drumond', pos: ['MEI', 'PD'], ovr: 80 },
      { name: 'Humberto Ramos', pos: ['MEI'], ovr: 81 },
      { name: 'Lola', pos: ['ATA', 'PD'], ovr: 81 },
      { name: 'Dario', pos: ['ATA'], ovr: 89 },
      { name: 'Tião', pos: ['PE', 'ME'], ovr: 79 },
      { name: 'Careca', pos: ['GOL'], ovr: 72 },
      { name: 'Zica', pos: ['LD'], ovr: 73 },
      { name: 'Bibi', pos: ['LE'], ovr: 74 },
      { name: 'Nadir', pos: ['ZAG'], ovr: 74 },
      { name: 'Danilo', pos: ['VOL', 'MC'], ovr: 75 },
      { name: 'Spencer', pos: ['MEI', 'ME'], ovr: 74 },
      { name: 'Caldeira', pos: ['PE'], ovr: 76 },
      { name: 'Guara', pos: ['ATA'], ovr: 73 },
      { name: 'Romeu', pos: ['ATA'], ovr: 72 },
    ]
  },
  {
    id: 'palmeiras1972', club: 'Palmeiras', year: 1972, label: 'Palmeiras 1972 (Academia)', coach: 'Osvaldo Brandao',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Ademir da Guia', pos: ['MC', 'MEI'], ovr: 96 },
      { name: 'Leivinha', pos: ['MEI', 'ATA'], ovr: 91 },
      { name: 'Luís Pereira', pos: ['ZAG'], ovr: 93 },
      { name: 'Emerson Leão', pos: ['GOL'], ovr: 91 },
      { name: 'Dudu', pos: ['VOL', 'MC'], ovr: 89 },
      { name: 'César Maluco', pos: ['ATA'], ovr: 89 },
      { name: 'Eurico', pos: ['LD'], ovr: 85 },
      { name: 'Alfredo Mostarda', pos: ['ZAG'], ovr: 84 },
      { name: 'Zeca', pos: ['LE'], ovr: 83 },
      { name: 'Edu Bala', pos: ['PD', 'MD'], ovr: 84 },
      { name: 'Nei', pos: ['PE', 'ME'], ovr: 84 },
      { name: 'Ronaldo', pos: ['ATA', 'PD'], ovr: 81 },
      { name: 'Madurga', pos: ['MC', 'MEI'], ovr: 82 },
      { name: 'Polaco', pos: ['ZAG', 'LE'], ovr: 78 },
      { name: 'Fedato', pos: ['ATA'], ovr: 78 },
      { name: 'Pio', pos: ['PE', 'ATA'], ovr: 79 },
      { name: 'João Carlos', pos: ['LD', 'ZAG'], ovr: 76 },
      { name: 'Bernard', pos: ['GOL'], ovr: 77 },
      { name: 'Marinho', pos: ['VOL', 'MC'], ovr: 78 },
      { name: 'Celso', pos: ['MC', 'MEI'], ovr: 75 },
    ]
  },
  {
    id: 'palmeiras1973', club: 'Palmeiras', year: 1973, label: 'Palmeiras 1973 (Bicampeao)', coach: 'Osvaldo Brandao',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Ademir da Guia', pos: ['MC', 'MEI'], ovr: 96 },
      { name: 'Luís Pereira', pos: ['ZAG'], ovr: 94 },
      { name: 'Leivinha', pos: ['MEI', 'ATA'], ovr: 91 },
      { name: 'Emerson Leão', pos: ['GOL'], ovr: 92 },
      { name: 'Dudu', pos: ['VOL', 'MC'], ovr: 89 },
      { name: 'César Maluco', pos: ['ATA'], ovr: 88 },
      { name: 'Alfredo Mostarda', pos: ['ZAG'], ovr: 85 },
      { name: 'Eurico', pos: ['LD'], ovr: 85 },
      { name: 'Zeca', pos: ['LE'], ovr: 83 },
      { name: 'Edu Bala', pos: ['PD', 'MD'], ovr: 84 },
      { name: 'Nei', pos: ['PE', 'ME'], ovr: 83 },
      { name: 'Ronaldo', pos: ['ATA', 'PD'], ovr: 81 },
      { name: 'Fedato', pos: ['ATA'], ovr: 78 },
      { name: 'Polaco', pos: ['ZAG', 'LE'], ovr: 77 },
      { name: 'Pio', pos: ['PE', 'ATA'], ovr: 79 },
      { name: 'Toninho Vanusa', pos: ['MC', 'MEI'], ovr: 78 },
      { name: 'De Rosis', pos: ['VOL', 'MC'], ovr: 76 },
      { name: 'João Carlos', pos: ['LD', 'ZAG'], ovr: 75 },
      { name: 'Bernard', pos: ['GOL'], ovr: 77 },
      { name: 'Édson', pos: ['MC', 'ME'], ovr: 75 },
    ]
  },
  {
    id: 'vasco1974', club: 'Vasco', year: 1974, label: 'Vasco 1974 (Campeao Brasileiro)', coach: 'Mario Travaglini',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Roberto Dinamite', pos: ['ATA'], ovr: 94 },
      { name: 'Andrada', pos: ['GOL'], ovr: 87 },
      { name: 'Zanata', pos: ['MC', 'MEI'], ovr: 84 },
      { name: 'Alcir', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Miguel', pos: ['ZAG'], ovr: 83 },
      { name: 'Fidélis', pos: ['LD'], ovr: 82 },
      { name: 'Alfinete', pos: ['LE', 'LD'], ovr: 81 },
      { name: 'Moisés', pos: ['ZAG'], ovr: 82 },
      { name: 'Jorginho Carvoeiro', pos: ['PD', 'MD'], ovr: 83 },
      { name: 'Luiz Carlos', pos: ['PE', 'ME'], ovr: 81 },
      { name: 'Ademir', pos: ['MEI', 'MC'], ovr: 81 },
      { name: 'Joel Santana', pos: ['ZAG', 'LD'], ovr: 78 },
      { name: 'Peres', pos: ['MC', 'MEI'], ovr: 77 },
      { name: 'Paulo César', pos: ['LE'], ovr: 76 },
      { name: 'Mazarópi', pos: ['GOL'], ovr: 78 },
      { name: 'Fred', pos: ['VOL', 'MC'], ovr: 75 },
      { name: 'Amarildo', pos: ['ATA'], ovr: 76 },
      { name: 'Jaílson', pos: ['PD', 'ATA'], ovr: 74 },
      { name: 'Gaúcho', pos: ['ZAG', 'MC'], ovr: 74 },
      { name: 'Galdino', pos: ['PE', 'ME'], ovr: 73 },
    ]
  },
  {
    id: 'internacional1975', club: 'Internacional', year: 1975, label: 'Internacional 1975/1976', coach: 'Rubens Minelli',
    colors: { p: '#FF0000', s: '#FFFFFF' },
    players: [
      { name: 'Falcão', pos: ['VOL', 'MC'], ovr: 95 },
      { name: 'Figueroa', pos: ['ZAG'], ovr: 96 },
      { name: 'Carpegiani', pos: ['MC', 'MEI'], ovr: 91 },
      { name: 'Manga', pos: ['GOL'], ovr: 90 },
      { name: 'Lula', pos: ['PE', 'ME'], ovr: 87 },
      { name: 'Valdomiro', pos: ['PD', 'MD'], ovr: 88 },
      { name: 'Flávio Minuano', pos: ['ATA'], ovr: 87 },
      { name: 'Caçapava', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Vacaria', pos: ['LE'], ovr: 84 },
      { name: 'Hermínio', pos: ['ZAG'], ovr: 83 },
      { name: 'Valdir', pos: ['LD'], ovr: 83 },
      { name: 'Batista', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Jair', pos: ['MEI', 'MC'], ovr: 81 },
      { name: 'Cláudio Duarte', pos: ['LD', 'ZAG'], ovr: 78 },
      { name: 'Ramon', pos: ['ATA', 'MD'], ovr: 77 },
      { name: 'Chico Spina', pos: ['PD', 'ATA'], ovr: 78 },
      { name: 'Schneider', pos: ['GOL'], ovr: 76 },
      { name: 'Borjão', pos: ['ATA'], ovr: 75 },
      { name: 'Escurinho', pos: ['ATA', 'MEI'], ovr: 79 },
      { name: 'Edinho', pos: ['LE', 'ME'], ovr: 74 },
    ]
  },
  {
    id: 'cruzeiro1976', club: 'Cruzeiro', year: 1976, label: 'Cruzeiro 1976 (Libertadores)', coach: 'Zeze Moreira',
    colors: { p: '#0033A0', s: '#ffffff' },
    players: [
      { name: 'Raul', pos: ['GOL'], ovr: 87 },
      { name: 'Nelinho', pos: ['LD'], ovr: 92 },
      { name: 'Morais', pos: ['ZAG'], ovr: 85 },
      { name: 'Osmar Guarnelli', pos: ['ZAG', 'VOL'], ovr: 83 },
      { name: 'Vanderlei', pos: ['LE'], ovr: 82 },
      { name: 'Wilson Piazza', pos: ['VOL', 'ZAG'], ovr: 90 },
      { name: 'Zeze', pos: ['MC', 'MEI'], ovr: 82 },
      { name: 'Eduardo', pos: ['MEI', 'MC'], ovr: 85 },
      { name: 'Palhinha', pos: ['ATA'], ovr: 89 },
      { name: 'Joaozinho', pos: ['MEI', 'PE'], ovr: 88 },
      { name: 'Roberto Batata', pos: ['ATA', 'PD'], ovr: 86 },
      { name: 'Jairzinho', pos: ['PD', 'ATA'], ovr: 88 },
      { name: 'Waldo', pos: ['ATA'], ovr: 80 },
      { name: 'Vanderlei Paiva', pos: ['MC', 'VOL'], ovr: 79 },
      { name: 'Rafael', pos: ['GOL'], ovr: 76 },
      { name: 'Piazza Filho', pos: ['ZAG'], ovr: 75 },
      { name: 'Ze Carlos', pos: ['LD', 'LE'], ovr: 78 },
      { name: 'Ronaldo', pos: ['MEI', 'MD'], ovr: 79 },
      { name: 'Neco', pos: ['LE'], ovr: 77 },
      { name: 'Marcelo', pos: ['PE', 'ME'], ovr: 76 },
    ]
  },
  {
    id: 'fluminense1976', club: 'Fluminense', year: 1976, label: 'Fluminense 1976 (Maquina Tricolor)', coach: 'Duque',
    colors: { p: '#7A1921', s: '#006633' },
    players: [
      { name: 'Felix', pos: ['GOL'], ovr: 84 },
      { name: 'Carlos Alberto Torres', pos: ['LD', 'ZAG'], ovr: 91 },
      { name: 'Edinho', pos: ['ZAG'], ovr: 87 },
      { name: 'Miguel', pos: ['ZAG'], ovr: 83 },
      { name: 'Rodrigues Neto', pos: ['LE'], ovr: 86 },
      { name: 'Carlos Alberto Pintinho', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Rivelino', pos: ['MEI', 'ME'], ovr: 95 },
      { name: 'Gilson Nunes', pos: ['MC', 'MD'], ovr: 82 },
      { name: 'Cafuringa', pos: ['PD', 'MD'], ovr: 87 },
      { name: 'Doval', pos: ['ATA'], ovr: 88 },
      { name: 'Paulo Cezar Caju', pos: ['PE', 'MEI'], ovr: 89 },
      { name: 'Marco Antonio', pos: ['LE', 'LD'], ovr: 85 },
      { name: 'Manfrini', pos: ['ATA'], ovr: 82 },
      { name: 'Dirceu', pos: ['MEI', 'ME'], ovr: 86 },
      { name: 'Renato', pos: ['GOL'], ovr: 77 },
      { name: 'Ze Mario', pos: ['LD', 'ZAG'], ovr: 79 },
      { name: 'Cleber', pos: ['VOL'], ovr: 78 },
      { name: 'Nilton Batata', pos: ['ATA', 'PD'], ovr: 77 },
      { name: 'Ruy Rey', pos: ['MC', 'MEI'], ovr: 78 },
      { name: 'Jorge Vitorio', pos: ['ZAG'], ovr: 76 },
    ]
  },
  {
    id: 'corinthians1977', club: 'Corinthians', year: 1977, label: 'Corinthians 1977', coach: 'Oswaldo Brandao',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Tobias', pos: ['GOL'], ovr: 84 },
      { name: 'Zé Maria', pos: ['LD', 'MD'], ovr: 89 },
      { name: 'Wladimir', pos: ['LE', 'ME'], ovr: 89 },
      { name: 'Moisés', pos: ['ZAG'], ovr: 84 },
      { name: 'Ademir', pos: ['ZAG'], ovr: 82 },
      { name: 'Ruço', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Basílio', pos: ['MC', 'MEI', 'ATA'], ovr: 86 },
      { name: 'Palhinha', pos: ['MEI', 'ATA', 'MC'], ovr: 90 },
      { name: 'Vaguinho', pos: ['PD', 'ATA'], ovr: 85 },
      { name: 'Geraldão', pos: ['ATA'], ovr: 84 },
      { name: 'Romeu Cambalhota', pos: ['PE', 'PD'], ovr: 84 },
      { name: 'Jairo', pos: ['GOL'], ovr: 79 },
      { name: 'Cláudio Mineiro', pos: ['LE', 'ME'], ovr: 79 },
      { name: 'Zé Eduardo', pos: ['ZAG'], ovr: 78 },
      { name: 'Givanildo Oliveira', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Tião', pos: ['VOL'], ovr: 77 },
      { name: 'Luciano', pos: ['MEI'], ovr: 76 },
      { name: 'Ivan', pos: ['PD'], ovr: 75 },
      { name: 'Edu', pos: ['PE', 'MEI'], ovr: 80 },
      { name: 'Lance', pos: ['ATA'], ovr: 76 },
    ]
  },
  {
    id: 'saopaulo1977', club: 'Sao Paulo', year: 1977, label: 'Sao Paulo 1977 (1o Brasileirao)', coach: 'Rubens Minelli',
    colors: { p: '#C8102E', s: '#ffffff' },
    players: [
      { name: 'Waldir Peres', pos: ['GOL'], ovr: 86 },
      { name: 'Getulio', pos: ['LD'], ovr: 82 },
      { name: 'Arlindo', pos: ['ZAG'], ovr: 83 },
      { name: 'Chicao', pos: ['ZAG'], ovr: 85 },
      { name: 'Everaldo', pos: ['LE'], ovr: 81 },
      { name: 'Ze Teodoro', pos: ['VOL', 'LE'], ovr: 82 },
      { name: 'Pedrinho', pos: ['MC', 'MEI'], ovr: 83 },
      { name: 'Terto', pos: ['MEI', 'MD'], ovr: 84 },
      { name: 'Serginho Chulapa', pos: ['ATA'], ovr: 88 },
      { name: 'Mirandinha', pos: ['ATA', 'MEI'], ovr: 84 },
      { name: 'Ze Sergio', pos: ['PE', 'ME'], ovr: 87 },
      { name: 'Valdir Peres Jr', pos: ['GOL'], ovr: 75 },
      { name: 'Renato', pos: ['ZAG'], ovr: 78 },
      { name: 'Chico Fraga', pos: ['MC', 'VOL'], ovr: 79 },
      { name: 'Nelsinho', pos: ['LD'], ovr: 78 },
      { name: 'Paulo Isidoro', pos: ['PD', 'MD'], ovr: 82 },
      { name: 'Nei', pos: ['ATA'], ovr: 77 },
      { name: 'Zezinho', pos: ['MEI'], ovr: 76 },
      { name: 'Wanderley', pos: ['LE'], ovr: 75 },
      { name: 'Dario', pos: ['VOL'], ovr: 76 },
    ]
  },
  {
    id: 'guarani1978', club: 'Guarani', year: 1978, label: 'Guarani 1978 (Campeao Brasileiro)', coach: 'Carlos Alberto Silva',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Careca', pos: ['ATA'], ovr: 94 },
      { name: 'Zenon', pos: ['MEI', 'MC'], ovr: 92 },
      { name: 'Renato', pos: ['MC'], ovr: 89 },
      { name: 'Neneca', pos: ['GOL'], ovr: 88 },
      { name: 'Gomes', pos: ['ZAG'], ovr: 87 },
      { name: 'Capitão', pos: ['PD', 'MD'], ovr: 86 },
      { name: 'Bozó', pos: ['PE', 'ME'], ovr: 86 },
      { name: 'Miranda', pos: ['LE'], ovr: 85 },
      { name: 'Mauro', pos: ['LD', 'ME'], ovr: 85 },
      { name: 'Zé Carlos', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Edson', pos: ['ZAG', 'ME'], ovr: 85 },
      { name: 'Manguinha', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Silvinho', pos: ['PE', 'ATA'], ovr: 82 },
      { name: 'Macedo', pos: ['ATA'], ovr: 81 },
      { name: 'João de Deus', pos: ['GOL'], ovr: 80 },
      { name: 'Adriano', pos: ['MC'], ovr: 80 },
      { name: 'Alexandre', pos: ['LD', 'ZAG'], ovr: 79 },
      { name: 'Almeida', pos: ['LE'], ovr: 79 },
      { name: 'Gersinho', pos: ['PD'], ovr: 78 },
      { name: 'Cidão', pos: ['ZAG'], ovr: 78 },
    ]
  },
  {
    id: 'internacional1979', club: 'Internacional', year: 1979, label: 'Internacional 1979 (Invicto)', coach: 'Enio Andrade',
    colors: { p: '#D2122E', s: '#ffffff' },
    players: [
      { name: 'Benítez', pos: ['GOL'], ovr: 89 },
      { name: 'João Carlos', pos: ['LD'], ovr: 80 },
      { name: 'Cláudio Mineiro', pos: ['LE', 'ME'], ovr: 85 },
      { name: 'Mauro Galvão', pos: ['ZAG', 'VOL'], ovr: 88 },
      { name: 'Mauro Pastor', pos: ['ZAG'], ovr: 86 },
      { name: 'Batista', pos: ['VOL', 'MC'], ovr: 90 },
      { name: 'Falcão', pos: ['MC', 'MEI', 'VOL'], ovr: 98 },
      { name: 'Jair', pos: ['MEI', 'MC', 'ATA'], ovr: 91 },
      { name: 'Mário Sérgio', pos: ['MEI', 'PE', 'ME'], ovr: 88 },
      { name: 'Valdomiro', pos: ['PD', 'ATA'], ovr: 89 },
      { name: 'Bira', pos: ['ATA'], ovr: 87 },
      { name: 'Gasperin', pos: ['GOL'], ovr: 76 },
      { name: 'Édson Galvão', pos: ['LD'], ovr: 76 },
      { name: 'Beliato', pos: ['ZAG'], ovr: 79 },
      { name: 'Valdir Lima', pos: ['VOL'], ovr: 79 },
      { name: 'Tonho', pos: ['MEI'], ovr: 83 },
      { name: 'Chico Spina', pos: ['PD', 'ATA'], ovr: 83 },
      { name: 'Silvinho', pos: ['PE'], ovr: 78 },
      { name: 'Adílson', pos: ['PE'], ovr: 82 },
      { name: 'Mário Motta', pos: ['ATA'], ovr: 78 },
    ]
  },
  {
    id: 'flamengo1980', club: 'Flamengo', year: 1980, label: 'Flamengo 1980 (Campeao Brasileiro)', coach: 'Claudio Coutinho',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Raul Plassmann', pos: ['GOL'], ovr: 85 },
      { name: 'Leandro', pos: ['LD', 'ZAG', 'MC'], ovr: 92 },
      { name: 'Mozer', pos: ['ZAG'], ovr: 87 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 83 },
      { name: 'Júnior', pos: ['LE', 'MC', 'ME'], ovr: 93 },
      { name: 'Andrade', pos: ['VOL', 'MC'], ovr: 88 },
      { name: 'Adílio', pos: ['MC', 'MEI', 'ME'], ovr: 89 },
      { name: 'Zico', pos: ['MEI', 'ATA', 'MC'], ovr: 97 },
      { name: 'Tita', pos: ['MEI', 'PD', 'ATA'], ovr: 86 },
      { name: 'Nunes', pos: ['ATA'], ovr: 86 },
      { name: 'Júlio César Uri Geller', pos: ['PE'], ovr: 81 },
      { name: 'Cantarele', pos: ['GOL'], ovr: 78 },
      { name: 'Antunes', pos: ['LD'], ovr: 74 },
      { name: 'Figueiredo', pos: ['ZAG'], ovr: 78 },
      { name: 'Vítor', pos: ['VOL'], ovr: 76 },
      { name: 'Lico', pos: ['MEI', 'PE'], ovr: 83 },
      { name: 'Chiquinho', pos: ['PD'], ovr: 76 },
      { name: 'Anselmo', pos: ['ATA'], ovr: 77 },
      { name: 'Reinaldo', pos: ['ATA'], ovr: 75 },
      { name: 'Popoca', pos: ['ATA', 'MEI'], ovr: 74 },
    ]
  },
  {
    id: 'flamengo1981', club: 'Flamengo', year: 1981, label: 'Flamengo 1981 (Mundial)', coach: 'Paulo Cesar Carpegiani',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Raul Plassmann', pos: ['GOL'], ovr: 87 },
      { name: 'Leandro', pos: ['LD', 'ZAG', 'MC'], ovr: 94 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 85 },
      { name: 'Mozer', pos: ['ZAG'], ovr: 89 },
      { name: 'Júnior', pos: ['LE', 'MC', 'ME'], ovr: 95 },
      { name: 'Andrade', pos: ['VOL', 'MC'], ovr: 90 },
      { name: 'Adílio', pos: ['MC', 'MEI', 'ME'], ovr: 91 },
      { name: 'Zico', pos: ['MEI', 'ATA', 'MC'], ovr: 99 },
      { name: 'Tita', pos: ['MEI', 'PD', 'ATA'], ovr: 88 },
      { name: 'Lico', pos: ['MEI', 'PE'], ovr: 85 },
      { name: 'Nunes', pos: ['ATA'], ovr: 89 },
      { name: 'Cantarele', pos: ['GOL'], ovr: 78 },
      { name: 'Nei Dias', pos: ['LD'], ovr: 76 },
      { name: 'Figueiredo', pos: ['ZAG'], ovr: 78 },
      { name: 'Rondinelli', pos: ['ZAG'], ovr: 81 },
      { name: 'Vítor', pos: ['VOL'], ovr: 76 },
      { name: 'Chiquinho', pos: ['PD'], ovr: 76 },
      { name: 'Júlio César Uri Geller', pos: ['PE'], ovr: 82 },
      { name: 'Anselmo', pos: ['ATA'], ovr: 78 },
      { name: 'Baroninho', pos: ['PE', 'ATA'], ovr: 81 },
    ]
  },
  {
    id: 'gremio1981', club: 'Gremio', year: 1981, label: 'Gremio 1981 (Campeao Brasileiro)', coach: 'Enio Andrade',
    colors: { p: '#0D80BF', s: '#000000' },
    players: [
      { name: 'Mazaropi', pos: ['GOL'], ovr: 85 },
      { name: 'Paulo Roberto', pos: ['LD'], ovr: 82 },
      { name: 'De Leon', pos: ['ZAG'], ovr: 88 },
      { name: 'Casemiro Mior', pos: ['ZAG'], ovr: 83 },
      { name: 'Baidek', pos: ['LE'], ovr: 83 },
      { name: 'China', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Osvaldo', pos: ['MC', 'MEI'], ovr: 83 },
      { name: 'Tarciso', pos: ['MEI', 'MD'], ovr: 86 },
      { name: 'Baltazar', pos: ['ATA'], ovr: 85 },
      { name: 'Paulo Cesar Magalhaes', pos: ['MEI', 'PE'], ovr: 82 },
      { name: 'Vantuir', pos: ['PD', 'MD'], ovr: 81 },
      { name: 'Renato Gaucho', pos: ['PD', 'ATA'], ovr: 84 },
      { name: 'Sergio', pos: ['GOL'], ovr: 75 },
      { name: 'Betinho', pos: ['ZAG'], ovr: 77 },
      { name: 'Valdo', pos: ['MC', 'MEI'], ovr: 79 },
      { name: 'Nunes', pos: ['ATA'], ovr: 80 },
      { name: 'Bonamigo', pos: ['VOL'], ovr: 77 },
      { name: 'Andre Catimba', pos: ['PE', 'ME'], ovr: 78 },
      { name: 'Joao Antonio', pos: ['LD'], ovr: 75 },
      { name: 'Ancheta', pos: ['ZAG'], ovr: 79 },
    ]
  },
  {
    id: 'flamengo1982', club: 'Flamengo', year: 1982, label: 'Flamengo 1982 (Bicampeao Brasileiro)', coach: 'Paulo Cesar Carpegiani',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Zico', pos: ['MEI', 'MC'], ovr: 99 },
      { name: 'Júnior', pos: ['LE', 'MC'], ovr: 94 },
      { name: 'Leandro', pos: ['LD', 'MC'], ovr: 94 },
      { name: 'Mozer', pos: ['ZAG'], ovr: 89 },
      { name: 'Nunes', pos: ['ATA'], ovr: 89 },
      { name: 'Adílio', pos: ['MC', 'MEI'], ovr: 89 },
      { name: 'Tita', pos: ['PD', 'MD'], ovr: 89 },
      { name: 'Raul Plassmann', pos: ['GOL'], ovr: 88 },
      { name: 'Andrade', pos: ['VOL', 'MC'], ovr: 88 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 86 },
      { name: 'Lico', pos: ['PE', 'MD'], ovr: 86 },
      { name: 'Vítor', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Cantarele', pos: ['GOL'], ovr: 81 },
      { name: 'Figueiredo', pos: ['ZAG'], ovr: 81 },
      { name: 'Popoca', pos: ['MEI', 'MC'], ovr: 81 },
      { name: 'Chiquinho', pos: ['ATA', 'MC'], ovr: 80 },
      { name: 'Antunes', pos: ['LD'], ovr: 79 },
      { name: 'Reinaldo', pos: ['PE'], ovr: 79 },
      { name: 'Anselmo', pos: ['ATA'], ovr: 79 },
      { name: 'Wilsinho', pos: ['PD', 'MD'], ovr: 78 },
    ]
  },
  {
    id: 'flamengo1983', club: 'Flamengo', year: 1983, label: 'Flamengo 1983 (Tricampeao Brasileiro)', coach: 'Carlinhos',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Cantarele', pos: ['GOL'], ovr: 84 },
      { name: 'Leandro', pos: ['LD'], ovr: 92 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 85 },
      { name: 'Mozer', pos: ['ZAG'], ovr: 88 },
      { name: 'Junior', pos: ['LE', 'MC'], ovr: 92 },
      { name: 'Andrade', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Adilio', pos: ['MC', 'MEI'], ovr: 87 },
      { name: 'Peu', pos: ['MEI', 'MD'], ovr: 82 },
      { name: 'Baltazar', pos: ['ATA'], ovr: 84 },
      { name: 'Bebeto', pos: ['ATA', 'MEI'], ovr: 86 },
      { name: 'Tita', pos: ['PD', 'MEI'], ovr: 85 },
      { name: 'Nunes', pos: ['ATA'], ovr: 84 },
      { name: 'Zinho', pos: ['ME', 'MEI'], ovr: 78 },
      { name: 'Vitor', pos: ['MC', 'VOL'], ovr: 79 },
      { name: 'Raul', pos: ['GOL'], ovr: 77 },
      { name: 'Figueiredo', pos: ['ZAG'], ovr: 78 },
      { name: 'Jorginho', pos: ['LD', 'LE'], ovr: 80 },
      { name: 'Cladson', pos: ['PE', 'ME'], ovr: 77 },
      { name: 'Rondinelli', pos: ['ZAG'], ovr: 82 },
      { name: 'Marquinho', pos: ['MEI', 'MD'], ovr: 79 },
    ]
  },
  {
    id: 'gremio1983', club: 'Gremio', year: 1983, label: 'Gremio 1983 (Campeao do Mundo)', coach: 'Valdir Espinosa',
    colors: { p: '#0D80BF', s: '#000000' },
    players: [
      { name: 'Mazaropi', pos: ['GOL'], ovr: 87 },
      { name: 'Paulo Roberto', pos: ['LD'], ovr: 83 },
      { name: 'De Leon', pos: ['ZAG'], ovr: 90 },
      { name: 'Casemiro Mior', pos: ['ZAG'], ovr: 84 },
      { name: 'Baidek', pos: ['LE'], ovr: 84 },
      { name: 'China', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Osvaldo', pos: ['MC', 'MEI'], ovr: 84 },
      { name: 'Mario Sergio', pos: ['MEI', 'ME'], ovr: 88 },
      { name: 'Caio', pos: ['ATA'], ovr: 85 },
      { name: 'Tita', pos: ['MEI', 'ATA'], ovr: 86 },
      { name: 'Renato Gaucho', pos: ['PD', 'ATA'], ovr: 91 },
      { name: 'Tarciso', pos: ['MEI', 'MD'], ovr: 84 },
      { name: 'Valdo', pos: ['MC', 'MEI'], ovr: 82 },
      { name: 'Bonamigo', pos: ['VOL'], ovr: 79 },
      { name: 'Sergio', pos: ['GOL'], ovr: 76 },
      { name: 'Betinho', pos: ['ZAG'], ovr: 78 },
      { name: 'Vantuir', pos: ['PD', 'MD'], ovr: 80 },
      { name: 'Andre Catimba', pos: ['PE', 'ME'], ovr: 79 },
      { name: 'Joao Antonio', pos: ['LD'], ovr: 76 },
      { name: 'Baltazar', pos: ['ATA'], ovr: 82 },
    ]
  },
  {
    id: 'fluminense1984', club: 'Fluminense', year: 1984, label: 'Fluminense 1984 (Campeao Brasileiro)', coach: 'Carlos Alberto Parreira',
    colors: { p: '#7A1921', s: '#006633' },
    players: [
      { name: 'Paulo Vítor', pos: ['GOL'], ovr: 84 },
      { name: 'Aldo', pos: ['LD'], ovr: 82 },
      { name: 'Branco', pos: ['LE', 'ME'], ovr: 88 },
      { name: 'Duílio', pos: ['ZAG'], ovr: 83 },
      { name: 'Ricardo Rocha', pos: ['ZAG', 'VOL'], ovr: 86 },
      { name: 'Jandir', pos: ['VOL'], ovr: 83 },
      { name: 'Delei', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Assis', pos: ['MC', 'MEI'], ovr: 88 },
      { name: 'Romerito', pos: ['MEI', 'PD', 'MC'], ovr: 91 },
      { name: 'Tato', pos: ['PE', 'ME'], ovr: 82 },
      { name: 'Washington', pos: ['ATA'], ovr: 87 },
      { name: 'Ricardo Pinto', pos: ['GOL'], ovr: 75 },
      { name: 'Renato', pos: ['LE'], ovr: 74 },
      { name: 'Vica', pos: ['ZAG'], ovr: 80 },
      { name: 'Renê', pos: ['MEI', 'MC'], ovr: 78 },
      { name: 'Wilsinho', pos: ['PD'], ovr: 79 },
      { name: 'Paulinho', pos: ['PE'], ovr: 76 },
      { name: 'Cláudio Adão', pos: ['ATA'], ovr: 84 },
      { name: 'Agnaldo', pos: ['ATA'], ovr: 76 },
      { name: 'Gustavo', pos: ['ATA'], ovr: 74 },
    ]
  },
  {
    id: 'coritiba1985', club: 'Coritiba', year: 1985, label: 'Coritiba 1985 (Campeao Brasileiro)', coach: 'Enio Andrade',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Rafael Cammarota', pos: ['GOL'], ovr: 86 },
      { name: 'André', pos: ['LD', 'ZAG'], ovr: 82 },
      { name: 'Dida', pos: ['LE', 'ZAG'], ovr: 83 },
      { name: 'Gomes', pos: ['ZAG'], ovr: 85 },
      { name: 'Heraldo', pos: ['ZAG'], ovr: 83 },
      { name: 'Almir', pos: ['VOL'], ovr: 84 },
      { name: 'Marildo', pos: ['VOL', 'MC'], ovr: 81 },
      { name: 'Édson', pos: ['PE'], ovr: 81 },
      { name: 'Lela', pos: ['PD', 'ATA'], ovr: 87 },
      { name: 'Índio', pos: ['ATA'], ovr: 85 },
      { name: 'Toby', pos: ['ATA', 'MEI'], ovr: 83 },
      { name: 'Jairo', pos: ['GOL'], ovr: 79 },
      { name: 'Caxias', pos: ['LD'], ovr: 76 },
      { name: 'Vavá', pos: ['ZAG'], ovr: 77 },
      { name: 'Marco Aurélio', pos: ['MC', 'MEI'], ovr: 85 },
      { name: 'Tovar', pos: ['MEI', 'MC'], ovr: 82 },
      { name: 'Miltinho', pos: ['MEI'], ovr: 78 },
      { name: 'Paulinho', pos: ['PD'], ovr: 77 },
      { name: 'Vicente', pos: ['PE'], ovr: 76 },
      { name: 'Hélcio', pos: ['ATA'], ovr: 77 },
    ]
  },
  {
    id: 'saopaulo1986', club: 'Sao Paulo', year: 1986, label: 'São Paulo 1986 (Campeão Brasileiro)', coach: 'Pepe',
    colors: { p: '#C8102E', s: '#ffffff' },
    players: [
      { name: 'Careca', pos: ['ATA'], ovr: 96 },
      { name: 'Müller', pos: ['ATA', 'MD'], ovr: 92 },
      { name: 'Darío Pereyra', pos: ['ZAG', 'VOL'], ovr: 90 },
      { name: 'Gilmar Rinaldi', pos: ['GOL'], ovr: 88 },
      { name: 'Silas', pos: ['MC'], ovr: 88 },
      { name: 'Oscar', pos: ['ZAG'], ovr: 88 },
      { name: 'Nelsinho', pos: ['LE'], ovr: 87 },
      { name: 'Bernardo', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Pita', pos: ['MEI', 'MC'], ovr: 86 },
      { name: 'Zé Teodoro', pos: ['LD'], ovr: 85 },
      { name: 'Sidnei', pos: ['PD', 'MC'], ovr: 84 },
      { name: 'Wagner Basílio', pos: ['ZAG'], ovr: 83 },
      { name: 'Fonseca', pos: ['LD', 'ZAG'], ovr: 83 },
      { name: 'Ronaldão', pos: ['ZAG', 'MC'], ovr: 82 },
      { name: 'Vizolli', pos: ['VOL'], ovr: 82 },
      { name: 'Pianelli', pos: ['MEI', 'PE'], ovr: 81 },
      { name: 'Lange', pos: ['ATA'], ovr: 81 },
      { name: 'Abelha', pos: ['GOL'], ovr: 80 },
      { name: 'Manu', pos: ['MC', 'ME'], ovr: 79 },
      { name: 'Quarenta', pos: ['LE'], ovr: 78 },
    ]
  },
  {
    id: 'flamengo1987', club: 'Flamengo', year: 1987, label: 'Flamengo 1987 (Copa Uniao)', coach: 'Carlinhos',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Zetti', pos: ['GOL'], ovr: 84 },
      { name: 'Josimar', pos: ['LD'], ovr: 86 },
      { name: 'Aldair', pos: ['ZAG'], ovr: 88 },
      { name: 'Leandro', pos: ['ZAG', 'LD'], ovr: 90 },
      { name: 'Leonardo', pos: ['LE', 'MC'], ovr: 86 },
      { name: 'Andrade', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Zinho', pos: ['ME', 'MEI'], ovr: 84 },
      { name: 'Zico', pos: ['MEI', 'ATA'], ovr: 96 },
      { name: 'Bebeto', pos: ['ATA', 'MEI'], ovr: 90 },
      { name: 'Renato Gaucho', pos: ['PD', 'ATA'], ovr: 89 },
      { name: 'Zinho Pereira', pos: ['MD', 'PD'], ovr: 80 },
      { name: 'Jorginho', pos: ['LD', 'LE'], ovr: 83 },
      { name: 'Ailton', pos: ['ZAG'], ovr: 79 },
      { name: 'Marcio Costa', pos: ['VOL'], ovr: 78 },
      { name: 'Cantarele', pos: ['GOL'], ovr: 80 },
      { name: 'Edinho', pos: ['MC', 'MEI'], ovr: 80 },
      { name: 'Ze Carlos', pos: ['ATA'], ovr: 79 },
      { name: 'Paulinho', pos: ['MD', 'PD'], ovr: 78 },
      { name: 'Rogerio', pos: ['LE'], ovr: 76 },
      { name: 'Marcelo', pos: ['ATA', 'PE'], ovr: 77 },
    ]
  },
  {
    id: 'sport1987', club: 'Sport', year: 1987, label: 'Sport 1987 (Campeão Brasileiro)', coach: 'Emerson Leao',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Flávio', pos: ['GOL'], ovr: 84 },
      { name: 'Betão', pos: ['LD'], ovr: 82 },
      { name: 'Macaxeira', pos: ['LE'], ovr: 81 },
      { name: 'Estevam', pos: ['ZAG'], ovr: 85 },
      { name: 'Marco Antônio', pos: ['ZAG'], ovr: 83 },
      { name: 'Rogério', pos: ['VOL'], ovr: 83 },
      { name: 'Zé do Carmo', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Ribamar', pos: ['MC', 'MEI'], ovr: 84 },
      { name: 'Robertinho', pos: ['PD', 'ATA'], ovr: 83 },
      { name: 'Neco', pos: ['PE', 'ME'], ovr: 85 },
      { name: 'Nando', pos: ['ATA'], ovr: 85 },
      { name: 'Moacir', pos: ['GOL'], ovr: 76 },
      { name: 'Adriano', pos: ['ZAG'], ovr: 77 },
      { name: 'Dedé', pos: ['VOL'], ovr: 77 },
      { name: 'Nando', pos: ['MEI', 'MC'], ovr: 82 },
      { name: 'Zico', pos: ['MEI'], ovr: 78 },
      { name: 'Augusto', pos: ['PD'], ovr: 75 },
      { name: 'Émerson', pos: ['PE'], ovr: 76 },
      { name: 'Betinho', pos: ['ATA'], ovr: 80 },
      { name: 'Isaías', pos: ['ATA'], ovr: 75 },
    ]
  },
  {
    id: 'bahia1988', club: 'Bahia', year: 1988, label: 'Bahia 1988 (Bicampeão Brasileiro)', coach: 'Evaristo de Macedo',
    colors: { p: '#003399', s: '#C8102E' },
    players: [
      { name: 'Ronaldo', pos: ['GOL'], ovr: 88 },
      { name: 'Tarantini', pos: ['LD', 'ZAG'], ovr: 83 },
      { name: 'Paulo Róbson', pos: ['LE', 'ME'], ovr: 84 },
      { name: 'João Marcelo', pos: ['ZAG'], ovr: 86 },
      { name: 'Claudir', pos: ['ZAG'], ovr: 85 },
      { name: 'Paulo Rodrigues', pos: ['VOL', 'MC'], ovr: 87 },
      { name: 'Zé Carlos', pos: ['MC', 'MEI', 'VOL'], ovr: 88 },
      { name: 'Bobô', pos: ['MEI', 'MC', 'ATA'], ovr: 92 },
      { name: 'Marquinhos', pos: ['PD', 'PE'], ovr: 81 },
      { name: 'Sandro', pos: ['PE', 'ME'], ovr: 84 },
      { name: 'Charles Fabian', pos: ['ATA'], ovr: 89 },
      { name: 'Sidmar', pos: ['GOL'], ovr: 77 },
      { name: 'Maizena', pos: ['LD'], ovr: 76 },
      { name: 'Edinho', pos: ['LE'], ovr: 75 },
      { name: 'Newmar', pos: ['ZAG'], ovr: 78 },
      { name: 'Sales', pos: ['VOL'], ovr: 83 },
      { name: 'Gil Sergipano', pos: ['VOL', 'MC'], ovr: 81 },
      { name: 'Dácio', pos: ['MEI'], ovr: 75 },
      { name: 'Osmar', pos: ['PD', 'ATA'], ovr: 83 },
      { name: 'Renato', pos: ['ATA'], ovr: 80 },
    ]
  },
  {
    id: 'vasco1989', club: 'Vasco', year: 1989, label: 'Vasco 1989 (Campeão Brasileiro)', coach: 'Nelsinho Rosa',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Acácio', pos: ['GOL'], ovr: 85 },
      { name: 'Luís Carlos Winck', pos: ['LD'], ovr: 84 },
      { name: 'Quiñonez', pos: ['ZAG'], ovr: 83 },
      { name: 'Marco Aurélio', pos: ['ZAG', 'MC'], ovr: 82 },
      { name: 'Célio Silva', pos: ['ZAG'], ovr: 80 },
      { name: 'Mazinho', pos: ['LE', 'VOL'], ovr: 88 },
      { name: 'Zé do Carmo', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Andrade', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Marco Antônio Boiadeiro', pos: ['MC'], ovr: 83 },
      { name: 'Bismarck', pos: ['MEI', 'MD'], ovr: 86 },
      { name: 'Bebeto', pos: ['ATA', 'MEI'], ovr: 92 },
      { name: 'Tita', pos: ['MEI', 'MD'], ovr: 85 },
      { name: 'William', pos: ['MEI', 'ME'], ovr: 82 },
      { name: 'Sorato', pos: ['ATA'], ovr: 83 },
      { name: 'Tato', pos: ['PE', 'ME'], ovr: 80 },
      { name: 'Ayupe', pos: ['LD'], ovr: 74 },
      { name: 'Leonardo Siqueira', pos: ['ZAG'], ovr: 76 },
      { name: 'Cássio', pos: ['LE'], ovr: 74 },
      { name: 'França', pos: ['VOL'], ovr: 75 },
      { name: 'Reginaldo', pos: ['GOL'], ovr: 75 },
    ]
  },
  {
    id: 'corinthians1990', club: 'Corinthians', year: 1990, label: 'Corinthians 1990 (Primeiro Titulo)', coach: 'Nelsinho Baptista',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Neto', pos: ['MEI', 'MC'], ovr: 93 },
      { name: 'Ronaldo Giovanelli', pos: ['GOL'], ovr: 89 },
      { name: 'Márcio Bittencourt', pos: ['VOL', 'MC'], ovr: 87 },
      { name: 'Tupãzinho', pos: ['MC', 'MD'], ovr: 87 },
      { name: 'Marcelo Djian', pos: ['ZAG'], ovr: 86 },
      { name: 'Wilson Mano', pos: ['VOL', 'LD'], ovr: 86 },
      { name: 'Giba', pos: ['LD'], ovr: 85 },
      { name: 'Jacenir', pos: ['LE'], ovr: 85 },
      { name: 'Fabinho', pos: ['PD', 'MC'], ovr: 85 },
      { name: 'Mauro', pos: ['ZAG', 'ME'], ovr: 84 },
      { name: 'Guinei', pos: ['ZAG'], ovr: 84 },
      { name: 'Dinei', pos: ['ATA'], ovr: 84 },
      { name: 'Gérson', pos: ['ZAG', 'LD'], ovr: 78 },
      { name: 'Ezequiel', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Paulo Sérgio', pos: ['ATA', 'ME'], ovr: 82 },
      { name: 'Jairo', pos: ['ATA'], ovr: 81 },
      { name: 'Marcos Roberto', pos: ['LE'], ovr: 80 },
      { name: 'Wilson', pos: ['GOL'], ovr: 80 },
      { name: 'Dama', pos: ['ZAG'], ovr: 79 },
      { name: 'Dagoberto', pos: ['GOL'], ovr: 74 },
    ]
  },
  {
    id: 'saopaulo1991', club: 'Sao Paulo', year: 1991, label: 'São Paulo 1991 (Campeão Brasileiro)', coach: 'Tele Santana',
    colors: { p: '#C8102E', s: '#ffffff' },
    players: [
      { name: 'Zetti', pos: ['GOL'], ovr: 91 },
      { name: 'Cafu', pos: ['LD', 'MD', 'PD', 'MC'], ovr: 92 },
      { name: 'Ricardo Rocha', pos: ['ZAG', 'VOL'], ovr: 92 },
      { name: 'Antônio Carlos Zago', pos: ['ZAG'], ovr: 86 },
      { name: 'Leonardo', pos: ['LE', 'ME', 'MC'], ovr: 90 },
      { name: 'Bernardo', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Sídnei', pos: ['VOL'], ovr: 81 },
      { name: 'Raí', pos: ['MEI', 'ATA'], ovr: 93 },
      { name: 'Elivélton', pos: ['PE', 'ME'], ovr: 84 },
      { name: 'Müller', pos: ['ATA', 'PD', 'PE', 'MEI'], ovr: 91 },
      { name: 'Macedo', pos: ['ATA', 'PD'], ovr: 83 },
      { name: 'Marcos Bonequini', pos: ['GOL'], ovr: 76 },
      { name: 'Zé Teodoro', pos: ['LD'], ovr: 80 },
      { name: 'Nelsinho', pos: ['LE'], ovr: 82 },
      { name: 'Ronaldão', pos: ['ZAG', 'VOL'], ovr: 85 },
      { name: 'Suélio', pos: ['VOL'], ovr: 79 },
      { name: 'Catê', pos: ['ATA', 'PD'], ovr: 75 },
      { name: 'Flávio Campos', pos: ['MC', 'VOL'], ovr: 81 },
      { name: 'Mário Tilico', pos: ['PD', 'PE'], ovr: 83 },
      { name: 'Rinaldo', pos: ['ATA'], ovr: 78 },
    ]
  },
  {
    id: 'flamengo1992', club: 'Flamengo', year: 1992, label: 'Flamengo 1992 (Campeão Brasileiro)', coach: 'Carlinhos',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Júnior', pos: ['MC', 'LE'], ovr: 93 },
      { name: 'Gilmar', pos: ['GOL', 'MC'], ovr: 88 },
      { name: 'Zinho', pos: ['ME', 'MC'], ovr: 88 },
      { name: 'Gaúcho', pos: ['ATA', 'MC'], ovr: 87 },
      { name: 'Wilson Gottardo', pos: ['ZAG'], ovr: 87 },
      { name: 'Djalminha', pos: ['MEI', 'MC'], ovr: 86 },
      { name: 'Piá', pos: ['LE'], ovr: 86 },
      { name: 'Charles', pos: ['LD'], ovr: 85 },
      { name: 'Júnior Baiano', pos: ['ZAG'], ovr: 85 },
      { name: 'Uidemar', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Nélio', pos: ['PE', 'MC'], ovr: 85 },
      { name: 'Marcelinho Carioca', pos: ['MEI', 'ME'], ovr: 84 },
      { name: 'Rogério', pos: ['ZAG'], ovr: 83 },
      { name: 'Marquinhos', pos: ['MC', 'ME'], ovr: 83 },
      { name: 'Paulo Nunes', pos: ['PD', 'ATA'], ovr: 83 },
      { name: 'Fabinho', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Totó', pos: ['ATA'], ovr: 81 },
      { name: 'Gelson', pos: ['ZAG'], ovr: 80 },
      { name: 'Adriano', pos: ['GOL', 'MC'], ovr: 79 },
      { name: 'Luís Antônio', pos: ['LE', 'MC'], ovr: 78 },
    ]
  },
  {
    id: 'saopaulo1992', club: 'Sao Paulo', year: 1992, label: 'Sao Paulo 1992 (Campeao do Mundo)', coach: 'Tele Santana',
    colors: { p: '#C8102E', s: '#ffffff' },
    players: [
      { name: 'Zetti', pos: ['GOL'], ovr: 91 },
      { name: 'Cafu', pos: ['LD', 'MD'], ovr: 92 },
      { name: 'Ronaldao', pos: ['ZAG'], ovr: 88 },
      { name: 'Valber', pos: ['ZAG'], ovr: 87 },
      { name: 'Ronaldo Luiz', pos: ['LE'], ovr: 86 },
      { name: 'Pintado', pos: ['VOL', 'MC'], ovr: 87 },
      { name: 'Toninho Cerezo', pos: ['MC', 'VOL'], ovr: 91 },
      { name: 'Rai', pos: ['MEI', 'ATA'], ovr: 96 },
      { name: 'Muller', pos: ['ATA', 'PD'], ovr: 91 },
      { name: 'Palhinha', pos: ['ATA'], ovr: 89 },
      { name: 'Macedo', pos: ['PE', 'ME'], ovr: 85 },
      { name: 'Elivelton', pos: ['MEI', 'PD'], ovr: 84 },
      { name: 'Gilmar', pos: ['GOL'], ovr: 82 },
      { name: 'Adilson', pos: ['VOL', 'ZAG'], ovr: 82 },
      { name: 'Ivan', pos: ['ZAG'], ovr: 80 },
      { name: 'Doriva', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Vitor', pos: ['LE', 'LD'], ovr: 79 },
      { name: 'Cafuringa', pos: ['ATA', 'PD'], ovr: 80 },
      { name: 'Dinho', pos: ['MC', 'MEI'], ovr: 82 },
      { name: 'Andre Luiz', pos: ['ZAG', 'LD'], ovr: 79 },
    ]
  },
  {
    id: 'palmeiras1993', club: 'Palmeiras', year: 1993, label: 'Palmeiras 1993 (Campeão Brasileiro)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Sérgio', pos: ['GOL'], ovr: 87 },
      { name: 'Mazinho', pos: ['LD', 'VOL', 'LE', 'MC'], ovr: 87 },
      { name: 'Cláudio', pos: ['LD', 'MD'], ovr: 86 },
      { name: 'Roberto Carlos', pos: ['LE', 'ME'], ovr: 92 },
      { name: 'Antônio Carlos Zago', pos: ['ZAG'], ovr: 89 },
      { name: 'Cléber', pos: ['ZAG'], ovr: 86 },
      { name: 'César Sampaio', pos: ['VOL', 'MC'], ovr: 91 },
      { name: 'Zinho', pos: ['MEI', 'ME', 'MC'], ovr: 90 },
      { name: 'Edmundo', pos: ['PD', 'ATA', 'MEI'], ovr: 93 },
      { name: 'Edílson', pos: ['PE', 'ATA', 'PD', 'MEI'], ovr: 87 },
      { name: 'Evair', pos: ['ATA', 'MEI'], ovr: 92 },
      { name: 'Velloso', pos: ['GOL'], ovr: 80 },
      { name: 'Tonhão', pos: ['ZAG'], ovr: 83 },
      { name: 'Edinho Baiano', pos: ['ZAG'], ovr: 78 },
      { name: 'Daniel Frasson', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Amaral', pos: ['VOL'], ovr: 82 },
      { name: 'Jean Carlo', pos: ['MEI', 'PE'], ovr: 81 },
      { name: 'Maurílio', pos: ['PD', 'ATA', 'LD'], ovr: 82 },
      { name: 'Sorato', pos: ['ATA'], ovr: 83 },
      { name: 'Saulo', pos: ['ATA'], ovr: 78 },
    ]
  },
  {
    id: 'saopaulo1993', club: 'Sao Paulo', year: 1993, label: 'Sao Paulo 1993 (Bicampeao do Mundo)', coach: 'Tele Santana',
    colors: { p: '#C8102E', s: '#ffffff' },
    players: [
      { name: 'Zetti', pos: ['GOL'], ovr: 92 },
      { name: 'Cafu', pos: ['LD', 'MD'], ovr: 93 },
      { name: 'Ronaldao', pos: ['ZAG'], ovr: 88 },
      { name: 'Valber', pos: ['ZAG'], ovr: 88 },
      { name: 'Ronaldo Luiz', pos: ['LE'], ovr: 86 },
      { name: 'Doriva', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Toninho Cerezo', pos: ['MC', 'VOL'], ovr: 90 },
      { name: 'Dinho', pos: ['MEI', 'MC'], ovr: 86 },
      { name: 'Muller', pos: ['ATA', 'PD'], ovr: 91 },
      { name: 'Palhinha', pos: ['ATA'], ovr: 90 },
      { name: 'Juninho Paulista', pos: ['MEI', 'MD'], ovr: 88 },
      { name: 'Rai', pos: ['MEI', 'ATA'], ovr: 95 },
      { name: 'Leonardo', pos: ['LE', 'MC'], ovr: 89 },
      { name: 'Gilmar', pos: ['GOL'], ovr: 82 },
      { name: 'Pintado', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Axel', pos: ['ZAG'], ovr: 81 },
      { name: 'Elivelton', pos: ['MEI', 'PD'], ovr: 85 },
      { name: 'Macedo', pos: ['PE', 'ME'], ovr: 84 },
      { name: 'Andre Luiz', pos: ['ZAG', 'LD'], ovr: 80 },
      { name: 'Guilherme', pos: ['ATA'], ovr: 81 },
    ]
  },
  {
    id: 'palmeiras1994', club: 'Palmeiras', year: 1994, label: 'Palmeiras 1994 (Bicampeão Brasileiro)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Rivaldo', pos: ['MEI', 'MC'], ovr: 94 },
      { name: 'Edmundo', pos: ['PD', 'ATA'], ovr: 93 },
      { name: 'Roberto Carlos', pos: ['LE'], ovr: 93 },
      { name: 'Evair', pos: ['ATA', 'ME'], ovr: 92 },
      { name: 'César Sampaio', pos: ['VOL', 'MC'], ovr: 91 },
      { name: 'Zinho', pos: ['ME', 'MC'], ovr: 90 },
      { name: 'Cléber', pos: ['ZAG'], ovr: 89 },
      { name: 'Antônio Carlos', pos: ['ZAG'], ovr: 88 },
      { name: 'Velloso', pos: ['GOL'], ovr: 88 },
      { name: 'Flávio Conceição', pos: ['MC'], ovr: 87 },
      { name: 'Mazinho', pos: ['MC', 'LD'], ovr: 86 },
      { name: 'Cláudio', pos: ['LD'], ovr: 85 },
      { name: 'Amaral', pos: ['VOL', 'ME'], ovr: 85 },
      { name: 'Maurílio', pos: ['PD', 'ATA'], ovr: 83 },
      { name: 'Tonhão', pos: ['ZAG'], ovr: 83 },
      { name: 'Sorato', pos: ['ATA'], ovr: 82 },
      { name: 'Wagner', pos: ['LE', 'MC'], ovr: 81 },
      { name: 'Sérgio', pos: ['GOL'], ovr: 80 },
      { name: 'Macula', pos: ['MC'], ovr: 79 },
      { name: 'Chiquinho', pos: ['PE', 'MC'], ovr: 78 },
    ]
  },
  {
    id: 'botafogo1995', club: 'Botafogo', year: 1995, label: 'Botafogo 1995', coach: 'Paulo Autuori',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Wagner', pos: ['GOL', 'MC'], ovr: 85 },
      { name: 'Wilson Goiano', pos: ['LD'], ovr: 81 },
      { name: 'Wilson Gottardo', pos: ['ZAG'], ovr: 84 },
      { name: 'Goncalves', pos: ['ZAG'], ovr: 83 },
      { name: 'Andre Silva', pos: ['LE'], ovr: 80 },
      { name: 'Leandro Avila', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Jamir', pos: ['VOL', 'MEI'], ovr: 82 },
      { name: 'Beto', pos: ['MEI', 'VOL'], ovr: 81 },
      { name: 'Sergio Manoel', pos: ['MEI', 'PD'], ovr: 84 },
      { name: 'Donizete', pos: ['ATA'], ovr: 85 },
      { name: 'Tulio Maravilha', pos: ['ATA'], ovr: 93 },
      { name: 'Moises', pos: ['LE'], ovr: 76 },
      { name: 'Iranildo', pos: ['MEI', 'MC'], ovr: 79 },
      { name: 'Marcelo Alves', pos: ['MEI', 'MC'], ovr: 76 },
      { name: 'Narcizio', pos: ['ATA'], ovr: 75 },
      { name: 'Rui', pos: ['ATA'], ovr: 75 },
      { name: 'Marcio', pos: ['LD', 'MC'], ovr: 75 },
      { name: 'Claudinho', pos: ['ZAG'], ovr: 74 },
      { name: 'Jorginho', pos: ['MEI', 'MC'], ovr: 75 },
      { name: 'Alan', pos: ['PE', 'ME'], ovr: 74 },
    ]
  },
  {
    id: 'gremio1995', club: 'Gremio', year: 1995, label: 'Gremio 1995 (Libertadores)', coach: 'Luiz Felipe Scolari',
    colors: { p: '#0D80BF', s: '#000000' },
    players: [
      { name: 'Danrlei', pos: ['GOL'], ovr: 87 },
      { name: 'Arce', pos: ['LD', 'MD'], ovr: 86 },
      { name: 'Adilson Batista', pos: ['ZAG'], ovr: 85 },
      { name: 'Rivarola', pos: ['ZAG'], ovr: 83 },
      { name: 'Roger', pos: ['LE', 'LD'], ovr: 83 },
      { name: 'Dinho', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Goiano', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Arilson', pos: ['MEI', 'MC'], ovr: 86 },
      { name: 'Jardel', pos: ['ATA'], ovr: 91 },
      { name: 'Paulo Nunes', pos: ['ATA', 'PD'], ovr: 86 },
      { name: 'Carlos Miguel', pos: ['MEI', 'PE'], ovr: 82 },
      { name: 'Emerson', pos: ['VOL', 'MC'], ovr: 80 },
      { name: 'Luciano', pos: ['ZAG'], ovr: 78 },
      { name: 'Marcos Adriano', pos: ['LD'], ovr: 77 },
      { name: 'Rodrigo Fabri', pos: ['MEI', 'MD'], ovr: 80 },
      { name: 'Ricardo Rocha', pos: ['GOL'], ovr: 75 },
      { name: 'Nando', pos: ['ATA'], ovr: 78 },
      { name: 'Marcelo Ramos', pos: ['ATA', 'PE'], ovr: 79 },
      { name: 'Fabio Baiano', pos: ['MEI', 'MD'], ovr: 81 },
      { name: 'Charles', pos: ['VOL'], ovr: 77 },
    ]
  },
  {
    id: 'gremio1996', club: 'Gremio', year: 1996, label: 'Gremio 1996', coach: 'Luiz Felipe Scolari',
    colors: { p: '#1c3f94', s: '#000000' },
    players: [
      { name: 'Danrlei', pos: ['GOL'], ovr: 88 },
      { name: 'Arce', pos: ['LD', 'MD'], ovr: 90 },
      { name: 'Roger Machado', pos: ['LE', 'ZAG'], ovr: 86 },
      { name: 'Adilson Batista', pos: ['ZAG'], ovr: 87 },
      { name: 'Rivarola', pos: ['ZAG'], ovr: 85 },
      { name: 'Dinho', pos: ['VOL'], ovr: 85 },
      { name: 'Goiano', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Emerson', pos: ['MC', 'VOL'], ovr: 84 },
      { name: 'Carlos Miguel', pos: ['MEI', 'ME', 'PE'], ovr: 86 },
      { name: 'Paulo Nunes', pos: ['PD', 'ATA'], ovr: 90 },
      { name: 'Jardel', pos: ['ATA'], ovr: 91 },
      { name: 'Murilo', pos: ['GOL'], ovr: 77 },
      { name: 'Marco Antônio', pos: ['LD'], ovr: 76 },
      { name: 'Cristiano', pos: ['LE'], ovr: 75 },
      { name: 'Mauro Galvão', pos: ['ZAG', 'VOL'], ovr: 89 },
      { name: 'João Antônio', pos: ['VOL', 'MC'], ovr: 81 },
      { name: 'Ailton', pos: ['MEI', 'ATA'], ovr: 82 },
      { name: 'Zinho', pos: ['PE', 'PD'], ovr: 80 },
      { name: 'Zé Alcino', pos: ['ATA'], ovr: 85 },
      { name: 'Rodrigo Gral', pos: ['ATA'], ovr: 77 },
    ]
  },
  {
    id: 'cruzeiro1997', club: 'Cruzeiro', year: 1997, label: 'Cruzeiro 1997 (Libertadores)', coach: 'Levir Culpi',
    colors: { p: '#0033A0', s: '#ffffff' },
    players: [
      { name: 'Dida', pos: ['GOL'], ovr: 89 },
      { name: 'Vitor', pos: ['LD'], ovr: 82 },
      { name: 'Wilson Gottardo', pos: ['ZAG'], ovr: 84 },
      { name: 'Gelson Baresi', pos: ['ZAG'], ovr: 83 },
      { name: 'Nonato', pos: ['LE'], ovr: 82 },
      { name: 'Fabinho', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Ricardinho', pos: ['MC', 'MEI'], ovr: 86 },
      { name: 'Palhinha', pos: ['MEI', 'ATA'], ovr: 85 },
      { name: 'Marcelo Ramos', pos: ['ATA'], ovr: 86 },
      { name: 'Elivelton', pos: ['MEI', 'PD'], ovr: 85 },
      { name: 'Donizete', pos: ['ATA', 'PE'], ovr: 84 },
      { name: 'Cleisson', pos: ['ZAG'], ovr: 78 },
      { name: 'Rodrigo', pos: ['GOL'], ovr: 76 },
      { name: 'Ademir', pos: ['VOL'], ovr: 78 },
      { name: 'Marcelo Djian', pos: ['MC', 'MEI'], ovr: 80 },
      { name: 'Careca', pos: ['ATA'], ovr: 79 },
      { name: 'Luizao', pos: ['ATA'], ovr: 82 },
      { name: 'Marcio Santos', pos: ['ZAG'], ovr: 80 },
      { name: 'Sandro', pos: ['LE', 'LD'], ovr: 76 },
      { name: 'Rodrigo Fabri', pos: ['MEI', 'MD'], ovr: 80 },
    ]
  },
  {
    id: 'vasco1997', club: 'Vasco', year: 1997, label: 'Vasco 1997 (Brasileiro)', coach: 'Antonio Lopes',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Carlos Germano', pos: ['GOL'], ovr: 85 },
      { name: 'Valber', pos: ['LD'], ovr: 81 },
      { name: 'Odvan', pos: ['ZAG'], ovr: 82 },
      { name: 'Mauro Galvao', pos: ['ZAG'], ovr: 84 },
      { name: 'Felipe', pos: ['LE'], ovr: 83 },
      { name: 'Luisinho', pos: ['VOL', 'MEI'], ovr: 82 },
      { name: 'Nasa', pos: ['VOL', 'MEI'], ovr: 81 },
      { name: 'Juninho Pernambucano', pos: ['MEI', 'MD'], ovr: 88 },
      { name: 'Ramon', pos: ['MEI', 'MD'], ovr: 84 },
      { name: 'Edmundo', pos: ['ATA'], ovr: 95 },
      { name: 'Evair', pos: ['PE', 'ME'], ovr: 88 },
      { name: 'Marica', pos: ['LD'], ovr: 76 },
      { name: 'Alex Pinho', pos: ['ZAG'], ovr: 75 },
      { name: 'Pedrinho', pos: ['MEI', 'MC'], ovr: 80 },
      { name: 'Mauricinho', pos: ['MEI', 'MC'], ovr: 75 },
      { name: 'Donizete', pos: ['ATA'], ovr: 82 },
      { name: 'Brener', pos: ['ATA'], ovr: 76 },
      { name: 'Luizao', pos: ['ATA'], ovr: 83 },
      { name: 'Gil', pos: ['ZAG', 'MC'], ovr: 74 },
      { name: 'Sandro', pos: ['MEI', 'MC'], ovr: 73 },
    ]
  },
  {
    id: 'corinthians1998', club: 'Corinthians', year: 1998, label: 'Corinthians 1998 (Bicampeao)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Nei', pos: ['GOL'], ovr: 77 },
      { name: 'Índio', pos: ['LD'], ovr: 80 },
      { name: 'Gamarra', pos: ['ZAG'], ovr: 92 },
      { name: 'Batata', pos: ['ZAG'], ovr: 79 },
      { name: 'Silvinho', pos: ['LE', 'ME'], ovr: 85 },
      { name: 'Vampeta', pos: ['VOL', 'MC', 'LD'], ovr: 88 },
      { name: 'Rincón', pos: ['VOL', 'MC', 'MEI'], ovr: 87 },
      { name: 'Marcelinho Carioca', pos: ['MEI', 'MD', 'PD', 'ATA'], ovr: 91 },
      { name: 'Ricardinho', pos: ['MEI', 'ME', 'MC'], ovr: 88 },
      { name: 'Edílson', pos: ['PE', 'ATA', 'PD', 'MEI'], ovr: 90 },
      { name: 'Mirandinha', pos: ['PD', 'ATA'], ovr: 79 },
      { name: 'Maurício', pos: ['GOL'], ovr: 74 },
      { name: 'Rodrigo', pos: ['LD'], ovr: 75 },
      { name: 'Cris', pos: ['ZAG'], ovr: 74 },
      { name: 'Romeu', pos: ['ZAG'], ovr: 75 },
      { name: 'Amaral', pos: ['VOL'], ovr: 76 },
      { name: 'Gilmar Fubá', pos: ['VOL'], ovr: 76 },
      { name: 'Souza', pos: ['MEI'], ovr: 76 },
      { name: 'Didi', pos: ['ATA'], ovr: 75 },
      { name: 'Dinei', pos: ['ATA'], ovr: 78 },
    ]
  },
  {
    id: 'vasco1998', club: 'Vasco', year: 1998, label: 'Vasco 1998 (Libertadores)', coach: 'Antonio Lopes',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Carlos Germano', pos: ['GOL'], ovr: 91 },
      { name: 'Vágner', pos: ['LD', 'VOL', 'MC'], ovr: 85 },
      { name: 'Mauro Galvão', pos: ['ZAG', 'VOL'], ovr: 92 },
      { name: 'Odvan', pos: ['ZAG'], ovr: 85 },
      { name: 'Felipe', pos: ['LE', 'ME', 'MEI'], ovr: 91 },
      { name: 'Luisinho', pos: ['VOL'], ovr: 85 },
      { name: 'Nasa', pos: ['VOL'], ovr: 84 },
      { name: 'Juninho Pernambucano', pos: ['MC', 'MEI', 'MD'], ovr: 92 },
      { name: 'Pedrinho', pos: ['MEI', 'ME', 'PE'], ovr: 87 },
      { name: 'Donizete', pos: ['PD', 'ATA'], ovr: 89 },
      { name: 'Luizão', pos: ['PE', 'ATA'], ovr: 90 },
      { name: 'Márcio', pos: ['GOL'], ovr: 77 },
      { name: 'Filipe Alvim', pos: ['LD'], ovr: 76 },
      { name: 'Géder', pos: ['ZAG'], ovr: 78 },
      { name: 'Nelson', pos: ['VOL'], ovr: 79 },
      { name: 'Válber', pos: ['MEI', 'MC', 'LD'], ovr: 83 },
      { name: 'Gian', pos: ['MEI'], ovr: 77 },
      { name: 'Mauricinho', pos: ['PE'], ovr: 78 },
      { name: 'Sorato', pos: ['ATA'], ovr: 80 },
      { name: 'Luiz Cláudio', pos: ['ATA'], ovr: 76 },
    ]
  },
  {
    id: 'corinthians1999', club: 'Corinthians', year: 1999, label: 'Corinthians 1999 (Tricampeao)', coach: 'Oswaldo de Oliveira',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Dida', pos: ['GOL'], ovr: 88 },
      { name: 'Indio', pos: ['LD'], ovr: 80 },
      { name: 'Joao Carlos', pos: ['ZAG'], ovr: 79 },
      { name: 'Marcio Costa', pos: ['ZAG'], ovr: 79 },
      { name: 'Kleber', pos: ['LE'], ovr: 79 },
      { name: 'Vampeta', pos: ['VOL', 'MC'], ovr: 89 },
      { name: 'Rincon', pos: ['MEI', 'MC'], ovr: 87 },
      { name: 'Ricardinho', pos: ['MEI', 'MC'], ovr: 88 },
      { name: 'Marcelinho Carioca', pos: ['MEI', 'ME'], ovr: 92 },
      { name: 'Edilson', pos: ['ATA', 'MD'], ovr: 89 },
      { name: 'Luizao', pos: ['ATA'], ovr: 87 },
      { name: 'Dinei', pos: ['ATA'], ovr: 79 },
      { name: 'Marcos Senna', pos: ['VOL', 'MC'], ovr: 81 },
      { name: 'Sylvinho', pos: ['LE', 'PE'], ovr: 86 },
      { name: 'Adilson', pos: ['ZAG'], ovr: 74 },
      { name: 'Gilmar', pos: ['VOL', 'MC'], ovr: 75 },
      { name: 'Edu', pos: ['MEI', 'ME'], ovr: 75 },
      { name: 'Fabinho', pos: ['ZAG', 'MC'], ovr: 73 },
      { name: 'Luis Carlos', pos: ['PD', 'MD'], ovr: 72 },
      { name: 'Anderson', pos: ['ATA'], ovr: 71 },
    ]
  },
  {
    id: 'palmeiras1999', club: 'Palmeiras', year: 1999, label: 'Palmeiras 1999 (Libertadores)', coach: 'Luiz Felipe Scolari',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Marcos', pos: ['GOL'], ovr: 91 },
      { name: 'Arce', pos: ['LD', 'MD'], ovr: 87 },
      { name: 'Junior Baiano', pos: ['ZAG'], ovr: 85 },
      { name: 'Roque Junior', pos: ['ZAG'], ovr: 87 },
      { name: 'Junior', pos: ['LE', 'MC'], ovr: 85 },
      { name: 'Cesar Sampaio', pos: ['VOL', 'ZAG'], ovr: 87 },
      { name: 'Rogerio', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Zinho', pos: ['ME', 'MEI'], ovr: 86 },
      { name: 'Oseas', pos: ['ATA'], ovr: 84 },
      { name: 'Alex', pos: ['MEI', 'ATA'], ovr: 89 },
      { name: 'Paulo Nunes', pos: ['ATA', 'PD'], ovr: 85 },
      { name: 'Euller', pos: ['PE', 'ATA'], ovr: 83 },
      { name: 'Evair', pos: ['ATA'], ovr: 82 },
      { name: 'Galeano', pos: ['ATA', 'PD'], ovr: 80 },
      { name: 'Sergio', pos: ['GOL'], ovr: 76 },
      { name: 'Cleber', pos: ['ZAG'], ovr: 80 },
      { name: 'Fabio Junior', pos: ['ATA', 'PE'], ovr: 79 },
      { name: 'Marcinho', pos: ['LE', 'LD'], ovr: 78 },
      { name: 'Pedrinho', pos: ['MEI', 'MD'], ovr: 80 },
      { name: 'Alceu', pos: ['VOL'], ovr: 77 },
    ]
  },
  {
    id: 'corinthians2000', club: 'Corinthians', year: 2000, label: 'Corinthians 2000 (Mundial FIFA)', coach: 'Oswaldo de Oliveira',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Dida', pos: ['GOL'], ovr: 89 },
      { name: 'Indio', pos: ['LD', 'ZAG'], ovr: 82 },
      { name: 'Fabio Luciano', pos: ['ZAG'], ovr: 85 },
      { name: 'Joao Carlos', pos: ['ZAG'], ovr: 83 },
      { name: 'Kleber', pos: ['LE'], ovr: 84 },
      { name: 'Vampeta', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Freddy Rincon', pos: ['MC', 'MEI'], ovr: 87 },
      { name: 'Ricardinho', pos: ['MEI', 'MC'], ovr: 87 },
      { name: 'Luizao', pos: ['ATA'], ovr: 88 },
      { name: 'Marcelinho Carioca', pos: ['MEI', 'ME'], ovr: 89 },
      { name: 'Edilson', pos: ['PD', 'ATA'], ovr: 88 },
      { name: 'Fabio Costa', pos: ['GOL'], ovr: 80 },
      { name: 'Gilmar Fubá', pos: ['MC', 'VOL'], ovr: 80 },
      { name: 'Rogerio Correa', pos: ['ZAG'], ovr: 79 },
      { name: 'Adilson', pos: ['LD', 'LE'], ovr: 78 },
      { name: 'Ewerthon', pos: ['ATA', 'PD'], ovr: 81 },
      { name: 'Fabio Baiano', pos: ['MEI', 'MD'], ovr: 81 },
      { name: 'Marquinhos', pos: ['ATA'], ovr: 78 },
      { name: 'Silvinho', pos: ['LE', 'ME'], ovr: 80 },
      { name: 'Sylvinho Melo', pos: ['VOL'], ovr: 77 },
    ]
  },
  {
    id: 'vasco2000', club: 'Vasco', year: 2000, label: 'Vasco 2000 (Brasileiro + Mercosul)', coach: 'Oswaldo de Oliveira',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Carlos Germano', pos: ['GOL'], ovr: 85 },
      { name: 'Valber', pos: ['LD'], ovr: 80 },
      { name: 'Anderson Polga', pos: ['ZAG'], ovr: 83 },
      { name: 'Odvan', pos: ['ZAG'], ovr: 81 },
      { name: 'Felipe', pos: ['LE'], ovr: 82 },
      { name: 'Ramon', pos: ['MEI', 'MD'], ovr: 85 },
      { name: 'Juninho Paulista', pos: ['MEI', 'MC'], ovr: 87 },
      { name: 'Pedrinho', pos: ['MEI', 'MC'], ovr: 83 },
      { name: 'Luizao', pos: ['ATA'], ovr: 89 },
      { name: 'Donizete', pos: ['ATA'], ovr: 87 },
      { name: 'Romario', pos: ['ATA'], ovr: 94 },
      { name: 'Sandro', pos: ['GOL', 'MC'], ovr: 74 },
      { name: 'Valdir', pos: ['LD'], ovr: 76 },
      { name: 'Mauro Galvao', pos: ['ZAG'], ovr: 82 },
      { name: 'Everton', pos: ['ATA'], ovr: 76 },
      { name: 'Nasa', pos: ['VOL'], ovr: 80 },
      { name: 'Nilton', pos: ['VOL', 'MC'], ovr: 79 },
      { name: 'Paulo Victor', pos: ['MEI', 'MC'], ovr: 77 },
      { name: 'Alexandre Pires', pos: ['ATA'], ovr: 78 },
      { name: 'Fabio Augusto', pos: ['LD'], ovr: 75 },
    ]
  },
  {
    id: 'athleticopr2001', club: 'Athletico-PR', year: 2001, label: 'Athletico-PR 2001', coach: 'Geninho',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Flávio', pos: ['GOL'], ovr: 82 },
      { name: 'Nem', pos: ['ZAG'], ovr: 84 },
      { name: 'Gustavo', pos: ['ZAG'], ovr: 81 },
      { name: 'Rogério Corrêa', pos: ['ZAG'], ovr: 81 },
      { name: 'Alessandro', pos: ['LD', 'MD'], ovr: 81 },
      { name: 'Fabiano', pos: ['LE', 'ME'], ovr: 80 },
      { name: 'Cocito', pos: ['VOL'], ovr: 82 },
      { name: 'Kléberson', pos: ['VOL', 'MC', 'MD'], ovr: 87 },
      { name: 'Adriano Gabiru', pos: ['MC', 'MEI', 'MD'], ovr: 83 },
      { name: 'Alex Mineiro', pos: ['ATA'], ovr: 88 },
      { name: 'Kléber Pereira', pos: ['ATA'], ovr: 86 },
      { name: 'Luisinho Netto', pos: ['LD', 'MD'], ovr: 76 },
      { name: 'Vicente', pos: ['LE'], ovr: 75 },
      { name: 'Igor', pos: ['ZAG'], ovr: 76 },
      { name: 'Pires', pos: ['VOL'], ovr: 77 },
      { name: 'Souza', pos: ['MEI', 'MC'], ovr: 81 },
      { name: 'Lobatón', pos: ['MEI'], ovr: 74 },
      { name: 'Ilan', pos: ['ATA', 'PD'], ovr: 79 },
      { name: 'Dagoberto', pos: ['ATA', 'PE'], ovr: 72 },
      { name: 'Adauto', pos: ['ATA'], ovr: 74 },
    ]
  },
  {
    id: 'gremio2001', club: 'Gremio', year: 2001, label: 'Gremio 2001 (Copa do Brasil)', coach: 'Tite',
    colors: { p: '#0D80BF', s: '#000000' },
    players: [
      { name: 'Danrlei', pos: ['GOL'], ovr: 84 },
      { name: 'Rodrigo', pos: ['LD'], ovr: 80 },
      { name: 'Anderson Polga', pos: ['ZAG'], ovr: 84 },
      { name: 'Claudio Milar', pos: ['ZAG'], ovr: 80 },
      { name: 'Marcio Careca', pos: ['LE'], ovr: 79 },
      { name: 'Tinga', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Fabio Pinto', pos: ['VOL', 'MC'], ovr: 80 },
      { name: 'Zinho', pos: ['ME', 'MEI'], ovr: 84 },
      { name: 'Christian', pos: ['ATA'], ovr: 81 },
      { name: 'Ronaldinho Gaucho', pos: ['MEI', 'PE'], ovr: 92 },
      { name: 'Rodrigo Fabri', pos: ['MEI', 'MD'], ovr: 83 },
      { name: 'Claudio Pitbull', pos: ['ATA', 'PD'], ovr: 80 },
      { name: 'Fabio', pos: ['GOL'], ovr: 76 },
      { name: 'Gelson', pos: ['ZAG'], ovr: 77 },
      { name: 'Anderson Lima', pos: ['LD', 'LE'], ovr: 79 },
      { name: 'Andrei', pos: ['MC', 'MEI'], ovr: 78 },
      { name: 'Alex Alves', pos: ['ATA'], ovr: 79 },
      { name: 'Rafael Marques', pos: ['ATA', 'PE'], ovr: 78 },
      { name: 'Guilherme', pos: ['MC', 'VOL'], ovr: 77 },
      { name: 'Luizinho Vieira', pos: ['MEI', 'MD'], ovr: 76 },
    ]
  },
  {
    id: 'saocaetano2001', club: 'Sao Caetano', year: 2001, label: 'Sao Caetano 2001 (Vice-campeao Brasileiro)', coach: 'Jair Picerni',
    colors: { p: '#003399', s: '#ffffff' },
    players: [
      { name: 'Silvio Luiz', pos: ['GOL'], ovr: 84 },
      { name: 'Daniel', pos: ['LD'], ovr: 79 },
      { name: 'Dininho', pos: ['ZAG'], ovr: 83 },
      { name: 'Fabio Santos', pos: ['ZAG'], ovr: 80 },
      { name: 'Marcelo Costa', pos: ['LE'], ovr: 79 },
      { name: 'Adaozinho', pos: ['VOL', 'MC'], ovr: 80 },
      { name: 'Maraba', pos: ['VOL', 'MC'], ovr: 79 },
      { name: 'Esquerdinha', pos: ['MEI', 'ME'], ovr: 81 },
      { name: 'Anailson', pos: ['ATA'], ovr: 82 },
      { name: 'Magrao', pos: ['MEI', 'MC'], ovr: 82 },
      { name: 'Warley', pos: ['PD', 'ATA'], ovr: 82 },
      { name: 'Serginho', pos: ['ATA'], ovr: 78 },
      { name: 'Marcos', pos: ['GOL'], ovr: 74 },
      { name: 'Rubens Cardoso', pos: ['ZAG'], ovr: 76 },
      { name: 'Robson', pos: ['MC', 'VOL'], ovr: 76 },
      { name: 'Marcinho', pos: ['LD', 'LE'], ovr: 75 },
      { name: 'Adhemar', pos: ['MEI', 'MD'], ovr: 77 },
      { name: 'Brandao', pos: ['ATA', 'PE'], ovr: 78 },
      { name: 'Capitao', pos: ['ZAG', 'VOL'], ovr: 76 },
      { name: 'Gustavo', pos: ['PE', 'ME'], ovr: 75 },
    ]
  },
  {
    id: 'santos2002', club: 'Santos', year: 2002, label: 'Santos 2002 (Meninos da Vila)', coach: 'Emerson Leao',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Fabio Costa', pos: ['GOL'], ovr: 86 },
      { name: 'Maurinho', pos: ['LD'], ovr: 78 },
      { name: 'Andre Luis', pos: ['ZAG'], ovr: 83 },
      { name: 'Alex', pos: ['ZAG'], ovr: 85 },
      { name: 'Leo', pos: ['LE'], ovr: 83 },
      { name: 'Paulo Almeida', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Renato', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Elano', pos: ['MEI', 'MD'], ovr: 87 },
      { name: 'Diego', pos: ['MEI', 'MC'], ovr: 88 },
      { name: 'Robinho', pos: ['ATA', 'PE', 'ME'], ovr: 92 },
      { name: 'William', pos: ['PE', 'ME'], ovr: 76 },
      { name: 'Julio Cesar', pos: ['GOL'], ovr: 73 },
      { name: 'Wellington', pos: ['MEI', 'MC'], ovr: 72 },
      { name: 'Alexandre', pos: ['ATA'], ovr: 73 },
      { name: 'Robert', pos: ['ATA'], ovr: 82 },
      { name: 'Michel', pos: ['ATA'], ovr: 71 },
      { name: 'Adriano', pos: ['ZAG'], ovr: 73 },
      { name: 'Felipe', pos: ['LD'], ovr: 72 },
      { name: 'Marcos', pos: ['VOL', 'MD'], ovr: 71 },
      { name: 'Junior', pos: ['MEI', 'MC'], ovr: 70 },
    ]
  },
  {
    id: 'cruzeiro2003', club: 'Cruzeiro', year: 2003, label: 'Cruzeiro 2003 (Triplice Coroa)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#1c3f94', s: '#ffffff' },
    players: [
      { name: 'Gomes', pos: ['GOL'], ovr: 86 },
      { name: 'Maurinho', pos: ['LD'], ovr: 84 },
      { name: 'Cris', pos: ['ZAG'], ovr: 85 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 88 },
      { name: 'Leandro', pos: ['LE', 'MC'], ovr: 84 },
      { name: 'Maldonado', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Augusto Recife', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Wendell', pos: ['MEI', 'MC'], ovr: 84 },
      { name: 'Alex', pos: ['MEI', 'MC'], ovr: 96 },
      { name: 'Aristizabal', pos: ['ATA'], ovr: 88 },
      { name: 'Mota', pos: ['ATA'], ovr: 85 },
      { name: 'Maicon', pos: ['LD'], ovr: 82 },
      { name: 'Luisao', pos: ['ZAG'], ovr: 85 },
      { name: 'Felipe Melo', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Zinho', pos: ['MEI', 'MC'], ovr: 79 },
      { name: 'Marcio Nobre', pos: ['ATA'], ovr: 81 },
      { name: 'Deivid', pos: ['ATA'], ovr: 84 },
      { name: 'Alex Alves', pos: ['ATA'], ovr: 80 },
      { name: 'Martinez', pos: ['MEI', 'MC'], ovr: 79 },
      { name: 'Thiago', pos: ['ZAG'], ovr: 81 },
    ]
  },
  {
    id: 'santos2004', club: 'Santos', year: 2004, label: 'Santos 2004 (Bicampeonato + 103 gols)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Mauro', pos: ['GOL'], ovr: 81 },
      { name: 'Alex', pos: ['ZAG'], ovr: 86 },
      { name: 'André Luís', pos: ['ZAG'], ovr: 83 },
      { name: 'Paulo César', pos: ['LD'], ovr: 83 },
      { name: 'Léo', pos: ['LE'], ovr: 87 },
      { name: 'Renato', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Paulo Almeida', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Elano', pos: ['MEI', 'MD'], ovr: 91 },
      { name: 'Ricardinho', pos: ['MEI', 'MC'], ovr: 89 },
      { name: 'Robinho', pos: ['ATA', 'ME'], ovr: 94 },
      { name: 'Deivid', pos: ['ATA'], ovr: 87 },
      { name: 'Doni', pos: ['GOL'], ovr: 77 },
      { name: 'Júlio Sérgio', pos: ['GOL'], ovr: 75 },
      { name: 'Ávalos', pos: ['ZAG'], ovr: 79 },
      { name: 'Flávio', pos: ['LD', 'LE'], ovr: 77 },
      { name: 'Fabinho', pos: ['VOL', 'MC'], ovr: 79 },
      { name: 'Preto Casagrande', pos: ['MEI', 'VOL'], ovr: 79 },
      { name: 'Marcinho', pos: ['MEI', 'ATA'], ovr: 77 },
      { name: 'Basílio', pos: ['ATA'], ovr: 82 },
      { name: 'William', pos: ['ATA', 'ME'], ovr: 76 },
    ]
  },
  {
    id: 'corinthians2005', club: 'Corinthians', year: 2005, label: 'Corinthians 2005', coach: 'Antonio Lopes',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Fábio Costa', pos: ['GOL'], ovr: 88 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 82 },
      { name: 'Betão', pos: ['ZAG', 'LD'], ovr: 82 },
      { name: 'Gustavo Nery', pos: ['LE', 'ME', 'MC'], ovr: 86 },
      { name: 'Coelho', pos: ['LD', 'MD'], ovr: 83 },
      { name: 'Marcelo Mattos', pos: ['VOL'], ovr: 86 },
      { name: 'Wendel', pos: ['VOL', 'LD'], ovr: 78 },
      { name: 'Bruno Octávio', pos: ['VOL'], ovr: 76 },
      { name: 'Carlos Alberto', pos: ['MC', 'MEI', 'PD'], ovr: 87 },
      { name: 'Tevez', pos: ['ATA', 'MEI', 'PE'], ovr: 95 },
      { name: 'Nilmar', pos: ['ATA', 'PD', 'PE'], ovr: 90 },
      { name: 'Tiago Campagnaro', pos: ['GOL'], ovr: 77 },
      { name: 'Edson', pos: ['LD'], ovr: 76 },
      { name: 'Sebá Domínguez', pos: ['ZAG'], ovr: 84 },
      { name: 'Marcus Vinícius', pos: ['ZAG'], ovr: 77 },
      { name: 'Rosinei', pos: ['VOL', 'MC', 'MD'], ovr: 85 },
      { name: 'Roger Flores', pos: ['MEI', 'MC'], ovr: 86 },
      { name: 'Hugo', pos: ['MEI', 'ME'], ovr: 80 },
      { name: 'Jô', pos: ['ATA', 'PE'], ovr: 82 },
      { name: 'Bobô', pos: ['ATA'], ovr: 76 },
    ]
  },
  {
    id: 'saopaulo2005', club: 'Sao Paulo', year: 2005, label: 'Sao Paulo 2005 (Libertadores + Mundial)', coach: 'Paulo Autuori',
    colors: { p: '#C8102E', s: '#ffffff' },
    players: [
      { name: 'Rogerio Ceni', pos: ['GOL'], ovr: 94 },
      { name: 'Cicinho', pos: ['LD', 'MD'], ovr: 87 },
      { name: 'Lugano', pos: ['ZAG'], ovr: 89 },
      { name: 'Fabao', pos: ['ZAG'], ovr: 84 },
      { name: 'Junior', pos: ['LE', 'MC'], ovr: 85 },
      { name: 'Mineiro', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Josue', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Danilo', pos: ['MEI', 'MC'], ovr: 86 },
      { name: 'Amoroso', pos: ['ATA'], ovr: 87 },
      { name: 'Souza', pos: ['MEI', 'PE'], ovr: 85 },
      { name: 'Aloisio', pos: ['ATA', 'PD'], ovr: 85 },
      { name: 'Grafite', pos: ['ATA'], ovr: 84 },
      { name: 'Diego Tardelli', pos: ['ATA', 'PE'], ovr: 82 },
      { name: 'Christian', pos: ['MEI', 'MC'], ovr: 81 },
      { name: 'Bosco', pos: ['GOL'], ovr: 78 },
      { name: 'Edcarlos', pos: ['ZAG'], ovr: 80 },
      { name: 'Flavio Donizete', pos: ['ATA', 'PD'], ovr: 79 },
      { name: 'Renan', pos: ['VOL'], ovr: 79 },
      { name: 'Alex Silva', pos: ['ZAG'], ovr: 80 },
      { name: 'Luizao', pos: ['ATA'], ovr: 81 },
    ]
  },
  {
    id: 'internacional2006', club: 'Internacional', year: 2006, label: 'Internacional 2006 (Libertadores + Mundial)', coach: 'Abel Braga',
    colors: { p: '#D2122E', s: '#ffffff' },
    players: [
      { name: 'Clemer', pos: ['GOL'], ovr: 84 },
      { name: 'Ceara', pos: ['LD', 'MD'], ovr: 82 },
      { name: 'Indio', pos: ['ZAG'], ovr: 85 },
      { name: 'Fabiano Eller', pos: ['ZAG'], ovr: 83 },
      { name: 'Wellington Monteiro', pos: ['LE'], ovr: 81 },
      { name: 'Edinho', pos: ['VOL', 'ZAG'], ovr: 84 },
      { name: 'Tinga', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Alex', pos: ['MEI', 'MC'], ovr: 84 },
      { name: 'Fernandao', pos: ['ATA'], ovr: 88 },
      { name: 'Iarley', pos: ['MEI', 'ATA'], ovr: 85 },
      { name: 'Rafael Sobis', pos: ['ATA', 'PE'], ovr: 85 },
      { name: 'Adriano Gabiru', pos: ['ATA', 'PD'], ovr: 82 },
      { name: 'Michel', pos: ['ZAG'], ovr: 79 },
      { name: 'Perdigao', pos: ['LD', 'LE'], ovr: 78 },
      { name: 'Renan', pos: ['GOL'], ovr: 79 },
      { name: 'Jorge Wagner', pos: ['MEI', 'ME'], ovr: 82 },
      { name: 'Elder Granja', pos: ['ATA', 'PE'], ovr: 79 },
      { name: 'Rubens Cardoso', pos: ['VOL'], ovr: 78 },
      { name: 'Marcio Careca', pos: ['LE'], ovr: 77 },
      { name: 'Luizao', pos: ['ATA'], ovr: 79 },
    ]
  },
  {
    id: 'saopaulo2006', club: 'Sao Paulo', year: 2006, label: 'Sao Paulo 2006', coach: 'Muricy Ramalho',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Rogerio Ceni', pos: ['GOL'], ovr: 96 },
      { name: 'Ilsinho', pos: ['LD', 'PD'], ovr: 83 },
      { name: 'Fabao', pos: ['ZAG'], ovr: 86 },
      { name: 'Miranda', pos: ['ZAG'], ovr: 87 },
      { name: 'Junior', pos: ['LE', 'MC'], ovr: 82 },
      { name: 'Mineiro', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Josue', pos: ['VOL', 'MEI'], ovr: 85 },
      { name: 'Souza', pos: ['MEI', 'MC'], ovr: 83 },
      { name: 'Danilo', pos: ['MEI', 'MC'], ovr: 85 },
      { name: 'Leandro', pos: ['PD', 'MC'], ovr: 82 },
      { name: 'Aloisio', pos: ['ATA'], ovr: 86 },
      { name: 'Lugano', pos: ['ZAG'], ovr: 87 },
      { name: 'Alex Silva', pos: ['ZAG'], ovr: 78 },
      { name: 'Cicinho', pos: ['LD', 'PD'], ovr: 84 },
      { name: 'Thiago Ribeiro', pos: ['MEI', 'MD'], ovr: 80 },
      { name: 'Richarlyson', pos: ['MEI', 'MC'], ovr: 79 },
      { name: 'Lenilson', pos: ['ATA'], ovr: 78 },
      { name: 'Anderson', pos: ['ATA'], ovr: 77 },
      { name: 'Rodrigo', pos: ['LD'], ovr: 76 },
      { name: 'Edcarlos', pos: ['ZAG'], ovr: 81 },
    ]
  },
  {
    id: 'saopaulo2007', club: 'Sao Paulo', year: 2007, label: 'Sao Paulo 2007 (Bicampeonato)', coach: 'Muricy Ramalho',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Rogério Ceni', pos: ['GOL'], ovr: 96 },
      { name: 'Breno', pos: ['ZAG'], ovr: 87 },
      { name: 'Miranda', pos: ['ZAG'], ovr: 89 },
      { name: 'Alex Silva', pos: ['ZAG'], ovr: 79 },
      { name: 'Ilsinho', pos: ['LD', 'MD', 'MC'], ovr: 83 },
      { name: 'Jorge Wagner', pos: ['ME', 'MEI', 'LE'], ovr: 87 },
      { name: 'Josué', pos: ['VOL'], ovr: 86 },
      { name: 'Richarlyson', pos: ['VOL', 'LE', 'ZAG', 'MC'], ovr: 84 },
      { name: 'Hernanes', pos: ['MC', 'VOL', 'MEI'], ovr: 91 },
      { name: 'Aloísio Chulapa', pos: ['ATA'], ovr: 85 },
      { name: 'Borges', pos: ['ATA'], ovr: 84 },
      { name: 'Bosco', pos: ['GOL'], ovr: 79 },
      { name: 'Reasco', pos: ['LD'], ovr: 81 },
      { name: 'Júnior', pos: ['LE', 'ME', 'MC'], ovr: 82 },
      { name: 'Jadilson', pos: ['LE', 'ME'], ovr: 81 },
      { name: 'André Dias', pos: ['ZAG'], ovr: 83 },
      { name: 'Fernando', pos: ['VOL'], ovr: 82 },
      { name: 'Hugo', pos: ['MEI', 'MC', 'ME'], ovr: 80 },
      { name: 'Leandro', pos: ['ATA', 'MD', 'PD'], ovr: 81 },
      { name: 'Dagoberto', pos: ['ATA', 'PE', 'PD'], ovr: 86 },
    ]
  },
  {
    id: 'saopaulo2008', club: 'Sao Paulo', year: 2008, label: 'Sao Paulo 2008 (Tricampeonato)', coach: 'Muricy Ramalho',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Rogerio Ceni', pos: ['GOL'], ovr: 95 },
      { name: 'Ilsinho', pos: ['LD', 'PD'], ovr: 81 },
      { name: 'Fabao', pos: ['ZAG'], ovr: 84 },
      { name: 'Miranda', pos: ['ZAG'], ovr: 89 },
      { name: 'Lugano', pos: ['ZAG'], ovr: 88 },
      { name: 'Junior', pos: ['LE', 'MC'], ovr: 80 },
      { name: 'Mineiro', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Josue', pos: ['VOL', 'MEI'], ovr: 84 },
      { name: 'Danilo', pos: ['MEI', 'MC'], ovr: 84 },
      { name: 'Hernanes', pos: ['MEI', 'MC'], ovr: 92 },
      { name: 'Borges', pos: ['ATA'], ovr: 84 },
      { name: 'Aloisio', pos: ['ATA'], ovr: 83 },
      { name: 'Diego Tardelli', pos: ['ATA'], ovr: 85 },
      { name: 'Grafite', pos: ['ATA'], ovr: 86 },
      { name: 'Alex Silva', pos: ['ZAG'], ovr: 78 },
      { name: 'Eder Luis', pos: ['ATA'], ovr: 78 },
      { name: 'Rafael', pos: ['ZAG'], ovr: 77 },
      { name: 'Jadson', pos: ['MEI', 'MC'], ovr: 81 },
      { name: 'Junior Cesar', pos: ['LE'], ovr: 76 },
      { name: 'Souza', pos: ['MEI', 'MC'], ovr: 83 },
    ]
  },
  {
    id: 'corinthians2009', club: 'Corinthians', year: 2009, label: 'Corinthians 2009 (Copa do Brasil)', coach: 'Mano Menezes',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Felipe', pos: ['GOL'], ovr: 82 },
      { name: 'Alessandro', pos: ['LD'], ovr: 82 },
      { name: 'Chicao', pos: ['ZAG'], ovr: 85 },
      { name: 'William', pos: ['ZAG'], ovr: 81 },
      { name: 'Roberto Carlos', pos: ['LE', 'ME'], ovr: 86 },
      { name: 'Cristian', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Elias', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Douglas', pos: ['MEI', 'MC'], ovr: 82 },
      { name: 'Ronaldo', pos: ['ATA'], ovr: 90 },
      { name: 'Jorge Henrique', pos: ['PD', 'ATA'], ovr: 82 },
      { name: 'Dentinho', pos: ['PE', 'ATA'], ovr: 83 },
      { name: 'Danilo', pos: ['MEI', 'MC'], ovr: 83 },
      { name: 'Julio Cesar', pos: ['ZAG'], ovr: 79 },
      { name: 'Andre Santos', pos: ['LE', 'ME'], ovr: 81 },
      { name: 'Bruno Octavio', pos: ['GOL'], ovr: 75 },
      { name: 'Iarley', pos: ['MEI', 'MD'], ovr: 80 },
      { name: 'Tcheco', pos: ['MEI', 'MC'], ovr: 79 },
      { name: 'Ralf', pos: ['VOL'], ovr: 80 },
      { name: 'Morais', pos: ['LD'], ovr: 77 },
      { name: 'Souza', pos: ['ATA'], ovr: 79 },
    ]
  },
  {
    id: 'flamengo2009', club: 'Flamengo', year: 2009, label: 'Flamengo 2009 (Hexacampeonato)', coach: 'Andrade',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Bruno', pos: ['GOL'], ovr: 85 },
      { name: 'Ronaldo Angelim', pos: ['ZAG'], ovr: 85 },
      { name: 'Leo Moura', pos: ['LD', 'PD'], ovr: 89 },
      { name: 'Willians', pos: ['LE'], ovr: 82 },
      { name: 'Wellinton Souza', pos: ['ZAG'], ovr: 81 },
      { name: 'Ze Roberto', pos: ['MD', 'MEI'], ovr: 83 },
      { name: 'Gonzalo Fierro', pos: ['MEI', 'MC'], ovr: 84 },
      { name: 'Petkovic', pos: ['MEI', 'MC'], ovr: 88 },
      { name: 'Rafael Toro', pos: ['MC', 'MEI'], ovr: 81 },
      { name: 'Adriano', pos: ['ATA', 'MEI'], ovr: 91 },
      { name: 'Kleber', pos: ['ATA'], ovr: 86 },
      { name: 'Juan', pos: ['ZAG'], ovr: 87 },
      { name: 'Alvaro', pos: ['LD', 'LE'], ovr: 77 },
      { name: 'Emerson Sheik', pos: ['PD', 'ATA'], ovr: 81 },
      { name: 'Maldonado', pos: ['VOL', 'MC'], ovr: 77 },
      { name: 'Denis Marques', pos: ['ATA'], ovr: 76 },
      { name: 'Everton Silva', pos: ['ZAG'], ovr: 77 },
      { name: 'David Braz', pos: ['ZAG'], ovr: 83 },
      { name: 'Ibson', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Diego', pos: ['GOL'], ovr: 75 },
    ]
  },
  {
    id: 'fluminense2010', club: 'Fluminense', year: 2010, label: 'Fluminense 2010 (Tricampeonato)', coach: 'Muricy Ramalho',
    colors: { p: '#7a1e3c', s: '#006437' },
    players: [
      { name: 'Ricardo Berna', pos: ['GOL'], ovr: 82 },
      { name: 'Mariano', pos: ['LD', 'MD'], ovr: 86 },
      { name: 'Gum', pos: ['ZAG'], ovr: 84 },
      { name: 'Leandro Euzebio', pos: ['ZAG'], ovr: 83 },
      { name: 'Carlinhos', pos: ['LE'], ovr: 82 },
      { name: 'Diguinho', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Deco', pos: ['MC'], ovr: 88 },
      { name: 'Conca', pos: ['MEI', 'MC'], ovr: 91 },
      { name: 'Emerson Sheik', pos: ['ATA', 'ME'], ovr: 82 },
      { name: 'Washington', pos: ['ATA'], ovr: 85 },
      { name: 'Fred', pos: ['ATA'], ovr: 89 },
      { name: 'Fernando Henrique', pos: ['GOL'], ovr: 79 },
      { name: 'Valencia', pos: ['VOL'], ovr: 81 },
      { name: 'Rodrigo Souto', pos: ['VOL', 'MC'], ovr: 80 },
      { name: 'Julio Cesar', pos: ['LE', 'ME'], ovr: 79 },
      { name: 'Thiago Neves', pos: ['MEI', 'ME'], ovr: 79 },
      { name: 'Marquinho', pos: ['ME', 'MC'], ovr: 79 },
      { name: 'Rodrigueiro', pos: ['MEI', 'MC'], ovr: 77 },
      { name: 'Alan', pos: ['ATA', 'ME'], ovr: 77 },
      { name: 'Andre Luis', pos: ['ZAG'], ovr: 76 },
    ]
  },
  {
    id: 'internacional2010', club: 'Internacional', year: 2010, label: 'Internacional 2010 (Libertadores)', coach: 'Celso Roth',
    colors: { p: '#D2122E', s: '#ffffff' },
    players: [
      { name: 'Renan', pos: ['GOL'], ovr: 84 },
      { name: 'Nei', pos: ['LD', 'MD'], ovr: 82 },
      { name: 'Bolivar', pos: ['ZAG'], ovr: 85 },
      { name: 'Indio', pos: ['ZAG'], ovr: 84 },
      { name: 'Kleber', pos: ['LE'], ovr: 81 },
      { name: 'Sandro', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Guinazu', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'D\'Alessandro', pos: ['MEI', 'ME'], ovr: 91 },
      { name: 'Leandro Damiao', pos: ['ATA'], ovr: 86 },
      { name: 'Giuliano', pos: ['MEI', 'ATA'], ovr: 85 },
      { name: 'Alecsandro', pos: ['ATA', 'PD'], ovr: 83 },
      { name: 'Andrezinho', pos: ['MEI', 'MD'], ovr: 82 },
      { name: 'Tinga', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Muriel', pos: ['GOL'], ovr: 79 },
      { name: 'Juan', pos: ['ZAG'], ovr: 80 },
      { name: 'Wilson Matias', pos: ['LD', 'LE'], ovr: 77 },
      { name: 'Taison', pos: ['PE', 'ATA'], ovr: 83 },
      { name: 'Rafael Sobis', pos: ['ATA', 'PE'], ovr: 83 },
      { name: 'Pablo Guinazu Jr', pos: ['VOL'], ovr: 76 },
      { name: 'Elton', pos: ['ATA'], ovr: 78 },
    ]
  },
  {
    id: 'santos2010', club: 'Santos', year: 2010, label: 'Santos 2010 (Copa do Brasil)', coach: 'Dorival Junior',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Rafael', pos: ['GOL'], ovr: 87 },
      { name: 'Danilo', pos: ['LD', 'MC', 'VOL'], ovr: 83 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 85 },
      { name: 'Durval', pos: ['ZAG'], ovr: 86 },
      { name: 'Leo', pos: ['LE'], ovr: 81 },
      { name: 'Adriano', pos: ['VOL', 'MC'], ovr: 79 },
      { name: 'Arouca', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Elano', pos: ['MEI', 'MD'], ovr: 87 },
      { name: 'Paulo Henrique Ganso', pos: ['MEI', 'MC'], ovr: 88 },
      { name: 'Robinho', pos: ['PE', 'ME'], ovr: 89 },
      { name: 'Neymar', pos: ['ATA', 'PE'], ovr: 93 },
      { name: 'Andre', pos: ['ATA'], ovr: 82 },
      { name: 'Ze Eduardo', pos: ['ATA'], ovr: 79 },
      { name: 'Alan Kardec', pos: ['ATA'], ovr: 78 },
      { name: 'Alan Patrick', pos: ['MEI', 'MC'], ovr: 78 },
      { name: 'Alex Sandro', pos: ['LE'], ovr: 81 },
      { name: 'Wesley', pos: ['VOL', 'MC', 'LD', 'MD'], ovr: 82 },
      { name: 'Bruno Rodrigo', pos: ['ZAG'], ovr: 79 },
      { name: 'Felipe', pos: ['GOL'], ovr: 75 },
      { name: 'Para', pos: ['LD'], ovr: 78 },
    ]
  },
  {
    id: 'corinthians2011', club: 'Corinthians', year: 2011, label: 'Corinthians 2011 (Pentacampeonato)', coach: 'Tite',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Júlio César', pos: ['GOL'], ovr: 80 },
      { name: 'Alessandro', pos: ['LD', 'LE'], ovr: 81 },
      { name: 'Chicão', pos: ['ZAG'], ovr: 86 },
      { name: 'Leandro Castán', pos: ['ZAG', 'LE'], ovr: 87 },
      { name: 'Fábio Santos', pos: ['LE'], ovr: 85 },
      { name: 'Ralf', pos: ['VOL'], ovr: 88 },
      { name: 'Paulinho', pos: ['VOL', 'MC'], ovr: 90 },
      { name: 'Alex', pos: ['MC', 'MEI', 'ME'], ovr: 87 },
      { name: 'Danilo', pos: ['MEI', 'MC', 'PE', 'ATA'], ovr: 86 },
      { name: 'Emerson Sheik', pos: ['PE', 'ATA', 'PD'], ovr: 87 },
      { name: 'Liédson', pos: ['ATA'], ovr: 84 },
      { name: 'Danilo Fernandes', pos: ['GOL'], ovr: 76 },
      { name: 'Weldinho', pos: ['LD'], ovr: 76 },
      { name: 'Ramon', pos: ['LE', 'ME'], ovr: 78 },
      { name: 'Wallace', pos: ['ZAG'], ovr: 81 },
      { name: 'Paulo André', pos: ['ZAG'], ovr: 82 },
      { name: 'Edenílson', pos: ['VOL', 'LD', 'MD'], ovr: 79 },
      { name: 'Morais', pos: ['MEI', 'MD'], ovr: 78 },
      { name: 'Jorge Henrique', pos: ['PD', 'PE', 'MD'], ovr: 82 },
      { name: 'Willian Bigode', pos: ['ATA', 'PD', 'PE'], ovr: 78 },
    ]
  },
  {
    id: 'santos2011', club: 'Santos', year: 2011, label: 'Santos 2011 (Libertadores)', coach: 'Adilson Batista',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Rafael Cabral', pos: ['GOL'], ovr: 85 },
      { name: 'Danilo', pos: ['LD', 'VOL', 'MC', 'MD'], ovr: 88 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 87 },
      { name: 'Durval', pos: ['ZAG'], ovr: 81 },
      { name: 'Léo', pos: ['LE', 'ME'], ovr: 85 },
      { name: 'Arouca', pos: ['VOL', 'MC'], ovr: 87 },
      { name: 'Wesley', pos: ['MC', 'LD', 'VOL'], ovr: 81 },
      { name: 'Ganso', pos: ['MEI', 'MC'], ovr: 92 },
      { name: 'Marquinhos', pos: ['MEI', 'MC'], ovr: 81 },
      { name: 'Neymar', pos: ['PE', 'PD', 'MEI', 'ATA'], ovr: 96 },
      { name: 'Zé Eduardo', pos: ['ATA', 'PE', 'PD'], ovr: 83 },
      { name: 'Felipe', pos: ['GOL'], ovr: 80 },
      { name: 'Pará', pos: ['LD', 'LE', 'VOL'], ovr: 83 },
      { name: 'Alex Sandro', pos: ['LE', 'ME'], ovr: 83 },
      { name: 'Bruno Aguiar', pos: ['ZAG'], ovr: 79 },
      { name: 'Roberto Brum', pos: ['VOL'], ovr: 79 },
      { name: 'Rodrigo Mancha', pos: ['VOL'], ovr: 78 },
      { name: 'Madson', pos: ['MEI', 'PD'], ovr: 81 },
      { name: 'Robinho', pos: ['ATA', 'PE', 'PD'], ovr: 90 },
      { name: 'André', pos: ['ATA'], ovr: 86 },
    ]
  },
  {
    id: 'vasco2011', club: 'Vasco', year: 2011, label: 'Vasco 2011 (Copa do Brasil)', coach: 'Ricardo Gomes',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Fernando Prass', pos: ['GOL'], ovr: 86 },
      { name: 'Fagner', pos: ['LD', 'MD'], ovr: 84 },
      { name: 'Dede', pos: ['ZAG'], ovr: 86 },
      { name: 'Anderson Salles', pos: ['ZAG'], ovr: 81 },
      { name: 'Ramon', pos: ['LE'], ovr: 81 },
      { name: 'Fellipe Bastos', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Juninho Pernambucano', pos: ['MC', 'MEI'], ovr: 89 },
      { name: 'Diego Souza', pos: ['MEI', 'ATA'], ovr: 86 },
      { name: 'Alecsandro', pos: ['ATA'], ovr: 84 },
      { name: 'Eder Luis', pos: ['PE', 'ATA'], ovr: 83 },
      { name: 'Bernardo', pos: ['MEI', 'PD'], ovr: 82 },
      { name: 'Elton', pos: ['ATA', 'PD'], ovr: 80 },
      { name: 'Rodolfo', pos: ['ZAG'], ovr: 78 },
      { name: 'Alan Kardec', pos: ['ATA'], ovr: 81 },
      { name: 'Diego Cavalieri', pos: ['GOL'], ovr: 80 },
      { name: 'Nilton', pos: ['VOL', 'MC'], ovr: 79 },
      { name: 'Felipe', pos: ['MC', 'MEI'], ovr: 81 },
      { name: 'Marcio Careca', pos: ['LE'], ovr: 77 },
      { name: 'Jumar', pos: ['LD', 'ZAG'], ovr: 76 },
      { name: 'Souza', pos: ['MEI', 'MD'], ovr: 78 },
    ]
  },
  {
    id: 'corinthians2012', club: 'Corinthians', year: 2012, label: 'Corinthians 2012 (Libertadores + Mundial)', coach: 'Tite',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Cassio', pos: ['GOL'], ovr: 90 },
      { name: 'Alessandro', pos: ['LD'], ovr: 83 },
      { name: 'Chicao', pos: ['ZAG'], ovr: 86 },
      { name: 'Paulo Andre', pos: ['ZAG'], ovr: 85 },
      { name: 'Fabio Santos', pos: ['LE', 'ME'], ovr: 85 },
      { name: 'Ralf', pos: ['VOL'], ovr: 84 },
      { name: 'Paulinho', pos: ['VOL', 'MC'], ovr: 89 },
      { name: 'Douglas', pos: ['MEI', 'MC'], ovr: 83 },
      { name: 'Danilo', pos: ['MEI', 'ME'], ovr: 85 },
      { name: 'Emerson Sheik', pos: ['ATA', 'PE'], ovr: 86 },
      { name: 'Jorge Henrique', pos: ['PD', 'ATA'], ovr: 82 },
      { name: 'Guerrero', pos: ['ATA'], ovr: 87 },
      { name: 'Romarinho', pos: ['ATA', 'PD'], ovr: 80 },
      { name: 'Julio Cesar', pos: ['ZAG'], ovr: 80 },
      { name: 'Danilo Fernandes', pos: ['GOL'], ovr: 79 },
      { name: 'Willian Arana', pos: ['LE'], ovr: 77 },
      { name: 'Alex', pos: ['MEI', 'MC'], ovr: 85 },
      { name: 'Edenilson', pos: ['VOL', 'MD'], ovr: 79 },
      { name: 'Wallace', pos: ['ZAG'], ovr: 77 },
      { name: 'Martinez', pos: ['LD', 'MD'], ovr: 78 },
    ]
  },
  {
    id: 'fluminense2012', club: 'Fluminense', year: 2012, label: 'Fluminense 2012 (Tetracampeonato)', coach: 'Abel Braga',
    colors: { p: '#7a1e3c', s: '#006437' },
    players: [
      { name: 'Diego Cavalieri', pos: ['GOL'], ovr: 84 },
      { name: 'Bruno', pos: ['LD'], ovr: 81 },
      { name: 'Gum', pos: ['ZAG'], ovr: 85 },
      { name: 'Leandro Euzebio', pos: ['ZAG'], ovr: 82 },
      { name: 'Carlinhos', pos: ['LE'], ovr: 82 },
      { name: 'Edinho', pos: ['VOL', 'ME'], ovr: 78 },
      { name: 'Jean', pos: ['VOL', 'MC'], ovr: 79 },
      { name: 'Deco', pos: ['MEI', 'MC'], ovr: 87 },
      { name: 'Thiago Neves', pos: ['MEI', 'ME'], ovr: 88 },
      { name: 'Wellington Nem', pos: ['PD', 'MEI'], ovr: 83 },
      { name: 'Fred', pos: ['ATA'], ovr: 90 },
      { name: 'Rafael Sobis', pos: ['ATA'], ovr: 82 },
      { name: 'Rafael Moura', pos: ['ATA'], ovr: 79 },
      { name: 'Wagner', pos: ['MEI', 'MC'], ovr: 76 },
      { name: 'Lanzini', pos: ['MEI', 'MC'], ovr: 80 },
      { name: 'Michael', pos: ['MEI', 'MD'], ovr: 74 },
      { name: 'Rodrigo Lindoso', pos: ['VOL'], ovr: 78 },
      { name: 'Samuel', pos: ['ATA'], ovr: 73 },
      { name: 'Martinuccio', pos: ['MEI', 'MC'], ovr: 74 },
      { name: 'Anderson', pos: ['ZAG'], ovr: 78 },
    ]
  },
  {
    id: 'atleticomg2013', club: 'Atletico-MG', year: 2013, label: 'Atletico-MG 2013 (Libertadores)', coach: 'Cuca',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Victor', pos: ['GOL'], ovr: 91 },
      { name: 'Marcos Rocha', pos: ['LD', 'MD'], ovr: 85 },
      { name: 'Réver', pos: ['ZAG'], ovr: 87 },
      { name: 'Leonardo Silva', pos: ['ZAG'], ovr: 87 },
      { name: 'Junior Cesar', pos: ['LE'], ovr: 81 },
      { name: 'Richarlyson', pos: ['LE', 'VOL', 'ZAG'], ovr: 81 },
      { name: 'Pierre', pos: ['VOL'], ovr: 84 },
      { name: 'Josué', pos: ['VOL'], ovr: 82 },
      { name: 'Ronaldinho Gaúcho', pos: ['MEI', 'PE', 'ATA'], ovr: 95 },
      { name: 'Diego Tardelli', pos: ['PD', 'ATA', 'PE'], ovr: 89 },
      { name: 'Bernard', pos: ['PE', 'PD', 'MEI'], ovr: 87 },
      { name: 'Giovanni', pos: ['GOL'], ovr: 78 },
      { name: 'Carlos César', pos: ['LD'], ovr: 76 },
      { name: 'Gilberto Silva', pos: ['ZAG', 'VOL'], ovr: 80 },
      { name: 'Rafael Marques', pos: ['ZAG'], ovr: 77 },
      { name: 'Leandro Donizete', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Guilherme', pos: ['MEI', 'ATA'], ovr: 82 },
      { name: 'Leleu', pos: ['MEI'], ovr: 72 },
      { name: 'Luan', pos: ['PD', 'PE'], ovr: 82 },
      { name: 'Jô', pos: ['ATA'], ovr: 88 },
    ]
  },
  {
    id: 'botafogo2013', club: 'Botafogo', year: 2013, label: 'Botafogo 2013 (Era Seedorf)', coach: 'Oswaldo de Oliveira',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Jefferson', pos: ['GOL'], ovr: 88 },
      { name: 'Gabriel', pos: ['LD', 'MD'], ovr: 80 },
      { name: 'Bolivar', pos: ['ZAG'], ovr: 83 },
      { name: 'Doria', pos: ['ZAG'], ovr: 80 },
      { name: 'Julio Cesar', pos: ['LE'], ovr: 79 },
      { name: 'Renato', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Gabriel Silva', pos: ['VOL', 'MC'], ovr: 80 },
      { name: 'Seedorf', pos: ['MEI', 'MC'], ovr: 87 },
      { name: 'Rafael Marques', pos: ['ATA'], ovr: 82 },
      { name: 'Lodeiro', pos: ['MEI', 'PE'], ovr: 85 },
      { name: 'Vitinho', pos: ['PD', 'ATA'], ovr: 84 },
      { name: 'Andrezinho', pos: ['MEI', 'MD'], ovr: 80 },
      { name: 'Emerson Sheik', pos: ['ATA', 'PE'], ovr: 82 },
      { name: 'Renan Fonseca', pos: ['ZAG'], ovr: 77 },
      { name: 'Marcio Ramos', pos: ['GOL'], ovr: 75 },
      { name: 'Airton', pos: ['VOL'], ovr: 78 },
      { name: 'Elias', pos: ['ATA', 'PD'], ovr: 77 },
      { name: 'Lucas Zen', pos: ['LD', 'LE'], ovr: 76 },
      { name: 'Hyuri', pos: ['ATA', 'PE'], ovr: 78 },
      { name: 'Ferreyra', pos: ['ATA'], ovr: 77 },
    ]
  },
  {
    id: 'cruzeiro2013', club: 'Cruzeiro', year: 2013, label: 'Cruzeiro 2013 (Brasileiro)', coach: 'Marcelo Oliveira',
    colors: { p: '#1c3f94', s: '#ffffff' },
    players: [
      { name: 'Fábio', pos: ['GOL'], ovr: 89 },
      { name: 'Ceará', pos: ['LD'], ovr: 82 },
      { name: 'Dedé', pos: ['ZAG'], ovr: 86 },
      { name: 'Bruno Rodrigo', pos: ['ZAG'], ovr: 84 },
      { name: 'Egídio', pos: ['LE', 'ME'], ovr: 82 },
      { name: 'Nilton', pos: ['VOL'], ovr: 85 },
      { name: 'Lucas Silva', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Éverton Ribeiro', pos: ['MEI', 'PD', 'MC'], ovr: 91 },
      { name: 'Ricardo Goulart', pos: ['MEI', 'ATA'], ovr: 87 },
      { name: 'Willian Bigode', pos: ['PE', 'PD', 'ATA'], ovr: 85 },
      { name: 'Borges', pos: ['ATA'], ovr: 85 },
      { name: 'Rafael', pos: ['GOL'], ovr: 79 },
      { name: 'Mayke', pos: ['LD', 'MD'], ovr: 82 },
      { name: 'Leo', pos: ['ZAG', 'LD'], ovr: 80 },
      { name: 'Paulão', pos: ['ZAG'], ovr: 77 },
      { name: 'Henrique', pos: ['VOL'], ovr: 81 },
      { name: 'Leandro Guerreiro', pos: ['VOL', 'ZAG'], ovr: 77 },
      { name: 'Júlio Baptista', pos: ['MEI', 'ATA'], ovr: 81 },
      { name: 'Luan', pos: ['PD', 'PE'], ovr: 79 },
      { name: 'Dagoberto', pos: ['PE', 'ATA'], ovr: 84 },
    ]
  },
  {
    id: 'cruzeiro2014', club: 'Cruzeiro', year: 2014, label: 'Cruzeiro 2014 (Tetracampeonato)', coach: 'Marcelo Oliveira',
    colors: { p: '#1c3f94', s: '#ffffff' },
    players: [
      { name: 'Fábio', pos: ['GOL'], ovr: 87 },
      { name: 'Ceará', pos: ['LD'], ovr: 82 },
      { name: 'Dedé', pos: ['ZAG'], ovr: 90 },
      { name: 'Bruno Rodrigo', pos: ['ZAG'], ovr: 81 },
      { name: 'Egídio', pos: ['LE', 'ME'], ovr: 81 },
      { name: 'Lucas Silva', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Henrique', pos: ['VOL'], ovr: 81 },
      { name: 'Nilton', pos: ['VOL'], ovr: 83 },
      { name: 'Éverton Ribeiro', pos: ['MEI', 'PD', 'MC'], ovr: 90 },
      { name: 'Ricardo Goulart', pos: ['MEI', 'ATA', 'MC'], ovr: 89 },
      { name: 'Marcelo Moreno', pos: ['ATA'], ovr: 85 },
      { name: 'Rafael', pos: ['GOL'], ovr: 75 },
      { name: 'Mayke', pos: ['LD', 'MD'], ovr: 80 },
      { name: 'Samudio', pos: ['LE'], ovr: 73 },
      { name: 'Manoel', pos: ['ZAG'], ovr: 78 },
      { name: 'Leo', pos: ['ZAG', 'LD'], ovr: 80 },
      { name: 'Willian Farias', pos: ['VOL'], ovr: 79 },
      { name: 'Marlone', pos: ['MEI', 'PE'], ovr: 78 },
      { name: 'Marquinhos', pos: ['PD', 'PE'], ovr: 77 },
      { name: 'Willian Bigode', pos: ['PE', 'PD', 'ATA'], ovr: 75 },
    ]
  },
  {
    id: 'corinthians2015', club: 'Corinthians', year: 2015, label: 'Corinthians 2015 (Hexacampeonato)', coach: 'Tite',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Cassio', pos: ['GOL'], ovr: 89 },
      { name: 'Fagner', pos: ['LD'], ovr: 82 },
      { name: 'Gil Baiano', pos: ['ZAG'], ovr: 87 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 84 },
      { name: 'Guilherme Arana', pos: ['LE'], ovr: 83 },
      { name: 'Ralf', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Elias', pos: ['VOL', 'MEI'], ovr: 84 },
      { name: 'Renato Augusto', pos: ['MEI', 'MC'], ovr: 86 },
      { name: 'Jadson', pos: ['MEI', 'MC'], ovr: 88 },
      { name: 'Roberto Firmino', pos: ['ATA', 'MEI'], ovr: 85 },
      { name: 'Malcom', pos: ['PD', 'MD'], ovr: 82 },
      { name: 'Alessandro', pos: ['LD'], ovr: 78 },
      { name: 'Chicao', pos: ['ZAG'], ovr: 82 },
      { name: 'Rodriguinho', pos: ['MEI', 'MC'], ovr: 83 },
      { name: 'Willian Arao', pos: ['VOL', 'MC'], ovr: 80 },
      { name: 'Petros', pos: ['VOL', 'MC'], ovr: 77 },
      { name: 'Lucca', pos: ['ATA'], ovr: 73 },
      { name: 'Luciano', pos: ['ATA'], ovr: 79 },
      { name: 'Danilo Avelar', pos: ['LE'], ovr: 77 },
      { name: 'Uendel', pos: ['LE'], ovr: 78 },
    ]
  },
  {
    id: 'santos2015', club: 'Santos', year: 2015, label: 'Santos 2015 (Paulistao + Vice Copa BR)', coach: 'Dorival Junior',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Vanderlei', pos: ['GOL'], ovr: 88 },
      { name: 'Victor Ferraz', pos: ['LD', 'MD', 'LE'], ovr: 84 },
      { name: 'David Braz', pos: ['ZAG'], ovr: 83 },
      { name: 'Gustavo Henrique', pos: ['ZAG'], ovr: 82 },
      { name: 'Zeca', pos: ['LE', 'LD', 'ME'], ovr: 83 },
      { name: 'Renato', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Thiago Maia', pos: ['VOL'], ovr: 84 },
      { name: 'Lucas Lima', pos: ['MEI', 'MC'], ovr: 91 },
      { name: 'Marquinhos Gabriel', pos: ['MEI', 'PD', 'PE'], ovr: 84 },
      { name: 'Ricardo Oliveira', pos: ['ATA'], ovr: 92 },
      { name: 'Gabigol', pos: ['PD', 'ATA'], ovr: 89 },
      { name: 'Vladimir', pos: ['GOL'], ovr: 81 },
      { name: 'Daniel Guedes', pos: ['LD'], ovr: 77 },
      { name: 'Chiquinho', pos: ['LE', 'ME'], ovr: 77 },
      { name: 'Werley', pos: ['ZAG'], ovr: 79 },
      { name: 'Valencia', pos: ['VOL'], ovr: 78 },
      { name: 'Geuvânio', pos: ['PD', 'PE'], ovr: 83 },
      { name: 'Robinho', pos: ['PE', 'MEI', 'ATA'], ovr: 88 },
      { name: 'Leandro Damião', pos: ['ATA'], ovr: 80 },
      { name: 'Nilson', pos: ['ATA'], ovr: 74 },
    ]
  },
  {
    id: 'gremio2016', club: 'Gremio', year: 2016, label: 'Gremio 2016 (Copa do Brasil)', coach: 'Renato Portaluppi',
    colors: { p: '#0D80BF', s: '#000000' },
    players: [
      { name: 'Marcelo Grohe', pos: ['GOL'], ovr: 86 },
      { name: 'Edilson', pos: ['LD', 'MD'], ovr: 82 },
      { name: 'Pedro Geromel', pos: ['ZAG'], ovr: 86 },
      { name: 'Kannemann', pos: ['ZAG'], ovr: 85 },
      { name: 'Marcelo Oliveira', pos: ['LE'], ovr: 81 },
      { name: 'Maicon', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Ramiro', pos: ['MC', 'MD'], ovr: 83 },
      { name: 'Douglas', pos: ['MEI', 'MC'], ovr: 84 },
      { name: 'Bolanos', pos: ['MEI', 'PD'], ovr: 82 },
      { name: 'Luan', pos: ['ATA', 'MEI'], ovr: 86 },
      { name: 'Pedro Rocha', pos: ['ATA', 'PE'], ovr: 82 },
      { name: 'Everton Cebolinha', pos: ['PE', 'ATA'], ovr: 82 },
      { name: 'Bressan', pos: ['ZAG'], ovr: 79 },
      { name: 'Fernandinho', pos: ['ATA', 'PD'], ovr: 80 },
      { name: 'Tiago', pos: ['GOL'], ovr: 77 },
      { name: 'Wallace Oliveira', pos: ['LD', 'LE'], ovr: 77 },
      { name: 'Miller Bolanos Jr', pos: ['MEI', 'MD'], ovr: 77 },
      { name: 'Henrique Almeida', pos: ['ATA'], ovr: 79 },
      { name: 'Walace', pos: ['VOL', 'MC'], ovr: 81 },
      { name: 'Lincoln', pos: ['ATA', 'PE'], ovr: 77 },
    ]
  },
  {
    id: 'palmeiras2016', club: 'Palmeiras', year: 2016, label: 'Palmeiras 2016', coach: 'Cuca',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Fernando Prass', pos: ['GOL'], ovr: 84 },
      { name: 'Marcos Rocha', pos: ['LD'], ovr: 82 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 83 },
      { name: 'Mina', pos: ['ZAG'], ovr: 84 },
      { name: 'Egidio', pos: ['LE'], ovr: 81 },
      { name: 'Arouca', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Felipe Melo', pos: ['VOL', 'MC'], ovr: 87 },
      { name: 'Thiago Santos', pos: ['VOL', 'MC'], ovr: 79 },
      { name: 'Allione', pos: ['MEI', 'PD'], ovr: 82 },
      { name: 'Dudu', pos: ['PD', 'MD'], ovr: 88 },
      { name: 'Gabriel Jesus', pos: ['ATA'], ovr: 91 },
      { name: 'Cleiton Xavier', pos: ['MEI', 'MC'], ovr: 79 },
      { name: 'Tche Tche', pos: ['MEI', 'VOL'], ovr: 80 },
      { name: 'Rafael Marques', pos: ['ATA'], ovr: 77 },
      { name: 'Willian', pos: ['ATA', 'ME'], ovr: 78 },
      { name: 'Mauricio Ramos', pos: ['ZAG'], ovr: 76 },
      { name: 'Jean', pos: ['LD', 'MC'], ovr: 78 },
      { name: 'Thiago Martins', pos: ['ZAG'], ovr: 79 },
      { name: 'Raphael Veiga', pos: ['MEI', 'MC'], ovr: 80 },
      { name: 'Roger Guedes', pos: ['ATA', 'PE'], ovr: 80 },
    ]
  },
  {
    id: 'corinthians2017', club: 'Corinthians', year: 2017, label: 'Corinthians 2017 (Heptacampeonato)', coach: 'Fabio Carille',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Cássio', pos: ['GOL'], ovr: 90 },
      { name: 'Fagner', pos: ['LD'], ovr: 85 },
      { name: 'Balbuena', pos: ['ZAG'], ovr: 84 },
      { name: 'Pablo', pos: ['ZAG'], ovr: 82 },
      { name: 'Guilherme Arana', pos: ['LE', 'ME'], ovr: 83 },
      { name: 'Gabriel', pos: ['VOL'], ovr: 82 },
      { name: 'Maycon', pos: ['VOL', 'MC', 'LE'], ovr: 85 },
      { name: 'Jadson', pos: ['MEI', 'MD', 'MC'], ovr: 89 },
      { name: 'Ángel Romero', pos: ['PD', 'PE', 'ATA'], ovr: 82 },
      { name: 'Clayson', pos: ['PE', 'PD'], ovr: 80 },
      { name: 'Jô', pos: ['ATA'], ovr: 87 },
      { name: 'Walter', pos: ['GOL'], ovr: 75 },
      { name: 'Léo Príncipe', pos: ['LD'], ovr: 76 },
      { name: 'Moisés', pos: ['LE'], ovr: 76 },
      { name: 'Pedro Henrique', pos: ['ZAG'], ovr: 77 },
      { name: 'Camacho', pos: ['VOL', 'MC'], ovr: 74 },
      { name: 'Paulo Roberto', pos: ['VOL', 'LD'], ovr: 76 },
      { name: 'Rodriguinho', pos: ['MC', 'MEI', 'ATA'], ovr: 84 },
      { name: 'Marquinhos Gabriel', pos: ['MEI', 'MD', 'PD'], ovr: 80 },
      { name: 'Pedrinho', pos: ['PE', 'PD', 'MEI'], ovr: 78 },
    ]
  },
  {
    id: 'gremio2017', club: 'Gremio', year: 2017, label: 'Gremio 2017 (Tri da Libertadores)', coach: 'Renato Portaluppi',
    colors: { p: '#0D80BF', s: '#000000' },
    players: [
      { name: 'Marcelo Grohe', pos: ['GOL'], ovr: 88 },
      { name: 'Edilson', pos: ['LD', 'MD'], ovr: 83 },
      { name: 'Pedro Geromel', pos: ['ZAG'], ovr: 88 },
      { name: 'Kannemann', pos: ['ZAG'], ovr: 87 },
      { name: 'Bruno Cortez', pos: ['LE'], ovr: 83 },
      { name: 'Michel', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Arthur', pos: ['MC', 'MEI'], ovr: 87 },
      { name: 'Ramiro', pos: ['MC', 'MD'], ovr: 83 },
      { name: 'Cicero', pos: ['MEI', 'MC'], ovr: 83 },
      { name: 'Luan', pos: ['ATA', 'MEI'], ovr: 89 },
      { name: 'Everton Cebolinha', pos: ['PE', 'ATA'], ovr: 85 },
      { name: 'Fernandinho', pos: ['PD', 'ATA'], ovr: 81 },
      { name: 'Lucas Barrios', pos: ['ATA'], ovr: 82 },
      { name: 'Jael', pos: ['ATA'], ovr: 79 },
      { name: 'Leo Moura', pos: ['LD'], ovr: 80 },
      { name: 'Paulo Victor', pos: ['GOL'], ovr: 79 },
      { name: 'Bressan', pos: ['ZAG'], ovr: 79 },
      { name: 'Jailson', pos: ['VOL'], ovr: 80 },
      { name: 'Pedro Rocha', pos: ['ATA', 'PE'], ovr: 81 },
      { name: 'Marcelo Oliveira', pos: ['LE'], ovr: 79 },
    ]
  },
  {
    id: 'athleticopr2018', club: 'Athletico-PR', year: 2018, label: 'Athletico-PR 2018 (Sul-Americana)', coach: 'Tiago Nunes',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Santos', pos: ['GOL'], ovr: 85 },
      { name: 'Jonathan', pos: ['LD', 'MD'], ovr: 81 },
      { name: 'Thiago Heleno', pos: ['ZAG'], ovr: 83 },
      { name: 'Paulo Andre', pos: ['ZAG'], ovr: 82 },
      { name: 'Renan Lodi', pos: ['LE', 'ME'], ovr: 83 },
      { name: 'Wellington', pos: ['VOL', 'MC'], ovr: 81 },
      { name: 'Bruno Guimaraes', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Lucho Gonzalez', pos: ['MEI', 'MC'], ovr: 85 },
      { name: 'Pablo', pos: ['ATA'], ovr: 85 },
      { name: 'Nikao', pos: ['MEI', 'PE'], ovr: 84 },
      { name: 'Marcelo Cirino', pos: ['ATA', 'PD'], ovr: 82 },
      { name: 'Rony', pos: ['ATA', 'PD'], ovr: 82 },
      { name: 'Leo Pereira', pos: ['ZAG'], ovr: 80 },
      { name: 'Raphael Veiga', pos: ['MEI', 'MC'], ovr: 82 },
      { name: 'Felipe Alves', pos: ['GOL'], ovr: 77 },
      { name: 'Camacho', pos: ['VOL'], ovr: 79 },
      { name: 'Marcinho', pos: ['LD', 'MD'], ovr: 78 },
      { name: 'Guilherme Bissoli', pos: ['ATA'], ovr: 78 },
      { name: 'Zezinho', pos: ['MEI', 'MD'], ovr: 78 },
      { name: 'Bruno Nazario', pos: ['MEI', 'ME'], ovr: 79 },
    ]
  },
  {
    id: 'cruzeiro2018', club: 'Cruzeiro', year: 2018, label: 'Cruzeiro 2018 (Bi da Copa do Brasil)', coach: 'Mano Menezes',
    colors: { p: '#0033A0', s: '#ffffff' },
    players: [
      { name: 'Fabio', pos: ['GOL'], ovr: 89 },
      { name: 'Edilson', pos: ['LD', 'MD'], ovr: 82 },
      { name: 'Dede', pos: ['ZAG'], ovr: 87 },
      { name: 'Leo', pos: ['ZAG'], ovr: 84 },
      { name: 'Egidio', pos: ['LE', 'ME'], ovr: 83 },
      { name: 'Henrique', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Lucas Romero', pos: ['VOL', 'MC'], ovr: 81 },
      { name: 'Thiago Neves', pos: ['MEI', 'ATA'], ovr: 86 },
      { name: 'Barcos', pos: ['ATA'], ovr: 83 },
      { name: 'Arrascaeta', pos: ['MEI', 'PE'], ovr: 88 },
      { name: 'Robinho', pos: ['MEI', 'MD'], ovr: 83 },
      { name: 'Rafinha', pos: ['ATA', 'PD'], ovr: 81 },
      { name: 'Sassa', pos: ['ATA'], ovr: 80 },
      { name: 'Murilo', pos: ['ZAG'], ovr: 79 },
      { name: 'Rafael', pos: ['GOL'], ovr: 78 },
      { name: 'Ariel Cabral', pos: ['VOL'], ovr: 80 },
      { name: 'Raniel', pos: ['ATA'], ovr: 79 },
      { name: 'Marcelo Hermes', pos: ['LE'], ovr: 78 },
      { name: 'David', pos: ['ATA', 'PE'], ovr: 80 },
      { name: 'Lucas Silva', pos: ['MC', 'VOL'], ovr: 81 },
    ]
  },
  {
    id: 'palmeiras2018', club: 'Palmeiras', year: 2018, label: 'Palmeiras 2018 (80 pontos recorde)', coach: 'Luiz Felipe Scolari',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Weverton', pos: ['GOL'], ovr: 89 },
      { name: 'Marcos Rocha', pos: ['LD'], ovr: 84 },
      { name: 'Gustavo Gomez', pos: ['ZAG'], ovr: 88 },
      { name: 'Luan', pos: ['ZAG'], ovr: 83 },
      { name: 'Diogo Barbosa', pos: ['LE'], ovr: 82 },
      { name: 'Felipe Melo', pos: ['VOL', 'MC'], ovr: 88 },
      { name: 'Bruno Henrique', pos: ['VOL', 'ME'], ovr: 84 },
      { name: 'Ze Rafael', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Hyoran', pos: ['MEI', 'MC'], ovr: 80 },
      { name: 'Dudu', pos: ['PD', 'MD'], ovr: 92 },
      { name: 'Borja', pos: ['ATA'], ovr: 81 },
      { name: 'Lucas Lima', pos: ['MEI', 'MC'], ovr: 82 },
      { name: 'Willian', pos: ['ATA', 'ME'], ovr: 82 },
      { name: 'Deyverson', pos: ['ATA'], ovr: 80 },
      { name: 'Moises', pos: ['VOL', 'LE'], ovr: 79 },
      { name: 'Mayke', pos: ['LD'], ovr: 80 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 82 },
      { name: 'Thiago Santos', pos: ['VOL', 'MC'], ovr: 78 },
      { name: 'Rafael Marques', pos: ['ATA'], ovr: 76 },
      { name: 'Raphael Veiga', pos: ['MEI', 'MC'], ovr: 80 },
    ]
  },
  {
    id: 'athleticopr2019', club: 'Athletico-PR', year: 2019, label: 'Athletico-PR 2019 (Copa do Brasil)', coach: 'Tiago Nunes',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Santos', pos: ['GOL'], ovr: 84 },
      { name: 'Marcio Azevedo', pos: ['LD'], ovr: 81 },
      { name: 'Pedro Henrique', pos: ['ZAG'], ovr: 82 },
      { name: 'Thiago Heleno', pos: ['ZAG'], ovr: 84 },
      { name: 'Leo Pereira', pos: ['LE'], ovr: 82 },
      { name: 'Christian', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Matheus Fernandes', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Bruno Guimaraes', pos: ['VOL', 'MC', 'MEI'], ovr: 88 },
      { name: 'Nikao', pos: ['MEI', 'MD'], ovr: 90 },
      { name: 'Rony', pos: ['PD', 'ME'], ovr: 88 },
      { name: 'Marco Ruben', pos: ['ATA'], ovr: 83 },
      { name: 'Jonathan', pos: ['GOL'], ovr: 77 },
      { name: 'Robson Bambu', pos: ['ZAG'], ovr: 81 },
      { name: 'Abner', pos: ['LE'], ovr: 79 },
      { name: 'Lucho Gonzalez', pos: ['MEI', 'MC'], ovr: 85 },
      { name: 'Marcelo Cirino', pos: ['PE', 'ME'], ovr: 83 },
      { name: 'Wellington', pos: ['VOL', 'MC'], ovr: 81 },
      { name: 'Jonathan Rios', pos: ['LD'], ovr: 80 },
      { name: 'Vitinho', pos: ['PD'], ovr: 82 },
      { name: 'Marcinho', pos: ['LD', 'MC'], ovr: 78 },
    ]
  },
  {
    id: 'flamengo2019', club: 'Flamengo', year: 2019, label: 'Flamengo 2019 (Bicampeonato + Libertadores)', coach: 'Jorge Jesus',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Diego Alves', pos: ['GOL'], ovr: 87 },
      { name: 'Rafinha', pos: ['LD'], ovr: 86 },
      { name: 'Rodrigo Caio', pos: ['ZAG'], ovr: 86 },
      { name: 'Pablo Mari', pos: ['ZAG'], ovr: 85 },
      { name: 'Filipe Luis', pos: ['LE'], ovr: 91 },
      { name: 'Willian Arao', pos: ['VOL', 'MC', 'ZAG'], ovr: 88 },
      { name: 'Gerson', pos: ['VOL', 'MC', 'MD', 'MEI'], ovr: 90 },
      { name: 'Everton Ribeiro', pos: ['MEI', 'MD'], ovr: 91 },
      { name: 'Arrascaeta', pos: ['MEI', 'MC'], ovr: 92 },
      { name: 'Bruno Henrique', pos: ['PE', 'ATA', 'ME', 'PD'], ovr: 90 },
      { name: 'Gabigol', pos: ['ATA'], ovr: 97 },
      { name: 'Pedro', pos: ['ATA'], ovr: 88 },
      { name: 'Diego', pos: ['MEI', 'MC'], ovr: 84 },
      { name: 'Cuellar', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Rodinei', pos: ['LD'], ovr: 82 },
      { name: 'Reinier', pos: ['MEI', 'MC', 'ATA'], ovr: 82 },
      { name: 'Michael', pos: ['PE', 'ME', 'ATA'], ovr: 82 },
      { name: 'Thiago Maia', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Lincoln', pos: ['ATA'], ovr: 79 },
      { name: 'Leo Ortiz', pos: ['ZAG'], ovr: 80 },
    ]
  },
  {
    id: 'flamengo2020', club: 'Flamengo', year: 2020, label: 'Flamengo 2020 (Bicampeonato)', coach: 'Rogerio Ceni',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Diego Alves', pos: ['GOL'], ovr: 86 },
      { name: 'Rafinha', pos: ['LD'], ovr: 84 },
      { name: 'Rodrigo Caio', pos: ['ZAG'], ovr: 87 },
      { name: 'Leo Pereira', pos: ['ZAG'], ovr: 84 },
      { name: 'Filipe Luis', pos: ['LE'], ovr: 89 },
      { name: 'Willian Arao', pos: ['VOL', 'MC'], ovr: 88 },
      { name: 'Gerson', pos: ['MEI', 'VOL'], ovr: 90 },
      { name: 'Everton Ribeiro', pos: ['MEI', 'MD'], ovr: 91 },
      { name: 'Arrascaeta', pos: ['MEI', 'MC'], ovr: 91 },
      { name: 'Bruno Henrique', pos: ['PE', 'ME'], ovr: 89 },
      { name: 'Gabigol', pos: ['ATA'], ovr: 96 },
      { name: 'Pedro', pos: ['ATA'], ovr: 90 },
      { name: 'Thiago Maia', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Michael', pos: ['ATA', 'MD'], ovr: 83 },
      { name: 'Rodinei', pos: ['LD'], ovr: 82 },
      { name: 'Diego', pos: ['MEI', 'MC'], ovr: 82 },
      { name: 'Vitinho', pos: ['PD', 'MD'], ovr: 81 },
      { name: 'Hugo Souza', pos: ['GOL'], ovr: 76 },
      { name: 'Rene', pos: ['LE', 'MC'], ovr: 82 },
      { name: 'Leo Ortiz', pos: ['ZAG'], ovr: 80 },
    ]
  },
  {
    id: 'palmeiras2020', club: 'Palmeiras', year: 2020, label: 'Palmeiras 2020 (Libertadores)', coach: 'Abel Ferreira',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Weverton', pos: ['GOL'], ovr: 86 },
      { name: 'Marcos Rocha', pos: ['LD', 'MD'], ovr: 84 },
      { name: 'Gustavo Gomez', pos: ['ZAG'], ovr: 87 },
      { name: 'Luan', pos: ['ZAG'], ovr: 83 },
      { name: 'Vina', pos: ['LE', 'ME'], ovr: 83 },
      { name: 'Felipe Melo', pos: ['VOL', 'ZAG'], ovr: 83 },
      { name: 'Danilo', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Ze Rafael', pos: ['MC', 'MEI'], ovr: 83 },
      { name: 'Luiz Adriano', pos: ['ATA'], ovr: 84 },
      { name: 'Raphael Veiga', pos: ['MEI', 'ME'], ovr: 85 },
      { name: 'Rony', pos: ['ATA', 'PD'], ovr: 84 },
      { name: 'Breno Lopes', pos: ['ATA', 'PD'], ovr: 79 },
      { name: 'Gabriel Menino', pos: ['MC', 'MD'], ovr: 82 },
      { name: 'Patrick de Paula', pos: ['VOL', 'MC'], ovr: 80 },
      { name: 'Jailson', pos: ['GOL'], ovr: 79 },
      { name: 'Empereur', pos: ['ZAG'], ovr: 79 },
      { name: 'Willian', pos: ['ATA', 'PE'], ovr: 80 },
      { name: 'Mayke', pos: ['LD'], ovr: 81 },
      { name: 'Lucas Lima', pos: ['MEI', 'MC'], ovr: 80 },
      { name: 'Wesley', pos: ['ATA', 'PE'], ovr: 79 },
    ]
  },
  {
    id: 'santos2020', club: 'Santos', year: 2020, label: 'Santos 2020 (Vice-Campeao da Libertadores)', coach: 'Cuca',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'John', pos: ['GOL'], ovr: 84 },
      { name: 'Pará', pos: ['LD', 'LE', 'VOL'], ovr: 80 },
      { name: 'Lucas Veríssimo', pos: ['ZAG'], ovr: 88 },
      { name: 'Luan Peres', pos: ['ZAG', 'LE'], ovr: 85 },
      { name: 'Felipe Jonatan', pos: ['LE', 'ME', 'MC'], ovr: 81 },
      { name: 'Alison', pos: ['VOL'], ovr: 82 },
      { name: 'Sandry', pos: ['VOL', 'MC'], ovr: 81 },
      { name: 'Diego Pituca', pos: ['VOL', 'MC', 'LE'], ovr: 86 },
      { name: 'Marinho', pos: ['PD', 'ATA'], ovr: 92 },
      { name: 'Soteldo', pos: ['PE', 'MEI', 'PD'], ovr: 90 },
      { name: 'Kaio Jorge', pos: ['ATA'], ovr: 85 },
      { name: 'João Paulo', pos: ['GOL'], ovr: 83 },
      { name: 'Laércio', pos: ['ZAG'], ovr: 77 },
      { name: 'Madson', pos: ['LD', 'MD'], ovr: 81 },
      { name: 'Luiz Felipe', pos: ['ZAG'], ovr: 79 },
      { name: 'Jobson', pos: ['VOL', 'MC'], ovr: 78 },
      { name: 'Jean Mota', pos: ['MC', 'MEI', 'LE'], ovr: 78 },
      { name: 'Lucas Lourenço', pos: ['MEI'], ovr: 75 },
      { name: 'Arthur Gomes', pos: ['PE', 'PD', 'LE'], ovr: 78 },
      { name: 'Lucas Braga', pos: ['PE', 'PD'], ovr: 83 },
    ]
  },
  {
    id: 'atleticomg2021', club: 'Atletico-MG', year: 2021, label: 'Atletico-MG 2021 (Brasileiro + Copa do Brasil)', coach: 'Cuca',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Everson', pos: ['GOL'], ovr: 88 },
      { name: 'Mariano', pos: ['LD', 'VOL'], ovr: 78 },
      { name: 'Rever', pos: ['ZAG', 'VOL'], ovr: 82 },
      { name: 'Junior Alonso', pos: ['ZAG', 'LE'], ovr: 83 },
      { name: 'Guilherme Arana', pos: ['LE', 'ME'], ovr: 88 },
      { name: 'Allan', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Jair', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Matias Zaracho', pos: ['MC', 'MD'], ovr: 87 },
      { name: 'Nacho Fernandez', pos: ['MEI', 'MC'], ovr: 90 },
      { name: 'Jefferson Savarino', pos: ['PD', 'MD'], ovr: 84 },
      { name: 'Hulk', pos: ['ATA', 'PD'], ovr: 94 },
      { name: 'Guga', pos: ['LD', 'LE'], ovr: 80 },
      { name: 'Dodo', pos: ['LE', 'ME'], ovr: 79 },
      { name: 'Tche Tche', pos: ['VOL', 'MC'], ovr: 78 },
      { name: 'Hyoran', pos: ['MEI', 'ME'], ovr: 79 },
      { name: 'Savio', pos: ['PD', 'PE'], ovr: 76 },
      { name: 'Keno', pos: ['PE', 'PD'], ovr: 85 },
      { name: 'Eduardo Vargas', pos: ['PE', 'ATA'], ovr: 84 },
      { name: 'Diego Costa', pos: ['ATA'], ovr: 77 },
      { name: 'Eduardo Sasha', pos: ['ATA', 'MEI'], ovr: 82 },
    ]
  },
  {
    id: 'palmeiras2021', club: 'Palmeiras', year: 2021, label: 'Palmeiras 2021 (Bi da Libertadores)', coach: 'Abel Ferreira',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Weverton', pos: ['GOL'], ovr: 87 },
      { name: 'Marcos Rocha', pos: ['LD', 'MD'], ovr: 84 },
      { name: 'Gustavo Gomez', pos: ['ZAG'], ovr: 88 },
      { name: 'Luan', pos: ['ZAG'], ovr: 84 },
      { name: 'Piquerez', pos: ['LE', 'ME'], ovr: 85 },
      { name: 'Danilo', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Ze Rafael', pos: ['MC', 'MEI'], ovr: 84 },
      { name: 'Raphael Veiga', pos: ['MEI', 'ME'], ovr: 87 },
      { name: 'Rony', pos: ['ATA', 'PD'], ovr: 85 },
      { name: 'Dudu', pos: ['MEI', 'PE'], ovr: 86 },
      { name: 'Gustavo Scarpa', pos: ['MEI', 'ME'], ovr: 85 },
      { name: 'Deyverson', pos: ['ATA'], ovr: 80 },
      { name: 'Felipe Melo', pos: ['VOL', 'ZAG'], ovr: 82 },
      { name: 'Mayke', pos: ['LD'], ovr: 82 },
      { name: 'Jailson', pos: ['GOL'], ovr: 79 },
      { name: 'Gabriel Menino', pos: ['MC', 'MD'], ovr: 82 },
      { name: 'Renan', pos: ['ZAG'], ovr: 79 },
      { name: 'Wesley', pos: ['ATA', 'PE'], ovr: 80 },
      { name: 'Patrick de Paula', pos: ['VOL', 'MC'], ovr: 80 },
      { name: 'Breno Lopes', pos: ['ATA', 'PD'], ovr: 79 },
    ]
  },
  {
    id: 'athleticopr2022', club: 'Athletico-PR', year: 2022, label: 'Athletico-PR 2022 (Finalista Libertadores)', coach: 'Luiz Felipe Scolari',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Bento', pos: ['GOL'], ovr: 87 },
      { name: 'Orejuela', pos: ['LD'], ovr: 80 },
      { name: 'Pedro Henrique', pos: ['ZAG'], ovr: 83 },
      { name: 'Thiago Heleno', pos: ['ZAG'], ovr: 82 },
      { name: 'Abner', pos: ['LE'], ovr: 83 },
      { name: 'Christian', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Matheus Fernandes', pos: ['VOL', 'MC'], ovr: 83 },
      { name: 'Erick', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Fernandinho', pos: ['VOL', 'MC', 'MEI'], ovr: 90 },
      { name: 'David Terans', pos: ['MEI', 'MC'], ovr: 86 },
      { name: 'Canobbio', pos: ['PD', 'MD'], ovr: 84 },
      { name: 'Romulo', pos: ['ATA'], ovr: 83 },
      { name: 'Pablo', pos: ['ATA'], ovr: 82 },
      { name: 'Vitor Roque', pos: ['ATA'], ovr: 87 },
      { name: 'Vitinho', pos: ['PD'], ovr: 82 },
      { name: 'Ze Ivaldo', pos: ['ZAG'], ovr: 82 },
      { name: 'Anderson', pos: ['GOL'], ovr: 79 },
      { name: 'Matheus Felipe', pos: ['ZAG'], ovr: 81 },
      { name: 'Pedrinho', pos: ['LE', 'MC'], ovr: 81 },
      { name: 'Khellven', pos: ['LD'], ovr: 79 },
    ]
  },
  {
    id: 'flamengo2022', club: 'Flamengo', year: 2022, label: 'Flamengo 2022 (Libertadores + Copa do Brasil)', coach: 'Dorival Junior',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Santos', pos: ['GOL'], ovr: 86 },
      { name: 'Rodinei', pos: ['LD', 'MD'], ovr: 84 },
      { name: 'Fabricio Bruno', pos: ['ZAG'], ovr: 85 },
      { name: 'David Luiz', pos: ['ZAG'], ovr: 87 },
      { name: 'Filipe Luis', pos: ['LE', 'ME'], ovr: 86 },
      { name: 'Thiago Maia', pos: ['VOL', 'MC'], ovr: 84 },
      { name: 'Joao Gomes', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Everton Ribeiro', pos: ['MEI', 'MD'], ovr: 88 },
      { name: 'Pedro', pos: ['ATA'], ovr: 89 },
      { name: 'Arrascaeta', pos: ['MEI', 'PE'], ovr: 92 },
      { name: 'Gabigol', pos: ['ATA', 'PE'], ovr: 90 },
      { name: 'Arturo Vidal', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Everton Cebolinha', pos: ['PE', 'ATA'], ovr: 85 },
      { name: 'Ayrton Lucas', pos: ['LE', 'ME'], ovr: 84 },
      { name: 'Leo Pereira', pos: ['ZAG'], ovr: 83 },
      { name: 'Hugo Souza', pos: ['GOL'], ovr: 80 },
      { name: 'Matheuzinho', pos: ['LD', 'MD'], ovr: 81 },
      { name: 'Vitinho', pos: ['ATA', 'PD'], ovr: 80 },
      { name: 'Marinho', pos: ['ATA', 'PE'], ovr: 82 },
      { name: 'Pablo', pos: ['ZAG'], ovr: 80 },
    ]
  },
  {
    id: 'palmeiras2022', club: 'Palmeiras', year: 2022, label: 'Palmeiras 2022 (81 pontos RECORDE historico)', coach: 'Abel Ferreira',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Weverton', pos: ['GOL'], ovr: 92 },
      { name: 'Marcos Rocha', pos: ['LD'], ovr: 84 },
      { name: 'Gustavo Gomez', pos: ['ZAG'], ovr: 90 },
      { name: 'Murilo', pos: ['ZAG'], ovr: 87 },
      { name: 'Piquerez', pos: ['LE'], ovr: 89 },
      { name: 'Danilo', pos: ['VOL', 'MC'], ovr: 88 },
      { name: 'Ze Rafael', pos: ['VOL', 'MC'], ovr: 86 },
      { name: 'Atuesta', pos: ['VOL', 'MC'], ovr: 81 },
      { name: 'Raphael Veiga', pos: ['MEI', 'MC'], ovr: 90 },
      { name: 'Dudu', pos: ['PD', 'MD'], ovr: 88 },
      { name: 'Flaco Lopez', pos: ['ATA'], ovr: 86 },
      { name: 'Rony', pos: ['PE', 'ME'], ovr: 85 },
      { name: 'Endrick', pos: ['ATA'], ovr: 91 },
      { name: 'Mayke', pos: ['LD'], ovr: 81 },
      { name: 'Gabriel Menino', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Luan', pos: ['ZAG'], ovr: 80 },
      { name: 'Vanderlan', pos: ['LE'], ovr: 78 },
      { name: 'Pedro Geromel', pos: ['ZAG'], ovr: 79 },
      { name: 'Jose Manuel Lopez', pos: ['ATA'], ovr: 75 },
      { name: 'Jhon Jhon', pos: ['MEI', 'MC'], ovr: 79 },
    ]
  },
  {
    id: 'botafogo2023', club: 'Botafogo', year: 2023, label: 'Botafogo 2023 (Deixou escapar)', coach: 'Luis Castro',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Lucas Perri', pos: ['GOL'], ovr: 85 },
      { name: 'Di Plácido', pos: ['LD'], ovr: 81 },
      { name: 'Adryelson', pos: ['ZAG'], ovr: 83 },
      { name: 'Victor Cuesta', pos: ['ZAG'], ovr: 82 },
      { name: 'Marcal', pos: ['LE'], ovr: 80 },
      { name: 'Eduardo', pos: ['MEI', 'VOL'], ovr: 83 },
      { name: 'Marlon Freitas', pos: ['VOL'], ovr: 84 },
      { name: 'Tche Tche', pos: ['MEI', 'VOL'], ovr: 83 },
      { name: 'Gustavo Sauer', pos: ['PD'], ovr: 83 },
      { name: 'Tiquinho Soares', pos: ['ATA'], ovr: 89 },
      { name: 'Jeffinho', pos: ['PE', 'ATA'], ovr: 84 },
      { name: 'Diego Hernandez', pos: ['MEI'], ovr: 80 },
      { name: 'Hugo', pos: ['LE'], ovr: 78 },
      { name: 'Rafael', pos: ['LD'], ovr: 79 },
      { name: 'Kayque', pos: ['VOL'], ovr: 80 },
      { name: 'Júnior Santos', pos: ['PD', 'ATA'], ovr: 83 },
      { name: 'Diego Costa', pos: ['ATA'], ovr: 79 },
      { name: 'Patrick de Paula', pos: ['VOL'], ovr: 82 },
      { name: 'Victor Sa', pos: ['ATA'], ovr: 82 },
      { name: 'Gatito Fernández', pos: ['GOL'], ovr: 82 },
    ]
  },
  {
    id: 'fluminense2023', club: 'Fluminense', year: 2023, label: 'Fluminense 2023 (Libertadores)', coach: 'Fernando Diniz',
    colors: { p: '#7A1921', s: '#006633' },
    players: [
      { name: 'Fabio', pos: ['GOL'], ovr: 89 },
      { name: 'Samuel Xavier', pos: ['LD', 'MD'], ovr: 83 },
      { name: 'Nino', pos: ['ZAG'], ovr: 86 },
      { name: 'Felipe Melo', pos: ['ZAG', 'VOL'], ovr: 83 },
      { name: 'Marcelo', pos: ['LE', 'ME'], ovr: 86 },
      { name: 'Andre', pos: ['VOL', 'MC'], ovr: 87 },
      { name: 'Martinelli', pos: ['MC', 'VOL'], ovr: 82 },
      { name: 'Ganso', pos: ['MEI', 'MC'], ovr: 86 },
      { name: 'Cano', pos: ['ATA'], ovr: 88 },
      { name: 'Jhon Arias', pos: ['MEI', 'PD'], ovr: 88 },
      { name: 'Keno', pos: ['PE', 'ATA'], ovr: 84 },
      { name: 'John Kennedy', pos: ['ATA', 'PE'], ovr: 80 },
      { name: 'Alexsander', pos: ['MC', 'MEI'], ovr: 80 },
      { name: 'Lima', pos: ['MEI', 'MD'], ovr: 81 },
      { name: 'Diogo Barbosa', pos: ['LE'], ovr: 80 },
      { name: 'Vitor Mendes', pos: ['ZAG'], ovr: 79 },
      { name: 'Pedro Rangel', pos: ['GOL'], ovr: 77 },
      { name: 'Guga', pos: ['LD', 'MD'], ovr: 79 },
      { name: 'Yony Gonzalez', pos: ['ATA', 'PE'], ovr: 79 },
      { name: 'Alan', pos: ['MEI', 'PD'], ovr: 78 },
    ]
  },
  {
    id: 'palmeiras2023', club: 'Palmeiras', year: 2023, label: 'Palmeiras 2023 (Tricampeonato com Abel)', coach: 'Abel Ferreira',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Weverton', pos: ['GOL'], ovr: 90 },
      { name: 'Marcos Rocha', pos: ['LD', 'ZAG'], ovr: 83 },
      { name: 'Gustavo Gómez', pos: ['ZAG'], ovr: 91 },
      { name: 'Murilo', pos: ['ZAG'], ovr: 86 },
      { name: 'Joaquín Piquerez', pos: ['LE', 'ME', 'ZAG'], ovr: 88 },
      { name: 'Zé Rafael', pos: ['VOL', 'MC'], ovr: 87 },
      { name: 'Richard Ríos', pos: ['VOL', 'MC'], ovr: 82 },
      { name: 'Gabriel Menino', pos: ['VOL', 'MC', 'LD'], ovr: 82 },
      { name: 'Raphael Veiga', pos: ['MEI', 'MC', 'MD'], ovr: 91 },
      { name: 'Dudu', pos: ['PE', 'PD', 'MEI'], ovr: 88 },
      { name: 'Endrick', pos: ['ATA'], ovr: 90 },
      { name: 'Marcelo Lomba', pos: ['GOL'], ovr: 79 },
      { name: 'Mayke', pos: ['LD', 'MD', 'PD'], ovr: 86 },
      { name: 'Vanderlan', pos: ['LE', 'ME'], ovr: 79 },
      { name: 'Luan', pos: ['ZAG', 'VOL'], ovr: 83 },
      { name: 'Fabinho', pos: ['VOL'], ovr: 76 },
      { name: 'Luis Guilherme', pos: ['MEI', 'PD'], ovr: 77 },
      { name: 'Artur', pos: ['PD', 'PE', 'ATA'], ovr: 84 },
      { name: 'Breno Lopes', pos: ['PE', 'PD'], ovr: 81 },
      { name: 'Rony', pos: ['ATA', 'PD', 'PE'], ovr: 84 },
    ]
  },
  {
    id: 'botafogo2024', club: 'Botafogo', year: 2024, label: 'Botafogo 2024 (Brasileirao + Libertadores)', coach: 'Artur Jorge',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'John', pos: ['GOL'], ovr: 87 },
      { name: 'Vitinho', pos: ['LD'], ovr: 83 },
      { name: 'Alexander Barboza', pos: ['ZAG'], ovr: 86 },
      { name: 'Bastos', pos: ['ZAG'], ovr: 85 },
      { name: 'Cuiabano', pos: ['LE'], ovr: 84 },
      { name: 'Marlon Freitas', pos: ['MC', 'VOL'], ovr: 86 },
      { name: 'Gregore', pos: ['VOL', 'MC'], ovr: 85 },
      { name: 'Thiago Almada', pos: ['MEI', 'ME'], ovr: 89 },
      { name: 'Igor Jesus', pos: ['ATA'], ovr: 91 },
      { name: 'Jefferson Savarino', pos: ['PE', 'ME'], ovr: 85 },
      { name: 'Luiz Henrique', pos: ['PD', 'MD'], ovr: 90 },
      { name: 'Gatito Fernandez', pos: ['GOL'], ovr: 78 },
      { name: 'Adryelson', pos: ['ZAG'], ovr: 80 },
      { name: 'Tiquinho Soares', pos: ['ATA'], ovr: 81 },
      { name: 'Danilo Barbosa', pos: ['VOL', 'MC'], ovr: 80 },
      { name: 'Tche Tche', pos: ['MC', 'VOL'], ovr: 80 },
      { name: 'Marcal', pos: ['LE'], ovr: 78 },
      { name: 'Mateo Ponte', pos: ['LD'], ovr: 79 },
      { name: 'Junior Santos', pos: ['PD', 'ATA'], ovr: 78 },
      { name: 'Carlos Alberto', pos: ['PE', 'MC'], ovr: 76 },
    ]
  },
];














































// ============================================================
// FORMAÇÕES TÁTICAS
// ============================================================
const FORMATIONS = {
  // ==========================================
  // LINHA DE 4 ZAGUEIROS
  // ==========================================

  // --- Variações do 4-3-3 ---
  '4-3-3-ofensivo': {
    label: '4-3-3 Ofensivo (1 VOL, 2 MEI)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MEI: 2, PD: 1, PE: 1, ATA: 1 }
  },
  '4-3-3-misto': {
    label: '4-3-3 Misto (1 VOL, 1 MC, 1 MEI)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 1, MEI: 1, PD: 1, PE: 1, ATA: 1 }
  },
  '4-3-3-defensivo': {
    label: '4-3-3 Contenção (2 VOL, 1 MC)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 2, MC: 1, PD: 1, PE: 1, ATA: 1 }
  },

  // --- Variações do 4-4-2 ---
  '4-4-2-linha': {
    label: '4-4-2 Tradicional em Linha',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 2, MD: 1, ME: 1, ATA: 2 }
  },
  '4-4-2-losango-misto': {
    label: '4-4-2 Losango (1 VOL, 2 MC, 1 MEI)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 2, MEI: 1, ATA: 2 }
  },
  '4-4-2-quadrado': {
    label: '4-2-2-2 (2 VOL, 2 MEI)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 2, MEI: 2, ATA: 2 }
  },

  // --- Variações do 4-2-3-1 ---
  '4-2-3-1-classico': {
    label: '4-2-3-1 Defensivo (2 VOL, 1 MC, 1 MD, 1 ME)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 2, MC: 1, MD: 1, ME: 1, ATA: 1 }
  },
  '4-2-3-1-ofensivo': {
    label: '4-2-3-1 Ofensivo (1 VOL, 1 MC, 1 MEI, 2 PONTA)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 1, MEI: 1, PD: 1, PE: 1, ATA: 1 }
  },

  // --- Variações do 4-1-4-1 e 4-5-1 ---
  '4-1-4-1-ofensivo': {
    label: '4-1-4-1 Ofensivo (1 VOL, 2 MC, 1 MD, 1 ME)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 2, MD: 1, ME: 1, ATA: 1 }
  },
  '4-1-4-1-linha': {
    label: '4-1-4-1 Técnico (1 VOL, 2 MEI, 1 MD, 1 ME)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MD: 1, MEI: 2, ME: 1, ATA: 1 }
  },
  '4-5-1-retranca': {
    label: '4-5-1 Bloqueio (1 VOL, 2 MC, 1 MD, 1 ME)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 2, MD: 1, ME: 1, ATA: 1 }
  },

  // --- Variações do 4-3-1-2 e 4-1-3-2 ---
  '4-3-1-2-misto': {
    label: '4-3-1-2 Italiano (1 VOL, 2 MC, 1 MEI)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 2, MEI: 1, ATA: 2 }
  },
  '4-1-3-2-ofensivo': {
    label: '4-1-3-2 Pressão (1 VOL, 1 MD, 1 MEI, 1 ME)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MD: 1, MEI: 1, ME: 1, ATA: 2 }
  },


  // ==========================================
  // LINHA DE 3 ZAGUEIROS
  // ==========================================

  // --- Variações do 3-5-2 ---
  '3-5-2-equilibrio': {
    label: '3-5-2 (1 VOL, 1 MC, 1 MEI)',
    counts: { GOL: 1, ZAG: 3, MD: 1, VOL: 1, MC: 1, MEI: 1, ME: 1, ATA: 2 }
  },
  '3-5-2-pesado': {
    label: '3-5-2 Pesado (2 VOL, 1 MEI)',
    counts: { GOL: 1, ZAG: 3, MD: 1, VOL: 2, MEI: 1, ME: 1, ATA: 2 }
  },

  // --- Variação do 3-4-3 (sem alas — 3 zagueiros puros, 4 no meio, 3 na frente) ---
  '3-4-3-misto': {
    label: '3-4-3 (1 VOL, 1 MC, 1 MD, 1 ME)',
    counts: { GOL: 1, ZAG: 3, VOL: 1, MC: 1, MD: 1, ME: 1, PD: 1, PE: 1, ATA: 1 }
  },

  // --- Outros esquemas com 3 Zagueiros (sem alas) ---
  '3-4-2-1-moderno': {
    label: '3-4-2-1 (1 VOL, 1 MC, 1 MD, 1 ME, 2 MEI)',
    counts: { GOL: 1, ZAG: 3, VOL: 1, MC: 1, MD: 1, ME: 1, MEI: 2, ATA: 1 }
  },
  '3-2-4-1-ofensivo': {
    label: '3-2-4-1 (1 VOL, 1 MC, 2 MEI)',
    counts: { GOL: 1, ZAG: 3, VOL: 1, MC: 1, MEI: 2, PD: 1, PE: 1, ATA: 1 }
  },


  // ==========================================
  // LINHA DE 5 ZAGUEIROS (RETRANCA)
  // ==========================================

  '5-3-2-muralha': {
    label: '5-3-2 Retranca Total (1 VOL, 2 MC)',
    counts: { GOL: 1, LD: 1, ZAG: 3, LE: 1, VOL: 1, MC: 2, ATA: 2 }
  },
  '5-4-1-misto': {
    label: '5-4-1 Equilibrado (1 VOL, 1 MC, 1 MD, 1 ME)',
    counts: { GOL: 1, LD: 1, ZAG: 3, LE: 1, VOL: 1, MC: 1, MD: 1, ME: 1, ATA: 1 }
  },
  '5-2-3-contra-ataque': {
    label: '5-2-3 Contra-Ataque (1 VOL, 1 MC)',
    counts: { GOL: 1, LD: 1, ZAG: 3, LE: 1, VOL: 1, MC: 1, PD: 1, PE: 1, ATA: 1 }
  }
};


const BASE_COORDS = {
  GOL: { x: 50, y: 92 },
  LD: { x: 86, y: 76 },
  ZAG: { x: 50, y: 80 },
  LE: { x: 14, y: 76 },
  VOL: { x: 50, y: 62 },
  MC: { x: 50, y: 54 },  // Meio-Campo (central midfielder, between VOL and MEI)
  MEI: { x: 50, y: 46 },
  MD: { x: 80, y: 48 },  // Meia Direita (wide midfielder right)
  ME: { x: 20, y: 48 },  // Meia Esquerda (wide midfielder left)
  PD: { x: 82, y: 22 },  // Ponta Direita (right winger, more attacking)
  PE: { x: 18, y: 22 },  // Ponta Esquerda (left winger, more attacking)
  ATA: { x: 50, y: 11 },
};

function buildPitchSlots(formationKey) {
  const { counts } = FORMATIONS[formationKey];

  // VOL e MC, quando os dois têm qty 1, ficam lado a lado na mesma linha (em
  // vez de um atrás do outro) — só a função muda, não a altura no campo.
  // MD/ME sempre entram na linha do MC quando ele existe (formando MD-MC-ME);
  // sem MC, entram na linha do MEI (MD-MEI-ME); sem os dois, ficam com o VOL
  // (formando o "4" plano de um 4-4-2 tradicional, por exemplo).
  const mergeVolMc = counts.VOL === 1 && counts.MC === 1;
  const hasMC = !!counts.MC;
  const hasMEI = !!counts.MEI;
  const hasWide = !!counts.MD || !!counts.ME;
  const wideJoinsMei = !hasMC && hasMEI && hasWide;
  // Sem MC nem MEI, MD/ME entram na linha do VOL (ex: 4-4-2 em linha) — e
  // como MD/ME ficam bem abertos (mesmo x de LD/LE), essa linha precisa de
  // mais distância vertical da zaga, senão os círculos se tocam/cruzam.
  const volJoinsWide = !hasMC && !hasMEI && hasWide;

  // Linhas mais espaçadas verticalmente — os círculos do campo de draft têm
  // 44px, então uma diferença pequena de y (como 54 pra 62) fica quase
  // encostando um no outro. Aqui dá mais respiro entre VOL / MC / MEI.
  const mcRowY = mergeVolMc ? 58 : 52;
  const volRowY = mergeVolMc ? 58 : volJoinsWide ? 52 : 68;
  const meiRowY = 36;
  const wideRowY = hasMC ? mcRowY : hasMEI ? meiRowY : volRowY;

  const ROW_ORDER = { ME: 0, VOL: 1, MC: 2, MEI: 2, MD: 3 };
  const rows = new Map(); // y -> [{ pos, order }]
  const pushToRow = (pos, qty, y, order) => {
    if (!qty) return;
    if (!rows.has(y)) rows.set(y, []);
    const arr = rows.get(y);
    for (let i = 0; i < qty; i++) arr.push({ pos, order });
  };
  pushToRow('VOL', mergeVolMc ? 1 : counts.VOL, volRowY, ROW_ORDER.VOL);
  pushToRow('MC', mergeVolMc ? 1 : counts.MC, mcRowY, ROW_ORDER.MC);
  pushToRow('MD', counts.MD, wideRowY, ROW_ORDER.MD);
  pushToRow('ME', counts.ME, wideRowY, ROW_ORDER.ME);
  if (wideJoinsMei) pushToRow('MEI', counts.MEI, wideRowY, ROW_ORDER.MEI);

  const groupedPos = new Set(['VOL', 'MC', 'MD', 'ME']);
  if (wideJoinsMei) groupedPos.add('MEI');

  const slots = [];
  Object.entries(counts).forEach(([pos, qty]) => {
    if (groupedPos.has(pos)) return; // tratado abaixo via `rows`
    const base = BASE_COORDS[pos];
    // MEI sozinho (sem se juntar à linha do MD/ME) usava o y antigo de
    // BASE_COORDS (46), que fica colado na linha do MC (52) — quase
    // encostando/cruzando visualmente. Usa a linha própria do MEI (36).
    const y = pos === 'MEI' ? meiRowY : base.y;
    for (let i = 0; i < qty; i++) {
      const key = qty === 1 ? pos : `${pos}${i + 1}`;
      let x = base.x;
      if (qty > 1) {
        const spread = qty === 2 ? 16 : qty === 3 ? 22 : 12;
        const offset = (i - (qty - 1) / 2) * (spread * 2 / Math.max(qty - 1, 1));
        x = Math.max(8, Math.min(92, base.x + offset));
      }
      slots.push({ key, label: pos, realPos: pos, x, y });
    }
  });

  const counters = {};
  for (const [y, items] of rows.entries()) {
    items.sort((a, b) => a.order - b.order);
    const n = items.length;
    // Espalha mais largo que o normal (usado pra multiplicar 1 posição só,
    // como 2 ATA) porque aqui são posições DIFERENTES lado a lado — precisa
    // de mais distância pros círculos de 44px não ficarem colados.
    const spread = n <= 1 ? 0 : n === 2 ? 18 : n === 3 ? 26 : 36;
    items.forEach((item, i) => {
      const offset = n <= 1 ? 0 : (i - (n - 1) / 2) * (spread * 2 / Math.max(n - 1, 1));
      const x = Math.max(8, Math.min(92, 50 + offset));
      counters[item.pos] = (counters[item.pos] ?? 0) + 1;
      const key = counts[item.pos] === 1 ? item.pos : `${item.pos}${counters[item.pos]}`;
      slots.push({ key, label: item.pos, realPos: item.pos, x, y });
    });
  }

  // 4-2-2-2: os MEIs ficam mais avançados e abertos, os volantes mais fechados
  // e recuados — não sobrepõem, mas também não ficam achatados numa linha só.
  if (formationKey === '4-4-2-quadrado') {
    slots.forEach(s => {
      if (s.realPos === 'MEI') { s.y = 38; s.x = s.x < 50 ? 28 : 72; }
      if (s.realPos === 'VOL') { s.x = s.x < 50 ? 42 : 58; }
    });
  }

  return slots;
}

// Encaixa os titulares de UMA formação maximizando o overall total — não é
// "primeiro que couber, serve": processa por overall decrescente e, se a
// vaga que o jogador serve já está ocupada por alguém mais fraco, tenta
// REALOCAR esse ocupante pra outra vaga livre que ele também sirva (busca
// em profundidade — o "caminho aumentante" do algoritmo de Kuhn), abrindo
// espaço pro craque de cima. Sem isso, um jogador fraco que "chegou primeiro"
// numa vaga rara (tipo o único MEI livre) travava ali pra sempre, mesmo
// sobrando banco com gente melhor que só não tinha essa tag específica —
// era exatamente o caso do Santos: Geraldino (77) titular numa vaga de MEI
// enquanto Lima (86) e Calvet (84) ficavam de fora, sem o sistema nunca
// tentar a troca. Por processar do maior overall pro menor, o resultado
// final é o conjunto de titulares que maximiza a soma dos overalls — não só
// "alguém que serve" em cada vaga.
function tryAssignStarters(starterSlots, playersByOvrDesc) {
  const slotOwner = new Map(); // slot.key -> { p, i }
  const tryPlace = (candidate, visitedSlots) => {
    for (const slot of starterSlots) {
      if (visitedSlots.has(slot.key) || !candidate.p.pos.includes(slot.realPos)) continue;
      visitedSlots.add(slot.key);
      const occupant = slotOwner.get(slot.key);
      if (!occupant || tryPlace(occupant, visitedSlots)) {
        slotOwner.set(slot.key, candidate);
        return true;
      }
    }
    return false;
  };
  playersByOvrDesc.forEach(candidate => tryPlace(candidate, new Set()));
  if (slotOwner.size !== starterSlots.length) return null; // formação não fecha com esse elenco
  const assign = {};
  const usedPlayers = new Set();
  slotOwner.forEach((candidate, slotKey) => { assign[slotKey] = candidate.p; usedPlayers.add(candidate.i); });
  return { assign, usedPlayers };
}

// Monta um "pitch" completo (11 titulares + 5 banco) a partir do elenco real
// de UM time histórico — usado por "Jogar com este time pronto", o atalho
// que pula o sorteio/draft inteiro. Testa TODAS as formações (não só a
// primeira que fechar) e fica com a que dá o maior overall titular somado —
// sem isso, uma formação que exigisse 2 MEI podia forçar um reserva fraco
// (única opção com a tag certa) pra titular enquanto um meio-campista muito
// melhor, mas só tagueado MC/VOL, ficava de fora por falta de vaga - mesmo
// existindo outra formação onde os dois craques cabiam perfeitamente.
function autoFillSquadFromTeam(team) {
  // Cada elenco tem 20 jogadores (100 times × 20 = os "2.000 jogadores" do
  // catálogo) pro campo de só 16 vagas — o elenco INTEIRO entra como pool
  // (não só os 16 "titulares+banco pretendidos" da ordem original): alguns
  // times só têm o 2º/3º melhor atacante a partir do 17º jogador listado.
  const players = team.players;
  if (!players || players.length < 16) return null;
  const byOvrDesc = players.map((p, i) => ({ p, i })).sort((a, b) => b.p.ovr - a.p.ovr);
  let best = null;
  for (const formationKey of Object.keys(FORMATIONS)) {
    const starterSlots = buildPitchSlots(formationKey);
    const benchSlots = ['bench1', 'bench2', 'bench3', 'bench4', 'bench5'].map((k, i) => ({
      key: k, label: `SUB ${i + 1}`, realPos: 'bench', isBench: true, x: 0, y: 0,
    }));
    const result = tryAssignStarters(starterSlots, byOvrDesc);
    if (!result) continue; // essa formação não fecha com esse elenco de jeito nenhum
    const totalOvr = Object.values(result.assign).reduce((sum, p) => sum + p.ovr, 0);
    if (!best || totalOvr > best.totalOvr) {
      const leftover = players
        .filter((_, i) => !result.usedPlayers.has(i))
        .sort((a, b) => b.ovr - a.ovr)
        .slice(0, 5);
      best = { formationKey, starterSlots, benchSlots, assign: result.assign, leftover, totalOvr };
    }
  }
  if (!best) return null; // não deveria acontecer com os elencos reais do jogo, mas por segurança
  const pitch = {};
  best.starterSlots.forEach(slot => {
    const raw = best.assign[slot.key];
    pitch[slot.key] = {
      ...raw, teamLabel: team.label, teamId: team.id, club: team.club, year: team.year,
      nat: raw.nat || 'BRA', isBench: false, slotKey: slot.key,
    };
  });
  best.benchSlots.forEach((slot, idx) => {
    const raw = best.leftover[idx];
    pitch[slot.key] = {
      ...raw, teamLabel: team.label, teamId: team.id, club: team.club, year: team.year,
      nat: raw.nat || 'BRA', isBench: true, slotKey: slot.key,
    };
  });
  return { formationKey: best.formationKey, pitchSlots: [...best.starterSlots, ...best.benchSlots], pitch };
}

// Fisher-Yates. `rand` é injetável porque o multiplayer precisa embaralhar de
// forma DETERMINÍSTICA (mesma seed em todos os peers → mesmo resultado); com
// Math.random cada cliente geraria uma ordem diferente e o campeonato inteiro
// desincronizaria.
function shuffle2(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Código de sala: 6 caracteres, letras maiúsculas e números sempre mesclados
// (garante pelo menos 1 letra e 1 número, não só um pedaço aleatório de um UUID).
const ROOM_CODE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ROOM_CODE_DIGITS = '0123456789';
function generateRoomCode() {
  const pool = ROOM_CODE_LETTERS + ROOM_CODE_DIGITS;
  let code;
  do {
    code = Array.from({ length: 6 }, () => pool[Math.floor(Math.random() * pool.length)]).join('');
  } while (!/[A-Z]/.test(code) || !/[0-9]/.test(code));
  return code;
}

// ============================================================
// MOTOR DE SIMULAÇÃO
// ============================================================
function teamStrength(xi) {
  const vals = Object.values(xi).filter(p => !p.isBench);
  if (vals.length === 0) return 50;
  const baseOvr = vals.reduce((s, p) => s + p.ovr, 0) / vals.length;
  return Math.round(baseOvr * 10) / 10;
}

// Dificuldade: desloca o OVR de todos os jogadores dos times adversários
// (não mexe no time do usuário) antes de calcular a força de cada time —
// como o ajuste vive nos jogadores, ele sobrevive a recomputações de OVR
// no meio da temporada (troca por lesão/suspensão em teamsForRound).
const DIFFICULTY_LEVELS = {
  facil: { label: 'Fácil', short: 'Fácil', desc: 'IA joga abaixo do seu nível de papel.', aiOvrAdjust: -2 },
  normal: { label: 'Normal', short: 'Normal', desc: 'IA joga com o OVR original dos times sorteados.', aiOvrAdjust: 0 },
  dificil: { label: 'Difícil', short: 'Difícil', desc: 'IA joga acima do seu nível de papel.', aiOvrAdjust: 2 },
  // +3, não +5. Com +5 o Lendário era um muro, não uma dificuldade: a IA
  // ficava com 87,2 de média e o título exigia ~99 de OVR de time, enquanto o
  // MELHOR XI possível da base inteira (vendo os 56 times e escolhendo o
  // ótimo) dá 94 — ou seja, era matematicamente inalcançável pelo draft.
  // Medido no jogo: com OVR 95 deu 0 título em 3 temporadas; só com 99 saíram
  // 2 em 3. Com +3 um draft excelente (92) ganha ~43% das vezes e um draft
  // normal (85) quase nunca (2%) — difícil de verdade, mas possível.
  lendario: { label: 'Lendário', short: 'Lendário', desc: 'IA bem mais forte — precisa de um elenco excepcional.', aiOvrAdjust: 3 },
};
// Cor e peso no ranking de cada nível, num lugar só. O multiplicador estava
// escrito à mão no explicador de pontos; com o selo abaixo mostrando o mesmo
// número em outra tela, dois textos soltos acabariam discordando um dia.
// Precisa bater com DIFFICULTY_WEIGHT em server/routes/me.ts, que é quem de
// fato calcula os pontos.
const DIFFICULTY_UI = {
  facil: { tone: '#7fd99a', mult: '× 0,5' },
  normal: { tone: '#9fb3a8', mult: '× 1' },
  dificil: { tone: '#e8a33d', mult: '× 1,75' },
  lendario: { tone: '#e0593f', mult: '× 3' },
};

// Selo da dificuldade, pra ficar à vista durante a temporada inteira. Não é
// enfeite: a dificuldade multiplica os pontos de ranking da campanha, então
// é ela que diz quanto o título vai valer. Sem isso dava pra jogar 38
// rodadas sem lembrar em que nível a temporada tinha começado.
function DifficultyBadge({ difficulty, style }) {
  const level = DIFFICULTY_LEVELS[difficulty];
  const ui = DIFFICULTY_UI[difficulty];
  if (!level || !ui) return null;
  return (
    <span
      title={`Dificuldade ${level.label} — campanha vale ${ui.mult} no ranking. ${level.desc}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
        fontFamily: "'Space Mono', monospace", fontSize: 10, fontWeight: 700,
        letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 1,
        padding: '4px 8px', borderRadius: 999, whiteSpace: 'nowrap',
        color: ui.tone, background: hexToRgba(ui.tone, 0.12),
        border: `1px solid ${hexToRgba(ui.tone, 0.4)}`,
        ...style,
      }}
    >
      {level.short}
      <span style={{ opacity: 0.65, fontWeight: 400 }}>{ui.mult}</span>
    </span>
  );
}

function applyDifficultyToPlayers(players, difficultyKey) {
  const adjust = DIFFICULTY_LEVELS[difficultyKey]?.aiOvrAdjust || 0;
  if (adjust === 0) return players;
  return players.map(p => ({ ...p, ovr: Math.max(40, Math.min(99, p.ovr + adjust)) }));
}

// Simulação de disputa de pênaltis (5 cobranças + morte súbita)
function simulatePenalties(teamAId, teamBId, leagueTeams, rand = Math.random) {
  const teamA = leagueTeams.find(t => t.id === teamAId);
  const teamB = leagueTeams.find(t => t.id === teamBId);
  const ovA = teamA ? teamA.ovr : 70;
  const ovB = teamB ? teamB.ovr : 70;
  // OVR-based penalty hit rate: 50-85%
  const rateA = Math.min(0.85, Math.max(0.5, 0.65 + (ovA - 70) * 0.005));
  const rateB = Math.min(0.85, Math.max(0.5, 0.65 + (ovB - 70) * 0.005));
  let goalsA = 0, goalsB = 0;
  const kicks = [];
  for (let i = 0; i < 5; i++) {
    const a = rand() < rateA;
    const b = rand() < rateB;
    if (a) goalsA++;
    if (b) goalsB++;
    kicks.push({ a, b, goalsA, goalsB });
    // Encerramento antecipado: um time não alcança mais o outro mesmo
    // acertando tudo que falta (e o outro errando tudo) — ex.: 3x0 depois
    // de 3 cobranças com 2 restantes pra cada, o time de trás no máximo
    // empata 3x3 acertando as duas, nunca ultrapassa. Tinha um +1 sobrando
    // aqui que fazia a disputa continuar uma cobrança além da hora.
    const remaining = 4 - i;
    if (goalsA - goalsB > remaining || goalsB - goalsA > remaining) break;
  }
  // Sudden death if still tied
  let sdGuard = 0;
  while (goalsA === goalsB && sdGuard++ < 50) {
    const a = rand() < rateA;
    const b = rand() < rateB;
    if (a) goalsA++;
    if (b) goalsB++;
    kicks.push({ a, b, goalsA, goalsB, suddenDeath: true });
    if (goalsA !== goalsB) break;
  }
  // Estourou a trava das 50 cobranças ainda empatado (chance astronômica, mas
  // possível): sem desempate declarado, `goalsA > goalsB` dava a vaga sempre
  // ao time B por padrão. Uma cobrança de morte súbita decidida na moeda é
  // menos arbitrária do que premiar sempre o mesmo lado.
  if (goalsA === goalsB) {
    if (rand() < 0.5) goalsA++; else goalsB++;
    kicks.push({ a: goalsA > goalsB, b: goalsB > goalsA, goalsA, goalsB, suddenDeath: true });
  }
  return { winner: goalsA > goalsB ? teamAId : teamBId, goalsA, goalsB, kicks };
}

function poissonSample(lambda, rand = Math.random) {
  let L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

// ============================================================
// LIGA: round-robin + geração de eventos de partida
// ============================================================
const MY_TEAM_ID = '__myteam__';

// Gera calendário round-robin (todos contra todos, turno único)
function generateRoundRobin(teamIds) {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push(null);
  const n = teams.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) {
      const h = teams[i];
      const a = teams[n - 1 - i];
      if (h && a) round.push({ homeId: h, awayId: a });
    }
    rounds.push(round);
    const last = teams.pop();
    teams.splice(1, 0, last);
  }
  return rounds;
}

// Brasileirão: turno + returno (38 rodadas para 20 times)
function generateDoubleRoundRobin(teamIds) {
  const first = generateRoundRobin(teamIds);
  const second = first.map(round => round.map(m => ({ homeId: m.awayId, awayId: m.homeId })));
  return [...first, ...second];
}

// Mesma conta de pontos/saldo usada pra atualizar a tabela do Brasileirão
// (3/1/0, desempate por saldo então gols pró) — extraída aqui pra dar pra
// avançar a tabela da divisão espelho da Série B sem duplicar a lógica de
// pontuação em dois lugares que podiam divergir.
function applyRoundToTable(table, results) {
  const tbl = table.map(r => ({ ...r }));
  results.forEach(res => {
    const h = tbl.find(t => t.id === res.homeId);
    const a = tbl.find(t => t.id === res.awayId);
    if (!h || !a) return;
    h.pj++; a.pj++;
    h.gp += res.homeGoals; h.gc += res.awayGoals;
    a.gp += res.awayGoals; a.gc += res.homeGoals;
    if (res.homeGoals > res.awayGoals) { h.v++; h.pts += 3; a.d++; }
    else if (res.homeGoals < res.awayGoals) { a.v++; a.pts += 3; h.d++; }
    else { h.e++; h.pts++; a.e++; a.pts++; }
  });
  return [...tbl].sort((a, b) => b.pts - a.pts || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp);
}

// Quantos times sobem/descem por temporada na Série A/B — 1º e 2º da Série B
// sobem direto; 3ºx6º e 4ºx5º jogam mata-mata de acesso (ida e volta) pela
// vaga. Isso soma 4 subindo, batendo com os 4 últimos da Série A caindo —
// as duas divisões continuam com 20 times na temporada seguinte.
const RELEGATION_SPOTS = 4;
const DIRECT_PROMOTION_SPOTS = 2;
const PLAYOFF_ZONE = [3, 4, 5, 6]; // posições (1-based) que disputam o mata-mata

// A quem cada posição da zona de playoff enfrenta: 3ºx6º, 4ºx5º.
function playoffOpponentPosition(pos) {
  if (pos === 3) return 6; if (pos === 6) return 3;
  if (pos === 4) return 5; if (pos === 5) return 4;
  return null;
}

// Decide o que acontece no fim da fase regular da Série A/B, a partir da
// tabela final e da divisão atual — sem efeito colateral nenhum, só a
// resposta. Usada tanto pelo avanço rodada a rodada (goNextRound) quanto
// pela simulação direta (fastForwardBrasileirao), que sem isso tinham cada
// uma sua própria lógica de fim de temporada e a segunda nunca soube de
// promoção/rebaixamento.
function resolveDivisionEnd(finalTable, myTeamId, myDivision) {
  const myPos = finalTable.findIndex(t => t.id === myTeamId) + 1;
  if (myDivision === 'A') {
    return { move: myPos > 20 - RELEGATION_SPOTS ? 'relegated' : 'stayed', tie: null };
  }
  if (myPos <= DIRECT_PROMOTION_SPOTS) return { move: 'promoted', tie: null };
  if (PLAYOFF_ZONE.includes(myPos)) {
    const oppPos = playoffOpponentPosition(myPos);
    const opponent = finalTable[oppPos - 1];
    // Quem está melhor colocado joga a volta em casa — mesma vantagem de
    // quem fez a fase regular melhor que a Copa já dá pro melhor cabeça de
    // chave (aqui não tem "cabeça de chave" formal, mas a lógica é a mesma).
    const betterPos = Math.min(myPos, oppPos);
    const leg1Match = betterPos === myPos ? { homeId: opponent.id, awayId: myTeamId } : { homeId: myTeamId, awayId: opponent.id };
    return { move: null, tie: { opponentId: opponent.id, opponentLabel: opponent.label, myPos, oppPos, leg1Match } };
  }
  return { move: 'stayed', tie: null };
}

// Sorteia `count` elencos de IA (com reposição se precisar) e monta os times
// completos, já com dificuldade aplicada — mesma lógica que startSeason e
// newSeason já tinham cada um a sua cópia; extraída aqui porque a Série A/B
// precisa de DUAS levas (uma por divisão) na mesma hora. `idxOffset` evita
// ids repetidos entre as duas levas (sem ele, a leva da Série B reiniciava
// o índice do zero e podia colidir com um id já usado na Série A).
function drawAiTeams(count, difficulty, idxOffset = 0, rand = Math.random) {
  let pool = [];
  while (pool.length < count) pool = [...pool, ...shuffle2([...TEAMS], rand)];
  return pool.slice(0, count).map((t, i) => {
    const idx = idxOffset + i;
    const playersWithMeta = applyDifficultyToPlayers(
      t.players.map(p => ({ ...p, club: t.club, year: t.year, nat: p.nat || 'BRA' })),
      difficulty
    );
    return {
      id: `${t.id}_${idx}`,
      label: t.label,
      club: t.club,
      clubLogo: CLUB_LOGOS[t.club] || null,
      ovr: teamStrength(Object.fromEntries(playersWithMeta.map((p, i2) => [i2, p]))),
      players: playersWithMeta,
    };
  });
}

// Monta o pacote da divisão espelho (só IA, sem o jogador) — sorteia os 20
// times, gera as 38 rodadas e a tabela zerada. Usado pra Série A/B ter as
// "outras 20 vagas" existindo de verdade, mesmo o jogador nunca jogando lá
// diretamente (ela avança sozinha, um round por vez, junto da divisão do
// jogador — ver o novo trecho de goNextRound).
function buildMirrorDivision(difficulty, idxOffset, rand = Math.random) {
  const teams = drawAiTeams(20, difficulty, idxOffset, rand);
  const fixtures = generateDoubleRoundRobin(shuffle2(teams.map(t => t.id), rand));
  const table = teams.map(t => ({ id: t.id, label: t.label, clubLogo: t.clubLogo || null, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }));
  return { teams, fixtures, table, round: 0 };
}

// Avança a divisão espelho em UM round (chamado toda vez que a divisão do
// jogador avança uma rodada, pra ficar em lockstep — ela não fica pra trás
// nem termina antes). `rand` determinístico por partida, mesmo padrão usado
// pros jogos que a IA resolve sozinha no resto da rodada do jogador.
function advanceMirrorDivision(division, seed) {
  if (!division || division.round >= division.fixtures.length) return division;
  const round = division.fixtures[division.round];
  const results = round.map(m => {
    const h = division.teams.find(t => t.id === m.homeId);
    const a = division.teams.find(t => t.id === m.awayId);
    const sim = simAiMatch(h, a, matchPrng(seed, `mirror-${division.round}`, m.homeId, m.awayId));
    return { homeId: m.homeId, awayId: m.awayId, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
  });
  return { ...division, table: applyRoundToTable(division.table, results), round: division.round + 1 };
}

// Sorteia o adversário lendário da Supercopa do Brasil (Desafio do Dia) —
// semeado pela DATA (não por Math.random), então todo mundo que abrir o
// jogo no mesmo dia vê o mesmo confronto, e ele muda sozinho à meia-noite
// (hora local de cada um; sem ranking pra comparar, não precisa ser o mesmo
// instante pra todo mundo).
function getDailyChallengeOpponent() {
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const prng = makePrng(hashSeed(`daily-${dateKey}`));
  const shuffled = [...TEAMS].sort(() => prng() - 0.5);
  return { dateKey, opponent: shuffled[0] };
}

// ── Calendário da temporada ──────────────────────────────────────────────
// Datas das rodadas do Brasileirão: derivadas só do número de rodadas e do
// ano (função pura e determinística), então nada disso precisa ser salvo —
// save antigo continua funcionando e as datas são recalculadas na hora.
// Formato realista: começa no primeiro sábado a partir de 13/04, uma rodada
// por semana, com uma rodada de meio de semana (quarta) a cada 9 — é o que
// faz as 38 rodadas caberem entre abril e dezembro, como no campeonato real.
const SEASON_START_MONTH = 3; // abril (0-based)
const SEASON_START_DAY = 13;
const MIDWEEK_EVERY = 9;

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
// Chave YYYY-MM-DD pra comparar/indexar dias sem esbarrar em fuso horário.
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function buildSeasonCalendar(numRounds, year) {
  const dates = [];
  const d = new Date(year, SEASON_START_MONTH, SEASON_START_DAY);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1); // primeiro sábado
  for (let r = 0; r < numRounds; r++) {
    dates.push(new Date(d));
    if (d.getDay() === 3) d.setDate(d.getDate() + 3);              // quarta → sábado
    else if ((r + 1) % MIDWEEK_EVERY === 0) d.setDate(d.getDate() + 4); // sábado → quarta
    else d.setDate(d.getDate() + 7);                                // sábado → sábado
  }
  return dates;
}
// Índice da rodada que acontece nesse dia (ou -1). Recebe o mapa pronto pra
// não varrer o array de datas a cada célula do calendário.
function roundDateMap(dates) {
  const map = {};
  dates.forEach((d, i) => { map[dateKey(d)] = i; });
  return map;
}
// Grade do mês começando na segunda-feira, com null nas bordas.
function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // seg=0 … dom=6
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

// Copa do Brasil — tabela de eliminatórias
const CUP_ROUND_NAMES = ['16 Avos de Final', 'Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Final'];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const FAST_SIM_ROUND_DELAY_MS = 450;
// Ritmo da animação "dia a dia" do calendário. O dia vazio precisa ser lento
// o bastante pra dar pra VER o tempo passando — com 18ms (valor anterior) os
// ~7 dias entre rodadas sumiam em 126ms e parecia que a simulação pulava de
// jogo em jogo. Como a 1x a temporada inteira leva ~35s, o modal tem um
// seletor de velocidade (1x/2x/4x) que divide esses tempos.
const CALENDAR_EMPTY_DAY_MS = 85;
const CALENDAR_MATCH_DAY_MS = 420;
const CALENDAR_SPEEDS = [1, 2, 4];
// Quanto o resumo da partida fica na tela sozinho no modo automático, antes de
// se fechar e liberar o avanço pra próxima rodada. Longo o bastante pra bater
// o olho nas notas, curto o bastante pra não virar espera.
const MATCH_SUMMARY_AUTO_MS = 4000;
// Quanto o chaveamento fica aberto sozinho no modo automático depois que uma
// fase é decidida. Precisa cobrir a animação dos classificados subindo (~1.2s)
// e ainda sobrar tempo pra ler a chave.
const BRACKET_ADVANCE_AUTO_MS = 4200;

// Texto que aparece durante a "simulação direta" — sem isso a espera fica
// morta na tela; com uma frase que muda a cada rodada dá a sensação de
// acompanhar o campeonato de verdade acontecendo, não só uma barra de espera.
function fastSimStatusText({ gameMode, round, totalRounds, table, myTeamId }) {
  if (gameMode === 'copa') {
    const roundName = CUP_ROUND_NAMES[Math.min(round, CUP_ROUND_NAMES.length - 1)] || 'Copa do Brasil';
    return `Simulando ${roundName}...`;
  }
  const roundNum = round + 1;
  const half = Math.ceil(totalRounds / 2);
  if (roundNum === half) return 'Fim do primeiro turno!';
  if (roundNum === half + 1) return 'Começando o returno...';
  if (roundNum >= totalRounds - 2) return 'Reta final do campeonato...';
  if (table && table.length >= 2) {
    const top2Gap = Math.abs((table[0]?.pts ?? 0) - (table[1]?.pts ?? 0));
    if (top2Gap <= 2 && roundNum > 5) return 'Briga acirrada pela liderança!';
    const myPos = myTeamId ? table.findIndex(t => t.id === myTeamId) : -1;
    if (myPos === 0 && roundNum > 5) return 'Seu time na ponta da tabela!';
    if (myPos >= table.length - 4 && myPos !== -1 && roundNum > 10) return 'Seu time brigando contra o rebaixamento!';
  }
  return `Simulando ${roundNum}ª rodada...`;
}

function generateCupFirstRound(teamIds) {
  const shuffled = shuffle2([...teamIds]);
  const matches = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2)
    matches.push({ homeId: shuffled[i], awayId: shuffled[i + 1] });
  return matches;
}

// Pesos de propensão a marcar por posição — sem isso, um zagueiro tinha a
// mesma chance de artilheiro que o centroavante, e a lista de artilheiros
// saía completamente irreal (gols pulverizados entre o elenco todo).
const SCORE_WEIGHT_BY_POS = {
  ATA: 10, PD: 6, PE: 6, MEI: 4, MD: 3, ME: 3, MC: 2, VOL: 1, LD: 0.6, LE: 0.6, ZAG: 0.3,
};
const ASSIST_WEIGHT_BY_POS = {
  MEI: 10, PD: 6, PE: 6, MC: 5, MD: 4, ME: 4, VOL: 3, LD: 3, LE: 3, ATA: 2, ZAG: 1,
};
// Zagueiros e volantes tomam mais cartão (marcação dura); pontas e atacantes menos.
const CARD_WEIGHT_BY_POS = {
  ZAG: 3, VOL: 3, LD: 2, LE: 2, MC: 1.5, MD: 1, ME: 1, MEI: 1, PD: 0.8, PE: 0.8, ATA: 0.8, GOL: 0.4,
};
// Lesão bate mais em quem corre mais (pontas/atacantes/laterais) que em zagueiros/goleiro.
const INJURY_WEIGHT_BY_POS = {
  ATA: 1.2, PD: 1.15, PE: 1.15, VOL: 1, MC: 1, MEI: 1, MD: 1, ME: 1, LD: 1.05, LE: 1.05, ZAG: 0.85, GOL: 0.3,
};

function weightedPick(players, weightMap, rand) {
  if (!players || players.length === 0) return null;
  const weights = players.map(p => (weightMap[p.pos[0]] ?? 1) * (0.5 + (p.ovr || 70) / 100));
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rand() * total;
  for (let i = 0; i < players.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return players[i];
  }
  return players[players.length - 1];
}

// Times com XI muito reduzido (vários suspensos/lesionados de uma vez e banco
// curto) podem, em teoria, ficar sem nenhum jogador de linha — sem essa rede
// de segurança, weightedPick devolvia null e o `.name` explodia a simulação.
function pickGoalScorer(players, rand = Math.random) {
  const field = players.filter(p => !p.pos.includes('GOL'));
  const pool = field.length > 0 ? field : players;
  return weightedPick(pool, SCORE_WEIGHT_BY_POS, rand)?.name ?? 'Jogador';
}

const OWN_GOAL_CHANCE = 0.045;
const ASSIST_CHANCE = 0.72;

// Pênalti sofrido durante o jogo em si — antes só existia cobrança nas
// disputas de pênalti (fim de jogo empatado na Copa), nunca dentro dos 90
// minutos de uma partida normal. Chance por TIME por jogo + taxa de acerto
// (a mesma taxa base usada nas disputas de shootout, ~65-85% por OVR).
// Média real de futebol: ~1 pênalti a cada 3-4 partidas (~28.6% de chance
// por partida). Os dois times rolam independente, então a chance de sair
// pelo menos um pênalti NA PARTIDA é 1-(1-p)² — não é o mesmo que a chance
// por time (senão a combinada ficaria quase o dobro do pretendido).
const PENALTY_AWARD_CHANCE_PER_TEAM = 0.155; // ~28.6% de chance de pênalti por partida (1 a cada ~3.5 jogos)
function penaltyScoreRate(ovr) { return Math.min(0.85, Math.max(0.5, 0.65 + (ovr - 70) * 0.005)); }

function pickAssister(players, scorerName, rand = Math.random) {
  const pool = players.filter(p => !p.pos.includes('GOL') && p.name !== scorerName);
  if (pool.length === 0) return null;
  return weightedPick(pool, ASSIST_WEIGHT_BY_POS, rand)?.name ?? null;
}

// ── Cartões, expulsões e lesões ─────────────────────────────────────────
const RED_CARD_CHANCE_PER_TEAM = 0.018;   // ~1 expulsão direta a cada ~55 jogos por time
const YELLOWS_PER_MATCH_AVG = 2.2;        // total combinado (Poisson) por partida
const INJURY_CHANCE_PER_TEAM = 0.05;      // ~1 lesao a cada ~20 jogos por time
const YELLOWS_FOR_SUSPENSION = 3;         // 3 amarelos acumulados = 1 jogo de suspensao

// Muitos nomes de jogadores se repetem entre times históricos diferentes
// (ex.: "Danilo" existe em 7 elencos distintos) — cartão/suspensão/lesão
// precisam ser identificados por time+nome, senão um jogador suspenso num
// time "contamina" um homônimo completamente saudável de outro clube.
// Normaliza nome de jogador pra comparação (remove acento, ignora
// maiúsculas/espaços nas pontas) — a base tem o mesmo jogador grafado de
// formas diferentes em cartas de anos/times distintos (ex.: "Rogerio Ceni"
// vs "Rogério Ceni"), e sem normalizar isso o bloqueio de "mesmo jogador em
// duas épocas" falha silenciosamente pra esses casos.
function normalizePlayerName(name) {
  return (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function playerKey(teamId, name) { return `${teamId}::${name}`; }
function splitPlayerKey(key) {
  const sep = key.indexOf('::');
  return { teamId: key.slice(0, sep), name: key.slice(sep + 2) };
}
const RED_SUSPENSION_ROUNDS = 1;
const INJURY_MIN_ROUNDS = 1;
const INJURY_MAX_ROUNDS = 3;

// Chefe do Departamento Médico — narra as lesões com a energia exagerada e
// hiperbólica de um comentarista, sempre no grito, sempre épico até pra uma
// entorse boba.
const MEDICAL_CHIEF_NAME = 'Dr. Trovão';
const MEDICAL_QUOTES = [
  'MEU DEUS DO CÉU, olha o tamanho da pancada, isso aí é osso!!',
  'CALMA, CALMA, o bicho é forte, mas hoje o campo ganhou dele!',
  'SURREAL, gente, já mandei o fisioterapeuta correndo igual bólido!',
  'ISSO NÃO É NORMAL, minha nossa senhora, já chama a maca!',
  'Óooo, doeu só de ver, viu! Time já tá sentindo falta dele lá atrás!',
  'Fica tranquilo, torcida, aqui no departamento médico é OUTRO NÍVEL de cuidado!',
  'GIGANTE o esforço, mas o corpo cobrou a conta, é osso, rapaziada!',
  'Já falei, já avisei: reposição de eletrólito é O SEGREDO, mas hoje não teve jeito!',
];
function medicalQuote(rand = Math.random) {
  return MEDICAL_QUOTES[Math.floor(rand() * MEDICAL_QUOTES.length)];
}

// Titulares de um time = 11 primeiros do array (convenção já usada no resto do
// código: times historicos vêm com titulares antes dos reservas no SQL, e o
// time do próprio usuário já chega aqui só com os 11 titulares).
function getStarters(team) {
  return (team?.players || []).slice(0, 11);
}

// Garante titulares antes de reservas num array de jogadores marcados com
// isBench — necessário porque o elenco do próprio usuário vem de um objeto
// (pitch) cuja ordem de inserção não segue a ordem das posições no campinho.
function partitionStartersFirst(players) {
  return [...players].sort((a, b) => (a?.isBench ? 1 : 0) - (b?.isBench ? 1 : 0));
}

// Troca titulares indisponíveis (suspensos/lesionados) por reservas elegíveis
// (mesma posição primária se possível). Se não houver substituto, o time joga
// com um a menos naquela vaga. Retorna o XI efetivo + um log de trocas pra feed/aviso.
function getEligibleRoster(team, unavailableNames) {
  const all = team?.players || [];
  if (!unavailableNames || unavailableNames.size === 0) return { players: all.slice(0, 11), changes: [], fullRoster: all };
  const isUnavailable = p => unavailableNames.has(playerKey(team.id, p.name));
  const starters = all.slice(0, 11);
  const bench = all.slice(11).filter(p => !isUnavailable(p));
  const changes = [];
  const result = [];
  starters.forEach(p => {
    if (!isUnavailable(p)) { result.push(p); return; }
    const idx = bench.findIndex(b => b.pos?.[0] === p.pos?.[0]);
    const sub = idx !== -1 ? bench.splice(idx, 1)[0] : (bench.length ? bench.splice(0, 1)[0] : null);
    if (sub) { result.push({ ...sub, isBench: false }); changes.push({ out: p.name, in: sub.name }); }
    else changes.push({ out: p.name, in: null });
  });
  // `bench` aqui sobrou só com quem não entrou no XI (splice remove os usados)
  // — junto com o XI ajustado, forma o elenco completo pra essa rodada, pra
  // não perder o banco caso role uma 2a troca (lesão cosmética) na mesma partida.
  return { players: result, changes, fullRoster: [...result, ...bench] };
}

// Monta a visão do elenco pra EXIBIÇÃO (Ver Elenco de qualquer time, aba
// Elenco do próprio time): titulares já com a troca automática de
// suspensos/lesionados aplicada — nunca mostra quem está fora como titular
// — banco restante, e uma lista separada de desfalques com o motivo e, se
// era titular, quem entrou no lugar (ou aviso de que não tinha reserva na
// posição, então o time joga com um a menos). Ambos ordenados por posição
// (GOL → defesa → meio → ataque), não pela ordem de inserção no elenco.
function buildSquadView(team, suspensions, injuries) {
  if (!team) return { starters: [], bench: [], unavailable: [] };
  const all = team.players || [];
  const prefix = `${team.id}::`;
  const suspendedNames = new Set(Object.entries(suspensions || {}).filter(([k, left]) => left > 0 && k.startsWith(prefix)).map(([k]) => k.slice(prefix.length)));
  const injuredNames = new Set(Object.entries(injuries || {}).filter(([k, left]) => left > 0 && k.startsWith(prefix)).map(([k]) => k.slice(prefix.length)));
  const { players: effectiveStarters, changes } = getEligibleRoster(team, unavailableNamesFrom(suspensions, injuries));
  const changeByOut = new Map(changes.map(c => [c.out, c.in]));
  const startersNames = new Set(effectiveStarters.map(p => p.name));
  const bench = all.slice(11).filter(p => !startersNames.has(p.name) && !suspendedNames.has(p.name) && !injuredNames.has(p.name));
  const unavailable = all
    .filter(p => suspendedNames.has(p.name) || injuredNames.has(p.name))
    .map(p => ({
      ...p,
      reason: suspendedNames.has(p.name) ? 'suspenso' : 'lesionado',
      replacementName: changeByOut.get(p.name) || null,
      shortOnSubs: changeByOut.has(p.name) && !changeByOut.get(p.name),
    }));
  const byPos = (a, b) => posOrderIndex(a.pos?.[0]) - posOrderIndex(b.pos?.[0]);
  return {
    starters: [...effectiveStarters].sort(byPos),
    bench: [...bench].sort(byPos),
    unavailable,
  };
}

function decideRedCards(rand) {
  return { home: rand() < RED_CARD_CHANCE_PER_TEAM, away: rand() < RED_CARD_CHANCE_PER_TEAM };
}

// Expulsão reduz a propria expectativa de gols e aumenta a do adversário
// (vantagem numérica) — mais simples e robusto que simular minuto a minuto.
// `redCount` soma expulsões diretas + segundo amarelo, então 2 expulsões no
// mesmo time (raríssimo, mas possível) penalizam mais que 1.
function applyRedCardEffect(homeExp, awayExp, homeReds, awayReds) {
  let h = homeExp, a = awayExp;
  for (let i = 0; i < homeReds; i++) { h *= 0.65; a *= 1.2; }
  for (let i = 0; i < awayReds; i++) { a *= 0.65; h *= 1.2; }
  return [h, a];
}

// Time da casa joga um pouco melhor que "no papel" (torcida, viagem do
// visitante, familiaridade com o gramado) — efeito pequeno de propósito.
const HOME_ADVANTAGE = 1.05;

// Clássicos/rivalidades históricas — jogo mais aberto e disputado quando os
// dois times se enfrentam (leve boost pros dois lados, não só um favorito).
function rivalryKey(a, b) { return [a, b].sort().join('|'); }
const RIVALRY_PAIRS = [
  ['Flamengo', 'Fluminense'], ['Flamengo', 'Vasco'], ['Flamengo', 'Botafogo'],
  ['Vasco', 'Botafogo'], ['Vasco', 'Fluminense'], ['Fluminense', 'Botafogo'],
  ['Corinthians', 'Palmeiras'], ['Corinthians', 'Sao Paulo'], ['Sao Paulo', 'Palmeiras'],
  ['Santos', 'Corinthians'], ['Santos', 'Sao Paulo'], ['Santos', 'Palmeiras'],
  ['Gremio', 'Internacional'],
  ['Cruzeiro', 'Atletico-MG'],
  ['Bahia', 'Vitoria'],
  ['Athletico-PR', 'Coritiba'],
  ['Fortaleza', 'Ceara'],
];
const RIVALRIES = new Set(RIVALRY_PAIRS.map(([a, b]) => rivalryKey(a, b)));
function isRivalryMatch(clubA, clubB) {
  if (!clubA || !clubB) return false;
  return RIVALRIES.has(rivalryKey(clubA, clubB));
}
const RIVALRY_BOOST = 1.05;

// Gera os cartões (amarelo/vermelho) de uma partida. Compartilhado entre a
// versão detalhada (com minuto, via randMin) e a versão leve de fundo (sem
// minuto) — assim o 2o amarelo vira expulsão do mesmo jeito nos dois casos.
// Precisa rodar ANTES de sortear os gols pra expulsão (direta ou por 2o
// amarelo) já entrar no cálculo de expectativa de gols daquela partida.
function pickMatchCards(homeTeam, homeXI, awayTeam, awayXI, rand, randMin) {
  const events = [];
  const yellowCounts = new Map();
  const sentOff = new Set();

  const addYellow = (team, xi) => {
    const pool = xi.filter(p => !sentOff.has(p.name));
    if (pool.length === 0) return;
    const player = weightedPick(pool, CARD_WEIGHT_BY_POS, rand);
    const prior = yellowCounts.get(player.name) || 0;
    if (prior >= 1) {
      // Segundo amarelo na partida = expulso.
      sentOff.add(player.name);
      events.push({ type: 'red', minute: randMin ? randMin() : undefined, teamId: team.id, teamLabel: team.label, player: player.name, secondYellow: true });
    } else {
      yellowCounts.set(player.name, prior + 1);
      events.push({ type: 'yellow', minute: randMin ? randMin() : undefined, teamId: team.id, teamLabel: team.label, player: player.name });
    }
  };

  const yellowCount = poissonSample(YELLOWS_PER_MATCH_AVG, rand);
  for (let i = 0; i < yellowCount; i++) {
    const isHome = rand() < 0.5;
    addYellow(isHome ? homeTeam : awayTeam, isHome ? homeXI : awayXI);
  }

  // Vermelho direto (independente do 2o amarelo) — 1 por time no máximo.
  const reds = decideRedCards(rand);
  if (reds.home) {
    const pool = homeXI.filter(p => !sentOff.has(p.name));
    if (pool.length > 0) {
      const player = weightedPick(pool, CARD_WEIGHT_BY_POS, rand);
      sentOff.add(player.name);
      events.push({ type: 'red', minute: randMin ? randMin(20, 90) : undefined, teamId: homeTeam.id, teamLabel: homeTeam.label, player: player.name });
    }
  }
  if (reds.away) {
    const pool = awayXI.filter(p => !sentOff.has(p.name));
    if (pool.length > 0) {
      const player = weightedPick(pool, CARD_WEIGHT_BY_POS, rand);
      sentOff.add(player.name);
      events.push({ type: 'red', minute: randMin ? randMin(20, 90) : undefined, teamId: awayTeam.id, teamLabel: awayTeam.label, player: player.name });
    }
  }

  const homeRedCount = events.filter(e => e.type === 'red' && e.teamId === homeTeam.id).length;
  const awayRedCount = events.filter(e => e.type === 'red' && e.teamId === awayTeam.id).length;
  return { events, homeRedCount, awayRedCount };
}

// Gera lista de eventos de gol/cartão/lesão para uma partida com minutos únicos
// Nome de um reserva pra cobrir a lesão de um titular — mesma posição
// primeiro, senão o primeiro do banco disponível. Só usado pra dar nome ao
// evento cosmético de substituição do time adversário (não mexe na força do
// time nem no restante da simulação, que já é decidida em bloco na geração
// dos eventos).
function pickReplacementName(team, injuredPos) {
  const bench = (team?.players || []).slice(11);
  if (bench.length === 0) return null;
  const samePos = bench.find(p => p.pos?.[0] === injuredPos);
  return (samePos || bench[0]).name;
}

// Sorteia quem fez o gol (e a assistência) — usado tanto no jogo detalhado
// do usuário quanto na simulação leve dos outros jogos da rodada, pra que
// artilheiros/assistências também contem os gols de partidas que não têm
// minuto a minuto (senão a simulação direta nunca alimentava esses rankings).
function pickGoalOutcome(scoringTeam, scoringXI, concedingTeam, concedingXI, rand) {
  const isOwnGoal = rand() < OWN_GOAL_CHANCE;
  const scorer = isOwnGoal ? pickGoalScorer(concedingXI, rand) : pickGoalScorer(scoringXI, rand);
  const hasAssist = !isOwnGoal && rand() < ASSIST_CHANCE;
  return {
    teamId: scoringTeam.id,
    teamLabel: scoringTeam.label,
    scorer,
    isOwnGoal,
    ownGoalTeamLabel: isOwnGoal ? concedingTeam.label : undefined,
    assist: hasAssist ? pickAssister(scoringXI, scorer, rand) : null,
  };
}

// Constrói o feed de eventos "ao vivo" (com minuto pra animação) A PARTIR do
// resultado que simAiMatch já decidiu com a seed compartilhada — antes, a
// partida do usuário era gerada por um algoritmo próprio (generateMatchEvents,
// removido), diferente do usado pras outras partidas da rodada. No
// multiplayer isso fazia cada peer calcular um placar diferente pra mesma
// partida (a "minha" pra mim é "de fundo" pro meu adversário), desalinhando a
// tabela entre os dois pro resto da temporada. Usando sempre simAiMatch como
// fonte da verdade, placar/cartões/lesões batem em qualquer cliente; só o
// minuto de cada evento aqui é sorteado localmente (cosmético, não precisa
// bater entre clientes).
function buildLiveMatchEvents(sim, homeTeam, homeXI, awayTeam, awayXI) {
  const usedMin = new Set();
  const randMin = (minM = 1, maxM = 90) => {
    // Sorteia um minuto ainda livre. A busca é por tentativa, então precisa de
    // saída: se a faixa lotar (mais eventos do que minutos disponíveis), o
    // do/while original girava pra sempre e travava a aba. Depois de algumas
    // tentativas, pega o primeiro minuto livre da faixa — e se nem isso
    // existir, aceita repetir o minuto (dois lances no mesmo minuto é bem
    // menos grave do que a partida não rodar).
    for (let i = 0; i < 40; i++) {
      const m = Math.floor(Math.random() * (maxM - minM + 1)) + minM;
      if (!usedMin.has(m)) { usedMin.add(m); return m; }
    }
    for (let m = minM; m <= maxM; m++) {
      if (!usedMin.has(m)) { usedMin.add(m); return m; }
    }
    return minM;
  };

  const discipline = (sim.discipline || []).map(ev => {
    if (ev.type === 'injury') {
      const team = ev.teamId === homeTeam.id ? homeTeam : awayTeam;
      const xi = ev.teamId === homeTeam.id ? homeXI : awayXI;
      const pos = xi.find(p => p.name === ev.player)?.pos?.[0];
      return {
        ...ev, minute: randMin(), teamLabel: team.label,
        medicalQuote: medicalQuote(), replacementName: pickReplacementName(team, pos),
      };
    }
    return { ...ev, minute: (ev.type === 'red' && !ev.secondYellow) ? randMin(20, 90) : randMin() };
  });

  const goals = (sim.goals || []).map(g => ({ ...g, type: 'goal', minute: randMin() }));

  return [...discipline, ...goals].sort((a, b) => a.minute - b.minute);
}

// Nota de jogo por jogador (estilo 6.5, 8.2) — só é calculada pro jogo do
// usuário, que é o único com eventos detalhados por jogador (jogos simulados
// em segundo plano só têm placar + disciplina, sem atribuição de gol/assist
// suficiente pra render uma nota individual justa).
const RATING_BASE = 6.0;
const RATING_DEFENSIVE_POS = new Set(['GOL', 'ZAG', 'LD', 'LE', 'VOL']);
function computeMatchRatings(homeTeam, homeXI, awayTeam, awayXI, events, homeGoals, awayGoals, rand) {
  const ratings = new Map();
  [...homeXI, ...awayXI].forEach(p => ratings.set(p.name, RATING_BASE));
  events.forEach(ev => {
    if (ev.type === 'goal') {
      if (ev.isOwnGoal) ratings.set(ev.scorer, (ratings.get(ev.scorer) ?? RATING_BASE) - 1.3);
      else ratings.set(ev.scorer, (ratings.get(ev.scorer) ?? RATING_BASE) + 1.8);
      if (ev.assist) ratings.set(ev.assist, (ratings.get(ev.assist) ?? RATING_BASE) + 0.7);
    } else if (ev.type === 'yellow') {
      ratings.set(ev.player, (ratings.get(ev.player) ?? RATING_BASE) - 0.4);
    } else if (ev.type === 'red') {
      ratings.set(ev.player, (ratings.get(ev.player) ?? RATING_BASE) - (ev.secondYellow ? 1.2 : 1.5));
    }
  });
  const finalize = (team, xi, teamGoals, oppGoals) => xi.map(p => {
    let r = ratings.get(p.name) ?? RATING_BASE;
    if (teamGoals > oppGoals) r += 0.4;
    else if (teamGoals < oppGoals) r -= 0.3;
    if (oppGoals === 0 && RATING_DEFENSIVE_POS.has(p.pos?.[0])) r += 0.3;
    r += (rand() - 0.5) * 0.6;
    r = Math.max(4, Math.min(10, r));
    return { name: p.name, teamId: team.id, teamLabel: team.label, pos: p.pos?.[0], rating: Math.round(r * 10) / 10 };
  });
  return [...finalize(homeTeam, homeXI, homeGoals, awayGoals), ...finalize(awayTeam, awayXI, awayGoals, homeGoals)];
}

// Versão leve pra jogos que não estão sendo assistidos (resto da rodada) — sem
// minuto a minuto, mas com os mesmos cartões/lesões pra manter suspensões e
// desfalques consistentes na liga inteira, não só no jogo do usuário.
function pickGkName(xi) {
  return (xi || []).find(p => p.pos?.[0] === 'GOL')?.name || null;
}

function simAiMatch(homeTeam, awayTeam, rand = Math.random) {
  const homeXI = getStarters(homeTeam);
  const awayXI = getStarters(awayTeam);

  const { events: discipline, homeRedCount, awayRedCount } = pickMatchCards(homeTeam, homeXI, awayTeam, awayXI, rand, null);

  // Mesma regra da versão detalhada: quem foi expulso não concorre mais a
  // gol/assistência/pênalti pro resto da partida.
  const homeSentOff = new Set(discipline.filter(e => e.type === 'red' && e.teamId === homeTeam.id).map(e => e.player));
  const awaySentOff = new Set(discipline.filter(e => e.type === 'red' && e.teamId === awayTeam.id).map(e => e.player));
  const homeGoalXI = homeXI.filter(p => !homeSentOff.has(p.name));
  const awayGoalXI = awayXI.filter(p => !awaySentOff.has(p.name));

  const diff = homeTeam.ovr - awayTeam.ovr;
  let homeExp = Math.max(0.2, 1.3 + diff * 0.042) * HOME_ADVANTAGE;
  let awayExp = Math.max(0.2, 1.3 - diff * 0.042);
  if (isRivalryMatch(homeTeam.club, awayTeam.club)) { homeExp *= RIVALRY_BOOST; awayExp *= RIVALRY_BOOST; }
  [homeExp, awayExp] = applyRedCardEffect(homeExp, awayExp, homeRedCount, awayRedCount);

  [[homeTeam, homeXI], [awayTeam, awayXI]].forEach(([team, xi]) => {
    if (xi.length === 0 || rand() >= INJURY_CHANCE_PER_TEAM) return;
    const rounds = INJURY_MIN_ROUNDS + Math.floor(rand() * (INJURY_MAX_ROUNDS - INJURY_MIN_ROUNDS + 1));
    discipline.push({ type: 'injury', teamId: team.id, player: weightedPick(xi, INJURY_WEIGHT_BY_POS, rand).name, rounds });
  });

  let homeGoals = poissonSample(homeExp, rand);
  let awayGoals = poissonSample(awayExp, rand);
  // Sorteia autor (e assistência) de cada gol mesmo aqui — sem isso a
  // simulação direta (que só passa por esta função pra TODOS os jogos,
  // incluindo o do usuário) nunca alimentava artilheiros/assistências.
  const goals = [];
  for (let i = 0; i < homeGoals; i++) goals.push(pickGoalOutcome(homeTeam, homeGoalXI, awayTeam, awayGoalXI, rand));
  for (let i = 0; i < awayGoals; i++) goals.push(pickGoalOutcome(awayTeam, awayGoalXI, homeTeam, homeGoalXI, rand));

  // Pênalti durante o jogo (fora das disputas de shootout) — só o desfecho
  // convertido importa aqui (sem minuto a minuto pra mostrar a cobrança
  // perdida); quando convertido, soma no placar e entra como gol normal
  // (isPenalty:true) pro artilheiro contar certo.
  [[homeTeam, homeGoalXI, true], [awayTeam, awayGoalXI, false]].forEach(([team, xi, isHome]) => {
    if (xi.length === 0 || rand() >= PENALTY_AWARD_CHANCE_PER_TEAM) return;
    if (rand() >= penaltyScoreRate(team.ovr)) return;
    const taker = pickGoalScorer(xi, rand);
    if (isHome) homeGoals++; else awayGoals++;
    goals.push({ teamId: team.id, teamLabel: team.label, scorer: taker, isOwnGoal: false, isPenalty: true, assist: null });
  });

  // Notas de partida pra TODOS os jogos da liga, não só o do usuário — reusa
  // os mesmos gols/cartões já sorteados aqui (a fórmula de nota só olha
  // type/scorer/assist/player/secondYellow, não precisa de minuto a minuto)
  // pra alimentar a média de nota da temporada de qualquer jogador da liga.
  const ratingEvents = [...discipline, ...goals.map(g => ({ ...g, type: 'goal' }))];
  const ratings = computeMatchRatings(homeTeam, homeXI, awayTeam, awayXI, ratingEvents, homeGoals, awayGoals, rand);

  return {
    homeGoals, awayGoals, discipline, goals, ratings,
    homeGkName: pickGkName(homeXI), awayGkName: pickGkName(awayXI),
  };
}

// Funde os gols de simAiMatch (jogos simulados em segundo plano, sem
// minuto a minuto) nos rankings de artilheiros/assistências — sem isso esses
// rankings só contavam os gols do próprio jogo do usuário, ficando vazios
// depois de uma simulação direta (ou incompletos mesmo no modo normal).
// Chave por time+nome (igual cardCounts/suspensions) — a base tem o mesmo
// nome real (ex.: "Edmundo") em elencos de times/anos diferentes, e se dois
// deles caem na mesma liga simulada, uma chave só por nome fundia os gols
// dos dois num artilheiro só, com o teamLabel de qualquer um dos dois.
function applyGoalsToScorers(scorers, goals) {
  const next = { ...scorers };
  goals.forEach(g => {
    if (g.isOwnGoal) return;
    const key = playerKey(g.teamId, g.scorer);
    next[key] = { goals: (next[key]?.goals || 0) + 1, teamLabel: g.teamLabel };
  });
  return next;
}
function applyGoalsToAssisters(assisters, goals) {
  const next = { ...assisters };
  goals.forEach(g => {
    if (!g.assist) return;
    const key = playerKey(g.teamId, g.assist);
    next[key] = { assists: (next[key]?.assists || 0) + 1, teamLabel: g.teamLabel };
  });
  return next;
}

// Ranking de goleiros por jogos sem sofrer gol (clean sheets) — cada entrada
// é {teamId, teamLabel, gkName, conceded} pra UM time num jogo; conta como
// "sem sofrer" quando conceded === 0. Mesma chave time+nome dos demais
// rankings, pelo mesmo motivo (nomes reais se repetem em elencos diferentes).
function applyCleanSheets(cleanSheets, entries) {
  const next = { ...cleanSheets };
  entries.forEach(e => {
    if (!e.gkName) return;
    const key = playerKey(e.teamId, e.gkName);
    const prev = next[key];
    next[key] = {
      clean: (prev?.clean || 0) + (e.conceded === 0 ? 1 : 0),
      teamLabel: e.teamLabel,
    };
  });
  return next;
}

// Média de nota da temporada — acumula soma+contagem por jogador (chave
// time+nome) a partir das notas de UMA partida (computeMatchRatings), pra no
// fim dividir soma/contagem e ranquear quem manteve o nível ao longo de toda
// a campanha, não só numa partida isolada.
function applySeasonRatings(seasonRatings, matchRatings) {
  const next = { ...seasonRatings };
  (matchRatings || []).forEach(r => {
    const key = playerKey(r.teamId, r.name);
    const prev = next[key];
    next[key] = {
      sum: (prev?.sum || 0) + r.rating,
      count: (prev?.count || 0) + 1,
      teamLabel: r.teamLabel,
      pos: r.pos,
    };
  });
  return next;
}

// Conjunto de chaves time+nome indisponíveis nesta rodada (suspensos ou lesionados).
function unavailableNamesFrom(suspensions, injuries) {
  const s = new Set();
  Object.entries(suspensions || {}).forEach(([name, left]) => { if (left > 0) s.add(name); });
  Object.entries(injuries || {}).forEach(([name, left]) => { if (left > 0) s.add(name); });
  return s;
}

// Momento/forma: últimos resultados (V/E/D) do time, mais recente por último.
// Um time em sequência de vitórias joga levemente acima do seu overall "de
// papel", e vice-versa — sem isso, times de elenco parecido nunca "quebravam"
// a média esperada de forma perceptível ao longo de uma rodada ruim/boa.
const FORM_HISTORY_LEN = 5;
const FORM_MAX_ADJUST = 2.5;
function formAdjustment(recentResults) {
  if (!recentResults || recentResults.length === 0) return 0;
  const score = recentResults.reduce((s, r) => s + (r === 'V' ? 1 : r === 'D' ? -1 : 0), 0);
  const avg = score / recentResults.length;
  return Math.round(avg * FORM_MAX_ADJUST * 10) / 10;
}
function pushFormResult(history, result) {
  return [...(history || []), result].slice(-FORM_HISTORY_LEN);
}
function updateFormFromResults(prevForm, results) {
  const next = { ...prevForm };
  (results || []).forEach(r => {
    const hRes = r.homeGoals > r.awayGoals ? 'V' : r.homeGoals < r.awayGoals ? 'D' : 'E';
    const aRes = r.homeGoals < r.awayGoals ? 'V' : r.homeGoals > r.awayGoals ? 'D' : 'E';
    next[r.homeId] = pushFormResult(next[r.homeId], hRes);
    next[r.awayId] = pushFormResult(next[r.awayId], aRes);
  });
  return next;
}

// Retorna uma cópia efêmera de leagueTeams com o XI de cada time já ajustado
// pra rodada (indisponíveis trocados por reserva elegível) e o overall ajustado
// pela forma recente. Não mexe no state original — cada rodada recalcula do
// zero a partir do elenco completo, então nada precisa ser desfeito depois.
function teamsForRound(teams, unavailableNames, formMap) {
  return teams.map(t => {
    const { players, changes, fullRoster } = getEligibleRoster(t, unavailableNames);
    const baseOvr = changes.length > 0 ? teamStrength(Object.fromEntries(players.map((p, i) => [i, p]))) : t.ovr;
    const adj = formAdjustment(formMap?.[t.id]);
    if (changes.length === 0 && adj === 0) return t;
    return { ...t, players: changes.length > 0 ? fullRoster : t.players, ovr: Math.round((baseOvr + adj) * 10) / 10 };
  });
}

// Aplica ao estado de cartões/suspensões/lesões o que aconteceu na rodada que
// acabou de ser jogada: decrementa quem já estava cumprindo suspensão/lesão
// (liberado se chegou a 0) e soma as ocorrências novas (amarelos, vermelhos,
// lesões) de todos os jogos da rodada — inclusive os simulados em segundo plano.
// `cards` guarda o total de amarelos da temporada (pra leaderboard, nunca reseta)
// — a suspensão dispara a cada múltiplo de 3, sem precisar de um segundo contador.
function applyRoundDiscipline(prevCards, prevSuspensions, prevInjuries, occurrences) {
  const cards = { ...prevCards };
  const suspensions = {};
  const injuries = {};
  Object.entries(prevSuspensions || {}).forEach(([k, left]) => { if (left - 1 > 0) suspensions[k] = left - 1; });
  Object.entries(prevInjuries || {}).forEach(([k, left]) => { if (left - 1 > 0) injuries[k] = left - 1; });
  (occurrences || []).forEach(o => {
    const key = playerKey(o.teamId, o.player);
    if (o.type === 'yellow') {
      const cur = (cards[key] || 0) + 1;
      cards[key] = cur;
      if (cur % YELLOWS_FOR_SUSPENSION === 0) suspensions[key] = Math.max(suspensions[key] || 0, RED_SUSPENSION_ROUNDS);
    } else if (o.type === 'red') {
      // Segundo amarelo também conta como amarelo pro total da temporada, além da expulsão.
      if (o.secondYellow) cards[key] = (cards[key] || 0) + 1;
      suspensions[key] = Math.max(suspensions[key] || 0, RED_SUSPENSION_ROUNDS);
    } else if (o.type === 'injury') {
      injuries[key] = Math.max(injuries[key] || 0, o.rounds || INJURY_MIN_ROUNDS);
    }
  });
  return { cards, suspensions, injuries };
}

// Prêmios de fim de temporada: quem se destacou entre os jogadores do PRÓPRIO
// usuário ganha um pequeno bônus permanente de overall (persiste em "Nova
// temporada com mesmo elenco", já que só o elenco do usuário atravessa pra
// próxima temporada — os adversários são sorteados de novo). Artilheiro e
// líder de assistência usam o mesmo ranking já exibido em "Artilheiros"/
// "Líderes de Assistência"; goleiro menos vazado só se aplica ao Brasileirão,
// que tem tabela com GC — a Copa não tem uma tabela geral pra comparar.
const SEASON_AWARD_BONUS = 2;
// Nº mínimo de partidas notificadas (computeMatchRatings) pra um jogador
// concorrer aos prêmios baseados em nota média — sem isso, um jogador que
// só entrou uma vez e teve sorte levaria o prêmio da temporada inteira.
const MIN_RATING_APPEARANCES_FOR_AWARD = 5;
function computeSeasonAwards({ myTeamId, myPlayers, leagueTable, scorers, assisters, seasonRatings, gameMode }) {
  const awards = [];
  const usedNames = new Set(); // um jogador só leva um prêmio por temporada

  const push = (name, reason, extra) => {
    if (!name || usedNames.has(name)) return;
    usedNames.add(name);
    awards.push({ name, reason, ...extra });
  };

  // scorers/assisters são chaveados por time+nome (playerKey) — comparar o
  // teamId extraído com myTeamId é mais preciso que comparar só pelo nome,
  // já que nomes reais se repetem em elencos de times diferentes.
  const topScorer = scorers && Object.entries(scorers).sort((a, b) => b[1].goals - a[1].goals)[0];
  const topScorerInfo = topScorer && splitPlayerKey(topScorer[0]);
  if (topScorerInfo && topScorerInfo.teamId === myTeamId) {
    push(topScorerInfo.name, 'Artilheiro da temporada', { goals: topScorer[1].goals });
  }

  const topAssist = assisters && Object.entries(assisters).sort((a, b) => b[1].assists - a[1].assists)[0];
  const topAssistInfo = topAssist && splitPlayerKey(topAssist[0]);
  if (topAssistInfo && topAssistInfo.teamId === myTeamId) {
    push(topAssistInfo.name, 'Líder de assistências', { assists: topAssist[1].assists });
  }

  if ((gameMode === 'brasileirao' || gameMode === 'serieab') && leagueTable?.length) {
    const bestDefense = [...leagueTable].sort((a, b) => a.gc - b.gc)[0];
    if (bestDefense?.id === myTeamId) {
      const gk = (myPlayers || []).find(p => p.pos?.[0] === 'GOL');
      if (gk) push(gk.name, 'Goleiro menos vazado', { gc: bestDefense.gc });
    }
  }

  // Prêmios baseados em nota média da temporada (seasonRatings) — só do
  // próprio elenco, com mínimo de partidas pra evitar amostra pequena demais.
  const myRatingEntries = Object.entries(seasonRatings || {})
    .map(([key, r]) => ({ ...splitPlayerKey(key), ...r }))
    .filter(r => r.teamId === myTeamId && r.count >= MIN_RATING_APPEARANCES_FOR_AWARD && !usedNames.has(r.name));

  // Zagueiro do Ano: melhor média entre os zagueiros do elenco.
  const bestDefender = myRatingEntries
    .filter(r => r.pos === 'ZAG')
    .sort((a, b) => (b.sum / b.count) - (a.sum / a.count))[0];
  if (bestDefender) push(bestDefender.name, 'Zagueiro do Ano', { rating: Math.round((bestDefender.sum / bestDefender.count) * 10) / 10 });

  // Revelação: melhor média entre quem tinha OVR abaixo da média do elenco —
  // sem dado de idade/ano de estreia, usamos "abaixo do esperado no papel,
  // acima do esperado em campo" como proxy de jogador revelado na temporada.
  const avgSquadOvr = myPlayers?.length ? myPlayers.reduce((s, p) => s + (p.ovr || 0), 0) / myPlayers.length : 0;
  const revelacao = myRatingEntries
    .filter(r => !usedNames.has(r.name))
    .filter(r => {
      const player = myPlayers?.find(p => p.name === r.name);
      return player && player.ovr < avgSquadOvr;
    })
    .sort((a, b) => (b.sum / b.count) - (a.sum / a.count))[0];
  if (revelacao) push(revelacao.name, 'Revelação da temporada', { rating: Math.round((revelacao.sum / revelacao.count) * 10) / 10 });

  return awards;
}

// Catálogo de conquistas — espelha os ids decididos pelo servidor
// (server/routes/me.ts) em POST /me/season-result; aqui só o texto de exibição.
const ACHIEVEMENT_CATALOG = {
  first_title: { icon: '🏆', label: 'Primeiro Título', desc: 'Conquistou seu primeiro título (Brasileirão ou Copa).' },
  dynasty: { icon: '👑', label: 'Dinastia', desc: 'Alcançou 3 títulos com a conta.' },
  veteran: { icon: '📅', label: 'Veterano', desc: 'Completou 10 temporadas.' },
  podium_finish: { icon: '🥉', label: 'Pódio', desc: 'Terminou o Brasileirão entre os 3 primeiros.' },
  unbeaten_season: { icon: '🛡️', label: 'Invencível', desc: 'Terminou uma temporada do Brasileirão sem nenhuma derrota.' },
  golden_boot: { icon: '👟', label: 'Chuteira de Ouro', desc: 'Seu jogador foi o artilheiro da temporada.' },
  // Marcos de gols marcados (carreira, soma de todas as temporadas/copas)
  goals_100: { icon: '⚽', label: 'Artilheiro Nato', desc: 'Marcou 100 gols com a conta.' },
  goals_1000: { icon: '👟', label: 'Máquina de Gols', desc: 'Marcou 1.000 gols com a conta.' },
  goals_2500: { icon: '🥾', label: 'Chuteira Quente', desc: 'Marcou 2.500 gols com a conta.' },
  goals_5000: { icon: '🔥', label: 'Artilheiro Implacável', desc: 'Marcou 5.000 gols com a conta.' },
  goals_10000: { icon: '🎯', label: 'Gols Não Faltam', desc: 'Marcou 10.000 gols com a conta.' },
  goals_20000: { icon: '🌟', label: 'Lenda Artilheira', desc: 'Marcou 20.000 gols com a conta.' },
  // Marcos de assistências (carreira)
  assists_100: { icon: '🤝', label: 'Garçom', desc: 'Deu 100 assistências com a conta.' },
  assists_1000: { icon: '🍽️', label: 'Cozinheiro de Jogadas', desc: 'Deu 1.000 assistências com a conta.' },
  assists_2500: { icon: '🥢', label: 'Talher de Ouro', desc: 'Deu 2.500 assistências com a conta.' },
  assists_5000: { icon: '🎩', label: 'Maestro', desc: 'Deu 5.000 assistências com a conta.' },
  assists_10000: { icon: '🪄', label: 'Mágico das Assistências', desc: 'Deu 10.000 assistências com a conta.' },
  assists_20000: { icon: '🧞', label: 'Gênio da Bola Parada e do Passe', desc: 'Deu 20.000 assistências com a conta.' },
  // Marcos de gols sofridos (carreira) — pra rir da própria zaga
  conceded_100: { icon: '🥅', label: 'Zaga Furada', desc: 'Sofreu 100 gols com a conta.' },
  conceded_1000: { icon: '😅', label: 'Time Vazado', desc: 'Sofreu 1.000 gols com a conta.' },
  conceded_2500: { icon: '🕳️', label: 'Zaga Peneira', desc: 'Sofreu 2.500 gols com a conta.' },
  conceded_5000: { icon: '🧱', label: 'Parede de Queijo Suíço', desc: 'Sofreu 5.000 gols com a conta.' },
  conceded_10000: { icon: '🏳️', label: 'Sofredor Profissional', desc: 'Sofreu 10.000 gols com a conta.' },
  conceded_20000: { icon: '💀', label: 'Zaga de Papel', desc: 'Sofreu 20.000 gols com a conta.' },
  // Saldo de gols (melhor campanha)
  goal_diff_30: { icon: '📈', label: 'Saldo Positivo', desc: 'Fechou uma temporada ou copa com saldo de gols +30.' },
  goal_diff_50: { icon: '🚀', label: 'Atropelo', desc: 'Fechou uma temporada ou copa com saldo de gols +50.' },
  goal_diff_80: { icon: '💥', label: 'Show de Bola', desc: 'Fechou uma temporada ou copa com saldo de gols +80.' },
  // Campanhas invictas
  unbeaten_league_champion: { icon: '👑🛡️', label: 'Temporada Perfeita', desc: 'Foi campeão invicto do Brasileirão.' },
  unbeaten_cup_champion: { icon: '🏆🛡️', label: 'Copa Perfeita', desc: 'Foi campeão invicto da Copa do Brasil.' },
  perfect_double: { icon: '💎', label: 'Dose Dupla Perfeita', desc: 'Foi campeão invicto do Brasileirão e da Copa do Brasil.' },
  // Multiplayer
  multiplayer_win: { icon: '🎮', label: 'Rei do Multiplayer', desc: 'Venceu uma temporada jogando com amigos.' },
  multiplayer_veteran: { icon: '🕹️', label: 'Veterano do Multiplayer', desc: 'Venceu 10 temporadas jogando com amigos.' },
  // Elenco de encher os olhos — melhor jogador INDIVIDUAL já escalado (não
  // precisa ser o mesmo jogador em temporadas diferentes, é o recorde)
  squad_ovr_85: { icon: '⭐', label: 'Craque no Elenco', desc: 'Teve um jogador de overall 85+ no elenco.' },
  squad_ovr_86: { icon: '⭐', label: 'Craque Cotado', desc: 'Teve um jogador de overall 86+ no elenco.' },
  squad_ovr_87: { icon: '🌠', label: 'Fora de Série', desc: 'Teve um jogador de overall 87+ no elenco.' },
  squad_ovr_88: { icon: '🌠', label: 'Categoria Mundial', desc: 'Teve um jogador de overall 88+ no elenco.' },
  squad_ovr_89: { icon: '💫', label: 'Nível Seleção', desc: 'Teve um jogador de overall 89+ no elenco.' },
  squad_ovr_90: { icon: '💫', label: 'Ídolo Absoluto', desc: 'Teve um jogador de overall 90+ no elenco.' },
  squad_ovr_91: { icon: '👽', label: 'Extraterrestre', desc: 'Teve um jogador de overall 91+ no elenco.' },
  squad_ovr_92: { icon: '🐐', label: 'O Maior de Todos', desc: 'Teve um jogador de overall 92+ no elenco.' },
  // Time de encher os olhos — overall médio do XI (não de um jogador só)
  team_ovr_90: { icon: '🛡️', label: 'Time de Gala', desc: 'Montou um time com overall médio 90+.' },
  team_ovr_91: { icon: '🛡️', label: 'Elenco Milionário', desc: 'Montou um time com overall médio 91+.' },
  team_ovr_92: { icon: '🏛️', label: 'Escrete Histórico', desc: 'Montou um time com overall médio 92+.' },
  team_ovr_93: { icon: '🏛️', label: 'Time dos Sonhos', desc: 'Montou um time com overall médio 93+.' },
  team_ovr_94: { icon: '👑', label: 'Seleção Improvável', desc: 'Montou um time com overall médio 94+.' },
  team_ovr_95: { icon: '👑', label: 'Time Perfeito', desc: 'Montou um time com overall médio 95+.' },
  // Volume de carreira (jogos disputados e vitórias acumuladas)
  matches_50: { icon: '📋', label: 'Rodagem', desc: 'Disputou 50 partidas com a conta.' },
  matches_100: { icon: '📖', label: 'Centenário', desc: 'Disputou 100 partidas com a conta.' },
  matches_250: { icon: '📚', label: 'Nas Quatro Linhas', desc: 'Disputou 250 partidas com a conta.' },
  matches_500: { icon: '🏟️', label: 'Casa Cheia', desc: 'Disputou 500 partidas com a conta.' },
  wins_50: { icon: '✅', label: 'Começando a Vencer', desc: 'Venceu 50 partidas com a conta.' },
  wins_100: { icon: '🥇', label: 'Máquina de Vencer', desc: 'Venceu 100 partidas com a conta.' },
  wins_250: { icon: '🏅', label: 'Imbatível na Estatística', desc: 'Venceu 250 partidas com a conta.' },
  // Títulos por dificuldade — o multiplicador de pontos já existe pra
  // dificuldade, mas nenhuma conquista reconhecia especificamente ter
  // encarado (e vencido) no nível mais duro.
  champion_facil: { icon: '🟢', label: 'Campeão no Fácil', desc: 'Foi campeão do Brasileirão, Copa ou Série A/B na dificuldade Fácil.' },
  champion_normal: { icon: '🔵', label: 'Campeão no Normal', desc: 'Foi campeão do Brasileirão, Copa ou Série A/B na dificuldade Normal.' },
  champion_dificil: { icon: '🟠', label: 'Campeão no Difícil', desc: 'Foi campeão do Brasileirão, Copa ou Série A/B na dificuldade Difícil.' },
  champion_lendario: { icon: '🔴', label: 'Campeão no Lendário', desc: 'Foi campeão do Brasileirão, Copa ou Série A/B na dificuldade Lendário — a mais dura do jogo.' },
  unbeaten_dificil: { icon: '🛡️🟠', label: 'Perfeito no Difícil', desc: 'Foi campeão invicto jogando no Difícil.' },
  unbeaten_lendario: { icon: '🛡️🔴', label: 'Perfeito no Lendário', desc: 'Foi campeão invicto jogando no Lendário.' },
  // Série A/B
  serieab_promoted: { icon: '⬆️', label: 'Acesso Garantido', desc: 'Subiu da Série B pra Série A.' },
  serieab_champion_b: { icon: '🏆', label: 'Rei da Segundona', desc: 'Foi campeão da Série B.' },
  // Quase lá — campanhas boas que não chegaram no pódio
  top5_finish: { icon: '5️⃣', label: 'Entre os 5 Melhores', desc: 'Terminou o Brasileirão entre os 5 primeiros.' },
  top10_finish: { icon: '🔟', label: 'Primeira Metade', desc: 'Terminou o Brasileirão entre os 10 primeiros.' },
  // Invencibilidade em maior escala (a versão "uma vez" já existe acima)
  unbeaten_br_5: { icon: '🛡️', label: 'Invencibilidade Rotineira', desc: 'Foi campeão invicto do Brasileirão 5 vezes.' },
  unbeaten_br_10: { icon: '🛡️👑', label: 'Império Invicto', desc: 'Foi campeão invicto do Brasileirão 10 vezes.' },
  unbeaten_copa_5: { icon: '🏆🛡️', label: 'Copa Sempre Perfeita', desc: 'Foi campeão invicto da Copa do Brasil 5 vezes.' },
  unbeaten_copa_10: { icon: '🏆👑', label: 'Dominação na Copa', desc: 'Foi campeão invicto da Copa do Brasil 10 vezes.' },
  // Campanha turbulenta — pro lado engraçado das estatísticas
  turbulent_season: { icon: '🌀', label: 'Temporada Turbulenta', desc: 'Perdeu 15 ou mais partidas numa única temporada.' },
  // Artilharia de uma temporada só (não é carreira, é o pico de uma vez)
  season_goals_50: { icon: '⚽', label: 'Ataque Afiado', desc: 'Marcou 50 gols numa única temporada ou copa.' },
  season_goals_100: { icon: '🎯', label: 'Ataque Devastador', desc: 'Marcou 100 gols numa única temporada ou copa.' },
  season_goals_150: { icon: '🚀', label: 'Ataque Absurdo', desc: 'Marcou 150 gols numa única temporada ou copa.' },
};

// Gera dezenas de marcos por contador (gols, assistências, partidas etc.) em
// cima do catálogo escrito à mão acima — os marcos que já existiam mantêm o
// nome/ícone especial de antes; os novos usam o mesmo texto-modelo, só
// variando o número. É assim que todo sistema de conquista por "milestone"
// funciona (Steam, apps de hábito etc.) — ninguém espera um nome exclusivo
// pra cada marco de uma progressão numérica, e escrever à mão umas 250
// descrições assim não deixaria nenhuma mais especial, só mais devagar.
function addTierAchievements(catalog, prefix, thresholds, icon, labelFor, descFor) {
  thresholds.forEach(n => {
    const id = `${prefix}_${n}`;
    if (catalog[id]) return; // já definido à mão acima — não sobrescreve
    catalog[id] = { icon, label: labelFor(n), desc: descFor(n) };
  });
}

const ACH_FMT = n => n.toLocaleString('pt-BR');
const CAREER_TIERS = [10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 10000, 12500, 15000, 17500, 20000, 25000, 30000, 40000, 50000, 75000, 100000];
const VOLUME_TIERS = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000];
const SQUAD_OVR_TIERS_FULL = Array.from({ length: 25 }, (_, i) => 75 + i); // 75..99
const TEAM_OVR_TIERS_FULL = Array.from({ length: 20 }, (_, i) => 80 + i); // 80..99
const GOAL_DIFF_TIERS_FULL = [10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100, 120, 150, 200];
const TITLE_TIERS = [5, 10, 15, 25, 50, 100];
const SEASON_TIERS = [15, 20, 25, 50, 75, 100, 150, 200];
const MP_WINS_TIERS = [5, 15, 25, 50, 100, 250];

addTierAchievements(ACHIEVEMENT_CATALOG, 'goals', CAREER_TIERS, '⚽', n => `${ACH_FMT(n)} Gols na Carreira`, n => `Marcou ${ACH_FMT(n)} gols com a conta.`);
addTierAchievements(ACHIEVEMENT_CATALOG, 'assists', CAREER_TIERS, '🤝', n => `${ACH_FMT(n)} Assistências na Carreira`, n => `Deu ${ACH_FMT(n)} assistências com a conta.`);
addTierAchievements(ACHIEVEMENT_CATALOG, 'conceded', CAREER_TIERS, '🥅', n => `${ACH_FMT(n)} Gols Sofridos`, n => `Sofreu ${ACH_FMT(n)} gols com a conta.`);
addTierAchievements(ACHIEVEMENT_CATALOG, 'matches', VOLUME_TIERS, '📋', n => `${ACH_FMT(n)} Partidas na Carreira`, n => `Disputou ${ACH_FMT(n)} partidas com a conta.`);
addTierAchievements(ACHIEVEMENT_CATALOG, 'wins', VOLUME_TIERS, '✅', n => `${ACH_FMT(n)} Vitórias na Carreira`, n => `Venceu ${ACH_FMT(n)} partidas com a conta.`);
addTierAchievements(ACHIEVEMENT_CATALOG, 'draws', VOLUME_TIERS, '🟰', n => `${ACH_FMT(n)} Empates na Carreira`, n => `Empatou ${ACH_FMT(n)} partidas com a conta.`);
addTierAchievements(ACHIEVEMENT_CATALOG, 'losses', VOLUME_TIERS, '📉', n => `${ACH_FMT(n)} Derrotas na Carreira`, n => `Perdeu ${ACH_FMT(n)} partidas com a conta.`);
addTierAchievements(ACHIEVEMENT_CATALOG, 'squad_ovr', SQUAD_OVR_TIERS_FULL, '⭐', n => `Craque ${n} OVR no Elenco`, n => `Teve um jogador de overall ${n}+ no elenco.`);
addTierAchievements(ACHIEVEMENT_CATALOG, 'team_ovr', TEAM_OVR_TIERS_FULL, '🛡️', n => `Time Médio ${n} OVR`, n => `Montou um time com overall médio ${n}+.`);
addTierAchievements(ACHIEVEMENT_CATALOG, 'goal_diff', GOAL_DIFF_TIERS_FULL, '📈', n => `Saldo +${n}`, n => `Fechou uma temporada ou copa com saldo de gols +${n}.`);
addTierAchievements(ACHIEVEMENT_CATALOG, 'titles', TITLE_TIERS, '👑', n => `${n} Títulos na Conta`, n => `Alcançou ${n} títulos com a conta.`);
addTierAchievements(ACHIEVEMENT_CATALOG, 'seasons', SEASON_TIERS, '📅', n => `${n} Temporadas Jogadas`, n => `Completou ${n} temporadas.`);
addTierAchievements(ACHIEVEMENT_CATALOG, 'mpwins', MP_WINS_TIERS, '🎮', n => `${n} Vitórias no Multiplayer`, n => `Venceu ${n} temporadas jogando com amigos.`);

// Agrupamento por categoria pra galeria completa (AchievementsModal).
const ACHIEVEMENT_CATEGORIES = [
  { label: 'Títulos e Carreira', ids: ['first_title', 'dynasty', ...TITLE_TIERS.map(n => `titles_${n}`), 'veteran', ...SEASON_TIERS.map(n => `seasons_${n}`), 'podium_finish', 'top5_finish', 'top10_finish', 'unbeaten_season', 'golden_boot', 'turbulent_season'] },
  { label: 'Dificuldade', ids: ['champion_facil', 'champion_normal', 'champion_dificil', 'champion_lendario', 'unbeaten_dificil', 'unbeaten_lendario'] },
  { label: 'Série A/B', ids: ['serieab_promoted', 'serieab_champion_b'] },
  { label: 'Gols', ids: CAREER_TIERS.map(n => `goals_${n}`) },
  { label: 'Artilharia de uma Temporada', ids: ['season_goals_50', 'season_goals_100', 'season_goals_150'] },
  { label: 'Assistências', ids: CAREER_TIERS.map(n => `assists_${n}`) },
  { label: 'Gols Sofridos', ids: CAREER_TIERS.map(n => `conceded_${n}`) },
  { label: 'Saldo de Gols', ids: GOAL_DIFF_TIERS_FULL.map(n => `goal_diff_${n}`) },
  { label: 'Elenco', ids: SQUAD_OVR_TIERS_FULL.map(n => `squad_ovr_${n}`) },
  { label: 'Time', ids: TEAM_OVR_TIERS_FULL.map(n => `team_ovr_${n}`) },
  { label: 'Volume de Carreira', ids: [...VOLUME_TIERS.map(n => `matches_${n}`), ...VOLUME_TIERS.map(n => `wins_${n}`), ...VOLUME_TIERS.map(n => `draws_${n}`), ...VOLUME_TIERS.map(n => `losses_${n}`)] },
  { label: 'Campanhas Invictas', ids: ['unbeaten_league_champion', 'unbeaten_br_5', 'unbeaten_br_10', 'unbeaten_cup_champion', 'unbeaten_copa_5', 'unbeaten_copa_10', 'perfect_double'] },
  { label: 'Multiplayer', ids: ['multiplayer_win', 'multiplayer_veteran', ...MP_WINS_TIERS.map(n => `mpwins_${n}`)] },
];

// Contador de cada família de conquista por "milestone" — o mesmo campo do
// usuário serve pra TODOS os thresholds daquela família, então não precisa
// mais de um `case` por id: só extrai o prefixo e o número (ver
// getAchievementProgress abaixo).
const ACH_FIELD_BY_PREFIX = {
  goals: u => u.career_goals || 0,
  assists: u => u.career_assists || 0,
  conceded: u => u.career_conceded || 0,
  matches: u => u.career_matches_played || 0,
  wins: u => u.career_wins || 0,
  draws: u => u.career_draws || 0,
  losses: u => u.career_losses || 0,
  squad_ovr: u => u.best_player_ovr || 0,
  team_ovr: u => u.best_team_ovr || 0,
  goal_diff: u => Math.max(0, u.best_goal_diff || 0),
  titles: u => (u.titles_brasileirao || 0) + (u.titles_copa || 0),
  seasons: u => u.seasons_played || 0,
  mpwins: u => u.multiplayer_wins || 0,
};
const ACH_TIER_ID_RE = /^(goals|assists|conceded|matches|wins|draws|losses|squad_ovr|team_ovr|goal_diff|titles|seasons|mpwins)_(\d+)$/;

// Progresso numérico das conquistas que têm um contador persistido na conta
// (server/db.ts) — usado pra desenhar a barra na galeria. Conquistas binárias
// sem contador de carreira (ex.: invicto, artilheiro da temporada) voltam null.
function getAchievementProgress(id, user) {
  const totalTitles = (user.titles_brasileirao || 0) + (user.titles_copa || 0);
  if (id === 'first_title') return { current: totalTitles, target: 1 };
  if (id === 'dynasty') return { current: totalTitles, target: 3 };
  if (id === 'veteran') return { current: user.seasons_played || 0, target: 10 };
  if (id === 'multiplayer_veteran') return { current: user.multiplayer_wins || 0, target: 10 };
  const m = id.match(ACH_TIER_ID_RE);
  if (m) {
    const [, prefix, n] = m;
    return { current: ACH_FIELD_BY_PREFIX[prefix](user), target: Number(n) };
  }
  return null;
}

// Card de uma conquista (ícone + label + desc + barra de progresso ou selo de
// desbloqueada) — compartilhado entre a galeria completa (AchievementsModal) e
// o showcase de objetivos em destaque na Intro, pra não duplicar o mesmo JSX
// em dois lugares.
function AchievementProgressCard({ id, user, unlockedSet }) {
  const a = ACHIEVEMENT_CATALOG[id];
  if (!a) return null;
  const isUnlocked = unlockedSet.has(id);
  const progress = !isUnlocked ? getAchievementProgress(id, user) : null;
  const pct = progress ? Math.min(100, Math.round((progress.current / progress.target) * 100)) : 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10,
      background: isUnlocked ? 'rgba(212,162,60,0.1)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isUnlocked ? 'rgba(212,162,60,0.35)' : 'rgba(255,255,255,0.07)'}`,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0, filter: isUnlocked ? 'none' : 'grayscale(1)', opacity: isUnlocked ? 1 : 0.4 }}>{a.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: isUnlocked ? '#F4F1EA' : 'rgba(244,241,234,0.6)' }}>{a.label}</div>
        <div style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.3 }}>{a.desc}</div>
        {progress && (
          <div style={{ marginTop: 6 }}>
            <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#d4a23c', borderRadius: 999, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 9.5, opacity: 0.45, marginTop: 3, fontFamily: "'Space Mono', monospace" }}>
              {Math.min(progress.current, progress.target).toLocaleString('pt-BR')}/{progress.target.toLocaleString('pt-BR')}
            </div>
          </div>
        )}
      </div>
      {isUnlocked
        ? <span style={{ fontSize: 16, flexShrink: 0 }}>✅</span>
        : <span style={{ fontSize: 15, flexShrink: 0, opacity: 0.35 }}>🔒</span>
      }
    </div>
  );
}

// Galeria completa: todas as conquistas do catálogo, desbloqueadas ou não,
// com barra de progresso quando existe um contador de carreira pra elas.
function AchievementsModal({ user, onClose }) {
  const unlocked = new Set(user.achievements || []);
  const totalCount = Object.keys(ACHIEVEMENT_CATALOG).length;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, position: 'relative' }}>
        <button onClick={onClose} aria-label="Fechar" className="tap-target-sm" style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', padding: 6, lineHeight: 1 }}>✕</button>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Conquistas</div>
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 18, fontFamily: "'Space Mono', monospace" }}>{unlocked.size}/{totalCount} desbloqueadas</div>
        {ACHIEVEMENT_CATEGORIES.map(group => (
          <div key={group.label} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{group.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.ids.map(id => <AchievementProgressCard key={id} id={id} user={user} unlockedSet={unlocked} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Compatibilidade entre slot do campinho e posições do jogador.
// MD aceita jogadores com PD, MEI ou MD. ME aceita PE, MEI ou ME.
// VOL aceita VOL ou MEI. Sem mapeamento = exige a posição exata.
const POS_COMPAT = {
  GOL: ['GOL'],
  LD: ['LD', 'ZAG'],
  LE: ['LE', 'ZAG'],
  ZAG: ['ZAG', 'LD', 'LE'],
  VOL: ['VOL', 'MEI', 'MC'],
  MEI: ['MEI', 'VOL', 'MC', 'MD', 'ME'],
  MC: ['MC', 'MEI', 'VOL', 'MD', 'ME'],
  MD: ['MD', 'PD', 'MEI', 'MC'],
  ME: ['ME', 'PE', 'MEI', 'MC'],
  PD: ['PD', 'MD', 'ATA', 'MEI'],
  PE: ['PE', 'ME', 'ATA', 'MEI'],
  ATA: ['ATA', 'PD', 'PE'],
};

// Números do conteúdo do jogo (clubes, elencos, jogadores) — usados como
// selo de "isso aqui é grande" na home e no ranking. Preferido a mostrar
// contagem de contas cadastradas/ativas: aquele número é pequeno num site
// novo e cai quando ninguém abre o jogo num período, enquanto o acervo de
// times históricos só cresce. Derivado de TEAMS, nunca escrito à mão — não
// tem como ficar desatualizado a cada leva de times nova.
const GAME_STATS = {
  clubs: new Set(TEAMS.map(t => t.club)).size,
  squads: TEAMS.length,
  players: TEAMS.reduce((n, t) => n + t.players.length, 0),
};

// Logos via TheSportsDB (r2.thesportsdb.com — free, sem autenticação)
const CLUB_LOGOS = {
  // Times no jogo (66 equipes históricas)
  'Santos': 'https://r2.thesportsdb.com/images/media/team/badge/j8xk9g1679447486.png',
  'Sao Caetano': 'https://r2.thesportsdb.com/images/media/team/badge/e72hdi1593453914.png',
  'Botafogo': 'https://r2.thesportsdb.com/images/media/team/badge/bs5mbw1733004596.png',
  'Palmeiras': 'https://r2.thesportsdb.com/images/media/team/badge/vsqwqp1473538105.png',
  'Internacional': 'https://r2.thesportsdb.com/images/media/team/badge/yprvxx1473538097.png',
  'Fluminense': 'https://r2.thesportsdb.com/images/media/team/badge/stvvwp1473538082.png',
  'Coritiba': 'https://r2.thesportsdb.com/images/media/team/badge/ywwsyu1473538050.png',
  'Sao Paulo': 'https://r2.thesportsdb.com/images/media/team/badge/sxpupx1473538135.png',
  'Sport': 'https://r2.thesportsdb.com/images/media/team/badge/tyrbls1545421563.png',
  'Bahia': 'https://r2.thesportsdb.com/images/media/team/badge/xuvtsv1473539308.png',
  'Vasco': 'https://r2.thesportsdb.com/images/media/team/badge/ynqlxo1630521109.png',
  'Corinthians': 'https://r2.thesportsdb.com/images/media/team/badge/vvuvps1473538042.png',
  'Gremio': 'https://r2.thesportsdb.com/images/media/team/badge/uvpwyt1473538089.png',
  'Athletico-PR': 'https://r2.thesportsdb.com/images/media/team/badge/irzu1u1554237406.png',
  'Cruzeiro': 'https://r2.thesportsdb.com/images/media/team/badge/upsvvu1473538059.png',
  'Flamengo': 'https://r2.thesportsdb.com/images/media/team/badge/syptwx1473538074.png',
  'Atletico-MG': 'https://r2.thesportsdb.com/images/media/team/badge/x5lixs1743742872.png',
  'Guarani': 'https://r2.thesportsdb.com/images/media/team/badge/tpipb21766508536.png',
  // Times extras (não no jogo mas disponíveis como emblema pessoal)
  'Fortaleza': 'https://r2.thesportsdb.com/images/media/team/badge/tosmdr1532853458.png',
  'Ceara': 'https://r2.thesportsdb.com/images/media/team/badge/rxxvyp1464886685.png',
  'America-MG': 'https://r2.thesportsdb.com/images/media/team/badge/rtpp171752177342.png',
  'Goias': 'https://r2.thesportsdb.com/images/media/team/badge/qhfhdp1635869930.png',
  'Vitoria': 'https://r2.thesportsdb.com/images/media/team/badge/tysrrx1473538156.png',
  'Bragantino': 'https://r2.thesportsdb.com/images/media/team/badge/2p7tl41701423595.png',
  'Criciuma': 'https://r2.thesportsdb.com/images/media/team/badge/r11mld1766506200.png',
  'Chapecoense': 'https://r2.thesportsdb.com/images/media/team/badge/wy0e1i1765900601.png',
  'Ponte Preta': 'https://r2.thesportsdb.com/images/media/team/badge/wbss4d1644929547.png',
  'Juventude': 'https://r2.thesportsdb.com/images/media/team/badge/1ntter1766506778.png',
  'Avai': 'https://r2.thesportsdb.com/images/media/team/badge/bblkat1766506007.png',
  'Atletico-GO': 'https://r2.thesportsdb.com/images/media/team/badge/l7382k1766505911.png',
};

// Qual clube o emblema escolhido representa. O time do usuário não vem de
// TEAMS, então não tem campo `club` — e era por isso que ele ficava SEM grito
// de gol (a busca em GOAL_AUDIO_FILES caía em `undefined`) e, ao ser campeão,
// tocava o hino do clube da MAIORIA dos jogadores escalados em vez do hino do
// escudo escolhido. Emblema próprio (upload) continua sem clube conhecido.
function clubFromLogo(logoUrl) {
  if (!logoUrl) return null;
  return Object.keys(CLUB_LOGOS).find(c => CLUB_LOGOS[c] === logoUrl) || null;
}

// Áudios de gol reais por clube (public/gol/*.mp3). Botafogo tem 2 variantes
// que alternam aleatoriamente; clubes sem arquivo proprio ficam sem som.
const GOAL_AUDIO_FILES = {
  'Flamengo': ['/gol/Flamengo.mp3'],
  'Fluminense': ['/gol/Fluminense.mp3'],
  'Atletico-MG': ['/gol/Atletico-MG.mp3'],
  'Santos': ['/gol/Santos.mp3'],
  'Sao Caetano': ['/gol/Sao-Caetano.mp3'],
  'Athletico-PR': ['/gol/Athletico-PR.mp3'],
  'Bahia': ['/gol/Bahia.mp3'],
  'Botafogo': ['/gol/Botafogo-1.mp3', '/gol/Botafogo-2.mp3'],
  'Corinthians': ['/gol/Corinthians.mp3'],
  'Coritiba': ['/gol/Coritiba.mp3'],
  'Cruzeiro': ['/gol/Cruzeiro.mp3'],
  'Gremio': ['/gol/Gremio.mp3'],
  'Guarani': ['/gol/Guarani.mp3'],
  'Internacional': ['/gol/Internacional.mp3'],
  'Palmeiras': ['/gol/Palmeiras.mp3'],
  'Sao Paulo': ['/gol/Sao-Paulo.mp3'],
  'Sport': ['/gol/Sport.mp3'],
  'Vasco': ['/gol/Vasco.mp3'],
};

// Silenciar o áudio de gol — flag em módulo (não em state) porque
// playGoalAudio é chamado de dentro do tick(), fora do ciclo de render.
let _goalAudioMuted = (() => {
  try { return localStorage.getItem('brl_goal_audio_muted') === '1'; } catch { return false; }
})();
function setGoalAudioMuted(muted) {
  _goalAudioMuted = muted;
  try { localStorage.setItem('brl_goal_audio_muted', muted ? '1' : '0'); } catch { }
}
function isGoalAudioMuted() { return _goalAudioMuted; }

// Feedback tátil pra celular — a Vibration API não existe no iOS Safari (a
// chamada simplesmente não faz nada nesse caso, sem erro) e respeita o mesmo
// mute do áudio de gol, já que quem desligou o som provavelmente quer o jogo
// mais discreto de um jeito geral.
function hapticPulse(pattern) {
  if (_goalAudioMuted) return;
  try { navigator.vibrate?.(pattern); } catch { /* sem suporte, ignora */ }
}
const HAPTIC = { goal: [40, 60, 90], concede: [120], card: [30], penaltyMiss: [25, 50, 25] };

function playGoalAudio(club, customUrl, onEnd) {
  let done = false;
  const finish = () => { if (done) return; done = true; onEnd?.(); };
  if (_goalAudioMuted) { finish(); return; }

  let src = customUrl;
  if (!src) {
    const files = GOAL_AUDIO_FILES[club];
    if (!files || files.length === 0) { finish(); return; }
    src = files[Math.floor(Math.random() * files.length)];
  }
  try {
    const audio = new Audio(src);
    audio.volume = 0.85;
    audio.onended = finish;
    audio.onerror = finish;
    // Rede de seguranca: caso o arquivo nao carregue/dispare eventos.
    setTimeout(finish, 4500);
    audio.play().catch(finish);
  } catch { finish(); }
}

// IDs YouTube dos hinos oficiais — tocam na tela de campeão
const CLUB_ANTHEMS = {
  'Santos': 'QXs6kGLVL_0',
  'Sao Caetano': 'YqPaxCODcPI',
  'Flamengo': 'pFvX3lHujn8',
  'Corinthians': 'g6M8oJq-dEA',
  'Palmeiras': 'n47Y8-xNDPo',
  'Internacional': 's6rT_BfQnuE',
  'Sao Paulo': 'pGD2BJeYjNA',
  'Vasco': 'Fsbka7RbOpw',
  'Gremio': 'cBmkH37USnA',
  'Cruzeiro': '901buxaTBtA',
  'Botafogo': 'itm2AQsH0pU',
  'Fluminense': 'MMxM5YePtsM',
  'Bahia': '960Fx8gcnIY',
  'Sport': 'PVcqbeerC8k',
  'Athletico-PR': 'kNd1BbWicMc',
  'Coritiba': 'NZki289dBz4',
  'Atletico-MG': 'SeERcAA-CJw',
  'Guarani': 'b6KGAtvKhoQ',
  // Times "extras" (não jogáveis no draft, só disponíveis como emblema
  // pessoal — ver CLUB_LOGOS) — antes não tinham hino, então escolher um
  // desses como emblema não liberava a opção "Hino" no áudio ambiente.
  'Fortaleza': 'BHSAxofET5I',
  'Ceara': 'GYERpERV5EE',
  'America-MG': 'V8vErmpMs2U',
  'Goias': 'Otjv3Zt8oGU',
  'Vitoria': 'XveVhtInOrM',
  'Bragantino': 'tIAWfcA6fKg',
  'Criciuma': 'e93zsWdcByE',
  'Chapecoense': 'LF3SY2RXcxA',
  'Ponte Preta': 'lXsg_HiCua0',
  'Juventude': 'yuSxwQ8FJng',
  'Avai': 'QtPwQKg4aF0',
  'Atletico-GO': 'GHZsE4wLGMQ',
};

// Estádio de cada clube jogável (não cobre os "extras", que são só emblema
// pessoal e nunca mandam uma partida de verdade). Nome atual — clubes que
// vendem naming rights (Corinthians, Palmeiras, São Paulo, Atlético-MG,
// Athletico-PR) mudam de nome de tempos em tempos; o resto usa o nome
// tradicional, que já É o nome oficial atual.
const CLUB_STADIUMS = {
  'Santos': 'Vila Belmiro',
  'Sao Caetano': 'Anacleto Campanella',
  'Flamengo': 'Maracanã',
  'Corinthians': 'Neo Química Arena',
  'Palmeiras': 'Nubank Parque',
  'Internacional': 'Beira-Rio',
  'Sao Paulo': 'MorumBIS',
  'Vasco': 'São Januário',
  'Gremio': 'Arena do Grêmio',
  'Cruzeiro': 'Mineirão',
  'Botafogo': 'Nilton Santos',
  'Fluminense': 'Maracanã',
  'Bahia': 'Arena Fonte Nova',
  'Sport': 'Ilha do Retiro',
  'Athletico-PR': 'Arena da Baixada',
  'Coritiba': 'Couto Pereira',
  'Atletico-MG': 'Arena MRV',
  'Guarani': 'Brinco de Ouro da Princesa',
};

function expandPlayerPositions(playerPos) {
  const result = new Set(playerPos);
  Object.entries(POS_COMPAT).forEach(([slotType, accepts]) => {
    if (playerPos.some(p => accepts.includes(p))) result.add(slotType);
  });
  return [...result];
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function needsDark(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

function shortName(name) {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 9);
  // Prefer last word unless it's a suffix like "Jr", "Filho" etc
  const suffixes = new Set(['jr', 'filho', 'neto', 'junior', 'jr.']);
  const last = parts[parts.length - 1];
  const word = suffixes.has(last.toLowerCase()) ? parts[parts.length - 2] || last : last;
  return word.length <= 9 ? word : word.slice(0, 8) + '.';
}

function ovrColor(ovr) {
  if (ovr >= 93) return '#FFD700';
  if (ovr >= 86) return '#d4a23c';
  if (ovr >= 78) return '#94a3b8';
  return '#64748b';
}

// ============================================================
// ESTADO
// ============================================================
const MAX_SKIPS = 3;

export default function App() {
  // ── LocalStorage restore ──────────────────────────────────
  const _sv = (() => {
    try { const s = localStorage.getItem('brl_save'); return s ? JSON.parse(s) : null; } catch { return null; }
  })();
  const _hasSave = !!(_sv?.phase && _sv.phase !== 'intro');
  // Primeira visita de verdade (nunca jogou nesse navegador, sem save
  // nenhum) — pula a home e cai direto no "Escolher formação", pra dar
  // interação com o jogo já de cara em vez de só texto de marketing. Só
  // acontece UMA vez: `brl_returning` é marcado logo abaixo (useEffect), e
  // depois disso a pessoa sempre vê a home normal, mesmo sem save ativo.
  const _isFirstVisit = !_hasSave && (() => {
    try { return localStorage.getItem('brl_returning') !== '1'; } catch { return false; }
  })();

  const [phase, setPhase] = useState(_hasSave ? 'intro' : (_isFirstVisit ? 'formation' : 'intro'));
  // Fase do jogo salvo, guardada à parte de `phase`: com save, a tela
  // inicial mostra a home (não pula direto pro jogo) com um botão
  // "Continuar" visível — em vez de reabrir sozinho sem avisar, que é
  // menos confiável quando a pessoa volta só no dia seguinte. Os outros
  // estados (pitch, fixtures, currentRound etc.) abaixo já carregam do save
  // normalmente; só `phase` fica em 'intro' até a pessoa escolher.
  const [savedPhase, setSavedPhase] = useState(_hasSave ? _sv.phase : null);
  const [formationKey, setFormationKey] = useState(_sv?.formationKey ?? null);
  const [pitchSlots, setPitchSlots] = useState(_sv?.pitchSlots ?? []);
  const [usedTeamIds, setUsedTeamIds] = useState(_sv?.usedTeamIds ?? []);
  const [rolledTeam, setRolledTeam] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollingPreview, setRollingPreview] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [pitch, setPitch] = useState(_sv?.pitch ?? {});
  const [captainSlot, setCaptainSlot] = useState(_sv?.captainSlot ?? null);
  const [skipsLeft, setSkipsLeft] = useState(_sv?.skipsLeft ?? MAX_SKIPS);
  const [log, setLog] = useState(_sv?.log ?? []);

  // Time personalizado
  const [myTeamName, setMyTeamName] = useState(_sv?.myTeamName ?? 'Meu Time');
  const [myTeamBadge, setMyTeamBadge] = useState(_sv?.myTeamBadge ?? '⭐');
  const [myTeamColor, setMyTeamColor] = useState(_sv?.myTeamColor ?? '#d4a23c');
  const [myTeamCoach, setMyTeamCoach] = useState(_sv?.myTeamCoach ?? '');
  const [myTeamCity, setMyTeamCity] = useState(_sv?.myTeamCity ?? '');

  // ── Conta (login opcional) ──────────────────────────────────
  const [authToken, setAuthToken] = useState(() => api.getToken());
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(() => !!api.getToken());
  const [authError, setAuthError] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalMode, setAccountModalMode] = useState('choice');
  // Abre o modal de conta já numa aba específica (ex.: 'signup' direto, sem
  // passar pela tela de escolha) — usado pelo convite de conta no fim de
  // temporada pra quem jogou como convidado.
  const openAccountModal = (mode = 'choice') => { setAccountModalMode(mode); setShowAccountModal(true); };
  const [showAccountPanel, setShowAccountPanel] = useState(false);

  // Prompt de instalação como PWA — o navegador dispara `beforeinstallprompt`
  // só quando já acha o site "instalável" (manifest + service worker ok) e a
  // pessoa ainda não instalou; guardamos o evento pra poder chamar .prompt()
  // depois, no clique do próprio usuário (não dá pra disparar sozinho).
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(() => {
    try { return localStorage.getItem('brl_install_dismissed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPromptEvent(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    trackEvent('pwa_install_prompt_result', { outcome });
    setInstallPromptEvent(null);
  };
  const dismissInstallBanner = () => {
    setInstallDismissed(true);
    try { localStorage.setItem('brl_install_dismissed', '1'); } catch { /* ignore */ }
  };

  // Se já tem token salvo, valida e restaura a sessão ao carregar.
  useEffect(() => {
    if (!authToken) { setAuthLoading(false); return; }
    let cancelled = false;
    setAuthLoading(true);
    api.fetchMe()
      .then(data => {
        if (!data?.user) throw new Error('Resposta invalida ao restaurar sessao.');
        if (!cancelled) setCurrentUser(data.user);
      })
      .catch(() => { if (!cancelled) { api.clearToken(); setAuthToken(null); } })
      .finally(() => { if (!cancelled) setAuthLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marca o navegador como "já visitou" — feito aqui (efeito, depois do
  // primeiro render) e não junto da leitura de `_isFirstVisit` acima, pra não
  // escrever no localStorage durante a renderização. Sem isso o pulo direto
  // pro draft aconteceria de novo a cada vez que a pessoa clicasse em
  // "Voltar" sem chegar a jogar.
  useEffect(() => {
    if (_isFirstVisit) { try { localStorage.setItem('brl_returning', '1'); } catch { } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ao logar/cadastrar/restaurar sessão, o time do usuário passa a vir da conta.
  useEffect(() => {
    if (!currentUser) return;
    setMyTeamName(currentUser.team_name || 'Meu Time');
    setMyTeamColor(currentUser.team_color || '#d4a23c');
    setMyTeamLogo(currentUser.team_logo || null);
    setMyTeamCoach(currentUser.team_coach || '');
    setMyTeamCity(currentUser.team_city || '');
  }, [currentUser]);

  const handleAuthSuccess = (result, mode) => {
    if (!result?.token || !result?.user) {
      setAuthError('Erro ao autenticar. Verifique se o servidor está rodando e tente de novo.');
      return;
    }
    const { token, user } = result;
    api.setToken(token);
    setAuthToken(token);
    setCurrentUser(user);
    setAuthError('');
    setShowAccountModal(false);
    if (mode === 'signup') trackEvent('sign_up');
  };

  const handleGuestChoice = () => setShowAccountModal(false);

  const handleLogout = () => {
    api.clearToken();
    setAuthToken(null);
    setCurrentUser(null);
    setShowAccountPanel(false);
  };

  // Atualiza um subconjunto de campos: no servidor (se logado) + no state local
  // (pra refletir na hora, sem esperar round-trip).
  const updateAccountFields = async (fields) => {
    if (!currentUser) return;
    const { user } = await api.updateMe(fields);
    setCurrentUser(user);
  };

  const handleDeleteAccount = async (password) => {
    await api.deleteMe(password);
    handleLogout();
  };

  // Modo de jogo
  const [gameMode, setGameMode] = useState(_sv?.gameMode ?? 'serieab'); // 'brasileirao' (legado, so em saves antigos) | 'copa' | 'serieab' | 'multi'

  // Série A/B — divisão que o jogador está disputando nesta temporada, e a
  // divisão espelho (só IA) que avança junto pra existir de verdade (o
  // "40 times, 20 na A e 20 na B" pedido) sem precisar ficar interativa.
  // `myDivision` persiste entre "Nova Temporada"; os times de cada lado são
  // sorteados de novo a cada temporada nova, igual já acontece hoje com os
  // adversários do Brasileirão normal (não há "elenco fixo" pra time de IA
  // nenhum nesse jogo, só o do próprio jogador).
  const [myDivision, setMyDivision] = useState(_sv?.myDivision ?? 'A'); // 'A' | 'B'
  const [otherDivision, setOtherDivision] = useState(_sv?.otherDivision ?? null); // { teams, fixtures, table } — espelho, só IA
  // Resultado da promoção/rebaixamento decidido no fim da temporada — usado
  // pra avisar na tela de resultado e decidir a divisão da temporada seguinte.
  const [divisionMove, setDivisionMove] = useState(_sv?.divisionMove ?? null); // null | 'promoted' | 'relegated' | 'stayed'
  // Mata-mata de acesso (3ºx6º, 4ºx5º da Série B) — só existe quando o
  // jogador termina a temporada nessa faixa. Mesma lógica de agregado +
  // pênaltis que a Copa já usa, só que pra um confronto só, não um chaveamento
  // inteiro — jogado como duas rodadas extras anexadas ao fim de `fixtures`.
  const [promotionTie, setPromotionTie] = useState(_sv?.promotionTie ?? null); // { opponentId, leg, leg1Result }

  // Dificuldade (curva de OVR da IA) — preferência do dispositivo, independente
  // de save em andamento (uma temporada já iniciada mantém o OVR que já baixou).
  const [difficulty, setDifficulty] = useState(() => {
    try { return localStorage.getItem('brl_difficulty') || 'normal'; } catch { return 'normal'; }
  });
  useEffect(() => {
    try { localStorage.setItem('brl_difficulty', difficulty); } catch { }
  }, [difficulty]);

  // Mercado de transferências entre temporadas: libera até 2 jogadores do
  // elenco atual e reaproveita o fluxo de draft (mesmo dado/rolagem) só pra
  // preencher as vagas liberadas. Essa flag decide se o confirm do Squad, no
  // final desse mini-draft, chama newSeason (mesmo elenco, só trocado) em vez
  // de startSeason (jogo novo do zero).
  const [isTransferSeason, setIsTransferSeason] = useState(_sv?.isTransferSeason ?? false);

  // Supercopa do Brasil (Desafio do Dia) — monta um time do zero (mesmo
  // sorteio/draft de qualquer carreira nova) pra enfrentar um time lendário
  // sorteado por data (o mesmo pra todo mundo que abrir o jogo hoje), numa
  // partida única, sem entrar nas conquistas nem nas estatísticas de carreira
  // (não é uma temporada de verdade) — só vencer dá +50 pontos soltos de
  // ranking (ver bloco isolado dentro de applySeasonAwards). Reaproveita o
  // motor do Brasileirão com fixtures de 1 rodada só — vira "última rodada"
  // sozinho.
  const [isDailyChallenge, setIsDailyChallenge] = useState(_sv?.isDailyChallenge ?? false);
  const [showDailyChallenge, setShowDailyChallenge] = useState(false);
  const dailyChallenge = useMemo(() => getDailyChallengeOpponent(), []);
  // Só dá pra JOGAR (confirmar escalação e entrar em campo) uma vez por dia
  // — guardado por data (não por resultado), então nem perder/desistir libera
  // outra tentativa no mesmo dia. Marcado em `confirmDailyChallenge`, não ao
  // abrir o modal (só ver o adversário do dia não deveria "gastar" o dia).
  const [dailyChallengeDoneDate, setDailyChallengeDoneDate] = useState(() => {
    try { return localStorage.getItem('brl_daily_done_date'); } catch { return null; }
  });
  const dailyChallengeAlreadyPlayed = dailyChallengeDoneDate === dailyChallenge.dateKey;

  // Multiplayer (PeerJS)
  const [multiPhase, setMultiPhase] = useState(null); // null|'lobby'|'room'
  const [multiGameMode, setMultiGameMode] = useState('serieab');
  const [roomCode, setRoomCode] = useState('');
  const [isLeader, setIsLeader] = useState(false);
  const [roomSnap, setRoomSnap] = useState(null); // estado da sala (mantido pelo líder)
  const [joinInput, setJoinInput] = useState('');
  const [multiTimerLeft, setMultiTimerLeft] = useState(null);
  const [multiConnecting, setMultiConnecting] = useState(false);
  const multiConnectingRef = useRef(false); // espelha multiConnecting p/ checagem síncrona (evita Peer duplicado em duplo-toque antes do re-render)
  const [multiError, setMultiError] = useState('');
  const peerRef = useRef(null);       // instância Peer (líder ou guest)
  const connsRef = useRef({});        // líder: { peerId: DataConnection }
  const leaderConnRef = useRef(null); // guest: conexão com o líder
  const [chatMessages, setChatMessages] = useState([]); // chat/reações da sala (transiente, não é salvo)
  const [chatOpen, setChatOpen] = useState(false);

  // Convite direto por link (?join=CODIGO, gerado pelo botão de compartilhar
  // da sala) — pré-preenche o código e já leva pro lobby de multiplayer, pra
  // quem clicou no link só precisar apertar "Entrar".
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('join');
    if (code) {
      setJoinInput(code.trim().toUpperCase());
      setMultiPhase('lobby');
      window.history.replaceState(null, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Logo do time
  const [myTeamLogo, setMyTeamLogo] = useState(_sv?.myTeamLogo ?? null);
  const [cropSrc, setCropSrc] = useState(null);

  // Liga
  const [leagueTeams, setLeagueTeams] = useState(_sv?.leagueTeams ?? []);
  const [leagueTable, setLeagueTable] = useState(_sv?.leagueTable ?? []);
  const [fixtures, setFixtures] = useState(_sv?.fixtures ?? []);
  // Datas de cada rodada — derivadas (função pura), nunca salvas. Só faz
  // sentido no Brasileirão (a Copa é mata-mata, sem calendário de pontos
  // corridos).
  //
  // seasonYear em si PRECISA ser estado (salvo), não um useMemo([]) fixo no
  // ano real: era isso que prendia toda "Nova Temporada" (mesmo elenco ou
  // via mercado de transferências) sempre em 2026 — o valor era calculado
  // uma vez só, na primeira renderização do componente, e nunca mudava de
  // novo dali pra frente. Incrementado em newSeason() (ver mais abaixo);
  // volta pro ano real em startSeason() (carreira nova do zero).
  const [seasonYear, setSeasonYear] = useState(_sv?.seasonYear ?? new Date().getFullYear());
  const seasonDates = useMemo(
    () => (fixtures.length > 0 ? buildSeasonCalendar(fixtures.length, seasonYear) : []),
    [fixtures.length, seasonYear]
  );
  const [currentRound, setCurrentRound] = useState(_sv?.currentRound ?? 0);

  // Copa (eliminatória)
  const [cupRounds, setCupRounds] = useState(_sv?.cupRounds ?? []); // [{name, matches, leg1Results, results}]
  const [cupRoundIdx, setCupRoundIdx] = useState(_sv?.cupRoundIdx ?? 0);
  const [cupLeg, setCupLeg] = useState(_sv?.cupLeg ?? 1); // 1=jogo de ida  2=jogo de volta
  const cupLegRef = useRef(1);
  useEffect(() => { cupLegRef.current = cupLeg; }, [cupLeg]);
  const [userInCup, setUserInCup] = useState(_sv?.userInCup ?? true);
  const userInCupRef = useRef(_sv?.userInCup ?? true);
  useEffect(() => { userInCupRef.current = userInCup; }, [userInCup]);
  const [eliminationRoundName, setEliminationRoundName] = useState(_sv?.eliminationRoundName ?? null);
  const [cupWinnerId, setCupWinnerId] = useState(_sv?.cupWinnerId ?? null);
  // Transição do chaveamento: quando uma fase termina, o chaveamento abre
  // sozinho e mostra os classificados subindo pros blocos da fase seguinte —
  // é o equivalente na Copa ao calendário andando dia a dia no Brasileirão.
  // { intoRoundIdx, winnerIds } numa fase comum; { championId } na final.
  // Nunca é salvo: é um momento, não estado de campeonato.
  const [bracketAdvance, setBracketAdvance] = useState(null);
  // Na final a tela de resultado espera o usuário sair do chaveamento — o
  // troféu subindo no chaveamento é o fecho da Copa, e cortar direto pro
  // resultado passava por cima dele.
  const resultsAfterBracketRef = useRef(false);

  // Histórico e artilheiros
  const [matchHistory, setMatchHistory] = useState(_sv?.matchHistory ?? []);
  const [scorers, setScorers] = useState(_sv?.scorers ?? {});
  const [assisters, setAssisters] = useState(_sv?.assisters ?? {});
  const [cleanSheets, setCleanSheets] = useState(_sv?.cleanSheets ?? {});
  const [seasonRatings, setSeasonRatings] = useState(_sv?.seasonRatings ?? {});
  const [viewingTeam, setViewingTeam] = useState(null);

  // Cartões, suspensões e lesões — { nome: contagem/rodadas restantes }
  const [cardCounts, setCardCounts] = useState(_sv?.cardCounts ?? {});
  const [redCards, setRedCards] = useState(_sv?.redCards ?? {}); // { nome: total de expulsões na temporada }
  const [suspensions, setSuspensions] = useState(_sv?.suspensions ?? {});
  const [injuries, setInjuries] = useState(_sv?.injuries ?? {});
  const [lastRoundDiscipline, setLastRoundDiscipline] = useState(null); // aviso de desfalques da última rodada
  const [lastMatchRatings, setLastMatchRatings] = useState(null); // notas dos jogadores da última partida do usuário
  // Resumo da partida (placar + notas) abre na hora que o jogo termina — antes
  // só dava pra ver as notas clicando num link escondido lá embaixo, depois
  // da tabela inteira e de todas as outras estatísticas da liga.
  const [showMatchSummary, setShowMatchSummary] = useState(false);
  useEffect(() => { if (lastMatchRatings?.length > 0) setShowMatchSummary(true); }, [lastMatchRatings]);
  // Forma/momento — últimos resultados de cada time ('V'|'E'|'D'), mais recente por último
  const [teamForm, setTeamForm] = useState(_sv?.teamForm ?? {});
  // Prêmios de fim de temporada (artilheiro/assistência/goleiro menos vazado do próprio time)
  const [seasonAwards, setSeasonAwards] = useState(_sv?.seasonAwards ?? []);
  // Conquistas desbloqueadas nesta submissão (toast) + ranking global
  const [newAchievements, setNewAchievements] = useState([]);

  // Indicador de offline — o service worker (public/sw.js) mantém o app
  // funcionando sem rede depois da primeira visita; isso só avisa o usuário
  // que ele está no modo offline (login/ranking/multiplayer não funcionam).
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  const [showNews, setShowNews] = useState(false);
  // Quantas novidades o jogador ainda não viu (não só um "tem ou não tem") —
  // itens antes do último visto na lista (mais recente primeiro) são novos.
  const unseenNewsCount = (() => {
    try {
      const seenId = localStorage.getItem('brl_news_seen');
      if (!seenId) return WHATS_NEW.length;
      const idx = WHATS_NEW.findIndex(item => item.id === seenId);
      return idx === -1 ? WHATS_NEW.length : idx;
    } catch { return 0; }
  })();

  // Rotas de verdade (URL própria, compartilhável, indexável pelo Google) pras
  // páginas institucionais — Como Jogar/Termos/Privacidade/Contato. É só
  // History API direto (pushState/popstate), sem lib de rotas: o servidor já
  // cai em index.html pra qualquer caminho fora de /api (SPA catch-all), e
  // aqui a gente só lê window.location.pathname pra saber qual página mostrar.
  const [infoPage, setInfoPage] = useState(() => INFO_ROUTES[window.location.pathname] || null);
  const [teamsPage, setTeamsPage] = useState(() => parseTeamsPathname(window.location.pathname));
  const [rankingPage, setRankingPage] = useState(() => window.location.pathname === '/ranking');
  useEffect(() => {
    const onPopState = () => {
      setInfoPage(INFO_ROUTES[window.location.pathname] || null);
      setTeamsPage(parseTeamsPathname(window.location.pathname));
      setRankingPage(window.location.pathname === '/ranking');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    let title = 'Brasileirão Lendário — Monte seu time com lendas do futebol brasileiro';
    let description = `Simulador de futebol grátis: monte seu elenco com craques históricos de ${TEAMS.length} times do futebol brasileiro (1959-2024), escale a formação e dispute o Brasileirão ou a Copa do Brasil sozinho ou com amigos no multiplayer.`;
    let path = '/';
    // As 100 páginas de time individuais (/times/{id}) são quase idênticas
    // entre si — uma frase-modelo trocando só o nome do time, mais a lista de
    // jogadores. Conteúdo gerado em massa com pouca variação é exatamente o
    // que a política de "conteúdo de baixo valor" do AdSense cita. noindex
    // tira elas da avaliação de qualidade do site sem tirar do ar: continuam
    // funcionando normalmente pra quem chega por um link ou navega pelo
    // índice em /times (que segue indexável, por ser uma página real de
    // listagem). `follow` mantém o Google encontrando as outras páginas do
    // site a partir daqui.
    let robots = 'index, follow';
    if (infoPage) {
      title = `${INFO_TABS.find(t => t.id === infoPage)?.label} — Brasileirão Lendário`;
      path = canonicalPathFor(infoPage);
    } else if (teamsPage === 'index') {
      title = 'Times Históricos do Brasileirão — Brasileirão Lendário';
      description = `Os ${TEAMS.length} times históricos disponíveis pra montar no Brasileirão Lendário, com elenco completo de cada um.`;
      path = '/times';
    } else if (teamsPage) {
      const team = TEAMS.find(t => t.id === teamsPage);
      const { baseName, achievement } = parseTeamLabel(team.label);
      title = `${team.label} — Elenco completo | Brasileirão Lendário`;
      description = `Monte o ${baseName}${achievement ? ` (${achievement})` : ''} no Brasileirão Lendário: elenco completo com ${team.players.length} jogadores reais, técnico ${team.coach}, e dispute o Brasileirão ou a Copa do Brasil.`;
      path = canonicalTeamsPath(teamsPage);
      robots = 'noindex, follow';
    } else if (rankingPage) {
      // Conteúdo 100% dinâmico/pessoal (muda por período e a cada temporada
      // registrada) — sem valor de busca nenhum, então noindex, mas ainda
      // com URL própria (compartilhável, funciona com voltar/avançar).
      title = 'Ranking Global — Brasileirão Lendário';
      description = 'Classificação de todos os jogadores do Brasileirão Lendário — diária, semanal, mensal ou geral.';
      path = '/ranking';
      robots = 'noindex, follow';
    }
    document.title = title;
    let robotsTag = document.querySelector('meta[name="robots"]');
    if (!robotsTag) {
      robotsTag = document.createElement('meta');
      robotsTag.name = 'robots';
      document.head.appendChild(robotsTag);
    }
    robotsTag.content = robots;
    // A <meta name="description"> do index.html é estática — sem atualizar
    // aqui, toda página (institucional ou de time) mantém o snippet
    // genérico da home nos resultados de busca, perdendo a chance de um
    // resumo específico por página.
    const descTag = document.querySelector('meta[name="description"]');
    if (descTag) descTag.content = description;
    // O <link rel="canonical"> do index.html também é estático (sempre a
    // home) — sem atualizar aqui, o Google via cada página institucional/de
    // time declarando ela mesma como duplicata da home, e só indexava a
    // home — mesmo com as URLs certinhas no sitemap. Atualiza pra URL real
    // da página a cada navegação.
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = `https://brasileiraolendario.com.br${path}`;
  }, [infoPage, teamsPage, rankingPage]);
  const navigateToInfo = (tab) => {
    window.history.pushState(null, '', canonicalPathFor(tab));
    setInfoPage(tab);
    setTeamsPage(null);
  };
  const closeInfoPage = () => {
    window.history.pushState(null, '', '/');
    setInfoPage(null);
  };
  const navigateToTeamsIndex = () => {
    window.history.pushState(null, '', '/times');
    setTeamsPage('index');
    setInfoPage(null);
  };
  const navigateToTeam = (id) => {
    window.history.pushState(null, '', `/times/${id}`);
    setTeamsPage(id);
    setInfoPage(null);
  };
  const closeTeamsPage = () => {
    window.history.pushState(null, '', '/');
    setTeamsPage(null);
  };
  const navigateToRanking = () => {
    window.history.pushState(null, '', '/ranking');
    setRankingPage(true);
    setInfoPage(null);
    setTeamsPage(null);
  };
  const closeRankingPage = () => {
    window.history.pushState(null, '', '/');
    setRankingPage(false);
  };

  // Compartilhar o jogo com amigos (não é o convite de sala — é o app em si).
  // Mais importante ainda rodando instalado como PWA: nesse modo não tem
  // barra de endereço visível pra copiar o link manualmente.
  const [appShareCopied, setAppShareCopied] = useState(false);
  const shareApp = async () => {
    trackEvent('share', { method: 'app_referral' });
    const url = window.location.origin;
    const text = 'Tô jogando Brasileirão Lendário — monta seu time com craques históricos do futebol brasileiro e dispute o título. Bora jogar?';
    if (navigator.share) {
      try { await navigator.share({ title: 'Brasileirão Lendário', text, url }); } catch { /* usuário cancelou — sem problema */ }
    } else {
      navigator.clipboard?.writeText(url);
      setAppShareCopied(true);
      setTimeout(() => setAppShareCopied(false), 2000);
    }
  };
  // Silenciar áudio de gol — o estado React só existe pra atualizar o ícone;
  // quem realmente controla se toca ou não é a flag de módulo em playGoalAudio.
  const [goalAudioMuted, setGoalAudioMutedUi] = useState(() => isGoalAudioMuted());
  const toggleGoalAudioMuted = () => {
    setGoalAudioMuted(!goalAudioMuted);
    setGoalAudioMutedUi(!goalAudioMuted);
  };
  const suspensionsRef = useRef(suspensions);
  const injuriesRef = useRef(injuries);
  useEffect(() => { suspensionsRef.current = suspensions; }, [suspensions]);
  useEffect(() => { injuriesRef.current = injuries; }, [injuries]);

  // Partida ao vivo
  const [clockMinute, setClockMinute] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveScore, setLiveScore] = useState({ home: 0, away: 0 });
  const [roundResults, setRoundResults] = useState(null);
  // Placar de TODAS as rodadas já jogadas ({ [rodada]: resultados }) — o
  // `roundResults` acima guarda só a rodada atual (é sobrescrito), e o
  // `matchHistory` só os jogos do usuário. O calendário precisa do placar
  // de qualquer rodada passada. Save antigo sem esse campo vira {}.
  const [roundHistory, setRoundHistory] = useState(_sv?.roundHistory ?? {});
  const [activeUserMatch, setActiveUserMatch] = useState(null);

  const [simSpeed, setSimSpeed] = useState(1);
  const [simMode, setSimMode] = useState('manual'); // 'manual' | 'auto'
  const [autoCountdown, setAutoCountdown] = useState(null); // null | 1-3
  const [isPaused, setIsPaused] = useState(false);
  const [showSubPanel, setShowSubPanel] = useState(false);
  // Nome do jogador lesionado quando a pausa foi forçada por lesão (em vez de
  // uma pausa manual do usuário) — usado só pra avisar na UI o motivo da pausa.
  const [forcedSubReason, setForcedSubReason] = useState(null);
  const [subSelectStarter, setSubSelectStarter] = useState(null);
  const [liveLineup, setLiveLineup] = useState(null);
  // Jogadores que já saíram do jogo por substituição nesta partida — na vida
  // real quem sai não pode voltar, então ficam bloqueados na lista de reservas.
  const [subbedOutNames, setSubbedOutNames] = useState([]);
  // Simulação direta — avança a temporada inteira (inclusive as próprias
  // partidas) rodada a rodada, com texto animado, sem precisar clicar em cada
  // rodada nem assistir o jogo minuto a minuto.
  const [fastSimActive, setFastSimActive] = useState(false);
  const [fastSimStatusMsg, setFastSimStatusMsg] = useState('');
  const fastSimCancelRef = useRef(false);
  // Calendário da temporada: modal aberto, dia que o "cursor" da animação
  // está percorrendo, e se a simulação em andamento foi disparada por ele
  // (nesse caso o modal fica aberto animando, em vez do overlay genérico
  // "Simulando…" que a tela de jogo mostra pro fast-forward normal).
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarSimActive, setCalendarSimActive] = useState(false);
  const [calendarCursor, setCalendarCursor] = useState(null);
  const calendarCursorRef = useRef(null);
  // Velocidade da animação do calendário. Também em ref: o loop de simulação
  // é assíncrono e lê o valor a cada passo — sem a ref ele ficaria preso na
  // velocidade que estava valendo quando começou.
  const [calendarSpeed, setCalendarSpeed] = useState(1);
  const calendarSpeedRef = useRef(1);
  const changeCalendarSpeed = (s) => { calendarSpeedRef.current = s; setCalendarSpeed(s); };
  const [penaltyPhase, setPenaltyPhase] = useState(null);
  // Ref sincrono do penaltyPhase — goNextRound precisa checar "tem pênalti
  // rolando agora" sem depender do closure (que só atualiza no próximo
  // render), senão o avanço automático de rodada corre e declara campeão
  // antes mesmo do usuário terminar de ver as cobranças no modal.
  const penaltyPhaseRef = useRef(null);
  useEffect(() => { penaltyPhaseRef.current = penaltyPhase; }, [penaltyPhase]);

  const timerRef = useRef(null);
  const clockRef = useRef(null);
  const speedRef = useRef(1);
  const autoActionRef = useRef(null); // 'startRound' | 'nextRound'
  const startRoundRef = useRef(null);
  const goNextRoundRef = useRef(null);
  const isPausedRef = useRef(false);
  const tickFnRef = useRef(null);
  const liveLineupRef = useRef(null);
  // O tick() da partida precisa saber se está no modo automático (pra não
  // parar o jogo esperando um clique) e conseguir aplicar uma substituição —
  // ambos vêm por ref porque o tick roda dentro de um useCallback com
  // dependências próprias e pegaria versões velhas.
  const simModeRef = useRef('manual');
  const applyLiveSubRef = useRef(null);
  // Eventos já mostrados no feed da partida atual — precisa ser um ref (não só
  // a variável local `shown` dentro do tick()) porque uma substituição feita
  // com o jogo pausado é adicionada de fora do tick(); sem compartilhar o
  // mesmo array, o próximo tick sobrescrevia liveEvents com a lista antiga e
  // a troca sumia do feed assim que o jogo era retomado.
  const shownEventsRef = useRef([]);

  // No multiplayer, cada jogador é identificado pelo seu peerId (MY_PID) — não
  // pelo id fixo '__myteam__' usado no solo. Sem isso, o cliente nunca encontra
  // a própria partida na rodada e a simulação trava.
  const myTeamId = roomSnap ? MY_PID : MY_TEAM_ID;
  const myTeamIdRef = useRef(myTeamId);
  useEffect(() => { myTeamIdRef.current = myTeamId; }, [myTeamId]);

  useEffect(() => { speedRef.current = simSpeed; }, [simSpeed]);
  useEffect(() => { simModeRef.current = simMode; }, [simMode]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (clockRef.current) clearTimeout(clockRef.current);
  }, []);

  const filledSlots = Object.keys(pitch);
  const remainingSlots = pitchSlots.filter(s => !filledSlots.includes(s.key));

  const rollWithAnimation = useCallback((finalTeam, pool) => {
    setIsRolling(true);
    setSelectedPlayer(null);
    const spinPool = pool.length > 0 ? pool : TEAMS;
    const totalSteps = 18;
    let step = 0;
    const tick = () => {
      step++;
      setRollingPreview(shuffle2(spinPool)[0]);
      if (step >= totalSteps) {
        setRollingPreview(null);
        setIsRolling(false);
        setRolledTeam(finalTeam);
      } else {
        timerRef.current = setTimeout(tick, 50 + step * 12);
      }
    };
    timerRef.current = setTimeout(tick, 50);
  }, []);

  // O time sorteado é efêmero (nunca entra no save, e nem deveria — ele é
  // re-sorteado a cada escolha). Só que o SAVE guarda `phase: 'draft'`, então
  // recarregar a página no meio da escalação restaurava um Draft sem time
  // nenhum: caía na tela "os times disponíveis se esgotaram", que não tem
  // botão nenhum — e como o save continuava em 'draft', TODA recarga seguinte
  // voltava pro mesmo beco. Sortear de novo aqui devolve a pessoa exatamente
  // de onde parou. Fica reativo (não só no mount) pra também se recuperar de
  // qualquer outro caminho que deixe o draft sem time na mão.
  useEffect(() => {
    if (phase !== 'draft' || rolledTeam || isRolling) return;
    const candidates = TEAMS.filter(t => !usedTeamIds.includes(t.id));
    if (candidates.length === 0) return; // aí é o fim real da pool — a tela vazia tem saída própria
    rollWithAnimation(shuffle2(candidates)[0], candidates);
  }, [phase, rolledTeam, isRolling, usedTeamIds, rollWithAnimation]);

  const chooseFormation = (key) => {
    setFormationKey(key);
    const formSlots = buildPitchSlots(key);
    const benchSlots = ['bench1', 'bench2', 'bench3', 'bench4', 'bench5'].map((k, i) => ({
      key: k, label: `SUB ${i + 1}`, realPos: 'bench', isBench: true, x: 0, y: 0
    }));
    setPitchSlots([...formSlots, ...benchSlots]);
    setUsedTeamIds([]);
    setPitch({});
    setSkipsLeft(MAX_SKIPS);
    setLog([]);
    setSelectedPlayer(null);
    setRepositioningSlot(null);
    setCaptainSlot(null);
    setPhase('draft');
    rollWithAnimation(shuffle2(TEAMS)[0], TEAMS);
  };

  // Atalho "Jogar com este time pronto" — pula o sorteio inteiro e usa o
  // elenco real de UM time histórico como titulares+banco. Nome/escudo/cor
  // continuam sendo os seus (não vira o clube) — só o elenco é emprestado.
  // Mesmo fluxo funciona em sala com amigos: reaproveita o `phase='squad'`
  // que o draft normal (solo ou multiplayer) já termina nele, então o
  // capitão e o "Pronto!"/`multiConfirmDraft` seguem exatamente iguais.
  const useReadyMadeSquad = (team) => {
    const built = autoFillSquadFromTeam(team);
    if (!built) return; // não deveria acontecer com os elencos reais do jogo
    setFormationKey(built.formationKey);
    setPitchSlots(built.pitchSlots);
    setPitch(built.pitch);
    setUsedTeamIds([]);
    setSkipsLeft(MAX_SKIPS);
    setLog([]);
    setSelectedPlayer(null);
    setRepositioningSlot(null);
    setCaptainSlot(null);
    setRolledTeam(null);
    setPhase('squad');
  };

  // Supercopa do Brasil: escolheu enfrentar o time lendário de hoje — vai
  // pro fluxo normal de formação/sorteio (igual começar uma carreira do
  // zero), só guardando quem é o adversário pra montar o confronto quando a
  // escalação for confirmada (ver `confirmDailyChallenge`, o onConfirm da
  // tela de Squad).
  const [dailyOpponent, setDailyOpponent] = useState(_sv?.dailyOpponent ?? null);
  const startDailyChallenge = (opponent) => {
    setFormationKey(null);
    setPitchSlots([]);
    setPitch({});
    setUsedTeamIds([]);
    setSkipsLeft(MAX_SKIPS);
    setLog([]);
    setSelectedPlayer(null);
    setRepositioningSlot(null);
    setCaptainSlot(null);
    setRolledTeam(null);
    setDailyOpponent(opponent);
    setIsDailyChallenge(true);
    setShowDailyChallenge(false);
    setPhase('formation');
  };

  // onConfirm da tela de Squad quando isDailyChallenge — em vez de sortear
  // 19 adversários (startSeason), monta só o confronto de hoje: o time que
  // acabei de montar no draft vs o time lendário do dia, 1 rodada só. O
  // motor do Brasileirão já entende "1 rodada = última rodada" sozinho (ver
  // `regularRounds` em Playing), então não precisa de nada especial daqui
  // pra frente além da tela de resultado.
  const confirmDailyChallenge = () => {
    // Marca o dia como "gasto" já ao entrar em campo — nem perder ou
    // desistir no meio libera outra tentativa hoje.
    try { localStorage.setItem('brl_daily_done_date', dailyChallenge.dateKey); } catch { /* ignore */ }
    setDailyChallengeDoneDate(dailyChallenge.dateKey);
    const pitchWithCaptain = captainSlot && pitch[captainSlot]
      ? { ...pitch, [captainSlot]: { ...pitch[captainSlot], ovr: pitch[captainSlot].ovr + 2, isCaptain: true } }
      : pitch;
    const userOvr = teamStrength(pitchWithCaptain);
    const userPlayers = partitionStartersFirst(Object.values(pitchWithCaptain));
    const myTeamObj = { id: MY_TEAM_ID, label: myTeamName || 'Meu Time', badge: myTeamBadge, color: myTeamColor, logo: myTeamLogo, club: clubFromLogo(myTeamLogo), ovr: userOvr, players: userPlayers };
    const opp = dailyOpponent;
    // Time LENDÁRIO de verdade: escala sempre na dificuldade mais alta, não
    // na que a pessoa tem configurada pra carreira normal — é o que faz da
    // Supercopa um desafio à parte, igual pra todo mundo que jogar hoje.
    const oppPlayers = applyDifficultyToPlayers(
      opp.players.map(p => ({ ...p, club: opp.club, year: opp.year, nat: p.nat || 'BRA' })),
      'lendario'
    );
    const oppTeamObj = {
      id: opp.id, label: opp.label, club: opp.club, clubLogo: CLUB_LOGOS[opp.club] || null,
      ovr: teamStrength(Object.fromEntries(oppPlayers.map((p, i) => [i, p]))),
      players: oppPlayers,
    };
    setLeagueTeams([myTeamObj, oppTeamObj]);
    setLeagueTable([myTeamObj, oppTeamObj].map(t => ({ id: t.id, label: t.label, clubLogo: t.clubLogo || null, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 })));
    setFixtures([[{ homeId: MY_TEAM_ID, awayId: opp.id }]]);
    setCurrentRound(0);
    setGameMode('brasileirao');
    setClockMinute(0);
    setIsSimulating(false);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setRoundResults(null);
    setActiveUserMatch(null);
    setMatchHistory([]);
    setRoundHistory({});
    setScorers({});
    setAssisters({});
    setCleanSheets({});
    setSeasonRatings({});
    setCardCounts({});
    setRedCards({});
    setSuspensions({});
    setInjuries({});
    setLastRoundDiscipline(null);
    setLastMatchRatings(null);
    setTeamForm({});
    setSeasonAwards([]);
    setPhase('playing');
  };

  const openTransferMarket = () => setPhase('transfer');

  // Libera as vagas escolhidas (até 2) e reabre o draft só pra elas — mantém
  // formação, elenco restante e (se não foi liberado) o capitão intactos.
  const confirmTransferReleases = (slotKeysToRelease) => {
    setIsTransferSeason(true);
    if (slotKeysToRelease.length === 0) {
      newSeason();
      return;
    }
    setPitch(prev => {
      const next = { ...prev };
      slotKeysToRelease.forEach(k => delete next[k]);
      return next;
    });
    setCaptainSlot(prev => (slotKeysToRelease.includes(prev) ? null : prev));
    setUsedTeamIds([]);
    setSkipsLeft(MAX_SKIPS);
    setLog([]);
    setSelectedPlayer(null);
    setRepositioningSlot(null);
    setPhase('draft');
    rollWithAnimation(shuffle2(TEAMS)[0], TEAMS);
  };

  // Nomes já escalados (para bloquear o mesmo jogador de duas épocas diferentes).
  // Normaliza acento/maiúsculas antes de comparar — a base tem o mesmo jogador
  // grafado de formas diferentes em cartas de anos/times distintos (ex.:
  // "Rogerio Ceni" numa carta e "Rogério Ceni" noutra), e sem isso dava pra
  // escalar as duas cartas como se fossem jogadores diferentes.
  const pickedPlayerNames = useMemo(
    () => new Set(Object.values(pitch).map(p => normalizePlayerName(p.name))),
    [pitch]
  );

  // Estado de reposicionamento (mover jogador já escalado para outro slot)
  const [repositioningSlot, setRepositioningSlot] = useState(null); // slotKey original

  // Posições que existem de verdade nesse esquema (ex.: 4-4-2 em linha não
  // tem PD/PE/MEI). Um jogador cujas posições não batem com NENHUMA delas não
  // tem pra onde ir — nem titular, nem banco, já que na hora de substituir ele
  // também não teria vaga compatível pra entrar.
  const formationPosSet = useMemo(
    () => new Set(formationKey ? Object.keys(FORMATIONS[formationKey].counts) : []),
    [formationKey]
  );
  const isPlayerBlockedByFormation = (player) => !player.pos.some(p => formationPosSet.has(p));

  const eligibleSlotsForPlayer = (player) => {
    if (repositioningSlot === null && pickedPlayerNames.has(normalizePlayerName(player.name))) return [];
    if (isPlayerBlockedByFormation(player)) return [];
    // Expande as posições do próprio jogador (Pelé ['ATA','MEI'] → cobre PE, PD, VOL, MC…)
    const canPlayAt = new Set(player.pos);
    // Escalando da pool: só vaga vazia conta. Reposicionando (jogador já em
    // campo/banco, pego pra mover): TODA vaga compatível conta, mesmo ocupada
    // — é isso que permite trocar de lugar com quem já está lá (ex.: Ceni no
    // lugar do Cássio), não só cair numa vaga livre.
    const candidateSlots = repositioningSlot !== null ? pitchSlots : remainingSlots;
    return candidateSlots.filter(slot => {
      if (slot.isBench) return true;
      return canPlayAt.has(slot.realPos);
    });
  };

  const clickPlayer = (player) => {
    if (repositioningSlot !== null) {
      // Cancela reposição: devolve o jogador ao slot original
      const orig = selectedPlayer;
      setPitch(prev => ({ ...prev, [repositioningSlot]: orig }));
      setSelectedPlayer(null);
      setRepositioningSlot(null);
      return;
    }
    const slots = eligibleSlotsForPlayer(player);
    if (slots.length === 0) return;
    if (slots.length === 1) pickPlayerForSlot(player, slots[0].key);
    else setSelectedPlayer(player);
  };

  const clickPitchSlot = (slotKey) => {
    if (repositioningSlot !== null) {
      const targetMeta = pitchSlots.find(s => s.key === slotKey);
      if (!targetMeta) return;
      const player = selectedPlayer;
      const playerCanGoToTarget = targetMeta.isBench || player.pos.includes(targetMeta.realPos);
      if (!playerCanGoToTarget) return;
      const occupant = pitch[slotKey];
      // A braçadeira é por slot — se o capitão foi um dos jogadores movidos,
      // ela acompanha ele pro novo slot (null se ele saiu de campo: foi pro
      // banco ou foi deslocado de volta pro grupo por não caber na origem).
      let nextCaptainSlot = captainSlot;
      if (!occupant) {
        // Empty target – just place
        setPitch(prev => ({ ...prev, [slotKey]: { ...player, slotKey, isBench: !!targetMeta.isBench } }));
        if (repositioningSlot === captainSlot) nextCaptainSlot = targetMeta.isBench ? null : slotKey;
      } else {
        // Occupied target – try swap
        const srcMeta = pitchSlots.find(s => s.key === repositioningSlot);
        const occupantCanGoToSrc = !srcMeta || srcMeta.isBench || occupant.pos.includes(srcMeta.realPos);
        if (occupantCanGoToSrc) {
          setPitch(prev => ({
            ...prev,
            [slotKey]: { ...player, slotKey, isBench: !!targetMeta.isBench },
            [repositioningSlot]: { ...occupant, slotKey: repositioningSlot, isBench: !!srcMeta?.isBench },
          }));
          if (repositioningSlot === captainSlot) nextCaptainSlot = targetMeta.isBench ? null : slotKey;
          else if (slotKey === captainSlot) nextCaptainSlot = srcMeta?.isBench ? null : repositioningSlot;
        } else {
          // Occupant can't go to source slot – displace (remove) occupant
          setPitch(prev => {
            const next = { ...prev };
            delete next[repositioningSlot];
            next[slotKey] = { ...player, slotKey, isBench: !!targetMeta.isBench };
            return next;
          });
          if (repositioningSlot === captainSlot) nextCaptainSlot = targetMeta.isBench ? null : slotKey;
          else if (slotKey === captainSlot) nextCaptainSlot = null; // ocupante foi removido do time, não tem pra onde a braçadeira ir
        }
      }
      if (nextCaptainSlot !== captainSlot) setCaptainSlot(nextCaptainSlot);
      setSelectedPlayer(null);
      setRepositioningSlot(null);
      return;
    }
    if (selectedPlayer) {
      if (!eligibleSlotsForPlayer(selectedPlayer).some(s => s.key === slotKey)) return;
      pickPlayerForSlot(selectedPlayer, slotKey);
    }
  };

  const startReposition = (slotKey) => {
    const player = pitch[slotKey];
    if (!player) return;
    // Remove temporariamente do campo para liberar o slot nos remainingSlots
    setPitch(prev => { const next = { ...prev }; delete next[slotKey]; return next; });
    setSelectedPlayer(player);
    setRepositioningSlot(slotKey);
  };

  const pauseSim = () => {
    if (clockRef.current) clearTimeout(clockRef.current);
    clockRef.current = null;
    isPausedRef.current = true;
    setIsPaused(true);
    setShowSubPanel(true);
  };

  const resumeSim = () => {
    isPausedRef.current = false;
    setIsPaused(false);
    setShowSubPanel(false);
    setSubSelectStarter(null);
    setForcedSubReason(null);
    if (tickFnRef.current) {
      const MS = { 1: 250, 1.5: 125, 2: 55 };
      clockRef.current = setTimeout(tickFnRef.current, MS[speedRef.current] ?? 250);
    }
  };

  // Atalhos de teclado (só faz sentido no desktop, mas não atrapalha o
  // celular) — espaço pausa/retoma a partida ao vivo, setas mudam a
  // velocidade. Ignora quando o foco está num campo de texto (nome do time,
  // chat, etc.), senão espaço/setas quebrariam a digitação normal.
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      if (phase !== 'playing') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (isSimulating && !isPaused) pauseSim();
        else if (isPaused) resumeSim();
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowRight') {
        e.preventDefault();
        setSimSpeed(s => (s === 1 ? 1.5 : s === 1.5 ? 2 : 2));
      } else if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') {
        e.preventDefault();
        setSimSpeed(s => (s === 2 ? 1.5 : s === 1.5 ? 1 : 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, isSimulating, isPaused]);

  const applyLiveSub = (starterKey, benchPlayer) => {
    const starter = liveLineupRef.current?.[starterKey];
    if (!starter || !benchPlayer) return;
    // Quem já saiu do jogo nesta partida não pode voltar (igual na vida real).
    if (subbedOutNames.includes(benchPlayer.name)) return;
    const starterMeta = pitchSlots.find(s => s.key === starterKey);
    if (starterMeta && !benchPlayer.pos.includes(starterMeta.realPos) && !starterMeta.isBench) return;
    setLiveLineup(prev => {
      const next = { ...prev };
      const benchKey = Object.keys(next).find(k => next[k].name === benchPlayer.name);
      next[starterKey] = { ...benchPlayer, slotKey: starterKey, isBench: false };
      if (benchKey) next[benchKey] = { ...starter, slotKey: benchKey, isBench: true };
      liveLineupRef.current = next;
      return next;
    });
    // Persiste no elenco da temporada — sem isso, a troca desaparecia assim
    // que a próxima rodada reconstruía o time do zero a partir do `pitch`.
    setPitch(prev => {
      const next = { ...prev };
      const benchKey = Object.keys(next).find(k => next[k].name === benchPlayer.name);
      next[starterKey] = { ...benchPlayer, slotKey: starterKey, isBench: false };
      if (benchKey) next[benchKey] = { ...starter, slotKey: benchKey, isBench: true };
      return next;
    });
    // Também sincroniza o `leagueTeams` — é ELE (não o `pitch`) que a
    // simulação usa (getStarters/teamsForRound) pra decidir quem joga na
    // PRÓXIMA rodada. Sem isso, a troca aparecia certa na tela (liveLineup
    // vem do pitch) mas a simulação seguinte continuava sorteando gols pro
    // titular antigo, porque leagueTeams só é reconstruído em startSeason/
    // newSeason, nunca durante a temporada.
    setLeagueTeams(prev => prev.map(t => {
      if (t.id !== myTeamId) return t;
      const nextPlayers = t.players.map(pl => {
        if (pl.name === starter.name) return { ...pl, isBench: true };
        if (pl.name === benchPlayer.name) return { ...pl, isBench: false };
        return pl;
      });
      return { ...t, players: nextPlayers, ovr: teamStrength(Object.fromEntries(nextPlayers.map((p, i) => [i, p]))) };
    }));
    setSubbedOutNames(prev => [...prev, starter.name]);
    setSubSelectStarter(null);
    // Mostra a troca no feed da partida, igual gol/cartão/lesão — empurra no
    // MESMO array que o tick() usa (shownEventsRef), senão o próximo tick
    // sobrescrevia liveEvents com a lista antiga e a troca sumia do feed.
    shownEventsRef.current.push({
      type: 'substitution',
      minute: clockMinute,
      teamId: myTeamId,
      teamLabel: myTeamName || 'Meu Time',
      playerOut: starter.name,
      playerIn: benchPlayer.name,
      homeScore: liveScore.home,
      awayScore: liveScore.away,
    });
    setLiveEvents([...shownEventsRef.current]);
  };
  useEffect(() => { applyLiveSubRef.current = applyLiveSub; });

  // Substituição escolhida pelo próprio jogo (modo automático): o melhor
  // reserva compatível com a vaga de quem saiu. Devolve true se conseguiu —
  // se o banco não tiver ninguém que jogue ali, o time segue com um a menos,
  // igual à troca manual quando tudo está bloqueado.
  const autoSubForSlot = (slotKey) => {
    const lineup = liveLineupRef.current || {};
    const slotMeta = pitchSlots.find(s => s.key === slotKey);
    const candidates = Object.values(lineup)
      .filter(p => p?.isBench && !subbedOutNames.includes(p.name))
      .filter(p => !slotMeta || slotMeta.isBench || (p.pos || []).includes(slotMeta.realPos))
      .sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
    if (candidates.length === 0) return false;
    applyLiveSubRef.current?.(slotKey, candidates[0]);
    return true;
  };

  const pickPlayerForSlot = (player, slotKey) => {
    const isBench = pitchSlots.find(s => s.key === slotKey)?.isBench || false;
    setPitch(prev => ({ ...prev, [slotKey]: { ...player, teamLabel: rolledTeam.label, teamId: rolledTeam.id, club: rolledTeam.club, year: rolledTeam.year, nat: player.nat || 'BRA', isBench, slotKey } }));
    setUsedTeamIds(prev => [...prev, rolledTeam.id]);
    setLog(prev => [...prev, { teamLabel: rolledTeam.label, playerName: player.name, slot: slotKey }]);
    setSelectedPlayer(null);
    const stillRemaining = pitchSlots.filter(s => s.key !== slotKey && !filledSlots.includes(s.key));
    if (stillRemaining.length === 0) {
      setPhase('squad');
      setRolledTeam(null);
    } else {
      const candidates = TEAMS.filter(t => !usedTeamIds.includes(t.id) && t.id !== rolledTeam.id);
      if (candidates.length === 0) { setPhase('squad'); }
      else rollWithAnimation(shuffle2(candidates)[0], candidates);
    }
  };

  // Time sorteado em que NENHUM jogador cabe nas vagas que sobraram (ex.: só
  // falta a vaga de PE, o banco já está cheio e o time não tem ponta esquerda).
  // Sem os 3 pulos na mão isso deixava a tela inteira sem uma única ação
  // possível — jogador nenhum clicável, "pular" desabilitado — e o único jeito
  // de sair era limpar o navegador. Nesse caso o pulo passa a ser de graça.
  const rolledTeamHasNoFit = useMemo(() => {
    if (!rolledTeam || isRolling || repositioningSlot !== null) return false;
    return rolledTeam.players.every(p => eligibleSlotsForPlayer(p).length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolledTeam, isRolling, repositioningSlot, remainingSlots, pickedPlayerNames, formationPosSet]);

  const skipTeam = () => {
    if (!rolledTeam) return;
    if (skipsLeft <= 0 && !rolledTeamHasNoFit) return;
    // Pulo forçado (nada cabe) não consome a cota — a pessoa não escolheu isso.
    if (skipsLeft > 0) setSkipsLeft(s => s - 1);
    setUsedTeamIds(prev => [...prev, rolledTeam.id]);
    setLog(prev => [...prev, { teamLabel: rolledTeam.label, skipped: true }]);
    setSelectedPlayer(null);
    const candidates = TEAMS.filter(t => ![...usedTeamIds, rolledTeam.id].includes(t.id));
    if (candidates.length === 0) setPhase('squad');
    else rollWithAnimation(shuffle2(candidates)[0], candidates);
  };

  const startSeason = () => {
    // Carreira nova do zero: o calendário volta a começar no ano real de
    // hoje, mesmo que a carreira anterior (via "Nova Temporada") já tivesse
    // avançado vários anos.
    setSeasonYear(new Date().getFullYear());
    // Aplica +2 OVR ao capitão antes de calcular o time
    const pitchWithCaptain = captainSlot && pitch[captainSlot]
      ? { ...pitch, [captainSlot]: { ...pitch[captainSlot], ovr: pitch[captainSlot].ovr + 2, isCaptain: true } }
      : pitch;
    const userOvr = teamStrength(pitchWithCaptain);
    const userPlayers = partitionStartersFirst(Object.values(pitchWithCaptain));

    const neededAI = (gameMode === 'brasileirao' || gameMode === 'serieab') ? 19 : 31;
    // Gera pool com repetição se necessário
    let pool = [];
    while (pool.length < neededAI) pool = [...pool, ...shuffle2([...TEAMS])];
    const opps = pool.slice(0, neededAI).map((t, idx) => {
      // Adiciona club/year/nat — usados no hino do clube, no áudio de gol e na visualização de elenco
      const playersWithMeta = applyDifficultyToPlayers(
        t.players.map(p => ({ ...p, club: t.club, year: t.year, nat: p.nat || 'BRA' })),
        difficulty
      );
      return {
        id: `${t.id}_${idx}`,
        label: t.label,
        club: t.club,
        clubLogo: CLUB_LOGOS[t.club] || null,
        ovr: teamStrength(Object.fromEntries(playersWithMeta.map((p, i) => [i, p]))),
        players: playersWithMeta,
      };
    });

    const myTeamObj = { id: MY_TEAM_ID, label: myTeamName || 'Meu Time', badge: myTeamBadge, color: myTeamColor, logo: myTeamLogo, club: clubFromLogo(myTeamLogo), ovr: userOvr, players: userPlayers };
    const allTeams = [myTeamObj, ...opps];

    setLeagueTeams(allTeams);
    setClockMinute(0);
    setIsSimulating(false);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setRoundResults(null);
    setActiveUserMatch(null);
    setMatchHistory([]);
    setRoundHistory({});
    setCalendarCursor(null);
    calendarCursorRef.current = null;
    setScorers({});
    setAssisters({});
    setCleanSheets({});
    setSeasonRatings({});
    setCardCounts({});
    setRedCards({});
    setSuspensions({});
    setInjuries({});
    setLastRoundDiscipline(null);
    setLastMatchRatings(null);
    setTeamForm({});
    setSeasonAwards([]);
    setEliminationRoundName(null);
    setBracketAdvance(null);
    resultsAfterBracketRef.current = false;
    // Mesmo vazamento do multiplayer (ver o efeito de `roomSnap.phase ===
    // 'simulation'`): sair no meio de um Desafio do Dia sem terminar (o
    // "voltar ao menu" de propósito não apaga o save) e começar uma
    // temporada normal em seguida prendia essa flag em `true` — a temporada
    // inteira caía no branch de Desafio do Dia dentro de `applySeasonAwards`
    // e nunca submetia o resultado de verdade pro ranking.
    setIsDailyChallenge(false);
    setDailyOpponent(null);

    if (gameMode === 'brasileirao' || gameMode === 'serieab') {
      // Embaralha só a ordem passada pro gerador de tabela: o método do
      // círculo mantém o índice 0 fixo, então a POSIÇÃO no array determina em
      // que rodada cada dupla se enfrenta. Com o time do usuário sempre no
      // índice 0, o padrão de adversários saía idêntico toda temporada.
      const rounds = generateDoubleRoundRobin(shuffle2(allTeams.map(t => t.id)));
      const table = allTeams.map(t => ({ id: t.id, label: t.label, clubLogo: t.clubLogo || null, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }));
      setFixtures(rounds);
      setLeagueTable(table);
      setCurrentRound(0);
      setCupRounds([]);
      setCupRoundIdx(0);
      setCupLeg(1);
      setUserInCup(true);
      setCupWinnerId(null);
      if (gameMode === 'serieab') {
        // Começo de carreira sempre entra pela Série A — só a partir da
        // segunda temporada (via "Nova Temporada", depois de um rebaixamento)
        // é que da pra estar na B. idxOffset=19: os 19 adversários da divisão
        // do jogador já usaram os índices 0-18 no sorteio acima, então a
        // divisão espelho começa do 19 — sem isso os dois sorteios podiam
        // gerar o mesmo id de time em divisões diferentes.
        setMyDivision('A');
        setOtherDivision(buildMirrorDivision(difficulty, 19));
        setDivisionMove(null);
        setPromotionTie(null);
      }
    } else {
      // Copa do Brasil
      const firstMatches = generateCupFirstRound(allTeams.map(t => t.id));
      const firstRound = { name: CUP_ROUND_NAMES[0], matches: firstMatches, leg1Results: [], results: [] };
      setCupRounds([firstRound]);
      setCupRoundIdx(0);
      setCupLeg(1);
      setUserInCup(true);
      setCupWinnerId(null);
      setFixtures([firstMatches]);
      setCurrentRound(0);
      setLeagueTable([]);
    }
    setPhase('playing');
  };

  const startRound = useCallback(() => {
    if (isSimulating) return;
    const round = fixtures[currentRound];
    const um = round.find(m => m.homeId === myTeamId || m.awayId === myTeamId);
    const unavailableNames = unavailableNamesFrom(suspensionsRef.current, injuriesRef.current);
    const roundTeams = teamsForRound(leagueTeams, unavailableNames, teamForm);

    if (!um) {
      // Copa: user already eliminated — fast-simulate this AI-only round
      if (gameMode !== 'copa' || userInCupRef.current) return;
      const occurrences = [];
      const allGoals = [];
      const cleanSheetEntries = [];
      let ratingsAcc = seasonRatings;
      const allResults = round.map(m => {
        const h = roundTeams.find(t => t.id === m.homeId);
        const a = roundTeams.find(t => t.id === m.awayId);
        if (!h || !a) return { homeId: m.homeId, awayId: m.awayId, homeGoals: 0, awayGoals: 0 };
        const sim = simAiMatch(h, a, matchPrng(roomSnap?.seed, currentRound, m.homeId, m.awayId));
        occurrences.push(...(sim.discipline || []));
        allGoals.push(...(sim.goals || []));
        cleanSheetEntries.push(
          { teamId: h.id, teamLabel: h.label, gkName: sim.homeGkName, conceded: sim.awayGoals },
          { teamId: a.id, teamLabel: a.label, gkName: sim.awayGkName, conceded: sim.homeGoals },
        );
        ratingsAcc = applySeasonRatings(ratingsAcc, sim.ratings);
        return { homeId: m.homeId, awayId: m.awayId, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
      });
      setRoundResults(allResults);
      // Pênaltis dos confrontos só de IA. Sem gravar isso, `cupMatchOutcome`
      // não conseguia dizer quem passou num agregado empatado (ele lê
      // `penaltyResults` da fase), e o chaveamento deixava o confronto sem
      // classificado: bloco sem dourado e a linha até a fase seguinte apagada,
      // mesmo com o time já classificado de fato. Só era gravado quando o
      // próprio usuário jogava a fase.
      setCupRounds(prev => prev.map((r, i) => {
        if (i !== cupRoundIdx) return r;
        const isFinalRound = (r.matches?.length || 0) === 1;
        if (cupLegRef.current !== 2 && !isFinalRound) return { ...r, results: allResults };
        const leg1Res = isFinalRound ? [] : (r.leg1Results || []);
        const penaltyResults = [];
        (r.matches || []).forEach((match, i2) => {
          const l2 = allResults[i2] || { homeGoals: 0, awayGoals: 0 };
          const l1 = leg1Res[i2] || { homeGoals: 0, awayGoals: 0 };
          const aggA = isFinalRound ? l2.homeGoals : l1.homeGoals + l2.awayGoals;
          const aggB = isFinalRound ? l2.awayGoals : l1.awayGoals + l2.homeGoals;
          if (aggA !== aggB) return;
          // Mesma chave de seed usada pelo goNextRound, pra o vencedor mostrado
          // no chaveamento ser exatamente o que avança.
          const penRand = matchPrng(roomSnap?.seed, `${cupRoundIdx}-${cupLegRef.current}-pen`, match.homeId, match.awayId);
          penaltyResults.push({ matchIdx: i2, ...simulatePenalties(match.homeId, match.awayId, leagueTeams, penRand) });
        });
        return { ...r, results: allResults, ...(penaltyResults.length > 0 ? { penaltyResults } : {}) };
      }));
      setTeamForm(prev => updateFormFromResults(prev, allResults));
      setScorers(prev => applyGoalsToScorers(prev, allGoals));
      setAssisters(prev => applyGoalsToAssisters(prev, allGoals));
      setCleanSheets(prev => applyCleanSheets(prev, cleanSheetEntries));
      setSeasonRatings(ratingsAcc);
      const { cards, suspensions: susp, injuries: inj } = applyRoundDiscipline(cardCounts, suspensions, injuries, occurrences);
      setCardCounts(cards); setSuspensions(susp); setInjuries(inj);
      setRedCards(prev => {
        const next = { ...prev };
        occurrences.forEach(o => { if (o.type === 'red') { const k = playerKey(o.teamId, o.player); next[k] = (next[k] || 0) + 1; } });
        return next;
      });
      return;
    }

    const homeTeam = roundTeams.find(t => t.id === um.homeId);
    const awayTeam = roundTeams.find(t => t.id === um.awayId);
    const homeXI = getStarters(homeTeam);
    const awayXI = getStarters(awayTeam);
    const matchRand = matchPrng(roomSnap?.seed, currentRound, um.homeId, um.awayId);
    const sim = simAiMatch(homeTeam, awayTeam, matchRand);
    const events = buildLiveMatchEvents(sim, homeTeam, homeXI, awayTeam, awayXI);

    setActiveUserMatch(um);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setClockMinute(0);
    setRoundResults(null);
    setLastMatchRatings(null);
    setIsSimulating(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setShowSubPanel(false);
    setSubSelectStarter(null);
    setForcedSubReason(null);
    setPenaltyPhase(null);
    setSubbedOutNames([]);
    // Init live lineup from current pitch — mas se algum titular do usuário
    // está suspenso/lesionado nesta rodada (mesma troca que o motor de
    // simulação já aplicou via getEligibleRoster/teamsForRound pro homeTeam/
    // awayTeam acima), espelha essa troca aqui também. Sem isso o painel de
    // troca e a cobrança de pênalti mostravam o titular "castigado" como se
    // estivesse em campo, mesmo ele nunca tendo entrado na simulação real.
    // Não persiste em `pitch`/`leagueTeams` — é só pra essa partida, igual
    // a troca automática nas outras rodadas (efêmera, recalculada do zero).
    let initLL = { ...pitch };
    const myLeagueTeam = leagueTeams.find(t => t.id === myTeamId);
    if (myLeagueTeam) {
      const { changes: myChanges } = getEligibleRoster(myLeagueTeam, unavailableNames);
      if (myChanges.length > 0) {
        const next = { ...initLL };
        myChanges.forEach(({ out, in: inName }) => {
          if (!inName) return;
          const outKey = Object.keys(next).find(k => next[k]?.name === out && !next[k]?.isBench);
          const inKey = Object.keys(next).find(k => next[k]?.name === inName);
          if (!outKey || !inKey) return;
          const outPlayer = next[outKey];
          const inPlayer = next[inKey];
          next[outKey] = { ...inPlayer, slotKey: outKey, isBench: false };
          next[inKey] = { ...outPlayer, slotKey: inKey, isBench: true };
        });
        initLL = next;
      }
    }
    setLiveLineup(initLL);
    liveLineupRef.current = initLL;

    const SPEED_MS = { 1: 250, 1.5: 125, 2: 55 };

    let minute = 0;
    let evIdx = 0;
    let hs = 0;
    let as_ = 0;
    shownEventsRef.current = [];

    const tick = () => {
      minute++;
      let lastGoalThisTick = null;
      let injuredMyPlayerEvent = null;

      while (evIdx < events.length && events[evIdx].minute <= minute) {
        const ev = events[evIdx];
        evIdx++;
        if (ev.type !== 'goal') {
          // Cartão/lesão: entra no feed mas não mexe no placar nem toca áudio de gol.
          shownEventsRef.current.push({ ...ev, homeScore: hs, awayScore: as_ });
          if ((ev.type === 'yellow' || ev.type === 'red') && ev.teamId === myTeamId) hapticPulse(HAPTIC.card);
          if (ev.type === 'penalty_miss') hapticPulse(HAPTIC.penaltyMiss);
          if (ev.type === 'injury') {
            if (ev.teamId === myTeamId) {
              // Lesão do meu jogador: para o jogo aqui — o resto dos eventos
              // deste minuto (se houver) só é processado depois que o usuário
              // escolher o substituto e retomar.
              injuredMyPlayerEvent = ev;
              break;
            } else if (ev.replacementName) {
              // Lesão do adversário: substituição automática só cosmética no
              // feed (o resultado do jogo já foi decidido inteiro na geração
              // dos eventos, então isso não muda a força do time adversário).
              shownEventsRef.current.push({
                type: 'substitution', minute: ev.minute, teamId: ev.teamId, teamLabel: ev.teamLabel,
                playerOut: ev.player, playerIn: ev.replacementName, homeScore: hs, awayScore: as_,
              });
            }
          }
          continue;
        }
        if (ev.teamId === um.homeId) hs++;
        else as_++;
        shownEventsRef.current.push({ ...ev, homeScore: hs, awayScore: as_ });
        hapticPulse(ev.teamId === myTeamId ? HAPTIC.goal : HAPTIC.concede);
        // Record scorer (gols contra nao contam pro artilheiro). Chave por
        // time+nome — nomes reais se repetem em elencos de times/anos
        // diferentes (ex.: "Edmundo"), e uma chave só por nome fundia os
        // gols de dois jogadores distintos caso ambos caíssem na mesma liga.
        if (!ev.isOwnGoal) {
          const scorerKey = playerKey(ev.teamId, ev.scorer);
          setScorers(prev => ({
            ...prev,
            [scorerKey]: { goals: (prev[scorerKey]?.goals || 0) + 1, teamLabel: ev.teamLabel }
          }));
        }
        if (ev.assist) {
          const assistKey = playerKey(ev.teamId, ev.assist);
          setAssisters(prev => ({
            ...prev,
            [assistKey]: { assists: (prev[assistKey]?.assists || 0) + 1, teamLabel: ev.teamLabel }
          }));
        }
        lastGoalThisTick = {
          club: ev.teamId === homeTeam.id ? homeTeam.club : awayTeam.club,
          customUrl: ev.teamId === myTeamId ? currentUser?.goal_audio : null,
        };
      }

      setClockMinute(minute);
      setLiveScore({ home: hs, away: as_ });
      if (shownEventsRef.current.length > 0) setLiveEvents([...shownEventsRef.current]);

      if (minute >= 90) {
        setIsSimulating(false);

        // Placar oficial vem do `sim` (mesmo motor/seed usado por todos os
        // clientes pra essa partida) — não do `hs`/`as_` acumulado localmente
        // no tick, que por construção já deveria bater, mas usar `sim` direto
        // garante que o resultado registrado é exatamente o mesmo que
        // qualquer outro peer no multiplayer calcula pra esse confronto.
        const finalHs = sim.homeGoals;
        const finalAs = sim.awayGoals;

        const ratings = sim.ratings;
        setLastMatchRatings(ratings);
        let ratingsAcc = applySeasonRatings(seasonRatings, ratings);

        // Record match in history
        setMatchHistory(prev => [...prev, {
          round: currentRound + 1,
          homeLabel: homeTeam.label,
          awayLabel: awayTeam.label,
          hg: finalHs,
          ag: finalAs,
          isUser: true,
          gameMode,
          legLabel: gameMode === 'copa' ? (cupLegRef.current === 1 ? 'Ida' : 'Volta')
            : (gameMode === 'serieab' && promotionTie?.leg) ? (promotionTie.leg === 1 ? 'Ida — Acesso' : 'Volta — Acesso')
            : undefined,
          ratings,
        }]);

        // Simular todos os jogos da rodada
        const occurrences = events.filter(ev => ev.type !== 'goal').map(ev => ({ type: ev.type, teamId: ev.teamId, player: ev.player, rounds: ev.rounds, secondYellow: ev.secondYellow }));
        const otherMatchGoals = [];
        const cleanSheetEntries = [
          { teamId: homeTeam.id, teamLabel: homeTeam.label, gkName: pickGkName(homeXI), conceded: finalAs },
          { teamId: awayTeam.id, teamLabel: awayTeam.label, gkName: pickGkName(awayXI), conceded: finalHs },
        ];
        const results = round.map(m => {
          if (m.homeId === um.homeId && m.awayId === um.awayId)
            return { homeId: m.homeId, awayId: m.awayId, homeGoals: finalHs, awayGoals: finalAs };
          const h = roundTeams.find(t => t.id === m.homeId);
          const a = roundTeams.find(t => t.id === m.awayId);
          const sim = simAiMatch(h, a, matchPrng(roomSnap?.seed, currentRound, m.homeId, m.awayId));
          occurrences.push(...(sim.discipline || []));
          otherMatchGoals.push(...(sim.goals || []));
          cleanSheetEntries.push(
            { teamId: h.id, teamLabel: h.label, gkName: sim.homeGkName, conceded: sim.awayGoals },
            { teamId: a.id, teamLabel: a.label, gkName: sim.awayGkName, conceded: sim.homeGoals },
          );
          ratingsAcc = applySeasonRatings(ratingsAcc, sim.ratings);
          return { homeId: m.homeId, awayId: m.awayId, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
        });

        setRoundResults(results);
        setRoundHistory(prev => ({ ...prev, [currentRound]: results }));
        setTeamForm(prev => updateFormFromResults(prev, results));
        setSeasonRatings(ratingsAcc);
        if (otherMatchGoals.length > 0) {
          setScorers(prev => applyGoalsToScorers(prev, otherMatchGoals));
          setAssisters(prev => applyGoalsToAssisters(prev, otherMatchGoals));
        }
        setCleanSheets(prev => applyCleanSheets(prev, cleanSheetEntries));
        const { cards, suspensions: susp, injuries: inj } = applyRoundDiscipline(cardCounts, suspensions, injuries, occurrences);
        setCardCounts(cards); setSuspensions(susp); setInjuries(inj);
        setRedCards(prev => {
          const next = { ...prev };
          occurrences.forEach(o => { if (o.type === 'red') { const k = playerKey(o.teamId, o.player); next[k] = (next[k] || 0) + 1; } });
          return next;
        });
        setLastRoundDiscipline(occurrences.length > 0 ? occurrences : null);

        if (gameMode === 'brasileirao' || gameMode === 'serieab') {
          setLeagueTable(prev => {
            const tbl = prev.map(r => ({ ...r }));
            results.forEach(res => {
              const h = tbl.find(t => t.id === res.homeId);
              const a = tbl.find(t => t.id === res.awayId);
              if (!h || !a) return;
              h.pj++; a.pj++;
              h.gp += res.homeGoals; h.gc += res.awayGoals;
              a.gp += res.awayGoals; a.gc += res.homeGoals;
              if (res.homeGoals > res.awayGoals) { h.v++; h.pts += 3; a.d++; }
              else if (res.homeGoals < res.awayGoals) { a.v++; a.pts += 3; h.d++; }
              else { h.e++; h.pts++; a.e++; a.pts++; }
            });
            return [...tbl].sort((a, b) =>
              b.pts - a.pts || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp
            );
          });
        } else {
          // Copa: registrar resultado da rodada
          setCupRounds(prev => {
            const baseUpdated = prev.map((r, i) => i === cupRoundIdx ? { ...r, results } : r);
            const cupRoundDataPeek = baseUpdated[cupRoundIdx];
            // Final é jogo único (2 times = 1 partida) — decide tudo na hora,
            // sem esperar um jogo de volta que nunca vai existir.
            const isFinal = (cupRoundDataPeek?.matches?.length || 0) === 1;
            // Leg 2 (ou a final de jogo único, que nunca sai da leg 1): calcular pênaltis e verificar eliminação por agregado
            if (cupLegRef.current === 2 || (cupLegRef.current === 1 && isFinal)) {
              const cupRoundData = baseUpdated[cupRoundIdx];
              const leg1Res = isFinal ? [] : (cupRoundData?.leg1Results || []);
              const penaltyResults = [];

              // Compute penalties for all tied matches (regra do gol fora foi extinta — empate no agregado já vai para os pênaltis)
              cupRoundData?.matches?.forEach((match, i) => {
                const l2 = results[i] || { homeGoals: 0, awayGoals: 0 };
                let aggA, aggB;
                if (isFinal) { aggA = l2.homeGoals; aggB = l2.awayGoals; }
                else {
                  const l1 = leg1Res[i] || { homeGoals: 0, awayGoals: 0 };
                  aggA = l1.homeGoals + l2.awayGoals;
                  aggB = l1.awayGoals + l2.homeGoals;
                }
                if (aggA === aggB) {
                  const penRand = matchPrng(roomSnap?.seed, `${cupRoundIdx}-${cupLegRef.current}-pen`, match.homeId, match.awayId);
                  const pen = simulatePenalties(match.homeId, match.awayId, leagueTeams, penRand);
                  penaltyResults.push({ matchIdx: i, ...pen });
                }
              });

              // User elimination check
              const userMatchIdx = cupRoundData?.matches?.findIndex(m => m.homeId === myTeamId || m.awayId === myTeamId) ?? -1;
              if (userMatchIdx >= 0) {
                const match = cupRoundData.matches[userMatchIdx];
                const l2 = results[userMatchIdx] || { homeGoals: 0, awayGoals: 0 };
                const isHome = match.homeId === myTeamId;
                let userAgg, oppAgg;
                if (isFinal) {
                  userAgg = isHome ? l2.homeGoals : l2.awayGoals;
                  oppAgg = isHome ? l2.awayGoals : l2.homeGoals;
                } else {
                  const l1 = leg1Res[userMatchIdx] || { homeGoals: 0, awayGoals: 0 };
                  userAgg = isHome ? (l1.homeGoals + l2.awayGoals) : (l1.awayGoals + l2.homeGoals);
                  oppAgg = isHome ? (l1.awayGoals + l2.homeGoals) : (l1.homeGoals + l2.awayGoals);
                }
                if (userAgg < oppAgg) {
                  setUserInCup(false);
                  setEliminationRoundName(cupRoundData?.name || CUP_ROUND_NAMES[cupRoundIdx] || 'Copa');
                } else if (userAgg === oppAgg) {
                  // Empate no agregado (regra do gol fora foi extinta) — decide nos pênaltis
                  const userPen = penaltyResults.find(pr => pr.matchIdx === userMatchIdx);
                  if (userPen) {
                    if (userPen.winner !== myTeamId) {
                      setUserInCup(false);
                      setEliminationRoundName(cupRoundData?.name || CUP_ROUND_NAMES[cupRoundIdx] || 'Copa');
                    }
                    // homeTeam/awayTeam (topo do startRound) refletem a orientação do jogo de volta,
                    // enquanto isHome/match refletem a orientação do jogo de ida — não são a mesma coisa.
                    // Buscar direto pelo id evita trocar "meu time" pelo adversário quando o mando de campo inverte.
                    const myT = leagueTeams.find(t => t.id === myTeamId);
                    const opT = leagueTeams.find(t => t.id === (isHome ? match.awayId : match.homeId));
                    // Só quem termina em campo pode cobrar — 11 titulares (já
                    // considerando substituições feitas ao longo do jogo), nunca
                    // o banco inteiro de 16.
                    const myPlayers = liveLineupRef.current
                      ? Object.values(liveLineupRef.current).filter(p => !p.isBench)
                      : (myT?.players || []).slice(0, 11);
                    // Busca por posição, não por índice fixo — o elenco do usuário não
                    // garante o goleiro na posição 0 (só titulares-antes-de-reservas).
                    const myGk = (myPlayers || []).find(p => p.pos?.[0] === 'GOL')?.name || 'Goleiro';
                    const oppGk = (opT?.players || []).find(p => p.pos?.[0] === 'GOL')?.name || 'Goleiro';
                    setPenaltyPhase({
                      kicks: userPen.kicks,
                      winner: userPen.winner,
                      homeId: match.homeId,
                      awayId: match.awayId,
                      myIsHome: isHome,
                      myTeamLabel: myT?.label || 'Meu Time',
                      oppTeamLabel: opT?.label || 'Adversario',
                      myGkName: myGk,
                      oppGkName: oppGk,
                      myPlayers,
                    });
                  }
                }
              }

              // Store penalty results on the cup round
              if (penaltyResults.length > 0) {
                return baseUpdated.map((r, i) => i === cupRoundIdx ? { ...r, penaltyResults } : r);
              }
            }
            return baseUpdated;
          });
        }
      } else if (injuredMyPlayerEvent) {
        const hurtSlotKey = Object.keys(liveLineupRef.current || {}).find(
          k => liveLineupRef.current[k]?.name === injuredMyPlayerEvent.player && !liveLineupRef.current[k]?.isBench
        );
        // Meu jogador se machucou: para o jogo e abre o painel de troca com
        // ele já pré-selecionado, igual uma pausa manual — só falta o usuário
        // escolher o reserva (ou seguir com um a menos, se não houver um
        // compatível) e clicar em retomar.
        const doForcedPause = () => {
          isPausedRef.current = true;
          setIsPaused(true);
          setShowSubPanel(true);
          setForcedSubReason(injuredMyPlayerEvent.player);
          if (hurtSlotKey) setSubSelectStarter(hurtSlotKey);
        };
        // ...menos no modo automático, onde não existe "o usuário escolher":
        // o jogo faz a troca sozinho e segue. Sem isso a partida ficava parada
        // pra sempre no painel de substituição, e o campeonato inteiro travava
        // na primeira lesão.
        const handleInjury = () => {
          if (simModeRef.current === 'auto') {
            if (hurtSlotKey) autoSubForSlot(hurtSlotKey);
            clockRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
            return;
          }
          doForcedPause();
        };
        if (lastGoalThisTick) playGoalAudio(lastGoalThisTick.club, lastGoalThisTick.customUrl, handleInjury);
        else handleInjury();
      } else if (lastGoalThisTick) {
        // Pausa o relogio ate o audio de gol (arquivo real, nao narracao por voz) terminar.
        playGoalAudio(lastGoalThisTick.club, lastGoalThisTick.customUrl, () => {
          if (isPausedRef.current) return;
          clockRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
        });
      } else {
        clockRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
      }
    };

    tickFnRef.current = tick;
    clockRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
  }, [fixtures, currentRound, leagueTeams, isSimulating, gameMode, cupRoundIdx, myTeamId, roomSnap?.seed, cardCounts, suspensions, injuries, teamForm]);

  // Calcula e aplica os prêmios de fim de temporada — só o elenco do próprio
  // usuário recebe o bônus permanente (é o único que atravessa pra próxima
  // temporada; os adversários são sorteados de novo em "newSeason").
  const applySeasonAwards = (copaChampionId, tableOverride, scorersOverride, assistersOverride, matchHistoryOverride, ratingsOverride, divisionMoveOverride) => {
    const myTeam = leagueTeams.find(t => t.id === myTeamId);
    // Overrides evitam closure velha quando chamado de dentro da simulação
    // direta (fastForward*): o estado real (scorers/assisters/leagueTable) só
    // é atualizado no próximo render, mas essa função já roda com os totais
    // acumulados localmente durante o loop assíncrono.
    const awards = computeSeasonAwards({
      myTeamId, myPlayers: myTeam?.players, leagueTable: tableOverride || leagueTable,
      scorers: scorersOverride || scorers, assisters: assistersOverride || assisters,
      seasonRatings: ratingsOverride || seasonRatings, gameMode,
    });
    setSeasonAwards(awards);
    if (awards.length > 0) {
      setPitch(prev => {
        const next = { ...prev };
        awards.forEach(a => {
          Object.entries(next).forEach(([k, p]) => {
            if (p?.name === a.name) next[k] = { ...p, ovr: (p.ovr || 70) + SEASON_AWARD_BONUS };
          });
        });
        return next;
      });
    }

    // Desafio do Dia é uma partida avulsa pra divertir, não uma temporada de
    // verdade — não conta título/conquista/estatística de carreira. Só dá
    // +50 pontos soltos de ranking se vencer (endpoint dedicado, sem passar
    // pelas conquistas/temporada abaixo).
    if (isDailyChallenge) {
      if (currentUser) {
        const dailyTable = tableOverride || leagueTable;
        const myDailyRow = dailyTable.find(t => t.id === myTeamId);
        const oppDailyRow = dailyTable.find(t => t.id !== myTeamId);
        const wonDaily = (myDailyRow?.gp ?? 0) > (oppDailyRow?.gp ?? 0);
        if (wonDaily) {
          api.submitDailyChallengeResult({ dateKey: dailyChallenge.dateKey })
            .then(({ user }) => setCurrentUser(user))
            .catch(() => { /* ranking é bônus — falha aqui não deve travar a tela de resultado */ });
        }
      }
      return;
    }
    // Ranking global e conquistas só fazem sentido pra quem está logado (só a
    // conta persiste entre sessões — convidado joga normal, sem entrar no ranking).
    if (!currentUser) return;
    const isCopa = gameMode === 'copa';
    const finalTable = tableOverride || leagueTable;
    const champion = isCopa ? copaChampionId === myTeamId : finalTable[0]?.id === myTeamId;
    const myRow = isCopa ? null : finalTable.find(t => t.id === myTeamId);
    const position = isCopa ? null : (finalTable.findIndex(t => t.id === myTeamId) + 1 || null);

    // Campanha completa desta temporada/copa (mesmo cálculo usado no card de
    // compartilhar) — usada pros marcos de carreira (gols/gols sofridos) e
    // pra decidir "invicto" também na Copa, que não tem coluna de derrotas
    // numa tabela geral como o Brasileirão.
    const myLabel = leagueTeams?.find(t => t.id === myTeamId)?.label || myTeamName || 'Meu Time';
    let goalsScored = 0, goalsConceded = 0, campaignLosses = 0, campaignWins = 0, campaignDraws = 0;
    (matchHistoryOverride || matchHistory || []).filter(m => m.gameMode === gameMode).forEach(m => {
      const isHome = m.homeLabel === myLabel;
      const my = isHome ? m.hg : m.ag;
      const opp = isHome ? m.ag : m.hg;
      goalsScored += my;
      goalsConceded += opp;
      if (my < opp) campaignLosses++;
      else if (my > opp) campaignWins++;
      else campaignDraws++;
    });
    const losses = campaignLosses;
    const unbeaten = campaignLosses === 0;
    const finalAssisters = assistersOverride || assisters;
    const assistsMade = Object.entries(finalAssisters)
      .filter(([k]) => k.startsWith(`${myTeamId}::`))
      .reduce((sum, [, d]) => sum + (d.assists || 0), 0);
    const gotTopScorerAward = awards.some(a => a.reason === 'Artilheiro da temporada');
    // Overall do time e do melhor jogador individual do elenco NESTA temporada
    // — o servidor só atualiza o recorde se isso superar o que já tinha salvo.
    const myTeamThisSeason = leagueTeams?.find(t => t.id === myTeamId);
    const teamOvr = myTeamThisSeason?.ovr ?? null;
    const squadOvrs = (myTeamThisSeason?.players || []).map(p => p.ovr || 0);
    const bestPlayerOvr = squadOvrs.length > 0 ? Math.max(...squadOvrs) : null;
    api.submitSeasonResult({
      gameMode, champion, position, losses, wins: campaignWins, draws: campaignDraws, gotTopScorerAward,
      goalsScored, goalsConceded, assistsMade, unbeaten, multiplayer: !!roomSnap,
      teamOvr, bestPlayerOvr,
      // Série B vale metade dos pontos de campanha da Série A no ranking —
      // o servidor decide o peso, aqui só avisa em qual divisão a temporada
      // rolou (só faz sentido no modo serieab).
      division: gameMode === 'serieab' ? myDivision : undefined,
      // Idem: só faz sentido no modo serieab, e só quando essa chamada é
      // justamente a de fim de temporada (senão fica undefined — não é toda
      // chamada de applySeasonAwards que decide promoção/queda).
      divisionMove: gameMode === 'serieab' ? (divisionMoveOverride ?? divisionMove) : undefined,
      // Dificuldade vale multiplicador no ranking. No multiplayer os times de
      // IA entram sem ajuste de dificuldade nenhum (ver o efeito de simulação
      // da sala), então mandar o valor guardado no localStorage daria pontos
      // de Lendário numa partida que não foi de Lendário.
      difficulty: roomSnap ? 'normal' : difficulty,
    })
      .then(({ user, newlyUnlocked }) => {
        setCurrentUser(user);
        if (newlyUnlocked?.length > 0) setNewAchievements(newlyUnlocked);
        trackEvent('season_complete', { game_mode: gameMode, champion });
      })
      .catch(() => { /* ranking é bônus — falha aqui não deve travar a tela de resultado */ });
  };

  // Simulação direta do Brasileirão: avança todas as rodadas restantes —
  // inclusive as do próprio usuário, que passam a ser resolvidas por
  // simAiMatch como qualquer outro jogo (sem tela de partida ao vivo) — uma
  // rodada por vez, com uma pausa curta e texto animado entre elas.
  // `targetRound` (exclusivo) para a simulação ANTES daquela rodada — é o que
  // o calendário usa pro "simular até esse jogo" (a pessoa joga essa rodada
  // ao vivo depois). Sem alvo, simula até o fim da temporada.
  // Cuidado: essa função também é passada direto como onClick (`onSimulateAll`),
  // e nesse caso o 1º argumento é o evento de clique — daí a checagem de tipo.
  const fastForwardBrasileirao = async (targetRound = null, { onCalendar = false } = {}) => {
    if (fastSimActive || isSimulating) return;
    // Mata-mata de acesso em andamento: ida/volta viram uma "rodada" extra
    // nesse mesmo `fixtures`, mas o placar agregado e o pênaltis dependem da
    // lógica turno-a-turno de `goNextRound` — simular batido aqui trataria
    // essas 2 partidas como jogos de tabela normais e corromperia a
    // classificação. Por isso essas 2 partidas só rolam ao vivo.
    if (gameMode === 'serieab' && promotionTie?.leg) return;
    const target = typeof targetRound === 'number' ? Math.min(targetRound, fixtures.length) : fixtures.length;
    if (currentRound >= target) return;
    setFastSimActive(true);
    setCalendarSimActive(onCalendar);
    fastSimCancelRef.current = false;
    setShowSubPanel(false);
    setSubSelectStarter(null);
    setForcedSubReason(null);

    let round = currentRound;
    let table = leagueTable.map(r => ({ ...r }));
    let otherDiv = otherDivision;
    let cards = { ...cardCounts };
    let susp = { ...suspensions };
    let inj = { ...injuries };
    let form = { ...teamForm };
    let history = [...matchHistory];
    let scorersAcc = { ...scorers };
    let assistersAcc = { ...assisters };
    let cleanSheetsAcc = { ...cleanSheets };
    let redCardsAcc = { ...redCards };
    let ratingsAcc = { ...seasonRatings };

    while (round < target && !fastSimCancelRef.current) {
      setFastSimStatusMsg(fastSimStatusText({ gameMode: 'brasileirao', round, totalRounds: fixtures.length, table, myTeamId }));

      // Animação "dia a dia" do calendário: anda pelos dias vazios até chegar
      // no dia dessa rodada, pra dar a sensação de tempo passando.
      if (onCalendar && seasonDates[round]) {
        const roundDay = seasonDates[round];
        let cursor = calendarCursorRef.current ? addDays(calendarCursorRef.current, 1) : roundDay;
        while (cursor < roundDay && !fastSimCancelRef.current) {
          calendarCursorRef.current = cursor;
          setCalendarCursor(cursor);
          await delay(CALENDAR_EMPTY_DAY_MS / calendarSpeedRef.current);
          cursor = addDays(cursor, 1);
        }
        calendarCursorRef.current = roundDay;
        setCalendarCursor(roundDay);
      }

      const unavailable = unavailableNamesFrom(susp, inj);
      const roundTeams = teamsForRound(leagueTeams, unavailable, form);
      const occurrences = [];
      const roundGoals = [];
      const cleanSheetEntries = [];
      const results = fixtures[round].map(m => {
        const h = roundTeams.find(t => t.id === m.homeId);
        const a = roundTeams.find(t => t.id === m.awayId);
        if (!h || !a) return { homeId: m.homeId, awayId: m.awayId, homeGoals: 0, awayGoals: 0 };
        const sim = simAiMatch(h, a, matchPrng(roomSnap?.seed, round, m.homeId, m.awayId));
        occurrences.push(...(sim.discipline || []));
        roundGoals.push(...(sim.goals || []));
        cleanSheetEntries.push(
          { teamId: h.id, teamLabel: h.label, gkName: sim.homeGkName, conceded: sim.awayGoals },
          { teamId: a.id, teamLabel: a.label, gkName: sim.awayGkName, conceded: sim.homeGoals },
        );
        ratingsAcc = applySeasonRatings(ratingsAcc, sim.ratings);
        if (m.homeId === myTeamId || m.awayId === myTeamId) {
          history.push({
            round: round + 1, homeLabel: h.label, awayLabel: a.label,
            hg: sim.homeGoals, ag: sim.awayGoals, isUser: true, gameMode,
          });
        }
        return { homeId: m.homeId, awayId: m.awayId, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
      });
      scorersAcc = applyGoalsToScorers(scorersAcc, roundGoals);
      assistersAcc = applyGoalsToAssisters(assistersAcc, roundGoals);
      cleanSheetsAcc = applyCleanSheets(cleanSheetsAcc, cleanSheetEntries);

      results.forEach(res => {
        const h = table.find(t => t.id === res.homeId);
        const a = table.find(t => t.id === res.awayId);
        if (!h || !a) return;
        h.pj++; a.pj++;
        h.gp += res.homeGoals; h.gc += res.awayGoals;
        a.gp += res.awayGoals; a.gc += res.homeGoals;
        if (res.homeGoals > res.awayGoals) { h.v++; h.pts += 3; a.d++; }
        else if (res.homeGoals < res.awayGoals) { a.v++; a.pts += 3; h.d++; }
        else { h.e++; h.pts++; a.e++; a.pts++; }
      });
      table = [...table].sort((a, b) => b.pts - a.pts || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp);

      const disc = applyRoundDiscipline(cards, susp, inj, occurrences);
      cards = disc.cards; susp = disc.suspensions; inj = disc.injuries;
      // Sempre um objeto novo (nunca muta redCardsAcc em cima) — o setRedCards
      // de cada rodada precisa de uma referência diferente da anterior, senão
      // o React vê Object.is(mesmaRef, mesmaRef) e pula o re-render daquela
      // chamada, deixando o placar de vermelhos "preso" na 1ª rodada da leva.
      redCardsAcc = { ...redCardsAcc };
      occurrences.forEach(o => { if (o.type === 'red') { const k = playerKey(o.teamId, o.player); redCardsAcc[k] = (redCardsAcc[k] || 0) + 1; } });
      form = updateFormFromResults(form, results);
      round++;
      // A divisão espelho tem que andar junto mesmo na simulação direta —
      // sem isso, "Simulação direta" (o jeito mais comum de jogar uma
      // temporada inteira) deixava a Série A/B espelho parada na rodada 0
      // o tempo todo, e a promoção/rebaixamento do lado da IA nunca existia.
      if (gameMode === 'serieab') {
        otherDiv = advanceMirrorDivision(otherDiv, roomSnap?.seed);
        setOtherDivision(otherDiv);
      }

      setLeagueTable(table);
      setCardCounts(cards);
      setSuspensions(susp);
      setInjuries(inj);
      setTeamForm(form);
      // Cópia nova: `history` é mutado com push a cada rodada, então mandar a
      // mesma referência faz o React pular o re-render (Object.is igual).
      setMatchHistory([...history]);
      setScorers(scorersAcc);
      setAssisters(assistersAcc);
      setCleanSheets(cleanSheetsAcc);
      setRedCards(redCardsAcc);
      setSeasonRatings(ratingsAcc);
      setCurrentRound(round);
      setRoundResults(results);
      setRoundHistory(prev => ({ ...prev, [round - 1]: results }));

      await delay(onCalendar ? CALENDAR_MATCH_DAY_MS / calendarSpeedRef.current : FAST_SIM_ROUND_DELAY_MS);
    }

    setFastSimActive(false);
    setCalendarSimActive(false);
    setFastSimStatusMsg('');
    // Acabaram as rodadas → temporada encerrada, mesmo que o "Parar" tenha
    // sido apertado justamente na última (senão o jogo ficava preso em
    // "Rodada 39 de 38"). O calendário TEM que fechar aqui: ele é renderizado
    // no root com z-index alto, e a tela de resultado apareceria atrás dele —
    // era o "cheguei no fim e não acontece nada".
    if (round >= fixtures.length) {
      if (gameMode === 'serieab') {
        const { move, tie } = resolveDivisionEnd(table, myTeamId, myDivision);
        if (tie) {
          // Mata-mata de acesso pela frente — não é algo pra passar batido
          // dentro da simulação direta; fecha o calendário e deixa a pessoa
          // jogar essas duas partidas de verdade, igual qualquer outro jogo.
          setShowCalendar(false);
          setPromotionTie({ opponentId: tie.opponentId, opponentLabel: tie.opponentLabel, myPos: tie.myPos, oppPos: tie.oppPos, leg: 1 });
          setFixtures(f => [...f, [tie.leg1Match]]);
          setCurrentRound(round);
          setRoundResults(null);
          return;
        }
        setDivisionMove(move);
      }
      setShowCalendar(false);
      applySeasonAwards(undefined, table, scorersAcc, assistersAcc, history, ratingsAcc, gameMode === 'serieab' ? move : undefined);
      setPhase('results');
    } else {
      // Cancelado no meio do caminho: roundResults ficou com o resultado da
      // ÚLTIMA rodada simulada, mas currentRound já aponta pra PRÓXIMA rodada
      // (ainda não jogada). Sem isso, "Próxima rodada" aparecia disponível
      // (roundDone = roundResults !== null) pra uma rodada que nunca rolou,
      // e clicar nela avançava o contador sem nunca atualizar a tabela —
      // exatamente o desalinhamento "PJ 32 mas Rodada 34" reportado.
      setRoundResults(null);
    }
  };

  // Simulação direta da Copa — mesma ideia, mas navegando o chaveamento
  // (ida/volta, pênaltis automáticos) até sair um campeão, respeitando as
  // suspensões/lesões/forma acumuladas (a versão antiga só rodava depois do
  // usuário já ter sido eliminado, e nem olhava pra isso).
  const fastForwardCopa = async () => {
    if (fastSimActive || isSimulating) return;
    setFastSimActive(true);
    fastSimCancelRef.current = false;
    setShowSubPanel(false);
    setSubSelectStarter(null);
    setForcedSubReason(null);

    let currCupRounds = cupRounds.map(r => ({ ...r }));
    let currCupRoundIdx = cupRoundIdx;
    let currCupLeg = cupLeg;
    let currFixtures = [...fixtures];
    let currRound = currentRound;
    let cards = { ...cardCounts };
    let susp = { ...suspensions };
    let inj = { ...injuries };
    let form = { ...teamForm };
    let history = [...matchHistory];
    let stillInCup = userInCup;
    let elimName = eliminationRoundName;
    let winnerId = null;
    let scorersAcc = { ...scorers };
    let assistersAcc = { ...assisters };
    let cleanSheetsAcc = { ...cleanSheets };
    let redCardsAcc = { ...redCards };
    let ratingsAcc = { ...seasonRatings };

    // Descarrega no estado tudo que o laço acumulou localmente. É chamado no
    // fim de CADA iteração e também logo antes do break que sai com o campeão
    // — a final é uma iteração como qualquer outra e precisa entrar nas
    // estatísticas igual às outras fases.
    const flushCupState = () => {
      setCupRounds(currCupRounds);
      setCupRoundIdx(currCupRoundIdx);
      setCupLeg(currCupLeg);
      setFixtures(currFixtures);
      setCurrentRound(currRound);
      setCardCounts(cards);
      setSuspensions(susp);
      setInjuries(inj);
      setTeamForm(form);
      // Cópia nova a cada descarga: `history` é o MESMO array a cada iteração
      // (history.push muta no lugar), então mandar a referência direta fazia o
      // React comparar o array consigo mesmo e pular o re-render. Funcionava
      // por acidente — a mutação vazava pro estado anterior — e por isso a
      // campanha do jogador às vezes incluía a final e às vezes não.
      setMatchHistory([...history]);
      setUserInCup(stillInCup);
      setEliminationRoundName(elimName);
      setScorers(scorersAcc);
      setAssisters(assistersAcc);
      setCleanSheets(cleanSheetsAcc);
      setRedCards(redCardsAcc);
      setSeasonRatings(ratingsAcc);
    };

    let iters = 0;
    while (iters++ < 20 && !fastSimCancelRef.current) {
      const round = currFixtures[currRound];
      const cupRoundData = currCupRounds[currCupRoundIdx];
      if (!round || !cupRoundData) break;

      const legSuffix = cupRoundData.matches.length === 1 ? ' (jogo único)' : (currCupLeg === 1 ? ' (ida)' : ' (volta)');
      setFastSimStatusMsg(fastSimStatusText({ gameMode: 'copa', round: currCupRoundIdx, totalRounds: CUP_ROUND_NAMES.length }) + legSuffix);

      const unavailable = unavailableNamesFrom(susp, inj);
      const roundTeams = teamsForRound(leagueTeams, unavailable, form);
      const occurrences = [];
      const roundGoals = [];
      const cleanSheetEntries = [];
      const results = round.map(m => {
        const h = roundTeams.find(t => t.id === m.homeId);
        const a = roundTeams.find(t => t.id === m.awayId);
        if (!h || !a) return { homeId: m.homeId, awayId: m.awayId, homeGoals: 0, awayGoals: 0 };
        const sim = simAiMatch(h, a, matchPrng(roomSnap?.seed, currRound, m.homeId, m.awayId));
        occurrences.push(...(sim.discipline || []));
        roundGoals.push(...(sim.goals || []));
        cleanSheetEntries.push(
          { teamId: h.id, teamLabel: h.label, gkName: sim.homeGkName, conceded: sim.awayGoals },
          { teamId: a.id, teamLabel: a.label, gkName: sim.awayGkName, conceded: sim.homeGoals },
        );
        ratingsAcc = applySeasonRatings(ratingsAcc, sim.ratings);
        if (m.homeId === myTeamId || m.awayId === myTeamId) {
          history.push({
            round: currRound + 1, homeLabel: h.label, awayLabel: a.label,
            hg: sim.homeGoals, ag: sim.awayGoals, isUser: true, gameMode: 'copa',
            legLabel: currCupLeg === 1 ? 'Ida' : 'Volta',
          });
        }
        return { homeId: m.homeId, awayId: m.awayId, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
      });
      scorersAcc = applyGoalsToScorers(scorersAcc, roundGoals);
      assistersAcc = applyGoalsToAssisters(assistersAcc, roundGoals);
      cleanSheetsAcc = applyCleanSheets(cleanSheetsAcc, cleanSheetEntries);

      const disc = applyRoundDiscipline(cards, susp, inj, occurrences);
      cards = disc.cards; susp = disc.suspensions; inj = disc.injuries;
      redCardsAcc = { ...redCardsAcc };
      occurrences.forEach(o => { if (o.type === 'red') { const k = playerKey(o.teamId, o.player); redCardsAcc[k] = (redCardsAcc[k] || 0) + 1; } });
      form = updateFormFromResults(form, results);

      // Final é jogo único (2 times = 1 partida) — sem jogo de volta.
      const isFinal = cupRoundData.matches.length === 1;

      if (currCupLeg === 1 && !isFinal) {
        currCupRounds = currCupRounds.map((r, i) => i === currCupRoundIdx ? { ...r, leg1Results: results } : r);
        const leg2Matches = cupRoundData.matches.map(m => ({ homeId: m.awayId, awayId: m.homeId }));
        currFixtures = [...currFixtures, leg2Matches];
        currRound++;
        currCupLeg = 2;
      } else {
        const leg1Res = isFinal ? [] : (currCupRounds[currCupRoundIdx].leg1Results || []);
        const userMatchIdx = cupRoundData.matches.findIndex(m => m.homeId === myTeamId || m.awayId === myTeamId);
        // Guarda as disputas de pênalti da fase junto com o resultado — é daqui
        // que o chaveamento tira quem passou num agregado empatado. Sem isso o
        // confronto ficava sem classificado no desenho da chave.
        const penaltyResults = [];
        const aggregateWinners = cupRoundData.matches.map((match, i) => {
          const l2 = results[i] || { homeGoals: 0, awayGoals: 0 };
          let aggA, aggB;
          if (isFinal) { aggA = l2.homeGoals; aggB = l2.awayGoals; }
          else {
            const l1 = leg1Res[i] || { homeGoals: 0, awayGoals: 0 };
            aggA = l1.homeGoals + l2.awayGoals;
            aggB = l1.awayGoals + l2.homeGoals;
          }
          if (aggA !== aggB) return aggA > aggB ? match.homeId : match.awayId;
          const penRand = matchPrng(roomSnap?.seed, `${currCupRoundIdx}-pen`, match.homeId, match.awayId);
          const pen = simulatePenalties(match.homeId, match.awayId, leagueTeams, penRand);
          penaltyResults.push({ matchIdx: i, ...pen });
          return pen.winner;
        });

        if (stillInCup && userMatchIdx >= 0 && aggregateWinners[userMatchIdx] !== myTeamId) {
          stillInCup = false;
          elimName = cupRoundData.name || CUP_ROUND_NAMES[currCupRoundIdx] || 'Copa';
        }

        const nextMatches = [];
        for (let i = 0; i + 1 < aggregateWinners.length; i += 2)
          nextMatches.push({ homeId: aggregateWinners[i], awayId: aggregateWinners[i + 1] });

        currCupRounds = currCupRounds.map((r, i) => i === currCupRoundIdx
          ? { ...r, results, ...(penaltyResults.length > 0 ? { penaltyResults } : {}) }
          : r);

        if (nextMatches.length === 0) {
          winnerId = aggregateWinners[0] || null;
          currRound++;
          // Saiu campeão: essa iteração É a final. Antes daqui saía um `break`
          // seco, pulando o bloco de setters lá embaixo — e a final inteira
          // (gols, assistências, jogo sem sofrer gol, notas, cartões, e a
          // própria partida na campanha do jogador) nunca chegava ao estado.
          // A tela de campeão mostrava a Copa toda MENOS a decisão. Descarrega
          // tudo antes de sair.
          flushCupState();
          break;
        }

        const nextRoundName = CUP_ROUND_NAMES[currCupRoundIdx + 1] || 'Final';
        const newRound = { name: nextRoundName, matches: nextMatches, leg1Results: [], results: [] };
        currCupRounds = [...currCupRounds, newRound];
        currFixtures = [...currFixtures, nextMatches];
        currRound++;
        currCupRoundIdx++;
        currCupLeg = 1;
      }

      flushCupState();

      await delay(FAST_SIM_ROUND_DELAY_MS);
    }

    setFastSimActive(false);
    setFastSimStatusMsg('');
    if (!fastSimCancelRef.current) {
      setCupWinnerId(winnerId);
      applySeasonAwards(winnerId, undefined, scorersAcc, assistersAcc, history, ratingsAcc);
      // Mesmo fecho do caminho manual: o troféu sobe no chaveamento (que já
      // estava na tela durante a simulação) e só então vem o resultado.
      resultsAfterBracketRef.current = true;
      setBracketAdvance({ championId: winnerId });
    } else {
      // Mesmo motivo do fastForwardBrasileirao: sem isso, roundResults ficava
      // com o resultado da última rodada simulada (currCupLeg/currCupRoundIdx
      // já tinham avançado pra próxima), fazendo "Próxima rodada" aparecer
      // liberada pra uma rodada não jogada — e pior aqui, o goNextRound da
      // Copa usa roundResults como leg1Res/leg2Res pra calcular o agregado,
      // então dados requentados também estragavam esse cálculo.
      setRoundResults(null);
    }
  };

  const cancelFastSim = () => { fastSimCancelRef.current = true; };

  // Abre o calendário posicionando o cursor no dia da última rodada jogada
  // (ou pouco antes da 1ª), pra que a animação até a próxima rodada tenha
  // dias vazios pra percorrer.
  const openCalendar = () => {
    const anchor = seasonDates[currentRound - 1] || (seasonDates[0] ? addDays(seasonDates[0], -3) : null);
    calendarCursorRef.current = anchor;
    setCalendarCursor(anchor);
    setShowCalendar(true);
  };
  // "Simulação direta": abre o calendário e simula até o fim da temporada
  // com a animação dia a dia (em vez do overlay antigo de tela cheia).
  const simulateSeasonOnCalendar = () => {
    openCalendar();
    fastForwardBrasileirao(null, { onCalendar: true });
  };

  const goNextRound = useCallback(() => {
    // Pênaltis ainda sendo exibidos (usuário assistindo/clicando as cobranças
    // no modal) — não avança rodada nem declara campeão até ele fechar. Sem
    // isso, o auto-advance (modo automático) ou o clique em "Ver campeão"
    // corriam por cima do modal e mostravam o resultado final antes da hora.
    if (penaltyPhaseRef.current) return;
    const next = currentRound + 1;

    if (gameMode === 'brasileirao') {
      if (next >= fixtures.length) {
        applySeasonAwards();
        setPhase('results');
      } else {
        setCurrentRound(next);
        setRoundResults(null);
        setLiveEvents([]);
        setLiveScore({ home: 0, away: 0 });
        setClockMinute(0);
        setActiveUserMatch(null);
      }
      return;
    }

    if (gameMode === 'serieab') {
      // A divisão espelho (só IA) avança em lockstep com a do jogador —
      // é isso que faz ela "existir de verdade" (os 40 times, 20 e 20) sem
      // precisar de tela nenhuma pra ela.
      setOtherDivision(prev => advanceMirrorDivision(prev, roomSnap?.seed));

      // Já dentro do mata-mata de acesso — a ida/volta foi anexada ao fim de
      // `fixtures` quando a fase regular (38 rodadas) terminou, abaixo.
      if (promotionTie?.leg) {
        const legMatch = fixtures[currentRound][0];
        const legRes = (roundResults || [])[0] || { homeGoals: 0, awayGoals: 0 };
        const myGoals = legMatch.homeId === myTeamId ? legRes.homeGoals : legRes.awayGoals;
        const oppGoals = legMatch.homeId === myTeamId ? legRes.awayGoals : legRes.homeGoals;

        if (promotionTie.leg === 1) {
          // Fim da ida: guarda o placar e monta a volta com o mando
          // invertido — mesma convenção que a Copa já usa entre as pernas.
          const leg2Match = { homeId: legMatch.awayId, awayId: legMatch.homeId };
          setFixtures(f => [...f, [leg2Match]]);
          setPromotionTie(t => ({ ...t, leg: 2, myLeg1Goals: myGoals, oppLeg1Goals: oppGoals }));
          setCurrentRound(next);
          setRoundResults(null);
          setLiveEvents([]);
          setLiveScore({ home: 0, away: 0 });
          setClockMinute(0);
          setActiveUserMatch(null);
          return;
        }

        // Fim da volta: agregado decide; empatado, pênaltis (mesma regra
        // da Copa — sem gol fora, que foi extinta).
        const aggMine = promotionTie.myLeg1Goals + myGoals;
        const aggOpp = promotionTie.oppLeg1Goals + oppGoals;
        let promoted;
        if (aggMine !== aggOpp) promoted = aggMine > aggOpp;
        else {
          const pen = simulatePenalties(myTeamId, promotionTie.opponentId, leagueTeams, matchPrng(roomSnap?.seed, 'promotion-pen', myTeamId, promotionTie.opponentId));
          promoted = pen.winner === myTeamId;
        }
        setDivisionMove(promoted ? 'promoted' : 'stayed');
        setPromotionTie(t => ({ ...t, leg: null, aggMine, aggOpp, promoted }));
        applySeasonAwards(undefined, undefined, undefined, undefined, undefined, undefined, promoted ? 'promoted' : 'stayed');
        setPhase('results');
        return;
      }

      if (next >= fixtures.length) {
        // Fase regular terminou — decide promoção/rebaixamento (ou o
        // mata-mata, se a colocação cair na zona 3º-6º da Série B).
        const { move, tie } = resolveDivisionEnd(leagueTable, myTeamId, myDivision);
        if (tie) {
          setPromotionTie({ opponentId: tie.opponentId, opponentLabel: tie.opponentLabel, myPos: tie.myPos, oppPos: tie.oppPos, leg: 1 });
          setFixtures(f => [...f, [tie.leg1Match]]);
          setCurrentRound(next);
          setRoundResults(null);
          setLiveEvents([]);
          setLiveScore({ home: 0, away: 0 });
          setClockMinute(0);
          setActiveUserMatch(null);
        } else {
          setDivisionMove(move);
          applySeasonAwards(undefined, undefined, undefined, undefined, undefined, undefined, move);
          setPhase('results');
        }
      } else {
        setCurrentRound(next);
        setRoundResults(null);
        setLiveEvents([]);
        setLiveScore({ home: 0, away: 0 });
        setClockMinute(0);
        setActiveUserMatch(null);
      }
      return;
    }

    // Copa — jogo de ida → jogo de volta → próxima fase.
    //
    // Tudo abaixo roda DIRETO, não dentro de um `setCupRounds(prev => …)`.
    // Antes ficava tudo dentro do updater, e o StrictMode do React (que chama
    // updater duas vezes de propósito, pra denunciar updater impuro) executava
    // junto os setState de dentro: `setCupRoundIdx(r => r + 1)` entrava na fila
    // duas vezes e a Copa PULAVA uma fase inteira (16 avos → quartas). Updater
    // tem que ser função pura; efeito colateral fica fora.
    const currentCupRound = cupRounds[cupRoundIdx];
    if (!currentCupRound) return;

    const reset = () => {
      setRoundResults(null);
      setLiveEvents([]);
      setLiveScore({ home: 0, away: 0 });
      setClockMinute(0);
      setActiveUserMatch(null);
    };

    // Final é jogo único (2 times = 1 partida só) — sem jogo de volta, a
    // própria "ida" já decide tudo (no empate, pênaltis na hora).
    const isFinal = currentCupRound.matches.length === 1;

    if (cupLeg === 1 && !isFinal) {
      // Salvar resultados do jogo de ida e preparar jogo de volta
      const leg1Res = roundResults || [];
      const leg2Matches = currentCupRound.matches.map(m => ({ homeId: m.awayId, awayId: m.homeId }));
      // `results` ainda guarda o resultado do jogo de ida (o tick() grava ali
      // toda vez que uma rodada termina, ida ou volta) — sem limpar aqui, o
      // chaveamento tratava esse resultado antigo como se já fosse o jogo de
      // volta enquanto ele ainda estava rolando, e como agregado = ida+ida
      // (soma comutativa), o placar sempre dava empate por matemática.
      setCupRounds(prev => prev.map((r, i) => i === cupRoundIdx ? { ...r, leg1Results: leg1Res, results: [] } : r));
      setFixtures(f => [...f, leg2Matches]);
      setCupLeg(2);
      setCurrentRound(next);
      reset();
      return;
    }

    {
      // Leg 2 (ou a final de jogo único, que nunca sai do cupLeg 1) — calcular vencedores
      const leg1Res = isFinal ? [] : (currentCupRound.leg1Results || []);
      const leg2Res = roundResults || [];
      // Use pre-computed penalty results from tick if available
      const preComputedPenalties = currentCupRound.penaltyResults || [];
      // Pênaltis resolvidos aqui na hora (fase sem o usuário, sem nada
      // pré-computado) — precisam ser gravados na fase pro chaveamento.
      const latePenalties = [];

      const aggregateWinners = currentCupRound.matches.map((match, i) => {
        const l2 = leg2Res[i] || { homeGoals: 0, awayGoals: 0 };
        let aggA, aggB;
        if (isFinal) {
          // Jogo único: o placar da própria partida já é o agregado (sem
          // inversão de mando, já que não existe volta pra somar).
          aggA = l2.homeGoals;
          aggB = l2.awayGoals;
        } else {
          const l1 = leg1Res[i] || { homeGoals: 0, awayGoals: 0 };
          // leg1 home = match.homeId, leg2 home = match.awayId (invertido)
          aggA = l1.homeGoals + l2.awayGoals;
          aggB = l1.awayGoals + l2.homeGoals;
        }
        if (aggA !== aggB) return aggA > aggB ? match.homeId : match.awayId;
        // Empate no agregado (regra do gol fora foi extinta) — pênaltis
        // usar resultado pré-computado (já calculado no tick com a mesma seed) ou simular como fallback
        const precomputed = preComputedPenalties.find(pr => pr.matchIdx === i);
        if (precomputed) return precomputed.winner;
        const penRand = matchPrng(roomSnap?.seed, `${cupRoundIdx}-${cupLeg}-pen`, match.homeId, match.awayId);
        const pen = simulatePenalties(match.homeId, match.awayId, leagueTeams, penRand);
        // Guarda também quando cai no fallback, senão o chaveamento fica sem
        // saber quem passou nesse confronto (bloco sem dourado, linha apagada).
        latePenalties.push({ matchIdx: i, ...pen });
        return pen.winner;
      });

      const nextMatches = [];
      for (let i = 0; i + 1 < aggregateWinners.length; i += 2)
        nextMatches.push({ homeId: aggregateWinners[i], awayId: aggregateWinners[i + 1] });

      // Grava na fase os pênaltis resolvidos agora — é o que faz o chaveamento
      // saber quem passou num agregado empatado.
      const patchPens = (list) => (latePenalties.length === 0 ? list : list.map((r, i) => i === cupRoundIdx
        ? { ...r, penaltyResults: [...(r.penaltyResults || []), ...latePenalties] }
        : r));

      if (nextMatches.length === 0) {
        const championId = aggregateWinners[0] || null;
        setCupRounds(prev => patchPens(prev));
        setCupWinnerId(championId);
        applySeasonAwards(championId);
        // Fecho da Copa no próprio chaveamento: o campeão sobe pro bloco da
        // final com o troféu. A tela de resultado só entra depois que o
        // usuário sai daqui (ver `resultsAfterBracketRef`).
        resultsAfterBracketRef.current = true;
        setBracketAdvance({ championId });
        return;
      }

      const nextRoundName = CUP_ROUND_NAMES[cupRoundIdx + 1] || 'Final';
      const newRound = { name: nextRoundName, matches: nextMatches, leg1Results: [], results: [] };

      setCupRounds(prev => [...patchPens(prev), newRound]);
      setFixtures(f => [...f, nextMatches]);
      // Valor absoluto em vez de `r => r + 1`: o índice da fase é derivado do
      // que já sabemos aqui, então ele não depende da ordem da fila e não
      // anda duas vezes se algo disparar o avanço mais de uma vez.
      setCupRoundIdx(cupRoundIdx + 1);
      setCupLeg(1);
      setCurrentRound(next);
      reset();
      // Fase decidida: abre o chaveamento com os classificados subindo pros
      // blocos novos. Só acontece na virada de FASE — de ida pra volta nada
      // se classifica, então não faz sentido interromper o jogo ali.
      setBracketAdvance({ intoRoundIdx: cupRoundIdx + 1, winnerIds: aggregateWinners });
    }
  }, [currentRound, fixtures, gameMode, cupRounds, cupRoundIdx, cupLeg, roundResults, leagueTeams, myTeamId, roomSnap?.seed, leagueTable, scorers, assisters, promotionTie, myDivision]);

  // Sai da transição do chaveamento. Na final é aqui que a tela de resultado
  // finalmente entra — o troféu no chaveamento vem primeiro.
  const dismissBracketAdvance = useCallback(() => {
    setBracketAdvance(null);
    if (resultsAfterBracketRef.current) {
      resultsAfterBracketRef.current = false;
      setPhase('results');
    }
  }, []);

  // No modo automático ninguém fecha o chaveamento — ele se fecha sozinho
  // depois de dar tempo de ver quem subiu, igual ao resumo da partida.
  useEffect(() => {
    if (!bracketAdvance || simMode !== 'auto') return;
    const t = setTimeout(dismissBracketAdvance, BRACKET_ADVANCE_AUTO_MS);
    return () => clearTimeout(t);
  }, [bracketAdvance, simMode, dismissBracketAdvance]);

  // Mantém refs atualizadas para os efeitos de auto não ficarem com closures velhas
  useEffect(() => { startRoundRef.current = startRound; }, [startRound]);
  useEffect(() => { goNextRoundRef.current = goNextRound; }, [goNextRound]);

  // Auto-save to localStorage
  useEffect(() => {
    // Estar na home NÃO apaga o save — só para de escrever nele. Isso é o
    // que permite "voltar ao menu" sem perder o jogo: quem apaga de
    // propósito é só restart() (jogar de novo / confirmar um jogo novo por
    // cima de um save existente), nunca só passar pela tela inicial.
    if (phase === 'intro') return;
    if (multiPhase || roomSnap) return; // don't persist multiplayer sessions
    // Supercopa do Brasil usa os MESMOS estados (pitch, leagueTeams,
    // fixtures...) de uma carreira normal — gravar aqui durante o desafio
    // sobrescreveria o save de uma carreira de verdade que já estava rolando
    // antes de abrir a Supercopa. Como o desafio nunca é retomável entre
    // sessões (1x por dia, sem "Continuar"), não custa nada não persistir.
    if (isDailyChallenge) return;
    try {
      const save = {
        phase, formationKey, pitchSlots, pitch, usedTeamIds, skipsLeft, log, captainSlot,
        gameMode, myTeamName, myTeamBadge, myTeamColor, myTeamCoach, myTeamCity, myTeamLogo,
        leagueTeams, leagueTable, fixtures, currentRound, roundHistory,
        cupRounds, cupRoundIdx, cupLeg, userInCup, eliminationRoundName, cupWinnerId,
        matchHistory, scorers, assisters, cleanSheets, seasonRatings, cardCounts, redCards, suspensions, injuries, teamForm, seasonAwards,
        myDivision, otherDivision, divisionMove, promotionTie,
        isDailyChallenge, dailyOpponent,
        // Sem persistir isso, um reload no meio de um "Mercado de
        // transferências" (phase='squad', isTransferSeason=true só em
        // memória) voltava com a flag em false — o confirm do Squad então
        // chamava startSeason() em vez de newSeason(), o que reseta
        // myDivision pra 'A' e descarta silenciosamente uma queda pra Série B.
        isTransferSeason,
        seasonYear,
      };
      localStorage.setItem('brl_save', JSON.stringify(save));
    } catch (e) { }
  }, [phase, fixtures, currentRound, roundHistory, leagueTable, cupRounds, matchHistory, pitch, roundResults, cardCounts, redCards, suspensions, injuries, teamForm, seasonAwards, myDivision, otherDivision, divisionMove, promotionTie, isDailyChallenge, dailyOpponent, isTransferSeason, seasonYear]);

  // Dispara a ação quando simMode muda ou rodada termina/começa
  useEffect(() => {
    setAutoCountdown(null);
    autoActionRef.current = null;
    if (simMode !== 'auto' || phase !== 'playing') return;
    // Pênaltis abertos: não inicia o avanço automático (senão ele conta 3s e
    // declara campeão por cima do modal que o usuário ainda está vendo).
    if (penaltyPhase) return;
    // Resumo da partida aberto: mesma lógica — não avança sozinho por cima
    // do resumo/notas que acabou de aparecer, senão a próxima rodada já
    // começa a rolar com o modal antigo ainda na tela.
    if (showMatchSummary) return;
    // Chaveamento em transição: mesma regra — não começa a próxima fase por
    // cima dos classificados ainda subindo na tela.
    if (bracketAdvance) return;
    if (roundResults !== null && !isSimulating) {
      autoActionRef.current = 'nextRound';
      setAutoCountdown(3);
    } else if (roundResults === null && !isSimulating) {
      autoActionRef.current = 'startRound';
      setAutoCountdown(3);
    }
  }, [simMode, phase, roundResults, isSimulating, penaltyPhase, showMatchSummary, bracketAdvance]);

  // ...e no modo automático ninguém clica em "Continuar" pra fechar esse
  // resumo. O efeito acima desistia de avançar enquanto ele estivesse aberto,
  // e como o resumo aparece DEPOIS de toda partida do usuário, o modo Auto
  // jogava a primeira rodada e travava pra sempre esperando um clique que
  // nunca vinha. Aqui o resumo se fecha sozinho — tempo suficiente pra ver as
  // notas, e aí o avanço automático destrava naturalmente.
  useEffect(() => {
    if (!showMatchSummary || simMode !== 'auto' || phase !== 'playing') return;
    const t = setTimeout(() => setShowMatchSummary(false), MATCH_SUMMARY_AUTO_MS);
    return () => clearTimeout(t);
  }, [showMatchSummary, simMode, phase]);

  // Modo automático: assim que uma rodada termina, abre o calendário e anda
  // os dias até a data da próxima rodada — é o "tempo passando" entre uma
  // partida e outra. Fecha sozinho antes do próximo jogo começar (o avanço
  // em si continua sendo o auto-advance que já existia, isso aqui é só a
  // camada visual).
  useEffect(() => {
    if (simMode !== 'auto' || gameMode !== 'brasileirao' || phase !== 'playing') return;
    if (roundResults === null || isSimulating || fastSimActive) return;
    const from = seasonDates[currentRound];
    const to = seasonDates[currentRound + 1];
    if (!from || !to) return;
    let cancelled = false;
    (async () => {
      setShowCalendar(true);
      let cursor = from;
      calendarCursorRef.current = from;
      setCalendarCursor(from);
      while (cursor < to && !cancelled) {
        cursor = addDays(cursor, 1);
        calendarCursorRef.current = cursor;
        setCalendarCursor(cursor);
        await delay(CALENDAR_EMPTY_DAY_MS / calendarSpeedRef.current);
      }
      if (!cancelled) {
        await delay(400);
        setShowCalendar(false);
      }
    })();
    return () => { cancelled = true; };
  }, [simMode, gameMode, phase, roundResults, isSimulating, fastSimActive, currentRound, seasonDates]);

  // Tique do contador regressivo
  useEffect(() => {
    if (autoCountdown === null) return;
    if (autoCountdown === 0) {
      const action = autoActionRef.current;
      autoActionRef.current = null;
      setAutoCountdown(null);
      if (action === 'nextRound') goNextRoundRef.current?.();
      else if (action === 'startRound') startRoundRef.current?.();
      return;
    }
    const t = setTimeout(() => setAutoCountdown(c => (c !== null && c > 0 ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [autoCountdown]);

  const restart = () => {
    // Sai do registro público de salas na hora (não espera os 45s de TTL) —
    // só o líder tem uma sala publicada; pra convidado ou fora do multiplayer
    // `isLeader`/`roomCode` não batem os dois e isso vira um no-op.
    if (isLeader && roomCode) { api.closeRoom(roomCode).catch(() => { }); }
    try { localStorage.removeItem('brl_save'); } catch { }
    if (timerRef.current) clearTimeout(timerRef.current);
    if (clockRef.current) clearTimeout(clockRef.current);
    // destrói peer se estava no multiplayer
    if (peerRef.current) { try { peerRef.current.destroy(); } catch { } peerRef.current = null; }
    connsRef.current = {};
    leaderConnRef.current = null;
    setMultiPhase(null);
    setRoomCode('');
    setRoomSnap(null);
    setIsLeader(false);
    setJoinInput('');
    setPhase('intro');
    setSavedPhase(null);
    setMyDivision('A');
    setOtherDivision(null);
    setDivisionMove(null);
    setPromotionTie(null);
    setIsDailyChallenge(false);
    setDailyOpponent(null);
    // Sem isso, abandonar um "Mercado de transferências" (isTransferSeason
    // vira true em confirmTransferReleases, só volta a false dentro de
    // newSeason) por aqui deixava a flag presa em true — a PRÓXIMA carreira
    // do zero então escondia "Voltar"/"Redo" na tela de escalação (Squad),
    // que ficam ocultos de propósito só durante um mercado de verdade.
    setIsTransferSeason(false);
    setFormationKey(null);
    setPitchSlots([]);
    setPitch({});
    setUsedTeamIds([]);
    setSkipsLeft(MAX_SKIPS);
    setLog([]);
    setRolledTeam(null);
    setIsRolling(false);
    setRollingPreview(null);
    setSelectedPlayer(null);
    setRepositioningSlot(null);
    setCaptainSlot(null);
    setIsPaused(false);
    setShowSubPanel(false);
    setSubSelectStarter(null);
    setForcedSubReason(null);
    setLiveLineup(null);
    setPenaltyPhase(null);
    isPausedRef.current = false;
    tickFnRef.current = null;
    liveLineupRef.current = null;
    setLeagueTeams([]);
    setLeagueTable([]);
    setFixtures([]);
    setCurrentRound(0);
    setClockMinute(0);
    setIsSimulating(false);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setRoundResults(null);
    setActiveUserMatch(null);
    setCupRounds([]);
    setCupRoundIdx(0);
    setCupLeg(1);
    setUserInCup(true);
    setEliminationRoundName(null);
    setCupWinnerId(null);
    setBracketAdvance(null);
    resultsAfterBracketRef.current = false;
    setMatchHistory([]);
    setRoundHistory({});
    setCalendarCursor(null);
    calendarCursorRef.current = null;
    setScorers({});
    setAssisters({});
    setCleanSheets({});
    setSeasonRatings({});
    setCardCounts({});
    setRedCards({});
    setSuspensions({});
    setInjuries({});
    setLastRoundDiscipline(null);
    setLastMatchRatings(null);
    setTeamForm({});
    setSeasonAwards([]);
    setChatMessages([]);
    setViewingTeam(null);
  };

  // "Voltar à home" ao SAIR da Supercopa do Brasil (tela de resultado do
  // Desafio do Dia) — de propósito NÃO é o restart() acima. restart() apaga
  // o `brl_save` do disco incondicionalmente; como o autosave já pula
  // enquanto isDailyChallenge é true (ver efeito de autosave), o disco ainda
  // guarda intacta uma eventual carreira real que já estava rolando antes de
  // abrir o desafio — só que a MEMÓRIA (pitch, leagueTeams, fixtures...)
  // ainda está com os dados da Supercopa que acabou de terminar. Recarregar
  // a página é o jeito seguro de re-hidratar esse estado a partir do disco
  // sem duplicar à mão a lógica inteira de restauração do save.
  const exitDailyChallenge = () => {
    window.location.reload();
  };

  // Sair do multiplayer (lobby, sala esperando, ou fim de uma temporada com
  // amigos) — de propósito NÃO é o restart() acima, pelo mesmo motivo do
  // exitDailyChallenge: o autosave já pula a sessão multiplayer inteira
  // (`if (multiPhase || roomSnap) return;`), então uma carreira solo real
  // que já estava salva antes de entrar na sala nunca foi tocada no disco.
  // restart() apagaria esse save de qualquer jeito (é incondicional), sem
  // nenhum aviso disso nos dois lugares que chamavam ele aqui (o "Sair da
  // sala" da tela de lobby nem tinha confirmação nenhuma). Fecha a sala/peer
  // igual restart() faz, e recarrega em vez de tentar restaurar o estado da
  // carreira solo à mão.
  const leaveMultiplayer = () => {
    if (isLeader && roomCode) { api.closeRoom(roomCode).catch(() => { }); }
    if (peerRef.current) { try { peerRef.current.destroy(); } catch { } peerRef.current = null; }
    window.location.reload();
  };

  // Revanche com o mesmo grupo — só o líder chama isso (é quem manda no
  // roomSnap; um convidado só manda `update` pro líder, nunca muta a sala
  // direto). Devolve a sala pra fase 'lobby' igual uma sala recém-criada:
  // mesma identidade (nome/cor/emblema/técnico/cidade) de cada humano, mas
  // sem elenco/prontidão da partida que acabou de terminar, e sem os times
  // de IA que preenchiam a sala (o próximo `multiLeaderStart` sorteia um
  // lote novo do tamanho certo pra quem sobrou). O broadcast do snap com
  // phase:'lobby' é o que faz o efeito abaixo levar TODOS os peers (líder
  // incluso) de volta pra RoomScreen sozinho.
  const multiLeaderRematch = () => {
    setRoomSnap(prev => {
      if (!prev) return prev;
      const players = {};
      Object.entries(prev.players).forEach(([pid, p]) => {
        if (p.isAI) return;
        players[pid] = { name: p.name, color: p.color, logo: p.logo || null, coach: p.coach || '', city: p.city || '', ready: false, pitch: null, ovr: 0 };
      });
      const next = { ...prev, phase: 'lobby', players, startedAt: null, seed: null };
      leaderBroadcast({ type: 'snap', snap: next });
      return next;
    });
  };

  // Descrição curta de uma fase salva, pro botão "Continuar" na home e (se
  // um dia precisar) qualquer outro lugar que queira dizer onde a pessoa
  // parou. `p` é a fase (não necessariamente a `phase` atual — o botão
  // "Continuar" descreve `savedPhase` enquanto a tela ainda está em 'intro').
  const describePhase = (p) => {
    if (!p || p === 'intro' || p === 'results') return null;
    if (isDailyChallenge) return 'a Supercopa do Brasil';
    if (p === 'playing') {
      if (gameMode === 'copa') return CUP_ROUND_NAMES[cupRoundIdx] || 'Copa do Brasil';
      if (gameMode === 'serieab') {
        if (promotionTie?.leg) return `Mata-mata de Acesso · Série ${myDivision}`;
        return `Rodada ${currentRound + 1} de 38 · Série ${myDivision}`;
      }
      return `Rodada ${currentRound + 1} de ${fixtures.length}`;
    }
    if (p === 'transfer') return 'o mercado de transferências';
    return 'a escalação do seu time'; // formation / draft / squad
  };

  // "Voltar ao menu" (título do cabeçalho) por si só NUNCA apaga nada — só
  // troca a tela pra home, deixando o jogo intacto em memória e no save,
  // pronto pra retomar pelo botão "Continuar". Antes disso ser assim, um
  // clique nesse título (visível o tempo todo, inclusive no meio de uma
  // partida) chamava restart() na hora e apagava a temporada sem avisar.
  // A única coisa que realmente precisa de confirmação aqui é sair de uma
  // sala multiplayer com gente de verdade esperando do outro lado — não há
  // "save" nenhum em risco no solo, só a pergunta de ficar ou sair da sala.
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const requestGoHome = () => {
    if (roomSnap) { setShowLeaveConfirm(true); return; }
    if (phase === 'intro') return;
    // Pausa a simulação/animação em andamento antes de sair — sem isso o
    // relógio da partida ou a animação do draft continuavam rodando em
    // segundo plano enquanto a pessoa via a home, e ao voltar o estado
    // estaria fora de sincronia com o que apareceu na tela.
    if (timerRef.current) clearTimeout(timerRef.current);
    if (clockRef.current) clearTimeout(clockRef.current);
    isPausedRef.current = true;
    setIsPaused(true);
    // Guarda a fase atual pra reaparecer o botão "Continuar" na home — sem
    // isso, só o save do MOUNT original (savedPhase inicial) alimentava o
    // botão; depois de usá-lo uma vez (continueSavedGame zera savedPhase),
    // "voltar ao menu" de novo mostrava a home sem nenhum jeito de retomar.
    setSavedPhase(phase);
    setPhase('intro');
  };

  // Retoma exatamente de onde parou — todo o estado (pitch, fixtures,
  // rodada, tabela etc.) já está carregado desde o mount a partir do save;
  // só falta trocar a fase visível de volta.
  const continueSavedGame = () => {
    const p = savedPhase;
    setSavedPhase(null);
    setPhase(p);
  };

  // Começar um jogo novo por cima de um save existente pede confirmação — é
  // a outra ponta do mesmo cuidado do "voltar ao menu": o botão mais visível
  // da home ("Escolher formação") não pode apagar uma temporada em
  // andamento com um clique só. Reaproveita restart() (que já zera TUDO
  // direito, inclusive coisas que um `setPhase` sozinho deixaria penduradas
  // de antes — cartões, lesões, histórico da temporada anterior) e, na
  // sequência síncrona, já avança pra 'formation': as duas chamadas de
  // setPhase são batelhadas pelo React, então a tela nunca chega a piscar
  // em 'intro'.
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const goToFormationPicker = () => {
    if (savedPhase) { setShowOverwriteConfirm(true); return; }
    setPhase('formation');
  };
  const confirmNewGameOverSave = () => {
    setShowOverwriteConfirm(false);
    restart();
    setPhase('formation');
  };

  // Nova temporada com o mesmo elenco
  const newSeason = useCallback(() => {
    setIsTransferSeason(false);
    setSeasonYear(y => y + 1);
    const pitchWithCaptain = captainSlot && pitch[captainSlot]
      ? { ...pitch, [captainSlot]: { ...pitch[captainSlot], ovr: pitch[captainSlot].ovr + 2, isCaptain: true } }
      : pitch;
    const userOvr = teamStrength(pitchWithCaptain);
    const userPlayers = partitionStartersFirst(Object.values(pitchWithCaptain));

    setClockMinute(0);
    setIsSimulating(false);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setRoundResults(null);
    setActiveUserMatch(null);
    setCupRounds([]);
    setCupRoundIdx(0);
    setCupLeg(1);
    setUserInCup(true);
    setEliminationRoundName(null);
    setCupWinnerId(null);
    setBracketAdvance(null);
    resultsAfterBracketRef.current = false;
    setMatchHistory([]);
    setRoundHistory({});
    setCalendarCursor(null);
    calendarCursorRef.current = null;
    setScorers({});
    setAssisters({});
    setCleanSheets({});
    setSeasonRatings({});
    setCardCounts({});
    setRedCards({});
    setSuspensions({});
    setInjuries({});
    setLastRoundDiscipline(null);
    setLastMatchRatings(null);
    setTeamForm({});
    setSeasonAwards([]);

    const neededAI = (gameMode === 'brasileirao' || gameMode === 'serieab') ? 19 : 31;
    let pool = [];
    while (pool.length < neededAI) pool = [...pool, ...shuffle2([...TEAMS])];
    const opps = pool.slice(0, neededAI).map((t, idx) => {
      const playersWithMeta = applyDifficultyToPlayers(
        t.players.map(p => ({ ...p, club: t.club, year: t.year, nat: p.nat || 'BRA' })),
        difficulty
      );
      return {
        id: `${t.id}_${idx}`,
        label: t.label,
        club: t.club,
        clubLogo: CLUB_LOGOS[t.club] || null,
        ovr: teamStrength(Object.fromEntries(playersWithMeta.map((p, i) => [i, p]))),
        players: playersWithMeta,
      };
    });

    const myTeamObj = { id: MY_TEAM_ID, label: myTeamName || 'Meu Time', badge: myTeamBadge, color: myTeamColor, logo: myTeamLogo, club: clubFromLogo(myTeamLogo), ovr: userOvr, players: userPlayers };
    const allTeams = [myTeamObj, ...opps];
    setLeagueTeams(allTeams);

    if (gameMode === 'brasileirao' || gameMode === 'serieab') {
      // Embaralha só a ordem passada pro gerador de tabela: o método do
      // círculo mantém o índice 0 fixo, então a POSIÇÃO no array determina em
      // que rodada cada dupla se enfrenta. Com o time do usuário sempre no
      // índice 0, o padrão de adversários saía idêntico toda temporada.
      const rounds = generateDoubleRoundRobin(shuffle2(allTeams.map(t => t.id)));
      const table = allTeams.map(t => ({ id: t.id, label: t.label, clubLogo: t.clubLogo || null, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }));
      setFixtures(rounds);
      setLeagueTable(table);
      setCurrentRound(0);
      if (gameMode === 'serieab') {
        // Aplica o resultado da temporada que acabou de terminar ANTES de
        // sortear a próxima — é isso que faz a promoção/rebaixamento
        // persistir de uma temporada pra outra, mesmo os adversários sendo
        // sorteados de novo (não tem "elenco fixo" de IA nesse jogo).
        setMyDivision(prev => divisionMove === 'promoted' ? 'A' : divisionMove === 'relegated' ? 'B' : prev);
        setOtherDivision(buildMirrorDivision(difficulty, 19));
        setDivisionMove(null);
        setPromotionTie(null);
      }
    } else {
      const firstMatches = generateCupFirstRound(allTeams.map(t => t.id));
      const firstRound = { name: CUP_ROUND_NAMES[0], matches: firstMatches, leg1Results: [], results: [] };
      setCupRounds([firstRound]);
      setCupRoundIdx(0);
      setCupLeg(1);
      setFixtures([firstMatches]);
      setCurrentRound(0);
      setLeagueTable([]);
    }
    setPhase('playing');
  }, [pitch, captainSlot, gameMode, myTeamName, myTeamBadge, myTeamColor, myTeamLogo, difficulty, divisionMove]);

  // Simula todas as fases restantes da Copa até o campeão (usuário eliminado)
  // ── MULTIPLAYER (PeerJS) ──────────────────────────────────────────────────
  // Helpers para broadcast / envio de mensagem
  const leaderBroadcast = (msg) => {
    Object.values(connsRef.current).forEach(c => { try { c.send(msg); } catch { } });
  };

  const leaderApplySnap = (snap) => {
    setRoomSnap({ ...snap });
    leaderBroadcast({ type: 'snap', snap });
  };

  // Chat/reações da sala — topologia estrela via líder (igual ao resto do
  // multiplayer): quem manda NÃO adiciona localmente na hora, só quando a
  // mensagem "volta" pelo líder (que ecoa pra todos, inclusive quem mandou).
  // O líder é exceção: como não tem conexão consigo mesmo, adiciona na hora
  // além de retransmitir. Isso evita mensagem duplicada sem precisar de id.
  const addLocalChatMessage = (msg) => setChatMessages(prev => [...prev.slice(-49), msg]);
  const sendChatPayload = (msg) => {
    if (isLeader) { addLocalChatMessage(msg); leaderBroadcast(msg); }
    else leaderConnRef.current?.send(msg);
  };
  const sendChatMessage = (text) => {
    const trimmed = (text || '').trim().slice(0, 200);
    if (!trimmed) return;
    sendChatPayload({ type: 'chat', pid: MY_PID, name: myTeamName || 'Você', text: trimmed, ts: Date.now() });
  };
  const sendReaction = (emoji) => {
    sendChatPayload({ type: 'reaction', pid: MY_PID, name: myTeamName || 'Você', emoji, ts: Date.now() });
  };

  const multiUpdateMyTeam = (fields) => {
    if (isLeader) {
      setRoomSnap(prev => {
        if (!prev) return prev;
        const next = { ...prev, players: { ...prev.players, [MY_PID]: { ...prev.players[MY_PID], ...fields } } };
        leaderBroadcast({ type: 'snap', snap: next });
        return next;
      });
    } else {
      leaderConnRef.current?.send({ type: 'update', pid: MY_PID, fields });
    }
  };

  const multiSetReady = () => multiUpdateMyTeam({ ready: true });

  const multiLeaderSetTimer = (minutes) => {
    setRoomSnap(prev => {
      if (!prev) return prev;
      const next = { ...prev, timerMinutes: minutes };
      leaderBroadcast({ type: 'snap', snap: next });
      return next;
    });
  };

  const multiLeaderStart = () => {
    setRoomSnap(prev => {
      if (!prev) return prev;
      const maxSlots = prev.gameMode === 'copa' ? 32 : 20;
      const humanCount = Object.keys(prev.players).length;
      const needed = Math.max(0, maxSlots - humanCount);
      const aiPlayers = {};
      if (needed > 0) {
        const shuffled = shuffle2(TEAMS).slice(0, needed);
        shuffled.forEach((t, i) => {
          const pp = t.players.map((pl, j) => ({ ...pl, club: t.club, year: t.year, nat: pl.nat || 'BRA', isBench: j >= 11 }));
          aiPlayers[`ai_${i}`] = {
            name: t.label, color: (t.colors && t.colors.p) || '#888', logo: CLUB_LOGOS[t.club] || null,
            coach: t.coach || '', city: '', ready: true, isAI: true, club: t.club,
            pitch: Object.fromEntries(pp.map((p, j) => [j, p])),
            ovr: teamStrength(Object.fromEntries(pp.map((p, j) => [j, p]))),
          };
        });
      }
      const next = {
        ...prev, phase: 'team-setup', startedAt: Date.now(),
        players: { ...prev.players, ...aiPlayers },
      };
      leaderBroadcast({ type: 'snap', snap: next });
      return next;
    });
  };

  const multiLeaderSimulate = () => {
    const seed = Math.floor(Math.random() * 2147483647);
    setRoomSnap(prev => {
      if (!prev) return prev;
      const next = { ...prev, phase: 'simulation', seed };
      leaderBroadcast({ type: 'snap', snap: next });
      return next;
    });
  };

  const multiCreateRoom = async (attemptsLeft = 5) => {
    if (attemptsLeft === 5) {
      if (multiConnectingRef.current) return; // evita Peer duplicado em duplo-toque antes do re-render
      multiConnectingRef.current = true;
    }
    setMultiConnecting(true);
    setMultiError('');
    const code = generateRoomCode();
    let peer;
    try {
      peer = new Peer(code, await peerOptions());
      peerRef.current = peer;
    } catch (e) {
      multiConnectingRef.current = false;
      setMultiConnecting(false);
      setMultiError('Erro ao criar conexão: ' + e.message);
      return;
    }

    const timeout = setTimeout(() => {
      multiConnectingRef.current = false;
      setMultiConnecting(false);
      setMultiError('Tempo esgotado — sem resposta do servidor de conexão. Verifique sua internet.');
      try { peer.destroy(); } catch { }
    }, MULTI_CONNECT_TIMEOUT_MS);

    peer.on('open', (id) => {
      clearTimeout(timeout);
      multiConnectingRef.current = false;
      setMultiConnecting(false);
      setIsLeader(true);
      setRoomCode(id.toUpperCase());
      const initialSnap = {
        gameMode: multiGameMode,
        phase: 'lobby',
        timerMinutes: 3,
        leaderId: MY_PID,
        leaderPeerId: id,
        seed: null,
        players: {
          [MY_PID]: { name: myTeamName || 'Meu Time', color: myTeamColor, logo: myTeamLogo || null, coach: myTeamCoach || '', city: myTeamCity || '', ready: false, pitch: null, ovr: 0 }
        }
      };
      setRoomSnap(initialSnap);
      setMultiPhase('room');
      setChatMessages([]);
      trackEvent('multiplayer_room_created', { game_mode: multiGameMode });
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        connsRef.current[conn.peer] = conn;
        // envia snapshot atual via ref para evitar stale closure
        setRoomSnap(current => { conn.send({ type: 'snap', snap: current }); return current; });
      });
      conn.on('data', (msg) => {
        if (msg.type === 'join') {
          conn._pid = msg.pid; // lembra qual jogador da sala esta conexão representa (p/ limpeza ao desconectar)
          setRoomSnap(prev => {
            if (!prev) return prev;
            const maxP = prev.gameMode === 'copa' ? 32 : 20;
            if (Object.keys(prev.players).length >= maxP) { conn.send({ type: 'error', msg: 'Sala cheia!' }); return prev; }
            const next = { ...prev, players: { ...prev.players, [msg.pid]: { name: msg.name, color: msg.color, logo: msg.logo || null, coach: msg.coach || '', city: msg.city || '', ready: false, pitch: null, ovr: 0 } } };
            leaderBroadcast({ type: 'snap', snap: next });
            return next;
          });
        }
        if (msg.type === 'update') {
          setRoomSnap(prev => {
            if (!prev) return prev;
            const next = { ...prev, players: { ...prev.players, [msg.pid]: { ...(prev.players[msg.pid] || {}), ...msg.fields } } };
            leaderBroadcast({ type: 'snap', snap: next });
            return next;
          });
        }
        if (msg.type === 'chat' || msg.type === 'reaction') {
          addLocalChatMessage(msg);
          leaderBroadcast(msg);
        }
      });
      conn.on('close', () => {
        delete connsRef.current[conn.peer];
        // Remove o jogador que caiu enquanto ainda estava no lobby/draft, pra não travar o "todos prontos"
        // pra sempre. Depois que a simulação já começou, mantemos o time dele (já entrou nos confrontos).
        if (conn._pid) {
          setRoomSnap(prev => {
            if (!prev || (prev.phase !== 'lobby' && prev.phase !== 'team-setup')) return prev;
            if (!prev.players[conn._pid]) return prev;
            const players = { ...prev.players };
            delete players[conn._pid];
            const next = { ...prev, players };
            leaderBroadcast({ type: 'snap', snap: next });
            return next;
          });
        }
      });
    });

    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && attemptsLeft > 0) {
        clearTimeout(timeout);
        try { peer.destroy(); } catch { }
        multiCreateRoom(attemptsLeft - 1);
        return;
      }
      clearTimeout(timeout);
      multiConnectingRef.current = false;
      setMultiConnecting(false);
      setMultiError('Erro: ' + (e.message || e.type));
      try { peer.destroy(); } catch { }
    });
  };

  // Heartbeat pro registro público de salas ("Ver salas") — só o líder
  // publica (o registro é só metadados pra descoberta; o jogo em si continua
  // 100% P2P). Publica na hora ao criar a sala (não espera o 1º tick) e
  // continua batendo durante team-setup/simulação — é assim que uma sala "em
  // andamento" segue visível (só que bloqueada) na lista em vez de sumir
  // assim que o jogo começa. Falha de rede aqui nunca pode virar erro visível
  // pro jogador, é só um canal auxiliar de descoberta.
  useEffect(() => {
    if (!isLeader || !roomCode) return;
    const publish = () => {
      setRoomSnap(current => {
        if (current) {
          api.publishRoom(roomCode, {
            label: current.players?.[MY_PID]?.name || 'Meu Time',
            gameMode: current.gameMode,
            playerCount: Object.keys(current.players || {}).length,
            phase: current.phase,
          }).catch(() => { });
        }
        return current;
      });
    };
    publish();
    const interval = setInterval(publish, 15000);
    return () => clearInterval(interval);
  }, [isLeader, roomCode]);

  const multiJoinRoom = async (code) => {
    if (multiConnectingRef.current) return; // já tem uma tentativa de entrada em andamento — evita Peer duplicado no duplo-toque
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) return;
    multiConnectingRef.current = true;
    setMultiConnecting(true);
    setMultiError('');
    const peer = new Peer(undefined, await peerOptions());
    peerRef.current = peer;

    // Entrar numa sala tem DUAS etapas que podem falhar, e elas pedem
    // recados diferentes:
    //   1. falar com o servidor de sinalização (o peer "abrir");
    //   2. abrir a conexão direta com o líder (WebRTC/ICE de verdade).
    // Antes existia um aviso só, de 12s, dizendo "sem resposta do servidor de
    // conexão — verifique sua internet". Quando o que falhava era a etapa 2
    // (rede que bloqueia P2P: Wi-Fi corporativo, 4G com CGNAT), o recado
    // mandava a pessoa olhar pro lugar errado — a internet dela estava ótima.
    // A etapa 2 também não tinha tratamento de erro nenhum: se o ICE morresse,
    // o botão ficava girando até o timeout sem nunca dizer o porquê.
    let peerOpened = false;
    let settled = false;
    const finishWith = (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      multiConnectingRef.current = false;
      setMultiConnecting(false);
      if (msg) setMultiError(msg);
      if (msg) { try { peer.destroy(); } catch { } }
    };
    const timeout = setTimeout(() => {
      // Quando não há relay disponível, "tente outra rede" é o único conselho
      // honesto: em 4G ou Wi-Fi de faculdade a conexão não vai fechar por
      // tentativa nenhuma, e mandar a pessoa insistir só faz perder tempo.
      finishWith(peerOpened
        ? (hasRelay === false
          ? 'Não foi possível abrir a conexão com o líder. Esta rede (4G ou Wi-Fi de faculdade/empresa) bloqueia conexão direta, e o servidor de retransmissão não está configurado. Tente pelo Wi-Fi de casa.'
          : 'Não foi possível abrir a conexão com o líder. Costuma ser a rede bloqueando conexão direta (Wi-Fi de empresa/faculdade, ou 4G). Tente outra rede, ou peça pro outro jogador criar a sala.')
        : 'Tempo esgotado — sem resposta do servidor de conexão. Verifique sua internet.');
    }, MULTI_CONNECT_TIMEOUT_MS);

    peer.on('open', (myPeerId) => {
      peerOpened = true;
      // O codigo de 6 caracteres digitado pelo jogador É o peerId completo do lider
      // (o lider cria sua sala com esse mesmo codigo como ID via generateRoomCode()).
      const conn = peer.connect(normalizedCode, { reliable: true });
      leaderConnRef.current = conn;
      conn.on('open', () => {
        finishWith(null);
        conn.send({ type: 'join', pid: MY_PID, name: myTeamName || 'Meu Time', color: myTeamColor, logo: myTeamLogo || null, coach: myTeamCoach || '', city: myTeamCity || '' });
        setIsLeader(false);
        setRoomCode(normalizedCode);
        setMultiPhase('room');
        setChatMessages([]);
        trackEvent('multiplayer_room_joined');
      });
      conn.on('data', (msg) => {
        if (msg.type === 'snap') { setRoomSnap(msg.snap); setMultiGameMode(msg.snap.gameMode); }
        if (msg.type === 'error') { alert(msg.msg); peer.destroy(); setMultiPhase('lobby'); }
        if (msg.type === 'chat' || msg.type === 'reaction') addLocalChatMessage(msg);
      });
      // Sem isso, uma conexão que morre no meio do caminho não avisava nada —
      // só o timeout genérico daqui a alguns segundos.
      conn.on('error', () => {
        finishWith('A conexão com o líder falhou. Confira se ele ainda está com a sala aberta e tente de novo.');
      });
      conn.on('close', () => {
        if (settled) alert('Conexão com o líder perdida.');
        else finishWith('A conexão com o líder caiu antes de entrar na sala. Tente de novo.');
      });
    });
    peer.on('error', (e) => {
      // `network` é a queda temporária do socket com o servidor de sinalização
      // — o PeerJS reconecta sozinho. Derrubar o peer aqui matava uma entrada
      // que ainda ia dar certo (e, depois de conectado, matava a sala inteira).
      if (e.type === 'network' && !settled) { try { peer.reconnect(); } catch { } return; }
      if (settled) return; // já está na sala: um erro avulso não pode derrubá-la
      if (e.type === 'peer-unavailable') finishWith('Sala não encontrada. Confira o código com quem criou a sala — ela também some se o criador fechar a aba.');
      else finishWith('Erro de conexão: ' + (e.message || e.type));
    });
  };

  // team-setup → cada jogador faz o draft normal (formação + escolha de jogadores + capitão)
  useEffect(() => {
    if (!roomSnap || roomSnap.phase !== 'team-setup') return;
    if (multiPhase === 'in-draft' || multiPhase === 'waiting') return;
    // reseta o estado do draft e inicia o fluxo solo normal
    setFormationKey(null);
    setPitchSlots([]);
    setPitch({});
    setUsedTeamIds([]);
    setSkipsLeft(MAX_SKIPS);
    setLog([]);
    setRolledTeam(null);
    setCaptainSlot(null);
    setRepositioningSlot(null);
    setPhase('formation');
    setMultiPhase('in-draft');
  }, [roomSnap?.phase]);

  // Timer countdown durante o draft multiplayer
  useEffect(() => {
    if (!roomSnap || roomSnap.phase !== 'team-setup') return;
    const minutes = roomSnap.timerMinutes || 3;
    const startedAt = roomSnap.startedAt || Date.now();
    const endAt = startedAt + minutes * 60 * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setMultiTimerLeft(left);
      if (left === 0) multiConfirmDraft(true); // força envio ao expirar
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [roomSnap?.phase, roomSnap?.startedAt, roomSnap?.timerMinutes]);

  // Submete o draft do jogador para a sala
  const multiConfirmDraft = (forced = false) => {
    if (multiPhase === 'waiting') return; // já submeteu
    const pitchWithCaptain = captainSlot && pitch[captainSlot]
      ? { ...pitch, [captainSlot]: { ...pitch[captainSlot], ovr: pitch[captainSlot].ovr + 2, isCaptain: true } }
      : pitch;
    const ovr = teamStrength(pitchWithCaptain);
    const safe = {};
    Object.entries(pitchWithCaptain).forEach(([k, p]) => {
      safe[k] = { name: p.name, pos: p.pos, ovr: p.ovr, club: p.club || '', year: p.year || 0, nat: p.nat || 'BRA', isBench: p.isBench || false, slotKey: k };
    });
    const fields = { pitch: safe, ovr, ready: true };
    if (isLeader) {
      setRoomSnap(prev => {
        if (!prev) return prev;
        const next = { ...prev, players: { ...prev.players, [MY_PID]: { ...(prev.players[MY_PID] || {}), ...fields } } };
        leaderBroadcast({ type: 'snap', snap: next });
        return next;
      });
    } else {
      leaderConnRef.current?.send({ type: 'update', pid: MY_PID, fields });
    }
    setMultiPhase('waiting');
    setPhase('multi-waiting');
  };

  // Quando o líder chama multiLeaderRematch (revanche) o snap volta pra
  // phase:'lobby' — esse efeito é o que leva QUALQUER peer (líder incluso)
  // de volta pra RoomScreen sozinho, assim que o snap chega (o handler de
  // 'data' já atualiza `roomSnap` na hora, não importa em que tela a pessoa
  // estava). Só dispara vindo de uma partida (`phase` ainda em 'playing'/
  // 'results') — não interfere no fluxo normal de criar/entrar numa sala,
  // que já usa `setMultiPhase('room')` direto e nunca passa por 'playing'/
  // 'results' antes disso.
  useEffect(() => {
    if (!roomSnap || roomSnap.phase !== 'lobby') return;
    if (phase !== 'playing' && phase !== 'results') return;
    setPhase('intro');
    setMultiPhase('room');
  }, [roomSnap?.phase, phase]);

  // Quando snapshot muda para 'simulation' → lança simulação local com seed compartilhado
  useEffect(() => {
    if (!roomSnap || roomSnap.phase !== 'simulation' || !roomSnap.seed) return;
    if (phase === 'playing' || phase === 'results') return;
    setScorers({});
    setAssisters({});
    setCleanSheets({});
    setSeasonRatings({});
    setCardCounts({});
    setRedCards({});
    setSuspensions({});
    setInjuries({});
    setLastRoundDiscipline(null);
    setLastMatchRatings(null);
    setTeamForm({});
    setSeasonAwards([]);
    // O `startSeason` do individual zera estes também; aqui eles ficavam de
    // fora, então uma campanha anterior podia vazar pra dentro da partida com
    // amigos (a "Campanha Completa" filtra só por modo de jogo, não por
    // sessão) e o calendário mostraria resultados de rodadas que não são
    // dessa liga.
    setMatchHistory([]);
    // Se a pessoa saiu no meio de um Desafio do Dia (botão "voltar ao menu",
    // que de propósito NUNCA apaga o save) e entrou direto numa sala com
    // amigos, essa flag ficava presa em `true`. Toda temporada de multiplayer
    // então caía no primeiro `if (isDailyChallenge)` de `applySeasonAwards`,
    // que retorna cedo e nunca chama o `submitSeasonResult` de verdade — o
    // jogador terminava a temporada e não ganhava ranking/título/conquista
    // nenhuma, em silêncio (o catch daquele branch é separado e não avisa).
    setIsDailyChallenge(false);
    setDailyOpponent(null);
    setRoundHistory({});
    setCupWinnerId(null);
    setCupRoundIdx(0);
    setEliminationRoundName(null);
    setBracketAdvance(null);
    resultsAfterBracketRef.current = false;
    setRoundResults(null);
    setActiveUserMatch(null);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setClockMinute(0);
    setCalendarCursor(null);
    calendarCursorRef.current = null;
    const players = Object.entries(roomSnap.players || {});
    const gMode = roomSnap.gameMode || 'brasileirao';
    const maxSlots = gMode === 'copa' ? 32 : 20;
    const humanTeams = players.map(([pid, p]) => ({
      id: pid, label: p.name || 'Jogador', badge: '', color: p.color || '#d4a23c',
      // Tabela do Brasileirão, chaveamento da Copa e o card de partida ao
      // vivo leem `clubLogo` pra desenhar o escudo de QUALQUER linha que não
      // seja "meu time" (o próprio jogador tem um caso especial à parte, via
      // `myTeamLogo`) — com isso fixo em null, o escudo de todo humano que
      // não fosse "eu" simplesmente nunca aparecia pros outros jogadores da
      // sala. `logo` já guardava o emblema escolhido; só faltava espelhar em
      // `clubLogo`, que é o campo que esses componentes de fato leem.
      logo: p.logo || null, clubLogo: p.logo || null, club: clubFromLogo(p.logo), ovr: p.ovr || 70,
      players: p.pitch ? partitionStartersFirst(Object.values(p.pitch)) : [], isHuman: true,
    }));
    const needed = maxSlots - humanTeams.length;
    const prng = makePrng(roomSnap.seed);
    const shuffled = [...TEAMS].sort(() => prng() - 0.5).slice(0, needed);
    const aiTeams = shuffled.map((t, i) => {
      const pp = t.players.map(pl => ({ ...pl, club: t.club, year: t.year, nat: pl.nat || 'BRA' }));
      return { id: `ai_${i}`, label: t.label, badge: '', color: '#888', logo: null, clubLogo: CLUB_LOGOS[t.club] || null, club: t.club, ovr: teamStrength(Object.fromEntries(pp.map((p, j) => [j, p]))), players: pp, isHuman: false };
    });
    const allTeams = [...humanTeams, ...aiTeams];
    setGameMode(gMode);
    setLeagueTeams(allTeams);
    if (gMode === 'brasileirao' || gMode === 'serieab') {
      // Mesma correção do single player (a posição no array decide em que
      // rodada cada dupla se enfrenta), mas aqui o embaralhamento PRECISA ser
      // semeado: com os humanos sempre nos primeiros índices, dois jogadores
      // caíam SEMPRE na 19ª e na 38ª rodada. Usa a seed compartilhada da sala
      // (+2 pra não repetir a sequência já usada no sorteio dos times de IA
      // acima) pra todos os peers gerarem exatamente o mesmo calendário.
      const rounds = generateDoubleRoundRobin(shuffle2(allTeams.map(t => t.id), makePrng(roomSnap.seed + 2)));
      setFixtures(rounds);
      setLeagueTable(allTeams.map(t => ({ id: t.id, label: t.label, clubLogo: t.clubLogo || null, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 })));
      setCurrentRound(0);
      setCupRounds([]);
      setCupLeg(1);
      setUserInCup(true);
      if (gMode === 'serieab') {
        // Série B da sala é só enfeite (sempre A pra todo mundo, ninguém joga
        // "na B" de verdade) — mas precisa nascer IDÊNTICA em todos os peers,
        // daí o `rand` semeado (+3, pra não repetir nenhuma sequência já usada
        // acima) em vez do Math.random cru que o singleplayer usa. Dificuldade
        // fixa em 'normal' pelo mesmo motivo do resto do preenchimento de IA
        // da sala (ver aiTeams acima): é lida do localStorage de cada peer,
        // então não é a mesma em todo mundo — usar teria feito essa Série B
        // "de mentira" simular resultados diferentes pra cada pessoa na sala.
        setMyDivision('A');
        setOtherDivision(buildMirrorDivision('normal', maxSlots - 1, makePrng(roomSnap.seed + 3)));
        setDivisionMove(null);
        setPromotionTie(null);
      }
    } else {
      // Copa do Brasil multiplayer
      const prng2 = makePrng(roomSnap.seed + 1);
      const shuffledIds = [...allTeams.map(t => t.id)].sort(() => prng2() - 0.5);
      const firstMatches = [];
      for (let i = 0; i + 1 < shuffledIds.length; i += 2)
        firstMatches.push({ homeId: shuffledIds[i], awayId: shuffledIds[i + 1] });
      const firstRound = { name: CUP_ROUND_NAMES[0], matches: firstMatches, leg1Results: [], results: [] };
      setCupRounds([firstRound]);
      setCupRoundIdx(0);
      setCupLeg(1);
      setUserInCup(true);
      setCupWinnerId(null);
      setFixtures([firstMatches]);
      setCurrentRound(0);
      setLeagueTable([]);
    }
    setPhase('playing');
    setMultiPhase(null);
  }, [roomSnap?.phase, roomSnap?.seed]);

  // Fases com painel de jogadores à esquerda + campinho fixo à direita
  // (Draft/Squad/Mercado) também sofriam com os 760px de sempre. Não usa
  // "sem limite" como a home: nessas telas a lista de jogadores é quem
  // sobra de espaço do grid (`1fr 380px`, o campinho já cresceu pro
  // tamanho máximo dele), e liberar o limite deixava cada linha da lista
  // enorme, com um vão vazio à direita do nome/overall — 1100 dá folga
  // real sem esvaziar as linhas. Já a home ('intro') vai sem limite mesmo
  // — é a tela de marketing/menu, pediram pra ocupar o espaço todo do PC.
  const wideMainMaxWidth = multiPhase ? null : phase === 'intro' ? 'none' : ['draft', 'squad', 'transfer'].includes(phase) ? 1100 : null;

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>
      <div style={styles.bgTexture} />
      {/* Timer flutuante durante o draft multiplayer */}
      {multiPhase === 'in-draft' && multiTimerLeft !== null && (
        <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 999, background: multiTimerLeft < 30 ? 'rgba(224,80,80,0.9)' : 'rgba(11,26,18,0.92)', border: `1px solid ${multiTimerLeft < 30 ? '#e05050' : 'rgba(212,162,60,0.4)'}`, borderRadius: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, opacity: 0.7, color: '#F4F1EA' }}>⏱ Tempo restante</span>
          <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: multiTimerLeft < 30 ? '#fff' : '#d4a23c' }}>
            {String(Math.floor(multiTimerLeft / 60)).padStart(2, '0')}:{String(multiTimerLeft % 60).padStart(2, '0')}
          </span>
        </div>
      )}
      {roomSnap && (
        <MultiplayerChatWidget
          messages={chatMessages}
          myPid={MY_PID}
          open={chatOpen}
          onToggle={() => setChatOpen(o => !o)}
          onSendText={sendChatMessage}
          onSendReaction={sendReaction}
          myTeamColor={myTeamColor}
        />
      )}
      <header style={styles.header}>
        {/* Header sempre em largura total, em toda tela (diferente do `main`
            abaixo, que ainda varia por fase via wideMainMaxWidth) — pedido
            explícito pra não ficar com uma faixa estreita centralizada. */}
        <div style={{ ...styles.headerInner, maxWidth: 'none' }} className="header-inner-pad">
          <div style={styles.crest}>🏆</div>
          <div>
            <div
              style={{ ...styles.title, cursor: 'pointer' }}
              className="header-title-h"
              title="Voltar ao menu inicial"
              onClick={requestGoHome}
            >BRASILEIRÃO LENDÁRIO</div>
            <div style={styles.subtitle} className="header-subtitle-h">monte · escale · seja campeão</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} className="header-actions-h">
            {/* "Continuar"/"Desafio do Dia" só fazem sentido na home (o resto
                do tempo já se está dentro de um jogo) — moveram pra cá pra
                tirar da frente do título de marketing no corpo da Intro. Uma
                divisória visual separa "ações da sessão" dos ícones utilitários,
                pra não virar uma fileira confusa de botões sem hierarquia. */}
            {phase === 'intro' && !multiPhase && (describePhase(savedPhase) || dailyChallenge) && (
              <>
                {describePhase(savedPhase) && (
                  <button
                    onClick={continueSavedGame}
                    className="mode-card-hover tap-target-sm"
                    title={describePhase(savedPhase)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0,
                      padding: '7px 12px', borderRadius: 999, color: '#0B1A12',
                      border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      background: `linear-gradient(135deg, ${myTeamColor || '#d4a23c'}, ${myTeamColor || '#d4a23c'}cc)`,
                    }}
                  >
                    ▶ Continuar
                  </button>
                )}
                {dailyChallenge && (
                  <button
                    onClick={() => !dailyChallengeAlreadyPlayed && setShowDailyChallenge(true)}
                    className={dailyChallengeAlreadyPlayed ? '' : 'mode-card-hover tap-target-sm'}
                    disabled={dailyChallengeAlreadyPlayed}
                    title={dailyChallengeAlreadyPlayed
                      ? 'Você já jogou a Supercopa do Brasil de hoje — volta amanhã pra outro time lendário.'
                      : `Monte um time pra enfrentar o ${parseTeamLabel(dailyChallenge.opponent.label).baseName} · vencer dá +50 pontos no ranking`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0,
                      padding: '7px 12px', borderRadius: 999, cursor: dailyChallengeAlreadyPlayed ? 'default' : 'pointer', fontSize: 12, fontWeight: 700,
                      color: dailyChallengeAlreadyPlayed ? 'rgba(244,241,234,0.4)' : (myTeamColor || '#d4a23c'),
                      border: `1.5px solid ${dailyChallengeAlreadyPlayed ? 'rgba(255,255,255,0.12)' : hexToRgba(myTeamColor || '#d4a23c', 0.4)}`,
                      background: dailyChallengeAlreadyPlayed ? 'transparent' : hexToRgba(myTeamColor || '#d4a23c', 0.1),
                    }}
                  >
                    {dailyChallengeAlreadyPlayed ? '✅ Supercopa de hoje feita' : '🏆 Supercopa do Brasil'}
                  </button>
                )}
                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
              </>
            )}
            <button
              onClick={shareApp}
              title="Compartilhar o jogo com amigos"
              className="tap-target-sm"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap',
                background: 'none', border: '1px solid rgba(212,162,60,0.35)',
                borderRadius: 999, padding: '6px 10px', cursor: 'pointer',
                color: appShareCopied ? '#7fd99a' : '#d4a23c', fontSize: 12, fontFamily: "'Space Mono', monospace",
              }}
            >
              {appShareCopied ? '✓' : '📤'} <span className="header-action-label">Compartilhar</span>
            </button>
            <button
              onClick={toggleGoalAudioMuted}
              title={goalAudioMuted ? 'Áudio de gol desativado — clique pra reativar' : 'Desativar áudio de gol'}
              className="tap-target-sm"
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap',
                background: 'none', border: '1px solid rgba(212,162,60,0.35)',
                borderRadius: 999, padding: '6px 10px', cursor: 'pointer',
                color: '#d4a23c', fontSize: 12, fontFamily: "'Space Mono', monospace",
              }}
            >
              🎙️ <span className="header-action-label">Áudio</span>
              {goalAudioMuted && (
                <span style={{
                  position: 'absolute', top: -2, right: -2, fontSize: 12, color: '#e05050',
                  textShadow: '0 0 2px rgba(0,0,0,0.9)',
                }}>✕</span>
              )}
            </button>
            <button
              onClick={navigateToRanking}
              title="Ranking global"
              className="tap-target-sm"
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap',
                background: 'none', border: '1px solid rgba(212,162,60,0.35)',
                borderRadius: 999, padding: '6px 10px', cursor: 'pointer',
                color: '#d4a23c', fontSize: 12, fontFamily: "'Space Mono', monospace",
              }}
            >🏆 <span className="header-action-label">Ranking</span></button>
            <button
              onClick={() => { setShowNews(true); try { localStorage.setItem('brl_news_seen', WHATS_NEW[0].id); } catch { /* ignore */ } }}
              title="Novidades"
              className="tap-target-sm"
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap',
                background: 'none', border: '1px solid rgba(212,162,60,0.35)',
                borderRadius: 999, padding: '6px 10px', cursor: 'pointer',
                color: '#d4a23c', fontSize: 12, fontFamily: "'Space Mono', monospace",
              }}
            >
              💡 <span className="header-action-label">Novidades</span>
              {unseenNewsCount > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -6, minWidth: 15, height: 15, padding: '0 3px',
                  borderRadius: 999, background: '#e05050', border: '1px solid #0B1A12',
                  fontSize: 9, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Space Mono', monospace", lineHeight: 1,
                }}>
                  {unseenNewsCount > 9 ? '9+' : unseenNewsCount}
                </span>
              )}
            </button>
            {currentUser ? (
              <button
                onClick={() => setShowAccountPanel(true)}
                className="header-account-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 999, padding: '6px 12px', cursor: 'pointer',
                  color: '#F4F1EA', fontSize: 12, fontFamily: "'Space Mono', monospace",
                  maxWidth: 180, whiteSpace: 'nowrap',
                }}
                title="Minha Conta"
              >
                <span>👤</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.username}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAccountModal(true)}
                className="header-account-btn tap-target-sm"
                style={{
                  flexShrink: 0, whiteSpace: 'nowrap',
                  background: 'none', border: '1px solid rgba(212,162,60,0.35)',
                  // 30px de altura no celular — abaixo do que o dedo acerta bem.
                  borderRadius: 999, padding: '8px 14px', minHeight: 36, cursor: 'pointer',
                  color: '#d4a23c', fontSize: 12, fontFamily: "'Space Mono', monospace", fontWeight: 600,
                }}
              >
                Entrar / Criar conta
              </button>
            )}
          </div>
        </div>
      </header>
      {isOffline && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9500,
          background: '#3a2c0f', color: '#d4a23c', textAlign: 'center',
          fontSize: 12, fontFamily: "'Space Mono', monospace", padding: '6px 12px',
          borderBottom: '1px solid rgba(212,162,60,0.35)',
        }}>
          📡 Sem conexão — jogando offline. Login, ranking e multiplayer ficam indisponíveis até a rede voltar.
        </div>
      )}
      {installPromptEvent && !installDismissed && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9500,
          background: '#0f1f15', borderTop: '1px solid rgba(212,162,60,0.3)',
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
          flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 12.5, color: '#F4F1EA' }}>📲 Instale o Brasileirão Lendário como app pra abrir mais rápido</span>
          <button onClick={handleInstallClick} style={{ background: '#d4a23c', color: '#0B1A12', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Instalar</button>
          <button onClick={dismissInstallBanner} style={{ background: 'none', border: 'none', color: 'rgba(244,241,234,0.4)', fontSize: 12, cursor: 'pointer' }}>Agora não</button>
        </div>
      )}
      {rankingPage && <RankingPage onBack={closeRankingPage} myUsername={currentUser?.username} myTeamColor={myTeamColor} />}
      {showNews && <NewsModal onClose={() => setShowNews(false)} />}
      {infoPage && <InfoPage tab={infoPage} onNavigate={navigateToInfo} onClose={closeInfoPage} myTeamColor={myTeamColor} />}
      {teamsPage === 'index' && <TeamsIndexPage onBack={closeTeamsPage} onOpenTeam={navigateToTeam} myTeamColor={myTeamColor} />}
      {teamsPage && teamsPage !== 'index' && (
        <TeamDetailPage
          team={TEAMS.find(t => t.id === teamsPage)}
          onBack={closeTeamsPage}
          onOpenIndex={navigateToTeamsIndex}
          myTeamColor={myTeamColor}
          onPlayWithTeam={team => { useReadyMadeSquad(team); closeTeamsPage(); }}
        />
      )}
      {newAchievements.length > 0 && (
        <AchievementToast achievements={newAchievements} onClose={() => setNewAchievements([])} />
      )}

      <main style={{ ...styles.main, maxWidth: wideMainMaxWidth || styles.main.maxWidth }} className="main-pad">
        {/* TELAS MULTIPLAYER */}
        {multiPhase === 'lobby' && (
          <MultiLobby
            gameMode={multiGameMode} onSetGameMode={setMultiGameMode}
            myTeamName={myTeamName} myTeamColor={myTeamColor} myTeamLogo={myTeamLogo}
            myTeamCoach={myTeamCoach} myTeamCity={myTeamCity}
            joinInput={joinInput} onJoinInput={setJoinInput}
            onCreateRoom={multiCreateRoom}
            onJoinRoom={() => multiJoinRoom(joinInput)}
            onBrowseRooms={() => setMultiPhase('browse')}
            connecting={multiConnecting} error={multiError}
            onBack={() => { setMultiPhase(null); setGameMode('brasileirao'); setMultiError(''); }}
          />
        )}
        {multiPhase === 'browse' && (
          <PublicRoomsScreen
            onBack={() => setMultiPhase('lobby')}
            onJoinRoom={multiJoinRoom}
            myTeamColor={myTeamColor}
          />
        )}
        {multiPhase === 'room' && roomSnap && (
          <RoomScreen
            roomCode={roomCode} roomData={roomSnap} myId={MY_PID} isLeader={isLeader}
            myTeamName={myTeamName} myTeamColor={myTeamColor} myTeamLogo={myTeamLogo}
            myTeamCoach={myTeamCoach} myTeamCity={myTeamCity}
            onSetName={v => { setMyTeamName(v); multiUpdateMyTeam({ name: v }); }}
            onSetColor={v => { setMyTeamColor(v); multiUpdateMyTeam({ color: v }); }}
            onSetLogo={v => { setMyTeamLogo(v); multiUpdateMyTeam({ logo: v || null }); }}
            onSetCoach={v => { setMyTeamCoach(v); multiUpdateMyTeam({ coach: v }); }}
            onSetCity={v => { setMyTeamCity(v); multiUpdateMyTeam({ city: v }); }}
            onSetTimer={multiLeaderSetTimer}
            onStartSetup={multiLeaderStart}
            onStartSimulation={multiLeaderSimulate}
            onReady={multiSetReady}
            timerLeft={multiTimerLeft}
            onBack={leaveMultiplayer}
          />
        )}

        {phase === 'intro' && !multiPhase && (
          <Intro
            onStart={goToFormationPicker}
            gameMode={gameMode} onSetGameMode={setGameMode}
            difficulty={difficulty} onSetDifficulty={setDifficulty}
            myTeamColor={myTeamColor} myTeamLogo={myTeamLogo} myTeamBadge={myTeamBadge}
            currentUser={currentUser}
            onUpdateFields={updateAccountFields}
            onMultiPlayer={() => setMultiPhase('lobby')}
            onNavigateInfo={navigateToInfo}
            onNavigateTeams={navigateToTeamsIndex}
            dailyChallenge={dailyChallenge}
            dailyChallengeAlreadyPlayed={dailyChallengeAlreadyPlayed}
            onOpenDailyChallenge={() => setShowDailyChallenge(true)}
          />
        )}
        {showDailyChallenge && (
          <DailyChallengeModal
            opponent={dailyChallenge.opponent}
            myTeamColor={myTeamColor}
            onPick={startDailyChallenge}
            onClose={() => setShowDailyChallenge(false)}
          />
        )}
        {phase === 'formation' && <FormationPicker onChoose={chooseFormation} onBack={!multiPhase ? () => setPhase('intro') : undefined} gameMode={!multiPhase ? gameMode : undefined} onSetGameMode={!multiPhase && !isDailyChallenge ? setGameMode : undefined} onPlayReadyMade={useReadyMadeSquad} isDailyChallenge={isDailyChallenge} />}
        {phase === 'transfer' && (
          <TransferMarket
            pitch={pitch}
            pitchSlots={pitchSlots}
            myTeamColor={myTeamColor}
            onConfirm={confirmTransferReleases}
          />
        )}
        {phase === 'draft' && (
          <Draft
            onBack={(!multiPhase && !isTransferSeason) ? () => { setPhase('formation'); setPitch({}); setUsedTeamIds([]); setLog([]); setRolledTeam(null); setSkipsLeft(MAX_SKIPS); } : undefined}
            rolledTeam={rolledTeam}
            isRolling={isRolling}
            rollingPreview={rollingPreview}
            pitch={pitch}
            pitchSlots={pitchSlots}
            formationLabel={formationKey ? FORMATIONS[formationKey].label : ''}
            skipsLeft={skipsLeft}
            selectedPlayer={selectedPlayer}
            repositioningSlot={repositioningSlot}
            eligibleSlotsForPlayer={eligibleSlotsForPlayer}
            isPlayerBlockedByFormation={isPlayerBlockedByFormation}
            onClickPlayer={clickPlayer}
            onClickPitchSlot={clickPitchSlot}
            onUnplacePlayer={startReposition}
            onSkipTeam={skipTeam}
            mustSkip={rolledTeamHasNoFit}
            myTeamColor={myTeamColor}
            captainSlot={captainSlot}
          />
        )}
        {phase === 'squad' && (
          <Squad
            pitch={pitch} pitchSlots={pitchSlots}
            formationLabel={formationKey ? FORMATIONS[formationKey].label : ''}
            captainSlot={captainSlot} onSetCaptain={setCaptainSlot}
            onConfirm={multiPhase === 'in-draft' ? multiConfirmDraft : isDailyChallenge ? confirmDailyChallenge : (isTransferSeason ? newSeason : startSeason)}
            onRedo={!isTransferSeason && !isDailyChallenge ? () => { setPhase('formation'); setCaptainSlot(null); } : undefined}
            myTeamColor={myTeamColor}
            selectedPlayer={selectedPlayer}
            repositioningSlot={repositioningSlot}
            eligibleSlotsForPlayer={eligibleSlotsForPlayer}
            onClickPitchSlot={clickPitchSlot}
            onUnplacePlayer={startReposition}
          />
        )}
        {phase === 'multi-waiting' && roomSnap && (
          <MultiWaitingScreen
            roomData={roomSnap} myId={MY_PID} isLeader={isLeader}
            myTeamColor={myTeamColor} onSimulate={multiLeaderSimulate}
          />
        )}
        {phase === 'playing' && (
          <Playing
            myTeamId={myTeamId}
            pitchSlots={pitchSlots}
            fixtures={fixtures}
            currentRound={currentRound}
            leagueTeams={leagueTeams}
            leagueTable={leagueTable}
            clockMinute={clockMinute}
            isSimulating={isSimulating}
            liveEvents={liveEvents}
            liveScore={liveScore}
            roundResults={roundResults}
            activeUserMatch={activeUserMatch}
            myTeamColor={myTeamColor}
            myTeamBadge={myTeamBadge}
            myTeamLogo={myTeamLogo}
            gameMode={gameMode}
            cupRounds={cupRounds}
            cupRoundIdx={cupRoundIdx}
            cupLeg={cupLeg}
            userInCup={userInCup}
            eliminationRoundName={eliminationRoundName}
            simSpeed={simSpeed}
            onSetSpeed={setSimSpeed}
            simMode={simMode}
            onSetSimMode={setSimMode}
            autoCountdown={autoCountdown}
            onStartRound={startRound}
            onNextRound={goNextRound}
            matchHistory={matchHistory}
            scorers={scorers}
            assisters={assisters}
            cleanSheets={cleanSheets}
            seasonRatings={seasonRatings}
            cardCounts={cardCounts}
            redCards={redCards}
            suspensions={suspensions}
            injuries={injuries}
            lastRoundDiscipline={lastRoundDiscipline}
            lastMatchRatings={lastMatchRatings}
            teamForm={teamForm}
            viewingTeam={viewingTeam}
            onViewTeam={setViewingTeam}
            onSimulateAll={isDailyChallenge ? () => fastForwardBrasileirao(null, { onCalendar: false }) : gameMode === 'copa' ? fastForwardCopa : (gameMode === 'serieab' && promotionTie?.leg) ? undefined : simulateSeasonOnCalendar}
            onOpenCalendar={!isDailyChallenge && (gameMode === 'brasileirao' || gameMode === 'serieab') ? openCalendar : undefined}
            myDivision={myDivision}
            otherDivision={otherDivision}
            promotionTie={promotionTie}
            isDailyChallenge={isDailyChallenge}
            // Durante a simulação pelo calendário o modal já mostra o
            // progresso — o overlay genérico "Simulando…" só atrapalharia.
            fastSimActive={fastSimActive && !calendarSimActive}
            fastSimStatusMsg={fastSimStatusMsg}
            onCancelFastSim={cancelFastSim}
            isPaused={isPaused}
            onPause={pauseSim}
            onResume={resumeSim}
            showSubPanel={showSubPanel}
            forcedSubReason={forcedSubReason}
            liveLineup={liveLineup}
            subSelectStarter={subSelectStarter}
            onSelectSubStarter={setSubSelectStarter}
            onApplySub={applyLiveSub}
            subbedOutNames={subbedOutNames}
            bracketAdvance={bracketAdvance}
            onDismissBracketAdvance={dismissBracketAdvance}
            difficulty={difficulty}
          />
        )}
        {phase === 'results' && isDailyChallenge && (
          <DailyChallengeResults leagueTable={leagueTable} myTeamId={myTeamId} myTeamColor={myTeamColor} myTeamBadge={myTeamBadge} myTeamLogo={myTeamLogo} leagueTeams={leagueTeams} currentUser={currentUser} onExit={exitDailyChallenge} />
        )}
        {phase === 'results' && !isDailyChallenge && (
          /* "Nova temporada" e "Mercado" reconstroem a liga em torno de
             MY_TEAM_ID, mas dentro de uma sala o time do jogador é o id do
             peer (ver `myTeamId`) — a temporada nascia sem ele em nenhum
             confronto e a tela de jogo abria sem botão de jogar. Numa
             partida com amigos o caminho certo é "Jogar de novo com o mesmo
             grupo" (onRematch, líder-only, volta a sala pra 'lobby') ou
             "Sair da sala" (onRestart aqui vira `leaveMultiplayer`, não
             `restart`: `restart` apaga o `brl_save` do disco
             incondicionalmente, e uma sessão multiplayer nunca escreve nele
             — autosave pula enquanto `multiPhase || roomSnap` —, então o
             save no disco, se existir, é de uma carreira solo real sem
             nada a ver com essa sala). */
          <Results leagueTable={leagueTable} myTeamId={myTeamId} myTeamColor={myTeamColor} myTeamBadge={myTeamBadge} myTeamLogo={myTeamLogo} gameMode={gameMode} cupWinnerId={cupWinnerId} eliminationRoundName={eliminationRoundName} leagueTeams={leagueTeams} onRestart={roomSnap ? leaveMultiplayer : restart} isLeader={isLeader} onRematch={roomSnap ? multiLeaderRematch : undefined} scorers={scorers} assisters={assisters} cleanSheets={cleanSheets} seasonRatings={seasonRatings} cardCounts={cardCounts} redCards={redCards} seasonAwards={seasonAwards} onNewSeason={roomSnap ? undefined : newSeason} onOpenTransferMarket={roomSnap ? undefined : openTransferMarket} matchHistory={matchHistory} onViewTeam={setViewingTeam} currentUser={currentUser} onOpenAccount={() => openAccountModal('signup')} myDivision={myDivision} divisionMove={divisionMove} promotionTie={promotionTie} otherDivision={otherDivision} />
        )}
        {viewingTeam && (
          <TeamViewModal team={viewingTeam} onClose={() => setViewingTeam(null)} myTeamColor={myTeamColor} suspensions={suspensions} injuries={injuries} />
        )}
        {/* `phase === 'playing'` é rede de segurança: o calendário nunca pode
            ficar por cima da tela de resultado no fim da temporada. */}
        {showCalendar && phase === 'playing' && (gameMode === 'brasileirao' || gameMode === 'serieab') && fixtures.length > 0 && (
          <SeasonCalendarModal
            fixtures={fixtures}
            seasonDates={seasonDates}
            currentRound={currentRound}
            roundHistory={roundHistory}
            leagueTeams={leagueTeams}
            myTeamId={myTeamId}
            myTeamColor={myTeamColor}
            simActive={calendarSimActive}
            cursorDate={calendarCursor}
            speed={calendarSpeed}
            onSetSpeed={changeCalendarSpeed}
            onSimulateTo={(round) => fastForwardBrasileirao(round, { onCalendar: true })}
            onSimulateAll={() => fastForwardBrasileirao(null, { onCalendar: true })}
            onStop={cancelFastSim}
            onClose={() => setShowCalendar(false)}
          />
        )}
        {showMatchSummary && activeUserMatch && (
          <MatchSummaryModal
            ratings={lastMatchRatings}
            match={activeUserMatch}
            score={roundResults?.find(r => r.homeId === activeUserMatch.homeId && r.awayId === activeUserMatch.awayId)}
            homeTeam={leagueTeams.find(t => t.id === activeUserMatch.homeId)}
            awayTeam={leagueTeams.find(t => t.id === activeUserMatch.awayId)}
            myTeamId={myTeamId}
            myTeamColor={myTeamColor}
            onDismiss={() => setShowMatchSummary(false)}
          />
        )}
        {penaltyPhase && (
          <PenaltyModal
            penaltyPhase={penaltyPhase}
            myTeamColor={myTeamColor}
            auto={simMode === 'auto'}
            onDismiss={() => {
              // Zera o ref ANTES de chamar goNextRound — setPenaltyPhase(null)
              // só reflete no próximo render, e goNextRound (closure velho)
              // ainda leria o penaltyPhase antigo se dependesse só do state.
              penaltyPhaseRef.current = null;
              setPenaltyPhase(null);
              goNextRound();
            }}
          />
        )}
      </main>
      {showLeaveConfirm && (
        <div onClick={() => setShowLeaveConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Sair da sala?</div>
            <p style={{ fontSize: 13, opacity: 0.65, lineHeight: 1.5, marginBottom: 6 }}>
              Você está numa partida com outros jogadores. Voltar ao menu agora desconecta você da sala.
            </p>
            <button onClick={() => { setShowLeaveConfirm(false); leaveMultiplayer(); }} style={{ ...styles.btnPrimary, width: '100%', background: '#e05050', color: '#fff', marginTop: 16 }}>
              Sim, sair da sala
            </button>
            <button onClick={() => setShowLeaveConfirm(false)} style={{ ...styles.btnGhost, marginTop: 10 }}>
              Cancelar, continuar jogando
            </button>
          </div>
        </div>
      )}
      {showOverwriteConfirm && (
        <div onClick={() => setShowOverwriteConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Começar um jogo novo?</div>
            <p style={{ fontSize: 13, opacity: 0.65, lineHeight: 1.5, marginBottom: 6 }}>
              Você tem uma partida salva em <b>{describePhase(savedPhase)}</b>. Começar de novo substitui ela — não dá pra retomar depois.
            </p>
            <button onClick={confirmNewGameOverSave} style={{ ...styles.btnPrimary, width: '100%', background: '#e05050', color: '#fff', marginTop: 16 }}>
              Começar mesmo assim
            </button>
            <button onClick={() => setShowOverwriteConfirm(false)} style={{ ...styles.btnGhost, marginTop: 10 }}>
              Cancelar, continuar meu jogo salvo
            </button>
          </div>
        </div>
      )}
      {showAccountModal && (
        <AccountModal
          mode={accountModalMode}
          onGuestChoice={handleGuestChoice}
          onAuthSuccess={handleAuthSuccess}
          onClose={() => setShowAccountModal(false)}
        />
      )}
      {showAccountPanel && currentUser && (
        <AccountPanel
          user={currentUser}
          onUpdateFields={updateAccountFields}
          onClose={() => setShowAccountPanel(false)}
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccount}
        />
      )}
    </div>
  );
}

// ============================================================
// TELAS
// ============================================================
// ============================================================
// CROP DE LOGO
// ============================================================
function ImageCropModal({ src, onConfirm, onCancel }) {
  const CROP = 200;
  const canvasRef = useRef(null);
  const imgRef = useRef(new Image());
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const drag = useRef({ active: false, sx: 0, sy: 0, spx: 0, spy: 0 });

  useEffect(() => {
    const img = imgRef.current;
    img.onload = () => {
      const fit = CROP / Math.min(img.naturalWidth, img.naturalHeight);
      setZoom(fit);
      setPan({ x: 0, y: 0 });
      setLoaded(true);
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    if (!loaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = imgRef.current;
    ctx.clearRect(0, 0, CROP, CROP);
    ctx.save();
    ctx.beginPath();
    ctx.arc(CROP / 2, CROP / 2, CROP / 2, 0, Math.PI * 2);
    ctx.clip();
    const sw = img.naturalWidth * zoom;
    const sh = img.naturalHeight * zoom;
    ctx.drawImage(img, (CROP - sw) / 2 + pan.x, (CROP - sh) / 2 + pan.y, sw, sh);
    ctx.restore();
    ctx.strokeStyle = 'rgba(212,162,60,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CROP / 2, CROP / 2, CROP / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [pan, zoom, loaded]);

  // Pointer Events (não Mouse Events) — cobrem mouse, touch e caneta com a
  // mesma API. Com só onMouse*, arrastar pra reposicionar o logo era
  // impossível no celular (touch não dispara mousemove/mouseup contínuo).
  // setPointerCapture mantém os eventos vindo pro canvas mesmo se o dedo/
  // cursor sair da área dele no meio do arraste.
  const onPD = e => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { active: true, sx: e.clientX, sy: e.clientY, spx: pan.x, spy: pan.y };
  };
  const onPM = e => {
    if (!drag.current.active) return;
    setPan({ x: drag.current.spx + e.clientX - drag.current.sx, y: drag.current.spy + e.clientY - drag.current.sy });
  };
  const onPU = () => { drag.current.active = false; };

  const confirm = () => {
    const out = document.createElement('canvas');
    out.width = 120; out.height = 120;
    const ctx = out.getContext('2d');
    const img = imgRef.current;
    const sc = 120 / CROP;
    ctx.save();
    ctx.beginPath();
    ctx.arc(60, 60, 60, 0, Math.PI * 2);
    ctx.clip();
    const sw = img.naturalWidth * zoom * sc;
    const sh = img.naturalHeight * zoom * sc;
    ctx.drawImage(img, ((CROP - img.naturalWidth * zoom) / 2 + pan.x) * sc, ((CROP - img.naturalHeight * zoom) / 2 + pan.y) * sc, sw, sh);
    ctx.restore();
    onConfirm(out.toDataURL('image/png'));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700 }}>Recortar logo do time</div>
      <div style={{ fontSize: 12, opacity: 0.5 }}>Arraste para reposicionar · Use o slider para zoom</div>
      <canvas
        ref={canvasRef} width={CROP} height={CROP}
        style={{ borderRadius: '50%', cursor: 'grab', display: 'block', touchAction: 'none' }}
        onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={onPU}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, opacity: 0.45 }}>−</span>
        <input type="range" min="0.3" max="4" step="0.05" value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          style={{ width: 160, accentColor: '#d4a23c' }}
        />
        <span style={{ fontSize: 12, opacity: 0.45 }}>+</span>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onCancel} style={{ padding: '10px 22px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#F4F1EA', cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
        <button onClick={confirm} style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: '#d4a23c', color: '#0B1A12', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Confirmar recorte</button>
      </div>
    </div>
  );
}

// ============================================================
// CONTA — modal de entrada (cadastro / login / convidado)
// ============================================================
// Só abre por ação explícita (botão "Entrar / Criar conta" no cabeçalho, ou
// convite contextual no fim de temporada) — nunca mais sozinho ao carregar a
// página. Por isso sempre pode ser fechado: quem abriu, decide quando sair.
function AccountModal({ mode: initialMode = 'choice', onGuestChoice, onAuthSuccess, onClose }) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (mode === 'signup' && !username.trim()) { setError('Escolha um nome de usuário.'); return; }
    if (!email.trim() || !password) { setError('Preencha email e senha.'); return; }
    setLoading(true);
    try {
      const result = mode === 'signup' ? await api.signup(username, email, password) : await api.login(email, password);
      onAuthSuccess(result, mode);
    } catch (err) {
      setError(err.message || 'Algo deu errado. Tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, position: 'relative' }}>
        <button onClick={onClose} aria-label="Fechar" className="tap-target-sm" style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', padding: 6, lineHeight: 1 }}>✕</button>

        {mode === 'choice' && (
          <>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Bem-vindo!</div>
            <p style={{ fontSize: 13, opacity: 0.6, textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
              Crie uma conta pra salvar seu time e acessar de qualquer lugar, ou jogue como convidado sem compromisso.
            </p>
            <button onClick={() => setMode('signup')} style={{ ...styles.btnIntro, width: '100%', background: '#d4a23c', color: '#0B1A12', marginBottom: 10 }}>Criar conta</button>
            <button onClick={() => setMode('login')} style={{ ...styles.btnGhost, marginTop: 0, marginBottom: 10 }}>Já tenho conta</button>
            <button onClick={onGuestChoice} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, padding: '8px 0', cursor: 'pointer' }}>
              Jogar como convidado →
            </button>
          </>
        )}

        {(mode === 'signup' || mode === 'login') && (
          <>
            <button onClick={() => setMode('choice')} className="tap-target-sm" style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px 14px', margin: '0 0 0 -2px', minHeight: 34 }}>&#8592; Voltar</button>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, marginBottom: 18 }}>
              {mode === 'signup' ? 'Criar conta' : 'Entrar'}
            </div>
            {mode === 'signup' && (
              <input
                value={username} onChange={e => setUsername(e.target.value)} placeholder="Nome de usuário"
                autoFocus maxLength={20} style={{ ...styles.teamInput, marginBottom: 10 }}
              />
            )}
            <input
              value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
              autoFocus={mode !== 'signup'} style={{ ...styles.teamInput, marginBottom: 10 }}
            />
            <input
              value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha (mín. 6 caracteres)" type="password"
              onKeyDown={e => e.key === 'Enter' && submit()}
              style={{ ...styles.teamInput, marginBottom: 14 }}
            />
            {error && <div style={{ color: '#e05050', fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <button onClick={submit} disabled={loading} style={{ ...styles.btnIntro, width: '100%', background: '#d4a23c', color: '#0B1A12', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Aguarde…' : mode === 'signup' ? 'Criar conta' : 'Entrar'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Barrinhas de equalizador — indicador de "tocando agora" reaproveitável.
function EqBars({ color = '#d4a23c', height = 12 }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height, flexShrink: 0 }}>
      {[6, 10, 7, 12, 5, 9, 7, 11, 6].map((h, i) => (
        <div key={i} style={{ width: 3, height: h * (height / 12), borderRadius: 2, background: color, animation: `pulse ${0.5 + i * 0.1}s ease-in-out infinite alternate`, opacity: 0.7 }} />
      ))}
    </div>
  );
}

// ============================================================
// CONTA — painel de edição (time, email/senha, excluir conta)
// ============================================================
function AccountPanel({ user, onUpdateFields, onClose, onLogout, onDeleteAccount }) {
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [credError, setCredError] = useState('');
  const [savingCred, setSavingCred] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setUsername(user.username);
    setEmail(user.email);
  }, [user]);

  const saveCredentials = async () => {
    setCredError('');
    const fields = {};
    const normalizedUsername = username.trim();
    if (normalizedUsername && normalizedUsername !== user.username) fields.username = normalizedUsername;
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail && normalizedEmail !== user.email) fields.email = normalizedEmail;
    if (password) fields.password = password;
    if (Object.keys(fields).length === 0) return;
    // Email/senha são sensíveis o bastante pra exigir confirmação com a senha
    // atual (evita que um token vazado sequestre a conta sozinho).
    if ((fields.email || fields.password) && !currentPassword) {
      setCredError('Informe sua senha atual para confirmar.');
      return;
    }
    if (fields.email || fields.password) fields.currentPassword = currentPassword;
    setSavingCred(true);
    try {
      await onUpdateFields(fields);
      setPassword('');
      setCurrentPassword('');
    } catch (err) {
      setCredError(err.message || 'Erro ao salvar.');
    } finally {
      setSavingCred(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    if (!deletePassword) { setError('Informe sua senha para confirmar a exclusão.'); return; }
    setDeleting(true);
    try { await onDeleteAccount(deletePassword); }
    catch (err) { setError(err.message || 'Erro ao excluir conta.'); setDeleting(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={onClose} aria-label="Fechar" className="tap-target-sm" style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', padding: 6, lineHeight: 1 }}>✕</button>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{user.username}</div>
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 20 }}>{user.email}</div>

        <div style={styles.teamEditSection}>
          <div style={styles.teamEditLabel}>Usuário, email e senha</div>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Nome de usuário" maxLength={20} style={styles.teamInput} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={{ ...styles.teamInput, marginTop: 8 }} />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Nova senha (opcional)" style={{ ...styles.teamInput, marginTop: 8 }} />
          <input value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} type="password" placeholder="Senha atual (p/ alterar email ou senha)" style={{ ...styles.teamInput, marginTop: 8 }} />
          {credError && <div style={{ color: '#e05050', fontSize: 12, marginTop: 6 }}>{credError}</div>}
          <button onClick={saveCredentials} disabled={savingCred} style={{ ...styles.btnSmall, marginTop: 10 }}>
            {savingCred ? 'Salvando…' : 'Salvar'}
          </button>
        </div>

        {error && <div style={{ color: '#e05050', fontSize: 12, marginTop: 10 }}>{error}</div>}
        {confirmDelete && (
          <input value={deletePassword} onChange={e => setDeletePassword(e.target.value)} type="password" placeholder="Digite sua senha para confirmar" style={{ ...styles.teamInput, marginTop: 10 }} autoFocus />
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onLogout} style={{ ...styles.btnGhost, marginTop: 0, flex: 1 }}>Sair</button>
          <button onClick={handleDelete} disabled={deleting} style={{ ...styles.btnGhost, marginTop: 0, flex: 1, borderColor: 'rgba(224,80,80,0.4)', color: '#e05050' }}>
            {confirmDelete ? (deleting ? 'Excluindo…' : 'Confirmar exclusão?') : 'Excluir conta'}
          </button>
        </div>
      </div>
    </div>
  );
}

const TEAM_BADGES = ['⭐', '🔥', '🦅', '🐯', '🦁', '💎', '⚡', '🏆', '🌊', '🎯', '🛡️', '🌟'];
const TEAM_COLORS = ['#d4a23c', '#e05050', '#4a90d9', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#e91e8c'];

// Estados brasileiros — usado no seletor de UF do time (Ver Clube) e no
// filtro de região do ranking global. Precisa bater com BRAZIL_UFS no
// backend (server/routes/me.ts).
const BRAZIL_UFS = [
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'],
  ['CE', 'Ceará'], ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'], ['GO', 'Goiás'],
  ['MA', 'Maranhão'], ['MT', 'Mato Grosso'], ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'],
  ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'], ['PE', 'Pernambuco'], ['PI', 'Piauí'],
  ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'], ['RS', 'Rio Grande do Sul'],
  ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'], ['SP', 'São Paulo'],
  ['SE', 'Sergipe'], ['TO', 'Tocantins'],
];

function parseYouTubeId(input) {
  if (!input) return null;
  const s = input.trim();
  // youtu.be/ID
  const short = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return short[1];
  // youtube.com/watch?v=ID
  const long = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (long) return long[1];
  // youtube.com/embed/ID
  const embed = s.match(/embed\/([A-Za-z0-9_-]{11})/);
  if (embed) return embed[1];
  // raw 11-char ID
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}

// Supercopa do Brasil (Desafio do Dia) — mostra o time lendário sorteado
// pra hoje e manda pra tela de formação/sorteio pra montar um time do zero
// pra enfrentá-lo, igual começar uma carreira nova.
function DailyChallengeModal({ opponent, myTeamColor, onPick, onClose }) {
  const mc = myTeamColor || '#d4a23c';
  const { baseName, achievement } = parseTeamLabel(opponent.label);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#0f1f15', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>🏆 Supercopa do Brasil</div>
          <button onClick={onClose} className="tap-target-sm" style={{ background: 'none', border: 'none', color: '#F4F1EA', fontSize: 20, cursor: 'pointer', width: 32, height: 32 }}>×</button>
        </div>
        <p style={{ fontSize: 12.5, opacity: 0.6, lineHeight: 1.5, marginBottom: 16 }}>
          Monte um time do zero (mesmo sorteio de sempre) pra enfrentar o time lendário de hoje, numa partida única. Vencer dá +50 pontos no ranking global. O adversário muda todo dia, e só dá pra jogar uma vez — capricha na escalação!
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1px solid ${hexToRgba(mc, 0.35)}`, background: hexToRgba(mc, 0.08), marginBottom: 16 }}>
          {CLUB_LOGOS[opponent.club] && (
            <img src={CLUB_LOGOS[opponent.club]} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none'; }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, opacity: 0.55, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Adversário de hoje</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{baseName} <span style={{ opacity: 0.5, fontWeight: 400 }}>{opponent.year}</span></div>
            {achievement && <div style={{ fontSize: 11, color: mc, marginTop: 1 }}>{achievement}</div>}
          </div>
        </div>
        <button
          onClick={() => onPick(opponent)}
          style={{ ...styles.btnPrimary, width: '100%', background: mc, color: '#0B1A12' }}
        >
          Montar meu time →
        </button>
      </div>
    </div>
  );
}

// Objetivos em destaque na home — curadoria de 4 (não a galeria de 25 inteira,
// pra não poluir a primeira tela). Mistura metas binárias (sem barra, ex.:
// título invicto) com metas quantitativas (com barra, via getAchievementProgress).
const FEATURED_ACHIEVEMENT_IDS = ['unbeaten_league_champion', 'goals_1000', 'dynasty', 'veteran'];

// Selo de tamanho do acervo: quantos clubes, elencos e jogadores dá pra
// sortear. Substitui contagem de contas cadastradas/ativas (ver GAME_STATS
// acima) nos dois lugares em que a home e o ranking mostravam esse tipo de
// número de cara.
function GameStatsBar({ style }) {
  return (
    <div style={style}>
      <b>{GAME_STATS.clubs}</b> clubes · <b>{GAME_STATS.squads}</b> elencos históricos · <b>{GAME_STATS.players.toLocaleString('pt-BR')}</b> jogadores
    </div>
  );
}

function Intro({ onStart, gameMode, onSetGameMode, difficulty, onSetDifficulty, myTeamColor, myTeamLogo, myTeamBadge, currentUser, onUpdateFields, onMultiPlayer, onNavigateInfo, onNavigateTeams, dailyChallenge, dailyChallengeAlreadyPlayed, onOpenDailyChallenge }) {
  const mc = myTeamColor || '#d4a23c';
  const carouselTeams = [...TEAMS, ...TEAMS]; // duplicado pra loop contínuo do carrossel
  const [showClub, setShowClub] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);

  return (
    <>
      <div style={styles.introCard} className="intro-card-mob">
        <div style={{ ...styles.introTopBar, background: `linear-gradient(90deg, transparent, ${mc}, transparent)` }} />
        {/* "Continuar"/"Desafio do Dia" moraram aqui antes — foram pro
            cabeçalho (só aparecem na home) pra não competir com o título de
            marketing logo abaixo, deixando esse topo só com o selo do jogo. */}
        <div style={styles.introBadge}>⚽ Futebol Brasileiro · 1959–2024</div>
        <GameStatsBar style={styles.gameStatsBar} />
        <h1 style={styles.introTitle} className="intro-title-h">Monte o time lendário dos seus sonhos.</h1>
        <p style={styles.introLead}>
          Sorteie os maiores times campeões do Brasileirão, escolha os melhores jogadores de cada era
          e dispute uma liga completa com cronômetro ao vivo.
        </p>

        <div style={styles.featGrid} className="feat-grid-3">
          <div style={styles.featCard} className="feat-card-hover">
            <span style={styles.featIndex}>01</span>
            <div style={{ ...styles.featIconWrap, background: hexToRgba(mc, 0.14), border: `1px solid ${hexToRgba(mc, 0.35)}` }}>🎲</div>
            <div style={styles.featTitle}>Role o dado</div>
            <div style={styles.featDesc}>Sorteie times campeões lendários. Recuse até 3 que não te interessar.</div>
          </div>
          <div style={styles.featCard} className="feat-card-hover">
            <span style={styles.featIndex}>02</span>
            <div style={{ ...styles.featIconWrap, background: hexToRgba(mc, 0.14), border: `1px solid ${hexToRgba(mc, 0.35)}` }}>🏟️</div>
            <div style={styles.featTitle}>Monte o Plantel</div>
            <div style={styles.featDesc}>Escolha 11 titulares e 5 reservas entre os maiores craques de cada era.</div>
          </div>
          <div style={styles.featCard} className="feat-card-hover">
            <span style={styles.featIndex}>03</span>
            <div style={{ ...styles.featIconWrap, background: hexToRgba(mc, 0.14), border: `1px solid ${hexToRgba(mc, 0.35)}` }}>🏆</div>
            <div style={styles.featTitle}>Dispute o título</div>
            <div style={styles.featDesc}>Liga com 20 times, 38 rodadas e gols aparecendo minuto a minuto.</div>
          </div>
        </div>

        <div style={styles.introSectionLabel}>{TEAMS.length} times lendários no elenco</div>
        <div style={styles.introMarqueeWrap}>
          <div style={styles.introMarqueeTrack} className="marquee-track">
            {carouselTeams.map((t, i) => (
              <div key={`${t.id}-${i}`} style={styles.introTeamChip}>
                {CLUB_LOGOS[t.club] && (
                  <img src={CLUB_LOGOS[t.club]} alt="" style={styles.introTeamChipCrest} onError={e => { e.currentTarget.style.display = 'none'; }} />
                )}
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* Clube + objetivos de carreira — só pra quem tem conta (é o que
            persiste entre sessões); convidado vê uma chamada pra criar conta. */}
        {currentUser ? (
          <div style={{ marginBottom: 28 }}>
            <button
              onClick={() => setShowClub(true)}
              className="mode-card-hover"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                padding: '14px 16px', marginBottom: 14, borderRadius: 12, color: '#F4F1EA',
                border: `2px solid ${hexToRgba(mc, 0.4)}`, background: hexToRgba(mc, 0.08), cursor: 'pointer',
              }}
            >
              {myTeamLogo
                ? <img src={myTeamLogo} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                : <span style={{ fontSize: 32, flexShrink: 0 }}>{myTeamBadge || '⭐'}</span>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: mc }}>Ver meu Clube</div>
                <div style={{ fontSize: 11, opacity: 0.6, color: '#F4F1EA' }}>
                  {(currentUser.titles_brasileirao || 0) + (currentUser.titles_copa || 0)} títulos · {currentUser.seasons_played || 0} temporadas · histórico completo
                </div>
              </div>
              <span style={{ fontSize: 18, opacity: 0.5, color: '#F4F1EA' }}>→</span>
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={styles.teamEditLabel}>Conquistas em destaque</div>
              <button onClick={() => setShowAchievements(true)} style={{ background: 'none', border: 'none', color: mc, fontSize: 11, cursor: 'pointer', padding: 0 }}>
                Ver todas ({Object.keys(ACHIEVEMENT_CATALOG).length}) →
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FEATURED_ACHIEVEMENT_IDS.map(id => (
                <AchievementProgressCard key={id} id={id} user={currentUser} unlockedSet={new Set(currentUser.achievements || [])} />
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            marginBottom: 28, padding: '14px 16px', borderRadius: 12,
            border: '1px dashed rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.02)',
            fontSize: 12, opacity: 0.6, textAlign: 'center',
          }}>
            Crie uma conta pra acompanhar seus objetivos de carreira e o histórico do seu clube.
          </div>
        )}

        {/* Modo de jogo */}
        <div style={{ marginBottom: 28 }}>
          <div style={styles.teamEditLabel}>Modo de jogo</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              {
                // O Brasileirão sem divisão única saiu de circulação — agora
                // "Brasileirão" JÁ é a Série A/B, com acesso e queda embutidos.
                id: 'serieab',
                trophy: 'https://r2.thesportsdb.com/images/media/league/trophy/02ftjh1684945323.png',
                title: 'Brasileirão',
                sub: '40 times · Série A e B · Acesso e queda a cada temporada',
              },
              {
                id: 'copa',
                trophy: 'https://r2.thesportsdb.com/images/media/league/trophy/jv27c41776553182.png',
                title: 'Copa do Brasil',
                sub: '32 times · Mata-mata · Ida e volta',
              },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => onSetGameMode(m.id)}
                className="mode-card-hover"
                aria-pressed={gameMode === m.id}
                style={{
                  padding: '14px 12px', borderRadius: 12, border: '2px solid', position: 'relative',
                  borderColor: gameMode === m.id ? mc : 'rgba(255,255,255,0.1)',
                  background: gameMode === m.id ? hexToRgba(mc, 0.1) : 'rgba(255,255,255,0.03)',
                  color: '#F4F1EA', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                  boxShadow: gameMode === m.id ? `0 0 0 1px ${hexToRgba(mc, 0.15)} inset` : 'none',
                }}
              >
                {gameMode === m.id && (
                  <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: mc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#0B1A12' }}>✓</div>
                )}
                <img
                  src={m.trophy}
                  alt={m.title}
                  style={{ height: 40, objectFit: 'contain', marginBottom: 8, display: 'block' }}
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, color: gameMode === m.id ? mc : '#F4F1EA' }}>{m.title}</div>
                <div style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>{m.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Dificuldade */}
        <div style={{ marginBottom: 28 }}>
          <div style={styles.teamEditLabel}>Dificuldade</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }} className="difficulty-grid">
            {Object.entries(DIFFICULTY_LEVELS).map(([key, d]) => (
              <button
                key={key}
                onClick={() => onSetDifficulty(key)}
                title={d.desc}
                className="mode-card-hover"
                aria-pressed={difficulty === key}
                style={{
                  padding: '10px 6px', borderRadius: 10, border: '2px solid',
                  borderColor: difficulty === key ? mc : 'rgba(255,255,255,0.1)',
                  background: difficulty === key ? hexToRgba(mc, 0.1) : 'rgba(255,255,255,0.03)',
                  color: difficulty === key ? mc : '#F4F1EA',
                  cursor: 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 700,
                  transition: 'all 0.12s',
                }}
              >
                {d.short}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 6, lineHeight: 1.4 }}>{DIFFICULTY_LEVELS[difficulty]?.desc}</div>
        </div>

        {/* Jogar com Amigos */}
        <button
          onClick={onMultiPlayer}
          style={{
            width: '100%', marginBottom: 20, padding: '14px 16px',
            borderRadius: 12, border: '2px solid rgba(127,217,154,0.35)',
            background: 'rgba(127,217,154,0.06)', color: '#7fd99a',
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 14,
          }}
        >
          <span style={{ fontSize: 28 }}>👥</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Jogar com Amigos</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Brasileirão (até 20) · Copa do Brasil (até 32) · Sala por código</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 18, opacity: 0.5 }}>→</span>
        </button>

        <button style={{ ...styles.btnIntro, background: `linear-gradient(135deg, ${mc}, ${mc}cc)`, color: '#0B1A12', boxShadow: `0 8px 24px ${hexToRgba(mc, 0.35)}` }} onClick={onStart}>
          {gameMode === 'copa' ? 'Escolher formação — Copa →' : 'Escolher formação — Brasileirão →'}
        </button>

        {/* Rodapé institucional */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap',
          marginTop: 28, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          {[['como-jogar', 'Como Jogar'], ['termos', 'Termos de Uso'], ['privacidade', 'Política de Privacidade'], ['contato', 'Contato']].map(([id, label]) => (
            <button key={id} onClick={() => onNavigateInfo(id)} className="tap-target-sm" style={{ background: 'none', border: 'none', color: 'rgba(244,241,234,0.45)', cursor: 'pointer', fontSize: 11.5, padding: '6px 2px', textDecoration: 'underline', textUnderlineOffset: 3 }}>
              {label}
            </button>
          ))}
          <button onClick={onNavigateTeams} className="tap-target-sm" style={{ background: 'none', border: 'none', color: 'rgba(244,241,234,0.45)', cursor: 'pointer', fontSize: 11.5, padding: '6px 2px', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Times Históricos
          </button>
          {dailyChallenge && (
            <button
              onClick={() => !dailyChallengeAlreadyPlayed && onOpenDailyChallenge()}
              className="tap-target-sm"
              disabled={dailyChallengeAlreadyPlayed}
              title={dailyChallengeAlreadyPlayed ? 'Você já jogou hoje — volta amanhã.' : 'Monte um time e vencer dá +50 pontos no ranking global'}
              style={{
                background: 'none', border: 'none', cursor: dailyChallengeAlreadyPlayed ? 'default' : 'pointer', fontSize: 11.5, padding: '6px 2px',
                textDecoration: 'underline', textUnderlineOffset: 3,
                color: dailyChallengeAlreadyPlayed ? 'rgba(244,241,234,0.3)' : 'rgba(244,241,234,0.45)',
              }}
            >
              🏆 Supercopa do Brasil {!dailyChallengeAlreadyPlayed && '(+50 pts)'}
            </button>
          )}
        </div>
      </div>

      {showClub && (
        <ClubHistoryModal user={currentUser} myTeamLogo={myTeamLogo} myTeamBadge={myTeamBadge} myTeamColor={myTeamColor} onUpdateFields={onUpdateFields} onClose={() => setShowClub(false)} />
      )}
      {showAchievements && currentUser && (
        <AchievementsModal user={currentUser} onClose={() => setShowAchievements(false)} />
      )}
    </>
  );
}

// "Ver meu Clube" — histórico de carreira completo da conta (jogos, V/E/D,
// gols marcados/sofridos, títulos, conquistas). Reaproveita os campos
// career_* que o servidor já acumula a cada temporada registrada.
function ClubHistoryModal({ user, myTeamLogo, myTeamBadge, myTeamColor, onClose, onUpdateFields }) {
  const mc = myTeamColor || '#d4a23c';
  const mp = user?.career_matches_played || 0;
  const w = user?.career_wins || 0;
  const d = user?.career_draws || 0;
  const l = user?.career_losses || 0;
  const winPct = mp > 0 ? Math.round((w / mp) * 100) : 0;
  const gp = user?.career_goals || 0;
  const gc = user?.career_conceded || 0;
  const gd = gp - gc;
  const assists = user?.career_assists || 0;
  const unlockedCount = (user?.achievements || []).length;
  const totalAchievements = Object.keys(ACHIEVEMENT_CATALOG).length;
  // Recordes de carreira: o servidor já calcula e guarda tudo isso
  // (routes/me.ts, season-result) mas essa tela — que é justamente o lugar
  // certo pra mostrar a história do clube — não exibia nenhum deles.
  const bestPosition = user?.best_position ?? null;
  const bestGoalDiff = user?.best_goal_diff ?? null;
  const bestTeamOvr = user?.best_team_ovr ?? null;
  const bestPlayerOvr = user?.best_player_ovr ?? null;
  const rankingPoints = user?.ranking_points ?? 0;
  const unbeatenTitles = (user?.unbeaten_titles_brasileirao || 0) + (user?.unbeaten_titles_copa || 0);
  const multiplayerWins = user?.multiplayer_wins || 0;

  const fileInputRef = useRef(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [name, setName] = useState(user?.team_name || '');
  const [city, setCity] = useState(user?.team_city || '');
  const [coach, setCoach] = useState(user?.team_coach || '');
  const [error, setError] = useState('');
  const [showAchievements, setShowAchievements] = useState(false);

  const [audioMode, setAudioMode] = useState('default'); // 'off' | 'default' | 'hino' | 'youtube'
  const [ytInput, setYtInput] = useState('');
  const [ytId, setYtId] = useState(null);

  const [goalAudioMode, setGoalAudioMode] = useState('idle'); // 'idle' | 'record' | 'link'
  const [goalAudioLinkInput, setGoalAudioLinkInput] = useState('');
  const [isRecordingGoal, setIsRecordingGoal] = useState(false);
  const [recordedGoalPreviewUrl, setRecordedGoalPreviewUrl] = useState(null);
  const [recordedGoalDataUrl, setRecordedGoalDataUrl] = useState(null);
  const [goalAudioError, setGoalAudioError] = useState('');
  const goalMediaRecorderRef = useRef(null);
  const goalRecordTimeoutRef = useRef(null);
  const goalAudioFileInputRef = useRef(null);

  const anthemClub = clubFromLogo(myTeamLogo);
  const anthemId = anthemClub && CLUB_ANTHEMS[anthemClub];
  // Só um dos três modos toca por vez ('hino' ou 'youtube' — 'default' é o
  // <audio> local, sem esse problema), então um hook só, apontado pro vídeo
  // do modo ativo, cobre os dois. Mesmo bug do hino do campeão: um <iframe
  // autoplay=1> cru nunca tocava som de verdade em navegador nenhum.
  const ambientVideoId = audioMode === 'hino' ? (anthemId || null) : audioMode === 'youtube' ? ytId : null;
  const ambientPlayer = useMutedAutoplayYouTube(ambientVideoId);

  useEffect(() => {
    setName(user?.team_name || '');
    setCity(user?.team_city || '');
    setCoach(user?.team_coach || '');
  }, [user]);

  const commitField = async (field, value) => {
    setError('');
    try { await onUpdateFields({ [field]: value }); }
    catch (err) { setError(err.message || 'Erro ao salvar.'); }
  };

  const handleFileChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    e.target.value = '';
  };

  const applyYoutube = () => {
    const id = parseYouTubeId(ytInput);
    if (id) setYtId(id);
  };

  const startGoalRecording = async () => {
    setGoalAudioError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          setRecordedGoalDataUrl(reader.result);
          setRecordedGoalPreviewUrl(URL.createObjectURL(blob));
        };
        reader.readAsDataURL(blob);
        setIsRecordingGoal(false);
      };
      goalMediaRecorderRef.current = mr;
      mr.start();
      setIsRecordingGoal(true);
      goalRecordTimeoutRef.current = setTimeout(() => { if (mr.state === 'recording') mr.stop(); }, 5000);
    } catch {
      setGoalAudioError('Não foi possível acessar o microfone.');
    }
  };
  const stopGoalRecording = () => {
    clearTimeout(goalRecordTimeoutRef.current);
    if (goalMediaRecorderRef.current?.state === 'recording') goalMediaRecorderRef.current.stop();
  };
  const saveGoalRecording = async () => {
    if (!recordedGoalDataUrl) return;
    await commitField('goal_audio', recordedGoalDataUrl);
    setRecordedGoalDataUrl(null);
    setRecordedGoalPreviewUrl(null);
    setGoalAudioMode('idle');
  };
  const discardGoalRecording = () => {
    setRecordedGoalDataUrl(null);
    setRecordedGoalPreviewUrl(null);
  };
  const applyGoalAudioLink = () => {
    const url = goalAudioLinkInput.trim();
    if (!url) return;
    commitField('goal_audio', url);
    setGoalAudioMode('idle');
    setGoalAudioLinkInput('');
  };
  // Ver AccountPanel (removido) pro histórico dessa decisão: o limite tem que
  // caber no `express.json({ limit: '2mb' })` do servidor DEPOIS de virar
  // base64 (infla ~33%) — 1.4MB brutos dá ~1.87MB em base64, com folga.
  const MAX_GOAL_AUDIO_BYTES = 1.4 * 1024 * 1024;
  const handleGoalAudioFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_GOAL_AUDIO_BYTES) {
      setGoalAudioError('Áudio muito grande (máx. 1,4MB). Escolha um arquivo mais curto.');
      e.target.value = '';
      return;
    }
    setGoalAudioError('');
    const reader = new FileReader();
    reader.onload = () => commitField('goal_audio', reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const removeGoalAudio = () => commitField('goal_audio', null);

  // Cor fixa (não a cor do time) pro texto — a cor do time pode ser escura
  // (ex.: preto do Santos), o que deixava o número ilegível em cima do fundo
  // escuro do modal. Dourado fixo é sempre legível, é o acento padrão do app.
  const statColor = '#d4a23c';
  const Stat = ({ label, value }) => (
    <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 19, fontWeight: 700, color: statColor }}>{value}</div>
      <div style={{ fontSize: 9.5, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>{label}</div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onConfirm={dataUrl => { setCropSrc(null); commitField('team_logo', dataUrl); }}
          onCancel={() => setCropSrc(null)}
        />
      )}
      {showAchievements && <AchievementsModal user={user} onClose={() => setShowAchievements(false)} />}
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, position: 'relative' }}>
        <button onClick={onClose} aria-label="Fechar" className="tap-target-sm" style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 18, cursor: 'pointer', zIndex: 1, padding: 6, lineHeight: 1 }}>✕</button>
        <div style={{ padding: '28px 24px 20px', textAlign: 'center', background: `linear-gradient(180deg, ${hexToRgba(mc, 0.18)}, transparent)`, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {myTeamLogo
            ? <img src={myTeamLogo} alt="" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', marginBottom: 10 }} />
            : <div style={{ fontSize: 48, marginBottom: 6 }}>{myTeamBadge || '⭐'}</div>
          }
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700 }}>{user?.team_name || 'Meu Time'}</div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
            {user?.team_city || ''}{user?.team_coach ? ` · Téc. ${user.team_coach}` : ''}
          </div>
          {user?.created_at && (
            <div style={{ fontSize: 10.5, opacity: 0.4, marginTop: 4 }}>
              Clube fundado em {new Date(user.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          {onUpdateFields && (
            <div style={styles.teamEditCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: 76, height: 76, borderRadius: 16,
                      background: hexToRgba(mc, 0.15),
                      border: `2px dashed ${hexToRgba(mc, 0.6)}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', overflow: 'hidden', position: 'relative',
                    }}
                  >
                    {myTeamLogo
                      ? <img src={myTeamLogo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 32, opacity: 0.4 }}>📷</span>
                    }
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: 11, fontWeight: 600, color: mc, background: hexToRgba(mc, 0.12), border: `1px solid ${hexToRgba(mc, 0.3)}`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                  >
                    📷 Upload logo
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                {myTeamLogo && (
                  <button onClick={() => commitField('team_logo', null)} style={{ fontSize: 11, color: '#e05050', background: 'none', border: '1px solid rgba(224,80,80,0.3)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                    Remover logo
                  </button>
                )}
              </div>

              <div style={styles.teamEditSep} />

              <div style={styles.teamEditSection}>
                <div style={styles.teamEditLabel}>Emblema do clube</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(CLUB_LOGOS).map(([club, url]) => (
                    <button
                      key={club}
                      onClick={() => commitField('team_logo', myTeamLogo === url ? null : url)}
                      title={club}
                      style={{
                        width: 44, height: 44, borderRadius: 10, padding: 5,
                        border: `2px solid ${myTeamLogo === url ? mc : 'rgba(255,255,255,0.08)'}`,
                        background: myTeamLogo === url ? hexToRgba(mc, 0.15) : 'rgba(255,255,255,0.03)',
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}
                    >
                      <img src={url} alt={club} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.teamEditSection}>
                <div style={styles.teamEditLabel}>Cor principal</div>
                <div style={styles.colorGrid}>
                  {TEAM_COLORS.map(c => (
                    <button key={c} onClick={() => commitField('team_color', c)} style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: c,
                      border: `3px solid ${mc === c ? '#fff' : 'transparent'}`,
                      outline: mc === c ? `2px solid ${c}` : 'none',
                      outlineOffset: 2,
                      cursor: 'pointer', transition: 'all 0.12s', padding: 0,
                    }} />
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={styles.teamEditLabel}>Nome do time</label>
                  <input
                    value={name} onChange={e => setName(e.target.value)}
                    onBlur={() => name !== (user?.team_name || '') && commitField('team_name', name)}
                    placeholder="Meu Time" maxLength={24} style={styles.teamInput}
                  />
                </div>
                <div>
                  <label style={styles.teamEditLabel}>Cidade</label>
                  <input
                    value={city} onChange={e => setCity(e.target.value)}
                    onBlur={() => city !== (user?.team_city || '') && commitField('team_city', city)}
                    placeholder="Ex: São Paulo" maxLength={20} style={styles.teamInput}
                  />
                </div>
                <div>
                  <label style={styles.teamEditLabel}>Estado (UF)</label>
                  <select
                    value={user?.team_uf || ''}
                    onChange={e => commitField('team_uf', e.target.value || null)}
                    style={styles.teamInput}
                  >
                    <option value="" style={styles.selectOption}>Não informado</option>
                    {BRAZIL_UFS.map(([code, label]) => (
                      <option key={code} value={code} style={styles.selectOption}>{code} — {label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={styles.teamEditLabel}>Técnico</label>
                  <input
                    value={coach} onChange={e => setCoach(e.target.value)}
                    onBlur={() => coach !== (user?.team_coach || '') && commitField('team_coach', coach)}
                    placeholder="Seu nome" maxLength={24} style={styles.teamInput}
                  />
                </div>
              </div>
              {error && <div style={{ color: '#e05050', fontSize: 11.5, marginTop: 10 }}>{error}</div>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            <Stat label="Brasileirões" value={user?.titles_brasileirao || 0} />
            <Stat label="Copas do Brasil" value={user?.titles_copa || 0} />
            <Stat label="Temporadas" value={user?.seasons_played || 0} />
            <Stat label="Pontos ranking" value={rankingPoints} />
          </div>

          <div style={{ fontSize: 10, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Retrospecto de carreira</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Stat label="Jogos" value={mp} />
            <Stat label="Vitórias" value={w} />
            <Stat label="Empates" value={d} />
            <Stat label="Derrotas" value={l} />
          </div>
          {mp > 0 && (
            <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', display: 'flex', marginBottom: 6 }}>
              <div style={{ width: `${(w / mp) * 100}%`, background: '#7fd99a' }} />
              <div style={{ width: `${(d / mp) * 100}%`, background: '#d4a23c' }} />
              <div style={{ width: `${(l / mp) * 100}%`, background: '#e05050' }} />
            </div>
          )}
          <div style={{ fontSize: 11, opacity: 0.5, textAlign: 'center', marginBottom: 22 }}>{winPct}% de aproveitamento</div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            <Stat label="Gols marcados" value={gp} />
            <Stat label="Assistências" value={assists} />
            <Stat label="Gols sofridos" value={gc} />
            <Stat label="Saldo" value={gd >= 0 ? `+${gd}` : gd} />
          </div>

          {/* Recordes — melhor marca já batida em qualquer temporada da
              carreira, nunca diminui (ver applySeasonAwards no servidor).
              Só aparece o que já foi alcançado ao menos uma vez. */}
          {(bestPosition != null || bestGoalDiff != null || bestTeamOvr != null || bestPlayerOvr != null || unbeatenTitles > 0 || multiplayerWins > 0) && (
            <>
              <div style={{ fontSize: 10, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Recordes</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
                {bestPosition != null && <Stat label="Melhor posição" value={`${bestPosition}º`} />}
                {bestGoalDiff != null && <Stat label="Melhor saldo" value={bestGoalDiff >= 0 ? `+${bestGoalDiff}` : bestGoalDiff} />}
                {bestTeamOvr != null && <Stat label="Melhor time" value={Number(bestTeamOvr).toFixed(1)} />}
                {bestPlayerOvr != null && <Stat label="Melhor jogador" value={bestPlayerOvr} />}
                {unbeatenTitles > 0 && <Stat label="Títulos invictos" value={unbeatenTitles} />}
                {multiplayerWins > 0 && <Stat label="Vitórias c/ amigos" value={multiplayerWins} />}
              </div>
            </>
          )}

          <div style={{ marginBottom: onUpdateFields ? 24 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 10, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1 }}>
                Conquistas ({unlockedCount}/{totalAchievements})
              </div>
              <button onClick={() => setShowAchievements(true)} style={{ background: 'none', border: 'none', color: mc, fontSize: 11, cursor: 'pointer', padding: 0 }}>
                Ver todas →
              </button>
            </div>
            {user?.achievements?.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {user.achievements.map(id => {
                  const a = ACHIEVEMENT_CATALOG[id];
                  if (!a) return null;
                  return (
                    <span key={id} title={a.desc} style={{ fontSize: 11, background: 'rgba(212,162,60,0.12)', border: '1px solid rgba(212,162,60,0.3)', borderRadius: 999, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {a.icon} {a.label}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 11.5, opacity: 0.4 }}>Nenhuma conquista desbloqueada ainda.</div>
            )}
          </div>

          {onUpdateFields && (
            <>
              {/* Áudio ambiente — trilha padrão, hino do clube ou link próprio */}
              <div style={{
                background: `linear-gradient(135deg, ${hexToRgba(mc, 0.14)}, rgba(0,0,0,0.4))`,
                border: `1px solid ${hexToRgba(mc, 0.3)}`,
                borderRadius: 16, padding: '18px 20px', marginBottom: 24, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 40px)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, position: 'relative' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: hexToRgba(mc, 0.18), border: `1px solid ${hexToRgba(mc, 0.4)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎙️</div>
                  <div>
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: mc, fontWeight: 700 }}>Transmissão</div>
                    <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 700 }}>Áudio ambiente</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8, position: 'relative' }}>
                  <button
                    onClick={() => setAudioMode(m => m === 'default' ? 'off' : 'default')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${audioMode === 'default' ? hexToRgba(mc, 0.5) : 'rgba(255,255,255,0.1)'}`,
                      background: audioMode === 'default' ? hexToRgba(mc, 0.12) : 'rgba(255,255,255,0.03)',
                      color: '#F4F1EA', textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>🎵</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Trilha padrão</div>
                      <div style={{ fontSize: 11, opacity: 0.55 }}>Som ambiente clássico do jogo</div>
                    </div>
                    {audioMode === 'default' && <EqBars color={mc} />}
                  </button>

                  <button
                    onClick={() => anthemId && setAudioMode(m => m === 'hino' ? 'off' : 'hino')}
                    disabled={!anthemId}
                    title={!anthemId ? 'Escolha um emblema de clube oficial acima pra liberar o hino' : ''}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '10px 14px', borderRadius: 10, cursor: anthemId ? 'pointer' : 'not-allowed',
                      border: `1px solid ${audioMode === 'hino' ? hexToRgba(mc, 0.5) : 'rgba(255,255,255,0.1)'}`,
                      background: audioMode === 'hino' ? hexToRgba(mc, 0.12) : 'rgba(255,255,255,0.03)',
                      color: '#F4F1EA', textAlign: 'left', transition: 'all 0.15s', opacity: anthemId ? 1 : 0.45,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>🏆</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Hino {anthemClub ? `do ${anthemClub.replace(/-/g, ' ')}` : 'do seu time'}</div>
                      <div style={{ fontSize: 11, opacity: 0.55 }}>{anthemId ? 'Hino oficial do clube' : 'Escolha um emblema oficial acima pra liberar'}</div>
                    </div>
                    {audioMode === 'hino' && anthemId && (
                      ambientPlayer.playing && ambientPlayer.muted ? (
                        <span
                          onClick={e => { e.stopPropagation(); ambientPlayer.activate(); }}
                          title="Autoplay só é permitido sem som — clique pra ativar"
                          style={{ fontSize: 10.5, fontWeight: 700, color: mc, background: hexToRgba(mc, 0.18), border: `1px solid ${hexToRgba(mc, 0.5)}`, borderRadius: 999, padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}
                        >
                          🔊 Ativar som
                        </span>
                      ) : ambientPlayer.playing ? <EqBars color={mc} /> : null
                    )}
                  </button>

                  <button
                    onClick={() => setAudioMode(m => m === 'youtube' ? 'off' : 'youtube')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${audioMode === 'youtube' ? hexToRgba(mc, 0.5) : 'rgba(255,255,255,0.1)'}`,
                      background: audioMode === 'youtube' ? hexToRgba(mc, 0.12) : 'rgba(255,255,255,0.03)',
                      color: '#F4F1EA', textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>🔗</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Link personalizado</div>
                      <div style={{ fontSize: 11, opacity: 0.55 }}>Cole um link do YouTube</div>
                    </div>
                    {audioMode === 'youtube' && ytId && (
                      ambientPlayer.playing && ambientPlayer.muted ? (
                        <span
                          onClick={e => { e.stopPropagation(); ambientPlayer.activate(); }}
                          title="Autoplay só é permitido sem som — clique pra ativar"
                          style={{ fontSize: 10.5, fontWeight: 700, color: mc, background: hexToRgba(mc, 0.18), border: `1px solid ${hexToRgba(mc, 0.5)}`, borderRadius: 999, padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}
                        >
                          🔊 Ativar som
                        </span>
                      ) : ambientPlayer.playing ? <EqBars color={mc} /> : null
                    )}
                  </button>
                </div>

                {audioMode === 'youtube' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, position: 'relative' }}>
                    <input
                      value={ytInput} onChange={e => setYtInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && applyYoutube()}
                      placeholder="Link do YouTube…" style={{ ...styles.teamInput, flex: 1, margin: 0 }}
                    />
                    <button onClick={applyYoutube} style={{ background: mc, color: '#0B1A12', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      Tocar
                    </button>
                  </div>
                )}
                {audioMode === 'youtube' && !ytId && ytInput && (
                  <div style={{ fontSize: 11, color: '#e05050', marginTop: 6, position: 'relative' }}>Link inválido — cole um link do YouTube ou ID de 11 caracteres.</div>
                )}

                {audioMode === 'default' && (
                  <audio key="club-default-bg" src="/audio.mp3" autoPlay loop style={{ display: 'none' }} />
                )}
                {/* Um container só pro modo ativo (hino OU link — nunca os
                    dois ao mesmo tempo). O hook decide sozinho qual vídeo
                    carregar a partir de `ambientVideoId`. */}
                {ambientVideoId && (
                  <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
                    <div ref={ambientPlayer.containerRef} />
                  </div>
                )}
              </div>

              {/* Áudio de gol do meu time — grava, cola link ou envia arquivo */}
              <div style={{
                background: `linear-gradient(135deg, ${hexToRgba(mc, 0.14)}, rgba(0,0,0,0.4))`,
                border: `1px solid ${hexToRgba(mc, 0.3)}`,
                borderRadius: 16, padding: '18px 20px', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: hexToRgba(mc, 0.18), border: `1px solid ${hexToRgba(mc, 0.4)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>⚽</div>
                  <div>
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: mc, fontWeight: 700 }}>Comemoração</div>
                    <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 700 }}>Áudio de gol do meu time</div>
                  </div>
                </div>

                {user?.goal_audio ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, opacity: 0.7, flex: 1 }}>Áudio personalizado configurado</span>
                    <button onClick={() => { const a = new Audio(user.goal_audio); a.play().catch(() => { }); }} style={{ fontSize: 11, color: mc, background: 'none', border: `1px solid ${hexToRgba(mc, 0.4)}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>▶ Testar</button>
                    <button onClick={removeGoalAudio} style={{ fontSize: 11, color: '#e05050', background: 'none', border: '1px solid rgba(224,80,80,0.3)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>Remover</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 12 }}>Sem áudio personalizado — toca o som padrão do clube (quando disponível) ao marcar gol.</div>
                )}

                <div style={{ display: 'grid', gap: 8 }}>
                  <button
                    onClick={() => setGoalAudioMode(m => m === 'record' ? 'idle' : 'record')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${goalAudioMode === 'record' ? hexToRgba(mc, 0.5) : 'rgba(255,255,255,0.1)'}`,
                      background: goalAudioMode === 'record' ? hexToRgba(mc, 0.12) : 'rgba(255,255,255,0.03)',
                      color: '#F4F1EA', textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>🎙️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Gravar</div>
                      <div style={{ fontSize: 11, opacity: 0.55 }}>Grave até 5 segundos pelo microfone</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setGoalAudioMode(m => m === 'link' ? 'idle' : 'link')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${goalAudioMode === 'link' ? hexToRgba(mc, 0.5) : 'rgba(255,255,255,0.1)'}`,
                      background: goalAudioMode === 'link' ? hexToRgba(mc, 0.12) : 'rgba(255,255,255,0.03)',
                      color: '#F4F1EA', textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>🔗</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Link de áudio</div>
                      <div style={{ fontSize: 11, opacity: 0.55 }}>Cole a URL direta de um arquivo de áudio</div>
                    </div>
                  </button>

                  <button
                    onClick={() => goalAudioFileInputRef.current?.click()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                      color: '#F4F1EA', textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>📁</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Enviar arquivo</div>
                      <div style={{ fontSize: 11, opacity: 0.55 }}>Escolha um arquivo de áudio do seu dispositivo</div>
                    </div>
                  </button>
                  <input ref={goalAudioFileInputRef} type="file" accept="audio/*" onChange={handleGoalAudioFile} style={{ display: 'none' }} />
                </div>

                {goalAudioMode === 'record' && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {!isRecordingGoal && !recordedGoalPreviewUrl && (
                      <button onClick={startGoalRecording} style={{ ...styles.btnSmall, margin: 0 }}>● Iniciar gravação</button>
                    )}
                    {isRecordingGoal && (
                      <button onClick={stopGoalRecording} style={{ ...styles.btnSmall, margin: 0, color: '#e05050', borderColor: 'rgba(224,80,80,0.4)' }}>■ Parar (gravando…)</button>
                    )}
                    {recordedGoalPreviewUrl && (
                      <>
                        <audio src={recordedGoalPreviewUrl} controls style={{ height: 32 }} />
                        <button onClick={saveGoalRecording} style={{ ...styles.btnSmall, margin: 0 }}>Salvar</button>
                        <button onClick={discardGoalRecording} style={{ ...styles.btnSmall, margin: 0, color: '#e05050', borderColor: 'rgba(224,80,80,0.4)' }}>Descartar</button>
                      </>
                    )}
                  </div>
                )}
                {goalAudioMode === 'link' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input
                      value={goalAudioLinkInput} onChange={e => setGoalAudioLinkInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && applyGoalAudioLink()}
                      placeholder="https://…/gol.mp3" style={{ ...styles.teamInput, flex: 1, margin: 0 }}
                    />
                    <button onClick={applyGoalAudioLink} style={{ background: mc, color: '#0B1A12', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      Aplicar
                    </button>
                  </div>
                )}
                {goalAudioError && <div style={{ color: '#e05050', fontSize: 11, marginTop: 8 }}>{goalAudioError}</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const CONTACT_EMAIL = 'leonardoranuci@brasileiraolendario.com.br';

// Link de email reutilizável — clicar SEMPRE copia o endereço pro clipboard
// (com confirmação visível trocando o texto por um instante), além de tentar
// abrir o cliente de email padrão via mailto:. O mailto: sozinho só funciona
// se o dispositivo tiver um app de email configurado como padrão — sem isso,
// clicar num <a href="mailto:..."> normal não faz NADA visível (parecia um
// bug quebrado, mas era só falta de fallback pra quem não tem isso configurado).
function EmailLink({ subject, style, label }) {
  const [copied, setCopied] = useState(false);
  const mailto = `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
  const handleClick = () => {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(CONTACT_EMAIL)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => { });
  };
  return (
    <a href={mailto} onClick={handleClick} style={style}>
      {copied ? '✅ Email copiado!' : label}
    </a>
  );
}

const INFO_TABS = [
  { id: 'como-jogar', label: 'Como Jogar', icon: '🎮' },
  { id: 'termos', label: 'Termos de Uso', icon: '📜' },
  { id: 'privacidade', label: 'Privacidade', icon: '🔒' },
  { id: 'contato', label: 'Contato', icon: '✉️' },
];
// URL própria de cada aba — path -> id da aba (usado pelo roteamento no
// componente raiz, via History API direta).
const INFO_ROUTES = {
  '/como-jogar': 'como-jogar',
  '/termos-de-uso': 'termos',
  '/privacidade': 'privacidade',
  '/contato': 'contato',
};
// Caminho canônico de cada página — o inverso de INFO_ROUTES (id da aba ->
// path), usado pra manter o <link rel="canonical"> em sincronia com a rota
// atual (ver useEffect de infoPage no componente raiz).
function canonicalPathFor(infoPage) {
  if (!infoPage) return '/';
  return Object.entries(INFO_ROUTES).find(([, v]) => v === infoPage)?.[0] || '/';
}

// Extrai o nome base e a conquista (texto entre parênteses no fim do label,
// quando existe, ex.: "Guarani 1978 (Campeao Brasileiro)") — só reformata o
// que já está no dado de TEAMS, não inventa nenhum fato novo.
function parseTeamLabel(label) {
  const m = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { baseName: m[1], achievement: m[2] } : { baseName: label, achievement: null };
}
// Roteamento das páginas de time histórico — /times (índice) e /times/{id}
// (detalhe). Sem lib de rotas, mesmo esquema das páginas institucionais
// (History API direta + o servidor caindo em index.html pra tudo fora de
// /api). Sem página de "não encontrado" dedicada: um id inválido cai em
// null/home, exagero criar isso pra 46 páginas conhecidas.
function parseTeamsPathname(pathname) {
  if (pathname === '/times') return 'index';
  if (pathname.startsWith('/times/')) {
    const id = pathname.slice('/times/'.length);
    return TEAMS.some(t => t.id === id) ? id : null;
  }
  return null;
}
function canonicalTeamsPath(teamsPage) {
  if (!teamsPage) return '/';
  return teamsPage === 'index' ? '/times' : `/times/${teamsPage}`;
}

const HOW_TO_PLAY_STEPS = [
  { icon: '🎲', title: 'Monte seu elenco no draft', text: 'A cada rodada do draft, você sorteia um time histórico do Brasileirão (1959–2024) e escolhe UM jogador dele pra preencher uma vaga da sua formação. Não gostou do time sorteado? Você tem até 3 pulos pra tentar outro.' },
  { icon: '🧩', title: 'Escolha a formação e o capitão', text: 'Antes do draft, escolha entre várias formações táticas (4-4-2, 4-3-3, 3-5-2 e outras). Depois de montar os 11 titulares e o banco, escolha um capitão — ele ganha +2 de overall fixo pra temporada inteira.' },
  { icon: '⚙️', title: 'Escolha a dificuldade certa', text: 'Fácil, Normal, Difícil ou Lendário ajustam o nível dos adversários controlados pela IA. Lendário é pensado pra quem já manja do jogo — os rivais jogam bem acima do overall de papel deles.' },
  { icon: '🏆', title: 'Brasileirão ou Copa do Brasil', text: 'No Brasileirão, são 20 times em pontos corridos (38 rodadas, todos contra todos). Na Copa do Brasil, é mata-mata com ida e volta entre 32 times até sair um campeão.' },
  { icon: '🩹', title: 'Cuidado com cartões e lesões', text: 'Jogadores suspensos (3 amarelos ou vermelho direto) e lesionados ficam fora automaticamente das próximas rodadas, sendo substituídos pelo reserva da mesma posição — acompanhe isso na aba Elenco.' },
  { icon: '👥', title: 'Jogue com amigos', text: 'No modo multiplayer, cada jogador faz seu próprio draft e assume um time real da liga — sem servidor, a conexão é direta entre os navegadores (P2P). Um cria a sala, os outros entram com o código ou o link de convite.' },
];

// Como Jogar, Termos de Uso, Política de Privacidade e Contato — página cheia
// com URL própria (ver INFO_ROUTES + roteamento no componente raiz), não mais
// um modal solto: dá pra compartilhar/favoritar o link e o Google indexa cada
// uma separadamente. Modelo de texto genérico de entretenimento gratuito, sem
// apostas/dinheiro real. Termos/Privacidade NÃO são aconselhamento jurídico;
// vale revisão antes de tratar como documento definitivo (LGPD).
function InfoPage({ tab, onNavigate, onClose, myTeamColor }) {
  const mc = myTeamColor || '#d4a23c';
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10000, overflowY: 'auto', padding: '70px 16px 40px' }}>
      <button
        onClick={onClose}
        title="Voltar pro app"
        style={{
          position: 'fixed', top: 14, left: 14, zIndex: 10001,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(15,31,21,0.95)', border: `1px solid ${hexToRgba(mc, 0.4)}`,
          borderRadius: 999, padding: '8px 14px', color: mc,
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        ← Voltar pro app
      </button>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, position: 'relative' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {INFO_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => onNavigate(t.id)}
              style={{
                padding: '6px 12px', borderRadius: 999, border: `1px solid ${tab === t.id ? '#d4a23c' : 'rgba(255,255,255,0.15)'}`,
                background: tab === t.id ? 'rgba(212,162,60,0.12)' : 'transparent',
                color: tab === t.id ? '#d4a23c' : 'rgba(244,241,234,0.6)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'como-jogar' && (
          <div style={{ fontSize: 13, lineHeight: 1.75, opacity: 0.85 }}>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 14 }}>Como Jogar</h2>
            <div style={{ display: 'grid', gap: 16 }}>
              {HOW_TO_PLAY_STEPS.map(step => (
                <div key={step.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{step.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 2, opacity: 1 }}>{step.title}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.6 }}>{step.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'termos' && (
          <div style={{ fontSize: 13, lineHeight: 1.75, opacity: 0.85 }}>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 12 }}>Termos de Uso</h2>
            <p><b>Sobre o jogo.</b> Brasileirão Lendário é um simulador de futebol gratuito, feito por fã, sem qualquer vínculo oficial com a CBF, clubes ou federações — os nomes de times e jogadores históricos aparecem em caráter editorial/homenagem, sem fins comerciais associados a essas marcas.</p>
            <p><b>Sem apostas ou dinheiro real.</b> Não há qualquer forma de aposta, prêmio em dinheiro ou compra dentro do jogo. É puramente entretenimento.</p>
            <p><b>Sua conta.</b> Você é responsável por manter sua senha em segurança. Pode excluir sua conta e todos os dados associados a qualquer momento, direto no painel de conta.</p>
            <p><b>Modo multiplayer.</b> Ao jogar com outras pessoas, espera-se conduta respeitosa. Não há moderação em tempo real do chat — use o bom senso.</p>
            <p><b>Sem garantias.</b> O serviço é fornecido "como está". Não garantimos disponibilidade ininterrupta nem ausência total de erros.</p>
            <p><b>Mudanças.</b> Estes termos podem ser atualizados conforme o jogo evolui.</p>
            <p style={{ opacity: 0.5, fontSize: 11.5 }}>Dúvidas: <EmailLink label={CONTACT_EMAIL} style={{ color: '#d4a23c', textDecoration: 'underline' }} /></p>
          </div>
        )}

        {tab === 'privacidade' && (
          <div style={{ fontSize: 13, lineHeight: 1.75, opacity: 0.85 }}>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 12 }}>Política de Privacidade</h2>
            <p><b>O que coletamos.</b> Nome de usuário, email e senha (guardada só como hash, nunca em texto puro) ao criar conta; estatísticas de jogo (temporadas, gols, títulos etc.) associadas à sua conta; e o endereço IP das suas requisições, usado só pra limitar tentativas de login e evitar abuso — não pra rastreamento.</p>
            <p><b>Armazenamento local.</b> O progresso da partida em andamento e o token de login ficam salvos no seu próprio navegador (localStorage), não em nossos servidores.</p>
            <p><b>Google Analytics.</b> Usamos o Google Analytics pra entender, de forma agregada, como o site é usado (páginas vistas, eventos como criar conta ou completar uma temporada). Não vendemos nem compartilhamos seus dados pessoais com terceiros pra fins de publicidade.</p>
            <p><b>Seus direitos.</b> Você pode acessar, corrigir ou excluir seus dados a qualquer momento — a exclusão de conta (disponível no painel) apaga permanentemente seu registro do nosso banco de dados.</p>
            <p><b>Menores de idade.</b> O jogo não é direcionado especificamente a crianças menores de 13 anos.</p>
            <p style={{ opacity: 0.5, fontSize: 11.5 }}>Dúvidas ou solicitações sobre seus dados: <EmailLink label={CONTACT_EMAIL} style={{ color: '#d4a23c', textDecoration: 'underline' }} /></p>
          </div>
        )}

        {tab === 'contato' && (
          <div style={{ fontSize: 13, lineHeight: 1.75, opacity: 0.85 }}>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 12 }}>Fala com a gente!</h2>
            <p>Esse jogo é feito por (e pra) quem ama futebol brasileiro — então toda ideia é bem-vinda:</p>
            <p><b>🏟️ Quer que a gente adicione algum time histórico que falta?</b> Manda os 20 atletas completos (titulares + reservas) do elenco que você quer ver no jogo, com posição de cada um — a gente confere e, se entrar, divulga aqui no site quem teve a ideia.</p>
            <p><b>💡 Tem alguma sugestão, bug pra reportar ou só quer trocar uma ideia?</b> Manda pra gente também — toda sugestão que vira novidade no jogo, o crédito é seu.</p>
            <p style={{ marginTop: 16 }}>
              <EmailLink label={`✉️ ${CONTACT_EMAIL}`} style={{ color: '#d4a23c', fontWeight: 700, textDecoration: 'none', fontSize: 14 }} />
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Índice + detalhe dos times históricos — conteúdo indexável de verdade
// (URL própria por time), gerado só a partir do que já existe em TEAMS
// (clube, ano, técnico, conquista, elenco real) — nenhum fato novo é
// inventado. Mesmo visual/estrutura do InfoPage (overlay + botão "Voltar
// pro app" fixo), pra manter consistência.
function TeamsIndexPage({ onBack, onOpenTeam, myTeamColor }) {
  const mc = myTeamColor || '#d4a23c';
  const sorted = useMemo(() => [...TEAMS].sort((a, b) => a.year - b.year), []);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(t => t.label.toLowerCase().includes(q) || String(t.year).includes(q));
  }, [sorted, query]);
  return (
    <div onClick={onBack} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10000, overflowY: 'auto', padding: '70px 16px 40px' }}>
      <button
        onClick={onBack}
        title="Voltar pro app"
        style={{
          position: 'fixed', top: 14, left: 14, zIndex: 10001,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(15,31,21,0.95)', border: `1px solid ${hexToRgba(mc, 0.4)}`,
          borderRadius: 999, padding: '8px 14px', color: mc,
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        ← Voltar pro app
      </button>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, position: 'relative' }}>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Times Históricos</h1>
        <p style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.6, marginBottom: 14 }}>
          Os {TEAMS.length} times que você pode sortear no draft do Brasileirão Lendário, cada um com o elenco real da época.
        </p>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar time por nome ou ano..."
          style={{ ...styles.teamInput, marginBottom: 14 }}
        />
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.5, textAlign: 'center', padding: 16 }}>Nenhum time encontrado.</div>
          )}
          {filtered.map(team => {
            const { baseName, achievement } = parseTeamLabel(team.label);
            return (
              <button
                key={team.id}
                onClick={() => onOpenTeam(team.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                  color: '#F4F1EA', textAlign: 'left', cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{baseName} <span style={{ opacity: 0.5, fontWeight: 400 }}>{team.year}</span></div>
                  {achievement && <div style={{ fontSize: 11, color: mc, marginTop: 1 }}>{achievement}</div>}
                </div>
                <span style={{ fontSize: 11, opacity: 0.4, flexShrink: 0 }}>{team.players.length} jogadores</span>
                <span style={{ fontSize: 14, opacity: 0.4, flexShrink: 0 }}>→</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TeamDetailPage({ team, onBack, onOpenIndex, myTeamColor, onPlayWithTeam }) {
  const mc = myTeamColor || '#d4a23c';
  if (!team) return null;
  const { baseName, achievement } = parseTeamLabel(team.label);
  const starters = [...team.players.slice(0, 11)].sort((a, b) => posOrderIndex(a.pos?.[0]) - posOrderIndex(b.pos?.[0]));
  const bench = team.players.slice(11);
  return (
    <div onClick={onBack} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10000, overflowY: 'auto', padding: '70px 16px 40px' }}>
      <button
        onClick={onBack}
        title="Voltar pro app"
        style={{
          position: 'fixed', top: 14, left: 14, zIndex: 10001,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(15,31,21,0.95)', border: `1px solid ${hexToRgba(mc, 0.4)}`,
          borderRadius: 999, padding: '8px 14px', color: mc,
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        ← Voltar pro app
      </button>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, position: 'relative' }}>
        <button onClick={onOpenIndex} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 11.5, cursor: 'pointer', padding: 0, marginBottom: 14 }}>
          ← Ver todos os times
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: team.colors?.p || mc, border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700 }}>{baseName} <span style={{ opacity: 0.5, fontWeight: 400 }}>{team.year}</span></h1>
        </div>
        {achievement && (
          <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: mc, background: hexToRgba(mc, 0.12), border: `1px solid ${hexToRgba(mc, 0.35)}`, borderRadius: 999, padding: '3px 10px', marginBottom: 12 }}>
            🏆 {achievement}
          </div>
        )}
        {CLUB_STADIUMS[team.club] && (
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
            🏟️ {CLUB_STADIUMS[team.club]}
          </div>
        )}
        <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.6, marginBottom: 14 }}>
          Monte o {baseName}{achievement ? ` (${achievement})` : ''} no Brasileirão Lendário: elenco completo com {team.players.length} jogadores reais, técnico {team.coach}, e dispute o Brasileirão ou a Copa do Brasil sozinho ou com amigos.
        </p>

        {onPlayWithTeam && (
          <button
            onClick={() => onPlayWithTeam(team)}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: mc, color: '#0B1A12', fontWeight: 700, fontSize: 14, marginBottom: 18,
            }}
          >
            ▶ Jogar com este time
          </button>
        )}

        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Titulares</div>
        {starters.map((p, i) => (
          <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12.5 }}>
            <span style={{ width: 36, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{p.pos?.[0] || '-'}</span>
            <span style={{ flex: 1 }}>{p.name}</span>
            <span style={{ fontFamily: "'Space Mono', monospace", color: ovrColor(p.ovr), fontSize: 11 }} title="Força no simulador, não é uma estatística histórica oficial">{p.ovr}</span>
          </div>
        ))}
        {bench.length > 0 && (
          <>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.4)', marginTop: 14, marginBottom: 6 }}>Banco</div>
            {bench.map((p, i) => (
              <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12.5 }}>
                <span style={{ width: 36, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{p.pos?.[0] || '-'}</span>
                <span style={{ flex: 1 }}>{p.name}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", color: ovrColor(p.ovr), fontSize: 11 }} title="Força no simulador, não é uma estatística histórica oficial">{p.ovr}</span>
              </div>
            ))}
          </>
        )}
        <div style={{ fontSize: 10, opacity: 0.4, marginTop: 10 }}>* Overall é a força do jogador no simulador, não uma estatística histórica oficial.</div>

        <button onClick={onBack} style={{ ...styles.btnPrimary, width: '100%', marginTop: 20, background: mc, color: '#0B1A12' }}>
          Jogar agora →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// TELAS MULTIPLAYER
// ============================================================
function MultiLobby({ gameMode, onSetGameMode, myTeamName, myTeamColor, myTeamLogo, joinInput, onJoinInput, onCreateRoom, onJoinRoom, onBrowseRooms, connecting, error, onBack }) {
  const mc = myTeamColor || '#d4a23c';
  return (
    <div style={styles.card} className="card-mob">
      <button onClick={onBack} className="tap-target-sm" style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: '6px 2px', marginLeft: -2, minHeight: 34 }}>← Voltar</button>
      <div style={styles.eyebrow}>Multiplayer</div>
      <h2 style={styles.h2}>Jogar com Amigos</h2>

      <div style={{ marginBottom: 20 }}>
        <div style={styles.teamEditLabel}>Modo de jogo</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            // Mesma mudança do singleplayer: "Brasileirão" já É a Série A/B —
            // a divisão B roda só de enfeite (100% IA), ninguém da sala joga
            // nela de verdade, mas o acesso/queda aparece no fim da temporada.
            { id: 'serieab', label: 'Brasileirão', sub: 'Até 20 jogadores · Série A e B', trophy: 'https://r2.thesportsdb.com/images/media/league/trophy/02ftjh1684945323.png' },
            { id: 'copa', label: 'Copa do Brasil', sub: 'Até 32 jogadores', trophy: 'https://r2.thesportsdb.com/images/media/league/trophy/jv27c41776553182.png' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => onSetGameMode(m.id)}
              className="mode-card-hover"
              aria-pressed={gameMode === m.id}
              style={{
                padding: '12px', borderRadius: 12, border: '2px solid',
                borderColor: gameMode === m.id ? mc : 'rgba(255,255,255,0.1)',
                background: gameMode === m.id ? hexToRgba(mc, 0.1) : 'rgba(255,255,255,0.03)',
                color: '#F4F1EA', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <img src={m.trophy} alt={m.label} style={{ height: 32, objectFit: 'contain', marginBottom: 6, display: 'block' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
              <div style={{ fontWeight: 700, fontSize: 13, color: gameMode === m.id ? mc : '#F4F1EA' }}>{m.label}</div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>{m.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <button
        style={{ ...styles.btnPrimary, width: '100%', background: mc, color: '#0B1A12', marginBottom: 12, opacity: connecting ? 0.7 : 1 }}
        onClick={onCreateRoom}
        disabled={connecting}
      >
        {connecting ? '⏳ Conectando…' : '✦ Criar sala'}
      </button>
      {error && (
        <div style={{ fontSize: 12, color: '#e05050', background: 'rgba(224,80,80,0.08)', border: '1px solid rgba(224,80,80,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: 12, opacity: 0.4 }}>ou</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={joinInput}
          onChange={e => onJoinInput(e.target.value.trim())}
          onKeyDown={e => e.key === 'Enter' && !connecting && onJoinRoom()}
          placeholder="Cole o código da sala aqui…"
          disabled={connecting}
          style={{ ...styles.teamInput, flex: 1, margin: 0, fontFamily: 'monospace', fontSize: 13, opacity: connecting ? 0.6 : 1 }}
        />
        <button onClick={onJoinRoom} disabled={connecting} style={{ ...styles.btnPrimary, margin: 0, padding: '0 18px', whiteSpace: 'nowrap', opacity: connecting ? 0.7 : 1 }}>
          {connecting ? '⏳' : 'Entrar'}
        </button>
      </div>
      <div style={{ fontSize: 11, opacity: 0.4, marginTop: 6, textAlign: 'center' }}>Cole o código que o criador da sala compartilhou</div>

      <button
        onClick={onBrowseRooms}
        style={{
          width: '100%', marginTop: 16, padding: '10px 0', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#F4F1EA', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        🔎 Ver salas abertas
      </button>
      <div style={{ fontSize: 11, opacity: 0.4, marginTop: 6, textAlign: 'center' }}>Não conhece ninguém? Entre numa sala aberta pra estranhos</div>
    </div>
  );
}

// Lista pública de salas abertas — busca a cada 7s enquanto a tela estiver
// montada. Sala em andamento (status 'in_progress') continua aparecendo,
// só que bloqueada (sem botão de entrar) — é assim que a lista dá uma noção
// de "tem gente jogando" mesmo sem poder entrar naquela em específico.
function PublicRoomsScreen({ onBack, onJoinRoom, myTeamColor }) {
  const mc = myTeamColor || '#d4a23c';
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState('');
  const [joiningCode, setJoiningCode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.fetchPublicRooms()
        .then(({ rooms: list }) => { if (!cancelled) { setRooms(list); setError(''); } })
        .catch(() => { if (!cancelled) setError('Não foi possível carregar as salas agora.'); });
    };
    load();
    const interval = setInterval(load, 7000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleJoin = (code) => {
    setJoiningCode(code);
    onJoinRoom(code);
  };

  return (
    <div style={styles.card} className="card-mob">
      <button onClick={onBack} className="tap-target-sm" style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: '6px 2px', marginLeft: -2, minHeight: 34 }}>← Voltar</button>
      <div style={styles.eyebrow}>Multiplayer</div>
      <h2 style={styles.h2}>Salas Abertas</h2>

      {error && <div style={{ fontSize: 13, opacity: 0.6, marginTop: 12 }}>{error}</div>}
      {!error && !rooms && <div style={{ fontSize: 13, opacity: 0.6, marginTop: 12 }}>Carregando...</div>}
      {rooms && rooms.length === 0 && (
        <div style={{ fontSize: 13, opacity: 0.6, marginTop: 12 }}>Nenhuma sala aberta agora — crie a sua!</div>
      )}

      {rooms && rooms.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {rooms.map(room => {
            const isOpen = room.status === 'lobby';
            return (
              <div
                key={room.code}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                  border: `1px solid ${isOpen ? hexToRgba(mc, 0.3) : 'rgba(255,255,255,0.08)'}`,
                  background: isOpen ? hexToRgba(mc, 0.06) : 'rgba(255,255,255,0.02)',
                  opacity: isOpen ? 1 : 0.55,
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{room.gameMode === 'copa' ? '🏅' : '🏆'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>
                    {room.playerCount}/{room.maxPlayers} jogadores · {room.gameMode === 'copa' ? 'Copa do Brasil' : 'Brasileirão'}
                  </div>
                </div>
                {isOpen ? (
                  <button
                    onClick={() => handleJoin(room.code)}
                    disabled={joiningCode !== null}
                    style={{ ...styles.btnPrimary, margin: 0, padding: '7px 14px', fontSize: 12.5, flexShrink: 0, opacity: joiningCode !== null ? 0.7 : 1 }}
                  >
                    {joiningCode === room.code ? '⏳' : 'Entrar'}
                  </button>
                ) : (
                  <span title="Partida em andamento" style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RoomScreen({ roomCode, roomData, myId, isLeader, myTeamName, myTeamColor, myTeamLogo, myTeamCoach, myTeamCity, onSetName, onSetColor, onSetLogo, onSetCoach, onSetCity, onSetTimer, onStartSetup, onStartSimulation, onReady, timerLeft, onBack }) {
  const mc = myTeamColor || '#d4a23c';
  const players = Object.entries(roomData.players || {});
  const allReady = players.length > 0 && players.every(([, p]) => p.ready);
  const myData = roomData.players?.[myId] || {};
  const isSetupPhase = roomData.phase === 'team-setup';
  const timerMinutes = roomData.timerMinutes || 3;
  const maxSlots = roomData.gameMode === 'copa' ? 32 : 20;
  const emptySlots = Math.max(0, maxSlots - players.length);

  // Revelação sequencial dos times fictícios sorteados ao iniciar
  const [revealNames, setRevealNames] = React.useState({});
  const seenAiIds = React.useRef(new Set());
  React.useEffect(() => {
    const aiIds = players.filter(([, p]) => p.isAI).map(([pid]) => pid);
    const freshIds = aiIds.filter(pid => !seenAiIds.current.has(pid));
    if (freshIds.length === 0) return;
    // Guarda todo timeout/interval criado aqui pra poder cancelar no cleanup
    // — sem isso, sair da sala (ou a lista de players mudar) no meio da
    // animação deixava timers órfãos chamando setState num componente já
    // desmontado.
    const timers = [];
    freshIds.forEach((pid, idx) => {
      seenAiIds.current.add(pid);
      const startDelay = idx * 130;
      const toId = setTimeout(() => {
        let step = 0;
        const totalSteps = 5;
        const iv = setInterval(() => {
          step++;
          if (step >= totalSteps) {
            clearInterval(iv);
            setRevealNames(prev => { const next = { ...prev }; delete next[pid]; return next; });
          } else {
            const decoy = TEAMS[Math.floor(Math.random() * TEAMS.length)].label;
            setRevealNames(prev => ({ ...prev, [pid]: decoy }));
          }
        }, 90);
        timers.push(iv);
      }, startDelay);
      timers.push(toId);
    });
    return () => timers.forEach(id => { clearTimeout(id); clearInterval(id); });
  }, [players.map(([pid]) => pid).join(',')]);

  const [copied, setCopied] = React.useState(false);
  const copyCode = () => {
    const code = roomData.leaderPeerId || roomCode;
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  // Convite direto — link com ?join=CODIGO já pré-preenche o código de quem
  // clicar (ver useEffect no componente raiz). Web Share API com fallback de
  // copiar link, mesmo padrão do ShareResultButton.
  const [inviteCopied, setInviteCopied] = React.useState(false);
  const shareInvite = async () => {
    const code = roomData.leaderPeerId || roomCode;
    const url = `${window.location.origin}/?join=${code}`;
    const text = `Bora jogar Brasileirão Lendário comigo? Entra na minha sala: ${url}`;
    trackEvent('share', { method: 'multiplayer_invite' });
    if (navigator.share) {
      try { await navigator.share({ title: 'Brasileirão Lendário', text, url }); } catch { /* usuário cancelou — sem problema */ }
    } else {
      navigator.clipboard?.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    }
  };

  const fileRef = React.useRef(null);
  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onSetLogo(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div style={styles.card} className="card-mob">
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>← Sair da sala</button>

      {/* Código da sala */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={styles.eyebrow}>{roomData.gameMode === 'copa' ? 'Copa do Brasil' : 'Brasileirão'} · Sala</div>
        {isLeader && roomData.leaderPeerId && (
          <>
            <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: mc, margin: '10px 0 6px', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 14px', letterSpacing: 1 }}>
              {roomData.leaderPeerId}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={copyCode} style={{ fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 14px', color: copied ? '#7fd99a' : '#aaa', cursor: 'pointer' }}>
                {copied ? '✓ Copiado!' : '📋 Copiar código'}
              </button>
              <button onClick={shareInvite} style={{ fontSize: 12, background: hexToRgba(mc, 0.12), border: `1px solid ${hexToRgba(mc, 0.4)}`, borderRadius: 8, padding: '5px 14px', color: inviteCopied ? '#7fd99a' : mc, cursor: 'pointer' }}>
                {inviteCopied ? '✓ Link copiado!' : '📤 Convidar amigos'}
              </button>
            </div>
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 6 }}>Envie o código ou o link de convite pros seus amigos entrarem na sala</div>
          </>
        )}
        {!isLeader && (
          <div style={{ fontSize: 13, opacity: 0.5, marginTop: 8 }}>Conectado à sala · Aguardando o líder iniciar</div>
        )}
      </div>

      {/* Timer (só líder vê os botões) */}
      {isLeader && !isSetupPhase && (
        <div style={{ marginBottom: 16 }}>
          <div style={styles.teamEditLabel}>Tempo para criar o time</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[3, 4, 5].map(m => (
              <button key={m} onClick={() => onSetTimer(m)} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: '2px solid',
                borderColor: timerMinutes === m ? mc : 'rgba(255,255,255,0.12)',
                background: timerMinutes === m ? hexToRgba(mc, 0.12) : 'transparent',
                color: timerMinutes === m ? mc : '#aaa', cursor: 'pointer', fontWeight: 700, fontSize: 14,
              }}>
                {m} min
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Configurar time */}
      {isSetupPhase && (
        <div style={{ marginBottom: 16, padding: 14, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={styles.teamEditLabel}>Seu time</div>
            {timerLeft !== null && (
              <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: timerLeft < 30 ? '#e05050' : mc }}>
                {String(Math.floor(timerLeft / 60)).padStart(2, '0')}:{String(timerLeft % 60).padStart(2, '0')}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={styles.teamEditLabel}>Nome</label>
              <input value={myTeamName} onChange={e => onSetName(e.target.value)} placeholder="Meu Time" style={styles.teamInput} />
            </div>
            <div>
              <label style={styles.teamEditLabel}>Cidade</label>
              <input value={myTeamCity} onChange={e => onSetCity(e.target.value)} placeholder="Cidade" style={styles.teamInput} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={styles.teamEditLabel}>Técnico</label>
              <input value={myTeamCoach} onChange={e => onSetCoach(e.target.value)} placeholder="Seu nome" style={styles.teamInput} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={styles.teamEditLabel}>Cor</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['#d4a23c', '#e05050', '#4a90d9', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#e91e8c'].map(c => (
                <button key={c} onClick={() => onSetColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${myTeamColor === c ? '#fff' : 'transparent'}`, outline: myTeamColor === c ? `2px solid ${c}` : 'none', outlineOffset: 2, cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={styles.teamEditLabel}>Emblema do clube</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(CLUB_LOGOS).map(([club, url]) => (
                <button key={club} onClick={() => onSetLogo(myTeamLogo === url ? null : url)} title={club} style={{ width: 38, height: 38, borderRadius: 8, padding: 4, border: `2px solid ${myTeamLogo === url ? mc : 'rgba(255,255,255,0.08)'}`, background: myTeamLogo === url ? hexToRgba(mc, 0.15) : 'rgba(255,255,255,0.03)', cursor: 'pointer' }}>
                  <img src={url} alt={club} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.2)', background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>
              📷 Upload logo
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            {!myData.ready && (
              <button onClick={onReady} style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none', background: mc, color: '#0B1A12', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                ✓ Pronto!
              </button>
            )}
            {myData.ready && (
              <div style={{ flex: 2, padding: '8px', borderRadius: 8, background: 'rgba(127,217,154,0.12)', color: '#7fd99a', fontWeight: 700, textAlign: 'center', fontSize: 13 }}>
                ✓ Pronto!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid de vagas — jogadores reais + vagas aguardando + times fictícios sorteados */}
      <div style={{ marginBottom: 16 }}>
        <div style={styles.sectionLabel}>Vagas ({players.length}/{maxSlots})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {players.map(([pid, p]) => {
            const isRevealing = pid in revealNames;
            const displayName = isRevealing ? revealNames[pid] : (p.name || 'Jogador');
            return (
              <div key={pid} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10,
                border: `1px solid ${p.isAI ? 'rgba(255,255,255,0.1)' : hexToRgba(mc, 0.25)}`,
                background: p.isAI ? 'rgba(255,255,255,0.03)' : hexToRgba(mc, 0.06),
              }}>
                {p.logo
                  ? <img src={p.logo} alt="" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'contain', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
                  : <div style={{ width: 28, height: 28, borderRadius: 7, background: p.color || '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>⚽</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: p.color || '#F4F1EA',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    opacity: isRevealing ? 0.55 : 1, transition: 'opacity 0.08s',
                  }}>
                    {displayName}
                  </div>
                  {p.isAI && !isRevealing && <div style={{ fontSize: 9.5, opacity: 0.4, letterSpacing: 0.5 }}>TIME SORTEADO</div>}
                  {pid === roomData.leaderId && !p.isAI && <div style={{ fontSize: 9.5, color: '#d4a23c' }}>LÍDER</div>}
                </div>
                {!isRevealing && <span style={{ fontSize: 13, flexShrink: 0 }}>{p.ready ? '✅' : '⏳'}</span>}
              </div>
            );
          })}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`empty-${i}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 10px',
              borderRadius: 10, border: '1px dashed rgba(255,255,255,0.15)', minHeight: 44,
            }}>
              <span style={{ fontSize: 11.5, opacity: 0.35 }}>Aguardando…</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ações do líder */}
      {isLeader && !isSetupPhase && (
        <button
          onClick={onStartSetup}
          disabled={players.length < 2}
          style={{ ...styles.btnPrimary, width: '100%', background: mc, color: '#0B1A12', opacity: players.length < 2 ? 0.5 : 1 }}
        >
          {players.length < 2
            ? 'Aguardando mais jogadores... (mín. 2)'
            : emptySlots > 0
              ? `▶ Iniciar — sorteia ${emptySlots} time${emptySlots !== 1 ? 's' : ''} pras vagas restantes`
              : `▶ Iniciar — ${timerMinutes} min para criar o time`}
        </button>
      )}
      {!isLeader && !isSetupPhase && (
        <div style={{ textAlign: 'center', fontSize: 13, opacity: 0.5, padding: 12 }}>
          Aguardando o líder iniciar a partida…
        </div>
      )}
      {isSetupPhase && isLeader && allReady && (
        <button onClick={onStartSimulation} style={{ ...styles.btnPrimary, width: '100%', background: '#27ae60', color: '#fff', marginTop: 8 }}>
          Todos prontos — Iniciar simulação →
        </button>
      )}
    </div>
  );
}

function MultiWaitingScreen({ roomData, myId, isLeader, myTeamColor, onSimulate }) {
  const mc = myTeamColor || '#d4a23c';
  const players = Object.entries(roomData.players || {});
  const readyCount = players.filter(([, p]) => p.ready).length;
  const allReady = readyCount === players.length && players.length > 0;

  return (
    <div style={styles.card} className="card-mob">
      <div style={{ textAlign: 'center', padding: '16px 0 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
        <div style={styles.eyebrow}>Time montado!</div>
        <h2 style={styles.h2}>Aguardando os outros jogadores…</h2>
        <div style={{ fontSize: 13, opacity: 0.5, marginTop: 4 }}>{readyCount} de {players.length} prontos</div>
      </div>

      <div style={{ marginBottom: 20 }}>
        {players.map(([pid, p]) => (
          <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {p.logo
              ? <img src={p.logo} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', background: 'rgba(255,255,255,0.05)' }} />
              : <div style={{ width: 32, height: 32, borderRadius: 8, background: p.color || '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⚽</div>
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: p.color || '#F4F1EA' }}>{p.name || 'Jogador'}</div>
              {p.ovr > 0 && <div style={{ fontSize: 11, opacity: 0.5 }}>OVR {p.ovr}</div>}
            </div>
            {pid === myId && <span style={{ fontSize: 10, color: '#aaa', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '1px 6px' }}>VOCÊ</span>}
            <span style={{ fontSize: 16 }}>{p.ready ? '✅' : '⏳'}</span>
          </div>
        ))}
      </div>

      {isLeader && allReady && (
        <button onClick={onSimulate} style={{ ...styles.btnPrimary, width: '100%', background: '#27ae60', color: '#fff' }}>
          Todos prontos — Iniciar campeonato! →
        </button>
      )}
      {isLeader && !allReady && (
        <div style={{ textAlign: 'center', fontSize: 13, opacity: 0.4 }}>Aguardando todos terminarem o draft…</div>
      )}
      {!isLeader && (
        <div style={{ textAlign: 'center', fontSize: 13, opacity: 0.4 }}>Aguardando o líder iniciar o campeonato…</div>
      )}
    </div>
  );
}

// ============================================================
// FIM DAS TELAS MULTIPLAYER
// ============================================================
const FORMATION_GROUPS = [
  { prefix: '4', title: 'Linha de 4 zagueiros', icon: '🛡️', hint: 'Equilíbrio clássico entre defesa e ataque' },
  { prefix: '3', title: 'Linha de 3 zagueiros', icon: '⚔️', hint: 'Mais volume ofensivo, alas cobrindo as laterais' },
  { prefix: '5', title: 'Linha de 5 zagueiros', icon: '🔒', hint: 'Retranca — prioriza solidez defensiva' },
];

function FormationPicker({ onChoose, onBack, gameMode, onSetGameMode, onPlayReadyMade, isDailyChallenge }) {
  const groups = useMemo(() => (
    FORMATION_GROUPS
      .map(g => ({ ...g, items: Object.entries(FORMATIONS).filter(([key]) => key.split('-')[0] === g.prefix) }))
      .filter(g => g.items.length > 0)
  ), []);
  const total = Object.keys(FORMATIONS).length;
  // Atalho pra quem já sabe qual time histórico quer usar — funciona igual
  // no solo e numa sala com amigos, já que os dois passam por essa mesma
  // tela antes do draft.
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  return (
    <div style={styles.card} className="card-mob">
      {onBack && <button onClick={onBack} className="tap-target-sm" style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px 10px', margin: '0 0 0 -2px', minHeight: 32 }}>&#8592; Voltar</button>}
      {/* Quem chega direto aqui (primeira visita pula a home) nunca via o
          seletor de campeonato — sem isso, ficava preso no Brasileirão
          (o padrão) sem jeito nenhum de escolher a Copa do Brasil. */}
      {onSetGameMode && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { id: 'serieab', label: 'Brasileirão' },
            { id: 'copa', label: 'Copa do Brasil' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => onSetGameMode(m.id)}
              aria-pressed={gameMode === m.id}
              className="mode-card-hover"
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${gameMode === m.id ? '#d4a23c' : 'rgba(255,255,255,0.12)'}`,
                background: gameMode === m.id ? 'rgba(212,162,60,0.12)' : 'rgba(255,255,255,0.03)',
                color: gameMode === m.id ? '#d4a23c' : '#F4F1EA', fontWeight: 700, fontSize: 13,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
      <div style={styles.eyebrow}>{isDailyChallenge ? '🏆 Supercopa do Brasil · Passo 1 de 2' : 'Passo 1 de 2'}</div>
      <h2 style={styles.h2}>Escolha o esquema tático</h2>
      <p style={styles.formationIntro}>
        {total} esquemas táticos à sua escolha, organizados pela linha de defesa. Cada posição no campinho
        já mostra a cor da função — goleiro, zaga, meio ou ataque.
      </p>

      {onPlayReadyMade && (
        <button
          onClick={() => setShowTeamPicker(true)}
          style={{
            width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderRadius: 10, marginBottom: 24, cursor: 'pointer',
            border: '1px dashed rgba(212,162,60,0.4)', background: 'rgba(212,162,60,0.06)', color: '#F4F1EA',
          }}
        >
          <span style={{ fontSize: 18 }}>🏆</span>
          <span style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#d4a23c' }}>Já sei qual time eu quero</div>
            <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 1 }}>Pula o sorteio — usa o elenco pronto de um time histórico</div>
          </span>
          <span style={{ fontSize: 14, opacity: 0.5 }}>→</span>
        </button>
      )}
      {showTeamPicker && (
        <TeamPickerModal
          onClose={() => setShowTeamPicker(false)}
          onPick={team => { setShowTeamPicker(false); onPlayReadyMade(team); }}
        />
      )}

      {groups.map(g => (
        <div key={g.prefix} style={{ marginBottom: 28 }}>
          <div style={styles.formationSectionHead}>
            <span style={styles.formationSectionTitle}><span>{g.icon}</span>{g.title}</span>
            <span style={styles.formationSectionHint}>{g.hint}</span>
          </div>
          <div style={styles.formationGrid} className="formation-grid">
            {g.items.map(([key, f]) => {
              const m = f.label.match(/^([\d-]+)\s*(.*)$/);
              const shape = m ? m[1] : f.label;
              const desc = m ? m[2] : '';
              return (
                <button key={key} className="formation-card" style={styles.formationCard} onClick={() => onChoose(key)}>
                  <div style={styles.formationShapeNum}>{shape}</div>
                  <div style={styles.formationShapeDesc}>{desc}</div>
                  <MiniPitchPreview formationKey={key} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Modal de busca pra escolher um dos 100 times históricos e jogar direto com
// o elenco pronto deles — usado tanto no solo quanto numa sala com amigos
// (FormationPicker é a mesma tela nos dois casos).
function TeamPickerModal({ onClose, onPick }) {
  const [query, setQuery] = useState('');
  const sorted = useMemo(() => [...TEAMS].sort((a, b) => b.year - a.year), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(t => t.label.toLowerCase().includes(q) || String(t.year).includes(q));
  }, [sorted, query]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#0f1f15', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px 16px 0 0', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Escolha um time pronto</div>
          <button onClick={onClose} className="tap-target-sm" style={{ background: 'none', border: 'none', color: '#F4F1EA', fontSize: 20, cursor: 'pointer', width: 32, height: 32 }}>×</button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por time ou ano..."
          style={{ ...styles.teamInput, marginBottom: 12 }}
        />
        <div style={{ overflowY: 'auto', display: 'grid', gap: 6 }}>
          {filtered.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.5, textAlign: 'center', padding: 16 }}>Nenhum time encontrado.</div>
          )}
          {filtered.map(team => {
            const { baseName, achievement } = parseTeamLabel(team.label);
            return (
              <button
                key={team.id}
                onClick={() => onPick(team)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                  color: '#F4F1EA', textAlign: 'left', cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{baseName} <span style={{ opacity: 0.5, fontWeight: 400 }}>{team.year}</span></div>
                  {achievement && <div style={{ fontSize: 11, color: '#d4a23c', marginTop: 1 }}>{achievement}</div>}
                </div>
                <span style={{ fontSize: 14, opacity: 0.4, flexShrink: 0 }}>→</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Cores por função tática — a mesma lógica usada no campo cheio (Pitch), pra
// ficar consistente do início (escolha do esquema) ao fim (escalação).
const POS_GROUP_COLOR = {
  GOL: '#F4F1EA',
  LD: '#4a90d9', ZAG: '#4a90d9', LE: '#4a90d9',
  // VOL (volante, mais recuado/destruidor) ganha um tom mais escuro que o
  // resto do meio — senão, colado perto do MC/MEI, fica impossível
  // diferenciar um do outro só pela cor.
  VOL: '#a67a2e',
  MC: '#d4a23c', MEI: '#d4a23c', MD: '#d4a23c', ME: '#d4a23c',
  PD: '#e05050', PE: '#e05050', ATA: '#e05050',
};

// Ordem fixa de exibição por posição primária (lista de jogadores no Draft).
const POS_ORDER = ['GOL', 'LD', 'ZAG', 'LE', 'VOL', 'MC', 'MD', 'ME', 'MEI', 'PD', 'ATA', 'PE'];
const posOrderIndex = (pos) => {
  const i = POS_ORDER.indexOf(pos);
  return i === -1 ? POS_ORDER.length : i;
};

function MiniPitchPreview({ formationKey }) {
  const slots = useMemo(() => buildPitchSlots(formationKey), [formationKey]);
  return (
    <div style={styles.miniPitch}>
      <div style={styles.miniPitchHalfLine} />
      <div style={styles.miniPitchCircle} />
      <div style={styles.miniPitchCenterDot} />
      <div style={styles.miniPitchArcTop} />
      <div style={styles.miniPitchArcBottom} />
      {slots.map((s, i) => (
        <div
          key={i}
          title={s.realPos}
          style={{ ...styles.miniDot, left: `${s.x}%`, top: `${s.y}%`, background: POS_GROUP_COLOR[s.realPos] || '#d4a23c' }}
        >
          <span style={styles.miniDotLabel}>{s.realPos}</span>
        </div>
      ))}
    </div>
  );
}

function Pitch({ pitch, pitchSlots, highlightSlots = [], previewSlots = [], onClickSlot, onUnplace, myTeamColor, captainSlot }) {
  const mc = myTeamColor || '#d4a23c';
  const dark = needsDark(mc);
  const highlightKeys = new Set(highlightSlots.map(s => s.key));
  const previewKeys = new Set(previewSlots.map(s => s.key));

  const markLine = (style) => <div style={{ position: 'absolute', pointerEvents: 'none', ...style }} />;

  return (
    <div style={styles.pitchWrap}>
      <div style={{
        ...styles.pitchField,
        background: '#124d27',
        backgroundImage: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0.07) 0%, rgba(0,0,0,0.07) 14.3%, transparent 14.3%, transparent 28.6%)',
      }} className="pitch-field">

        {/* ── Marcações do campo ── */}
        {/* Linha do meio */}
        {markLine({ left: 0, right: 0, top: '50%', height: 1, background: 'rgba(255,255,255,0.3)' })}
        {/* Círculo central */}
        {markLine({ left: '50%', top: '50%', width: 74, height: 74, border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '50%', transform: 'translate(-50%,-50%)' })}
        {/* Ponto central */}
        {markLine({ left: '50%', top: '50%', width: 5, height: 5, background: 'rgba(255,255,255,0.45)', borderRadius: '50%', transform: 'translate(-50%,-50%)' })}

        {/* Área penal superior */}
        {markLine({ top: 0, left: '18%', width: '64%', height: '17%', border: '1.5px solid rgba(255,255,255,0.3)', borderTop: 'none', boxSizing: 'border-box' })}
        {/* Pequena área superior */}
        {markLine({ top: 0, left: '35%', width: '30%', height: '7%', border: '1.5px solid rgba(255,255,255,0.25)', borderTop: 'none', boxSizing: 'border-box' })}
        {/* Gol superior */}
        {markLine({ top: 0, left: '40.5%', width: '19%', height: '2.8%', background: 'rgba(255,255,255,0.08)', borderBottom: '1.5px solid rgba(255,255,255,0.35)', boxSizing: 'border-box' })}
        {/* Ponto de pênalti superior */}
        {markLine({ top: '10.5%', left: '50%', width: 5, height: 5, background: 'rgba(255,255,255,0.38)', borderRadius: '50%', transform: 'translate(-50%,-50%)' })}

        {/* Área penal inferior */}
        {markLine({ bottom: 0, left: '18%', width: '64%', height: '17%', border: '1.5px solid rgba(255,255,255,0.3)', borderBottom: 'none', boxSizing: 'border-box' })}
        {/* Pequena área inferior */}
        {markLine({ bottom: 0, left: '35%', width: '30%', height: '7%', border: '1.5px solid rgba(255,255,255,0.25)', borderBottom: 'none', boxSizing: 'border-box' })}
        {/* Gol inferior */}
        {markLine({ bottom: 0, left: '40.5%', width: '19%', height: '2.8%', background: 'rgba(255,255,255,0.08)', borderTop: '1.5px solid rgba(255,255,255,0.35)', boxSizing: 'border-box' })}
        {/* Ponto de pênalti inferior */}
        {markLine({ top: '89.5%', left: '50%', width: 5, height: 5, background: 'rgba(255,255,255,0.38)', borderRadius: '50%', transform: 'translate(-50%,-50%)' })}

        {/* Cantos */}
        {[{ top: -8, left: -8 }, { top: -8, right: -8 }, { bottom: -8, left: -8 }, { bottom: -8, right: -8 }].map((pos, i) =>
          <div key={i} style={{ position: 'absolute', pointerEvents: 'none', ...pos, width: 16, height: 16, border: '1.5px solid rgba(255,255,255,0.28)', borderRadius: '50%' }} />
        )}

        {/* ── Jogadores ── */}
        {pitchSlots.filter(slot => !slot.isBench).map(slot => {
          const occupant = pitch[slot.key];
          const isHighlighted = highlightKeys.has(slot.key);
          // Preview de hover: só faz sentido em vaga vazia e quando não há
          // seleção ativa (Draft já garante isso ao computar previewSlots) —
          // é só um "olhar antes de escalar", não é clicável.
          const isPreviewed = !occupant && !isHighlighted && previewKeys.has(slot.key);
          // Vaga ocupada TAMBÉM entra em canPlace quando destacada — é o que
          // permite trocar de lugar com quem já está lá durante reposição
          // (fora da reposição, isHighlighted nunca inclui vaga ocupada, então
          // isso não muda nada do fluxo normal de escalar da pool).
          const canPlace = isHighlighted && !!onClickSlot;
          const canUnplace = !!occupant && !!onUnplace;
          const clickable = canPlace || canUnplace;
          const isCap = captainSlot && slot.key === captainSlot;

          const circleColor = occupant ? mc : isHighlighted ? 'rgba(127,217,154,0.35)' : isPreviewed ? 'rgba(212,162,60,0.22)' : 'rgba(255,255,255,0.1)';
          const borderColor = canUnplace
            ? `2px dashed ${mc}`
            : isHighlighted
              ? '2px solid #7fd99a'
              : isPreviewed
                ? '2px dashed #d4a23c'
                : occupant
                  ? '2.5px solid rgba(255,255,255,0.65)'
                  : '1.5px solid rgba(255,255,255,0.28)';
          const shadow = occupant
            ? `0 3px 10px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.25)`
            : isHighlighted
              ? '0 0 14px rgba(127,217,154,0.45)'
              : isPreviewed
                ? '0 0 10px rgba(212,162,60,0.3)'
                : 'none';

          return (
            <div
              key={slot.key}
              onClick={clickable ? () => canPlace ? onClickSlot(slot.key) : onUnplace(slot.key) : undefined}
              title={occupant ? `${occupant.name}${occupant.teamLabel ? ` · ${occupant.teamLabel}` : ''} — clique para mover` : slot.label}
              style={{
                position: 'absolute',
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                transform: 'translate(-50%,-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                zIndex: occupant ? 3 : 2,
                cursor: clickable ? 'pointer' : 'default',
                transition: 'transform 0.15s',
              }}
              className="pitch-spot"
            >
              {/* Círculo principal — flexShrink:0 é essencial aqui: o wrapper
                  ".pitch-spot" é um flex column, e sem isso o mobile (que só
                  limitava a ALTURA do wrapper) encolhia só a altura do
                  círculo, achatando-o numa elipse em vez de manter o círculo. */}
              <div className="pitch-spot-circle" style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: circleColor,
                border: borderColor,
                boxShadow: shadow,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column',
                position: 'relative',
                transform: (isHighlighted || isPreviewed) && !occupant ? 'scale(1.12)' : 'scale(1)',
                transition: 'all 0.15s',
              }}>
                {isCap && (
                  <span style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', fontSize: 11, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>⭐</span>
                )}
                {occupant ? (
                  <span style={{ fontSize: 8, fontWeight: 800, color: dark ? '#0a1a0f' : '#fff', textAlign: 'center', lineHeight: 1.15, padding: '0 3px', maxWidth: 40, wordBreak: 'break-word' }} className="pitch-spot-name">
                    {shortName(occupant.name)}
                  </span>
                ) : (
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, color: isHighlighted ? '#7fd99a' : isPreviewed ? '#d4a23c' : 'rgba(255,255,255,0.55)', lineHeight: 1 }}>
                    {slot.label}
                  </span>
                )}
              </div>

              {/* Badge OVR */}
              {occupant && (
                <div style={{
                  background: 'rgba(6,14,10,0.82)',
                  borderRadius: 3,
                  padding: '1px 4px',
                  fontSize: 8,
                  fontWeight: 700,
                  fontFamily: "'Space Mono', monospace",
                  color: ovrColor(occupant.ovr),
                  border: '1px solid rgba(255,255,255,0.12)',
                  lineHeight: 1.5,
                  marginTop: 1,
                }}>
                  {occupant.ovr}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Exibe os jogadores do banco de reservas (interativo durante o draft)
function BenchDisplay({ pitch, pitchSlots, myTeamColor, highlightSlots = [], previewSlots = [], onClickSlot, onUnplace }) {
  const mc = myTeamColor || '#d4a23c';
  const benchSlots = pitchSlots.filter(s => s.isBench);
  const filled = benchSlots.filter(s => pitch[s.key]);
  const highlightKeys = new Set(highlightSlots.map(s => s.key));
  const previewKeys = new Set(previewSlots.map(s => s.key));
  if (benchSlots.length === 0) return null;
  return (
    <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', letterSpacing: 1 }}>
        Banco ({filled.length}/{benchSlots.length})
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {benchSlots.map(slot => {
          const p = pitch[slot.key];
          const isHighlighted = highlightKeys.has(slot.key);
          const isPreviewed = !p && !isHighlighted && previewKeys.has(slot.key);
          const canPlace = isHighlighted && !!onClickSlot;
          const canUnplace = !!p && !!onUnplace;
          const clickable = canPlace || canUnplace;
          return (
            <div
              key={slot.key}
              onClick={clickable ? () => canPlace ? onClickSlot(slot.key) : onUnplace(slot.key) : undefined}
              title={p ? (canPlace ? `Trocar de lugar com ${p.name}` : `${p.name} — clique para remover`) : canPlace ? 'Colocar no banco' : slot.label}
              style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 12, minWidth: 80, textAlign: 'center',
                background: canPlace ? 'rgba(127,217,154,0.12)' : isPreviewed ? 'rgba(212,162,60,0.1)' : p ? `${mc}22` : 'rgba(255,255,255,0.04)',
                border: `1px ${isPreviewed ? 'dashed' : 'solid'} ${canPlace ? '#7fd99a88' : isPreviewed ? '#d4a23c88' : p ? mc + '55' : 'rgba(255,255,255,0.1)'}`,
                cursor: clickable ? 'pointer' : 'default',
                transform: canPlace ? 'scale(1.06)' : 'scale(1)',
                transition: 'all 0.15s',
                boxShadow: canPlace ? '0 0 10px rgba(127,217,154,0.25)' : 'none',
              }}
            >
              {p ? (
                <>
                  <div style={{ fontWeight: 600, color: mc }}>{shortName(p.name)}</div>
                  <div style={{ fontSize: 10, opacity: 0.5 }}>{p.pos[0]} · {p.ovr}</div>
                </>
              ) : (
                <div style={{ color: canPlace ? '#7fd99a' : isPreviewed ? '#d4a23c' : 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: (canPlace || isPreviewed) ? 600 : 400 }}>
                  {canPlace ? '+ ' : ''}{slot.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Chaveamento visual da Copa
// Desfecho de um confronto do mata-mata: agregado ida+volta (com o mando
// invertido na volta), ou o placar simples quando é jogo único (final), já
// levando em conta os pênaltis quando o agregado empata — mesma regra que
// `goNextRound` usa pra decidir quem avança de verdade.
function cupMatchOutcome(round, matchIdx) {
  const match = round?.matches?.[matchIdx];
  if (!match) return { decided: false, aggH: null, aggA: null };
  const isFinal = (round.matches?.length || 0) === 1;
  const leg1 = round.leg1Results?.[matchIdx];
  const leg2 = round.results?.[matchIdx];
  if (!leg2) return { decided: false, aggH: null, aggA: null };
  const aggH = isFinal ? leg2.homeGoals : (leg1 ? leg1.homeGoals + leg2.awayGoals : null);
  const aggA = isFinal ? leg2.awayGoals : (leg1 ? leg1.awayGoals + leg2.homeGoals : null);
  if (aggH == null || aggA == null) return { decided: false, aggH: null, aggA: null };
  if (aggH !== aggA) {
    const winnerId = aggH > aggA ? match.homeId : match.awayId;
    return { decided: true, aggH, aggA, winnerId, loserId: winnerId === match.homeId ? match.awayId : match.homeId, onPens: false };
  }
  const pen = round.penaltyResults?.find(p => p.matchIdx === matchIdx);
  if (!pen?.winner) return { decided: false, aggH, aggA };
  return {
    decided: true, aggH, aggA, winnerId: pen.winner,
    loserId: pen.winner === match.homeId ? match.awayId : match.homeId, onPens: true,
  };
}

// Geometria do chaveamento clássico: 4 fases de cada lado (16 avos → semi) e a
// final no meio, 9 colunas no total. As posições são calculadas em JS (e não
// via flex) porque as linhas que ligam um confronto ao bloco da fase seguinte
// precisam de coordenadas exatas — elas são desenhadas num SVG sobreposto.
const BK_BLOCK_H = 46;
const BK_PITCH = 58;   // distância entre os centros de dois blocos das 16 avos
const BK_COL_W = 132;
const BK_COL_GAP = 26;
const BK_SIDE_ROUNDS = 4;
const BK_GOLD = '#f0c040';
const BK_HEIGHT = BK_PITCH * 8;                     // 8 confrontos por lado
const BK_WIDTH = 9 * BK_COL_W + 8 * BK_COL_GAP;
// Abaixo desta escala os nomes dos times deixam de ser legíveis (no celular a
// chave inteira cabe em ~0,24, virando um borrão cinza bonito e inútil).
const BK_LEGIBLE_SCALE = 0.55;

const bkColX = (col) => col * (BK_COL_W + BK_COL_GAP);
// Centro vertical do bloco `i` da fase `r` (r=0 nas 16 avos). A cada fase o
// espaçamento dobra, então o bloco da fase seguinte cai exatamente no meio dos
// dois que o alimentam — é o que faz a árvore fechar sozinha.
const bkBlockY = (r, i) => BK_PITCH * Math.pow(2, r) * (i + 0.5);
// Coluna de uma fase: lado esquerdo conta da borda pro meio, direito espelhado.
const bkColOf = (r, side) => (side === 'L' ? r : 8 - r);

function CupBracketModal({
  cupRounds, leagueTeams, myTeamId, myTeamColor, myTeamLogo, myTeamBadge, onViewTeam, onClose,
  // Transição: `advance` é o momento em que uma fase acabou de ser decidida.
  // { intoRoundIdx, winnerIds } numa fase comum; { championId } na final.
  advance = null, simActive = false, simStatus = '', onSimulateAll, onCancelSim,
}) {
  const mc = myTeamColor || '#d4a23c';
  const wrapRef = useRef(null);
  const autoZoomedRef = useRef(false);
  const [fitScale, setFitScale] = useState(1);
  const [zoomed, setZoomed] = useState(false);
  const advancingIds = useMemo(() => new Set(advance?.winnerIds || []), [advance]);
  const intoRoundIdx = advance?.intoRoundIdx ?? -1;
  const championId = advance?.championId ?? null;
  const isChampionMoment = !!championId;
  const championTeam = isChampionMoment ? leagueTeams?.find(t => t.id === championId) : null;

  // Durante a transição o chaveamento se abre já enquadrado na fase que acabou
  // de ser decidida — no celular a chave inteira cabe minúscula, e o momento
  // que interessa é justamente o bloco novo.
  const decidedRoundIdx = isChampionMoment ? BK_SIDE_ROUNDS : intoRoundIdx - 1;

  // Encolhe o chaveamento inteiro pra caber na largura disponível — assim o
  // formato clássico aparece de uma vez só, sem rolagem horizontal. No celular
  // isso fica minúsculo, então o botão de ampliar sobe pra um tamanho legível
  // e aí sim libera a rolagem lateral.
  useEffect(() => {
    const fit = () => {
      const w = wrapRef.current?.clientWidth;
      if (!w) return;
      const s = Math.min(1, w / BK_WIDTH);
      setFitScale(s);
      // No celular a chave inteira cabe numa escala de ~0,24: o desenho fica
      // bonito e os nomes dos times viram borrão cinza. Nesse caso não adianta
      // "caber" — abre já ampliado e rolado até a fase que interessa, em vez
      // de mostrar algo ilegível e esperar a pessoa descobrir o "Ampliar".
      // Só na primeira medição, pra não desfazer o que a pessoa escolheu.
      if (s < BK_LEGIBLE_SCALE && !autoZoomedRef.current) {
        autoZoomedRef.current = true;
        setZoomed(true);
      }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  const scale = zoomed ? Math.max(fitScale, 0.8) : fitScale;
  const canZoom = fitScale < 0.8;

  // Ampliado, o chaveamento é mais largo que a tela. Rolar sozinho até a fase
  // recém-decidida (ou a final, no momento do campeão) evita abrir o modal
  // encarando as 16 avos enquanto o que acabou de acontecer está fora da tela.
  // Coluna que a rolagem persegue: a fase recém-decidida quando o modal abriu
  // por uma transição; senão, a fase mais avançada que já tem confronto — que
  // é onde a Copa está agora. Sem esse segundo caso, abrir o chaveamento na
  // semifinal (ou durante a simulação) começava encarando as 16 avos.
  const focusCol = useMemo(() => {
    if (decidedRoundIdx >= BK_SIDE_ROUNDS) return 4;
    if (decidedRoundIdx >= 0) return decidedRoundIdx;
    let last = 0;
    (cupRounds || []).forEach((r, i) => { if (r?.matches?.length) last = i; });
    return last >= BK_SIDE_ROUNDS ? 4 : last;
  }, [decidedRoundIdx, cupRounds]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !zoomed) return;
    const alvo = (bkColX(focusCol) + BK_COL_W / 2) * scale - el.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, alvo), behavior: 'smooth' });
  }, [zoomed, scale, focusCol]);

  const teamOf = (id) => leagueTeams?.find(t => t.id === id);
  const crestOf = (team, id) => {
    if (id === myTeamId) {
      if (myTeamLogo) return <img src={myTeamLogo} style={styles.bracketCrestImg} alt="" />;
      if (myTeamBadge) return <span style={styles.bracketCrestEmoji}>{myTeamBadge}</span>;
      return null;
    }
    return team?.clubLogo ? <img src={team.clubLogo} style={styles.bracketCrestImg} alt="" /> : null;
  };

  const outcomeAt = (r, matchIdx) => {
    const round = cupRounds?.[r];
    if (!round?.matches?.[matchIdx]) return null;
    return cupMatchOutcome(round, matchIdx);
  };

  const renderBlock = (r, matchIdx, side, posIdx) => {
    const round = cupRounds?.[r];
    const m = round?.matches?.[matchIdx];
    const x = bkColX(bkColOf(r, side));
    const y = r >= BK_SIDE_ROUNDS ? BK_HEIGHT / 2 : bkBlockY(r, posIdx);
    const key = `b${r}-${matchIdx}`;
    const box = {
      position: 'absolute', left: x, top: y - BK_BLOCK_H / 2, width: BK_COL_W, height: BK_BLOCK_H,
      borderRadius: 7, overflow: 'hidden', background: 'rgba(0,0,0,0.3)',
    };

    // Fase ainda não sorteada: bloco vazio, só pra manter o desenho do
    // chaveamento completo desde a primeira fase.
    if (!m) {
      return (
        <div key={key} style={{ ...box, border: '1px dashed rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 10, opacity: 0.25, fontFamily: "'Space Mono', monospace" }}>a definir</span>
        </div>
      );
    }

    const out = cupMatchOutcome(round, matchIdx);
    const rows = [
      { id: m.homeId, agg: out.aggH },
      { id: m.awayId, agg: out.aggA },
    ];
    // Bloco que acabou de ser preenchido pelos classificados: entra na tela
    // com um pequeno salto, escalonado por posição pra dar leitura de cima
    // pra baixo em vez de tudo piscando junto.
    const isLanding = r === intoRoundIdx && rows.some(row => advancingIds.has(row.id));
    const isChampionBlock = isChampionMoment && r === BK_SIDE_ROUNDS;
    // Confronto que ACABOU de ser decidido — é o único que ganha o anel dourado
    // cheio. Antes todo classificado de todas as fases levava anel, e com 16
    // vencedores só nas 16 avos a tela virava uma parede de amarelo onde o
    // dourado não queria dizer mais nada. Agora: dourado forte = acabou de
    // acontecer; texto dourado = já passou; e o time do jogador tem a cor DELE,
    // que é o que ele procura na tela.
    const isJustDecided = r === decidedRoundIdx && !!advance;
    const hasMine = rows.some(row => row.id === myTeamId);
    const ring = isChampionBlock || isJustDecided
      ? BK_GOLD
      : hasMine ? hexToRgba(mc, 0.55) : 'rgba(255,255,255,0.1)';
    return (
      <div
        key={key}
        className={isLanding ? 'bk-land' : undefined}
        style={{
          ...box,
          border: `1px solid ${ring}`,
          // O brilho fica no BLOCO (que é arredondado), não na linha de dentro:
          // a linha é retangular e o anel dela era cortado pelo raio do bloco,
          // o que deixava os cantos com cara de borda quebrada.
          boxShadow: isChampionBlock || isJustDecided ? `0 0 0 1px ${hexToRgba(BK_GOLD, 0.35)}` : 'none',
          animationDelay: isLanding ? `${0.35 + posIdx * 0.09}s` : undefined,
        }}
      >
        {rows.map((row, ti) => {
          const team = teamOf(row.id);
          const won = out.decided && out.winnerId === row.id;
          const lost = out.decided && out.loserId === row.id;
          const mine = row.id === myTeamId;
          const flashing = isJustDecided && won && (isChampionMoment || advancingIds.has(row.id));
          return (
            <div key={ti} className={flashing ? 'bk-flash' : undefined} style={{
              display: 'flex', alignItems: 'center', gap: 5, height: '50%', padding: '0 6px',
              borderBottom: ti === 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              background: mine ? hexToRgba(mc, 0.16) : won ? hexToRgba(BK_GOLD, isJustDecided ? 0.16 : 0.07) : 'transparent',
              opacity: lost ? 0.32 : 1,
            }}>
              <span style={{ ...styles.bracketCrestSlot, width: 16, height: 16 }}>{crestOf(team, row.id)}</span>
              <span
                onClick={() => !mine && onViewTeam && team && onViewTeam(team)}
                style={{
                  flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: 10.5, cursor: mine ? 'default' : 'pointer',
                  color: mine ? mc : won ? BK_GOLD : '#F4F1EA',
                  fontWeight: won || mine ? 700 : 400,
                }}
              >{team?.label || '?'}</span>
              {row.agg !== null && row.agg !== undefined && (
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10.5, fontWeight: 700, color: mine ? mc : won ? BK_GOLD : 'rgba(255,255,255,0.6)' }}>
                  {row.agg}{out.onPens && won ? '*' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Todos os blocos: 8 confrontos por lado nas 16 avos, metade a cada fase.
  const blocks = [];
  for (let r = 0; r < BK_SIDE_ROUNDS; r++) {
    const perSide = 8 >> r;
    for (let p = 0; p < perSide; p++) {
      blocks.push(renderBlock(r, p, 'L', p));
      blocks.push(renderBlock(r, perSide + p, 'R', p));
    }
  }
  blocks.push(renderBlock(BK_SIDE_ROUNDS, 0, 'L', 0)); // final, no centro

  // Linhas: uma por confronto, do bloco dele até o bloco da fase seguinte.
  // Fica dourada quando o confronto já foi decidido — é a linha "levando" o
  // classificado pro próximo bloco.
  const paths = [];
  for (let r = 0; r < BK_SIDE_ROUNDS; r++) {
    const perSide = 8 >> r;
    for (let p = 0; p < perSide; p++) {
      for (const side of ['L', 'R']) {
        const matchIdx = side === 'L' ? p : perSide + p;
        const out = outcomeAt(r, matchIdx);
        const lit = !!out?.decided;
        const y = bkBlockY(r, p);
        const isSemi = r === BK_SIDE_ROUNDS - 1;
        const targetY = isSemi ? BK_HEIGHT / 2 : bkBlockY(r + 1, Math.floor(p / 2));
        const colFrom = bkColOf(r, side);
        const colTo = isSemi ? 4 : bkColOf(r + 1, side);
        // No lado direito o desenho corre da direita pra esquerda.
        const xFrom = side === 'L' ? bkColX(colFrom) + BK_COL_W : bkColX(colFrom);
        const xTo = side === 'L' ? bkColX(colTo) : bkColX(colTo) + BK_COL_W;
        const midX = (xFrom + xTo) / 2;
        // Na transição, a linha da fase recém-decidida se DESENHA (em vez de
        // já aparecer pronta) — é ela que "leva" o classificado até o bloco
        // novo, e o bloco só aterrissa depois que ela chega lá.
        const drawing = lit && r === decidedRoundIdx && !!advance;
        const len = Math.abs(midX - xFrom) + Math.abs(targetY - y) + Math.abs(xTo - midX);
        // Três intensidades em vez de duas: a linha da fase que acabou de sair
        // é ouro cheio, as fases já resolvidas ficam num ouro apagado (contam a
        // história sem competir com o presente) e o que não foi jogado é
        // cinza. Antes toda linha decidida era ouro forte e a chave inteira
        // brigava por atenção.
        const strokeCor = drawing ? BK_GOLD : lit ? hexToRgba(BK_GOLD, 0.4) : 'rgba(255,255,255,0.13)';
        paths.push(
          <path
            key={`p${r}-${side}-${p}`}
            className={drawing ? 'bk-draw' : undefined}
            d={`M ${xFrom} ${y} H ${midX} V ${targetY} H ${xTo}`}
            fill="none"
            stroke={strokeCor}
            strokeWidth={drawing ? 2 : lit ? 1.4 : 1}
            style={drawing ? { '--bk-len': len, strokeDasharray: len, animationDelay: `${p * 0.06}s` } : undefined}
          />
        );
      }
    }
  }

  const roundLabels = [];
  for (let r = 0; r < BK_SIDE_ROUNDS; r++) {
    for (const side of ['L', 'R']) {
      roundLabels.push(
        <div key={`l${r}${side}`} style={{
          position: 'absolute', left: bkColX(bkColOf(r, side)), top: -22, width: BK_COL_W,
          textAlign: 'center', fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase',
          fontFamily: "'Space Mono', monospace", opacity: 0.4,
        }}>{CUP_ROUND_NAMES[r]}</div>
      );
    }
  }
  roundLabels.push(
    <div key="lfinal" style={{
      position: 'absolute', left: bkColX(4), top: -22, width: BK_COL_W,
      textAlign: 'center', fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase',
      fontFamily: "'Space Mono', monospace", color: BK_GOLD, fontWeight: 700,
    }}>🏆 Final</div>
  );

  // Troféu sobre o bloco da final — só no instante em que o campeão sai.
  const trophy = isChampionMoment ? (
    <div key="trophy" className="bk-trophy" style={{
      position: 'absolute', left: bkColX(4), top: BK_HEIGHT / 2 - BK_BLOCK_H / 2 - 40,
      width: BK_COL_W, textAlign: 'center', fontSize: 30, animationDelay: '0.5s', pointerEvents: 'none',
    }}>🏆</div>
  ) : null;

  // Os confrontos que a fase nova acabou de formar, em texto. O desenho da
  // chave conta a história inteira, mas ele é encolhido pra caber na largura —
  // no celular vira letra de formiga, e é justamente aqui que a pessoa quer
  // ler UMA coisa: quem eu pego agora. Some no momento do campeão (ali o que
  // importa é o troféu) e fora da transição.
  const nextMatchStrip = advance && !isChampionMoment && cupRounds?.[intoRoundIdx]?.matches?.length > 0 ? (
    <div style={{ marginTop: 14, display: 'grid', gap: 4 }}>
      {cupRounds[intoRoundIdx].matches.map((m, i) => {
        const h = teamOf(m.homeId), a = teamOf(m.awayId);
        const mine = m.homeId === myTeamId || m.awayId === myTeamId;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
            padding: '6px 10px', borderRadius: 6,
            background: mine ? hexToRgba(mc, 0.14) : 'rgba(255,255,255,0.04)',
            border: `1px solid ${mine ? hexToRgba(mc, 0.4) : 'rgba(255,255,255,0.07)'}`,
            fontWeight: mine ? 700 : 400,
          }}>
            <span style={{ flex: 1, minWidth: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h?.label || '?'}</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, opacity: 0.5, flexShrink: 0 }}>×</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a?.label || '?'}</span>
          </div>
        );
      })}
    </div>
  ) : null;

  // Cabeçalho: fora da transição é só o título; durante, conta o que acabou
  // de acontecer (é o momento em que a pessoa descobre quem vai pegar).
  // "Classificados para Final" ficava sem artigo. As fases têm gênero/número
  // diferentes ("as Oitavas", "a Final"), então o artigo vem junto do nome.
  const faseDestino = CUP_ROUND_NAMES[intoRoundIdx];
  const nomeComArtigo = faseDestino
    ? `${/^(16 Avos|Oitavas|Quartas)/.test(faseDestino) ? 'as' : 'a'} ${faseDestino}`
    : 'a fase seguinte';
  const title = isChampionMoment
    ? `🏆 ${championTeam?.label || 'Campeão'} — campeão da Copa do Brasil`
    : advance
      ? `Classificados para ${nomeComArtigo}`
      : simActive
        ? (simStatus || 'Simulando a Copa…')
        : '🏆 Chaveamento — Copa do Brasil';
  // Durante a transição o fundo fecha por clique só quando não é o momento do
  // campeão — ali o botão é o caminho, pra ninguém pular o fecho sem querer.
  const closeOnBackdrop = !simActive && !isChampionMoment ? onClose : undefined;

  return (
    <div onClick={closeOnBackdrop} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1460, maxHeight: '94vh', overflowY: 'auto', background: '#0f1f15', border: `1px solid ${isChampionMoment ? hexToRgba(BK_GOLD, 0.45) : 'rgba(255,255,255,0.1)'}`, borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: BK_GOLD, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {canZoom && (
              <button
                onClick={() => setZoomed(z => !z)}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#F4F1EA', fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}
              >{zoomed ? '⤢ Ver inteiro' : '🔍 Ampliar'}</button>
            )}
            {/* Durante a simulação direta e no momento do campeão o ✕ sai de
                cena: ali a ação certa é o botão embaixo, não abandonar. */}
            {!simActive && !isChampionMoment && (
              <button onClick={onClose} aria-label="Fechar" className="tap-target-sm" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 18, cursor: 'pointer', padding: 6, lineHeight: 1 }}>✕</button>
            )}
          </div>
        </div>

        <div ref={wrapRef} style={{ width: '100%', overflowX: zoomed ? 'auto' : 'hidden', overflowY: 'hidden' }}>
          <div style={{ height: (BK_HEIGHT + 30) * scale, width: BK_WIDTH * scale, position: 'relative' }}>
            <div style={{ position: 'absolute', width: BK_WIDTH, height: BK_HEIGHT, top: 26 * scale, left: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <svg width={BK_WIDTH} height={BK_HEIGHT} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{paths}</svg>
              {roundLabels}
              {blocks}
              {trophy}
            </div>
          </div>
        </div>

        {nextMatchStrip}

        <div style={{ marginTop: 14, display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', fontSize: 10.5, opacity: 0.55 }}>
          <span><span style={{ color: BK_GOLD }}>▬</span> classificado</span>
          <span>times escurecidos foram eliminados</span>
          <span><span style={{ fontFamily: "'Space Mono', monospace" }}>*</span> decidido nos pênaltis</span>
        </div>

        {simActive ? (
          <>
            <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: BK_GOLD, fontFamily: "'Space Mono', monospace", minHeight: 18 }}>
              {simStatus || 'Simulando…'}
            </div>
            {onCancelSim && (
              <button onClick={onCancelSim} style={{ ...styles.btnGhost, width: '100%', marginTop: 10 }}>Parar</button>
            )}
          </>
        ) : (
          <>
            {/* Fora da transição, o chaveamento também é de onde dá pra tocar a
                Copa até o fim — o mesmo papel que o calendário tem no
                Brasileirão. */}
            {!advance && onSimulateAll && (
              <button onClick={onSimulateAll} style={{ ...styles.btnGhost, width: '100%', marginTop: 14 }}>
                ⏭ Simular até o campeão
              </button>
            )}
            <button onClick={onClose} style={{ ...styles.btnPrimary, width: '100%', marginTop: advance ? 14 : 8, background: isChampionMoment ? BK_GOLD : mc, color: '#0B1A12' }}>
              {isChampionMoment ? 'Ver resultado final →' : advance ? 'Continuar →' : 'Fechar'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Painel de estatísticas da temporada (artilheiros, assistências, goleiros,
// notas e cartões) — usado tanto no Brasileirão quanto na Copa.
function SeasonStatsPanel({ scorers, assisters, cleanSheets, seasonRatings, cardCounts, redCards, leagueTeams, mc }) {
  const empty = !((scorers && Object.keys(scorers).length) || (assisters && Object.keys(assisters).length)
    || (cleanSheets && Object.keys(cleanSheets).length) || (seasonRatings && Object.keys(seasonRatings).length)
    || (cardCounts && Object.keys(cardCounts).length));
  if (empty) {
    return <div style={{ marginTop: 14, fontSize: 12, opacity: 0.45, textAlign: 'center' }}>As estatísticas aparecem depois do primeiro jogo.</div>;
  }
  return (
    <>
      {scorers && Object.keys(scorers).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={styles.sectionLabel}>Artilheiros</div>
          {Object.entries(scorers)
            .sort((a, b) => b[1].goals - a[1].goals)
            .slice(0, 5)
            .map(([key, d], i) => {
              const { name } = splitPlayerKey(key);
              return (
                <div key={key} style={styles.statRow}>
                  <span style={styles.statRank}>{i + 1}.</span>
                  <span style={styles.statName}>{name}</span>
                  <span style={styles.statTeam}>{d.teamLabel}</span>
                  <span style={{ ...styles.statValue, color: mc }}>gol {d.goals}</span>
                </div>
              );
            })
          }
        </div>
      )}

      {assisters && Object.keys(assisters).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={styles.sectionLabel}>Lideres de Assistencia</div>
          {Object.entries(assisters)
            .sort((a, b) => b[1].assists - a[1].assists)
            .slice(0, 5)
            .map(([key, d], i) => {
              const { name } = splitPlayerKey(key);
              return (
                <div key={key} style={styles.statRow}>
                  <span style={styles.statRank}>{i + 1}.</span>
                  <span style={styles.statName}>{name}</span>
                  <span style={styles.statTeam}>{d.teamLabel}</span>
                  <span style={{ ...styles.statValue, color: mc }}>assist {d.assists}</span>
                </div>
              );
            })
          }
        </div>
      )}

      {cleanSheets && Object.keys(cleanSheets).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={styles.sectionLabel}>Goleiros — Jogos sem sofrer gol</div>
          {Object.entries(cleanSheets)
            .filter(([, d]) => d.clean > 0)
            .sort((a, b) => b[1].clean - a[1].clean)
            .slice(0, 5)
            .map(([key, d], i) => {
              const { name } = splitPlayerKey(key);
              return (
                <div key={key} style={styles.statRow}>
                  <span style={styles.statRank}>{i + 1}.</span>
                  <span style={styles.statName}>{name}</span>
                  <span style={styles.statTeam}>{d.teamLabel}</span>
                  <span style={{ ...styles.statValue, color: mc }}>🧤 {d.clean}</span>
                </div>
              );
            })
          }
        </div>
      )}

      {seasonRatings && Object.keys(seasonRatings).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={styles.sectionLabel}>Nota Média da Temporada</div>
          {Object.entries(seasonRatings)
            .filter(([, d]) => d.count >= 3)
            .sort((a, b) => (b[1].sum / b[1].count) - (a[1].sum / a[1].count))
            .slice(0, 5)
            .map(([key, d], i) => {
              const { name } = splitPlayerKey(key);
              const avg = d.sum / d.count;
              return (
                <div key={key} style={styles.statRow}>
                  <span style={styles.statRank}>{i + 1}.</span>
                  <span style={styles.statName}>{name}</span>
                  <span style={styles.statTeam}>{d.teamLabel} · {d.count}j</span>
                  <span style={{ ...styles.statValue, color: avg >= 7.5 ? '#7fd99a' : avg < 5.5 ? '#e0593f' : mc }}>⭐ {avg.toFixed(1)}</span>
                </div>
              );
            })
          }
        </div>
      )}

      {cardCounts && Object.keys(cardCounts).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={styles.sectionLabel}>Cartões</div>
          {Object.entries(cardCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([key, yellows], i) => {
              const { teamId, name } = splitPlayerKey(key);
              const teamLabel = leagueTeams?.find(t => t.id === teamId)?.label;
              return (
                <div key={key} style={styles.statRow}>
                  <span style={styles.statRank}>{i + 1}.</span>
                  <span style={styles.statName}>{name}</span>
                  {teamLabel && <span style={styles.statTeam}>{teamLabel}</span>}
                  {redCards?.[key] > 0 && <span style={{ fontSize: 13 }}>🟥×{redCards[key]}</span>}
                  <span style={{ ...styles.statValue, color: mc }}>🟨 {yellows}</span>
                </div>
              );
            })
          }
        </div>
      )}
    </>
  );
}

// Modal para ver o elenco COMPLETO (titulares + banco) de um time — aberto
// ao clicar num time em qualquer lugar do app (tabela, chaveamento da Copa,
// cabeçalho da partida ao vivo, resultado final). Importante sobretudo no
// mobile, onde não dá pra "passar o olho" no elenco adversário sem um modal.
function TeamViewModal({ team, onClose, myTeamColor, suspensions, injuries }) {
  const mc = myTeamColor || '#d4a23c';
  if (!team) return null;
  const { starters, bench, unavailable } = buildSquadView(team, suspensions, injuries);
  const understaffed = unavailable.some(p => p.shortOnSubs);
  const players = team.players || [];
  const renderRow = (p, i) => (
    <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
      <span style={{ width: 36, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{p.pos?.[0] || '-'}</span>
      <span style={{ flex: 1 }}>{p.name}</span>
      <span style={{ fontFamily: "'Space Mono', monospace", color: ovrColor(p.ovr), fontSize: 11 }}>{p.ovr}</span>
    </div>
  );
  const renderUnavailableRow = (p, i) => (
    <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12, opacity: 0.5 }}>
      <span style={{ width: 36, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{p.pos?.[0] || '-'}</span>
      <span style={{ flex: 1 }}>
        {p.name}
        <span title={p.reason === 'suspenso' ? 'Suspenso' : 'Lesionado'} style={{ marginLeft: 6 }}>{p.reason === 'suspenso' ? '🟥' : '🩹'}</span>
        {p.replacementName && <span style={{ display: 'block', fontSize: 10, opacity: 0.8, marginTop: 1 }}>entra: {p.replacementName}</span>}
        {p.shortOnSubs && <span style={{ display: 'block', fontSize: 10, color: '#e05050', marginTop: 1 }}>sem reserva na posição</span>}
      </span>
      <span style={{ fontFamily: "'Space Mono', monospace", color: ovrColor(p.ovr), fontSize: 11 }}>{p.ovr}</span>
    </div>
  );
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0F2318', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 20, width: '100%', maxWidth: 400, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            {team.clubLogo && <img src={team.clubLogo} style={{ width: 28, height: 28, objectFit: 'contain', marginRight: 8, verticalAlign: 'middle' }} alt="" />}
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 700 }}>{team.label}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, padding: 6 }}>x</button>
        </div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: mc, marginBottom: 12 }}>OVR {team.ovr} · {players.length} jogadores</div>
        {understaffed && (
          <div style={{ background: 'rgba(224,80,80,0.12)', border: '1px solid rgba(224,80,80,0.35)', borderRadius: 8, padding: '8px 10px', fontSize: 11.5, color: '#e05050', marginBottom: 12 }}>
            ⚠️ Time desfalcado — sem reserva disponível pra uma posição.
          </div>
        )}
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Titulares</div>
        {starters.map(renderRow)}
        {bench.length > 0 && (
          <>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.4)', marginTop: 14, marginBottom: 4 }}>Banco</div>
            {bench.map(renderRow)}
          </>
        )}
        {unavailable.length > 0 && (
          <>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.4)', marginTop: 14, marginBottom: 4 }}>Desfalques</div>
            {unavailable.map(renderUnavailableRow)}
          </>
        )}
      </div>
    </div>
  );
}

// Zonas da tabela do Brasileirão
function getZoneInfo(pos, total) {
  if (pos <= 4) return { color: '#22c55e', label: 'G4', title: 'Libertadores - Fase de Grupos' };
  if (pos <= 6) return { color: '#86efac', label: 'G6', title: 'Libertadores - Pre' };
  if (pos <= 12) return { color: '#60a5fa', label: 'SA', title: 'Sul-Americana' };
  if (pos >= total - 3) return { color: '#ef4444', label: 'Z4', title: 'Rebaixamento' };
  return null;
}

function DraftTopBar({ formationLabel, filled, total, skipsLeft, onSkip, onBack, mustSkip = false }) {
  const pct = total > 0 ? (filled / total) * 100 : 0;
  // `mustSkip`: nenhum jogador do time sorteado cabe nas vagas restantes. O
  // pulo continua disponível mesmo com a cota zerada — senão a tela fica sem
  // ação nenhuma (ver comentário em skipTeam).
  const canSkip = skipsLeft > 0 || mustSkip;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={styles.draftTopRow}>
        <div>
          {onBack && <button onClick={onBack} className="tap-target-sm" style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px', margin: '0 0 2px -2px', minHeight: 30, display: 'block' }}>&#8592; Voltar</button>}
          <div style={styles.eyebrow}>{formationLabel}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{filled} de {total} posições preenchidas</div>
          {mustSkip && (
            <div style={{ fontSize: 12, color: '#e0a03c', marginTop: 6, maxWidth: 340 }}>
              Nenhum jogador deste time cabe nas vagas que sobraram — pule sem gastar seus pulos.
            </div>
          )}
        </div>
        <button
          onClick={onSkip}
          disabled={!canSkip}
          title={!canSkip ? 'Sem pulos restantes' : mustSkip && skipsLeft <= 0 ? 'Pulo livre — nenhum jogador cabe' : 'Pular este time'}
          style={{
            ...styles.skipsBox,
            cursor: canSkip ? 'pointer' : 'not-allowed',
            opacity: canSkip ? 1 : 0.4,
            background: 'none',
            border: `1px solid ${canSkip ? 'rgba(212,162,60,0.4)' : 'rgba(255,255,255,0.12)'}`,
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          <span style={{ ...styles.skipsNum, color: canSkip ? '#d4a23c' : 'rgba(255,255,255,0.4)' }}>{mustSkip && skipsLeft <= 0 ? '↻' : skipsLeft}</span>
          <span style={{ ...styles.skipsLabel, color: canSkip ? 'rgba(212,162,60,0.8)' : 'rgba(255,255,255,0.35)' }}>pular</span>
        </button>
      </div>
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${pct}%` }} />
      </div>
    </div>
  );
}

function useIsMobile(bp = 768) {
  const [mob, setMob] = useState(() => typeof window !== 'undefined' && window.innerWidth <= bp);
  useEffect(() => {
    const fn = () => setMob(window.innerWidth <= bp);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [bp]);
  return mob;
}

function Draft({ onBack, rolledTeam, isRolling, rollingPreview, pitch, pitchSlots, formationLabel, skipsLeft, selectedPlayer, repositioningSlot, eligibleSlotsForPlayer, isPlayerBlockedByFormation, onClickPlayer, onClickPitchSlot, onUnplacePlayer, onSkipTeam, mustSkip, myTeamColor, captainSlot }) {
  const isMobile = useIsMobile();
  const filledCount = Object.keys(pitch).length;
  const highlightSlots = selectedPlayer ? eligibleSlotsForPlayer(selectedPlayer) : [];
  // Preview no hover: só no desktop (touch não tem hover de verdade) e só
  // quando não há seleção ativa, pra não conflitar com o destaque real.
  // Debounça a entrada (não a saída) — sem isso, passar o mouse rápido por
  // vários jogadores da lista disparava um re-render + animação de escala no
  // campo a cada linha sobrevoada, e a transição de 0.15s de cada uma ainda
  // rodando quando a próxima já começava dava a sensação de "delay"/travado.
  const [hoveredPlayer, setHoveredPlayer] = useState(null);
  const hoverTimeoutRef = useRef(null);
  useEffect(() => () => clearTimeout(hoverTimeoutRef.current), []);
  const handlePlayerHoverStart = (p) => {
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setHoveredPlayer(p), 60);
  };
  const handlePlayerHoverEnd = (p) => {
    clearTimeout(hoverTimeoutRef.current);
    setHoveredPlayer(prev => (prev?.name === p.name ? null : prev));
  };
  const previewSlots = !isMobile && !selectedPlayer && hoveredPlayer ? eligibleSlotsForPlayer(hoveredPlayer) : [];
  const sortedPlayers = useMemo(() => {
    if (!rolledTeam) return [];
    return [...rolledTeam.players].sort((a, b) => posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]));
  }, [rolledTeam]);

  const mobileLayoutStyle = { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 };
  const playersPanelStyle = isMobile
    ? { ...styles.draftLeft, maxHeight: '50vh' }
    : styles.draftLeft;
  const pitchPanelStyle = isMobile ? {} : styles.draftRight;

  if (isRolling) {
    const pitchEl = <div style={pitchPanelStyle}><Pitch pitch={pitch} pitchSlots={pitchSlots} myTeamColor={myTeamColor} captainSlot={captainSlot} /></div>;
    const rollingEl = (
      <div className="draft-left" style={playersPanelStyle}>
        <div style={styles.rollingBox}>
          <span style={styles.diceIconSpin}>🎲</span>
          <div style={styles.rollingName}>{rollingPreview ? rollingPreview.label : '...'}</div>
          <div style={styles.rollingHint}>sorteando time...</div>
        </div>
      </div>
    );
    return (
      <div style={styles.card} className="card-mob">
        <DraftTopBar formationLabel={formationLabel} filled={filledCount} total={pitchSlots.length} skipsLeft={skipsLeft} onSkip={onSkipTeam} onBack={onBack} mustSkip={mustSkip} />
        <div style={isMobile ? mobileLayoutStyle : styles.draftLayout} className="draft-layout-grid">
          {isMobile ? <>{pitchEl}{rollingEl}</> : <>{rollingEl}{pitchEl}</>}
        </div>
      </div>
    );
  }

  if (!rolledTeam) {
    return (
      <div style={styles.card} className="card-mob">
        <DraftTopBar formationLabel={formationLabel} filled={filledCount} total={pitchSlots.length} skipsLeft={skipsLeft} onSkip={onSkipTeam} onBack={onBack} />
        <div style={styles.emptyState}>
          Os times disponíveis se esgotaram.
        </div>
        {/* Essa tela já foi um beco sem saída: sem botão nenhum e com o save
            preso em 'draft', toda recarga voltava pra cá. Hoje o App re-sorteia
            sozinho ao restaurar, e este botão é a rede de segurança final. */}
        {onBack && (
          <button style={{ ...styles.btnPrimary, width: '100%', marginTop: 12 }} onClick={onBack}>
            Recomeçar a escalação
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ ...styles.card, position: 'relative' }} className="card-mob">
      <DraftTopBar formationLabel={formationLabel} filled={filledCount} total={pitchSlots.length} skipsLeft={skipsLeft} onSkip={onSkipTeam} onBack={onBack} mustSkip={mustSkip} />

      {selectedPlayer && (
        <div style={styles.selectedPlayerBanner}>
          {repositioningSlot !== null
            ? <>Mova <b>{selectedPlayer.name}</b> para outra posição — ou clique num jogador para cancelar</>
            : <>Escolha a posição no campo para <b>{selectedPlayer.name}</b></>
          }
        </div>
      )}

      {/* Banner de preview do hover: sempre sobreposto (position:absolute +
          wrapper de altura zero), nunca em fluxo normal. Antes ele empurrava
          o layout ao aparecer/sumir — o que deslocava a PRÓPRIA linha hoverada
          pra fora do cursor, disparando mouseleave, escondendo o banner, o que
          devolvia a linha pro lugar, disparando mouseenter de novo: um loop
          infinito de pisca-pisca. pointerEvents:'none' garante que o banner
          nunca "rouba" o hover de quem está embaixo dele mesmo quando
          se sobrepõe visualmente. */}
      {!selectedPlayer && (
        <div style={{ position: 'relative', height: 0, zIndex: 5 }}>
          {previewSlots.length > 0 && hoveredPlayer ? (
            <div style={{ ...styles.selectedPlayerBanner, position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none', background: '#1a2a12', boxShadow: '0 4px 14px rgba(0,0,0,0.45)', border: '1px solid rgba(212,162,60,0.5)' }}>
              👀 <b>{hoveredPlayer.name}</b> pode jogar em: {previewSlots.map(s => s.label).join(', ')}
            </div>
          ) : hoveredPlayer && isPlayerBlockedByFormation(hoveredPlayer) ? (
            <div style={{ ...styles.selectedPlayerBanner, position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none', background: '#2a1414', boxShadow: '0 4px 14px rgba(0,0,0,0.45)', border: '1px solid rgba(224,80,80,0.5)' }}>
              🔒 <b>{hoveredPlayer.name}</b> não tem posição compatível com o esquema atual
            </div>
          ) : null}
        </div>
      )}

      <div style={isMobile ? mobileLayoutStyle : styles.draftLayout} className="draft-layout-grid">
        {/* No mobile: campo primeiro; no desktop: jogadores primeiro */}
        {isMobile && (
          <div style={pitchPanelStyle}>
            <Pitch
              pitch={pitch}
              pitchSlots={pitchSlots}
              highlightSlots={highlightSlots}
              previewSlots={previewSlots}
              onClickSlot={onClickPitchSlot}
              onUnplace={repositioningSlot === null ? onUnplacePlayer : undefined}
              myTeamColor={myTeamColor}
              captainSlot={captainSlot}
            />
          </div>
        )}

        {/* Jogadores */}
        <div className="draft-left" style={playersPanelStyle}>
          <div style={styles.teamHeaderCard}>
            {CLUB_LOGOS[rolledTeam.club]
              ? <img src={CLUB_LOGOS[rolledTeam.club]} style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }} alt={rolledTeam.club} />
              : <span style={{ fontSize: 20 }}>🎲</span>
            }
            <div>
              <div style={styles.rolledTeamLabel}>{rolledTeam.label}</div>
              <div style={styles.rolledTeamCoach}>Técnico: {rolledTeam.coach}</div>
            </div>
          </div>

          <div style={styles.playersList}>
            {sortedPlayers.map((p, i) => {
              const slots = eligibleSlotsForPlayer(p);
              const canPick = slots.length > 0;
              const blockedByFormation = !canPick && isPlayerBlockedByFormation(p);
              const isSelected = selectedPlayer?.name === p.name;
              return (
                <button
                  key={i}
                  onClick={() => canPick && onClickPlayer(p)}
                  onMouseEnter={() => handlePlayerHoverStart(p)}
                  onMouseLeave={() => handlePlayerHoverEnd(p)}
                  disabled={!canPick}
                  title={blockedByFormation ? 'Sem posição compatível nesse esquema — nem titular, nem banco' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 9,
                    border: '1px solid',
                    background: isSelected
                      ? 'rgba(127,217,154,0.1)'
                      : canPick ? 'rgba(255,255,255,0.03)' : 'transparent',
                    borderColor: isSelected
                      ? 'rgba(127,217,154,0.5)'
                      : canPick ? 'rgba(255,255,255,0.07)' : 'transparent',
                    opacity: canPick ? 1 : 0.3,
                    cursor: canPick ? 'pointer' : 'not-allowed',
                    color: '#F4F1EA',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.12s, border-color 0.12s',
                    marginBottom: 2,
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    background: isSelected ? 'rgba(127,217,154,0.2)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${POS_GROUP_COLOR[p.pos[0]] || 'rgba(255,255,255,0.15)'}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14,
                    color: ovrColor(p.ovr),
                  }}>
                    {p.ovr}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{
                      fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden',
                      textOverflow: 'ellipsis', lineHeight: 1.2,
                    }}>
                      {p.name}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 16 }}>
                      {p.pos.map((pos, pi) => {
                        const c = POS_GROUP_COLOR[pos] || '#d4a23c';
                        const isPrimary = pi === 0;
                        return (
                          <span key={pos} style={{
                            fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 800,
                            padding: '2px 6px', borderRadius: 4, letterSpacing: 0.4, lineHeight: 1.4,
                            background: isPrimary ? c : `${c}22`,
                            color: isPrimary ? '#0B1A12' : c,
                            border: isPrimary ? 'none' : `1px solid ${c}88`,
                          }}>{pos}</span>
                        );
                      })}
                      {blockedByFormation && (
                        <span style={{
                          fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 800,
                          padding: '2px 6px', borderRadius: 4, letterSpacing: 0.4, lineHeight: 1.4,
                          background: 'rgba(224,80,80,0.15)', color: '#e05050', border: '1px solid rgba(224,80,80,0.4)',
                        }}>🔒 FORA DO ESQUEMA</span>
                      )}
                    </div>
                  </div>
                  {isSelected && <span style={{ flexShrink: 0, fontSize: 16, color: '#7fd99a' }}>→</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Campo — só no desktop (mobile já renderizou acima) */}
        {!isMobile && (
          <div style={styles.draftRight}>
            <Pitch
              pitch={pitch}
              pitchSlots={pitchSlots}
              highlightSlots={highlightSlots}
              previewSlots={previewSlots}
              onClickSlot={onClickPitchSlot}
              onUnplace={repositioningSlot === null ? onUnplacePlayer : undefined}
              myTeamColor={myTeamColor}
              captainSlot={captainSlot}
            />
          </div>
        )}
      </div>
      <BenchDisplay
        pitch={pitch}
        pitchSlots={pitchSlots}
        myTeamColor={myTeamColor}
        highlightSlots={highlightSlots}
        previewSlots={previewSlots}
        onClickSlot={onClickPitchSlot}
        onUnplace={repositioningSlot === null ? onUnplacePlayer : undefined}
      />
    </div>
  );
}

function Squad({ pitch, pitchSlots, formationLabel, captainSlot, onSetCaptain, onConfirm, onRedo, myTeamColor, selectedPlayer, repositioningSlot, eligibleSlotsForPlayer, onClickPitchSlot, onUnplacePlayer }) {
  const starters = Object.values(pitch).filter(p => !p.isBench);
  const avgOvr = starters.length ? Math.round(starters.reduce((s, p) => s + p.ovr, 0) / starters.length) : 0;
  const effectiveOvr = Math.round((avgOvr + (captainSlot && !pitch[captainSlot]?.isBench ? 2 / starters.length : 0)) * 10) / 10;
  const starterSlots = pitchSlots.filter(s => !s.isBench).sort((a, b) => posOrderIndex(a.realPos) - posOrderIndex(b.realPos));
  const benchSlots = pitchSlots.filter(s => s.isBench);
  const highlightSlots = selectedPlayer ? eligibleSlotsForPlayer(selectedPlayer) : [];

  return (
    <div style={styles.card} className="card-mob">
      <div style={styles.eyebrow}>{formationLabel}</div>
      <h2 style={styles.h2}>OVR base: {avgOvr} · Efetivo: {effectiveOvr} (11 titulares)</h2>

      {selectedPlayer ? (
        <div style={styles.selectedPlayerBanner}>
          Mova <b>{selectedPlayer.name}</b> para outra posição — ou clique num jogador do campo/banco para cancelar
        </div>
      ) : (
        <div style={{
          textAlign: 'center', fontSize: 12, padding: '8px 12px',
          background: captainSlot ? 'rgba(212,162,60,0.1)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${captainSlot ? 'rgba(212,162,60,0.35)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 8, marginBottom: 10, color: captainSlot ? '#d4a23c' : 'rgba(255,255,255,0.5)',
        }}>
          {captainSlot
            ? `Capitao: ${pitch[captainSlot]?.name} — +2 OVR`
            : 'Toque em um titular para definir o capitao (bracadeira +2 OVR). Clique num jogador do campo/banco pra trocar de posição.'}
        </div>
      )}

      <Pitch
        pitch={pitch} pitchSlots={pitchSlots} myTeamColor={myTeamColor} captainSlot={captainSlot}
        highlightSlots={highlightSlots}
        onClickSlot={onClickPitchSlot}
        onUnplace={repositioningSlot === null ? onUnplacePlayer : undefined}
      />
      <BenchDisplay
        pitch={pitch} pitchSlots={pitchSlots} myTeamColor={myTeamColor}
        highlightSlots={highlightSlots}
        onClickSlot={onClickPitchSlot}
        onUnplace={repositioningSlot === null ? onUnplacePlayer : undefined}
      />

      <div style={styles.squadList}>
        {/* Titulares */}
        {starterSlots.map(slot => {
          const p = pitch[slot.key];
          if (!p) return null;
          const isCap = captainSlot === slot.key;
          return (
            <button
              key={slot.key}
              onClick={() => onSetCaptain(isCap ? null : slot.key)}
              className="squad-row-g"
              style={{
                ...styles.squadRow,
                cursor: 'pointer',
                background: isCap ? 'rgba(212,162,60,0.12)' : 'transparent',
                border: `1px solid ${isCap ? 'rgba(212,162,60,0.4)' : 'transparent'}`,
                borderRadius: 8,
                width: '100%',
                textAlign: 'left',
                color: '#F4F1EA',
              }}
            >
              <span style={{ ...styles.squadPos, color: isCap ? '#d4a23c' : undefined }}>
                {isCap ? 'C' : slot.label}
              </span>
              <span style={{ ...styles.squadName, fontWeight: isCap ? 700 : 400 }}>{p.name}</span>
              <span style={styles.squadTeam}>{p.teamLabel}</span>
              <span style={{ ...styles.squadOvr, color: isCap ? '#d4a23c' : undefined }}>
                {isCap ? `${p.ovr} +2` : p.ovr}
              </span>
            </button>
          );
        })}
        {/* Banco */}
        {benchSlots.some(s => pitch[s.key]) && (
          <>
            <div style={{ fontSize: 11, opacity: 0.4, padding: '8px 0 4px', fontFamily: "'Space Mono', monospace" }}>BANCO</div>
            {benchSlots.map(slot => {
              const p = pitch[slot.key];
              if (!p) return null;
              return (
                <div key={slot.key} style={{ ...styles.squadRow, opacity: 0.7 }}>
                  <span style={styles.squadPos}>{p.pos[0]}</span>
                  <span style={styles.squadName}>{p.name}</span>
                  <span style={styles.squadTeam}>{p.teamLabel}</span>
                  <span style={styles.squadOvr}>{p.ovr}</span>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div style={styles.btnRow}>
        {onRedo && <button style={styles.btnGhost} onClick={onRedo}>Trocar formacao</button>}
        <button
          style={{ ...styles.btnPrimary, opacity: (captainSlot && repositioningSlot === null) ? 1 : 0.6 }}
          onClick={onConfirm}
          disabled={!captainSlot || repositioningSlot !== null}
          title={
            repositioningSlot !== null
              ? 'Termine de reposicionar o jogador primeiro'
              : captainSlot ? '' : 'Escolha um capitao primeiro'
          }
        >
          {repositioningSlot !== null ? 'Reposicionando…' : captainSlot ? 'Disputar ->' : 'Escolha um capitao'}
        </button>
      </div>
    </div>
  );
}

// Mercado de transferências entre temporadas: libera até 2 jogadores do
// elenco pra sortear substitutos (reaproveita o dado do draft original,
// só que preenchendo apenas as vagas liberadas — sem orçamento).
function TransferMarket({ pitch, pitchSlots, myTeamColor, onConfirm }) {
  const mc = myTeamColor || '#d4a23c';
  const [releasedKeys, setReleasedKeys] = useState([]);
  const starterSlots = pitchSlots.filter(s => !s.isBench).sort((a, b) => posOrderIndex(a.realPos) - posOrderIndex(b.realPos));
  const benchSlots = pitchSlots.filter(s => s.isBench);

  const toggle = (key) => {
    setReleasedKeys(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      if (prev.length >= 2) return prev;
      return [...prev, key];
    });
  };

  const renderRow = (slot) => {
    const p = pitch[slot.key];
    if (!p) return null;
    const isReleased = releasedKeys.includes(slot.key);
    return (
      <button
        key={slot.key}
        onClick={() => toggle(slot.key)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
          padding: '9px 12px', borderRadius: 9, marginBottom: 4,
          border: `1px solid ${isReleased ? 'rgba(224,80,80,0.5)' : 'rgba(255,255,255,0.07)'}`,
          background: isReleased ? 'rgba(224,80,80,0.12)' : 'rgba(255,255,255,0.03)',
          color: '#F4F1EA', cursor: 'pointer',
        }}
      >
        <span style={{ width: 34, fontSize: 11, opacity: 0.6, fontFamily: "'Space Mono', monospace" }}>{slot.realPos === 'bench' ? (p.pos?.[0] || '-') : slot.realPos}</span>
        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, textDecoration: isReleased ? 'line-through' : 'none', opacity: isReleased ? 0.6 : 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: ovrColor(p.ovr), flexShrink: 0 }}>{p.ovr}</span>
        {isReleased && <span style={{ color: '#e05050', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>LIBERADO</span>}
      </button>
    );
  };

  return (
    <div style={styles.card} className="card-mob">
      <div style={styles.eyebrow}>Mercado de Transferências</div>
      <h2 style={styles.h2}>Libere até 2 jogadores pra sortear substitutos</h2>
      <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 16, lineHeight: 1.5 }}>
        Toque em quem você quer dispensar (até 2, titular ou banco). Pra cada um, você volta a rolar o dado igual no draft original até achar alguém pra vaga. Sem orçamento — é troca direta.
      </p>

      <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Titulares</div>
      {starterSlots.map(renderRow)}
      <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1, margin: '14px 0 6px' }}>Banco</div>
      {benchSlots.map(renderRow)}

      <button
        style={{ ...styles.btnPrimary, marginTop: 20, width: '100%', background: mc, color: '#0B1A12' }}
        onClick={() => onConfirm(releasedKeys)}
      >
        {releasedKeys.length === 0
          ? 'Manter elenco e seguir →'
          : `Liberar ${releasedKeys.length} e sortear substituto${releasedKeys.length > 1 ? 's' : ''} →`}
      </button>
    </div>
  );
}

// ============================================================
// COMPONENTE: Resumo da partida (placar + notas) — abre sozinho assim que
// o jogo do usuário termina, em vez de ficar escondido atrás de um link lá
// embaixo depois de toda a tabela/estatísticas da liga.
// ============================================================
function MatchSummaryModal({ ratings, match, score, homeTeam, awayTeam, myTeamId, myTeamColor, onDismiss }) {
  const mc = myTeamColor || '#d4a23c';
  if (!ratings?.length || !match) return null;
  const homeRatings = [...ratings].filter(r => r.teamId === match.homeId).sort((a, b) => b.rating - a.rating);
  const awayRatings = [...ratings].filter(r => r.teamId === match.awayId).sort((a, b) => b.rating - a.rating);
  const motm = [...ratings].sort((a, b) => b.rating - a.rating)[0];

  const col = (list, side, teamLabel) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: side === 'away' ? 'right' : 'left', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teamLabel}</div>
      {list.map((r, i) => (
        <div key={`${r.name}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12.5, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: side === 'away' ? 'right' : 'left', flex: 1 }}>{r.name}</span>
          <span style={{
            fontFamily: "'Space Mono', monospace", fontWeight: 700, flexShrink: 0,
            color: r.rating >= 7.5 ? '#7fd99a' : r.rating < 5.5 ? '#e0593f' : '#F4F1EA',
          }}>{r.rating.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0F2318', border: `1px solid ${hexToRgba(mc, 0.35)}`, borderRadius: 16, padding: 22, width: '100%', maxWidth: 460, maxHeight: '86vh', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.6, marginBottom: 6 }}>Fim de jogo</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 17 }}>
            <span className="match-summary-header-team" style={{ flex: 1, minWidth: 0, textAlign: 'right', color: match.homeId === myTeamId ? mc : '#F4F1EA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{homeTeam?.label || '?'}</span>
            <span style={{ fontFamily: "'Space Mono', monospace", background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '4px 12px', flexShrink: 0 }}>{score?.homeGoals ?? 0} - {score?.awayGoals ?? 0}</span>
            <span className="match-summary-header-team" style={{ flex: 1, minWidth: 0, textAlign: 'left', color: match.awayId === myTeamId ? mc : '#F4F1EA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{awayTeam?.label || '?'}</span>
          </div>
        </div>

        {motm && (
          <div style={{ textAlign: 'center', background: hexToRgba(mc, 0.1), border: `1px solid ${hexToRgba(mc, 0.3)}`, borderRadius: 10, padding: '8px 12px', marginBottom: 14, fontSize: 13 }}>
            🌟 Craque da partida: <b style={{ color: mc }}>{motm.name}</b> <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>{motm.rating.toFixed(1)}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16 }} className="match-summary-cols">
          {col(homeRatings, 'home', homeTeam?.label)}
          {col(awayRatings, 'away', awayTeam?.label)}
        </div>

        <button onClick={onDismiss} style={{ ...styles.btnPrimary, marginTop: 18, width: '100%', background: mc, color: '#0B1A12' }}>
          Continuar →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE: Modal de Pênaltis Interativo
// ============================================================
// `auto`: modo automático — a disputa se resolve sozinha (escolhe o cobrador e
// fecha no fim), senão o modo automático parava de vez na primeira decisão por
// pênaltis esperando um clique que nunca vinha.
function PenaltyModal({ penaltyPhase, onDismiss, myTeamColor, auto = false }) {
  const mc = myTeamColor || '#d4a23c';
  const [inner, setInner] = React.useState(() => ({
    kickNum: 0,     // 0,1,...: even=home, odd=away
    // A cobrança 0 é sempre do time da casa — se eu sou o visitante, quem
    // bate primeiro é o adversário (antes isso vinha fixo em 'pick', me
    // deixando escolher cobrador pra uma cobrança que não era minha).
    phase: penaltyPhase?.myIsHome === false ? 'auto_kick' : 'pick',
    countdown: null,
    takerName: null,
    lastResult: null,
    myGoals: 0,
    opGoals: 0,
    myKickResults: [],
    opKickResults: [],
  }));
  const tiRef = React.useRef(null);

  if (!penaltyPhase) return null;
  const { kicks, winner, myIsHome, myTeamLabel, oppTeamLabel, myGkName, oppGkName, myPlayers } = penaltyPhase;

  const { kickNum, phase, countdown, takerName, lastResult, myGoals, opGoals, myKickResults, opKickResults } = inner;

  // Is this kick (by kickNum) my team's kick?
  const pairIdx = Math.floor(kickNum / 2);
  const isHomeKick = kickNum % 2 === 0;
  const isMyKick = myIsHome ? isHomeKick : !isHomeKick;

  const currentKickPair = kicks[pairIdx];

  const clearT = () => { if (tiRef.current) clearTimeout(tiRef.current); };

  const getResultText = (scored, isMine) => {
    if (scored) return isMine ? 'GOOOOOL! ⚽' : 'GOL ⚽';
    const r = Math.random();
    // Quem defende é sempre o goleiro do OUTRO lado de quem está cobrando —
    // se sou eu cobrando, quem pode ter defendido é o goleiro adversário, e
    // vice-versa (antes o goleiro citado era sempre o mesmo, do lado errado).
    if (r < 0.35) return `DEFENDE O ${isMine ? oppGkName : myGkName}! 🧤`;
    if (r < 0.65) return isMine ? 'ISOLOOOOU! 😩' : 'ISOLOU';
    return isMine ? 'ERROOOOU! 😱' : 'ERROU';
  };

  const resolveKick = (taker) => {
    if (!currentKickPair) { advanceKick(null); return; }
    const scored = isHomeKick ? currentKickPair.a : currentKickPair.b;
    const resultText = getResultText(scored, isMyKick);
    const newMy = isMyKick ? myGoals + (scored ? 1 : 0) : myGoals;
    const newOp = !isMyKick ? opGoals + (scored ? 1 : 0) : opGoals;
    const newMyK = isMyKick ? [...myKickResults, { scored, name: taker }] : myKickResults;
    const newOpK = !isMyKick ? [...opKickResults, { scored }] : opKickResults;
    hapticPulse(scored ? (isMyKick ? HAPTIC.goal : HAPTIC.concede) : HAPTIC.penaltyMiss);
    setInner(p => ({ ...p, phase: 'result', takerName: taker, lastResult: { scored, scorer: taker, isMyKick, resultText }, myGoals: newMy, opGoals: newOp, myKickResults: newMyK, opKickResults: newOpK }));
    clearT();
    tiRef.current = setTimeout(() => advanceKick({ myGoals: newMy, opGoals: newOp, myK: newMyK, opK: newOpK }), 2200);
  };

  const advanceKick = (scores) => {
    clearT();
    const nextKickNum = kickNum + 1;
    const nextPairIdx = Math.floor(nextKickNum / 2);
    if (nextPairIdx >= kicks.length) {
      setInner(p => ({ ...p, phase: 'done' }));
      return;
    }
    const nextIsHome = nextKickNum % 2 === 0;
    const nextIsMyKick = myIsHome ? nextIsHome : !nextIsHome;
    setInner(p => ({
      ...p,
      kickNum: nextKickNum,
      phase: nextIsMyKick ? 'pick' : 'auto_kick',
      countdown: null, takerName: null, lastResult: null,
      myGoals: scores?.myGoals ?? p.myGoals,
      opGoals: scores?.opGoals ?? p.opGoals,
      myKickResults: scores?.myK ?? p.myKickResults,
      opKickResults: scores?.opK ?? p.opKickResults,
    }));
  };

  // Auto-kick for opponent
  React.useEffect(() => {
    if (inner.phase !== 'auto_kick') return;
    clearT();
    tiRef.current = setTimeout(() => startCountdown('auto'), 500);
    return clearT;
  }, [inner.phase, kickNum]);

  React.useEffect(() => () => clearT(), []);

  const startCountdown = (taker) => {
    setInner(p => ({ ...p, phase: 'countdown', countdown: 3, takerName: taker }));
  };

  React.useEffect(() => {
    if (inner.phase !== 'countdown' || inner.countdown === null) return;
    if (inner.countdown === 0) {
      resolveKick(inner.takerName);
      return;
    }
    clearT();
    tiRef.current = setTimeout(() => setInner(p => ({ ...p, countdown: (p.countdown || 1) - 1 })), 1000);
    return clearT;
  }, [inner.phase, inner.countdown]);

  // Quem ainda pode cobrar: quem já bateu só volta pra fila depois que todo
  // mundo cobrou uma vez, como na disputa de verdade.
  const availableKickers = () => {
    const usedNames = new Set(myKickResults.map(r => r.name));
    return (usedNames.size >= (myPlayers || []).length
      ? (myPlayers || [])
      : (myPlayers || []).filter(p => !usedNames.has(p.name))
    ).slice().sort((a, b) => posOrderIndex(a.pos?.[0]) - posOrderIndex(b.pos?.[0]));
  };

  // No modo automático ninguém escolhe o cobrador — a disputa se resolve
  // sozinha (o melhor batedor disponível vai à marca). Sem isso, o modo
  // automático parava de vez na primeira decisão por pênaltis, esperando um
  // clique que nunca vinha.
  React.useEffect(() => {
    if (!auto || inner.phase !== 'pick') return;
    const list = availableKickers();
    if (list.length === 0) return;
    const best = list.reduce((a, b) => ((b.ovr || 0) > (a.ovr || 0) ? b : a), list[0]);
    const t = setTimeout(() => startCountdown(best.name), 700);
    return () => clearTimeout(t);
  }, [auto, inner.phase, kickNum]);

  // ...e ninguém fecha o resultado da disputa no fim, pelo mesmo motivo.
  React.useEffect(() => {
    if (!auto || inner.phase !== 'done') return;
    const t = setTimeout(() => onDismiss?.(), 2200);
    return () => clearTimeout(t);
  }, [auto, inner.phase, onDismiss]);

  const startKickersName = () => {
    if (inner.phase !== 'pick') return null;
    const availablePlayers = availableKickers();
    if (auto) {
      return (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: mc, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>{myTeamLabel}</div>
          <div>Escolhendo o cobrador...</div>
        </div>
      );
    }
    return (
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: mc, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>Escolha o cobrador</div>
        {availablePlayers.map((p, i) => (
          <button key={i} onClick={() => startCountdown(p.name)} style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 7, color: '#F4F1EA', fontFamily: "'Space Mono',monospace",
            fontSize: 12, cursor: 'pointer', marginBottom: 4,
          }}>
            {p.name} <span style={{ opacity: 0.5, fontSize: 10 }}>{(p.pos || []).join('/')}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderKickDots = (results, isMe) => (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {results.map((r, i) => (
        <span key={i} style={{ fontSize: 16, lineHeight: 1 }}>{r.scored ? '🟢' : '🔴'}</span>
      ))}
    </div>
  );

  const isSuddenDeath = kicks[pairIdx]?.suddenDeath;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(5,15,8,0.92)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
    }}>
      {/* Header */}
      <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 22, fontWeight: 700, color: '#F4F1EA', marginBottom: 4, textAlign: 'center' }}>
        ⚽ Disputa de Pênaltis
        {isSuddenDeath && <span style={{ fontSize: 12, color: '#e05050', marginLeft: 8 }}>MORTE SÚBITA</span>}
      </div>

      {/* Score */}
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 28, fontWeight: 700, color: mc, marginBottom: 16, letterSpacing: 2 }}>
        {myGoals} – {opGoals}
      </div>

      {/* Team labels with kick dots */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 400, marginBottom: 16 }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{myTeamLabel}</div>
          {renderKickDots(myKickResults, true)}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{oppTeamLabel}</div>
          {renderKickDots(opKickResults, false)}
        </div>
      </div>

      {/* Main interaction area */}
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'rgba(255,255,255,0.04)', borderRadius: 14,
        padding: '18px 16px', minHeight: 140,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        {phase === 'pick' && startKickersName()}

        {(phase === 'auto_kick') && (
          <div style={{ textAlign: 'center', fontSize: 14, opacity: 0.7 }}>
            <div style={{ fontSize: 11, color: mc, marginBottom: 6 }}>{oppTeamLabel}</div>
            <div>Preparando cobrança...</div>
          </div>
        )}

        {phase === 'countdown' && (
          <div style={{ textAlign: 'center' }}>
            {takerName && takerName !== 'auto' && (
              <div style={{ fontSize: 13, color: mc, marginBottom: 12, fontWeight: 700 }}>{takerName}</div>
            )}
            {takerName === 'auto' && (
              <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 12 }}>{oppTeamLabel}</div>
            )}
            <div style={{
              fontSize: countdown === 1 ? 72 : countdown === 2 ? 64 : 56,
              fontFamily: "'Fraunces',Georgia,serif", fontWeight: 700,
              color: countdown === 1 ? '#e05050' : countdown === 2 ? '#d4a23c' : '#F4F1EA',
              lineHeight: 1, transition: 'font-size 0.15s',
            }}>{countdown}</div>
          </div>
        )}

        {phase === 'result' && lastResult && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: lastResult.scored ? 28 : 22, fontWeight: 700,
              color: lastResult.scored && lastResult.isMyKick ? '#7fd99a'
                : !lastResult.scored && !lastResult.isMyKick ? '#7fd99a' : '#e05050',
              fontFamily: "'Fraunces',Georgia,serif",
              marginBottom: 6,
            }}>{lastResult.resultText}</div>
            {lastResult.scorer && lastResult.scorer !== 'auto' && (
              <div style={{ fontSize: 12, opacity: 0.6 }}>{lastResult.scorer}</div>
            )}
          </div>
        )}

        {phase === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: mc, fontFamily: "'Fraunces',Georgia,serif", marginBottom: 8 }}>
              {winner === '__myteam__' ? '🏆 Classificado nos pênaltis!' : '💔 Eliminado nos pênaltis'}
            </div>
            <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
              {myTeamLabel} {myGoals} × {opGoals} {oppTeamLabel}
            </div>
            <button onClick={onDismiss} style={{
              fontFamily: "'Space Mono',monospace", fontSize: 13, fontWeight: 700,
              padding: '10px 28px', borderRadius: 10, border: 'none',
              background: mc, color: '#0B1A12', cursor: 'pointer',
            }}>Continuar →</button>
          </div>
        )}
      </div>

      {/* Round indicator */}
      {phase !== 'done' && (
        <div style={{ marginTop: 12, fontSize: 11, opacity: 0.45, fontFamily: "'Space Mono',monospace" }}>
          {isSuddenDeath ? 'MORTE SÚBITA' : `Cobrança ${pairIdx + 1} de ${kicks.length}`} · {isMyKick ? myTeamLabel : oppTeamLabel}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TELA DE JOGO: liga com cronômetro e tabela
// ============================================================
// Toast de conquista desbloqueada — some sozinho depois de alguns segundos.
function AchievementToast({ achievements, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [achievements, onClose]);
  return (
    <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {achievements.map(id => {
        const a = ACHIEVEMENT_CATALOG[id];
        if (!a) return null;
        return (
          <div key={id} onClick={onClose} style={{
            background: 'rgba(11,26,18,0.97)', border: '1px solid rgba(212,162,60,0.5)', borderRadius: 12,
            padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)', minWidth: 240,
          }}>
            <span style={{ fontSize: 24 }}>{a.icon}</span>
            <div>
              <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1, color: '#d4a23c' }}>Conquista desbloqueada</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F4F1EA' }}>{a.label}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{a.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const LEADERBOARD_PAGE_SIZE = 30;

// Ranking global — busca no backend ao abrir, público (não exige login pra
// ver). Paginado com "carregar mais" (dá pra ver todo mundo, não só um top
// fixo), filtrável por UF e por escudo do time, e com um botão "Ver minha
// classificação" que pula direto pra posição do jogador (com uma animação de
// contagem rápida até o número real, tipo velocímetro) e destaca a linha dele.
// Explicação da pontuação, dentro do próprio ranking — é onde a pergunta
// nasce ("por que fulano está na minha frente?"). Fechada por padrão pra não
// empurrar a tabela pra baixo de quem só quer ver as posições.
// Os números aqui espelham o cálculo do servidor em routes/me.ts
// (POST /me/season-result): mexeu lá, mexe aqui.
function PontosDoRanking() {
  const [aberto, setAberto] = useState(false);
  const linha = (oQue, quanto) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
      <span style={{ flex: 1, minWidth: 0 }}>{oQue}</span>
      <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: '#d4a23c', whiteSpace: 'nowrap' }}>{quanto}</span>
    </div>
  );
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setAberto(a => !a)}
        className="tap-target-sm"
        style={{ background: 'none', border: 'none', minHeight: 34, color: '#d4a23c', fontFamily: "'Space Mono', monospace", fontSize: 11.5, cursor: 'pointer', padding: '4px 0' }}
      >
        {aberto ? 'v' : '>'} Como funcionam os pontos
      </button>
      {aberto && (
        <div style={{ fontSize: 12, lineHeight: 1.55, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', marginTop: 4 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.5, marginBottom: 6 }}>1 · Campanha</div>
          {linha('Campeão do Brasileirão', '50 pts')}
          {linha('Campeão da Copa do Brasil', '40 pts')}
          {linha('Brasileirão, do 2º ao 15º lugar', '19 a 6 pts')}
          {linha('Do 16º pra baixo, ou Copa sem título', '5 pts')}

          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.5, margin: '10px 0 6px' }}>2 · Dificuldade (multiplica a campanha)</div>
          {Object.entries(DIFFICULTY_LEVELS).map(([k, lv]) => linha(lv.label, DIFFICULTY_UI[k].mult))}

          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.5, margin: '10px 0 6px' }}>3 · Gols (valem igual em toda dificuldade)</div>
          {linha('Cada gol que seu time marcou', '+1 pt')}
          {linha('Cada gol que seu time sofreu', '−1 pt')}

          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', opacity: 0.8 }}>
            Exemplo: campeão do Brasileirão no <b>Difícil</b>, com 60 gols marcados e 47 sofridos:{' '}
            <b style={{ color: '#d4a23c' }}>50 × 1,75 + 60 − 47 = 101 pts</b>. O mesmo título no Fácil daria 38.
          </div>
          <div style={{ marginTop: 8, opacity: 0.8 }}>
            Numa temporada de 38 rodadas os gols pesam mais que a colocação — quem ataca sobe,
            quem leva goleada desce. Uma campanha ruim pode render <b>saldo negativo</b> e
            derrubar seus pontos. Os totais somam de uma temporada pra outra.
          </div>
          <div style={{ marginTop: 8, opacity: 0.8 }}>
            É por isso que o Lendário compensa: lá a IA joga muito acima do papel, o título é raro
            e vale o triplo. No Fácil o título sai fácil e vale metade.
          </div>
          <div style={{ marginTop: 8, opacity: 0.8 }}>
            Empatou? Fica na frente quem tem mais títulos do Brasileirão; depois, mais títulos de Copa.
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, opacity: 0.6 }}>
            Só entra no ranking quem termina a temporada <b>logado</b>. Como convidado nada é registrado.
          </div>
        </div>
      )}
    </div>
  );
}

const RANKING_PERIODS = [
  { id: 'geral', label: 'Geral' },
  { id: 'monthly', label: 'Mensal' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'daily', label: 'Diário' },
];

// Ranking global — página própria (URL /ranking, não modal), pública (não
// exige login pra ver). 4 abas de período: geral (ranking_points vitalício)
// ou diário/semanal/mensal (soma de ranking_events dentro da janela — só
// aparece quem pontuou alguma coisa nela). Paginado com "carregar mais" (dá
// pra ver todo mundo, não só um top fixo), filtrável por UF e por escudo do
// time, e com um botão "Ver minha classificação" que pula direto pra posição
// do jogador (com uma animação de contagem rápida até o número real, tipo
// velocímetro) e destaca a linha dele.
function RankingPage({ onBack, myUsername, myTeamColor }) {
  const mc = myTeamColor || '#d4a23c';
  const [period, setPeriod] = useState('geral');
  const [rows, setRows] = useState(null);
  const [baseOffset, setBaseOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [uf, setUf] = useState('');
  const [logo, setLogo] = useState('');
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [finding, setFinding] = useState(false);
  const [findDisplay, setFindDisplay] = useState(1);
  const [notRanked, setNotRanked] = useState(false);
  const [highlightRank, setHighlightRank] = useState(null);
  const rowRefs = useRef({});

  const load = (reset, offset, overrides = {}) => {
    const effectiveUf = 'uf' in overrides ? overrides.uf : uf;
    const effectiveLogo = 'logo' in overrides ? overrides.logo : logo;
    const effectivePeriod = 'period' in overrides ? overrides.period : period;
    api.fetchLeaderboard({ limit: LEADERBOARD_PAGE_SIZE, offset, uf: effectiveUf, logo: effectiveLogo, period: effectivePeriod })
      .then(({ leaderboard, total: t, hasMore: hm }) => {
        setRows(prev => reset || !prev ? leaderboard : [...prev, ...leaderboard]);
        if (reset) setBaseOffset(offset);
        setTotal(t);
        setHasMore(hm);
        setError('');
      })
      .catch(() => setError('Não foi possível carregar o ranking agora.'))
      .finally(() => setLoadingMore(false));
  };

  useEffect(() => {
    load(true, 0, { uf: '', logo: '', period });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (nextUf, nextLogo) => {
    setUf(nextUf);
    setLogo(nextLogo);
    setHighlightRank(null);
    setNotRanked(false);
    setRows(null);
    load(true, 0, { uf: nextUf, logo: nextLogo, period });
  };

  const changePeriod = (nextPeriod) => {
    if (nextPeriod === period) return;
    setPeriod(nextPeriod);
    setUf('');
    setLogo('');
    setHighlightRank(null);
    setNotRanked(false);
    setRows(null);
    load(true, 0, { uf: '', logo: '', period: nextPeriod });
  };

  const loadMore = () => {
    setLoadingMore(true);
    load(false, baseOffset + (rows?.length || 0));
  };

  // "Efeito de velocidade": conta rápido do 1 até a colocação real (com
  // desaceleração no final), depois busca a janela do ranking em volta dela
  // e rola/realça a linha do jogador — sem filtro nenhum ativo, é sobre o
  // recorte inteiro daquele período, não faria sentido misturar com uma
  // fatia filtrada. Num período (não geral), quem não pontuou nada ali
  // simplesmente não tem posição — `rank` vem null, sem número pra animar.
  const findMe = async () => {
    if (finding) return;
    setError('');
    try {
      const { rank } = await api.fetchMyRank({ period });
      if (rank == null) {
        setNotRanked(true);
        return;
      }
      setNotRanked(false);
      setFinding(true);
      setFindDisplay(1);
      const startedAt = performance.now();
      const DURATION = 900;
      const animate = (now) => {
        const t = Math.min(1, (now - startedAt) / DURATION);
        const eased = 1 - Math.pow(1 - t, 3);
        setFindDisplay(Math.max(1, Math.round(1 + (rank - 1) * eased)));
        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          setFinding(false);
          setUf('');
          setLogo('');
          setHighlightRank(rank);
          setRows(null);
          load(true, Math.max(0, rank - 4), { uf: '', logo: '', period });
        }
      };
      requestAnimationFrame(animate);
    } catch {
      setError('Não foi possível buscar sua classificação agora.');
    }
  };

  useEffect(() => {
    if (highlightRank == null || !rows) return;
    const el = rowRefs.current[highlightRank];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setHighlightRank(null), 2500);
    return () => clearTimeout(t);
  }, [rows, highlightRank]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10000, overflowY: 'auto', padding: '70px 16px 40px' }}>
      <button
        onClick={onBack}
        title="Voltar pro app"
        style={{
          position: 'fixed', top: 14, left: 14, zIndex: 10001,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(15,31,21,0.95)', border: `1px solid ${hexToRgba(mc, 0.4)}`,
          borderRadius: 999, padding: '8px 14px', color: mc,
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        ← Voltar pro app
      </button>
      <div style={{ width: '100%', maxWidth: 640, margin: '0 auto', background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: mc, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>🏆 Ranking Global</div>
        <GameStatsBar style={{ fontSize: 11, opacity: 0.6, marginBottom: 14 }} />

        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {RANKING_PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => changePeriod(p.id)}
              aria-pressed={period === p.id}
              style={{
                flex: '1 1 0%', minWidth: 76, padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${period === p.id ? mc : 'rgba(255,255,255,0.12)'}`,
                background: period === p.id ? hexToRgba(mc, 0.12) : 'rgba(255,255,255,0.03)',
                color: period === p.id ? mc : '#F4F1EA', fontWeight: 700, fontSize: 13,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period !== 'geral' && (
          <div style={{ fontSize: 11.5, opacity: 0.55, marginBottom: 14, lineHeight: 1.4 }}>
            {period === 'daily' && 'Pontos de campanha ganhos nas últimas 24h.'}
            {period === 'weekly' && 'Pontos de campanha ganhos nos últimos 7 dias.'}
            {period === 'monthly' && 'Pontos de campanha ganhos nos últimos 30 dias.'}
            {' '}Só entra quem terminou alguma temporada logado nessa janela.
          </div>
        )}

        <PontosDoRanking />

        {finding ? (
          <div style={{ textAlign: 'center', padding: '34px 0' }}>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Buscando sua posição...</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 42, fontWeight: 700, color: mc }}>#{findDisplay}</div>
          </div>
        ) : (
          <>
            {myUsername && (
              <button
                onClick={findMe}
                style={{
                  width: '100%', marginBottom: 12, padding: '9px 0', borderRadius: 8,
                  background: hexToRgba(mc, 0.14), border: `1px solid ${hexToRgba(mc, 0.4)}`,
                  color: mc, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                }}
              >
                📍 Ver minha classificação
              </button>
            )}
            {notRanked && (
              <div style={{ fontSize: 12.5, opacity: 0.7, textAlign: 'center', marginBottom: 12, padding: '8px 0' }}>
                Você ainda não pontuou nesse período — termine uma temporada logado pra entrar.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select
                value={uf}
                onChange={e => applyFilters(e.target.value, logo)}
                style={{ ...styles.teamInput, flex: 1 }}
              >
                <option value="" style={styles.selectOption}>Todos os estados</option>
                {BRAZIL_UFS.map(([code, label]) => (
                  <option key={code} value={code} style={styles.selectOption}>{code} — {label}</option>
                ))}
              </select>
              <select
                value={logo}
                onChange={e => applyFilters(uf, e.target.value)}
                style={{ ...styles.teamInput, flex: 1 }}
              >
                <option value="" style={styles.selectOption}>Todos os escudos</option>
                {Object.entries(CLUB_LOGOS).map(([club, url]) => (
                  <option key={club} value={url} style={styles.selectOption}>{club.replace(/-/g, ' ')}</option>
                ))}
              </select>
            </div>

            {error && <div style={{ fontSize: 13, opacity: 0.6 }}>{error}</div>}
            {!error && !rows && <div style={{ fontSize: 13, opacity: 0.6 }}>Carregando...</div>}
            {rows && rows.length === 0 && (
              <div style={{ fontSize: 13, opacity: 0.6 }}>
                {uf || logo ? 'Ninguém com esse filtro no ranking ainda.' : 'Ninguém no ranking ainda — jogue uma temporada logado pra entrar!'}
              </div>
            )}
            {rows && rows.length > 0 && (
              <div style={{ fontSize: 10.5, opacity: 0.45, marginBottom: 4 }}>{total} {total === 1 ? 'jogador' : 'jogadores'}{uf ? ` em ${uf}` : ''}</div>
            )}
            {rows && rows.map((r, i) => {
              const rank = baseOffset + i + 1;
              const isMe = r.username === myUsername;
              const isHighlighted = rank === highlightRank;
              return (
                <div
                  key={r.username}
                  ref={el => { rowRefs.current[rank] = el; }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 6px',
                    borderRadius: 8,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontWeight: isMe ? 700 : 400,
                    color: isMe ? mc : '#F4F1EA',
                    background: isHighlighted ? hexToRgba(mc, 0.18) : 'transparent',
                    transition: 'background 0.4s ease',
                  }}
                >
                  <span style={{ width: 26, textAlign: 'right', opacity: 0.5, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{rank}.</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{r.username}</span>
                  {r.team_uf && !uf && <span style={{ fontSize: 10, opacity: 0.5, fontFamily: "'Space Mono', monospace" }}>{r.team_uf}</span>}
                  <span style={{ fontSize: 11, opacity: 0.6 }}>🏆{r.titles_brasileirao + r.titles_copa}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13 }}>{r.ranking_points} pts</span>
                </div>
              );
            })}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  width: '100%', marginTop: 12, padding: '9px 0', borderRadius: 8,
                  background: hexToRgba(mc, 0.1), border: `1px solid ${hexToRgba(mc, 0.3)}`,
                  color: mc, fontSize: 12.5, fontWeight: 600, cursor: loadingMore ? 'default' : 'pointer',
                  opacity: loadingMore ? 0.6 : 1,
                }}
              >
                {loadingMore ? 'Carregando...' : 'Carregar mais'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Changelog resumido, mais recente primeiro — o botão 💡 no header mostra um
// ponto vermelho enquanto `id` do primeiro item aqui for diferente do último
// visto (guardado em localStorage). Atualize essa lista a cada leva de
// novidades relevante pro jogador (não precisa registrar todo commit interno).
const WHATS_NEW = [
  {
    id: '2026-08-desafio-do-dia-pontos',
    date: 'Agosto de 2026',
    title: 'Desafio do Dia agora vale ranking — e só dá pra jogar 1x por dia',
    desc: 'Vencer o Desafio do Dia agora soma +50 pontos direto no seu ranking global (pra quem tem conta) — antes era só uma partida avulsa, sem nenhum efeito fora dela. Em troca, agora só dá pra jogar o desafio uma vez por dia: depois de confirmar a escalação, o confronto de hoje fica marcado como usado até virar a data (mesmo desistindo ou perdendo no meio). O atalho pra ele também apareceu de novo no rodapé da home, além do cabeçalho.',
  },
  {
    id: '2026-08-ranking-periodos',
    date: 'Agosto de 2026',
    title: 'Ranking Global ganha página própria e 4 períodos',
    desc: 'O Ranking Global deixou de ser um modal pequeno e virou uma página inteira (com URL própria, /ranking) — mais espaço pra ver a lista. E agora tem 4 abas: Geral (o total de sempre), Mensal, Semanal e Diário — cada um mostra só quem pontuou alguma campanha logada dentro daquela janela de tempo. De brinde, o cabeçalho ficou menos apertado: "Continuar" e "Desafio do Dia" saíram do corpo da home e foram pra lá, ao lado dos ícones de compartilhar/áudio/ranking/novidades — que em telas bem largas agora mostram o nome ao lado do ícone.',
  },
  {
    id: '2026-08-time-pronto',
    date: 'Agosto de 2026',
    title: 'Novo atalho: jogar direto com um time histórico pronto',
    desc: 'Não quer sortear? Agora dá pra pular o draft inteiro e jogar com o elenco real de um dos 100 times históricos, titulares e banco já escalados — seu nome, escudo e cor continuam os seus, só o time em campo muda. A escalação escolhida é sempre a que mais soma overall entre os 16 do elenco, então ninguém fraco entra só por sorte de posição enquanto um craque melhor fica no banco. É só clicar em "Já sei qual time eu quero" na escolha de esquema tático (funciona também nas salas com amigos), ou entrar em "Times Históricos" e clicar em "Jogar com este time" na página de qualquer clube.',
  },
  {
    id: '2026-08-serie-ab',
    date: 'Agosto de 2026',
    title: 'O Brasileirão agora é Série A e B',
    desc: 'O modo "Brasileirão" avulso saiu de cena: agora é direto Série A e B, com 40 times sorteados desde o início (20 em cada divisão), no solo e também nas salas com amigos. No fim de cada temporada, os 2 últimos colocados da Série A caem e os 2 primeiros da Série B sobem direto — quem fica entre 3º e 6º na Série B disputa um mata-mata de acesso, ida e volta. A divisão em que você está persiste de uma temporada pra outra, e o ranking global agora também reflete isso: pontos de campanha na Série B valem metade dos da Série A.',
  },
  {
    id: '2026-08-100-times',
    date: 'Agosto de 2026',
    title: 'Adição: 100 times históricos no draft (era 56)',
    desc: 'O draft quase dobrou de tamanho: são 100 elencos e 2.000 jogadores, e agora a linha do tempo começa de verdade em 1959. Entraram as eras que faltavam — o Santos de Pelé (1961, 62 e 63), a Academia do Palmeiras, o Botafogo de Gérson e Jairzinho, o Fluminense de 1970, o Inter de Falcão e Figueroa, o Vasco de Roberto Dinamite, o Cruzeiro de 1966 e muito mais. Como são mais times na roleta, cada draft fica mais variado e montar um elenco de OVR alto ficou mais fácil: os craques da era clássica estão entre os melhores do jogo.',
  },
  {
    id: '2026-08-chaveamento-copa',
    date: 'Agosto de 2026',
    title: 'Adição: chaveamento da Copa do Brasil',
    desc: 'A Copa do Brasil ganhou o chaveamento no formato clássico, num modal grande: 16 confrontos de cada lado e a final no meio. A cada fase que termina, quem foi eliminado escurece e quem passou fica com contorno dourado, com a linha levando o classificado até o bloco da próxima fase. Abre pelo botão "Ver chaveamento" — e no lugar dele, a tela da Copa agora mostra as estatísticas do torneio (artilheiros, assistências, goleiros, notas e cartões).',
  },
  {
    id: '2026-08-calendario',
    date: 'Agosto de 2026',
    title: 'Adição: calendário de jogos da temporada',
    desc: 'O Brasileirão agora tem um calendário de verdade, de abril a dezembro, com as 38 rodadas espalhadas em sábados e rodadas de meio de semana. Dá pra abrir pelo botão "Ver calendário", clicar no dia de um jogo futuro pra simular dia a dia até ele, e acompanhar o resultado de cada rodada com selo colorido (🟢 V, 🔴 D, ⚪ E) e placar. No modo automático ele abre sozinho entre as partidas mostrando o tempo passar.',
  },
  {
    id: '2026-08-fix-tabela-multiplayer',
    date: 'Agosto de 2026',
    title: 'Correção de bug: confronto entre amigos sempre na mesma rodada',
    desc: 'No multiplayer, os dois jogadores caíam sempre na 19ª e na 38ª rodada — o gerador de tabela fixava o primeiro time da lista, e os humanos sempre entravam nas primeiras posições. Agora a ordem é sorteada antes de montar a tabela (de forma idêntica em todos os jogadores da sala), então o clássico entre vocês cai numa rodada diferente a cada campeonato.',
  },
  {
    id: '2026-08-ranking-uf',
    date: 'Agosto de 2026',
    title: 'Ranking Global mostra todo mundo e filtra por estado',
    desc: 'O Ranking Global agora lista todos os jogadores (com "carregar mais", não só um top fixo), dá pra filtrar por estado (UF) e mostra quantos jogadores estão ativos. Também corrigimos um bug em que o placar de partidas no multiplayer podia ficar diferente entre os jogadores da mesma sala.',
  },
  {
    id: '2026-08-migracao-mysql',
    date: 'Agosto de 2026',
    title: 'Site novo no ar, com conta e ranking mais estáveis',
    desc: 'Migramos o site pra hospedagem definitiva (brasileiraolendario.com.br) e trocamos o banco de dados pra um mais robusto — login, conquistas e ranking agora persistem com muito mais confiabilidade entre atualizações do jogo.',
  },
  {
    id: '2026-08-clube-conquistas',
    date: 'Agosto de 2026',
    title: '"Ver meu Clube" e dezenas de conquistas novas',
    desc: 'A tela inicial agora mostra um histórico completo de carreira (jogos, vitórias, empates, derrotas, gols marcados e sofridos) e um mural de conquistas — incluindo marcos de overall de elenco e de time, não só de gols.',
  },
  {
    id: '2026-08-convite-instalar',
    date: 'Agosto de 2026',
    title: 'Convide amigos por link e instale como app',
    desc: 'No multiplayer, agora dá pra compartilhar um link direto de convite pra sala (em vez de só o código). O jogo também pode ser instalado como aplicativo no celular ou computador.',
  },
];

// Mural de novidades — acessado pelo ícone 💡 no header.
function NewsModal({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#0B1A12', border: '1px solid rgba(212,162,60,0.3)', borderRadius: 14, padding: 20, width: '100%', maxWidth: 460, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#d4a23c', letterSpacing: 1, textTransform: 'uppercase' }}>💡 Novidades</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#F4F1EA', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {WHATS_NEW.map(item => (
            <div key={item.id} style={{ borderLeft: '2px solid rgba(212,162,60,0.4)', paddingLeft: 12 }}>
              <div style={{ fontSize: 10, opacity: 0.5, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{item.date}</div>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.55 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CHAT_QUICK_EMOJIS = ['⚽', '😱', '🔥', '👏', '😂', '😡', '💪'];

// Chat + reações rápidas da sala — flutuante, disponível em qualquer fase
// enquanto existir uma sala (lobby, draft, ao vivo, resultado).
function MultiplayerChatWidget({ messages, myPid, open, onToggle, onSendText, onSendReaction, myTeamColor }) {
  const [text, setText] = useState('');
  const mc = myTeamColor || '#d4a23c';
  const listRef = useRef(null);
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const submit = (e) => {
    e.preventDefault();
    onSendText(text);
    setText('');
  };

  return (
    <div style={{ position: 'fixed', bottom: 12, right: 12, zIndex: 999, width: open ? 260 : 'auto' }}>
      {open && (
        <div style={{ background: 'rgba(11,26,18,0.96)', border: `1px solid ${mc}55`, borderRadius: 12, marginBottom: 8, display: 'flex', flexDirection: 'column', maxHeight: 320 }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 11, fontWeight: 700, color: mc, letterSpacing: 1, textTransform: 'uppercase' }}>
            Chat da sala
          </div>
          <div ref={listRef} style={{ overflowY: 'auto', flex: 1, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 60 }}>
            {messages.length === 0 && <span style={{ fontSize: 12, opacity: 0.4 }}>Sem mensagens ainda.</span>}
            {messages.map((m, i) => (
              <div key={i} style={{ fontSize: 12, color: '#F4F1EA' }}>
                <b style={{ color: m.pid === myPid ? mc : '#8fb3d9' }}>{m.name}:</b>{' '}
                {m.type === 'reaction' ? <span style={{ fontSize: 16 }}>{m.emoji}</span> : m.text}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '6px 8px', borderTop: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
            {CHAT_QUICK_EMOJIS.map(e => (
              <button key={e} onClick={() => onSendReaction(e)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: 2 }}>{e}</button>
            ))}
          </div>
          <form onSubmit={submit} style={{ display: 'flex', gap: 6, padding: '6px 8px 8px' }}>
            <input
              value={text} onChange={e => setText(e.target.value)} maxLength={200}
              placeholder="Mensagem..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 8px', color: '#F4F1EA', fontSize: 12, fontFamily: "'Space Mono', monospace" }}
            />
            <button type="submit" style={{ background: mc, color: '#0B1A12', border: 'none', borderRadius: 8, padding: '0 10px', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>▶</button>
          </form>
        </div>
      )}
      <button
        onClick={onToggle}
        style={{
          width: 48, height: 48, borderRadius: '50%', border: `1px solid ${mc}55`, background: 'rgba(11,26,18,0.96)',
          color: mc, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginLeft: 'auto', boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
        }}
        title="Chat da sala"
      >💬</button>
    </div>
  );
}

function LiveMatchBox({ um, homeTeam, awayTeam, myTeamId, myTeamBadge, myTeamLogo, mc, liveScore, clockDisplay, isSimulating, roundDone, liveEvents, simSpeed, onSetSpeed, simMode, onSetSimMode, autoCountdown, onStartRound, roundLabel, isPaused, onPause, onResume, showSubPanel, forcedSubReason, liveLineup, subSelectStarter, onSelectSubStarter, onApplySub, subbedOutNames, myTeamColor, onSimulateAll, pitchSlots, myUnavailableNames, onViewTeam }) {
  if (!um || !homeTeam || !awayTeam) return null;
  const isAuto = simMode === 'auto';
  // Expulso já saiu de campo — não tem como "substituir" quem nem está mais
  // jogando (o time simplesmente segue com um a menos, igual na vida real).
  const redCardedNames = new Set(
    (liveEvents || []).filter(ev => ev.type === 'red' && ev.teamId === myTeamId).map(ev => ev.player)
  );
  const hColor = homeTeam.id === myTeamId ? mc : (homeTeam.colors?.p || homeTeam.color || '#3a85d9');
  const aColor = awayTeam.id === myTeamId ? mc : (awayTeam.colors?.p || awayTeam.color || '#c94040');
  const isClassico = isRivalryMatch(homeTeam.club, awayTeam.club);
  return (
    <div style={styles.liveMatchBox} className="card-mob">
      {isClassico && (
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#e0a83c', background: 'rgba(224,168,60,0.12)', border: '1px solid rgba(224,168,60,0.35)', borderRadius: 999, padding: '3px 12px' }}>
            🔥 Clássico
          </span>
        </div>
      )}
      {/* Estádio do mandante — só clima, sem afetar simulação nenhuma. O
          time do próprio jogador não vem de TEAMS (é montado do zero), então
          não tem `club`/estádio conhecido; times de IA têm. */}
      {CLUB_STADIUMS[homeTeam.club] && (
        <div style={{ textAlign: 'center', fontSize: 11, opacity: 0.45, marginBottom: 6 }}>
          🏟️ {CLUB_STADIUMS[homeTeam.club]}
        </div>
      )}
      <div style={styles.liveTeamsRow} className="live-teams-row">
        <div
          onClick={() => homeTeam.id !== myTeamId && onViewTeam && onViewTeam(homeTeam)}
          title={homeTeam.id !== myTeamId ? 'Ver elenco' : undefined}
          style={{ ...styles.liveTeamName, textAlign: 'right', fontWeight: homeTeam.id === myTeamId ? 700 : 400, color: homeTeam.id === myTeamId ? mc : '#F4F1EA', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0, cursor: homeTeam.id !== myTeamId ? 'pointer' : 'default' }}
          className="live-team-n"
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{homeTeam.label}</span>
          {homeTeam.id === myTeamId
            ? (myTeamLogo ? <img src={myTeamLogo} style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} alt="" /> : (myTeamBadge && <span style={{ fontSize: 22, flexShrink: 0 }}>{myTeamBadge}</span>))
            : (homeTeam.clubLogo && <img src={homeTeam.clubLogo} style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} alt="" />)
          }
        </div>
        <div style={styles.liveScoreBlock}>
          <span style={styles.liveScoreNum} className="live-score-n">{liveScore.home}</span>
          <span style={styles.liveScoreDash}>–</span>
          <span style={styles.liveScoreNum} className="live-score-n">{liveScore.away}</span>
        </div>
        <div
          onClick={() => awayTeam.id !== myTeamId && onViewTeam && onViewTeam(awayTeam)}
          title={awayTeam.id !== myTeamId ? 'Ver elenco' : undefined}
          style={{ ...styles.liveTeamName, textAlign: 'left', fontWeight: awayTeam.id === myTeamId ? 700 : 400, color: awayTeam.id === myTeamId ? mc : '#F4F1EA', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 6, minWidth: 0, cursor: awayTeam.id !== myTeamId ? 'pointer' : 'default' }}
          className="live-team-n"
        >
          {awayTeam.id === myTeamId
            ? (myTeamLogo ? <img src={myTeamLogo} style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} alt="" /> : (myTeamBadge && <span style={{ fontSize: 22, flexShrink: 0 }}>{myTeamBadge}</span>))
            : (awayTeam.clubLogo && <img src={awayTeam.clubLogo} style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} alt="" />)
          }
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{awayTeam.label}</span>
        </div>
      </div>

      {(isSimulating || roundDone) && (
        <div style={{ ...styles.clockRow, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ ...styles.clock, color: isSimulating ? '#7fd99a' : '#F4F1EA', minWidth: 52, textAlign: 'center' }}>{clockDisplay}</div>
          {isSimulating && <div style={styles.clockPulse} />}
          {isSimulating && (
            <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
              {[1, 1.5, 2].map(sp => (
                <button key={sp} onClick={() => onSetSpeed(sp)} className="tap-target-sm" style={{
                  fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: simSpeed === sp ? 700 : 400,
                  padding: '3px 8px', borderRadius: 6, border: '1px solid', cursor: 'pointer',
                  borderColor: simSpeed === sp ? '#d4a23c' : 'rgba(255,255,255,0.2)',
                  background: simSpeed === sp ? 'rgba(212,162,60,0.15)' : 'transparent',
                  color: simSpeed === sp ? '#d4a23c' : 'rgba(255,255,255,0.6)',
                }}>{sp}x</button>
              ))}
            </div>
          )}
          {roundDone && !isSimulating && <div style={styles.clockFull}>Tempo encerrado</div>}
          {isSimulating && !isPaused && (
            <button onClick={onPause} className="tap-target-sm" style={{
              position: 'relative', fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(255,140,0,0.5)',
              background: 'rgba(255,140,0,0.1)', color: '#ffaa00', cursor: 'pointer', marginLeft: 6,
            }}>⏸ Pausar</button>
          )}
          {isPaused && (
            <button onClick={onResume} className="tap-target-sm" style={{
              position: 'relative', fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(127,217,154,0.5)',
              background: 'rgba(127,217,154,0.1)', color: '#7fd99a', cursor: 'pointer', marginLeft: 6,
            }}>▶ Retomar</button>
          )}
        </div>
      )}

      {liveEvents.length > 0 && (
        <div style={styles.matchCenter}>
          {liveEvents.map((ev, i) => {
            const isHomeSide = ev.teamId === homeTeam.id;
            const sideColor = isHomeSide ? hColor : aColor;
            const icon = ev.type === 'yellow' ? '🟨' : ev.type === 'red' ? (ev.secondYellow ? '🟨🟥' : '🟥') : ev.type === 'injury' ? '🩹' : ev.type === 'substitution' ? '🔄' : ev.type === 'penalty_miss' ? '❌' : (ev.isOwnGoal ? '⚽🔴' : '⚽');
            const mainText = ev.type === 'goal' ? `${ev.scorer}${ev.isOwnGoal ? ' (contra)' : ev.isPenalty ? ' (pênalti)' : ''}`
              : ev.type === 'substitution' ? `Entrando: ${ev.playerIn}`
                : ev.type === 'penalty_miss' ? ev.player
                  : ev.player;
            const subText = ev.type === 'goal'
              ? (ev.isOwnGoal ? `contra, ${ev.ownGoalTeamLabel}` : ev.isPenalty ? `pênalti convertido · ${ev.teamLabel}` : ev.assist ? `assist: ${ev.assist}` : ev.teamLabel)
              : ev.type === 'yellow' ? `cartão amarelo · ${ev.teamLabel}`
                : ev.type === 'red' ? (ev.secondYellow ? `segundo amarelo, expulso · ${ev.teamLabel}` : `expulso · ${ev.teamLabel}`)
                  : ev.type === 'substitution' ? `Saindo: ${ev.playerOut} · ${ev.teamLabel}`
                    : ev.type === 'penalty_miss' ? `pênalti perdido, defendido por ${ev.gkName || 'goleiro'} · ${ev.teamLabel}`
                      : `lesionado, sai de campo · ${ev.teamLabel}`;
            const content = (
              <div style={{ ...styles.matchCenterCard, borderColor: `${sideColor}55`, background: `${sideColor}14`, flexDirection: isHomeSide ? 'row' : 'row-reverse' }}>
                <span style={{ fontSize: 15 }}>{icon}</span>
                <div style={{ ...styles.matchCenterInfo, textAlign: isHomeSide ? 'left' : 'right' }}>
                  <span style={styles.goalScorer}>{mainText}</span>
                  <span style={styles.goalTeam}>{subText}</span>
                  {ev.type === 'injury' && ev.medicalQuote && (
                    <span style={{ display: 'block', fontSize: 10, opacity: 0.55, fontStyle: 'italic', marginTop: 2 }}>
                      {MEDICAL_CHIEF_NAME}: "{ev.medicalQuote}"
                    </span>
                  )}
                </div>
              </div>
            );
            return (
              <div key={i} style={styles.matchCenterRow}>
                <div style={{ ...styles.matchCenterSide, justifyContent: 'flex-end' }}>{isHomeSide && content}</div>
                <div style={styles.matchCenterMinuteCol}>
                  <span style={styles.goalMinute}>{ev.minute}'</span>
                  <span style={styles.goalScore}>{ev.homeScore}–{ev.awayScore}</span>
                </div>
                <div style={{ ...styles.matchCenterSide, justifyContent: 'flex-start' }}>{!isHomeSide && content}</div>
              </div>
            );
          })}
        </div>
      )}
      {liveEvents.length === 0 && roundDone && <div style={styles.noGoalsMsg}>Sem gols — 0 × 0</div>}

      {/* Sub panel */}
      {showSubPanel && liveLineup && (
        <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px' }}>
          {forcedSubReason && (
            <div style={{ fontSize: 12, color: '#e0593f', marginBottom: 8, fontWeight: 700 }}>
              🩹 {forcedSubReason} se machucou! Escolha um substituto (ou retome jogando com um a menos).
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, color: myTeamColor || '#d4a23c', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
            ↕ Substituição
            {subSelectStarter && <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 8 }}>Escolha o reserva</span>}
            {!subSelectStarter && <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 8 }}>Escolha o titular</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4 }}>Titulares</div>
              {Object.entries(liveLineup)
                .filter(([k, p]) => !p.isBench && !redCardedNames.has(p.name) && !myUnavailableNames?.has(p.name))
                .sort(([, a], [, b]) => posOrderIndex(a.pos?.[0]) - posOrderIndex(b.pos?.[0]))
                .map(([k, p]) => (
                  <button key={k} onClick={() => onSelectSubStarter(subSelectStarter === k ? null : k)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px',
                      background: subSelectStarter === k ? 'rgba(127,217,154,0.15)' : 'rgba(255,255,255,0.04)',
                      border: subSelectStarter === k ? '1px solid rgba(127,217,154,0.5)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6, color: '#F4F1EA',
                      fontFamily: "'Space Mono',monospace", fontSize: 10, cursor: 'pointer', marginBottom: 3,
                    }}
                  >
                    {p.name} <span style={{ opacity: 0.45 }}>{(p.pos || []).join('/')}</span>
                  </button>
                ))}
            </div>
            {subSelectStarter && (() => {
              const starterMeta = pitchSlots?.find(s => s.key === subSelectStarter);
              return (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4 }}>Reservas</div>
                  {Object.entries(liveLineup)
                    .filter(([k, p]) => p.isBench && !myUnavailableNames?.has(p.name))
                    .sort(([, a], [, b]) => posOrderIndex(a.pos?.[0]) - posOrderIndex(b.pos?.[0]))
                    .map(([k, p]) => {
                      const alreadyOut = (subbedOutNames || []).includes(p.name);
                      const positionOk = !starterMeta || starterMeta.isBench || (p.pos || []).includes(starterMeta.realPos);
                      const blocked = alreadyOut || !positionOk;
                      const reason = alreadyOut ? 'Já saiu do jogo nesta partida — não pode voltar' : !positionOk ? 'Não joga na posição desse titular' : undefined;
                      return (
                        <button
                          key={k}
                          onClick={() => !blocked && onApplySub(subSelectStarter, p)}
                          disabled={blocked}
                          title={reason}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px',
                            background: blocked ? 'rgba(224,80,80,0.06)' : 'rgba(255,255,255,0.04)',
                            border: blocked ? '1px solid rgba(224,80,80,0.25)' : '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 6, color: blocked ? 'rgba(244,241,234,0.35)' : '#F4F1EA',
                            fontFamily: "'Space Mono',monospace", fontSize: 10,
                            cursor: blocked ? 'not-allowed' : 'pointer', marginBottom: 3, opacity: blocked ? 0.6 : 1,
                          }}
                        >
                          {blocked ? '🔒 ' : ''}{p.name} <span style={{ opacity: 0.45 }}>{(p.pos || []).join('/')}</span>
                        </button>
                      );
                    })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Toggle manual / automático */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['manual', 'auto'].map(m => (
            <button key={m} onClick={() => onSetSimMode(m)} className="tap-target-sm" style={{
              fontFamily: "'Space Mono', monospace", fontSize: 11,
              padding: '4px 10px', borderRadius: 6, border: '1px solid', cursor: 'pointer',
              borderColor: simMode === m ? mc : 'rgba(255,255,255,0.18)',
              background: simMode === m ? `${mc}22` : 'transparent',
              color: simMode === m ? mc : 'rgba(255,255,255,0.45)',
              fontWeight: simMode === m ? 700 : 400,
            }}>
              {m === 'manual' ? 'Manual' : 'Auto'}
            </button>
          ))}
        </div>
        {!isSimulating && !roundDone && !isAuto && (
          <button style={{ ...styles.btnPrimary, margin: 0, flex: 1 }} onClick={onStartRound}>
            ▶ {roundLabel}
          </button>
        )}
        {!isSimulating && !roundDone && isAuto && autoCountdown !== null && (
          <div style={{ flex: 1, textAlign: 'center', fontFamily: "'Space Mono', monospace", fontSize: 12, color: mc }}>
            Iniciando em {autoCountdown}s…
          </div>
        )}
      </div>
      {!isSimulating && !roundDone && onSimulateAll && (
        <button
          onClick={onSimulateAll}
          title="Avança todas as rodadas restantes (inclusive as suas) sem parar pra jogar cada uma"
          style={{
            width: '100%', marginTop: 8, background: 'none', border: '1px solid rgba(212,162,60,0.35)',
            borderRadius: 8, padding: '7px 10px', color: '#d4a23c', fontFamily: "'Space Mono', monospace",
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ⏭ Simulação direta — ir até o fim
        </button>
      )}
    </div>
  );
}

// Resultado do usuário numa rodada já jogada: {res:'V'|'D'|'E', gf, ga} ou
// null se a rodada ainda não aconteceu. Usado nos selos do calendário.
function userRoundResult(roundResults, myTeamId) {
  if (!roundResults) return null;
  const m = roundResults.find(r => r.homeId === myTeamId || r.awayId === myTeamId);
  if (!m) return null;
  const isHome = m.homeId === myTeamId;
  const gf = isHome ? m.homeGoals : m.awayGoals;
  const ga = isHome ? m.awayGoals : m.homeGoals;
  return { res: gf > ga ? 'V' : gf < ga ? 'D' : 'E', gf, ga };
}
const RESULT_COLORS = { V: '#7fd99a', D: '#e05050', E: 'rgba(255,255,255,0.45)' };

// Calendário da temporada — grade do mês com as rodadas marcadas, resultado
// de cada uma (selo V/D/E + placar) e a simulação "dia a dia" até a rodada
// que a pessoa escolher.
// Escudo pequeno de um time da liga, com dois cuidados que o <img> cru não
// tem: nem todo time tem imagem (o time do próprio jogador pode ter só um
// emblema de texto), e a URL vem do TheSportsDB, que pode falhar. Nos dois
// casos cai nas iniciais do clube em vez de deixar um buraco no layout.
// `ring` desenha o resultado em volta do escudo — assim o calendário mostra
// QUEM foi o adversário e COMO terminou sem precisar de duas linhas.
function TinyCrest({ team, size = 20, ring = null, title }) {
  const [failed, setFailed] = useState(false);
  const src = team?.clubLogo || team?.logo || null;
  const box = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    boxSizing: 'border-box',
    ...(ring ? { border: `2px solid ${ring}` } : {}),
  };
  if (src && !failed) {
    return (
      <span style={{ ...box, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }} title={title}>
        <img
          src={src} alt={team?.club || ''} onError={() => setFailed(true)}
          style={{ width: size - (ring ? 6 : 2), height: size - (ring ? 6 : 2), objectFit: 'contain' }}
        />
      </span>
    );
  }
  const nome = team?.club || team?.label || '?';
  return (
    <span
      title={title}
      style={{
        ...box, background: hexToRgba(team?.color || '#9fb3a8', 0.22),
        color: team?.color || '#cfd8d2', fontFamily: "'Space Mono', monospace",
        fontSize: Math.max(7, Math.round(size * 0.4)), fontWeight: 700, letterSpacing: -0.3,
      }}
    >{nome.slice(0, 3).toUpperCase()}</span>
  );
}

function SeasonCalendarModal({
  fixtures, seasonDates, currentRound, roundHistory, leagueTeams, myTeamId, myTeamColor,
  simActive, cursorDate, speed, onSetSpeed, onSimulateTo, onSimulateAll, onStop, onClose,
}) {
  const mc = myTeamColor || '#d4a23c';
  const dateMap = useMemo(() => roundDateMap(seasonDates), [seasonDates]);
  const refDate = seasonDates[Math.min(currentRound, seasonDates.length - 1)] || new Date();
  const [view, setView] = useState({ year: refDate.getFullYear(), month: refDate.getMonth() });
  const [selectedRound, setSelectedRound] = useState(Math.min(currentRound, fixtures.length - 1));
  const [emptyMsg, setEmptyMsg] = useState('');

  // Durante a animação o calendário segue o cursor (vira o mês sozinho).
  useEffect(() => {
    if (!cursorDate) return;
    setView(v => (v.year === cursorDate.getFullYear() && v.month === cursorDate.getMonth()
      ? v : { year: cursorDate.getFullYear(), month: cursorDate.getMonth() }));
  }, [cursorDate]);

  // ...e o painel de jogos embaixo troca junto: quando o cursor cai num dia de
  // jogo, é aquela rodada que passa a ser exibida. Sem isso o painel ficava
  // preso na rodada em que o modal foi aberto enquanto a temporada inteira
  // corria por cima.
  useEffect(() => {
    if (!cursorDate) return;
    const r = dateMap[dateKey(cursorDate)];
    if (r !== undefined) setSelectedRound(r);
  }, [cursorDate, dateMap]);

  // Fora da simulação (modo automático entre partidas, ou logo depois de
  // parar), o painel acompanha a rodada atual do campeonato.
  useEffect(() => {
    if (simActive) return;
    setSelectedRound(Math.min(currentRound, fixtures.length - 1));
  }, [currentRound, simActive, fixtures.length]);

  useEffect(() => {
    if (!emptyMsg) return;
    const t = setTimeout(() => setEmptyMsg(''), 2000);
    return () => clearTimeout(t);
  }, [emptyMsg]);

  const shiftMonth = (delta) => setView(v => {
    const d = new Date(v.year, v.month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const handleDayClick = (day) => {
    if (simActive) return;
    const round = dateMap[dateKey(day)];
    if (round === undefined) { setEmptyMsg('Não há jogo nesse dia.'); return; }
    setSelectedRound(round);
    if (round > currentRound) onSimulateTo(round);
  };

  const teamById = (id) => leagueTeams?.find(t => t.id === id) || null;
  const teamLabel = (id) => teamById(id)?.label || '—';

  // Adversário do jogador em cada rodada — é o que dá sentido ao escudo no
  // dia. Sem isso o calendário só dizia "R30", que não conta nada sobre o
  // jogo que vem.
  const roundOpponent = useMemo(() => {
    const map = {};
    (fixtures || []).forEach((matches, r) => {
      const m = (matches || []).find(x => x.homeId === myTeamId || x.awayId === myTeamId);
      if (!m) return;
      const isHome = m.homeId === myTeamId;
      map[r] = { team: leagueTeams?.find(t => t.id === (isHome ? m.awayId : m.homeId)) || null, isHome };
    });
    return map;
  }, [fixtures, leagueTeams, myTeamId]);

  const selectedMatches = fixtures[selectedRound] || [];
  const selectedResults = roundHistory?.[selectedRound] || null;
  const cursorKey = cursorDate ? dateKey(cursorDate) : null;

  return (
    <div onClick={simActive ? undefined : onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, maxHeight: '94vh', overflowY: 'auto', background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 22, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: mc, fontWeight: 700 }}>
            📅 Calendário de jogos
          </div>
          {!simActive && (
            <button onClick={onClose} aria-label="Fechar" className="tap-target-sm" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 18, cursor: 'pointer', padding: 6, lineHeight: 1 }}>✕</button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
          <button onClick={() => shiftMonth(-1)} disabled={simActive} aria-label="Mês anterior" className="tap-target-sm" style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#F4F1EA', width: 28, height: 28, cursor: simActive ? 'default' : 'pointer', opacity: simActive ? 0.3 : 1 }}>‹</button>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 700, minWidth: 150, textAlign: 'center' }}>
            {MONTH_NAMES[view.month]} {view.year}
          </div>
          <button onClick={() => shiftMonth(1)} disabled={simActive} aria-label="Próximo mês" className="tap-target-sm" style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#F4F1EA', width: 28, height: 28, cursor: simActive ? 'default' : 'pointer', opacity: simActive ? 0.3 : 1 }}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
          {WEEKDAY_LABELS.map(w => (
            <div key={w} style={{ textAlign: 'center', fontSize: 10.5, fontFamily: "'Space Mono', monospace", opacity: 0.45, letterSpacing: 0.5 }}>{w}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {monthMatrix(view.year, view.month).flat().map((day, i) => {
            if (!day) return <div key={`e${i}`} />;
            const key = dateKey(day);
            const round = dateMap[key];
            const hasRound = round !== undefined;
            const played = hasRound && roundHistory?.[round];
            const result = played ? userRoundResult(roundHistory[round], myTeamId) : null;
            const isCursor = cursorKey === key;
            const isSelected = hasRound && round === selectedRound;
            const opponent = hasRound ? roundOpponent[round] : null;
            return (
              <button
                key={key}
                onClick={() => handleDayClick(day)}
                title={hasRound ? `Rodada ${round + 1}` : 'Sem jogo'}
                style={{
                  minHeight: 70, padding: '5px 3px', borderRadius: 8, textAlign: 'center', cursor: simActive ? 'default' : 'pointer',
                  border: `1px solid ${isCursor ? mc : isSelected ? hexToRgba(mc, 0.5) : hasRound ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'}`,
                  background: isCursor ? hexToRgba(mc, 0.22) : hasRound ? 'rgba(255,255,255,0.04)' : 'transparent',
                  color: '#F4F1EA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                }}
              >
                <span style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", opacity: hasRound ? 0.85 : 0.35 }}>{day.getDate()}</span>
                {/* O escudo do adversário vale mais que o número da rodada:
                    diz de cara contra quem é o jogo. O anel em volta carrega o
                    resultado, o que evita gastar uma linha só com o selo V/D/E
                    — a célula tem ~40px de largura no celular. */}
                {hasRound && (
                  <TinyCrest
                    team={opponent?.team}
                    size={22}
                    ring={result ? RESULT_COLORS[result.res] : null}
                    title={opponent?.team
                      ? `Rodada ${round + 1} · ${opponent.isHome ? 'em casa contra' : 'fora contra'} ${opponent.team.label}`
                      : `Rodada ${round + 1}`}
                  />
                )}
                {hasRound && !result && (
                  <span style={{ fontSize: 9, color: mc, fontWeight: 700, lineHeight: 1, fontFamily: "'Space Mono', monospace" }}>
                    {/* Tinha um "@" aqui pra marcar jogo fora. A 9px, em Space
                        Mono, ele lia como "a" — "a R2" em vez de "@ R2". Mando
                        fica no tooltip do dia e na lista de jogos abaixo, que é
                        onde dá pra mostrar sem ambiguidade. */}
                    R{round + 1}
                  </span>
                )}
                {result && (
                  <span style={{ fontSize: 9.5, fontFamily: "'Space Mono', monospace", lineHeight: 1, display: 'flex', gap: 3 }}>
                    <span style={{ fontWeight: 800, color: RESULT_COLORS[result.res] }}>{result.res}</span>
                    <span style={{ opacity: 0.6 }}>{result.gf}-{result.ga}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {emptyMsg && (
          <div style={{ marginTop: 8, textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>{emptyMsg}</div>
        )}

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.45, marginBottom: 6 }}>
            Jogos da rodada {selectedRound + 1}
            {seasonDates[selectedRound] && ` · ${seasonDates[selectedRound].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
          </div>
          {selectedMatches.map((m, i) => {
            const r = selectedResults?.[i];
            const isMine = m.homeId === myTeamId || m.awayId === myTeamId;
            return (
              <div key={`${m.homeId}-${m.awayId}`} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', fontSize: 11.5,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: isMine ? hexToRgba(mc, 0.08) : 'transparent',
                fontWeight: isMine ? 700 : 400,
              }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teamLabel(m.homeId)}</span>
                  <TinyCrest team={teamById(m.homeId)} size={16} />
                </span>
                <span style={{ fontFamily: "'Space Mono', monospace", minWidth: 34, textAlign: 'center', flexShrink: 0, color: r ? mc : 'rgba(255,255,255,0.3)' }}>
                  {r ? `${r.homeGoals}-${r.awayGoals}` : 'x'}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TinyCrest team={teamById(m.awayId)} size={16} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teamLabel(m.awayId)}</span>
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Velocidade da passagem dos dias — sempre visível (dá pra trocar
              no meio da simulação, o loop lê o valor a cada passo). */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 10.5, opacity: 0.45, fontFamily: "'Space Mono', monospace" }}>VELOCIDADE</span>
            {CALENDAR_SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => onSetSpeed(s)}
                className="tap-target-sm"
                style={{
                  fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: speed === s ? 700 : 400,
                  padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                  border: `1px solid ${speed === s ? mc : 'rgba(255,255,255,0.2)'}`,
                  background: speed === s ? hexToRgba(mc, 0.15) : 'transparent',
                  color: speed === s ? mc : 'rgba(255,255,255,0.6)',
                }}
              >{s}x</button>
            ))}
          </div>
          {simActive ? (
            <button onClick={onStop} style={{ ...styles.btnPrimary, width: '100%', background: '#e05050', color: '#fff' }}>
              ⏸ Parar no próximo jogo
            </button>
          ) : (
            <>
              <div style={{ fontSize: 11, opacity: 0.45, textAlign: 'center' }}>
                Clique no dia de um jogo futuro pra simular até ele.
              </div>
              <button onClick={onSimulateAll} style={{ ...styles.btnGhost, marginTop: 0, width: '100%' }}>
                ⏭ Simular até o fim da temporada
              </button>
              <button onClick={onClose} style={{ ...styles.btnPrimary, width: '100%', background: mc, color: '#0B1A12' }}>
                Ir pra minha liga
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Playing({ myTeamId, pitchSlots, fixtures, currentRound, leagueTeams, leagueTable, clockMinute, isSimulating, liveEvents, liveScore, roundResults, activeUserMatch, myTeamColor, myTeamBadge, myTeamLogo, gameMode, cupRounds, cupRoundIdx, cupLeg, userInCup, eliminationRoundName, simSpeed, onSetSpeed, simMode, onSetSimMode, autoCountdown, onStartRound, onNextRound, matchHistory, scorers, assisters, cleanSheets, seasonRatings, cardCounts, redCards, suspensions, injuries, lastRoundDiscipline, lastMatchRatings, teamForm, viewingTeam, onViewTeam, onSimulateAll, onOpenCalendar, fastSimActive, fastSimStatusMsg, onCancelFastSim, isPaused, onPause, onResume, showSubPanel, forcedSubReason, liveLineup, subSelectStarter, onSelectSubStarter, onApplySub, subbedOutNames, bracketAdvance, onDismissBracketAdvance, difficulty, myDivision, otherDivision, promotionTie, isDailyChallenge }) {
  const mc = myTeamColor || '#d4a23c';
  // Nomes (não as chaves compostas) dos jogadores do PRÓPRIO time atualmente
  // suspensos ou machucados — usado só pra filtrar o painel de troca/cobrança
  // de pênalti na tela ao vivo, pra não deixar escalar/selecionar quem está
  // fora por disciplina/lesão mesmo depois da troca automática pré-jogo.
  const [showBracket, setShowBracket] = useState(false);
  const myUnavailableNames = useMemo(() => {
    const names = new Set();
    const prefix = `${myTeamId}::`;
    const add = obj => Object.entries(obj || {}).forEach(([k, left]) => { if (left > 0 && k.startsWith(prefix)) names.add(k.slice(prefix.length)); });
    add(suspensions);
    add(injuries);
    return names;
  }, [suspensions, injuries, myTeamId]);
  const round = fixtures[currentRound] || [];
  const um = activeUserMatch || round.find(m => m.homeId === myTeamId || m.awayId === myTeamId);
  const homeTeam = um ? leagueTeams.find(t => t.id === um.homeId) : null;
  const awayTeam = um ? leagueTeams.find(t => t.id === um.awayId) : null;
  // Label do próprio time — o histórico guarda só os nomes (homeLabel/
  // awayLabel), então é assim que dá pra saber o mando e quem foi o
  // adversário em cada partida (mesmo critério usado na tela de resultado).
  const myLabel = leagueTeams?.find(t => t.id === myTeamId)?.label || 'Meu Time';
  const roundDone = roundResults !== null;
  const clockDisplay = `${clockMinute}'`;
  const [showHistory, setShowHistory] = useState(false);
  const [showRatings, setShowRatings] = useState(false);
  // Navegação por abas (só faz sentido no Brasileirão — a Copa é mata-mata,
  // sem tabela/estatísticas de temporada pra separar; ela mantém a tela única).
  const [activeTab, setActiveTab] = useState('partida');
  // Divisão espelho (só IA) da Série A/B: existia calculada há tempos
  // (promoção/rebaixamento depende dela), mas não tinha NENHUM jeito de ver
  // — nem essa aba, nem em lugar nenhum. `myDivision` é a MINHA divisão;
  // `otherDivision.table` é sempre da outra.
  const otherDivisionLabel = myDivision === 'A' ? 'B' : 'A';
  const TABS = [
    { id: 'partida', label: 'Partida', icon: '⚽' },
    { id: 'tabela', label: 'Tabela', icon: '📊' },
    { id: 'elenco', label: 'Elenco', icon: '👥' },
    { id: 'estatisticas', label: 'Estatísticas', icon: '🏅' },
    ...(gameMode === 'serieab' && otherDivision ? [{ id: 'outra-serie', label: `Série ${otherDivisionLabel}`, icon: '🔭' }] : []),
  ];

  // Simulação direta da Copa: em vez do overlay genérico de "Simulando…", ela
  // roda DENTRO do chaveamento — cada fase que fecha acende suas linhas e
  // preenche a fase seguinte na frente da pessoa. É o mesmo papel que o
  // calendário faz no Brasileirão, andando dia a dia.
  if (fastSimActive && gameMode === 'copa' && cupRounds.length > 0) {
    return (
      <div style={styles.card} className="card-mob">
        <CupBracketModal
          cupRounds={cupRounds} leagueTeams={leagueTeams} myTeamId={myTeamId} myTeamColor={mc}
          myTeamLogo={myTeamLogo} myTeamBadge={myTeamBadge} onViewTeam={onViewTeam}
          simActive simStatus={fastSimStatusMsg} onCancelSim={onCancelFastSim}
          onClose={() => { }}
        />
      </div>
    );
  }

  // Simulação direta em andamento — sobrepõe qualquer outra tela (Copa ou
  // Brasileirão, eliminado ou não) até chegar no fim ou o usuário cancelar.
  if (fastSimActive) {
    return (
      <div style={styles.card} className="card-mob">
        <div style={{ textAlign: 'center', padding: '54px 20px' }}>
          <div style={{ fontSize: 42, marginBottom: 16 }}>⏭️</div>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 700, color: mc, marginBottom: 10, minHeight: 26 }}>
            {fastSimStatusMsg || 'Simulando...'}
          </div>
          {(gameMode === 'brasileirao' || gameMode === 'serieab') && (
            <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 10 }}>
              Rodada {currentRound + 1} de {fixtures.length}
            </div>
          )}
          <div style={{ marginBottom: 22 }}><DifficultyBadge difficulty={difficulty} /></div>
          <div style={{ ...styles.clockPulse, margin: '0 auto' }} />
          {onCancelFastSim && (
            <button style={{ ...styles.btnGhost, marginTop: 28 }} onClick={onCancelFastSim}>Cancelar</button>
          )}
        </div>
      </div>
    );
  }

  // ── COPA DO BRASIL ──────────────────────────────────────────
  if (gameMode === 'copa') {
    const cupRound = cupRounds[cupRoundIdx] || {};
    const roundName = cupRound.name || CUP_ROUND_NAMES[cupRoundIdx] || 'Copa';
    // Final é jogo único (2 times = 1 partida) — sem jogo de volta.
    const isFinal = (cupRound.matches?.length || 0) === 1;
    const isLastCupRound = cupRoundIdx >= CUP_ROUND_NAMES.length - 1;
    const legLabel = isFinal ? 'Jogo Único' : (cupLeg === 1 ? 'Jogo de Ida' : 'Jogo de Volta');

    // Contexto do jogo de ida para exibir no leg 2
    const leg1Results = cupLeg === 2 ? (cupRound.leg1Results || []) : null;
    const userOrigIdx = cupRound.matches ? cupRound.matches.findIndex(m => m.homeId === myTeamId || m.awayId === myTeamId) : -1;
    const userLeg1 = leg1Results && userOrigIdx >= 0 ? leg1Results[userOrigIdx] : null;
    const origMatch = userOrigIdx >= 0 ? cupRound.matches[userOrigIdx] : null;

    // Rodapé comum às três telas da Copa (jogando, eliminado, eliminado com
    // resultados): estatísticas do torneio + botão que abre o chaveamento no
    // modal. O chaveamento saiu de dentro da tela porque em 5 fases ele nunca
    // coube — no modal dá pra desenhar o formato clássico inteiro.
    const cupExtras = (
      <>
        {cupRounds.length > 0 && (
          <button
            style={{ ...styles.btnGhost, width: '100%', marginTop: 14 }}
            onClick={() => setShowBracket(true)}
          >
            🏆 Ver chaveamento
          </button>
        )}
        <div style={{ marginTop: 14 }}>
          <div style={styles.sectionLabel}>Estatísticas da Copa</div>
          <SeasonStatsPanel
            scorers={scorers} assisters={assisters} cleanSheets={cleanSheets} seasonRatings={seasonRatings}
            cardCounts={cardCounts} redCards={redCards} leagueTeams={leagueTeams} mc={mc}
          />
        </div>
        {/* Duas portas pro mesmo chaveamento: o botão "Ver chaveamento" (a
            pessoa quis olhar) e a transição de fase (o jogo mostrou sozinho).
            A transição manda, porque é ela que tem a animação e o CTA certo. */}
        {(showBracket || bracketAdvance) && (
          <CupBracketModal
            cupRounds={cupRounds} leagueTeams={leagueTeams} myTeamId={myTeamId} myTeamColor={mc}
            myTeamLogo={myTeamLogo} myTeamBadge={myTeamBadge} onViewTeam={onViewTeam}
            advance={bracketAdvance}
            onSimulateAll={!bracketAdvance && onSimulateAll ? () => { setShowBracket(false); onSimulateAll(); } : undefined}
            onClose={bracketAdvance ? onDismissBracketAdvance : () => setShowBracket(false)}
          />
        )}
      </>
    );

    // Usuário eliminado
    if (!userInCup) {
      const elimRoundName = eliminationRoundName || roundName;

      // Quando !roundDone (fase AI sem user), mostrar botão de avançar em modo manual
      if (!roundDone) {
        return (
          <div style={styles.card} className="card-mob">
            <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>😔</div>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Eliminado nas {elimRoundName}</div>
              <div style={{ fontSize: 13, opacity: 0.55, marginBottom: 20 }}>O torneio continua sem voce.</div>
              {simMode === 'manual' && <button style={styles.btnSmall} onClick={onStartRound}>Simular proxima fase</button>}
              {simMode === 'manual' && onSimulateAll && (
                <button style={{ ...styles.btnPrimary, background: '#d4a23c', color: '#0B1A12', margin: '8px auto', display: 'block' }} onClick={onSimulateAll}>
                  Simular ate o campeao
                </button>
              )}
              {simMode === 'auto' && autoCountdown !== null && (
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#d4a23c' }}>Simulando em {autoCountdown}s...</div>
              )}
            </div>
            {cupExtras}
          </div>
        );
      }

      // roundDone: mostrar resultados desta fase e avançar
      const elimL2 = roundResults && userOrigIdx >= 0 ? roundResults[userOrigIdx] || { homeGoals: 0, awayGoals: 0 } : null;
      const elimIsHome = origMatch ? origMatch.homeId === myTeamId : false;
      const elimUserAgg = elimL2 && userLeg1
        ? (elimIsHome ? userLeg1.homeGoals + elimL2.awayGoals : userLeg1.awayGoals + elimL2.homeGoals) : null;
      const elimOppAgg = elimL2 && userLeg1
        ? (elimIsHome ? userLeg1.awayGoals + elimL2.homeGoals : userLeg1.homeGoals + elimL2.awayGoals) : null;

      return (
        <div style={styles.card} className="card-mob">
          <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>😔</div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Eliminado!</div>
            <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 6 }}>Seu time foi eliminado nas {elimRoundName}.</div>
            {elimUserAgg !== null && elimOppAgg !== null && (
              <div style={{ fontSize: 13, fontFamily: "'Space Mono', monospace", color: '#e05050', marginBottom: 20 }}>
                Agregado: {elimUserAgg} x {elimOppAgg}
              </div>
            )}
            {simMode === 'manual' && <button style={styles.btnSmall} onClick={onNextRound}>Ver campeao</button>}
            {simMode === 'manual' && onSimulateAll && (
              <button style={{ ...styles.btnPrimary, background: '#d4a23c', color: '#0B1A12', margin: '8px auto', display: 'block' }} onClick={onSimulateAll}>
                Simular ate o campeao
              </button>
            )}
            {simMode === 'auto' && autoCountdown !== null && (
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#d4a23c' }}>Avancando em {autoCountdown}s...</div>
            )}
          </div>
          {roundResults && cupRound.matches && leg1Results && (
            <div style={styles.otherMatchesBox}>
              <div style={styles.sectionLabel}>Agregado — {roundName}</div>
              {cupRound.matches.map((origM, i) => {
                const l1 = leg1Results[i] || { homeGoals: 0, awayGoals: 0 };
                const l2 = roundResults[i] || { homeGoals: 0, awayGoals: 0 };
                const aggHome = l1.homeGoals + l2.awayGoals;
                const aggAway = l1.awayGoals + l2.homeGoals;
                const h = leagueTeams.find(t => t.id === origM.homeId);
                const a = leagueTeams.find(t => t.id === origM.awayId);
                const hw = aggHome > aggAway;
                const aw = aggAway > aggHome;
                const isUserRow = origM.homeId === myTeamId || origM.awayId === myTeamId;
                return (
                  <div key={i} style={{ ...styles.otherMatchRow, background: isUserRow ? 'rgba(224,80,80,0.07)' : undefined }}>
                    <span style={{ ...styles.otherTeam, fontWeight: hw ? 700 : 400, color: hw ? '#7fd99a' : undefined }}>{h?.label}</span>
                    <span style={styles.otherScore}>{aggHome} - {aggAway}</span>
                    <span style={{ ...styles.otherTeam, textAlign: 'left', fontWeight: aw ? 700 : 400, color: aw ? '#7fd99a' : undefined }}>{a?.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          {cupExtras}
        </div>
      );
    }

    return (
      <div style={styles.card} className="card-mob">
        <div style={styles.draftTopRow}>
          <div>
            <div style={styles.eyebrow}>Copa do Brasil · {legLabel}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700 }}>{roundName}</span>
              <DifficultyBadge difficulty={difficulty} />
            </div>
          </div>
          {roundDone && userInCup && simMode === 'manual' && (
            <button style={{ ...styles.btnSmall, background: mc, color: '#0B1A12' }} onClick={onNextRound}>
              {isFinal ? '🏆 Ver campeão →' : (isLastCupRound && cupLeg === 2 ? '🏆 Ver campeão →' : cupLeg === 1 ? 'Jogo de Volta →' : 'Próxima fase →')}
            </button>
          )}
          {roundDone && userInCup && simMode === 'auto' && autoCountdown !== null && (
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: mc }}>
              Avançando em {autoCountdown}s…
            </div>
          )}
        </div>

        {/* Contexto do jogo de ida + agregado ao vivo quando estamos no jogo de volta */}
        {cupLeg === 2 && userLeg1 && origMatch && um && (() => {
          const myLeg1 = origMatch.homeId === myTeamId ? userLeg1.homeGoals : userLeg1.awayGoals;
          const oppLeg1 = origMatch.homeId === myTeamId ? userLeg1.awayGoals : userLeg1.homeGoals;
          // Placar ao vivo do jogo de volta (não o resultado final salvo em roundResults,
          // que só existe depois que a partida termina) — soma ao 1º jogo pra dar o
          // agregado em tempo real, minuto a minuto.
          const isUserHomeLeg2 = um.homeId === myTeamId;
          const myLeg2Live = isUserHomeLeg2 ? liveScore.home : liveScore.away;
          const oppLeg2Live = isUserHomeLeg2 ? liveScore.away : liveScore.home;
          const myAggLive = myLeg1 + myLeg2Live;
          const oppAggLive = oppLeg1 + oppLeg2Live;
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: 10, marginBottom: 12, fontSize: 12, flexWrap: 'wrap' }}>
              <span style={{ opacity: 0.55 }}>1º jogo:</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#F4F1EA' }}>{myLeg1} × {oppLeg1}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ opacity: 0.55 }}>Agregado:</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: myAggLive > oppAggLive ? '#7fd99a' : myAggLive < oppAggLive ? '#e05050' : mc }}>{myAggLive} × {oppAggLive}</span>
            </div>
          );
        })()}

        <LiveMatchBox
          um={um} homeTeam={homeTeam} awayTeam={awayTeam}
          myTeamId={myTeamId} myTeamBadge={myTeamBadge} myTeamLogo={myTeamLogo} mc={mc}
          liveScore={liveScore} clockDisplay={clockDisplay}
          isSimulating={isSimulating} roundDone={roundDone}
          liveEvents={liveEvents} simSpeed={simSpeed}
          onSetSpeed={onSetSpeed} simMode={simMode} onSetSimMode={onSetSimMode}
          autoCountdown={autoCountdown} onStartRound={onStartRound}
          roundLabel={`Jogar — ${roundName} (${legLabel})`}
          isPaused={isPaused} onPause={onPause} onResume={onResume}
          showSubPanel={showSubPanel} forcedSubReason={forcedSubReason} liveLineup={liveLineup}
          subSelectStarter={subSelectStarter}
          onSelectSubStarter={onSelectSubStarter}
          onApplySub={onApplySub} subbedOutNames={subbedOutNames} myTeamColor={myTeamColor} onSimulateAll={onSimulateAll} pitchSlots={pitchSlots}
          myUnavailableNames={myUnavailableNames} onViewTeam={onViewTeam}
        />

        {/* Placar agregado após jogo de volta */}
        {roundDone && cupLeg === 2 && userLeg1 && origMatch && roundResults && (() => {
          const l2 = roundResults[userOrigIdx] || { homeGoals: 0, awayGoals: 0 };
          const isUserHome = origMatch.homeId === myTeamId;
          const userAgg = isUserHome ? (userLeg1.homeGoals + l2.awayGoals) : (userLeg1.awayGoals + l2.homeGoals);
          const oppAgg = isUserHome ? (userLeg1.awayGoals + l2.homeGoals) : (userLeg1.homeGoals + l2.awayGoals);
          return (
            <div style={{ textAlign: 'center', padding: '10px 0 4px', fontSize: 13 }}>
              <span style={{ opacity: 0.55, marginRight: 8 }}>Placar agregado:</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 16, color: userAgg > oppAgg ? '#7fd99a' : userAgg < oppAgg ? '#e05050' : mc }}>
                {userAgg} × {oppAgg}
              </span>
              {userAgg > oppAgg && <span style={{ marginLeft: 8, color: '#7fd99a', fontSize: 12 }}>✓ Classificado</span>}
              {userAgg < oppAgg && <span style={{ marginLeft: 8, color: '#e05050', fontSize: 12 }}>✗ Eliminado</span>}
              {userAgg === oppAgg && <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 12 }}>Pênaltis</span>}
            </div>
          );
        })()}

        {roundDone && (
          <div style={styles.otherMatchesBox}>
            <div style={styles.sectionLabel}>
              {cupLeg === 2 ? `Agregado — ${roundName}` : `Outros jogos — ${roundName} · Jogo de Ida`}
            </div>
            {cupLeg === 2 && cupRound.matches && leg1Results
              ? cupRound.matches
                .map((origM, i) => ({ origM, i }))
                .filter(({ origM }) => origM.homeId !== myTeamId && origM.awayId !== myTeamId)
                .map(({ origM, i }) => {
                  const l1 = leg1Results[i] || { homeGoals: 0, awayGoals: 0 };
                  const l2 = roundResults[i] || { homeGoals: 0, awayGoals: 0 };
                  const aggHome = l1.homeGoals + l2.awayGoals;
                  const aggAway = l1.awayGoals + l2.homeGoals;
                  const h = leagueTeams.find(t => t.id === origM.homeId);
                  const a = leagueTeams.find(t => t.id === origM.awayId);
                  const winH = aggHome > aggAway, winA = aggAway > aggHome;
                  return (
                    <div key={i} style={styles.otherMatchRow}>
                      <span style={{ ...styles.otherTeam, fontWeight: winH ? 700 : 400, color: winH ? '#7fd99a' : undefined }}>{h?.label}</span>
                      <span style={styles.otherScore}>{aggHome} – {aggAway}</span>
                      <span style={{ ...styles.otherTeam, textAlign: 'left', fontWeight: winA ? 700 : 400, color: winA ? '#7fd99a' : undefined }}>{a?.label}</span>
                    </div>
                  );
                })
              : roundResults.filter(r => r.homeId !== myTeamId && r.awayId !== myTeamId).map((r, i) => {
                const h = leagueTeams.find(t => t.id === r.homeId);
                const a = leagueTeams.find(t => t.id === r.awayId);
                const winH = r.homeGoals > r.awayGoals, winA = r.awayGoals > r.homeGoals;
                return (
                  <div key={i} style={styles.otherMatchRow}>
                    <span style={{ ...styles.otherTeam, fontWeight: winH ? 700 : 400, color: winH ? '#7fd99a' : undefined }}>{h?.label}</span>
                    <span style={styles.otherScore}>{r.homeGoals} – {r.awayGoals}</span>
                    <span style={{ ...styles.otherTeam, textAlign: 'left', fontWeight: winA ? 700 : 400, color: winA ? '#7fd99a' : undefined }}>{a?.label}</span>
                  </div>
                );
              })
            }
          </div>
        )}

        {/* Pênaltis */}
        {roundDone && cupLeg === 2 && (() => {
          const penRes = cupRound.penaltyResults || [];
          if (!penRes.length) return null;
          return (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
              <div style={styles.sectionLabel}>Penaltis</div>
              {penRes.map((pr, pi) => {
                const hTeam = leagueTeams.find(t => t.id === cupRound.matches[pr.matchIdx]?.homeId);
                const aTeam = leagueTeams.find(t => t.id === cupRound.matches[pr.matchIdx]?.awayId);
                return (
                  <div key={pi} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{hTeam?.label} {pr.goalsA} x {pr.goalsB} {aTeam?.label}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{hTeam?.label}: {pr.kicks.map(k => k.a ? 'O' : 'X').join(' ')}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{aTeam?.label}: {pr.kicks.map(k => k.b ? 'O' : 'X').join(' ')}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {cupExtras}
      </div>
    );
  }

  // ── BRASILEIRÃO ─────────────────────────────────────────────
  const totalRounds = fixtures.length;
  // Série A/B pode ter 39 ou 40 "rodadas" quando o jogador cai no mata-mata
  // de acesso (2 rodadas extras anexadas no fim) — sem tratar isso à parte,
  // a última rodada regular mostraria "Rodada 38 de 40" (confuso) em vez de
  // avisar que virou mata-mata.
  const inPromotionTie = gameMode === 'serieab' && promotionTie?.leg;
  const regularRounds = gameMode === 'serieab' ? 38 : totalRounds;
  // A última rodada regular pode levar direto pro resultado OU pro jogo de
  // ida do mata-mata — só se sabe depois que ela termina de verdade (a
  // colocação final decide). O rótulo do botão assume "resultado final" nos
  // dois casos; quem cai no mata-mata vê a rodada seguinte já anunciada como
  // tal, então o desencontro dura só um clique.
  const isFinalRegularRound = !inPromotionTie && currentRound + 1 >= regularRounds;
  const isFinalPlayoffLeg = inPromotionTie && promotionTie.leg === 2;
  const isLastRound = isFinalRegularRound || isFinalPlayoffLeg;

  return (
    <div style={styles.card} className="card-mob">
      <div style={styles.draftTopRow}>
        <div>
          <div style={styles.eyebrow}>
            {isDailyChallenge ? '🏆 Supercopa do Brasil' : inPromotionTie ? 'Série A/B · Mata-mata de Acesso' : gameMode === 'serieab' ? `Brasileirão · Série ${myDivision}` : 'Brasileirão · Série A'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
            <span style={{ fontSize: 13, opacity: 0.6 }}>
              {isDailyChallenge
                ? `vs ${leagueTeams.find(t => t.id !== myTeamId)?.label || 'time lendário de hoje'}`
                : inPromotionTie
                ? `${promotionTie.leg === 1 ? 'Jogo de Ida' : 'Jogo de Volta'} vs ${promotionTie.opponentLabel}`
                : `Rodada ${currentRound + 1} de ${regularRounds}`}
            </span>
            {/* O adversário da Supercopa é sempre escalado em Lendário (ver
                confirmDailyChallenge) — o badge mostra isso, não a
                dificuldade configurada pra carreira normal do jogador. */}
            <DifficultyBadge difficulty={isDailyChallenge ? 'lendario' : difficulty} />
          </div>
          {onOpenCalendar && (
            <button
              onClick={onOpenCalendar}
              className="tap-target-sm"
              style={{ marginTop: 6, background: 'none', border: `1px solid ${hexToRgba(mc, 0.35)}`, borderRadius: 8, color: mc, fontSize: 11.5, fontWeight: 600, padding: '4px 10px', cursor: 'pointer' }}
            >
              📅 Ver calendário
            </button>
          )}
        </div>
        {roundDone && simMode === 'manual' && (
          <button style={{ ...styles.btnSmall, background: mc, color: '#0B1A12' }} onClick={onNextRound}>
            {isLastRound ? 'Ver resultado final →' : inPromotionTie ? 'Jogo de Volta →' : 'Próxima rodada →'}
          </button>
        )}
        {roundDone && simMode === 'auto' && autoCountdown !== null && (
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: mc, fontWeight: isLastRound ? 700 : 400 }}>
            {/* Era o mesmo texto genérico de qualquer rodada ("Avançando em
                3s...") bem na hora de revelar o campeão — sem clima nenhum
                pro momento mais importante da temporada. */}
            {isLastRound ? `🏆 Revelando o campeão em ${autoCountdown}s…` : `Avançando em ${autoCountdown}s…`}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }} className="tab-bar-scroll">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex: '1 1 0%', minWidth: 0, background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 6px 12px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
              color: activeTab === t.id ? mc : 'rgba(244,241,234,0.45)',
              borderBottom: `2px solid ${activeTab === t.id ? mc : 'transparent'}`,
              marginBottom: -1, transition: 'color 0.12s, border-color 0.12s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'partida' && (
        <>
          <LiveMatchBox
            um={um} homeTeam={homeTeam} awayTeam={awayTeam}
            myTeamId={myTeamId} myTeamBadge={myTeamBadge} myTeamLogo={myTeamLogo} mc={mc}
            liveScore={liveScore} clockDisplay={clockDisplay}
            isSimulating={isSimulating} roundDone={roundDone}
            liveEvents={liveEvents} simSpeed={simSpeed}
            onSetSpeed={onSetSpeed} simMode={simMode} onSetSimMode={onSetSimMode}
            autoCountdown={autoCountdown} onStartRound={onStartRound}
            roundLabel={`Jogar Rodada ${currentRound + 1}`}
            isPaused={isPaused} onPause={onPause} onResume={onResume}
            showSubPanel={showSubPanel} forcedSubReason={forcedSubReason} liveLineup={liveLineup}
            subSelectStarter={subSelectStarter}
            onSelectSubStarter={onSelectSubStarter}
            onApplySub={onApplySub} subbedOutNames={subbedOutNames} myTeamColor={myTeamColor} onSimulateAll={onSimulateAll} pitchSlots={pitchSlots}
            myUnavailableNames={myUnavailableNames} onViewTeam={onViewTeam}
          />

          {roundDone && (
            <div style={styles.otherMatchesBox}>
              <div style={styles.sectionLabel}>Outros jogos da rodada {currentRound + 1}</div>
              {roundResults.filter(r => r.homeId !== myTeamId && r.awayId !== myTeamId).map((r, i) => {
                const h = leagueTeams.find(t => t.id === r.homeId);
                const a = leagueTeams.find(t => t.id === r.awayId);
                const hw = r.homeGoals > r.awayGoals, aw = r.awayGoals > r.homeGoals;
                return (
                  <div key={i} style={styles.otherMatchRow}>
                    <span style={{ ...styles.otherTeam, fontWeight: hw ? 700 : 400 }}>{h?.label}</span>
                    <span style={styles.otherScore}>{r.homeGoals} – {r.awayGoals}</span>
                    <span style={{ ...styles.otherTeam, textAlign: 'left', fontWeight: aw ? 700 : 400 }}>{a?.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'tabela' && (
        <div style={styles.tableSection} className="table-scroll">
          <div style={styles.sectionLabel}>Classificacao Geral</div>
          <div style={styles.tableHeaderRow}>
            <span style={styles.tablePos}>#</span>
            <span style={{ flex: 1 }}>Time</span>
            <span style={styles.tableCell}>PJ</span>
            <span style={styles.tableCell}>V</span>
            <span style={styles.tableCell}>E</span>
            <span style={styles.tableCell}>D</span>
            <span style={styles.tableCell} className="table-col-hide-mobile">GP</span>
            <span style={styles.tableCell} className="table-col-hide-mobile">GC</span>
            <span style={styles.tableCell}>SG</span>
            <span style={{ ...styles.tableCell, color: '#d4a23c', fontWeight: 700 }}>PTS</span>
            <span style={{ width: 28 }} className="table-col-hide-mobile"></span>
          </div>
          {leagueTable.map((row, i) => {
            const isMe = row.id === myTeamId;
            const sg = row.gp - row.gc;
            const zone = isMe ? null : getZoneInfo(i + 1, leagueTable.length);
            return (
              <div key={row.id} style={{
                ...styles.tableRow,
                background: isMe ? hexToRgba(mc, 0.1) : i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
                borderLeft: isMe ? `3px solid ${mc}` : zone ? `3px solid ${zone.color}` : '3px solid transparent',
              }}>
                <span style={styles.tablePos}>{i + 1}</span>
                <span
                  onClick={() => !isMe && onViewTeam && onViewTeam(leagueTeams.find(t => t.id === row.id))}
                  style={{ flex: 1, minWidth: 0, fontWeight: isMe ? 700 : 400, color: isMe ? mc : '#F4F1EA', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, cursor: isMe ? 'default' : 'pointer' }}
                >
                  {isMe
                    ? (myTeamLogo ? <img src={myTeamLogo} style={styles.tableCrestImg} alt="" /> : (myTeamBadge && <span style={styles.tableCrestEmoji}>{myTeamBadge}</span>))
                    : (row.clubLogo && <img src={row.clubLogo} style={styles.tableCrestImg} alt="" />)
                  }
                  <span style={{ flex: '1 1 0%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{row.label}</span>
                  {teamForm?.[row.id]?.length > 0 && (
                    <span style={{ display: 'flex', gap: 2, flexShrink: 0 }} title="Forma recente">
                      {teamForm[row.id].map((r, fi) => (
                        <span key={fi} style={{
                          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                          background: r === 'V' ? '#7fd99a' : r === 'D' ? '#e0593f' : '#d4a23c',
                        }} />
                      ))}
                    </span>
                  )}
                </span>
                <span style={styles.tableCell}>{row.pj}</span>
                <span style={{ ...styles.tableCell, color: row.v > 0 ? '#7fd99a' : undefined }}>{row.v}</span>
                <span style={styles.tableCell}>{row.e}</span>
                <span style={{ ...styles.tableCell, color: row.d > 0 ? '#e0593f' : undefined }}>{row.d}</span>
                <span style={styles.tableCell} className="table-col-hide-mobile">{row.gp}</span>
                <span style={styles.tableCell} className="table-col-hide-mobile">{row.gc}</span>
                <span style={{ ...styles.tableCell, color: sg > 0 ? '#7fd99a' : sg < 0 ? '#e0593f' : undefined }}>{sg >= 0 ? `+${sg}` : sg}</span>
                <span style={{ ...styles.tableCell, fontWeight: 700, color: '#d4a23c' }}>{row.pts}</span>
                <span style={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="table-col-hide-mobile">
                  {zone && !isMe && <span title={zone.title} style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, background: `${zone.color}22`, color: zone.color, fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>{zone.label}</span>}
                </span>
              </div>
            );
          })}
          {/* Legenda de zonas */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: 11, opacity: 0.6 }}>
            {[['#22c55e', 'G4 Libertadores (grupos)'], ['#86efac', 'G6 Libertadores (pre)'], ['#60a5fa', 'SA Sul-Americana'], ['#ef4444', 'Z4 Rebaixamento']].map(([c, l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
              </span>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'outra-serie' && otherDivision && (
        <div style={styles.tableSection} className="table-scroll">
          <div style={styles.sectionLabel}>
            Série {otherDivisionLabel} · Rodada {Math.min(otherDivision.round, otherDivision.fixtures.length)} de {otherDivision.fixtures.length}
          </div>
          <p style={{ fontSize: 11.5, opacity: 0.55, margin: '2px 0 12px' }}>
            Só times de IA disputando em paralelo — quando a temporada acabar, quem sobe/desce daqui também conta pra sua Série {myDivision} do ano que vem.
          </p>
          <div style={styles.tableHeaderRow}>
            <span style={styles.tablePos}>#</span>
            <span style={{ flex: 1 }}>Time</span>
            <span style={styles.tableCell}>PJ</span>
            <span style={styles.tableCell}>V</span>
            <span style={styles.tableCell}>E</span>
            <span style={styles.tableCell}>D</span>
            <span style={styles.tableCell} className="table-col-hide-mobile">GP</span>
            <span style={styles.tableCell} className="table-col-hide-mobile">GC</span>
            <span style={styles.tableCell}>SG</span>
            <span style={{ ...styles.tableCell, color: '#d4a23c', fontWeight: 700 }}>PTS</span>
            <span style={{ width: 28 }} className="table-col-hide-mobile"></span>
          </div>
          {otherDivision.table.map((row, i) => {
            const sg = row.gp - row.gc;
            const zone = getZoneInfo(i + 1, otherDivision.table.length);
            return (
              <div key={row.id} style={{
                ...styles.tableRow,
                background: i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
                borderLeft: zone ? `3px solid ${zone.color}` : '3px solid transparent',
              }}>
                <span style={styles.tablePos}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {row.clubLogo && <img src={row.clubLogo} style={styles.tableCrestImg} alt="" />}
                  <span style={{ flex: '1 1 0%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{row.label}</span>
                </span>
                <span style={styles.tableCell}>{row.pj}</span>
                <span style={{ ...styles.tableCell, color: row.v > 0 ? '#7fd99a' : undefined }}>{row.v}</span>
                <span style={styles.tableCell}>{row.e}</span>
                <span style={{ ...styles.tableCell, color: row.d > 0 ? '#e0593f' : undefined }}>{row.d}</span>
                <span style={styles.tableCell} className="table-col-hide-mobile">{row.gp}</span>
                <span style={styles.tableCell} className="table-col-hide-mobile">{row.gc}</span>
                <span style={{ ...styles.tableCell, color: sg > 0 ? '#7fd99a' : sg < 0 ? '#e0593f' : undefined }}>{sg >= 0 ? `+${sg}` : sg}</span>
                <span style={{ ...styles.tableCell, fontWeight: 700, color: '#d4a23c' }}>{row.pts}</span>
                <span style={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="table-col-hide-mobile">
                  {zone && <span title={zone.title} style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, background: `${zone.color}22`, color: zone.color, fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>{zone.label}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'elenco' && (() => {
        const myTeam = leagueTeams.find(t => t.id === myTeamId);
        // Titulares aqui já vêm com a troca automática de suspensos/lesionados
        // aplicada (getEligibleRoster) e ordenados por posição — nunca mostra
        // quem está fora como se estivesse escalado, e quem entrou no lugar
        // some da lista de "Banco" (já é titular). Mesma lógica usada de
        // verdade na simulação da rodada (teamsForRound), só pra exibição.
        const { starters, bench, unavailable } = buildSquadView(myTeam, suspensions, injuries);
        const understaffed = unavailable.some(p => p.shortOnSubs);
        const renderRow = (p, i) => {
          // p.pos é a lista de posições que o jogador PODE jogar, não onde ele
          // foi escalado (um LD com pos ['LD','MD'] pode estar num slot MD) —
          // pra mostrar a posição real usada, busca a vaga pelo slotKey salvo
          // no draft. Exclui slots de banco da busca (`!s.isBench`): um
          // reserva promovido por getEligibleRoster continua com o slotKey
          // de quando estava no banco (ex.: "bench2"), e sem esse filtro a
          // busca encontrava esse slot e usava seu realPos literal "bench"
          // como se fosse a posição do jogador.
          const assignedPos = !p.isBench && pitchSlots.find(s => s.key === p.slotKey && !s.isBench)?.realPos;
          const posLabel = assignedPos || p.pos?.[0] || '-';
          return (
            <div key={`${p.name}-${i}`} style={styles.squadRow}>
              <span style={{ ...styles.squadPos, color: p.isCaptain ? '#d4a23c' : undefined }}>{p.isCaptain ? 'C' : posLabel}</span>
              <span style={styles.squadName}>{p.name}</span>
              <span style={styles.squadTeam}>{p.club || ''}</span>
              <span style={{ ...styles.squadOvr, color: p.isCaptain ? '#d4a23c' : undefined }}>{p.isCaptain ? `${p.ovr} +2` : p.ovr}</span>
            </div>
          );
        };
        const renderUnavailableRow = (p, i) => (
          <div key={`${p.name}-${i}`} style={{ ...styles.squadRow, opacity: 0.5 }}>
            <span style={styles.squadPos}>{p.pos?.[0] || '-'}</span>
            <span style={styles.squadName}>
              {p.name}
              <span title={p.reason === 'suspenso' ? 'Suspenso' : 'Lesionado'} style={{ marginLeft: 6 }}>{p.reason === 'suspenso' ? '🟥' : '🩹'}</span>
              {p.replacementName && <span style={{ display: 'block', fontSize: 10, opacity: 0.8, marginTop: 1 }}>entra: {p.replacementName}</span>}
              {p.shortOnSubs && <span style={{ display: 'block', fontSize: 10, color: '#e05050', marginTop: 1 }}>sem reserva na posição</span>}
            </span>
            <span style={styles.squadTeam}>{p.club || ''}</span>
            <span style={styles.squadOvr}>{p.ovr}</span>
          </div>
        );
        return (
          <div style={styles.squadList}>
            {understaffed && (
              <div style={{ background: 'rgba(224,80,80,0.12)', border: '1px solid rgba(224,80,80,0.35)', borderRadius: 8, padding: '8px 10px', fontSize: 11.5, color: '#e05050', marginBottom: 12 }}>
                ⚠️ Time desfalcado — sem reserva disponível pra uma posição.
              </div>
            )}
            <div style={styles.sectionLabel}>Titulares</div>
            {starters.map(renderRow)}
            {bench.length > 0 && (
              <>
                <div style={{ ...styles.sectionLabel, marginTop: 14 }}>Banco</div>
                {bench.map(renderRow)}
              </>
            )}
            {unavailable.length > 0 && (
              <>
                <div style={{ ...styles.sectionLabel, marginTop: 14 }}>Desfalques</div>
                {unavailable.map(renderUnavailableRow)}
              </>
            )}
          </div>
        );
      })()}

      {activeTab === 'estatisticas' && (
        <SeasonStatsPanel
          scorers={scorers} assisters={assisters} cleanSheets={cleanSheets} seasonRatings={seasonRatings}
          cardCounts={cardCounts} redCards={redCards} leagueTeams={leagueTeams} mc={mc}
        />
      )}

      {activeTab === 'partida' && (
        <>
          {(() => {
            const prefix = `${myTeamId}::`;
            const desfalques = [
              ...Object.entries(suspensions || {}).filter(([k, left]) => left > 0 && k.startsWith(prefix)).map(([k]) => ({ name: k.slice(prefix.length), reason: 'suspenso' })),
              ...Object.entries(injuries || {}).filter(([k, left]) => left > 0 && k.startsWith(prefix)).map(([k]) => ({ name: k.slice(prefix.length), reason: 'lesionado' })),
            ];
            if (desfalques.length === 0) return null;
            const hasInjury = desfalques.some(d => d.reason === 'lesionado');
            return (
              <div style={{ marginTop: 14, background: 'rgba(224,80,80,0.08)', border: '1px solid rgba(224,80,80,0.3)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#e05050', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                  Desfalques no seu time{hasInjury && <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.7 }}> — boletim de {MEDICAL_CHIEF_NAME}</span>}
                </div>
                {desfalques.map((d, i) => (
                  <div key={`${d.name}-${i}`} style={{ fontSize: 13, padding: '2px 0' }}>{d.name} <span style={{ opacity: 0.6, fontSize: 11 }}>({d.reason})</span></div>
                ))}
              </div>
            );
          })()}

          {lastMatchRatings?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <button onClick={() => setShowRatings(s => !s)} className="tap-target-sm" style={{ background: 'none', border: 'none', minHeight: 34, color: mc, fontFamily: "'Space Mono', monospace", fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
                {showRatings ? 'v' : '>'} Notas da última partida
              </button>
              {showRatings && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', marginTop: 6 }}>
                  {[activeUserMatch?.homeId, activeUserMatch?.awayId].map((tid, side) => (
                    <div key={side}>
                      {[...lastMatchRatings].filter(r => r.teamId === tid).sort((a, b) => b.rating - a.rating).map((r, i) => (
                        <div key={`${r.name}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                          <span style={{
                            fontFamily: "'Space Mono', monospace", fontWeight: 700, flexShrink: 0,
                            color: r.rating >= 7.5 ? '#7fd99a' : r.rating < 5.5 ? '#e0593f' : '#F4F1EA',
                          }}>{r.rating.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Historico de partidas */}
          {matchHistory && matchHistory.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <button onClick={() => setShowHistory(h => !h)} className="tap-target-sm" style={{ background: 'none', border: 'none', minHeight: 34, color: mc, fontFamily: "'Space Mono', monospace", fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
                {showHistory ? 'v' : '>'} Historico ({matchHistory.length} partida{matchHistory.length !== 1 ? 's' : ''})
              </button>
              {showHistory && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Uma linha por partida do usuário: rodada, selo V/D/E, mando
                  (vs = casa, @ = fora), adversário e placar. Só o adversário
                  aparece — o outro time é sempre o do usuário, e mostrar os
                  dois nomes era justamente o que estourava a largura e
                  quebrava a linha (o grid de 3 colunas recebia 4 filhos). */}
                  {[...matchHistory].reverse().map((m, i) => {
                    const isHome = m.homeLabel === myLabel;
                    const gf = isHome ? m.hg : m.ag;
                    const ga = isHome ? m.ag : m.hg;
                    const res = gf > ga ? 'V' : gf < ga ? 'D' : 'E';
                    const opponent = isHome ? m.awayLabel : m.homeLabel;
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                        borderRadius: 8, background: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${hexToRgba(RESULT_COLORS[res], 0.28)}`, fontSize: 12.5,
                      }}>
                        <span style={{ fontSize: 9.5, opacity: 0.4, fontFamily: "'Space Mono', monospace", width: 30, flexShrink: 0 }}>
                          {m.gameMode === 'copa' ? (m.legLabel || '').slice(0, 5) : `R${m.round}`}
                        </span>
                        <span style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: RESULT_COLORS[res], color: '#0B1A12', fontSize: 11, fontWeight: 800,
                        }}>{res}</span>
                        <span style={{ fontSize: 10, opacity: 0.4, width: 16, flexShrink: 0, textAlign: 'center' }}>{isHome ? 'vs' : '@'}</span>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opponent}</span>
                        <span style={{
                          fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, flexShrink: 0,
                          color: RESULT_COLORS[res] === RESULT_COLORS.E ? '#F4F1EA' : RESULT_COLORS[res],
                        }}>{gf}-{ga}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// RESULTADO FINAL
// ============================================================
function getMostCommonClub(players = []) {
  const counts = {};
  for (const p of players) { if (p.club) counts[p.club] = (counts[p.club] || 0) + 1; }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

// Gera a imagem (canvas) do card de resultado pra compartilhar. Quando o
// usuário tem um emblema próprio (teamLogo, data URL do upload/crop), ele é
// desenhado de verdade no canvas — é um data: URL local, então carrega na
// hora e não esbarra em CORS. Sem logo, cai no emoji (teamBadge) como antes.
// A altura do canvas cresce dinamicamente pra caber a campanha completa
// (todas as partidas da temporada/copa) quando ela é informada.
function drawResultCard({ title, subtitle, teamLabel, teamBadge, teamLogo, teamColor, stats, awards, campaign }) {
  return new Promise((resolve) => {
    const rowH = 26;
    const height = 900 + (campaign?.length ? 60 + campaign.length * rowH : 0);
    const canvas = document.createElement('canvas');
    canvas.width = 900; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const mc = teamColor || '#d4a23c';

    const grad = ctx.createLinearGradient(0, 0, 900, height);
    grad.addColorStop(0, '#0B1A12');
    grad.addColorStop(1, '#132a1c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 900, height);

    ctx.strokeStyle = hexToRgba(mc, 0.6);
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, 852, height - 48);

    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 22px "Space Mono", monospace';
    ctx.fillText('BRASILEIRÃO LENDÁRIO', 450, 90);

    if (!teamLogo) {
      ctx.font = '140px sans-serif';
      ctx.fillText(teamBadge || '⚽', 450, 260);
    }

    ctx.fillStyle = '#F4F1EA';
    ctx.font = '700 40px Georgia, serif';
    ctx.fillText(teamLabel || 'Meu Time', 450, 330);

    ctx.fillStyle = mc;
    ctx.font = '700 62px Georgia, serif';
    ctx.fillText(title, 450, 420);

    if (subtitle) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '400 26px "Space Mono", monospace';
      ctx.fillText(subtitle, 450, 465);
    }

    if (stats?.length) {
      const statY = 560;
      const spacing = 780 / stats.length;
      stats.forEach((s, i) => {
        const x = 60 + spacing * i + spacing / 2;
        ctx.fillStyle = mc;
        ctx.font = '700 44px "Space Mono", monospace';
        ctx.fillText(String(s.value), x, statY);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '400 18px "Space Mono", monospace';
        ctx.fillText(s.label, x, statY + 30);
      });
    }

    let y = 660;
    if (awards?.length) {
      ctx.fillStyle = 'rgba(212,162,60,0.9)';
      ctx.font = '700 22px Georgia, serif';
      ctx.fillText('🏅 Prêmios da Temporada', 450, y);
      ctx.fillStyle = '#F4F1EA';
      ctx.font = '400 20px "Space Mono", monospace';
      const shownAwards = awards.slice(0, 4);
      shownAwards.forEach((a, i) => ctx.fillText(a, 450, y + 40 + i * 32));
      y += 40 + shownAwards.length * 32 + 30;
    }

    if (campaign?.length) {
      ctx.fillStyle = 'rgba(212,162,60,0.9)';
      ctx.font = '700 22px Georgia, serif';
      ctx.fillText('📋 Campanha Completa', 450, y);
      y += 36;
      ctx.font = '400 18px "Space Mono", monospace';
      campaign.forEach(line => {
        ctx.fillStyle = line.result === 'v' ? '#7fd99a' : line.result === 'd' ? '#e0593f' : 'rgba(255,255,255,0.75)';
        ctx.fillText(line.text, 450, y);
        y += rowH;
      });
    }

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '400 16px "Space Mono", monospace';
    ctx.fillText('monte · escale · seja campeão', 450, height - 40);

    const finish = () => resolve(canvas);

    if (teamLogo) {
      const img = new Image();
      // Escudos oficiais vêm de r2.thesportsdb.com, que não manda cabeçalho
      // CORS nenhum — sem `crossOrigin`, o navegador carrega a imagem numa
      // boa (ela aparece na tela normalmente), mas desenhá-la no canvas
      // "contamina" ele: `canvas.toBlob()` passa a devolver `null` sempre,
      // sem lançar erro nenhum. Era por isso que "Compartilhar resultado"
      // simplesmente não fazia nada — o botão de quem tinha escolhido um
      // escudo oficial (o caso mais comum) sempre caía nesse `null`.
      // `crossOrigin='anonymous'` pede a imagem em modo CORS: como o
      // servidor não responde com o cabeçalho, ela falha (cai no onerror
      // abaixo, que já tinha um fallback pronto pro emblema em texto) em
      // vez de carregar "suja" — pior fica sem o escudo na imagem
      // compartilhada, melhor que o botão inteiro não funcionar.
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(450, 220, 88, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 362, 132, 176, 176);
        ctx.restore();
        finish();
      };
      img.onerror = () => {
        ctx.font = '140px sans-serif';
        ctx.fillText(teamBadge || '⚽', 450, 260);
        finish();
      };
      img.src = teamLogo;
    } else {
      finish();
    }
  });
}

// Botão de compartilhar o card de resultado — usa Web Share API com arquivo
// quando disponível (mobile), senão cai pra download direto do PNG.
function ShareResultButton({ cardData }) {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    trackEvent('share', { method: 'result_card' });
    try {
      const canvas = await drawResultCard(cardData);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;
      const file = new File([blob], 'brasileirao-lendario-resultado.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Brasileirão Lendário', text: cardData.title });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'brasileirao-lendario-resultado.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch { /* usuário cancelou o compartilhamento — sem problema */ }
    finally { setBusy(false); }
  };
  return (
    <button onClick={share} disabled={busy} style={{ ...styles.btnGhost, marginTop: 10, width: '100%' }}>
      {busy ? 'Gerando...' : '📤 Compartilhar resultado'}
    </button>
  );
}

// Carrega o script da API de verdade do YouTube uma única vez por sessão
// (mesmo que vários AnthemPlayer sejam montados ao longo do jogo — Copa e
// Brasileirão podem terminar na mesma sessão). `window.onYouTubeIframeAPIReady`
// é o callback que a própria API do YouTube chama sozinha quando carrega.
let _ytApiPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (_ytApiPromise) return _ytApiPromise;
  _ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return _ytApiPromise;
}

// Antes disso era um <iframe src="...&autoplay=1"> cru, sem mute — e por
// isso NENHUM áudio via YouTube tocava de verdade neste jogo: testado
// direto, os 18 hinos ficavam parados em t=0.00 (paused=true). Navegador
// nenhum autoriza autoplay COM SOM num iframe de terceiro sem gesto do
// usuário; a barrinha animada "tocando" era só estado local do React, não
// refletia áudio nenhum saindo da caixa. O único jeito de tocar som de
// verdade é: 1) autoplay MUDO (isso sim é permitido sempre) via API de
// verdade do YouTube (não dá pra silenciar um iframe cru depois de
// carregado, só via API), e 2) um clique real da pessoa pra desmutar — o
// clique É o gesto que libera o som.
//
// Um hook só, usado pelos TRÊS lugares que tocam áudio via YouTube no jogo
// (hino do campeão, hino no painel de áudio ambiente, link personalizado no
// mesmo painel) — os três tinham exatamente esse bug, cada um com seu
// próprio <iframe> cru.
function useMutedAutoplayYouTube(videoId) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  // 'loading' | 'ready' | 'error' — 'error' cobre tanto vídeo removido
  // quanto incorporação desativada pelo dono.
  const [status, setStatus] = useState('loading');
  const [muted, setMuted] = useState(true);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    setStatus('loading');
    setMuted(true);
    setUserPaused(false);
    if (!videoId) return;
    let cancelled = false;
    let player = null;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;
      player = new YT.Player(containerRef.current, {
        videoId,
        playerVars: { autoplay: 1, mute: 1, controls: 0, playsinline: 1 },
        events: {
          onReady: (e) => { e.target.playVideo(); setStatus('ready'); },
          onError: () => setStatus('error'),
        },
      });
      playerRef.current = player;
    });
    return () => {
      cancelled = true;
      try { player?.destroy(); } catch { }
      playerRef.current = null;
    };
  }, [videoId]);

  const activate = () => {
    try { playerRef.current?.unMute(); playerRef.current?.setVolume(100); } catch { }
    setMuted(false);
  };
  const togglePause = () => {
    try { userPaused ? playerRef.current?.playVideo() : playerRef.current?.pauseVideo(); } catch { }
    setUserPaused(p => !p);
  };

  return { containerRef, status, muted, userPaused, activate, togglePause, playing: status === 'ready' && !userPaused };
}

function AnthemPlayer({ club }) {
  const videoId = CLUB_ANTHEMS[club];
  const { containerRef, status, muted, activate, togglePause, playing } = useMutedAutoplayYouTube(videoId);

  if (!videoId || status === 'error') return null;
  return (
    <div style={{ marginTop: 24, borderRadius: 12, border: '1px solid rgba(212,162,60,0.3)', background: '#0a1a0f', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
      {/* Player de verdade, escondido — só áudio */}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
        <div ref={containerRef} />
      </div>

      {/* Indicador visual */}
      <div style={{ fontSize: 28 }}>🎵</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#d4a23c' }}>Hino do Campeão</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{club}{playing && muted ? ' · mudo até você ativar o som' : ''}</div>
        {playing && (
          <div style={{ display: 'flex', gap: 3, marginTop: 6, alignItems: 'flex-end', height: 16 }}>
            {[8, 14, 10, 16, 6, 12, 10, 14, 8].map((h, i) => (
              <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: '#d4a23c', animation: `pulse ${0.6 + i * 0.1}s ease-in-out infinite alternate`, opacity: muted ? 0.35 : 0.8 }} />
            ))}
          </div>
        )}
      </div>
      {/* Enquanto está mudo, "ativar som" é a ação que importa — é o clique
          que os navegadores exigem pra liberar áudio. Só depois disso faz
          sentido oferecer pausar/retomar. */}
      {status === 'ready' && muted && playing ? (
        <button
          onClick={activate}
          style={{ background: 'rgba(212,162,60,0.15)', border: '1px solid rgba(212,162,60,0.5)', borderRadius: 8, color: '#d4a23c', cursor: 'pointer', padding: '6px 14px', fontSize: 13, fontWeight: 700 }}
        >
          🔊 Ativar som
        </button>
      ) : status === 'ready' && (
        <button
          onClick={togglePause}
          style={{ background: playing ? 'rgba(212,162,60,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${playing ? 'rgba(212,162,60,0.5)' : 'rgba(255,255,255,0.2)'}`, borderRadius: 8, color: playing ? '#d4a23c' : '#aaa', cursor: 'pointer', padding: '6px 14px', fontSize: 13, fontWeight: 600 }}
        >
          {playing ? '⏸ Pausar' : '▶ Tocar'}
        </button>
      )}
    </div>
  );
}

// Escudo do campeão no topo da tela de resultado — antes desse ponto era só
// um emoji genérico (🏆/🥈/⚽), a mesma coisa pra qualquer time. Prioriza o
// escudo de verdade (do próprio jogador se ele venceu, ou do rival
// histórico); cai pro emblema em emoji e por último pro emoji genérico.
function ChampionCrest({ logoUrl, badgeEmoji, fallback, mc }) {
  const [failed, setFailed] = useState(false);
  const size = 104;
  const box = {
    width: size, height: size, borderRadius: '50%', margin: '0 auto 14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    background: hexToRgba(mc, 0.12), border: `2px solid ${hexToRgba(mc, 0.6)}`,
    boxShadow: `0 0 24px ${hexToRgba(mc, 0.25)}`, overflow: 'hidden',
  };
  if (logoUrl && !failed) {
    return (
      <div style={box}>
        <img src={logoUrl} alt="" onError={() => setFailed(true)} style={{ width: '78%', height: '78%', objectFit: 'contain' }} />
      </div>
    );
  }
  return <div style={box}><span style={{ fontSize: 52 }}>{badgeEmoji || fallback}</span></div>;
}

// Faixa de comemoração do campeão — segura um instante em suspense (tipo
// abertura de envelope) antes de soltar a frase em loop tipo painel de
// estádio, pra dar um clímax maior que só cravar o texto na tela de cara.
function ChampionMarquee({ teamLabel, color }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    // Era 1800ms — mas pra quem chegou aqui pela rodada 38 (auto), já tinha
    // acabado de ver "🏆 Revelando o campeão em 3s...2s...1s..." antes
    // disso. Duas esperas seguidas fazendo o mesmo trabalho (criar
    // suspense) só davam a sensação de trava; um respiro curto basta.
    const t = setTimeout(() => setRevealed(true), 700);
    return () => clearTimeout(t);
  }, []);
  const mc = color || '#d4a23c';
  const phrase = `PUTA QUE PARIU, É O MELHOR TIME DO BRASIL: ${(teamLabel || '').toUpperCase()}!`;

  if (!revealed) {
    return (
      <div className="champion-suspense" style={{ textAlign: 'center', padding: '10px 0 18px', fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 3, color: mc, textTransform: 'uppercase' }}>
        🏆 revelando o campeão...
      </div>
    );
  }

  return (
    <div style={{
      overflow: 'hidden', margin: '4px 0 18px', padding: '10px 0',
      background: hexToRgba(mc, 0.08), border: `1px solid ${hexToRgba(mc, 0.3)}`, borderRadius: 10,
      maskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)',
      WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)',
    }}>
      <div className="champion-marquee-track" style={{ display: 'flex', width: 'max-content' }}>
        {[0, 1].map(i => (
          <span key={i} style={{ whiteSpace: 'nowrap', fontFamily: "'Fraunces', Georgia, serif", fontWeight: 800, fontSize: 18, color: mc, paddingRight: 48 }}>
            {phrase} &nbsp;🏆&nbsp; {phrase} &nbsp;🏆&nbsp;
          </span>
        ))}
      </div>
    </div>
  );
}

// Convite pra criar conta no melhor momento possível — logo que a pessoa
// termina uma temporada jogando como convidado (satisfação alta, e sem
// conta esse resultado nem entra no Ranking Global). Dispensa só nessa
// sessão (sem localStorage) — não é a mesma decisão "definitiva" do modal
// de primeira visita, então pode aparecer de novo numa próxima temporada.
function GuestConversionBanner({ myTeamColor, onOpenAccount }) {
  const mc = myTeamColor || '#d4a23c';
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, padding: '12px 14px',
      borderRadius: 12, background: hexToRgba(mc, 0.1), border: `1px solid ${hexToRgba(mc, 0.35)}`,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>🏆</span>
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4 }}>
        <b>Curtiu a temporada?</b> Crie uma conta pra salvar seu time, entrar no Ranking Global e não perder esse progresso.
      </div>
      <button onClick={onOpenAccount} style={{ background: mc, color: '#0B1A12', border: 'none', borderRadius: 8, padding: '7px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
        Criar conta
      </button>
      <button onClick={() => setDismissed(true)} title="Dispensar" aria-label="Dispensar" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, lineHeight: 1, cursor: 'pointer', flexShrink: 0, padding: 0, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
    </div>
  );
}

// Bloco agrupador da tela de fim de campeonato — moldura com a cor do time,
// igual ao padrão já usado no painel de conta (🎙️ Transmissão, ⚽ Comemoração).
// Antes a tela inteira (Copa e Brasileirão) era uma pilha de ~12 blocos soltos
// no mesmo fundo, sem nada separando um do outro visualmente — daí a
// confusão. Cada ResultSection é um "cartão" próprio, com título e ícone.
function ResultSection({ icon, label, mc, children, style }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${hexToRgba(mc, 0.1)}, rgba(0,0,0,0.35))`,
      border: `1px solid ${hexToRgba(mc, 0.28)}`,
      borderRadius: 14, padding: '16px 18px', marginTop: 16,
      ...style,
    }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', color: mc, fontWeight: 700 }}>
          {icon && <span style={{ fontSize: 14 }}>{icon}</span>}{label}
        </div>
      )}
      {children}
    </div>
  );
}

// Artilharia/assistências/defesa/notas/cartões viravam 5 blocos empilhados
// com o mesmo rótulo — o trecho mais poluído da tela antiga. Agora é um
// cartão só, com abas: só uma categoria por vez, trocada por clique.
// `categories` já entram com os dados formatados (não crus), pra este
// componente não precisar saber nada sobre a forma dos dados do jogo.
function ResultStatsTabs({ mc, title, categories }) {
  const available = categories.filter(c => c.entries.length > 0);
  const [tabId, setTabId] = useState(available[0]?.id);
  if (available.length === 0) return null;
  const active = available.find(c => c.id === tabId) || available[0];
  return (
    <ResultSection icon="🏅" label={title} mc={mc}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {available.map(c => (
          <button
            key={c.id}
            onClick={() => setTabId(c.id)}
            className="tap-target-sm"
            style={{
              fontFamily: "'Space Mono', monospace", fontSize: 11.5, fontWeight: 700,
              padding: '6px 11px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${active.id === c.id ? mc : 'rgba(255,255,255,0.15)'}`,
              background: active.id === c.id ? hexToRgba(mc, 0.16) : 'rgba(255,255,255,0.03)',
              color: active.id === c.id ? mc : 'rgba(244,241,234,0.6)',
            }}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      {active.entries.map((row, i) => (
        <ResultStatRow key={row.key} rank={i + 1} name={row.name} team={row.team} value={row.value} mc={mc} />
      ))}
    </ResultSection>
  );
}

// Rodapé de ações da tela de fim de campeonato. Antes eram 3 botões
// empilhados (2 "ghost" + 1 "primary") sem deixar claro qual era a ação
// principal — e o mais provável de continuar jogando ("Nova temporada com
// o mesmo elenco") vinha estilizado como secundário, enquanto "Jogar de
// novo" (começar um time do ZERO) é que levava o destaque visual. Invertido
// aqui: continuar é o CTA principal; recomeçar do zero fica disponível mas
// discreto. Em multiplayer (onNewSeason indisponível) "Jogar de novo" vira
// o principal, por ser a única opção.
function ResultActions({ mc, onNewSeason, onOpenTransferMarket, onRestart, isLeader, onRematch }) {
  return (
    <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {onNewSeason ? (
        <>
          <button style={{ ...styles.btnPrimary, width: '100%', background: mc, color: '#0B1A12' }} onClick={onNewSeason}>
            ▶ Nova temporada com o mesmo elenco
          </button>
          {onOpenTransferMarket && (
            <button style={{ ...styles.btnGhost, width: '100%', marginTop: 0 }} onClick={onOpenTransferMarket}>
              🔁 Mercado de transferências (trocar até 2)
            </button>
          )}
          <button style={{ ...styles.btnGhost, width: '100%', marginTop: 0, opacity: 0.75 }} onClick={onRestart}>
            Jogar de novo (time novo, do zero)
          </button>
        </>
      ) : onRematch ? (
        // Multiplayer: sem "Nova temporada"/"Mercado" (reconstroem em torno
        // de MY_TEAM_ID, que não existe numa sala — ver comentário no
        // chamador). Só o líder decide a revanche; convidado só acompanha
        // (o efeito de `roomSnap.phase === 'lobby'` já leva todo mundo de
        // volta pra sala sozinho assim que o líder confirma).
        isLeader ? (
          <>
            <button style={{ ...styles.btnPrimary, width: '100%', background: mc, color: '#0B1A12' }} onClick={onRematch}>
              🔁 Jogar de novo com o mesmo grupo
            </button>
            <button style={{ ...styles.btnGhost, width: '100%', marginTop: 0, opacity: 0.75 }} onClick={onRestart}>
              Sair da sala
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', fontSize: 12.5, opacity: 0.55, padding: '4px 0 2px' }}>
              Aguardando o líder decidir a próxima partida…
            </div>
            <button style={{ ...styles.btnGhost, width: '100%', marginTop: 0 }} onClick={onRestart}>
              Sair da sala
            </button>
          </>
        )
      ) : (
        <button style={{ ...styles.btnPrimary, width: '100%', background: mc, color: '#0B1A12' }} onClick={onRestart}>
          Jogar de novo
        </button>
      )}
    </div>
  );
}

// Linha de ranking da tela de resultado: posição, nome, time e valor. O time
// é o que separa dois homônimos de elencos diferentes — sem ele os rankings
// mostravam "Gabigol / Gabigol" em sequência e pareciam quebrados.
function ResultStatRow({ rank, name, team, value, mc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
      <span style={{ width: 20, flexShrink: 0, opacity: 0.4, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{rank}.</span>
      {/* O nome do jogador tem prioridade: quem encolhe primeiro é o nome do
          time, que só está aqui pra desempatar homônimos. */}
      <span style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 6, overflow: 'hidden' }}>
        <span style={{ flexShrink: 0, maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        {team && (
          <span style={{ opacity: 0.45, fontSize: 11, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team}</span>
        )}
      </span>
      <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: mc, flexShrink: 0, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

// Resultado do Desafio do Dia — tela própria, mais simples que a de uma
// temporada de verdade (sem tabela, sem prêmios, sem "Nova Temporada"): é
// uma partida avulsa só pra divertir, então o placar e um "volte amanhã"
// já contam a história inteira.
function DailyChallengeResults({ leagueTable, myTeamId, myTeamColor, myTeamBadge, myTeamLogo, leagueTeams, currentUser, onExit }) {
  const mc = myTeamColor || '#d4a23c';
  const myRow = leagueTable.find(t => t.id === myTeamId) || {};
  const oppRow = leagueTable.find(t => t.id !== myTeamId) || {};
  const oppTeam = leagueTeams?.find(t => t.id !== myTeamId);
  const myGoals = myRow.gp ?? 0;
  const oppGoals = oppRow.gp ?? 0;
  const result = myGoals > oppGoals ? 'win' : myGoals < oppGoals ? 'loss' : 'draw';
  // Vitória mostra o MEU escudo (fui campeão do confronto), não o do
  // adversário — mesmo padrão do Results de temporada (championLogo).
  const crestLogo = result === 'win' ? myTeamLogo : oppTeam?.clubLogo;
  return (
    <div style={styles.card} className="card-mob">
      <div style={{ textAlign: 'center' }}>
        <ChampionCrest
          logoUrl={crestLogo}
          badgeEmoji={result === 'win' ? myTeamBadge : null}
          fallback={result === 'win' ? '🏆' : result === 'draw' ? '🤝' : '😮'}
          mc={mc}
        />
      </div>
      <div style={styles.eyebrow}>Supercopa do Brasil</div>
      <h1 style={styles.h1} className="h1-mob">
        {result === 'win' ? 'VITÓRIA!' : result === 'draw' ? 'EMPATE' : 'DERROTA'}
      </h1>
      <div style={{ textAlign: 'center', fontSize: 26, fontWeight: 700, margin: '10px 0 4px', fontFamily: "'Space Mono', monospace", color: mc }}>
        {myGoals} × {oppGoals}
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, opacity: 0.6, marginBottom: 20 }}>vs {oppTeam?.label}</div>
      <p style={{ fontSize: 13, opacity: 0.7, textAlign: 'center', lineHeight: 1.5, marginBottom: 8 }}>
        {result === 'win' && 'Time montado do zero derrubou um time lendário — levou a Supercopa de hoje!'}
        {result === 'draw' && 'Ficou tudo igual contra o time lendário de hoje — tenta desempatar amanhã, com outro adversário.'}
        {result === 'loss' && 'O time lendário de hoje levou a melhor — volta amanhã pra outro confronto e tenta de novo.'}
      </p>
      {result === 'win' && currentUser && (
        <div style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: mc, marginBottom: 8 }}>
          +50 pontos no ranking global 🏆
        </div>
      )}
      <div style={{ textAlign: 'center', fontSize: 11, opacity: 0.5, marginBottom: 22 }}>
        Só dá pra jogar a Supercopa do Brasil uma vez por dia — volta amanhã pra outro time lendário.
      </div>
      <button style={{ ...styles.btnPrimary, width: '100%', background: mc, color: '#0B1A12' }} onClick={onExit}>
        Voltar à home →
      </button>
    </div>
  );
}

function Results({ leagueTable, myTeamId, myTeamColor, myTeamBadge, myTeamLogo, gameMode, cupWinnerId, eliminationRoundName, leagueTeams, onRestart, isLeader, onRematch, scorers, assisters, cleanSheets, seasonRatings, cardCounts, redCards, seasonAwards, onNewSeason, onOpenTransferMarket, matchHistory, onViewTeam, currentUser, onOpenAccount, myDivision, divisionMove, promotionTie, otherDivision }) {
  const mc = myTeamColor || '#d4a23c';
  const [showCampaign, setShowCampaign] = useState(false);
  const [showOtherDivision, setShowOtherDivision] = useState(false);
  // Nome do time dono da chave time::nome — jogadores reais se repetem entre
  // elencos de anos diferentes (Gabigol no Flamengo 2019 e no 2020), e sem
  // isso os rankings mostravam o mesmo nome duas vezes seguidas, parecendo
  // bug. O painel de estatísticas durante a temporada já fazia certo.
  const teamOf = (key, d) => d?.teamLabel || leagueTeams?.find(t => t.id === splitPlayerKey(key).teamId)?.label || '';
  // Formata uma lista [chave, dado] pro formato que ResultStatsTabs espera —
  // já com nome/time resolvidos, não a chave crua.
  const toRows = (entries, valueFn) => entries.map(([key, d]) => ({
    key, name: splitPlayerKey(key).name, team: teamOf(key, d), value: valueFn(d, key),
  }));
  const topScorers = scorers ? Object.entries(scorers).sort((a, b) => b[1].goals - a[1].goals).slice(0, 3) : [];
  const topAssisters = assisters ? Object.entries(assisters).sort((a, b) => b[1].assists - a[1].assists).slice(0, 3) : [];
  const topCleanSheets = cleanSheets
    ? Object.entries(cleanSheets).filter(([, d]) => d.clean > 0).sort((a, b) => b[1].clean - a[1].clean).slice(0, 3)
    : [];
  const topRatings = seasonRatings
    ? Object.entries(seasonRatings).filter(([, d]) => d.count >= 3).sort((a, b) => (b[1].sum / b[1].count) - (a[1].sum / a[1].count)).slice(0, 3)
    : [];
  const topCards = cardCounts ? Object.entries(cardCounts).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
  // As 5 categorias que antes eram 5 blocos empilhados na tela — agora
  // abas de um cartão só (ResultStatsTabs), compartilhado por Copa e
  // Brasileirão.
  const statCategories = [
    { id: 'artilharia', icon: '⚽', label: 'Artilharia', entries: toRows(topScorers, d => `gol ${d.goals}`) },
    { id: 'assist', icon: '🎯', label: 'Assistências', entries: toRows(topAssisters, d => `assist ${d.assists}`) },
    { id: 'defesa', icon: '🧤', label: 'Defesa', entries: toRows(topCleanSheets, d => `🧤 ${d.clean}`) },
    { id: 'notas', icon: '⭐', label: 'Notas', entries: toRows(topRatings, d => `⭐ ${(d.sum / d.count).toFixed(1)}`) },
    { id: 'cartoes', icon: '🟨', label: 'Cartões', entries: toRows(topCards, (yellows, key) => `${redCards?.[key] > 0 ? `🟥×${redCards[key]}  ` : ''}🟨 ${yellows}`) },
  ];

  // Campanha completa (todas as partidas do usuario nesta temporada/copa, na ordem) —
  // usada tanto na tela de resultado quanto no card compartilhavel.
  const myLabel = leagueTeams?.find(t => t.id === myTeamId)?.label || 'Meu Time';
  const campaignLines = (matchHistory || [])
    .filter(m => m.gameMode === gameMode)
    .map(m => {
      const isHome = m.homeLabel === myLabel;
      const my = isHome ? m.hg : m.ag;
      const opp = isHome ? m.ag : m.hg;
      const result = my > opp ? 'v' : my < opp ? 'd' : 'e';
      const oppLabel = isHome ? m.awayLabel : m.homeLabel;
      const roundLabel = gameMode === 'copa'
        ? `${CUP_ROUND_NAMES[Math.min((m.round || 1) - 1, CUP_ROUND_NAMES.length - 1)]}${m.legLabel ? ` (${m.legLabel})` : ''}`
        : m.legLabel ? m.legLabel : `Rodada ${m.round}`;
      return { result, text: `${roundLabel}: ${isHome ? 'vs' : '@'} ${oppLabel} ${my}-${opp}` };
    });

  // ── COPA ────────────────────────────────────────────────────
  if (gameMode === 'copa') {
    const winner = leagueTeams?.find(t => t.id === cupWinnerId);
    const userWon = cupWinnerId === myTeamId;
    // Quem perde a DECISÃO é vice-campeão, não "eliminado antes da final".
    // A mensagem antiga era a mesma pra quem caiu nos 16 avos e pra quem
    // chegou à final — apagava justamente a melhor campanha possível sem o
    // título. `eliminationRoundName` já guarda "Final" nesse caso.
    const wasRunnerUp = !userWon && eliminationRoundName === 'Final';
    const champClub = winner?.club || getMostCommonClub(winner?.players);
    // Escudo de verdade no lugar do emoji genérico — o campeão pode ser o
    // PRÓPRIO time do jogador (emblema escolhido por ele) ou um rival
    // histórico (escudo oficial do clube, vindo de leagueTeams).
    const championLogo = userWon ? myTeamLogo : winner?.clubLogo;
    return (
      <div style={styles.card} className="card-mob">
        <div style={{ textAlign: 'center', padding: '12px 0 28px' }}>
          <ChampionCrest logoUrl={championLogo} badgeEmoji={userWon ? myTeamBadge : null} fallback={userWon ? '🏆' : wasRunnerUp ? '🥈' : '⚽'} mc={mc} />
          <div style={styles.eyebrow}>Copa do Brasil — Resultado Final</div>
          <h1 style={{ ...styles.h1, color: userWon ? mc : '#F4F1EA', marginTop: 8 }}>
            {userWon ? 'CAMPEAO!' : wasRunnerUp ? 'VICE-CAMPEAO' : 'Copa encerrada'}
          </h1>
          <div style={{ fontSize: 15, opacity: 0.7, marginBottom: 20 }}>
            {userWon
              ? `${myTeamBadge || ''} ${myTeamBadge ? ' ' : ''}Seu time conquistou a Copa do Brasil!`
              : <>Campeao: <b style={{ color: '#d4a23c' }}>{winner?.label ?? '-'}</b></>
            }
          </div>
          {!userWon && myTeamBadge && (
            <div style={styles.badgeMuted}>
              {wasRunnerUp
                ? 'Seu time chegou à decisão e perdeu a final. Faltou pouco!'
                : 'Seu time foi eliminado antes da final. Tente de novo!'}
            </div>
          )}
          {userWon && <div style={styles.badge}>Copa do Brasil conquistada! Time lendario!</div>}
        </div>
        <ChampionMarquee teamLabel={winner?.label} color={mc} />
        {/* O hino sobe pra logo abaixo da faixa de revelação — antes ficava
            no meio da tela, sem nenhuma ligação com o momento em que o
            campeão é anunciado. */}
        <AnthemPlayer club={champClub} />
        {!currentUser && <GuestConversionBanner myTeamColor={myTeamColor} onOpenAccount={onOpenAccount} />}

        {seasonAwards?.length > 0 && (
          <ResultSection icon="🏆" label="Prêmios da Temporada" mc={mc}>
            {seasonAwards.map(a => (
              <div key={a.reason} style={{ fontSize: 13, padding: '3px 0' }}>
                <b>{a.name}</b> — {a.reason} <span style={{ color: mc, fontWeight: 700 }}>(+{SEASON_AWARD_BONUS} OVR)</span>
              </div>
            ))}
          </ResultSection>
        )}

        <ResultStatsTabs mc={mc} title="Destaques da Copa" categories={statCategories} />

        {campaignLines.length > 0 && (
          <ResultSection icon="📋" label="Campanha" mc={mc}>
            <button onClick={() => setShowCampaign(s => !s)} className="tap-target-sm" style={{ background: 'none', border: 'none', minHeight: 34, color: mc, fontFamily: "'Space Mono', monospace", fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
              {showCampaign ? '▾' : '▸'} Ver todas as partidas ({campaignLines.length})
            </button>
            {showCampaign && campaignLines.map((l, i) => (
              <div key={i} style={{ fontSize: 13, padding: '3px 0', color: l.result === 'v' ? '#7fd99a' : l.result === 'd' ? '#e0593f' : '#F4F1EA' }}>{l.text}</div>
            ))}
          </ResultSection>
        )}

        <div style={{ marginTop: 16 }}>
          <ShareResultButton cardData={{
            title: userWon ? 'CAMPEÃO!' : wasRunnerUp ? 'VICE-CAMPEÃO' : 'Eliminado',
            subtitle: userWon ? 'Copa do Brasil' : `Copa do Brasil · Campeão: ${winner?.label ?? '-'}`,
            teamLabel: leagueTeams?.find(t => t.id === myTeamId)?.label || 'Meu Time',
            teamBadge: myTeamBadge, teamLogo: myTeamLogo, teamColor: myTeamColor,
            awards: seasonAwards?.map(a => `${a.name} — ${a.reason}`),
            campaign: campaignLines,
          }} />
        </div>
        <ResultActions mc={mc} onNewSeason={onNewSeason} onOpenTransferMarket={onOpenTransferMarket} onRestart={onRestart} isLeader={isLeader} onRematch={onRematch} />
      </div>
    );
  }

  // ── BRASILEIRAO ─────────────────────────────────────────────
  const pos = leagueTable.findIndex(t => t.id === myTeamId) + 1;
  const myRow = leagueTable.find(t => t.id === myTeamId) || {};
  const champion = leagueTable[0];
  const isChampion = pos === 1;
  const podium = pos <= 3;
  const champTeam = leagueTeams?.find(t => t.id === champion?.id);
  const champClub = champTeam?.club || getMostCommonClub(champTeam?.players);
  const championLogo = isChampion ? myTeamLogo : champTeam?.clubLogo;

  return (
    <div style={styles.card} className="card-mob">
      <div style={{ textAlign: 'center' }}>
        <ChampionCrest logoUrl={championLogo} badgeEmoji={isChampion ? myTeamBadge : null} fallback={isChampion ? '🏆' : podium ? '🥉' : '⚽'} mc={mc} />
      </div>
      <div style={styles.eyebrow}>{gameMode === 'serieab' ? `Fim da Série ${myDivision}` : 'Fim do Brasileirao · Serie A'}</div>
      <h1 style={styles.h1} className="h1-mob">
        {isChampion ? 'CAMPEAO!' : podium ? `${pos}o lugar — podio!` : `${pos}o lugar`}
      </h1>

      <ChampionMarquee teamLabel={champion?.label} color={mc} />
      {/* O hino sobe pra logo abaixo da faixa de revelação — antes ficava
          no meio da tela, sem nenhuma ligação com o momento em que o
          campeão é anunciado. */}
      <AnthemPlayer club={champClub} />
      {!currentUser && <GuestConversionBanner myTeamColor={myTeamColor} onOpenAccount={onOpenAccount} />}

      {/* Acesso/queda — o aviso que faltava pra "Série A/B" fazer sentido de
          verdade: sem ele, promoção e rebaixamento aconteciam por baixo dos
          panos e só se refletiam na temporada seguinte, sem nenhum
          reconhecimento na hora. */}
      {gameMode === 'serieab' && divisionMove && (
        <ResultSection
          icon={divisionMove === 'promoted' ? '🎉' : divisionMove === 'relegated' ? '📉' : '📋'}
          label={divisionMove === 'promoted' ? 'Promovido!' : divisionMove === 'relegated' ? 'Rebaixado' : 'Situação na Tabela'}
          mc={mc}
        >
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>
            {divisionMove === 'relegated' && `Terminou em ${pos}º lugar na Série A e caiu para a Série B na próxima temporada.`}
            {divisionMove === 'promoted' && promotionTie?.aggMine != null &&
              `Venceu o mata-mata de acesso contra ${promotionTie.opponentLabel} (agregado ${promotionTie.aggMine}-${promotionTie.aggOpp}) e subiu para a Série A!`}
            {divisionMove === 'promoted' && promotionTie?.aggMine == null &&
              `Terminou em ${pos}º lugar na Série B — acesso direto à Série A na próxima temporada!`}
            {divisionMove === 'stayed' && myDivision === 'B' && promotionTie?.aggMine != null &&
              `Perdeu o mata-mata de acesso contra ${promotionTie.opponentLabel} (agregado ${promotionTie.aggMine}-${promotionTie.aggOpp}) — segue na Série B.`}
            {divisionMove === 'stayed' && myDivision === 'B' && promotionTie?.aggMine == null &&
              `Terminou em ${pos}º lugar na Série B — segue na mesma divisão na próxima temporada.`}
            {divisionMove === 'stayed' && myDivision === 'A' &&
              `Terminou em ${pos}º lugar na Série A — segue na mesma divisão na próxima temporada.`}
          </div>
        </ResultSection>
      )}

      {/* Divisão espelho (só IA) — existia calculada há tempos (é dela que
          vem quem sobe/desce do outro lado), mas não tinha jeito nenhum de
          ver o resultado final, nem aqui nem durante a temporada. */}
      {gameMode === 'serieab' && otherDivision && (
        <ResultSection icon="🔭" label={`Como terminou a Série ${myDivision === 'A' ? 'B' : 'A'}`} mc={mc}>
          <button
            onClick={() => setShowOtherDivision(v => !v)}
            style={{ background: 'none', border: 'none', color: mc, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: showOtherDivision ? 12 : 0 }}
          >
            {showOtherDivision ? '▾' : '▸'} Ver classificação final ({otherDivision.table.length} times)
          </button>
          {showOtherDivision && (
            <div className="table-scroll">
              <div style={styles.tableHeaderRow}>
                <span style={styles.tablePos}>#</span>
                <span style={{ flex: 1 }}>Time</span>
                <span style={styles.tableCell}>PJ</span>
                <span style={{ ...styles.tableCell, color: '#d4a23c', fontWeight: 700 }}>PTS</span>
              </div>
              {otherDivision.table.map((row, i) => {
                const zone = getZoneInfo(i + 1, otherDivision.table.length);
                return (
                  <div key={row.id} style={{
                    ...styles.tableRow,
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
                    borderLeft: zone ? `3px solid ${zone.color}` : '3px solid transparent',
                  }}>
                    <span style={styles.tablePos}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {row.clubLogo && <img src={row.clubLogo} style={styles.tableCrestImg} alt="" />}
                      <span style={{ flex: '1 1 0%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{row.label}</span>
                      {zone && <span title={zone.title} style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, background: `${zone.color}22`, color: zone.color, fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>{zone.label}</span>}
                    </span>
                    <span style={styles.tableCell}>{row.pj}</span>
                    <span style={{ ...styles.tableCell, fontWeight: 700, color: '#d4a23c' }}>{row.pts}</span>
                  </div>
                );
              })}
            </div>
          )}
        </ResultSection>
      )}

      <ResultSection icon="📊" label="Seu Desempenho" mc={mc}>
        {!isChampion && (
          <div style={{ ...styles.championBox, marginBottom: 14 }}>
            Campeao: <b>{champion?.label}</b> — {champion?.pts} pts
          </div>
        )}
        <div style={{ ...styles.finalStats, marginBottom: 0 }} className="stats-grid-3">
          <Stat label="Pontos" value={myRow.pts ?? 0} />
          <Stat label="Vitorias" value={myRow.v ?? 0} />
          <Stat label="Empates" value={myRow.e ?? 0} />
          <Stat label="Derrotas" value={myRow.d ?? 0} />
          <Stat label="Gols pro" value={myRow.gp ?? 0} />
          <Stat label="Gols contra" value={myRow.gc ?? 0} />
        </div>
        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
          {isChampion && '🏆 Brasileirão conquistado! Você montou um time lendário.'}
          {!isChampion && podium && '🥉 Campanha sólida — faltou pouco pra vencer!'}
          {!podium && 'Campanha difícil. Tente montar um time mais equilibrado.'}
        </div>
      </ResultSection>

      {seasonAwards?.length > 0 && (
        <ResultSection icon="🏆" label="Prêmios da Temporada" mc={mc}>
          {seasonAwards.map(a => (
            <div key={a.reason} style={{ fontSize: 13, padding: '3px 0' }}>
              <b>{a.name}</b> — {a.reason} <span style={{ color: mc, fontWeight: 700 }}>(+{SEASON_AWARD_BONUS} OVR)</span>
            </div>
          ))}
        </ResultSection>
      )}

      <ResultStatsTabs mc={mc} title="Destaques da Temporada" categories={statCategories} />

      <ResultSection icon="📈" label="Classificação Final" mc={mc}>
      <div className="table-scroll">
        <div style={styles.tableHeaderRow}>
          <span style={styles.tablePos}>#</span>
          <span style={{ flex: 1 }}>Time</span>
          <span style={styles.tableCell}>PJ</span>
          <span style={styles.tableCell}>V</span>
          <span style={styles.tableCell}>E</span>
          <span style={styles.tableCell}>D</span>
          <span style={styles.tableCell} className="table-col-hide-mobile">GP</span>
          <span style={styles.tableCell} className="table-col-hide-mobile">GC</span>
          <span style={styles.tableCell}>SG</span>
          <span style={{ ...styles.tableCell, color: '#d4a23c', fontWeight: 700 }}>PTS</span>
        </div>
        {leagueTable.map((row, i) => {
          const isMe = row.id === myTeamId;
          const sg = row.gp - row.gc;
          const zone = isMe ? null : getZoneInfo(i + 1, leagueTable.length);
          return (
            <div key={row.id} style={{
              ...styles.tableRow,
              background: isMe ? hexToRgba(mc, 0.1) : i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
              borderLeft: isMe ? `3px solid ${mc}` : zone ? `3px solid ${zone.color}` : '3px solid transparent',
            }}>
              <span style={styles.tablePos}>{i + 1}</span>
              <span
                onClick={() => !isMe && onViewTeam && onViewTeam(leagueTeams.find(t => t.id === row.id))}
                style={{ flex: 1, minWidth: 0, fontWeight: isMe ? 700 : 400, color: isMe ? mc : '#F4F1EA', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: isMe ? 'default' : 'pointer' }}
              >
                {isMe
                  ? (myTeamLogo
                    ? <img src={myTeamLogo} style={styles.tableCrestImg} alt="" />
                    : (myTeamBadge && <span style={styles.tableCrestEmoji}>{myTeamBadge}</span>))
                  : (row.clubLogo && <img src={row.clubLogo} style={styles.tableCrestImg} alt="" />)
                }
                <span style={{ flex: '1 1 0%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{row.label}</span>
              </span>
              <span style={styles.tableCell}>{row.pj}</span>
              <span style={styles.tableCell}>{row.v}</span>
              <span style={styles.tableCell}>{row.e}</span>
              <span style={styles.tableCell}>{row.d}</span>
              <span style={styles.tableCell} className="table-col-hide-mobile">{row.gp}</span>
              <span style={styles.tableCell} className="table-col-hide-mobile">{row.gc}</span>
              <span style={styles.tableCell}>{sg >= 0 ? `+${sg}` : sg}</span>
              <span style={{ ...styles.tableCell, fontWeight: 700, color: '#d4a23c' }}>{row.pts}</span>
            </div>
          );
        })}
      </div>{/* /table-scroll */}
      </ResultSection>

      {campaignLines.length > 0 && (
        <ResultSection icon="📋" label="Campanha" mc={mc}>
          <button onClick={() => setShowCampaign(s => !s)} className="tap-target-sm" style={{ background: 'none', border: 'none', minHeight: 34, color: mc, fontFamily: "'Space Mono', monospace", fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
            {showCampaign ? '▾' : '▸'} Ver todas as partidas ({campaignLines.length})
          </button>
          {showCampaign && campaignLines.map((l, i) => (
            <div key={i} style={{ fontSize: 13, padding: '3px 0', color: l.result === 'v' ? '#7fd99a' : l.result === 'd' ? '#e0593f' : '#F4F1EA' }}>{l.text}</div>
          ))}
        </ResultSection>
      )}

      <div style={{ marginTop: 16 }}>
        <ShareResultButton cardData={{
          title: isChampion ? 'CAMPEÃO!' : `${pos}º lugar`,
          subtitle: gameMode === 'serieab' ? `Brasileirão · Série ${myDivision}` : 'Brasileirão · Série A',
          teamLabel: leagueTeams?.find(t => t.id === myTeamId)?.label || 'Meu Time',
          teamBadge: myTeamBadge, teamLogo: myTeamLogo, teamColor: myTeamColor,
          campaign: campaignLines,
          stats: [
            { label: 'PTS', value: myRow.pts ?? 0 },
            { label: 'V', value: myRow.v ?? 0 },
            { label: 'E', value: myRow.e ?? 0 },
            { label: 'D', value: myRow.d ?? 0 },
          ],
          awards: seasonAwards?.map(a => `${a.name} — ${a.reason}`),
        }} />
      </div>
      <ResultActions mc={mc} onNewSeason={onNewSeason} onOpenTransferMarket={onOpenTransferMarket} onRestart={onRestart} isLeader={isLeader} onRematch={onRematch} />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.statBox}>
      <div style={styles.finalStatValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

// ============================================================
// ESTILO
// ============================================================
const globalCss = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  button { cursor: pointer; font-family: inherit; }
  button:focus-visible { outline: 2px solid #d4a23c; outline-offset: 2px; }
  button:disabled { cursor: not-allowed; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes fadeSlideIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

  /* ── Transição do chaveamento ────────────────────────────────
     Quando uma fase termina, o chaveamento abre e os classificados "sobem"
     pros blocos da fase seguinte. Três peças que rodam juntas: a linha que
     leva o time se desenha, o bloco de destino aparece, e o nome de quem
     passou pisca em dourado. */
  @keyframes bkDraw { from { stroke-dashoffset: var(--bk-len); } to { stroke-dashoffset: 0; } }
  @keyframes bkLand {
    0%   { opacity: 0; transform: scale(0.9); }
    60%  { opacity: 1; transform: scale(1.04); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes bkFlash {
    0%, 100% { box-shadow: inset 0 0 0 1.5px ${'#f0c040'}; }
    50%      { box-shadow: inset 0 0 0 2.5px ${'#f0c040'}, 0 0 16px ${'rgba(240,192,64,0.65)'}; }
  }
  @keyframes bkTrophy {
    0%   { opacity: 0; transform: translateY(10px) scale(0.7); }
    70%  { opacity: 1; transform: translateY(0) scale(1.15); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  .bk-draw  { animation: bkDraw 0.55s ease-out both; }
  .bk-land  { animation: bkLand 0.45s cubic-bezier(0.2,0.9,0.3,1.2) both; }
  .bk-flash { animation: bkFlash 0.8s ease-in-out 2; }
  .bk-trophy { animation: bkTrophy 0.7s cubic-bezier(0.2,0.9,0.3,1.3) both; }
  @media (prefers-reduced-motion: reduce) {
    .bk-draw, .bk-land, .bk-flash, .bk-trophy { animation: none !important; }
  }

  .marquee-track { animation: marquee 48s linear infinite; will-change: transform; }
  .marquee-track:hover { animation-play-state: paused; }
  .champion-marquee-track { animation: marquee 10s linear infinite; will-change: transform; }
  @keyframes suspensePulse {
    0%, 100% { opacity: 0.55; transform: scale(0.97); text-shadow: 0 0 0 rgba(212,162,60,0); }
    50% { opacity: 1; transform: scale(1.04); text-shadow: 0 0 20px rgba(212,162,60,0.65); }
  }
  .champion-suspense { animation: suspensePulse 0.65s ease-in-out infinite; }
  .feat-card-hover:hover { border-color: rgba(212,162,60,0.4) !important; transform: translateY(-2px); }
  /* Rótulo dos ícones do cabeçalho (Compartilhar/Áudio/Ranking/Novidades) só
     aparece com bastante espaço sobrando — abaixo disso vira só ícone (com
     tooltip via title) pra não espremer contra "Continuar"/"Desafio do Dia"
     e o botão de conta na mesma linha. */
  .header-action-label { display: none; }
  @media (min-width: 1500px) {
    .header-action-label { display: inline; }
  }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
  /* Área de toque mínima recomendada (~44px) sem inflar o botão visualmente —
     um pseudo-elemento invisível estica a região clicável ao redor. Vale por
     TIPO DE PONTEIRO, não por largura de tela: um iPad em paisagem tem 1024px
     e continua sendo dedo. */
  @media (pointer: coarse) {
    .tap-target-sm { position: relative; }
    .tap-target-sm::after { content: ''; position: absolute; inset: -10px; }
  }
  @media (max-width: 768px) {
    .draft-layout-grid { grid-template-columns: 1fr !important; }
    .draft-layout-grid > div:first-child { order: 2; }
    .draft-layout-grid > div:last-child { order: 1; max-height: none !important; position: static !important; }
    .draft-left { max-height: 50vh !important; }
    .pitch-field { max-width: 300px !important; margin: 0 auto; }
    .main-pad { padding: 16px 12px 60px !important; }
    .header-inner-pad { padding: 12px 14px !important; flex-wrap: wrap !important; row-gap: 8px !important; }
    .header-title-h { font-size: 15px !important; line-height: 1.2 !important; }
    .header-subtitle-h { font-size: 9px !important; }
    /* Título+logo numa "linha" e os botões (áudio/ranking/conta) na linha de
       baixo, ocupando a largura toda — sem isso eles brigavam pelo mesmo
       espaço e o botão de login quebrava em 3 linhas espremido num canto. */
    .header-actions-h { flex-basis: 100% !important; margin-left: 0 !important; justify-content: flex-end !important; flex-wrap: wrap !important; row-gap: 6px !important; }
    .header-account-btn { padding: 6px 10px !important; font-size: 11px !important; }
    .intro-title-h { font-size: 26px !important; line-height: 1.2 !important; }
    .feat-grid-3 { grid-template-columns: 1fr 1fr !important; }
    .difficulty-grid { grid-template-columns: 1fr 1fr !important; }
    .stats-grid-3 { grid-template-columns: 1fr 1fr !important; }
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    /* GP/GC somem no mobile (sobra SG, que já resume os dois) — sem isso as
       tabelas de classificação empurravam o PTS (a coluna mais importante)
       pra fora da tela, escondido atrás de um scroll horizontal que ninguém
       descobria sozinho. */
    .table-col-hide-mobile { display: none !important; }
    .card-mob { padding: 16px 12px !important; }
    .live-score-n { font-size: 20px !important; min-width: 18px !important; }
    .live-teams-row { gap: 6px !important; }
    .live-team-n { font-size: 12px !important; }
    .squad-row-g { grid-template-columns: 36px 1fr auto 36px !important; gap: 8px !important; }
    .pitch-spot { font-size: 8px !important; }
    .pitch-spot-circle { width: 40px !important; height: 40px !important; }
    .pitch-spot-name { font-size: 7px !important; }
    .h1-mob { font-size: 24px !important; }
    .h2-mob { font-size: 18px !important; }
    .intro-card-mob { padding: 28px 16px 24px !important; }
    .formation-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
    .match-summary-cols { flex-direction: column !important; }
    .match-summary-header-team { font-size: 13px !important; }
    .tab-bar-scroll button { font-size: 11px !important; padding: 8px 4px 10px !important; gap: 3px !important; }
  }
  input::placeholder { color: rgba(255,255,255,0.2); }
  input:focus { border-color: rgba(212,162,60,0.5) !important; outline: none; }
  /* Barra de rolagem discreta em todo o app — a padrão do Chrome/Windows é
     larga e cinza-claro, e ficava gritando dentro dos modais escuros. */
  * { scrollbar-width: thin; scrollbar-color: rgba(212,162,60,0.32) transparent; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(212,162,60,0.3); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(212,162,60,0.55); background-clip: padding-box; border: 2px solid transparent; }
  ::-webkit-scrollbar-corner { background: transparent; }
  .draft-left::-webkit-scrollbar { width: 3px; }
  .formation-card:hover { background: rgba(212,162,60,0.09) !important; border-color: rgba(212,162,60,0.45) !important; transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.35); }
  .formation-card:active { transform: translateY(0); }
  .mode-card-hover:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.3); }
  .mode-card-hover:active { transform: translateY(0); }
`;

const styles = {
  page: { minHeight: '100vh', background: '#0B1A12', color: '#F4F1EA', fontFamily: "'Source Sans 3', system-ui, sans-serif", position: 'relative', overflow: 'hidden' },
  bgTexture: { position: 'fixed', inset: 0, opacity: 0.05, background: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 1px,transparent 40px)', pointerEvents: 'none' },
  header: { borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'relative', zIndex: 1 },
  headerInner: { maxWidth: 760, margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 },
  crest: { fontSize: 28 },
  title: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, letterSpacing: 0.5 },
  subtitle: { fontFamily: "'Space Mono', monospace", fontSize: 11, opacity: 0.6, letterSpacing: 1, textTransform: 'uppercase' },
  main: { maxWidth: 760, margin: '0 auto', padding: '32px 24px 80px', position: 'relative', zIndex: 1 },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28 },
  h1: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, lineHeight: 1.15, margin: '0 0 16px' },
  h2: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, margin: '4px 0 20px' },
  lead: { fontSize: 16, lineHeight: 1.6, opacity: 0.85, marginBottom: 28 },
  eyebrow: { fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#d4a23c' },
  skipsBadge: { fontSize: 12, padding: '6px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 999 },
  draftTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  btnPrimary: { background: '#d4a23c', color: '#0B1A12', border: 'none', borderRadius: 10, padding: '14px 28px', fontSize: 16, fontWeight: 700 },
  btnGhost: { background: 'transparent', color: '#F4F1EA', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '12px 24px', fontSize: 14, marginTop: 16, width: '100%' },
  btnSmall: { background: '#d4a23c', color: '#0B1A12', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700 },
  btnDisabled: { opacity: 0.35 },
  btnRow: { display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' },
  emptyState: { background: 'rgba(224,89,63,0.1)', border: '1px solid rgba(224,89,63,0.4)', borderRadius: 10, padding: '16px 18px', fontSize: 14, lineHeight: 1.5 },

  formationIntro: { fontSize: 13, opacity: 0.6, lineHeight: 1.5, marginBottom: 24, maxWidth: 520 },
  formationGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  formationCard: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16,
    padding: '18px 16px', color: '#F4F1EA', textAlign: 'center', cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s, transform 0.15s, box-shadow 0.15s',
  },
  formationName: { fontSize: 13, fontWeight: 700, marginBottom: 10, fontFamily: "'Space Mono', monospace" },
  formationShapeNum: { fontSize: 23, fontWeight: 800, fontFamily: "'Space Mono', monospace", letterSpacing: 0.5, color: '#F4F1EA' },
  formationShapeDesc: { fontSize: 11.5, opacity: 0.55, marginTop: 4, marginBottom: 14, lineHeight: 1.4, minHeight: 32 },
  formationSectionHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' },
  formationSectionTitle: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Space Mono', monospace", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: '#d4a23c' },
  formationSectionHint: { fontSize: 11.5, opacity: 0.45, fontStyle: 'italic' },
  miniPitch: {
    position: 'relative', width: '100%', aspectRatio: '0.66',
    background: 'linear-gradient(180deg,#0f3d22,#145c30)', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.2)', overflow: 'hidden',
    boxShadow: 'inset 0 0 18px rgba(0,0,0,0.35)',
  },
  miniPitchHalfLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(255,255,255,0.2)', pointerEvents: 'none' },
  miniPitchCircle: { position: 'absolute', left: '50%', top: '50%', width: 30, height: 30, marginLeft: -15, marginTop: -15, border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', pointerEvents: 'none' },
  miniPitchCenterDot: { position: 'absolute', left: '50%', top: '50%', width: 3, height: 3, marginLeft: -1.5, marginTop: -1.5, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', pointerEvents: 'none' },
  miniPitchArcTop: { position: 'absolute', left: '50%', top: 0, width: 46, height: 22, marginLeft: -23, border: '1px solid rgba(255,255,255,0.16)', borderTop: 'none', borderRadius: '0 0 50% 50% / 0 0 100% 100%', pointerEvents: 'none' },
  miniPitchArcBottom: { position: 'absolute', left: '50%', bottom: 0, width: 46, height: 22, marginLeft: -23, border: '1px solid rgba(255,255,255,0.16)', borderBottom: 'none', borderRadius: '50% 50% 0 0 / 100% 100% 0 0', pointerEvents: 'none' },
  miniDot: {
    position: 'absolute', width: 22, height: 22, borderRadius: '50%', transform: 'translate(-50%,-50%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid rgba(0,0,0,0.45)', boxShadow: '0 1px 4px rgba(0,0,0,0.5)', zIndex: 2,
  },
  miniDotLabel: { fontSize: 7.5, fontWeight: 800, color: '#0B1A12', fontFamily: "'Space Mono', monospace", lineHeight: 1, letterSpacing: -0.2 },

  pitchWrap: { margin: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  pitchField: { position: 'relative', width: '100%', maxWidth: 380, aspectRatio: '0.68', background: 'linear-gradient(180deg,#0f3d22 0%,#145c30 50%,#0f3d22 100%)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 8, overflow: 'hidden' },

  rolledTeamBox: { marginTop: 24 },
  rolledTeamHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '2px solid', borderRadius: 12, marginBottom: 16 },
  diceIcon: { fontSize: 24 },
  diceIconSpin: { fontSize: 40, animation: 'spin 0.5s linear infinite' },
  rolledTeamLabel: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700 },
  rolledTeamCoach: { fontSize: 12, opacity: 0.6 },
  rollingBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 16px', marginTop: 8 },
  rollingName: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, minHeight: 30 },
  rollingHint: { fontSize: 12, opacity: 0.5, fontFamily: "'Space Mono', monospace", letterSpacing: 1, textTransform: 'uppercase' },
  selectedPlayerBanner: { textAlign: 'center', fontSize: 13, padding: '10px 14px', background: 'rgba(127,217,154,0.12)', border: '1px solid rgba(127,217,154,0.4)', borderRadius: 8, margin: '12px 0' },
  elevenGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 },
  elevenCard: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 10px', textAlign: 'center', color: '#F4F1EA', fontFamily: 'inherit' },
  elevenOvr: { fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: '#d4a23c' },
  elevenName: { fontSize: 13, fontWeight: 600, margin: '4px 0 2px', minHeight: 32 },
  elevenPos: { fontSize: 10, opacity: 0.5, marginBottom: 4, fontFamily: "'Space Mono', monospace" },
  elevenBlocked: { fontSize: 10, opacity: 0.5, fontStyle: 'italic', padding: '6px 0' },
  elevenMultiHint: { fontSize: 9, opacity: 0.55, marginTop: 2, lineHeight: 1.3 },
  elevenSelectedHint: { fontSize: 10, color: '#7fd99a', fontWeight: 700, marginTop: 2 },

  squadList: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 20 },
  squadRow: { display: 'grid', gridTemplateColumns: '50px 1fr auto 40px', gap: 12, alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 },
  squadPos: { fontFamily: "'Space Mono', monospace", fontSize: 11, opacity: 0.6 },
  squadName: { fontWeight: 600, fontSize: 15 },
  squadTeam: { fontSize: 12, opacity: 0.5 },
  squadOvr: { fontFamily: "'Space Mono', monospace", fontWeight: 700, color: '#d4a23c', textAlign: 'right' },

  // Jogo ao vivo
  liveMatchBox: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '20px 16px', marginBottom: 20 },
  statRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 },
  statRank: { width: 20, textAlign: 'right', opacity: 0.4, fontFamily: "'Space Mono', monospace", fontSize: 11 },
  statName: { flex: '1 1 0%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statTeam: { fontSize: 11, opacity: 0.5, flexShrink: 1, minWidth: 0, maxWidth: '38%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statValue: { fontFamily: "'Space Mono', monospace", fontWeight: 700 },
  bracketCrestSlot: { width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  bracketCrestImg: { width: 20, height: 20, objectFit: 'contain', flexShrink: 0, borderRadius: 4, background: 'rgba(255,255,255,0.9)', padding: 1 },
  bracketCrestEmoji: { fontSize: 16, lineHeight: 1 },
  tableCrestImg: { width: 20, height: 20, objectFit: 'contain', flexShrink: 0, borderRadius: 4, background: 'rgba(255,255,255,0.9)', padding: 1 },
  tableCrestEmoji: { fontSize: 17, lineHeight: 1, flexShrink: 0 },
  liveTeamsRow: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 12, marginBottom: 12 },
  liveTeamName: { fontSize: 14, lineHeight: 1.3 },
  liveScoreBlock: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.35)', borderRadius: 10, padding: '8px 16px' },
  liveScoreNum: { fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: '#F4F1EA', minWidth: 24, textAlign: 'center' },
  liveScoreDash: { fontFamily: "'Space Mono', monospace", fontSize: 20, opacity: 0.5 },
  clockRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 },
  clock: { fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700 },
  clockPulse: { width: 8, height: 8, borderRadius: '50%', background: '#7fd99a', animation: 'pulse 1s ease-in-out infinite' },
  clockFull: { fontSize: 12, opacity: 0.5, fontFamily: "'Space Mono', monospace" },
  matchCenter: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 },
  matchCenterRow: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 52px minmax(0,1fr)', alignItems: 'center', gap: 6 },
  matchCenterSide: { display: 'flex', minWidth: 0, overflow: 'hidden' },
  matchCenterCard: { display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px', borderRadius: 8, border: '1px solid', maxWidth: '100%', minWidth: 0 },
  matchCenterInfo: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
  matchCenterMinuteCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 },
  goalMinute: { fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: '#d4a23c' },
  goalScorer: { fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  goalTeam: { fontSize: 11, opacity: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  goalScore: { fontFamily: "'Space Mono', monospace", fontSize: 11, opacity: 0.6, whiteSpace: 'nowrap' },
  noGoalsMsg: { textAlign: 'center', opacity: 0.5, fontSize: 13, padding: '12px 0' },

  // Outros jogos da rodada
  otherMatchesBox: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px', marginBottom: 20 },
  otherMatchRow: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', gap: 8, alignItems: 'center', padding: '6px 4px', fontSize: 13 },
  otherTeam: { textAlign: 'right', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  otherScore: { fontFamily: "'Space Mono', monospace", fontWeight: 700, textAlign: 'center', minWidth: 48, flexShrink: 0, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '2px 6px' },

  // Tabela de classificação
  tableSection: { marginTop: 8 },
  sectionLabel: { fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#d4a23c', marginBottom: 8, marginTop: 20 },
  tableHeaderRow: { display: 'flex', alignItems: 'center', padding: '6px 10px', fontSize: 11, opacity: 0.5, fontFamily: "'Space Mono', monospace", letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.08)' },
  tableRow: { display: 'flex', alignItems: 'center', padding: '7px 10px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' },
  tablePos: { width: 22, fontSize: 11, opacity: 0.5, fontFamily: "'Space Mono', monospace", textAlign: 'center', flexShrink: 0 },
  tableCell: { width: 32, textAlign: 'center', fontFamily: "'Space Mono', monospace", fontSize: 12, flexShrink: 0 },

  // Resultado final
  finalStats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20, marginTop: 8 },
  statBox: { background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '14px 10px', textAlign: 'center' },
  finalStatValue: { fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: '#d4a23c' },
  statLabel: { fontSize: 11, opacity: 0.6, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  badge: { background: 'rgba(212,162,60,0.15)', border: '1px solid #d4a23c', borderRadius: 10, padding: '14px 18px', marginBottom: 16, fontWeight: 600 },
  badgeInfo: { background: 'rgba(127,217,154,0.08)', border: '1px solid rgba(127,217,154,0.3)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, fontSize: 14 },
  badgeMuted: { background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, opacity: 0.7, fontSize: 14 },
  championBox: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14 },

  // Editor de time
  teamEditCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '20px', marginBottom: 28, textAlign: 'left' },
  teamEditPreview: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 },
  teamEditSep: { height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 0 16px' },
  teamEditSection: { marginBottom: 14 },
  teamEditLabel: { display: 'block', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.45, marginBottom: 8 },
  badgeGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  colorGrid: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  teamInput: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 12px', color: '#F4F1EA', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  // O popup nativo de <option> ignora o background semi-transparente do
  // <select> pai (a maioria dos navegadores desenha a lista com o fundo
  // padrão do sistema) — sem uma cor sólida explícita aqui, o texto claro
  // herdado ficava quase ilegível em cima de um fundo claro.
  selectOption: { background: '#14261a', color: '#F4F1EA' },
  gameStatsBar: {
    fontSize: 11.5, opacity: 0.7,
    marginBottom: 16, marginTop: -8,
  },

  // Intro screen
  introCard: { textAlign: 'center', padding: '40px 28px 36px', position: 'relative', overflow: 'hidden' },
  introTopBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  introBadge: { display: 'inline-block', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#d4a23c', background: 'rgba(212,162,60,0.12)', border: '1px solid rgba(212,162,60,0.35)', borderRadius: 999, padding: '5px 14px', marginBottom: 20 },
  introTitle: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 38, fontWeight: 700, lineHeight: 1.1, margin: '0 0 16px' },
  introLead: { fontSize: 16, lineHeight: 1.65, opacity: 0.75, maxWidth: 460, margin: '0 auto 36px' },
  featGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 },
  featCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '20px 14px', position: 'relative', transition: 'border-color 0.15s, transform 0.15s' },
  featIconWrap: { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 20 },
  featIndex: { position: 'absolute', top: 10, right: 12, fontFamily: "'Space Mono', monospace", fontSize: 10, opacity: 0.25, fontWeight: 700 },
  featIcon: { fontSize: 24, marginBottom: 8 },
  featTitle: { fontWeight: 700, fontSize: 13, marginBottom: 6 },
  featDesc: { fontSize: 12, opacity: 0.6, lineHeight: 1.5 },
  introSectionLabel: { fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.4, marginBottom: 12, textAlign: 'center' },
  introMarqueeWrap: {
    overflow: 'hidden', marginBottom: 32,
    maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
    WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
  },
  introMarqueeTrack: { display: 'flex', gap: 10, width: 'max-content' },
  introTeamChip: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, whiteSpace: 'nowrap', opacity: 0.75, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '5px 14px 5px 8px' },
  introTeamChipCrest: { width: 16, height: 16, objectFit: 'contain', borderRadius: '50%', flexShrink: 0 },
  btnIntro: { background: '#d4a23c', color: '#0B1A12', border: 'none', borderRadius: 12, padding: '16px 40px', fontSize: 17, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.3 },

  // Draft side-by-side layout
  // 380px = o maxWidth do próprio campinho (`pitchField`) — dar mais que
  // isso à coluna não deixaria ele maior, só sobraria vão vazio ao lado.
  draftLayout: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, marginTop: 16, alignItems: 'start' },
  draftLeft: { display: 'flex', flexDirection: 'column', gap: 0, maxHeight: '72vh', overflowY: 'auto', paddingRight: 4 },
  draftRight: { position: 'sticky', top: 16 },
  teamHeaderCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 },
  playersList: { display: 'flex', flexDirection: 'column', gap: 2 },
  playerRow: { display: 'grid', gridTemplateColumns: '38px 1fr auto', gap: 10, alignItems: 'center', padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid transparent', cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s' },
  playerOvr: { fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, textAlign: 'center' },
  playerInfo: { display: 'flex', flexDirection: 'column', gap: 1 },
  playerName: { fontSize: 13, fontWeight: 600 },
  playerPos: { fontFamily: "'Space Mono', monospace", fontSize: 10, opacity: 0.5 },
  playerHint: { fontSize: 10, color: '#7fd99a', fontStyle: 'italic' },
  skipsBox: { background: 'rgba(212,162,60,0.12)', border: '1px solid rgba(212,162,60,0.3)', borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 54 },
  skipsNum: { fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: '#d4a23c', display: 'block' },
  skipsLabel: { fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 },
  progressBar: { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#d4a23c', borderRadius: 999, transition: 'width 0.3s ease' },
  btnSkip: { background: 'transparent', color: '#F4F1EA', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', marginTop: 8, width: '100%' },
};
