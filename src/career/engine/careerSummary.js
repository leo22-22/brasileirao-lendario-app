// Resumo de uma carreira salva para a página de entrada do Modo Carreira
// (2026-11-13). Só LÊ o save, com as mesmas funções da Visão geral e da
// Tabela (posição/zona, próximo jogo, forma, fase da Copa). A página guarda
// só estes resumos — o save inteiro de cada carreira é lido, resumido e
// descartado, sem ficar em memória.
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { zoneFor } from '../../lib/standings.js';
import { formatCalendarDay } from './calendar.js';
import { computePlayerValue } from './pricing.js';
import { clubForm } from './simHelpers.js';
import { upcomingFixtures, myCopaStatus } from './careerMeta.js';
import { PHASE_SHORT } from './copaView.js';
import { listCareerSaves } from '../state/careerStorage.js';
import { displayName } from '../../lib/displayName.js';

// Posição + zona (mesmas faixas da Tabela: G4/G6/Sul-Americana/Z4 na A;
// acesso/rebaixamento na B). tone: 'ok' | 'bad' | null
function zoneOf(division, pos, n, round) {
  if (round === 0) return { tone: null, label: 'Pré-temporada', short: `Série ${division}` };
  if (division === 'B') {
    // Regra do motor: 1º–2º sobem direto, 3º–6º mata-mata; ninguém cai da B.
    if (pos <= 2) return { tone: 'ok', label: `${pos}º · Acesso direto`, short: `Série B · ${pos}º · acesso` };
    if (pos <= 6) return { tone: 'ok', label: `${pos}º · Mata-mata de acesso`, short: `Série B · ${pos}º · mata-mata` };
    return { tone: null, label: `${pos}º lugar`, short: `Série B · ${pos}º` };
  }
  const zz = zoneFor('A', pos, n);
  const z = zz ? { label: zz.short } : null;
  const short = `Série A · ${pos}º`;
  if (z?.label === 'G4') return { tone: 'ok', label: `${pos}º · Libertadores`, short };
  if (z?.label === 'G6') return { tone: 'ok', label: `${pos}º · Pré-Libertadores`, short };
  if (z?.label === 'SA') return { tone: null, label: `${pos}º · Sul-Americana`, short };
  if (z) return { tone: 'bad', label: `${pos}º · Zona de rebaixamento`, short };
  return { tone: null, label: `${pos}º lugar`, short };
}

function copaTag(save) {
  const st = myCopaStatus(save);
  if (st.alive) return `Copa · ${PHASE_SHORT[st.bye ? 1 : st.round].toLowerCase()}`;
  if (st.label === 'Campeão') return 'Copa · campeão';
  if (st.label === 'Eliminado') return 'Copa · eliminado';
  return null;
}

export function careerSummary(save) {
  const me = save.myClubId;
  const team = TEAMS.find(t => t.id === me);
  const club = save.clubs[me];
  const division = club.division;
  const data = division === 'A' ? save.divisionA : save.divisionB;
  const pos = data.table.findIndex(r => r.id === me) + 1;
  let next = null;
  try { next = upcomingFixtures(save, 1)[0] || null; } catch { next = null; }
  return {
    seed: save.seed,
    clubId: me,
    name: displayName(team?.club || ''),
    logo: CLUB_LOGOS[team?.club] || null,
    colorP: team?.colors?.p || '#0D3A29',
    colorS: team?.colors?.s || '#111111',
    season: save.season,
    dateText: formatCalendarDay(save.calendarDay || 1),
    division,
    round: data.round,
    zone: zoneOf(division, pos, data.table.length, data.round),
    budget: club.budget,
    squadValue: club.roster.filter(p => !p.inAcademy).reduce((s, p) => s + computePlayerValue(p, me), 0),
    copa: copaTag(save),
    next: next ? {
      comp: next.comp, detail: next.detail, day: next.day,
      homeId: next.isHome === false ? next.oppId : me,
      awayId: next.isHome === false ? me : next.oppId,
      oppId: next.oppId,
    } : null,
    form: clubForm(data, me, 5).reverse(), // mais antigo → mais recente
    updatedAt: typeof save.updatedAt === 'number' ? save.updatedAt : null,
    screen: save.screen || 'hub',
  };
}

// Mais recente primeiro: updatedAt (quando existe), senão a ordem antiga
// (temporada/dia no jogo).
export function listCareerSummaries() {
  return listCareerSaves()
    .map(careerSummary)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || (b.season * 1000) - (a.season * 1000));
}

export function timeAgo(ts, now = Date.now()) {
  if (!ts) return null;
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'agora mesmo';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} minuto${m === 1 ? '' : 's'}`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} hora${h === 1 ? '' : 's'}`;
  const d = Math.round(h / 24);
  if (d < 7) return `há ${d} dia${d === 1 ? '' : 's'}`;
  const w = Math.round(d / 7);
  if (d < 30) return `há ${w} semana${w === 1 ? '' : 's'}`;
  const mo = Math.round(d / 30);
  return `há ${mo} ${mo === 1 ? 'mês' : 'meses'}`;
}
