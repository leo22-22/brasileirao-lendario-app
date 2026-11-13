// Categoria de base do Modo Carreira — a cada temporada, todo clube (os 40
// da Série A/B 2026) recebe 2-3 jovens novos, gerados do zero: nome,
// posição, idade (16-19), overall-base por tier, chance de ter potencial
// de crescer, e uma chance rara e independente de sair uma "joia" —
// inclusive num clube pequeno, de propósito (ver tabela de números no
// plano aprovado). Determinístico: a mesma seed+clube+temporada sempre
// gera os mesmos jovens, pra um save ser reproduzível.
import { POS_ORDER } from '../../lib/format.js';
import { careerClubTier } from '../../data/career-clubs.js';

// Peso de cada posição na geração — goleiro é raro (só precisa de 2-3 no
// elenco inteiro), meio-campo/ataque mais comuns, espelhando a composição
// real de um elenco.
const POSITION_WEIGHTS = {
  GOL: 3, ZAG: 10, LD: 7, LE: 7, VOL: 10, MC: 10, MEI: 9, PD: 8, PE: 8, ATA: 10, MD: 2, ME: 2,
};

function weightedPosition(rand) {
  const entries = POS_ORDER.map(p => [p, POSITION_WEIGHTS[p] || 1]);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rand() * total;
  for (const [pos, w] of entries) {
    if (roll < w) return pos;
    roll -= w;
  }
  return entries[entries.length - 1][0];
}

// ~60 nomes/sobrenomes brasileiros comuns, pra montar "Nome Sobrenome"
// (60% das vezes) — mistura com os elencos reais de 2026, que usam nome
// completo. Os outros 40% usam um apelido único de estilo histórico
// ("Nadinho"), pra manter a tradição do jogo pros jovens recém-descobertos.
const FIRST_NAMES = [
  'Lucas', 'Matheus', 'Gabriel', 'Rafael', 'Bruno', 'Thiago', 'Felipe', 'Eduardo', 'Diego', 'Rodrigo',
  'Caio', 'Pedro', 'Vinicius', 'Guilherme', 'Vitor', 'Leonardo', 'Daniel', 'Marcos', 'Igor', 'Juan',
  'Yuri', 'Carlos', 'Henrique', 'Alan', 'Wesley', 'Erick', 'Nathan', 'Kauan', 'Jhonatan', 'Robson',
  'Everton', 'Anderson', 'Luiz', 'Fabio', 'Renan', 'Douglas', 'Jefferson', 'Weverton', 'Jonas', 'Elias',
  'Gustavo', 'Ryan', 'Breno', 'Davi', 'Samuel', 'Otavio', 'Wallace', 'Ricardo', 'Alex', 'Cauan',
  'Joao', 'Antonio', 'Jorge', 'Paulo', 'Sergio', 'Nicolas', 'Emerson', 'Fernando', 'Rogerio', 'Vagner',
];
const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Ferreira', 'Almeida', 'Lima', 'Araujo',
  'Carvalho', 'Gomes', 'Ribeiro', 'Martins', 'Barbosa', 'Rocha', 'Dias', 'Teixeira', 'Fernandes', 'Moreira',
  'Cardoso', 'Nunes', 'Correia', 'Nascimento', 'Pinto', 'Monteiro', 'Mendes', 'Freitas', 'Vieira', 'Castro',
  'Campos', 'Cavalcante', 'Azevedo', 'Macedo', 'Borges', 'Reis', 'Andrade', 'Brito', 'Peixoto', 'Farias',
];
const NICKNAMES = [
  'Nadinho', 'Leozinho', 'Marito', 'Biriba', 'Carioca', 'Baiano', 'Mineirinho', 'Paulistinha', 'Negao',
  'Tigrinho', 'Foguinho', 'Furacao', 'Ferinha', 'Canhotinha', 'Pezinho', 'Dinho', 'Betinho', 'Zequinha',
  'Tatu', 'Bolinha', 'Formiga', 'Flechinha', 'Pardal', 'Tico', 'Juninho', 'Mazinho', 'Pipico', 'Tande',
  'Vavazinho', 'Chiquinho', 'Pelezinho', 'Netinho', 'Gaucho', 'Serginho', 'Capixaba', 'Potiguar', 'Cearinha',
  'Baianinho', 'Mogi', 'Trator',
];

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

export function generateProspectName(rand) {
  if (rand() < 0.4) return pick(NICKNAMES, rand);
  return `${pick(FIRST_NAMES, rand)} ${pick(LAST_NAMES, rand)}`;
}

// Faixas por tier: [ovrMin, ovrMax], chance de ter potencial de crescer,
// [ganhoMin, ganhoMax] por temporada enquanto crescer, chance de "joia"
// (independente, aplicada depois do sorteio normal), [ovrMin, ovrMax] da
// joia.
// Exportado (2026-11-13) só para a tela de Base mostrar "O que esperar" com
// os números reais — nenhuma regra mudou.
export const TIER_TABLE = {
  elite: { ovr: [58, 68], growthChance: 0.55, growthRange: [1, 4], starChance: 0.06, starOvr: [78, 86] },
  grande: { ovr: [54, 64], growthChance: 0.45, growthRange: [1, 3], starChance: 0.03, starOvr: [78, 86] },
  medio: { ovr: [50, 60], growthChance: 0.35, growthRange: [1, 3], starChance: 0.012, starOvr: [78, 86] },
  pequeno: { ovr: [46, 56], growthChance: 0.30, growthRange: [1, 2], starChance: 0.004, starOvr: [78, 86] },
};

function randInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

export function generateYouthProspect(rand, tier) {
  const table = TIER_TABLE[tier] || TIER_TABLE.pequeno;
  const isStar = rand() < table.starChance;
  const ovr = isStar ? randInt(rand, table.starOvr[0], table.starOvr[1]) : randInt(rand, table.ovr[0], table.ovr[1]);
  const hasPotential = isStar || rand() < table.growthChance;
  const growthPerSeason = hasPotential ? randInt(rand, table.growthRange[0], table.growthRange[1]) : 0;
  // Potencial = teto que o overall pode alcançar crescendo; sem potencial,
  // o teto é o próprio overall atual (nunca cresce).
  const seasonsOfGrowth = hasPotential ? randInt(rand, 2, 5) : 0;
  const potential = hasPotential ? Math.min(99, ovr + growthPerSeason * seasonsOfGrowth) : ovr;
  return {
    name: generateProspectName(rand),
    pos: [weightedPosition(rand)],
    ovr,
    age: randInt(rand, 16, 19),
    potential,
    growthPerSeason,
    isStar,
    isYouth: true,
    // Começa na categoria de base (fora do elenco profissional — não
    // aparece no Elenco/Formação/Mercado) até o usuário promover ou
    // completar 20 anos (ver promoteYouthPlayer em rosterStore.js e a
    // graduação automática em seasonEngine.js).
    inAcademy: true,
  };
}

// Gera o lote de jovens de um clube numa temporada — 2 ou 3 jogadores,
// RNG semeado por save+clube+temporada (determinístico e barato: no
// máximo ~3 sorteios × 40 clubes = ~120 por temporada inteira).
export function generateClubYouthBatch(makePrngFn, hashSeedFn, saveSeed, clubId, season) {
  const rand = makePrngFn(hashSeedFn(`${saveSeed}|youth|${clubId}|${season}`));
  const tier = careerClubTier(clubId);
  const count = 2 + Math.floor(rand() * 2); // 2 ou 3
  return Array.from({ length: count }, () => generateYouthProspect(rand, tier));
}

