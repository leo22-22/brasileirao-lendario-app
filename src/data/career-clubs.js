// Metadados do Modo Carreira pros 40 clubes reais de 2026 (20 Série A +
// 20 Série B, ids em src/data/teams.js). Um único campo `tier` alimenta
// duas coisas ao mesmo tempo: o FatorClube da fórmula de preço (ver
// src/career/engine/pricing.js) e a qualidade média da categoria de base
// (ver src/career/engine/youth.js) — clube grande paga mais por jogador E
// tem uma base melhor em média, mas isso nunca impede uma joia rara surgir
// num clube pequeno (ver tabela de chances em youth.js).
//
// `stadiumCapacity` é a capacidade real de cada estádio (dado público,
// Wikipedia/TheSportsDB) — usada só pra calcular a renda de público em
// casa (src/career/engine/economy.js). `tier` decide ocupação média e
// preço do ingresso, não a capacidade em si.
//
// Nenhum destes clubes/tiers afeta qualquer outro modo do jogo — usado só
// dentro de src/career/.

export const SERIE_A_2026_TEAM_IDS = [
  'flamengo2026', 'palmeiras2026', 'cruzeiro2026', 'corinthians2026', 'botafogo2026',
  'fluminense2026', 'saopaulo2026', 'bahia2026', 'mirassol2026', 'vasco2026',
  'atleticomg2026', 'internacional2026', 'athleticopr2026', 'coritiba2026', 'bragantino2026',
  'vitoria2026', 'remo2026', 'chapecoense2026', 'santos2026', 'gremio2026',
];

export const SERIE_B_2026_TEAM_IDS = [
  'fortaleza2026', 'sport2026', 'juventude2026', 'ceara2026', 'goias2026',
  'novorizontino2026', 'athletic2026', 'criciuma2026', 'crb2026', 'vilanova2026',
  'cuiaba2026', 'atleticogo2026', 'operario2026', 'avai2026', 'saobernardo2026',
  'botafogosp2026', 'americamg2026', 'londrina2026', 'pontepreta2026', 'nautico2026',
];

export const CAREER_CLUB_IDS = [...SERIE_A_2026_TEAM_IDS, ...SERIE_B_2026_TEAM_IDS];

// tier: 'elite' | 'grande' | 'medio' | 'pequeno' — lista própria do jogo,
// não precisa bater 100% com o "G12" real; é só pra equilibrar preços e
// categoria de base.
export const CAREER_CLUB_META = {
  // Série A 2026
  flamengo2026: { tier: 'elite', stadiumCapacity: 78838 }, // Maracanã
  palmeiras2026: { tier: 'elite', stadiumCapacity: 43713 }, // Allianz Parque
  cruzeiro2026: { tier: 'elite', stadiumCapacity: 61846 }, // Mineirão
  corinthians2026: { tier: 'elite', stadiumCapacity: 49205 }, // Neo Química Arena
  botafogo2026: { tier: 'elite', stadiumCapacity: 46931 }, // Nilton Santos
  fluminense2026: { tier: 'elite', stadiumCapacity: 78838 }, // Maracanã
  saopaulo2026: { tier: 'elite', stadiumCapacity: 66795 }, // MorumBIS
  bahia2026: { tier: 'elite', stadiumCapacity: 50025 }, // Arena Fonte Nova
  vasco2026: { tier: 'elite', stadiumCapacity: 21880 }, // São Januário
  atleticomg2026: { tier: 'elite', stadiumCapacity: 46000 }, // Arena MRV
  internacional2026: { tier: 'elite', stadiumCapacity: 50128 }, // Beira-Rio
  gremio2026: { tier: 'elite', stadiumCapacity: 55662 }, // Arena do Grêmio

  mirassol2026: { tier: 'grande', stadiumCapacity: 15100 }, // Mirassolão
  athleticopr2026: { tier: 'grande', stadiumCapacity: 42372 }, // Arena da Baixada
  coritiba2026: { tier: 'grande', stadiumCapacity: 40000 }, // Couto Pereira
  bragantino2026: { tier: 'grande', stadiumCapacity: 17500 }, // Nabi Abi Chedid
  vitoria2026: { tier: 'grande', stadiumCapacity: 30000 }, // Barradão
  remo2026: { tier: 'grande', stadiumCapacity: 16200 }, // Baenão
  chapecoense2026: { tier: 'grande', stadiumCapacity: 19500 }, // Arena Condá
  santos2026: { tier: 'grande', stadiumCapacity: 16068 }, // Vila Belmiro

  // Série B 2026
  fortaleza2026: { tier: 'medio', stadiumCapacity: 63903 }, // Castelão (compartilhado)
  sport2026: { tier: 'medio', stadiumCapacity: 30000 }, // Ilha do Retiro
  juventude2026: { tier: 'medio', stadiumCapacity: 19924 }, // Alfredo Jaconi
  ceara2026: { tier: 'medio', stadiumCapacity: 63903 }, // Castelão (compartilhado)
  goias2026: { tier: 'medio', stadiumCapacity: 12500 }, // Serrinha
  americamg2026: { tier: 'medio', stadiumCapacity: 23018 }, // Raimundo Sampaio
  avai2026: { tier: 'medio', stadiumCapacity: 17800 }, // Aderbal Ramos da Silva
  criciuma2026: { tier: 'medio', stadiumCapacity: 19225 }, // Heriberto Hülse
  vilanova2026: { tier: 'medio', stadiumCapacity: 11788 }, // Onésio Brasileiro Alvarenga

  novorizontino2026: { tier: 'pequeno', stadiumCapacity: 10041 }, // Jorge Ismael de Biasi
  athletic2026: { tier: 'pequeno', stadiumCapacity: 4655 }, // Joaquim Portugal
  crb2026: { tier: 'pequeno', stadiumCapacity: 20800 }, // Rei Pelé
  cuiaba2026: { tier: 'pequeno', stadiumCapacity: 44097 }, // Arena Pantanal
  atleticogo2026: { tier: 'pequeno', stadiumCapacity: 13000 }, // Antônio Accioly
  operario2026: { tier: 'pequeno', stadiumCapacity: 10632 }, // Germano Krüger
  saobernardo2026: { tier: 'pequeno', stadiumCapacity: 16000 }, // Primeiro de Maio
  botafogosp2026: { tier: 'pequeno', stadiumCapacity: 29292 }, // Santa Cruz
  londrina2026: { tier: 'pequeno', stadiumCapacity: 36000 }, // Jacy Scaff
  pontepreta2026: { tier: 'pequeno', stadiumCapacity: 19728 }, // Moisés Lucarelli
  nautico2026: { tier: 'pequeno', stadiumCapacity: 19800 }, // Eládio de Barros Carvalho
};

export function careerClubTier(clubId) {
  return CAREER_CLUB_META[clubId]?.tier || 'pequeno';
}

export function careerClubDivision(clubId) {
  return SERIE_A_2026_TEAM_IDS.includes(clubId) ? 'A' : 'B';
}
