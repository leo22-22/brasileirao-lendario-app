import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Peer from 'peerjs';
import * as api from './api.js';

// ─── MULTIPLAYER (PeerJS — sem conta, sem backend) ────────────────────────────
// O líder vira o "servidor": peers conectam diretamente ao ID dele via WebRTC.

const MY_PID = (() => {
  let id = sessionStorage.getItem('brl_pid');
  if (!id) { id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); sessionStorage.setItem('brl_pid', id); }
  return id;
})();

// Seeded PRNG (mulberry32) — garante mesmos resultados em todos os clientes
function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deriva uma seed numérica estável a partir de uma string (djb2-like)
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

// PRNG independente por partida: dado a mesma seed de sala + rodada + confronto,
// todo peer chega ao mesmo placar, mesmo que cada um simule localmente.
function matchPrng(roomSeed, roundKey, homeId, awayId) {
  if (roomSeed == null) return Math.random;
  return makePrng(hashSeed(`${roomSeed}|${roundKey}|${homeId}|${awayId}`));
}

// ============================================================
// DADOS: 66 times históricos do Brasileirão (1959-2026)
// ============================================================
const TEAMS = [
  { id: 'corinthians1977', club: 'Corinthians', year: 1977, label: 'Corinthians 1977', coach: 'Oswaldo Brandao',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Tobias', pos: ['GOL'], ovr: 84 },
      { name: 'Zé Maria', pos: ['LD','MD'], ovr: 89 },
      { name: 'Wladimir', pos: ['LE','ME'], ovr: 89 },
      { name: 'Moisés', pos: ['ZAG'], ovr: 84 },
      { name: 'Ademir', pos: ['ZAG'], ovr: 82 },
      { name: 'Ruço', pos: ['VOL','MC'], ovr: 83 },
      { name: 'Basílio', pos: ['MC','MEI','ATA'], ovr: 86 },
      { name: 'Palhinha', pos: ['MEI','ATA','MC'], ovr: 90 },
      { name: 'Vaguinho', pos: ['PD','ATA'], ovr: 85 },
      { name: 'Geraldão', pos: ['ATA'], ovr: 84 },
      { name: 'Romeu Cambalhota', pos: ['PE','PD'], ovr: 84 },
      { name: 'Jairo', pos: ['GOL'], ovr: 79 },
      { name: 'Cláudio Mineiro', pos: ['LE','ME'], ovr: 79 },
      { name: 'Zé Eduardo', pos: ['ZAG'], ovr: 78 },
      { name: 'Givanildo Oliveira', pos: ['VOL','MC'], ovr: 82 },
      { name: 'Tião', pos: ['VOL'], ovr: 77 },
      { name: 'Luciano', pos: ['MEI'], ovr: 76 },
      { name: 'Ivan', pos: ['PD'], ovr: 75 },
      { name: 'Edu', pos: ['PE','MEI'], ovr: 80 },
      { name: 'Lance', pos: ['ATA'], ovr: 76 },
    ]},
  { id: 'guarani1978', club: 'Guarani', year: 1978, label: 'Guarani 1978 (Campeao Brasileiro)', coach: 'Carlos Alberto Silva',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Careca', pos: ['ATA'], ovr: 94 },
      { name: 'Zenon', pos: ['MEI','MC'], ovr: 92 },
      { name: 'Renato', pos: ['MC'], ovr: 89 },
      { name: 'Neneca', pos: ['GOL'], ovr: 88 },
      { name: 'Gomes', pos: ['ZAG'], ovr: 87 },
      { name: 'Capitão', pos: ['PD','MD'], ovr: 86 },
      { name: 'Bozó', pos: ['PE','ME'], ovr: 86 },
      { name: 'Miranda', pos: ['LE'], ovr: 85 },
      { name: 'Mauro', pos: ['LD','ME'], ovr: 85 },
      { name: 'Zé Carlos', pos: ['VOL','MC'], ovr: 85 },
      { name: 'Edson', pos: ['ZAG','ME'], ovr: 85 },
      { name: 'Manguinha', pos: ['VOL','MC'], ovr: 83 },
      { name: 'Silvinho', pos: ['PE','ATA'], ovr: 82 },
      { name: 'Macedo', pos: ['ATA'], ovr: 81 },
      { name: 'João de Deus', pos: ['GOL'], ovr: 80 },
      { name: 'Adriano', pos: ['MC'], ovr: 80 },
      { name: 'Alexandre', pos: ['LD','ZAG'], ovr: 79 },
      { name: 'Almeida', pos: ['LE'], ovr: 79 },
      { name: 'Gersinho', pos: ['PD'], ovr: 78 },
      { name: 'Cidão', pos: ['ZAG'], ovr: 78 },
    ]},
  { id: 'internacional1979', club: 'Internacional', year: 1979, label: 'Internacional 1979 (Invicto)', coach: 'Enio Andrade',
    colors: { p: '#D2122E', s: '#ffffff' },
    players: [
      { name: 'Benítez', pos: ['GOL'], ovr: 89 },
      { name: 'João Carlos', pos: ['LD'], ovr: 80 },
      { name: 'Cláudio Mineiro', pos: ['LE','ME'], ovr: 85 },
      { name: 'Mauro Galvão', pos: ['ZAG','VOL'], ovr: 88 },
      { name: 'Mauro Pastor', pos: ['ZAG'], ovr: 86 },
      { name: 'Batista', pos: ['VOL','MC'], ovr: 90 },
      { name: 'Falcão', pos: ['MC','MEI','VOL'], ovr: 98 },
      { name: 'Jair', pos: ['MEI','MC','ATA'], ovr: 91 },
      { name: 'Mário Sérgio', pos: ['MEI','PE','ME'], ovr: 88 },
      { name: 'Valdomiro', pos: ['PD','ATA'], ovr: 89 },
      { name: 'Bira', pos: ['ATA'], ovr: 87 },
      { name: 'Gasperin', pos: ['GOL'], ovr: 76 },
      { name: 'Édson Galvão', pos: ['LD'], ovr: 76 },
      { name: 'Beliato', pos: ['ZAG'], ovr: 79 },
      { name: 'Valdir Lima', pos: ['VOL'], ovr: 79 },
      { name: 'Tonho', pos: ['MEI'], ovr: 83 },
      { name: 'Chico Spina', pos: ['PD','ATA'], ovr: 83 },
      { name: 'Silvinho', pos: ['PE'], ovr: 78 },
      { name: 'Adílson', pos: ['PE'], ovr: 82 },
      { name: 'Mário Motta', pos: ['ATA'], ovr: 78 },
    ]},
  { id: 'flamengo1980', club: 'Flamengo', year: 1980, label: 'Flamengo 1980 (Campeao Brasileiro)', coach: 'Claudio Coutinho',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Raul Plassmann', pos: ['GOL'], ovr: 85 },
      { name: 'Leandro', pos: ['LD','ZAG','MC'], ovr: 92 },
      { name: 'Mozer', pos: ['ZAG'], ovr: 87 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 83 },
      { name: 'Júnior', pos: ['LE','MC','ME'], ovr: 93 },
      { name: 'Andrade', pos: ['VOL','MC'], ovr: 88 },
      { name: 'Adílio', pos: ['MC','MEI','ME'], ovr: 89 },
      { name: 'Zico', pos: ['MEI','ATA','MC'], ovr: 97 },
      { name: 'Tita', pos: ['MEI','PD','ATA'], ovr: 86 },
      { name: 'Nunes', pos: ['ATA'], ovr: 86 },
      { name: 'Júlio César Uri Geller', pos: ['PE'], ovr: 81 },
      { name: 'Cantarele', pos: ['GOL'], ovr: 78 },
      { name: 'Antunes', pos: ['LD'], ovr: 74 },
      { name: 'Figueiredo', pos: ['ZAG'], ovr: 78 },
      { name: 'Vítor', pos: ['VOL'], ovr: 76 },
      { name: 'Lico', pos: ['MEI','PE'], ovr: 83 },
      { name: 'Chiquinho', pos: ['PD'], ovr: 76 },
      { name: 'Anselmo', pos: ['ATA'], ovr: 77 },
      { name: 'Reinaldo', pos: ['ATA'], ovr: 75 },
      { name: 'Popoca', pos: ['ATA','MEI'], ovr: 74 },
    ]},
  { id: 'flamengo1981', club: 'Flamengo', year: 1981, label: 'Flamengo 1981 (Mundial)', coach: 'Paulo Cesar Carpegiani',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Raul Plassmann', pos: ['GOL'], ovr: 87 },
      { name: 'Leandro', pos: ['LD','ZAG','MC'], ovr: 94 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 85 },
      { name: 'Mozer', pos: ['ZAG'], ovr: 89 },
      { name: 'Júnior', pos: ['LE','MC','ME'], ovr: 95 },
      { name: 'Andrade', pos: ['VOL','MC'], ovr: 90 },
      { name: 'Adílio', pos: ['MC','MEI','ME'], ovr: 91 },
      { name: 'Zico', pos: ['MEI','ATA','MC'], ovr: 99 },
      { name: 'Tita', pos: ['MEI','PD','ATA'], ovr: 88 },
      { name: 'Lico', pos: ['MEI','PE'], ovr: 85 },
      { name: 'Nunes', pos: ['ATA'], ovr: 89 },
      { name: 'Cantarele', pos: ['GOL'], ovr: 78 },
      { name: 'Nei Dias', pos: ['LD'], ovr: 76 },
      { name: 'Figueiredo', pos: ['ZAG'], ovr: 78 },
      { name: 'Rondinelli', pos: ['ZAG'], ovr: 81 },
      { name: 'Vítor', pos: ['VOL'], ovr: 76 },
      { name: 'Chiquinho', pos: ['PD'], ovr: 76 },
      { name: 'Júlio César Uri Geller', pos: ['PE'], ovr: 82 },
      { name: 'Anselmo', pos: ['ATA'], ovr: 78 },
      { name: 'Baroninho', pos: ['PE','ATA'], ovr: 81 },
    ]},
  { id: 'flamengo1982', club: 'Flamengo', year: 1982, label: 'Flamengo 1982 (Bicampeao Brasileiro)', coach: 'Paulo Cesar Carpegiani',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Zico', pos: ['MEI','MC'], ovr: 99 },
      { name: 'Júnior', pos: ['LE','MC'], ovr: 94 },
      { name: 'Leandro', pos: ['LD','MC'], ovr: 94 },
      { name: 'Mozer', pos: ['ZAG'], ovr: 89 },
      { name: 'Nunes', pos: ['ATA'], ovr: 89 },
      { name: 'Adílio', pos: ['MC','MEI'], ovr: 89 },
      { name: 'Tita', pos: ['PD','MD'], ovr: 89 },
      { name: 'Raul Plassmann', pos: ['GOL'], ovr: 88 },
      { name: 'Andrade', pos: ['VOL','MC'], ovr: 88 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 86 },
      { name: 'Lico', pos: ['PE','MD'], ovr: 86 },
      { name: 'Vítor', pos: ['VOL','MC'], ovr: 82 },
      { name: 'Cantarele', pos: ['GOL'], ovr: 81 },
      { name: 'Figueiredo', pos: ['ZAG'], ovr: 81 },
      { name: 'Popoca', pos: ['MEI','MC'], ovr: 81 },
      { name: 'Chiquinho', pos: ['ATA','MC'], ovr: 80 },
      { name: 'Antunes', pos: ['LD'], ovr: 79 },
      { name: 'Reinaldo', pos: ['PE'], ovr: 79 },
      { name: 'Anselmo', pos: ['ATA'], ovr: 79 },
      { name: 'Wilsinho', pos: ['PD','MD'], ovr: 78 },
    ]},
  { id: 'fluminense1984', club: 'Fluminense', year: 1984, label: 'Fluminense 1984 (Campeao Brasileiro)', coach: 'Carlos Alberto Parreira',
    colors: { p: '#7A1921', s: '#006633' },
    players: [
      { name: 'Paulo Vítor', pos: ['GOL'], ovr: 84 },
      { name: 'Aldo', pos: ['LD'], ovr: 82 },
      { name: 'Branco', pos: ['LE','ME'], ovr: 88 },
      { name: 'Duílio', pos: ['ZAG'], ovr: 83 },
      { name: 'Ricardo Rocha', pos: ['ZAG','VOL'], ovr: 86 },
      { name: 'Jandir', pos: ['VOL'], ovr: 83 },
      { name: 'Delei', pos: ['VOL','MC'], ovr: 85 },
      { name: 'Assis', pos: ['MC','MEI'], ovr: 88 },
      { name: 'Romerito', pos: ['MEI','PD','MC'], ovr: 91 },
      { name: 'Tato', pos: ['PE','ME'], ovr: 82 },
      { name: 'Washington', pos: ['ATA'], ovr: 87 },
      { name: 'Ricardo Pinto', pos: ['GOL'], ovr: 75 },
      { name: 'Renato', pos: ['LE'], ovr: 74 },
      { name: 'Vica', pos: ['ZAG'], ovr: 80 },
      { name: 'Renê', pos: ['MEI','MC'], ovr: 78 },
      { name: 'Wilsinho', pos: ['PD'], ovr: 79 },
      { name: 'Paulinho', pos: ['PE'], ovr: 76 },
      { name: 'Cláudio Adão', pos: ['ATA'], ovr: 84 },
      { name: 'Agnaldo', pos: ['ATA'], ovr: 76 },
      { name: 'Gustavo', pos: ['ATA'], ovr: 74 },
    ]},
  { id: 'coritiba1985', club: 'Coritiba', year: 1985, label: 'Coritiba 1985 (Campeao Brasileiro)', coach: 'Enio Andrade',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Rafael Cammarota', pos: ['GOL'], ovr: 84 },
      { name: 'André', pos: ['LD','ZAG'], ovr: 80 },
      { name: 'Dida', pos: ['LE','ZAG'], ovr: 81 },
      { name: 'Gomes', pos: ['ZAG'], ovr: 83 },
      { name: 'Heraldo', pos: ['ZAG'], ovr: 81 },
      { name: 'Almir', pos: ['VOL'], ovr: 82 },
      { name: 'Marildo', pos: ['VOL','MC'], ovr: 79 },
      { name: 'Édson', pos: ['PE'], ovr: 79 },
      { name: 'Lela', pos: ['PD','ATA'], ovr: 85 },
      { name: 'Índio', pos: ['ATA'], ovr: 83 },
      { name: 'Toby', pos: ['ATA','MEI'], ovr: 81 },
      { name: 'Jairo', pos: ['GOL'], ovr: 77 },
      { name: 'Caxias', pos: ['LD'], ovr: 74 },
      { name: 'Vavá', pos: ['ZAG'], ovr: 75 },
      { name: 'Marco Aurélio', pos: ['MC','MEI'], ovr: 83 },
      { name: 'Tovar', pos: ['MEI','MC'], ovr: 80 },
      { name: 'Miltinho', pos: ['MEI'], ovr: 76 },
      { name: 'Paulinho', pos: ['PD'], ovr: 75 },
      { name: 'Vicente', pos: ['PE'], ovr: 74 },
      { name: 'Hélcio', pos: ['ATA'], ovr: 75 },
    ]},
  { id: 'sao-paulo1986', club: 'Sao Paulo', year: 1986, label: 'São Paulo 1986 (Campeão Brasileiro)', coach: 'Pepe',
    colors: { p: '#C8102E', s: '#ffffff' },
    players: [
      { name: 'Careca', pos: ['ATA'], ovr: 96 },
      { name: 'Müller', pos: ['ATA','MD'], ovr: 92 },
      { name: 'Darío Pereyra', pos: ['ZAG','VOL'], ovr: 90 },
      { name: 'Gilmar Rinaldi', pos: ['GOL'], ovr: 88 },
      { name: 'Silas', pos: ['MC'], ovr: 88 },
      { name: 'Oscar', pos: ['ZAG'], ovr: 88 },
      { name: 'Nelsinho', pos: ['LE'], ovr: 87 },
      { name: 'Bernardo', pos: ['VOL','MC'], ovr: 86 },
      { name: 'Pita', pos: ['MEI','MC'], ovr: 86 },
      { name: 'Zé Teodoro', pos: ['LD'], ovr: 85 },
      { name: 'Sidnei', pos: ['PD','MC'], ovr: 84 },
      { name: 'Wagner Basílio', pos: ['ZAG'], ovr: 83 },
      { name: 'Fonseca', pos: ['LD','ZAG'], ovr: 83 },
      { name: 'Ronaldão', pos: ['ZAG','MC'], ovr: 82 },
      { name: 'Vizolli', pos: ['VOL'], ovr: 82 },
      { name: 'Pianelli', pos: ['MEI','PE'], ovr: 81 },
      { name: 'Lange', pos: ['ATA'], ovr: 81 },
      { name: 'Abelha', pos: ['GOL'], ovr: 80 },
      { name: 'Manu', pos: ['MC','ME'], ovr: 79 },
      { name: 'Quarenta', pos: ['LE'], ovr: 78 },
    ]},
  { id: 'sport1987', club: 'Sport', year: 1987, label: 'Sport 1987 (Campeão Brasileiro)', coach: 'Emerson Leao',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Flávio', pos: ['GOL'], ovr: 84 },
      { name: 'Betão', pos: ['LD'], ovr: 82 },
      { name: 'Macaxeira', pos: ['LE'], ovr: 81 },
      { name: 'Estevam', pos: ['ZAG'], ovr: 85 },
      { name: 'Marco Antônio', pos: ['ZAG'], ovr: 83 },
      { name: 'Rogério', pos: ['VOL'], ovr: 83 },
      { name: 'Zé do Carmo', pos: ['VOL','MC'], ovr: 86 },
      { name: 'Ribamar', pos: ['MC','MEI'], ovr: 84 },
      { name: 'Robertinho', pos: ['PD','ATA'], ovr: 83 },
      { name: 'Neco', pos: ['PE','ME'], ovr: 85 },
      { name: 'Nando', pos: ['ATA'], ovr: 85 },
      { name: 'Moacir', pos: ['GOL'], ovr: 76 },
      { name: 'Adriano', pos: ['ZAG'], ovr: 77 },
      { name: 'Dedé', pos: ['VOL'], ovr: 77 },
      { name: 'Nando', pos: ['MEI','MC'], ovr: 82 },
      { name: 'Zico', pos: ['MEI'], ovr: 78 },
      { name: 'Augusto', pos: ['PD'], ovr: 75 },
      { name: 'Émerson', pos: ['PE'], ovr: 76 },
      { name: 'Betinho', pos: ['ATA'], ovr: 80 },
      { name: 'Isaías', pos: ['ATA'], ovr: 75 },
    ]},
  { id: 'bahia1988', club: 'Bahia', year: 1988, label: 'Bahia 1988 (Bicampeão Brasileiro)', coach: 'Evaristo de Macedo',
    colors: { p: '#003399', s: '#C8102E' },
    players: [
      { name: 'Ronaldo', pos: ['GOL'], ovr: 88 },
      { name: 'Tarantini', pos: ['LD','ZAG'], ovr: 83 },
      { name: 'Paulo Róbson', pos: ['LE','ME'], ovr: 84 },
      { name: 'João Marcelo', pos: ['ZAG'], ovr: 86 },
      { name: 'Claudir', pos: ['ZAG'], ovr: 85 },
      { name: 'Paulo Rodrigues', pos: ['VOL','MC'], ovr: 87 },
      { name: 'Zé Carlos', pos: ['MC','MEI','VOL'], ovr: 88 },
      { name: 'Bobô', pos: ['MEI','MC','ATA'], ovr: 92 },
      { name: 'Marquinhos', pos: ['PD','PE'], ovr: 81 },
      { name: 'Sandro', pos: ['PE','ME'], ovr: 84 },
      { name: 'Charles Fabian', pos: ['ATA'], ovr: 89 },
      { name: 'Sidmar', pos: ['GOL'], ovr: 77 },
      { name: 'Maizena', pos: ['LD'], ovr: 76 },
      { name: 'Edinho', pos: ['LE'], ovr: 75 },
      { name: 'Newmar', pos: ['ZAG'], ovr: 78 },
      { name: 'Sales', pos: ['VOL'], ovr: 83 },
      { name: 'Gil Sergipano', pos: ['VOL','MC'], ovr: 81 },
      { name: 'Dácio', pos: ['MEI'], ovr: 75 },
      { name: 'Osmar', pos: ['PD','ATA'], ovr: 83 },
      { name: 'Renato', pos: ['ATA'], ovr: 80 },
    ]},
  { id: 'vasco1989', club: 'Vasco', year: 1989, label: 'Vasco 1989 (Campeão Brasileiro)', coach: 'Nelsinho Rosa',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Acácio', pos: ['GOL'], ovr: 85 },
      { name: 'Luís Carlos Winck', pos: ['LD'], ovr: 84 },
      { name: 'Quiñonez', pos: ['ZAG'], ovr: 83 },
      { name: 'Marco Aurélio', pos: ['ZAG','MC'], ovr: 82 },
      { name: 'Célio Silva', pos: ['ZAG'], ovr: 80 },
      { name: 'Mazinho', pos: ['LE','VOL'], ovr: 88 },
      { name: 'Zé do Carmo', pos: ['VOL','MC'], ovr: 84 },
      { name: 'Andrade', pos: ['VOL','MC'], ovr: 83 },
      { name: 'Marco Antônio Boiadeiro', pos: ['MC'], ovr: 83 },
      { name: 'Bismarck', pos: ['MEI','MD'], ovr: 86 },
      { name: 'Bebeto', pos: ['ATA','MEI'], ovr: 92 },
      { name: 'Tita', pos: ['MEI','MD'], ovr: 85 },
      { name: 'William', pos: ['MEI','ME'], ovr: 82 },
      { name: 'Sorato', pos: ['ATA'], ovr: 83 },
      { name: 'Tato', pos: ['PE','ME'], ovr: 80 },
      { name: 'Ayupe', pos: ['LD'], ovr: 74 },
      { name: 'Leonardo Siqueira', pos: ['ZAG'], ovr: 76 },
      { name: 'Cássio', pos: ['LE'], ovr: 74 },
      { name: 'França', pos: ['VOL'], ovr: 75 },
      { name: 'Reginaldo', pos: ['GOL'], ovr: 75 },
    ]},
  { id: 'corinthians1990', club: 'Corinthians', year: 1990, label: 'Corinthians 1990 (Primeiro Titulo)', coach: 'Nelsinho Baptista',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Neto', pos: ['MEI','MC'], ovr: 93 },
      { name: 'Ronaldo Giovanelli', pos: ['GOL'], ovr: 89 },
      { name: 'Márcio Bittencourt', pos: ['VOL','MC'], ovr: 87 },
      { name: 'Tupãzinho', pos: ['MC','MD'], ovr: 87 },
      { name: 'Marcelo Djian', pos: ['ZAG'], ovr: 86 },
      { name: 'Wilson Mano', pos: ['VOL','LD'], ovr: 86 },
      { name: 'Giba', pos: ['LD'], ovr: 85 },
      { name: 'Jacenir', pos: ['LE'], ovr: 85 },
      { name: 'Fabinho', pos: ['PD','MC'], ovr: 85 },
      { name: 'Mauro', pos: ['ZAG','ME'], ovr: 84 },
      { name: 'Guinei', pos: ['ZAG'], ovr: 84 },
      { name: 'Dinei', pos: ['ATA'], ovr: 84 },
      { name: 'Gérson', pos: ['ZAG','LD'], ovr: 78 },
      { name: 'Ezequiel', pos: ['VOL','MC'], ovr: 83 },
      { name: 'Paulo Sérgio', pos: ['ATA','ME'], ovr: 82 },
      { name: 'Jairo', pos: ['ATA'], ovr: 81 },
      { name: 'Marcos Roberto', pos: ['LE'], ovr: 80 },
      { name: 'Wilson', pos: ['GOL'], ovr: 80 },
      { name: 'Dama', pos: ['ZAG'], ovr: 79 },
      { name: 'Dagoberto', pos: ['GOL'], ovr: 74 },
    ]},
  { id: 'sao-paulo1991', club: 'Sao Paulo', year: 1991, label: 'São Paulo 1991 (Campeão Brasileiro)', coach: 'Tele Santana',
    colors: { p: '#C8102E', s: '#ffffff' },
    players: [
      { name: 'Zetti', pos: ['GOL'], ovr: 91 },
      { name: 'Cafu', pos: ['LD','MD','PD','MC'], ovr: 92 },
      { name: 'Ricardo Rocha', pos: ['ZAG','VOL'], ovr: 92 },
      { name: 'Antônio Carlos Zago', pos: ['ZAG'], ovr: 86 },
      { name: 'Leonardo', pos: ['LE','ME','MC'], ovr: 90 },
      { name: 'Bernardo', pos: ['VOL','MC'], ovr: 85 },
      { name: 'Sídnei', pos: ['VOL'], ovr: 81 },
      { name: 'Raí', pos: ['MEI','ATA'], ovr: 93 },
      { name: 'Elivélton', pos: ['PE','ME'], ovr: 84 },
      { name: 'Müller', pos: ['ATA','PD','PE','MEI'], ovr: 91 },
      { name: 'Macedo', pos: ['ATA','PD'], ovr: 83 },
      { name: 'Marcos Bonequini', pos: ['GOL'], ovr: 76 },
      { name: 'Zé Teodoro', pos: ['LD'], ovr: 80 },
      { name: 'Nelsinho', pos: ['LE'], ovr: 82 },
      { name: 'Ronaldão', pos: ['ZAG','VOL'], ovr: 85 },
      { name: 'Suélio', pos: ['VOL'], ovr: 79 },
      { name: 'Catê', pos: ['ATA','PD'], ovr: 75 },
      { name: 'Flávio Campos', pos: ['MC','VOL'], ovr: 81 },
      { name: 'Mário Tilico', pos: ['PD','PE'], ovr: 83 },
      { name: 'Rinaldo', pos: ['ATA'], ovr: 78 },
    ]},
  { id: 'flamengo1992', club: 'Flamengo', year: 1992, label: 'Flamengo 1992 (Campeão Brasileiro)', coach: 'Carlinhos',
    colors: { p: '#C8102E', s: '#000000' },
    players: [
      { name: 'Júnior', pos: ['MC','LE'], ovr: 93 },
      { name: 'Gilmar', pos: ['GOL','MC'], ovr: 88 },
      { name: 'Zinho', pos: ['ME','MC'], ovr: 88 },
      { name: 'Gaúcho', pos: ['ATA','MC'], ovr: 87 },
      { name: 'Wilson Gottardo', pos: ['ZAG'], ovr: 87 },
      { name: 'Djalminha', pos: ['MEI','MC'], ovr: 86 },
      { name: 'Piá', pos: ['LE'], ovr: 86 },
      { name: 'Charles', pos: ['LD'], ovr: 85 },
      { name: 'Júnior Baiano', pos: ['ZAG'], ovr: 85 },
      { name: 'Uidemar', pos: ['VOL','MC'], ovr: 85 },
      { name: 'Nélio', pos: ['PE','MC'], ovr: 85 },
      { name: 'Marcelinho Carioca', pos: ['MEI','ME'], ovr: 84 },
      { name: 'Rogério', pos: ['ZAG'], ovr: 83 },
      { name: 'Marquinhos', pos: ['MC','ME'], ovr: 83 },
      { name: 'Paulo Nunes', pos: ['PD','ATA'], ovr: 83 },
      { name: 'Fabinho', pos: ['VOL','MC'], ovr: 82 },
      { name: 'Totó', pos: ['ATA'], ovr: 81 },
      { name: 'Gelson', pos: ['ZAG'], ovr: 80 },
      { name: 'Adriano', pos: ['GOL','MC'], ovr: 79 },
      { name: 'Luís Antônio', pos: ['LE','MC'], ovr: 78 },
    ]},
  { id: 'palmeiras1993', club: 'Palmeiras', year: 1993, label: 'Palmeiras 1993 (Campeão Brasileiro)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Sérgio', pos: ['GOL'], ovr: 87 },
      { name: 'Mazinho', pos: ['LD','VOL','LE','MC'], ovr: 87 },
      { name: 'Cláudio', pos: ['LD','MD'], ovr: 86 },
      { name: 'Roberto Carlos', pos: ['LE','ME'], ovr: 92 },
      { name: 'Antônio Carlos Zago', pos: ['ZAG'], ovr: 89 },
      { name: 'Cléber', pos: ['ZAG'], ovr: 86 },
      { name: 'César Sampaio', pos: ['VOL','MC'], ovr: 91 },
      { name: 'Zinho', pos: ['MEI','ME','MC'], ovr: 90 },
      { name: 'Edmundo', pos: ['PD','ATA','MEI'], ovr: 93 },
      { name: 'Edílson', pos: ['PE','ATA','PD','MEI'], ovr: 87 },
      { name: 'Evair', pos: ['ATA','MEI'], ovr: 92 },
      { name: 'Velloso', pos: ['GOL'], ovr: 80 },
      { name: 'Tonhão', pos: ['ZAG'], ovr: 83 },
      { name: 'Edinho Baiano', pos: ['ZAG'], ovr: 78 },
      { name: 'Daniel Frasson', pos: ['VOL','MC'], ovr: 84 },
      { name: 'Amaral', pos: ['VOL'], ovr: 82 },
      { name: 'Jean Carlo', pos: ['MEI','PE'], ovr: 81 },
      { name: 'Maurílio', pos: ['PD','ATA','LD'], ovr: 82 },
      { name: 'Sorato', pos: ['ATA'], ovr: 83 },
      { name: 'Saulo', pos: ['ATA'], ovr: 78 },
    ]},
  { id: 'palmeiras1994', club: 'Palmeiras', year: 1994, label: 'Palmeiras 1994 (Bicampeão Brasileiro)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Rivaldo', pos: ['MEI','MC'], ovr: 94 },
      { name: 'Edmundo', pos: ['PD','ATA'], ovr: 93 },
      { name: 'Roberto Carlos', pos: ['LE'], ovr: 93 },
      { name: 'Evair', pos: ['ATA','ME'], ovr: 92 },
      { name: 'César Sampaio', pos: ['VOL','MC'], ovr: 91 },
      { name: 'Zinho', pos: ['ME','MC'], ovr: 90 },
      { name: 'Cléber', pos: ['ZAG'], ovr: 89 },
      { name: 'Antônio Carlos', pos: ['ZAG'], ovr: 88 },
      { name: 'Velloso', pos: ['GOL'], ovr: 88 },
      { name: 'Flávio Conceição', pos: ['MC'], ovr: 87 },
      { name: 'Mazinho', pos: ['MC','LD'], ovr: 86 },
      { name: 'Cláudio', pos: ['LD'], ovr: 85 },
      { name: 'Amaral', pos: ['VOL','ME'], ovr: 85 },
      { name: 'Maurílio', pos: ['PD','ATA'], ovr: 83 },
      { name: 'Tonhão', pos: ['ZAG'], ovr: 83 },
      { name: 'Sorato', pos: ['ATA'], ovr: 82 },
      { name: 'Wagner', pos: ['LE','MC'], ovr: 81 },
      { name: 'Sérgio', pos: ['GOL'], ovr: 80 },
      { name: 'Macula', pos: ['MC'], ovr: 79 },
      { name: 'Chiquinho', pos: ['PE','MC'], ovr: 78 },
    ]},
  { id: 'botafogo1995', club: 'Botafogo', year: 1995, label: 'Botafogo 1995', coach: 'Paulo Autuori',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Wagner', pos: ['GOL','MC'], ovr: 81 },
      { name: 'Wilson Goiano', pos: ['LD'], ovr: 77 },
      { name: 'Wilson Gottardo', pos: ['ZAG'], ovr: 80 },
      { name: 'Goncalves', pos: ['ZAG'], ovr: 79 },
      { name: 'Andre Silva', pos: ['LE'], ovr: 76 },
      { name: 'Leandro Avila', pos: ['VOL','MC'], ovr: 78 },
      { name: 'Jamir', pos: ['VOL','MEI'], ovr: 78 },
      { name: 'Beto', pos: ['MEI','VOL'], ovr: 77 },
      { name: 'Sergio Manoel', pos: ['MEI','PD'], ovr: 80 },
      { name: 'Donizete', pos: ['ATA'], ovr: 81 },
      { name: 'Tulio Maravilha', pos: ['ATA'], ovr: 89 },
      { name: 'Moises', pos: ['LE'], ovr: 72 },
      { name: 'Iranildo', pos: ['MEI','MC'], ovr: 75 },
      { name: 'Marcelo Alves', pos: ['MEI','MC'], ovr: 72 },
      { name: 'Narcizio', pos: ['ATA'], ovr: 71 },
      { name: 'Rui', pos: ['ATA'], ovr: 71 },
      { name: 'Marcio', pos: ['LD','MC'], ovr: 71 },
      { name: 'Claudinho', pos: ['ZAG'], ovr: 70 },
      { name: 'Jorginho', pos: ['MEI','MC'], ovr: 71 },
      { name: 'Alan', pos: ['PE','ME'], ovr: 70 },
    ]},
  { id: 'gremio1996', club: 'Gremio', year: 1996, label: 'Gremio 1996', coach: 'Luiz Felipe Scolari',
    colors: { p: '#1c3f94', s: '#000000' },
    players: [
      { name: 'Danrlei', pos: ['GOL'], ovr: 88 },
      { name: 'Arce', pos: ['LD','MD'], ovr: 90 },
      { name: 'Roger Machado', pos: ['LE','ZAG'], ovr: 86 },
      { name: 'Adilson Batista', pos: ['ZAG'], ovr: 87 },
      { name: 'Rivarola', pos: ['ZAG'], ovr: 85 },
      { name: 'Dinho', pos: ['VOL'], ovr: 85 },
      { name: 'Goiano', pos: ['VOL','MC'], ovr: 86 },
      { name: 'Emerson', pos: ['MC','VOL'], ovr: 84 },
      { name: 'Carlos Miguel', pos: ['MEI','ME','PE'], ovr: 86 },
      { name: 'Paulo Nunes', pos: ['PD','ATA'], ovr: 90 },
      { name: 'Jardel', pos: ['ATA'], ovr: 91 },
      { name: 'Murilo', pos: ['GOL'], ovr: 77 },
      { name: 'Marco Antônio', pos: ['LD'], ovr: 76 },
      { name: 'Cristiano', pos: ['LE'], ovr: 75 },
      { name: 'Mauro Galvão', pos: ['ZAG','VOL'], ovr: 89 },
      { name: 'João Antônio', pos: ['VOL','MC'], ovr: 81 },
      { name: 'Ailton', pos: ['MEI','ATA'], ovr: 82 },
      { name: 'Zinho', pos: ['PE','PD'], ovr: 80 },
      { name: 'Zé Alcino', pos: ['ATA'], ovr: 85 },
      { name: 'Rodrigo Gral', pos: ['ATA'], ovr: 77 },
    ]},
  { id: 'vasco1997', club: 'Vasco', year: 1997, label: 'Vasco 1997 (Brasileiro)', coach: 'Antonio Lopes',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Carlos Germano', pos: ['GOL'], ovr: 85 },
      { name: 'Valber', pos: ['LD'], ovr: 81 },
      { name: 'Odvan', pos: ['ZAG'], ovr: 82 },
      { name: 'Mauro Galvao', pos: ['ZAG'], ovr: 84 },
      { name: 'Felipe', pos: ['LE'], ovr: 83 },
      { name: 'Luisinho', pos: ['VOL','MEI'], ovr: 82 },
      { name: 'Nasa', pos: ['VOL','MEI'], ovr: 81 },
      { name: 'Juninho Pernambucano', pos: ['MEI','MD'], ovr: 88 },
      { name: 'Ramon', pos: ['MEI','MD'], ovr: 84 },
      { name: 'Edmundo', pos: ['ATA'], ovr: 95 },
      { name: 'Evair', pos: ['PE','ME'], ovr: 88 },
      { name: 'Marica', pos: ['LD'], ovr: 76 },
      { name: 'Alex Pinho', pos: ['ZAG'], ovr: 75 },
      { name: 'Pedrinho', pos: ['MEI','MC'], ovr: 80 },
      { name: 'Mauricinho', pos: ['MEI','MC'], ovr: 75 },
      { name: 'Donizete', pos: ['ATA'], ovr: 82 },
      { name: 'Brener', pos: ['ATA'], ovr: 76 },
      { name: 'Luizao', pos: ['ATA'], ovr: 83 },
      { name: 'Gil', pos: ['ZAG','MC'], ovr: 74 },
      { name: 'Sandro', pos: ['MEI','MC'], ovr: 73 },
    ]},
  { id: 'vasco1998', club: 'Vasco', year: 1998, label: 'Vasco 1998 (Libertadores)', coach: 'Antonio Lopes',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Carlos Germano', pos: ['GOL'], ovr: 91 },
      { name: 'Vágner', pos: ['LD','VOL','MC'], ovr: 85 },
      { name: 'Mauro Galvão', pos: ['ZAG','VOL'], ovr: 92 },
      { name: 'Odvan', pos: ['ZAG'], ovr: 85 },
      { name: 'Felipe', pos: ['LE','ME','MEI'], ovr: 91 },
      { name: 'Luisinho', pos: ['VOL'], ovr: 85 },
      { name: 'Nasa', pos: ['VOL'], ovr: 84 },
      { name: 'Juninho Pernambucano', pos: ['MC','MEI','MD'], ovr: 92 },
      { name: 'Pedrinho', pos: ['MEI','ME','PE'], ovr: 87 },
      { name: 'Donizete', pos: ['PD','ATA'], ovr: 89 },
      { name: 'Luizão', pos: ['PE','ATA'], ovr: 90 },
      { name: 'Márcio', pos: ['GOL'], ovr: 77 },
      { name: 'Filipe Alvim', pos: ['LD'], ovr: 76 },
      { name: 'Géder', pos: ['ZAG'], ovr: 78 },
      { name: 'Nelson', pos: ['VOL'], ovr: 79 },
      { name: 'Válber', pos: ['MEI','MC','LD'], ovr: 83 },
      { name: 'Gian', pos: ['MEI'], ovr: 77 },
      { name: 'Mauricinho', pos: ['PE'], ovr: 78 },
      { name: 'Sorato', pos: ['ATA'], ovr: 80 },
      { name: 'Luiz Cláudio', pos: ['ATA'], ovr: 76 },
    ]},
  { id: 'corinthians1998', club: 'Corinthians', year: 1998, label: 'Corinthians 1998 (Bicampeao)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Nei', pos: ['GOL'], ovr: 77 },
      { name: 'Índio', pos: ['LD'], ovr: 80 },
      { name: 'Gamarra', pos: ['ZAG'], ovr: 92 },
      { name: 'Batata', pos: ['ZAG'], ovr: 79 },
      { name: 'Silvinho', pos: ['LE','ME'], ovr: 85 },
      { name: 'Vampeta', pos: ['VOL','MC','LD'], ovr: 88 },
      { name: 'Rincón', pos: ['VOL','MC','MEI'], ovr: 87 },
      { name: 'Marcelinho Carioca', pos: ['MEI','MD','PD','ATA'], ovr: 91 },
      { name: 'Ricardinho', pos: ['MEI','ME','MC'], ovr: 88 },
      { name: 'Edílson', pos: ['PE','ATA','PD','MEI'], ovr: 90 },
      { name: 'Mirandinha', pos: ['PD','ATA'], ovr: 79 },
      { name: 'Maurício', pos: ['GOL'], ovr: 74 },
      { name: 'Rodrigo', pos: ['LD'], ovr: 75 },
      { name: 'Cris', pos: ['ZAG'], ovr: 74 },
      { name: 'Romeu', pos: ['ZAG'], ovr: 75 },
      { name: 'Amaral', pos: ['VOL'], ovr: 76 },
      { name: 'Gilmar Fubá', pos: ['VOL'], ovr: 76 },
      { name: 'Souza', pos: ['MEI'], ovr: 76 },
      { name: 'Didi', pos: ['ATA'], ovr: 75 },
      { name: 'Dinei', pos: ['ATA'], ovr: 78 },
    ]},
  { id: 'corinthians1999', club: 'Corinthians', year: 1999, label: 'Corinthians 1999 (Tricampeao)', coach: 'Oswaldo de Oliveira',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Dida', pos: ['GOL'], ovr: 88 },
      { name: 'Indio', pos: ['LD'], ovr: 80 },
      { name: 'Joao Carlos', pos: ['ZAG'], ovr: 79 },
      { name: 'Marcio Costa', pos: ['ZAG'], ovr: 79 },
      { name: 'Kleber', pos: ['LE'], ovr: 79 },
      { name: 'Vampeta', pos: ['VOL','MC'], ovr: 89 },
      { name: 'Rincon', pos: ['MEI','MC'], ovr: 87 },
      { name: 'Ricardinho', pos: ['MEI','MC'], ovr: 88 },
      { name: 'Marcelinho Carioca', pos: ['MEI','ME'], ovr: 92 },
      { name: 'Edilson', pos: ['ATA','MD'], ovr: 89 },
      { name: 'Luizao', pos: ['ATA'], ovr: 87 },
      { name: 'Dinei', pos: ['ATA'], ovr: 79 },
      { name: 'Marcos Senna', pos: ['VOL','MC'], ovr: 81 },
      { name: 'Sylvinho', pos: ['LE','PE'], ovr: 86 },
      { name: 'Adilson', pos: ['ZAG'], ovr: 74 },
      { name: 'Gilmar', pos: ['VOL','MC'], ovr: 75 },
      { name: 'Edu', pos: ['MEI','ME'], ovr: 75 },
      { name: 'Fabinho', pos: ['ZAG','MC'], ovr: 73 },
      { name: 'Luis Carlos', pos: ['PD','MD'], ovr: 72 },
      { name: 'Anderson', pos: ['ATA'], ovr: 71 },
    ]},
  { id: 'vasco2000', club: 'Vasco', year: 2000, label: 'Vasco 2000 (Brasileiro + Mercosul)', coach: 'Oswaldo de Oliveira',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Carlos Germano', pos: ['GOL'], ovr: 82 },
      { name: 'Valber', pos: ['LD'], ovr: 77 },
      { name: 'Anderson Polga', pos: ['ZAG'], ovr: 80 },
      { name: 'Odvan', pos: ['ZAG'], ovr: 78 },
      { name: 'Felipe', pos: ['LE'], ovr: 79 },
      { name: 'Ramon', pos: ['MEI','MD'], ovr: 82 },
      { name: 'Juninho Paulista', pos: ['MEI','MC'], ovr: 84 },
      { name: 'Pedrinho', pos: ['MEI','MC'], ovr: 80 },
      { name: 'Luizao', pos: ['ATA'], ovr: 86 },
      { name: 'Donizete', pos: ['ATA'], ovr: 84 },
      { name: 'Romario', pos: ['ATA'], ovr: 91 },
      { name: 'Sandro', pos: ['GOL','MC'], ovr: 71 },
      { name: 'Valdir', pos: ['LD'], ovr: 73 },
      { name: 'Mauro Galvao', pos: ['ZAG'], ovr: 79 },
      { name: 'Everton', pos: ['ATA'], ovr: 73 },
      { name: 'Nasa', pos: ['VOL'], ovr: 77 },
      { name: 'Nilton', pos: ['VOL','MC'], ovr: 76 },
      { name: 'Paulo Victor', pos: ['MEI','MC'], ovr: 74 },
      { name: 'Alexandre Pires', pos: ['ATA'], ovr: 75 },
      { name: 'Fabio Augusto', pos: ['LD'], ovr: 72 },
    ]},
  { id: 'athletico-pr2001', club: 'Athletico-PR', year: 2001, label: 'Athletico-PR 2001', coach: 'Geninho',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Flávio', pos: ['GOL'], ovr: 82 },
      { name: 'Nem', pos: ['ZAG'], ovr: 84 },
      { name: 'Gustavo', pos: ['ZAG'], ovr: 81 },
      { name: 'Rogério Corrêa', pos: ['ZAG'], ovr: 81 },
      { name: 'Alessandro', pos: ['LD','MD'], ovr: 81 },
      { name: 'Fabiano', pos: ['LE','ME'], ovr: 80 },
      { name: 'Cocito', pos: ['VOL'], ovr: 82 },
      { name: 'Kléberson', pos: ['VOL','MC','MD'], ovr: 87 },
      { name: 'Adriano Gabiru', pos: ['MC','MEI','MD'], ovr: 83 },
      { name: 'Alex Mineiro', pos: ['ATA'], ovr: 88 },
      { name: 'Kléber Pereira', pos: ['ATA'], ovr: 86 },
      { name: 'Luisinho Netto', pos: ['LD','MD'], ovr: 76 },
      { name: 'Vicente', pos: ['LE'], ovr: 75 },
      { name: 'Igor', pos: ['ZAG'], ovr: 76 },
      { name: 'Pires', pos: ['VOL'], ovr: 77 },
      { name: 'Souza', pos: ['MEI','MC'], ovr: 81 },
      { name: 'Lobatón', pos: ['MEI'], ovr: 74 },
      { name: 'Ilan', pos: ['ATA','PD'], ovr: 79 },
      { name: 'Dagoberto', pos: ['ATA','PE'], ovr: 72 },
      { name: 'Adauto', pos: ['ATA'], ovr: 74 },
    ]},
  { id: 'santos2002', club: 'Santos', year: 2002, label: 'Santos 2002 (Meninos da Vila)', coach: 'Emerson Leao',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Fabio Costa', pos: ['GOL'], ovr: 86 },
      { name: 'Maurinho', pos: ['LD'], ovr: 78 },
      { name: 'Andre Luis', pos: ['ZAG'], ovr: 83 },
      { name: 'Alex', pos: ['ZAG'], ovr: 85 },
      { name: 'Leo', pos: ['LE'], ovr: 83 },
      { name: 'Paulo Almeida', pos: ['VOL','MC'], ovr: 82 },
      { name: 'Renato', pos: ['VOL','MC'], ovr: 86 },
      { name: 'Elano', pos: ['MEI','MD'], ovr: 87 },
      { name: 'Diego', pos: ['MEI','MC'], ovr: 88 },
      { name: 'Robinho', pos: ['ATA','PE','ME'], ovr: 92 },
      { name: 'William', pos: ['PE','ME'], ovr: 76 },
      { name: 'Julio Cesar', pos: ['GOL'], ovr: 73 },
      { name: 'Wellington', pos: ['MEI','MC'], ovr: 72 },
      { name: 'Alexandre', pos: ['ATA'], ovr: 73 },
      { name: 'Robert', pos: ['ATA'], ovr: 82 },
      { name: 'Michel', pos: ['ATA'], ovr: 71 },
      { name: 'Adriano', pos: ['ZAG'], ovr: 73 },
      { name: 'Felipe', pos: ['LD'], ovr: 72 },
      { name: 'Marcos', pos: ['VOL','MD'], ovr: 71 },
      { name: 'Junior', pos: ['MEI','MC'], ovr: 70 },
    ]},
  { id: 'cruzeiro2003', club: 'Cruzeiro', year: 2003, label: 'Cruzeiro 2003 (Triplice Coroa)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#1c3f94', s: '#ffffff' },
    players: [
      { name: 'Gomes', pos: ['GOL'], ovr: 80 },
      { name: 'Maurinho', pos: ['LD'], ovr: 78 },
      { name: 'Cris', pos: ['ZAG'], ovr: 79 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 82 },
      { name: 'Leandro', pos: ['LE','MC'], ovr: 78 },
      { name: 'Maldonado', pos: ['VOL','MC'], ovr: 79 },
      { name: 'Augusto Recife', pos: ['VOL','MC'], ovr: 77 },
      { name: 'Wendell', pos: ['MEI','MC'], ovr: 78 },
      { name: 'Alex', pos: ['MEI','MC'], ovr: 90 },
      { name: 'Aristizabal', pos: ['ATA'], ovr: 82 },
      { name: 'Mota', pos: ['ATA'], ovr: 79 },
      { name: 'Maicon', pos: ['LD'], ovr: 76 },
      { name: 'Luisao', pos: ['ZAG'], ovr: 79 },
      { name: 'Felipe Melo', pos: ['VOL','MC'], ovr: 78 },
      { name: 'Zinho', pos: ['MEI','MC'], ovr: 73 },
      { name: 'Marcio Nobre', pos: ['ATA'], ovr: 75 },
      { name: 'Deivid', pos: ['ATA'], ovr: 78 },
      { name: 'Alex Alves', pos: ['ATA'], ovr: 74 },
      { name: 'Martinez', pos: ['MEI','MC'], ovr: 73 },
      { name: 'Thiago', pos: ['ZAG'], ovr: 75 },
    ]},
  { id: 'santos2004', club: 'Santos', year: 2004, label: 'Santos 2004 (Bicampeonato + 103 gols)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Mauro', pos: ['GOL'], ovr: 81 },
      { name: 'Alex', pos: ['ZAG'], ovr: 86 },
      { name: 'André Luís', pos: ['ZAG'], ovr: 83 },
      { name: 'Paulo César', pos: ['LD'], ovr: 83 },
      { name: 'Léo', pos: ['LE'], ovr: 87 },
      { name: 'Renato', pos: ['VOL','MC'], ovr: 85 },
      { name: 'Paulo Almeida', pos: ['VOL','MC'], ovr: 84 },
      { name: 'Elano', pos: ['MEI','MD'], ovr: 91 },
      { name: 'Ricardinho', pos: ['MEI','MC'], ovr: 89 },
      { name: 'Robinho', pos: ['ATA','ME'], ovr: 94 },
      { name: 'Deivid', pos: ['ATA'], ovr: 87 },
      { name: 'Doni', pos: ['GOL'], ovr: 77 },
      { name: 'Júlio Sérgio', pos: ['GOL'], ovr: 75 },
      { name: 'Ávalos', pos: ['ZAG'], ovr: 79 },
      { name: 'Flávio', pos: ['LD','LE'], ovr: 77 },
      { name: 'Fabinho', pos: ['VOL','MC'], ovr: 79 },
      { name: 'Preto Casagrande', pos: ['MEI','VOL'], ovr: 79 },
      { name: 'Marcinho', pos: ['MEI','ATA'], ovr: 77 },
      { name: 'Basílio', pos: ['ATA'], ovr: 82 },
      { name: 'William', pos: ['ATA','ME'], ovr: 76 },
    ]},
  { id: 'corinthians2005', club: 'Corinthians', year: 2005, label: 'Corinthians 2005', coach: 'Antonio Lopes',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Fábio Costa', pos: ['GOL'], ovr: 88 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 82 },
      { name: 'Betão', pos: ['ZAG','LD'], ovr: 82 },
      { name: 'Gustavo Nery', pos: ['LE','ME','MC'], ovr: 86 },
      { name: 'Coelho', pos: ['LD','MD'], ovr: 83 },
      { name: 'Marcelo Mattos', pos: ['VOL'], ovr: 86 },
      { name: 'Wendel', pos: ['VOL','LD'], ovr: 78 },
      { name: 'Bruno Octávio', pos: ['VOL'], ovr: 76 },
      { name: 'Carlos Alberto', pos: ['MC','MEI','PD'], ovr: 87 },
      { name: 'Tevez', pos: ['ATA','MEI','PE'], ovr: 95 },
      { name: 'Nilmar', pos: ['ATA','PD','PE'], ovr: 90 },
      { name: 'Tiago Campagnaro', pos: ['GOL'], ovr: 77 },
      { name: 'Edson', pos: ['LD'], ovr: 76 },
      { name: 'Sebá Domínguez', pos: ['ZAG'], ovr: 84 },
      { name: 'Marcus Vinícius', pos: ['ZAG'], ovr: 77 },
      { name: 'Rosinei', pos: ['VOL','MC','MD'], ovr: 85 },
      { name: 'Roger Flores', pos: ['MEI','MC'], ovr: 86 },
      { name: 'Hugo', pos: ['MEI','ME'], ovr: 80 },
      { name: 'Jô', pos: ['ATA','PE'], ovr: 82 },
      { name: 'Bobô', pos: ['ATA'], ovr: 76 },
    ]},
  { id: 'sao-paulo2006', club: 'Sao Paulo', year: 2006, label: 'Sao Paulo 2006', coach: 'Muricy Ramalho',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Rogerio Ceni', pos: ['GOL'], ovr: 94 },
      { name: 'Ilsinho', pos: ['LD','PD'], ovr: 78 },
      { name: 'Fabao', pos: ['ZAG'], ovr: 81 },
      { name: 'Miranda', pos: ['ZAG'], ovr: 82 },
      { name: 'Junior', pos: ['LE','MC'], ovr: 77 },
      { name: 'Mineiro', pos: ['VOL','MC'], ovr: 81 },
      { name: 'Josue', pos: ['VOL','MEI'], ovr: 80 },
      { name: 'Souza', pos: ['MEI','MC'], ovr: 78 },
      { name: 'Danilo', pos: ['MEI','MC'], ovr: 80 },
      { name: 'Leandro', pos: ['PD','MC'], ovr: 77 },
      { name: 'Aloisio', pos: ['ATA'], ovr: 81 },
      { name: 'Lugano', pos: ['ZAG'], ovr: 82 },
      { name: 'Alex Silva', pos: ['ZAG'], ovr: 73 },
      { name: 'Cicinho', pos: ['LD','PD'], ovr: 79 },
      { name: 'Thiago Ribeiro', pos: ['MEI','MD'], ovr: 75 },
      { name: 'Richarlyson', pos: ['MEI','MC'], ovr: 74 },
      { name: 'Lenilson', pos: ['ATA'], ovr: 73 },
      { name: 'Anderson', pos: ['ATA'], ovr: 72 },
      { name: 'Rodrigo', pos: ['LD'], ovr: 71 },
      { name: 'Edcarlos', pos: ['ZAG'], ovr: 76 },
    ]},
  { id: 'sao-paulo2007', club: 'Sao Paulo', year: 2007, label: 'Sao Paulo 2007 (Bicampeonato)', coach: 'Muricy Ramalho',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Rogério Ceni', pos: ['GOL'], ovr: 92 },
      { name: 'Breno', pos: ['ZAG'], ovr: 82 },
      { name: 'Miranda', pos: ['ZAG'], ovr: 84 },
      { name: 'Alex Silva', pos: ['ZAG'], ovr: 74 },
      { name: 'Ilsinho', pos: ['LD','MD','MC'], ovr: 78 },
      { name: 'Jorge Wagner', pos: ['ME','MEI','LE'], ovr: 82 },
      { name: 'Josué', pos: ['VOL'], ovr: 81 },
      { name: 'Richarlyson', pos: ['VOL','LE','ZAG','MC'], ovr: 79 },
      { name: 'Hernanes', pos: ['MC','VOL','MEI'], ovr: 86 },
      { name: 'Aloísio Chulapa', pos: ['ATA'], ovr: 80 },
      { name: 'Borges', pos: ['ATA'], ovr: 79 },
      { name: 'Bosco', pos: ['GOL'], ovr: 74 },
      { name: 'Reasco', pos: ['LD'], ovr: 76 },
      { name: 'Júnior', pos: ['LE','ME','MC'], ovr: 77 },
      { name: 'Jadilson', pos: ['LE','ME'], ovr: 76 },
      { name: 'André Dias', pos: ['ZAG'], ovr: 78 },
      { name: 'Fernando', pos: ['VOL'], ovr: 77 },
      { name: 'Hugo', pos: ['MEI','MC','ME'], ovr: 75 },
      { name: 'Leandro', pos: ['ATA','MD','PD'], ovr: 76 },
      { name: 'Dagoberto', pos: ['ATA','PE','PD'], ovr: 81 },
    ]},
  { id: 'sao-paulo2008', club: 'Sao Paulo', year: 2008, label: 'Sao Paulo 2008 (Tricampeonato)', coach: 'Muricy Ramalho',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Rogerio Ceni', pos: ['GOL'], ovr: 91 },
      { name: 'Ilsinho', pos: ['LD','PD'], ovr: 77 },
      { name: 'Fabao', pos: ['ZAG'], ovr: 80 },
      { name: 'Miranda', pos: ['ZAG'], ovr: 85 },
      { name: 'Lugano', pos: ['ZAG'], ovr: 84 },
      { name: 'Junior', pos: ['LE','MC'], ovr: 76 },
      { name: 'Mineiro', pos: ['VOL','MC'], ovr: 82 },
      { name: 'Josue', pos: ['VOL','MEI'], ovr: 80 },
      { name: 'Danilo', pos: ['MEI','MC'], ovr: 80 },
      { name: 'Hernanes', pos: ['MEI','MC'], ovr: 88 },
      { name: 'Borges', pos: ['ATA'], ovr: 80 },
      { name: 'Aloisio', pos: ['ATA'], ovr: 79 },
      { name: 'Diego Tardelli', pos: ['ATA'], ovr: 81 },
      { name: 'Grafite', pos: ['ATA'], ovr: 82 },
      { name: 'Alex Silva', pos: ['ZAG'], ovr: 74 },
      { name: 'Eder Luis', pos: ['ATA'], ovr: 74 },
      { name: 'Rafael', pos: ['ZAG'], ovr: 73 },
      { name: 'Jadson', pos: ['MEI','MC'], ovr: 77 },
      { name: 'Junior Cesar', pos: ['LE'], ovr: 72 },
      { name: 'Souza', pos: ['MEI','MC'], ovr: 79 },
    ]},
  { id: 'flamengo2009', club: 'Flamengo', year: 2009, label: 'Flamengo 2009 (Hexacampeonato)', coach: 'Andrade',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Bruno', pos: ['GOL'], ovr: 82 },
      { name: 'Ronaldo Angelim', pos: ['ZAG'], ovr: 82 },
      { name: 'Leo Moura', pos: ['LD','PD'], ovr: 86 },
      { name: 'Willians', pos: ['LE'], ovr: 79 },
      { name: 'Wellinton Souza', pos: ['ZAG'], ovr: 78 },
      { name: 'Ze Roberto', pos: ['MD','MEI'], ovr: 80 },
      { name: 'Gonzalo Fierro', pos: ['MEI','MC'], ovr: 81 },
      { name: 'Petkovic', pos: ['MEI','MC'], ovr: 85 },
      { name: 'Rafael Toro', pos: ['MC','MEI'], ovr: 78 },
      { name: 'Adriano', pos: ['ATA','MEI'], ovr: 88 },
      { name: 'Kleber', pos: ['ATA'], ovr: 83 },
      { name: 'Juan', pos: ['ZAG'], ovr: 84 },
      { name: 'Alvaro', pos: ['LD','LE'], ovr: 74 },
      { name: 'Emerson Sheik', pos: ['PD','ATA'], ovr: 78 },
      { name: 'Maldonado', pos: ['VOL','MC'], ovr: 74 },
      { name: 'Denis Marques', pos: ['ATA'], ovr: 73 },
      { name: 'Everton Silva', pos: ['ZAG'], ovr: 74 },
      { name: 'David Braz', pos: ['ZAG'], ovr: 80 },
      { name: 'Ibson', pos: ['VOL','MC'], ovr: 79 },
      { name: 'Diego', pos: ['GOL'], ovr: 72 },
    ]},
  { id: 'santos2010', club: 'Santos', year: 2010, label: 'Santos 2010 (Copa do Brasil)', coach: 'Dorival Junior',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Rafael', pos: ['GOL'], ovr: 87 },
      { name: 'Danilo', pos: ['LD','MC','VOL'], ovr: 83 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 85 },
      { name: 'Durval', pos: ['ZAG'], ovr: 86 },
      { name: 'Leo', pos: ['LE'], ovr: 81 },
      { name: 'Adriano', pos: ['VOL','MC'], ovr: 79 },
      { name: 'Arouca', pos: ['VOL','MC'], ovr: 85 },
      { name: 'Elano', pos: ['MEI','MD'], ovr: 87 },
      { name: 'Paulo Henrique Ganso', pos: ['MEI','MC'], ovr: 88 },
      { name: 'Robinho', pos: ['PE','ME'], ovr: 89 },
      { name: 'Neymar', pos: ['ATA','PE'], ovr: 93 },
      { name: 'Andre', pos: ['ATA'], ovr: 82 },
      { name: 'Ze Eduardo', pos: ['ATA'], ovr: 79 },
      { name: 'Alan Kardec', pos: ['ATA'], ovr: 78 },
      { name: 'Alan Patrick', pos: ['MEI','MC'], ovr: 78 },
      { name: 'Alex Sandro', pos: ['LE'], ovr: 81 },
      { name: 'Wesley', pos: ['VOL','MC','LD','MD'], ovr: 82 },
      { name: 'Bruno Rodrigo', pos: ['ZAG'], ovr: 79 },
      { name: 'Felipe', pos: ['GOL'], ovr: 75 },
      { name: 'Para', pos: ['LD'], ovr: 78 },
    ]},
  { id: 'fluminense2010', club: 'Fluminense', year: 2010, label: 'Fluminense 2010 (Tricampeonato)', coach: 'Muricy Ramalho',
    colors: { p: '#7a1e3c', s: '#006437' },
    players: [
      { name: 'Ricardo Berna', pos: ['GOL'], ovr: 79 },
      { name: 'Mariano', pos: ['LD','MD'], ovr: 83 },
      { name: 'Gum', pos: ['ZAG'], ovr: 81 },
      { name: 'Leandro Euzebio', pos: ['ZAG'], ovr: 80 },
      { name: 'Carlinhos', pos: ['LE'], ovr: 79 },
      { name: 'Diguinho', pos: ['VOL','MC'], ovr: 80 },
      { name: 'Deco', pos: ['MC'], ovr: 85 },
      { name: 'Conca', pos: ['MEI','MC'], ovr: 88 },
      { name: 'Emerson Sheik', pos: ['ATA','ME'], ovr: 79 },
      { name: 'Washington', pos: ['ATA'], ovr: 82 },
      { name: 'Fred', pos: ['ATA'], ovr: 86 },
      { name: 'Fernando Henrique', pos: ['GOL'], ovr: 76 },
      { name: 'Valencia', pos: ['VOL'], ovr: 78 },
      { name: 'Rodrigo Souto', pos: ['VOL','MC'], ovr: 77 },
      { name: 'Julio Cesar', pos: ['LE','ME'], ovr: 76 },
      { name: 'Thiago Neves', pos: ['MEI','ME'], ovr: 76 },
      { name: 'Marquinho', pos: ['ME','MC'], ovr: 76 },
      { name: 'Rodrigueiro', pos: ['MEI','MC'], ovr: 74 },
      { name: 'Alan', pos: ['ATA','ME'], ovr: 74 },
      { name: 'Andre Luis', pos: ['ZAG'], ovr: 73 },
    ]},
  { id: 'santos2011', club: 'Santos', year: 2011, label: 'Santos 2011 (Libertadores)', coach: 'Adilson Batista',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Rafael Cabral', pos: ['GOL'], ovr: 82 },
      { name: 'Danilo', pos: ['LD','VOL','MC','MD'], ovr: 85 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 84 },
      { name: 'Durval', pos: ['ZAG'], ovr: 78 },
      { name: 'Léo', pos: ['LE','ME'], ovr: 82 },
      { name: 'Arouca', pos: ['VOL','MC'], ovr: 84 },
      { name: 'Wesley', pos: ['MC','LD','VOL'], ovr: 78 },
      { name: 'Ganso', pos: ['MEI','MC'], ovr: 89 },
      { name: 'Marquinhos', pos: ['MEI','MC'], ovr: 78 },
      { name: 'Neymar', pos: ['PE','PD','MEI','ATA'], ovr: 95 },
      { name: 'Zé Eduardo', pos: ['ATA','PE','PD'], ovr: 80 },
      { name: 'Felipe', pos: ['GOL'], ovr: 77 },
      { name: 'Pará', pos: ['LD','LE','VOL'], ovr: 80 },
      { name: 'Alex Sandro', pos: ['LE','ME'], ovr: 80 },
      { name: 'Bruno Aguiar', pos: ['ZAG'], ovr: 76 },
      { name: 'Roberto Brum', pos: ['VOL'], ovr: 76 },
      { name: 'Rodrigo Mancha', pos: ['VOL'], ovr: 75 },
      { name: 'Madson', pos: ['MEI','PD'], ovr: 78 },
      { name: 'Robinho', pos: ['ATA','PE','PD'], ovr: 87 },
      { name: 'André', pos: ['ATA'], ovr: 83 },
    ]},
  { id: 'corinthians2011', club: 'Corinthians', year: 2011, label: 'Corinthians 2011 (Pentacampeonato)', coach: 'Tite',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Júlio César', pos: ['GOL'], ovr: 78 },
      { name: 'Alessandro', pos: ['LD','LE'], ovr: 79 },
      { name: 'Chicão', pos: ['ZAG'], ovr: 84 },
      { name: 'Leandro Castán', pos: ['ZAG','LE'], ovr: 85 },
      { name: 'Fábio Santos', pos: ['LE'], ovr: 83 },
      { name: 'Ralf', pos: ['VOL'], ovr: 86 },
      { name: 'Paulinho', pos: ['VOL','MC'], ovr: 88 },
      { name: 'Alex', pos: ['MC','MEI','ME'], ovr: 85 },
      { name: 'Danilo', pos: ['MEI','MC','PE','ATA'], ovr: 84 },
      { name: 'Emerson Sheik', pos: ['PE','ATA','PD'], ovr: 85 },
      { name: 'Liédson', pos: ['ATA'], ovr: 82 },
      { name: 'Danilo Fernandes', pos: ['GOL'], ovr: 74 },
      { name: 'Weldinho', pos: ['LD'], ovr: 74 },
      { name: 'Ramon', pos: ['LE','ME'], ovr: 76 },
      { name: 'Wallace', pos: ['ZAG'], ovr: 79 },
      { name: 'Paulo André', pos: ['ZAG'], ovr: 80 },
      { name: 'Edenílson', pos: ['VOL','LD','MD'], ovr: 77 },
      { name: 'Morais', pos: ['MEI','MD'], ovr: 76 },
      { name: 'Jorge Henrique', pos: ['PD','PE','MD'], ovr: 80 },
      { name: 'Willian Bigode', pos: ['ATA','PD','PE'], ovr: 76 },
    ]},
  { id: 'fluminense2012', club: 'Fluminense', year: 2012, label: 'Fluminense 2012 (Tetracampeonato)', coach: 'Abel Braga',
    colors: { p: '#7a1e3c', s: '#006437' },
    players: [
      { name: 'Diego Cavalieri', pos: ['GOL'], ovr: 84 },
      { name: 'Bruno', pos: ['LD'], ovr: 81 },
      { name: 'Gum', pos: ['ZAG'], ovr: 85 },
      { name: 'Leandro Euzebio', pos: ['ZAG'], ovr: 82 },
      { name: 'Carlinhos', pos: ['LE'], ovr: 82 },
      { name: 'Edinho', pos: ['VOL','ME'], ovr: 78 },
      { name: 'Jean', pos: ['VOL','MC'], ovr: 79 },
      { name: 'Deco', pos: ['MEI','MC'], ovr: 87 },
      { name: 'Thiago Neves', pos: ['MEI','ME'], ovr: 88 },
      { name: 'Wellington Nem', pos: ['PD','MEI'], ovr: 83 },
      { name: 'Fred', pos: ['ATA'], ovr: 90 },
      { name: 'Rafael Sobis', pos: ['ATA'], ovr: 82 },
      { name: 'Rafael Moura', pos: ['ATA'], ovr: 79 },
      { name: 'Wagner', pos: ['MEI','MC'], ovr: 76 },
      { name: 'Lanzini', pos: ['MEI','MC'], ovr: 80 },
      { name: 'Michael', pos: ['MEI','MD'], ovr: 74 },
      { name: 'Rodrigo Lindoso', pos: ['VOL'], ovr: 78 },
      { name: 'Samuel', pos: ['ATA'], ovr: 73 },
      { name: 'Martinuccio', pos: ['MEI','MC'], ovr: 74 },
      { name: 'Anderson', pos: ['ZAG'], ovr: 78 },
    ]},
  { id: 'atletico-mg2013', club: 'Atletico-MG', year: 2013, label: 'Atletico-MG 2013 (Libertadores)', coach: 'Cuca',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Victor', pos: ['GOL'], ovr: 91 },
      { name: 'Marcos Rocha', pos: ['LD','MD'], ovr: 85 },
      { name: 'Réver', pos: ['ZAG'], ovr: 87 },
      { name: 'Leonardo Silva', pos: ['ZAG'], ovr: 87 },
      { name: 'Junior Cesar', pos: ['LE'], ovr: 81 },
      { name: 'Richarlyson', pos: ['LE','VOL','ZAG'], ovr: 81 },
      { name: 'Pierre', pos: ['VOL'], ovr: 84 },
      { name: 'Josué', pos: ['VOL'], ovr: 82 },
      { name: 'Ronaldinho Gaúcho', pos: ['MEI','PE','ATA'], ovr: 95 },
      { name: 'Diego Tardelli', pos: ['PD','ATA','PE'], ovr: 89 },
      { name: 'Bernard', pos: ['PE','PD','MEI'], ovr: 87 },
      { name: 'Giovanni', pos: ['GOL'], ovr: 78 },
      { name: 'Carlos César', pos: ['LD'], ovr: 76 },
      { name: 'Gilberto Silva', pos: ['ZAG','VOL'], ovr: 80 },
      { name: 'Rafael Marques', pos: ['ZAG'], ovr: 77 },
      { name: 'Leandro Donizete', pos: ['VOL','MC'], ovr: 84 },
      { name: 'Guilherme', pos: ['MEI','ATA'], ovr: 82 },
      { name: 'Leleu', pos: ['MEI'], ovr: 72 },
      { name: 'Luan', pos: ['PD','PE'], ovr: 82 },
      { name: 'Jô', pos: ['ATA'], ovr: 88 },
    ]},
  { id: 'cruzeiro2013', club: 'Cruzeiro', year: 2013, label: 'Cruzeiro 2013 (Brasileiro)', coach: 'Marcelo Oliveira',
    colors: { p: '#1c3f94', s: '#ffffff' },
    players: [
      { name: 'Fábio', pos: ['GOL'], ovr: 89 },
      { name: 'Ceará', pos: ['LD'], ovr: 82 },
      { name: 'Dedé', pos: ['ZAG'], ovr: 86 },
      { name: 'Bruno Rodrigo', pos: ['ZAG'], ovr: 84 },
      { name: 'Egídio', pos: ['LE','ME'], ovr: 82 },
      { name: 'Nilton', pos: ['VOL'], ovr: 85 },
      { name: 'Lucas Silva', pos: ['VOL','MC'], ovr: 84 },
      { name: 'Éverton Ribeiro', pos: ['MEI','PD','MC'], ovr: 91 },
      { name: 'Ricardo Goulart', pos: ['MEI','ATA'], ovr: 87 },
      { name: 'Willian Bigode', pos: ['PE','PD','ATA'], ovr: 85 },
      { name: 'Borges', pos: ['ATA'], ovr: 85 },
      { name: 'Rafael', pos: ['GOL'], ovr: 79 },
      { name: 'Mayke', pos: ['LD','MD'], ovr: 82 },
      { name: 'Leo', pos: ['ZAG','LD'], ovr: 80 },
      { name: 'Paulão', pos: ['ZAG'], ovr: 77 },
      { name: 'Henrique', pos: ['VOL'], ovr: 81 },
      { name: 'Leandro Guerreiro', pos: ['VOL','ZAG'], ovr: 77 },
      { name: 'Júlio Baptista', pos: ['MEI','ATA'], ovr: 81 },
      { name: 'Luan', pos: ['PD','PE'], ovr: 79 },
      { name: 'Dagoberto', pos: ['PE','ATA'], ovr: 84 },
    ]},
  { id: 'cruzeiro2014', club: 'Cruzeiro', year: 2014, label: 'Cruzeiro 2014 (Tetracampeonato)', coach: 'Marcelo Oliveira',
    colors: { p: '#1c3f94', s: '#ffffff' },
    players: [
      { name: 'Fábio', pos: ['GOL'], ovr: 87 },
      { name: 'Ceará', pos: ['LD'], ovr: 82 },
      { name: 'Dedé', pos: ['ZAG'], ovr: 90 },
      { name: 'Bruno Rodrigo', pos: ['ZAG'], ovr: 81 },
      { name: 'Egídio', pos: ['LE','ME'], ovr: 81 },
      { name: 'Lucas Silva', pos: ['VOL','MC'], ovr: 84 },
      { name: 'Henrique', pos: ['VOL'], ovr: 81 },
      { name: 'Nilton', pos: ['VOL'], ovr: 83 },
      { name: 'Éverton Ribeiro', pos: ['MEI','PD','MC'], ovr: 90 },
      { name: 'Ricardo Goulart', pos: ['MEI','ATA','MC'], ovr: 89 },
      { name: 'Marcelo Moreno', pos: ['ATA'], ovr: 85 },
      { name: 'Rafael', pos: ['GOL'], ovr: 75 },
      { name: 'Mayke', pos: ['LD','MD'], ovr: 80 },
      { name: 'Samudio', pos: ['LE'], ovr: 73 },
      { name: 'Manoel', pos: ['ZAG'], ovr: 78 },
      { name: 'Leo', pos: ['ZAG','LD'], ovr: 80 },
      { name: 'Willian Farias', pos: ['VOL'], ovr: 79 },
      { name: 'Marlone', pos: ['MEI','PE'], ovr: 78 },
      { name: 'Marquinhos', pos: ['PD','PE'], ovr: 77 },
      { name: 'Willian Bigode', pos: ['PE','PD','ATA'], ovr: 75 },
    ]},
  { id: 'corinthians2015', club: 'Corinthians', year: 2015, label: 'Corinthians 2015 (Hexacampeonato)', coach: 'Tite',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Cassio', pos: ['GOL'], ovr: 89 },
      { name: 'Fagner', pos: ['LD'], ovr: 82 },
      { name: 'Gil Baiano', pos: ['ZAG'], ovr: 87 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 84 },
      { name: 'Guilherme Arana', pos: ['LE'], ovr: 83 },
      { name: 'Ralf', pos: ['VOL','MC'], ovr: 85 },
      { name: 'Elias', pos: ['VOL','MEI'], ovr: 84 },
      { name: 'Renato Augusto', pos: ['MEI','MC'], ovr: 86 },
      { name: 'Jadson', pos: ['MEI','MC'], ovr: 88 },
      { name: 'Roberto Firmino', pos: ['ATA','MEI'], ovr: 85 },
      { name: 'Malcom', pos: ['PD','MD'], ovr: 82 },
      { name: 'Alessandro', pos: ['LD'], ovr: 78 },
      { name: 'Chicao', pos: ['ZAG'], ovr: 82 },
      { name: 'Rodriguinho', pos: ['MEI','MC'], ovr: 83 },
      { name: 'Willian Arao', pos: ['VOL','MC'], ovr: 80 },
      { name: 'Petros', pos: ['VOL','MC'], ovr: 77 },
      { name: 'Lucca', pos: ['ATA'], ovr: 73 },
      { name: 'Luciano', pos: ['ATA'], ovr: 79 },
      { name: 'Danilo Avelar', pos: ['LE'], ovr: 77 },
      { name: 'Uendel', pos: ['LE'], ovr: 78 },
    ]},
  { id: 'palmeiras2016', club: 'Palmeiras', year: 2016, label: 'Palmeiras 2016', coach: 'Cuca',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Fernando Prass', pos: ['GOL'], ovr: 84 },
      { name: 'Marcos Rocha', pos: ['LD'], ovr: 82 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 83 },
      { name: 'Mina', pos: ['ZAG'], ovr: 84 },
      { name: 'Egidio', pos: ['LE'], ovr: 81 },
      { name: 'Arouca', pos: ['VOL','MC'], ovr: 83 },
      { name: 'Felipe Melo', pos: ['VOL','MC'], ovr: 87 },
      { name: 'Thiago Santos', pos: ['VOL','MC'], ovr: 79 },
      { name: 'Allione', pos: ['MEI','PD'], ovr: 82 },
      { name: 'Dudu', pos: ['PD','MD'], ovr: 88 },
      { name: 'Gabriel Jesus', pos: ['ATA'], ovr: 91 },
      { name: 'Cleiton Xavier', pos: ['MEI','MC'], ovr: 79 },
      { name: 'Tche Tche', pos: ['MEI','VOL'], ovr: 80 },
      { name: 'Rafael Marques', pos: ['ATA'], ovr: 77 },
      { name: 'Willian', pos: ['ATA','ME'], ovr: 78 },
      { name: 'Mauricio Ramos', pos: ['ZAG'], ovr: 76 },
      { name: 'Jean', pos: ['LD','MC'], ovr: 78 },
      { name: 'Thiago Martins', pos: ['ZAG'], ovr: 79 },
      { name: 'Raphael Veiga', pos: ['MEI','MC'], ovr: 80 },
      { name: 'Roger Guedes', pos: ['ATA','PE'], ovr: 80 },
    ]},
  { id: 'corinthians2017', club: 'Corinthians', year: 2017, label: 'Corinthians 2017 (Heptacampeonato)', coach: 'Fabio Carille',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Cássio', pos: ['GOL'], ovr: 90 },
      { name: 'Fagner', pos: ['LD'], ovr: 85 },
      { name: 'Balbuena', pos: ['ZAG'], ovr: 84 },
      { name: 'Pablo', pos: ['ZAG'], ovr: 82 },
      { name: 'Guilherme Arana', pos: ['LE','ME'], ovr: 83 },
      { name: 'Gabriel', pos: ['VOL'], ovr: 82 },
      { name: 'Maycon', pos: ['VOL','MC','LE'], ovr: 85 },
      { name: 'Jadson', pos: ['MEI','MD','MC'], ovr: 89 },
      { name: 'Ángel Romero', pos: ['PD','PE','ATA'], ovr: 82 },
      { name: 'Clayson', pos: ['PE','PD'], ovr: 80 },
      { name: 'Jô', pos: ['ATA'], ovr: 87 },
      { name: 'Walter', pos: ['GOL'], ovr: 75 },
      { name: 'Léo Príncipe', pos: ['LD'], ovr: 76 },
      { name: 'Moisés', pos: ['LE'], ovr: 76 },
      { name: 'Pedro Henrique', pos: ['ZAG'], ovr: 77 },
      { name: 'Camacho', pos: ['VOL','MC'], ovr: 74 },
      { name: 'Paulo Roberto', pos: ['VOL','LD'], ovr: 76 },
      { name: 'Rodriguinho', pos: ['MC','MEI','ATA'], ovr: 84 },
      { name: 'Marquinhos Gabriel', pos: ['MEI','MD','PD'], ovr: 80 },
      { name: 'Pedrinho', pos: ['PE','PD','MEI'], ovr: 78 },
    ]},
  { id: 'palmeiras2018', club: 'Palmeiras', year: 2018, label: 'Palmeiras 2018 (80 pontos recorde)', coach: 'Luiz Felipe Scolari',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Weverton', pos: ['GOL'], ovr: 89 },
      { name: 'Marcos Rocha', pos: ['LD'], ovr: 84 },
      { name: 'Gustavo Gomez', pos: ['ZAG'], ovr: 88 },
      { name: 'Luan', pos: ['ZAG'], ovr: 83 },
      { name: 'Diogo Barbosa', pos: ['LE'], ovr: 82 },
      { name: 'Felipe Melo', pos: ['VOL','MC'], ovr: 88 },
      { name: 'Bruno Henrique', pos: ['VOL','ME'], ovr: 84 },
      { name: 'Ze Rafael', pos: ['VOL','MC'], ovr: 83 },
      { name: 'Hyoran', pos: ['MEI','MC'], ovr: 80 },
      { name: 'Dudu', pos: ['PD','MD'], ovr: 92 },
      { name: 'Borja', pos: ['ATA'], ovr: 81 },
      { name: 'Lucas Lima', pos: ['MEI','MC'], ovr: 82 },
      { name: 'Willian', pos: ['ATA','ME'], ovr: 82 },
      { name: 'Deyverson', pos: ['ATA'], ovr: 80 },
      { name: 'Moises', pos: ['VOL','LE'], ovr: 79 },
      { name: 'Mayke', pos: ['LD'], ovr: 80 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 82 },
      { name: 'Thiago Santos', pos: ['VOL','MC'], ovr: 78 },
      { name: 'Rafael Marques', pos: ['ATA'], ovr: 76 },
      { name: 'Raphael Veiga', pos: ['MEI','MC'], ovr: 80 },
    ]},
  { id: 'athletico-pr2019', club: 'Athletico-PR', year: 2019, label: 'Athletico-PR 2019 (Copa do Brasil)', coach: 'Tiago Nunes',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Santos', pos: ['GOL'], ovr: 82 },
      { name: 'Marcio Azevedo', pos: ['LD'], ovr: 79 },
      { name: 'Pedro Henrique', pos: ['ZAG'], ovr: 80 },
      { name: 'Thiago Heleno', pos: ['ZAG'], ovr: 82 },
      { name: 'Leo Pereira', pos: ['LE'], ovr: 80 },
      { name: 'Christian', pos: ['VOL','MC'], ovr: 83 },
      { name: 'Matheus Fernandes', pos: ['VOL','MC'], ovr: 82 },
      { name: 'Bruno Guimaraes', pos: ['VOL','MEI'], ovr: 86 },
      { name: 'Nikao', pos: ['MEI','MD'], ovr: 88 },
      { name: 'Rony', pos: ['PD','ME'], ovr: 86 },
      { name: 'Marco Ruben', pos: ['ATA'], ovr: 81 },
      { name: 'Jonathan', pos: ['GOL'], ovr: 75 },
      { name: 'Robson Bambu', pos: ['ZAG'], ovr: 79 },
      { name: 'Abner', pos: ['LE'], ovr: 77 },
      { name: 'Lucho Gonzalez', pos: ['MEI','MC'], ovr: 83 },
      { name: 'Marcelo Cirino', pos: ['PE','ME'], ovr: 81 },
      { name: 'Wellington', pos: ['VOL','MC'], ovr: 79 },
      { name: 'Jonathan Rios', pos: ['LD'], ovr: 78 },
      { name: 'Vitinho', pos: ['PD'], ovr: 80 },
      { name: 'Marcinho', pos: ['LD','MC'], ovr: 76 },
    ]},
  { id: 'flamengo2019', club: 'Flamengo', year: 2019, label: 'Flamengo 2019 (Bicampeonato + Libertadores)', coach: 'Jorge Jesus',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Diego Alves', pos: ['GOL'], ovr: 87 },
      { name: 'Rafinha', pos: ['LD'], ovr: 86 },
      { name: 'Rodrigo Caio', pos: ['ZAG'], ovr: 86 },
      { name: 'Pablo Mari', pos: ['ZAG'], ovr: 85 },
      { name: 'Filipe Luis', pos: ['LE'], ovr: 91 },
      { name: 'Willian Arao', pos: ['VOL','MC','ZAG'], ovr: 88 },
      { name: 'Gerson', pos: ['VOL','MC','MD','MEI'], ovr: 90 },
      { name: 'Everton Ribeiro', pos: ['MEI','MD'], ovr: 91 },
      { name: 'Arrascaeta', pos: ['MEI','MC'], ovr: 92 },
      { name: 'Bruno Henrique', pos: ['PE','ATA','ME','PD'], ovr: 90 },
      { name: 'Gabigol', pos: ['ATA'], ovr: 97 },
      { name: 'Pedro', pos: ['ATA'], ovr: 88 },
      { name: 'Diego', pos: ['MEI','MC'], ovr: 84 },
      { name: 'Cuellar', pos: ['VOL','MC'], ovr: 85 },
      { name: 'Rodinei', pos: ['LD'], ovr: 82 },
      { name: 'Reinier', pos: ['MEI','MC','ATA'], ovr: 82 },
      { name: 'Michael', pos: ['PE','ME','ATA'], ovr: 82 },
      { name: 'Thiago Maia', pos: ['VOL','MC'], ovr: 83 },
      { name: 'Lincoln', pos: ['ATA'], ovr: 79 },
      { name: 'Leo Ortiz', pos: ['ZAG'], ovr: 80 },
    ]},
  { id: 'flamengo2020', club: 'Flamengo', year: 2020, label: 'Flamengo 2020 (Bicampeonato)', coach: 'Rogerio Ceni',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Diego Alves', pos: ['GOL'], ovr: 86 },
      { name: 'Rafinha', pos: ['LD'], ovr: 84 },
      { name: 'Rodrigo Caio', pos: ['ZAG'], ovr: 87 },
      { name: 'Leo Pereira', pos: ['ZAG'], ovr: 84 },
      { name: 'Filipe Luis', pos: ['LE'], ovr: 89 },
      { name: 'Willian Arao', pos: ['VOL','MC'], ovr: 88 },
      { name: 'Gerson', pos: ['MEI','VOL'], ovr: 90 },
      { name: 'Everton Ribeiro', pos: ['MEI','MD'], ovr: 91 },
      { name: 'Arrascaeta', pos: ['MEI','MC'], ovr: 91 },
      { name: 'Bruno Henrique', pos: ['PE','ME'], ovr: 89 },
      { name: 'Gabigol', pos: ['ATA'], ovr: 96 },
      { name: 'Pedro', pos: ['ATA'], ovr: 90 },
      { name: 'Thiago Maia', pos: ['VOL','MC'], ovr: 84 },
      { name: 'Michael', pos: ['ATA','MD'], ovr: 83 },
      { name: 'Rodinei', pos: ['LD'], ovr: 82 },
      { name: 'Diego', pos: ['MEI','MC'], ovr: 82 },
      { name: 'Vitinho', pos: ['PD','MD'], ovr: 81 },
      { name: 'Hugo Souza', pos: ['GOL'], ovr: 76 },
      { name: 'Rene', pos: ['LE','MC'], ovr: 82 },
      { name: 'Leo Ortiz', pos: ['ZAG'], ovr: 80 },
    ]},
  { id: 'atletico-mg2021', club: 'Atletico-MG', year: 2021, label: 'Atletico-MG 2021 (Brasileiro + Copa do Brasil)', coach: 'Cuca',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Everson', pos: ['GOL'], ovr: 88 },
      { name: 'Mariano', pos: ['LD','VOL'], ovr: 78 },
      { name: 'Rever', pos: ['ZAG','VOL'], ovr: 82 },
      { name: 'Junior Alonso', pos: ['ZAG','LE'], ovr: 83 },
      { name: 'Guilherme Arana', pos: ['LE','ME'], ovr: 88 },
      { name: 'Allan', pos: ['VOL','MC'], ovr: 86 },
      { name: 'Jair', pos: ['VOL','MC'], ovr: 83 },
      { name: 'Matias Zaracho', pos: ['MC','MD'], ovr: 87 },
      { name: 'Nacho Fernandez', pos: ['MEI','MC'], ovr: 90 },
      { name: 'Jefferson Savarino', pos: ['PD','MD'], ovr: 84 },
      { name: 'Hulk', pos: ['ATA','PD'], ovr: 94 },
      { name: 'Guga', pos: ['LD','LE'], ovr: 80 },
      { name: 'Dodo', pos: ['LE','ME'], ovr: 79 },
      { name: 'Tche Tche', pos: ['VOL','MC'], ovr: 78 },
      { name: 'Hyoran', pos: ['MEI','ME'], ovr: 79 },
      { name: 'Savio', pos: ['PD','PE'], ovr: 76 },
      { name: 'Keno', pos: ['PE','PD'], ovr: 85 },
      { name: 'Eduardo Vargas', pos: ['PE','ATA'], ovr: 84 },
      { name: 'Diego Costa', pos: ['ATA'], ovr: 77 },
      { name: 'Eduardo Sasha', pos: ['ATA','MEI'], ovr: 82 },
    ]},
  { id: 'palmeiras2022', club: 'Palmeiras', year: 2022, label: 'Palmeiras 2022 (81 pontos RECORDE historico)', coach: 'Abel Ferreira',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Weverton', pos: ['GOL'], ovr: 92 },
      { name: 'Marcos Rocha', pos: ['LD'], ovr: 84 },
      { name: 'Gustavo Gomez', pos: ['ZAG'], ovr: 90 },
      { name: 'Murilo', pos: ['ZAG'], ovr: 87 },
      { name: 'Piquerez', pos: ['LE'], ovr: 89 },
      { name: 'Danilo', pos: ['VOL','MC'], ovr: 88 },
      { name: 'Ze Rafael', pos: ['VOL','MC'], ovr: 86 },
      { name: 'Atuesta', pos: ['VOL','MC'], ovr: 81 },
      { name: 'Raphael Veiga', pos: ['MEI','MC'], ovr: 90 },
      { name: 'Dudu', pos: ['PD','MD'], ovr: 88 },
      { name: 'Flaco Lopez', pos: ['ATA'], ovr: 86 },
      { name: 'Rony', pos: ['PE','ME'], ovr: 85 },
      { name: 'Endrick', pos: ['ATA'], ovr: 91 },
      { name: 'Mayke', pos: ['LD'], ovr: 81 },
      { name: 'Gabriel Menino', pos: ['VOL','MC'], ovr: 82 },
      { name: 'Luan', pos: ['ZAG'], ovr: 80 },
      { name: 'Vanderlan', pos: ['LE'], ovr: 78 },
      { name: 'Pedro Geromel', pos: ['ZAG'], ovr: 79 },
      { name: 'Jose Manuel Lopez', pos: ['ATA'], ovr: 75 },
      { name: 'Jhon Jhon', pos: ['MEI','MC'], ovr: 79 },
    ]},
  { id: 'athletico-pr2022', club: 'Athletico-PR', year: 2022, label: 'Athletico-PR 2022 (Finalista Libertadores)', coach: 'Luiz Felipe Scolari',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Bento', pos: ['GOL'], ovr: 87 },
      { name: 'Orejuela', pos: ['LD'], ovr: 80 },
      { name: 'Pedro Henrique', pos: ['ZAG'], ovr: 83 },
      { name: 'Thiago Heleno', pos: ['ZAG'], ovr: 82 },
      { name: 'Abner', pos: ['LE'], ovr: 83 },
      { name: 'Christian', pos: ['VOL','MC'], ovr: 84 },
      { name: 'Matheus Fernandes', pos: ['VOL','MC'], ovr: 83 },
      { name: 'Erick', pos: ['VOL','MC'], ovr: 82 },
      { name: 'Fernandinho', pos: ['VOL','MC','MEI'], ovr: 90 },
      { name: 'David Terans', pos: ['MEI','MC'], ovr: 86 },
      { name: 'Canobbio', pos: ['PD','MD'], ovr: 84 },
      { name: 'Romulo', pos: ['ATA'], ovr: 83 },
      { name: 'Pablo', pos: ['ATA'], ovr: 82 },
      { name: 'Vitor Roque', pos: ['ATA'], ovr: 87 },
      { name: 'Vitinho', pos: ['PD'], ovr: 82 },
      { name: 'Ze Ivaldo', pos: ['ZAG'], ovr: 82 },
      { name: 'Anderson', pos: ['GOL'], ovr: 79 },
      { name: 'Matheus Felipe', pos: ['ZAG'], ovr: 81 },
      { name: 'Pedrinho', pos: ['LE','MC'], ovr: 81 },
      { name: 'Khellven', pos: ['LD'], ovr: 79 },
    ]},
  { id: 'palmeiras2023', club: 'Palmeiras', year: 2023, label: 'Palmeiras 2023 (Tricampeonato com Abel)', coach: 'Abel Ferreira',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Weverton', pos: ['GOL'], ovr: 90 },
      { name: 'Marcos Rocha', pos: ['LD','ZAG'], ovr: 83 },
      { name: 'Gustavo Gómez', pos: ['ZAG'], ovr: 91 },
      { name: 'Murilo', pos: ['ZAG'], ovr: 86 },
      { name: 'Joaquín Piquerez', pos: ['LE','ME','ZAG'], ovr: 88 },
      { name: 'Zé Rafael', pos: ['VOL','MC'], ovr: 87 },
      { name: 'Richard Ríos', pos: ['VOL','MC'], ovr: 82 },
      { name: 'Gabriel Menino', pos: ['VOL','MC','LD'], ovr: 82 },
      { name: 'Raphael Veiga', pos: ['MEI','MC','MD'], ovr: 91 },
      { name: 'Dudu', pos: ['PE','PD','MEI'], ovr: 88 },
      { name: 'Endrick', pos: ['ATA'], ovr: 90 },
      { name: 'Marcelo Lomba', pos: ['GOL'], ovr: 79 },
      { name: 'Mayke', pos: ['LD','MD','PD'], ovr: 86 },
      { name: 'Vanderlan', pos: ['LE','ME'], ovr: 79 },
      { name: 'Luan', pos: ['ZAG','VOL'], ovr: 83 },
      { name: 'Fabinho', pos: ['VOL'], ovr: 76 },
      { name: 'Luis Guilherme', pos: ['MEI','PD'], ovr: 77 },
      { name: 'Artur', pos: ['PD','PE','ATA'], ovr: 84 },
      { name: 'Breno Lopes', pos: ['PE','PD'], ovr: 81 },
      { name: 'Rony', pos: ['ATA','PD','PE'], ovr: 84 },
    ]},
  { id: 'botafogo2024', club: 'Botafogo', year: 2024, label: 'Botafogo 2024 (Brasileirao + Libertadores)', coach: 'Artur Jorge',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'John', pos: ['GOL'], ovr: 83 },
      { name: 'Vitinho', pos: ['LD'], ovr: 79 },
      { name: 'Alexander Barboza', pos: ['ZAG'], ovr: 82 },
      { name: 'Bastos', pos: ['ZAG'], ovr: 81 },
      { name: 'Cuiabano', pos: ['LE'], ovr: 80 },
      { name: 'Marlon Freitas', pos: ['MC','VOL'], ovr: 82 },
      { name: 'Gregore', pos: ['VOL','MC'], ovr: 81 },
      { name: 'Thiago Almada', pos: ['MEI','ME'], ovr: 85 },
      { name: 'Igor Jesus', pos: ['ATA'], ovr: 87 },
      { name: 'Jefferson Savarino', pos: ['PE','ME'], ovr: 81 },
      { name: 'Luiz Henrique', pos: ['PD','MD'], ovr: 86 },
      { name: 'Gatito Fernandez', pos: ['GOL'], ovr: 76 },
      { name: 'Adryelson', pos: ['ZAG'], ovr: 78 },
      { name: 'Tiquinho Soares', pos: ['ATA'], ovr: 79 },
      { name: 'Danilo Barbosa', pos: ['VOL','MC'], ovr: 78 },
      { name: 'Tche Tche', pos: ['MC','VOL'], ovr: 78 },
      { name: 'Marcal', pos: ['LE'], ovr: 76 },
      { name: 'Mateo Ponte', pos: ['LD'], ovr: 77 },
      { name: 'Junior Santos', pos: ['PD','ATA'], ovr: 76 },
      { name: 'Carlos Alberto', pos: ['PE','MC'], ovr: 74 },
    ]},
  { id: 'santos2015', club: 'Santos', year: 2015, label: 'Santos 2015 (Paulistao + Vice Copa BR)', coach: 'Dorival Junior',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Vanderlei', pos: ['GOL'], ovr: 88 },
      { name: 'Victor Ferraz', pos: ['LD','MD','LE'], ovr: 84 },
      { name: 'David Braz', pos: ['ZAG'], ovr: 83 },
      { name: 'Gustavo Henrique', pos: ['ZAG'], ovr: 82 },
      { name: 'Zeca', pos: ['LE','LD','ME'], ovr: 83 },
      { name: 'Renato', pos: ['VOL','MC'], ovr: 86 },
      { name: 'Thiago Maia', pos: ['VOL'], ovr: 84 },
      { name: 'Lucas Lima', pos: ['MEI','MC'], ovr: 91 },
      { name: 'Marquinhos Gabriel', pos: ['MEI','PD','PE'], ovr: 84 },
      { name: 'Ricardo Oliveira', pos: ['ATA'], ovr: 92 },
      { name: 'Gabigol', pos: ['PD','ATA'], ovr: 89 },
      { name: 'Vladimir', pos: ['GOL'], ovr: 81 },
      { name: 'Daniel Guedes', pos: ['LD'], ovr: 77 },
      { name: 'Chiquinho', pos: ['LE','ME'], ovr: 77 },
      { name: 'Werley', pos: ['ZAG'], ovr: 79 },
      { name: 'Valencia', pos: ['VOL'], ovr: 78 },
      { name: 'Geuvânio', pos: ['PD','PE'], ovr: 83 },
      { name: 'Robinho', pos: ['PE','MEI','ATA'], ovr: 88 },
      { name: 'Leandro Damião', pos: ['ATA'], ovr: 80 },
      { name: 'Nilson', pos: ['ATA'], ovr: 74 },
    ]},
  { id: 'santos2020', club: 'Santos', year: 2020, label: 'Santos 2020 (Vice-Campeao da Libertadores)', coach: 'Cuca',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'John', pos: ['GOL'], ovr: 82 },
      { name: 'Pará', pos: ['LD','LE','VOL'], ovr: 78 },
      { name: 'Lucas Veríssimo', pos: ['ZAG'], ovr: 86 },
      { name: 'Luan Peres', pos: ['ZAG','LE'], ovr: 83 },
      { name: 'Felipe Jonatan', pos: ['LE','ME','MC'], ovr: 79 },
      { name: 'Alison', pos: ['VOL'], ovr: 80 },
      { name: 'Sandry', pos: ['VOL','MC'], ovr: 79 },
      { name: 'Diego Pituca', pos: ['VOL','MC','LE'], ovr: 84 },
      { name: 'Marinho', pos: ['PD','ATA'], ovr: 90 },
      { name: 'Soteldo', pos: ['PE','MEI','PD'], ovr: 88 },
      { name: 'Kaio Jorge', pos: ['ATA'], ovr: 83 },
      { name: 'João Paulo', pos: ['GOL'], ovr: 81 },
      { name: 'Laércio', pos: ['ZAG'], ovr: 75 },
      { name: 'Madson', pos: ['LD','MD'], ovr: 79 },
      { name: 'Luiz Felipe', pos: ['ZAG'], ovr: 77 },
      { name: 'Jobson', pos: ['VOL','MC'], ovr: 76 },
      { name: 'Jean Mota', pos: ['MC','MEI','LE'], ovr: 76 },
      { name: 'Lucas Lourenço', pos: ['MEI'], ovr: 73 },
      { name: 'Arthur Gomes', pos: ['PE','PD','LE'], ovr: 76 },
      { name: 'Lucas Braga', pos: ['PE','PD'], ovr: 81 },
    ]},
  { id: 'botafogo2023', club: 'Botafogo', year: 2023, label: 'Botafogo 2023 (Deixou escapar)', coach: 'Luis Castro',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Lucas Perri', pos: ['GOL'], ovr: 85 },
      { name: 'Di Plácido', pos: ['LD'], ovr: 81 },
      { name: 'Adryelson', pos: ['ZAG'], ovr: 83 },
      { name: 'Victor Cuesta', pos: ['ZAG'], ovr: 82 },
      { name: 'Marcal', pos: ['LE'], ovr: 80 },
      { name: 'Eduardo', pos: ['MEI','VOL'], ovr: 83 },
      { name: 'Marlon Freitas', pos: ['VOL'], ovr: 84 },
      { name: 'Tche Tche', pos: ['MEI','VOL'], ovr: 83 },
      { name: 'Gustavo Sauer', pos: ['PD'], ovr: 83 },
      { name: 'Tiquinho Soares', pos: ['ATA'], ovr: 89 },
      { name: 'Jeffinho', pos: ['PE','ATA'], ovr: 84 },
      { name: 'Diego Hernandez', pos: ['MEI'], ovr: 80 },
      { name: 'Hugo', pos: ['LE'], ovr: 78 },
      { name: 'Rafael', pos: ['LD'], ovr: 79 },
      { name: 'Kayque', pos: ['VOL'], ovr: 80 },
      { name: 'Júnior Santos', pos: ['PD','ATA'], ovr: 83 },
      { name: 'Diego Costa', pos: ['ATA'], ovr: 79 },
      { name: 'Patrick de Paula', pos: ['VOL'], ovr: 82 },
      { name: 'Victor Sa', pos: ['ATA'], ovr: 82 },
      { name: 'Gatito Fernández', pos: ['GOL'], ovr: 82 },
    ]},
];











































// ============================================================
// FORMAÇÕES TÁTICAS
// ============================================================
const FORMATIONS = {
  // ==========================================
  // LINHA DE 4 ZAGUEIROS
  // ==========================================

  // --- Variações do 4-3-3 ---
  '4-3-3-ofensivo': {
    label: '4-3-3 Ofensivo (1 VOL, 2 MEI)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MEI: 2, PD: 1, PE: 1, ATA: 1 }
  },
  '4-3-3-misto': {
    label: '4-3-3 Misto (1 VOL, 1 MC, 1 MEI)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 1, MEI: 1, PD: 1, PE: 1, ATA: 1 }
  },
  '4-3-3-defensivo': {
    label: '4-3-3 Contenção (2 VOL, 1 MC)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 2, MC: 1, PD: 1, PE: 1, ATA: 1 }
  },

  // --- Variações do 4-4-2 ---
  '4-4-2-linha': {
    label: '4-4-2 Tradicional em Linha',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 2, MD: 1, ME: 1, ATA: 2 }
  },
  '4-4-2-losango-misto': {
    label: '4-4-2 Losango (1 VOL, 2 MC, 1 MEI)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 2, MEI: 1, ATA: 2 }
  },
  '4-4-2-quadrado': {
    label: '4-2-2-2 (2 VOL, 2 MEI)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 2, MEI: 2, ATA: 2 }
  },

  // --- Variações do 4-2-3-1 ---
  '4-2-3-1-classico': {
    label: '4-2-3-1 Defensivo (2 VOL, 1 MC, 1 MD, 1 ME)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 2, MC: 1, MD: 1, ME: 1, ATA: 1 }
  },
  '4-2-3-1-ofensivo': {
    label: '4-2-3-1 Ofensivo (1 VOL, 1 MC, 1 MEI, 2 PONTA)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 1, MEI: 1, PD: 1, PE: 1, ATA: 1 }
  },

  // --- Variações do 4-1-4-1 e 4-5-1 ---
  '4-1-4-1-ofensivo': {
    label: '4-1-4-1 Ofensivo (1 VOL, 2 MC, 1 MD, 1 ME)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 2, MD: 1, ME: 1, ATA: 1 }
  },
  '4-1-4-1-linha': {
    label: '4-1-4-1 Técnico (1 VOL, 2 MEI, 1 MD, 1 ME)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MD: 1, MEI: 2, ME: 1, ATA: 1 }
  },
  '4-5-1-retranca': {
    label: '4-5-1 Bloqueio (1 VOL, 2 MC, 1 MD, 1 ME)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 2, MD: 1, ME: 1, ATA: 1 }
  },

  // --- Variações do 4-3-1-2 e 4-1-3-2 ---
  '4-3-1-2-misto': {
    label: '4-3-1-2 Italiano (1 VOL, 2 MC, 1 MEI)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MC: 2, MEI: 1, ATA: 2 }
  },
  '4-1-3-2-ofensivo': {
    label: '4-1-3-2 Pressão (1 VOL, 1 MD, 1 MEI, 1 ME)',
    counts: { GOL: 1, LD: 1, ZAG: 2, LE: 1, VOL: 1, MD: 1, MEI: 1, ME: 1, ATA: 2 }
  },


  // ==========================================
  // LINHA DE 3 ZAGUEIROS
  // ==========================================

  // --- Variações do 3-5-2 ---
  '3-5-2-equilibrio': {
    label: '3-5-2 (1 VOL, 1 MC, 1 MEI)',
    counts: { GOL: 1, LD: 1, ZAG: 3, LE: 1, VOL: 1, MC: 1, MEI: 1, ATA: 2 }
  },
  '3-5-2-pesado': {
    label: '3-5-2 Pesado (2 VOL, 1 MEI)',
    counts: { GOL: 1, LD: 1, ZAG: 3, LE: 1, VOL: 2, MEI: 1, ATA: 2 }
  },

  // --- Variação do 3-4-3 (sem alas — 3 zagueiros puros, 4 no meio, 3 na frente) ---
  '3-4-3-misto': {
    label: '3-4-3 (1 VOL, 1 MC, 1 MD, 1 ME)',
    counts: { GOL: 1, ZAG: 3, VOL: 1, MC: 1, MD: 1, ME: 1, PD: 1, PE: 1, ATA: 1 }
  },

  // --- Outros esquemas com 3 Zagueiros (sem alas) ---
  '3-4-2-1-moderno': {
    label: '3-4-2-1 (1 VOL, 1 MC, 1 MD, 1 ME, 2 MEI)',
    counts: { GOL: 1, ZAG: 3, VOL: 1, MC: 1, MD: 1, ME: 1, MEI: 2, ATA: 1 }
  },
  '3-2-4-1-ofensivo': {
    label: '3-2-4-1 (1 VOL, 1 MC, 2 MEI)',
    counts: { GOL: 1, ZAG: 3, VOL: 1, MC: 1, MEI: 2, PD: 1, PE: 1, ATA: 1 }
  },


  // ==========================================
  // LINHA DE 5 ZAGUEIROS (RETRANCA)
  // ==========================================

  '5-3-2-muralha': {
    label: '5-3-2 Retranca Total (1 VOL, 2 MC)',
    counts: { GOL: 1, LD: 1, ZAG: 3, LE: 1, VOL: 1, MC: 2, ATA: 2 }
  },
  '5-4-1-misto': {
    label: '5-4-1 Equilibrado (1 VOL, 1 MC, 1 MD, 1 ME)',
    counts: { GOL: 1, LD: 1, ZAG: 3, LE: 1, VOL: 1, MC: 1, MD: 1, ME: 1, ATA: 1 }
  },
  '5-2-3-contra-ataque': {
    label: '5-2-3 Contra-Ataque (1 VOL, 1 MC)',
    counts: { GOL: 1, LD: 1, ZAG: 3, LE: 1, VOL: 1, MC: 1, PD: 1, PE: 1, ATA: 1 }
  }
};


const BASE_COORDS = {
  GOL: { x: 50, y: 92 },
  LD: { x: 86, y: 76 },
  ZAG: { x: 50, y: 80 },
  LE: { x: 14, y: 76 },
  VOL: { x: 50, y: 62 },
  MC: { x: 50, y: 54 },  // Meio-Campo (central midfielder, between VOL and MEI)
  MEI: { x: 50, y: 46 },
  MD: { x: 80, y: 48 },  // Meia Direita (wide midfielder right)
  ME: { x: 20, y: 48 },  // Meia Esquerda (wide midfielder left)
  PD: { x: 82, y: 22 },  // Ponta Direita (right winger, more attacking)
  PE: { x: 18, y: 22 },  // Ponta Esquerda (left winger, more attacking)
  ATA: { x: 50, y: 11 },
};

function buildPitchSlots(formationKey) {
  const { counts } = FORMATIONS[formationKey];

  // VOL e MC, quando os dois têm qty 1, ficam lado a lado na mesma linha (em
  // vez de um atrás do outro) — só a função muda, não a altura no campo.
  // MD/ME sempre entram na linha do MC quando ele existe (formando MD-MC-ME);
  // sem MC, entram na linha do MEI (MD-MEI-ME); sem os dois, ficam com o VOL
  // (formando o "4" plano de um 4-4-2 tradicional, por exemplo).
  const mergeVolMc = counts.VOL === 1 && counts.MC === 1;
  const hasMC = !!counts.MC;
  const hasMEI = !!counts.MEI;
  const hasWide = !!counts.MD || !!counts.ME;
  const wideJoinsMei = !hasMC && hasMEI && hasWide;
  // Sem MC nem MEI, MD/ME entram na linha do VOL (ex: 4-4-2 em linha) — e
  // como MD/ME ficam bem abertos (mesmo x de LD/LE), essa linha precisa de
  // mais distância vertical da zaga, senão os círculos se tocam/cruzam.
  const volJoinsWide = !hasMC && !hasMEI && hasWide;

  // Linhas mais espaçadas verticalmente — os círculos do campo de draft têm
  // 44px, então uma diferença pequena de y (como 54 pra 62) fica quase
  // encostando um no outro. Aqui dá mais respiro entre VOL / MC / MEI.
  const mcRowY = mergeVolMc ? 58 : 52;
  const volRowY = mergeVolMc ? 58 : volJoinsWide ? 52 : 68;
  const meiRowY = 36;
  const wideRowY = hasMC ? mcRowY : hasMEI ? meiRowY : volRowY;

  const ROW_ORDER = { ME: 0, VOL: 1, MC: 2, MEI: 2, MD: 3 };
  const rows = new Map(); // y -> [{ pos, order }]
  const pushToRow = (pos, qty, y, order) => {
    if (!qty) return;
    if (!rows.has(y)) rows.set(y, []);
    const arr = rows.get(y);
    for (let i = 0; i < qty; i++) arr.push({ pos, order });
  };
  pushToRow('VOL', mergeVolMc ? 1 : counts.VOL, volRowY, ROW_ORDER.VOL);
  pushToRow('MC', mergeVolMc ? 1 : counts.MC, mcRowY, ROW_ORDER.MC);
  pushToRow('MD', counts.MD, wideRowY, ROW_ORDER.MD);
  pushToRow('ME', counts.ME, wideRowY, ROW_ORDER.ME);
  if (wideJoinsMei) pushToRow('MEI', counts.MEI, wideRowY, ROW_ORDER.MEI);

  const groupedPos = new Set(['VOL', 'MC', 'MD', 'ME']);
  if (wideJoinsMei) groupedPos.add('MEI');

  const slots = [];
  Object.entries(counts).forEach(([pos, qty]) => {
    if (groupedPos.has(pos)) return; // tratado abaixo via `rows`
    const base = BASE_COORDS[pos];
    // MEI sozinho (sem se juntar à linha do MD/ME) usava o y antigo de
    // BASE_COORDS (46), que fica colado na linha do MC (52) — quase
    // encostando/cruzando visualmente. Usa a linha própria do MEI (36).
    const y = pos === 'MEI' ? meiRowY : base.y;
    for (let i = 0; i < qty; i++) {
      const key = qty === 1 ? pos : `${pos}${i + 1}`;
      let x = base.x;
      if (qty > 1) {
        const spread = qty === 2 ? 16 : qty === 3 ? 22 : 12;
        const offset = (i - (qty - 1) / 2) * (spread * 2 / Math.max(qty - 1, 1));
        x = Math.max(8, Math.min(92, base.x + offset));
      }
      slots.push({ key, label: pos, realPos: pos, x, y });
    }
  });

  const counters = {};
  for (const [y, items] of rows.entries()) {
    items.sort((a, b) => a.order - b.order);
    const n = items.length;
    // Espalha mais largo que o normal (usado pra multiplicar 1 posição só,
    // como 2 ATA) porque aqui são posições DIFERENTES lado a lado — precisa
    // de mais distância pros círculos de 44px não ficarem colados.
    const spread = n <= 1 ? 0 : n === 2 ? 18 : n === 3 ? 26 : 36;
    items.forEach((item, i) => {
      const offset = n <= 1 ? 0 : (i - (n - 1) / 2) * (spread * 2 / Math.max(n - 1, 1));
      const x = Math.max(8, Math.min(92, 50 + offset));
      counters[item.pos] = (counters[item.pos] ?? 0) + 1;
      const key = counts[item.pos] === 1 ? item.pos : `${item.pos}${counters[item.pos]}`;
      slots.push({ key, label: item.pos, realPos: item.pos, x, y });
    });
  }

  // 4-2-2-2: os MEIs ficam mais avançados e abertos, os volantes mais fechados
  // e recuados — não sobrepõem, mas também não ficam achatados numa linha só.
  if (formationKey === '4-4-2-quadrado') {
    slots.forEach(s => {
      if (s.realPos === 'MEI') { s.y = 38; s.x = s.x < 50 ? 28 : 72; }
      if (s.realPos === 'VOL') { s.x = s.x < 50 ? 42 : 58; }
    });
  }

  return slots;
}

function shuffle2(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Código de sala: 6 caracteres, letras maiúsculas e números sempre mesclados
// (garante pelo menos 1 letra e 1 número, não só um pedaço aleatório de um UUID).
const ROOM_CODE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ROOM_CODE_DIGITS = '0123456789';
function generateRoomCode() {
  const pool = ROOM_CODE_LETTERS + ROOM_CODE_DIGITS;
  let code;
  do {
    code = Array.from({ length: 6 }, () => pool[Math.floor(Math.random() * pool.length)]).join('');
  } while (!/[A-Z]/.test(code) || !/[0-9]/.test(code));
  return code;
}

// ============================================================
// MOTOR DE SIMULAÇÃO
// ============================================================
function teamStrength(xi) {
  const vals = Object.values(xi).filter(p => !p.isBench);
  if (vals.length === 0) return 50;
  const baseOvr = vals.reduce((s, p) => s + p.ovr, 0) / vals.length;
  return Math.round(baseOvr * 10) / 10;
}

// Simulação de disputa de pênaltis (5 cobranças + morte súbita)
function simulatePenalties(teamAId, teamBId, leagueTeams, rand = Math.random) {
  const teamA = leagueTeams.find(t => t.id === teamAId);
  const teamB = leagueTeams.find(t => t.id === teamBId);
  const ovA = teamA ? teamA.ovr : 70;
  const ovB = teamB ? teamB.ovr : 70;
  // OVR-based penalty hit rate: 50-85%
  const rateA = Math.min(0.85, Math.max(0.5, 0.65 + (ovA - 70) * 0.005));
  const rateB = Math.min(0.85, Math.max(0.5, 0.65 + (ovB - 70) * 0.005));
  let goalsA = 0, goalsB = 0;
  const kicks = [];
  for (let i = 0; i < 5; i++) {
    const a = rand() < rateA;
    const b = rand() < rateB;
    if (a) goalsA++;
    if (b) goalsB++;
    kicks.push({ a, b, goalsA, goalsB });
    // Early termination: one team can't catch up
    const remaining = 4 - i;
    if (goalsA - goalsB > remaining + 1 || goalsB - goalsA > remaining + 1) break;
  }
  // Sudden death if still tied
  let sdGuard = 0;
  while (goalsA === goalsB && sdGuard++ < 50) {
    const a = rand() < rateA;
    const b = rand() < rateB;
    if (a) goalsA++;
    if (b) goalsB++;
    kicks.push({ a, b, goalsA, goalsB, suddenDeath: true });
    if (goalsA !== goalsB) break;
  }
  return { winner: goalsA > goalsB ? teamAId : teamBId, goalsA, goalsB, kicks };
}

function poissonSample(lambda, rand = Math.random) {
  let L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

// ============================================================
// LIGA: round-robin + geração de eventos de partida
// ============================================================
const MY_TEAM_ID = '__myteam__';

function narrateGoal(scorer, isMyGoal, onEnd) {
  if (!('speechSynthesis' in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance();
  u.lang = 'pt-BR';
  if (isMyGoal) {
    u.text = `Goooooool! ${scorer}!`;
    u.pitch = 1.55;
    u.rate = 0.65;
    u.volume = 1;
  } else {
    u.text = `Gol! ${scorer}.`;
    u.pitch = 0.85;
    u.rate = 0.85;
    u.volume = 0.75;
  }
  if (onEnd) {
    let done = false;
    const finish = () => { if (done) return; done = true; onEnd(); };
    u.onend = finish;
    u.onerror = finish;
    // Rede de seguranca: alguns navegadores nao disparam onend de forma confiavel.
    setTimeout(finish, 4500);
  }
  window.speechSynthesis.speak(u);
}

// Gera calendário round-robin (todos contra todos, turno único)
function generateRoundRobin(teamIds) {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push(null);
  const n = teams.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) {
      const h = teams[i];
      const a = teams[n - 1 - i];
      if (h && a) round.push({ homeId: h, awayId: a });
    }
    rounds.push(round);
    const last = teams.pop();
    teams.splice(1, 0, last);
  }
  return rounds;
}

// Brasileirão: turno + returno (38 rodadas para 20 times)
function generateDoubleRoundRobin(teamIds) {
  const first = generateRoundRobin(teamIds);
  const second = first.map(round => round.map(m => ({ homeId: m.awayId, awayId: m.homeId })));
  return [...first, ...second];
}

// Copa do Brasil — tabela de eliminatórias
const CUP_ROUND_NAMES = ['16 Avos de Final', 'Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Final'];

function generateCupFirstRound(teamIds) {
  const shuffled = shuffle2([...teamIds]);
  const matches = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2)
    matches.push({ homeId: shuffled[i], awayId: shuffled[i + 1] });
  return matches;
}

function pickGoalScorer(players, rand = Math.random) {
  const field = players.filter(p => !p.pos.includes('GOL'));
  const pool = field.length > 0 ? field : players;
  return pool[Math.floor(rand() * pool.length)].name;
}

const OWN_GOAL_CHANCE = 0.045;
const ASSIST_CHANCE = 0.72;

function pickAssister(players, scorerName, rand = Math.random) {
  const pool = players.filter(p => !p.pos.includes('GOL') && p.name !== scorerName);
  if (pool.length === 0) return null;
  return pool[Math.floor(rand() * pool.length)].name;
}

// Gera lista de eventos de gol para uma partida com minutos únicos
function generateMatchGoals(homeTeam, awayTeam, rand = Math.random) {
  const diff = homeTeam.ovr - awayTeam.ovr;
  const homeExp = Math.max(0.2, 1.3 + diff * 0.042);
  const awayExp = Math.max(0.2, 1.3 - diff * 0.042);
  const homeGoals = poissonSample(homeExp, rand);
  const awayGoals = poissonSample(awayExp, rand);

  const usedMin = new Set();
  const randMin = () => {
    let m;
    do { m = Math.floor(rand() * 90) + 1; } while (usedMin.has(m));
    usedMin.add(m);
    return m;
  };

  const makeGoalEvent = (scoringTeam, concedingTeam) => {
    const isOwnGoal = rand() < OWN_GOAL_CHANCE;
    const scorer = isOwnGoal ? pickGoalScorer(concedingTeam.players, rand) : pickGoalScorer(scoringTeam.players, rand);
    const hasAssist = !isOwnGoal && rand() < ASSIST_CHANCE;
    return {
      minute: randMin(),
      teamId: scoringTeam.id,
      teamLabel: scoringTeam.label,
      scorer,
      isOwnGoal,
      ownGoalTeamLabel: isOwnGoal ? concedingTeam.label : undefined,
      assist: hasAssist ? pickAssister(scoringTeam.players, scorer, rand) : null,
    };
  };

  const events = [];
  for (let i = 0; i < homeGoals; i++)
    events.push(makeGoalEvent(homeTeam, awayTeam));
  for (let i = 0; i < awayGoals; i++)
    events.push(makeGoalEvent(awayTeam, homeTeam));

  return events.sort((a, b) => a.minute - b.minute);
}

function simAiMatch(homeTeam, awayTeam, rand = Math.random) {
  const diff = homeTeam.ovr - awayTeam.ovr;
  return {
    homeGoals: poissonSample(Math.max(0.2, 1.3 + diff * 0.042), rand),
    awayGoals: poissonSample(Math.max(0.2, 1.3 - diff * 0.042), rand),
  };
}

// Compatibilidade entre slot do campinho e posições do jogador.
// MD aceita jogadores com PD, MEI ou MD. ME aceita PE, MEI ou ME.
// VOL aceita VOL ou MEI. Sem mapeamento = exige a posição exata.
const POS_COMPAT = {
  GOL: ['GOL'],
  LD: ['LD', 'ZAG'],
  LE: ['LE', 'ZAG'],
  ZAG: ['ZAG', 'LD', 'LE'],
  VOL: ['VOL', 'MEI', 'MC'],
  MEI: ['MEI', 'VOL', 'MC', 'MD', 'ME'],
  MC: ['MC', 'MEI', 'VOL', 'MD', 'ME'],
  MD: ['MD', 'PD', 'MEI', 'MC'],
  ME: ['ME', 'PE', 'MEI', 'MC'],
  PD: ['PD', 'MD', 'ATA', 'MEI'],
  PE: ['PE', 'ME', 'ATA', 'MEI'],
  ATA: ['ATA', 'PD', 'PE'],
};

// Logos via TheSportsDB (r2.thesportsdb.com — free, sem autenticação)
const CLUB_LOGOS = {
  // Times no jogo (66 equipes históricas)
  'Santos': 'https://r2.thesportsdb.com/images/media/team/badge/j8xk9g1679447486.png',
  'Botafogo': 'https://r2.thesportsdb.com/images/media/team/badge/bs5mbw1733004596.png',
  'Palmeiras': 'https://r2.thesportsdb.com/images/media/team/badge/vsqwqp1473538105.png',
  'Internacional': 'https://r2.thesportsdb.com/images/media/team/badge/yprvxx1473538097.png',
  'Fluminense': 'https://r2.thesportsdb.com/images/media/team/badge/stvvwp1473538082.png',
  'Coritiba': 'https://r2.thesportsdb.com/images/media/team/badge/ywwsyu1473538050.png',
  'Sao Paulo': 'https://r2.thesportsdb.com/images/media/team/badge/sxpupx1473538135.png',
  'Sport': 'https://r2.thesportsdb.com/images/media/team/badge/tyrbls1545421563.png',
  'Bahia': 'https://r2.thesportsdb.com/images/media/team/badge/xuvtsv1473539308.png',
  'Vasco': 'https://r2.thesportsdb.com/images/media/team/badge/ynqlxo1630521109.png',
  'Corinthians': 'https://r2.thesportsdb.com/images/media/team/badge/vvuvps1473538042.png',
  'Gremio': 'https://r2.thesportsdb.com/images/media/team/badge/uvpwyt1473538089.png',
  'Athletico-PR': 'https://r2.thesportsdb.com/images/media/team/badge/irzu1u1554237406.png',
  'Cruzeiro': 'https://r2.thesportsdb.com/images/media/team/badge/upsvvu1473538059.png',
  'Flamengo': 'https://r2.thesportsdb.com/images/media/team/badge/syptwx1473538074.png',
  'Atletico-MG': 'https://r2.thesportsdb.com/images/media/team/badge/x5lixs1743742872.png',
  'Guarani': 'https://r2.thesportsdb.com/images/media/team/badge/tpipb21766508536.png',
  // Times extras (não no jogo mas disponíveis como emblema pessoal)
  'Fortaleza': 'https://r2.thesportsdb.com/images/media/team/badge/tosmdr1532853458.png',
  'Ceara': 'https://r2.thesportsdb.com/images/media/team/badge/rxxvyp1464886685.png',
  'America-MG': 'https://r2.thesportsdb.com/images/media/team/badge/rtpp171752177342.png',
  'Goias': 'https://r2.thesportsdb.com/images/media/team/badge/qhfhdp1635869930.png',
  'Vitoria': 'https://r2.thesportsdb.com/images/media/team/badge/tysrrx1473538156.png',
  'Bragantino': 'https://r2.thesportsdb.com/images/media/team/badge/2p7tl41701423595.png',
  'Criciuma': 'https://r2.thesportsdb.com/images/media/team/badge/r11mld1766506200.png',
  'Chapecoense': 'https://r2.thesportsdb.com/images/media/team/badge/wy0e1i1765900601.png',
  'Ponte Preta': 'https://r2.thesportsdb.com/images/media/team/badge/wbss4d1644929547.png',
  'Juventude': 'https://r2.thesportsdb.com/images/media/team/badge/1ntter1766506778.png',
  'Avai': 'https://r2.thesportsdb.com/images/media/team/badge/bblkat1766506007.png',
  'Atletico-GO': 'https://r2.thesportsdb.com/images/media/team/badge/l7382k1766505911.png',
};

// Áudios de gol reais por clube (public/gol/*.mp3). Botafogo tem 2 variantes
// que alternam aleatoriamente; clubes sem arquivo proprio ficam sem som.
const GOAL_AUDIO_FILES = {
  'Fluminense': ['/gol/Fluminense.mp3'],
  'Atletico-MG': ['/gol/Atletico-MG.mp3'],
  'Santos': ['/gol/Santos.mp3'],
  'Athletico-PR': ['/gol/Athletico-PR.mp3'],
  'Bahia': ['/gol/Bahia.mp3'],
  'Botafogo': ['/gol/Botafogo-1.mp3', '/gol/Botafogo-2.mp3'],
  'Corinthians': ['/gol/Corinthians.mp3'],
  'Coritiba': ['/gol/Coritiba.mp3'],
  'Cruzeiro': ['/gol/Cruzeiro.mp3'],
  'Gremio': ['/gol/Gremio.mp3'],
  'Guarani': ['/gol/Guarani.mp3'],
  'Internacional': ['/gol/Internacional.mp3'],
  'Palmeiras': ['/gol/Palmeiras.mp3'],
  'Sao Paulo': ['/gol/Sao-Paulo.mp3'],
  'Sport': ['/gol/Sport.mp3'],
  'Vasco': ['/gol/Vasco.mp3'],
};

function playGoalAudio(club, customUrl) {
  let src = customUrl;
  if (!src) {
    const files = GOAL_AUDIO_FILES[club];
    if (!files || files.length === 0) return;
    src = files[Math.floor(Math.random() * files.length)];
  }
  try {
    const audio = new Audio(src);
    audio.volume = 0.85;
    audio.play().catch(() => {});
  } catch { /* ignore */ }
}

// IDs YouTube dos hinos oficiais — tocam na tela de campeão
const CLUB_ANTHEMS = {
  'Santos': 'QXs6kGLVL_0',
  'Flamengo': 'pFvX3lHujn8',
  'Corinthians': 'g6M8oJq-dEA',
  'Palmeiras': 'n47Y8-xNDPo',
  'Internacional': 's6rT_BfQnuE',
  'Sao Paulo': 'pGD2BJeYjNA',
  'Vasco': 'Fsbka7RbOpw',
  'Gremio': 'cBmkH37USnA',
  'Cruzeiro': '901buxaTBtA',
  'Botafogo': 'itm2AQsH0pU',
  'Fluminense': 'MMxM5YePtsM',
  'Bahia': '960Fx8gcnIY',
  'Sport': 'PVcqbeerC8k',
  'Athletico-PR': 'kNd1BbWicMc',
  'Coritiba': 'NZki289dBz4',
  'Atletico-MG': 'dD4IPCN4o5I',
  'Guarani': 'b6KGAtvKhoQ',
};

function expandPlayerPositions(playerPos) {
  const result = new Set(playerPos);
  Object.entries(POS_COMPAT).forEach(([slotType, accepts]) => {
    if (playerPos.some(p => accepts.includes(p))) result.add(slotType);
  });
  return [...result];
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function needsDark(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

function shortName(name) {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 9);
  // Prefer last word unless it's a suffix like "Jr", "Filho" etc
  const suffixes = new Set(['jr', 'filho', 'neto', 'junior', 'jr.']);
  const last = parts[parts.length - 1];
  const word = suffixes.has(last.toLowerCase()) ? parts[parts.length - 2] || last : last;
  return word.length <= 9 ? word : word.slice(0, 8) + '.';
}

function ovrColor(ovr) {
  if (ovr >= 93) return '#FFD700';
  if (ovr >= 86) return '#d4a23c';
  if (ovr >= 78) return '#94a3b8';
  return '#64748b';
}

// ============================================================
// ESTADO
// ============================================================
const MAX_SKIPS = 3;

export default function App() {
  // ── LocalStorage restore ──────────────────────────────────
  const _sv = (() => {
    try { const s = localStorage.getItem('brl_save'); return s ? JSON.parse(s) : null; } catch { return null; }
  })();

  const [phase, setPhase] = useState(_sv?.phase && _sv.phase !== 'intro' ? _sv.phase : 'intro');
  const [formationKey, setFormationKey] = useState(_sv?.formationKey ?? null);
  const [pitchSlots, setPitchSlots] = useState(_sv?.pitchSlots ?? []);
  const [usedTeamIds, setUsedTeamIds] = useState(_sv?.usedTeamIds ?? []);
  const [rolledTeam, setRolledTeam] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollingPreview, setRollingPreview] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [pitch, setPitch] = useState(_sv?.pitch ?? {});
  const [captainSlot, setCaptainSlot] = useState(_sv?.captainSlot ?? null);
  const [skipsLeft, setSkipsLeft] = useState(_sv?.skipsLeft ?? MAX_SKIPS);
  const [log, setLog] = useState(_sv?.log ?? []);

  // Time personalizado
  const [myTeamName, setMyTeamName] = useState(_sv?.myTeamName ?? 'Meu Time');
  const [myTeamBadge, setMyTeamBadge] = useState(_sv?.myTeamBadge ?? '⭐');
  const [myTeamColor, setMyTeamColor] = useState(_sv?.myTeamColor ?? '#d4a23c');
  const [myTeamCoach, setMyTeamCoach] = useState(_sv?.myTeamCoach ?? '');
  const [myTeamCity, setMyTeamCity] = useState(_sv?.myTeamCity ?? '');

  // ── Conta (login opcional) ──────────────────────────────────
  const [authToken, setAuthToken] = useState(() => api.getToken());
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(() => !!api.getToken());
  const [authError, setAuthError] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);

  // Se já tem token salvo, valida e restaura a sessão ao carregar.
  useEffect(() => {
    if (!authToken) { setAuthLoading(false); return; }
    let cancelled = false;
    setAuthLoading(true);
    api.fetchMe()
      .then(data => {
        if (!data?.user) throw new Error('Resposta invalida ao restaurar sessao.');
        if (!cancelled) setCurrentUser(data.user);
      })
      .catch(() => { if (!cancelled) { api.clearToken(); setAuthToken(null); } })
      .finally(() => { if (!cancelled) setAuthLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Primeira visita: sem sessão e sem escolha prévia de "convidado" → mostra o modal.
  useEffect(() => {
    if (authLoading) return;
    if (!authToken && localStorage.getItem('brl_guest_ack') !== '1') {
      setShowAccountModal(true);
    }
  }, [authLoading, authToken]);

  // Ao logar/cadastrar/restaurar sessão, o time do usuário passa a vir da conta.
  useEffect(() => {
    if (!currentUser) return;
    setMyTeamName(currentUser.team_name || 'Meu Time');
    setMyTeamColor(currentUser.team_color || '#d4a23c');
    setMyTeamLogo(currentUser.team_logo || null);
    setMyTeamCoach(currentUser.team_coach || '');
    setMyTeamCity(currentUser.team_city || '');
  }, [currentUser]);

  const handleAuthSuccess = (result) => {
    if (!result?.token || !result?.user) {
      setAuthError('Erro ao autenticar. Verifique se o servidor está rodando e tente de novo.');
      return;
    }
    const { token, user } = result;
    api.setToken(token);
    setAuthToken(token);
    setCurrentUser(user);
    setAuthError('');
    try { localStorage.setItem('brl_guest_ack', '1'); } catch { /* ignore */ }
    setShowAccountModal(false);
  };

  const handleGuestChoice = () => {
    try { localStorage.setItem('brl_guest_ack', '1'); } catch { /* ignore */ }
    setShowAccountModal(false);
  };

  const handleLogout = () => {
    api.clearToken();
    setAuthToken(null);
    setCurrentUser(null);
    setShowAccountPanel(false);
  };

  // Atualiza um subconjunto de campos: no servidor (se logado) + no state local
  // (pra refletir na hora, sem esperar round-trip).
  const updateAccountFields = async (fields) => {
    if (!currentUser) return;
    const { user } = await api.updateMe(fields);
    setCurrentUser(user);
  };

  const handleDeleteAccount = async () => {
    await api.deleteMe();
    handleLogout();
  };

  // Modo de jogo
  const [gameMode, setGameMode] = useState(_sv?.gameMode ?? 'brasileirao'); // 'brasileirao' | 'copa' | 'multi'

  // Multiplayer (PeerJS)
  const [multiPhase, setMultiPhase] = useState(null); // null|'lobby'|'room'
  const [multiGameMode, setMultiGameMode] = useState('brasileirao');
  const [roomCode, setRoomCode] = useState('');
  const [isLeader, setIsLeader] = useState(false);
  const [roomSnap, setRoomSnap] = useState(null); // estado da sala (mantido pelo líder)
  const [joinInput, setJoinInput] = useState('');
  const [multiTimerLeft, setMultiTimerLeft] = useState(null);
  const [multiConnecting, setMultiConnecting] = useState(false);
  const [multiError, setMultiError] = useState('');
  const peerRef = useRef(null);       // instância Peer (líder ou guest)
  const connsRef = useRef({});        // líder: { peerId: DataConnection }
  const leaderConnRef = useRef(null); // guest: conexão com o líder

  // Logo do time
  const [myTeamLogo, setMyTeamLogo] = useState(_sv?.myTeamLogo ?? null);
  const [cropSrc, setCropSrc] = useState(null);

  // Liga
  const [leagueTeams, setLeagueTeams] = useState(_sv?.leagueTeams ?? []);
  const [leagueTable, setLeagueTable] = useState(_sv?.leagueTable ?? []);
  const [fixtures, setFixtures] = useState(_sv?.fixtures ?? []);
  const [currentRound, setCurrentRound] = useState(_sv?.currentRound ?? 0);

  // Copa (eliminatória)
  const [cupRounds, setCupRounds] = useState(_sv?.cupRounds ?? []); // [{name, matches, leg1Results, results}]
  const [cupRoundIdx, setCupRoundIdx] = useState(_sv?.cupRoundIdx ?? 0);
  const [cupLeg, setCupLeg] = useState(_sv?.cupLeg ?? 1); // 1=jogo de ida  2=jogo de volta
  const cupLegRef = useRef(1);
  useEffect(() => { cupLegRef.current = cupLeg; }, [cupLeg]);
  const [userInCup, setUserInCup] = useState(_sv?.userInCup ?? true);
  const userInCupRef = useRef(_sv?.userInCup ?? true);
  useEffect(() => { userInCupRef.current = userInCup; }, [userInCup]);
  const [eliminationRoundName, setEliminationRoundName] = useState(_sv?.eliminationRoundName ?? null);
  const [cupWinnerId, setCupWinnerId] = useState(_sv?.cupWinnerId ?? null);

  // Histórico e artilheiros
  const [matchHistory, setMatchHistory] = useState(_sv?.matchHistory ?? []);
  const [scorers, setScorers] = useState(_sv?.scorers ?? {});
  const [assisters, setAssisters] = useState(_sv?.assisters ?? {});
  const [viewingTeam, setViewingTeam] = useState(null);

  // Partida ao vivo
  const [clockMinute, setClockMinute] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveScore, setLiveScore] = useState({ home: 0, away: 0 });
  const [roundResults, setRoundResults] = useState(null);
  const [activeUserMatch, setActiveUserMatch] = useState(null);

  const [simSpeed, setSimSpeed] = useState(1);
  const [simMode, setSimMode] = useState('manual'); // 'manual' | 'auto'
  const [autoCountdown, setAutoCountdown] = useState(null); // null | 1-3
  const [isPaused, setIsPaused] = useState(false);
  const [showSubPanel, setShowSubPanel] = useState(false);
  const [subSelectStarter, setSubSelectStarter] = useState(null);
  const [liveLineup, setLiveLineup] = useState(null);
  const [penaltyPhase, setPenaltyPhase] = useState(null);

  const timerRef = useRef(null);
  const clockRef = useRef(null);
  const speedRef = useRef(1);
  const autoActionRef = useRef(null); // 'startRound' | 'nextRound'
  const startRoundRef = useRef(null);
  const goNextRoundRef = useRef(null);
  const isPausedRef = useRef(false);
  const tickFnRef = useRef(null);
  const liveLineupRef = useRef(null);

  // No multiplayer, cada jogador é identificado pelo seu peerId (MY_PID) — não
  // pelo id fixo '__myteam__' usado no solo. Sem isso, o cliente nunca encontra
  // a própria partida na rodada e a simulação trava.
  const myTeamId = roomSnap ? MY_PID : MY_TEAM_ID;
  const myTeamIdRef = useRef(myTeamId);
  useEffect(() => { myTeamIdRef.current = myTeamId; }, [myTeamId]);

  useEffect(() => { speedRef.current = simSpeed; }, [simSpeed]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (clockRef.current) clearTimeout(clockRef.current);
  }, []);

  const filledSlots = Object.keys(pitch);
  const remainingSlots = pitchSlots.filter(s => !filledSlots.includes(s.key));

  const goToFormationPicker = () => setPhase('formation');

  const rollWithAnimation = useCallback((finalTeam, pool) => {
    setIsRolling(true);
    setSelectedPlayer(null);
    const spinPool = pool.length > 0 ? pool : TEAMS;
    const totalSteps = 18;
    let step = 0;
    const tick = () => {
      step++;
      setRollingPreview(shuffle2(spinPool)[0]);
      if (step >= totalSteps) {
        setRollingPreview(null);
        setIsRolling(false);
        setRolledTeam(finalTeam);
      } else {
        timerRef.current = setTimeout(tick, 50 + step * 12);
      }
    };
    timerRef.current = setTimeout(tick, 50);
  }, []);

  const chooseFormation = (key) => {
    setFormationKey(key);
    const formSlots = buildPitchSlots(key);
    const benchSlots = ['bench1', 'bench2', 'bench3', 'bench4', 'bench5'].map((k, i) => ({
      key: k, label: `SUB ${i + 1}`, realPos: 'bench', isBench: true, x: 0, y: 0
    }));
    setPitchSlots([...formSlots, ...benchSlots]);
    setUsedTeamIds([]);
    setPitch({});
    setSkipsLeft(MAX_SKIPS);
    setLog([]);
    setSelectedPlayer(null);
    setRepositioningSlot(null);
    setCaptainSlot(null);
    setPhase('draft');
    rollWithAnimation(shuffle2(TEAMS)[0], TEAMS);
  };

  // Nomes já escalados (para bloquear o mesmo jogador de duas épocas diferentes)
  const pickedPlayerNames = useMemo(
    () => new Set(Object.values(pitch).map(p => p.name)),
    [pitch]
  );

  // Estado de reposicionamento (mover jogador já escalado para outro slot)
  const [repositioningSlot, setRepositioningSlot] = useState(null); // slotKey original

  const eligibleSlotsForPlayer = (player) => {
    if (pickedPlayerNames.has(player.name)) return [];
    // Expande as posições do próprio jogador (Pelé ['ATA','MEI'] → cobre PE, PD, VOL, MC…)
    const canPlayAt = new Set(player.pos);
    return remainingSlots.filter(slot => {
      if (slot.isBench) return true;
      return canPlayAt.has(slot.realPos);
    });
  };

  const clickPlayer = (player) => {
    if (repositioningSlot !== null) {
      // Cancela reposição: devolve o jogador ao slot original
      const orig = selectedPlayer;
      setPitch(prev => ({ ...prev, [repositioningSlot]: orig }));
      setSelectedPlayer(null);
      setRepositioningSlot(null);
      return;
    }
    const slots = eligibleSlotsForPlayer(player);
    if (slots.length === 0) return;
    if (slots.length === 1) pickPlayerForSlot(player, slots[0].key);
    else setSelectedPlayer(player);
  };

  const clickPitchSlot = (slotKey) => {
    if (repositioningSlot !== null) {
      const targetMeta = pitchSlots.find(s => s.key === slotKey);
      if (!targetMeta) return;
      const player = selectedPlayer;
      const playerCanGoToTarget = targetMeta.isBench || player.pos.includes(targetMeta.realPos);
      if (!playerCanGoToTarget) return;
      const occupant = pitch[slotKey];
      if (!occupant) {
        // Empty target – just place
        setPitch(prev => ({ ...prev, [slotKey]: { ...player, slotKey } }));
      } else {
        // Occupied target – try swap
        const srcMeta = pitchSlots.find(s => s.key === repositioningSlot);
        const occupantCanGoToSrc = !srcMeta || srcMeta.isBench || occupant.pos.includes(srcMeta.realPos);
        if (occupantCanGoToSrc) {
          setPitch(prev => ({
            ...prev,
            [slotKey]: { ...player, slotKey },
            [repositioningSlot]: { ...occupant, slotKey: repositioningSlot },
          }));
        } else {
          // Occupant can't go to source slot – displace (remove) occupant
          setPitch(prev => {
            const next = { ...prev };
            delete next[repositioningSlot];
            next[slotKey] = { ...player, slotKey };
            return next;
          });
        }
      }
      setSelectedPlayer(null);
      setRepositioningSlot(null);
      return;
    }
    if (selectedPlayer) {
      if (!eligibleSlotsForPlayer(selectedPlayer).some(s => s.key === slotKey)) return;
      pickPlayerForSlot(selectedPlayer, slotKey);
    }
  };

  const startReposition = (slotKey) => {
    const player = pitch[slotKey];
    if (!player) return;
    // Remove temporariamente do campo para liberar o slot nos remainingSlots
    setPitch(prev => { const next = { ...prev }; delete next[slotKey]; return next; });
    setSelectedPlayer(player);
    setRepositioningSlot(slotKey);
  };

  const pauseSim = () => {
    if (clockRef.current) clearTimeout(clockRef.current);
    clockRef.current = null;
    isPausedRef.current = true;
    setIsPaused(true);
    setShowSubPanel(true);
  };

  const resumeSim = () => {
    isPausedRef.current = false;
    setIsPaused(false);
    setShowSubPanel(false);
    setSubSelectStarter(null);
    if (tickFnRef.current) {
      const MS = { 1: 250, 1.5: 125, 2: 55 };
      clockRef.current = setTimeout(tickFnRef.current, MS[speedRef.current] ?? 250);
    }
  };

  const applyLiveSub = (starterKey, benchPlayer) => {
    const starter = liveLineupRef.current?.[starterKey];
    if (!starter || !benchPlayer) return;
    const starterMeta = pitchSlots.find(s => s.key === starterKey);
    if (starterMeta && !benchPlayer.pos.includes(starterMeta.realPos) && !starterMeta.isBench) return;
    setLiveLineup(prev => {
      const next = { ...prev };
      const benchKey = Object.keys(next).find(k => next[k].name === benchPlayer.name);
      next[starterKey] = { ...benchPlayer, slotKey: starterKey, isBench: false };
      if (benchKey) next[benchKey] = { ...starter, slotKey: benchKey, isBench: true };
      liveLineupRef.current = next;
      return next;
    });
    setSubSelectStarter(null);
  };

  const pickPlayerForSlot = (player, slotKey) => {
    const isBench = pitchSlots.find(s => s.key === slotKey)?.isBench || false;
    setPitch(prev => ({ ...prev, [slotKey]: { ...player, teamLabel: rolledTeam.label, teamId: rolledTeam.id, club: rolledTeam.club, year: rolledTeam.year, nat: player.nat || 'BRA', isBench, slotKey } }));
    setUsedTeamIds(prev => [...prev, rolledTeam.id]);
    setLog(prev => [...prev, { teamLabel: rolledTeam.label, playerName: player.name, slot: slotKey }]);
    setSelectedPlayer(null);
    const stillRemaining = pitchSlots.filter(s => s.key !== slotKey && !filledSlots.includes(s.key));
    if (stillRemaining.length === 0) {
      setPhase('squad');
      setRolledTeam(null);
    } else {
      const candidates = TEAMS.filter(t => !usedTeamIds.includes(t.id) && t.id !== rolledTeam.id);
      if (candidates.length === 0) { setPhase('squad'); }
      else rollWithAnimation(shuffle2(candidates)[0], candidates);
    }
  };

  const skipTeam = () => {
    if (skipsLeft <= 0) return;
    setSkipsLeft(s => s - 1);
    setUsedTeamIds(prev => [...prev, rolledTeam.id]);
    setLog(prev => [...prev, { teamLabel: rolledTeam.label, skipped: true }]);
    setSelectedPlayer(null);
    const candidates = TEAMS.filter(t => ![...usedTeamIds, rolledTeam.id].includes(t.id));
    if (candidates.length === 0) setPhase('squad');
    else rollWithAnimation(shuffle2(candidates)[0], candidates);
  };

  const startSeason = () => {
    // Aplica +2 OVR ao capitão antes de calcular o time
    const pitchWithCaptain = captainSlot && pitch[captainSlot]
      ? { ...pitch, [captainSlot]: { ...pitch[captainSlot], ovr: pitch[captainSlot].ovr + 2, isCaptain: true } }
      : pitch;
    const userOvr = teamStrength(pitchWithCaptain);
    const userPlayers = Object.values(pitchWithCaptain);

    const neededAI = gameMode === 'brasileirao' ? 19 : 31;
    // Gera pool com repetição se necessário
    let pool = [];
    while (pool.length < neededAI) pool = [...pool, ...shuffle2([...TEAMS])];
    const opps = pool.slice(0, neededAI).map((t, idx) => {
      // Adiciona club/year/nat — usados no hino do clube, no áudio de gol e na visualização de elenco
      const playersWithMeta = t.players.map(p => ({ ...p, club: t.club, year: t.year, nat: p.nat || 'BRA' }));
      return {
        id: `${t.id}_${idx}`,
        label: t.label,
        club: t.club,
        clubLogo: CLUB_LOGOS[t.club] || null,
        ovr: teamStrength(Object.fromEntries(playersWithMeta.map((p, i) => [i, p]))),
        players: playersWithMeta,
      };
    });

    const myTeamObj = { id: MY_TEAM_ID, label: myTeamName || 'Meu Time', badge: myTeamBadge, color: myTeamColor, logo: myTeamLogo, ovr: userOvr, players: userPlayers };
    const allTeams = [myTeamObj, ...opps];

    setLeagueTeams(allTeams);
    setClockMinute(0);
    setIsSimulating(false);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setRoundResults(null);
    setActiveUserMatch(null);
    setMatchHistory([]);
    setScorers({});

    if (gameMode === 'brasileirao') {
      const rounds = generateDoubleRoundRobin(allTeams.map(t => t.id));
      const table = allTeams.map(t => ({ id: t.id, label: t.label, clubLogo: t.clubLogo || null, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }));
      setFixtures(rounds);
      setLeagueTable(table);
      setCurrentRound(0);
      setCupRounds([]);
      setCupRoundIdx(0);
      setCupLeg(1);
      setUserInCup(true);
      setCupWinnerId(null);
    } else {
      // Copa do Brasil
      const firstMatches = generateCupFirstRound(allTeams.map(t => t.id));
      const firstRound = { name: CUP_ROUND_NAMES[0], matches: firstMatches, leg1Results: [], results: [] };
      setCupRounds([firstRound]);
      setCupRoundIdx(0);
      setCupLeg(1);
      setUserInCup(true);
      setCupWinnerId(null);
      setFixtures([firstMatches]);
      setCurrentRound(0);
      setLeagueTable([]);
    }
    setPhase('playing');
  };

  const startRound = useCallback(() => {
    if (isSimulating) return;
    const round = fixtures[currentRound];
    const um = round.find(m => m.homeId === myTeamId || m.awayId === myTeamId);
    if (!um) {
      // Copa: user already eliminated — fast-simulate this AI-only round
      if (gameMode !== 'copa' || userInCupRef.current) return;
      const allResults = round.map(m => {
        const h = leagueTeams.find(t => t.id === m.homeId);
        const a = leagueTeams.find(t => t.id === m.awayId);
        if (!h || !a) return { homeId: m.homeId, awayId: m.awayId, homeGoals: 0, awayGoals: 0 };
        return { homeId: m.homeId, awayId: m.awayId, ...simAiMatch(h, a, matchPrng(roomSnap?.seed, currentRound, m.homeId, m.awayId)) };
      });
      setRoundResults(allResults);
      setCupRounds(prev => prev.map((r, i) => i === cupRoundIdx ? { ...r, results: allResults } : r));
      return;
    }

    const homeTeam = leagueTeams.find(t => t.id === um.homeId);
    const awayTeam = leagueTeams.find(t => t.id === um.awayId);
    const events = generateMatchGoals(homeTeam, awayTeam, matchPrng(roomSnap?.seed, currentRound, um.homeId, um.awayId));

    setActiveUserMatch(um);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setClockMinute(0);
    setRoundResults(null);
    setIsSimulating(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setShowSubPanel(false);
    setSubSelectStarter(null);
    setPenaltyPhase(null);
    // Init live lineup from current pitch
    const initLL = { ...pitch };
    setLiveLineup(initLL);
    liveLineupRef.current = initLL;

    const SPEED_MS = { 1: 250, 1.5: 125, 2: 55 };

    let minute = 0;
    let evIdx = 0;
    let hs = 0;
    let as_ = 0;
    const shown = [];

    const tick = () => {
      minute++;
      let lastGoalThisTick = null;

      while (evIdx < events.length && events[evIdx].minute <= minute) {
        const ev = events[evIdx];
        if (ev.teamId === um.homeId) hs++;
        else as_++;
        shown.push({ ...ev, homeScore: hs, awayScore: as_ });
        evIdx++;
        playGoalAudio(
          ev.teamId === homeTeam.id ? homeTeam.club : awayTeam.club,
          ev.teamId === myTeamId ? currentUser?.goal_audio : null
        );
        // Record scorer (gols contra nao contam pro artilheiro)
        if (!ev.isOwnGoal) {
          setScorers(prev => ({
            ...prev,
            [ev.scorer]: { goals: (prev[ev.scorer]?.goals || 0) + 1, teamLabel: ev.teamLabel }
          }));
        }
        if (ev.assist) {
          setAssisters(prev => ({
            ...prev,
            [ev.assist]: { assists: (prev[ev.assist]?.assists || 0) + 1, teamLabel: ev.teamLabel }
          }));
        }
        lastGoalThisTick = { scorer: ev.scorer, isMyGoal: ev.teamId === myTeamId };
      }

      setClockMinute(minute);
      setLiveScore({ home: hs, away: as_ });
      if (shown.length > 0) setLiveEvents([...shown]);

      if (minute >= 90) {
        setIsSimulating(false);
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();

        const finalHs = hs;
        const finalAs = as_;

        // Record match in history
        setMatchHistory(prev => [...prev, {
          round: currentRound + 1,
          homeLabel: homeTeam.label,
          awayLabel: awayTeam.label,
          hg: finalHs,
          ag: finalAs,
          isUser: true,
          gameMode,
          legLabel: gameMode === 'copa' ? (cupLegRef.current === 1 ? 'Ida' : 'Volta') : undefined,
        }]);

        // Simular todos os jogos da rodada
        const results = round.map(m => {
          if (m.homeId === um.homeId && m.awayId === um.awayId)
            return { homeId: m.homeId, awayId: m.awayId, homeGoals: finalHs, awayGoals: finalAs };
          const h = leagueTeams.find(t => t.id === m.homeId);
          const a = leagueTeams.find(t => t.id === m.awayId);
          const sim = simAiMatch(h, a, matchPrng(roomSnap?.seed, currentRound, m.homeId, m.awayId));
          return { homeId: m.homeId, awayId: m.awayId, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
        });

        setRoundResults(results);

        if (gameMode === 'brasileirao') {
          setLeagueTable(prev => {
            const tbl = prev.map(r => ({ ...r }));
            results.forEach(res => {
              const h = tbl.find(t => t.id === res.homeId);
              const a = tbl.find(t => t.id === res.awayId);
              if (!h || !a) return;
              h.pj++; a.pj++;
              h.gp += res.homeGoals; h.gc += res.awayGoals;
              a.gp += res.awayGoals; a.gc += res.homeGoals;
              if (res.homeGoals > res.awayGoals) { h.v++; h.pts += 3; a.d++; }
              else if (res.homeGoals < res.awayGoals) { a.v++; a.pts += 3; h.d++; }
              else { h.e++; h.pts++; a.e++; a.pts++; }
            });
            return [...tbl].sort((a, b) =>
              b.pts - a.pts || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp
            );
          });
        } else {
          // Copa: registrar resultado da rodada
          setCupRounds(prev => {
            const baseUpdated = prev.map((r, i) => i === cupRoundIdx ? { ...r, results } : r);
            // Leg 2: calcular pênaltis e verificar eliminação por agregado
            if (cupLegRef.current === 2) {
              const cupRoundData = baseUpdated[cupRoundIdx];
              const leg1Res = cupRoundData?.leg1Results || [];
              const penaltyResults = [];

              // Compute penalties for all tied matches (regra do gol fora foi extinta — empate no agregado já vai para os pênaltis)
              cupRoundData?.matches?.forEach((match, i) => {
                const l1 = leg1Res[i] || { homeGoals: 0, awayGoals: 0 };
                const l2 = results[i] || { homeGoals: 0, awayGoals: 0 };
                const aggA = l1.homeGoals + l2.awayGoals;
                const aggB = l1.awayGoals + l2.homeGoals;
                if (aggA === aggB) {
                  const penRand = matchPrng(roomSnap?.seed, `${cupRoundIdx}-${cupLegRef.current}-pen`, match.homeId, match.awayId);
                  const pen = simulatePenalties(match.homeId, match.awayId, leagueTeams, penRand);
                  penaltyResults.push({ matchIdx: i, ...pen });
                }
              });

              // User elimination check
              const userMatchIdx = cupRoundData?.matches?.findIndex(m => m.homeId === myTeamId || m.awayId === myTeamId) ?? -1;
              if (userMatchIdx >= 0) {
                const match = cupRoundData.matches[userMatchIdx];
                const l1 = leg1Res[userMatchIdx] || { homeGoals: 0, awayGoals: 0 };
                const l2 = results[userMatchIdx] || { homeGoals: 0, awayGoals: 0 };
                const isHome = match.homeId === myTeamId;
                const userAgg = isHome ? (l1.homeGoals + l2.awayGoals) : (l1.awayGoals + l2.homeGoals);
                const oppAgg = isHome ? (l1.awayGoals + l2.homeGoals) : (l1.homeGoals + l2.awayGoals);
                if (userAgg < oppAgg) {
                  setUserInCup(false);
                  setEliminationRoundName(cupRoundData?.name || CUP_ROUND_NAMES[cupRoundIdx] || 'Copa');
                } else if (userAgg === oppAgg) {
                  // Empate no agregado (regra do gol fora foi extinta) — decide nos pênaltis
                  const userPen = penaltyResults.find(pr => pr.matchIdx === userMatchIdx);
                  if (userPen) {
                    if (userPen.winner !== myTeamId) {
                      setUserInCup(false);
                      setEliminationRoundName(cupRoundData?.name || CUP_ROUND_NAMES[cupRoundIdx] || 'Copa');
                    }
                    // homeTeam/awayTeam (topo do startRound) refletem a orientação do jogo de volta,
                    // enquanto isHome/match refletem a orientação do jogo de ida — não são a mesma coisa.
                    // Buscar direto pelo id evita trocar "meu time" pelo adversário quando o mando de campo inverte.
                    const myT = leagueTeams.find(t => t.id === myTeamId);
                    const opT = leagueTeams.find(t => t.id === (isHome ? match.awayId : match.homeId));
                    const myPlayers = liveLineupRef.current
                      ? Object.values(liveLineupRef.current)
                      : (myT?.players || []).slice(0, 16);
                    const oppGk = (opT?.players || [])[0]?.name || 'Goleiro';
                    setPenaltyPhase({
                      kicks: userPen.kicks,
                      winner: userPen.winner,
                      homeId: match.homeId,
                      awayId: match.awayId,
                      myIsHome: isHome,
                      myTeamLabel: myT?.label || 'Meu Time',
                      oppTeamLabel: opT?.label || 'Adversario',
                      oppGkName: oppGk,
                      myPlayers,
                    });
                  }
                }
              }

              // Store penalty results on the cup round
              if (penaltyResults.length > 0) {
                return baseUpdated.map((r, i) => i === cupRoundIdx ? { ...r, penaltyResults } : r);
              }
            }
            return baseUpdated;
          });
        }
      } else if (lastGoalThisTick) {
        // Pausa o relogio ate a narracao do gol terminar antes de seguir a partida.
        narrateGoal(lastGoalThisTick.scorer, lastGoalThisTick.isMyGoal, () => {
          if (isPausedRef.current) return;
          clockRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
        });
      } else {
        clockRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
      }
    };

    tickFnRef.current = tick;
    clockRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
  }, [fixtures, currentRound, leagueTeams, isSimulating, gameMode, cupRoundIdx, myTeamId, roomSnap?.seed]);

  const goNextRound = useCallback(() => {
    const next = currentRound + 1;

    if (gameMode === 'brasileirao') {
      if (next >= fixtures.length) {
        setPhase('results');
      } else {
        setCurrentRound(next);
        setRoundResults(null);
        setLiveEvents([]);
        setLiveScore({ home: 0, away: 0 });
        setClockMinute(0);
        setActiveUserMatch(null);
      }
      return;
    }

    // Copa — jogo de ida → jogo de volta → próxima fase
    setCupRounds(prev => {
      const currentCupRound = prev[cupRoundIdx];
      if (!currentCupRound) return prev;

      const reset = () => {
        setRoundResults(null);
        setLiveEvents([]);
        setLiveScore({ home: 0, away: 0 });
        setClockMinute(0);
        setActiveUserMatch(null);
      };

      if (cupLeg === 1) {
        // Salvar resultados do jogo de ida e preparar jogo de volta
        const leg1Res = roundResults || [];
        const leg2Matches = currentCupRound.matches.map(m => ({ homeId: m.awayId, awayId: m.homeId }));
        setFixtures(f => [...f, leg2Matches]);
        setCupLeg(2);
        setCurrentRound(next);
        reset();
        return prev.map((r, i) => i === cupRoundIdx ? { ...r, leg1Results: leg1Res } : r);
      }

      // Leg 2 — calcular vencedores por agregado
      const leg1Res = currentCupRound.leg1Results || [];
      const leg2Res = roundResults || [];
      // Use pre-computed penalty results from tick if available
      const preComputedPenalties = currentCupRound.penaltyResults || [];

      const aggregateWinners = currentCupRound.matches.map((match, i) => {
        const l1 = leg1Res[i] || { homeGoals: 0, awayGoals: 0 };
        const l2 = leg2Res[i] || { homeGoals: 0, awayGoals: 0 };
        // leg1 home = match.homeId, leg2 home = match.awayId (invertido)
        const aggA = l1.homeGoals + l2.awayGoals;
        const aggB = l1.awayGoals + l2.homeGoals;
        if (aggA !== aggB) return aggA > aggB ? match.homeId : match.awayId;
        // Empate no agregado (regra do gol fora foi extinta) — pênaltis
        // usar resultado pré-computado (já calculado no tick com a mesma seed) ou simular como fallback
        const precomputed = preComputedPenalties.find(pr => pr.matchIdx === i);
        if (precomputed) return precomputed.winner;
        const penRand = matchPrng(roomSnap?.seed, `${cupRoundIdx}-${cupLeg}-pen`, match.homeId, match.awayId);
        const pen = simulatePenalties(match.homeId, match.awayId, leagueTeams, penRand);
        return pen.winner;
      });

      const nextMatches = [];
      for (let i = 0; i + 1 < aggregateWinners.length; i += 2)
        nextMatches.push({ homeId: aggregateWinners[i], awayId: aggregateWinners[i + 1] });

      if (nextMatches.length === 0) {
        setCupWinnerId(aggregateWinners[0] || null);
        setPhase('results');
        return prev;
      }

      const nextRoundName = CUP_ROUND_NAMES[cupRoundIdx + 1] || 'Final';
      const newRound = { name: nextRoundName, matches: nextMatches, leg1Results: [], results: [] };
      const updated = [...prev, newRound];

      setFixtures(f => [...f, nextMatches]);
      setCupRoundIdx(r => r + 1);
      setCupLeg(1);
      setCurrentRound(next);
      reset();

      return updated;
    });
  }, [currentRound, fixtures, gameMode, cupRoundIdx, cupLeg, roundResults, leagueTeams, myTeamId, roomSnap?.seed]);

  // Mantém refs atualizadas para os efeitos de auto não ficarem com closures velhas
  useEffect(() => { startRoundRef.current = startRound; }, [startRound]);
  useEffect(() => { goNextRoundRef.current = goNextRound; }, [goNextRound]);

  // Auto-save to localStorage
  useEffect(() => {
    if (phase === 'intro') { try { localStorage.removeItem('brl_save'); } catch { } return; }
    if (multiPhase || roomSnap) return; // don't persist multiplayer sessions
    try {
      const save = {
        phase, formationKey, pitchSlots, pitch, usedTeamIds, skipsLeft, log, captainSlot,
        gameMode, myTeamName, myTeamBadge, myTeamColor, myTeamCoach, myTeamCity, myTeamLogo,
        leagueTeams, leagueTable, fixtures, currentRound,
        cupRounds, cupRoundIdx, cupLeg, userInCup, eliminationRoundName, cupWinnerId,
        matchHistory, scorers, assisters,
      };
      localStorage.setItem('brl_save', JSON.stringify(save));
    } catch (e) { }
  }, [phase, fixtures, currentRound, leagueTable, cupRounds, matchHistory, pitch, roundResults]);

  // Dispara a ação quando simMode muda ou rodada termina/começa
  useEffect(() => {
    setAutoCountdown(null);
    autoActionRef.current = null;
    if (simMode !== 'auto' || phase !== 'playing') return;
    if (roundResults !== null && !isSimulating) {
      autoActionRef.current = 'nextRound';
      setAutoCountdown(3);
    } else if (roundResults === null && !isSimulating) {
      autoActionRef.current = 'startRound';
      setAutoCountdown(3);
    }
  }, [simMode, phase, roundResults, isSimulating]);

  // Tique do contador regressivo
  useEffect(() => {
    if (autoCountdown === null) return;
    if (autoCountdown === 0) {
      const action = autoActionRef.current;
      autoActionRef.current = null;
      setAutoCountdown(null);
      if (action === 'nextRound') goNextRoundRef.current?.();
      else if (action === 'startRound') startRoundRef.current?.();
      return;
    }
    const t = setTimeout(() => setAutoCountdown(c => (c !== null && c > 0 ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [autoCountdown]);

  const restart = () => {
    try { localStorage.removeItem('brl_save'); } catch { }
    if (timerRef.current) clearTimeout(timerRef.current);
    if (clockRef.current) clearTimeout(clockRef.current);
    // destrói peer se estava no multiplayer
    if (peerRef.current) { try { peerRef.current.destroy(); } catch { } peerRef.current = null; }
    connsRef.current = {};
    leaderConnRef.current = null;
    setMultiPhase(null);
    setRoomCode('');
    setRoomSnap(null);
    setIsLeader(false);
    setJoinInput('');
    setPhase('intro');
    setFormationKey(null);
    setPitchSlots([]);
    setPitch({});
    setUsedTeamIds([]);
    setSkipsLeft(MAX_SKIPS);
    setLog([]);
    setRolledTeam(null);
    setIsRolling(false);
    setRollingPreview(null);
    setSelectedPlayer(null);
    setRepositioningSlot(null);
    setCaptainSlot(null);
    setIsPaused(false);
    setShowSubPanel(false);
    setSubSelectStarter(null);
    setLiveLineup(null);
    setPenaltyPhase(null);
    isPausedRef.current = false;
    tickFnRef.current = null;
    liveLineupRef.current = null;
    setLeagueTeams([]);
    setLeagueTable([]);
    setFixtures([]);
    setCurrentRound(0);
    setClockMinute(0);
    setIsSimulating(false);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setRoundResults(null);
    setActiveUserMatch(null);
    setCupRounds([]);
    setCupRoundIdx(0);
    setCupLeg(1);
    setUserInCup(true);
    setEliminationRoundName(null);
    setCupWinnerId(null);
    setMatchHistory([]);
    setScorers({});
    setViewingTeam(null);
  };

  // Nova temporada com o mesmo elenco
  const newSeason = useCallback(() => {
    const pitchWithCaptain = captainSlot && pitch[captainSlot]
      ? { ...pitch, [captainSlot]: { ...pitch[captainSlot], ovr: pitch[captainSlot].ovr + 2, isCaptain: true } }
      : pitch;
    const userOvr = teamStrength(pitchWithCaptain);
    const userPlayers = Object.values(pitchWithCaptain).filter(p => !p.isBench);

    setClockMinute(0);
    setIsSimulating(false);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setRoundResults(null);
    setActiveUserMatch(null);
    setCupRounds([]);
    setCupRoundIdx(0);
    setCupLeg(1);
    setUserInCup(true);
    setEliminationRoundName(null);
    setCupWinnerId(null);
    setMatchHistory([]);
    setScorers({});

    const neededAI = gameMode === 'brasileirao' ? 19 : 31;
    let pool = [];
    while (pool.length < neededAI) pool = [...pool, ...shuffle2([...TEAMS])];
    const opps = pool.slice(0, neededAI).map((t, idx) => {
      const playersWithMeta = t.players.map(p => ({ ...p, club: t.club, year: t.year, nat: p.nat || 'BRA' }));
      return {
        id: `${t.id}_${idx}`,
        label: t.label,
        club: t.club,
        clubLogo: CLUB_LOGOS[t.club] || null,
        ovr: teamStrength(Object.fromEntries(playersWithMeta.map((p, i) => [i, p]))),
        players: playersWithMeta,
      };
    });

    const myTeamObj = { id: MY_TEAM_ID, label: myTeamName || 'Meu Time', badge: myTeamBadge, color: myTeamColor, logo: myTeamLogo, ovr: userOvr, players: userPlayers };
    const allTeams = [myTeamObj, ...opps];
    setLeagueTeams(allTeams);

    if (gameMode === 'brasileirao') {
      const rounds = generateDoubleRoundRobin(allTeams.map(t => t.id));
      const table = allTeams.map(t => ({ id: t.id, label: t.label, clubLogo: t.clubLogo || null, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }));
      setFixtures(rounds);
      setLeagueTable(table);
      setCurrentRound(0);
    } else {
      const firstMatches = generateCupFirstRound(allTeams.map(t => t.id));
      const firstRound = { name: CUP_ROUND_NAMES[0], matches: firstMatches, leg1Results: [], results: [] };
      setCupRounds([firstRound]);
      setCupRoundIdx(0);
      setCupLeg(1);
      setFixtures([firstMatches]);
      setCurrentRound(0);
      setLeagueTable([]);
    }
    setPhase('playing');
  }, [pitch, captainSlot, gameMode, myTeamName, myTeamBadge, myTeamColor, myTeamLogo]);

  // Simula todas as fases restantes da Copa até o campeão (usuário eliminado)
  const simulateAllCupa = useCallback(() => {
    let currCupRounds = cupRounds.map(r => ({ ...r }));
    let currCupRoundIdx = cupRoundIdx;
    let currCupLeg = cupLeg;
    let currFixtures = [...fixtures];
    let currRound = currentRound;
    let winnerId = null;

    let iters = 0;
    while (iters++ < 20) {
      const round = currFixtures[currRound];
      if (!round) break;
      const results = round.map(m => {
        const h = leagueTeams.find(t => t.id === m.homeId);
        const a = leagueTeams.find(t => t.id === m.awayId);
        if (!h || !a) return { homeId: m.homeId, awayId: m.awayId, homeGoals: 0, awayGoals: 0 };
        return { homeId: m.homeId, awayId: m.awayId, ...simAiMatch(h, a, matchPrng(roomSnap?.seed, currRound, m.homeId, m.awayId)) };
      });

      const cupRoundData = currCupRounds[currCupRoundIdx];
      if (!cupRoundData) break;

      if (currCupLeg === 1) {
        currCupRounds = currCupRounds.map((r, i) => i === currCupRoundIdx ? { ...r, leg1Results: results } : r);
        const leg2Matches = cupRoundData.matches.map(m => ({ homeId: m.awayId, awayId: m.homeId }));
        currFixtures = [...currFixtures, leg2Matches];
        currRound++;
        currCupLeg = 2;
      } else {
        const leg1Res = currCupRounds[currCupRoundIdx].leg1Results || [];
        const aggregateWinners = cupRoundData.matches.map((match, i) => {
          const l1 = leg1Res[i] || { homeGoals: 0, awayGoals: 0 };
          const l2 = results[i] || { homeGoals: 0, awayGoals: 0 };
          const aggA = l1.homeGoals + l2.awayGoals;
          const aggB = l1.awayGoals + l2.homeGoals;
          if (aggA !== aggB) return aggA > aggB ? match.homeId : match.awayId;
          // Empate no agregado (regra do gol fora foi extinta) — decide nos pênaltis
          const penRand = matchPrng(roomSnap?.seed, `${currCupRoundIdx}-pen`, match.homeId, match.awayId);
          const pen = simulatePenalties(match.homeId, match.awayId, leagueTeams, penRand);
          return pen.winner;
        });

        const nextMatches = [];
        for (let i = 0; i + 1 < aggregateWinners.length; i += 2)
          nextMatches.push({ homeId: aggregateWinners[i], awayId: aggregateWinners[i + 1] });

        if (nextMatches.length === 0) {
          winnerId = aggregateWinners[0] || null;
          break;
        }

        const nextRoundName = CUP_ROUND_NAMES[currCupRoundIdx + 1] || 'Final';
        const newRound = { name: nextRoundName, matches: nextMatches, leg1Results: [], results: [] };
        currCupRounds = [...currCupRounds, newRound];
        currFixtures = [...currFixtures, nextMatches];
        currRound++;
        currCupRoundIdx++;
        currCupLeg = 1;
      }
    }

    setCupRounds(currCupRounds);
    setCupRoundIdx(currCupRoundIdx);
    setCupWinnerId(winnerId);
    setPhase('results');
  }, [cupRounds, cupRoundIdx, cupLeg, fixtures, currentRound, leagueTeams, roomSnap?.seed]);

  // ── MULTIPLAYER (PeerJS) ──────────────────────────────────────────────────
  // Helpers para broadcast / envio de mensagem
  const leaderBroadcast = (msg) => {
    Object.values(connsRef.current).forEach(c => { try { c.send(msg); } catch { } });
  };

  const leaderApplySnap = (snap) => {
    setRoomSnap({ ...snap });
    leaderBroadcast({ type: 'snap', snap });
  };

  const multiUpdateMyTeam = (fields) => {
    if (isLeader) {
      setRoomSnap(prev => {
        if (!prev) return prev;
        const next = { ...prev, players: { ...prev.players, [MY_PID]: { ...prev.players[MY_PID], ...fields } } };
        leaderBroadcast({ type: 'snap', snap: next });
        return next;
      });
    } else {
      leaderConnRef.current?.send({ type: 'update', pid: MY_PID, fields });
    }
  };

  const multiSetReady = () => multiUpdateMyTeam({ ready: true });

  const multiLeaderSetTimer = (minutes) => {
    setRoomSnap(prev => {
      if (!prev) return prev;
      const next = { ...prev, timerMinutes: minutes };
      leaderBroadcast({ type: 'snap', snap: next });
      return next;
    });
  };

  const multiLeaderStart = () => {
    setRoomSnap(prev => {
      if (!prev) return prev;
      const maxSlots = prev.gameMode === 'copa' ? 32 : 20;
      const humanCount = Object.keys(prev.players).length;
      const needed = Math.max(0, maxSlots - humanCount);
      const aiPlayers = {};
      if (needed > 0) {
        const shuffled = shuffle2(TEAMS).slice(0, needed);
        shuffled.forEach((t, i) => {
          const pp = t.players.map((pl, j) => ({ ...pl, club: t.club, year: t.year, nat: pl.nat || 'BRA', isBench: j >= 11 }));
          aiPlayers[`ai_${i}`] = {
            name: t.label, color: (t.colors && t.colors.p) || '#888', logo: CLUB_LOGOS[t.club] || null,
            coach: t.coach || '', city: '', ready: true, isAI: true, club: t.club,
            pitch: Object.fromEntries(pp.map((p, j) => [j, p])),
            ovr: teamStrength(Object.fromEntries(pp.map((p, j) => [j, p]))),
          };
        });
      }
      const next = {
        ...prev, phase: 'team-setup', startedAt: Date.now(),
        players: { ...prev.players, ...aiPlayers },
      };
      leaderBroadcast({ type: 'snap', snap: next });
      return next;
    });
  };

  const multiLeaderSimulate = () => {
    const seed = Math.floor(Math.random() * 2147483647);
    setRoomSnap(prev => {
      if (!prev) return prev;
      const next = { ...prev, phase: 'simulation', seed };
      leaderBroadcast({ type: 'snap', snap: next });
      return next;
    });
  };

  const multiCreateRoom = async (attemptsLeft = 5) => {
    setMultiConnecting(true);
    setMultiError('');
    const code = generateRoomCode();
    let peer;
    try {
      peer = new Peer(code, { debug: 1 });
      peerRef.current = peer;
    } catch (e) {
      setMultiConnecting(false);
      setMultiError('Erro ao criar conexão: ' + e.message);
      return;
    }

    const timeout = setTimeout(() => {
      setMultiConnecting(false);
      setMultiError('Tempo esgotado — sem resposta do servidor de conexão. Verifique sua internet.');
      try { peer.destroy(); } catch { }
    }, 12000);

    peer.on('open', (id) => {
      clearTimeout(timeout);
      setMultiConnecting(false);
      setIsLeader(true);
      setRoomCode(id.toUpperCase());
      const initialSnap = {
        gameMode: multiGameMode,
        phase: 'lobby',
        timerMinutes: 3,
        leaderId: MY_PID,
        leaderPeerId: id,
        seed: null,
        players: {
          [MY_PID]: { name: myTeamName || 'Meu Time', color: myTeamColor, logo: myTeamLogo || null, coach: myTeamCoach || '', city: myTeamCity || '', ready: false, pitch: null, ovr: 0 }
        }
      };
      setRoomSnap(initialSnap);
      setMultiPhase('room');
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        connsRef.current[conn.peer] = conn;
        // envia snapshot atual via ref para evitar stale closure
        setRoomSnap(current => { conn.send({ type: 'snap', snap: current }); return current; });
      });
      conn.on('data', (msg) => {
        if (msg.type === 'join') {
          conn._pid = msg.pid; // lembra qual jogador da sala esta conexão representa (p/ limpeza ao desconectar)
          setRoomSnap(prev => {
            if (!prev) return prev;
            const maxP = prev.gameMode === 'copa' ? 32 : 20;
            if (Object.keys(prev.players).length >= maxP) { conn.send({ type: 'error', msg: 'Sala cheia!' }); return prev; }
            const next = { ...prev, players: { ...prev.players, [msg.pid]: { name: msg.name, color: msg.color, logo: msg.logo || null, coach: msg.coach || '', city: msg.city || '', ready: false, pitch: null, ovr: 0 } } };
            leaderBroadcast({ type: 'snap', snap: next });
            return next;
          });
        }
        if (msg.type === 'update') {
          setRoomSnap(prev => {
            if (!prev) return prev;
            const next = { ...prev, players: { ...prev.players, [msg.pid]: { ...(prev.players[msg.pid] || {}), ...msg.fields } } };
            leaderBroadcast({ type: 'snap', snap: next });
            return next;
          });
        }
      });
      conn.on('close', () => {
        delete connsRef.current[conn.peer];
        // Remove o jogador que caiu enquanto ainda estava no lobby/draft, pra não travar o "todos prontos"
        // pra sempre. Depois que a simulação já começou, mantemos o time dele (já entrou nos confrontos).
        if (conn._pid) {
          setRoomSnap(prev => {
            if (!prev || (prev.phase !== 'lobby' && prev.phase !== 'team-setup')) return prev;
            if (!prev.players[conn._pid]) return prev;
            const players = { ...prev.players };
            delete players[conn._pid];
            const next = { ...prev, players };
            leaderBroadcast({ type: 'snap', snap: next });
            return next;
          });
        }
      });
    });

    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && attemptsLeft > 0) {
        clearTimeout(timeout);
        try { peer.destroy(); } catch { }
        multiCreateRoom(attemptsLeft - 1);
        return;
      }
      clearTimeout(timeout);
      setMultiConnecting(false);
      setMultiError('Erro: ' + (e.message || e.type));
      try { peer.destroy(); } catch { }
    });
  };

  const multiJoinRoom = async (code) => {
    const normalizedCode = code.trim().toUpperCase();
    const peer = new Peer(undefined, { debug: 1 });
    peerRef.current = peer;
    peer.on('open', (myPeerId) => {
      // O codigo de 6 caracteres digitado pelo jogador É o peerId completo do lider
      // (o lider cria sua sala com esse mesmo codigo como ID via generateRoomCode()).
      const conn = peer.connect(normalizedCode, { reliable: true });
      leaderConnRef.current = conn;
      conn.on('open', () => {
        conn.send({ type: 'join', pid: MY_PID, name: myTeamName || 'Meu Time', color: myTeamColor, logo: myTeamLogo || null, coach: myTeamCoach || '', city: myTeamCity || '' });
      });
      conn.on('data', (msg) => {
        if (msg.type === 'snap') { setRoomSnap(msg.snap); setMultiGameMode(msg.snap.gameMode); }
        if (msg.type === 'error') { alert(msg.msg); peer.destroy(); setMultiPhase('lobby'); }
      });
      conn.on('close', () => alert('Conexão com o líder perdida.'));
      setIsLeader(false);
      setRoomCode(normalizedCode);
      setMultiPhase('room');
    });
    peer.on('error', (e) => {
      if (e.type === 'peer-unavailable') alert('Sala não encontrada. Verifique o código.');
      else alert('Erro: ' + e.message);
      peer.destroy();
      setMultiPhase('lobby');
    });
  };

  // team-setup → cada jogador faz o draft normal (formação + escolha de jogadores + capitão)
  useEffect(() => {
    if (!roomSnap || roomSnap.phase !== 'team-setup') return;
    if (multiPhase === 'in-draft' || multiPhase === 'waiting') return;
    // reseta o estado do draft e inicia o fluxo solo normal
    setFormationKey(null);
    setPitchSlots([]);
    setPitch({});
    setUsedTeamIds([]);
    setSkipsLeft(MAX_SKIPS);
    setLog([]);
    setRolledTeam(null);
    setCaptainSlot(null);
    setRepositioningSlot(null);
    setPhase('formation');
    setMultiPhase('in-draft');
  }, [roomSnap?.phase]);

  // Timer countdown durante o draft multiplayer
  useEffect(() => {
    if (!roomSnap || roomSnap.phase !== 'team-setup') return;
    const minutes = roomSnap.timerMinutes || 3;
    const startedAt = roomSnap.startedAt || Date.now();
    const endAt = startedAt + minutes * 60 * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setMultiTimerLeft(left);
      if (left === 0) multiConfirmDraft(true); // força envio ao expirar
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [roomSnap?.phase, roomSnap?.startedAt, roomSnap?.timerMinutes]);

  // Submete o draft do jogador para a sala
  const multiConfirmDraft = (forced = false) => {
    if (multiPhase === 'waiting') return; // já submeteu
    const pitchWithCaptain = captainSlot && pitch[captainSlot]
      ? { ...pitch, [captainSlot]: { ...pitch[captainSlot], ovr: pitch[captainSlot].ovr + 2, isCaptain: true } }
      : pitch;
    const ovr = teamStrength(pitchWithCaptain);
    const safe = {};
    Object.entries(pitchWithCaptain).forEach(([k, p]) => {
      safe[k] = { name: p.name, pos: p.pos, ovr: p.ovr, club: p.club || '', year: p.year || 0, nat: p.nat || 'BRA', isBench: p.isBench || false, slotKey: k };
    });
    const fields = { pitch: safe, ovr, ready: true };
    if (isLeader) {
      setRoomSnap(prev => {
        if (!prev) return prev;
        const next = { ...prev, players: { ...prev.players, [MY_PID]: { ...(prev.players[MY_PID] || {}), ...fields } } };
        leaderBroadcast({ type: 'snap', snap: next });
        return next;
      });
    } else {
      leaderConnRef.current?.send({ type: 'update', pid: MY_PID, fields });
    }
    setMultiPhase('waiting');
    setPhase('multi-waiting');
  };

  // Quando snapshot muda para 'simulation' → lança simulação local com seed compartilhado
  useEffect(() => {
    if (!roomSnap || roomSnap.phase !== 'simulation' || !roomSnap.seed) return;
    if (phase === 'playing' || phase === 'results') return;
    const players = Object.entries(roomSnap.players || {});
    const gMode = roomSnap.gameMode || 'brasileirao';
    const maxSlots = gMode === 'copa' ? 32 : 20;
    const humanTeams = players.map(([pid, p]) => ({
      id: pid, label: p.name || 'Jogador', badge: '', color: p.color || '#d4a23c',
      logo: p.logo || null, clubLogo: null, ovr: p.ovr || 70,
      players: p.pitch ? Object.values(p.pitch) : [], isHuman: true,
    }));
    const needed = maxSlots - humanTeams.length;
    const prng = makePrng(roomSnap.seed);
    const shuffled = [...TEAMS].sort(() => prng() - 0.5).slice(0, needed);
    const aiTeams = shuffled.map((t, i) => {
      const pp = t.players.map(pl => ({ ...pl, club: t.club, year: t.year, nat: pl.nat || 'BRA' }));
      return { id: `ai_${i}`, label: t.label, badge: '', color: '#888', logo: null, clubLogo: CLUB_LOGOS[t.club] || null, club: t.club, ovr: teamStrength(Object.fromEntries(pp.map((p, j) => [j, p]))), players: pp, isHuman: false };
    });
    const allTeams = [...humanTeams, ...aiTeams];
    setGameMode(gMode);
    setLeagueTeams(allTeams);
    if (gMode === 'brasileirao') {
      const rounds = generateDoubleRoundRobin(allTeams.map(t => t.id));
      setFixtures(rounds);
      setLeagueTable(allTeams.map(t => ({ id: t.id, label: t.label, clubLogo: t.clubLogo || null, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 })));
      setCurrentRound(0);
      setCupRounds([]);
      setCupLeg(1);
      setUserInCup(true);
    } else {
      // Copa do Brasil multiplayer
      const prng2 = makePrng(roomSnap.seed + 1);
      const shuffledIds = [...allTeams.map(t => t.id)].sort(() => prng2() - 0.5);
      const firstMatches = [];
      for (let i = 0; i + 1 < shuffledIds.length; i += 2)
        firstMatches.push({ homeId: shuffledIds[i], awayId: shuffledIds[i + 1] });
      const firstRound = { name: CUP_ROUND_NAMES[0], matches: firstMatches, leg1Results: [], results: [] };
      setCupRounds([firstRound]);
      setCupRoundIdx(0);
      setCupLeg(1);
      setUserInCup(true);
      setCupWinnerId(null);
      setFixtures([firstMatches]);
      setCurrentRound(0);
      setLeagueTable([]);
    }
    setPhase('playing');
    setMultiPhase(null);
  }, [roomSnap?.phase, roomSnap?.seed]);

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>
      <div style={styles.bgTexture} />
      {/* Timer flutuante durante o draft multiplayer */}
      {multiPhase === 'in-draft' && multiTimerLeft !== null && (
        <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 999, background: multiTimerLeft < 30 ? 'rgba(224,80,80,0.9)' : 'rgba(11,26,18,0.92)', border: `1px solid ${multiTimerLeft < 30 ? '#e05050' : 'rgba(212,162,60,0.4)'}`, borderRadius: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, opacity: 0.7, color: '#F4F1EA' }}>⏱ Tempo restante</span>
          <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: multiTimerLeft < 30 ? '#fff' : '#d4a23c' }}>
            {String(Math.floor(multiTimerLeft / 60)).padStart(2, '0')}:{String(multiTimerLeft % 60).padStart(2, '0')}
          </span>
        </div>
      )}
      <header style={styles.header}>
        <div style={styles.headerInner} className="header-inner-pad">
          <div style={styles.crest}>🏆</div>
          <div>
            <div
              style={{ ...styles.title, cursor: 'pointer' }}
              title="Voltar ao menu inicial"
              onClick={restart}
            >BRASILEIRÃO LENDÁRIO</div>
            <div style={styles.subtitle}>monte · escale · seja campeão</div>
          </div>
          {currentUser ? (
            <button
              onClick={() => setShowAccountPanel(true)}
              style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 999, padding: '6px 12px', cursor: 'pointer',
                color: '#F4F1EA', fontSize: 12, fontFamily: "'Space Mono', monospace",
                maxWidth: 180,
              }}
              title="Minha Conta"
            >
              <span>👤</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.username}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAccountModal(true)}
              style={{
                marginLeft: 'auto',
                background: 'none', border: '1px solid rgba(212,162,60,0.35)',
                borderRadius: 999, padding: '6px 14px', cursor: 'pointer',
                color: '#d4a23c', fontSize: 12, fontFamily: "'Space Mono', monospace", fontWeight: 600,
              }}
            >
              Entrar / Criar conta
            </button>
          )}
        </div>
      </header>

      <main style={styles.main} className="main-pad">
        {/* TELAS MULTIPLAYER */}
        {multiPhase === 'lobby' && (
          <MultiLobby
            gameMode={multiGameMode} onSetGameMode={setMultiGameMode}
            myTeamName={myTeamName} myTeamColor={myTeamColor} myTeamLogo={myTeamLogo}
            myTeamCoach={myTeamCoach} myTeamCity={myTeamCity}
            joinInput={joinInput} onJoinInput={setJoinInput}
            onCreateRoom={multiCreateRoom}
            onJoinRoom={() => multiJoinRoom(joinInput)}
            connecting={multiConnecting} error={multiError}
            onBack={() => { setMultiPhase(null); setGameMode('brasileirao'); setMultiError(''); }}
          />
        )}
        {multiPhase === 'room' && roomSnap && (
          <RoomScreen
            roomCode={roomCode} roomData={roomSnap} myId={MY_PID} isLeader={isLeader}
            myTeamName={myTeamName} myTeamColor={myTeamColor} myTeamLogo={myTeamLogo}
            myTeamCoach={myTeamCoach} myTeamCity={myTeamCity}
            onSetName={v => { setMyTeamName(v); multiUpdateMyTeam({ name: v }); }}
            onSetColor={v => { setMyTeamColor(v); multiUpdateMyTeam({ color: v }); }}
            onSetLogo={v => { setMyTeamLogo(v); multiUpdateMyTeam({ logo: v || null }); }}
            onSetCoach={v => { setMyTeamCoach(v); multiUpdateMyTeam({ coach: v }); }}
            onSetCity={v => { setMyTeamCity(v); multiUpdateMyTeam({ city: v }); }}
            onSetTimer={multiLeaderSetTimer}
            onStartSetup={multiLeaderStart}
            onStartSimulation={multiLeaderSimulate}
            onReady={multiSetReady}
            timerLeft={multiTimerLeft}
            onBack={restart}
          />
        )}

        {phase === 'intro' && !multiPhase && (
          <Intro
            onStart={goToFormationPicker}
            gameMode={gameMode} onSetGameMode={setGameMode}
            myTeamColor={myTeamColor}
            onMultiPlayer={() => setMultiPhase('lobby')}
          />
        )}
        {phase === 'formation' && <FormationPicker onChoose={chooseFormation} onBack={!multiPhase ? () => setPhase('intro') : undefined} />}
        {phase === 'draft' && (
          <Draft
            onBack={!multiPhase ? () => { setPhase('formation'); setPitch({}); setUsedTeamIds([]); setLog([]); setRolledTeam(null); setSkipsLeft(MAX_SKIPS); } : undefined}
            rolledTeam={rolledTeam}
            isRolling={isRolling}
            rollingPreview={rollingPreview}
            pitch={pitch}
            pitchSlots={pitchSlots}
            formationLabel={formationKey ? FORMATIONS[formationKey].label : ''}
            skipsLeft={skipsLeft}
            selectedPlayer={selectedPlayer}
            repositioningSlot={repositioningSlot}
            eligibleSlotsForPlayer={eligibleSlotsForPlayer}
            onClickPlayer={clickPlayer}
            onClickPitchSlot={clickPitchSlot}
            onUnplacePlayer={startReposition}
            onSkipTeam={skipTeam}
            myTeamColor={myTeamColor}
            captainSlot={captainSlot}
          />
        )}
        {phase === 'squad' && (
          <Squad
            pitch={pitch} pitchSlots={pitchSlots}
            formationLabel={formationKey ? FORMATIONS[formationKey].label : ''}
            captainSlot={captainSlot} onSetCaptain={setCaptainSlot}
            onConfirm={multiPhase === 'in-draft' ? multiConfirmDraft : startSeason}
            onRedo={() => { setPhase('formation'); setCaptainSlot(null); }}
            myTeamColor={myTeamColor}
          />
        )}
        {phase === 'multi-waiting' && roomSnap && (
          <MultiWaitingScreen
            roomData={roomSnap} myId={MY_PID} isLeader={isLeader}
            myTeamColor={myTeamColor} onSimulate={multiLeaderSimulate}
          />
        )}
        {phase === 'playing' && (
          <Playing
            myTeamId={myTeamId}
            fixtures={fixtures}
            currentRound={currentRound}
            leagueTeams={leagueTeams}
            leagueTable={leagueTable}
            clockMinute={clockMinute}
            isSimulating={isSimulating}
            liveEvents={liveEvents}
            liveScore={liveScore}
            roundResults={roundResults}
            activeUserMatch={activeUserMatch}
            myTeamColor={myTeamColor}
            myTeamBadge={myTeamBadge}
            myTeamLogo={myTeamLogo}
            gameMode={gameMode}
            cupRounds={cupRounds}
            cupRoundIdx={cupRoundIdx}
            cupLeg={cupLeg}
            userInCup={userInCup}
            eliminationRoundName={eliminationRoundName}
            simSpeed={simSpeed}
            onSetSpeed={setSimSpeed}
            simMode={simMode}
            onSetSimMode={setSimMode}
            autoCountdown={autoCountdown}
            onStartRound={startRound}
            onNextRound={goNextRound}
            matchHistory={matchHistory}
            scorers={scorers}
            assisters={assisters}
            viewingTeam={viewingTeam}
            onViewTeam={setViewingTeam}
            onSimulateAll={simulateAllCupa}
            isPaused={isPaused}
            onPause={pauseSim}
            onResume={resumeSim}
            showSubPanel={showSubPanel}
            liveLineup={liveLineup}
            subSelectStarter={subSelectStarter}
            onSelectSubStarter={setSubSelectStarter}
            onApplySub={applyLiveSub}
          />
        )}
        {phase === 'results' && (
          <Results leagueTable={leagueTable} myTeamId={myTeamId} myTeamColor={myTeamColor} myTeamBadge={myTeamBadge} myTeamLogo={myTeamLogo} gameMode={gameMode} cupWinnerId={cupWinnerId} leagueTeams={leagueTeams} onRestart={restart} scorers={scorers} assisters={assisters} onNewSeason={newSeason} />
        )}
        {viewingTeam && <TeamViewModal team={viewingTeam} onClose={() => setViewingTeam(null)} myTeamColor={myTeamColor} />}
        {penaltyPhase && (
          <PenaltyModal
            penaltyPhase={penaltyPhase}
            myTeamColor={myTeamColor}
            onDismiss={() => setPenaltyPhase(null)}
          />
        )}
      </main>
      {showAccountModal && (
        <AccountModal
          onGuestChoice={handleGuestChoice}
          onAuthSuccess={handleAuthSuccess}
          onClose={() => setShowAccountModal(false)}
          allowClose={localStorage.getItem('brl_guest_ack') === '1' || !!currentUser}
        />
      )}
      {showAccountPanel && currentUser && (
        <AccountPanel
          user={currentUser}
          myTeamColor={myTeamColor}
          myTeamLogo={myTeamLogo}
          onUpdateFields={updateAccountFields}
          onClose={() => setShowAccountPanel(false)}
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccount}
        />
      )}
    </div>
  );
}

// ============================================================
// TELAS
// ============================================================
// ============================================================
// CROP DE LOGO
// ============================================================
function ImageCropModal({ src, onConfirm, onCancel }) {
  const CROP = 200;
  const canvasRef = useRef(null);
  const imgRef = useRef(new Image());
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const drag = useRef({ active: false, sx: 0, sy: 0, spx: 0, spy: 0 });

  useEffect(() => {
    const img = imgRef.current;
    img.onload = () => {
      const fit = CROP / Math.min(img.naturalWidth, img.naturalHeight);
      setZoom(fit);
      setPan({ x: 0, y: 0 });
      setLoaded(true);
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    if (!loaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = imgRef.current;
    ctx.clearRect(0, 0, CROP, CROP);
    ctx.save();
    ctx.beginPath();
    ctx.arc(CROP / 2, CROP / 2, CROP / 2, 0, Math.PI * 2);
    ctx.clip();
    const sw = img.naturalWidth * zoom;
    const sh = img.naturalHeight * zoom;
    ctx.drawImage(img, (CROP - sw) / 2 + pan.x, (CROP - sh) / 2 + pan.y, sw, sh);
    ctx.restore();
    ctx.strokeStyle = 'rgba(212,162,60,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CROP / 2, CROP / 2, CROP / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [pan, zoom, loaded]);

  const onMD = e => { drag.current = { active: true, sx: e.clientX, sy: e.clientY, spx: pan.x, spy: pan.y }; };
  const onMM = e => {
    if (!drag.current.active) return;
    setPan({ x: drag.current.spx + e.clientX - drag.current.sx, y: drag.current.spy + e.clientY - drag.current.sy });
  };
  const onMU = () => { drag.current.active = false; };

  const confirm = () => {
    const out = document.createElement('canvas');
    out.width = 120; out.height = 120;
    const ctx = out.getContext('2d');
    const img = imgRef.current;
    const sc = 120 / CROP;
    ctx.save();
    ctx.beginPath();
    ctx.arc(60, 60, 60, 0, Math.PI * 2);
    ctx.clip();
    const sw = img.naturalWidth * zoom * sc;
    const sh = img.naturalHeight * zoom * sc;
    ctx.drawImage(img, ((CROP - img.naturalWidth * zoom) / 2 + pan.x) * sc, ((CROP - img.naturalHeight * zoom) / 2 + pan.y) * sc, sw, sh);
    ctx.restore();
    onConfirm(out.toDataURL('image/png'));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700 }}>Recortar logo do time</div>
      <div style={{ fontSize: 12, opacity: 0.5 }}>Arraste para reposicionar · Use o slider para zoom</div>
      <canvas
        ref={canvasRef} width={CROP} height={CROP}
        style={{ borderRadius: '50%', cursor: 'grab', display: 'block' }}
        onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, opacity: 0.45 }}>−</span>
        <input type="range" min="0.3" max="4" step="0.05" value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          style={{ width: 160, accentColor: '#d4a23c' }}
        />
        <span style={{ fontSize: 12, opacity: 0.45 }}>+</span>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onCancel} style={{ padding: '10px 22px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#F4F1EA', cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
        <button onClick={confirm} style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: '#d4a23c', color: '#0B1A12', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Confirmar recorte</button>
      </div>
    </div>
  );
}

// ============================================================
// CONTA — modal de entrada (cadastro / login / convidado)
// ============================================================
function AccountModal({ mode: initialMode = 'choice', onGuestChoice, onAuthSuccess, onClose, allowClose }) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (mode === 'signup' && !username.trim()) { setError('Escolha um nome de usuário.'); return; }
    if (!email.trim() || !password) { setError('Preencha email e senha.'); return; }
    setLoading(true);
    try {
      const result = mode === 'signup' ? await api.signup(username, email, password) : await api.login(email, password);
      onAuthSuccess(result);
    } catch (err) {
      setError(err.message || 'Algo deu errado. Tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, position: 'relative' }}>
        {allowClose && (
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        )}

        {mode === 'choice' && (
          <>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Bem-vindo!</div>
            <p style={{ fontSize: 13, opacity: 0.6, textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
              Crie uma conta pra salvar seu time e acessar de qualquer lugar, ou jogue como convidado sem compromisso.
            </p>
            <button onClick={() => setMode('signup')} style={{ ...styles.btnIntro, width: '100%', background: '#d4a23c', color: '#0B1A12', marginBottom: 10 }}>Criar conta</button>
            <button onClick={() => setMode('login')} style={{ ...styles.btnGhost, marginTop: 0, marginBottom: 10 }}>Já tenho conta</button>
            <button onClick={onGuestChoice} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, padding: '8px 0', cursor: 'pointer' }}>
              Jogar como convidado →
            </button>
          </>
        )}

        {(mode === 'signup' || mode === 'login') && (
          <>
            <button onClick={() => setMode('choice')} style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 14px 0' }}>&#8592; Voltar</button>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, marginBottom: 18 }}>
              {mode === 'signup' ? 'Criar conta' : 'Entrar'}
            </div>
            {mode === 'signup' && (
              <input
                value={username} onChange={e => setUsername(e.target.value)} placeholder="Nome de usuário"
                autoFocus maxLength={20} style={{ ...styles.teamInput, marginBottom: 10 }}
              />
            )}
            <input
              value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
              autoFocus={mode !== 'signup'} style={{ ...styles.teamInput, marginBottom: 10 }}
            />
            <input
              value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha (mín. 6 caracteres)" type="password"
              onKeyDown={e => e.key === 'Enter' && submit()}
              style={{ ...styles.teamInput, marginBottom: 14 }}
            />
            {error && <div style={{ color: '#e05050', fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <button onClick={submit} disabled={loading} style={{ ...styles.btnIntro, width: '100%', background: '#d4a23c', color: '#0B1A12', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Aguarde…' : mode === 'signup' ? 'Criar conta' : 'Entrar'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Barrinhas de equalizador — indicador de "tocando agora" reaproveitável.
function EqBars({ color = '#d4a23c', height = 12 }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height, flexShrink: 0 }}>
      {[6, 10, 7, 12, 5, 9, 7, 11, 6].map((h, i) => (
        <div key={i} style={{ width: 3, height: h * (height / 12), borderRadius: 2, background: color, animation: `pulse ${0.5 + i * 0.1}s ease-in-out infinite alternate`, opacity: 0.7 }} />
      ))}
    </div>
  );
}

// ============================================================
// CONTA — painel de edição (time, email/senha, excluir conta)
// ============================================================
function AccountPanel({ user, myTeamColor, myTeamLogo, onUpdateFields, onClose, onLogout, onDeleteAccount }) {
  const mc = myTeamColor || '#d4a23c';
  const fileInputRef = useRef(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [name, setName] = useState(user.team_name || '');
  const [city, setCity] = useState(user.team_city || '');
  const [coach, setCoach] = useState(user.team_coach || '');
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [credError, setCredError] = useState('');
  const [savingCred, setSavingCred] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [audioMode, setAudioMode] = useState('default'); // 'off' | 'default' | 'hino' | 'youtube'
  const [ytInput, setYtInput] = useState('');
  const [ytId, setYtId] = useState(null);

  const [goalAudioMode, setGoalAudioMode] = useState('idle'); // 'idle' | 'record' | 'link'
  const [goalAudioLinkInput, setGoalAudioLinkInput] = useState('');
  const [isRecordingGoal, setIsRecordingGoal] = useState(false);
  const [recordedGoalPreviewUrl, setRecordedGoalPreviewUrl] = useState(null);
  const [recordedGoalDataUrl, setRecordedGoalDataUrl] = useState(null);
  const [goalAudioError, setGoalAudioError] = useState('');
  const goalMediaRecorderRef = useRef(null);
  const goalRecordTimeoutRef = useRef(null);
  const goalAudioFileInputRef = useRef(null);

  const anthemClub = Object.entries(CLUB_LOGOS).find(([, url]) => url === myTeamLogo)?.[0];
  const anthemId = anthemClub && CLUB_ANTHEMS[anthemClub];

  useEffect(() => {
    setName(user.team_name || '');
    setCity(user.team_city || '');
    setCoach(user.team_coach || '');
    setUsername(user.username);
    setEmail(user.email);
  }, [user]);

  const applyYoutube = () => {
    const id = parseYouTubeId(ytInput);
    if (id) setYtId(id);
  };

  const startGoalRecording = async () => {
    setGoalAudioError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          setRecordedGoalDataUrl(reader.result);
          setRecordedGoalPreviewUrl(URL.createObjectURL(blob));
        };
        reader.readAsDataURL(blob);
        setIsRecordingGoal(false);
      };
      goalMediaRecorderRef.current = mr;
      mr.start();
      setIsRecordingGoal(true);
      goalRecordTimeoutRef.current = setTimeout(() => { if (mr.state === 'recording') mr.stop(); }, 5000);
    } catch {
      setGoalAudioError('Não foi possível acessar o microfone.');
    }
  };
  const stopGoalRecording = () => {
    clearTimeout(goalRecordTimeoutRef.current);
    if (goalMediaRecorderRef.current?.state === 'recording') goalMediaRecorderRef.current.stop();
  };
  const saveGoalRecording = async () => {
    if (!recordedGoalDataUrl) return;
    await commitField('goal_audio', recordedGoalDataUrl);
    setRecordedGoalDataUrl(null);
    setRecordedGoalPreviewUrl(null);
    setGoalAudioMode('idle');
  };
  const discardGoalRecording = () => {
    setRecordedGoalDataUrl(null);
    setRecordedGoalPreviewUrl(null);
  };
  const applyGoalAudioLink = () => {
    const url = goalAudioLinkInput.trim();
    if (!url) return;
    commitField('goal_audio', url);
    setGoalAudioMode('idle');
    setGoalAudioLinkInput('');
  };
  const handleGoalAudioFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => commitField('goal_audio', reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const removeGoalAudio = () => commitField('goal_audio', null);

  const commitField = async (field, value) => {
    setError('');
    try { await onUpdateFields({ [field]: value }); }
    catch (err) { setError(err.message || 'Erro ao salvar.'); }
  };

  const handleFileChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    e.target.value = '';
  };

  const saveCredentials = async () => {
    setCredError('');
    const fields = {};
    const normalizedUsername = username.trim();
    if (normalizedUsername && normalizedUsername !== user.username) fields.username = normalizedUsername;
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail && normalizedEmail !== user.email) fields.email = normalizedEmail;
    if (password) fields.password = password;
    if (Object.keys(fields).length === 0) return;
    setSavingCred(true);
    try {
      await onUpdateFields(fields);
      setPassword('');
    } catch (err) {
      setCredError(err.message || 'Erro ao salvar.');
    } finally {
      setSavingCred(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try { await onDeleteAccount(); }
    catch (err) { setError(err.message || 'Erro ao excluir conta.'); setDeleting(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onConfirm={dataUrl => { setCropSrc(null); commitField('team_logo', dataUrl); }}
          onCancel={() => setCropSrc(null)}
        />
      )}
      <div style={{ width: '100%', maxWidth: 460, background: '#0f1f15', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{user.username}</div>
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 20 }}>{user.email}</div>

        <div style={styles.teamEditCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 76, height: 76, borderRadius: 16,
                  background: hexToRgba(mc, 0.15),
                  border: `2px dashed ${hexToRgba(mc, 0.6)}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', overflow: 'hidden', position: 'relative',
                }}
              >
                {myTeamLogo
                  ? <img src={myTeamLogo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 32, opacity: 0.4 }}>📷</span>
                }
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: 11, fontWeight: 600, color: mc, background: hexToRgba(mc, 0.12), border: `1px solid ${hexToRgba(mc, 0.3)}`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
              >
                📷 Upload logo
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            {myTeamLogo && (
              <button onClick={() => commitField('team_logo', null)} style={{ fontSize: 11, color: '#e05050', background: 'none', border: '1px solid rgba(224,80,80,0.3)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                Remover logo
              </button>
            )}
          </div>

          <div style={styles.teamEditSep} />

          <div style={styles.teamEditSection}>
            <div style={styles.teamEditLabel}>Emblema do clube</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(CLUB_LOGOS).map(([club, url]) => (
                <button
                  key={club}
                  onClick={() => commitField('team_logo', myTeamLogo === url ? null : url)}
                  title={club}
                  style={{
                    width: 44, height: 44, borderRadius: 10, padding: 5,
                    border: `2px solid ${myTeamLogo === url ? mc : 'rgba(255,255,255,0.08)'}`,
                    background: myTeamLogo === url ? hexToRgba(mc, 0.15) : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  <img src={url} alt={club} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </button>
              ))}
            </div>
          </div>

          <div style={styles.teamEditSection}>
            <div style={styles.teamEditLabel}>Cor principal</div>
            <div style={styles.colorGrid}>
              {TEAM_COLORS.map(c => (
                <button key={c} onClick={() => commitField('team_color', c)} style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: c,
                  border: `3px solid ${mc === c ? '#fff' : 'transparent'}`,
                  outline: mc === c ? `2px solid ${c}` : 'none',
                  outlineOffset: 2,
                  cursor: 'pointer', transition: 'all 0.12s', padding: 0,
                }} />
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={styles.teamEditLabel}>Nome do time</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                onBlur={() => name !== (user.team_name || '') && commitField('team_name', name)}
                placeholder="Meu Time" maxLength={24} style={styles.teamInput}
              />
            </div>
            <div>
              <label style={styles.teamEditLabel}>Cidade</label>
              <input
                value={city} onChange={e => setCity(e.target.value)}
                onBlur={() => city !== (user.team_city || '') && commitField('team_city', city)}
                placeholder="Ex: São Paulo" maxLength={20} style={styles.teamInput}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={styles.teamEditLabel}>Técnico</label>
              <input
                value={coach} onChange={e => setCoach(e.target.value)}
                onBlur={() => coach !== (user.team_coach || '') && commitField('team_coach', coach)}
                placeholder="Seu nome" maxLength={24} style={styles.teamInput}
              />
            </div>
          </div>
        </div>

        {/* Áudio ambiente — trilha padrão, hino do clube ou link próprio */}
        <div style={{
          background: `linear-gradient(135deg, ${hexToRgba(mc, 0.14)}, rgba(0,0,0,0.4))`,
          border: `1px solid ${hexToRgba(mc, 0.3)}`,
          borderRadius: 16, padding: '18px 20px', marginBottom: 24, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 40px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, position: 'relative' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: hexToRgba(mc, 0.18), border: `1px solid ${hexToRgba(mc, 0.4)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎙️</div>
            <div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: mc, fontWeight: 700 }}>Transmissão</div>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 700 }}>Áudio ambiente</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8, position: 'relative' }}>
            <button
              onClick={() => setAudioMode(m => m === 'default' ? 'off' : 'default')}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${audioMode === 'default' ? hexToRgba(mc, 0.5) : 'rgba(255,255,255,0.1)'}`,
                background: audioMode === 'default' ? hexToRgba(mc, 0.12) : 'rgba(255,255,255,0.03)',
                color: '#F4F1EA', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 18 }}>🎵</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Trilha padrão</div>
                <div style={{ fontSize: 11, opacity: 0.55 }}>Som ambiente clássico do jogo</div>
              </div>
              {audioMode === 'default' && <EqBars color={mc} />}
            </button>

            <button
              onClick={() => anthemId && setAudioMode(m => m === 'hino' ? 'off' : 'hino')}
              disabled={!anthemId}
              title={!anthemId ? 'Escolha um emblema de clube oficial acima pra liberar o hino' : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', borderRadius: 10, cursor: anthemId ? 'pointer' : 'not-allowed',
                border: `1px solid ${audioMode === 'hino' ? hexToRgba(mc, 0.5) : 'rgba(255,255,255,0.1)'}`,
                background: audioMode === 'hino' ? hexToRgba(mc, 0.12) : 'rgba(255,255,255,0.03)',
                color: '#F4F1EA', textAlign: 'left', transition: 'all 0.15s', opacity: anthemId ? 1 : 0.45,
              }}
            >
              <span style={{ fontSize: 18 }}>🏆</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Hino {anthemClub ? `do ${anthemClub.replace(/-/g, ' ')}` : 'do seu time'}</div>
                <div style={{ fontSize: 11, opacity: 0.55 }}>{anthemId ? 'Hino oficial do clube' : 'Escolha um emblema oficial acima pra liberar'}</div>
              </div>
              {audioMode === 'hino' && anthemId && <EqBars color={mc} />}
            </button>

            <button
              onClick={() => setAudioMode(m => m === 'youtube' ? 'off' : 'youtube')}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${audioMode === 'youtube' ? hexToRgba(mc, 0.5) : 'rgba(255,255,255,0.1)'}`,
                background: audioMode === 'youtube' ? hexToRgba(mc, 0.12) : 'rgba(255,255,255,0.03)',
                color: '#F4F1EA', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 18 }}>🔗</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Link personalizado</div>
                <div style={{ fontSize: 11, opacity: 0.55 }}>Cole um link do YouTube</div>
              </div>
              {audioMode === 'youtube' && ytId && <EqBars color={mc} />}
            </button>
          </div>

          {audioMode === 'youtube' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, position: 'relative' }}>
              <input
                value={ytInput} onChange={e => setYtInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyYoutube()}
                placeholder="Link do YouTube…" style={{ ...styles.teamInput, flex: 1, margin: 0 }}
              />
              <button onClick={applyYoutube} style={{ background: mc, color: '#0B1A12', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Tocar
              </button>
            </div>
          )}
          {audioMode === 'youtube' && !ytId && ytInput && (
            <div style={{ fontSize: 11, color: '#e05050', marginTop: 6, position: 'relative' }}>Link inválido — cole um link do YouTube ou ID de 11 caracteres.</div>
          )}

          {audioMode === 'default' && (
            <audio key="acc-default-bg" src="/audio.mp3" autoPlay loop style={{ display: 'none' }} />
          )}
          {audioMode === 'hino' && anthemId && (
            <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
              <iframe key={anthemId} width="1" height="1" src={`https://www.youtube.com/embed/${anthemId}?autoplay=1&controls=0`} allow="autoplay; encrypted-media" title={`Hino ${anthemClub}`} />
            </div>
          )}
          {audioMode === 'youtube' && ytId && (
            <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
              <iframe key={ytId} width="1" height="1" src={`https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0`} allow="autoplay; encrypted-media" title="Áudio ambiente" />
            </div>
          )}
        </div>

        {/* Áudio de gol do meu time — grava, cola link ou envia arquivo */}
        <div style={{
          background: `linear-gradient(135deg, ${hexToRgba(mc, 0.14)}, rgba(0,0,0,0.4))`,
          border: `1px solid ${hexToRgba(mc, 0.3)}`,
          borderRadius: 16, padding: '18px 20px', marginBottom: 24, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: hexToRgba(mc, 0.18), border: `1px solid ${hexToRgba(mc, 0.4)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>⚽</div>
            <div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: mc, fontWeight: 700 }}>Comemoração</div>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 700 }}>Áudio de gol do meu time</div>
            </div>
          </div>

          {user.goal_audio ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.7, flex: 1 }}>Áudio personalizado configurado</span>
              <button onClick={() => { const a = new Audio(user.goal_audio); a.play().catch(() => {}); }} style={{ fontSize: 11, color: mc, background: 'none', border: `1px solid ${hexToRgba(mc, 0.4)}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>▶ Testar</button>
              <button onClick={removeGoalAudio} style={{ fontSize: 11, color: '#e05050', background: 'none', border: '1px solid rgba(224,80,80,0.3)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>Remover</button>
            </div>
          ) : (
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 12 }}>Sem áudio personalizado — toca o som padrão do clube (quando disponível) ao marcar gol.</div>
          )}

          <div style={{ display: 'grid', gap: 8 }}>
            <button
              onClick={() => setGoalAudioMode(m => m === 'record' ? 'idle' : 'record')}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${goalAudioMode === 'record' ? hexToRgba(mc, 0.5) : 'rgba(255,255,255,0.1)'}`,
                background: goalAudioMode === 'record' ? hexToRgba(mc, 0.12) : 'rgba(255,255,255,0.03)',
                color: '#F4F1EA', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 18 }}>🎙️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Gravar</div>
                <div style={{ fontSize: 11, opacity: 0.55 }}>Grave até 5 segundos pelo microfone</div>
              </div>
            </button>

            <button
              onClick={() => setGoalAudioMode(m => m === 'link' ? 'idle' : 'link')}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${goalAudioMode === 'link' ? hexToRgba(mc, 0.5) : 'rgba(255,255,255,0.1)'}`,
                background: goalAudioMode === 'link' ? hexToRgba(mc, 0.12) : 'rgba(255,255,255,0.03)',
                color: '#F4F1EA', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 18 }}>🔗</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Link de áudio</div>
                <div style={{ fontSize: 11, opacity: 0.55 }}>Cole a URL direta de um arquivo de áudio</div>
              </div>
            </button>

            <button
              onClick={() => goalAudioFileInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                color: '#F4F1EA', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 18 }}>📁</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Enviar arquivo</div>
                <div style={{ fontSize: 11, opacity: 0.55 }}>Escolha um arquivo de áudio do seu dispositivo</div>
              </div>
            </button>
            <input ref={goalAudioFileInputRef} type="file" accept="audio/*" onChange={handleGoalAudioFile} style={{ display: 'none' }} />
          </div>

          {goalAudioMode === 'record' && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {!isRecordingGoal && !recordedGoalPreviewUrl && (
                <button onClick={startGoalRecording} style={{ ...styles.btnSmall, margin: 0 }}>● Iniciar gravação</button>
              )}
              {isRecordingGoal && (
                <button onClick={stopGoalRecording} style={{ ...styles.btnSmall, margin: 0, color: '#e05050', borderColor: 'rgba(224,80,80,0.4)' }}>■ Parar (gravando…)</button>
              )}
              {recordedGoalPreviewUrl && (
                <>
                  <audio src={recordedGoalPreviewUrl} controls style={{ height: 32 }} />
                  <button onClick={saveGoalRecording} style={{ ...styles.btnSmall, margin: 0 }}>Salvar</button>
                  <button onClick={discardGoalRecording} style={{ ...styles.btnSmall, margin: 0, color: '#e05050', borderColor: 'rgba(224,80,80,0.4)' }}>Descartar</button>
                </>
              )}
            </div>
          )}
          {goalAudioMode === 'link' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                value={goalAudioLinkInput} onChange={e => setGoalAudioLinkInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyGoalAudioLink()}
                placeholder="https://…/gol.mp3" style={{ ...styles.teamInput, flex: 1, margin: 0 }}
              />
              <button onClick={applyGoalAudioLink} style={{ background: mc, color: '#0B1A12', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Aplicar
              </button>
            </div>
          )}
          {goalAudioError && <div style={{ color: '#e05050', fontSize: 11, marginTop: 8 }}>{goalAudioError}</div>}
        </div>

        <div style={styles.teamEditSep} />

        <div style={styles.teamEditSection}>
          <div style={styles.teamEditLabel}>Usuário, email e senha</div>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Nome de usuário" maxLength={20} style={styles.teamInput} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={{ ...styles.teamInput, marginTop: 8 }} />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Nova senha (opcional)" style={{ ...styles.teamInput, marginTop: 8 }} />
          {credError && <div style={{ color: '#e05050', fontSize: 12, marginTop: 6 }}>{credError}</div>}
          <button onClick={saveCredentials} disabled={savingCred} style={{ ...styles.btnSmall, marginTop: 10 }}>
            {savingCred ? 'Salvando…' : 'Salvar'}
          </button>
        </div>

        {error && <div style={{ color: '#e05050', fontSize: 12, marginTop: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onLogout} style={{ ...styles.btnGhost, marginTop: 0, flex: 1 }}>Sair</button>
          <button onClick={handleDelete} disabled={deleting} style={{ ...styles.btnGhost, marginTop: 0, flex: 1, borderColor: 'rgba(224,80,80,0.4)', color: '#e05050' }}>
            {confirmDelete ? (deleting ? 'Excluindo…' : 'Confirmar exclusão?') : 'Excluir conta'}
          </button>
        </div>
      </div>
    </div>
  );
}

const TEAM_BADGES = ['⭐', '🔥', '🦅', '🐯', '🦁', '💎', '⚡', '🏆', '🌊', '🎯', '🛡️', '🌟'];
const TEAM_COLORS = ['#d4a23c', '#e05050', '#4a90d9', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#e91e8c'];

function parseYouTubeId(input) {
  if (!input) return null;
  const s = input.trim();
  // youtu.be/ID
  const short = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return short[1];
  // youtube.com/watch?v=ID
  const long = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (long) return long[1];
  // youtube.com/embed/ID
  const embed = s.match(/embed\/([A-Za-z0-9_-]{11})/);
  if (embed) return embed[1];
  // raw 11-char ID
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}

function Intro({ onStart, gameMode, onSetGameMode, myTeamColor, onMultiPlayer }) {
  const mc = myTeamColor || '#d4a23c';
  const carouselTeams = [...TEAMS, ...TEAMS]; // duplicado pra loop contínuo do carrossel

  return (
    <>
      <div style={styles.introCard} className="intro-card-mob">
        <div style={{ ...styles.introTopBar, background: `linear-gradient(90deg, transparent, ${mc}, transparent)` }} />
        <div style={styles.introBadge}>⚽ Futebol Brasileiro · 1959–2026</div>
        <h1 style={styles.introTitle} className="intro-title-h">Monte o time lendário dos seus sonhos.</h1>
        <p style={styles.introLead}>
          Sorteie os maiores times campeões do Brasileirão, escolha os melhores jogadores de cada era
          e dispute uma liga completa com cronômetro ao vivo.
        </p>

        <div style={styles.featGrid} className="feat-grid-3">
          <div style={styles.featCard} className="feat-card-hover">
            <span style={styles.featIndex}>01</span>
            <div style={{ ...styles.featIconWrap, background: hexToRgba(mc, 0.14), border: `1px solid ${hexToRgba(mc, 0.35)}` }}>🎲</div>
            <div style={styles.featTitle}>Role o dado</div>
            <div style={styles.featDesc}>Sorteie times campeões lendários. Recuse até 3 que não te interessar.</div>
          </div>
          <div style={styles.featCard} className="feat-card-hover">
            <span style={styles.featIndex}>02</span>
            <div style={{ ...styles.featIconWrap, background: hexToRgba(mc, 0.14), border: `1px solid ${hexToRgba(mc, 0.35)}` }}>🏟️</div>
            <div style={styles.featTitle}>Monte o Plantel</div>
            <div style={styles.featDesc}>Escolha 11 titulares e 5 reservas entre os maiores craques de cada era.</div>
          </div>
          <div style={styles.featCard} className="feat-card-hover">
            <span style={styles.featIndex}>03</span>
            <div style={{ ...styles.featIconWrap, background: hexToRgba(mc, 0.14), border: `1px solid ${hexToRgba(mc, 0.35)}` }}>🏆</div>
            <div style={styles.featTitle}>Dispute o título</div>
            <div style={styles.featDesc}>Liga com 20 times, 38 rodadas e gols aparecendo minuto a minuto.</div>
          </div>
        </div>

        <div style={styles.introSectionLabel}>{TEAMS.length} times lendários no elenco</div>
        <div style={styles.introMarqueeWrap}>
          <div style={styles.introMarqueeTrack} className="marquee-track">
            {carouselTeams.map((t, i) => (
              <div key={`${t.id}-${i}`} style={styles.introTeamChip}>
                {CLUB_LOGOS[t.club] && (
                  <img src={CLUB_LOGOS[t.club]} alt="" style={styles.introTeamChipCrest} onError={e => { e.currentTarget.style.display = 'none'; }} />
                )}
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* Modo de jogo */}
        <div style={{ marginBottom: 28 }}>
          <div style={styles.teamEditLabel}>Modo de jogo</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              {
                id: 'brasileirao',
                trophy: 'https://r2.thesportsdb.com/images/media/league/trophy/02ftjh1684945323.png',
                title: 'Brasileirão',
                sub: '20 times · 38 rodadas · Pontos corridos',
              },
              {
                id: 'copa',
                trophy: 'https://r2.thesportsdb.com/images/media/league/trophy/jv27c41776553182.png',
                title: 'Copa do Brasil',
                sub: '32 times · Mata-mata · Ida e volta',
              },
            ].map(m => (
              <button key={m.id} onClick={() => onSetGameMode(m.id)} style={{
                padding: '14px 12px', borderRadius: 12, border: '2px solid', position: 'relative',
                borderColor: gameMode === m.id ? mc : 'rgba(255,255,255,0.1)',
                background: gameMode === m.id ? hexToRgba(mc, 0.1) : 'rgba(255,255,255,0.03)',
                color: '#F4F1EA', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                boxShadow: gameMode === m.id ? `0 0 0 1px ${hexToRgba(mc, 0.15)} inset` : 'none',
              }}>
                {gameMode === m.id && (
                  <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: mc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#0B1A12' }}>✓</div>
                )}
                <img
                  src={m.trophy}
                  alt={m.title}
                  style={{ height: 40, objectFit: 'contain', marginBottom: 8, display: 'block' }}
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, color: gameMode === m.id ? mc : '#F4F1EA' }}>{m.title}</div>
                <div style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>{m.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Jogar com Amigos */}
        <button
          onClick={onMultiPlayer}
          style={{
            width: '100%', marginBottom: 20, padding: '14px 16px',
            borderRadius: 12, border: '2px solid rgba(127,217,154,0.35)',
            background: 'rgba(127,217,154,0.06)', color: '#7fd99a',
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 14,
          }}
        >
          <span style={{ fontSize: 28 }}>👥</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Jogar com Amigos</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Brasileirão (até 20) · Copa do Brasil (até 32) · Sala por código</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 18, opacity: 0.5 }}>→</span>
        </button>

        <button style={{ ...styles.btnIntro, background: `linear-gradient(135deg, ${mc}, ${mc}cc)`, color: '#0B1A12', boxShadow: `0 8px 24px ${hexToRgba(mc, 0.35)}` }} onClick={onStart}>
          {gameMode === 'copa' ? 'Escolher formação — Copa →' : 'Escolher formação — Brasileirão →'}
        </button>
      </div>
    </>
  );
}

// ============================================================
// TELAS MULTIPLAYER
// ============================================================
function MultiLobby({ gameMode, onSetGameMode, myTeamName, myTeamColor, myTeamLogo, joinInput, onJoinInput, onCreateRoom, onJoinRoom, connecting, error, onBack }) {
  const mc = myTeamColor || '#d4a23c';
  return (
    <div style={styles.card} className="card-mob">
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>← Voltar</button>
      <div style={styles.eyebrow}>Multiplayer</div>
      <h2 style={styles.h2}>Jogar com Amigos</h2>

      <div style={{ marginBottom: 20 }}>
        <div style={styles.teamEditLabel}>Modo de jogo</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { id: 'brasileirao', label: 'Brasileirão', sub: 'Até 20 jogadores', trophy: 'https://r2.thesportsdb.com/images/media/league/trophy/02ftjh1684945323.png' },
            { id: 'copa', label: 'Copa do Brasil', sub: 'Até 32 jogadores', trophy: 'https://r2.thesportsdb.com/images/media/league/trophy/jv27c41776553182.png' },
          ].map(m => (
            <button key={m.id} onClick={() => onSetGameMode(m.id)} style={{
              padding: '12px', borderRadius: 12, border: '2px solid',
              borderColor: gameMode === m.id ? mc : 'rgba(255,255,255,0.1)',
              background: gameMode === m.id ? hexToRgba(mc, 0.1) : 'rgba(255,255,255,0.03)',
              color: '#F4F1EA', cursor: 'pointer', textAlign: 'left',
            }}>
              <img src={m.trophy} alt={m.label} style={{ height: 32, objectFit: 'contain', marginBottom: 6, display: 'block' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
              <div style={{ fontWeight: 700, fontSize: 13, color: gameMode === m.id ? mc : '#F4F1EA' }}>{m.label}</div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>{m.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <button
        style={{ ...styles.btnPrimary, width: '100%', background: mc, color: '#0B1A12', marginBottom: 12, opacity: connecting ? 0.7 : 1 }}
        onClick={onCreateRoom}
        disabled={connecting}
      >
        {connecting ? '⏳ Conectando…' : '✦ Criar sala'}
      </button>
      {error && (
        <div style={{ fontSize: 12, color: '#e05050', background: 'rgba(224,80,80,0.08)', border: '1px solid rgba(224,80,80,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: 12, opacity: 0.4 }}>ou</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={joinInput}
          onChange={e => onJoinInput(e.target.value.trim())}
          onKeyDown={e => e.key === 'Enter' && onJoinRoom()}
          placeholder="Cole o código da sala aqui…"
          style={{ ...styles.teamInput, flex: 1, margin: 0, fontFamily: 'monospace', fontSize: 13 }}
        />
        <button onClick={onJoinRoom} style={{ ...styles.btnPrimary, margin: 0, padding: '0 18px', whiteSpace: 'nowrap' }}>
          Entrar
        </button>
      </div>
      <div style={{ fontSize: 11, opacity: 0.4, marginTop: 6, textAlign: 'center' }}>Cole o código que o criador da sala compartilhou</div>
    </div>
  );
}

function RoomScreen({ roomCode, roomData, myId, isLeader, myTeamName, myTeamColor, myTeamLogo, myTeamCoach, myTeamCity, onSetName, onSetColor, onSetLogo, onSetCoach, onSetCity, onSetTimer, onStartSetup, onStartSimulation, onReady, timerLeft, onBack }) {
  const mc = myTeamColor || '#d4a23c';
  const players = Object.entries(roomData.players || {});
  const allReady = players.length > 0 && players.every(([, p]) => p.ready);
  const myData = roomData.players?.[myId] || {};
  const isSetupPhase = roomData.phase === 'team-setup';
  const timerMinutes = roomData.timerMinutes || 3;
  const maxSlots = roomData.gameMode === 'copa' ? 32 : 20;
  const emptySlots = Math.max(0, maxSlots - players.length);

  // Revelação sequencial dos times fictícios sorteados ao iniciar
  const [revealNames, setRevealNames] = React.useState({});
  const seenAiIds = React.useRef(new Set());
  React.useEffect(() => {
    const aiIds = players.filter(([, p]) => p.isAI).map(([pid]) => pid);
    const freshIds = aiIds.filter(pid => !seenAiIds.current.has(pid));
    if (freshIds.length === 0) return;
    freshIds.forEach((pid, idx) => {
      seenAiIds.current.add(pid);
      const startDelay = idx * 130;
      setTimeout(() => {
        let step = 0;
        const totalSteps = 5;
        const iv = setInterval(() => {
          step++;
          if (step >= totalSteps) {
            clearInterval(iv);
            setRevealNames(prev => { const next = { ...prev }; delete next[pid]; return next; });
          } else {
            const decoy = TEAMS[Math.floor(Math.random() * TEAMS.length)].label;
            setRevealNames(prev => ({ ...prev, [pid]: decoy }));
          }
        }, 90);
      }, startDelay);
    });
  }, [players.map(([pid]) => pid).join(',')]);

  const [copied, setCopied] = React.useState(false);
  const copyCode = () => {
    const code = roomData.leaderPeerId || roomCode;
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileRef = React.useRef(null);
  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onSetLogo(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div style={styles.card} className="card-mob">
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>← Sair da sala</button>

      {/* Código da sala */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={styles.eyebrow}>{roomData.gameMode === 'copa' ? 'Copa do Brasil' : 'Brasileirão'} · Sala</div>
        {isLeader && roomData.leaderPeerId && (
          <>
            <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: mc, margin: '10px 0 6px', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 14px', letterSpacing: 1 }}>
              {roomData.leaderPeerId}
            </div>
            <button onClick={copyCode} style={{ fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 14px', color: copied ? '#7fd99a' : '#aaa', cursor: 'pointer' }}>
              {copied ? '✓ Copiado!' : '📋 Copiar código'}
            </button>
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 6 }}>Envie este código para seus amigos entrarem na sala</div>
          </>
        )}
        {!isLeader && (
          <div style={{ fontSize: 13, opacity: 0.5, marginTop: 8 }}>Conectado à sala · Aguardando o líder iniciar</div>
        )}
      </div>

      {/* Timer (só líder vê os botões) */}
      {isLeader && !isSetupPhase && (
        <div style={{ marginBottom: 16 }}>
          <div style={styles.teamEditLabel}>Tempo para criar o time</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[3, 4, 5].map(m => (
              <button key={m} onClick={() => onSetTimer(m)} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: '2px solid',
                borderColor: timerMinutes === m ? mc : 'rgba(255,255,255,0.12)',
                background: timerMinutes === m ? hexToRgba(mc, 0.12) : 'transparent',
                color: timerMinutes === m ? mc : '#aaa', cursor: 'pointer', fontWeight: 700, fontSize: 14,
              }}>
                {m} min
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Configurar time */}
      {isSetupPhase && (
        <div style={{ marginBottom: 16, padding: 14, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={styles.teamEditLabel}>Seu time</div>
            {timerLeft !== null && (
              <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: timerLeft < 30 ? '#e05050' : mc }}>
                {String(Math.floor(timerLeft / 60)).padStart(2, '0')}:{String(timerLeft % 60).padStart(2, '0')}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={styles.teamEditLabel}>Nome</label>
              <input value={myTeamName} onChange={e => onSetName(e.target.value)} placeholder="Meu Time" style={styles.teamInput} />
            </div>
            <div>
              <label style={styles.teamEditLabel}>Cidade</label>
              <input value={myTeamCity} onChange={e => onSetCity(e.target.value)} placeholder="Cidade" style={styles.teamInput} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={styles.teamEditLabel}>Técnico</label>
              <input value={myTeamCoach} onChange={e => onSetCoach(e.target.value)} placeholder="Seu nome" style={styles.teamInput} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={styles.teamEditLabel}>Cor</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['#d4a23c', '#e05050', '#4a90d9', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#e91e8c'].map(c => (
                <button key={c} onClick={() => onSetColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${myTeamColor === c ? '#fff' : 'transparent'}`, outline: myTeamColor === c ? `2px solid ${c}` : 'none', outlineOffset: 2, cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={styles.teamEditLabel}>Emblema do clube</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(CLUB_LOGOS).map(([club, url]) => (
                <button key={club} onClick={() => onSetLogo(myTeamLogo === url ? null : url)} title={club} style={{ width: 38, height: 38, borderRadius: 8, padding: 4, border: `2px solid ${myTeamLogo === url ? mc : 'rgba(255,255,255,0.08)'}`, background: myTeamLogo === url ? hexToRgba(mc, 0.15) : 'rgba(255,255,255,0.03)', cursor: 'pointer' }}>
                  <img src={url} alt={club} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.2)', background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>
              📷 Upload logo
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            {!myData.ready && (
              <button onClick={onReady} style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none', background: mc, color: '#0B1A12', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                ✓ Pronto!
              </button>
            )}
            {myData.ready && (
              <div style={{ flex: 2, padding: '8px', borderRadius: 8, background: 'rgba(127,217,154,0.12)', color: '#7fd99a', fontWeight: 700, textAlign: 'center', fontSize: 13 }}>
                ✓ Pronto!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid de vagas — jogadores reais + vagas aguardando + times fictícios sorteados */}
      <div style={{ marginBottom: 16 }}>
        <div style={styles.sectionLabel}>Vagas ({players.length}/{maxSlots})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {players.map(([pid, p]) => {
            const isRevealing = pid in revealNames;
            const displayName = isRevealing ? revealNames[pid] : (p.name || 'Jogador');
            return (
              <div key={pid} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10,
                border: `1px solid ${p.isAI ? 'rgba(255,255,255,0.1)' : hexToRgba(mc, 0.25)}`,
                background: p.isAI ? 'rgba(255,255,255,0.03)' : hexToRgba(mc, 0.06),
              }}>
                {p.logo
                  ? <img src={p.logo} alt="" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'contain', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
                  : <div style={{ width: 28, height: 28, borderRadius: 7, background: p.color || '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>⚽</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: p.color || '#F4F1EA',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    opacity: isRevealing ? 0.55 : 1, transition: 'opacity 0.08s',
                  }}>
                    {displayName}
                  </div>
                  {p.isAI && !isRevealing && <div style={{ fontSize: 9.5, opacity: 0.4, letterSpacing: 0.5 }}>TIME SORTEADO</div>}
                  {pid === roomData.leaderId && !p.isAI && <div style={{ fontSize: 9.5, color: '#d4a23c' }}>LÍDER</div>}
                </div>
                {!isRevealing && <span style={{ fontSize: 13, flexShrink: 0 }}>{p.ready ? '✅' : '⏳'}</span>}
              </div>
            );
          })}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`empty-${i}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 10px',
              borderRadius: 10, border: '1px dashed rgba(255,255,255,0.15)', minHeight: 44,
            }}>
              <span style={{ fontSize: 11.5, opacity: 0.35 }}>Aguardando…</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ações do líder */}
      {isLeader && !isSetupPhase && (
        <button
          onClick={onStartSetup}
          disabled={players.length < 2}
          style={{ ...styles.btnPrimary, width: '100%', background: mc, color: '#0B1A12', opacity: players.length < 2 ? 0.5 : 1 }}
        >
          {players.length < 2
            ? 'Aguardando mais jogadores... (mín. 2)'
            : emptySlots > 0
              ? `▶ Iniciar — sorteia ${emptySlots} time${emptySlots !== 1 ? 's' : ''} pras vagas restantes`
              : `▶ Iniciar — ${timerMinutes} min para criar o time`}
        </button>
      )}
      {!isLeader && !isSetupPhase && (
        <div style={{ textAlign: 'center', fontSize: 13, opacity: 0.5, padding: 12 }}>
          Aguardando o líder iniciar a partida…
        </div>
      )}
      {isSetupPhase && isLeader && allReady && (
        <button onClick={onStartSimulation} style={{ ...styles.btnPrimary, width: '100%', background: '#27ae60', color: '#fff', marginTop: 8 }}>
          Todos prontos — Iniciar simulação →
        </button>
      )}
    </div>
  );
}

function MultiWaitingScreen({ roomData, myId, isLeader, myTeamColor, onSimulate }) {
  const mc = myTeamColor || '#d4a23c';
  const players = Object.entries(roomData.players || {});
  const readyCount = players.filter(([, p]) => p.ready).length;
  const allReady = readyCount === players.length && players.length > 0;

  return (
    <div style={styles.card} className="card-mob">
      <div style={{ textAlign: 'center', padding: '16px 0 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
        <div style={styles.eyebrow}>Time montado!</div>
        <h2 style={styles.h2}>Aguardando os outros jogadores…</h2>
        <div style={{ fontSize: 13, opacity: 0.5, marginTop: 4 }}>{readyCount} de {players.length} prontos</div>
      </div>

      <div style={{ marginBottom: 20 }}>
        {players.map(([pid, p]) => (
          <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {p.logo
              ? <img src={p.logo} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', background: 'rgba(255,255,255,0.05)' }} />
              : <div style={{ width: 32, height: 32, borderRadius: 8, background: p.color || '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⚽</div>
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: p.color || '#F4F1EA' }}>{p.name || 'Jogador'}</div>
              {p.ovr > 0 && <div style={{ fontSize: 11, opacity: 0.5 }}>OVR {p.ovr}</div>}
            </div>
            {pid === myId && <span style={{ fontSize: 10, color: '#aaa', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '1px 6px' }}>VOCÊ</span>}
            <span style={{ fontSize: 16 }}>{p.ready ? '✅' : '⏳'}</span>
          </div>
        ))}
      </div>

      {isLeader && allReady && (
        <button onClick={onSimulate} style={{ ...styles.btnPrimary, width: '100%', background: '#27ae60', color: '#fff' }}>
          Todos prontos — Iniciar campeonato! →
        </button>
      )}
      {isLeader && !allReady && (
        <div style={{ textAlign: 'center', fontSize: 13, opacity: 0.4 }}>Aguardando todos terminarem o draft…</div>
      )}
      {!isLeader && (
        <div style={{ textAlign: 'center', fontSize: 13, opacity: 0.4 }}>Aguardando o líder iniciar o campeonato…</div>
      )}
    </div>
  );
}

// ============================================================
// FIM DAS TELAS MULTIPLAYER
// ============================================================
const FORMATION_GROUPS = [
  { prefix: '4', title: 'Linha de 4 zagueiros', icon: '🛡️', hint: 'Equilíbrio clássico entre defesa e ataque' },
  { prefix: '3', title: 'Linha de 3 zagueiros', icon: '⚔️', hint: 'Mais volume ofensivo, alas cobrindo as laterais' },
  { prefix: '5', title: 'Linha de 5 zagueiros', icon: '🔒', hint: 'Retranca — prioriza solidez defensiva' },
];

function FormationPicker({ onChoose, onBack }) {
  const groups = useMemo(() => (
    FORMATION_GROUPS
      .map(g => ({ ...g, items: Object.entries(FORMATIONS).filter(([key]) => key.split('-')[0] === g.prefix) }))
      .filter(g => g.items.length > 0)
  ), []);
  const total = Object.keys(FORMATIONS).length;

  return (
    <div style={styles.card} className="card-mob">
      {onBack && <button onClick={onBack} style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 10px 0' }}>&#8592; Voltar</button>}
      <div style={styles.eyebrow}>Passo 1 de 2</div>
      <h2 style={styles.h2}>Escolha o esquema tático</h2>
      <p style={styles.formationIntro}>
        {total} esquemas táticos à sua escolha, organizados pela linha de defesa. Cada posição no campinho
        já mostra a cor da função — goleiro, zaga, meio ou ataque.
      </p>

      {groups.map(g => (
        <div key={g.prefix} style={{ marginBottom: 28 }}>
          <div style={styles.formationSectionHead}>
            <span style={styles.formationSectionTitle}><span>{g.icon}</span>{g.title}</span>
            <span style={styles.formationSectionHint}>{g.hint}</span>
          </div>
          <div style={styles.formationGrid} className="formation-grid">
            {g.items.map(([key, f]) => {
              const m = f.label.match(/^([\d-]+)\s*(.*)$/);
              const shape = m ? m[1] : f.label;
              const desc = m ? m[2] : '';
              return (
                <button key={key} className="formation-card" style={styles.formationCard} onClick={() => onChoose(key)}>
                  <div style={styles.formationShapeNum}>{shape}</div>
                  <div style={styles.formationShapeDesc}>{desc}</div>
                  <MiniPitchPreview formationKey={key} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Cores por função tática — a mesma lógica usada no campo cheio (Pitch), pra
// ficar consistente do início (escolha do esquema) ao fim (escalação).
const POS_GROUP_COLOR = {
  GOL: '#F4F1EA',
  LD: '#4a90d9', ZAG: '#4a90d9', LE: '#4a90d9',
  // VOL (volante, mais recuado/destruidor) ganha um tom mais escuro que o
  // resto do meio — senão, colado perto do MC/MEI, fica impossível
  // diferenciar um do outro só pela cor.
  VOL: '#a67a2e',
  MC: '#d4a23c', MEI: '#d4a23c', MD: '#d4a23c', ME: '#d4a23c',
  PD: '#e05050', PE: '#e05050', ATA: '#e05050',
};

// Ordem fixa de exibição por posição primária (lista de jogadores no Draft).
const POS_ORDER = ['GOL', 'LD', 'ZAG', 'LE', 'VOL', 'MC', 'MD', 'ME', 'MEI', 'PD', 'ATA', 'PE'];
const posOrderIndex = (pos) => {
  const i = POS_ORDER.indexOf(pos);
  return i === -1 ? POS_ORDER.length : i;
};

function MiniPitchPreview({ formationKey }) {
  const slots = useMemo(() => buildPitchSlots(formationKey), [formationKey]);
  return (
    <div style={styles.miniPitch}>
      <div style={styles.miniPitchHalfLine} />
      <div style={styles.miniPitchCircle} />
      <div style={styles.miniPitchCenterDot} />
      <div style={styles.miniPitchArcTop} />
      <div style={styles.miniPitchArcBottom} />
      {slots.map((s, i) => (
        <div
          key={i}
          title={s.realPos}
          style={{ ...styles.miniDot, left: `${s.x}%`, top: `${s.y}%`, background: POS_GROUP_COLOR[s.realPos] || '#d4a23c' }}
        >
          <span style={styles.miniDotLabel}>{s.realPos}</span>
        </div>
      ))}
    </div>
  );
}

function Pitch({ pitch, pitchSlots, highlightSlots = [], onClickSlot, onUnplace, myTeamColor, captainSlot }) {
  const mc = myTeamColor || '#d4a23c';
  const dark = needsDark(mc);
  const highlightKeys = new Set(highlightSlots.map(s => s.key));

  const markLine = (style) => <div style={{ position: 'absolute', pointerEvents: 'none', ...style }} />;

  return (
    <div style={styles.pitchWrap}>
      <div style={{
        ...styles.pitchField,
        background: '#124d27',
        backgroundImage: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0.07) 0%, rgba(0,0,0,0.07) 14.3%, transparent 14.3%, transparent 28.6%)',
      }} className="pitch-field">

        {/* ── Marcações do campo ── */}
        {/* Linha do meio */}
        {markLine({ left: 0, right: 0, top: '50%', height: 1, background: 'rgba(255,255,255,0.3)' })}
        {/* Círculo central */}
        {markLine({ left: '50%', top: '50%', width: 74, height: 74, border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '50%', transform: 'translate(-50%,-50%)' })}
        {/* Ponto central */}
        {markLine({ left: '50%', top: '50%', width: 5, height: 5, background: 'rgba(255,255,255,0.45)', borderRadius: '50%', transform: 'translate(-50%,-50%)' })}

        {/* Área penal superior */}
        {markLine({ top: 0, left: '18%', width: '64%', height: '17%', border: '1.5px solid rgba(255,255,255,0.3)', borderTop: 'none', boxSizing: 'border-box' })}
        {/* Pequena área superior */}
        {markLine({ top: 0, left: '35%', width: '30%', height: '7%', border: '1.5px solid rgba(255,255,255,0.25)', borderTop: 'none', boxSizing: 'border-box' })}
        {/* Gol superior */}
        {markLine({ top: 0, left: '40.5%', width: '19%', height: '2.8%', background: 'rgba(255,255,255,0.08)', borderBottom: '1.5px solid rgba(255,255,255,0.35)', boxSizing: 'border-box' })}
        {/* Ponto de pênalti superior */}
        {markLine({ top: '10.5%', left: '50%', width: 5, height: 5, background: 'rgba(255,255,255,0.38)', borderRadius: '50%', transform: 'translate(-50%,-50%)' })}

        {/* Área penal inferior */}
        {markLine({ bottom: 0, left: '18%', width: '64%', height: '17%', border: '1.5px solid rgba(255,255,255,0.3)', borderBottom: 'none', boxSizing: 'border-box' })}
        {/* Pequena área inferior */}
        {markLine({ bottom: 0, left: '35%', width: '30%', height: '7%', border: '1.5px solid rgba(255,255,255,0.25)', borderBottom: 'none', boxSizing: 'border-box' })}
        {/* Gol inferior */}
        {markLine({ bottom: 0, left: '40.5%', width: '19%', height: '2.8%', background: 'rgba(255,255,255,0.08)', borderTop: '1.5px solid rgba(255,255,255,0.35)', boxSizing: 'border-box' })}
        {/* Ponto de pênalti inferior */}
        {markLine({ top: '89.5%', left: '50%', width: 5, height: 5, background: 'rgba(255,255,255,0.38)', borderRadius: '50%', transform: 'translate(-50%,-50%)' })}

        {/* Cantos */}
        {[{ top: -8, left: -8 }, { top: -8, right: -8 }, { bottom: -8, left: -8 }, { bottom: -8, right: -8 }].map((pos, i) =>
          <div key={i} style={{ position: 'absolute', pointerEvents: 'none', ...pos, width: 16, height: 16, border: '1.5px solid rgba(255,255,255,0.28)', borderRadius: '50%' }} />
        )}

        {/* ── Jogadores ── */}
        {pitchSlots.filter(slot => !slot.isBench).map(slot => {
          const occupant = pitch[slot.key];
          const isHighlighted = highlightKeys.has(slot.key);
          const canPlace = isHighlighted && !occupant && onClickSlot;
          const canUnplace = !!occupant && !!onUnplace;
          const clickable = canPlace || canUnplace;
          const isCap = captainSlot && slot.key === captainSlot;

          const circleColor = occupant ? mc : isHighlighted ? 'rgba(127,217,154,0.35)' : 'rgba(255,255,255,0.1)';
          const borderColor = canUnplace
            ? `2px dashed ${mc}`
            : isHighlighted
              ? '2px solid #7fd99a'
              : occupant
                ? '2.5px solid rgba(255,255,255,0.65)'
                : '1.5px solid rgba(255,255,255,0.28)';
          const shadow = occupant
            ? `0 3px 10px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.25)`
            : isHighlighted
              ? '0 0 14px rgba(127,217,154,0.45)'
              : 'none';

          return (
            <div
              key={slot.key}
              onClick={clickable ? () => canPlace ? onClickSlot(slot.key) : onUnplace(slot.key) : undefined}
              title={occupant ? `${occupant.name}${occupant.teamLabel ? ` · ${occupant.teamLabel}` : ''} — clique para mover` : slot.label}
              style={{
                position: 'absolute',
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                transform: 'translate(-50%,-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                zIndex: occupant ? 3 : 2,
                cursor: clickable ? 'pointer' : 'default',
                transition: 'transform 0.15s',
              }}
              className="pitch-spot"
            >
              {/* Círculo principal */}
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: circleColor,
                border: borderColor,
                boxShadow: shadow,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column',
                position: 'relative',
                transform: isHighlighted && !occupant ? 'scale(1.12)' : 'scale(1)',
                transition: 'all 0.15s',
              }}>
                {isCap && (
                  <span style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', fontSize: 11, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>⭐</span>
                )}
                {occupant ? (
                  <span style={{ fontSize: 8, fontWeight: 800, color: dark ? '#0a1a0f' : '#fff', textAlign: 'center', lineHeight: 1.15, padding: '0 3px', maxWidth: 40, wordBreak: 'break-word' }} className="pitch-spot-name">
                    {shortName(occupant.name)}
                  </span>
                ) : (
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, color: isHighlighted ? '#7fd99a' : 'rgba(255,255,255,0.55)', lineHeight: 1 }}>
                    {slot.label}
                  </span>
                )}
              </div>

              {/* Badge OVR */}
              {occupant && (
                <div style={{
                  background: 'rgba(6,14,10,0.82)',
                  borderRadius: 3,
                  padding: '1px 4px',
                  fontSize: 8,
                  fontWeight: 700,
                  fontFamily: "'Space Mono', monospace",
                  color: ovrColor(occupant.ovr),
                  border: '1px solid rgba(255,255,255,0.12)',
                  lineHeight: 1.5,
                  marginTop: 1,
                }}>
                  {occupant.ovr}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Exibe os jogadores do banco de reservas (interativo durante o draft)
function BenchDisplay({ pitch, pitchSlots, myTeamColor, highlightSlots = [], onClickSlot, onUnplace }) {
  const mc = myTeamColor || '#d4a23c';
  const benchSlots = pitchSlots.filter(s => s.isBench);
  const filled = benchSlots.filter(s => pitch[s.key]);
  const highlightKeys = new Set(highlightSlots.map(s => s.key));
  if (benchSlots.length === 0) return null;
  return (
    <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', letterSpacing: 1 }}>
        Banco ({filled.length}/{benchSlots.length})
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {benchSlots.map(slot => {
          const p = pitch[slot.key];
          const isHighlighted = highlightKeys.has(slot.key);
          const canPlace = isHighlighted && !p && !!onClickSlot;
          const canUnplace = !!p && !!onUnplace;
          const clickable = canPlace || canUnplace;
          return (
            <div
              key={slot.key}
              onClick={clickable ? () => canPlace ? onClickSlot(slot.key) : onUnplace(slot.key) : undefined}
              title={p ? `${p.name} — clique para remover` : canPlace ? 'Colocar no banco' : slot.label}
              style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 12, minWidth: 80, textAlign: 'center',
                background: canPlace ? 'rgba(127,217,154,0.12)' : p ? `${mc}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${canPlace ? '#7fd99a88' : p ? mc + '55' : 'rgba(255,255,255,0.1)'}`,
                cursor: clickable ? 'pointer' : 'default',
                transform: canPlace ? 'scale(1.06)' : 'scale(1)',
                transition: 'all 0.15s',
                boxShadow: canPlace ? '0 0 10px rgba(127,217,154,0.25)' : 'none',
              }}
            >
              {p ? (
                <>
                  <div style={{ fontWeight: 600, color: mc }}>{shortName(p.name)}</div>
                  <div style={{ fontSize: 10, opacity: 0.5 }}>{p.pos[0]} · {p.ovr}</div>
                </>
              ) : (
                <div style={{ color: canPlace ? '#7fd99a' : 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: canPlace ? 600 : 400 }}>
                  {canPlace ? '+ ' : ''}{slot.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Chaveamento visual da Copa
function CupBracket({ cupRounds, leagueTeams, myTeamId, myTeamColor, onViewTeam }) {
  const mc = myTeamColor || '#d4a23c';
  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 12, minWidth: 'max-content', paddingBottom: 8 }}>
        {cupRounds.map((round, rIdx) => (
          <div key={rIdx} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
            <div style={{ fontSize: 10, opacity: 0.5, fontFamily: "'Space Mono', monospace", marginBottom: 6, textAlign: 'center', textTransform: 'uppercase' }}>{round.name}</div>
            {round.matches.map((m, mIdx) => {
              const h = leagueTeams.find(t => t.id === m.homeId);
              const a = leagueTeams.find(t => t.id === m.awayId);
              const leg1 = round.leg1Results?.[mIdx];
              const leg2 = round.results?.[mIdx];
              const aggH = leg1 && leg2 ? leg1.homeGoals + leg2.awayGoals : null;
              const aggA = leg1 && leg2 ? leg1.awayGoals + leg2.homeGoals : null;
              const hWon = aggH !== null && aggH > aggA;
              const aWon = aggA !== null && aggA > aggH;
              return (
                <div key={mIdx} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden', fontSize: 11 }}>
                  {[{ team: h, id: m.homeId, won: hWon }, { team: a, id: m.awayId, won: aWon }].map(({ team, id, won }, ti) => (
                    <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: won ? 'rgba(127,217,154,0.1)' : id === myTeamId ? `${mc}15` : 'transparent', borderBottom: ti === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                      {team?.clubLogo && <img src={team.clubLogo} style={{ width: 12, height: 12, objectFit: 'contain' }} alt="" />}
                      <span
                        onClick={() => id !== myTeamId && onViewTeam && team && onViewTeam(team)}
                        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: id === myTeamId ? mc : won ? '#7fd99a' : '#F4F1EA', fontWeight: won ? 700 : 400, cursor: id === myTeamId ? 'default' : 'pointer' }}
                      >{team?.label || '?'}</span>
                      {aggH !== null && <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>{ti === 0 ? aggH : aggA}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Modal para ver elenco de um time adversário
function TeamViewModal({ team, onClose, myTeamColor }) {
  const mc = myTeamColor || '#d4a23c';
  if (!team) return null;
  const starters = team.players?.filter(p => !p.isBench) || team.players || [];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0F2318', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 20, width: '100%', maxWidth: 400, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            {team.clubLogo && <img src={team.clubLogo} style={{ width: 28, height: 28, objectFit: 'contain', marginRight: 8, verticalAlign: 'middle' }} alt="" />}
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 700 }}>{team.label}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20 }}>x</button>
        </div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: mc, marginBottom: 12 }}>OVR {team.ovr}</div>
        {starters.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
            <span style={{ width: 36, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{p.pos?.join('/') || '-'}</span>
            <span style={{ flex: 1 }}>{p.name}</span>
            <span style={{ fontFamily: "'Space Mono', monospace", color: ovrColor(p.ovr), fontSize: 11 }}>{p.ovr}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Zonas da tabela do Brasileirão
function getZoneInfo(pos, total) {
  if (pos <= 4) return { color: '#22c55e', label: 'G4', title: 'Libertadores - Fase de Grupos' };
  if (pos <= 6) return { color: '#86efac', label: 'G6', title: 'Libertadores - Pre' };
  if (pos <= 12) return { color: '#60a5fa', label: 'SA', title: 'Sul-Americana' };
  if (pos >= total - 3) return { color: '#ef4444', label: 'Z4', title: 'Rebaixamento' };
  return null;
}

function DraftTopBar({ formationLabel, filled, total, skipsLeft, onSkip, onBack }) {
  const pct = total > 0 ? (filled / total) * 100 : 0;
  const canSkip = skipsLeft > 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={styles.draftTopRow}>
        <div>
          {onBack && <button onClick={onBack} style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 6px 0', display: 'block' }}>&#8592; Voltar</button>}
          <div style={styles.eyebrow}>{formationLabel}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{filled} de {total} posições preenchidas</div>
        </div>
        <button
          onClick={onSkip}
          disabled={!canSkip}
          title={canSkip ? 'Pular este time' : 'Sem pulos restantes'}
          style={{
            ...styles.skipsBox,
            cursor: canSkip ? 'pointer' : 'not-allowed',
            opacity: canSkip ? 1 : 0.4,
            background: 'none',
            border: `1px solid ${canSkip ? 'rgba(212,162,60,0.4)' : 'rgba(255,255,255,0.12)'}`,
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          <span style={{ ...styles.skipsNum, color: canSkip ? '#d4a23c' : 'rgba(255,255,255,0.4)' }}>{skipsLeft}</span>
          <span style={{ ...styles.skipsLabel, color: canSkip ? 'rgba(212,162,60,0.8)' : 'rgba(255,255,255,0.35)' }}>pular</span>
        </button>
      </div>
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${pct}%` }} />
      </div>
    </div>
  );
}

function useIsMobile(bp = 768) {
  const [mob, setMob] = useState(() => typeof window !== 'undefined' && window.innerWidth <= bp);
  useEffect(() => {
    const fn = () => setMob(window.innerWidth <= bp);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [bp]);
  return mob;
}

function Draft({ onBack, rolledTeam, isRolling, rollingPreview, pitch, pitchSlots, formationLabel, skipsLeft, selectedPlayer, repositioningSlot, eligibleSlotsForPlayer, onClickPlayer, onClickPitchSlot, onUnplacePlayer, onSkipTeam, myTeamColor, captainSlot }) {
  const isMobile = useIsMobile();
  const filledCount = Object.keys(pitch).length;
  const highlightSlots = selectedPlayer ? eligibleSlotsForPlayer(selectedPlayer) : [];
  const sortedPlayers = useMemo(() => {
    if (!rolledTeam) return [];
    return [...rolledTeam.players].sort((a, b) => posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]));
  }, [rolledTeam]);

  const mobileLayoutStyle = { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 };
  const playersPanelStyle = isMobile
    ? { ...styles.draftLeft, maxHeight: '50vh' }
    : styles.draftLeft;
  const pitchPanelStyle = isMobile ? {} : styles.draftRight;

  if (isRolling) {
    const pitchEl = <div style={pitchPanelStyle}><Pitch pitch={pitch} pitchSlots={pitchSlots} myTeamColor={myTeamColor} captainSlot={captainSlot} /></div>;
    const rollingEl = (
      <div className="draft-left" style={playersPanelStyle}>
        <div style={styles.rollingBox}>
          <span style={styles.diceIconSpin}>🎲</span>
          <div style={styles.rollingName}>{rollingPreview ? rollingPreview.label : '...'}</div>
          <div style={styles.rollingHint}>sorteando time...</div>
        </div>
      </div>
    );
    return (
      <div style={styles.card} className="card-mob">
        <DraftTopBar formationLabel={formationLabel} filled={filledCount} total={pitchSlots.length} skipsLeft={skipsLeft} onSkip={onSkipTeam} />
        <div style={isMobile ? mobileLayoutStyle : styles.draftLayout} className="draft-layout-grid">
          {isMobile ? <>{pitchEl}{rollingEl}</> : <>{rollingEl}{pitchEl}</>}
        </div>
      </div>
    );
  }

  if (!rolledTeam) {
    return (
      <div style={styles.card} className="card-mob">
        <div style={styles.emptyState}>
          Os times disponíveis se esgotaram. Siga com o que foi escalado até aqui.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card} className="card-mob">
      <DraftTopBar formationLabel={formationLabel} filled={filledCount} total={pitchSlots.length} skipsLeft={skipsLeft} onSkip={onSkipTeam} />

      {selectedPlayer && (
        <div style={styles.selectedPlayerBanner}>
          {repositioningSlot !== null
            ? <>Mova <b>{selectedPlayer.name}</b> para outra posição — ou clique num jogador para cancelar</>
            : <>Escolha a posição no campo para <b>{selectedPlayer.name}</b></>
          }
        </div>
      )}

      <div style={isMobile ? mobileLayoutStyle : styles.draftLayout} className="draft-layout-grid">
        {/* No mobile: campo primeiro; no desktop: jogadores primeiro */}
        {isMobile && (
          <div style={pitchPanelStyle}>
            <Pitch
              pitch={pitch}
              pitchSlots={pitchSlots}
              highlightSlots={highlightSlots}
              onClickSlot={onClickPitchSlot}
              onUnplace={repositioningSlot === null ? onUnplacePlayer : undefined}
              myTeamColor={myTeamColor}
              captainSlot={captainSlot}
            />
          </div>
        )}

        {/* Jogadores */}
        <div className="draft-left" style={playersPanelStyle}>
          <div style={styles.teamHeaderCard}>
            {CLUB_LOGOS[rolledTeam.club]
              ? <img src={CLUB_LOGOS[rolledTeam.club]} style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }} alt={rolledTeam.club} />
              : <span style={{ fontSize: 20 }}>🎲</span>
            }
            <div>
              <div style={styles.rolledTeamLabel}>{rolledTeam.label}</div>
              <div style={styles.rolledTeamCoach}>Técnico: {rolledTeam.coach}</div>
            </div>
          </div>

          <div style={styles.playersList}>
            {sortedPlayers.map((p, i) => {
              const slots = eligibleSlotsForPlayer(p);
              const canPick = slots.length > 0;
              const isSelected = selectedPlayer?.name === p.name;
              return (
                <button
                  key={i}
                  onClick={() => canPick && onClickPlayer(p)}
                  disabled={!canPick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 9,
                    border: '1px solid',
                    background: isSelected
                      ? 'rgba(127,217,154,0.1)'
                      : canPick ? 'rgba(255,255,255,0.03)' : 'transparent',
                    borderColor: isSelected
                      ? 'rgba(127,217,154,0.5)'
                      : canPick ? 'rgba(255,255,255,0.07)' : 'transparent',
                    opacity: canPick ? 1 : 0.3,
                    cursor: canPick ? 'pointer' : 'not-allowed',
                    color: '#F4F1EA',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.12s, border-color 0.12s',
                    marginBottom: 2,
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    background: isSelected ? 'rgba(127,217,154,0.2)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${POS_GROUP_COLOR[p.pos[0]] || 'rgba(255,255,255,0.15)'}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14,
                    color: ovrColor(p.ovr),
                  }}>
                    {p.ovr}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{
                      fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden',
                      textOverflow: 'ellipsis', lineHeight: 1.2,
                    }}>
                      {p.name}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 16 }}>
                      {p.pos.map((pos, pi) => {
                        const c = POS_GROUP_COLOR[pos] || '#d4a23c';
                        const isPrimary = pi === 0;
                        return (
                          <span key={pos} style={{
                            fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 800,
                            padding: '2px 6px', borderRadius: 4, letterSpacing: 0.4, lineHeight: 1.4,
                            background: isPrimary ? c : `${c}22`,
                            color: isPrimary ? '#0B1A12' : c,
                            border: isPrimary ? 'none' : `1px solid ${c}88`,
                          }}>{pos}</span>
                        );
                      })}
                    </div>
                  </div>
                  {isSelected && <span style={{ flexShrink: 0, fontSize: 16, color: '#7fd99a' }}>→</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Campo — só no desktop (mobile já renderizou acima) */}
        {!isMobile && (
          <div style={styles.draftRight}>
            <Pitch
              pitch={pitch}
              pitchSlots={pitchSlots}
              highlightSlots={highlightSlots}
              onClickSlot={onClickPitchSlot}
              onUnplace={repositioningSlot === null ? onUnplacePlayer : undefined}
              myTeamColor={myTeamColor}
              captainSlot={captainSlot}
            />
          </div>
        )}
      </div>
      <BenchDisplay
        pitch={pitch}
        pitchSlots={pitchSlots}
        myTeamColor={myTeamColor}
        highlightSlots={highlightSlots}
        onClickSlot={onClickPitchSlot}
        onUnplace={repositioningSlot === null ? onUnplacePlayer : undefined}
      />
    </div>
  );
}

function Squad({ pitch, pitchSlots, formationLabel, captainSlot, onSetCaptain, onConfirm, onRedo, myTeamColor }) {
  const starters = Object.values(pitch).filter(p => !p.isBench);
  const avgOvr = starters.length ? Math.round(starters.reduce((s, p) => s + p.ovr, 0) / starters.length) : 0;
  const effectiveOvr = Math.round((avgOvr + (captainSlot && !pitch[captainSlot]?.isBench ? 2 / starters.length : 0)) * 10) / 10;
  const starterSlots = pitchSlots.filter(s => !s.isBench).sort((a, b) => posOrderIndex(a.realPos) - posOrderIndex(b.realPos));
  const benchSlots = pitchSlots.filter(s => s.isBench);

  return (
    <div style={styles.card} className="card-mob">
      <div style={styles.eyebrow}>{formationLabel}</div>
      <h2 style={styles.h2}>OVR base: {avgOvr} · Efetivo: {effectiveOvr} (11 titulares)</h2>

      {/* Instrução capitão */}
      <div style={{
        textAlign: 'center', fontSize: 12, padding: '8px 12px',
        background: captainSlot ? 'rgba(212,162,60,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${captainSlot ? 'rgba(212,162,60,0.35)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 8, marginBottom: 10, color: captainSlot ? '#d4a23c' : 'rgba(255,255,255,0.5)',
      }}>
        {captainSlot
          ? `Capitao: ${pitch[captainSlot]?.name} — +2 OVR`
          : 'Toque em um titular para definir o capitao (bracadeira +2 OVR)'}
      </div>

      <Pitch pitch={pitch} pitchSlots={pitchSlots} myTeamColor={myTeamColor} captainSlot={captainSlot} />
      <BenchDisplay pitch={pitch} pitchSlots={pitchSlots} myTeamColor={myTeamColor} />

      <div style={styles.squadList}>
        {/* Titulares */}
        {starterSlots.map(slot => {
          const p = pitch[slot.key];
          if (!p) return null;
          const isCap = captainSlot === slot.key;
          return (
            <button
              key={slot.key}
              onClick={() => onSetCaptain(isCap ? null : slot.key)}
              className="squad-row-g"
              style={{
                ...styles.squadRow,
                cursor: 'pointer',
                background: isCap ? 'rgba(212,162,60,0.12)' : 'transparent',
                border: `1px solid ${isCap ? 'rgba(212,162,60,0.4)' : 'transparent'}`,
                borderRadius: 8,
                width: '100%',
                textAlign: 'left',
                color: '#F4F1EA',
              }}
            >
              <span style={{ ...styles.squadPos, color: isCap ? '#d4a23c' : undefined }}>
                {isCap ? 'C' : slot.label}
              </span>
              <span style={{ ...styles.squadName, fontWeight: isCap ? 700 : 400 }}>{p.name}</span>
              <span style={styles.squadTeam}>{p.teamLabel}</span>
              <span style={{ ...styles.squadOvr, color: isCap ? '#d4a23c' : undefined }}>
                {isCap ? `${p.ovr} +2` : p.ovr}
              </span>
            </button>
          );
        })}
        {/* Banco */}
        {benchSlots.some(s => pitch[s.key]) && (
          <>
            <div style={{ fontSize: 11, opacity: 0.4, padding: '8px 0 4px', fontFamily: "'Space Mono', monospace" }}>BANCO</div>
            {benchSlots.map(slot => {
              const p = pitch[slot.key];
              if (!p) return null;
              return (
                <div key={slot.key} style={{ ...styles.squadRow, opacity: 0.7 }}>
                  <span style={styles.squadPos}>{p.pos[0]}</span>
                  <span style={styles.squadName}>{p.name}</span>
                  <span style={styles.squadTeam}>{p.teamLabel}</span>
                  <span style={styles.squadOvr}>{p.ovr}</span>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div style={styles.btnRow}>
        <button style={styles.btnGhost} onClick={onRedo}>Trocar formacao</button>
        <button
          style={{ ...styles.btnPrimary, opacity: captainSlot ? 1 : 0.6 }}
          onClick={onConfirm}
          title={captainSlot ? '' : 'Escolha um capitao primeiro'}
        >
          {captainSlot ? 'Disputar ->' : 'Escolha um capitao'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE: Modal de Pênaltis Interativo
// ============================================================
function PenaltyModal({ penaltyPhase, onDismiss, myTeamColor }) {
  const mc = myTeamColor || '#d4a23c';
  const [inner, setInner] = React.useState({
    kickNum: 0,     // 0,1,...: even=home, odd=away
    phase: 'pick',  // 'pick' | 'countdown' | 'result' | 'done'
    countdown: null,
    takerName: null,
    lastResult: null,
    myGoals: 0,
    opGoals: 0,
    myKickResults: [],
    opKickResults: [],
  });
  const tiRef = React.useRef(null);

  if (!penaltyPhase) return null;
  const { kicks, winner, myIsHome, myTeamLabel, oppTeamLabel, oppGkName, myPlayers } = penaltyPhase;

  const { kickNum, phase, countdown, takerName, lastResult, myGoals, opGoals, myKickResults, opKickResults } = inner;

  // Is this kick (by kickNum) my team's kick?
  const pairIdx = Math.floor(kickNum / 2);
  const isHomeKick = kickNum % 2 === 0;
  const isMyKick = myIsHome ? isHomeKick : !isHomeKick;

  const currentKickPair = kicks[pairIdx];
  const isLastKick = pairIdx >= kicks.length - 1 && (myIsHome ? !isHomeKick : isHomeKick);

  const totalKicks = kicks.length * 2;
  const done = inner.phase === 'done';

  const clearT = () => { if (tiRef.current) clearTimeout(tiRef.current); };

  const getResultText = (scored, isMine) => {
    if (scored) return isMine ? 'GOOOOOL! ⚽' : 'GOL ⚽';
    const r = Math.random();
    if (r < 0.35 && !isMine) return `DEFENDE O ${oppGkName}! 🧤`;
    if (r < 0.65) return isMine ? 'ISOLOOOOU! 😩' : 'ISOLOU';
    return isMine ? 'ERROOOOU! 😱' : 'ERROU';
  };

  const resolveKick = (taker) => {
    if (!currentKickPair) { advanceKick(null); return; }
    const scored = isMyKick
      ? (isHomeKick ? currentKickPair.a : currentKickPair.b)
      : (isHomeKick ? currentKickPair.a : currentKickPair.b);
    const resultText = getResultText(scored, isMyKick);
    const newMy = isMyKick ? myGoals + (scored ? 1 : 0) : myGoals;
    const newOp = !isMyKick ? opGoals + (scored ? 1 : 0) : opGoals;
    const newMyK = isMyKick ? [...myKickResults, { scored, name: taker }] : myKickResults;
    const newOpK = !isMyKick ? [...opKickResults, { scored }] : opKickResults;
    setInner(p => ({ ...p, phase: 'result', takerName: taker, lastResult: { scored, scorer: taker, isMyKick, resultText }, myGoals: newMy, opGoals: newOp, myKickResults: newMyK, opKickResults: newOpK }));
    clearT();
    tiRef.current = setTimeout(() => advanceKick({ myGoals: newMy, opGoals: newOp, myK: newMyK, opK: newOpK }), 2200);
  };

  const advanceKick = (scores) => {
    clearT();
    const nextKickNum = kickNum + 1;
    const nextPairIdx = Math.floor(nextKickNum / 2);
    if (nextPairIdx >= kicks.length) {
      setInner(p => ({ ...p, phase: 'done' }));
      return;
    }
    const nextIsHome = nextKickNum % 2 === 0;
    const nextIsMyKick = myIsHome ? nextIsHome : !nextIsHome;
    setInner(p => ({
      ...p,
      kickNum: nextKickNum,
      phase: nextIsMyKick ? 'pick' : 'auto_kick',
      countdown: null, takerName: null, lastResult: null,
      myGoals: scores?.myGoals ?? p.myGoals,
      opGoals: scores?.opGoals ?? p.opGoals,
      myKickResults: scores?.myK ?? p.myKickResults,
      opKickResults: scores?.opK ?? p.opKickResults,
    }));
  };

  // Auto-kick for opponent
  React.useEffect(() => {
    if (inner.phase !== 'auto_kick') return;
    clearT();
    tiRef.current = setTimeout(() => startCountdown('auto'), 500);
    return clearT;
  }, [inner.phase, kickNum]);

  React.useEffect(() => () => clearT(), []);

  const startCountdown = (taker) => {
    setInner(p => ({ ...p, phase: 'countdown', countdown: 3, takerName: taker }));
  };

  React.useEffect(() => {
    if (inner.phase !== 'countdown' || inner.countdown === null) return;
    if (inner.countdown === 0) {
      resolveKick(inner.takerName);
      return;
    }
    clearT();
    tiRef.current = setTimeout(() => setInner(p => ({ ...p, countdown: (p.countdown || 1) - 1 })), 1000);
    return clearT;
  }, [inner.phase, inner.countdown]);

  const startKickersName = () => {
    if (inner.phase !== 'pick') return null;
    return (
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: mc, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>Escolha o cobrador</div>
        {(myPlayers || []).map((p, i) => (
          <button key={i} onClick={() => startCountdown(p.name)} style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 7, color: '#F4F1EA', fontFamily: "'Space Mono',monospace",
            fontSize: 12, cursor: 'pointer', marginBottom: 4,
          }}>
            {p.name} <span style={{ opacity: 0.5, fontSize: 10 }}>{(p.pos || []).join('/')}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderKickDots = (results, isMe) => (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {results.map((r, i) => (
        <span key={i} style={{ fontSize: 16, lineHeight: 1 }}>{r.scored ? '🟢' : '🔴'}</span>
      ))}
    </div>
  );

  const isSuddenDeath = kicks[pairIdx]?.suddenDeath;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(5,15,8,0.92)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
    }}>
      {/* Header */}
      <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 22, fontWeight: 700, color: '#F4F1EA', marginBottom: 4, textAlign: 'center' }}>
        ⚽ Disputa de Pênaltis
        {isSuddenDeath && <span style={{ fontSize: 12, color: '#e05050', marginLeft: 8 }}>MORTE SÚBITA</span>}
      </div>

      {/* Score */}
      <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 28, fontWeight: 700, color: mc, marginBottom: 16, letterSpacing: 2 }}>
        {myGoals} – {opGoals}
      </div>

      {/* Team labels with kick dots */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 400, marginBottom: 16 }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{myTeamLabel}</div>
          {renderKickDots(myKickResults, true)}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{oppTeamLabel}</div>
          {renderKickDots(opKickResults, false)}
        </div>
      </div>

      {/* Main interaction area */}
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'rgba(255,255,255,0.04)', borderRadius: 14,
        padding: '18px 16px', minHeight: 140,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        {phase === 'pick' && startKickersName()}

        {(phase === 'auto_kick') && (
          <div style={{ textAlign: 'center', fontSize: 14, opacity: 0.7 }}>
            <div style={{ fontSize: 11, color: mc, marginBottom: 6 }}>{oppTeamLabel}</div>
            <div>Preparando cobrança...</div>
          </div>
        )}

        {phase === 'countdown' && (
          <div style={{ textAlign: 'center' }}>
            {takerName && takerName !== 'auto' && (
              <div style={{ fontSize: 13, color: mc, marginBottom: 12, fontWeight: 700 }}>{takerName}</div>
            )}
            {takerName === 'auto' && (
              <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 12 }}>{oppTeamLabel}</div>
            )}
            <div style={{
              fontSize: countdown === 1 ? 72 : countdown === 2 ? 64 : 56,
              fontFamily: "'Fraunces',Georgia,serif", fontWeight: 700,
              color: countdown === 1 ? '#e05050' : countdown === 2 ? '#d4a23c' : '#F4F1EA',
              lineHeight: 1, transition: 'font-size 0.15s',
            }}>{countdown}</div>
          </div>
        )}

        {phase === 'result' && lastResult && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: lastResult.scored ? 28 : 22, fontWeight: 700,
              color: lastResult.scored && lastResult.isMyKick ? '#7fd99a'
                : !lastResult.scored && !lastResult.isMyKick ? '#7fd99a' : '#e05050',
              fontFamily: "'Fraunces',Georgia,serif",
              marginBottom: 6,
            }}>{lastResult.resultText}</div>
            {lastResult.scorer && lastResult.scorer !== 'auto' && (
              <div style={{ fontSize: 12, opacity: 0.6 }}>{lastResult.scorer}</div>
            )}
          </div>
        )}

        {phase === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: mc, fontFamily: "'Fraunces',Georgia,serif", marginBottom: 8 }}>
              {winner === '__myteam__' ? '🏆 Classificado nos pênaltis!' : '💔 Eliminado nos pênaltis'}
            </div>
            <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
              {myTeamLabel} {myGoals} × {opGoals} {oppTeamLabel}
            </div>
            <button onClick={onDismiss} style={{
              fontFamily: "'Space Mono',monospace", fontSize: 13, fontWeight: 700,
              padding: '10px 28px', borderRadius: 10, border: 'none',
              background: mc, color: '#0B1A12', cursor: 'pointer',
            }}>Continuar →</button>
          </div>
        )}
      </div>

      {/* Round indicator */}
      {phase !== 'done' && (
        <div style={{ marginTop: 12, fontSize: 11, opacity: 0.45, fontFamily: "'Space Mono',monospace" }}>
          {isSuddenDeath ? 'MORTE SÚBITA' : `Cobrança ${pairIdx + 1} de ${kicks.length}`} · {isMyKick ? myTeamLabel : oppTeamLabel}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TELA DE JOGO: liga com cronômetro e tabela
// ============================================================
function LiveMatchBox({ um, homeTeam, awayTeam, myTeamId, myTeamBadge, mc, liveScore, clockDisplay, isSimulating, roundDone, liveEvents, simSpeed, onSetSpeed, simMode, onSetSimMode, autoCountdown, onStartRound, roundLabel, isPaused, onPause, onResume, showSubPanel, liveLineup, subSelectStarter, onSelectSubStarter, onApplySub, myTeamColor }) {
  if (!um || !homeTeam || !awayTeam) return null;
  const isAuto = simMode === 'auto';
  const hColor = homeTeam.id === myTeamId ? mc : (homeTeam.colors?.p || homeTeam.color || '#3a85d9');
  const aColor = awayTeam.id === myTeamId ? mc : (awayTeam.colors?.p || awayTeam.color || '#c94040');
  return (
    <div style={styles.liveMatchBox} className="card-mob">
      <div style={styles.liveTeamsRow} className="live-teams-row">
        <div style={{ ...styles.liveTeamName, textAlign: 'right', fontWeight: homeTeam.id === myTeamId ? 700 : 400, color: homeTeam.id === myTeamId ? mc : '#F4F1EA', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }} className="live-team-n">
          <span>{homeTeam.label}</span>
          {homeTeam.id === myTeamId
            ? (myTeamBadge && <span style={{ fontSize: 22 }}>{myTeamBadge}</span>)
            : (homeTeam.clubLogo && <img src={homeTeam.clubLogo} style={{ width: 28, height: 28, objectFit: 'contain' }} alt="" />)
          }
        </div>
        <div style={styles.liveScoreBlock}>
          <span style={styles.liveScoreNum} className="live-score-n">{liveScore.home}</span>
          <span style={styles.liveScoreDash}>–</span>
          <span style={styles.liveScoreNum} className="live-score-n">{liveScore.away}</span>
        </div>
        <div style={{ ...styles.liveTeamName, textAlign: 'left', fontWeight: awayTeam.id === myTeamId ? 700 : 400, color: awayTeam.id === myTeamId ? mc : '#F4F1EA', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 6 }} className="live-team-n">
          {awayTeam.id === myTeamId
            ? (myTeamBadge && <span style={{ fontSize: 22 }}>{myTeamBadge}</span>)
            : (awayTeam.clubLogo && <img src={awayTeam.clubLogo} style={{ width: 28, height: 28, objectFit: 'contain' }} alt="" />)
          }
          <span>{awayTeam.label}</span>
        </div>
      </div>

      {(isSimulating || roundDone) && (
        <div style={{ ...styles.clockRow, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ ...styles.clock, color: isSimulating ? '#7fd99a' : '#F4F1EA', minWidth: 52, textAlign: 'center' }}>{clockDisplay}</div>
          {isSimulating && <div style={styles.clockPulse} />}
          {isSimulating && (
            <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
              {[1, 1.5, 2].map(sp => (
                <button key={sp} onClick={() => onSetSpeed(sp)} style={{
                  fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: simSpeed === sp ? 700 : 400,
                  padding: '3px 8px', borderRadius: 6, border: '1px solid', cursor: 'pointer',
                  borderColor: simSpeed === sp ? '#d4a23c' : 'rgba(255,255,255,0.2)',
                  background: simSpeed === sp ? 'rgba(212,162,60,0.15)' : 'transparent',
                  color: simSpeed === sp ? '#d4a23c' : 'rgba(255,255,255,0.6)',
                }}>{sp}x</button>
              ))}
            </div>
          )}
          {roundDone && !isSimulating && <div style={styles.clockFull}>Tempo encerrado</div>}
          {isSimulating && !isPaused && (
            <button onClick={onPause} style={{
              fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(255,140,0,0.5)',
              background: 'rgba(255,140,0,0.1)', color: '#ffaa00', cursor: 'pointer', marginLeft: 6,
            }}>⏸ Pausar</button>
          )}
          {isPaused && (
            <button onClick={onResume} style={{
              fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(127,217,154,0.5)',
              background: 'rgba(127,217,154,0.1)', color: '#7fd99a', cursor: 'pointer', marginLeft: 6,
            }}>▶ Retomar</button>
          )}
        </div>
      )}

      {liveEvents.length > 0 && (
        <div style={styles.matchCenter}>
          {liveEvents.map((ev, i) => {
            const isHomeSide = ev.teamId === homeTeam.id;
            const sideColor = isHomeSide ? hColor : aColor;
            const content = (
              <div style={{ ...styles.matchCenterCard, borderColor: `${sideColor}55`, background: `${sideColor}14`, flexDirection: isHomeSide ? 'row' : 'row-reverse' }}>
                <span style={{ fontSize: 15 }}>{ev.isOwnGoal ? '⚽🔴' : '⚽'}</span>
                <div style={{ ...styles.matchCenterInfo, textAlign: isHomeSide ? 'left' : 'right' }}>
                  <span style={styles.goalScorer}>{ev.scorer}{ev.isOwnGoal ? ' (contra)' : ''}</span>
                  <span style={styles.goalTeam}>{ev.isOwnGoal ? `contra, ${ev.ownGoalTeamLabel}` : ev.assist ? `assist: ${ev.assist}` : ev.teamLabel}</span>
                </div>
              </div>
            );
            return (
              <div key={i} style={styles.matchCenterRow}>
                <div style={{ ...styles.matchCenterSide, justifyContent: 'flex-end' }}>{isHomeSide && content}</div>
                <div style={styles.matchCenterMinuteCol}>
                  <span style={styles.goalMinute}>{ev.minute}'</span>
                  <span style={styles.goalScore}>{ev.homeScore}–{ev.awayScore}</span>
                </div>
                <div style={{ ...styles.matchCenterSide, justifyContent: 'flex-start' }}>{!isHomeSide && content}</div>
              </div>
            );
          })}
        </div>
      )}
      {liveEvents.length === 0 && roundDone && <div style={styles.noGoalsMsg}>Sem gols — 0 × 0</div>}

      {/* Sub panel */}
      {showSubPanel && liveLineup && (
        <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: myTeamColor || '#d4a23c', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
            ↕ Substituição
            {subSelectStarter && <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 8 }}>Escolha o reserva</span>}
            {!subSelectStarter && <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 8 }}>Escolha o titular</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4 }}>Titulares</div>
              {Object.entries(liveLineup).filter(([k, p]) => !p.isBench).map(([k, p]) => (
                <button key={k} onClick={() => !subSelectStarter ? onSelectSubStarter(k) : null}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px',
                    background: subSelectStarter === k ? 'rgba(127,217,154,0.15)' : 'rgba(255,255,255,0.04)',
                    border: subSelectStarter === k ? '1px solid rgba(127,217,154,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6, color: '#F4F1EA',
                    fontFamily: "'Space Mono',monospace", fontSize: 10, cursor: 'pointer', marginBottom: 3,
                  }}
                >
                  {p.name} <span style={{ opacity: 0.45 }}>{(p.pos || []).join('/')}</span>
                </button>
              ))}
            </div>
            {subSelectStarter && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4 }}>Reservas</div>
                {Object.entries(liveLineup).filter(([k, p]) => p.isBench).map(([k, p]) => (
                  <button key={k} onClick={() => onApplySub(subSelectStarter, p)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6, color: '#F4F1EA',
                      fontFamily: "'Space Mono',monospace", fontSize: 10, cursor: 'pointer', marginBottom: 3,
                    }}
                  >
                    {p.name} <span style={{ opacity: 0.45 }}>{(p.pos || []).join('/')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toggle manual / automático */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['manual', 'auto'].map(m => (
            <button key={m} onClick={() => onSetSimMode(m)} style={{
              fontFamily: "'Space Mono', monospace", fontSize: 11,
              padding: '4px 10px', borderRadius: 6, border: '1px solid', cursor: 'pointer',
              borderColor: simMode === m ? mc : 'rgba(255,255,255,0.18)',
              background: simMode === m ? `${mc}22` : 'transparent',
              color: simMode === m ? mc : 'rgba(255,255,255,0.45)',
              fontWeight: simMode === m ? 700 : 400,
            }}>
              {m === 'manual' ? 'Manual' : 'Auto'}
            </button>
          ))}
        </div>
        {!isSimulating && !roundDone && !isAuto && (
          <button style={{ ...styles.btnPrimary, margin: 0, flex: 1 }} onClick={onStartRound}>
            ▶ {roundLabel}
          </button>
        )}
        {!isSimulating && !roundDone && isAuto && autoCountdown !== null && (
          <div style={{ flex: 1, textAlign: 'center', fontFamily: "'Space Mono', monospace", fontSize: 12, color: mc }}>
            Iniciando em {autoCountdown}s…
          </div>
        )}
      </div>
    </div>
  );
}

function Playing({ myTeamId, fixtures, currentRound, leagueTeams, leagueTable, clockMinute, isSimulating, liveEvents, liveScore, roundResults, activeUserMatch, myTeamColor, myTeamBadge, myTeamLogo, gameMode, cupRounds, cupRoundIdx, cupLeg, userInCup, eliminationRoundName, simSpeed, onSetSpeed, simMode, onSetSimMode, autoCountdown, onStartRound, onNextRound, matchHistory, scorers, assisters, viewingTeam, onViewTeam, onSimulateAll, isPaused, onPause, onResume, showSubPanel, liveLineup, subSelectStarter, onSelectSubStarter, onApplySub }) {
  const mc = myTeamColor || '#d4a23c';
  const round = fixtures[currentRound] || [];
  const um = activeUserMatch || round.find(m => m.homeId === myTeamId || m.awayId === myTeamId);
  const homeTeam = um ? leagueTeams.find(t => t.id === um.homeId) : null;
  const awayTeam = um ? leagueTeams.find(t => t.id === um.awayId) : null;
  const roundDone = roundResults !== null;
  const clockDisplay = `${clockMinute}'`;
  const [showHistory, setShowHistory] = useState(false);

  // ── COPA DO BRASIL ──────────────────────────────────────────
  if (gameMode === 'copa') {
    const cupRound = cupRounds[cupRoundIdx] || {};
    const roundName = cupRound.name || CUP_ROUND_NAMES[cupRoundIdx] || 'Copa';
    const isLastCupRound = cupRoundIdx >= CUP_ROUND_NAMES.length - 1;
    const legLabel = cupLeg === 1 ? 'Jogo de Ida' : 'Jogo de Volta';

    // Contexto do jogo de ida para exibir no leg 2
    const leg1Results = cupLeg === 2 ? (cupRound.leg1Results || []) : null;
    const userOrigIdx = cupRound.matches ? cupRound.matches.findIndex(m => m.homeId === myTeamId || m.awayId === myTeamId) : -1;
    const userLeg1 = leg1Results && userOrigIdx >= 0 ? leg1Results[userOrigIdx] : null;
    const origMatch = userOrigIdx >= 0 ? cupRound.matches[userOrigIdx] : null;

    // Usuário eliminado
    if (!userInCup) {
      const elimRoundName = eliminationRoundName || roundName;

      // Quando !roundDone (fase AI sem user), mostrar botão de avançar em modo manual
      if (!roundDone) {
        return (
          <div style={styles.card} className="card-mob">
            <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>😔</div>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Eliminado nas {elimRoundName}</div>
              <div style={{ fontSize: 13, opacity: 0.55, marginBottom: 20 }}>O torneio continua sem voce.</div>
              {simMode === 'manual' && <button style={styles.btnSmall} onClick={onStartRound}>Simular proxima fase</button>}
              {simMode === 'manual' && onSimulateAll && (
                <button style={{ ...styles.btnPrimary, background: '#d4a23c', color: '#0B1A12', margin: '8px auto', display: 'block' }} onClick={onSimulateAll}>
                  Simular ate o campeao
                </button>
              )}
              {simMode === 'auto' && autoCountdown !== null && (
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#d4a23c' }}>Simulando em {autoCountdown}s...</div>
              )}
            </div>
            {cupRounds.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={styles.sectionLabel}>Chaveamento</div>
                <CupBracket cupRounds={cupRounds} leagueTeams={leagueTeams} myTeamId={myTeamId} myTeamColor={mc} onViewTeam={onViewTeam} />
              </div>
            )}
          </div>
        );
      }

      // roundDone: mostrar resultados desta fase e avançar
      const elimL2 = roundResults && userOrigIdx >= 0 ? roundResults[userOrigIdx] || { homeGoals: 0, awayGoals: 0 } : null;
      const elimIsHome = origMatch ? origMatch.homeId === myTeamId : false;
      const elimUserAgg = elimL2 && userLeg1
        ? (elimIsHome ? userLeg1.homeGoals + elimL2.awayGoals : userLeg1.awayGoals + elimL2.homeGoals) : null;
      const elimOppAgg = elimL2 && userLeg1
        ? (elimIsHome ? userLeg1.awayGoals + elimL2.homeGoals : userLeg1.homeGoals + elimL2.awayGoals) : null;

      return (
        <div style={styles.card} className="card-mob">
          <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>😔</div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Eliminado!</div>
            <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 6 }}>Seu time foi eliminado nas {elimRoundName}.</div>
            {elimUserAgg !== null && elimOppAgg !== null && (
              <div style={{ fontSize: 13, fontFamily: "'Space Mono', monospace", color: '#e05050', marginBottom: 20 }}>
                Agregado: {elimUserAgg} x {elimOppAgg}
              </div>
            )}
            {simMode === 'manual' && <button style={styles.btnSmall} onClick={onNextRound}>Ver campeao</button>}
            {simMode === 'manual' && onSimulateAll && (
              <button style={{ ...styles.btnPrimary, background: '#d4a23c', color: '#0B1A12', margin: '8px auto', display: 'block' }} onClick={onSimulateAll}>
                Simular ate o campeao
              </button>
            )}
            {simMode === 'auto' && autoCountdown !== null && (
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#d4a23c' }}>Avancando em {autoCountdown}s...</div>
            )}
          </div>
          {roundResults && cupRound.matches && leg1Results && (
            <div style={styles.otherMatchesBox}>
              <div style={styles.sectionLabel}>Agregado — {roundName}</div>
              {cupRound.matches.map((origM, i) => {
                const l1 = leg1Results[i] || { homeGoals: 0, awayGoals: 0 };
                const l2 = roundResults[i] || { homeGoals: 0, awayGoals: 0 };
                const aggHome = l1.homeGoals + l2.awayGoals;
                const aggAway = l1.awayGoals + l2.homeGoals;
                const h = leagueTeams.find(t => t.id === origM.homeId);
                const a = leagueTeams.find(t => t.id === origM.awayId);
                const hw = aggHome > aggAway;
                const aw = aggAway > aggHome;
                const isUserRow = origM.homeId === myTeamId || origM.awayId === myTeamId;
                return (
                  <div key={i} style={{ ...styles.otherMatchRow, background: isUserRow ? 'rgba(224,80,80,0.07)' : undefined }}>
                    <span style={{ ...styles.otherTeam, fontWeight: hw ? 700 : 400, color: hw ? '#7fd99a' : undefined }}>{h?.label}</span>
                    <span style={styles.otherScore}>{aggHome} - {aggAway}</span>
                    <span style={{ ...styles.otherTeam, textAlign: 'left', fontWeight: aw ? 700 : 400, color: aw ? '#7fd99a' : undefined }}>{a?.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          {cupRounds.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={styles.sectionLabel}>Chaveamento</div>
              <CupBracket cupRounds={cupRounds} leagueTeams={leagueTeams} myTeamId={myTeamId} myTeamColor={mc} onViewTeam={onViewTeam} />
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={styles.card} className="card-mob">
        <div style={styles.draftTopRow}>
          <div>
            <div style={styles.eyebrow}>Copa do Brasil · {legLabel}</div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, marginTop: 2 }}>{roundName}</div>
          </div>
          {roundDone && userInCup && simMode === 'manual' && (
            <button style={{ ...styles.btnSmall, background: mc, color: '#0B1A12' }} onClick={onNextRound}>
              {isLastCupRound && cupLeg === 2 ? '🏆 Ver campeão →' : cupLeg === 1 ? 'Jogo de Volta →' : 'Próxima fase →'}
            </button>
          )}
          {roundDone && userInCup && simMode === 'auto' && autoCountdown !== null && (
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: mc }}>
              Avançando em {autoCountdown}s…
            </div>
          )}
        </div>

        {/* Contexto do jogo de ida + agregado ao vivo quando estamos no jogo de volta */}
        {cupLeg === 2 && userLeg1 && origMatch && um && (() => {
          const myLeg1 = origMatch.homeId === myTeamId ? userLeg1.homeGoals : userLeg1.awayGoals;
          const oppLeg1 = origMatch.homeId === myTeamId ? userLeg1.awayGoals : userLeg1.homeGoals;
          // Placar ao vivo do jogo de volta (não o resultado final salvo em roundResults,
          // que só existe depois que a partida termina) — soma ao 1º jogo pra dar o
          // agregado em tempo real, minuto a minuto.
          const isUserHomeLeg2 = um.homeId === myTeamId;
          const myLeg2Live = isUserHomeLeg2 ? liveScore.home : liveScore.away;
          const oppLeg2Live = isUserHomeLeg2 ? liveScore.away : liveScore.home;
          const myAggLive = myLeg1 + myLeg2Live;
          const oppAggLive = oppLeg1 + oppLeg2Live;
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: 10, marginBottom: 12, fontSize: 12, flexWrap: 'wrap' }}>
              <span style={{ opacity: 0.55 }}>1º jogo:</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#F4F1EA' }}>{myLeg1} × {oppLeg1}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span style={{ opacity: 0.55 }}>Agregado:</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: myAggLive > oppAggLive ? '#7fd99a' : myAggLive < oppAggLive ? '#e05050' : mc }}>{myAggLive} × {oppAggLive}</span>
            </div>
          );
        })()}

        <LiveMatchBox
          um={um} homeTeam={homeTeam} awayTeam={awayTeam}
          myTeamId={myTeamId} myTeamBadge={myTeamBadge} mc={mc}
          liveScore={liveScore} clockDisplay={clockDisplay}
          isSimulating={isSimulating} roundDone={roundDone}
          liveEvents={liveEvents} simSpeed={simSpeed}
          onSetSpeed={onSetSpeed} simMode={simMode} onSetSimMode={onSetSimMode}
          autoCountdown={autoCountdown} onStartRound={onStartRound}
          roundLabel={`Jogar — ${roundName} (${legLabel})`}
          isPaused={isPaused} onPause={onPause} onResume={onResume}
          showSubPanel={showSubPanel} liveLineup={liveLineup}
          subSelectStarter={subSelectStarter}
          onSelectSubStarter={onSelectSubStarter}
          onApplySub={onApplySub} myTeamColor={myTeamColor}
        />

        {/* Placar agregado após jogo de volta */}
        {roundDone && cupLeg === 2 && userLeg1 && origMatch && roundResults && (() => {
          const l2 = roundResults[userOrigIdx] || { homeGoals: 0, awayGoals: 0 };
          const isUserHome = origMatch.homeId === myTeamId;
          const userAgg = isUserHome ? (userLeg1.homeGoals + l2.awayGoals) : (userLeg1.awayGoals + l2.homeGoals);
          const oppAgg = isUserHome ? (userLeg1.awayGoals + l2.homeGoals) : (userLeg1.homeGoals + l2.awayGoals);
          return (
            <div style={{ textAlign: 'center', padding: '10px 0 4px', fontSize: 13 }}>
              <span style={{ opacity: 0.55, marginRight: 8 }}>Placar agregado:</span>
              <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 16, color: userAgg > oppAgg ? '#7fd99a' : userAgg < oppAgg ? '#e05050' : mc }}>
                {userAgg} × {oppAgg}
              </span>
              {userAgg > oppAgg && <span style={{ marginLeft: 8, color: '#7fd99a', fontSize: 12 }}>✓ Classificado</span>}
              {userAgg < oppAgg && <span style={{ marginLeft: 8, color: '#e05050', fontSize: 12 }}>✗ Eliminado</span>}
              {userAgg === oppAgg && <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 12 }}>Pênaltis</span>}
            </div>
          );
        })()}

        {roundDone && (
          <div style={styles.otherMatchesBox}>
            <div style={styles.sectionLabel}>
              {cupLeg === 2 ? `Agregado — ${roundName}` : `Outros jogos — ${roundName} · Jogo de Ida`}
            </div>
            {cupLeg === 2 && cupRound.matches && leg1Results
              ? cupRound.matches
                .map((origM, i) => ({ origM, i }))
                .filter(({ origM }) => origM.homeId !== myTeamId && origM.awayId !== myTeamId)
                .map(({ origM, i }) => {
                  const l1 = leg1Results[i] || { homeGoals: 0, awayGoals: 0 };
                  const l2 = roundResults[i] || { homeGoals: 0, awayGoals: 0 };
                  const aggHome = l1.homeGoals + l2.awayGoals;
                  const aggAway = l1.awayGoals + l2.homeGoals;
                  const h = leagueTeams.find(t => t.id === origM.homeId);
                  const a = leagueTeams.find(t => t.id === origM.awayId);
                  const winH = aggHome > aggAway, winA = aggAway > aggHome;
                  return (
                    <div key={i} style={styles.otherMatchRow}>
                      <span style={{ ...styles.otherTeam, fontWeight: winH ? 700 : 400, color: winH ? '#7fd99a' : undefined }}>{h?.label}</span>
                      <span style={styles.otherScore}>{aggHome} – {aggAway}</span>
                      <span style={{ ...styles.otherTeam, textAlign: 'left', fontWeight: winA ? 700 : 400, color: winA ? '#7fd99a' : undefined }}>{a?.label}</span>
                    </div>
                  );
                })
              : roundResults.filter(r => r.homeId !== myTeamId && r.awayId !== myTeamId).map((r, i) => {
                const h = leagueTeams.find(t => t.id === r.homeId);
                const a = leagueTeams.find(t => t.id === r.awayId);
                const winH = r.homeGoals > r.awayGoals, winA = r.awayGoals > r.homeGoals;
                return (
                  <div key={i} style={styles.otherMatchRow}>
                    <span style={{ ...styles.otherTeam, fontWeight: winH ? 700 : 400, color: winH ? '#7fd99a' : undefined }}>{h?.label}</span>
                    <span style={styles.otherScore}>{r.homeGoals} – {r.awayGoals}</span>
                    <span style={{ ...styles.otherTeam, textAlign: 'left', fontWeight: winA ? 700 : 400, color: winA ? '#7fd99a' : undefined }}>{a?.label}</span>
                  </div>
                );
              })
            }
          </div>
        )}

        {/* Pênaltis */}
        {roundDone && cupLeg === 2 && (() => {
          const penRes = cupRound.penaltyResults || [];
          if (!penRes.length) return null;
          return (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
              <div style={styles.sectionLabel}>Penaltis</div>
              {penRes.map((pr, pi) => {
                const hTeam = leagueTeams.find(t => t.id === cupRound.matches[pr.matchIdx]?.homeId);
                const aTeam = leagueTeams.find(t => t.id === cupRound.matches[pr.matchIdx]?.awayId);
                return (
                  <div key={pi} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{hTeam?.label} {pr.goalsA} x {pr.goalsB} {aTeam?.label}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{hTeam?.label}: {pr.kicks.map(k => k.a ? 'O' : 'X').join(' ')}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{aTeam?.label}: {pr.kicks.map(k => k.b ? 'O' : 'X').join(' ')}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Chaveamento das fases */}
        {cupRounds.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={styles.sectionLabel}>Chaveamento</div>
            <CupBracket cupRounds={cupRounds} leagueTeams={leagueTeams} myTeamId={myTeamId} myTeamColor={mc} onViewTeam={onViewTeam} />
          </div>
        )}
      </div>
    );
  }

  // ── BRASILEIRÃO ─────────────────────────────────────────────
  const totalRounds = fixtures.length;
  const isLastRound = currentRound + 1 >= totalRounds;

  return (
    <div style={styles.card} className="card-mob">
      <div style={styles.draftTopRow}>
        <div>
          <div style={styles.eyebrow}>Brasileirão · Série A</div>
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>Rodada {currentRound + 1} de {totalRounds}</div>
        </div>
        {roundDone && simMode === 'manual' && (
          <button style={{ ...styles.btnSmall, background: mc, color: '#0B1A12' }} onClick={onNextRound}>
            {isLastRound ? 'Ver resultado final →' : 'Próxima rodada →'}
          </button>
        )}
        {roundDone && simMode === 'auto' && autoCountdown !== null && (
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: mc }}>
            Avançando em {autoCountdown}s…
          </div>
        )}
      </div>

      <LiveMatchBox
        um={um} homeTeam={homeTeam} awayTeam={awayTeam}
        myTeamId={myTeamId} myTeamBadge={myTeamBadge} mc={mc}
        liveScore={liveScore} clockDisplay={clockDisplay}
        isSimulating={isSimulating} roundDone={roundDone}
        liveEvents={liveEvents} simSpeed={simSpeed}
        onSetSpeed={onSetSpeed} simMode={simMode} onSetSimMode={onSetSimMode}
        autoCountdown={autoCountdown} onStartRound={onStartRound}
        roundLabel={`Jogar Rodada ${currentRound + 1}`}
        isPaused={isPaused} onPause={onPause} onResume={onResume}
        showSubPanel={showSubPanel} liveLineup={liveLineup}
        subSelectStarter={subSelectStarter}
        onSelectSubStarter={onSelectSubStarter}
        onApplySub={onApplySub} myTeamColor={myTeamColor}
      />

      {roundDone && (
        <div style={styles.otherMatchesBox}>
          <div style={styles.sectionLabel}>Outros jogos da rodada {currentRound + 1}</div>
          {roundResults.filter(r => r.homeId !== myTeamId && r.awayId !== myTeamId).map((r, i) => {
            const h = leagueTeams.find(t => t.id === r.homeId);
            const a = leagueTeams.find(t => t.id === r.awayId);
            const hw = r.homeGoals > r.awayGoals, aw = r.awayGoals > r.homeGoals;
            return (
              <div key={i} style={styles.otherMatchRow}>
                <span style={{ ...styles.otherTeam, fontWeight: hw ? 700 : 400 }}>{h?.label}</span>
                <span style={styles.otherScore}>{r.homeGoals} – {r.awayGoals}</span>
                <span style={{ ...styles.otherTeam, textAlign: 'left', fontWeight: aw ? 700 : 400 }}>{a?.label}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={styles.tableSection} className="table-scroll">
        <div style={styles.sectionLabel}>Classificacao Geral</div>
        <div style={styles.tableHeaderRow}>
          <span style={styles.tablePos}>#</span>
          <span style={{ flex: 1 }}>Time</span>
          <span style={styles.tableCell}>PJ</span>
          <span style={styles.tableCell}>V</span>
          <span style={styles.tableCell}>E</span>
          <span style={styles.tableCell}>D</span>
          <span style={styles.tableCell}>GP</span>
          <span style={styles.tableCell}>GC</span>
          <span style={styles.tableCell}>SG</span>
          <span style={{ ...styles.tableCell, color: '#d4a23c', fontWeight: 700 }}>PTS</span>
          <span style={{ width: 28 }}></span>
        </div>
        {leagueTable.map((row, i) => {
          const isMe = row.id === myTeamId;
          const sg = row.gp - row.gc;
          const zone = isMe ? null : getZoneInfo(i + 1, leagueTable.length);
          return (
            <div key={row.id} style={{
              ...styles.tableRow,
              background: isMe ? hexToRgba(mc, 0.1) : i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
              borderLeft: isMe ? `3px solid ${mc}` : zone ? `3px solid ${zone.color}` : '3px solid transparent',
            }}>
              <span style={styles.tablePos}>{i + 1}</span>
              <span
                onClick={() => !isMe && onViewTeam && onViewTeam(leagueTeams.find(t => t.id === row.id))}
                style={{ flex: 1, fontWeight: isMe ? 700 : 400, color: isMe ? mc : '#F4F1EA', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, cursor: isMe ? 'default' : 'pointer' }}
              >
                {isMe
                  ? (myTeamBadge && <span>{myTeamBadge}</span>)
                  : (row.clubLogo && <img src={row.clubLogo} style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }} alt="" />)
                }
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
              </span>
              <span style={styles.tableCell}>{row.pj}</span>
              <span style={{ ...styles.tableCell, color: row.v > 0 ? '#7fd99a' : undefined }}>{row.v}</span>
              <span style={styles.tableCell}>{row.e}</span>
              <span style={{ ...styles.tableCell, color: row.d > 0 ? '#e0593f' : undefined }}>{row.d}</span>
              <span style={styles.tableCell}>{row.gp}</span>
              <span style={styles.tableCell}>{row.gc}</span>
              <span style={{ ...styles.tableCell, color: sg > 0 ? '#7fd99a' : sg < 0 ? '#e0593f' : undefined }}>{sg >= 0 ? `+${sg}` : sg}</span>
              <span style={{ ...styles.tableCell, fontWeight: 700, color: '#d4a23c' }}>{row.pts}</span>
              <span style={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {zone && !isMe && <span title={zone.title} style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, background: `${zone.color}22`, color: zone.color, fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>{zone.label}</span>}
              </span>
            </div>
          );
        })}
        {/* Legenda de zonas */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: 11, opacity: 0.6 }}>
          {[['#22c55e', 'G4 Libertadores (grupos)'], ['#86efac', 'G6 Libertadores (pre)'], ['#60a5fa', 'SA Sul-Americana'], ['#ef4444', 'Z4 Rebaixamento']].map(([c, l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* Artilheiros */}
      {scorers && Object.keys(scorers).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={styles.sectionLabel}>Artilheiros</div>
          {Object.entries(scorers)
            .sort((a, b) => b[1].goals - a[1].goals)
            .slice(0, 5)
            .map(([name, d], i) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                <span style={{ width: 20, textAlign: 'right', opacity: 0.4, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{i + 1}.</span>
                <span style={{ flex: 1 }}>{name}</span>
                <span style={{ fontSize: 11, opacity: 0.5 }}>{d.teamLabel}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: mc }}>gol {d.goals}</span>
              </div>
            ))
          }
        </div>
      )}

      {assisters && Object.keys(assisters).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={styles.sectionLabel}>Lideres de Assistencia</div>
          {Object.entries(assisters)
            .sort((a, b) => b[1].assists - a[1].assists)
            .slice(0, 5)
            .map(([name, d], i) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                <span style={{ width: 20, textAlign: 'right', opacity: 0.4, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{i + 1}.</span>
                <span style={{ flex: 1 }}>{name}</span>
                <span style={{ fontSize: 11, opacity: 0.5 }}>{d.teamLabel}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: mc }}>assist {d.assists}</span>
              </div>
            ))
          }
        </div>
      )}

      {/* Historico de partidas */}
      {matchHistory && matchHistory.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setShowHistory(h => !h)} style={{ background: 'none', border: 'none', color: mc, fontFamily: "'Space Mono', monospace", fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
            {showHistory ? 'v' : '>'} Historico ({matchHistory.length} partida{matchHistory.length !== 1 ? 's' : ''})
          </button>
          {showHistory && (
            <div style={{ marginTop: 8 }}>
              {[...matchHistory].reverse().map((m, i) => (
                <div key={i} style={{ ...styles.otherMatchRow, fontSize: 12 }}>
                  <span style={{ fontSize: 10, opacity: 0.4, minWidth: 32 }}>{m.gameMode === 'copa' ? m.legLabel : `R${m.round}`}</span>
                  <span style={{ ...styles.otherTeam, fontWeight: m.hg > m.ag ? 700 : 400 }}>{m.homeLabel}</span>
                  <span style={styles.otherScore}>{m.hg} - {m.ag}</span>
                  <span style={{ ...styles.otherTeam, textAlign: 'left', fontWeight: m.ag > m.hg ? 700 : 400 }}>{m.awayLabel}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// RESULTADO FINAL
// ============================================================
function getMostCommonClub(players = []) {
  const counts = {};
  for (const p of players) { if (p.club) counts[p.club] = (counts[p.club] || 0) + 1; }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function AnthemPlayer({ club }) {
  const [playing, setPlaying] = React.useState(true);
  const videoId = CLUB_ANTHEMS[club];
  if (!videoId) return null;
  return (
    <div style={{ marginTop: 24, borderRadius: 12, border: '1px solid rgba(212,162,60,0.3)', background: '#0a1a0f', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
      {/* iframe escondido — só áudio */}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
        {playing && (
          <iframe
            key={videoId}
            width="1"
            height="1"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0`}
            allow="autoplay; encrypted-media"
            title={`Hino ${club}`}
          />
        )}
      </div>

      {/* Indicador visual */}
      <div style={{ fontSize: 28 }}>🎵</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#d4a23c' }}>Hino do Campeão</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{club}</div>
        {playing && (
          <div style={{ display: 'flex', gap: 3, marginTop: 6, alignItems: 'flex-end', height: 16 }}>
            {[8, 14, 10, 16, 6, 12, 10, 14, 8].map((h, i) => (
              <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: '#d4a23c', animation: `pulse ${0.6 + i * 0.1}s ease-in-out infinite alternate`, opacity: 0.8 }} />
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => setPlaying(p => !p)}
        style={{ background: playing ? 'rgba(212,162,60,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${playing ? 'rgba(212,162,60,0.5)' : 'rgba(255,255,255,0.2)'}`, borderRadius: 8, color: playing ? '#d4a23c' : '#aaa', cursor: 'pointer', padding: '6px 14px', fontSize: 13, fontWeight: 600 }}
      >
        {playing ? '⏸ Pausar' : '▶ Tocar'}
      </button>
    </div>
  );
}

function Results({ leagueTable, myTeamId, myTeamColor, myTeamBadge, myTeamLogo, gameMode, cupWinnerId, leagueTeams, onRestart, scorers, assisters, onNewSeason }) {
  const mc = myTeamColor || '#d4a23c';
  const topScorers = scorers ? Object.entries(scorers).sort((a, b) => b[1].goals - a[1].goals).slice(0, 3) : [];
  const topAssisters = assisters ? Object.entries(assisters).sort((a, b) => b[1].assists - a[1].assists).slice(0, 3) : [];

  // ── COPA ────────────────────────────────────────────────────
  if (gameMode === 'copa') {
    const winner = leagueTeams?.find(t => t.id === cupWinnerId);
    const userWon = cupWinnerId === myTeamId;
    const champClub = winner?.club || getMostCommonClub(winner?.players);
    return (
      <div style={styles.card} className="card-mob">
        <div style={{ textAlign: 'center', padding: '12px 0 28px' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{userWon ? '🏆' : '⚽'}</div>
          <div style={styles.eyebrow}>Copa do Brasil — Resultado Final</div>
          <h1 style={{ ...styles.h1, color: userWon ? mc : '#F4F1EA', marginTop: 8 }}>
            {userWon ? 'CAMPEAO!' : 'Copa encerrada'}
          </h1>
          <div style={{ fontSize: 15, opacity: 0.7, marginBottom: 20 }}>
            {userWon
              ? `${myTeamBadge || ''} ${myTeamBadge ? ' ' : ''}Seu time conquistou a Copa do Brasil!`
              : <>Campeao: <b style={{ color: '#d4a23c' }}>{winner?.label ?? '-'}</b></>
            }
          </div>
          {!userWon && myTeamBadge && (
            <div style={styles.badgeMuted}>Seu time foi eliminado antes da final. Tente de novo!</div>
          )}
          {userWon && <div style={styles.badge}>Copa do Brasil conquistada! Time lendario!</div>}
        </div>
        {topScorers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={styles.sectionLabel}>Artilheiro da Copa</div>
            {topScorers.map(([name, d], i) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 13 }}>
                <span style={{ width: 20, opacity: 0.4, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{i + 1}.</span>
                <span style={{ flex: 1 }}>{name}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: mc }}>gol {d.goals}</span>
              </div>
            ))}
          </div>
        )}
        {topAssisters.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={styles.sectionLabel}>Lider de Assistencia da Copa</div>
            {topAssisters.map(([name, d], i) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 13 }}>
                <span style={{ width: 20, opacity: 0.4, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{i + 1}.</span>
                <span style={{ flex: 1 }}>{name}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: mc }}>assist {d.assists}</span>
              </div>
            ))}
          </div>
        )}
        <AnthemPlayer club={champClub} />
        {onNewSeason && <button style={{ ...styles.btnGhost, marginTop: 10, width: '100%' }} onClick={onNewSeason}>Nova temporada com mesmo elenco</button>}
        <button style={{ ...styles.btnPrimary, marginTop: 10, width: '100%', background: mc, color: '#0B1A12' }} onClick={onRestart}>
          Jogar de novo
        </button>
      </div>
    );
  }

  // ── BRASILEIRAO ─────────────────────────────────────────────
  const pos = leagueTable.findIndex(t => t.id === myTeamId) + 1;
  const myRow = leagueTable.find(t => t.id === myTeamId) || {};
  const champion = leagueTable[0];
  const isChampion = pos === 1;
  const podium = pos <= 3;
  const champTeam = leagueTeams?.find(t => t.id === champion?.id);
  const champClub = champTeam?.club || getMostCommonClub(champTeam?.players);

  return (
    <div style={styles.card} className="card-mob">
      <div style={styles.eyebrow}>Fim do Brasileirao · Serie A</div>
      <h1 style={styles.h1} className="h1-mob">
        {isChampion ? 'CAMPEAO!' : podium ? `${pos}o lugar — podio!` : `${pos}o lugar`}
      </h1>

      {!isChampion && (
        <div style={styles.championBox}>
          Campeao: <b>{champion?.label}</b> — {champion?.pts} pts
        </div>
      )}

      <div style={styles.finalStats} className="stats-grid-3">
        <Stat label="Pontos" value={myRow.pts ?? 0} />
        <Stat label="Vitorias" value={myRow.v ?? 0} />
        <Stat label="Empates" value={myRow.e ?? 0} />
        <Stat label="Derrotas" value={myRow.d ?? 0} />
        <Stat label="Gols pro" value={myRow.gp ?? 0} />
        <Stat label="Gols contra" value={myRow.gc ?? 0} />
      </div>

      {isChampion && <div style={styles.badge}>Brasileirao conquistado! Voce montou um time lendario.</div>}
      {!isChampion && podium && <div style={styles.badgeInfo}>Campanha solida — faltou pouco pra vencer!</div>}
      {!podium && <div style={styles.badgeMuted}>Campanha dificil. Tente montar um time mais equilibrado.</div>}

      {topScorers.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={styles.sectionLabel}>Artilheiros</div>
          {topScorers.map(([name, d], i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 13 }}>
              <span style={{ width: 20, opacity: 0.4, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{i + 1}.</span>
              <span style={{ flex: 1 }}>{name}</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: mc }}>gol {d.goals}</span>
            </div>
          ))}
        </div>
      )}

      {topAssisters.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={styles.sectionLabel}>Lideres de Assistencia</div>
          {topAssisters.map(([name, d], i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 13 }}>
              <span style={{ width: 20, opacity: 0.4, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{i + 1}.</span>
              <span style={{ flex: 1 }}>{name}</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: mc }}>assist {d.assists}</span>
            </div>
          ))}
        </div>
      )}

      <AnthemPlayer club={champClub} />

      <div className="table-scroll">
        <div style={{ ...styles.sectionLabel, marginTop: 24 }}>Classificacao Final</div>
        <div style={styles.tableHeaderRow}>
          <span style={styles.tablePos}>#</span>
          <span style={{ flex: 1 }}>Time</span>
          <span style={styles.tableCell}>PJ</span>
          <span style={styles.tableCell}>V</span>
          <span style={styles.tableCell}>E</span>
          <span style={styles.tableCell}>D</span>
          <span style={styles.tableCell}>GP</span>
          <span style={styles.tableCell}>GC</span>
          <span style={styles.tableCell}>SG</span>
          <span style={{ ...styles.tableCell, color: '#d4a23c', fontWeight: 700 }}>PTS</span>
        </div>
        {leagueTable.map((row, i) => {
          const isMe = row.id === myTeamId;
          const sg = row.gp - row.gc;
          const zone = isMe ? null : getZoneInfo(i + 1, leagueTable.length);
          return (
            <div key={row.id} style={{
              ...styles.tableRow,
              background: isMe ? hexToRgba(mc, 0.1) : i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
              borderLeft: isMe ? `3px solid ${mc}` : zone ? `3px solid ${zone.color}` : '3px solid transparent',
            }}>
              <span style={styles.tablePos}>{i + 1}</span>
              <span style={{ flex: 1, fontWeight: isMe ? 700 : 400, color: isMe ? mc : '#F4F1EA', fontSize: 13 }}>
                {isMe && myTeamBadge && <span style={{ marginRight: 4 }}>{myTeamBadge}</span>}
                {row.label}
              </span>
              <span style={styles.tableCell}>{row.pj}</span>
              <span style={styles.tableCell}>{row.v}</span>
              <span style={styles.tableCell}>{row.e}</span>
              <span style={styles.tableCell}>{row.d}</span>
              <span style={styles.tableCell}>{row.gp}</span>
              <span style={styles.tableCell}>{row.gc}</span>
              <span style={styles.tableCell}>{sg >= 0 ? `+${sg}` : sg}</span>
              <span style={{ ...styles.tableCell, fontWeight: 700, color: '#d4a23c' }}>{row.pts}</span>
            </div>
          );
        })}
      </div>{/* /table-scroll */}

      {onNewSeason && <button style={{ ...styles.btnGhost, marginTop: 20, width: '100%' }} onClick={onNewSeason}>Nova temporada com mesmo elenco</button>}
      <button style={{ ...styles.btnPrimary, marginTop: 10, width: '100%', background: mc, color: '#0B1A12' }} onClick={onRestart}>
        Jogar de novo
      </button>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.statBox}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

// ============================================================
// ESTILO
// ============================================================
const globalCss = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  button { cursor: pointer; font-family: inherit; }
  button:focus-visible { outline: 2px solid #d4a23c; outline-offset: 2px; }
  button:disabled { cursor: not-allowed; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes fadeSlideIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .marquee-track { animation: marquee 48s linear infinite; }
  .marquee-track:hover { animation-play-state: paused; }
  .feat-card-hover:hover { border-color: rgba(212,162,60,0.4) !important; transform: translateY(-2px); }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
  @media (max-width: 768px) {
    .draft-layout-grid { grid-template-columns: 1fr !important; }
    .draft-layout-grid > div:first-child { order: 2; }
    .draft-layout-grid > div:last-child { order: 1; max-height: none !important; position: static !important; }
    .draft-left { max-height: 50vh !important; }
    .pitch-field { max-width: 300px !important; margin: 0 auto; }
    .main-pad { padding: 16px 12px 60px !important; }
    .header-inner-pad { padding: 12px 14px !important; }
    .intro-title-h { font-size: 26px !important; line-height: 1.2 !important; }
    .feat-grid-3 { grid-template-columns: 1fr 1fr !important; }
    .stats-grid-3 { grid-template-columns: 1fr 1fr !important; }
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .table-scroll > * { min-width: 420px; }
    .card-mob { padding: 16px 12px !important; }
    .live-score-n { font-size: 20px !important; min-width: 18px !important; }
    .live-teams-row { gap: 6px !important; }
    .live-team-n { font-size: 12px !important; }
    .squad-row-g { grid-template-columns: 36px 1fr auto 36px !important; gap: 8px !important; }
    .pitch-spot { width: 40px !important; height: 40px !important; font-size: 8px !important; }
    .pitch-spot-name { font-size: 7px !important; }
    .h1-mob { font-size: 24px !important; }
    .h2-mob { font-size: 18px !important; }
    .intro-card-mob { padding: 28px 16px 24px !important; }
    .formation-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
  }
  input::placeholder { color: rgba(255,255,255,0.2); }
  input:focus { border-color: rgba(212,162,60,0.5) !important; outline: none; }
  .draft-left { scrollbar-width: thin; scrollbar-color: rgba(212,162,60,0.3) transparent; }
  .draft-left::-webkit-scrollbar { width: 3px; }
  .draft-left::-webkit-scrollbar-track { background: transparent; }
  .draft-left::-webkit-scrollbar-thumb { background: rgba(212,162,60,0.35); border-radius: 999px; }
  .draft-left::-webkit-scrollbar-thumb:hover { background: rgba(212,162,60,0.65); }
  .formation-card:hover { background: rgba(212,162,60,0.09) !important; border-color: rgba(212,162,60,0.45) !important; transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.35); }
  .formation-card:active { transform: translateY(0); }
`;

const styles = {
  page: { minHeight: '100vh', background: '#0B1A12', color: '#F4F1EA', fontFamily: "'Source Sans 3', system-ui, sans-serif", position: 'relative', overflow: 'hidden' },
  bgTexture: { position: 'fixed', inset: 0, opacity: 0.05, background: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 1px,transparent 40px)', pointerEvents: 'none' },
  header: { borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'relative', zIndex: 1 },
  headerInner: { maxWidth: 760, margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 },
  crest: { fontSize: 28 },
  title: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, letterSpacing: 0.5 },
  subtitle: { fontFamily: "'Space Mono', monospace", fontSize: 11, opacity: 0.6, letterSpacing: 1, textTransform: 'uppercase' },
  main: { maxWidth: 760, margin: '0 auto', padding: '32px 24px 80px', position: 'relative', zIndex: 1 },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28 },
  h1: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, lineHeight: 1.15, margin: '0 0 16px' },
  h2: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, margin: '4px 0 20px' },
  lead: { fontSize: 16, lineHeight: 1.6, opacity: 0.85, marginBottom: 28 },
  eyebrow: { fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#d4a23c' },
  skipsBadge: { fontSize: 12, padding: '6px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 999 },
  draftTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  btnPrimary: { background: '#d4a23c', color: '#0B1A12', border: 'none', borderRadius: 10, padding: '14px 28px', fontSize: 16, fontWeight: 700 },
  btnGhost: { background: 'transparent', color: '#F4F1EA', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '12px 24px', fontSize: 14, marginTop: 16, width: '100%' },
  btnSmall: { background: '#d4a23c', color: '#0B1A12', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700 },
  btnDisabled: { opacity: 0.35 },
  btnRow: { display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' },
  emptyState: { background: 'rgba(224,89,63,0.1)', border: '1px solid rgba(224,89,63,0.4)', borderRadius: 10, padding: '16px 18px', fontSize: 14, lineHeight: 1.5 },

  formationIntro: { fontSize: 13, opacity: 0.6, lineHeight: 1.5, marginBottom: 24, maxWidth: 520 },
  formationGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  formationCard: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16,
    padding: '18px 16px', color: '#F4F1EA', textAlign: 'center', cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s, transform 0.15s, box-shadow 0.15s',
  },
  formationName: { fontSize: 13, fontWeight: 700, marginBottom: 10, fontFamily: "'Space Mono', monospace" },
  formationShapeNum: { fontSize: 23, fontWeight: 800, fontFamily: "'Space Mono', monospace", letterSpacing: 0.5, color: '#F4F1EA' },
  formationShapeDesc: { fontSize: 11.5, opacity: 0.55, marginTop: 4, marginBottom: 14, lineHeight: 1.4, minHeight: 32 },
  formationSectionHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' },
  formationSectionTitle: { display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Space Mono', monospace", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: '#d4a23c' },
  formationSectionHint: { fontSize: 11.5, opacity: 0.45, fontStyle: 'italic' },
  miniPitch: {
    position: 'relative', width: '100%', aspectRatio: '0.66',
    background: 'linear-gradient(180deg,#0f3d22,#145c30)', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.2)', overflow: 'hidden',
    boxShadow: 'inset 0 0 18px rgba(0,0,0,0.35)',
  },
  miniPitchHalfLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(255,255,255,0.2)', pointerEvents: 'none' },
  miniPitchCircle: { position: 'absolute', left: '50%', top: '50%', width: 30, height: 30, marginLeft: -15, marginTop: -15, border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', pointerEvents: 'none' },
  miniPitchCenterDot: { position: 'absolute', left: '50%', top: '50%', width: 3, height: 3, marginLeft: -1.5, marginTop: -1.5, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', pointerEvents: 'none' },
  miniPitchArcTop: { position: 'absolute', left: '50%', top: 0, width: 46, height: 22, marginLeft: -23, border: '1px solid rgba(255,255,255,0.16)', borderTop: 'none', borderRadius: '0 0 50% 50% / 0 0 100% 100%', pointerEvents: 'none' },
  miniPitchArcBottom: { position: 'absolute', left: '50%', bottom: 0, width: 46, height: 22, marginLeft: -23, border: '1px solid rgba(255,255,255,0.16)', borderBottom: 'none', borderRadius: '50% 50% 0 0 / 100% 100% 0 0', pointerEvents: 'none' },
  miniDot: {
    position: 'absolute', width: 22, height: 22, borderRadius: '50%', transform: 'translate(-50%,-50%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid rgba(0,0,0,0.45)', boxShadow: '0 1px 4px rgba(0,0,0,0.5)', zIndex: 2,
  },
  miniDotLabel: { fontSize: 7.5, fontWeight: 800, color: '#0B1A12', fontFamily: "'Space Mono', monospace", lineHeight: 1, letterSpacing: -0.2 },

  pitchWrap: { margin: '20px 0', display: 'flex', justifyContent: 'center' },
  pitchField: { position: 'relative', width: '100%', maxWidth: 380, aspectRatio: '0.68', background: 'linear-gradient(180deg,#0f3d22 0%,#145c30 50%,#0f3d22 100%)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 8, overflow: 'hidden' },

  rolledTeamBox: { marginTop: 24 },
  rolledTeamHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '2px solid', borderRadius: 12, marginBottom: 16 },
  diceIcon: { fontSize: 24 },
  diceIconSpin: { fontSize: 40, animation: 'spin 0.5s linear infinite' },
  rolledTeamLabel: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700 },
  rolledTeamCoach: { fontSize: 12, opacity: 0.6 },
  rollingBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 16px', marginTop: 8 },
  rollingName: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, minHeight: 30 },
  rollingHint: { fontSize: 12, opacity: 0.5, fontFamily: "'Space Mono', monospace", letterSpacing: 1, textTransform: 'uppercase' },
  selectedPlayerBanner: { textAlign: 'center', fontSize: 13, padding: '10px 14px', background: 'rgba(127,217,154,0.12)', border: '1px solid rgba(127,217,154,0.4)', borderRadius: 8, margin: '12px 0' },
  elevenGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 },
  elevenCard: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 10px', textAlign: 'center', color: '#F4F1EA', fontFamily: 'inherit' },
  elevenOvr: { fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: '#d4a23c' },
  elevenName: { fontSize: 13, fontWeight: 600, margin: '4px 0 2px', minHeight: 32 },
  elevenPos: { fontSize: 10, opacity: 0.5, marginBottom: 4, fontFamily: "'Space Mono', monospace" },
  elevenBlocked: { fontSize: 10, opacity: 0.5, fontStyle: 'italic', padding: '6px 0' },
  elevenMultiHint: { fontSize: 9, opacity: 0.55, marginTop: 2, lineHeight: 1.3 },
  elevenSelectedHint: { fontSize: 10, color: '#7fd99a', fontWeight: 700, marginTop: 2 },

  squadList: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 20 },
  squadRow: { display: 'grid', gridTemplateColumns: '50px 1fr auto 40px', gap: 12, alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 },
  squadPos: { fontFamily: "'Space Mono', monospace", fontSize: 11, opacity: 0.6 },
  squadName: { fontWeight: 600, fontSize: 15 },
  squadTeam: { fontSize: 12, opacity: 0.5 },
  squadOvr: { fontFamily: "'Space Mono', monospace", fontWeight: 700, color: '#d4a23c', textAlign: 'right' },

  // Jogo ao vivo
  liveMatchBox: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '20px 16px', marginBottom: 20 },
  liveTeamsRow: { display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, marginBottom: 12 },
  liveTeamName: { fontSize: 14, lineHeight: 1.3 },
  liveScoreBlock: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.35)', borderRadius: 10, padding: '8px 16px' },
  liveScoreNum: { fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: '#F4F1EA', minWidth: 24, textAlign: 'center' },
  liveScoreDash: { fontFamily: "'Space Mono', monospace", fontSize: 20, opacity: 0.5 },
  clockRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 },
  clock: { fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700 },
  clockPulse: { width: 8, height: 8, borderRadius: '50%', background: '#7fd99a', animation: 'pulse 1s ease-in-out infinite' },
  clockFull: { fontSize: 12, opacity: 0.5, fontFamily: "'Space Mono', monospace" },
  matchCenter: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', marginTop: 4 },
  matchCenterRow: { display: 'grid', gridTemplateColumns: '1fr 52px 1fr', alignItems: 'center', gap: 6 },
  matchCenterSide: { display: 'flex' },
  matchCenterCard: { display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px', borderRadius: 8, border: '1px solid', maxWidth: '100%' },
  matchCenterInfo: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
  matchCenterMinuteCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 },
  goalMinute: { fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: '#d4a23c' },
  goalScorer: { fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  goalTeam: { fontSize: 11, opacity: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  goalScore: { fontFamily: "'Space Mono', monospace", fontSize: 11, opacity: 0.6, whiteSpace: 'nowrap' },
  noGoalsMsg: { textAlign: 'center', opacity: 0.5, fontSize: 13, padding: '12px 0' },

  // Outros jogos da rodada
  otherMatchesBox: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px', marginBottom: 20 },
  otherMatchRow: { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', padding: '6px 4px', fontSize: 13 },
  otherTeam: { textAlign: 'right', opacity: 0.8 },
  otherScore: { fontFamily: "'Space Mono', monospace", fontWeight: 700, textAlign: 'center', minWidth: 48, background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '2px 6px' },

  // Tabela de classificação
  tableSection: { marginTop: 8 },
  sectionLabel: { fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#d4a23c', marginBottom: 8, marginTop: 20 },
  tableHeaderRow: { display: 'flex', alignItems: 'center', padding: '6px 10px', fontSize: 11, opacity: 0.5, fontFamily: "'Space Mono', monospace", letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.08)' },
  tableRow: { display: 'flex', alignItems: 'center', padding: '7px 10px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' },
  tablePos: { width: 22, fontSize: 11, opacity: 0.5, fontFamily: "'Space Mono', monospace", textAlign: 'center', flexShrink: 0 },
  tableCell: { width: 32, textAlign: 'center', fontFamily: "'Space Mono', monospace", fontSize: 12, flexShrink: 0 },

  // Resultado final
  finalStats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20, marginTop: 8 },
  statBox: { background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '14px 10px', textAlign: 'center' },
  statValue: { fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: '#d4a23c' },
  statLabel: { fontSize: 11, opacity: 0.6, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  badge: { background: 'rgba(212,162,60,0.15)', border: '1px solid #d4a23c', borderRadius: 10, padding: '14px 18px', marginBottom: 16, fontWeight: 600 },
  badgeInfo: { background: 'rgba(127,217,154,0.08)', border: '1px solid rgba(127,217,154,0.3)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, fontSize: 14 },
  badgeMuted: { background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, opacity: 0.7, fontSize: 14 },
  championBox: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14 },

  // Editor de time
  teamEditCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '20px', marginBottom: 28, textAlign: 'left' },
  teamEditPreview: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 },
  teamEditSep: { height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 0 16px' },
  teamEditSection: { marginBottom: 14 },
  teamEditLabel: { display: 'block', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.45, marginBottom: 8 },
  badgeGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  colorGrid: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  teamInput: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 12px', color: '#F4F1EA', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },

  // Intro screen
  introCard: { textAlign: 'center', padding: '40px 28px 36px', position: 'relative', overflow: 'hidden' },
  introTopBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  introBadge: { display: 'inline-block', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#d4a23c', background: 'rgba(212,162,60,0.12)', border: '1px solid rgba(212,162,60,0.35)', borderRadius: 999, padding: '5px 14px', marginBottom: 20 },
  introTitle: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 38, fontWeight: 700, lineHeight: 1.1, margin: '0 0 16px' },
  introLead: { fontSize: 16, lineHeight: 1.65, opacity: 0.75, maxWidth: 460, margin: '0 auto 36px' },
  featGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 },
  featCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '20px 14px', position: 'relative', transition: 'border-color 0.15s, transform 0.15s' },
  featIconWrap: { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 20 },
  featIndex: { position: 'absolute', top: 10, right: 12, fontFamily: "'Space Mono', monospace", fontSize: 10, opacity: 0.25, fontWeight: 700 },
  featIcon: { fontSize: 24, marginBottom: 8 },
  featTitle: { fontWeight: 700, fontSize: 13, marginBottom: 6 },
  featDesc: { fontSize: 12, opacity: 0.6, lineHeight: 1.5 },
  introSectionLabel: { fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.4, marginBottom: 12, textAlign: 'center' },
  introMarqueeWrap: {
    overflow: 'hidden', marginBottom: 32,
    maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
    WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
  },
  introMarqueeTrack: { display: 'flex', gap: 10, width: 'max-content' },
  introTeamChip: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, whiteSpace: 'nowrap', opacity: 0.75, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '5px 14px 5px 8px' },
  introTeamChipCrest: { width: 16, height: 16, objectFit: 'contain', borderRadius: '50%', flexShrink: 0 },
  btnIntro: { background: '#d4a23c', color: '#0B1A12', border: 'none', borderRadius: 12, padding: '16px 40px', fontSize: 17, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.3 },

  // Draft side-by-side layout
  draftLayout: { display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, marginTop: 16, alignItems: 'start' },
  draftLeft: { display: 'flex', flexDirection: 'column', gap: 0, maxHeight: '72vh', overflowY: 'auto', paddingRight: 4 },
  draftRight: { position: 'sticky', top: 16 },
  teamHeaderCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 },
  playersList: { display: 'flex', flexDirection: 'column', gap: 2 },
  playerRow: { display: 'grid', gridTemplateColumns: '38px 1fr auto', gap: 10, alignItems: 'center', padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid transparent', cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s' },
  playerOvr: { fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, textAlign: 'center' },
  playerInfo: { display: 'flex', flexDirection: 'column', gap: 1 },
  playerName: { fontSize: 13, fontWeight: 600 },
  playerPos: { fontFamily: "'Space Mono', monospace", fontSize: 10, opacity: 0.5 },
  playerHint: { fontSize: 10, color: '#7fd99a', fontStyle: 'italic' },
  skipsBox: { background: 'rgba(212,162,60,0.12)', border: '1px solid rgba(212,162,60,0.3)', borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 54 },
  skipsNum: { fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: '#d4a23c', display: 'block' },
  skipsLabel: { fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 },
  progressBar: { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#d4a23c', borderRadius: 999, transition: 'width 0.3s ease' },
  btnSkip: { background: 'transparent', color: '#F4F1EA', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', marginTop: 8, width: '100%' },
};
