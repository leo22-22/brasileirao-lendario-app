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
// DADOS: 66 times históricos do Brasileirão (1959-2026)
// ============================================================
const TEAMS = [
  { id: 'bahia1959', club: 'Bahia', year: 1959, label: 'Bahia 1959 (1o Campeonato Nacional)', coach: 'Otacilio Goncalves',
    colors: { p: '#003399', s: '#ffffff' },
    players: [
      { name: 'Paulo', pos: ['GOL'], ovr: 79 },
      { name: 'Antonio', pos: ['LD'], ovr: 76 },
      { name: 'Raimundo', pos: ['ZAG'], ovr: 78 },
      { name: 'Bino', pos: ['ZAG'], ovr: 77 },
      { name: 'Dema', pos: ['LE'], ovr: 76 },
      { name: 'Nilton', pos: ['VOL'], ovr: 77 },
      { name: 'Ze', pos: ['VOL'], ovr: 76 },
      { name: 'Magalhaes', pos: ['MEI'], ovr: 79 },
      { name: 'Mario', pos: ['PD'], ovr: 78 },
      { name: 'Doval', pos: ['ATA'], ovr: 82 },
      { name: 'Orlando', pos: ['PE'], ovr: 78 },
      { name: 'Elinaldo', pos: ['GOL'], ovr: 71 },
      { name: 'Batista', pos: ['LD'], ovr: 73 },
      { name: 'Airton', pos: ['ZAG'], ovr: 72 },
      { name: 'Juarez', pos: ['VOL'], ovr: 73 },
      { name: 'Ezio', pos: ['MEI'], ovr: 74 },
      { name: 'Hilton', pos: ['MEI'], ovr: 73 },
      { name: 'Carlinhos', pos: ['ATA'], ovr: 75 },
      { name: 'Nelson', pos: ['ATA'], ovr: 72 },
      { name: 'Adao', pos: ['PE'], ovr: 71 },
    ]},
  { id: 'santos1961', club: 'Santos', year: 1961, label: 'Santos 1961 (Taca Brasil)', coach: 'Lula',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Gylmar', pos: ['GOL'], ovr: 86 },
      { name: 'Lima', pos: ['LD'], ovr: 78 },
      { name: 'Mauro', pos: ['ZAG'], ovr: 82 },
      { name: 'Calvet', pos: ['ZAG'], ovr: 76 },
      { name: 'Dalmo', pos: ['LE'], ovr: 77 },
      { name: 'Zito', pos: ['VOL','MEI'], ovr: 87 },
      { name: 'Mengalvio', pos: ['VOL','MEI'], ovr: 83 },
      { name: 'Dorval', pos: ['PD','ATA'], ovr: 80 },
      { name: 'Coutinho', pos: ['MEI','ATA'], ovr: 88 },
      { name: 'Pele', pos: ['ATA','MEI'], ovr: 99 },
      { name: 'Pepe', pos: ['PE','ATA'], ovr: 89 },
      { name: 'Laercio', pos: ['GOL'], ovr: 72 },
      { name: 'Carlos Alberto Torres', pos: ['LD'], ovr: 75 },
      { name: 'Clodoaldo', pos: ['VOL','MEI'], ovr: 74 },
      { name: 'Toninho Guerreiro', pos: ['ATA'], ovr: 76 },
      { name: 'Edu', pos: ['PE','ATA'], ovr: 74 },
      { name: 'Olavo', pos: ['ZAG'], ovr: 73 },
      { name: 'Tite', pos: ['PE'], ovr: 73 },
      { name: 'Formiga', pos: ['VOL'], ovr: 72 },
      { name: 'Apolinario', pos: ['ZAG'], ovr: 70 },
    ]},
  { id: 'santos1962', club: 'Santos', year: 1962, label: 'Santos 1962 (Libertadores + Mundial + Taca Brasil)', coach: 'Lula',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Gylmar', pos: ['GOL'], ovr: 90 },
      { name: 'Lima', pos: ['LD'], ovr: 80 },
      { name: 'Mauro', pos: ['ZAG'], ovr: 86 },
      { name: 'Calvet', pos: ['ZAG'], ovr: 78 },
      { name: 'Dalmo', pos: ['LE'], ovr: 79 },
      { name: 'Zito', pos: ['VOL','MEI'], ovr: 90 },
      { name: 'Mengalvio', pos: ['VOL','MEI'], ovr: 86 },
      { name: 'Dorval', pos: ['PD','ATA'], ovr: 84 },
      { name: 'Coutinho', pos: ['MEI','ATA'], ovr: 92 },
      { name: 'Pele', pos: ['ATA','MEI'], ovr: 99 },
      { name: 'Pepe', pos: ['PE','ATA'], ovr: 91 },
      { name: 'Carlos Alberto Torres', pos: ['LD'], ovr: 76 },
      { name: 'Clodoaldo', pos: ['VOL','MEI'], ovr: 78 },
      { name: 'Toninho Guerreiro', pos: ['ATA'], ovr: 76 },
      { name: 'Edu', pos: ['PE','ATA'], ovr: 74 },
      { name: 'Joel', pos: ['ZAG'], ovr: 72 },
      { name: 'Laercio', pos: ['GOL'], ovr: 73 },
      { name: 'Rodrigues Neto', pos: ['ZAG'], ovr: 71 },
      { name: 'Orlando', pos: ['ATA'], ovr: 70 },
      { name: 'Pagao', pos: ['LD'], ovr: 70 },
    ]},
  { id: 'botafogo1968', club: 'Botafogo', year: 1968, label: 'Botafogo 1968', coach: 'Zagallo',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Cao', pos: ['GOL'], ovr: 79 },
      { name: 'Moreira', pos: ['LD'], ovr: 77 },
      { name: 'Ze Carlos', pos: ['ZAG'], ovr: 78 },
      { name: 'Leonidas', pos: ['ZAG'], ovr: 77 },
      { name: 'Waltencir', pos: ['LE'], ovr: 78 },
      { name: 'Carlos Roberto', pos: ['VOL'], ovr: 81 },
      { name: 'Gerson', pos: ['MEI','VOL'], ovr: 92 },
      { name: 'Rogerio', pos: ['PD'], ovr: 80 },
      { name: 'Roberto', pos: ['ATA'], ovr: 81 },
      { name: 'Jairzinho', pos: ['ATA','PD'], ovr: 93 },
      { name: 'Paulo Cezar Caju', pos: ['PE','MEI'], ovr: 86 },
      { name: 'Ubirajara Motta', pos: ['GOL'], ovr: 71 },
      { name: 'Chiquinho Pastor', pos: ['ZAG'], ovr: 73 },
      { name: 'Moises', pos: ['ZAG'], ovr: 72 },
      { name: 'Nei Conceicao', pos: ['VOL'], ovr: 75 },
      { name: 'Zequinha', pos: ['PD'], ovr: 74 },
      { name: 'Ferretti', pos: ['ATA'], ovr: 78 },
      { name: 'Humberto', pos: ['ATA'], ovr: 74 },
      { name: 'Afonsinho', pos: ['MEI'], ovr: 76 },
      { name: 'Torino', pos: ['ATA'], ovr: 72 },
    ]},
  { id: 'fluminense1970', club: 'Fluminense', year: 1970, label: 'Fluminense 1970 (1o titulo nacional)', coach: 'Yustrich',
    colors: { p: '#7a1e3c', s: '#006437' },
    players: [
      { name: 'Felix', pos: ['GOL'], ovr: 84 },
      { name: 'Marco Antonio', pos: ['LE'], ovr: 83 },
      { name: 'Flavio Minuano', pos: ['ATA'], ovr: 82 },
      { name: 'Samarone', pos: ['MEI','MC'], ovr: 81 },
      { name: 'Denilson', pos: ['VOL','ZAG'], ovr: 81 },
      { name: 'Lula', pos: ['PE','ME'], ovr: 80 },
      { name: 'Mickey', pos: ['ATA'], ovr: 79 },
      { name: 'Cafuringa', pos: ['PD','MD'], ovr: 79 },
      { name: 'Assis', pos: ['ZAG','VOL'], ovr: 78 },
      { name: 'Galhardo', pos: ['ZAG'], ovr: 78 },
      { name: 'Oliveira', pos: ['LD'], ovr: 77 },
      { name: 'Didi', pos: ['VOL','MC'], ovr: 76 },
      { name: 'Silveira', pos: ['ZAG','VOL'], ovr: 76 },
      { name: 'Claudio Garcia', pos: ['PD','MEI'], ovr: 75 },
      { name: 'Toninho', pos: ['LD'], ovr: 74 },
      { name: 'Jorge Vitorio', pos: ['GOL'], ovr: 73 },
      { name: 'Gilson Nunes', pos: ['PE'], ovr: 73 },
      { name: 'Wilton', pos: ['PD','ATA'], ovr: 72 },
      { name: 'Lulinha', pos: ['MC','VOL'], ovr: 72 },
      { name: 'Jair', pos: ['ATA'], ovr: 71 },
    ]},
  { id: 'atletico-mg1971', club: 'Atletico-MG', year: 1971, label: 'Atletico-MG 1971 (1o titulo)', coach: 'Vantuil de Oliveira',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Laerte', pos: ['GOL'], ovr: 78 },
      { name: 'Licio', pos: ['LD'], ovr: 76 },
      { name: 'Raimundo', pos: ['ZAG'], ovr: 78 },
      { name: 'Vantuil', pos: ['ZAG'], ovr: 77 },
      { name: 'Maneco', pos: ['LE'], ovr: 76 },
      { name: 'Rogerio', pos: ['VOL'], ovr: 78 },
      { name: 'Dario', pos: ['VOL'], ovr: 77 },
      { name: 'Reinaldo', pos: ['MEI'], ovr: 83 },
      { name: 'Ezio', pos: ['PD'], ovr: 79 },
      { name: 'Dada Maravilha', pos: ['ATA'], ovr: 84 },
      { name: 'Angelo', pos: ['PE'], ovr: 78 },
      { name: 'Marinho', pos: ['GOL'], ovr: 71 },
      { name: 'Sergio', pos: ['LD'], ovr: 73 },
      { name: 'Carlos', pos: ['ZAG'], ovr: 72 },
      { name: 'Gil', pos: ['VOL'], ovr: 73 },
      { name: 'Tiao', pos: ['MEI'], ovr: 74 },
      { name: 'Edu', pos: ['ATA'], ovr: 75 },
      { name: 'Ze Maria', pos: ['LE'], ovr: 72 },
      { name: 'Wilson', pos: ['ATA'], ovr: 72 },
      { name: 'Jonas', pos: ['PD'], ovr: 71 },
    ]},
  { id: 'palmeiras1972', club: 'Palmeiras', year: 1972, label: 'Palmeiras 1972 (Academia)', coach: 'Osvaldo Brandao',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Leao', pos: ['GOL'], ovr: 85 },
      { name: 'Eurico', pos: ['LD'], ovr: 78 },
      { name: 'Luis Pereira', pos: ['ZAG'], ovr: 86 },
      { name: 'Alfredo', pos: ['ZAG'], ovr: 77 },
      { name: 'Zeca', pos: ['LE'], ovr: 78 },
      { name: 'Dudu', pos: ['VOL'], ovr: 84 },
      { name: 'Ademir da Guia', pos: ['MEI','PD'], ovr: 91 },
      { name: 'Edu Bala', pos: ['PD','MEI'], ovr: 81 },
      { name: 'Madurga', pos: ['ATA'], ovr: 78 },
      { name: 'Leivinha', pos: ['ATA','PE'], ovr: 87 },
      { name: 'Nei', pos: ['PE'], ovr: 80 },
      { name: 'Ze Carlos', pos: ['MEI'], ovr: 73 },
      { name: 'Ronaldo', pos: ['ATA'], ovr: 74 },
      { name: 'Cesar', pos: ['ATA'], ovr: 73 },
      { name: 'Marco Antonio', pos: ['VOL'], ovr: 74 },
      { name: 'Ostrovski', pos: ['LD'], ovr: 71 },
      { name: 'Baldochi', pos: ['ZAG'], ovr: 72 },
      { name: 'Flavio', pos: ['MEI'], ovr: 75 },
      { name: 'Alfredo Jr', pos: ['ZAG'], ovr: 70 },
      { name: 'Rinaldo', pos: ['PE'], ovr: 70 },
    ]},
  { id: 'palmeiras1973', club: 'Palmeiras', year: 1973, label: 'Palmeiras 1973 (Bicampeonato Academia)', coach: 'Osvaldo Brandao',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Leao', pos: ['GOL'], ovr: 85 },
      { name: 'Eurico', pos: ['LD'], ovr: 78 },
      { name: 'Luis Pereira', pos: ['ZAG'], ovr: 87 },
      { name: 'Alfredo', pos: ['ZAG'], ovr: 77 },
      { name: 'Zeca', pos: ['LE'], ovr: 78 },
      { name: 'Dudu', pos: ['VOL'], ovr: 85 },
      { name: 'Ademir da Guia', pos: ['MEI','PD'], ovr: 92 },
      { name: 'Edu Bala', pos: ['PD','MEI'], ovr: 82 },
      { name: 'Cesar', pos: ['ATA'], ovr: 79 },
      { name: 'Leivinha', pos: ['ATA','PE'], ovr: 88 },
      { name: 'Nei', pos: ['PE'], ovr: 80 },
      { name: 'Ze Carlos', pos: ['MEI'], ovr: 74 },
      { name: 'Ronaldo', pos: ['ATA'], ovr: 75 },
      { name: 'Marco Antonio', pos: ['VOL'], ovr: 75 },
      { name: 'Luis Carlos', pos: ['LD'], ovr: 73 },
      { name: 'Gilberto', pos: ['ZAG'], ovr: 72 },
      { name: 'Flavio', pos: ['MEI'], ovr: 76 },
      { name: 'Edilson', pos: ['ATA'], ovr: 74 },
      { name: 'Amaral', pos: ['PE'], ovr: 71 },
      { name: 'Cica', pos: ['MEI'], ovr: 70 },
    ]},
  { id: 'vasco1974', club: 'Vasco', year: 1974, label: 'Vasco 1974 (1o Brasileiro moderno)', coach: 'Mario Travaglini',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Andrada', pos: ['GOL'], ovr: 80 },
      { name: 'Fidelis', pos: ['LD'], ovr: 76 },
      { name: 'Miguel', pos: ['ZAG'], ovr: 78 },
      { name: 'Moises', pos: ['ZAG'], ovr: 79 },
      { name: 'Alfinete', pos: ['LE'], ovr: 77 },
      { name: 'Alcir', pos: ['VOL'], ovr: 78 },
      { name: 'Zanata', pos: ['VOL','MEI'], ovr: 79 },
      { name: 'Ademir', pos: ['MEI'], ovr: 79 },
      { name: 'Jorginho Carvoeiro', pos: ['PD','MEI'], ovr: 82 },
      { name: 'Roberto Dinamite', pos: ['ATA'], ovr: 88 },
      { name: 'Luiz Carlos', pos: ['PE'], ovr: 78 },
      { name: 'Carlos Henrique', pos: ['GOL'], ovr: 72 },
      { name: 'Paulo Cesar', pos: ['LD'], ovr: 74 },
      { name: 'Joel', pos: ['ZAG'], ovr: 74 },
      { name: 'Gaucho', pos: ['VOL'], ovr: 76 },
      { name: 'Jair Pereira', pos: ['PD'], ovr: 74 },
      { name: 'Amarildo', pos: ['ATA'], ovr: 76 },
      { name: 'Bill', pos: ['ATA'], ovr: 72 },
      { name: 'Galdino', pos: ['PE'], ovr: 73 },
      { name: 'Marcelo', pos: ['ZAG'], ovr: 72 },
    ]},
  { id: 'internacional1975', club: 'Internacional', year: 1975, label: 'Internacional 1975', coach: 'Rubens Minelli',
    colors: { p: '#d2122e', s: '#ffffff' },
    players: [
      { name: 'Manga', pos: ['GOL'], ovr: 83 },
      { name: 'Valdir', pos: ['LD'], ovr: 76 },
      { name: 'Figueroa', pos: ['ZAG'], ovr: 92 },
      { name: 'Herminio', pos: ['ZAG'], ovr: 77 },
      { name: 'Chico Fraga', pos: ['LE'], ovr: 76 },
      { name: 'Cacapava', pos: ['VOL'], ovr: 79 },
      { name: 'Falcao', pos: ['MEI','VOL'], ovr: 90 },
      { name: 'Carpegiani', pos: ['MEI','VOL'], ovr: 83 },
      { name: 'Valdomiro', pos: ['PD','ATA'], ovr: 80 },
      { name: 'Flavio Minuano', pos: ['ATA'], ovr: 85 },
      { name: 'Lula', pos: ['PE'], ovr: 79 },
      { name: 'Tony', pos: ['LD'], ovr: 71 },
      { name: 'Belini', pos: ['ZAG'], ovr: 72 },
      { name: 'Jair', pos: ['PD','ATA'], ovr: 75 },
      { name: 'Escurinho', pos: ['ATA'], ovr: 73 },
      { name: 'Dario', pos: ['ATA'], ovr: 72 },
      { name: 'Batista', pos: ['VOL'], ovr: 77 },
      { name: 'Romano', pos: ['MEI'], ovr: 73 },
      { name: 'Duilio', pos: ['ATA'], ovr: 70 },
      { name: 'Darcy', pos: ['PE'], ovr: 70 },
    ]},
  { id: 'corinthians1977', club: 'Corinthians', year: 1977, label: 'Corinthians 1977', coach: 'Oswaldo Brandao',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Emerson', pos: ['GOL'], ovr: 78 },
      { name: 'Ze Maria', pos: ['LD'], ovr: 79 },
      { name: 'Geraldo', pos: ['ZAG'], ovr: 77 },
      { name: 'Macaranduba', pos: ['ZAG'], ovr: 76 },
      { name: 'Wladimir', pos: ['LE','MEI'], ovr: 81 },
      { name: 'Palinha', pos: ['VOL'], ovr: 80 },
      { name: 'Rivellino', pos: ['MEI'], ovr: 84 },
      { name: 'Zizinho Jr', pos: ['MEI'], ovr: 77 },
      { name: 'Ze Eduardo', pos: ['ATA'], ovr: 79 },
      { name: 'Basilio', pos: ['ATA','MEI'], ovr: 82 },
      { name: 'Biro-Biro', pos: ['PE'], ovr: 76 },
      { name: 'Renato', pos: ['GOL'], ovr: 71 },
      { name: 'Rodrigo', pos: ['LD'], ovr: 73 },
      { name: 'Eurico', pos: ['ZAG'], ovr: 72 },
      { name: 'Marco', pos: ['VOL'], ovr: 74 },
      { name: 'Lula', pos: ['MEI'], ovr: 75 },
      { name: 'Nene', pos: ['ATA'], ovr: 76 },
      { name: 'Sofocles', pos: ['PE'], ovr: 72 },
      { name: 'Cleber', pos: ['ATA'], ovr: 72 },
      { name: 'Toninho', pos: ['LD'], ovr: 71 },
    ]},
  { id: 'guarani1978', club: 'Guarani', year: 1978, label: 'Guarani 1978 (Unico titulo)', coach: 'Jair Pereira',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Manga', pos: ['GOL'], ovr: 80 },
      { name: 'Valber', pos: ['LD'], ovr: 76 },
      { name: 'Pedrinho', pos: ['ZAG'], ovr: 78 },
      { name: 'Macaranduba', pos: ['ZAG'], ovr: 77 },
      { name: 'Moraes', pos: ['LE'], ovr: 76 },
      { name: 'Djalma', pos: ['VOL'], ovr: 78 },
      { name: 'Juari', pos: ['VOL','MEI'], ovr: 80 },
      { name: 'Ronaldo', pos: ['MEI'], ovr: 78 },
      { name: 'Careca', pos: ['ATA'], ovr: 85 },
      { name: 'Paulo Cesar', pos: ['ATA','MEI'], ovr: 82 },
      { name: 'Leandro', pos: ['PE'], ovr: 78 },
      { name: 'Toninho', pos: ['GOL'], ovr: 71 },
      { name: 'Sergio', pos: ['LD'], ovr: 73 },
      { name: 'Leandro Jr', pos: ['ZAG'], ovr: 72 },
      { name: 'Mauro', pos: ['VOL'], ovr: 73 },
      { name: 'Ze Luis', pos: ['MEI'], ovr: 74 },
      { name: 'Roque', pos: ['ATA'], ovr: 75 },
      { name: 'Adriano', pos: ['PE'], ovr: 72 },
      { name: 'Alves', pos: ['ATA'], ovr: 72 },
      { name: 'Henrique', pos: ['LD'], ovr: 71 },
    ]},
  { id: 'internacional1979', club: 'Internacional', year: 1979, label: 'Internacional 1979 (Invicto)', coach: 'Enio Andrade',
    colors: { p: '#d2122e', s: '#ffffff' },
    players: [
      { name: 'Benitez', pos: ['GOL'], ovr: 82 },
      { name: 'Joao Carlos', pos: ['LD'], ovr: 76 },
      { name: 'Mauro Pastor', pos: ['ZAG'], ovr: 77 },
      { name: 'Mauro Galvao', pos: ['ZAG'], ovr: 84 },
      { name: 'Claudio Mineiro', pos: ['LE'], ovr: 76 },
      { name: 'Batista', pos: ['VOL'], ovr: 80 },
      { name: 'Falcao', pos: ['MEI','VOL'], ovr: 93 },
      { name: 'Jair', pos: ['MEI','VOL'], ovr: 82 },
      { name: 'Valdomiro', pos: ['PD'], ovr: 79 },
      { name: 'Bira', pos: ['ATA'], ovr: 78 },
      { name: 'Mario Sergio', pos: ['PE','ATA'], ovr: 80 },
      { name: 'Chico Spina', pos: ['ATA'], ovr: 76 },
      { name: 'Beliato', pos: ['ZAG'], ovr: 72 },
      { name: 'Larry', pos: ['ZAG'], ovr: 71 },
      { name: 'Toninho', pos: ['VOL'], ovr: 72 },
      { name: 'Claudiomir', pos: ['LD'], ovr: 71 },
      { name: 'Gilberto', pos: ['PE'], ovr: 70 },
      { name: 'Lula', pos: ['PE','ATA'], ovr: 74 },
      { name: 'Marcos', pos: ['MEI'], ovr: 71 },
      { name: 'Renato', pos: ['ATA'], ovr: 70 },
    ]},
  { id: 'flamengo1980', club: 'Flamengo', year: 1980, label: 'Flamengo 1980', coach: 'Claudio Coutinho',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Raul', pos: ['GOL'], ovr: 84 },
      { name: 'Toninho', pos: ['LD'], ovr: 78 },
      { name: 'Rondinelli', pos: ['ZAG'], ovr: 79 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 82 },
      { name: 'Junior', pos: ['LE','PE'], ovr: 91 },
      { name: 'Andrade', pos: ['VOL'], ovr: 86 },
      { name: 'Carpegiani', pos: ['MEI'], ovr: 81 },
      { name: 'Zico', pos: ['MEI'], ovr: 97 },
      { name: 'Tita', pos: ['PD'], ovr: 83 },
      { name: 'Nunes', pos: ['ATA'], ovr: 85 },
      { name: 'Julio Cesar', pos: ['PE'], ovr: 78 },
      { name: 'Cantarelli', pos: ['GOL'], ovr: 70 },
      { name: 'Nei Dias', pos: ['LD'], ovr: 72 },
      { name: 'Figueiredo', pos: ['ZAG'], ovr: 78 },
      { name: 'Vitor', pos: ['VOL'], ovr: 74 },
      { name: 'Lico', pos: ['PD','ATA'], ovr: 79 },
      { name: 'Peu', pos: ['ATA'], ovr: 75 },
      { name: 'Anselmo', pos: ['ATA'], ovr: 71 },
      { name: 'Carlos Henrique', pos: ['ATA'], ovr: 76 },
      { name: 'Barao', pos: ['MEI'], ovr: 73 },
    ]},
  { id: 'flamengo1981', club: 'Flamengo', year: 1981, label: 'Flamengo 1981 (Libertadores + Mundial)', coach: 'Paulo Cesar Carpegiani',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Raul', pos: ['GOL'], ovr: 85 },
      { name: 'Leandro', pos: ['LD','PD'], ovr: 88 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 82 },
      { name: 'Mozer', pos: ['ZAG'], ovr: 85 },
      { name: 'Junior', pos: ['LE','PE'], ovr: 92 },
      { name: 'Andrade', pos: ['VOL'], ovr: 87 },
      { name: 'Adilio', pos: ['MEI'], ovr: 84 },
      { name: 'Zico', pos: ['MEI'], ovr: 98 },
      { name: 'Lico', pos: ['PD','ATA'], ovr: 80 },
      { name: 'Tita', pos: ['ATA','PD'], ovr: 84 },
      { name: 'Nunes', pos: ['PE','ATA'], ovr: 87 },
      { name: 'Cantarelli', pos: ['GOL'], ovr: 70 },
      { name: 'Nei Dias', pos: ['LD'], ovr: 72 },
      { name: 'Figueiredo', pos: ['ZAG'], ovr: 78 },
      { name: 'Vitor', pos: ['VOL'], ovr: 74 },
      { name: 'Baroninho', pos: ['MEI'], ovr: 73 },
      { name: 'Carlos Henrique', pos: ['ATA'], ovr: 76 },
      { name: 'Paulo Cesar', pos: ['ATA'], ovr: 73 },
      { name: 'Pirilo', pos: ['ZAG'], ovr: 71 },
      { name: 'Eduardo', pos: ['PE'], ovr: 71 },
    ]},
  { id: 'flamengo1982', club: 'Flamengo', year: 1982, label: 'Flamengo 1982 (Tricampeonato)', coach: 'Paulo Cesar Carpegiani',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Raul', pos: ['GOL'], ovr: 84 },
      { name: 'Leandro', pos: ['LD','PD'], ovr: 87 },
      { name: 'Marinho', pos: ['ZAG'], ovr: 81 },
      { name: 'Figueiredo', pos: ['ZAG'], ovr: 78 },
      { name: 'Junior', pos: ['LE','PE'], ovr: 91 },
      { name: 'Andrade', pos: ['VOL'], ovr: 86 },
      { name: 'Adilio', pos: ['MEI'], ovr: 84 },
      { name: 'Zico', pos: ['MEI'], ovr: 97 },
      { name: 'Tita', pos: ['PD','ATA'], ovr: 82 },
      { name: 'Lico', pos: ['ATA','PD'], ovr: 79 },
      { name: 'Nunes', pos: ['PE','ATA'], ovr: 87 },
      { name: 'Cantarelli', pos: ['GOL'], ovr: 70 },
      { name: 'Mozer', pos: ['ZAG'], ovr: 83 },
      { name: 'Vitor', pos: ['VOL'], ovr: 74 },
      { name: 'Chiquinho Carioca', pos: ['ATA'], ovr: 75 },
      { name: 'Anselmo', pos: ['ATA'], ovr: 71 },
      { name: 'Carlos Henrique', pos: ['ATA'], ovr: 76 },
      { name: 'Nei Dias', pos: ['LD'], ovr: 72 },
      { name: 'Jose Carlos', pos: ['LD'], ovr: 71 },
      { name: 'Eduardo', pos: ['PE'], ovr: 71 },
    ]},
  { id: 'fluminense1984', club: 'Fluminense', year: 1984, label: 'Fluminense 1984 (Maquina Tricolor)', coach: 'Carlos Alberto Parreira',
    colors: { p: '#7a1e3c', s: '#006437' },
    players: [
      { name: 'Paulo Vitor', pos: ['GOL'], ovr: 81 },
      { name: 'Aldo', pos: ['LD'], ovr: 77 },
      { name: 'Duilio', pos: ['ZAG'], ovr: 80 },
      { name: 'Ricardo Gomes', pos: ['ZAG'], ovr: 88 },
      { name: 'Branco', pos: ['LE','PE'], ovr: 87 },
      { name: 'Jandir', pos: ['VOL'], ovr: 78 },
      { name: 'Delei', pos: ['MEI'], ovr: 79 },
      { name: 'Romerito', pos: ['MEI','VOL'], ovr: 86 },
      { name: 'Assis', pos: ['PD'], ovr: 83 },
      { name: 'Washington', pos: ['ATA'], ovr: 82 },
      { name: 'Tato', pos: ['PE'], ovr: 80 },
      { name: 'Ricardo Lopes', pos: ['LD'], ovr: 73 },
      { name: 'Renato Martins', pos: ['LE'], ovr: 74 },
      { name: 'Vica', pos: ['MEI'], ovr: 73 },
      { name: 'Leomir', pos: ['MEI'], ovr: 75 },
      { name: 'Wilsinho', pos: ['PD'], ovr: 74 },
      { name: 'Paulinho', pos: ['ATA'], ovr: 73 },
      { name: 'Getulio', pos: ['LD'], ovr: 72 },
      { name: 'Fernando', pos: ['ZAG'], ovr: 71 },
      { name: 'Ivan', pos: ['VOL'], ovr: 70 },
    ]},
  { id: 'coritiba1985', club: 'Coritiba', year: 1985, label: 'Coritiba 1985 (Unico titulo)', coach: 'Enio Andrade',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Rafael', pos: ['GOL'], ovr: 83 },
      { name: 'Andre', pos: ['LD'], ovr: 76 },
      { name: 'Gomes', pos: ['ZAG'], ovr: 79 },
      { name: 'Heraldo', pos: ['ZAG'], ovr: 78 },
      { name: 'Dida', pos: ['LE'], ovr: 76 },
      { name: 'Almir', pos: ['VOL'], ovr: 78 },
      { name: 'Marildo', pos: ['MEI'], ovr: 76 },
      { name: 'Tobi', pos: ['MEI'], ovr: 79 },
      { name: 'Lela', pos: ['PD'], ovr: 80 },
      { name: 'Indio', pos: ['ATA'], ovr: 81 },
      { name: 'Edson', pos: ['PE'], ovr: 78 },
      { name: 'Vava', pos: ['ZAG'], ovr: 72 },
      { name: 'Marco Aurelio', pos: ['VOL'], ovr: 73 },
      { name: 'Eliseu', pos: ['LD'], ovr: 71 },
      { name: 'Heldo', pos: ['MEI'], ovr: 72 },
      { name: 'Jardel', pos: ['ATA'], ovr: 74 },
      { name: 'Delmo', pos: ['ZAG'], ovr: 71 },
      { name: 'Rene', pos: ['VOL'], ovr: 70 },
      { name: 'Albuquerque', pos: ['PE'], ovr: 71 },
      { name: 'Neto Cida', pos: ['GOL'], ovr: 70 },
    ]},
  { id: 'sao-paulo1986', club: 'Sao Paulo', year: 1986, label: 'Sao Paulo 1986', coach: 'Pepe',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Gilmar', pos: ['GOL'], ovr: 82 },
      { name: 'Fonseca', pos: ['LD'], ovr: 77 },
      { name: 'Wagner Basilio', pos: ['ZAG'], ovr: 78 },
      { name: 'Dario Pereyra', pos: ['ZAG'], ovr: 83 },
      { name: 'Nelsinho', pos: ['LE'], ovr: 78 },
      { name: 'Bernardo', pos: ['VOL'], ovr: 79 },
      { name: 'Silas', pos: ['MEI'], ovr: 82 },
      { name: 'Pita', pos: ['MEI'], ovr: 84 },
      { name: 'Muller', pos: ['PD'], ovr: 88 },
      { name: 'Careca', pos: ['ATA'], ovr: 92 },
      { name: 'Sidney', pos: ['PE','ATA'], ovr: 81 },
      { name: 'Oscar', pos: ['ZAG'], ovr: 80 },
      { name: 'Falcao', pos: ['MEI'], ovr: 82 },
      { name: 'Marcio Araujo', pos: ['MEI'], ovr: 74 },
      { name: 'Ze Teodoro', pos: ['LD'], ovr: 74 },
      { name: 'Romulo', pos: ['ATA'], ovr: 73 },
      { name: 'Pianelli', pos: ['ATA'], ovr: 72 },
      { name: 'Roberto', pos: ['LE'], ovr: 71 },
      { name: 'Mauro', pos: ['VOL'], ovr: 71 },
      { name: 'Helio', pos: ['PD'], ovr: 70 },
    ]},
  { id: 'sport1987', club: 'Sport', year: 1987, label: 'Sport 1987 (Unico titulo)', coach: 'Emerson Leao',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Flavio', pos: ['GOL'], ovr: 78 },
      { name: 'Betao', pos: ['LD'], ovr: 75 },
      { name: 'Estevam', pos: ['ZAG'], ovr: 77 },
      { name: 'Marco Antonio', pos: ['ZAG'], ovr: 78 },
      { name: 'Ze Carlos Macae', pos: ['LE'], ovr: 76 },
      { name: 'Rogerio', pos: ['VOL'], ovr: 76 },
      { name: 'Ribamar', pos: ['MEI'], ovr: 76 },
      { name: 'Zico Sport', pos: ['MEI'], ovr: 77 },
      { name: 'Robertinho', pos: ['PD'], ovr: 77 },
      { name: 'Nando', pos: ['ATA'], ovr: 78 },
      { name: 'Neco', pos: ['PE'], ovr: 78 },
      { name: 'Sidmar', pos: ['GOL'], ovr: 72 },
      { name: 'Augusto', pos: ['VOL'], ovr: 72 },
      { name: 'Saulo', pos: ['ZAG'], ovr: 71 },
      { name: 'Paulo Roberto', pos: ['LD'], ovr: 71 },
      { name: 'Leandro', pos: ['MEI'], ovr: 73 },
      { name: 'Chiquinho', pos: ['VOL'], ovr: 70 },
      { name: 'Claudio', pos: ['ATA'], ovr: 73 },
      { name: 'Ze Carlos Jr', pos: ['LE'], ovr: 70 },
      { name: 'Marcos', pos: ['PD'], ovr: 71 },
    ]},
  { id: 'bahia1988', club: 'Bahia', year: 1988, label: 'Bahia 1988 (Unico titulo)', coach: 'Evaristo de Macedo',
    colors: { p: '#1c3f94', s: '#c8102e' },
    players: [
      { name: 'Ronaldo', pos: ['GOL'], ovr: 80 },
      { name: 'Tarantini', pos: ['LD'], ovr: 77 },
      { name: 'Joao Marcelo', pos: ['ZAG'], ovr: 78 },
      { name: 'Claudir', pos: ['ZAG'], ovr: 76 },
      { name: 'Edinho', pos: ['LE'], ovr: 76 },
      { name: 'Paulo Rodrigues', pos: ['VOL'], ovr: 81 },
      { name: 'Ze Carlos', pos: ['MEI'], ovr: 80 },
      { name: 'Bobo', pos: ['MEI'], ovr: 86 },
      { name: 'Osmar', pos: ['PD'], ovr: 77 },
      { name: 'Charles', pos: ['ATA'], ovr: 84 },
      { name: 'Marquinhos', pos: ['PE'], ovr: 79 },
      { name: 'Sidmar', pos: ['GOL'], ovr: 73 },
      { name: 'Zanata', pos: ['LD'], ovr: 74 },
      { name: 'Pereira', pos: ['ZAG'], ovr: 76 },
      { name: 'Paulo Robson', pos: ['LE'], ovr: 73 },
      { name: 'Gil Sergipano', pos: ['MEI'], ovr: 74 },
      { name: 'Renato', pos: ['ATA'], ovr: 75 },
      { name: 'Sandro', pos: ['ATA'], ovr: 72 },
      { name: 'Newmar', pos: ['ZAG'], ovr: 71 },
      { name: 'Dico', pos: ['ATA'], ovr: 70 },
    ]},
  { id: 'vasco1989', club: 'Vasco', year: 1989, label: 'Vasco 1989 (SeleVasco)', coach: 'Nelsinho Rosa',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Acacio', pos: ['GOL'], ovr: 81 },
      { name: 'Luis Carlos Winck', pos: ['LD'], ovr: 79 },
      { name: 'Marco Aurelio', pos: ['ZAG'], ovr: 79 },
      { name: 'Quinonez', pos: ['ZAG'], ovr: 80 },
      { name: 'Mazinho', pos: ['LE','VOL'], ovr: 84 },
      { name: 'Ze do Carmo', pos: ['VOL','MEI'], ovr: 78 },
      { name: 'Boiadeiro', pos: ['MEI'], ovr: 79 },
      { name: 'Bismarck', pos: ['MEI','PD'], ovr: 80 },
      { name: 'Bebeto', pos: ['PD','ATA'], ovr: 90 },
      { name: 'Sorato', pos: ['ATA'], ovr: 80 },
      { name: 'William', pos: ['PE'], ovr: 78 },
      { name: 'Celio Silva', pos: ['ZAG'], ovr: 73 },
      { name: 'Cassio', pos: ['LE'], ovr: 71 },
      { name: 'Andrade', pos: ['VOL'], ovr: 79 },
      { name: 'Tita', pos: ['MEI','ATA'], ovr: 78 },
      { name: 'Vivinho', pos: ['ATA'], ovr: 73 },
      { name: 'Tato', pos: ['PE'], ovr: 76 },
      { name: 'Paulinho', pos: ['LD'], ovr: 71 },
      { name: 'Rene', pos: ['ZAG'], ovr: 70 },
      { name: 'Alex', pos: ['MEI'], ovr: 70 },
    ]},
  { id: 'corinthians1990', club: 'Corinthians', year: 1990, label: 'Corinthians 1990', coach: 'Nelsinho Baptista',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Ronaldo', pos: ['GOL'], ovr: 80 },
      { name: 'Giba', pos: ['LD'], ovr: 77 },
      { name: 'Marcelo Djian', pos: ['ZAG'], ovr: 79 },
      { name: 'Guinei', pos: ['ZAG'], ovr: 76 },
      { name: 'Jacenir', pos: ['LE'], ovr: 76 },
      { name: 'Marcio', pos: ['VOL'], ovr: 78 },
      { name: 'Wilson Mano', pos: ['MEI','VOL'], ovr: 80 },
      { name: 'Neto', pos: ['MEI'], ovr: 89 },
      { name: 'Tupazinho', pos: ['PD','ATA'], ovr: 81 },
      { name: 'Fabinho', pos: ['ATA'], ovr: 77 },
      { name: 'Mauro', pos: ['PE'], ovr: 77 },
      { name: 'Ezequiel', pos: ['MEI'], ovr: 73 },
      { name: 'Paulo Sergio', pos: ['ATA'], ovr: 75 },
      { name: 'Dinei', pos: ['ATA'], ovr: 78 },
      { name: 'Sergio', pos: ['GOL'], ovr: 71 },
      { name: 'Antonio Carlos', pos: ['ZAG'], ovr: 73 },
      { name: 'Luisinho', pos: ['LD'], ovr: 71 },
      { name: 'Flavio', pos: ['MEI'], ovr: 72 },
      { name: 'Silvinho', pos: ['LE'], ovr: 73 },
      { name: 'Josemil', pos: ['ATA'], ovr: 70 },
    ]},
  { id: 'sao-paulo1991', club: 'Sao Paulo', year: 1991, label: 'Sao Paulo 1991 (Brasileiro)', coach: 'Tele Santana',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Zetti', pos: ['GOL'], ovr: 83 },
      { name: 'Cafu', pos: ['LD','PD'], ovr: 87 },
      { name: 'Antonio Carlos', pos: ['ZAG'], ovr: 84 },
      { name: 'Ricardo Rocha', pos: ['ZAG'], ovr: 85 },
      { name: 'Leonardo', pos: ['LE'], ovr: 86 },
      { name: 'Ronaldao', pos: ['VOL'], ovr: 78 },
      { name: 'Bernardo', pos: ['MEI'], ovr: 80 },
      { name: 'Rai', pos: ['MEI','PD'], ovr: 93 },
      { name: 'Muller', pos: ['PD','ATA'], ovr: 87 },
      { name: 'Macedo', pos: ['ATA'], ovr: 78 },
      { name: 'Elvelton', pos: ['PE'], ovr: 77 },
      { name: 'Ze Teodoro', pos: ['LD'], ovr: 73 },
      { name: 'Sidnei', pos: ['VOL'], ovr: 73 },
      { name: 'Suelio', pos: ['VOL'], ovr: 72 },
      { name: 'Mario Tilico', pos: ['ATA'], ovr: 75 },
      { name: 'Flavio', pos: ['ATA'], ovr: 73 },
      { name: 'Guga', pos: ['ZAG'], ovr: 71 },
      { name: 'Celso', pos: ['MEI'], ovr: 72 },
      { name: 'Paulo Sergio', pos: ['PE'], ovr: 72 },
      { name: 'Helio', pos: ['LD'], ovr: 70 },
    ]},
  { id: 'flamengo1992', club: 'Flamengo', year: 1992, label: 'Flamengo 1992', coach: 'Nelsinho Baptista',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Ze Carlos', pos: ['GOL'], ovr: 80 },
      { name: 'Leandro', pos: ['LD','PD'], ovr: 82 },
      { name: 'Carlos', pos: ['ZAG'], ovr: 76 },
      { name: 'Chico Anysio', pos: ['ZAG'], ovr: 75 },
      { name: 'Junior', pos: ['LE','PE'], ovr: 80 },
      { name: 'Marquinhos', pos: ['VOL'], ovr: 78 },
      { name: 'Djalminha', pos: ['MEI'], ovr: 84 },
      { name: 'Fabio Baiano', pos: ['MEI'], ovr: 80 },
      { name: 'Savio', pos: ['PD','ATA'], ovr: 82 },
      { name: 'Paulo Nunes', pos: ['ATA'], ovr: 80 },
      { name: 'Marcelinho Carioca', pos: ['MEI'], ovr: 82 },
      { name: 'Nelio', pos: ['MEI'], ovr: 77 },
      { name: 'Luis Antonio', pos: ['MEI'], ovr: 76 },
      { name: 'Tita', pos: ['ATA','MEI'], ovr: 75 },
      { name: 'William', pos: ['ATA'], ovr: 73 },
      { name: 'Pia', pos: ['LE'], ovr: 73 },
      { name: 'Sele', pos: ['LE'], ovr: 71 },
      { name: 'Edinho', pos: ['PE'], ovr: 72 },
      { name: 'Celso', pos: ['VOL'], ovr: 70 },
      { name: 'Reginaldo Araujo', pos: ['ATA'], ovr: 72 },
    ]},
  { id: 'palmeiras1993', club: 'Palmeiras', year: 1993, label: 'Palmeiras 1993 (Parmalat)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Sergio', pos: ['GOL'], ovr: 81 },
      { name: 'Claudio', pos: ['LD'], ovr: 77 },
      { name: 'Antonio Carlos', pos: ['ZAG'], ovr: 85 },
      { name: 'Cleber', pos: ['ZAG'], ovr: 78 },
      { name: 'Roberto Carlos', pos: ['LE','PE'], ovr: 89 },
      { name: 'Cesar Sampaio', pos: ['VOL'], ovr: 84 },
      { name: 'Mazinho', pos: ['VOL','LE'], ovr: 80 },
      { name: 'Zinho', pos: ['MEI','PD'], ovr: 85 },
      { name: 'Edilson', pos: ['PD','ATA'], ovr: 81 },
      { name: 'Edmundo', pos: ['ATA'], ovr: 90 },
      { name: 'Evair', pos: ['PE','ATA'], ovr: 86 },
      { name: 'Velloso', pos: ['GOL'], ovr: 74 },
      { name: 'Tonhao', pos: ['ZAG'], ovr: 73 },
      { name: 'Daniel Frasson', pos: ['VOL'], ovr: 74 },
      { name: 'Amaral', pos: ['VOL'], ovr: 72 },
      { name: 'Maurilio', pos: ['ATA'], ovr: 73 },
      { name: 'Jean Carlo', pos: ['MEI'], ovr: 73 },
      { name: 'Soares', pos: ['ATA'], ovr: 72 },
      { name: 'Dario', pos: ['LD'], ovr: 71 },
      { name: 'Paulo Victor', pos: ['ZAG'], ovr: 70 },
    ]},
  { id: 'palmeiras1994', club: 'Palmeiras', year: 1994, label: 'Palmeiras 1994 (Parmalat)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Sergio', pos: ['GOL'], ovr: 81 },
      { name: 'Claudio', pos: ['LD'], ovr: 77 },
      { name: 'Antonio Carlos', pos: ['ZAG'], ovr: 85 },
      { name: 'Cleber', pos: ['ZAG'], ovr: 78 },
      { name: 'Roberto Carlos', pos: ['LE','PE'], ovr: 90 },
      { name: 'Cesar Sampaio', pos: ['VOL'], ovr: 85 },
      { name: 'Mazinho', pos: ['VOL','LE'], ovr: 80 },
      { name: 'Zinho', pos: ['MEI','PD'], ovr: 85 },
      { name: 'Rivaldo', pos: ['PD','MEI'], ovr: 89 },
      { name: 'Edmundo', pos: ['ATA'], ovr: 91 },
      { name: 'Evair', pos: ['PE','ATA'], ovr: 86 },
      { name: 'Velloso', pos: ['GOL'], ovr: 74 },
      { name: 'Tonhao', pos: ['ZAG'], ovr: 73 },
      { name: 'Daniel Frasson', pos: ['VOL'], ovr: 74 },
      { name: 'Flavio Conceicao', pos: ['VOL'], ovr: 77 },
      { name: 'Edilson', pos: ['PD','ATA'], ovr: 81 },
      { name: 'Soares', pos: ['ATA'], ovr: 72 },
      { name: 'Jean Carlo', pos: ['MEI'], ovr: 73 },
      { name: 'Nali', pos: ['LD'], ovr: 70 },
      { name: 'Ciro', pos: ['ZAG'], ovr: 70 },
    ]},
  { id: 'botafogo1995', club: 'Botafogo', year: 1995, label: 'Botafogo 1995', coach: 'Paulo Autuori',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Wagner', pos: ['GOL'], ovr: 81 },
      { name: 'Wilson Goiano', pos: ['LD'], ovr: 77 },
      { name: 'Wilson Gottardo', pos: ['ZAG'], ovr: 80 },
      { name: 'Goncalves', pos: ['ZAG'], ovr: 79 },
      { name: 'Andre Silva', pos: ['LE'], ovr: 76 },
      { name: 'Leandro Avila', pos: ['VOL'], ovr: 78 },
      { name: 'Jamir', pos: ['VOL','MEI'], ovr: 78 },
      { name: 'Beto', pos: ['MEI','VOL'], ovr: 77 },
      { name: 'Sergio Manoel', pos: ['MEI','PD'], ovr: 80 },
      { name: 'Donizete', pos: ['ATA'], ovr: 81 },
      { name: 'Tulio Maravilha', pos: ['ATA'], ovr: 89 },
      { name: 'Moises', pos: ['LE'], ovr: 72 },
      { name: 'Iranildo', pos: ['MEI'], ovr: 75 },
      { name: 'Marcelo Alves', pos: ['MEI'], ovr: 72 },
      { name: 'Narcizio', pos: ['ATA'], ovr: 71 },
      { name: 'Rui', pos: ['ATA'], ovr: 71 },
      { name: 'Marcio', pos: ['LD'], ovr: 71 },
      { name: 'Claudinho', pos: ['ZAG'], ovr: 70 },
      { name: 'Jorginho', pos: ['MEI'], ovr: 71 },
      { name: 'Alan', pos: ['PE'], ovr: 70 },
    ]},
  { id: 'gremio1996', club: 'Gremio', year: 1996, label: 'Gremio 1996', coach: 'Luiz Felipe Scolari',
    colors: { p: '#1c3f94', s: '#000000' },
    players: [
      { name: 'Danrlei', pos: ['GOL'], ovr: 82 },
      { name: 'Arce', pos: ['LD','PD'], ovr: 81 },
      { name: 'Rivarola', pos: ['ZAG'], ovr: 79 },
      { name: 'Mauro Galvao', pos: ['ZAG'], ovr: 82 },
      { name: 'Roger', pos: ['LE'], ovr: 79 },
      { name: 'Dinho', pos: ['VOL','MEI'], ovr: 79 },
      { name: 'Luis Carlos Goiano', pos: ['VOL'], ovr: 78 },
      { name: 'Emerson', pos: ['MEI','VOL'], ovr: 82 },
      { name: 'Carlos Miguel', pos: ['MEI'], ovr: 79 },
      { name: 'Paulo Nunes', pos: ['ATA'], ovr: 87 },
      { name: 'Ze Alcino', pos: ['PE'], ovr: 78 },
      { name: 'Adilson', pos: ['ZAG'], ovr: 75 },
      { name: 'Luciano', pos: ['ZAG'], ovr: 73 },
      { name: 'Ailton', pos: ['ATA'], ovr: 76 },
      { name: 'Ze Afonso', pos: ['ATA'], ovr: 72 },
      { name: 'Arilson', pos: ['MEI'], ovr: 73 },
      { name: 'Helio', pos: ['LD'], ovr: 71 },
      { name: 'Marcelo', pos: ['PE'], ovr: 71 },
      { name: 'Marcio', pos: ['GOL'], ovr: 70 },
      { name: 'Jose Wilson', pos: ['ATA'], ovr: 70 },
    ]},
  { id: 'vasco1997', club: 'Vasco', year: 1997, label: 'Vasco 1997 (Brasileiro)', coach: 'Antonio Lopes',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Carlos Germano', pos: ['GOL'], ovr: 82 },
      { name: 'Valber', pos: ['LD'], ovr: 78 },
      { name: 'Odvan', pos: ['ZAG'], ovr: 79 },
      { name: 'Mauro Galvao', pos: ['ZAG'], ovr: 81 },
      { name: 'Felipe', pos: ['LE'], ovr: 80 },
      { name: 'Luisinho', pos: ['VOL','MEI'], ovr: 79 },
      { name: 'Nasa', pos: ['VOL','MEI'], ovr: 78 },
      { name: 'Juninho Pernambucano', pos: ['MEI','PD'], ovr: 85 },
      { name: 'Ramon', pos: ['MEI','PD'], ovr: 81 },
      { name: 'Edmundo', pos: ['ATA'], ovr: 95 },
      { name: 'Evair', pos: ['PE','ATA'], ovr: 85 },
      { name: 'Marica', pos: ['LD'], ovr: 73 },
      { name: 'Alex Pinho', pos: ['ZAG'], ovr: 72 },
      { name: 'Pedrinho', pos: ['MEI'], ovr: 77 },
      { name: 'Mauricinho', pos: ['MEI'], ovr: 72 },
      { name: 'Donizete', pos: ['ATA'], ovr: 79 },
      { name: 'Brener', pos: ['ATA'], ovr: 73 },
      { name: 'Luizao', pos: ['ATA'], ovr: 80 },
      { name: 'Gil', pos: ['ZAG'], ovr: 71 },
      { name: 'Sandro', pos: ['MEI'], ovr: 70 },
    ]},
  { id: 'vasco1998', club: 'Vasco', year: 1998, label: 'Vasco 1998 (Libertadores)', coach: 'Antonio Lopes',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Carlos Germano', pos: ['GOL'], ovr: 83 },
      { name: 'Vagner', pos: ['LD'], ovr: 79 },
      { name: 'Mauro Galvao', pos: ['ZAG'], ovr: 82 },
      { name: 'Odvan', pos: ['ZAG'], ovr: 80 },
      { name: 'Felipe', pos: ['LE'], ovr: 81 },
      { name: 'Luisinho', pos: ['VOL','MEI'], ovr: 80 },
      { name: 'Nasa', pos: ['VOL','MEI'], ovr: 79 },
      { name: 'Juninho Pernambucano', pos: ['MEI','PD'], ovr: 87 },
      { name: 'Pedrinho', pos: ['MEI'], ovr: 80 },
      { name: 'Edmundo', pos: ['ATA'], ovr: 91 },
      { name: 'Luizao', pos: ['ATA'], ovr: 87 },
      { name: 'Donizete', pos: ['ATA'], ovr: 84 },
      { name: 'Evair', pos: ['PE','ATA'], ovr: 83 },
      { name: 'Ramon', pos: ['MEI','PD'], ovr: 82 },
      { name: 'Cesar Prates', pos: ['LD'], ovr: 77 },
      { name: 'Alex Pinho', pos: ['ZAG'], ovr: 73 },
      { name: 'Paulo', pos: ['VOL'], ovr: 72 },
      { name: 'Valdir', pos: ['LD'], ovr: 71 },
      { name: 'Lima', pos: ['MEI'], ovr: 71 },
      { name: 'Clayton', pos: ['ATA'], ovr: 72 },
    ]},
  { id: 'corinthians1998', club: 'Corinthians', year: 1998, label: 'Corinthians 1998 (Bicampeao)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Nei', pos: ['GOL'], ovr: 77 },
      { name: 'Dida', pos: ['GOL'], ovr: 86 },
      { name: 'Indio', pos: ['LD'], ovr: 80 },
      { name: 'Batata', pos: ['ZAG'], ovr: 79 },
      { name: 'Marcio Costa', pos: ['ZAG'], ovr: 78 },
      { name: 'Gamarra', pos: ['ZAG'], ovr: 92 },
      { name: 'Sylvinho', pos: ['LE','PE'], ovr: 85 },
      { name: 'Vampeta', pos: ['VOL'], ovr: 88 },
      { name: 'Rincon', pos: ['MEI'], ovr: 87 },
      { name: 'Ricardinho', pos: ['MEI'], ovr: 88 },
      { name: 'Marcelinho Carioca', pos: ['MEI'], ovr: 91 },
      { name: 'Edilson', pos: ['ATA','MEI'], ovr: 90 },
      { name: 'Dinei', pos: ['ATA'], ovr: 78 },
      { name: 'Didi', pos: ['ATA'], ovr: 75 },
      { name: 'Amaral', pos: ['VOL'], ovr: 76 },
      { name: 'Cris', pos: ['ZAG','LE'], ovr: 74 },
      { name: 'Adilson', pos: ['ZAG'], ovr: 73 },
      { name: 'Kleber', pos: ['LE'], ovr: 78 },
      { name: 'Mirandinha', pos: ['ATA'], ovr: 74 },
      { name: 'Gilmar Fuba', pos: ['VOL'], ovr: 76 },
    ]},
  { id: 'corinthians1999', club: 'Corinthians', year: 1999, label: 'Corinthians 1999 (Tricampeao)', coach: 'Oswaldo de Oliveira',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Dida', pos: ['GOL'], ovr: 88 },
      { name: 'Indio', pos: ['LD'], ovr: 80 },
      { name: 'Joao Carlos', pos: ['ZAG'], ovr: 79 },
      { name: 'Marcio Costa', pos: ['ZAG'], ovr: 79 },
      { name: 'Kleber', pos: ['LE'], ovr: 79 },
      { name: 'Vampeta', pos: ['VOL'], ovr: 89 },
      { name: 'Rincon', pos: ['MEI'], ovr: 87 },
      { name: 'Ricardinho', pos: ['MEI'], ovr: 88 },
      { name: 'Marcelinho Carioca', pos: ['MEI'], ovr: 92 },
      { name: 'Edilson', pos: ['ATA','MEI'], ovr: 89 },
      { name: 'Luizao', pos: ['ATA'], ovr: 87 },
      { name: 'Dinei', pos: ['ATA'], ovr: 79 },
      { name: 'Marcos Senna', pos: ['VOL'], ovr: 81 },
      { name: 'Sylvinho', pos: ['LE','PE'], ovr: 86 },
      { name: 'Adilson', pos: ['ZAG'], ovr: 74 },
      { name: 'Gilmar', pos: ['VOL'], ovr: 75 },
      { name: 'Edu', pos: ['MEI'], ovr: 75 },
      { name: 'Fabinho', pos: ['ZAG'], ovr: 73 },
      { name: 'Luis Carlos', pos: ['PD'], ovr: 72 },
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
      { name: 'Ramon', pos: ['MEI','PD'], ovr: 82 },
      { name: 'Juninho Paulista', pos: ['MEI'], ovr: 84 },
      { name: 'Pedrinho', pos: ['MEI'], ovr: 80 },
      { name: 'Luizao', pos: ['ATA'], ovr: 86 },
      { name: 'Donizete', pos: ['ATA'], ovr: 84 },
      { name: 'Romario', pos: ['ATA'], ovr: 91 },
      { name: 'Sandro', pos: ['GOL'], ovr: 71 },
      { name: 'Valdir', pos: ['LD'], ovr: 73 },
      { name: 'Mauro Galvao', pos: ['ZAG'], ovr: 79 },
      { name: 'Everton', pos: ['ATA'], ovr: 73 },
      { name: 'Nasa', pos: ['VOL'], ovr: 77 },
      { name: 'Nilton', pos: ['VOL'], ovr: 76 },
      { name: 'Paulo Victor', pos: ['MEI'], ovr: 74 },
      { name: 'Alexandre Pires', pos: ['ATA'], ovr: 75 },
      { name: 'Fabio Augusto', pos: ['LD'], ovr: 72 },
    ]},
  { id: 'athletico-pr2001', club: 'Athletico-PR', year: 2001, label: 'Athletico-PR 2001', coach: 'Geninho',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Flavio', pos: ['GOL'], ovr: 80 },
      { name: 'Alessandro', pos: ['LD'], ovr: 78 },
      { name: 'Rogerio Correa', pos: ['ZAG'], ovr: 78 },
      { name: 'Nem', pos: ['ZAG'], ovr: 79 },
      { name: 'Gustavo', pos: ['ZAG'], ovr: 80 },
      { name: 'Fabiano', pos: ['LE'], ovr: 77 },
      { name: 'Cocito', pos: ['VOL'], ovr: 78 },
      { name: 'Kleberson', pos: ['VOL','MEI'], ovr: 86 },
      { name: 'Adriano', pos: ['MEI'], ovr: 79 },
      { name: 'Kleber', pos: ['ATA'], ovr: 84 },
      { name: 'Alex Mineiro', pos: ['ATA'], ovr: 85 },
      { name: 'Igor', pos: ['LD'], ovr: 73 },
      { name: 'Pires', pos: ['MEI'], ovr: 72 },
      { name: 'Rodriguinho', pos: ['MEI'], ovr: 71 },
      { name: 'Souza', pos: ['ATA'], ovr: 74 },
      { name: 'Ilan', pos: ['ATA'], ovr: 73 },
      { name: 'Adauto', pos: ['ATA'], ovr: 72 },
      { name: 'Marcos', pos: ['ZAG'], ovr: 71 },
      { name: 'Ederson', pos: ['MEI'], ovr: 72 },
      { name: 'Chico', pos: ['LD'], ovr: 71 },
    ]},
  { id: 'santos2002', club: 'Santos', year: 2002, label: 'Santos 2002 (Meninos da Vila)', coach: 'Emerson Leao',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Fabio Costa', pos: ['GOL'], ovr: 81 },
      { name: 'Maurinho', pos: ['LD'], ovr: 78 },
      { name: 'Andre Luis', pos: ['ZAG'], ovr: 77 },
      { name: 'Alex', pos: ['ZAG'], ovr: 78 },
      { name: 'Leo', pos: ['LE'], ovr: 79 },
      { name: 'Paulo Almeida', pos: ['VOL'], ovr: 77 },
      { name: 'Renato', pos: ['VOL','MEI'], ovr: 78 },
      { name: 'Elano', pos: ['MEI'], ovr: 84 },
      { name: 'Diego', pos: ['MEI','PD'], ovr: 85 },
      { name: 'Robinho', pos: ['ATA','PE'], ovr: 92 },
      { name: 'William', pos: ['PE'], ovr: 76 },
      { name: 'Julio Cesar', pos: ['GOL'], ovr: 73 },
      { name: 'Wellington', pos: ['MEI'], ovr: 72 },
      { name: 'Alexandre', pos: ['ATA'], ovr: 73 },
      { name: 'Robert', pos: ['ATA'], ovr: 74 },
      { name: 'Michel', pos: ['ATA'], ovr: 71 },
      { name: 'Adriano', pos: ['ZAG'], ovr: 73 },
      { name: 'Felipe', pos: ['LD'], ovr: 72 },
      { name: 'Marcos', pos: ['VOL'], ovr: 71 },
      { name: 'Junior', pos: ['MEI'], ovr: 70 },
    ]},
  { id: 'cruzeiro2003', club: 'Cruzeiro', year: 2003, label: 'Cruzeiro 2003 (Triplice Coroa)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#1c3f94', s: '#ffffff' },
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
      { name: 'Aristizabal', pos: ['ATA'], ovr: 82 },
      { name: 'Mota', pos: ['ATA'], ovr: 79 },
      { name: 'Maicon', pos: ['LD'], ovr: 76 },
      { name: 'Luisao', pos: ['ZAG'], ovr: 79 },
      { name: 'Felipe Melo', pos: ['VOL'], ovr: 78 },
      { name: 'Zinho', pos: ['MEI'], ovr: 73 },
      { name: 'Marcio Nobre', pos: ['ATA'], ovr: 75 },
      { name: 'Deivid', pos: ['ATA'], ovr: 78 },
      { name: 'Alex Alves', pos: ['ATA'], ovr: 74 },
      { name: 'Martinez', pos: ['MEI'], ovr: 73 },
      { name: 'Thiago', pos: ['ZAG'], ovr: 75 },
    ]},
  { id: 'santos2004', club: 'Santos', year: 2004, label: 'Santos 2004 (Bicampeonato + 103 gols)', coach: 'Vanderlei Luxemburgo',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Mauro', pos: ['GOL'], ovr: 78 },
      { name: 'Flavio', pos: ['LD'], ovr: 75 },
      { name: 'Avaulos', pos: ['ZAG'], ovr: 77 },
      { name: 'Leonardo', pos: ['ZAG'], ovr: 77 },
      { name: 'Leo', pos: ['LE'], ovr: 79 },
      { name: 'Fabinho', pos: ['VOL'], ovr: 77 },
      { name: 'Preto Casagrande', pos: ['VOL','MEI'], ovr: 76 },
      { name: 'Ricardinho', pos: ['MEI'], ovr: 84 },
      { name: 'Elano', pos: ['MEI'], ovr: 85 },
      { name: 'Robinho', pos: ['ATA','PE'], ovr: 91 },
      { name: 'Deivid', pos: ['ATA'], ovr: 84 },
      { name: 'Paulo Cesar', pos: ['LD'], ovr: 73 },
      { name: 'Marcinho', pos: ['MEI'], ovr: 72 },
      { name: 'Basilio', pos: ['ATA'], ovr: 71 },
      { name: 'William', pos: ['ATA','PE'], ovr: 73 },
      { name: 'Adriano', pos: ['ZAG'], ovr: 73 },
      { name: 'Rodrigo', pos: ['LD'], ovr: 71 },
      { name: 'Gabriel', pos: ['ZAG'], ovr: 72 },
      { name: 'Marquinhos', pos: ['VOL'], ovr: 71 },
      { name: 'Adriano Jr', pos: ['ATA'], ovr: 70 },
    ]},
  { id: 'corinthians2005', club: 'Corinthians', year: 2005, label: 'Corinthians 2005', coach: 'Antonio Lopes',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Fabio Costa', pos: ['GOL'], ovr: 80 },
      { name: 'Marinho', pos: ['LD'], ovr: 76 },
      { name: 'Wendel', pos: ['ZAG'], ovr: 77 },
      { name: 'Betao', pos: ['ZAG'], ovr: 73 },
      { name: 'Gustavo Nery', pos: ['LE'], ovr: 80 },
      { name: 'Coelho', pos: ['ZAG'], ovr: 76 },
      { name: 'Marcelo Mattos', pos: ['VOL'], ovr: 79 },
      { name: 'Bruno Octavio', pos: ['VOL','MEI'], ovr: 76 },
      { name: 'Carlos Alberto', pos: ['MEI'], ovr: 81 },
      { name: 'Tevez', pos: ['ATA'], ovr: 93 },
      { name: 'Nilmar', pos: ['ATA'], ovr: 80 },
      { name: 'Julio Cesar', pos: ['GOL'], ovr: 74 },
      { name: 'Sebastian Dominguez', pos: ['ZAG'], ovr: 76 },
      { name: 'Mascherano', pos: ['VOL'], ovr: 86 },
      { name: 'Roger', pos: ['MEI'], ovr: 78 },
      { name: 'Jo', pos: ['ATA'], ovr: 76 },
      { name: 'Wescley', pos: ['MEI'], ovr: 72 },
      { name: 'Eduardo Ratinho', pos: ['MEI'], ovr: 71 },
      { name: 'Rodrigo', pos: ['LD'], ovr: 71 },
      { name: 'Rosinei', pos: ['MEI'], ovr: 77 },
    ]},
  { id: 'sao-paulo2006', club: 'Sao Paulo', year: 2006, label: 'Sao Paulo 2006', coach: 'Muricy Ramalho',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Rogerio Ceni', pos: ['GOL'], ovr: 89 },
      { name: 'Ilsinho', pos: ['LD','PD'], ovr: 78 },
      { name: 'Fabao', pos: ['ZAG'], ovr: 81 },
      { name: 'Miranda', pos: ['ZAG'], ovr: 82 },
      { name: 'Junior', pos: ['LE'], ovr: 77 },
      { name: 'Mineiro', pos: ['VOL'], ovr: 81 },
      { name: 'Josue', pos: ['VOL','MEI'], ovr: 80 },
      { name: 'Souza', pos: ['MEI'], ovr: 78 },
      { name: 'Danilo', pos: ['MEI'], ovr: 80 },
      { name: 'Leandro', pos: ['PD','PE'], ovr: 77 },
      { name: 'Aloisio', pos: ['ATA'], ovr: 81 },
      { name: 'Lugano', pos: ['ZAG'], ovr: 82 },
      { name: 'Alex Silva', pos: ['ZAG'], ovr: 73 },
      { name: 'Cicinho', pos: ['LD','PD'], ovr: 79 },
      { name: 'Thiago Ribeiro', pos: ['MEI'], ovr: 75 },
      { name: 'Richarlyson', pos: ['MEI'], ovr: 74 },
      { name: 'Lenilson', pos: ['ATA'], ovr: 73 },
      { name: 'Anderson', pos: ['ATA'], ovr: 72 },
      { name: 'Rodrigo', pos: ['LD'], ovr: 71 },
      { name: 'Edcarlos', pos: ['ZAG'], ovr: 76 },
    ]},
  { id: 'sao-paulo2007', club: 'Sao Paulo', year: 2007, label: 'Sao Paulo 2007 (Bicampeonato)', coach: 'Muricy Ramalho',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Rogerio Ceni', pos: ['GOL'], ovr: 89 },
      { name: 'Ilsinho', pos: ['LD','PD'], ovr: 78 },
      { name: 'Fabao', pos: ['ZAG'], ovr: 80 },
      { name: 'Miranda', pos: ['ZAG'], ovr: 84 },
      { name: 'Lugano', pos: ['ZAG'], ovr: 84 },
      { name: 'Junior', pos: ['LE'], ovr: 77 },
      { name: 'Mineiro', pos: ['VOL'], ovr: 82 },
      { name: 'Josue', pos: ['VOL','MEI'], ovr: 81 },
      { name: 'Danilo', pos: ['MEI'], ovr: 81 },
      { name: 'Hernanes', pos: ['MEI'], ovr: 86 },
      { name: 'Grafite', pos: ['ATA'], ovr: 85 },
      { name: 'Aloisio', pos: ['ATA'], ovr: 80 },
      { name: 'Borges', pos: ['ATA'], ovr: 79 },
      { name: 'Cicinho', pos: ['LD','PD'], ovr: 79 },
      { name: 'Diego Tardelli', pos: ['ATA'], ovr: 80 },
      { name: 'Alex Silva', pos: ['ZAG'], ovr: 74 },
      { name: 'Souza', pos: ['MEI'], ovr: 79 },
      { name: 'Lucas', pos: ['PD'], ovr: 75 },
      { name: 'Pablo', pos: ['ZAG'], ovr: 73 },
      { name: 'Rodrigo', pos: ['LD'], ovr: 70 },
    ]},
  { id: 'sao-paulo2008', club: 'Sao Paulo', year: 2008, label: 'Sao Paulo 2008 (Tricampeonato)', coach: 'Muricy Ramalho',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Rogerio Ceni', pos: ['GOL'], ovr: 88 },
      { name: 'Ilsinho', pos: ['LD','PD'], ovr: 77 },
      { name: 'Fabao', pos: ['ZAG'], ovr: 80 },
      { name: 'Miranda', pos: ['ZAG'], ovr: 85 },
      { name: 'Lugano', pos: ['ZAG'], ovr: 84 },
      { name: 'Junior', pos: ['LE'], ovr: 76 },
      { name: 'Mineiro', pos: ['VOL'], ovr: 82 },
      { name: 'Josue', pos: ['VOL','MEI'], ovr: 80 },
      { name: 'Danilo', pos: ['MEI'], ovr: 80 },
      { name: 'Hernanes', pos: ['MEI'], ovr: 88 },
      { name: 'Borges', pos: ['ATA'], ovr: 80 },
      { name: 'Aloisio', pos: ['ATA'], ovr: 79 },
      { name: 'Diego Tardelli', pos: ['ATA'], ovr: 81 },
      { name: 'Grafite', pos: ['ATA'], ovr: 82 },
      { name: 'Alex Silva', pos: ['ZAG'], ovr: 74 },
      { name: 'Eder Luis', pos: ['ATA'], ovr: 74 },
      { name: 'Rafael', pos: ['ZAG'], ovr: 73 },
      { name: 'Jadson', pos: ['MEI'], ovr: 77 },
      { name: 'Junior Cesar', pos: ['LE'], ovr: 72 },
      { name: 'Souza', pos: ['MEI'], ovr: 79 },
    ]},
  { id: 'flamengo2009', club: 'Flamengo', year: 2009, label: 'Flamengo 2009 (Hexacampeonato)', coach: 'Andrade',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Bruno', pos: ['GOL'], ovr: 87 },
      { name: 'Leo Moura', pos: ['LD','PD'], ovr: 86 },
      { name: 'David Braz', pos: ['ZAG'], ovr: 80 },
      { name: 'Ronaldo Angelim', pos: ['ZAG'], ovr: 82 },
      { name: 'Juan', pos: ['ZAG'], ovr: 84 },
      { name: 'Gonzalez', pos: ['LE'], ovr: 79 },
      { name: 'Airton', pos: ['VOL'], ovr: 79 },
      { name: 'Willians', pos: ['VOL'], ovr: 80 },
      { name: 'Petkovic', pos: ['MEI'], ovr: 85 },
      { name: 'Adriano', pos: ['ATA'], ovr: 91 },
      { name: 'Obina', pos: ['ATA'], ovr: 80 },
      { name: 'Ze Roberto', pos: ['MEI','ATA'], ovr: 80 },
      { name: 'Kleberson', pos: ['VOL','MEI'], ovr: 81 },
      { name: 'Josiel', pos: ['PD'], ovr: 76 },
      { name: 'Everton', pos: ['ATA'], ovr: 78 },
      { name: 'Alvaro', pos: ['ZAG'], ovr: 78 },
      { name: 'Fierro', pos: ['MEI'], ovr: 75 },
      { name: 'Camacho', pos: ['ATA'], ovr: 72 },
      { name: 'Denis Marques', pos: ['ATA'], ovr: 72 },
      { name: 'Bruno Mezenga', pos: ['ATA'], ovr: 73 },
    ]},
  { id: 'santos2010', club: 'Santos', year: 2010, label: 'Santos 2010 (Copa do Brasil)', coach: 'Dorival Junior',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Rafael', pos: ['GOL'], ovr: 80 },
      { name: 'Danilo', pos: ['LD','PD'], ovr: 83 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 83 },
      { name: 'Durval', pos: ['ZAG'], ovr: 80 },
      { name: 'Leo', pos: ['LE'], ovr: 81 },
      { name: 'Adriano', pos: ['VOL'], ovr: 79 },
      { name: 'Arouca', pos: ['VOL','MEI'], ovr: 83 },
      { name: 'Elano', pos: ['MEI'], ovr: 87 },
      { name: 'Paulo Henrique Ganso', pos: ['MEI'], ovr: 88 },
      { name: 'Robinho', pos: ['PE','ATA'], ovr: 89 },
      { name: 'Neymar', pos: ['ATA','PE'], ovr: 93 },
      { name: 'Andre', pos: ['ATA'], ovr: 82 },
      { name: 'Ze Eduardo', pos: ['ATA'], ovr: 79 },
      { name: 'Alan Kardec', pos: ['ATA'], ovr: 78 },
      { name: 'Alan Patrick', pos: ['MEI'], ovr: 78 },
      { name: 'Alex Sandro', pos: ['LE'], ovr: 78 },
      { name: 'Wesley', pos: ['VOL'], ovr: 79 },
      { name: 'Bruno Rodrigo', pos: ['ZAG'], ovr: 79 },
      { name: 'Felipe', pos: ['GOL'], ovr: 75 },
      { name: 'Para', pos: ['LD'], ovr: 78 },
    ]},
  { id: 'fluminense2010', club: 'Fluminense', year: 2010, label: 'Fluminense 2010 (Tricampeonato)', coach: 'Muricy Ramalho',
    colors: { p: '#7a1e3c', s: '#006437' },
    players: [
      { name: 'Ricardo Berna', pos: ['GOL'], ovr: 82 },
      { name: 'Mariano', pos: ['LD'], ovr: 79 },
      { name: 'Gum', pos: ['ZAG'], ovr: 84 },
      { name: 'Leandro Euzebio', pos: ['ZAG'], ovr: 81 },
      { name: 'Carlinhos', pos: ['LE'], ovr: 82 },
      { name: 'Valencia', pos: ['VOL'], ovr: 80 },
      { name: 'Diguinho', pos: ['VOL'], ovr: 78 },
      { name: 'Conca', pos: ['MEI'], ovr: 87 },
      { name: 'Julio Cesar', pos: ['MEI','ATA'], ovr: 79 },
      { name: 'Emerson Sheik', pos: ['ATA','MEI'], ovr: 83 },
      { name: 'Fred', pos: ['ATA'], ovr: 87 },
      { name: 'Washington', pos: ['MEI'], ovr: 77 },
      { name: 'Rodriguinho', pos: ['ATA'], ovr: 74 },
      { name: 'Fernando Bob', pos: ['ATA'], ovr: 77 },
      { name: 'Edinho', pos: ['VOL','MEI'], ovr: 75 },
      { name: 'Diego Cavalieri', pos: ['GOL'], ovr: 78 },
      { name: 'Wagner', pos: ['MEI'], ovr: 75 },
      { name: 'Leandro', pos: ['LD'], ovr: 73 },
      { name: 'Rafael Sobis', pos: ['ATA'], ovr: 80 },
      { name: 'Samuel', pos: ['ATA'], ovr: 73 },
    ]},
  { id: 'santos2011', club: 'Santos', year: 2011, label: 'Santos 2011 (Libertadores)', coach: 'Adilson Batista',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Rafael', pos: ['GOL'], ovr: 82 },
      { name: 'Danilo', pos: ['LD','PD'], ovr: 85 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 84 },
      { name: 'Durval', pos: ['ZAG'], ovr: 78 },
      { name: 'Leo', pos: ['LE'], ovr: 82 },
      { name: 'Adriano', pos: ['VOL'], ovr: 79 },
      { name: 'Arouca', pos: ['VOL','MEI'], ovr: 84 },
      { name: 'Elano', pos: ['MEI'], ovr: 87 },
      { name: 'Paulo Henrique Ganso', pos: ['MEI'], ovr: 89 },
      { name: 'Neymar', pos: ['ATA','PE'], ovr: 95 },
      { name: 'Ze Eduardo', pos: ['ATA'], ovr: 80 },
      { name: 'Andre', pos: ['ATA'], ovr: 83 },
      { name: 'Robinho', pos: ['PE','ATA'], ovr: 87 },
      { name: 'Alex Sandro', pos: ['LE'], ovr: 80 },
      { name: 'Bruno Rodrigo', pos: ['ZAG'], ovr: 79 },
      { name: 'Jonathan', pos: ['LD'], ovr: 76 },
      { name: 'Alan Kardec', pos: ['ATA'], ovr: 78 },
      { name: 'Maikon Leite', pos: ['ATA','PD'], ovr: 78 },
      { name: 'Felipe', pos: ['GOL'], ovr: 77 },
      { name: 'Marquinhos', pos: ['VOL'], ovr: 78 },
    ]},
  { id: 'corinthians2011', club: 'Corinthians', year: 2011, label: 'Corinthians 2011 (Pentacampeonato)', coach: 'Tite',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Cassio', pos: ['GOL'], ovr: 87 },
      { name: 'Alessandro', pos: ['LD'], ovr: 80 },
      { name: 'Chicao', pos: ['ZAG'], ovr: 84 },
      { name: 'Leandro Castan', pos: ['ZAG'], ovr: 84 },
      { name: 'Fabio Santos', pos: ['LE'], ovr: 82 },
      { name: 'Ralf', pos: ['VOL'], ovr: 85 },
      { name: 'Paulinho', pos: ['VOL','MEI'], ovr: 88 },
      { name: 'Danilo', pos: ['MEI','PD'], ovr: 85 },
      { name: 'Alex', pos: ['MEI'], ovr: 85 },
      { name: 'Paolo Guerrero', pos: ['ATA'], ovr: 88 },
      { name: 'Emerson Sheik', pos: ['ATA','MEI'], ovr: 85 },
      { name: 'Jorge Henrique', pos: ['PD','ATA'], ovr: 80 },
      { name: 'Liedson', pos: ['ATA'], ovr: 82 },
      { name: 'Willian', pos: ['PD','MEI'], ovr: 84 },
      { name: 'Adriano', pos: ['ATA'], ovr: 80 },
      { name: 'Romarinho', pos: ['ATA'], ovr: 78 },
      { name: 'Paulo Andre', pos: ['ZAG'], ovr: 80 },
      { name: 'Julio Cesar', pos: ['GOL'], ovr: 80 },
      { name: 'Douglas', pos: ['MEI'], ovr: 74 },
      { name: 'Guilherme', pos: ['ATA'], ovr: 73 },
    ]},
  { id: 'fluminense2012', club: 'Fluminense', year: 2012, label: 'Fluminense 2012 (Tetracampeonato)', coach: 'Abel Braga',
    colors: { p: '#7a1e3c', s: '#006437' },
    players: [
      { name: 'Diego Cavalieri', pos: ['GOL'], ovr: 84 },
      { name: 'Bruno', pos: ['LD'], ovr: 81 },
      { name: 'Gum', pos: ['ZAG'], ovr: 85 },
      { name: 'Leandro Euzebio', pos: ['ZAG'], ovr: 82 },
      { name: 'Carlinhos', pos: ['LE'], ovr: 82 },
      { name: 'Edinho', pos: ['VOL','MEI'], ovr: 78 },
      { name: 'Jean', pos: ['VOL'], ovr: 79 },
      { name: 'Deco', pos: ['MEI'], ovr: 87 },
      { name: 'Thiago Neves', pos: ['MEI'], ovr: 88 },
      { name: 'Wellington Nem', pos: ['PD','MEI'], ovr: 83 },
      { name: 'Fred', pos: ['ATA'], ovr: 90 },
      { name: 'Rafael Sobis', pos: ['ATA'], ovr: 82 },
      { name: 'Rafael Moura', pos: ['ATA'], ovr: 79 },
      { name: 'Wagner', pos: ['MEI'], ovr: 76 },
      { name: 'Lanzini', pos: ['MEI'], ovr: 80 },
      { name: 'Michael', pos: ['MEI'], ovr: 74 },
      { name: 'Rodrigo Lindoso', pos: ['VOL'], ovr: 78 },
      { name: 'Samuel', pos: ['ATA'], ovr: 73 },
      { name: 'Martinuccio', pos: ['MEI'], ovr: 74 },
      { name: 'Anderson', pos: ['ZAG'], ovr: 78 },
    ]},
  { id: 'atletico-mg2013', club: 'Atletico-MG', year: 2013, label: 'Atletico-MG 2013 (Libertadores)', coach: 'Cuca',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Victor', pos: ['GOL'], ovr: 93 },
      { name: 'Marcos Rocha', pos: ['LD'], ovr: 83 },
      { name: 'Rever', pos: ['ZAG'], ovr: 84 },
      { name: 'Leonardo Silva', pos: ['ZAG'], ovr: 83 },
      { name: 'Junior Cesar', pos: ['LE'], ovr: 80 },
      { name: 'Richarlyson', pos: ['LE','VOL'], ovr: 82 },
      { name: 'Pierre', pos: ['VOL'], ovr: 85 },
      { name: 'Josue', pos: ['VOL','MEI'], ovr: 82 },
      { name: 'Ronaldinho Gaucho', pos: ['MEI'], ovr: 91 },
      { name: 'Diego Tardelli', pos: ['MEI','ATA'], ovr: 89 },
      { name: 'Bernard', pos: ['PD','MEI'], ovr: 88 },
      { name: 'Jo', pos: ['ATA'], ovr: 86 },
      { name: 'Guilherme', pos: ['ATA'], ovr: 81 },
      { name: 'Luan', pos: ['ATA','PE'], ovr: 82 },
      { name: 'Alecsandro', pos: ['ATA'], ovr: 79 },
      { name: 'Michel', pos: ['LD'], ovr: 80 },
      { name: 'Jemerson', pos: ['ZAG'], ovr: 80 },
      { name: 'Rafael Carioca', pos: ['VOL'], ovr: 79 },
      { name: 'Leandro Donizete', pos: ['MEI','VOL'], ovr: 83 },
      { name: 'Douglas Santos', pos: ['LE'], ovr: 77 },
    ]},
  { id: 'cruzeiro2013', club: 'Cruzeiro', year: 2013, label: 'Cruzeiro 2013 (Brasileiro)', coach: 'Marcelo Oliveira',
    colors: { p: '#1c3f94', s: '#ffffff' },
    players: [
      { name: 'Fabio', pos: ['GOL'], ovr: 87 },
      { name: 'Ceara', pos: ['LD'], ovr: 82 },
      { name: 'Bruno Rodrigo', pos: ['ZAG'], ovr: 81 },
      { name: 'Dede', pos: ['ZAG'], ovr: 88 },
      { name: 'Egidio', pos: ['LE'], ovr: 80 },
      { name: 'Lucas Silva', pos: ['VOL'], ovr: 83 },
      { name: 'Nilton', pos: ['VOL'], ovr: 84 },
      { name: 'Everton Ribeiro', pos: ['MEI','PD'], ovr: 91 },
      { name: 'Ricardo Goulart', pos: ['MEI','ATA'], ovr: 88 },
      { name: 'Borges', pos: ['ATA'], ovr: 81 },
      { name: 'Marcelo Moreno', pos: ['ATA'], ovr: 83 },
      { name: 'Mayke', pos: ['LD'], ovr: 78 },
      { name: 'Leo', pos: ['ZAG'], ovr: 79 },
      { name: 'Willian', pos: ['ATA','PE'], ovr: 84 },
      { name: 'Julio Baptista', pos: ['MEI'], ovr: 79 },
      { name: 'Diego Souza', pos: ['MEI'], ovr: 80 },
      { name: 'Dagoberto', pos: ['ATA'], ovr: 75 },
      { name: 'Rafael', pos: ['GOL'], ovr: 75 },
      { name: 'Cris', pos: ['ZAG'], ovr: 78 },
      { name: 'Samudio', pos: ['LE'], ovr: 73 },
    ]},
  { id: 'cruzeiro2014', club: 'Cruzeiro', year: 2014, label: 'Cruzeiro 2014 (Tetracampeonato)', coach: 'Marcelo Oliveira',
    colors: { p: '#1c3f94', s: '#ffffff' },
    players: [
      { name: 'Fabio', pos: ['GOL'], ovr: 87 },
      { name: 'Ceara', pos: ['LD'], ovr: 82 },
      { name: 'Dede', pos: ['ZAG'], ovr: 90 },
      { name: 'Bruno Rodrigo', pos: ['ZAG'], ovr: 81 },
      { name: 'Egidio', pos: ['LE'], ovr: 81 },
      { name: 'Lucas Silva', pos: ['VOL'], ovr: 84 },
      { name: 'Henrique', pos: ['VOL'], ovr: 81 },
      { name: 'Nilton', pos: ['VOL'], ovr: 83 },
      { name: 'Everton Ribeiro', pos: ['MEI','PD'], ovr: 90 },
      { name: 'Ricardo Goulart', pos: ['MEI','ATA'], ovr: 89 },
      { name: 'Marcelo Moreno', pos: ['ATA'], ovr: 85 },
      { name: 'Willian', pos: ['ATA','PE'], ovr: 83 },
      { name: 'Borges', pos: ['ATA'], ovr: 79 },
      { name: 'Dagoberto', pos: ['ATA'], ovr: 74 },
      { name: 'Luan', pos: ['ATA'], ovr: 76 },
      { name: 'Mayke', pos: ['LD'], ovr: 80 },
      { name: 'Leo', pos: ['ZAG'], ovr: 80 },
      { name: 'Elisson', pos: ['GOL'], ovr: 73 },
      { name: 'Manoel', pos: ['ZAG'], ovr: 78 },
      { name: 'Bruno Ramires', pos: ['VOL'], ovr: 79 },
    ]},
  { id: 'corinthians2015', club: 'Corinthians', year: 2015, label: 'Corinthians 2015 (Hexacampeonato)', coach: 'Tite',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Cassio', pos: ['GOL'], ovr: 89 },
      { name: 'Fagner', pos: ['LD'], ovr: 82 },
      { name: 'Gil Baiano', pos: ['ZAG'], ovr: 87 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 84 },
      { name: 'Guilherme Arana', pos: ['LE'], ovr: 83 },
      { name: 'Ralf', pos: ['VOL'], ovr: 85 },
      { name: 'Elias', pos: ['VOL','MEI'], ovr: 84 },
      { name: 'Renato Augusto', pos: ['MEI'], ovr: 86 },
      { name: 'Jadson', pos: ['MEI'], ovr: 88 },
      { name: 'Roberto Firmino', pos: ['ATA','MEI'], ovr: 85 },
      { name: 'Malcom', pos: ['PD','ATA'], ovr: 82 },
      { name: 'Alessandro', pos: ['LD'], ovr: 78 },
      { name: 'Chicao', pos: ['ZAG'], ovr: 82 },
      { name: 'Rodriguinho', pos: ['MEI'], ovr: 83 },
      { name: 'Willian Arao', pos: ['VOL'], ovr: 80 },
      { name: 'Petros', pos: ['VOL'], ovr: 77 },
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
      { name: 'Arouca', pos: ['VOL'], ovr: 83 },
      { name: 'Felipe Melo', pos: ['VOL'], ovr: 87 },
      { name: 'Thiago Santos', pos: ['VOL'], ovr: 79 },
      { name: 'Allione', pos: ['MEI','PD'], ovr: 82 },
      { name: 'Dudu', pos: ['PD','ATA'], ovr: 88 },
      { name: 'Gabriel Jesus', pos: ['ATA'], ovr: 91 },
      { name: 'Cleiton Xavier', pos: ['MEI'], ovr: 79 },
      { name: 'Tche Tche', pos: ['MEI','VOL'], ovr: 80 },
      { name: 'Rafael Marques', pos: ['ATA'], ovr: 77 },
      { name: 'Willian', pos: ['ATA','PE'], ovr: 78 },
      { name: 'Mauricio Ramos', pos: ['ZAG'], ovr: 76 },
      { name: 'Jean', pos: ['LD'], ovr: 78 },
      { name: 'Thiago Martins', pos: ['ZAG'], ovr: 79 },
      { name: 'Raphael Veiga', pos: ['MEI'], ovr: 80 },
      { name: 'Roger Guedes', pos: ['ATA','PE'], ovr: 80 },
    ]},
  { id: 'corinthians2017', club: 'Corinthians', year: 2017, label: 'Corinthians 2017 (Heptacampeonato)', coach: 'Fabio Carille',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Cassio', pos: ['GOL'], ovr: 90 },
      { name: 'Fagner', pos: ['LD'], ovr: 85 },
      { name: 'Pablo', pos: ['ZAG'], ovr: 82 },
      { name: 'Balbuena', pos: ['ZAG'], ovr: 84 },
      { name: 'Guilherme Arana', pos: ['LE'], ovr: 83 },
      { name: 'Ralf', pos: ['VOL'], ovr: 84 },
      { name: 'Maycon', pos: ['VOL'], ovr: 85 },
      { name: 'Jadson', pos: ['MEI'], ovr: 89 },
      { name: 'Marlone', pos: ['MEI'], ovr: 82 },
      { name: 'Jo', pos: ['ATA'], ovr: 87 },
      { name: 'Romero', pos: ['PD','ATA'], ovr: 82 },
      { name: 'Malcom', pos: ['PD','ATA'], ovr: 84 },
      { name: 'Marquinhos Gabriel', pos: ['PD'], ovr: 80 },
      { name: 'Rodriguinho', pos: ['MEI'], ovr: 84 },
      { name: 'Kazim', pos: ['ATA'], ovr: 73 },
      { name: 'Leo Santos', pos: ['ZAG'], ovr: 78 },
      { name: 'Camacho', pos: ['MEI'], ovr: 74 },
      { name: 'Mendoza', pos: ['PD'], ovr: 74 },
      { name: 'Carlos', pos: ['LD'], ovr: 71 },
      { name: 'Jo (reserva)', pos: ['ATA'], ovr: 75 },
    ]},
  { id: 'palmeiras2018', club: 'Palmeiras', year: 2018, label: 'Palmeiras 2018 (80 pontos recorde)', coach: 'Luiz Felipe Scolari',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Weverton', pos: ['GOL'], ovr: 89 },
      { name: 'Marcos Rocha', pos: ['LD'], ovr: 84 },
      { name: 'Gustavo Gomez', pos: ['ZAG'], ovr: 88 },
      { name: 'Luan', pos: ['ZAG'], ovr: 83 },
      { name: 'Diogo Barbosa', pos: ['LE'], ovr: 82 },
      { name: 'Felipe Melo', pos: ['VOL'], ovr: 88 },
      { name: 'Bruno Henrique', pos: ['VOL'], ovr: 84 },
      { name: 'Ze Rafael', pos: ['VOL','MEI'], ovr: 83 },
      { name: 'Hyoran', pos: ['MEI','PD'], ovr: 80 },
      { name: 'Dudu', pos: ['PD','ATA'], ovr: 92 },
      { name: 'Borja', pos: ['ATA'], ovr: 81 },
      { name: 'Lucas Lima', pos: ['MEI'], ovr: 82 },
      { name: 'Willian', pos: ['ATA','PE'], ovr: 82 },
      { name: 'Deyverson', pos: ['ATA'], ovr: 80 },
      { name: 'Moises', pos: ['VOL','LE'], ovr: 79 },
      { name: 'Mayke', pos: ['LD'], ovr: 80 },
      { name: 'Edu Dracena', pos: ['ZAG'], ovr: 82 },
      { name: 'Thiago Santos', pos: ['VOL'], ovr: 78 },
      { name: 'Rafael Marques', pos: ['ATA'], ovr: 76 },
      { name: 'Raphael Veiga', pos: ['MEI'], ovr: 80 },
    ]},
  { id: 'athletico-pr2019', club: 'Athletico-PR', year: 2019, label: 'Athletico-PR 2019 (Copa do Brasil)', coach: 'Tiago Nunes',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Santos', pos: ['GOL'], ovr: 82 },
      { name: 'Marcio Azevedo', pos: ['LD'], ovr: 79 },
      { name: 'Pedro Henrique', pos: ['ZAG'], ovr: 80 },
      { name: 'Thiago Heleno', pos: ['ZAG'], ovr: 82 },
      { name: 'Leo Pereira', pos: ['LE'], ovr: 80 },
      { name: 'Christian', pos: ['VOL'], ovr: 83 },
      { name: 'Matheus Fernandes', pos: ['VOL'], ovr: 82 },
      { name: 'Bruno Guimaraes', pos: ['VOL','MEI'], ovr: 86 },
      { name: 'Nikao', pos: ['MEI','PD'], ovr: 88 },
      { name: 'Rony', pos: ['PD','ATA'], ovr: 86 },
      { name: 'Marco Ruben', pos: ['ATA'], ovr: 81 },
      { name: 'Jonathan', pos: ['GOL'], ovr: 75 },
      { name: 'Robson Bambu', pos: ['ZAG'], ovr: 79 },
      { name: 'Abner', pos: ['LE'], ovr: 77 },
      { name: 'Lucho Gonzalez', pos: ['MEI'], ovr: 83 },
      { name: 'Marcelo Cirino', pos: ['PE'], ovr: 81 },
      { name: 'Wellington', pos: ['VOL'], ovr: 79 },
      { name: 'Jonathan Rios', pos: ['LD'], ovr: 78 },
      { name: 'Vitinho', pos: ['PD'], ovr: 80 },
      { name: 'Marcinho', pos: ['LD'], ovr: 76 },
    ]},
  { id: 'flamengo2019', club: 'Flamengo', year: 2019, label: 'Flamengo 2019 (Bicampeonato + Libertadores)', coach: 'Jorge Jesus',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Diego Alves', pos: ['GOL'], ovr: 87 },
      { name: 'Rafinha', pos: ['LD'], ovr: 86 },
      { name: 'Rodrigo Caio', pos: ['ZAG'], ovr: 86 },
      { name: 'Pablo Mari', pos: ['ZAG'], ovr: 85 },
      { name: 'Filipe Luis', pos: ['LE'], ovr: 91 },
      { name: 'Willian Arao', pos: ['VOL'], ovr: 88 },
      { name: 'Gerson', pos: ['MEI','VOL'], ovr: 90 },
      { name: 'Everton Ribeiro', pos: ['MEI','PD'], ovr: 91 },
      { name: 'Arrascaeta', pos: ['MEI'], ovr: 92 },
      { name: 'Bruno Henrique', pos: ['PE','ATA'], ovr: 90 },
      { name: 'Gabigol', pos: ['ATA'], ovr: 97 },
      { name: 'Pedro', pos: ['ATA'], ovr: 88 },
      { name: 'Diego', pos: ['MEI'], ovr: 84 },
      { name: 'Cuellar', pos: ['VOL'], ovr: 85 },
      { name: 'Rodinei', pos: ['LD'], ovr: 82 },
      { name: 'Reinier', pos: ['MEI'], ovr: 82 },
      { name: 'Michael', pos: ['ATA','PD'], ovr: 82 },
      { name: 'Thiago Maia', pos: ['VOL'], ovr: 83 },
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
      { name: 'Willian Arao', pos: ['VOL'], ovr: 88 },
      { name: 'Gerson', pos: ['MEI','VOL'], ovr: 90 },
      { name: 'Everton Ribeiro', pos: ['MEI','PD'], ovr: 91 },
      { name: 'Arrascaeta', pos: ['MEI'], ovr: 91 },
      { name: 'Bruno Henrique', pos: ['PE','ATA'], ovr: 89 },
      { name: 'Gabigol', pos: ['ATA'], ovr: 96 },
      { name: 'Pedro', pos: ['ATA'], ovr: 90 },
      { name: 'Thiago Maia', pos: ['VOL'], ovr: 84 },
      { name: 'Michael', pos: ['ATA','PD'], ovr: 83 },
      { name: 'Rodinei', pos: ['LD'], ovr: 82 },
      { name: 'Diego', pos: ['MEI'], ovr: 82 },
      { name: 'Vitinho', pos: ['PD'], ovr: 81 },
      { name: 'Hugo Souza', pos: ['GOL'], ovr: 76 },
      { name: 'Rene', pos: ['LE'], ovr: 82 },
      { name: 'Leo Ortiz', pos: ['ZAG'], ovr: 80 },
    ]},
  { id: 'atletico-mg2021', club: 'Atletico-MG', year: 2021, label: 'Atletico-MG 2021 (Brasileiro + Copa do Brasil)', coach: 'Cuca',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Everson', pos: ['GOL'], ovr: 88 },
      { name: 'Marcos Rocha', pos: ['LD'], ovr: 83 },
      { name: 'Rever', pos: ['ZAG'], ovr: 82 },
      { name: 'Nathan Silva', pos: ['ZAG'], ovr: 85 },
      { name: 'Guilherme Arana', pos: ['LE'], ovr: 88 },
      { name: 'Allan', pos: ['VOL','MEI'], ovr: 86 },
      { name: 'Jair', pos: ['VOL'], ovr: 83 },
      { name: 'Zaracho', pos: ['MEI'], ovr: 87 },
      { name: 'Nacho Fernandez', pos: ['MEI'], ovr: 90 },
      { name: 'Keno', pos: ['ATA','PE'], ovr: 85 },
      { name: 'Hulk', pos: ['ATA'], ovr: 94 },
      { name: 'Vargas', pos: ['MEI','PE'], ovr: 84 },
      { name: 'Savarino', pos: ['PE'], ovr: 82 },
      { name: 'Eduardo Sasha', pos: ['ATA'], ovr: 82 },
      { name: 'Tardelli', pos: ['ATA'], ovr: 79 },
      { name: 'Alisson', pos: ['ZAG','LD'], ovr: 83 },
      { name: 'Guga', pos: ['LD'], ovr: 80 },
      { name: 'Igor Gomes', pos: ['MEI'], ovr: 78 },
      { name: 'Hyoran', pos: ['MEI'], ovr: 79 },
      { name: 'Rabelo', pos: ['VOL'], ovr: 76 },
    ]},
  { id: 'palmeiras2022', club: 'Palmeiras', year: 2022, label: 'Palmeiras 2022 (81 pontos RECORDE historico)', coach: 'Abel Ferreira',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Weverton', pos: ['GOL'], ovr: 92 },
      { name: 'Marcos Rocha', pos: ['LD'], ovr: 84 },
      { name: 'Gustavo Gomez', pos: ['ZAG'], ovr: 90 },
      { name: 'Murilo', pos: ['ZAG'], ovr: 87 },
      { name: 'Piquerez', pos: ['LE'], ovr: 89 },
      { name: 'Danilo', pos: ['VOL','MEI'], ovr: 88 },
      { name: 'Ze Rafael', pos: ['VOL'], ovr: 86 },
      { name: 'Atuesta', pos: ['VOL'], ovr: 81 },
      { name: 'Raphael Veiga', pos: ['MEI','ATA'], ovr: 90 },
      { name: 'Dudu', pos: ['PD','ATA'], ovr: 88 },
      { name: 'Flaco Lopez', pos: ['ATA'], ovr: 86 },
      { name: 'Rony', pos: ['PE','ATA'], ovr: 85 },
      { name: 'Endrick', pos: ['ATA'], ovr: 91 },
      { name: 'Mayke', pos: ['LD'], ovr: 81 },
      { name: 'Gabriel Menino', pos: ['VOL'], ovr: 82 },
      { name: 'Luan', pos: ['ZAG'], ovr: 80 },
      { name: 'Vanderlan', pos: ['LE'], ovr: 78 },
      { name: 'Pedro Geromel', pos: ['ZAG'], ovr: 79 },
      { name: 'Jose Manuel Lopez', pos: ['ATA'], ovr: 75 },
      { name: 'Jhon Jhon', pos: ['MEI'], ovr: 79 },
    ]},
  { id: 'athletico-pr2022', club: 'Athletico-PR', year: 2022, label: 'Athletico-PR 2022 (Finalista Libertadores)', coach: 'Luiz Felipe Scolari',
    colors: { p: '#c8102e', s: '#000000' },
    players: [
      { name: 'Bento', pos: ['GOL'], ovr: 87 },
      { name: 'Orejuela', pos: ['LD'], ovr: 80 },
      { name: 'Pedro Henrique', pos: ['ZAG'], ovr: 83 },
      { name: 'Thiago Heleno', pos: ['ZAG'], ovr: 82 },
      { name: 'Abner', pos: ['LE'], ovr: 83 },
      { name: 'Christian', pos: ['VOL'], ovr: 84 },
      { name: 'Matheus Fernandes', pos: ['VOL'], ovr: 83 },
      { name: 'Erick', pos: ['VOL'], ovr: 82 },
      { name: 'Fernandinho', pos: ['VOL','MEI'], ovr: 90 },
      { name: 'David Terans', pos: ['MEI'], ovr: 86 },
      { name: 'Canobbio', pos: ['PD','MEI'], ovr: 84 },
      { name: 'Romulo', pos: ['ATA'], ovr: 83 },
      { name: 'Pablo', pos: ['ATA'], ovr: 82 },
      { name: 'Vitor Roque', pos: ['ATA'], ovr: 87 },
      { name: 'Vitinho', pos: ['PD'], ovr: 82 },
      { name: 'Ze Ivaldo', pos: ['ZAG'], ovr: 82 },
      { name: 'Anderson', pos: ['GOL'], ovr: 79 },
      { name: 'Matheus Felipe', pos: ['ZAG'], ovr: 81 },
      { name: 'Pedrinho', pos: ['LE'], ovr: 81 },
      { name: 'Khellven', pos: ['LD'], ovr: 79 },
    ]},
  { id: 'palmeiras2023', club: 'Palmeiras', year: 2023, label: 'Palmeiras 2023 (Tricampeonato com Abel)', coach: 'Abel Ferreira',
    colors: { p: '#006437', s: '#ffffff' },
    players: [
      { name: 'Weverton', pos: ['GOL'], ovr: 91 },
      { name: 'Marcos Rocha', pos: ['LD'], ovr: 83 },
      { name: 'Gustavo Gomez', pos: ['ZAG'], ovr: 91 },
      { name: 'Murilo', pos: ['ZAG'], ovr: 88 },
      { name: 'Piquerez', pos: ['LE'], ovr: 89 },
      { name: 'Danilo', pos: ['VOL','MEI'], ovr: 88 },
      { name: 'Ze Rafael', pos: ['VOL'], ovr: 85 },
      { name: 'Gabriel Menino', pos: ['VOL'], ovr: 83 },
      { name: 'Raphael Veiga', pos: ['MEI','ATA'], ovr: 92 },
      { name: 'Estevao', pos: ['PD','MEI'], ovr: 89 },
      { name: 'Flaco Lopez', pos: ['ATA'], ovr: 90 },
      { name: 'Dudu', pos: ['PD','ATA'], ovr: 87 },
      { name: 'Rony', pos: ['PE','ATA'], ovr: 84 },
      { name: 'Endrick', pos: ['ATA'], ovr: 93 },
      { name: 'Mayke', pos: ['LD'], ovr: 80 },
      { name: 'Vanderlan', pos: ['LE'], ovr: 79 },
      { name: 'Atuesta', pos: ['VOL'], ovr: 80 },
      { name: 'Jhon Jhon', pos: ['MEI'], ovr: 82 },
      { name: 'Artur', pos: ['PD'], ovr: 78 },
      { name: 'Lopes', pos: ['ATA'], ovr: 75 },
    ]},
  { id: 'botafogo2024', club: 'Botafogo', year: 2024, label: 'Botafogo 2024 (Tricampeonato + Libertadores)', coach: 'Artur Jorge',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'John', pos: ['GOL'], ovr: 87 },
      { name: 'Vitinho', pos: ['LD'], ovr: 84 },
      { name: 'Alexander Barboza', pos: ['ZAG'], ovr: 87 },
      { name: 'Adryelson', pos: ['ZAG'], ovr: 85 },
      { name: 'Cuiabano', pos: ['LE'], ovr: 83 },
      { name: 'Marlon Freitas', pos: ['VOL'], ovr: 88 },
      { name: 'Gregore', pos: ['VOL'], ovr: 83 },
      { name: 'Thiago Almada', pos: ['MEI'], ovr: 93 },
      { name: 'Savarino', pos: ['MEI','PE'], ovr: 87 },
      { name: 'Luiz Henrique', pos: ['PE','ATA'], ovr: 90 },
      { name: 'Igor Jesus', pos: ['ATA'], ovr: 87 },
      { name: 'Matheus Martins', pos: ['ATA'], ovr: 84 },
      { name: 'Eduardo Sasha', pos: ['ATA'], ovr: 82 },
      { name: 'Tiquinho Soares', pos: ['ATA'], ovr: 86 },
      { name: 'Alex Telles', pos: ['LE'], ovr: 84 },
      { name: 'Artur', pos: ['PD'], ovr: 81 },
      { name: 'Gabriel Pires', pos: ['VOL'], ovr: 79 },
      { name: 'Gatito Fernandez', pos: ['GOL'], ovr: 82 },
      { name: 'Rafael', pos: ['LD'], ovr: 80 },
      { name: 'Yarlen', pos: ['ATA'], ovr: 80 },
    ]},
  { id: 'santos2015', club: 'Santos', year: 2015, label: 'Santos 2015 (Paulistao + Vice Copa BR)', coach: 'Dorival Junior',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Vanderlei', pos: ['GOL'], ovr: 84 },
      { name: 'Victor Ferraz', pos: ['LD'], ovr: 80 },
      { name: 'David Braz', pos: ['ZAG'], ovr: 83 },
      { name: 'Gustavo Henrique', pos: ['ZAG'], ovr: 82 },
      { name: 'Zeca', pos: ['LE'], ovr: 80 },
      { name: 'Renato', pos: ['VOL'], ovr: 82 },
      { name: 'Thiago Maia', pos: ['VOL'], ovr: 85 },
      { name: 'Lucas Lima', pos: ['MEI'], ovr: 87 },
      { name: 'Marquinhos Gabriel', pos: ['PD','ATA'], ovr: 82 },
      { name: 'Ricardo Oliveira', pos: ['ATA'], ovr: 90 },
      { name: 'Gabigol', pos: ['ATA','PD'], ovr: 85 },
      { name: 'Vladimir', pos: ['GOL'], ovr: 79 },
      { name: 'Daniel Guedes', pos: ['LD'], ovr: 75 },
      { name: 'Luiz Felipe', pos: ['ZAG'], ovr: 79 },
      { name: 'Werley', pos: ['ZAG'], ovr: 76 },
      { name: 'Geuvânio', pos: ['PE','ATA'], ovr: 80 },
      { name: 'Robinho', pos: ['ATA','PE'], ovr: 81 },
      { name: 'Elano', pos: ['MEI'], ovr: 79 },
      { name: 'Leo Cittadini', pos: ['MEI'], ovr: 77 },
      { name: 'Alison', pos: ['VOL'], ovr: 77 },
    ]},
  { id: 'santos2020', club: 'Santos', year: 2020, label: 'Santos 2020 (Vici-Campeão da Libertadores)', coach: 'Cuca',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'John', pos: ['GOL'], ovr: 85 },
      { name: 'Para', pos: ['LD'], ovr: 81 },
      { name: 'Lucas Verissimo', pos: ['ZAG'], ovr: 87 },
      { name: 'Luan Peres', pos: ['ZAG'], ovr: 85 },
      { name: 'Felipe Jonatan', pos: ['LE'], ovr: 82 },
      { name: 'Alison', pos: ['VOL'], ovr: 82 },
      { name: 'Diego Pituca', pos: ['MEI','VOL'], ovr: 84 },
      { name: 'Sandry', pos: ['VOL'], ovr: 79 },
      { name: 'Soteldo', pos: ['PE','MEI'], ovr: 87 },
      { name: 'Marinho', pos: ['ATA','PD'], ovr: 89 },
      { name: 'Kaio Jorge', pos: ['ATA'], ovr: 85 },
      { name: 'Joao Paulo', pos: ['GOL','PD'], ovr: 85 },
      { name: 'Luiz Felile', pos: ['ZAG'], ovr: 77 },
      { name: 'Lucas Braga', pos: ['PE','ATA'], ovr: 83 },
      { name: 'Jean Mota', pos: ['MEI'], ovr: 79 },
      { name: 'Madson', pos: ['LD'], ovr: 78 },
      { name: 'Arthur Gomes', pos: ['PD'], ovr: 79 },
      { name: 'Vinicius Balieiro', pos: ['MEI'], ovr: 76 },
      { name: 'Carlos Sanchez', pos: ['MEI'], ovr: 83 },
      { name: 'Marcos Leonardo', pos: ['ATA'], ovr: 77 },
    ]},
  { id: 'botafogo2023', club: 'Botafogo', year: 2023, label: 'Botafogo 2023 (Deixou escapar)', coach: 'Luis Castro',
    colors: { p: '#000000', s: '#ffffff' },
    players: [
      { name: 'Lucas Perri', pos: ['GOL'], ovr: 85 },
      { name: 'Saravia', pos: ['LD'], ovr: 82 },
      { name: 'Adryelson', pos: ['ZAG'], ovr: 83 },
      { name: 'Victor Cuesta', pos: ['ZAG'], ovr: 82 },
      { name: 'Marcal', pos: ['LE'], ovr: 80 },
      { name: 'Eduardo', pos: ['VOL'], ovr: 83 },
      { name: 'Marlon Freitas', pos: ['VOL'], ovr: 84 },
      { name: 'Tche Tche', pos: ['MEI','VOL'], ovr: 83 },
      { name: 'Gustavo Sauer', pos: ['PD'], ovr: 83 },
      { name: 'Tiquinho Soares', pos: ['ATA'], ovr: 89 },
      { name: 'Jeffinho', pos: ['PE','ATA'], ovr: 84 },
      { name: 'Diego Hernandez', pos: ['MEI'], ovr: 80 },
      { name: 'Hugo', pos: ['GOL'], ovr: 78 },
      { name: 'Rafael', pos: ['LD'], ovr: 79 },
      { name: 'Kayque', pos: ['VOL'], ovr: 80 },
      { name: 'Oscar Romero', pos: ['MEI'], ovr: 82 },
      { name: 'Diego Costa', pos: ['ATA'], ovr: 79 },
      { name: 'Patrick de Paula', pos: ['VOL'], ovr: 82 },
      { name: 'Victor Sa', pos: ['ATA'], ovr: 82 },
      { name: 'Niko Kuhnel', pos: ['MEI'], ovr: 76 },
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
  const vals = Object.values(xi).filter(p => !p.isBench);
  if (vals.length === 0) return 50;
  const baseOvr = vals.reduce((s, p) => s + p.ovr, 0) / vals.length;
  const { ovrBonus } = calcChemistry(vals);
  return Math.round((baseOvr + ovrBonus) * 10) / 10;
}

// Simulação de disputa de pênaltis (5 cobranças + morte súbita)
function simulatePenalties(teamAId, teamBId, leagueTeams) {
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
    const a = Math.random() < rateA;
    const b = Math.random() < rateB;
    if (a) goalsA++;
    if (b) goalsB++;
    kicks.push({ a, b, goalsA, goalsB });
    // Early termination: one team can't catch up
    const remaining = 4 - i;
    if (goalsA - goalsB > remaining + 1 || goalsB - goalsA > remaining + 1) break;
  }
  // Sudden death if still tied
  while (goalsA === goalsB) {
    const a = Math.random() < rateA;
    const b = Math.random() < rateB;
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

  const events = [];
  for (let i = 0; i < homeGoals; i++)
    events.push({ minute: randMin(), teamId: homeTeam.id, teamLabel: homeTeam.label, scorer: pickGoalScorer(homeTeam.players, rand) });
  for (let i = 0; i < awayGoals; i++)
    events.push({ minute: randMin(), teamId: awayTeam.id, teamLabel: awayTeam.label, scorer: pickGoalScorer(awayTeam.players, rand) });

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
  GOL: ['GOL'],
  LD:  ['LD', 'ZAG'],
  LE:  ['LE', 'ZAG'],
  ZAG: ['ZAG', 'LD', 'LE'],
  VOL: ['VOL', 'MEI', 'MC'],
  MEI: ['MEI', 'VOL', 'MC', 'MD', 'ME'],
  MC:  ['MC', 'MEI', 'VOL', 'MD', 'ME'],
  MD:  ['MD', 'PD', 'MEI', 'MC'],
  ME:  ['ME', 'PE', 'MEI', 'MC'],
  PD:  ['PD', 'ATA', 'MD', 'MEI'],
  PE:  ['PE', 'ATA', 'ME', 'MEI'],
  ATA: ['ATA', 'PD', 'PE'],
};

// Logos via TheSportsDB (r2.thesportsdb.com — free, sem autenticação)
const CLUB_LOGOS = {
  // Times no jogo (66 equipes históricas)
  'Santos':       'https://r2.thesportsdb.com/images/media/team/badge/j8xk9g1679447486.png',
  'Botafogo':     'https://r2.thesportsdb.com/images/media/team/badge/bs5mbw1733004596.png',
  'Palmeiras':    'https://r2.thesportsdb.com/images/media/team/badge/vsqwqp1473538105.png',
  'Internacional':'https://r2.thesportsdb.com/images/media/team/badge/yprvxx1473538097.png',
  'Fluminense':   'https://r2.thesportsdb.com/images/media/team/badge/stvvwp1473538082.png',
  'Coritiba':     'https://r2.thesportsdb.com/images/media/team/badge/ywwsyu1473538050.png',
  'Sao Paulo':    'https://r2.thesportsdb.com/images/media/team/badge/sxpupx1473538135.png',
  'Sport':        'https://r2.thesportsdb.com/images/media/team/badge/tyrbls1545421563.png',
  'Bahia':        'https://r2.thesportsdb.com/images/media/team/badge/xuvtsv1473539308.png',
  'Vasco':        'https://r2.thesportsdb.com/images/media/team/badge/ynqlxo1630521109.png',
  'Corinthians':  'https://r2.thesportsdb.com/images/media/team/badge/vvuvps1473538042.png',
  'Gremio':       'https://r2.thesportsdb.com/images/media/team/badge/uvpwyt1473538089.png',
  'Athletico-PR': 'https://r2.thesportsdb.com/images/media/team/badge/irzu1u1554237406.png',
  'Cruzeiro':     'https://r2.thesportsdb.com/images/media/team/badge/upsvvu1473538059.png',
  'Flamengo':     'https://r2.thesportsdb.com/images/media/team/badge/syptwx1473538074.png',
  'Atletico-MG':  'https://r2.thesportsdb.com/images/media/team/badge/x5lixs1743742872.png',
  'Guarani':      'https://r2.thesportsdb.com/images/media/team/badge/tpipb21766508536.png',
  // Times extras (não no jogo mas disponíveis como emblema pessoal)
  'Fortaleza':    'https://r2.thesportsdb.com/images/media/team/badge/tosmdr1532853458.png',
  'Ceara':        'https://r2.thesportsdb.com/images/media/team/badge/rxxvyp1464886685.png',
  'America-MG':   'https://r2.thesportsdb.com/images/media/team/badge/rtpp171752177342.png',
  'Goias':        'https://r2.thesportsdb.com/images/media/team/badge/qhfhdp1635869930.png',
  'Vitoria':      'https://r2.thesportsdb.com/images/media/team/badge/tysrrx1473538156.png',
  'Bragantino':   'https://r2.thesportsdb.com/images/media/team/badge/2p7tl41701423595.png',
  'Criciuma':     'https://r2.thesportsdb.com/images/media/team/badge/r11mld1766506200.png',
  'Chapecoense':  'https://r2.thesportsdb.com/images/media/team/badge/wy0e1i1765900601.png',
  'Ponte Preta':  'https://r2.thesportsdb.com/images/media/team/badge/wbss4d1644929547.png',
  'Juventude':    'https://r2.thesportsdb.com/images/media/team/badge/1ntter1766506778.png',
  'Avai':         'https://r2.thesportsdb.com/images/media/team/badge/bblkat1766506007.png',
  'Atletico-GO':  'https://r2.thesportsdb.com/images/media/team/badge/l7382k1766505911.png',
};

// IDs YouTube dos hinos oficiais — tocam na tela de campeão
const CLUB_ANTHEMS = {
  'Santos':       'QXs6kGLVL_0',
  'Flamengo':     'pFvX3lHujn8',
  'Corinthians':  'g6M8oJq-dEA',
  'Palmeiras':    'n47Y8-xNDPo',
  'Internacional':'s6rT_BfQnuE',
  'Sao Paulo':    'pGD2BJeYjNA',
  'Vasco':        'Fsbka7RbOpw',
  'Gremio':       'cBmkH37USnA',
  'Cruzeiro':     '901buxaTBtA',
  'Botafogo':     'itm2AQsH0pU',
  'Fluminense':   'MMxM5YePtsM',
  'Bahia':        '960Fx8gcnIY',
  'Sport':        'PVcqbeerC8k',
  'Athletico-PR': 'kNd1BbWicMc',
  'Coritiba':     'NZki289dBz4',
  'Atletico-MG':  'dD4IPCN4o5I',
  'Guarani':      'b6KGAtvKhoQ',
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
  const [cupRounds, setCupRounds] = useState([]); // [{name, matches, leg1Results, results}]
  const [cupRoundIdx, setCupRoundIdx] = useState(0);
  const [cupLeg, setCupLeg] = useState(1); // 1=jogo de ida  2=jogo de volta
  const cupLegRef = useRef(1);
  useEffect(() => { cupLegRef.current = cupLeg; }, [cupLeg]);
  const [userInCup, setUserInCup] = useState(true);
  const userInCupRef = useRef(true);
  useEffect(() => { userInCupRef.current = userInCup; }, [userInCup]);
  const [eliminationRoundName, setEliminationRoundName] = useState(null);
  const [cupWinnerId, setCupWinnerId] = useState(null);

  // Histórico e artilheiros
  const [matchHistory, setMatchHistory] = useState([]);
  const [scorers, setScorers] = useState({});
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
    const formSlots = buildPitchSlots(key);
    const benchSlots = ['bench1','bench2','bench3','bench4','bench5'].map((k, i) => ({
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
    const canPlayAt = new Set(expandPlayerPositions(player.pos));
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
    const um = round.find(m => m.homeId === MY_TEAM_ID || m.awayId === MY_TEAM_ID);
    if (!um) {
      // Copa: user already eliminated — fast-simulate this AI-only round
      if (gameMode !== 'copa' || userInCupRef.current) return;
      const allResults = round.map(m => {
        const h = leagueTeams.find(t => t.id === m.homeId);
        const a = leagueTeams.find(t => t.id === m.awayId);
        if (!h || !a) return { homeId: m.homeId, awayId: m.awayId, homeGoals: 0, awayGoals: 0 };
        return { homeId: m.homeId, awayId: m.awayId, ...simAiMatch(h, a) };
      });
      setRoundResults(allResults);
      setCupRounds(prev => prev.map((r, i) => i === cupRoundIdx ? { ...r, results: allResults } : r));
      return;
    }

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
        // Record scorer
        setScorers(prev => ({
          ...prev,
          [ev.scorer]: { goals: (prev[ev.scorer]?.goals || 0) + 1, teamLabel: ev.teamLabel }
        }));
      }

      setClockMinute(minute);
      setLiveScore({ home: hs, away: as_ });
      if (shown.length > 0) setLiveEvents([...shown]);

      if (minute >= 90) {
        setIsSimulating(false);

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
            const baseUpdated = prev.map((r, i) => i === cupRoundIdx ? { ...r, results } : r);
            // Leg 2: calcular pênaltis e verificar eliminação por agregado
            if (cupLegRef.current === 2) {
              const cupRoundData = baseUpdated[cupRoundIdx];
              const leg1Res = cupRoundData?.leg1Results || [];
              const penaltyResults = [];

              // Compute penalties for all tied matches
              cupRoundData?.matches?.forEach((match, i) => {
                const l1 = leg1Res[i] || { homeGoals: 0, awayGoals: 0 };
                const l2 = results[i] || { homeGoals: 0, awayGoals: 0 };
                const aggA = l1.homeGoals + l2.awayGoals;
                const aggB = l1.awayGoals + l2.homeGoals;
                if (aggA === aggB) {
                  const awayA = l2.awayGoals;
                  const awayB = l1.awayGoals;
                  if (awayA === awayB) {
                    const pen = simulatePenalties(match.homeId, match.awayId, leagueTeams);
                    penaltyResults.push({ matchIdx: i, ...pen });
                  }
                }
              });

              // User elimination check
              const userMatchIdx = cupRoundData?.matches?.findIndex(m => m.homeId === MY_TEAM_ID || m.awayId === MY_TEAM_ID) ?? -1;
              if (userMatchIdx >= 0) {
                const match = cupRoundData.matches[userMatchIdx];
                const l1 = leg1Res[userMatchIdx] || { homeGoals: 0, awayGoals: 0 };
                const l2 = results[userMatchIdx] || { homeGoals: 0, awayGoals: 0 };
                const isHome = match.homeId === MY_TEAM_ID;
                const userAgg = isHome ? (l1.homeGoals + l2.awayGoals) : (l1.awayGoals + l2.homeGoals);
                const oppAgg  = isHome ? (l1.awayGoals + l2.homeGoals) : (l1.homeGoals + l2.awayGoals);
                if (userAgg < oppAgg) {
                  setUserInCup(false);
                  setEliminationRoundName(cupRoundData?.name || CUP_ROUND_NAMES[cupRoundIdx] || 'Copa');
                } else if (userAgg === oppAgg) {
                  const userAway = isHome ? l2.awayGoals : l1.awayGoals;
                  const oppAway  = isHome ? l1.awayGoals : l2.awayGoals;
                  if (userAway < oppAway) {
                    setUserInCup(false);
                    setEliminationRoundName(cupRoundData?.name || CUP_ROUND_NAMES[cupRoundIdx] || 'Copa');
                  } else if (userAway === oppAway) {
                    // Use penalty result
                    const userPen = penaltyResults.find(pr => pr.matchIdx === userMatchIdx);
                    if (userPen && userPen.winner !== MY_TEAM_ID) {
                      setUserInCup(false);
                      setEliminationRoundName(cupRoundData?.name || CUP_ROUND_NAMES[cupRoundIdx] || 'Copa');
                    }
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
        // Empate no agregado: gol fora
        const awayA = l2.awayGoals; // match.homeId marcou fora no leg2
        const awayB = l1.awayGoals; // match.awayId marcou fora no leg1
        if (awayA !== awayB) return awayA > awayB ? match.homeId : match.awayId;
        // Pênaltis — usar resultado pré-computado ou simular
        const precomputed = preComputedPenalties.find(pr => pr.matchIdx === i);
        if (precomputed) return precomputed.winner;
        const pen = simulatePenalties(match.homeId, match.awayId, leagueTeams);
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
  }, [currentRound, fixtures, gameMode, cupRoundIdx, cupLeg, roundResults, leagueTeams]);

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
        return { homeId: m.homeId, awayId: m.awayId, ...simAiMatch(h, a) };
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
          const awayA = l2.awayGoals, awayB = l1.awayGoals;
          if (awayA !== awayB) return awayA > awayB ? match.homeId : match.awayId;
          return Math.random() < 0.5 ? match.homeId : match.awayId;
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
  }, [cupRounds, cupRoundIdx, cupLeg, fixtures, currentRound, leagueTeams]);

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
            viewingTeam={viewingTeam}
            onViewTeam={setViewingTeam}
            onSimulateAll={simulateAllCupa}
          />
        )}
        {phase === 'results' && (
          <Results leagueTable={leagueTable} myTeamId={MY_TEAM_ID} myTeamColor={myTeamColor} myTeamBadge={myTeamBadge} myTeamLogo={myTeamLogo} gameMode={gameMode} cupWinnerId={cupWinnerId} leagueTeams={leagueTeams} onRestart={restart} scorers={scorers} onNewSeason={newSeason} />
        )}
        {viewingTeam && <TeamViewModal team={viewingTeam} onClose={() => setViewingTeam(null)} myTeamColor={myTeamColor} />}
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
      <div style={styles.introBadge}>⚽ Futebol Brasileiro · 1959–2026</div>
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
          <div style={styles.featTitle}>Monte o Plantel</div>
          <div style={styles.featDesc}>Escolha 11 titulares e 5 reservas entre os maiores craques de cada era.</div>
        </div>
        <div style={styles.featCard}>
          <div style={styles.featIcon}>🏆</div>
          <div style={styles.featTitle}>Dispute o título</div>
          <div style={styles.featDesc}>Liga com 20 times, 38 rodadas e gols aparecendo minuto a minuto.</div>
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
              sub: '32 times · Mata-mata · Ida e volta',
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
function CupBracket({ cupRounds, leagueTeams, myTeamId, myTeamColor }) {
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
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: id === myTeamId ? mc : won ? '#7fd99a' : '#F4F1EA', fontWeight: won ? 700 : 400 }}>{team?.label || '?'}</span>
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
  if (pos <= 4)  return { color: '#22c55e', label: 'G4', title: 'Libertadores - Fase de Grupos' };
  if (pos <= 6)  return { color: '#86efac', label: 'G6', title: 'Libertadores - Pre' };
  if (pos <= 12) return { color: '#60a5fa', label: 'SA', title: 'Sul-Americana' };
  if (pos >= total - 3) return { color: '#ef4444', label: 'Z4', title: 'Rebaixamento' };
  return null;
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

function Draft({ rolledTeam, isRolling, rollingPreview, pitch, pitchSlots, formationLabel, skipsLeft, selectedPlayer, repositioningSlot, eligibleSlotsForPlayer, onClickPlayer, onClickPitchSlot, onUnplacePlayer, onSkipTeam, myTeamColor, captainSlot }) {
  const isMobile = useIsMobile();
  const filledCount = Object.keys(pitch).length;
  const highlightSlots = selectedPlayer ? eligibleSlotsForPlayer(selectedPlayer) : [];

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

function Squad({ pitch, pitchSlots, formationLabel, captainSlot, onSetCaptain, onConfirm, onRedo, myTeamColor }) {
  const starters = Object.values(pitch).filter(p => !p.isBench);
  const avgOvr = starters.length ? Math.round(starters.reduce((s, p) => s + p.ovr, 0) / starters.length) : 0;
  const { ovrBonus } = calcChemistry(starters.filter(p => p.club));
  const effectiveOvr = Math.round((avgOvr + ovrBonus + (captainSlot && !pitch[captainSlot]?.isBench ? 2 / starters.length : 0)) * 10) / 10;
  const starterSlots = pitchSlots.filter(s => !s.isBench);
  const benchSlots = pitchSlots.filter(s => s.isBench);

  return (
    <div style={styles.card} className="card-mob">
      <div style={styles.eyebrow}>{formationLabel}</div>
      <h2 style={styles.h2}>OVR base: {avgOvr} · Efetivo: {effectiveOvr} (11 titulares)</h2>
      <ChemistryDisplay pitch={pitch} />

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

function Playing({ myTeamId, fixtures, currentRound, leagueTeams, leagueTable, clockMinute, isSimulating, liveEvents, liveScore, roundResults, activeUserMatch, myTeamColor, myTeamBadge, myTeamLogo, gameMode, cupRounds, cupRoundIdx, cupLeg, userInCup, eliminationRoundName, simSpeed, onSetSpeed, simMode, onSetSimMode, autoCountdown, onStartRound, onNextRound, matchHistory, scorers, viewingTeam, onViewTeam, onSimulateAll }) {
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
                <CupBracket cupRounds={cupRounds} leagueTeams={leagueTeams} myTeamId={myTeamId} myTeamColor={mc} />
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
              <CupBracket cupRounds={cupRounds} leagueTeams={leagueTeams} myTeamId={myTeamId} myTeamColor={mc} />
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

        {/* Contexto do jogo de ida quando estamos no jogo de volta */}
        {cupLeg === 2 && userLeg1 && origMatch && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: 10, marginBottom: 12, fontSize: 12 }}>
            <span style={{ opacity: 0.55 }}>1º jogo:</span>
            <span style={{ fontWeight: 700, fontFamily: 'monospace', color: mc }}>
              {origMatch.homeId === myTeamId ? userLeg1.homeGoals : userLeg1.awayGoals}
              {' × '}
              {origMatch.homeId === myTeamId ? userLeg1.awayGoals : userLeg1.homeGoals}
            </span>
            <span style={{ opacity: 0.55 }}>· 2º jogo decide o agregado</span>
          </div>
        )}

        <LiveMatchBox
          um={um} homeTeam={homeTeam} awayTeam={awayTeam}
          myTeamId={myTeamId} myTeamBadge={myTeamBadge} mc={mc}
          liveScore={liveScore} clockDisplay={clockDisplay}
          isSimulating={isSimulating} roundDone={roundDone}
          liveEvents={liveEvents} simSpeed={simSpeed}
          onSetSpeed={onSetSpeed} simMode={simMode} onSetSimMode={onSetSimMode}
          autoCountdown={autoCountdown} onStartRound={onStartRound}
          roundLabel={`Jogar — ${roundName} (${legLabel})`}
        />

        {/* Placar agregado após jogo de volta */}
        {roundDone && cupLeg === 2 && userLeg1 && origMatch && roundResults && (() => {
          const l2 = roundResults[userOrigIdx] || { homeGoals: 0, awayGoals: 0 };
          const isUserHome = origMatch.homeId === myTeamId;
          const userAgg = isUserHome ? (userLeg1.homeGoals + l2.awayGoals) : (userLeg1.awayGoals + l2.homeGoals);
          const oppAgg  = isUserHome ? (userLeg1.awayGoals + l2.homeGoals) : (userLeg1.homeGoals + l2.awayGoals);
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
            <CupBracket cupRounds={cupRounds} leagueTeams={leagueTeams} myTeamId={myTeamId} myTeamColor={mc} />
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
          {[['#22c55e','G4 Libertadores (grupos)'],['#86efac','G6 Libertadores (pre)'],['#60a5fa','SA Sul-Americana'],['#ef4444','Z4 Rebaixamento']].map(([c,l]) => (
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
                <span style={{ width: 20, textAlign: 'right', opacity: 0.4, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{i+1}.</span>
                <span style={{ flex: 1 }}>{name}</span>
                <span style={{ fontSize: 11, opacity: 0.5 }}>{d.teamLabel}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: mc }}>gol {d.goals}</span>
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

function Results({ leagueTable, myTeamId, myTeamColor, myTeamBadge, myTeamLogo, gameMode, cupWinnerId, leagueTeams, onRestart, scorers, onNewSeason }) {
  const mc = myTeamColor || '#d4a23c';
  const topScorers = scorers ? Object.entries(scorers).sort((a, b) => b[1].goals - a[1].goals).slice(0, 3) : [];

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
                <span style={{ width: 20, opacity: 0.4, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{i+1}.</span>
                <span style={{ flex: 1 }}>{name}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: mc }}>gol {d.goals}</span>
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
              <span style={{ width: 20, opacity: 0.4, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{i+1}.</span>
              <span style={{ flex: 1 }}>{name}</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: mc }}>gol {d.goals}</span>
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
