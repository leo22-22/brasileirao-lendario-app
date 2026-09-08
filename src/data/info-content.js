// Texto/config das páginas institucionais (Como Jogar, Termos, Privacidade,
// Contato) + escudo→estádio — extraído de App.jsx pra ser compartilhado
// entre o jogo (App.jsx) e o bundle de conteúdo (src/content/), sem
// duplicar texto entre os dois.
export const CONTACT_EMAIL = 'leonardoranuci@brasileiraolendario.com.br';

export const INFO_TABS = [
  { id: 'como-jogar', label: 'Como Jogar', icon: '🎮' },
  { id: 'termos', label: 'Termos de Uso', icon: '📜' },
  { id: 'privacidade', label: 'Privacidade', icon: '🔒' },
  { id: 'contato', label: 'Contato', icon: '✉️' },
];

// URL própria de cada aba — path -> id da aba (usado pelo roteamento).
export const INFO_ROUTES = {
  '/como-jogar': 'como-jogar',
  '/termos-de-uso': 'termos',
  '/privacidade': 'privacidade',
  '/contato': 'contato',
};

export const HOW_TO_PLAY_STEPS = [
  { icon: '🎲', title: 'Monte seu elenco no draft', text: 'A cada rodada do draft, você sorteia um time histórico do Brasileirão (1959–2024) e escolhe UM jogador dele pra preencher uma vaga da sua formação. Não gostou do time sorteado? Você tem até 3 pulos pra tentar outro.' },
  { icon: '🧩', title: 'Escolha a formação e o capitão', text: 'Antes do draft, escolha entre várias formações táticas (4-4-2, 4-3-3, 3-5-2 e outras). Depois de montar os 11 titulares e o banco, escolha um capitão — ele ganha +2 de overall fixo pra temporada inteira.' },
  { icon: '⚙️', title: 'Escolha a dificuldade certa', text: 'Fácil, Normal, Difícil ou Lendário ajustam o nível dos adversários controlados pela IA. Lendário é pensado pra quem já manja do jogo — os rivais jogam bem acima do overall de papel deles.' },
  { icon: '🏆', title: 'Brasileirão ou Copa do Brasil', text: 'No Brasileirão, são 20 times em pontos corridos (38 rodadas, todos contra todos). Na Copa do Brasil, é mata-mata com ida e volta entre 32 times até sair um campeão.' },
  { icon: '🩹', title: 'Cuidado com cartões e lesões', text: 'Jogadores suspensos (3 amarelos ou vermelho direto) e lesionados ficam fora automaticamente das próximas rodadas, sendo substituídos pelo reserva da mesma posição — acompanhe isso na aba Elenco.' },
  { icon: '👥', title: 'Jogue com amigos', text: 'No modo multiplayer, cada jogador faz seu próprio draft e assume um time real da liga — sem servidor, a conexão é direta entre os navegadores (P2P). Um cria a sala, os outros entram com o código ou o link de convite.' },
];

export const CLUB_STADIUMS = {
  'Santos': 'Vila Belmiro',
  'Sao Caetano': 'Anacleto Campanella',
  'Flamengo': 'Maracanã',
  'Corinthians': 'Neo Química Arena',
  'Palmeiras': 'Nubank Parque',
  'Internacional': 'Beira-Rio',
  'Sao Paulo': 'MorumBIS',
  'Vasco': 'São Januário',
  'Gremio': 'Arena do Grêmio',
  'Cruzeiro': 'Mineirão',
  'Botafogo': 'Nilton Santos',
  'Fluminense': 'Maracanã',
  'Bahia': 'Arena Fonte Nova',
  'Sport': 'Ilha do Retiro',
  'Athletico-PR': 'Arena da Baixada',
  'Coritiba': 'Couto Pereira',
  'Atletico-MG': 'Arena MRV',
  'Guarani': 'Brinco de Ouro da Princesa',
};
