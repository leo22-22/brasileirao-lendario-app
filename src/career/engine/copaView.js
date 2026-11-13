// Leitura da Copa do Brasil do Modo Carreira para a tela redesenhada
// (2026-11-13). SÓ LÊ o save — nenhuma regra ou sorteio daqui muda nada:
// a chave, os placares e os vencedores vêm de copaEngine.js (copa.rounds,
// copa.history, copa.ties, copa.leg1Results).
//
// Topologia da chave (copaEngine.js/nextFixedPairing): o confronto j de uma
// fase sai dos vencedores dos confrontos 2j e 2j+1 da fase anterior — vale
// de 16 avos até semifinal → final. Metade esquerda = primeiros confrontos.
import { COPA_ROUND_LABELS, COPA_DAYS, COPA_ENTRY_PRIZE_BY_ROUND, COPA_CHAMPION_PRIZE, COPA_RUNNER_UP_PRIZE } from './copaEngine.js';
import { matchOutcomeProbabilities } from '../../App.jsx';
import { teamForSim } from './simHelpers.js';

export const FINAL_PHASE = COPA_ROUND_LABELS.length - 1; // 5
export const PHASE_SHORT = ['Primeira fase', '16 avos', 'Oitavas', 'Quartas', 'Semifinal', 'Final'];
export { COPA_DAYS, COPA_ENTRY_PRIZE_BY_ROUND, COPA_CHAMPION_PRIZE, COPA_RUNNER_UP_PRIZE };

// Confrontos de uma fase, no formato da tela. `null` em placares ainda não
// jogados. aggA/aggB = agregado (ou placar do jogo único na final).
export function phaseTies(copa, phase) {
  if (!copa) return [];
  const hist = (copa.history || []).find(h => h.round === phase);
  const isCur = copa.phase === 'active' && copa.round === phase;
  let base = [];
  if (phase >= 1) {
    const e = copa.rounds?.[phase - 1];
    if (e?.matches?.length) {
      base = e.matches.map((m, i) => ({
        aId: m.homeId, bId: m.awayId,
        leg1: phase === FINAL_PHASE ? null : (e.leg1Results?.[i] || null),
        leg2: phase === FINAL_PHASE ? null : (e.results?.[i] || null),
        single: phase === FINAL_PHASE ? (e.results?.[0] || null) : null,
      }));
    }
  }
  if (!base.length && isCur) base = (copa.ties || []).map(t => ({ aId: t.aId, bId: t.bId }));
  if (!base.length && hist) base = hist.ties.map(t => ({ aId: t.aId, bId: t.bId }));
  if (isCur && copa.leg === 'volta' && copa.leg1Results) base = base.map((t, i) => ({ ...t, leg1: t.leg1 || copa.leg1Results[i] || null }));
  return base.map((t, i) => {
    const h = hist?.ties.find(x => x.aId === t.aId && x.bId === t.bId);
    let aggA = null, aggB = null;
    if (h) { aggA = h.aggA; aggB = h.aggB; } else if (t.leg1) { aggA = t.leg1.homeGoals; aggB = t.leg1.awayGoals; }
    const levelled = !!h && h.aggA === h.aggB;
    return {
      ...t, phase, idx: i, aggA, aggB, decided: !!h, winnerId: h?.winnerId || null,
      // Empate no agregado: pênaltis (16 avos em diante) ou jogo extra (1ª fase)
      onPens: levelled && phase >= 1, decider: levelled && phase === 0,
      // 1ª fase só guarda o agregado no histórico (sem placar por jogo)
      aggOnly: !!h && phase === 0,
    };
  });
}

export function allPhaseTies(copa) {
  return COPA_ROUND_LABELS.map((_, p) => phaseTies(copa, p));
}

export const hasClub = (t, id) => t && (t.aId === id || t.bId === id);

// Quem pode sair do confronto (phase, idx): o vencedor, os dois clubes, ou
// a união das duas chaves alimentadoras. null = ainda não sorteado.
export function survivors(T, phase, idx) {
  const t = T[phase]?.[idx];
  if (t) return t.decided ? [t.winnerId] : [t.aId, t.bId];
  if (phase <= 1) return null;
  const a = survivors(T, phase - 1, 2 * idx);
  const b = survivors(T, phase - 1, 2 * idx + 1);
  return a && b ? [...a, ...b] : null;
}

// Situação do meu clube na Copa.
export function myCopaRun(save) {
  const copa = save.copa;
  const me = save.myClubId;
  const T = allPhaseTies(copa);
  const steps = T.map((ties, p) => {
    const t = ties.find(x => hasClub(x, me)) || null;
    return { phase: p, tie: t, idx: t ? t.idx : -1 };
  });
  let eliminatedAt = null, champion = false;
  for (const s of steps) {
    if (s.tie?.decided && s.tie.winnerId !== me) { eliminatedAt = s.phase; break; }
    if (s.phase === FINAL_PHASE && s.tie?.decided && s.tie.winnerId === me) champion = true;
  }
  // Os 40 clubes estão na Copa. A 1ª fase NÃO fica em copa.history
  // (advancePrimeiraFase só sorteia os 16 avos), então depois dela só dá
  // para deduzir: Série A sempre folga; Série B que aparece nos 16 avos se
  // classificou ou folgou (não dá para saber qual) → null = "classificado".
  const phase0Known = copa.round === 0 || steps[0].tie != null;
  const division = save.clubs[me]?.division;
  const byeFirst = phase0Known ? !steps[0].tie : division === 'A' ? true : null;
  if (eliminatedAt == null && copa.round >= 1 && T[1]?.length && !steps[1].tie) eliminatedAt = 0;
  // Fase "atual" do meu clube: a do confronto em aberto (ou a da Copa, se folga)
  const live = copa.phase === 'active' && eliminatedAt == null;
  const curPhase = live ? copa.round : null;
  const curTie = live ? steps[copa.round]?.tie || null : null;
  // Último confronto conhecido (base pro caminho até a final)
  const lastKnown = [...steps].reverse().find(s => s.tie) || null;
  return { T, steps, eliminatedAt, champion, byeFirst, live, curPhase, curTie, lastKnown, me };
}

// Possíveis adversários por fase a partir do meu confronto mais recente.
export function pathAhead(run) {
  const { T, lastKnown } = run;
  if (!lastKnown || lastKnown.phase === 0) return null; // chave ainda sem sorteio
  const p = lastKnown.phase;
  const s = lastKnown.idx;
  const out = [];
  for (let q = p + 1; q <= FINAL_PHASE; q++) {
    const mineFeeder = s >> (q - 1 - p);
    const other = mineFeeder ^ 1;
    out.push({ phase: q, tieIdx: s >> (q - p), opponents: survivors(T, q - 1, other), otherFeeder: other });
  }
  return out;
}

// Probabilidades de UM jogo (mesma conta da Visão geral / MatchPreviewModal:
// matchOutcomeProbabilities com mandante e visitante), do ponto de vista de `me`.
export function legProbsFor(save, homeId, awayId, me) {
  const o = matchOutcomeProbabilities(teamForSim(save, homeId), teamForSim(save, awayId));
  return homeId === me ? { w: o.homeWin, d: o.draw, l: o.awayWin } : { w: o.awayWin, d: o.draw, l: o.homeWin };
}

// Chance de classificação — ESTIMATIVA. Cada jogo que falta vira vitória,
// empate ou derrota com as probabilidades de cada jogo; vitória/derrota
// se divide em margem de 1 (55%), 2 (28%) ou 3 gols (17%) — proporção
// típica do futebol, já que a função só dá V/E/D e não o placar. Somando ao
// saldo já conhecido: saldo > 0
// passa, < 0 cai, = 0 vai para o desempate do engine (pênaltis 50%, ou, na
// 1ª fase, jogo extra em que o mandante da ida passa com vitória/empate).
const MARGINS = [[1, 0.55], [2, 0.28], [3, 0.17]];

export function qualifyChance(save, tie, me) {
  const isFinal = tie.phase === FINAL_PHASE;
  const imA = tie.aId === me;
  let known = 0;
  const legs = [];
  if (isFinal) {
    if (tie.single) known += imA ? tie.single.homeGoals - tie.single.awayGoals : tie.single.awayGoals - tie.single.homeGoals;
    else legs.push(legProbsFor(save, tie.aId, tie.bId, me));
  } else {
    if (tie.leg1) known += imA ? tie.leg1.homeGoals - tie.leg1.awayGoals : tie.leg1.awayGoals - tie.leg1.homeGoals;
    else legs.push(legProbsFor(save, tie.aId, tie.bId, me));
    if (tie.leg2) known += imA ? tie.leg2.awayGoals - tie.leg2.homeGoals : tie.leg2.homeGoals - tie.leg2.awayGoals;
    else legs.push(legProbsFor(save, tie.bId, tie.aId, me));
  }
  let dist = new Map([[known, 1]]);
  for (const lp of legs) {
    const next = new Map();
    for (const [d, p] of dist) {
      for (const [m, share] of MARGINS) {
        next.set(d + m, (next.get(d + m) || 0) + p * lp.w * share);
        next.set(d - m, (next.get(d - m) || 0) + p * lp.l * share);
      }
      next.set(d, (next.get(d) || 0) + p * lp.d);
    }
    dist = next;
  }
  let tieBreak = 0.5;
  if (tie.phase === 0) {
    const dec = legProbsFor(save, tie.aId, tie.bId, me); // jogo extra: aId manda, empate = aId
    tieBreak = imA ? dec.w + dec.d : dec.w;
  }
  let chance = 0;
  for (const [d, p] of dist) chance += d > 0 ? p : d === 0 ? p * tieBreak : 0;
  return Math.max(0, Math.min(1, chance));
}

export function tieRuleText(phase) {
  if (phase === 0) return 'Empate no agregado: jogo extra em campo neutro (o mandante da ida passa se empatar).';
  if (phase === FINAL_PHASE) return 'Final em jogo único. Empate vai para os pênaltis.';
  return 'Empate no agregado vai para os pênaltis.';
}

// Gols só da Copa = temporada − Brasileirão (precisa do leaguePlayerStats,
// que existe desde 2026-11-13; saves de antes ficam null até a próxima
// temporada e a aba Artilharia não aparece).
export function copaScorers(save) {
  if (!save.leaguePlayerStats) return null;
  const season = save.seasonPlayerStats || {};
  const league = save.leaguePlayerStats;
  return Object.entries(season)
    .map(([k, s]) => {
      const [clubId, ...rest] = k.split('::');
      return { key: k, clubId, name: rest.join('::'), goals: (s.goals || 0) - (league[k]?.goals || 0) };
    })
    .filter(x => x.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
}
