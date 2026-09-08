// Helpers puros de formatação/exibição, usados tanto pelo jogo (App.jsx)
// quanto pelas páginas de conteúdo (src/content/) — extraídos pra cá pra
// não duplicar entre os dois bundles (ver src/main.jsx: rotas de conteúdo
// carregam um bundle separado do jogo, code-splitting real).
export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function ovrColor(ovr) {
  if (ovr >= 93) return '#FFD700';
  if (ovr >= 86) return '#d4a23c';
  if (ovr >= 78) return '#94a3b8';
  return '#64748b';
}

// Ordem fixa de exibição por posição primária (lista de jogadores no Draft
// e nas páginas de time).
export const POS_ORDER = ['GOL', 'LD', 'ZAG', 'LE', 'VOL', 'MC', 'MD', 'ME', 'MEI', 'PD', 'ATA', 'PE'];
export function posOrderIndex(pos) {
  const i = POS_ORDER.indexOf(pos);
  return i === -1 ? POS_ORDER.length : i;
}

// Extrai o nome base e a conquista (texto entre parênteses no fim do label,
// quando existe, ex.: "Guarani 1978 (Campeao Brasileiro)") — só reformata
// o que já está no dado de TEAMS, não inventa nenhum fato novo.
export function parseTeamLabel(label) {
  const m = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { baseName: m[1], achievement: m[2] } : { baseName: label, achievement: null };
}
