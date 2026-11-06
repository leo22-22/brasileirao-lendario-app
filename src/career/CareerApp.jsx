// Sub-app do Modo Carreira — montado por App.jsx em vez de todo o corpo
// normal do jogo quando `careerOpen` está ativo (ver src/App.jsx). Tem
// seu próprio estado e sua própria persistência (brl_career_save); nunca
// lê/escreve `phase`, `gameMode` ou `brl_save`. Só sai informação pro
// resto do app via `onHudChange` (pro cabeçalho mostrar o orçamento).
import { useState, useEffect, useCallback } from 'react';
import { TEAMS } from '../data/teams.js';
import { ClubPickerScreen } from './screens/ClubPickerScreen.jsx';
import { CareerStartScreen } from './screens/CareerStartScreen.jsx';
import { CareerHub, eventLine } from './screens/CareerHub.jsx';
import { CareerAdvanceModal } from './components/CareerAdvanceModal.jsx';
import { CareerSquadScreen } from './screens/CareerSquadScreen.jsx';
import { CareerMatchDayScreen } from './screens/CareerMatchDayScreen.jsx';
import { CareerTwoLegScreen } from './screens/CareerTwoLegScreen.jsx';
import { CareerFormationScreen } from './screens/CareerFormationScreen.jsx';
import { CareerTableScreen } from './screens/CareerTableScreen.jsx';
import { CareerCalendarScreen } from './screens/CareerCalendarScreen.jsx';
import { CareerCopaScreen } from './screens/CareerCopaScreen.jsx';
import { CareerYouthScreen } from './screens/CareerYouthScreen.jsx';
import { CareerTransferMarket } from './screens/CareerTransferMarket.jsx';
import { loadCareerSave, saveCareerSave, clearCareerSave } from './state/careerStorage.js';
import {
  createCareerSave, advanceDay, endOfSeason, finalizeSeasonAfterUserTie, simulateUserTie,
  simulateUserCopaTie, finalizeCopaUserTie, resolveCopaFinalUserMatch, simulateRestOfSeason, respondToOffer, counterOffer, toggleTransferList,
  resolveUserMatch,
} from './engine/seasonEngine.js';
import { COPA_ROUND_LABELS } from './engine/copaEngine.js';
import { proposeTransfer, promoteYouthPlayer } from './engine/rosterStore.js';
import { loanPlayerOut, requestLoanIn } from './engine/loans.js';

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
  const [advancing, setAdvancing] = useState(null); // { fromDay } | null

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

  // "Nova carreira" na tela de entrada — apaga o save salvo pra sempre e
  // manda pra escolha de clube, igual quem nunca jogou antes.
  const handleNewCareer = useCallback(() => {
    clearCareerSave();
    setSave(null);
    setScreen('picker');
  }, []);

  // Avança o calendário dia a dia (pula sozinho os dias sem nada) até
  // bater um jogo, surgir uma proposta de negociação, ou a temporada
  // regular acabar — nesse último caso já encadeia o fim de temporada.
  const handleAdvanceDay = useCallback(() => {
    setSave(prev => {
      if (!prev) return prev;
      setAdvancing({ fromDay: prev.calendarDay });
      const { save: afterDay, event } = advanceDay(prev);
      if (event === 'offers-pending') { setScreen('market'); return afterDay; }
      if (event === 'offer') { setScreen('market'); return afterDay; }
      if (event === 'season-end') {
        const after = endOfSeason(afterDay);
        setScreen(after.screen);
        return after;
      }
      return afterDay; // 'match' — fica no hub mostrando o resultado/próximo jogo
    });
  }, []);

  // "Simular até o fim da temporada" — pula direto pro resumo de fim de
  // temporada sem parar a cada dia; propostas que surgirem no caminho são
  // rejeitadas automaticamente (ver simulateRestOfSeason).
  const handleSimulateSeason = useCallback(() => {
    setSave(prev => {
      if (!prev) return prev;
      setAdvancing({ fromDay: prev.calendarDay });
      const { save: after } = simulateRestOfSeason(prev);
      setScreen(after.screen || (after.pendingUserTie ? 'playoff-tie' : 'hub'));
      return after;
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

  const handleResolveCopaTie = useCallback((result) => {
    setSave(prev => {
      if (!prev?.pendingUserCopaTie || !result) return prev;
      const iWon = result.myAggGoals !== result.oppAggGoals ? result.myAggGoals > result.oppAggGoals : !!result.penaltyWinnerIsMe;
      return finalizeCopaUserTie(prev, iWon, result);
    });
  }, []);

  // Final da Copa do Brasil — jogo único (ver resolveCopaFinalUserMatch):
  // o placar já saiu pronto junto com pendingUserCopaTie, essa tela só
  // anima; "Continuar" só precisa aplicar o que já foi decidido.
  const handleFinishCopaFinal = useCallback(() => {
    setSave(prev => prev && resolveCopaFinalUserMatch(prev));
  }, []);

  const handleConfirmFormation = useCallback(({ myStarters, myFormationLabel, myFormationKey }) => {
    setSave(prev => prev && { ...prev, myStarters, myFormationLabel, myFormationKey });
    setScreen('hub');
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

  // Empréstimo — nas duas direções quem decide é o clube dono do jogador
  // na hora do pedido (ver loans.js); lê `save` direto (não via updater)
  // pelo mesmo motivo de handleProposeTransfer: quem chama precisa do
  // resultado (aceito/recusado) na hora, pra tela mostrar.
  const handleLoanOut = useCallback((targetClubId, playerName, kind) => {
    if (!save) return { accepted: false };
    const result = loanPlayerOut(save, save.myClubId, targetClubId, playerName, kind);
    setSave(result.save);
    return result;
  }, [save]);

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

  if (!save || screen === 'picker') {
    return <ClubPickerScreen onPick={handlePick} onBack={onExit} />;
  }

  if (screen === 'start') {
    return (
      <CareerStartScreen
        save={save}
        onContinue={() => setScreen(save.screen || 'hub')}
        onNewCareer={handleNewCareer}
        onBack={onExit}
      />
    );
  }

  // Checado ANTES de qualquer tela de partida/confronto pendente — garante
  // que o calendário sempre termina de animar até o dia certo primeiro
  // (ver comentário no useState de `advancing` acima).
  if (advancing) {
    const dayEvents = (save.lastDayEvents || []).map(ev => eventLine(ev, save.myClubId)).filter(Boolean);
    return (
      <CareerAdvanceModal
        save={save}
        fromDay={advancing.fromDay}
        toDay={save.calendarDay}
        eventLines={dayEvents}
        onDone={() => setAdvancing(null)}
      />
    );
  }

  if (save.pendingUserMatch) {
    return <CareerMatchDayScreen save={save} onFinish={handleFinishUserMatch} />;
  }

  if (save.pendingUserTie) {
    const tie = save.pendingUserTie;
    const oppTeam = TEAMS.find(t => t.id === (tie.aId === save.myClubId ? tie.bId : tie.aId));
    return (
      <CareerTwoLegScreen
        title="Mata-mata de acesso"
        subtitle={`Ida e volta contra ${oppTeam?.club} — quem passar garante vaga na Série A.`}
        winLabel="🏆 Vaga garantida na Série A!"
        loseLabel="Eliminado — segue na Série B"
        prepare={() => simulateUserTie(save)}
        onContinue={handleResolvePlayoffTie}
      />
    );
  }

  if (save.pendingUserCopaTie) {
    const tie = save.pendingUserCopaTie;
    // A final é jogo único — reaproveita a mesma tela de partida ao vivo do
    // Brasileirão (CareerMatchDayScreen), só passando o jogo e o rótulo da
    // Copa por fora. As outras fases continuam ida+volta de verdade.
    if (tie.isFinal) {
      return <CareerMatchDayScreen save={save} pending={tie.finalMatch} competitionLabel="🏆 Copa do Brasil — Final" onFinish={handleFinishCopaFinal} />;
    }
    const oppTeam = TEAMS.find(t => t.id === (tie.aId === save.myClubId ? tie.bId : tie.aId));
    const roundLabel = COPA_ROUND_LABELS[save.copa.round];
    return (
      <CareerTwoLegScreen
        title={`Copa do Brasil — ${roundLabel}`}
        subtitle={`Ida e volta contra ${oppTeam?.club} — quem passar avança de fase.`}
        winLabel="🏆 Avançou de fase!"
        loseLabel="Eliminado da Copa do Brasil"
        prepare={() => simulateUserCopaTie(save)}
        onContinue={handleResolveCopaTie}
      />
    );
  }

  if (screen === 'squad') return <CareerSquadScreen save={save} onToggleListed={handleToggleListed} onBack={() => setScreen('hub')} />;
  if (screen === 'formation') return <CareerFormationScreen save={save} onConfirm={handleConfirmFormation} onBack={() => setScreen('hub')} />;
  if (screen === 'table') return <CareerTableScreen save={save} onBack={() => setScreen('hub')} />;
  if (screen === 'calendar') return <CareerCalendarScreen save={save} onBack={() => setScreen('hub')} />;
  if (screen === 'copa') return <CareerCopaScreen save={save} onBack={() => setScreen('hub')} />;
  if (screen === 'youth') return <CareerYouthScreen save={save} onPromote={handlePromoteYouth} onBack={() => setScreen('hub')} />;
  if (screen === 'market') return <CareerTransferMarket save={save} onPropose={handleProposeTransfer} onRespondOffer={handleRespondOffer} onCounterOffer={handleCounterOffer} onToggleListed={handleToggleListed} onLoanOut={handleLoanOut} onRequestLoan={handleRequestLoan} onBack={() => setScreen('hub')} />;

  return <CareerHub save={save} onNavigate={setScreen} onAdvanceDay={handleAdvanceDay} onSimulateSeason={handleSimulateSeason} onExit={onExit} />;
}
