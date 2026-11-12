// Helpers puros de formatação/exibição, usados tanto pelo jogo (App.jsx)
// quanto pelas páginas de conteúdo (src/content/) — extraídos pra cá pra
// não duplicar entre os dois bundles (ver src/main.jsx: rotas de conteúdo
// carregam um bundle separado do jogo, code-splitting real).
export function hexToRgba(hex, alpha) {
  // Tokens CSS (var(--gold) etc.) não têm canais pra separar — usa
  // color-mix pra aplicar a transparência do mesmo jeito.
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    if (typeof hex === 'string' && /^#[0-9a-fA-F]{3}$/.test(hex)) hex = '#' + hex.slice(1).split('').map(c => c + c).join('');
    else return `color-mix(in srgb, ${hex || 'var(--gold)'} ${Math.round(alpha * 100)}%, transparent)`;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function ovrColor(ovr) {
  // Tons escuros (tema claro): todos com contraste >= 4.5:1 sobre o creme.
  if (ovr >= 93) return '#7A5A10';
  if (ovr >= 86) return '#8A6A24';
  if (ovr >= 78) return '#46566A';
  return '#5E6670';
}

// Ordem fixa de exibição por posição primária (lista de jogadores no Draft
// e nas páginas de time).
export const POS_ORDER = ['GOL', 'LD', 'ZAG', 'LE', 'VOL', 'MC', 'MD', 'ME', 'MEI', 'PD', 'ATA', 'PE'];
export function posOrderIndex(pos) {
  const i = POS_ORDER.indexOf(pos);
  return i === -1 ? POS_ORDER.length : i;
}

// Cor por grupo de posição — usada no Modo Carreira (Mercado/Elenco/
// Formação) pra dar identidade visual a cada setor do time, igual um
// editor de escalação de verdade. Goleiro âmbar, defesa azul, meio
// verde, meia ofensivo roxo, ataque laranja.
export const POS_COLOR = {
  GOL: '#8F5D14',
  ZAG: '#2F6FA8', LD: '#2F6FA8', LE: '#2F6FA8',
  VOL: '#1F7A4D', MC: '#1F7A4D', MD: '#1F7A4D', ME: '#1F7A4D',
  MEI: '#6B4FA0',
  PD: '#B0521C', PE: '#B0521C', ATA: '#B0521C',
};
export function posColor(pos) {
  return POS_COLOR[pos] || '#69736B';
}

// Extrai o nome base e a conquista (texto entre parênteses no fim do label,
// quando existe, ex.: "Guarani 1978 (Campeao Brasileiro)") — só reformata
// o que já está no dado de TEAMS, não inventa nenhum fato novo.
export function parseTeamLabel(label) {
  const m = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { baseName: m[1], achievement: m[2] } : { baseName: label, achievement: null };
}
