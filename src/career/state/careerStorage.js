// Persistência do Modo Carreira — chaves PRÓPRIAS e separadas de `brl_save`
// (a do modo clássico/Atual 2026/Copa), seguindo a convenção `brl_<feature>`
// já usada no projeto. Nunca lida por nenhum outro modo; nunca escreve em
// `brl_save`.
//
// Multi-carreira (pedido explícito do usuário 2026-11-12: "permita criar
// mais de uma carreira também e depois só clicar em carregar carreira") —
// cada carreira vira um slot próprio (`brl_career_save_<seed>`, chaveado
// pelo `save.seed` que toda carreira já tem desde sempre, nunca muda e é
// único por construção — não precisou de nenhum campo novo no save pra
// isso). Um índice (`brl_career_saves_index`) guarda a lista de seeds
// existentes, e `brl_career_active_seed` guarda qual delas é "a atual"
// (a que abre direto ao entrar no Modo Carreira, a mesma que já era
// resumida antes dessa mudança). "Nova carreira" NUNCA mais apaga nada —
// só cria mais um slot e marca ele como ativo; apagar uma carreira de
// verdade agora é uma ação própria e explícita (ver deleteCareerSave),
// disponível na tela de carregar carreira.
//
// Save de antes dessa mudança (chave única `brl_career_save`) é migrado
// automaticamente na primeira leitura (ver migrateLegacyIfNeeded) — vira o
// primeiro (e, até criar outra, único) slot do esquema novo, sem o jogador
// perceber nada.
import { buildSeasonCalendar } from '../engine/calendar.js';
import { drawCopaBracket, COPA_DAYS } from '../engine/copaEngine.js';
import { makePrng, hashSeed } from '../../App.jsx';
import { TEAMS } from '../../data/teams.js';
import { ensureCareerMetaDefaults } from '../engine/careerMeta.js';

const LEGACY_KEY = 'brl_career_save';
const INDEX_KEY = 'brl_career_saves_index';
const ACTIVE_KEY = 'brl_career_active_seed';
const slotKey = (seed) => `brl_career_save_${seed}`;

function readIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function writeIndex(ids) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
  } catch {
    // ignora
  }
}

function migrateLegacyIfNeeded() {
  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (!legacyRaw) return;
    if (readIndex().length === 0) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy?.seed) {
        localStorage.setItem(slotKey(legacy.seed), legacyRaw);
        writeIndex([legacy.seed]);
        localStorage.setItem(ACTIVE_KEY, legacy.seed);
      }
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignora
  }
}

// Idade real (`age`) foi preenchida em teams.js depois que varios saves já
// existiam — o roster de um save é um clone tirado na criação da carreira
// (rosterStore.js), então não herda automaticamente dados novos de
// teams.js. Preenche a idade que falta puxando de teams.js: primeiro tenta
// achar o jogador no mesmo clube (cobre o caso comum de ele nunca ter sido
// negociado); se não achar (foi vendido/emprestado), cai pra uma busca
// pelo nome em qualquer clube — mas só aplica se o nome for inequívoco
// (existem jogadores reais homônimos entre clubes nesse elenco; melhor
// deixar sem idade do que arriscar atribuir a de outra pessoa).
function backfillAges(save) {
  const needsBackfill = Object.values(save.clubs).some(c => c.roster.some(p => p.age == null));
  if (!needsBackfill) return save;
  const ageByName = new Map();
  const ambiguous = new Set();
  for (const team of TEAMS) {
    for (const p of team.players) {
      if (p.age == null) continue;
      if (ageByName.has(p.name) && ageByName.get(p.name) !== p.age) ambiguous.add(p.name);
      else ageByName.set(p.name, p.age);
    }
  }
  const clubs = {};
  for (const [id, club] of Object.entries(save.clubs)) {
    const masterTeam = TEAMS.find(t => t.id === id);
    const roster = club.roster.map(p => {
      if (p.age != null) return p;
      const sameClubMatch = masterTeam?.players.find(tp => tp.name === p.name && tp.age != null);
      if (sameClubMatch) return { ...p, age: sameClubMatch.age };
      if (!ambiguous.has(p.name) && ageByName.has(p.name)) return { ...p, age: ageByName.get(p.name) };
      return p;
    });
    clubs[id] = { ...club, roster };
  }
  return { ...save, clubs };
}

// Save salvo antes da Copa do Brasil separar ida/volta em dias diferentes
// (2026-11-09) tem `copa.calendar` como array de 6 números (um dia por
// fase, resolvia ida+volta juntas) — troca pro novo formato de pares
// (COPA_DAYS, ver copaEngine.js) e preenche `leg`/`leg1Results` que não
// existiam. Um `pendingUserCopaTie` em andamento nesse save antigo (só
// pode estar parado na ida, já que o formato antigo nunca pausava no meio
// de duas pernas) já tem exatamente o formato `{aId,bId,leg1Match}` que o
// novo fluxo de ida espera — só ganha `leg:'ida'` pra cair na tela nova
// certa; a volta dele passa a ser pedida no dia certo, dias depois, não
// mais na mesma sessão.
function backfillCopaLegs(save) {
  if (!save.copa || typeof save.copa.calendar?.[0] !== 'number') return save;
  const copa = { ...save.copa, calendar: COPA_DAYS, leg: save.copa.leg ?? 'ida', leg1Results: save.copa.leg1Results ?? null };
  const pendingUserCopaTie = save.pendingUserCopaTie && !save.pendingUserCopaTie.isFinal && !save.pendingUserCopaTie.leg
    ? { ...save.pendingUserCopaTie, leg: 'ida' }
    : save.pendingUserCopaTie;
  return { ...save, copa, pendingUserCopaTie };
}

// Preenche campos que saves antigos (de antes do calendário dia a dia, da
// lista de transferências, ou da Copa do Brasil) não tinham — evita
// quebrar um save salvo numa versão anterior do Modo Carreira em vez de
// forçar o jogador a começar de novo.
function backfill(save) {
  if (!save) return save;
  let next = save;
  if (next.calendarDay == null || !next.seasonCalendar) {
    next = { ...next, calendarDay: next.calendarDay ?? 32, seasonCalendar: next.seasonCalendar ?? buildSeasonCalendar(38) };
  }
  // `transferList` (lista de transferências) é mais recente que o
  // calendário — saves que já tinham calendário mas não essa lista caíam
  // no `return save` acima antes desse campo existir.
  if (!next.transferList) next = { ...next, transferList: [] };
  // `loanList` (lista de empréstimo) é mais recente ainda — empréstimo
  // existia antes, mas era uma ação direta (sem lista); save de quando
  // isso mudou (2026-11-09) ainda não tem o campo.
  if (!next.loanList) next = { ...next, loanList: [] };
  // Copa do Brasil é mais recente ainda — save antigo sem ela ganha uma
  // Copa nova sorteada na hora, a partir do elenco atual (o calendário
  // dela usa `next.seasonCalendar`, que já existe nesse ponto).
  if (!next.copa) {
    const rand = makePrng(hashSeed(`${next.seed}|copa-backfill|${next.season}`));
    next = { ...next, copa: drawCopaBracket(next, rand, next.seasonCalendar), pendingUserCopaTie: next.pendingUserCopaTie ?? null };
  }
  next = backfillAges(next);
  next = backfillCopaLegs(next);
  // Visão geral redesenhada (2026-11-13): histórico de saldo/posição por
  // rodada, caixa de entrada e estado da diretoria — saves antigos começam
  // vazios e são preenchidos a partir da rodada seguinte (careerMeta.js).
  next = ensureCareerMetaDefaults(next);
  return next;
}

function readSlot(seed) {
  try {
    const raw = localStorage.getItem(slotKey(seed));
    return raw ? backfill(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

// Todas as carreiras salvas, mais recente jogada primeiro — pra tela de
// "Carregar carreira" listar. Carrega o save inteiro de cada uma (não só
// metadado) porque o motor não guarda um resumo separado; aceitável pelo
// número baixo de carreiras que um jogador tende a ter por vez.
export function listCareerSaves() {
  migrateLegacyIfNeeded();
  const ids = readIndex();
  return ids
    .map(readSlot)
    .filter(Boolean)
    .sort((a, b) => (b.calendarDay + b.season * 1000) - (a.calendarDay + a.season * 1000));
}

export function getActiveCareerSeed() {
  migrateLegacyIfNeeded();
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveCareerSeed(seed) {
  try {
    localStorage.setItem(ACTIVE_KEY, seed);
  } catch {
    // ignora
  }
}

// Carrega a carreira ativa (a que abre direto ao entrar no Modo Carreira,
// igual sempre foi) — null se nunca existiu nenhuma.
export function loadCareerSave() {
  migrateLegacyIfNeeded();
  const seed = getActiveCareerSeed();
  return seed ? readSlot(seed) : null;
}

export function loadCareerSaveBySeed(seed) {
  return readSlot(seed);
}

// Salva no PRÓPRIO slot da carreira (chaveado por `save.seed`) e marca ela
// como a ativa — chamado a cada mudança de estado durante o jogo (ver
// CareerApp.jsx), então "qual carreira é a atual" sempre acompanha a que
// está sendo jogada agora mesmo.
export function saveCareerSave(save) {
  try {
    localStorage.setItem(slotKey(save.seed), JSON.stringify(save));
    const ids = readIndex();
    if (!ids.includes(save.seed)) writeIndex([...ids, save.seed]);
    setActiveCareerSeed(save.seed);
  } catch {
    // localStorage indisponível/cheio — ignora, igual ao padrão já usado
    // pelo resto do app (brl_save, brl_difficulty etc.).
  }
}

// Apaga uma carreira específica de vez (pedido explícito do usuário: ação
// própria, separada de "começar carreira nova", que agora NUNCA apaga
// nada sozinha) — se era a ativa, a próxima mais recente (se houver)
// assume o lugar; devolve o seed que ficou ativo (ou null, sem nenhuma
// carreira restante) pra quem chamou decidir a tela.
export function deleteCareerSave(seed) {
  try {
    localStorage.removeItem(slotKey(seed));
    const remaining = readIndex().filter(id => id !== seed);
    writeIndex(remaining);
    if (getActiveCareerSeed() === seed) {
      const nextActive = remaining[remaining.length - 1] || null;
      if (nextActive) setActiveCareerSeed(nextActive);
      else localStorage.removeItem(ACTIVE_KEY);
      return nextActive;
    }
    return getActiveCareerSeed();
  } catch {
    return null;
  }
}

export function hasCareerSave() {
  migrateLegacyIfNeeded();
  return readIndex().length > 0;
}
