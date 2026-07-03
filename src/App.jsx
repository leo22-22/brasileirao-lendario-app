import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Peer from 'peerjs';

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

// ============================================================
// DADOS: 27 times campeões brasileiros lendários (1961-2006)
// ============================================================
const TEAMS = [
  { id: 'santos1961', club: 'Santos', year: 1961, label: 'Santos 1961', coach: 'Lula',
    colors: { p: '#0a0a0a', s: '#f5f5f5' },
    players: [
      { name: 'Gylmar', pos: ['GOL'], ovr: 86 },
      { name: 'Lima', pos: ['LD'], ovr: 78 },
      { name: 'Mauro', pos: ['ZAG'], ovr: 82 },
      { name: 'Calvet', pos: ['ZAG'], ovr: 76 },
      { name: 'Dalmo', pos: ['LE'], ovr: 77 },
      { name: 'Zito', pos: ['VOL', 'MEI'], ovr: 87 },
      { name: 'Mengálvio', pos: ['MEI', 'VOL'], ovr: 83 },
      { name: 'Dorval', pos: ['PD'], ovr: 80 },
      { name: 'Coutinho', pos: ['MEI', 'PD'], ovr: 88 },
      { name: 'Pelé', pos: ['ATA'], ovr: 99 },
      { name: 'Pepe', pos: ['PE'], ovr: 89 },
      { name: 'Laércio', pos: ['GOL'], ovr: 72 },
      { name: 'Olavo', pos: ['ZAG'], ovr: 73 },
      { name: 'Carlos Alberto Torres', pos: ['LD'], ovr: 75 },
      { name: 'Clodoaldo', pos: ['VOL'], ovr: 74 },
      { name: 'Toninho Guerreiro', pos: ['ATA'], ovr: 76 },
      { name: 'Edu', pos: ['PE'], ovr: 74 },
      { name: 'Tite', pos: ['PE'], ovr: 73 },
    ]},
  { id: 'botafogo1968', club: 'Botafogo', year: 1968, label: 'Botafogo 1968', coach: 'Zagallo',
    colors: { p: '#0a0a0a', s: '#f5f5f5' },
    players: [
      { name: 'Cao', pos: ['GOL'], ovr: 79 },
      { name: 'Moreira', pos: ['LD'], ovr: 77 },
      { name: 'Zé Carlos', pos: ['ZAG'], ovr: 78 },
      { name: 'Leônidas', pos: ['ZAG'], ovr: 77 },
      { name: 'Waltencir', pos: ['LE'], ovr: 78 },
      { name: 'Carlos Roberto', pos: ['VOL'], ovr: 81 },
      { name: 'Gérson', pos: ['MEI', 'VOL'], ovr: 92 },
      { name: 'Rogério', pos: ['PD'], ovr: 80 },
      { name: 'Roberto', pos: ['ATA'], ovr: 81 },
      { name: 'Jairzinho', pos: ['ATA'], ovr: 93 },
      { name: 'Paulo Cézar Caju', pos: ['PE'], ovr: 86 },
      { name: 'Ubirajara Motta', pos: ['GOL'], ovr: 71 },
      { name: 'Chiquinho Pastor', pos: ['ZAG'], ovr: 73 },
      { name: 'Moisés', pos: ['ZAG'], ovr: 72 },
      { name: 'Nei Conceição', pos: ['VOL'], ovr: 75 },
      { name: 'Zequinha', pos: ['PD'], ovr: 74 },
      { name: 'Ferretti', pos: ['ATA'], ovr: 78 },
      { name: 'Humberto', pos: ['ATA'], ovr: 74 },
      { name: 'Afonsinho', pos: ['MEI'], ovr: 76 },
      { name: 'Torino', pos: ['ATA'], ovr: 72 },
    ]},
  { id: 'palmeiras1972', club: 'Palmeiras', year: 1972, label: 'Palmeiras 1972 (Academia)', coach: 'Osvaldo Brandão',
    colors: { p: '#006437', s: '#f5f5f5' },
    players: [
      { name: 'Leão', pos: ['GOL'], ovr: 85 },
      { name: 'Eurico', pos: ['LD'], ovr: 78 },
      { name: 'Luís Pereira', pos: ['ZAG'], ovr: 86 },
      { name: 'Alfredo', pos: ['ZAG'], ovr: 77 },
      { name: 'Zeca', pos: ['LE'], ovr: 78 },
      { name: 'Dudu', pos: ['VOL'], ovr: 84 },
      { name: 'Ademir da Guia', pos: ['MEI', 'PD'], ovr: 91 },
      { name: 'Edu Bala', pos: ['PD'], ovr: 81 },
      { name: 'Madurga', pos: ['ATA'], ovr: 78 },
      { name: 'Leivinha', pos: ['ATA'], ovr: 87 },
      { name: 'Nei', pos: ['PE'], ovr: 80 },
      { name: 'Zé Carlos', pos: ['MEI'], ovr: 73 },
      { name: 'Ronaldo', pos: ['ATA'], ovr: 74 },
    ]},
  { id: 'internacional1975', club: 'Internacional', year: 1975, label: 'Internacional 1975', coach: 'Rubens Minelli',
    colors: { p: '#d2122e', s: '#f5f5f5' },
    players: [
      { name: 'Manga', pos: ['GOL'], ovr: 83 },
      { name: 'Valdir', pos: ['LD'], ovr: 76 },
      { name: 'Figueroa', pos: ['ZAG'], ovr: 92 },
      { name: 'Hermínio', pos: ['ZAG'], ovr: 77 },
      { name: 'Chico Fraga', pos: ['LE'], ovr: 76 },
      { name: 'Caçapava', pos: ['VOL'], ovr: 79 },
      { name: 'Falcão', pos: ['MEI', 'VOL'], ovr: 90 },
      { name: 'Carpegiani', pos: ['MEI', 'VOL'], ovr: 83 },
      { name: 'Valdomiro', pos: ['PD'], ovr: 80 },
      { name: 'Flávio', pos: ['ATA'], ovr: 85 },
      { name: 'Lula', pos: ['PE'], ovr: 79 },
      { name: 'Jair', pos: ['PD', 'ATA'], ovr: 75 },
      { name: 'Escurinho', pos: ['ATA'], ovr: 73 },
      { name: 'Dario', pos: ['ATA'], ovr: 72 },
    ]},
  { id: 'internacional1979', club: 'Internacional', year: 1979, label: 'Internacional 1979 (invicto)', coach: 'Ênio Andrade',
    colors: { p: '#d2122e', s: '#f5f5f5' },
    players: [
      { name: 'Benítez', pos: ['GOL'], ovr: 82 },
      { name: 'João Carlos', pos: ['LD'], ovr: 76 },
      { name: 'Mauro Pastor', pos: ['ZAG'], ovr: 77 },
      { name: 'Mauro Galvão', pos: ['ZAG'], ovr: 84 },
      { name: 'Cláudio Mineiro', pos: ['LE'], ovr: 76 },
      { name: 'Batista', pos: ['VOL'], ovr: 80 },
      { name: 'Falcão', pos: ['MEI', 'VOL'], ovr: 93 },
      { name: 'Jair', pos: ['MEI'], ovr: 82 },
      { name: 'Valdomiro', pos: ['PD'], ovr: 79 },
      { name: 'Bira', pos: ['ATA'], ovr: 78 },
      { name: 'Mário Sérgio', pos: ['PE'], ovr: 80 },
      { name: 'Chico Spina', pos: ['ATA'], ovr: 76 },
      { name: 'Beliato', pos: ['ZAG'], ovr: 72 },
      { name: 'Larry', pos: ['ZAG'], ovr: 71 },
      { name: 'Toninho', pos: ['VOL'], ovr: 72 },
    ]},
  { id: 'flamengo1980', club: 'Flamengo', year: 1980, label: 'Flamengo 1980', coach: 'Cláudio Coutinho',
    colors: { p: '#c8102e', s: '#0a0a0a' },
    players: [
      { name: 'Raul', pos: ['GOL'], ovr: 84 },
      { name: 'Toninho', pos: ['LD'], ovr: 78 },
      { name: 'Rondinelli', pos: ['ZAG'], ovr: 79 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 82 },
      { name: 'Júnior', pos: ['LE', 'PE'], ovr: 91 },
      { name: 'Andrade', pos: ['VOL'], ovr: 86 },
      { name: 'Carpeggiani', pos: ['MEI', 'VOL'], ovr: 81 },
      { name: 'Zico', pos: ['MEI'], ovr: 97 },
      { name: 'Tita', pos: ['PD'], ovr: 83 },
      { name: 'Nunes', pos: ['ATA'], ovr: 85 },
      { name: 'Júlio César', pos: ['PE'], ovr: 78 },
      { name: 'Cantarelli', pos: ['GOL'], ovr: 70 },
      { name: 'Nei Dias', pos: ['LD'], ovr: 72 },
      { name: 'Vítor', pos: ['VOL'], ovr: 74 },
      { name: 'Peu', pos: ['ATA'], ovr: 75 },
      { name: 'Anselmo', pos: ['ATA'], ovr: 71 },
      { name: 'Carlos Henrique', pos: ['ATA'], ovr: 76 },
    ]},
  { id: 'flamengo1981', club: 'Flamengo', year: 1981, label: 'Flamengo 1981 (Mundial)', coach: 'Paulo César Carpegiani',
    colors: { p: '#c8102e', s: '#0a0a0a' },
    players: [
      { name: 'Raul', pos: ['GOL'], ovr: 85 },
      { name: 'Leandro', pos: ['LD', 'PD'], ovr: 88 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 82 },
      { name: 'Mozer', pos: ['ZAG'], ovr: 85 },
      { name: 'Júnior', pos: ['LE', 'PE'], ovr: 92 },
      { name: 'Andrade', pos: ['VOL'], ovr: 87 },
      { name: 'Adílio', pos: ['MEI'], ovr: 84 },
      { name: 'Zico', pos: ['MEI'], ovr: 98 },
      { name: 'Lico', pos: ['PD'], ovr: 80 },
      { name: 'Tita', pos: ['ATA'], ovr: 84 },
      { name: 'Nunes', pos: ['PE'], ovr: 87 },
      { name: 'Cantarelli', pos: ['GOL'], ovr: 70 },
      { name: 'Nei Dias', pos: ['LD'], ovr: 72 },
      { name: 'Figueiredo', pos: ['ZAG'], ovr: 78 },
      { name: 'Vítor', pos: ['VOL'], ovr: 74 },
      { name: 'Baroninho', pos: ['MEI'], ovr: 73 },
      { name: 'Carlos Henrique', pos: ['ATA'], ovr: 76 },
    ]},
  { id: 'flamengo1982', club: 'Flamengo', year: 1982, label: 'Flamengo 1982', coach: 'Paulo César Carpegiani',
    colors: { p: '#c8102e', s: '#0a0a0a' },
    players: [
      { name: 'Raul', pos: ['GOL'], ovr: 84 },
      { name: 'Leandro', pos: ['LD', 'PD'], ovr: 87 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 81 },
      { name: 'Figueiredo', pos: ['ZAG'], ovr: 78 },
      { name: 'Júnior', pos: ['LE', 'PE'], ovr: 91 },
      { name: 'Andrade', pos: ['VOL'], ovr: 86 },
      { name: 'Adílio', pos: ['MEI'], ovr: 84 },
      { name: 'Zico', pos: ['MEI'], ovr: 97 },
      { name: 'Tita', pos: ['PD'], ovr: 82 },
      { name: 'Lico', pos: ['ATA'], ovr: 79 },
      { name: 'Nunes', pos: ['PE'], ovr: 87 },
      { name: 'Cantarelli', pos: ['GOL'], ovr: 70 },
      { name: 'Vítor', pos: ['VOL'], ovr: 74 },
      { name: 'Chiquinho Carioca', pos: ['ATA'], ovr: 75 },
      { name: 'Anselmo', pos: ['ATA'], ovr: 71 },
    ]},
  { id: 'fluminense1984', club: 'Fluminense', year: 1984, label: 'Fluminense 1984 (Máquina)', coach: 'Carlos Alberto Parreira',
    colors: { p: '#7a1e3c', s: '#006437' },
    players: [
      { name: 'Paulo Vítor', pos: ['GOL'], ovr: 81 },
      { name: 'Aldo', pos: ['LD'], ovr: 77 },
      { name: 'Duílio', pos: ['ZAG'], ovr: 80 },
      { name: 'Ricardo Gomes', pos: ['ZAG'], ovr: 88 },
      { name: 'Branco', pos: ['LE', 'PE'], ovr: 87 },
      { name: 'Jandir', pos: ['VOL'], ovr: 78 },
      { name: 'Delei', pos: ['MEI'], ovr: 79 },
      { name: 'Romerito', pos: ['MEI', 'VOL'], ovr: 86 },
      { name: 'Assis', pos: ['PD'], ovr: 83 },
      { name: 'Washington', pos: ['ATA'], ovr: 82 },
      { name: 'Tato', pos: ['PE'], ovr: 80 },
      { name: 'Ricardo Lopes', pos: ['LD'], ovr: 73 },
      { name: 'Renato Martins', pos: ['LE'], ovr: 74 },
      { name: 'Vica', pos: ['MEI'], ovr: 73 },
      { name: 'Leomir', pos: ['MEI'], ovr: 75 },
      { name: 'Wilsinho', pos: ['PD'], ovr: 74 },
      { name: 'Paulinho', pos: ['ATA'], ovr: 73 },
    ]},
  { id: 'coritiba1985', club: 'Coritiba', year: 1985, label: 'Coritiba 1985', coach: 'Ênio Andrade',
    colors: { p: '#006437', s: '#f5f5f5' },
    players: [
      { name: 'Rafael', pos: ['GOL'], ovr: 83 },
      { name: 'André', pos: ['LD'], ovr: 76 },
      { name: 'Gomes', pos: ['ZAG'], ovr: 79 },
      { name: 'Heraldo', pos: ['ZAG'], ovr: 78 },
      { name: 'Dida', pos: ['LE'], ovr: 76 },
      { name: 'Almir', pos: ['VOL'], ovr: 78 },
      { name: 'Marildo', pos: ['MEI'], ovr: 76 },
      { name: 'Tóbi', pos: ['MEI'], ovr: 79 },
      { name: 'Lela', pos: ['PD'], ovr: 80 },
      { name: 'Índio', pos: ['ATA'], ovr: 81 },
      { name: 'Édson', pos: ['PE'], ovr: 78 },
      { name: 'Vavá', pos: ['ZAG'], ovr: 72 },
      { name: 'Marco Aurélio', pos: ['VOL'], ovr: 73 },
      { name: 'Eliseu', pos: ['LD'], ovr: 71 },
    ]},
  { id: 'saopaulo1986', club: 'São Paulo', year: 1986, label: 'São Paulo 1986 (Menudos)', coach: 'Pepe',
    colors: { p: '#c8102e', s: '#0a0a0a' },
    players: [
      { name: 'Gilmar', pos: ['GOL'], ovr: 82 },
      { name: 'Fonseca', pos: ['LD'], ovr: 77 },
      { name: 'Wágner Basílio', pos: ['ZAG'], ovr: 78 },
      { name: 'Darío Pereyra', pos: ['ZAG'], ovr: 83 },
      { name: 'Nelsinho', pos: ['LE'], ovr: 78 },
      { name: 'Bernardo', pos: ['VOL', 'MEI'], ovr: 79 },
      { name: 'Silas', pos: ['MEI'], ovr: 82 },
      { name: 'Pita', pos: ['MEI'], ovr: 84 },
      { name: 'Müller', pos: ['PD'], ovr: 88 },
      { name: 'Careca', pos: ['ATA'], ovr: 92 },
      { name: 'Sidney', pos: ['PE'], ovr: 81 },
      { name: 'Zé Teodoro', pos: ['LD'], ovr: 74 },
      { name: 'Oscar', pos: ['ZAG'], ovr: 80 },
      { name: 'Falcão', pos: ['MEI'], ovr: 82 },
      { name: 'Márcio Araújo', pos: ['MEI'], ovr: 74 },
    ]},
  { id: 'sport1987', club: 'Sport', year: 1987, label: 'Sport 1987', coach: 'Émerson Leão',
    colors: { p: '#c8102e', s: '#0a0a0a' },
    players: [
      { name: 'Flávio', pos: ['GOL'], ovr: 78 },
      { name: 'Betão', pos: ['LD'], ovr: 75 },
      { name: 'Estevam', pos: ['ZAG'], ovr: 77 },
      { name: 'Marco Antônio', pos: ['ZAG'], ovr: 78 },
      { name: 'Zé Carlos Macaé', pos: ['LE'], ovr: 76 },
      { name: 'Rogério', pos: ['VOL'], ovr: 76 },
      { name: 'Ribamar', pos: ['MEI'], ovr: 76 },
      { name: 'Zico (Sport)', pos: ['MEI'], ovr: 77 },
      { name: 'Robertinho', pos: ['PD'], ovr: 77 },
      { name: 'Nando', pos: ['ATA'], ovr: 78 },
      { name: 'Neco', pos: ['PE'], ovr: 78 },
      { name: 'Augusto', pos: ['VOL'], ovr: 72 },
    ]},
  { id: 'bahia1988', club: 'Bahia', year: 1988, label: 'Bahia 1988', coach: 'Evaristo de Macedo',
    colors: { p: '#1c3f94', s: '#c8102e' },
    players: [
      { name: 'Ronaldo', pos: ['GOL'], ovr: 80 },
      { name: 'Tarantini', pos: ['LD'], ovr: 77 },
      { name: 'João Marcelo', pos: ['ZAG'], ovr: 78 },
      { name: 'Claudir', pos: ['ZAG'], ovr: 76 },
      { name: 'Edinho', pos: ['LE'], ovr: 76 },
      { name: 'Paulo Rodrigues', pos: ['VOL'], ovr: 81 },
      { name: 'Zé Carlos', pos: ['MEI'], ovr: 80 },
      { name: 'Bobô', pos: ['MEI'], ovr: 86 },
      { name: 'Osmar', pos: ['PD'], ovr: 77 },
      { name: 'Charles', pos: ['ATA'], ovr: 84 },
      { name: 'Marquinhos', pos: ['PE'], ovr: 79 },
      { name: 'Sidmar', pos: ['GOL'], ovr: 73 },
      { name: 'Zanata', pos: ['LD'], ovr: 74 },
      { name: 'Pereira', pos: ['ZAG'], ovr: 76 },
      { name: 'Paulo Róbson', pos: ['LE'], ovr: 73 },
      { name: 'Gil Sergipano', pos: ['MEI'], ovr: 74 },
      { name: 'Renato', pos: ['ATA'], ovr: 75 },
      { name: 'Sandro', pos: ['ATA'], ovr: 72 },
    ]},
  { id: 'vasco1989', club: 'Vasco', year: 1989, label: 'Vasco 1989 (SeleVasco)', coach: 'Nelsinho Rosa',
    colors: { p: '#0a0a0a', s: '#f5f5f5' },
    players: [
      { name: 'Acácio', pos: ['GOL'], ovr: 81 },
      { name: 'Luís Carlos Winck', pos: ['LD'], ovr: 79 },
      { name: 'Marco Aurélio', pos: ['ZAG'], ovr: 79 },
      { name: 'Quiñónez', pos: ['ZAG'], ovr: 80 },
      { name: 'Mazinho', pos: ['LE', 'VOL'], ovr: 84 },
      { name: 'Zé do Carmo', pos: ['VOL', 'MEI'], ovr: 78 },
      { name: 'Boiadeiro', pos: ['MEI', 'VOL'], ovr: 79 },
      { name: 'Bismarck', pos: ['MEI', 'PD'], ovr: 80 },
      { name: 'Bebeto', pos: ['PD'], ovr: 90 },
      { name: 'Sorato', pos: ['ATA'], ovr: 80 },
      { name: 'William', pos: ['PE'], ovr: 78 },
      { name: 'Célio Silva', pos: ['ZAG'], ovr: 73 },
      { name: 'Cássio', pos: ['LE'], ovr: 71 },
      { name: 'Andrade', pos: ['VOL'], ovr: 79 },
      { name: 'Tita', pos: ['MEI'], ovr: 78 },
      { name: 'Vivinho', pos: ['ATA'], ovr: 73 },
      { name: 'Tato', pos: ['PE'], ovr: 76 },
    ]},
  { id: 'corinthians1990', club: 'Corinthians', year: 1990, label: 'Corinthians 1990', coach: 'Nelsinho Baptista',
    colors: { p: '#0a0a0a', s: '#f5f5f5' },
    players: [
      { name: 'Ronaldo', pos: ['GOL'], ovr: 80 },
      { name: 'Giba', pos: ['LD'], ovr: 77 },
      { name: 'Marcelo Djian', pos: ['ZAG'], ovr: 79 },
      { name: 'Guinei', pos: ['ZAG'], ovr: 76 },
      { name: 'Jacenir', pos: ['LE'], ovr: 76 },
      { name: 'Márcio', pos: ['VOL'], ovr: 78 },
      { name: 'Wilson Mano', pos: ['MEI', 'VOL'], ovr: 80 },
      { name: 'Neto', pos: ['MEI'], ovr: 89 },
      { name: 'Tupãzinho', pos: ['PD'], ovr: 81 },
      { name: 'Fabinho', pos: ['ATA'], ovr: 77 },
      { name: 'Mauro', pos: ['PE'], ovr: 77 },
      { name: 'Ezequiel', pos: ['MEI'], ovr: 73 },
      { name: 'Paulo Sérgio', pos: ['ATA'], ovr: 75 },
    ]},
  { id: 'saopaulo1991', club: 'São Paulo', year: 1991, label: 'São Paulo 1991', coach: 'Telê Santana',
    colors: { p: '#c8102e', s: '#0a0a0a' },
    players: [
      { name: 'Zetti', pos: ['GOL'], ovr: 83 },
      { name: 'Cafu', pos: ['LD', 'PD'], ovr: 87 },
      { name: 'Antônio Carlos', pos: ['ZAG'], ovr: 84 },
      { name: 'Ricardo Rocha', pos: ['ZAG'], ovr: 85 },
      { name: 'Leonardo', pos: ['LE'], ovr: 86 },
      { name: 'Ronaldão', pos: ['VOL'], ovr: 78 },
      { name: 'Bernardo', pos: ['MEI'], ovr: 80 },
      { name: 'Raí', pos: ['MEI', 'PD'], ovr: 93 },
      { name: 'Müller', pos: ['PD'], ovr: 87 },
      { name: 'Macedo', pos: ['ATA'], ovr: 78 },
      { name: 'Elivélton', pos: ['PE'], ovr: 77 },
      { name: 'Zé Teodoro', pos: ['LD'], ovr: 73 },
      { name: 'Sídnei', pos: ['VOL'], ovr: 73 },
      { name: 'Suélio', pos: ['VOL'], ovr: 72 },
      { name: 'Mário Tilico', pos: ['ATA'], ovr: 75 },
    ]},
  { id: 'palmeiras1993', club: 'Palmeiras', year: 1993, label: 'Palmeiras 1993 (Parmalat)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#006437', s: '#f5f5f5' },
    players: [
      { name: 'Sérgio', pos: ['GOL'], ovr: 81 },
      { name: 'Cláudio', pos: ['LD'], ovr: 77 },
      { name: 'Antônio Carlos', pos: ['ZAG'], ovr: 85 },
      { name: 'Cléber', pos: ['ZAG'], ovr: 78 },
      { name: 'Roberto Carlos', pos: ['LE', 'PE'], ovr: 89 },
      { name: 'César Sampaio', pos: ['VOL'], ovr: 84 },
      { name: 'Mazinho', pos: ['VOL'], ovr: 80 },
      { name: 'Zinho', pos: ['MEI', 'PD'], ovr: 85 },
      { name: 'Edílson', pos: ['PD', 'ATA'], ovr: 81 },
      { name: 'Edmundo', pos: ['ATA'], ovr: 90 },
      { name: 'Evair', pos: ['PE'], ovr: 86 },
      { name: 'Velloso', pos: ['GOL'], ovr: 74 },
      { name: 'Tonhão', pos: ['ZAG'], ovr: 73 },
      { name: 'Daniel Frasson', pos: ['VOL'], ovr: 74 },
      { name: 'Amaral', pos: ['VOL'], ovr: 72 },
      { name: 'Maurílio', pos: ['ATA'], ovr: 73 },
    ]},
  { id: 'palmeiras1994', club: 'Palmeiras', year: 1994, label: 'Palmeiras 1994 (Parmalat)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#006437', s: '#f5f5f5' },
    players: [
      { name: 'Sérgio', pos: ['GOL'], ovr: 81 },
      { name: 'Cláudio', pos: ['LD'], ovr: 77 },
      { name: 'Antônio Carlos', pos: ['ZAG'], ovr: 85 },
      { name: 'Cléber', pos: ['ZAG'], ovr: 78 },
      { name: 'Roberto Carlos', pos: ['LE', 'PE'], ovr: 90 },
      { name: 'César Sampaio', pos: ['VOL'], ovr: 85 },
      { name: 'Mazinho', pos: ['VOL'], ovr: 80 },
      { name: 'Zinho', pos: ['MEI', 'PD'], ovr: 85 },
      { name: 'Rivaldo', pos: ['PD', 'MEI'], ovr: 89 },
      { name: 'Edmundo', pos: ['ATA'], ovr: 91 },
      { name: 'Evair', pos: ['PE'], ovr: 86 },
      { name: 'Velloso', pos: ['GOL'], ovr: 74 },
      { name: 'Tonhão', pos: ['ZAG'], ovr: 73 },
      { name: 'Daniel Frasson', pos: ['VOL'], ovr: 74 },
      { name: 'Flávio Conceição', pos: ['VOL'], ovr: 77 },
      { name: 'Edílson', pos: ['ATA'], ovr: 81 },
    ]},
  { id: 'botafogo1995', club: 'Botafogo', year: 1995, label: 'Botafogo 1995', coach: 'Paulo Autuori',
    colors: { p: '#0a0a0a', s: '#f5f5f5' },
    players: [
      { name: 'Wágner', pos: ['GOL'], ovr: 81 },
      { name: 'Wilson Goiano', pos: ['LD'], ovr: 77 },
      { name: 'Wilson Gottardo', pos: ['ZAG'], ovr: 80 },
      { name: 'Gonçalves', pos: ['ZAG'], ovr: 79 },
      { name: 'André Silva', pos: ['LE'], ovr: 76 },
      { name: 'Leandro Ávila', pos: ['VOL'], ovr: 78 },
      { name: 'Jamir', pos: ['VOL', 'MEI'], ovr: 78 },
      { name: 'Beto', pos: ['MEI', 'VOL'], ovr: 77 },
      { name: 'Sérgio Manoel', pos: ['MEI', 'PD'], ovr: 80 },
      { name: 'Donizete', pos: ['ATA'], ovr: 81 },
      { name: 'Túlio Maravilha', pos: ['ATA'], ovr: 89 },
      { name: 'Moisés', pos: ['LE'], ovr: 72 },
      { name: 'Iranildo', pos: ['MEI'], ovr: 75 },
      { name: 'Marcelo Alves', pos: ['MEI'], ovr: 72 },
      { name: 'Narcízio', pos: ['ATA'], ovr: 71 },
    ]},
  { id: 'gremio1996', club: 'Grêmio', year: 1996, label: 'Grêmio 1996', coach: 'Luiz Felipe Scolari',
    colors: { p: '#1c3f94', s: '#0a0a0a' },
    players: [
      { name: 'Danrlei', pos: ['GOL'], ovr: 82 },
      { name: 'Arce', pos: ['LD'], ovr: 81 },
      { name: 'Rivarola', pos: ['ZAG'], ovr: 79 },
      { name: 'Mauro Galvão', pos: ['ZAG'], ovr: 82 },
      { name: 'Roger', pos: ['LE'], ovr: 79 },
      { name: 'Dinho', pos: ['VOL', 'MEI'], ovr: 79 },
      { name: 'Luís Carlos Goiano', pos: ['VOL'], ovr: 78 },
      { name: 'Émerson', pos: ['MEI', 'VOL'], ovr: 82 },
      { name: 'Carlos Miguel', pos: ['MEI'], ovr: 79 },
      { name: 'Paulo Nunes', pos: ['ATA'], ovr: 87 },
      { name: 'Zé Alcino', pos: ['PE'], ovr: 78 },
      { name: 'Adílson', pos: ['ZAG'], ovr: 75 },
      { name: 'Luciano', pos: ['ZAG'], ovr: 73 },
      { name: 'Aílton', pos: ['ATA'], ovr: 76 },
      { name: 'Zé Afonso', pos: ['ATA'], ovr: 72 },
      { name: 'Arílson', pos: ['MEI'], ovr: 73 },
    ]},
  { id: 'vasco1997', club: 'Vasco', year: 1997, label: 'Vasco 1997', coach: 'Antônio Lopes',
    colors: { p: '#0a0a0a', s: '#f5f5f5' },
    players: [
      { name: 'Carlos Germano', pos: ['GOL'], ovr: 82 },
      { name: 'Válber', pos: ['LD'], ovr: 78 },
      { name: 'Odvan', pos: ['ZAG'], ovr: 79 },
      { name: 'Mauro Galvão', pos: ['ZAG'], ovr: 81 },
      { name: 'Felipe', pos: ['LE'], ovr: 80 },
      { name: 'Luisinho', pos: ['VOL', 'MEI'], ovr: 79 },
      { name: 'Nasa', pos: ['VOL', 'MEI'], ovr: 78 },
      { name: 'Juninho Pernambucano', pos: ['MEI', 'PD'], ovr: 85 },
      { name: 'Ramon', pos: ['MEI', 'PD'], ovr: 81 },
      { name: 'Edmundo', pos: ['ATA'], ovr: 95 },
      { name: 'Evair', pos: ['PE'], ovr: 85 },
      { name: 'Maricá', pos: ['LD'], ovr: 73 },
      { name: 'Alex Pinho', pos: ['ZAG'], ovr: 72 },
      { name: 'Pedrinho', pos: ['MEI'], ovr: 77 },
      { name: 'Mauricinho', pos: ['MEI'], ovr: 72 },
    ]},
  { id: 'athleticopr2001', club: 'Athletico-PR', year: 2001, label: 'Athletico-PR 2001', coach: 'Geninho',
    colors: { p: '#c8102e', s: '#0a0a0a' },
    players: [
      { name: 'Flávio', pos: ['GOL'], ovr: 80 },
      { name: 'Rogério Corrêa', pos: ['ZAG'], ovr: 78 },
      { name: 'Nem', pos: ['ZAG'], ovr: 79 },
      { name: 'Gustavo', pos: ['ZAG'], ovr: 80 },
      { name: 'Alessandro', pos: ['LD'], ovr: 78 },
      { name: 'Fabiano', pos: ['LE'], ovr: 77 },
      { name: 'Cocito', pos: ['VOL'], ovr: 78 },
      { name: 'Kléberson', pos: ['VOL', 'MEI'], ovr: 86 },
      { name: 'Adriano', pos: ['MEI'], ovr: 79 },
      { name: 'Kléber', pos: ['ATA'], ovr: 84 },
      { name: 'Alex Mineiro', pos: ['ATA'], ovr: 85 },
      { name: 'Igor', pos: ['LD'], ovr: 73 },
      { name: 'Pires', pos: ['MEI'], ovr: 72 },
      { name: 'Souza', pos: ['ATA'], ovr: 74 },
      { name: 'Ilan', pos: ['ATA'], ovr: 73 },
      { name: 'Rodriguinho', pos: ['MEI'], ovr: 71 },
      { name: 'Adauto', pos: ['ATA'], ovr: 72 },
    ]},
  { id: 'santos2002', club: 'Santos', year: 2002, label: 'Santos 2002 (Meninos da Vila)', coach: 'Émerson Leão',
    colors: { p: '#0a0a0a', s: '#f5f5f5' },
    players: [
      { name: 'Fábio Costa', pos: ['GOL'], ovr: 81 },
      { name: 'Maurinho', pos: ['LD'], ovr: 78 },
      { name: 'André Luís', pos: ['ZAG'], ovr: 77 },
      { name: 'Alex', pos: ['ZAG'], ovr: 78 },
      { name: 'Léo', pos: ['LE'], ovr: 79 },
      { name: 'Paulo Almeida', pos: ['VOL'], ovr: 77 },
      { name: 'Renato', pos: ['VOL', 'MEI'], ovr: 78 },
      { name: 'Elano', pos: ['MEI'], ovr: 84 },
      { name: 'Diego', pos: ['MEI', 'PD'], ovr: 85 },
      { name: 'Robinho', pos: ['ATA', 'PE'], ovr: 92 },
      { name: 'William', pos: ['PE'], ovr: 76 },
      { name: 'Júlio César', pos: ['GOL'], ovr: 73 },
      { name: 'Wellington', pos: ['MEI'], ovr: 72 },
      { name: 'Alexandre', pos: ['ATA'], ovr: 73 },
      { name: 'Robert', pos: ['ATA'], ovr: 74 },
      { name: 'Michel', pos: ['ATA'], ovr: 71 },
    ]},
  { id: 'cruzeiro2003', club: 'Cruzeiro', year: 2003, label: 'Cruzeiro 2003 (Tríplice Coroa)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#1c3f94', s: '#f5f5f5' },
    players: [
      { name: 'Gomes', pos: ['GOL'], ovr: 80 },
      { name: 'Maurinho', pos: ['LD'], ovr: 78 },
      { name: 'Cris', pos: ['ZAG'], ovr: 79 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 82 },
      { name: 'Leandro', pos: ['LE'], ovr: 78 },
      { name: 'Maldonado', pos: ['VOL'], ovr: 79 },
      { name: 'Augusto Recife', pos: ['VOL'], ovr: 77 },
      { name: 'Wendell', pos: ['MEI'], ovr: 78 },
      { name: 'Alex', pos: ['MEI'], ovr: 90 },
      { name: 'Aristizábal', pos: ['ATA'], ovr: 82 },
      { name: 'Mota', pos: ['ATA'], ovr: 79 },
      { name: 'Maicon', pos: ['LD'], ovr: 76 },
      { name: 'Luisão', pos: ['ZAG'], ovr: 79 },
      { name: 'Felipe Melo', pos: ['VOL'], ovr: 78 },
      { name: 'Zinho', pos: ['MEI'], ovr: 73 },
      { name: 'Márcio Nobre', pos: ['ATA'], ovr: 75 },
      { name: 'Deivid', pos: ['ATA'], ovr: 78 },
      { name: 'Alex Alves', pos: ['ATA'], ovr: 74 },
      { name: 'Thiago', pos: ['ZAG'], ovr: 75 },
    ]},
  { id: 'santos2004', club: 'Santos', year: 2004, label: 'Santos 2004', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#0a0a0a', s: '#f5f5f5' },
    players: [
      { name: 'Mauro', pos: ['GOL'], ovr: 78 },
      { name: 'Flávio', pos: ['LD'], ovr: 75 },
      { name: 'Ávalos', pos: ['ZAG'], ovr: 77 },
      { name: 'Leonardo', pos: ['ZAG'], ovr: 77 },
      { name: 'Léo', pos: ['LE'], ovr: 79 },
      { name: 'Fabinho', pos: ['VOL'], ovr: 77 },
      { name: 'Preto Casagrande', pos: ['VOL', 'MEI'], ovr: 76 },
      { name: 'Ricardinho', pos: ['MEI'], ovr: 84 },
      { name: 'Elano', pos: ['MEI'], ovr: 85 },
      { name: 'Robinho', pos: ['ATA', 'PE'], ovr: 91 },
      { name: 'Deivid', pos: ['ATA'], ovr: 84 },
      { name: 'Paulo César', pos: ['LD'], ovr: 73 },
      { name: 'Marcinho', pos: ['MEI'], ovr: 72 },
      { name: 'Basílio', pos: ['ATA'], ovr: 71 },
      { name: 'William', pos: ['ATA'], ovr: 73 },
    ]},
  { id: 'corinthians2005', club: 'Corinthians', year: 2005, label: 'Corinthians 2005', coach: 'Antônio Lopes',
    colors: { p: '#0a0a0a', s: '#f5f5f5' },
    players: [
      { name: 'Fábio Costa', pos: ['GOL'], ovr: 80 },
      { name: 'Marinho', pos: ['LD'], ovr: 76 },
      { name: 'Gustavo Nery', pos: ['LE'], ovr: 80 },
      { name: 'Wendel', pos: ['ZAG'], ovr: 77 },
      { name: 'Coelho', pos: ['ZAG'], ovr: 76 },
      { name: 'Marcelo Mattos', pos: ['VOL'], ovr: 79 },
      { name: 'Bruno Octávio', pos: ['VOL', 'MEI'], ovr: 76 },
      { name: 'Rosinei', pos: ['MEI'], ovr: 77 },
      { name: 'Carlos Alberto', pos: ['MEI'], ovr: 81 },
      { name: 'Tévez', pos: ['ATA'], ovr: 93 },
      { name: 'Nilmar', pos: ['ATA'], ovr: 80 },
      { name: 'Júlio César', pos: ['GOL'], ovr: 74 },
      { name: 'Betão', pos: ['ZAG'], ovr: 73 },
      { name: 'Sebastian Dominguez', pos: ['ZAG'], ovr: 76 },
      { name: 'Mascherano', pos: ['VOL'], ovr: 86 },
      { name: 'Roger', pos: ['MEI'], ovr: 78 },
      { name: 'Jô', pos: ['ATA'], ovr: 76 },
      { name: 'Wescley', pos: ['MEI'], ovr: 72 },
    ]},
  { id: 'saopaulo2006', club: 'São Paulo', year: 2006, label: 'São Paulo 2006', coach: 'Muricy Ramalho',
    colors: { p: '#c8102e', s: '#0a0a0a' },
    players: [
      { name: 'Rogério Ceni', pos: ['GOL'], ovr: 89 },
      { name: 'Ilsinho', pos: ['LD'], ovr: 78 },
      { name: 'Fabão', pos: ['ZAG'], ovr: 81 },
      { name: 'Miranda', pos: ['ZAG'], ovr: 82 },
      { name: 'Júnior', pos: ['LE'], ovr: 77 },
      { name: 'Mineiro', pos: ['VOL'], ovr: 81 },
      { name: 'Josué', pos: ['VOL', 'MEI'], ovr: 80 },
      { name: 'Souza', pos: ['MEI'], ovr: 78 },
      { name: 'Danilo', pos: ['MEI'], ovr: 80 },
      { name: 'Leandro', pos: ['PD', 'PE'], ovr: 77 },
      { name: 'Aloísio', pos: ['ATA'], ovr: 81 },
      { name: 'Alex Silva', pos: ['ZAG'], ovr: 73 },
      { name: 'Lugano', pos: ['ZAG'], ovr: 82 },
      { name: 'Edcarlos', pos: ['ZAG'], ovr: 76 },
      { name: 'Thiago Ribeiro', pos: ['MEI'], ovr: 75 },
      { name: 'Lenílson', pos: ['ATA'], ovr: 73 },
      { name: 'Richarlyson', pos: ['MEI'], ovr: 74 },
      { name: 'Cicinho', pos: ['LD'], ovr: 79 },
    ]},
];

// ============================================================
// FORMAÇÕES TÁTICAS
// ============================================================
const FORMATIONS = {
  '4-3-3':         { label: '4-3-3 Clássico',   counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:1, MEI:2, PD:1, PE:1, ATA:1 } },
  '4-4-2-linha':   { label: '4-4-2 (Linha)',     counts: { GOL:1, LD:1, ZAG:2, LE:1, MD:1, VOL:2, ME:1, ATA:2 } },
  '4-4-2-losango': { label: '4-4-2 (Losango)',   counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:1, MEI:3, ATA:2 } },
  '4-2-3-1':       { label: '4-2-3-1',           counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:2, MD:1, MEI:1, ME:1, ATA:1 } },
  '3-5-2':         { label: '3-5-2',             counts: { GOL:1, ZAG:3, LD:1, LE:1, MD:1, VOL:2, ME:1, ATA:2 } },
  '3-4-3':         { label: '3-4-3',             counts: { GOL:1, ZAG:3, LD:1, LE:1, VOL:2, PD:1, PE:1, ATA:1 } },
  '4-1-4-1':       { label: '4-1-4-1',           counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:1, MD:1, MEI:2, ME:1, ATA:1 } },
  '5-3-2':         { label: '5-3-2',             counts: { GOL:1, ZAG:3, LD:1, LE:1, VOL:3, ATA:2 } },
  '4-5-1':         { label: '4-5-1',             counts: { GOL:1, LD:1, ZAG:2, LE:1, MD:1, VOL:2, MEI:1, ME:1, ATA:1 } },
  '4-3-1-2':       { label: '4-3-1-2',           counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:3, MEI:1, ATA:2 } },
  '4-1-3-2':       { label: '4-1-3-2',           counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:1, MD:1, MEI:1, ME:1, ATA:2 } },
  '3-4-2-1':       { label: '3-4-2-1',           counts: { GOL:1, ZAG:3, LD:1, LE:1, VOL:2, MEI:2, ATA:1 } },
  '3-2-4-1':       { label: '3-2-4-1',           counts: { GOL:1, ZAG:3, LD:1, LE:1, VOL:2, MD:1, ME:1, ATA:1 } },
  '4-2-2-2':       { label: '4-2-2-2',           counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:2, MD:1, ME:1, ATA:2 } },
  '5-4-1':         { label: '5-4-1',             counts: { GOL:1, ZAG:3, LD:1, LE:1, MD:1, VOL:1, MEI:1, ME:1, ATA:1 } },
};

const BASE_COORDS = {
  GOL: { x: 50, y: 92 },
  LD:  { x: 86, y: 76 },
  ZAG: { x: 50, y: 80 },
  LE:  { x: 14, y: 76 },
  VOL: { x: 50, y: 62 },
  MEI: { x: 50, y: 46 },
  MD:  { x: 80, y: 48 },  // Meia Direita (wide midfielder right)
  ME:  { x: 20, y: 48 },  // Meia Esquerda (wide midfielder left)
  PD:  { x: 82, y: 22 },  // Ponta Direita (right winger, more attacking)
  PE:  { x: 18, y: 22 },  // Ponta Esquerda (left winger, more attacking)
  ATA: { x: 50, y: 11 },
};

function buildPitchSlots(formationKey) {
  const { counts } = FORMATIONS[formationKey];
  const slots = [];
  Object.entries(counts).forEach(([pos, qty]) => {
    const base = BASE_COORDS[pos];
    for (let i = 0; i < qty; i++) {
      const key = qty === 1 ? pos : `${pos}${i + 1}`;
      let x = base.x;
      if (qty > 1) {
        const spread = qty === 2 ? 16 : qty === 3 ? 22 : 12;
        const offset = (i - (qty - 1) / 2) * (spread * 2 / Math.max(qty - 1, 1));
        x = Math.max(8, Math.min(92, base.x + offset));
      }
      slots.push({ key, label: pos, realPos: pos, x, y: base.y });
    }
  });
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

// ============================================================
// ENTROSAMENTO
// ============================================================
// Por par de jogadores:
//   mesmo clube + mesmo ano  → +5  (= +2 clube + +3 extra)
//   mesmo clube (anos dif.)  → +2
//   mesmo país               → +1
// Baseline: 11 jogadores, todos de países distintos → 0 pares com bônus
const CHEM_MAX_OVR = 5; // bônus máximo de OVR concedido pelo entrosamento

function calcChemistry(players) {
  let score = 0;
  const breakdown = { epoca: 0, clube: 0, pais: 0 };

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i], b = players[j];
      const sameClub = a.club && b.club && a.club === b.club;
      const sameYear = sameClub && a.year != null && a.year === b.year;
      const sameNat  = (a.nat || 'BRA') === (b.nat || 'BRA');

      if (sameYear)       { score += 5; breakdown.epoca++; }
      else if (sameClub)  { score += 2; breakdown.clube++; }
      else if (sameNat)   { score += 1; breakdown.pais++;  }
    }
  }

  const n = players.length;
  const totalPairs = n * (n - 1) / 2;
  // teórico: se todos sem nada em comum → 0; se todos mesmo clube ≠ ano → 2*totalPairs
  const maxScore = totalPairs * 5; // todos mesmo ano+clube
  const pct = maxScore > 0 ? Math.round(score / maxScore * 100) : 0;
  const ovrBonus = maxScore > 0 ? (score / maxScore) * CHEM_MAX_OVR : 0;

  return { score, breakdown, pct, ovrBonus: Math.round(ovrBonus * 10) / 10 };
}

// ============================================================
// MOTOR DE SIMULAÇÃO
// ============================================================
function teamStrength(xi) {
  const vals = Object.values(xi);
  if (vals.length === 0) return 50;
  const baseOvr = vals.reduce((s, p) => s + p.ovr, 0) / vals.length;
  const { ovrBonus } = calcChemistry(vals);
  return Math.round((baseOvr + ovrBonus) * 10) / 10;
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

function teamBorderColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 70 ? 'rgba(255,255,255,0.35)' : hex;
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

function nextCupRound(prevMatches, results) {
  const winners = results.map((r, i) => {
    if (r.homeGoals > r.awayGoals) return prevMatches[i].homeId;
    if (r.awayGoals > r.homeGoals) return prevMatches[i].awayId;
    // Pênaltis: vantagem leve para OVR mais alto
    return Math.random() < 0.5 ? prevMatches[i].homeId : prevMatches[i].awayId;
  });
  const matches = [];
  for (let i = 0; i + 1 < winners.length; i += 2)
    matches.push({ homeId: winners[i], awayId: winners[i + 1] });
  return matches;
}

function pickGoalScorer(players) {
  const field = players.filter(p => !p.pos.includes('GOL'));
  const pool = field.length > 0 ? field : players;
  return pool[Math.floor(Math.random() * pool.length)].name;
}

// Gera lista de eventos de gol para uma partida com minutos únicos
function generateMatchGoals(homeTeam, awayTeam) {
  const diff = homeTeam.ovr - awayTeam.ovr;
  const homeExp = Math.max(0.2, 1.3 + diff * 0.042);
  const awayExp = Math.max(0.2, 1.3 - diff * 0.042);
  const homeGoals = poissonSample(homeExp);
  const awayGoals = poissonSample(awayExp);

  const usedMin = new Set();
  const randMin = () => {
    let m;
    do { m = Math.floor(Math.random() * 90) + 1; } while (usedMin.has(m));
    usedMin.add(m);
    return m;
  };

  const events = [];
  for (let i = 0; i < homeGoals; i++)
    events.push({ minute: randMin(), teamId: homeTeam.id, teamLabel: homeTeam.label, scorer: pickGoalScorer(homeTeam.players) });
  for (let i = 0; i < awayGoals; i++)
    events.push({ minute: randMin(), teamId: awayTeam.id, teamLabel: awayTeam.label, scorer: pickGoalScorer(awayTeam.players) });

  return events.sort((a, b) => a.minute - b.minute);
}

function simAiMatch(homeTeam, awayTeam) {
  const diff = homeTeam.ovr - awayTeam.ovr;
  return {
    homeGoals: poissonSample(Math.max(0.2, 1.3 + diff * 0.042)),
    awayGoals: poissonSample(Math.max(0.2, 1.3 - diff * 0.042)),
  };
}

// Compatibilidade entre slot do campinho e posições do jogador.
// MD aceita jogadores com PD, MEI ou MD. ME aceita PE, MEI ou ME.
// VOL aceita VOL ou MEI. Sem mapeamento = exige a posição exata.
const POS_COMPAT = {
  MD:  ['MD', 'PD', 'MEI'],
  ME:  ['ME', 'PE', 'MEI'],
  VOL: ['VOL', 'MEI'],
  MEI: ['MEI', 'VOL', 'MD', 'ME'],
};

// Logos via TheSportsDB (r2.thesportsdb.com — free, sem autenticação)
const CLUB_LOGOS = {
  'Santos':       'https://r2.thesportsdb.com/images/media/team/badge/j8xk9g1679447486.png',
  'Botafogo':     'https://r2.thesportsdb.com/images/media/team/badge/bs5mbw1733004596.png',
  'Palmeiras':    'https://r2.thesportsdb.com/images/media/team/badge/vsqwqp1473538105.png',
  'Internacional':'https://r2.thesportsdb.com/images/media/team/badge/yprvxx1473538097.png',
  'Fluminense':   'https://r2.thesportsdb.com/images/media/team/badge/stvvwp1473538082.png',
  'Coritiba':     'https://r2.thesportsdb.com/images/media/team/badge/ywwsyu1473538050.png',
  'São Paulo':    'https://r2.thesportsdb.com/images/media/team/badge/sxpupx1473538135.png',
  'Sport':        'https://r2.thesportsdb.com/images/media/team/badge/tyrbls1545421563.png',
  'Bahia':        'https://r2.thesportsdb.com/images/media/team/badge/xuvtsv1473539308.png',
  'Vasco':        'https://r2.thesportsdb.com/images/media/team/badge/ynqlxo1630521109.png',
  'Corinthians':  'https://r2.thesportsdb.com/images/media/team/badge/vvuvps1473538042.png',
  'Grêmio':       'https://r2.thesportsdb.com/images/media/team/badge/uvpwyt1473538089.png',
  'Athletico-PR': 'https://r2.thesportsdb.com/images/media/team/badge/irzu1u1554237406.png',
  'Cruzeiro':     'https://r2.thesportsdb.com/images/media/team/badge/upsvvu1473538059.png',
  'Flamengo':     'https://r2.thesportsdb.com/images/media/team/badge/syptwx1473538074.png',
};

// IDs YouTube dos hinos oficiais — tocam na tela de campeão
const CLUB_ANTHEMS = {
  'Santos':       'QXs6kGLVL_0',
  'Flamengo':     'pFvX3lHujn8',
  'Corinthians':  'g6M8oJq-dEA',
  'Palmeiras':    'n47Y8-xNDPo',
  'Internacional':'s6rT_BfQnuE',
  'São Paulo':    'pGD2BJeYjNA',
  'Vasco':        'Fsbka7RbOpw',
  'Grêmio':       'cBmkH37USnA',
  'Cruzeiro':     '901buxaTBtA',
  'Botafogo':     'itm2AQsH0pU',
  'Fluminense':   'MMxM5YePtsM',
  'Bahia':        '960Fx8gcnIY',
  'Sport':        'PVcqbeerC8k',
  'Athletico-PR': 'kNd1BbWicMc',
  'Coritiba':     'NZki289dBz4',
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
  const [phase, setPhase] = useState('intro');
  const [formationKey, setFormationKey] = useState(null);
  const [pitchSlots, setPitchSlots] = useState([]);
  const [usedTeamIds, setUsedTeamIds] = useState([]);
  const [rolledTeam, setRolledTeam] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollingPreview, setRollingPreview] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [pitch, setPitch] = useState({});
  const [captainSlot, setCaptainSlot] = useState(null);
  const [skipsLeft, setSkipsLeft] = useState(MAX_SKIPS);
  const [log, setLog] = useState([]);

  // Time personalizado
  const [myTeamName, setMyTeamName] = useState('Meu Time');
  const [myTeamBadge, setMyTeamBadge] = useState('⭐');
  const [myTeamColor, setMyTeamColor] = useState('#d4a23c');
  const [myTeamCoach, setMyTeamCoach] = useState('');
  const [myTeamCity, setMyTeamCity] = useState('');

  // Modo de jogo
  const [gameMode, setGameMode] = useState('brasileirao'); // 'brasileirao' | 'copa' | 'multi'

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
  const [myTeamLogo, setMyTeamLogo] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);

  // Liga
  const [leagueTeams, setLeagueTeams] = useState([]);
  const [leagueTable, setLeagueTable] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);

  // Copa (eliminatória)
  const [cupRounds, setCupRounds] = useState([]); // [{name, matches, results}]
  const [cupRoundIdx, setCupRoundIdx] = useState(0);
  const [userInCup, setUserInCup] = useState(true);
  const [cupWinnerId, setCupWinnerId] = useState(null);

  // Partida ao vivo
  const [clockMinute, setClockMinute] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveScore, setLiveScore] = useState({ home: 0, away: 0 });
  const [roundResults, setRoundResults] = useState(null);
  const [activeUserMatch, setActiveUserMatch] = useState(null);

  const [simSpeed, setSimSpeed] = useState(1);
  const [simMode, setSimMode] = useState('manual'); // 'manual' | 'auto'
  const [autoCountdown, setAutoCountdown] = useState(null); // null | 1-5

  const timerRef = useRef(null);
  const clockRef = useRef(null);
  const speedRef = useRef(1);
  const autoActionRef = useRef(null); // 'startRound' | 'nextRound'
  const startRoundRef = useRef(null);
  const goNextRoundRef = useRef(null);

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
    const slots = buildPitchSlots(key);
    setPitchSlots(slots);
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
    return remainingSlots.filter(slot => {
      const compat = POS_COMPAT[slot.realPos] || [slot.realPos];
      return player.pos.some(p => compat.includes(p));
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
      // Modo reposição: eligibleSlotsForPlayer já usa remainingSlots (slot original liberado)
      if (!eligibleSlotsForPlayer(selectedPlayer).some(s => s.key === slotKey)) return;
      const player = selectedPlayer;
      setPitch(prev => ({ ...prev, [slotKey]: { ...player, slotKey } }));
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

  const pickPlayerForSlot = (player, slotKey) => {
    setPitch(prev => ({ ...prev, [slotKey]: { ...player, teamLabel: rolledTeam.label, teamId: rolledTeam.id, club: rolledTeam.club, year: rolledTeam.year, nat: player.nat || 'BRA', slotKey } }));
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
      // Adiciona club/year/nat para que o entrosamento seja calculado corretamente
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

    if (gameMode === 'brasileirao') {
      const rounds = generateDoubleRoundRobin(allTeams.map(t => t.id));
      const table = allTeams.map(t => ({ id: t.id, label: t.label, clubLogo: t.clubLogo || null, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }));
      setFixtures(rounds);
      setLeagueTable(table);
      setCurrentRound(0);
      setCupRounds([]);
      setCupRoundIdx(0);
      setUserInCup(true);
      setCupWinnerId(null);
    } else {
      // Copa do Brasil
      const firstMatches = generateCupFirstRound(allTeams.map(t => t.id));
      const firstRound = { name: CUP_ROUND_NAMES[0], matches: firstMatches, results: [] };
      setCupRounds([firstRound]);
      setCupRoundIdx(0);
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
    const um = round.find(m => m.homeId === MY_TEAM_ID || m.awayId === MY_TEAM_ID);
    if (!um) return;

    const homeTeam = leagueTeams.find(t => t.id === um.homeId);
    const awayTeam = leagueTeams.find(t => t.id === um.awayId);
    const events = generateMatchGoals(homeTeam, awayTeam);

    setActiveUserMatch(um);
    setLiveEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setClockMinute(0);
    setRoundResults(null);
    setIsSimulating(true);

    const SPEED_MS = { 1: 250, 1.5: 125, 2: 55 };

    let minute = 0;
    let evIdx = 0;
    let hs = 0;
    let as_ = 0;
    const shown = [];

    const tick = () => {
      minute++;

      while (evIdx < events.length && events[evIdx].minute <= minute) {
        const ev = events[evIdx];
        if (ev.teamId === um.homeId) hs++;
        else as_++;
        shown.push({ ...ev, homeScore: hs, awayScore: as_ });
        evIdx++;
      }

      setClockMinute(minute);
      setLiveScore({ home: hs, away: as_ });
      if (shown.length > 0) setLiveEvents([...shown]);

      if (minute >= 90) {
        setIsSimulating(false);

        const finalHs = hs;
        const finalAs = as_;

        // Simular todos os jogos da rodada
        const results = round.map(m => {
          if (m.homeId === um.homeId && m.awayId === um.awayId)
            return { homeId: m.homeId, awayId: m.awayId, homeGoals: finalHs, awayGoals: finalAs };
          const h = leagueTeams.find(t => t.id === m.homeId);
          const a = leagueTeams.find(t => t.id === m.awayId);
          const sim = simAiMatch(h, a);
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
            const updated = prev.map((r, i) => i === cupRoundIdx ? { ...r, results } : r);
            return updated;
          });
          // Verificar se usuário foi eliminado
          const userMatch = results.find(r => r.homeId === MY_TEAM_ID || r.awayId === MY_TEAM_ID);
          if (userMatch) {
            const userWon = userMatch.homeId === MY_TEAM_ID
              ? userMatch.homeGoals >= userMatch.awayGoals
              : userMatch.awayGoals >= userMatch.homeGoals;
            if (!userWon) setUserInCup(false);
          }
        }
      } else {
        clockRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
      }
    };

    clockRef.current = setTimeout(tick, SPEED_MS[speedRef.current] ?? 250);
  }, [fixtures, currentRound, leagueTeams, isSimulating, gameMode, cupRoundIdx]);

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

    // Copa: avançar para próxima fase
    setCupRounds(prev => {
      const currentCupRound = prev[cupRoundIdx];
      if (!currentCupRound?.results?.length) return prev;

      const nextMatches = nextCupRound(currentCupRound.matches, currentCupRound.results);
      if (nextMatches.length === 0) {
        // Fim da copa: campeão é o último winner
        const lastResult = currentCupRound.results[0];
        const winnerId = lastResult.homeGoals >= lastResult.awayGoals ? lastResult.homeId : lastResult.awayId;
        setCupWinnerId(winnerId);
        setPhase('results');
        return prev;
      }

      const nextRoundName = CUP_ROUND_NAMES[cupRoundIdx + 1] || 'Final';
      const newRound = { name: nextRoundName, matches: nextMatches, results: [] };
      const updated = [...prev, newRound];

      setFixtures(f => [...f, nextMatches]);
      setCupRoundIdx(cupRoundIdx + 1);
      setCurrentRound(next);
      setRoundResults(null);
      setLiveEvents([]);
      setLiveScore({ home: 0, away: 0 });
      setClockMinute(0);
      setActiveUserMatch(null);

      return updated;
    });
  }, [currentRound, fixtures, gameMode, cupRoundIdx]);

  // Mantém refs atualizadas para os efeitos de auto não ficarem com closures velhas
  useEffect(() => { startRoundRef.current = startRound; }, [startRound]);
  useEffect(() => { goNextRoundRef.current = goNextRound; }, [goNextRound]);

  // Dispara a ação quando simMode muda ou rodada termina/começa
  useEffect(() => {
    setAutoCountdown(null);
    autoActionRef.current = null;
    if (simMode !== 'auto' || phase !== 'playing') return;
    if (roundResults !== null && !isSimulating) {
      autoActionRef.current = 'nextRound';
      setAutoCountdown(5);
    } else if (roundResults === null && !isSimulating) {
      autoActionRef.current = 'startRound';
      setAutoCountdown(5);
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
    if (timerRef.current) clearTimeout(timerRef.current);
    if (clockRef.current) clearTimeout(clockRef.current);
    // destrói peer se estava no multiplayer
    if (peerRef.current) { try { peerRef.current.destroy(); } catch {} peerRef.current = null; }
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
    setUserInCup(true);
    setCupWinnerId(null);
  };

  // ── MULTIPLAYER (PeerJS) ──────────────────────────────────────────────────
  // Helpers para broadcast / envio de mensagem
  const leaderBroadcast = (msg) => {
    Object.values(connsRef.current).forEach(c => { try { c.send(msg); } catch {} });
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
      const next = { ...prev, phase: 'team-setup', startedAt: Date.now() };
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

  const multiCreateRoom = async () => {
    setMultiConnecting(true);
    setMultiError('');
    let peer;
    try {
      peer = new Peer(undefined, { debug: 1 });
      peerRef.current = peer;
    } catch (e) {
      setMultiConnecting(false);
      setMultiError('Erro ao criar conexão: ' + e.message);
      return;
    }

    const timeout = setTimeout(() => {
      setMultiConnecting(false);
      setMultiError('Tempo esgotado — sem resposta do servidor de conexão. Verifique sua internet.');
      try { peer.destroy(); } catch {}
    }, 12000);

    peer.on('open', (id) => {
      clearTimeout(timeout);
      setMultiConnecting(false);
      setIsLeader(true);
      setRoomCode(id.slice(0, 6).toUpperCase());
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
      conn.on('close', () => { delete connsRef.current[conn.peer]; });
    });

    peer.on('error', (e) => {
      clearTimeout(timeout);
      setMultiConnecting(false);
      setMultiError('Erro: ' + (e.message || e.type));
      try { peer.destroy(); } catch {}
    });
  };

  const multiJoinRoom = async (code) => {
    const peer = new Peer(undefined, { debug: 1 });
    peerRef.current = peer;
    peer.on('open', (myPeerId) => {
      // o código da sala é o prefixo do peerId do líder — precisamos do peerId completo
      // mas sem servidor não temos como descobrir o peerId completo só pelo código de 6 chars
      // Solução: o líder usa o peerId completo como código (mostramos os primeiros 6 chars para reconhecimento visual,
      // mas o usuário digita o código completo ou o líder compartilha o link)
      const conn = peer.connect(code, { reliable: true });
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
      setRoomCode(code.slice(0, 6).toUpperCase());
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
      safe[k] = { name: p.name, pos: p.pos, ovr: p.ovr, club: p.club || '', year: p.year || 0, nat: p.nat || 'BRA', slotKey: k };
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
      setUserInCup(true);
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
          <div style={styles.crest}>★</div>
          <div>
            <div style={styles.title}>BRASILEIRÃO LENDÁRIO</div>
            <div style={styles.subtitle}>monte · escale · seja campeão</div>
          </div>
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
            myTeamName={myTeamName} myTeamBadge={myTeamBadge} myTeamColor={myTeamColor}
            myTeamCoach={myTeamCoach} myTeamCity={myTeamCity} myTeamLogo={myTeamLogo}
            onSetName={setMyTeamName} onSetBadge={setMyTeamBadge} onSetColor={setMyTeamColor}
            onSetCoach={setMyTeamCoach} onSetCity={setMyTeamCity}
            onSetLogo={setMyTeamLogo} cropSrc={cropSrc} onSetCropSrc={setCropSrc}
            onMultiPlayer={() => setMultiPhase('lobby')}
          />
        )}
        {phase === 'formation' && <FormationPicker onChoose={chooseFormation} />}
        {phase === 'draft' && (
          <Draft
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
          />
        )}
        {phase === 'squad' && (
          <Squad
            pitch={pitch} pitchSlots={pitchSlots}
            formationLabel={formationKey ? FORMATIONS[formationKey].label : ''}
            captainSlot={captainSlot} onSetCaptain={setCaptainSlot}
            onConfirm={multiPhase === 'in-draft' ? multiConfirmDraft : startSeason}
            onRedo={() => { setPhase('formation'); setCaptainSlot(null); }}
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
            myTeamId={MY_TEAM_ID}
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
            userInCup={userInCup}
            simSpeed={simSpeed}
            onSetSpeed={setSimSpeed}
            simMode={simMode}
            onSetSimMode={setSimMode}
            autoCountdown={autoCountdown}
            onStartRound={startRound}
            onNextRound={goNextRound}
          />
        )}
        {phase === 'results' && (
          <Results leagueTable={leagueTable} myTeamId={MY_TEAM_ID} myTeamColor={myTeamColor} myTeamBadge={myTeamBadge} myTeamLogo={myTeamLogo} gameMode={gameMode} cupWinnerId={cupWinnerId} leagueTeams={leagueTeams} onRestart={restart} />
        )}
      </main>
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

const TEAM_BADGES = ['⭐','🔥','🦅','🐯','🦁','💎','⚡','🏆','🌊','🎯','🛡️','🌟'];
const TEAM_COLORS = ['#d4a23c','#e05050','#4a90d9','#27ae60','#8e44ad','#e67e22','#16a085','#e91e8c'];

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

function Intro({ onStart, gameMode, onSetGameMode, myTeamName, myTeamBadge, myTeamColor, myTeamCoach, myTeamCity, myTeamLogo, onSetName, onSetBadge, onSetColor, onSetCoach, onSetCity, onSetLogo, cropSrc, onSetCropSrc, onMultiPlayer }) {
  const displayName = myTeamName || 'Meu Time';
  const fileInputRef = useRef(null);
  const [musicOn, setMusicOn] = React.useState(false);
  const [musicInput, setMusicInput] = React.useState('');
  const [musicId, setMusicId] = React.useState(null);

  const applyMusic = () => {
    const id = parseYouTubeId(musicInput);
    if (id) setMusicId(id);
  };

  const handleFileChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onSetCropSrc(url);
    e.target.value = '';
  };

  return (
    <>
    {cropSrc && (
      <ImageCropModal
        src={cropSrc}
        onConfirm={dataUrl => { onSetLogo(dataUrl); onSetCropSrc(null); }}
        onCancel={() => onSetCropSrc(null)}
      />
    )}
    <div style={styles.introCard} className="intro-card-mob">
      <div style={styles.introBadge}>⚽ Futebol Brasileiro · 1961–2006</div>
      <h1 style={styles.introTitle} className="intro-title-h">Monte o time lendário dos seus sonhos.</h1>
      <p style={styles.introLead}>
        Sorteie os maiores times campeões do Brasileirão, escolha os melhores jogadores de cada era
        e dispute uma liga completa com cronômetro ao vivo.
      </p>

      <div style={styles.featGrid} className="feat-grid-3">
        <div style={styles.featCard}>
          <div style={styles.featIcon}>🎲</div>
          <div style={styles.featTitle}>Role o dado</div>
          <div style={styles.featDesc}>Sorteie times campeões lendários. Recuse até 3 que não te interessar.</div>
        </div>
        <div style={styles.featCard}>
          <div style={styles.featIcon}>🏟️</div>
          <div style={styles.featTitle}>Escale o XI</div>
          <div style={styles.featDesc}>Escolha o craque certo pra cada posição do seu esquema tático.</div>
        </div>
        <div style={styles.featCard}>
          <div style={styles.featIcon}>🏆</div>
          <div style={styles.featTitle}>Dispute o título</div>
          <div style={styles.featDesc}>Liga com 10 times, 9 rodadas e gols aparecendo minuto a minuto.</div>
        </div>
      </div>

      {/* Editor do time */}
      <div style={styles.teamEditCard}>
        {/* Preview + Upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 76, height: 76, borderRadius: 16,
                background: hexToRgba(myTeamColor, 0.15),
                border: `2px dashed ${hexToRgba(myTeamColor, 0.6)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden', position: 'relative',
              }}
            >
              {myTeamLogo
                ? <img src={myTeamLogo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 32, opacity: 0.4 }}>📷</span>
              }
              {myTeamLogo && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0}
                >
                  <span style={{ fontSize: 20 }}>📷</span>
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ fontSize: 11, fontWeight: 600, color: myTeamColor, background: hexToRgba(myTeamColor, 0.12), border: `1px solid ${hexToRgba(myTeamColor, 0.3)}`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
            >
              📷 Upload logo
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, color: myTeamColor, lineHeight: 1.2 }}>
              {displayName}
            </div>
            {(myTeamCity || myTeamCoach) && (
              <div style={{ fontSize: 12, opacity: 0.5, marginTop: 3 }}>
                {myTeamCity && <span>{myTeamCity}</span>}
                {myTeamCity && myTeamCoach && <span> · </span>}
                {myTeamCoach && <span>Téc: {myTeamCoach}</span>}
              </div>
            )}
            {myTeamLogo && (
              <button onClick={() => onSetLogo(null)} style={{ marginTop: 6, fontSize: 11, color: '#e05050', background: 'none', border: '1px solid rgba(224,80,80,0.3)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                Remover logo
              </button>
            )}
          </div>
        </div>

        <div style={styles.teamEditSep} />

        {/* Emblema do clube (logos rápidos) */}
        <div style={styles.teamEditSection}>
          <div style={styles.teamEditLabel}>Emblema do clube</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(CLUB_LOGOS).map(([club, url]) => (
              <button
                key={club}
                onClick={() => onSetLogo(myTeamLogo === url ? null : url)}
                title={club}
                style={{
                  width: 44, height: 44, borderRadius: 10, padding: 5,
                  border: `2px solid ${myTeamLogo === url ? myTeamColor : 'rgba(255,255,255,0.08)'}`,
                  background: myTeamLogo === url ? hexToRgba(myTeamColor, 0.15) : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                <img src={url} alt={club} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Cor principal */}
        <div style={styles.teamEditSection}>
          <div style={styles.teamEditLabel}>Cor principal</div>
          <div style={styles.colorGrid}>
            {TEAM_COLORS.map(c => (
              <button key={c} onClick={() => onSetColor(c)} style={{
                width: 30, height: 30, borderRadius: '50%',
                background: c,
                border: `3px solid ${myTeamColor === c ? '#fff' : 'transparent'}`,
                outline: myTeamColor === c ? `2px solid ${c}` : 'none',
                outlineOffset: 2,
                cursor: 'pointer', transition: 'all 0.12s', padding: 0,
              }} />
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={styles.teamEditLabel}>Nome do time</label>
            <input
              value={myTeamName}
              onChange={e => onSetName(e.target.value)}
              placeholder="Meu Time"
              maxLength={24}
              style={styles.teamInput}
            />
          </div>
          <div>
            <label style={styles.teamEditLabel}>Cidade</label>
            <input
              value={myTeamCity}
              onChange={e => onSetCity(e.target.value)}
              placeholder="Ex: São Paulo"
              maxLength={20}
              style={styles.teamInput}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={styles.teamEditLabel}>Técnico</label>
            <input
              value={myTeamCoach}
              onChange={e => onSetCoach(e.target.value)}
              placeholder="Seu nome"
              maxLength={24}
              style={styles.teamInput}
            />
          </div>
        </div>

        <div style={styles.teamEditSep} />

        {/* Música de fundo */}
        <div>
          <button
            onClick={() => setMusicOn(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: musicOn ? hexToRgba(myTeamColor, 0.1) : 'rgba(255,255,255,0.04)',
              border: `1px solid ${musicOn ? hexToRgba(myTeamColor, 0.35) : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 10, padding: '9px 14px', cursor: 'pointer',
              color: musicOn ? myTeamColor : 'rgba(255,255,255,0.5)',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            <span>🎵</span>
            Música de fundo
            <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.6 }}>{musicOn ? 'ativada' : 'opcional'}</span>
          </button>
          {musicOn && (
            <div style={{ marginTop: 8, background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: musicId ? 10 : 0 }}>
                <input
                  value={musicInput}
                  onChange={e => setMusicInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyMusic()}
                  placeholder="Cole o link ou ID do YouTube…"
                  style={{ ...styles.teamInput, flex: 1, margin: 0 }}
                />
                <button onClick={applyMusic} style={{ background: myTeamColor, color: '#0B1A12', border: 'none', borderRadius: 8, padding: '0 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Tocar
                </button>
              </div>
              {musicId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                  {/* iframe escondido — só áudio */}
                  <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
                    <iframe key={musicId} width="1" height="1" src={`https://www.youtube.com/embed/${musicId}?autoplay=1&controls=0`} allow="autoplay; encrypted-media" title="Música de fundo" />
                  </div>
                  <span style={{ fontSize: 18 }}>🎵</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>Tocando música de fundo</div>
                    <div style={{ display: 'flex', gap: 2, marginTop: 4, alignItems: 'flex-end', height: 12 }}>
                      {[6,10,7,12,5,9,7,11,6].map((h, i) => (
                        <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: myTeamColor || '#d4a23c', animation: `pulse ${0.5 + i * 0.1}s ease-in-out infinite alternate`, opacity: 0.7 }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {!musicId && musicInput && (
                <div style={{ fontSize: 11, color: '#e05050', marginTop: 6 }}>Link inválido — cole um link do YouTube ou ID de 11 caracteres.</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={styles.introTeamStrip}>
        {['Santos 1961', 'Flamengo 1981', 'São Paulo 1991', 'Vasco 1997', 'Corinthians 2005'].map(t => (
          <div key={t} style={styles.introTeamChip}>{t}</div>
        ))}
        <div style={styles.introTeamChip}>+ 22 times</div>
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
              sub: '32 times · Mata-mata · Jogo único',
            },
          ].map(m => (
            <button key={m.id} onClick={() => onSetGameMode(m.id)} style={{
              padding: '14px 12px', borderRadius: 12, border: '2px solid',
              borderColor: gameMode === m.id ? myTeamColor : 'rgba(255,255,255,0.1)',
              background: gameMode === m.id ? hexToRgba(myTeamColor, 0.1) : 'rgba(255,255,255,0.03)',
              color: '#F4F1EA', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
            }}>
              <img
                src={m.trophy}
                alt={m.title}
                style={{ height: 40, objectFit: 'contain', marginBottom: 8, display: 'block' }}
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, color: gameMode === m.id ? myTeamColor : '#F4F1EA' }}>{m.title}</div>
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

      <button style={{ ...styles.btnIntro, background: myTeamColor, color: '#0B1A12' }} onClick={onStart}>
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
              {['#d4a23c','#e05050','#4a90d9','#27ae60','#8e44ad','#e67e22','#16a085','#e91e8c'].map(c => (
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

      {/* Lista de jogadores */}
      <div style={{ marginBottom: 16 }}>
        <div style={styles.sectionLabel}>Jogadores ({players.length})</div>
        {players.map(([pid, p]) => (
          <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {p.logo
              ? <img src={p.logo} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', background: 'rgba(255,255,255,0.05)' }} />
              : <div style={{ width: 32, height: 32, borderRadius: 8, background: p.color || '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⚽</div>
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: p.color || '#F4F1EA' }}>{p.name || 'Jogador'}</div>
              {p.city && <div style={{ fontSize: 11, opacity: 0.4 }}>{p.city}</div>}
            </div>
            {pid === roomData.leaderId && <span style={{ fontSize: 10, color: '#d4a23c', border: '1px solid rgba(212,162,60,0.3)', borderRadius: 4, padding: '1px 6px' }}>LÍDER</span>}
            {pid === myId && <span style={{ fontSize: 10, color: '#aaa', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '1px 6px' }}>VOCÊ</span>}
            <span style={{ fontSize: 14 }}>{p.ready ? '✅' : '⏳'}</span>
          </div>
        ))}
      </div>

      {/* Ações do líder */}
      {isLeader && !isSetupPhase && (
        <button
          onClick={onStartSetup}
          disabled={players.length < 2}
          style={{ ...styles.btnPrimary, width: '100%', background: mc, color: '#0B1A12', opacity: players.length < 2 ? 0.5 : 1 }}
        >
          {players.length < 2 ? 'Aguardando mais jogadores...' : `▶ Iniciar — ${timerMinutes} min para criar o time`}
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
function FormationPicker({ onChoose }) {
  return (
    <div style={styles.card} className="card-mob">
      <div style={styles.eyebrow}>Passo 1 de 2</div>
      <h2 style={styles.h2}>Escolha o esquema tático</h2>
      <div style={styles.formationGrid}>
        {Object.entries(FORMATIONS).map(([key, f]) => (
          <button key={key} style={styles.formationCard} onClick={() => onChoose(key)}>
            <div style={styles.formationName}>{f.label}</div>
            <MiniPitchPreview formationKey={key} />
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniPitchPreview({ formationKey }) {
  const slots = useMemo(() => buildPitchSlots(formationKey), [formationKey]);
  return (
    <div style={styles.miniPitch}>
      {slots.map((s, i) => (
        <div key={i} style={{ ...styles.miniDot, left: `${s.x}%`, top: `${s.y}%` }} />
      ))}
    </div>
  );
}

function Pitch({ pitch, pitchSlots, highlightSlots = [], onClickSlot, onUnplace }) {
  const highlightKeys = new Set(highlightSlots.map(s => s.key));
  return (
    <div style={styles.pitchWrap}>
      <div style={styles.pitchField} className="pitch-field">
        <div style={styles.pitchCircle} />
        <div style={styles.pitchHalfLine} />
        {pitchSlots.map(slot => {
          const occupant = pitch[slot.key];
          const isHighlighted = highlightKeys.has(slot.key);
          const canPlace = isHighlighted && !occupant && onClickSlot;
          const canUnplace = !!occupant && !!onUnplace;
          const clickable = canPlace || canUnplace;
          return (
            <div
              key={slot.key}
              onClick={clickable ? () => canPlace ? onClickSlot(slot.key) : onUnplace(slot.key) : undefined}
              style={{
                ...styles.pitchSpot,
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                background: occupant ? '#d4a23c' : isHighlighted ? 'rgba(127,217,154,0.5)' : 'rgba(255,255,255,0.08)',
                border: canUnplace
                  ? '2px dashed rgba(212,162,60,0.6)'
                  : isHighlighted
                    ? '2px solid #7fd99a'
                    : '1px solid rgba(255,255,255,0.25)',
                cursor: clickable ? 'pointer' : 'default',
                transform: isHighlighted && !occupant ? 'translate(-50%,-50%) scale(1.12)' : 'translate(-50%,-50%)',
                boxShadow: isHighlighted && !occupant ? '0 0 0 4px rgba(127,217,154,0.25)' : 'none',
              }}
              className="pitch-spot"
              title={occupant ? `${occupant.name} (${occupant.teamLabel}) — clique para reposicionar` : slot.label}
            >
              {occupant
                ? <span style={styles.pitchSpotName} className="pitch-spot-name">{occupant.name.split(' ')[0]}</span>
                : <span style={styles.pitchSpotLabel}>{slot.label}</span>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DraftTopBar({ formationLabel, filled, total, skipsLeft, onSkip, pitch }) {
  const pct = total > 0 ? (filled / total) * 100 : 0;
  const canSkip = skipsLeft > 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={styles.draftTopRow}>
        <div>
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
      {filled > 1 && (
        <div style={{ marginTop: 8 }}>
          <ChemistryDisplay pitch={pitch} compact />
        </div>
      )}
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

function Draft({ rolledTeam, isRolling, rollingPreview, pitch, pitchSlots, formationLabel, skipsLeft, selectedPlayer, repositioningSlot, eligibleSlotsForPlayer, onClickPlayer, onClickPitchSlot, onUnplacePlayer, onSkipTeam }) {
  const isMobile = useIsMobile();
  const filledCount = Object.keys(pitch).length;
  const highlightSlots = selectedPlayer ? eligibleSlotsForPlayer(selectedPlayer) : [];

  const mobileLayoutStyle = { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 };
  const playersPanelStyle = isMobile
    ? { ...styles.draftLeft, maxHeight: '50vh' }
    : styles.draftLeft;
  const pitchPanelStyle = isMobile ? {} : styles.draftRight;

  if (isRolling) {
    const pitchEl = <div style={pitchPanelStyle}><Pitch pitch={pitch} pitchSlots={pitchSlots} /></div>;
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
        <DraftTopBar formationLabel={formationLabel} filled={filledCount} total={pitchSlots.length} skipsLeft={skipsLeft} onSkip={onSkipTeam} pitch={pitch} />
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
      <DraftTopBar formationLabel={formationLabel} filled={filledCount} total={pitchSlots.length} skipsLeft={skipsLeft} onSkip={onSkipTeam} pitch={pitch} />

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
            {rolledTeam.players.map((p, i) => {
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
                    width: 40, height: 40, borderRadius: 8,
                    background: isSelected ? 'rgba(127,217,154,0.2)' : 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14,
                    color: ovrColor(p.ovr), flexShrink: 0,
                  }}>
                    {p.ovr}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {expandPlayerPositions(p.pos).map((pos) => {
                        const isNative = p.pos.includes(pos);
                        return (
                          <span key={pos} style={{
                            fontFamily: "'Space Mono', monospace", fontSize: 9,
                            padding: '2px 5px', borderRadius: 4,
                            background: isSelected
                              ? (isNative ? 'rgba(127,217,154,0.2)' : 'rgba(127,217,154,0.07)')
                              : (isNative ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'),
                            color: isSelected
                              ? (isNative ? '#7fd99a' : 'rgba(127,217,154,0.5)')
                              : (isNative ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)'),
                            letterSpacing: 0.3,
                            border: isNative ? 'none' : '1px solid rgba(255,255,255,0.08)',
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
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ChemistryDisplay({ pitch, compact = false }) {
  const xi = Object.values(pitch).filter(p => p && p.club);
  const { score, breakdown, pct, ovrBonus } = calcChemistry(xi);
  const chemColor = pct >= 66 ? '#7fd99a' : pct >= 33 ? '#d4a23c' : '#e05939';

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, opacity: 0.6, fontFamily: "'Space Mono', monospace" }}>ENTR.</span>
        <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 999 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: chemColor, borderRadius: 999, transition: 'width 0.4s' }} />
        </div>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: chemColor, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
        {ovrBonus > 0 && <span style={{ fontSize: 11, color: chemColor }}>+{ovrBonus} OVR</span>}
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', margin: '14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 15 }}>Entrosamento</span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 18, color: chemColor }}>{pct}%</span>
      </div>
      <div style={{ height: 7, background: 'rgba(255,255,255,0.1)', borderRadius: 999, marginBottom: 12 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: chemColor, borderRadius: 999, transition: 'width 0.4s' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {breakdown.epoca > 0 && (
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(127,217,154,0.15)', color: '#7fd99a', fontFamily: "'Space Mono', monospace" }}>
            ⚡ {breakdown.epoca} par{breakdown.epoca > 1 ? 'es' : ''} mesma época (+5)
          </span>
        )}
        {breakdown.clube > 0 && (
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(212,162,60,0.15)', color: '#d4a23c', fontFamily: "'Space Mono', monospace" }}>
            🤝 {breakdown.clube} par{breakdown.clube > 1 ? 'es' : ''} mesmo clube (+2)
          </span>
        )}
        {breakdown.pais > 0 && (
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', fontFamily: "'Space Mono', monospace" }}>
            🌎 {breakdown.pais} par{breakdown.pais > 1 ? 'es' : ''} mesmo país (+1)
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, opacity: 0.5 }}>
        Bônus de OVR: <span style={{ color: chemColor, fontWeight: 700 }}>+{ovrBonus}</span> aplicado na simulação
      </div>
    </div>
  );
}

function Squad({ pitch, pitchSlots, formationLabel, captainSlot, onSetCaptain, onConfirm, onRedo }) {
  const xi = Object.values(pitch);
  const avgOvr = xi.length ? Math.round(xi.reduce((s, p) => s + p.ovr, 0) / xi.length) : 0;
  const { ovrBonus } = calcChemistry(xi.filter(p => p.club));
  const effectiveOvr = Math.round((avgOvr + ovrBonus + (captainSlot ? 2 / xi.length : 0)) * 10) / 10;

  return (
    <div style={styles.card} className="card-mob">
      <div style={styles.eyebrow}>{formationLabel}</div>
      <h2 style={styles.h2}>OVR base: {avgOvr} · Efetivo: {effectiveOvr}</h2>
      <ChemistryDisplay pitch={pitch} />

      {/* Instrução capitão */}
      <div style={{
        textAlign: 'center', fontSize: 12, padding: '8px 12px',
        background: captainSlot ? 'rgba(212,162,60,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${captainSlot ? 'rgba(212,162,60,0.35)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 8, marginBottom: 10, color: captainSlot ? '#d4a23c' : 'rgba(255,255,255,0.5)',
      }}>
        {captainSlot
          ? `© Capitão: ${pitch[captainSlot]?.name} — +2 OVR`
          : 'Toque em um jogador para definir o capitão (braçadeira +2 OVR)'}
      </div>

      <Pitch pitch={pitch} pitchSlots={pitchSlots} />

      <div style={styles.squadList}>
        {pitchSlots.map(slot => {
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
                {isCap ? '©' : slot.label}
              </span>
              <span style={{ ...styles.squadName, fontWeight: isCap ? 700 : 400 }}>{p.name}</span>
              <span style={styles.squadTeam}>{p.teamLabel}</span>
              <span style={{ ...styles.squadOvr, color: isCap ? '#d4a23c' : undefined }}>
                {isCap ? `${p.ovr} +2` : p.ovr}
              </span>
            </button>
          );
        })}
      </div>

      <div style={styles.btnRow}>
        <button style={styles.btnGhost} onClick={onRedo}>Trocar formação</button>
        <button
          style={{ ...styles.btnPrimary, opacity: captainSlot ? 1 : 0.6 }}
          onClick={onConfirm}
          title={captainSlot ? '' : 'Escolha um capitão primeiro'}
        >
          {captainSlot ? 'Disputar →' : 'Escolha um capitão'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// TELA DE JOGO: liga com cronômetro e tabela
// ============================================================
function LiveMatchBox({ um, homeTeam, awayTeam, myTeamId, myTeamBadge, mc, liveScore, clockDisplay, isSimulating, roundDone, liveEvents, simSpeed, onSetSpeed, simMode, onSetSimMode, autoCountdown, onStartRound, roundLabel }) {
  if (!um || !homeTeam || !awayTeam) return null;
  const isAuto = simMode === 'auto';
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
        </div>
      )}

      {liveEvents.length > 0 && (
        <div style={styles.goalTimeline}>
          {liveEvents.map((ev, i) => {
            const isMyGoal = ev.teamId === myTeamId;
            return (
              <div key={i} style={{ ...styles.goalEvent, background: isMyGoal ? 'rgba(127,217,154,0.1)' : 'rgba(224,89,63,0.08)', borderLeft: isMyGoal ? '3px solid #7fd99a' : '3px solid rgba(224,89,63,0.5)' }}>
                <span style={styles.goalMinute}>{ev.minute}'</span>
                <span style={styles.goalBall}>⚽</span>
                <div style={styles.goalInfo}>
                  <span style={styles.goalScorer}>{ev.scorer}</span>
                  <span style={styles.goalTeam}>{ev.teamLabel}</span>
                </div>
                <span style={styles.goalScore}>({ev.homeScore}–{ev.awayScore})</span>
              </div>
            );
          })}
        </div>
      )}
      {liveEvents.length === 0 && roundDone && <div style={styles.noGoalsMsg}>Sem gols — 0 × 0</div>}

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

function Playing({ myTeamId, fixtures, currentRound, leagueTeams, leagueTable, clockMinute, isSimulating, liveEvents, liveScore, roundResults, activeUserMatch, myTeamColor, myTeamBadge, myTeamLogo, gameMode, cupRounds, cupRoundIdx, userInCup, simSpeed, onSetSpeed, simMode, onSetSimMode, autoCountdown, onStartRound, onNextRound }) {
  const mc = myTeamColor || '#d4a23c';
  const round = fixtures[currentRound] || [];
  const um = activeUserMatch || round.find(m => m.homeId === myTeamId || m.awayId === myTeamId);
  const homeTeam = um ? leagueTeams.find(t => t.id === um.homeId) : null;
  const awayTeam = um ? leagueTeams.find(t => t.id === um.awayId) : null;
  const roundDone = roundResults !== null;
  const clockDisplay = `${clockMinute}'`;

  // ── COPA DO BRASIL ──────────────────────────────────────────
  if (gameMode === 'copa') {
    const cupRound = cupRounds[cupRoundIdx] || {};
    const roundName = cupRound.name || CUP_ROUND_NAMES[cupRoundIdx] || 'Copa';
    const isLastCupRound = cupRoundIdx >= CUP_ROUND_NAMES.length - 1;

    // Usuário eliminado
    if (!userInCup && roundDone) {
      return (
        <div style={styles.card} className="card-mob">
          <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>😔</div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Eliminado!</div>
            <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 24 }}>Seu time foi eliminado nas {roundName}.</div>
            {simMode === 'manual' && <button style={styles.btnSmall} onClick={onNextRound}>Ver campeão →</button>}
            {simMode === 'auto' && autoCountdown !== null && (
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#d4a23c' }}>Avançando em {autoCountdown}s…</div>
            )}
          </div>
          {roundResults && (
            <div style={styles.otherMatchesBox}>
              <div style={styles.sectionLabel}>Resultados — {roundName}</div>
              {roundResults.map((r, i) => {
                const h = leagueTeams.find(t => t.id === r.homeId);
                const a = leagueTeams.find(t => t.id === r.awayId);
                const hw = r.homeGoals > r.awayGoals;
                const aw = r.awayGoals > r.homeGoals;
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
        </div>
      );
    }

    return (
      <div style={styles.card} className="card-mob">
        <div style={styles.draftTopRow}>
          <div>
            <div style={styles.eyebrow}>Copa do Brasil</div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, marginTop: 2 }}>{roundName}</div>
          </div>
          {roundDone && userInCup && simMode === 'manual' && (
            <button style={{ ...styles.btnSmall, background: mc, color: '#0B1A12' }} onClick={onNextRound}>
              {isLastCupRound ? '🏆 Ver campeão →' : 'Próxima fase →'}
            </button>
          )}
          {roundDone && userInCup && simMode === 'auto' && autoCountdown !== null && (
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
          roundLabel={`Jogar — ${roundName}`}
        />

        {roundDone && (
          <div style={styles.otherMatchesBox}>
            <div style={styles.sectionLabel}>Outros jogos — {roundName}</div>
            {roundResults.filter(r => r.homeId !== myTeamId && r.awayId !== myTeamId).map((r, i) => {
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
            })}
          </div>
        )}

        {/* Chaveamento das fases */}
        {cupRounds.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={styles.sectionLabel}>Chaveamento</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CUP_ROUND_NAMES.map((name, idx) => (
                <div key={idx} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 999,
                  background: idx < cupRoundIdx ? hexToRgba(mc, 0.2) : idx === cupRoundIdx ? hexToRgba(mc, 0.35) : 'rgba(255,255,255,0.05)',
                  color: idx <= cupRoundIdx ? mc : 'rgba(255,255,255,0.3)',
                  border: `1px solid ${idx === cupRoundIdx ? mc : 'transparent'}`,
                  fontFamily: "'Space Mono', monospace",
                }}>
                  {idx < cupRoundIdx ? '✓ ' : ''}{name}
                </div>
              ))}
            </div>
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
        <div style={styles.sectionLabel}>Classificação Geral</div>
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
          return (
            <div key={row.id} style={{
              ...styles.tableRow,
              background: isMe ? hexToRgba(mc, 0.1) : i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
              borderLeft: isMe ? `3px solid ${mc}` : '3px solid transparent',
            }}>
              <span style={styles.tablePos}>{i + 1}</span>
              <span style={{ flex: 1, fontWeight: isMe ? 700 : 400, color: isMe ? mc : '#F4F1EA', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
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
            </div>
          );
        })}
      </div>
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
            {[8,14,10,16,6,12,10,14,8].map((h, i) => (
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

function Results({ leagueTable, myTeamId, myTeamColor, myTeamBadge, myTeamLogo, gameMode, cupWinnerId, leagueTeams, onRestart }) {
  const mc = myTeamColor || '#d4a23c';

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
            {userWon ? 'CAMPEÃO!' : 'Copa encerrada'}
          </h1>
          <div style={{ fontSize: 15, opacity: 0.7, marginBottom: 20 }}>
            {userWon
              ? `${myTeamBadge || ''} ${myTeamBadge ? ' ' : ''}Seu time conquistou a Copa do Brasil!`
              : <>Campeão: <b style={{ color: '#d4a23c' }}>{winner?.label ?? '—'}</b></>
            }
          </div>
          {!userWon && myTeamBadge && (
            <div style={styles.badgeMuted}>Seu time foi eliminado antes da final. Tente de novo!</div>
          )}
          {userWon && <div style={styles.badge}>🏆 Copa do Brasil conquistada! Time lendário!</div>}
        </div>
        <AnthemPlayer club={champClub} />
        <button style={{ ...styles.btnPrimary, marginTop: 20, width: '100%', background: mc, color: '#0B1A12' }} onClick={onRestart}>
          Jogar de novo →
        </button>
      </div>
    );
  }

  // ── BRASILEIRÃO ─────────────────────────────────────────────
  const pos = leagueTable.findIndex(t => t.id === myTeamId) + 1;
  const myRow = leagueTable.find(t => t.id === myTeamId) || {};
  const champion = leagueTable[0];
  const isChampion = pos === 1;
  const podium = pos <= 3;
  const champTeam = leagueTeams?.find(t => t.id === champion?.id);
  const champClub = champTeam?.club || getMostCommonClub(champTeam?.players);

  return (
    <div style={styles.card} className="card-mob">
      <div style={styles.eyebrow}>Fim do Brasileirão · Série A</div>
      <h1 style={styles.h1} className="h1-mob">
        {isChampion ? '🏆 CAMPEÃO!' : podium ? `${pos}º lugar — pódio!` : `${pos}º lugar`}
      </h1>

      {!isChampion && (
        <div style={styles.championBox}>
          Campeão: <b>{champion?.label}</b> — {champion?.pts} pts
        </div>
      )}

      <div style={styles.finalStats} className="stats-grid-3">
        <Stat label="Pontos" value={myRow.pts ?? 0} />
        <Stat label="Vitórias" value={myRow.v ?? 0} />
        <Stat label="Empates" value={myRow.e ?? 0} />
        <Stat label="Derrotas" value={myRow.d ?? 0} />
        <Stat label="Gols pró" value={myRow.gp ?? 0} />
        <Stat label="Gols contra" value={myRow.gc ?? 0} />
      </div>

      {isChampion && <div style={styles.badge}>🏆 Brasileirão conquistado! Você montou um time lendário.</div>}
      {!isChampion && podium && <div style={styles.badgeInfo}>Campanha sólida — faltou pouco pra vencer!</div>}
      {!podium && <div style={styles.badgeMuted}>Campanha difícil. Tente montar um time mais equilibrado.</div>}

      <AnthemPlayer club={champClub} />

      <div className="table-scroll">
      <div style={{ ...styles.sectionLabel, marginTop: 24 }}>Classificação Final</div>
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
        return (
          <div key={row.id} style={{
            ...styles.tableRow,
            background: isMe ? hexToRgba(mc, 0.1) : i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
            borderLeft: isMe ? `3px solid ${mc}` : '3px solid transparent',
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

      <button style={{ ...styles.btnPrimary, marginTop: 28, width: '100%', background: mc, color: '#0B1A12' }} onClick={onRestart}>
        Jogar de novo →
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
  }
  input::placeholder { color: rgba(255,255,255,0.2); }
  input:focus { border-color: rgba(212,162,60,0.5) !important; outline: none; }
  .draft-left { scrollbar-width: thin; scrollbar-color: rgba(212,162,60,0.3) transparent; }
  .draft-left::-webkit-scrollbar { width: 3px; }
  .draft-left::-webkit-scrollbar-track { background: transparent; }
  .draft-left::-webkit-scrollbar-thumb { background: rgba(212,162,60,0.35); border-radius: 999px; }
  .draft-left::-webkit-scrollbar-thumb:hover { background: rgba(212,162,60,0.65); }
`;

const styles = {
  page: { minHeight: '100vh', background: '#0B1A12', color: '#F4F1EA', fontFamily: "'Source Sans 3', system-ui, sans-serif", position: 'relative', overflow: 'hidden' },
  bgTexture: { position: 'fixed', inset: 0, opacity: 0.05, background: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 1px,transparent 40px)', pointerEvents: 'none' },
  header: { borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'relative', zIndex: 1 },
  headerInner: { maxWidth: 760, margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 },
  crest: { fontSize: 22, color: '#d4a23c' },
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

  formationGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 },
  formationCard: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '14px 12px', color: '#F4F1EA', textAlign: 'center' },
  formationName: { fontSize: 13, fontWeight: 700, marginBottom: 10, fontFamily: "'Space Mono', monospace" },
  miniPitch: { position: 'relative', width: '100%', aspectRatio: '0.7', background: 'linear-gradient(180deg,#0f3d22,#145c30)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)' },
  miniDot: { position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: '#d4a23c', transform: 'translate(-50%,-50%)' },

  pitchWrap: { margin: '20px 0', display: 'flex', justifyContent: 'center' },
  pitchField: { position: 'relative', width: '100%', maxWidth: 380, aspectRatio: '0.68', background: 'linear-gradient(180deg,#0f3d22 0%,#145c30 50%,#0f3d22 100%)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 8, overflow: 'hidden' },
  pitchCircle: { position: 'absolute', left: '50%', top: '50%', width: 70, height: 70, border: '1px solid rgba(255,255,255,0.25)', borderRadius: '50%', transform: 'translate(-50%,-50%)' },
  pitchHalfLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(255,255,255,0.25)' },
  pitchSpot: { position: 'absolute', width: 46, height: 46, borderRadius: '50%', transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontSize: 9, textAlign: 'center', lineHeight: 1.1, transition: 'background 0.2s' },
  pitchSpotName: { fontWeight: 700, fontSize: 9, color: '#0B1A12', padding: '0 2px' },
  pitchSpotLabel: { fontFamily: "'Space Mono', monospace", fontSize: 9, opacity: 0.7, color: '#fff' },

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
  goalTimeline: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' },
  goalEvent: { display: 'grid', gridTemplateColumns: '36px 20px 1fr auto', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8 },
  goalMinute: { fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: '#d4a23c' },
  goalBall: { fontSize: 14 },
  goalInfo: { display: 'flex', flexDirection: 'column', gap: 1 },
  goalScorer: { fontSize: 13, fontWeight: 600 },
  goalTeam: { fontSize: 11, opacity: 0.55 },
  goalScore: { fontFamily: "'Space Mono', monospace", fontSize: 12, opacity: 0.7, whiteSpace: 'nowrap' },
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
  introCard: { textAlign: 'center', padding: '48px 28px 36px' },
  introBadge: { display: 'inline-block', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#d4a23c', background: 'rgba(212,162,60,0.12)', border: '1px solid rgba(212,162,60,0.35)', borderRadius: 999, padding: '5px 14px', marginBottom: 20 },
  introTitle: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 38, fontWeight: 700, lineHeight: 1.1, margin: '0 0 16px' },
  introLead: { fontSize: 16, lineHeight: 1.65, opacity: 0.75, maxWidth: 460, margin: '0 auto 36px' },
  featGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 },
  featCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '18px 12px' },
  featIcon: { fontSize: 24, marginBottom: 8 },
  featTitle: { fontWeight: 700, fontSize: 13, marginBottom: 6 },
  featDesc: { fontSize: 12, opacity: 0.6, lineHeight: 1.5 },
  introTeamStrip: { display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 32 },
  introTeamChip: { fontSize: 11, opacity: 0.55, background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: '4px 10px' },
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
