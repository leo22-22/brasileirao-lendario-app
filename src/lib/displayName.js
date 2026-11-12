// Acentuação SÓ de exibição. Os dados (club, nomes de jogador, ids) ficam
// sem acento porque são usados como chave — escudo (CLUB_LOGOS), estádio,
// clássicos, saves do Modo Carreira e localStorage. Aqui só se troca o
// texto que aparece na tela.
const WORDS = {
  Sao: 'São', Gremio: 'Grêmio', Atletico: 'Atlético', Vitoria: 'Vitória', Goias: 'Goiás',
  Ceara: 'Ceará', Avai: 'Avaí', Criciuma: 'Criciúma', Cuiaba: 'Cuiabá', Nautico: 'Náutico',
  Parana: 'Paraná', America: 'América', Operario: 'Operário', Uniao: 'União',
  Campeao: 'Campeão', campeao: 'campeão', Campea: 'Campeã', campea: 'campeã',
  Bicampeao: 'Bicampeão', Tricampeao: 'Tricampeão', Tetracampeao: 'Tetracampeão', Pentacampeao: 'Pentacampeão',
  Brasileirao: 'Brasileirão', Paulistao: 'Paulistão', Taca: 'Taça', Robertao: 'Robertão', Maracana: 'Maracanã',
  Falcao: 'Falcão', Olimpico: 'Olímpico', Tostao: 'Tostão', Romario: 'Romário', Pele: 'Pelé',
  Socrates: 'Sócrates', Suarez: 'Suárez', Savio: 'Sávio', Felipao: 'Felipão', Maquina: 'Máquina',
  Triplice: 'Tríplice', Titulo: 'Título', titulo: 'título', inedita: 'inédita', inedito: 'inédito',
  historico: 'histórico', Historico: 'Histórico', vitorias: 'vitórias', milesimo: 'milésimo',
  Decada: 'Década', decada: 'década', Joao: 'João', Classificacao: 'Classificação', CLASSIFICACAO: 'CLASSIFICAÇÃO',
  Capitao: 'Capitão', capitao: 'capitão', formacao: 'formação', Formacao: 'Formação', Historia: 'História',
};
const RE = new RegExp(`(?<![\\p{L}])(${Object.keys(WORDS).join('|')})(?![\\p{L}])`, 'gu');
const cache = new Map();

export function displayName(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = cache.get(text);
  if (out === undefined) {
    out = text.replace(RE, w => WORDS[w]).replace(/\b1o\b/g, '1º');
    if (cache.size < 5000) cache.set(text, out);
  }
  return out;
}
