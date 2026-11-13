// Dados DERIVADOS da Visão geral do Modo Carreira (objetivo da diretoria,
// moral exibida, leitura do auxiliar, dificuldade dos jogos, agenda,
// histórico de orçamento, avisos do elenco e caixa de entrada).
//
// Regra: só LÊ o que o motor já produz (tabela, resultados, calendário,
// Copa, suspensões, cartões, base, listas, transferLog, lastDayEvents) —
// não mexe em simulação, economia, mercado nem calendário. O que precisa
// persistir (histórico de orçamento/posição, caixa de entrada, estado da
// diretoria) vive em 3 campos novos do save, todos com padrão em
// `ensureCareerMetaDefaults` (chamado também pela migração em
// careerStorage.js) e atualizados de forma idempotente por `syncCareerMeta`.
import { TEAMS } from '../../data/teams.js';
import { careerClubTier } from '../../data/career-clubs.js';
import { clubForm, teamForSim } from './simHelpers.js';
import { COPA_DAYS, COPA_ROUND_LABELS } from './copaEngine.js';
import { isTransferWindowOpen, nextWindowOpenDay, currentWindowCloseDay } from './calendar.js';

const YELLOWS_FOR_SUSPENSION = 3; // mesmo valor de seasonEngine.js
const INBOX_LIMIT = 120;
const HISTORY_LIMIT = 60;

export function ensureCareerMetaDefaults(save) {
  if (!save) return save;
  if (Array.isArray(save.budgetHistory) && Array.isArray(save.inbox) && save.board !== undefined) return save;
  return {
    ...save,
    budgetHistory: Array.isArray(save.budgetHistory) ? save.budgetHistory : [],
    inbox: Array.isArray(save.inbox) ? save.inbox : [],
    board: save.board ?? null,
  };
}

export function myDivision(save) {
  const key = save.clubs[save.myClubId].division;
  return { key, data: key === 'A' ? save.divisionA : save.divisionB };
}

const clubName = (id) => TEAMS.find(t => t.id === id)?.club || '';

// ── Objetivo da diretoria ─────────────────────────────────────────────
// Meta pelo porte do clube (CAREER_CLUB_META.tier). Na Série B a régua
// muda: clube grande quer subir, médio quer ao menos o playoff.
export function boardGoal(save) {
  const { key } = myDivision(save);
  const tier = careerClubTier(save.myClubId);
  if (key === 'A') {
    if (tier === 'elite') return { text: 'Terminar entre os 6 primeiros', short: 'G6', target: 6 };
    if (tier === 'grande') return { text: 'Terminar entre os 10 primeiros', short: 'top 10', target: 10 };
    if (tier === 'medio') return { text: 'Escapar com folga (top 14)', short: 'top 14', target: 14 };
    return { text: 'Não ser rebaixado', short: 'fora do Z4', target: 16 };
  }
  if (tier === 'elite' || tier === 'grande') return { text: 'Subir direto (top 2)', short: 'acesso direto', target: 2 };
  if (tier === 'medio') return { text: 'Brigar pelo acesso (top 6)', short: 'playoff', target: 6 };
  return { text: 'Não ser rebaixado', short: 'fora do Z4', target: 16 };
}

const BANDS = [
  { min: 60, status: 'No caminho', tone: 'success' },
  { min: 35, status: 'Em risco', tone: 'warning' },
  { min: 0, status: 'Crítico', tone: 'danger' },
];
const bandFor = (c) => BANDS.find(b => c >= b.min);

// Confiança 0–100: distância entre a posição atual e a meta (o peso cresce
// conforme a temporada anda — no começo a tabela ainda não diz muito) +
// os últimos 5 resultados do Brasileirão.
export function computeBoard(save) {
  const { data: division } = myDivision(save);
  const goal = boardGoal(save);
  const total = division.fixtures.length;
  const played = division.round;
  const pos = division.table.findIndex(r => r.id === save.myClubId) + 1;
  const form = clubForm(division, save.myClubId, 5);
  let confidence = 70;
  if (played > 0) {
    const progress = Math.min(1, played / total);
    const gap = pos - goal.target; // >0 = atrás da meta
    const posScore = gap > 0 ? -gap * (4 + 6 * progress) : Math.min(20, -gap * 3);
    const formScore = form.reduce((s, r) => s + (r === 'V' ? 5 : r === 'D' ? -5 : 0), 0);
    confidence = Math.round(65 + posScore + formScore);
  }
  confidence = Math.max(3, Math.min(100, confidence));
  const band = bandFor(confidence);
  const table = division.table;
  const targetRow = table[goal.target - 1];
  const myRow = table[pos - 1];
  const ptsGap = targetRow && myRow && pos > goal.target ? targetRow.pts - myRow.pts : 0;
  return { ...goal, confidence, status: band.status, tone: band.tone, pos, ptsGap, roundsLeft: Math.max(0, total - played) };
}

// ── Moral (só exibição) ───────────────────────────────────────────────
// Derivada dos últimos 5 resultados do Brasileirão. Observação: o motor já
// tem um bônus próprio de sequência (clubMoraleBonus em simHelpers.js) —
// esta função NÃO altera a simulação, só descreve o momento do elenco.
export function moraleFrom(form) {
  if (form.length < 3) return { label: 'Normal', pct: 50, tone: 'muted', detail: form.length ? `${form.length} jogo${form.length > 1 ? 's' : ''} disputado${form.length > 1 ? 's' : ''}` : 'Temporada ainda não começou' };
  const pts = form.reduce((s, r) => s + (r === 'V' ? 3 : r === 'E' ? 1 : 0), 0);
  const max = form.length * 3;
  const pct = Math.round((pts / max) * 100);
  let streak = 1;
  while (streak < form.length && form[streak] === form[0]) streak++;
  const streakText = streak >= 2
    ? `${streak} ${form[0] === 'V' ? 'vitórias' : form[0] === 'D' ? 'derrotas' : 'empates'} seguid${form[0] === 'E' ? 'os' : 'as'}`
    : `${pts} de ${max} pontos nos últimos ${form.length}`;
  if (pct >= 73) return { label: 'Alta', pct, tone: 'success', detail: streakText };
  if (pct >= 47) return { label: 'Boa', pct, tone: 'success', detail: streakText };
  if (pct >= 27) return { label: 'Normal', pct, tone: 'warning', detail: streakText };
  return { label: 'Baixa', pct, tone: 'danger', detail: streakText };
}

// ── Força e dificuldade ───────────────────────────────────────────────
// OVR médio dos 11 titulares de cada lado (mesmo time que a simulação
// usaria, via teamForSim), com 1,5 de OVR de vantagem pra quem joga em casa.
export function startersOvr(save, clubId) {
  const t = teamForSim(save, clubId);
  const xi = (t.players || []).slice(0, 11);
  if (!xi.length) return 0;
  return xi.reduce((s, p) => s + (p.ovr || 0), 0) / xi.length;
}

export function matchDifficulty(save, oppId, isHome) {
  const diff = startersOvr(save, oppId) - startersOvr(save, save.myClubId) + (isHome ? -1.5 : 1.5);
  if (diff <= -6) return 1;
  if (diff <= -2) return 2;
  if (diff <= 2) return 3;
  if (diff <= 6) return 4;
  return 5;
}

// ── Copa do Brasil: meu confronto atual ──────────────────────────────
export function myCopaStatus(save) {
  const copa = save.copa;
  if (!copa) return { alive: false, label: '—' };
  if (copa.phase === 'done') {
    return { alive: false, label: copa.champion === save.myClubId ? 'Campeão' : 'Encerrada' };
  }
  const tie = (copa.ties || []).find(t => t.aId === save.myClubId || t.bId === save.myClubId);
  const bye = copa.round === 0 && (copa.byeIds || []).includes(save.myClubId);
  const label = COPA_ROUND_LABELS[copa.round];
  if (tie) return { alive: true, label, round: copa.round, tie, oppId: tie.aId === save.myClubId ? tie.bId : tie.aId };
  if (bye) return { alive: true, label: `${COPA_ROUND_LABELS[1]} (folga na 1ª fase)`, round: copa.round, bye: true };
  return { alive: false, label: 'Eliminado' };
}

// ── Agenda (Brasileirão + Copa, em ordem de data) ─────────────────────
export function upcomingFixtures(save, limit = 5) {
  const { data: division } = myDivision(save);
  const items = [];
  for (let r = division.round; r < division.fixtures.length && items.length < limit + 2; r++) {
    const m = (division.fixtures[r] || []).find(x => x.homeId === save.myClubId || x.awayId === save.myClubId);
    if (!m) continue;
    const isHome = m.homeId === save.myClubId;
    items.push({
      day: save.seasonCalendar[r], comp: 'Brasileirão', detail: `Rodada ${r + 1}`, roundIdx: r,
      oppId: isHome ? m.awayId : m.homeId, isHome, homeId: m.homeId, awayId: m.awayId,
    });
  }
  const copa = myCopaStatus(save);
  if (copa.alive && copa.tie) {
    const pair = COPA_DAYS[copa.round] || [];
    const isFinal = copa.round === COPA_ROUND_LABELS.length - 1;
    // `aId` manda a ida (mesma convenção de copaEngine.js), `bId` manda a volta.
    const legs = isFinal ? [{ day: pair[0], leg: null }] : [
      ...(save.copa.leg === 'ida' ? [{ day: pair[0], leg: 'ida' }] : []),
      { day: pair[1], leg: 'volta' },
    ];
    for (const l of legs) {
      if (l.day == null || l.day <= save.calendarDay) continue;
      const isHome = isFinal ? null : (l.leg === 'ida' ? copa.tie.aId === save.myClubId : copa.tie.bId === save.myClubId);
      items.push({
        day: l.day, comp: 'Copa do Brasil', detail: `${COPA_ROUND_LABELS[copa.round]}${l.leg ? ` · ${l.leg}` : ''}`,
        oppId: copa.oppId, isHome,
      });
    }
  }
  return items
    .filter(i => i.day >= save.calendarDay)
    .sort((a, b) => a.day - b.day)
    .slice(0, limit)
    .map(i => ({ ...i, difficulty: matchDifficulty(save, i.oppId, i.isHome !== false) }));
}

// ── Leitura do auxiliar (regras simples, dados reais) ─────────────────
function homeScoringRecord(division, clubId, count = 6) {
  let games = 0, scored = 0;
  for (let r = division.round - 1; r >= 0 && games < count; r--) {
    const m = (division.results?.[r] || []).find(x => x.homeId === clubId);
    if (!m) continue;
    games++;
    if (m.homeGoals > 0) scored++;
  }
  return { games, scored };
}
function awayScoringRecord(division, clubId, count = 6) {
  let games = 0, scored = 0;
  for (let r = division.round - 1; r >= 0 && games < count; r--) {
    const m = (division.results?.[r] || []).find(x => x.awayId === clubId);
    if (!m) continue;
    games++;
    if (m.awayGoals > 0) scored++;
  }
  return { games, scored };
}

export function assistantInsight(save, nextMatch) {
  if (!nextMatch) return null;
  const { data: division } = myDivision(save);
  const isHome = nextMatch.homeId === save.myClubId;
  const oppId = isHome ? nextMatch.awayId : nextMatch.homeId;
  const opp = clubName(oppId);
  const facts = [];

  const suspended = (save.myStarters || []).filter(n => (save.suspensions?.[n] || 0) > 0);
  if (suspended.length) facts.push({ w: 10, text: `${suspended.join(', ')} ${suspended.length > 1 ? 'estão suspensos' : 'está suspenso'} e não pode${suspended.length > 1 ? 'm' : ''} jogar — ajuste a escalação.` });

  const rec = isHome ? awayScoringRecord(division, oppId) : homeScoringRecord(division, oppId);
  if (rec.games >= 3) {
    const where = isHome ? 'fora de casa' : 'em casa';
    if (rec.scored >= rec.games - 1) facts.push({ w: 6, text: `o ${opp} marcou em ${rec.scored} dos últimos ${rec.games} jogos ${where}.` });
    else if (rec.scored <= Math.floor(rec.games / 3)) facts.push({ w: 5, text: `o ${opp} passou em branco em ${rec.games - rec.scored} dos últimos ${rec.games} jogos ${where}.` });
  }

  const myForm = clubForm(division, save.myClubId, 5);
  if (myForm.length >= 3) {
    let s = 1; while (s < myForm.length && myForm[s] === myForm[0]) s++;
    if (s >= 3 && myForm[0] === 'D') facts.push({ w: 7, text: `são ${s} derrotas seguidas — o elenco precisa de uma reação.` });
    if (s >= 3 && myForm[0] === 'V') facts.push({ w: 4, text: `o time vem de ${s} vitórias seguidas.` });
  }

  const mine = startersOvr(save, save.myClubId);
  const theirs = startersOvr(save, oppId);
  if (mine && theirs) {
    const d = Math.round((mine - theirs) * 10) / 10;
    if (d >= 3) facts.push({ w: 5, text: `nossos titulares têm ${String(d).replace('.', ',')} de OVR médio a mais que os do ${opp}.` });
    else if (d <= -3) facts.push({ w: 6, text: `os titulares do ${opp} têm ${String(-d).replace('.', ',')} de OVR médio a mais que os nossos.` });
  }

  const hanging = (save.myStarters || []).filter(n => (save.cardTally?.[n] || 0) === YELLOWS_FOR_SUSPENSION - 1);
  if (hanging.length) facts.push({ w: 3, text: `${hanging.slice(0, 2).join(' e ')} ${hanging.length > 1 ? 'estão pendurados' : 'está pendurado'} — mais um amarelo e fica${hanging.length > 1 ? 'm' : ''} fora.` });

  if (!facts.length) return null;
  facts.sort((a, b) => b.w - a.w);
  const t = facts[0].text;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ── Avisos do elenco ──────────────────────────────────────────────────
export function squadAlerts(save) {
  const club = save.clubs[save.myClubId];
  const alerts = [];
  const suspended = Object.entries(save.suspensions || {}).filter(([, left]) => left > 0);
  for (const [name, left] of suspended) {
    if (!club.roster.some(p => p.name === name)) continue;
    const starter = (save.myStarters || []).includes(name);
    alerts.push({ kind: 'suspended', tone: 'danger', icon: 'warning', title: `${name} suspenso`, text: `Fora por ${left} rodada${left > 1 ? 's' : ''}${starter ? ' · está na escalação titular' : ''}`, action: starter ? 'formation' : null, actionLabel: 'Trocar' });
  }
  const hanging = Object.entries(save.cardTally || {}).filter(([name, n]) => n === YELLOWS_FOR_SUSPENSION - 1 && club.roster.some(p => p.name === name));
  for (const [name] of hanging.slice(0, 3)) {
    alerts.push({ kind: 'hanging', tone: 'warning', icon: 'list', title: `${name} pendurado`, text: `${YELLOWS_FOR_SUSPENSION - 1} amarelos · suspenso se levar outro` });
  }
  const academy = club.roster.filter(p => p.inAcademy);
  if (academy.length) {
    const best = [...academy].sort((a, b) => (b.potential || b.ovr) - (a.potential || a.ovr))[0];
    const pot = best.potential ? `, potencial ${best.potential}` : '';
    alerts.push({ kind: 'youth', tone: 'success', icon: 'sprout', title: `${academy.length} promessa${academy.length > 1 ? 's' : ''} na base`, text: `${best.name}, ${best.pos?.[0] || ''}, ${best.age ?? '?'} anos${pot}`, action: 'youth', actionLabel: 'Ver' });
  }
  const listed = (save.transferList || []).filter(n => club.roster.some(p => p.name === n));
  if (listed.length) alerts.push({ kind: 'listed', tone: 'info', icon: 'tag', title: `${listed.length} jogador${listed.length > 1 ? 'es' : ''} na lista de transferência`, text: listed.slice(0, 3).join(', ') + (listed.length > 3 ? '…' : ''), action: 'market', actionLabel: 'Ver' });
  const loanListed = (save.loanList || []).filter(n => club.roster.some(p => p.name === n));
  if (loanListed.length) alerts.push({ kind: 'loan-listed', tone: 'info', icon: 'loan', title: `${loanListed.length} na lista de empréstimo`, text: loanListed.slice(0, 3).join(', ') + (loanListed.length > 3 ? '…' : ''), action: 'market', actionLabel: 'Ver' });
  const loanedOut = [];
  for (const [cid, c] of Object.entries(save.clubs)) {
    if (cid === save.myClubId) continue;
    for (const p of c.roster) if (p.onLoanFrom === save.myClubId) loanedOut.push({ name: p.name, clubId: cid });
  }
  if (loanedOut.length) alerts.push({ kind: 'loaned', tone: 'info', icon: 'loan', title: `${loanedOut.length} emprestado${loanedOut.length > 1 ? 's' : ''} a outros clubes`, text: loanedOut.slice(0, 2).map(p => `${p.name} (${clubName(p.clubId)})`).join(', ') + (loanedOut.length > 2 ? '…' : '') });
  const loanedIn = club.roster.filter(p => p.onLoanFrom && p.onLoanFrom !== save.myClubId);
  if (loanedIn.length) alerts.push({ kind: 'loaned-in', tone: 'info', icon: 'loan', title: `${loanedIn.length} jogador${loanedIn.length > 1 ? 'es' : ''} emprestado${loanedIn.length > 1 ? 's' : ''} ao clube`, text: loanedIn.slice(0, 3).map(p => p.name).join(', ') });
  if (!(save.myStarters || []).length) alerts.unshift({ kind: 'formation', tone: 'warning', icon: 'formation', title: 'Formação não definida', text: 'Escale os titulares antes do próximo jogo', action: 'formation', actionLabel: 'Definir' });
  return alerts;
}

// ── Recorte da tabela ─────────────────────────────────────────────────
export function tableSlice(save) {
  const { key, data: division } = myDivision(save);
  const table = division.table;
  const n = table.length;
  const myIdx = table.findIndex(r => r.id === save.myClubId);
  const keep = new Set([0, 5, myIdx - 2, myIdx - 1, myIdx, myIdx + 1, myIdx + 2].filter(i => i >= 0 && i < n));
  const rows = [];
  let prev = -1;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (prev >= 0 && i > prev + 1) rows.push({ gap: true, key: `gap-${i}` });
    rows.push({ ...table[i], pos: i + 1, mine: i === myIdx, z4: key === 'A' && i >= n - 4, zLineBefore: key === 'A' && i === n - 4 && prev === i - 1 });
    prev = i;
  }
  const myRow = table[myIdx];
  const pos = myIdx + 1;
  let sentence;
  const cname = clubName(save.myClubId);
  if (key === 'B') {
    // Série B: 1º–2º acesso direto, 3º–6º mata-mata (sem rebaixamento).
    if (pos <= 2) {
      const third = table[2];
      const d = myRow.pts - (third?.pts ?? myRow.pts);
      sentence = `O ${cname} está no acesso direto, ${d} ponto${d === 1 ? '' : 's'} à frente do 3º`;
    } else if (pos <= 6) {
      const second = table[1];
      const d = second.pts - myRow.pts;
      sentence = d <= 0 ? `O ${cname} está colado no acesso direto` : `O ${cname} está no mata-mata, a ${d} ponto${d > 1 ? 's' : ''} do acesso direto`;
    } else {
      const sixth = table[5];
      const d = sixth.pts - myRow.pts;
      sentence = d <= 0 ? `O ${cname} está colado na zona do mata-mata` : `${d} ponto${d > 1 ? 's' : ''} separa${d > 1 ? 'm' : ''} o ${cname} do mata-mata de acesso`;
    }
  } else if (pos > n - 4) {
    const safe = table[n - 5];
    const d = safe.pts - myRow.pts;
    sentence = d <= 0 ? `O ${cname} está empatado em pontos com a saída do Z4` : `${d} ponto${d > 1 ? 's' : ''} separa${d > 1 ? 'm' : ''} o ${cname} da saída do Z4`;
  } else {
    const targetPos = key === 'A' ? 6 : 6;
    if (pos > targetPos) {
      const t = table[targetPos - 1];
      const d = t.pts - myRow.pts;
      sentence = d <= 0 ? `O ${cname} está colado no G${targetPos}` : `${d} ponto${d > 1 ? 's' : ''} separa${d > 1 ? 'm' : ''} o ${cname} do G${targetPos}`;
    } else {
      const z = table[n - 4];
      const d = myRow.pts - z.pts;
      sentence = `${d} ponto${d === 1 ? '' : 's'} de vantagem para o Z4`;
    }
  }
  return { rows, sentence, n };
}

// ── Caixa de entrada ──────────────────────────────────────────────────
const money = (n) => `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;

function inboxFromEvent(ev, save) {
  const season = save.season;
  if (ev.type === 'match') {
    const isHome = ev.homeId === save.myClubId;
    const my = isHome ? ev.homeGoals : ev.awayGoals;
    const op = isHome ? ev.awayGoals : ev.homeGoals;
    const opp = clubName(isHome ? ev.awayId : ev.homeId);
    const res = my > op ? 'Vitória' : my < op ? 'Derrota' : 'Empate';
    return { id: `s${season}-match-${ev.day}`, day: ev.day, season, cat: 'imprensa', title: `${res}: ${clubName(save.myClubId)} ${my} × ${op} ${opp}`, text: `Brasileirão · ${isHome ? 'em casa' : 'fora de casa'}` };
  }
  if (ev.type === 'transfer-ai') {
    return { id: `s${season}-tai-${ev.day}-${ev.playerName}`, day: ev.day, season, cat: 'mercado', title: `${ev.playerName} vai para o ${clubName(ev.fromClubId)}`, text: `Saiu do ${clubName(ev.toClubId)} · ${money(ev.amount)}` };
  }
  if (ev.type === 'offer') {
    return { id: `s${season}-offer-${ev.day}-${ev.playerName}`, day: ev.day, season, cat: 'mercado', title: ev.offerKind === 'loan' ? `Proposta de empréstimo por ${ev.playerName}` : `Proposta por ${ev.playerName}`, text: `${clubName(ev.fromClubId || ev.buyerId || ev.clubId) || 'Um clube'} quer o jogador${ev.amount ? ` · ${money(ev.amount)}` : ''}`, action: 'market' };
  }
  if (ev.type === 'copa-round') {
    return { id: `s${season}-copa-${ev.day}`, day: ev.day, season, cat: 'imprensa', title: `Copa do Brasil: ${ev.roundLabel} definida`, text: 'Confira o chaveamento', action: 'copa' };
  }
  return null;
}

function inboxFromTransferLog(entry, idx, save) {
  if (!entry || (entry.fromClubId !== save.myClubId && entry.toClubId !== save.myClubId)) return null;
  const season = entry.season ?? save.season;
  const day = entry.day ?? 0;
  const id = `tlog-${idx}-${entry.playerName}`;
  const buying = entry.toClubId === save.myClubId;
  const other = clubName(buying ? entry.fromClubId : entry.toClubId);
  if (entry.type === 'loan-return') {
    return { id, day, season, cat: 'mercado', title: buying ? `${entry.playerName} volta de empréstimo` : `${entry.playerName} volta ao ${other}`, text: buying ? `Retorna do ${other}` : 'Fim do empréstimo' };
  }
  const isLoan = String(entry.type || '').startsWith('loan');
  const title = isLoan
    ? (buying ? `${entry.playerName} chega emprestado do ${other}` : `${entry.playerName} emprestado ao ${other}`)
    : (buying ? `${entry.playerName} chega do ${other}` : `${entry.playerName} vendido ao ${other}`);
  const text = entry.amount ? `${money(entry.amount)}${buying ? ' · reforço' : ' entraram no caixa'}` : 'Negócio concluído';
  return { id, day, season, cat: 'mercado', title, text };
}

// ── Sincronização (idempotente) ───────────────────────────────────────
export function syncCareerMeta(save) {
  if (!save || !save.clubs?.[save.myClubId]) return save;
  let next = ensureCareerMetaDefaults(save);
  const { data: division } = myDivision(next);
  const round = division.round;
  const balance = next.clubs[next.myClubId].budget;
  const pos = division.table.findIndex(r => r.id === next.myClubId) + 1;

  // Histórico de saldo/posição por rodada.
  const hist = next.budgetHistory;
  const last = hist[hist.length - 1];
  if (!last || last.season !== next.season || last.round !== round) {
    next = { ...next, budgetHistory: [...hist, { season: next.season, round, balance, pos }].slice(-HISTORY_LIMIT) };
  } else if (last.balance !== balance || last.pos !== pos) {
    next = { ...next, budgetHistory: [...hist.slice(0, -1), { ...last, balance, pos }] };
  }

  // Caixa de entrada: eventos do último avanço + transferências do meu clube.
  const known = new Set(next.inbox.map(m => m.id));
  const fresh = [];
  for (const ev of next.lastDayEvents || []) {
    const item = inboxFromEvent(ev, next);
    if (item && !known.has(item.id)) { fresh.push(item); known.add(item.id); }
  }
  (next.transferLog || []).forEach((entry, idx) => {
    const item = inboxFromTransferLog(entry, idx, next);
    if (item && !known.has(item.id)) { fresh.push(item); known.add(item.id); }
  });

  // Diretoria: mensagem quando a confiança muda de faixa (só depois de a
  // temporada começar, e uma de boas-vindas no início de cada temporada).
  const board = computeBoard(next);
  const prevBoard = next.board;
  let boardState = prevBoard;
  if (!prevBoard || prevBoard.season !== next.season) {
    boardState = { season: next.season, band: board.status, confidence: board.confidence, goal: board.text };
    const id = `s${next.season}-board-start`;
    if (!known.has(id)) fresh.push({ id, day: next.calendarDay, season: next.season, cat: 'diretoria', title: `Meta da temporada ${next.season}: ${board.text.toLowerCase()}`, text: 'A diretoria vai acompanhar a campanha rodada a rodada.' });
  } else if (round > 0 && prevBoard.band !== board.status) {
    const id = `s${next.season}-board-r${round}-${board.status}`;
    const msg = board.status === 'Crítico'
      ? { title: 'Diretoria cobra reação', text: `Confiança em ${board.confidence}%. A meta (${board.short}) está ficando longe.` }
      : board.status === 'Em risco'
        ? { title: 'Diretoria preocupada', text: `Confiança caiu para ${board.confidence}%. Os resultados precisam melhorar.` }
        : { title: 'Diretoria satisfeita', text: `Confiança voltou para ${board.confidence}%. O time está no caminho da meta.` };
    if (!known.has(id)) fresh.push({ id, day: next.calendarDay, season: next.season, cat: 'diretoria', ...msg });
    boardState = { ...prevBoard, band: board.status, confidence: board.confidence };
  } else if (prevBoard.confidence !== board.confidence) {
    boardState = { ...prevBoard, confidence: board.confidence };
  }
  if (boardState !== prevBoard) next = { ...next, board: boardState };

  // Observados: aviso quando a janela abre (uma vez por janela).
  if ((next.shortlist || []).length && isTransferWindowOpen(next.calendarDay)) {
    const windowKey = next.calendarDay <= 31 ? 'jan' : 'jul';
    const id = `s${next.season}-shortlist-${windowKey}`;
    if (!known.has(id)) {
      const n = next.shortlist.length;
      fresh.push({ id, day: next.calendarDay, season: next.season, cat: 'mercado', action: 'market', title: `${n} jogador${n > 1 ? 'es' : ''} observado${n > 1 ? 's' : ''} disponíve${n > 1 ? 'is' : 'l'}`, text: 'A janela de transferências abriu — veja a aba Observados.' });
    }
  }

  if (fresh.length) {
    const inbox = [...fresh.map(m => ({ ...m, read: false })), ...next.inbox]
      .sort((a, b) => (b.season - a.season) || (b.day - a.day))
      .slice(0, INBOX_LIMIT);
    next = { ...next, inbox };
  }
  return next;
}

export function markInboxRead(save, ids) {
  const set = ids ? new Set(ids) : null;
  return { ...save, inbox: (save.inbox || []).map(m => (!set || set.has(m.id) ? { ...m, read: true } : m)) };
}

export function transferWindowText(day) {
  if (isTransferWindowOpen(day)) return { open: true, text: `Janela aberta · fecha ${shortDate(currentWindowCloseDay(day))}` };
  const openDay = nextWindowOpenDay(day);
  return { open: false, text: openDay ? `Janela fechada · abre ${shortDate(openDay)}` : 'Janela fechada' };
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MLEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function dayParts(day) {
  let r = Math.max(1, Math.min(365, day));
  for (let m = 0; m < 12; m++) {
    if (r <= MLEN[m]) return { d: r, m: MONTHS[m] };
    r -= MLEN[m];
  }
  return { d: day, m: '' };
}
export function shortDate(day) {
  const { d, m } = dayParts(day);
  return `${String(d).padStart(2, '0')}/${m}`;
}
