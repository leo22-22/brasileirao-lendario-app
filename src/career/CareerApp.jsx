// Sub-app do Modo Carreira — montado por App.jsx em vez de todo o corpo
// normal do jogo quando `careerOpen` está ativo (ver src/App.jsx). Tem
// seu próprio estado e sua própria persistência (brl_career_save); nunca
// lê/escreve `phase`, `gameMode` ou `brl_save`. Só sai informação pro
// resto do app via `onHudChange` (pro cabeçalho mostrar o orçamento).
import { useState, useEffect, useCallback } from 'react';
import { TEAMS } from '../data/teams.js';
import { ClubPickerScreen } from './screens/ClubPickerScreen.jsx';
import { CareerStartScreen } from './screens/CareerStartScreen.jsx';
import { CareerHub } from './screens/CareerHub.jsx';
import { CareerSquadScreen } from './screens/CareerSquadScreen.jsx';
import { CareerMatchDayScreen } from './screens/CareerMatchDayScreen.jsx';
import { CareerTwoLegScreen } from './screens/CareerTwoLegScreen.jsx';
import { CareerFormationScreen } from './screens/CareerFormationScreen.jsx';
import { CareerTableScreen } from './screens/CareerTableScreen.jsx';
import { CareerCalendarScreen } from './screens/CareerCalendarScreen.jsx';
import { CareerCopaScreen } from './screens/CareerCopaScreen.jsx';
import { CareerTransferMarket } from './screens/CareerTransferMarket.jsx';
import { loadCareerSave, saveCareerSave, clearCareerSave } from './state/careerStorage.js';
import {
  createCareerSave, advanceDay, endOfSeason, finalizeSeasonAfterUserTie, simulateUserTie,
  simulateUserCopaTie, finalizeCopaUserTie, simulateRestOfSeason, respondToOffer, counterOffer, toggleTransferList,
  resolveUserMatch,
} from './engine/seasonEngine.js';
import { COPA_ROUND_LABELS } from './engine/copaEngine.js';
import { proposeTransfer } from './engine/rosterStore.js';

export function CareerApp({ onExit, onHudChange }) {
  const [save, setSave] = useState(() => loadCareerSave());
  // Com carreira salva, SEMPRE para na tela de "Continuar ou nova carreira"
  // primeiro — sem isso, não tinha nenhum jeito de recomeçar: toda entrada
  // no Modo Carreira carregava direto a carreira salva, sem opção nenhuma.
  const [screen, setScreen] = useState(() => (loadCareerSave() ? 'start' : 'picker'));

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
    setSave(prev => prev ? counterOffer(prev, offerIndex, counterAmount).save : prev);
  }, []);

  const handleToggleListed = useCallback((playerName) => {
    setSave(prev => prev && toggleTransferList(prev, playerName));
  }, []);

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

  if (screen === 'squad') return <CareerSquadScreen save={save} onBack={() => setScreen('hub')} />;
  if (screen === 'formation') return <CareerFormationScreen save={save} onConfirm={handleConfirmFormation} onBack={() => setScreen('hub')} />;
  if (screen === 'table') return <CareerTableScreen save={save} onBack={() => setScreen('hub')} />;
  if (screen === 'calendar') return <CareerCalendarScreen save={save} onBack={() => setScreen('hub')} />;
  if (screen === 'copa') return <CareerCopaScreen save={save} onBack={() => setScreen('hub')} />;
  if (screen === 'market') return <CareerTransferMarket save={save} onPropose={handleProposeTransfer} onRespondOffer={handleRespondOffer} onCounterOffer={handleCounterOffer} onToggleListed={handleToggleListed} onBack={() => setScreen('hub')} />;

  return <CareerHub save={save} onNavigate={setScreen} onAdvanceDay={handleAdvanceDay} onSimulateSeason={handleSimulateSeason} onExit={onExit} />;
}
