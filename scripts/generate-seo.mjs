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

function renderTeamBody(team) {
  const { baseName, achievement } = parseTeamLabel(team.label);
  const relatedSameClub = TEAMS.filter(t => t.club === team.club && t.id !== team.id).sort((a, b) => b.year - a.year);
  const sortedPlayers = [...team.players].sort((a, b) => POS_ORDER.indexOf(a.pos[0]) - POS_ORDER.indexOf(b.pos[0]));
  const rosterItems = sortedPlayers
    .map(p => `<li>${escapeHtml(p.name)} — ${escapeHtml(p.pos.join('/'))} — OVR ${p.ovr}</li>`)
    .join('\n          ');
  const relatedItems = relatedSameClub
    .slice(0, 12)
    .map(t => `<li><a href="/times/${t.id}">${escapeHtml(t.label)}</a></li>`)
    .join('\n          ');

  return `
    <header><nav aria-label="Trilha de navegação"><a href="/">Início</a> › <a href="/times">Times Históricos</a> › <span>${escapeHtml(baseName)}</span></nav></header>
    <main>
      <article>
        <h1>${escapeHtml(team.label)}</h1>
        <p>Monte o ${escapeHtml(baseName)}${achievement ? ` (${escapeHtml(achievement)})` : ''} no Brasileirão Lendário: elenco completo com ${team.players.length} jogadores reais${team.coach ? `, técnico ${escapeHtml(team.coach)}` : ''}, ano ${team.year}. Escale a formação e dispute o Brasileirão ou a Copa do Brasil sozinho ou com amigos.</p>
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
    const { baseName, achievement } = parseTeamLabel(team.label);
    const routePath = `/times/${team.id}`;
    const title = `${team.label} — Elenco completo | Brasileirão Lendário`;
    const description = `Monte o ${baseName}${achievement ? ` (${achievement})` : ''} no Brasileirão Lendário: elenco completo com ${team.players.length} jogadores reais, técnico ${team.coach}, e dispute o Brasileirão ou a Copa do Brasil.`;
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
      bodyHtml: renderTeamBody(team),
    }));
    count++;
  }

  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap());

  console.log(`generate-seo: ${count} páginas pré-renderizadas em dist/_prerender/, sitemap.xml atualizado (${TEAMS.length} times).`);
}

main();
