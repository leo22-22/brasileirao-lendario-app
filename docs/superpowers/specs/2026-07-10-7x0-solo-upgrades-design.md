# Fase 1: Melhorias Solo inspiradas no 7a0.com.br

Data: 2026-07-10
Status: Aprovado para planejamento

## Contexto

O jogo atual (`src/App.jsx`, ~4884 linhas) já implementa boa parte do loop
ROLAR → MONTAR → SIMULAR: draft com sorteio de times históricos do Brasileirão
(66 elencos, 1959–2024), 15 formações, cálculo de química, motor de simulação
por Poisson, modo Brasileirão (pontos corridos) e modo Copa do Brasil
(mata-mata de 32 times, ida e volta), multiplayer via PeerJS (salas / hotseat).

O usuário pediu para incorporar ideias do jogo https://7a0.com.br/ (não
acessível diretamente durante o brainstorm — trabalhado a partir da descrição
detalhada fornecida pelo usuário). Decisão tomada com o usuário: manter o tema
de clubes brasileiros (não migrar para seleções de Copa do Mundo) e endereçar,
nesta primeira fase, apenas melhorias que não dependem de conta/backend:

1. Um novo modo "Copa Lendária" com exatamente 7 partidas, para viabilizar o
   objetivo literal "7 a 0 perfeito" (campeão invicto e sem sofrer gols).
2. Um sistema de conquistas/carteirinha, persistido localmente (localStorage).
3. Instalabilidade como PWA (funciona offline, exceto multiplayer).

Fora de escopo nesta fase (fases futuras, exigem backend): contas com login
por magic link, Desafio do Dia com orçamento e ranking global, multiplayer
com salas persistentes cross-device.

## Decisões de escopo confirmadas com o usuário

- Tema: manter clubes brasileiros existentes (não migrar para seleções).
- Formato do "7 a 0": não redefinir os modos existentes; criar um 3º modo
  dedicado, de exatamente 7 partidas, para não alterar o comportamento atual
  de Brasileirão/Copa do Brasil para quem já joga esses modos.
- Estratégia de implementação: híbrida — não refatorar o motor/dados
  existentes que já funcionam; escrever as peças novas (agendador de
  partidas da Copa Lendária, tracking do 7x0, conquistas) como módulos
  isolados e puros em `src/`, com `App.jsx` apenas orquestrando UI sobre eles.
- Ícone do PWA: gerado como placeholder simples (selo de estrela dourada
  sobre verde escuro, reaproveitando a paleta já usada no app), substituível
  depois por arte real.
- PWA usa `vite-plugin-pwa` (não service worker manual) e as fontes do Google
  Fonts passam a ser self-hosted, para que o app funcione 100% offline
  (exceto multiplayer, que já depende de rede hoje).

## 1. Modo "Copa Lendária"

Objetivo: viabilizar o "7 a 0 perfeito" literal do brief original (3 jogos de
grupo + mata-mata até a final = 7 partidas).

### Estrutura do torneio

- 32 times sorteados do pool histórico de 66 elencos (mesma lógica de sorteio
  de oponentes já usada no modo Copa do Brasil hoje).
- 8 grupos de 4 times. O time do jogador cai em um dos grupos.
- **Fase de grupos**: turno único dentro do grupo (todos jogam contra todos
  uma vez) = 3 partidas para o time do jogador. Critério de classificação:
  pontos, saldo de gols, gols marcados (mesmo critério já usado no modo
  Brasileirão).
- **Mata-mata**: só o 1º colocado de cada grupo avança (8 times) →
  Quartas de Final → Semifinal → Final, jogo único (sem ida e volta) = 4
  partidas para quem chega até a final.
- Total para o jogador, se avançar até o fim: 3 + 4 = 7 partidas.
- Empate no mata-mata: prorrogação + pênaltis, reaproveitando a lógica já
  existente (usada hoje no modo Copa do Brasil) para desempate.
- Os outros grupos e o outro lado do chaveamento são simulados em segundo
  plano (IA vs IA), sem exigir telas de acompanhamento — só entram na UI
  quando afetam o adversário do jogador na rodada seguinte.

### Tracking do "7 a 0 perfeito"

- Estado do run acumula: partidas jogadas, resultado de cada uma, gols
  sofridos totais, se houve eliminação.
- Exibição ao vivo (ex.: durante a Copa Lendária): contador tipo
  `⚽ 4/7 · 0 sofridos`.
- Se o jogador sofrer qualquer gol ou for eliminado, a Copa Lendária
  **continua normalmente até o fim** (não interrompe o torneio) — apenas essa
  run deixa de ser elegível ao selo "7 a 0 perfeito". A tela de Resultado
  mostra o quão perto chegou (ex.: "Você caiu no jogo 5 — 3 gols sofridos").
- Selo "7 a 0 Perfeito" concedido apenas se: campeão + 0 derrotas (inclui não
  ter sido eliminado por pênaltis) + 0 gols sofridos nas 7 partidas.

### Novo módulo isolado

`src/engine/copaLendaria.js` (funções puras, testáveis):
- `drawGroups(teamPool, seed?) → { groups, userGroupIndex }`
- `buildGroupFixtures(groupTeamIds) → partidas` (reaproveita
  `generateRoundRobin` já existente em `App.jsx`, ou uma cópia local se a
  extração direta for arriscada — decidir no plano de implementação)
- `buildKnockoutBracket(groupWinners) → chaveamento de 8 times`
- `advanceKnockout(bracketState, roundResults) → próximo estado`
- `evaluateSevenZero(runState) → { qualifies: bool, matchesWon, goalsConceded }`

`App.jsx` ganha um novo valor de `gameMode` (`'lendaria'`) e chama esses
módulos a partir dos mesmos pontos onde hoje orquestra o modo `'copa'`,
reaproveitando as telas de Draft/Squad/Playing/Results já existentes (apenas
passando os fixtures/estado gerados pelo novo módulo).

## 2. Conquistas / Carteirinha

### Armazenamento

`src/achievements.js`: módulo isolado com:
- Lista de definições de conquistas: `{ id, title, description, icon, tier }`.
- `checkAchievements(runResult, lifetimeStats) → novasConquistas[]` (função
  pura — recebe o resultado da partida/torneio e o estado acumulado, devolve
  quais IDs foram desbloqueados).
- `loadCarteirinha()` / `saveCarteirinha(data)`: leitura/escrita em
  `localStorage` sob a chave `bl_carteirinha_v1`. Schema:
  ```json
  {
    "unlocked": { "primeiro_titulo": "2026-07-10T14:32:00Z", ... },
    "stats": {
      "gamesPlayed": 0,
      "titlesByMode": { "brasileirao": 0, "copa": 0, "lendaria": 0 },
      "bestWinStreak": 0,
      "leastGoalsConcededInTitle": null
    }
  }
  ```

### Conquistas iniciais

| id | Nome | Condição |
|---|---|---|
| `primeira_partida` | Primeira Partida | Jogou a primeira partida (qualquer modo) |
| `primeiro_titulo` | Primeiro Título | Foi campeão em qualquer modo |
| `sete_a_zero` | 7 a 0 Perfeito | Campeão da Copa Lendária, invicto, 0 gols sofridos (selo dourado, destaque especial) |
| `zebra_historica` | Zebra Histórica | Campeão com XI de força média < 75 OVR |
| `geracao_de_ouro` | Geração de Ouro | Campeão com XI de força média > 90 OVR |
| `invencivel` | Invencível | Campeão sem nenhuma derrota (qualquer modo) |

Lista extensível — novas conquistas podem ser adicionadas ao array de
definições sem mudar a lógica de avaliação.

### UI

Nova tela "Carteirinha", acessível a partir da Home/Perfil: grade de selos
(bloqueado = silhueta cinza, desbloqueado = colorido + data de conquista) e um
painel de estatísticas vitalícias (jogos disputados, títulos por modo, melhor
sequência de vitórias).

## 3. PWA

- `manifest.json`: nome "Brasileirão Lendário", `theme_color`/
  `background_color` = `#0B1A12`, `display: standalone`, ícones 192px e
  512px (+ variante maskable), gerados como placeholder (selo de estrela
  dourada sobre verde escuro).
- `vite-plugin-pwa` cuida da geração do service worker e do precache do app
  shell no build — Solo, Brasileirão, Copa do Brasil e Copa Lendária
  funcionam 100% offline depois do primeiro carregamento. Multiplayer
  continua exigindo rede (inalterado).
- Fontes `Fraunces`, `Source Sans 3` e `Space Mono`, hoje carregadas via
  `<link>` do Google Fonts em `index.html`, passam a ser self-hosted
  (arquivos locais + `@font-face`) para não quebrar offline.
- Botão "Instalar app" na Home usando o evento `beforeinstallprompt`
  (Android/desktop Chrome). Em iOS Safari (sem essa API), um hint estático
  único ("Adicione à tela de início") é mostrado em vez de um botão
  funcional.

## 4. Identidade visual

- Selo "7 a 0 Perfeito" reaproveita a linguagem visual dourada já usada para
  "Lendas" no draft, para parecer nativo do app.
- Contador ao vivo `⚽ N/7 · M sofridos` durante a Copa Lendária.
- Marcador "7‑:0" estilizado na tela de Resultado quando o selo é conquistado.

## Fora de escopo (fases futuras)

- Contas com login por magic link.
- Desafio do Dia com seed diária, orçamento por jogador e ranking global
  (cross-device). Nesta fase, nenhum ranking online é construído.
- Modo Almanaque (draft às cegas).
- Multiplayer para o novo modo Copa Lendária (fica solo/hotseat, como os
  demais modos hoje, sem mudanças na camada de multiplayer existente).

## Testes

- `copaLendaria.js` e `achievements.js` são funções puras — cobrir com testes
  unitários (sorteio de grupos com seed fixa é determinístico via
  `makePrng`, avaliação de conquistas com estados sintéticos).
- Verificação manual do fluxo completo (rolar → montar → jogar as 7
  partidas → ver o selo) no navegador antes de considerar a fase concluída.
- Verificação manual de instalação do PWA (Chrome desktop/Android) e de que
  o app abre offline após o primeiro load.
