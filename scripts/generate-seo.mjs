#!/usr/bin/env node
// Roda DEPOIS de `vite build` (ver package.json "build") e escreve, pra cada
// rota de conteúdo (índice de times + cada time individual), uma versão
// HTML pré-renderizada em dist/_prerender/{rota}.html: title/description/
// Open Graph/Twitter Card/canonical/robots corretos JÁ no HTML puro, mais
// JSON-LD (SportsTeam + BreadcrumbList) e o conteúdo real (elenco completo,
// técnico, ano, times relacionados) dentro de <div id="root">.
//
// Por quê: o app é uma SPA pura (Vite + React, sem SSR) — o servidor sempre
// mandava o MESMO index.html genérico pra qualquer rota, e o
// title/description/canonical só eram corrigidos DEPOIS que o JS rodava
// (ver o useEffect de roteamento em src/App.jsx). Isso nunca ajudou quem não
// executa JS (WhatsApp, Twitter, Discord, LinkedIn, Bing) e dependia de o
// Google rodar uma segunda passada de renderização pra indexar direito.
// server/index.ts serve o arquivo daqui quando existir, e cai no
// comportamento de sempre (index.html genérico) quando não existir.
//
// Não inventa nenhum fato: todo texto vem direto de src/data/teams.js
// (mesmo dado que o jogo usa).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEAMS } from '../src/data/teams.js';
import { CLUB_LOGOS } from '../src/data/club-logos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE_URL = 'https://brasileiraolendario.com.br';
const POS_ORDER = ['GOL', 'LD', 'ZAG', 'LE', 'VOL', 'MC', 'MD', 'ME', 'MEI', 'PD', 'ATA', 'PE'];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Mesma extração usada em App.jsx: nome base + o que está entre parênteses
// no fim do label (ex.: "Guarani 1978 (Campeão Brasileiro)") — só reformata
// o que já existe no dado, não inventa nada novo.
function parseTeamLabel(label) {
  const m = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { baseName: m[1], achievement: m[2] } : { baseName: label, achievement: null };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// "º" pra concordar com substantivo masculino ("6º elenco"), "ª" pra
// feminino ("6ª posição") — sem isso "ocupa a 6º posição" sai errado.
function ordinalPt(n, gender = 'm') {
  return `${n}${gender === 'f' ? 'ª' : 'º'}`;
}

function teamAvgOvr(team) {
  return team.players.reduce((s, p) => s + p.ovr, 0) / team.players.length;
}

// Estatísticas 100% derivadas de players/ovr — nenhum fato histórico, só
// aritmética em cima do dado que já existe. É o que substitui a frase-
// modelo repetida ("Monte o X... técnico Y...") como abertura da página:
// medido no diagnóstico anterior, aquela frase era ~90% do texto e batia
// 58,6% de linhas idênticas entre times sem nada em comum.
function computeTeamStats(team, allTeams) {
  const withAvg = allTeams.map(t => ({ id: t.id, avg: teamAvgOvr(t) }));
  const globalSorted = [...withAvg].sort((a, b) => b.avg - a.avg);
  const globalRank = globalSorted.findIndex(t => t.id === team.id) + 1;

  const standout = [...team.players].sort((a, b) => b.ovr - a.ovr)[0];

  const clubMates = allTeams.filter(t => t.club === team.club);
  let clubComparison = null;
  if (clubMates.length > 1) {
    const clubSorted = [...clubMates]
      .map(t => ({ id: t.id, label: t.label, avg: teamAvgOvr(t) }))
      .sort((a, b) => b.avg - a.avg);
    const clubRank = clubSorted.findIndex(t => t.id === team.id) + 1;
    clubComparison = { clubRank, clubTotal: clubSorted.length, clubSorted };
  }

  return {
    avgOvr: round1(teamAvgOvr(team)),
    globalRank,
    totalTeams: allTeams.length,
    standout,
    clubComparison,
  };
}

// Parágrafo de abertura derivado dos números acima — não do template de
// nome/ano/técnico. Só menciona a comparação com o clube quando existe mais
// de um elenco dele na base (sem isso, "não invente contexto pra preencher"
// vira um problema pra clubes com um elenco só, tipo Bangu ou Guarani).
function renderIntro(team, stats) {
  const { baseName, achievement } = parseTeamLabel(team.label);
  const { avgOvr, globalRank, totalTeams, standout, clubComparison } = stats;

  const parts = [];
  parts.push(
    `Com OVR médio de ${avgOvr}, o ${escapeHtml(baseName)}${achievement ? ` (${escapeHtml(achievement)})` : ''} ` +
    `é o ${ordinalPt(globalRank)} elenco mais forte entre os ${totalTeams} times históricos do Brasileirão Lendário. ` +
    `O destaque do elenco é ${escapeHtml(standout.name)} (${escapeHtml(standout.pos.join('/'))}, ${standout.ovr} de OVR).`
  );

  if (clubComparison) {
    const { clubRank, clubTotal } = clubComparison;
    let clubPhrase;
    if (clubRank === 1) clubPhrase = `é o elenco mais forte do ${escapeHtml(team.club)} disponível no jogo`;
    else if (clubRank === clubTotal) clubPhrase = `é o elenco do ${escapeHtml(team.club)} com o OVR médio mais baixo entre os disponíveis no jogo`;
    else clubPhrase = `ocupa a ${ordinalPt(clubRank, 'f')} posição em OVR médio entre os ${clubTotal} elencos do ${escapeHtml(team.club)} disponíveis no jogo`;
    parts.push(`Entre os elencos do ${escapeHtml(team.club)} no Brasileirão Lendário, este ${clubPhrase}.`);
  }

  parts.push(
    `Escale a formação com o técnico ${escapeHtml(team.coach)} e dispute o Brasileirão ou a Copa do Brasil sozinho ou com amigos.`
  );

  return parts;
}

// Mesmos números, resumidos pro <meta name="description"> — a frase que
// aparece no snippet de busca. Mais forte que "Monte o X... técnico Y..."
// pra quem está comparando resultados no Google.
function renderMetaDescription(team, stats) {
  const { baseName, achievement } = parseTeamLabel(team.label);
  const { avgOvr, globalRank, totalTeams, standout } = stats;
  return `${baseName}${achievement ? ` (${achievement})` : ''}: OVR médio ${avgOvr}, ${ordinalPt(globalRank)} elenco mais forte de ${totalTeams} no Brasileirão Lendário. Destaque: ${standout.name} (${standout.ovr} OVR). Monte esse time e dispute o Brasileirão ou a Copa do Brasil.`;
}

function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

function teamJsonLd(team) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: team.label,
    sport: 'Soccer',
    url: `${SITE_URL}/times/${team.id}`,
    ...(CLUB_LOGOS[team.club] ? { logo: CLUB_LOGOS[team.club] } : {}),
    ...(team.coach ? { coach: { '@type': 'Person', name: team.coach } } : {}),
    athlete: team.players.map(p => ({ '@type': 'Person', name: p.name })),
  };
}

function renderTeamsIndexBody() {
  const sorted = [...TEAMS].sort((a, b) => b.year - a.year);
  const items = sorted.map(t => `<li><a href="/times/${t.id}">${escapeHtml(t.label)}</a></li>`).join('\n      ');
  return `
    <header><nav aria-label="Trilha de navegação"><a href="/">Início</a> › <span>Times Históricos</span></nav></header>
    <main>
      <article>
        <h1>Times Históricos do Brasileirão Lendário</h1>
        <p>Os ${TEAMS.length} times históricos disponíveis pra montar no Brasileirão Lendário (1959-2026), com elenco completo de cada um.</p>
        <ul>
      ${items}
        </ul>
      </article>
    </main>`;
}

function renderTeamBody(team, stats) {
  const { baseName } = parseTeamLabel(team.label);
  const relatedSameClub = TEAMS.filter(t => t.club === team.club && t.id !== team.id).sort((a, b) => b.year - a.year);
  const sortedPlayers = [...team.players].sort((a, b) => POS_ORDER.indexOf(a.pos[0]) - POS_ORDER.indexOf(b.pos[0]));
  const rosterItems = sortedPlayers
    .map(p => `<li>${escapeHtml(p.name)} — ${escapeHtml(p.pos.join('/'))} — OVR ${p.ovr}</li>`)
    .join('\n          ');
  const relatedItems = relatedSameClub
    .slice(0, 12)
    .map(t => `<li><a href="/times/${t.id}">${escapeHtml(t.label)}</a></li>`)
    .join('\n          ');
  const introParagraphs = renderIntro(team, stats).map(p => `<p>${p}</p>`).join('\n        ');

  return `
    <header><nav aria-label="Trilha de navegação"><a href="/">Início</a> › <a href="/times">Times Históricos</a> › <span>${escapeHtml(baseName)}</span></nav></header>
    <main>
      <article>
        <h1>${escapeHtml(team.label)}</h1>
        ${introParagraphs}
        <h2>Elenco completo</h2>
        <ul>
          ${rosterItems}
        </ul>
        ${relatedSameClub.length > 0 ? `<h2>Outros elencos do ${escapeHtml(team.club)}</h2>
        <ul>
          ${relatedItems}
        </ul>` : ''}
        <p><a href="/">Jogue com este time agora no Brasileirão Lendário →</a></p>
      </article>
    </main>`;
}

function patchHtml(template, { title, description, routePath, robots, ogImage, jsonLdBlocks, bodyHtml }) {
  const url = `${SITE_URL}${routePath}`;
  let out = template;
  out = out.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(/<meta name="description"[^>]*content="[^"]*"[^>]*\/>/s, `<meta name="description" content="${escapeHtml(description)}" />`);
  out = out.replace(/<meta name="robots" content="[^"]*"\s*\/>/, `<meta name="robots" content="${robots}" />`);
  out = out.replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}" />`);
  out = out.replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  out = out.replace(/<meta property="og:description"[^>]*content="[^"]*"[^>]*\/>/s, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  out = out.replace(/<meta property="og:image" content="[^"]*"\s*\/>/, `<meta property="og:image" content="${ogImage}" />`);
  out = out.replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${url}" />`);
  out = out.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  out = out.replace(/<meta name="twitter:description"[^>]*content="[^"]*"[^>]*\/>/s, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  out = out.replace(/<meta name="twitter:image" content="[^"]*"\s*\/>/, `<meta name="twitter:image" content="${ogImage}" />`);
  // O bundle do peerjs (WebRTC do multiplayer) só é importado por App.jsx —
  // rota de conteúdo nunca baixa esse chunk (main.jsx decide isso ANTES de
  // importar qualquer um dos dois, ver src/main.jsx). Só que o Vite, ao
  // gerar dist/index.html, injeta um <link rel="modulepreload"> pra ele de
  // qualquer jeito (heurística conservadora: não sabe em build-time qual
  // branch do import() condicional vai rodar). Sem tirar essa dica aqui, o
  // navegador começa a baixar peerjs.js numa página de time mesmo sem
  // precisar dele nunca — inofensivo pro LCP (é baixa prioridade, não
  // bloqueia render) mas aparece como "JavaScript não usado" em qualquer
  // auditoria (Lighthouse etc.) e gasta banda à toa.
  out = out.replace(/<link rel="modulepreload"[^>]*peerjs[^>]*>\s*/i, '');
  if (jsonLdBlocks?.length) {
    const scripts = jsonLdBlocks.map(obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`).join('\n');
    out = out.replace('</head>', `${scripts}\n</head>`);
  }
  out = out.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
  return out;
}

function writeRoute(routePath, html) {
  const rel = routePath === '/' ? 'index.html' : `${routePath.replace(/^\//, '')}.html`;
  const outPath = path.join(DIST, '_prerender', rel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
}

function buildSitemap() {
  const urls = [
    { loc: '/', changefreq: 'weekly', priority: '1.0' },
    { loc: '/como-jogar', changefreq: 'monthly', priority: '0.8' },
    { loc: '/termos-de-uso', changefreq: 'monthly', priority: '0.3' },
    { loc: '/privacidade', changefreq: 'monthly', priority: '0.3' },
    { loc: '/contato', changefreq: 'monthly', priority: '0.5' },
    { loc: '/times', changefreq: 'monthly', priority: '0.6' },
    ...TEAMS.map(t => ({ loc: `/times/${t.id}`, changefreq: 'yearly', priority: '0.5' })),
  ];
  const body = urls
    .map(u => `  <url>\n    <loc>${SITE_URL}${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function main() {
  const templatePath = path.join(DIST, 'index.html');
  if (!fs.existsSync(templatePath)) {
    console.error('dist/index.html não existe — rode `vite build` antes deste script.');
    process.exit(1);
  }
  const template = fs.readFileSync(templatePath, 'utf8');

  let count = 0;

  writeRoute('/times', patchHtml(template, {
    title: 'Times Históricos do Brasileirão — Brasileirão Lendário',
    description: `Os ${TEAMS.length} times históricos disponíveis pra montar no Brasileirão Lendário, com elenco completo de cada um.`,
    routePath: '/times',
    robots: 'index, follow',
    ogImage: `${SITE_URL}/og-image.png`,
    jsonLdBlocks: [breadcrumbJsonLd([
      { name: 'Início', url: `${SITE_URL}/` },
      { name: 'Times Históricos', url: `${SITE_URL}/times` },
    ])],
    bodyHtml: renderTeamsIndexBody(),
  }));
  count++;

  for (const team of TEAMS) {
    const routePath = `/times/${team.id}`;
    const title = `${team.label} — Elenco completo | Brasileirão Lendário`;
    const stats = computeTeamStats(team, TEAMS);
    const description = renderMetaDescription(team, stats);
    const ogImage = CLUB_LOGOS[team.club] || `${SITE_URL}/og-image.png`;
    writeRoute(routePath, patchHtml(template, {
      title,
      description,
      routePath,
      robots: 'index, follow',
      ogImage,
      jsonLdBlocks: [
        teamJsonLd(team),
        breadcrumbJsonLd([
          { name: 'Início', url: `${SITE_URL}/` },
          { name: 'Times Históricos', url: `${SITE_URL}/times` },
          { name: team.label, url: `${SITE_URL}${routePath}` },
        ]),
      ],
      bodyHtml: renderTeamBody(team, stats),
    }));
    count++;
  }

  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap());

  console.log(`generate-seo: ${count} páginas pré-renderizadas em dist/_prerender/, sitemap.xml atualizado (${TEAMS.length} times).`);
}

main();
