// Sub-app do Modo Carreira — montado por App.jsx em vez de todo o corpo
// normal do jogo quando `careerOpen` está ativo (ver src/App.jsx). Tem
// seu próprio estado e sua própria persistência (brl_career_save); nunca
// lê/escreve `phase`, `gameMode` ou `brl_save`. Só sai informação pro
// resto do app via `onHudChange` (pro cabeçalho mostrar o orçamento).
import { useState, useEffect, useCallback } from 'react';
import { TEAMS } from '../data/teams.js';
import { ClubPickerScreen } from './screens/ClubPickerScreen.jsx';
import { CareerHub } from './screens/CareerHub.jsx';
import { loadCareerSave, saveCareerSave } from './state/careerStorage.js';
import { createCareerSave, playRound, endOfSeason, finalizeSeasonAfterUserTie, simulateUserTie } from './engine/seasonEngine.js';

function PlayoffTieScreen({ save, onResolve }) {
  const [result, setResult] = useState(null);
  const tie = save.pendingUserTie;
  const oppId = tie.aId === save.myClubId ? tie.bId : tie.aId;
  const oppTeam = TEAMS.find(t => t.id === oppId);

  const handleSimulate = () => setResult(simulateUserTie(save));
  const handleContinue = () => onResolve(result);

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px', textAlign: 'center' }}>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, marginBottom: 10 }}>Mata-mata de acesso</h2>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 20 }}>Ida e volta contra {oppTeam?.club} — quem passar garante vaga na Série A.</p>
      {!result ? (
        <button onClick={handleSimulate} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#d4a23c', color: '#0B1A12', fontWeight: 700, cursor: 'pointer' }}>Jogar os 2 jogos →</button>
      ) : (
        <>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>Ida: {result.leg1.homeGoals} x {result.leg1.awayGoals}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>Volta: {result.leg2.homeGoals} x {result.leg2.awayGoals}</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Agregado: {result.myAggGoals} x {result.oppAggGoals}</div>
          {result.wentToPenalties && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Empate no agregado — decidido nos pênaltis.</div>}
          <div style={{ fontSize: 15, fontWeight: 700, color: (result.myAggGoals > result.oppAggGoals || (result.wentToPenalties && result.penaltyWinnerIsMe)) ? '#7fd99a' : '#e05050', marginBottom: 20 }}>
            {(result.myAggGoals > result.oppAggGoals || (result.wentToPenalties && result.penaltyWinnerIsMe)) ? '🏆 Vaga garantida na Série A!' : 'Eliminado — segue na Série B'}
          </div>
          <button onClick={handleContinue} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#d4a23c', color: '#0B1A12', fontWeight: 700, cursor: 'pointer' }}>Continuar →</button>
        </>
      )}
    </div>
  );
}

function PlaceholderScreen({ title, onBack }) {
  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#d4a23c', fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: 0 }}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 10 }}>{title}</h2>
      <p style={{ opacity: 0.6, fontSize: 13 }}>Esta tela ainda está em construção — chega numa próxima atualização do Modo Carreira.</p>
    </div>
  );
}

const SCREEN_TITLES = { squad: 'Elenco', formation: 'Formação', market: 'Mercado de Transferências', table: 'Tabela' };

export function CareerApp({ onExit, onHudChange }) {
  const [save, setSave] = useState(() => loadCareerSave());
  const [screen, setScreen] = useState(() => {
    const existing = loadCareerSave();
    return existing ? (existing.screen || 'hub') : 'picker';
  });

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

  const handlePick = useCallback((clubId) => {
    setSave(createCareerSave(clubId));
    setScreen('hub');
  }, []);

  const handleAdvanceRound = useCallback(() => {
    setSave(prev => {
      if (!prev) return prev;
      const myDivisionKey = prev.clubs[prev.myClubId].division === 'A' ? 'divisionA' : 'divisionB';
      const division = prev[myDivisionKey];
      if (division.round >= division.fixtures.length) {
        const after = endOfSeason(prev);
        setScreen(after.screen);
        return after;
      }
      return playRound(prev, division.round, null);
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

  if (!save || screen === 'picker') {
    return <ClubPickerScreen onPick={handlePick} onBack={onExit} />;
  }

  if (save.pendingUserTie) {
    return <PlayoffTieScreen save={save} onResolve={handleResolvePlayoffTie} />;
  }

  if (['squad', 'formation', 'market', 'table'].includes(screen)) {
    return <PlaceholderScreen title={SCREEN_TITLES[screen]} onBack={() => setScreen('hub')} />;
  }

  return <CareerHub save={save} onNavigate={setScreen} onAdvanceRound={handleAdvanceRound} onExit={onExit} />;
}
