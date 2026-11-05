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

// Geometria simplificada em relação ao campinho clássico (que faz um
// agrupamento fino de linhas pra espalhar VOL/MC/MD/ME juntos) — aqui
// cada posição usa sua própria coordenada base, só espalhando
// horizontalmente quando tem mais de uma (ex.: 2 ZAG). Mais simples,
// ainda sem sobreposição visual pros 20 esquemas acima, e sem precisar
// replicar toda a heurística do campinho clássico.
export function buildPitchSlots(formationKey) {
  const scheme = FORMATIONS[formationKey] || FORMATIONS['4-3-3-misto'];
  const slots = [];
  for (const [pos, qty] of Object.entries(scheme.counts)) {
    const base = BASE_COORDS[pos];
    if (!base) continue;
    for (let i = 0; i < qty; i++) {
      const key = qty === 1 ? pos : `${pos}${i + 1}`;
      let x = base.x;
      if (qty > 1) {
        const spread = qty === 2 ? 16 : qty === 3 ? 22 : 12;
        const offset = (i - (qty - 1) / 2) * (spread * 2 / Math.max(qty - 1, 1));
        x = Math.max(8, Math.min(92, base.x + offset));
      }
      slots.push({ key, label: pos, realPos: pos, x, y: base.y });
    }
  }
  return slots;
}
