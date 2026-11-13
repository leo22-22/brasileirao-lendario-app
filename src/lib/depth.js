// Profundidade do elenco por posição — usada pela tela de Elenco (bloco
// "Profundidade por posição") e pelo Mercado (card "Carências"). Conta o
// jogador pela posição PRINCIPAL (p.pos[0]).
export const DEPTH_GROUPS = [
  { id: 'GOL', pos: ['GOL'] }, { id: 'LD', pos: ['LD'] }, { id: 'ZAG', pos: ['ZAG'] }, { id: 'LE', pos: ['LE'] },
  { id: 'VOL', pos: ['VOL'] }, { id: 'MC', pos: ['MC', 'MD', 'ME'] }, { id: 'MEI', pos: ['MEI'] },
  { id: 'PD/PE', pos: ['PD', 'PE'] }, { id: 'ATA', pos: ['ATA'] },
];

export const VETERAN_AGE = 32;

// roster = elenco profissional (sem quem está na base).
export function squadDepth(roster) {
  return DEPTH_GROUPS.map(d => {
    const ps = roster.filter(p => d.pos.includes(p.pos[0])).sort((a, b) => b.ovr - a.ovr);
    return { ...d, count: ps.length, best: ps[0] || null, bestOvr: ps.length ? ps[0].ovr : null, thin: ps.length <= 1 };
  });
}

export function squadNeeds(roster) {
  const depth = squadDepth(roster);
  const veterans = roster.filter(p => p.age != null && p.age >= VETERAN_AGE).sort((a, b) => b.age - a.age);
  return { thin: depth.filter(d => d.thin), veterans };
}
