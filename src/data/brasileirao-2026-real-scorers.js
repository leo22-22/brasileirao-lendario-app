// Artilharia REAL do Brasileirão Série A 2026 — top 20 da tabela da Placar
// (placar.com.br/tabelas/brasileirao-serie-a/artilharia, "Atualizado em
// 24/11/2026, 02:18", ou seja, com os jogos até 23/11 — os mesmos de
// REAL_RESULTS_2026). Conferida com a Wikipédia (23/11). Nenhum número aqui
// é inventado; quem não está no top 20 não entra (a fonte não lista).
//
// Usada só pelo Simulador 2026: (1) é o ponto de partida da artilharia
// (gols reais + gols simulados) e (2) calibra quem marca nos jogos
// simulados (`scoreBoost`), pelo ritmo real de cada um no próprio time.
// `name` = como o jogador está em TEAMS (ex.: o Danilo Santos do Botafogo é
// "Danilo (ATA)" no elenco). Atualize junto com os placares reais.
export const REAL_SCORERS_UPDATED_AT = '23/11';

export const REAL_SCORERS_2026 = [
  { teamId: 'athleticopr2026', name: 'Kevin Viveros', goals: 21 },
  { teamId: 'flamengo2026', name: 'Pedro', goals: 20 },
  { teamId: 'santos2026', name: 'Gabriel Barbosa', goals: 16 },
  { teamId: 'cruzeiro2026', name: 'Kaio Jorge', goals: 14 },
  { teamId: 'flamengo2026', name: 'Samuel Lino', goals: 13 },
  { teamId: 'vitoria2026', name: 'Rene', goals: 12 },
  { teamId: 'cruzeiro2026', name: 'Matheus Pereira', goals: 11 },
  { teamId: 'gremio2026', name: 'Carlos Vinicius', goals: 11 },
  { teamId: 'bahia2026', name: 'Luciano Juba', goals: 11 },
  { teamId: 'palmeiras2026', name: 'Jose Manuel Lopez', goals: 10 },
  { teamId: 'botafogo2026', name: 'Danilo (ATA)', goals: 10 },
  { teamId: 'remo2026', name: 'Jaja', goals: 10 },
  { teamId: 'palmeiras2026', name: 'Mauricio', goals: 10 },
  { teamId: 'saopaulo2026', name: 'Jonathan Calleri', goals: 10 },
  { teamId: 'coritiba2026', name: 'Pedro Rocha', goals: 9 },
  { teamId: 'coritiba2026', name: 'Breno Lopes', goals: 9 },
  { teamId: 'fluminense2026', name: 'John Kennedy', goals: 9 },
  { teamId: 'saopaulo2026', name: 'Luciano', goals: 9 },
  { teamId: 'flamengo2026', name: 'Jorge Carrascal', goals: 8 },
  { teamId: 'santos2026', name: 'Neymar', goals: 8 },
];
