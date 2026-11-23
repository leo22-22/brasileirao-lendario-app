// Card de resultado para compartilhar (PNG 1080×1350, formato 4:5 do feed).
// Usado no fim do Brasileirão Lendário, da Copa, da Supercopa do dia e do
// Simulador 2026. Só desenha o que vier em `data` — nada é inventado aqui.
//
// data: {
//   mode: 'Copa do Brasil Lendária',      // eyebrow
//   teamLabel, teamLogo, teamColor,       // escudo: imagem (data:/CORS) ou iniciais
//   title: 'Campeão!', subtitle,          // título grande + linha de apoio
//   stats: [{ label, value }],            // até 4
//   highlights: [{ label, text }],        // até 4 (craque, artilheiro, prêmios…)
//   campaign: ['v'|'e'|'d', …],           // um quadradinho por jogo (até 38)
//   campaignLabel: 'Campanha',
// }

const W = 1080;
const H = 1350;
const PAD = 72;
const C = {
  bg: '#F5F1E8', paper: '#FBF9F4', s2: '#EFE9DC', ink: '#0F1F17', ink2: '#3A463F', muted: '#69736B',
  line: '#E3DCCB', green: '#0D3A29', green2: '#14523A', gold: '#C29A45', goldInk: '#8A6A24',
  win: '#1F7A4D', draw: '#A39E90', loss: '#B23B3B', onDarkMuted: '#B6CBBF',
};
const SERIF = "'Fraunces', Georgia, serif";
const SANS = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
export const SITE_HOST = 'brasileiraolendario.com.br';

// Tira emoji/pictograma de qualquer texto que vá pro card (nomes de time do
// usuário podem ter). O card é só texto e formas.
const stripEmoji = (s) => String(s ?? '').replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍]/gu, '').replace(/\s{2,}/g, ' ').trim();

function initials(label) {
  const words = stripEmoji(label).replace(/\b\d{4}\b/g, '').split(/\s+/).filter(Boolean);
  if (!words.length) return 'BL';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Corta o texto em até `maxLines` linhas que cabem em `maxW` (com reticências).
function wrap(ctx, text, maxW, maxLines) {
  const words = stripEmoji(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const tryLine = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(tryLine).width <= maxW) { cur = tryLine; continue; }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  const usedAll = lines.join(' ').split(/\s+/).length >= words.length;
  if (!usedAll && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function fitFont(ctx, text, weight, family, size, maxW, min = 28) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > min && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    // Escudos remotos sem CORS "contaminam" o canvas (toBlob devolve null).
    // Em modo anonymous eles falham e caem nas iniciais — o botão continua funcionando.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function ensureFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`400 80px ${SERIF}`), document.fonts.load(`500 40px ${SERIF}`),
      document.fonts.load(`600 28px ${SANS}`), document.fonts.load(`400 26px ${SANS}`),
      document.fonts.load(`600 22px ${MONO}`),
    ]);
  } catch { /* sem fonte web, usa a de sistema */ }
}

export async function drawResultCard(data) {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const accent = data.teamColor || C.gold;

  // fundo creme
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // bloco verde do topo
  const heroH = 640;
  ctx.save();
  roundRect(ctx, 32, 32, W - 64, heroH, 44);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 32, 0, heroH + 32);
  g.addColorStop(0, C.green2); g.addColorStop(1, C.green);
  ctx.fillStyle = g;
  ctx.fillRect(32, 32, W - 64, heroH);
  // anéis dourados decorativos
  ctx.strokeStyle = 'rgba(194,154,69,.28)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(W - 40, 70, 260, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W - 40, 70, 360, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // eyebrow
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.onDarkMuted;
  ctx.font = `600 22px ${MONO}`;
  const modeText = stripEmoji(data.mode || '').toUpperCase();
  const eyebrow = modeText && modeText !== 'BRASILEIRÃO LENDÁRIO' ? `BRASILEIRÃO LENDÁRIO · ${modeText}` : 'BRASILEIRÃO LENDÁRIO';
  ctx.fillText(eyebrow, PAD + 8, 112);

  // escudo
  const cx = PAD + 8 + 74, cy = 250, r = 74;
  const img = await loadImage(data.teamLogo);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx.fillStyle = 'rgba(194,154,69,.35)'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
  if (img) {
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip();
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = accent; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `600 52px ${SANS}`;
    ctx.fillText(initials(data.teamLabel), cx, cy + 2);
  }
  ctx.restore();

  // nome do time ao lado do escudo
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FBF9F4';
  const nameX = cx + r + 32;
  const teamName = stripEmoji(data.teamLabel) || 'Meu Time';
  ctx.font = `500 40px ${SERIF}`;
  const nameLines = wrap(ctx, teamName, W - PAD - 8 - nameX, 2);
  nameLines.forEach((l, i) => ctx.fillText(l, nameX, cy - (nameLines.length - 1) * 24 + 14 + i * 48));

  // título grande
  const title = stripEmoji(data.title);
  const tSize = fitFont(ctx, title, 400, SERIF, 104, W - 2 * (PAD + 8), 56);
  ctx.fillStyle = C.gold;
  ctx.font = `400 ${tSize}px ${SERIF}`;
  ctx.fillText(title, PAD + 8, 470);

  if (data.subtitle) {
    ctx.fillStyle = '#DCE7E0';
    ctx.font = `400 30px ${SANS}`;
    wrap(ctx, data.subtitle, W - 2 * (PAD + 8), 2).forEach((l, i) => ctx.fillText(l, PAD + 8, 534 + i * 40));
  }

  // estatísticas (sobre a borda do bloco verde)
  let y = heroH + 32 + 40;
  const stats = (data.stats || []).filter(s => s && s.value !== undefined && s.value !== null && s.value !== '').slice(0, 4);
  if (stats.length) {
    const gap = 16;
    const bw = (W - 2 * PAD - gap * (stats.length - 1)) / stats.length;
    stats.forEach((s, i) => {
      const x = PAD + i * (bw + gap);
      ctx.fillStyle = C.paper; roundRect(ctx, x, y, bw, 132, 24); ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = C.ink; ctx.font = `400 ${fitFont(ctx, String(s.value), 400, SERIF, 58, bw - 24, 30)}px ${SERIF}`;
      ctx.fillText(String(s.value), x + bw / 2, y + 72);
      ctx.fillStyle = C.muted; ctx.font = `600 18px ${MONO}`;
      ctx.fillText(stripEmoji(s.label).toUpperCase(), x + bw / 2, y + 108);
    });
    ctx.textAlign = 'left';
    y += 132 + 36;
  }

  // destaques
  const highlights = (data.highlights || []).filter(h => h && h.text).slice(0, 4);
  const footerTop = H - 110;
  const campaign = (data.campaign || []).filter(x => x === 'v' || x === 'e' || x === 'd').slice(-38);
  const campaignH = campaign.length ? (campaign.length > 19 ? 150 : 104) : 0;
  const maxHlBottom = footerTop - (campaignH ? campaignH + 24 : 0);
  for (const h of highlights) {
    if (y + 70 > maxHlBottom) break;
    ctx.fillStyle = C.goldInk; ctx.font = `600 18px ${MONO}`;
    ctx.fillText(stripEmoji(h.label).toUpperCase(), PAD, y + 20);
    ctx.fillStyle = C.ink; ctx.font = `500 30px ${SANS}`;
    const lines = wrap(ctx, h.text, W - 2 * PAD, 2);
    lines.forEach((l, i) => ctx.fillText(l, PAD, y + 60 + i * 38));
    y += 60 + (lines.length - 1) * 38 + 30;
    ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(PAD, y - 8); ctx.lineTo(W - PAD, y - 8); ctx.stroke();
    y += 14;
  }

  // campanha: um quadradinho por jogo
  if (campaign.length) {
    const top = footerTop - campaignH;
    ctx.fillStyle = C.muted; ctx.font = `600 18px ${MONO}`;
    const v = campaign.filter(x => x === 'v').length, e = campaign.filter(x => x === 'e').length, d = campaign.filter(x => x === 'd').length;
    ctx.fillText(`${(data.campaignLabel || 'Campanha').toUpperCase()} · ${v}V ${e}E ${d}D`, PAD, top + 18);
    const perRow = campaign.length > 19 ? Math.ceil(campaign.length / 2) : campaign.length;
    const gap = 8;
    const size = Math.min(44, (W - 2 * PAD - gap * (perRow - 1)) / perRow);
    campaign.forEach((x, i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      ctx.fillStyle = x === 'v' ? C.win : x === 'd' ? C.loss : C.draw;
      roundRect(ctx, PAD + col * (size + gap), top + 36 + row * (size + gap), size, size, 8);
      ctx.fill();
    });
  }

  // rodapé
  ctx.strokeStyle = C.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PAD, footerTop + 22); ctx.lineTo(W - PAD, footerTop + 22); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.font = `500 30px ${SERIF}`;
  ctx.fillText('Brasileirão Lendário', PAD, H - 44);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.goldInk; ctx.font = `600 22px ${MONO}`;
  ctx.fillText(SITE_HOST, W - PAD, H - 48);

  return canvas;
}

/** Gera o PNG e abre o compartilhar do sistema (celular) ou baixa o arquivo. */
export async function shareResultCard(data) {
  const canvas = await drawResultCard(data);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return 'error';
  const file = new File([blob], 'brasileirao-lendario-resultado.png', { type: 'image/png' });
  const text = `${stripEmoji(data.title)}${data.subtitle ? ` · ${stripEmoji(data.subtitle)}` : ''} — https://${SITE_HOST}/`;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Brasileirão Lendário', text });
      return 'shared';
    } catch { return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
