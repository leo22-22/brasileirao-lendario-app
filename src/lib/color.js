// Helpers de contraste pro tema claro. Cores de clube (color_primary,
// myTeamColor, careerHud.clubColor) vêm do dado e podem ser amarelo, branco
// ou bem claras — usadas como TEXTO em cima do creme ficariam invisíveis.
// `readableOn` escurece a cor (mantendo o matiz) até bater o contraste
// mínimo; pra fundo/borda tingida a cor original do clube pode continuar.

export const CREAM = '#F5F1E8';
export const PAPER = '#FBF9F4';
export const INK = '#0F1F17';

function parseHex(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const toHex = (rgb) => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

function channel(v) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la == null || lb == null) return 1;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const cache = new Map();

// Escurece `colorHex` (misturando com preto-esverdeado da marca) até ter
// contraste >= `min` sobre `bgHex`. Cores que não são hex voltam como vieram.
export function readableOn(bgHex, colorHex, min = 4.5) {
  const key = `${bgHex}|${colorHex}|${min}`;
  if (cache.has(key)) return cache.get(key);
  const rgb = parseHex(colorHex);
  if (!rgb) return colorHex;
  let out = toHex(rgb);
  const target = [15, 31, 23];
  for (let t = 0; t <= 1.0001 && contrast(bgHex, out) < min; t += 0.04) {
    out = toHex(rgb.map((v, i) => v + (target[i] - v) * t));
  }
  cache.set(key, out);
  return out;
}

// Atalho: cor de clube como texto sobre o creme do app.
export const teamInk = (colorHex) => readableOn(CREAM, colorHex);

// Cor de texto pra pôr EM CIMA de um fundo sólido (botão/pill com a cor do
// clube): branco ou tinta escura, o que tiver mais contraste.
export function textOn(bgHex) {
  if (!parseHex(bgHex)) return '#fff';
  return contrast(bgHex, '#ffffff') >= contrast(bgHex, INK) ? '#fff' : INK;
}
