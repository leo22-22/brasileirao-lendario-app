// Desafio por link (sem servidor): o elenco montado no draft vai dentro do
// próprio link. Cada jogador é guardado como (time, índice no elenco
// original), não com OVR — quem abre o link reconstrói tudo a partir dos
// dados do jogo, então não dá pra "editar" um 99 no link.
//
// Formato v1 (JSON → base64url):
// { v: 1, n: nome, c: cor, f: formationKey | 'custom', s: slots (só custom),
//   k: capitão (slotKey), t: [teamId, ...], p: [[slotKey, iTime, idx], ...] }
// (cada time aparece uma vez em `t`; `p` aponta pra ele pelo índice — link
// bem mais curto quando o elenco vem quase todo do mesmo time).

export const LINK_PARAM = 'desafio';
const MAX_NAME = 24;

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(b64) {
  const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm + '==='.slice((norm.length + 3) % 4));
  const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Codifica o elenco. `pitch` = { slotKey: player } (player tem teamId e name),
 * `pitchSlots` só é usado na formação livre. Devolve null se algum jogador não
 * puder ser referenciado (ex.: veio de um time que não existe mais).
 */
export function encodeChallenge({ name, color, formationKey, pitchSlots, pitch, captainSlot }, teams) {
  const p = [];
  const t = [];
  for (const [slotKey, pl] of Object.entries(pitch || {})) {
    const team = teams.find(tm => tm.id === pl.teamId);
    const idx = team ? team.players.findIndex(x => x.name === pl.name) : -1;
    if (idx < 0) return null;
    if (!t.includes(pl.teamId)) t.push(pl.teamId);
    p.push([slotKey, t.indexOf(pl.teamId), idx]);
  }
  if (p.length < 11) return null;
  const payload = {
    v: 1,
    n: String(name || 'Meu Time').slice(0, MAX_NAME),
    c: typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : undefined,
    f: formationKey || 'custom',
    k: captainSlot || undefined,
    t,
    p,
  };
  if (payload.f === 'custom') {
    payload.s = (pitchSlots || []).filter(s => !s.isBench).map(s => [s.key, s.label, s.realPos, Math.round(s.x), Math.round(s.y)]);
  }
  return toBase64Url(JSON.stringify(payload));
}

/**
 * Decodifica e reconstrói o elenco. `buildPitchSlots(key)` vem do App (a
 * mesma usada no jogo). Devolve { name, color, formationKey, pitchSlots,
 * pitch, captainSlot } ou null se o link estiver quebrado.
 */
export function decodeChallenge(code, teams, buildPitchSlots, formations) {
  try {
    if (!code || code.length > 4000) return null;
    const d = JSON.parse(fromBase64Url(code));
    if (d?.v !== 1 || !Array.isArray(d.p) || !Array.isArray(d.t)) return null;
    let starterSlots;
    if (d.f === 'custom') {
      if (!Array.isArray(d.s) || d.s.length !== 11) return null;
      starterSlots = d.s.map(([key, label, realPos, x, y]) => ({ key: String(key), label: String(label), realPos: String(realPos), x: Number(x) || 50, y: Number(y) || 50 }));
    } else {
      if (!formations[d.f]) return null;
      starterSlots = buildPitchSlots(d.f);
    }
    const benchKeys = new Set(d.p.map(([k]) => k).filter(k => /^bench\d+$/.test(k)));
    const benchSlots = [...benchKeys].sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
      .map((k, i) => ({ key: k, label: `SUB ${i + 1}`, realPos: 'bench', isBench: true, x: 0, y: 0 }));
    const starterKeys = new Set(starterSlots.map(s => s.key));
    const pitch = {};
    const seen = new Set();
    for (const [slotKey, ti, idx] of d.p) {
      const teamId = d.t[ti];
      const isBench = benchKeys.has(slotKey);
      if (!isBench && !starterKeys.has(slotKey)) return null;
      const team = teams.find(t => t.id === teamId);
      const player = team?.players?.[idx];
      if (!player || seen.has(`${teamId}|${idx}`)) return null;
      seen.add(`${teamId}|${idx}`);
      pitch[slotKey] = { ...player, teamLabel: team.label, teamId: team.id, club: team.club, year: team.year, nat: player.nat || 'BRA', isBench, slotKey };
    }
    if (starterSlots.some(s => !pitch[s.key])) return null;
    return {
      // Sem nome próprio (ou o padrão "Meu Time") vira null: as telas usam
      // "seu amigo" — senão os dois lados apareciam como "Meu Time".
      name: d.n && String(d.n).trim() && d.n !== 'Meu Time' ? String(d.n).slice(0, MAX_NAME) : null,
      color: typeof d.c === 'string' && /^#[0-9a-f]{6}$/i.test(d.c) ? d.c : null,
      formationKey: d.f,
      pitchSlots: [...starterSlots, ...benchSlots],
      pitch,
      captainSlot: d.k && pitch[d.k] && !pitch[d.k].isBench ? d.k : null,
    };
  } catch {
    return null;
  }
}

export function challengeUrl(code, origin = window.location.origin) {
  return `${origin}/?${LINK_PARAM}=${code}`;
}

export function readChallengeFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get(LINK_PARAM);
  } catch {
    return null;
  }
}

export function clearChallengeFromUrl() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete(LINK_PARAM);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch { /* nada */ }
}
