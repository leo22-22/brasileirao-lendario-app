// Esquemas táticos e geometria do campinho do Modo Carreira — os mesmos
// 20 esquemas (`FORMATIONS`) e coordenadas base (`BASE_COORDS`) que o modo
// clássico usa em App.jsx, duplicados aqui de propósito: App.jsx importa
// CareerApp.jsx (pra montar o Modo Carreira), que acaba importando de
// volta pra App.jsx nesse ciclo — uma `const` como FORMATIONS quebra com
// "Cannot access before initialization" (TDZ) se importada assim (só
// function declaration sobrevive ao ciclo, por ser hoisted — é por isso
// que `teamStrength`/`makePrng`/`hashSeed`/`simAiMatch` continuam
// importados direto de App.jsx em outros arquivos do Modo Carreira). Mais
// simples e seguro duplicar esses poucos KB de dados do que arriscar o
// import circular de novo (já aconteceu uma vez com `CUP_ROUND_NAMES`,
// ver copaEngine.js).
export const FORMATIONS = {
  '4-3-3-ofensivo': { label: '4-3-3 Ofensivo', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MEI: 2, PD: 1, PE: 1, ATA: 1 } },
  '4-3-3-misto': { label: '4-3-3 Equilibrado', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 1, MEI: 1, PD: 1, PE: 1, ATA: 1 } },
  '4-3-3-defensivo': { label: '4-3-3 Defensivo', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 2, MC: 1, PD: 1, PE: 1, ATA: 1 } },
  '4-4-2-linha': { label: '4-4-2 Tradicional', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 2, MD: 1, ME: 1, ATA: 2 } },
  '4-4-2-losango-misto': { label: '4-4-2 Losango', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 2, MEI: 1, ATA: 2 } },
  '4-4-2-quadrado': { label: '4-2-2-2 Quadrado', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 2, MEI: 2, ATA: 2 } },
  '4-2-3-1-classico': { label: '4-2-3-1 Defensivo', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 2, MC: 1, MD: 1, ME: 1, ATA: 1 } },
  '4-2-3-1-ofensivo': { label: '4-2-3-1 Ofensivo', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 1, MEI: 1, MD: 1, ME: 1, ATA: 1 } },
  '4-1-4-1-ofensivo': { label: '4-1-4-1 Ofensivo', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 2, MD: 1, ME: 1, ATA: 1 } },
  '4-1-4-1-linha': { label: '4-1-4-1 Técnico', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MD: 1, MEI: 2, ME: 1, ATA: 1 } },
  '4-5-1-retranca': { label: '4-5-1 Defensivo', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 2, MEI: 1, MD: 1, ME: 1, ATA: 1 } },
  '4-3-1-2-misto': { label: '4-3-1-2 Equilibrado', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, MC: 3, MEI: 1, ATA: 2 } },
  '4-3-1-2-defensivo': { label: '4-3-1-2 Defensivo', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 3, MEI: 1, ATA: 2 } },
  '4-1-3-2-ofensivo': { label: '4-1-3-2 Ofensivo', counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MD: 1, MEI: 1, ME: 1, ATA: 2 } },
  '3-5-2-equilibrio': { label: '3-5-2 Equilibrado', counts: { GOL: 1, ZAG: 3, MD: 1, VOL: 1, MC: 1, MEI: 1, ME: 1, ATA: 2 } },
  '3-5-2-pesado': { label: '3-5-2 Defensivo', counts: { GOL: 1, ZAG: 3, MD: 1, VOL: 2, MEI: 1, ME: 1, ATA: 2 } },
  '3-4-3-misto': { label: '3-4-3 Equilibrado', counts: { GOL: 1, ZAG: 3, VOL: 1, MC: 1, MD: 1, ME: 1, PD: 1, PE: 1, ATA: 1 } },
  '3-4-2-1-moderno': { label: '3-4-2-1 Moderno', counts: { GOL: 1, ZAG: 3, VOL: 1, MC: 1, MD: 1, ME: 1, MEI: 2, ATA: 1 } },
  '3-2-4-1-ofensivo': { label: '3-2-4-1 Ofensivo', counts: { GOL: 1, ZAG: 3, VOL: 1, MC: 1, MEI: 2, PD: 1, PE: 1, ATA: 1 } },
  '5-3-2-muralha': { label: '5-3-2 Defensivo', counts: { GOL: 1, LD: 1, ZAG: 3, LE: 1, VOL: 1, MC: 2, ATA: 2 } },
  '5-4-1-misto': { label: '5-4-1 Equilibrado', counts: { GOL: 1, LD: 1, ZAG: 3, LE: 1, VOL: 1, MC: 1, MD: 1, ME: 1, ATA: 1 } },
  '5-2-3-contra-ataque': { label: '5-2-3 Contra-Ataque', counts: { GOL: 1, LD: 1, ZAG: 3, LE: 1, VOL: 1, MC: 1, PD: 1, PE: 1, ATA: 1 } },
};

const BASE_COORDS = {
  GOL: { x: 50, y: 92 },
  LD: { x: 86, y: 76 },
  ZAG: { x: 50, y: 80 },
  LE: { x: 14, y: 76 },
  VOL: { x: 50, y: 62 },
  MC: { x: 50, y: 54 },
  MEI: { x: 50, y: 46 },
  MD: { x: 80, y: 48 },
  ME: { x: 20, y: 48 },
  PD: { x: 82, y: 22 },
  PE: { x: 18, y: 22 },
  ATA: { x: 50, y: 11 },
};

// Geometria do campinho — portada 1:1 do campinho clássico (App.jsx,
// `buildPitchSlots`) depois de um bug real: a primeira versão daqui
// (mais simples, cada posição na sua própria linha de BASE_COORDS) não
// agrupava VOL/MC/MD/ME na mesma altura quando cada um tinha qty 1 — um
// "4-3-3 Equilibrado" (VOL+MC+MEI, 1 de cada) ficava com os 3 EMPILHADOS
// verticalmente no centro do campo (todos em x=50), em vez de VOL+MC lado
// a lado como um time de verdade escala. Os dados de FORMATIONS/
// BASE_COORDS já eram idênticos aos do campinho clássico (só formatados
// diferente) — só faltava essa heurística de agrupar linhas.
export function buildPitchSlots(formationKey) {
  const scheme = FORMATIONS[formationKey] || FORMATIONS['4-3-3-misto'];
  const { counts } = scheme;

  // VOL e MC, quando os dois têm qty 1, ficam lado a lado na mesma linha
  // (em vez de um atrás do outro) — só a função muda, não a altura no
  // campo. MD/ME sempre entram na linha do MC quando ele existe (MD-MC-ME);
  // sem MC, entram na linha do MEI (MD-MEI-ME); sem os dois, ficam com o
  // VOL (o "4" plano de um 4-4-2 tradicional, por exemplo).
  const mergeVolMc = counts.VOL === 1 && counts.MC === 1;
  const hasMC = !!counts.MC;
  const hasMEI = !!counts.MEI;
  const hasWide = !!counts.MD || !!counts.ME;
  const wideJoinsMei = !hasMC && hasMEI && hasWide;
  const volJoinsWide = !hasMC && !hasMEI && hasWide;

  const mcRowY = mergeVolMc ? 58 : 52;
  const volRowY = mergeVolMc ? 58 : volJoinsWide ? 52 : 68;
  const meiRowY = 36;
  const wideRowY = hasMC ? mcRowY : hasMEI ? meiRowY : volRowY;

  const ROW_ORDER = { ME: 0, VOL: 1, MC: 2, MEI: 2, MD: 3 };
  const rows = new Map(); // y -> [{ pos, order }]
  const pushToRow = (pos, qty, rowY, order) => {
    if (!qty) return;
    if (!rows.has(rowY)) rows.set(rowY, []);
    const arr = rows.get(rowY);
    for (let i = 0; i < qty; i++) arr.push({ pos, order });
  };
  pushToRow('VOL', mergeVolMc ? 1 : counts.VOL, volRowY, ROW_ORDER.VOL);
  pushToRow('MC', mergeVolMc ? 1 : counts.MC, mcRowY, ROW_ORDER.MC);
  pushToRow('MD', counts.MD, wideRowY, ROW_ORDER.MD);
  pushToRow('ME', counts.ME, wideRowY, ROW_ORDER.ME);
  if (wideJoinsMei) pushToRow('MEI', counts.MEI, wideRowY, ROW_ORDER.MEI);

  const groupedPos = new Set(['VOL', 'MC', 'MD', 'ME']);
  if (wideJoinsMei) groupedPos.add('MEI');

  const slots = [];
  Object.entries(counts).forEach(([pos, qty]) => {
    if (groupedPos.has(pos)) return; // tratado abaixo via `rows`
    const base = BASE_COORDS[pos];
    if (!base) return;
    // MEI sozinho (sem se juntar à linha do MD/ME) usa a própria linha
    // (36) em vez do y padrão de BASE_COORDS (46), que ficaria colado na
    // linha do MC (52).
    const y = pos === 'MEI' ? meiRowY : base.y;
    for (let i = 0; i < qty; i++) {
      const key = qty === 1 ? pos : `${pos}${i + 1}`;
      let x = base.x;
      if (qty > 1) {
        const spread = qty === 2 ? 16 : qty === 3 ? 22 : 12;
        const offset = (i - (qty - 1) / 2) * (spread * 2 / Math.max(qty - 1, 1));
        x = Math.max(8, Math.min(92, base.x + offset));
      }
      slots.push({ key, label: pos, realPos: pos, x, y });
    }
  });

  const counters = {};
  for (const [rowY, items] of rows.entries()) {
    items.sort((a, b) => a.order - b.order);
    const n = items.length;
    const spread = n <= 1 ? 0 : n === 2 ? 18 : n === 3 ? 26 : 36;
    items.forEach((item, i) => {
      const offset = n <= 1 ? 0 : (i - (n - 1) / 2) * (spread * 2 / Math.max(n - 1, 1));
      const x = Math.max(8, Math.min(92, 50 + offset));
      counters[item.pos] = (counters[item.pos] ?? 0) + 1;
      const key = counts[item.pos] === 1 ? item.pos : `${item.pos}${counters[item.pos]}`;
      slots.push({ key, label: item.pos, realPos: item.pos, x, y: rowY });
    });
  }

  // 4-2-2-2: os MEIs ficam mais avançados e abertos, os volantes mais
  // fechados e recuados — não sobrepõem, mas também não ficam achatados
  // numa linha só.
  if (formationKey === '4-4-2-quadrado') {
    slots.forEach(s => {
      if (s.realPos === 'MEI') { s.y = 38; s.x = s.x < 50 ? 28 : 72; }
      if (s.realPos === 'VOL') { s.x = s.x < 50 ? 42 : 58; }
    });
  }

  return slots;
}

// Escala os 11 titulares a partir de um "pool" preferido (em ordem) pras
// vagas de um esquema — 1ª passada tenta bater a posição PRIMÁRIA exata
// de cada vaga; 2ª passada preenche o que sobrar com o melhor jogador
// disponível, seja qual for a posição dele (garante sempre 11/11
// preenchidos). Compartilhada entre a Formação do usuário
// (CareerFormationScreen.jsx) e a escalação automática dos 39 clubes de
// IA (teamForSim, simHelpers.js) — extraída pra cá depois de um bug real
// (2026-11-12): a IA escalava só "top 11 por OVR" sem olhar posição
// nenhuma, então dois goleiros bons podiam entrar titulares juntos (e um
// lado do campo ficar sem ninguém) — qualquer seleção de time precisa
// passar por uma vaga de cada posição de verdade, não só OVR bruto.
export function autoFillFromPool(pool, slots) {
  const used = new Set();
  const starters = {};
  for (const slot of slots) {
    const match = pool.find(p => !used.has(p.name) && p.pos[0] === slot.realPos);
    if (match) { starters[slot.key] = match.name; used.add(match.name); }
  }
  for (const slot of slots) {
    if (starters[slot.key]) continue;
    const any = pool.find(p => !used.has(p.name));
    if (any) { starters[slot.key] = any.name; used.add(any.name); }
  }
  return starters;
}
