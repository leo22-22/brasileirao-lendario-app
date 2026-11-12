// Sub-app do Modo Carreira — montado por App.jsx em vez de todo o corpo
// normal do jogo quando `careerOpen` está ativo (ver src/App.jsx). Tem
// seu próprio estado e sua própria persistência (brl_career_save); nunca
// lê/escreve `phase`, `gameMode` ou `brl_save`. Só sai informação pro
// resto do app via `onHudChange` (pro cabeçalho mostrar o orçamento).
import { useState, useEffect, useCallback } from 'react';
import { TEAMS } from '../data/teams.js';
import { ClubPickerScreen } from './screens/ClubPickerScreen.jsx';
import { CareerStartScreen } from './screens/CareerStartScreen.jsx';
import { CareerLoadScreen } from './screens/CareerLoadScreen.jsx';
import { CareerHub, eventLine } from './screens/CareerHub.jsx';
import { CareerAdvanceModal } from './components/CareerAdvanceModal.jsx';
import { CareerSquadScreen } from './screens/CareerSquadScreen.jsx';
import { CareerMatchDayScreen } from './screens/CareerMatchDayScreen.jsx';
import { CareerTwoLegScreen } from './screens/CareerTwoLegScreen.jsx';
import { CareerCopaLegScreen } from './screens/CareerCopaLegScreen.jsx';
import { CareerSeasonReportScreen } from './screens/CareerSeasonReportScreen.jsx';
import { CareerFormationScreen } from './screens/CareerFormationScreen.jsx';
import { CareerTableScreen } from './screens/CareerTableScreen.jsx';
import { CareerCalendarScreen } from './screens/CareerCalendarScreen.jsx';
import { CareerCopaScreen } from './screens/CareerCopaScreen.jsx';
import { CareerYouthScreen } from './screens/CareerYouthScreen.jsx';
import { CareerTransferMarket } from './screens/CareerTransferMarket.jsx';
import { loadCareerSave, saveCareerSave, listCareerSaves, loadCareerSaveBySeed, setActiveCareerSeed, deleteCareerSave } from './state/careerStorage.js';
import {
  createCareerSave, advanceDay, endOfSeason, finalizeSeasonAfterUserTie, simulateUserTie,
  simulateUserCopaTieLeg1, simulateUserCopaTieLeg2, finalizeCopaUserTieLeg1, finalizeCopaUserTieLeg2,
  resolveCopaFinalUserMatch, simulateRestOfSeason, respondToOffer, counterOffer, toggleTransferList,
  resolveUserMatch, advanceToNextSeason,
} from './engine/seasonEngine.js';
import { COPA_ROUND_LABELS } from './engine/copaEngine.js';
import { proposeTransfer, promoteYouthPlayer } from './engine/rosterStore.js';
import { toggleLoanList, requestLoanIn } from './engine/loans.js';
import { applyCareerLineupChange } from './engine/simHelpers.js';
import { displayName } from '../lib/displayName.js';

export function CareerApp({ onExit, onHudChange }) {
  const [save, setSave] = useState(() => loadCareerSave());
  // Com carreira salva, SEMPRE para na tela de "Continuar ou nova carreira"
  // primeiro — sem isso, não tinha nenhum jeito de recomeçar: toda entrada
  // no Modo Carreira carregava direto a carreira salva, sem opção nenhuma.
  const [screen, setScreen] = useState(() => (loadCareerSave() ? 'start' : 'picker'));
  // Overlay do calendário "passando" — vive AQUI (não dentro de CareerHub)
  // de propósito: quando o "Avançar" cai direto numa partida/confronto
  // pendente, o roteamento de tela troca pra CareerMatchDayScreen/
  // CareerTwoLegScreen imediatamente, o que desmontava o hub (e a animação
  // junto) antes de mostrar qualquer coisa — pedido explícito do usuário
  // pra NUNCA pular a animação ("nunca pular tudo"). Com o estado aqui, a
  // checagem de `advancing` roda ANTES de qualquer outro roteamento de
  // tela (ver fim do componente), garantindo que o calendário sempre
  // termina de andar até o dia certo antes de abrir a partida/confronto.
  // { fromDay, toDay, originalSave, previewSave, finishScreen } | null — o
  // resultado (`previewSave`) já foi calculado no clique de "Avançar"/
  // "Simular", mas só é aplicado ao `save` de verdade quando a animação
  // termina (handleAdvanceDone) ou é interrompida (handleAdvanceStop) — ver
  // esses handlers pra entender por quê.
  const [advancing, setAdvancing] = useState(null);
  // Lista de carreiras salvas pra tela de "Carregar carreira" — estado
  // próprio (não um `listCareerSaves()` direto no render) porque apagar
  // uma carreira que NÃO é a ativa não muda `save` (bailout do setState
  // com o mesmo valor não re-renderiza), e sem isso a linha apagada
  // continuava aparecendo na lista até alguma outra coisa forçar redraw.
  const [savesList, setSavesList] = useState([]);

  useEffect(() => {
    if (save) saveCareerSave(save);
  }, [save]);

  useEffect(() => {
    if (!onHudChange) return;
    if (save) {
      const team = TEAMS.find(t => t.id === save.myClubId);
      onHudChange({ active: true, balance: save.clubs[save.myClubId].budget, clubLabel: team.club, clubColor: team.colors?.p });
    } else {
      onHudChange(null);
    }
    return () => onHudChange(null);
  }, [save, onHudChange]);

  const handlePick = useCallback((clubId, customBudget) => {
    setSave(createCareerSave(clubId, customBudget));
    setScreen('hub');
  }, []);

  // "Nova carreira" na tela de entrada — NUNCA MAIS apaga a carreira atual
  // (pedido explícito do usuário 2026-11-12: "permita criar mais de uma
  // carreira também"), só manda pra escolha de clube; a carreira que
  // estava ativa continua salva no próprio slot dela, intacta, e volta a
  // aparecer na tela de "Carregar carreira" depois.
  const handleNewCareer = useCallback(() => {
    setScreen('picker');
  }, []);

  // "Carregar carreira" — lista todas as carreiras salvas (ver
  // CareerLoadScreen) pra trocar de uma pra outra sem apagar nenhuma.
  const handleOpenLoad = useCallback(() => {
    setSavesList(listCareerSaves());
    setScreen('load');
  }, []);

  const handleLoadCareer = useCallback((seed) => {
    const loaded = loadCareerSaveBySeed(seed);
    if (!loaded) return;
    setActiveCareerSeed(seed);
    setSave(loaded);
    setScreen(loaded.screen || 'hub');
  }, []);

  // Apagar uma carreira é uma ação própria e explícita agora (antes era
  // uma consequência escondida de "começar carreira nova") — se for a
  // ativa, cai pra tela de escolha de clube (nenhuma carreira restando)
  // ou assume a próxima mais recente como ativa (ainda existe alguma).
  const handleDeleteCareer = useCallback((seed) => {
    const nextActiveSeed = deleteCareerSave(seed);
    setSavesList(listCareerSaves());
    setSave(prev => {
      if (!prev || prev.seed !== seed) return prev;
      const next = nextActiveSeed ? loadCareerSaveBySeed(nextActiveSeed) : null;
      setScreen(next ? 'start' : 'picker');
      return next;
    });
  }, []);

  // Resolve só 1 rodada a partir de `prev` — mesma função usada tanto pro
  // clique normal de "Avançar rodada" quanto pro "Parar" no meio de um
  // "Simular temporada até o fim" (ver handleAdvanceStop): parar SEMPRE
  // equivale a isso, nunca a revelar o que já tinha sido calculado mais à
  // frente (pedido explícito do usuário 2026-11-09: não pode jogar o
  // usuário direto num confronto seu que estava semanas à frente).
  function computeSingleAdvance(prev) {
    const { save: afterDay, event } = advanceDay(prev);
    if (event === 'offers-pending' || event === 'offer') return { previewSave: afterDay, finishScreen: 'market' };
    if (event === 'season-end') {
      const after = endOfSeason(afterDay);
      return { previewSave: after, finishScreen: after.screen };
    }
    return { previewSave: afterDay, finishScreen: 'hub' }; // 'match' — fica no hub mostrando o resultado/próximo jogo
  }

  // Avança o calendário dia a dia (pula sozinho os dias sem nada) até
  // bater um jogo, surgir uma proposta de negociação, ou a temporada
  // regular acabar — nesse último caso já encadeia o fim de temporada. O
  // resultado só é aplicado de verdade no save quando a animação termina
  // (handleAdvanceDone) ou é interrompida (handleAdvanceStop) — ver
  // comentário em `advancing` mais abaixo.
  const handleAdvanceDay = useCallback(() => {
    setSave(prev => {
      if (!prev) return prev;
      const { previewSave, finishScreen } = computeSingleAdvance(prev);
      setAdvancing({ fromDay: prev.calendarDay, toDay: previewSave.calendarDay, originalSave: prev, previewSave, finishScreen });
      return prev;
    });
  }, []);

  // "Simular até o fim da temporada" — pula direto pro resumo de fim de
  // temporada sem parar a cada dia; propostas que surgirem no caminho são
  // rejeitadas automaticamente (ver simulateRestOfSeason). Mesmo
  // adiamento de aplicação que handleAdvanceDay.
  const handleSimulateSeason = useCallback(() => {
    setSave(prev => {
      if (!prev) return prev;
      const { save: after } = simulateRestOfSeason(prev);
      const finishScreen = after.screen || (after.pendingUserTie ? 'playoff-tie' : 'hub');
      setAdvancing({ fromDay: prev.calendarDay, toDay: after.calendarDay, originalSave: prev, previewSave: after, finishScreen });
      return prev;
    });
  }, []);

  // Fim natural da animação (cursor chegou no último dia sozinho) — só
  // agora o resultado (já calculado desde o clique) é de fato aplicado.
  const handleAdvanceDone = useCallback(() => {
    setAdvancing(adv => {
      if (adv) { setSave(adv.previewSave); setScreen(adv.finishScreen); }
      return null;
    });
  }, []);

  // "Parar" (pedido explícito do usuário 2026-11-09): NÃO revela o
  // resultado que já tinha sido calculado pro pulo grande inteiro — isso
  // jogaria o usuário direto num confronto seu (ex.: Copa do Brasil) que
  // podia estar semanas à frente dentro de um "Simular temporada até o
  // fim" longo. Em vez disso, descarta aquele cálculo inteiro e refaz do
  // zero avançando só 1 rodada a partir do dia em que o pulo começou —
  // exatamente como um clique normal de "Avançar rodada" (determinístico:
  // mesmo seed+dia, mesmo resultado dessa 1ª rodada). Se essa 1 rodada cair
  // numa partida/confronto do usuário, a tela de jogo aparece normalmente
  // (não dá pra evitar, é o jogo dele); se não, só volta pro hub com o feed
  // daquele dia.
  const handleAdvanceStop = useCallback(() => {
    setAdvancing(adv => {
      if (adv) {
        const { previewSave, finishScreen } = computeSingleAdvance(adv.originalSave);
        setSave(previewSave);
        setScreen(finishScreen);
      }
      return null;
    });
  }, []);

  const handleResolvePlayoffTie = useCallback((result) => {
    setSave(prev => {
      if (!prev?.pendingUserTie || !result) return prev;
      const iWon = result.myAggGoals !== result.oppAggGoals ? result.myAggGoals > result.oppAggGoals : !!result.penaltyWinnerIsMe;
      const after = finalizeSeasonAfterUserTie(prev, result.myAggGoals, result.oppAggGoals, iWon);
      setScreen(after.screen);
      return after;
    });
  }, []);

  // Ida e volta da Copa do Brasil do próprio usuário agora são dois eventos
  // de calendário separados (ver copaEngine.js/CareerCopaLegScreen.jsx) —
  // cada handler só termina a perna que acabou de ser jogada; a fase só é
  // decidida de fato em handleResolveCopaTieLeg2.
  const handleResolveCopaTieLeg1 = useCallback((legResult) => {
    setSave(prev => (prev?.pendingUserCopaTie ? finalizeCopaUserTieLeg1(prev, legResult) : prev));
  }, []);

  const handleResolveCopaTieLeg2 = useCallback((legResult) => {
    setSave(prev => (prev?.pendingUserCopaTie ? finalizeCopaUserTieLeg2(prev, legResult) : prev));
  }, []);

  // Final da Copa do Brasil — jogo único (ver resolveCopaFinalUserMatch):
  // o placar já saiu pronto junto com pendingUserCopaTie, essa tela só
  // anima; "Continuar" só precisa aplicar o que já foi decidido.
  const handleFinishCopaFinal = useCallback(() => {
    setSave(prev => prev && resolveCopaFinalUserMatch(prev));
  }, []);

  const handleConfirmFormation = useCallback(({ myStarters, myBench, myFormationLabel, myFormationKey, myCaptain, myPenaltyTaker }) => {
    setSave(prev => prev && { ...prev, myStarters, myBench, myFormationLabel, myFormationKey, myCaptain, myPenaltyTaker });
    setScreen('hub');
  }, []);

  // Criar/Carregar formação (pedido explícito do usuário 2026-11-11) —
  // `save.savedFormations` guarda presets nomeados, independente da
  // escalação ATIVA (myStarters/myBench) — "carregar" só troca o que está
  // sendo editado na tela, nunca aplica direto sem passar por "Confirmar
  // escalação".
  const handleSaveFormationPreset = useCallback((preset) => {
    setSave(prev => {
      if (!prev) return prev;
      const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      return { ...prev, savedFormations: [...(prev.savedFormations || []), { id, ...preset }] };
    });
  }, []);

  const handleDeleteFormationPreset = useCallback((id) => {
    setSave(prev => prev && { ...prev, savedFormations: (prev.savedFormations || []).filter(p => p.id !== id) });
  }, []);

  // Proposta do usuário por um jogador de outro clube — diferente de uma
  // compra instantânea, o clube vendedor decide aceitar ou não (ver
  // proposeTransfer em rosterStore.js). Lê `save` direto (não via
  // updater) porque quem chama precisa do resultado (aceita/recusada) na
  // hora, pra tela mostrar — side-effect único por clique, sem risco de
  // valor desatualizado.
  const handleProposeTransfer = useCallback((sellerId, playerName, offeredAmount) => {
    if (!save) return { accepted: false, reason: 'sem carreira ativa' };
    const result = proposeTransfer(save, save.myClubId, sellerId, playerName, offeredAmount);
    setSave(result.save);
    return result;
  }, [save]);

  const handleRespondOffer = useCallback((offerIndex, accept) => {
    setSave(prev => prev && respondToOffer(prev, offerIndex, accept));
  }, []);

  const handleCounterOffer = useCallback((offerIndex, counterAmount) => {
    if (!save) return { accepted: false };
    const result = counterOffer(save, offerIndex, counterAmount);
    setSave(result.save);
    return result;
  }, [save]);

  const handleToggleListed = useCallback((playerName) => {
    setSave(prev => prev && toggleTransferList(prev, playerName));
  }, []);

  const handlePromoteYouth = useCallback((playerName) => {
    setSave(prev => prev && promoteYouthPlayer(prev, prev.myClubId, playerName));
  }, []);

  // Emprestar um jogador MEU pra outro clube funciona igual a lista de
  // transferências (ver loans.js) — só liga/desliga na lista, não decide
  // nada na hora; uma proposta de empréstimo pode ou não chegar depois.
  const handleToggleLoanList = useCallback((playerName) => {
    setSave(prev => prev && toggleLoanList(prev, playerName));
  }, []);

  // Pedir emprestado continua sendo ação direta: escolhe o jogador de
  // outro clube, o dono decide na hora (ver loans.js); lê `save` direto
  // (não via updater) pelo mesmo motivo de handleProposeTransfer: quem
  // chama precisa do resultado (aceito/recusado) na hora, pra tela mostrar.
  const handleRequestLoan = useCallback((ownerClubId, playerName, kind) => {
    if (!save) return { accepted: false };
    const result = requestLoanIn(save, save.myClubId, ownerClubId, playerName, kind);
    setSave(result.save);
    return result;
  }, [save]);

  // Fim da partida ao vivo do próprio usuário (CareerMatchDayScreen) —
  // só agora a rodada inteira é de fato resolvida e aplicada no save.
  const handleFinishUserMatch = useCallback(() => {
    setSave(prev => prev && resolveUserMatch(prev));
  }, []);

  // Troca feita DURANTE a partida ao vivo (pausa → substituição ou
  // reposicionamento tático, ver LiveMatchScreen/liveMatchUI.jsx) — nunca
  // muda o placar da partida em andamento, só persiste myStarters/myBench
  // pra valer de verdade a partir da PRÓXIMA partida do usuário.
  const handleApplyLiveLineupChange = useCallback((change) => {
    setSave(prev => prev && applyCareerLineupChange(prev, change));
  }, []);

  // Botão único do relatório de fim de temporada — só agora a temporada
  // nova é de fato montada (ver seasonEngine.js: endOfSeason/
  // finalizeSeasonAfterUserTie já pararam em `screen:'season-report'` e
  // deixaram o relatório pronto em `save.lastSeasonReport`).
  const handleAdvanceSeason = useCallback(() => {
    setSave(prev => prev && advanceToNextSeason(prev));
    setScreen('hub');
  }, []);

  if (!save || screen === 'picker') {
    // Voltar da escolha de clube: se já existe alguma carreira (chegou
    // aqui via "Nova carreira"), volta pra tela de entrada dela em vez de
    // sair do Modo Carreira inteiro — só sai de vez quando é a primeira
    // carreira (nunca existiu nenhuma save ainda).
    return <ClubPickerScreen onPick={handlePick} onBack={save ? () => setScreen('start') : onExit} />;
  }

  if (screen === 'start') {
    return (
      <CareerStartScreen
        save={save}
        onContinue={() => setScreen(save.screen || 'hub')}
        onNewCareer={handleNewCareer}
        onOpenLoad={handleOpenLoad}
        onBack={onExit}
      />
    );
  }

  if (screen === 'load') {
    return (
      <CareerLoadScreen
        saves={savesList}
        activeSeed={save?.seed}
        onLoad={handleLoadCareer}
        onDelete={handleDeleteCareer}
        onBack={() => setScreen(save ? 'start' : 'picker')}
      />
    );
  }

  // Checado ANTES de qualquer tela de partida/confronto pendente — garante
  // que o calendário sempre termina de animar até o dia certo primeiro
  // (ver comentário no useState de `advancing` acima).
  if (advancing) {
    const dayEvents = (advancing.previewSave.lastDayEvents || []).map(ev => eventLine(ev, advancing.previewSave.myClubId)).filter(Boolean);
    return (
      <CareerAdvanceModal
        save={advancing.previewSave}
        fromDay={advancing.fromDay}
        toDay={advancing.toDay}
        eventLines={dayEvents}
        onDone={handleAdvanceDone}
        onStop={handleAdvanceStop}
      />
    );
  }

  if (screen === 'season-report' && save.lastSeasonReport) {
    return <CareerSeasonReportScreen report={save.lastSeasonReport} onAdvance={handleAdvanceSeason} />;
  }

  if (save.pendingUserMatch) {
    return <CareerMatchDayScreen save={save} onFinish={handleFinishUserMatch} onApplyLineupChange={handleApplyLiveLineupChange} />;
  }

  if (save.pendingUserTie) {
    const tie = save.pendingUserTie;
    const oppTeam = TEAMS.find(t => t.id === (tie.aId === save.myClubId ? tie.bId : tie.aId));
    return (
      <CareerTwoLegScreen
        title="Mata-mata de acesso"
        subtitle={`Ida e volta contra ${displayName(oppTeam?.club)} — quem passar garante vaga na Série A.`}
        winLabel="🏆 Vaga garantida na Série A!"
        loseLabel="Eliminado — segue na Série B"
        prepare={() => simulateUserTie(save)}
        onContinue={handleResolvePlayoffTie}
        save={save} onApplyLineupChange={handleApplyLiveLineupChange}
      />
    );
  }

  if (save.pendingUserCopaTie) {
    const tie = save.pendingUserCopaTie;
    // A final é jogo único — reaproveita a mesma tela de partida ao vivo do
    // Brasileirão (CareerMatchDayScreen), só passando o jogo e o rótulo da
    // Copa por fora. As outras fases continuam ida+volta de verdade.
    if (tie.isFinal) {
      return <CareerMatchDayScreen save={save} pending={tie.finalMatch} competitionLabel="🏆 Copa do Brasil — Final" onFinish={handleFinishCopaFinal} onApplyLineupChange={handleApplyLiveLineupChange} />;
    }
    const roundLabel = COPA_ROUND_LABELS[save.copa.round];
    const title = `Copa do Brasil — ${roundLabel}`;
    if (tie.leg === 'ida') {
      return (
        <CareerCopaLegScreen
          title={title}
          leg="ida"
          prepare={() => simulateUserCopaTieLeg1(save)}
          onDoneIda={handleResolveCopaTieLeg1}
          save={save} onApplyLineupChange={handleApplyLiveLineupChange}
        />
      );
    }
    const myTieIdx = save.copa.ties.findIndex(t => t.aId === tie.aId && t.bId === tie.bId);
    return (
      <CareerCopaLegScreen
        title={title}
        leg="volta"
        leg1Result={save.copa.leg1Results[myTieIdx]}
        prepare={() => simulateUserCopaTieLeg2(save)}
        onDoneVolta={handleResolveCopaTieLeg2}
        save={save} onApplyLineupChange={handleApplyLiveLineupChange}
      />
    );
  }

  if (screen === 'squad') return <CareerSquadScreen save={save} onToggleListed={handleToggleListed} onBack={() => setScreen('hub')} />;
  if (screen === 'formation') return <CareerFormationScreen save={save} onConfirm={handleConfirmFormation} onSaveFormationPreset={handleSaveFormationPreset} onDeleteFormationPreset={handleDeleteFormationPreset} onBack={() => setScreen('hub')} />;
  if (screen === 'table') return <CareerTableScreen save={save} onBack={() => setScreen('hub')} />;
  if (screen === 'calendar') return <CareerCalendarScreen save={save} onBack={() => setScreen('hub')} />;
  if (screen === 'copa') return <CareerCopaScreen save={save} onBack={() => setScreen('hub')} />;
  if (screen === 'youth') return <CareerYouthScreen save={save} onPromote={handlePromoteYouth} onBack={() => setScreen('hub')} />;
  if (screen === 'market') return <CareerTransferMarket save={save} onPropose={handleProposeTransfer} onRespondOffer={handleRespondOffer} onCounterOffer={handleCounterOffer} onToggleListed={handleToggleListed} onToggleLoanList={handleToggleLoanList} onRequestLoan={handleRequestLoan} onBack={() => setScreen('hub')} />;

  return <CareerHub save={save} onNavigate={setScreen} onAdvanceDay={handleAdvanceDay} onSimulateSeason={handleSimulateSeason} onExit={onExit} />;
}
