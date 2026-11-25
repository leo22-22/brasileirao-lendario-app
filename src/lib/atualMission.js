// Brasileirão Atual — Desafio do dia.
//
// Uma missão por dia, igual pra todo mundo (semeada pela data, como a
// Supercopa): "assuma o Grêmio na rodada 27, com a tabela REAL daquele
// momento, e tire o time do Z4 até o fim". As rodadas anteriores à inicial
// vêm de REAL_RESULTS_2026 (placares reais); dali em diante é o motor de
// sempre. Cumpriu = +500 no ranking (servidor: /me/atual-mission-result).
// Módulo puro (sem React, sem App.jsx) pra poder testar em Node.

import { REAL_RESULTS_2026 } from '../data/brasileirao-2026-real-results.js';
import { applyResults } from './standings.js';

export const ATUAL_MISSION_POINTS = 500;
export const ATUAL_SERIE_A_IDS = ['fluminense2026', 'gremio2026', 'botafogo2026', 'cruzeiro2026', 'saopaulo2026', 'flamengo2026', 'corinthians2026', 'bahia2026', 'mirassol2026', 'vasco2026', 'atleticomg2026', 'palmeiras2026', 'internacional2026', 'athleticopr2026', 'coritiba2026', 'bragantino2026', 'vitoria2026', 'remo2026', 'chapecoense2026', 'santos2026'];

// Rodada em que a pessoa assume (1-based). 22..33 = de 6 a 17 rodadas pela frente.
const START_MIN = 22;
const START_MAX = 33;
const TOTAL_ROUNDS = 38;

export const MISSION_TYPES = {
  z4: { target: 16, verb: 'Tirar do Z4', goal: 'terminar fora da zona de rebaixamento (16º ou melhor)' },
  g4: { target: 4, verb: 'Levar ao G4', goal: 'terminar entre os 4 primeiros' },
  titulo: { target: 1, verb: 'Ser campeão', goal: 'terminar em 1º lugar' },
};

function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function missionDateKey(now = new Date()) {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/** Placares reais das rodadas ANTERIORES a startRound (1-based). */
export function realResultsBefore(startRound) {
  return REAL_RESULTS_2026.filter(r => r.round < startRound);
}

/** Tabela real (ordenada) antes da rodada startRound. labelOf(id) opcional. */
export function realTableBefore(startRound, labelOf = (id) => id) {
  const zero = ATUAL_SERIE_A_IDS.map(id => ({ id, label: labelOf(id), pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }));
  return applyResults(zero, realResultsBefore(startRound));
}

// Missões possíveis numa tabela: só as que têm chance real (distância em
// pontos compatível com as rodadas que faltam) e que ainda não estão
// cumpridas (quem já está fora do Z4 não ganha "tire do Z4").
function candidatesFor(table, remaining) {
  const out = [];
  const ptsAt = (pos) => table[pos - 1]?.pts ?? 0;
  table.forEach((row, i) => {
    const pos = i + 1;
    if (pos >= 17) {
      const gap = ptsAt(16) - row.pts;
      if (gap <= Math.max(3, Math.round(remaining * 1.2))) out.push({ type: 'z4', teamId: row.id, startPos: pos, gap });
    } else if (pos >= 5 && pos <= 9) {
      const gap = ptsAt(4) - row.pts;
      if (gap <= Math.max(3, Math.round(remaining * 0.9))) out.push({ type: 'g4', teamId: row.id, startPos: pos, gap });
    } else if (pos >= 2 && pos <= 4) {
      const gap = ptsAt(1) - row.pts;
      if (gap <= Math.max(3, Math.round(remaining * 0.8))) out.push({ type: 'titulo', teamId: row.id, startPos: pos, gap });
    }
  });
  return out;
}

/**
 * Missão do dia. Determinística pela data. Devolve
 * { dateKey, teamId, type, targetPosition, startRound, remaining, startPos, gap, verb, goal }.
 */
export function getAtualMission(now = new Date()) {
  const dateKey = missionDateKey(now);
  const prng = makePrng(hashSeed(`atual-mission-${dateKey}`));
  // Z4 aparece mais (é o exemplo-base do modo); G4 e título se alternam.
  const typeOrder = prng() < 0.5 ? ['z4', 'g4', 'titulo'] : prng() < 0.5 ? ['g4', 'z4', 'titulo'] : ['titulo', 'z4', 'g4'];
  for (let attempt = 0; attempt < 24; attempt++) {
    const startRound = START_MIN + Math.floor(prng() * (START_MAX - START_MIN + 1));
    const remaining = TOTAL_ROUNDS - startRound + 1;
    const cands = candidatesFor(realTableBefore(startRound), remaining);
    for (const type of typeOrder) {
      const ofType = cands.filter(c => c.type === type);
      if (!ofType.length) continue;
      const pick = ofType[Math.floor(prng() * ofType.length)];
      const meta = MISSION_TYPES[type];
      return { dateKey, ...pick, startRound, remaining, targetPosition: meta.target, verb: meta.verb, goal: meta.goal };
    }
  }
  // Não deve acontecer (sempre há alguém no Z4); fallback fixo.
  const startRound = START_MAX;
  const table = realTableBefore(startRound);
  const last = table[table.length - 1];
  return { dateKey, type: 'z4', teamId: last.id, startPos: 20, gap: table[15].pts - last.pts, startRound, remaining: TOTAL_ROUNDS - startRound + 1, targetPosition: 16, ...MISSION_TYPES.z4 };
}

export function missionSucceeded(mission, finalPosition) {
  return Number.isInteger(finalPosition) && finalPosition <= mission.targetPosition;
}

// ── Tentativa do dia (no aparelho) ──────────────────────────────────────
const DONE_KEY = 'brl_atual_mission_done';
export function readAtualMissionDone() {
  try { return localStorage.getItem(DONE_KEY); } catch { return null; }
}
export function markAtualMissionDone(dateKey) {
  try { localStorage.setItem(DONE_KEY, dateKey); } catch { /* sem storage */ }
}
