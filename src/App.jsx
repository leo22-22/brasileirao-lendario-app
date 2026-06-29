import React, { useState, useMemo, useCallback } from "react";

// ============================================================
// DADOS: 27 times campeões brasileiros lendários (1961-2006)
// Overall calibrado pela relevância histórica do jogador NAQUELA
// temporada específica (artilheiros, Bola de Prata/Ouro, recordes).
// Cada time tem titulares + reservas reais documentados da campanha.
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
// FORMAÇÕES TÁTICAS: 15 esquemas reais, cada um com a contagem
// exata de jogadores por posição (todas somam 11).
// ============================================================
const FORMATIONS = {
  '4-3-3':        { label: '4-3-3 Clássico',   counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:1, MEI:2, PD:1, PE:1, ATA:1 } },
  '4-4-2-linha':  { label: '4-4-2 (Linha)',     counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:2, PD:1, PE:1, ATA:2 } },
  '4-4-2-losango':{ label: '4-4-2 (Losango)',   counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:2, MEI:2, ATA:2 } },
  '4-2-3-1':      { label: '4-2-3-1',           counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:2, MEI:1, PD:1, PE:1, ATA:1 } },
  '3-5-2':        { label: '3-5-2',             counts: { GOL:1, ZAG:3, LD:1, LE:1, VOL:2, MEI:1, ATA:2 } },
  '3-4-3':        { label: '3-4-3',             counts: { GOL:1, ZAG:3, LD:1, LE:1, VOL:2, PD:1, PE:1, ATA:1 } },
  '4-1-4-1':      { label: '4-1-4-1',           counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:1, MEI:4, ATA:1 } },
  '5-3-2':        { label: '5-3-2',             counts: { GOL:1, ZAG:3, LD:1, LE:1, VOL:3, ATA:2 } },
  '4-5-1':        { label: '4-5-1',             counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:2, MEI:3, ATA:1 } },
  '4-3-1-2':      { label: '4-3-1-2',           counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:3, MEI:1, ATA:2 } },
  '4-1-3-2':      { label: '4-1-3-2',           counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:1, MEI:3, ATA:2 } },
  '3-4-2-1':      { label: '3-4-2-1',           counts: { GOL:1, ZAG:3, LD:1, LE:1, VOL:2, MEI:2, ATA:1 } },
  '3-2-4-1':      { label: '3-2-4-1',           counts: { GOL:1, ZAG:3, LD:1, LE:1, VOL:2, PD:1, PE:1, ATA:1 } },
  '4-2-2-2':      { label: '4-2-2-2',           counts: { GOL:1, LD:1, ZAG:2, LE:1, VOL:1, MEI:2, ATA:2, PE:1 } },
  '5-4-1':        { label: '5-4-1',             counts: { GOL:1, ZAG:3, LD:1, LE:1, VOL:1, MEI:1, PD:1, PE:1, ATA:1 } },
};

// Coordenadas-base por posição (linha de campo). Quando uma formação tem
// mais de 1 jogador na mesma posição (ex: 2 ZAG, 2 MEI), distribuímos em
// leque horizontal automaticamente em volta da coordenada-base.
const BASE_COORDS = {
  GOL: { x: 50, y: 92 },
  LD:  { x: 86, y: 76 },
  ZAG: { x: 50, y: 80 },
  LE:  { x: 14, y: 76 },
  VOL: { x: 50, y: 62 },
  MEI: { x: 50, y: 46 },
  PD:  { x: 82, y: 24 },
  PE:  { x: 18, y: 24 },
  ATA: { x: 50, y: 13 },
};

// Gera os slots do campinho (com key única por posição) a partir da formação escolhida.
function buildPitchSlots(formationKey) {
  const { counts } = FORMATIONS[formationKey];
  const slots = [];
  Object.entries(counts).forEach(([pos, qty]) => {
    const base = BASE_COORDS[pos];
    for (let i = 0; i < qty; i++) {
      const key = qty === 1 ? pos : `${pos}${i + 1}`;
      let x = base.x;
      if (qty > 1) {
        // distribui em leque horizontal: 2 -> -16/+16, 3 -> -22/0/+22
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
// MOTOR DE SIMULAÇÃO (validado: time +10 ovr vence ~60% das vezes)
// ============================================================
function teamStrength(xi) {
  const vals = Object.values(xi);
  if (vals.length === 0) return 50;
  return vals.reduce((s, p) => s + p.ovr, 0) / vals.length;
}

function poissonSample(lambda) {
  let L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function simulateMatch(myXI, oppOvr) {
  const myOvr = teamStrength(myXI);
  const diff = myOvr - oppOvr;
  const myExp = Math.max(0.3, 1.4 + diff * 0.045);
  const oppExp = Math.max(0.3, 1.4 - diff * 0.045);
  return { myGoals: poissonSample(myExp), oppGoals: poissonSample(oppExp) };
}

// ============================================================
// ESTADO E FLUXO DO DRAFT
// ============================================================
const MAX_SKIPS = 3;

export default function App() {
  const [phase, setPhase] = useState('intro'); // intro -> formation -> draft -> squad -> playing -> results
  const [formationKey, setFormationKey] = useState(null);
  const [pitchSlots, setPitchSlots] = useState([]);
  const [usedTeamIds, setUsedTeamIds] = useState([]); // times já sorteados (não repete)
  const [rolledTeam, setRolledTeam] = useState(null); // time atual exibido pra escolha
  const [isRolling, setIsRolling] = useState(false); // animação de "passando pelos times"
  const [rollingPreview, setRollingPreview] = useState(null); // time exibido durante a animação
  const [selectedPlayer, setSelectedPlayer] = useState(null); // jogador clicado, aguardando escolha de posição no campinho
  const [pitch, setPitch] = useState({}); // slotKey -> jogador escalado
  const [skipsLeft, setSkipsLeft] = useState(MAX_SKIPS);
  const [log, setLog] = useState([]); // histórico de escolhas
  const [opponents, setOpponents] = useState([]);
  const [results, setResults] = useState([]);
  const [matchIdx, setMatchIdx] = useState(0);

  const filledSlots = Object.keys(pitch);
  const remainingSlots = pitchSlots.filter(s => !filledSlots.includes(s.key));
  const draftDone = pitchSlots.length > 0 && remainingSlots.length === 0;

  const goToFormationPicker = () => {
    setPhase('formation');
  };

  // Anima a "passagem" por vários times antes de fixar o resultado real (igual caça-níquel).
  const rollWithAnimation = useCallback((finalTeam, pool) => {
    setIsRolling(true);
    setSelectedPlayer(null);
    const spinPool = pool.length > 0 ? pool : TEAMS;
    let step = 0;
    const totalSteps = 16;
    const interval = setInterval(() => {
      step++;
      setRollingPreview(shuffle2(spinPool)[0]);
      if (step >= totalSteps) {
        clearInterval(interval);
        setRollingPreview(null);
        setIsRolling(false);
        setRolledTeam(finalTeam);
      }
    }, 70 + step * 4); // desacelera ao longo da animação
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
    setPhase('draft');
    const first = shuffle2(TEAMS)[0];
    rollWithAnimation(first, TEAMS);
  };

  // Posições do campinho ainda livres que esse jogador específico pode ocupar
  const eligibleSlotsForPlayer = (player) => {
    return remainingSlots.filter(slot => player.pos.includes(slot.realPos));
  };

  // Clique no jogador: se só há 1 posição elegível, escala direto. Se há mais de 1,
  // apenas seleciona o jogador e deixa o campinho com as posições destacadas pra escolher.
  const clickPlayer = (player) => {
    const slots = eligibleSlotsForPlayer(player);
    if (slots.length === 0) return;
    if (slots.length === 1) {
      pickPlayerForSlot(player, slots[0].key);
    } else {
      setSelectedPlayer(player);
    }
  };

  // Clique numa posição destacada do campinho, confirmando onde o jogador selecionado entra.
  const clickPitchSlot = (slotKey) => {
    if (!selectedPlayer) return;
    const valid = eligibleSlotsForPlayer(selectedPlayer).some(s => s.key === slotKey);
    if (!valid) return;
    pickPlayerForSlot(selectedPlayer, slotKey);
  };

  const pickPlayerForSlot = (player, slotKey) => {
    setPitch(prev => ({ ...prev, [slotKey]: { ...player, teamLabel: rolledTeam.label, teamId: rolledTeam.id, slotKey } }));
    setUsedTeamIds(prev => [...prev, rolledTeam.id]);
    setLog(prev => [...prev, { teamLabel: rolledTeam.label, playerName: player.name, slot: slotKey }]);
    setSelectedPlayer(null);
    const stillRemaining = pitchSlots.filter(s => s.key !== slotKey && !filledSlots.includes(s.key));
    if (stillRemaining.length === 0) {
      setPhase('squad');
      setRolledTeam(null);
    } else {
      const candidates = TEAMS.filter(t => !usedTeamIds.includes(t.id) && t.id !== rolledTeam.id);
      if (candidates.length === 0) {
        setPhase('squad'); // sem mais times disponíveis, encerra com o que der
      } else {
        rollWithAnimation(shuffle2(candidates)[0], candidates);
      }
    }
  };

  // Pular o time inteiro (não escalar ninguém dele) — consome 1 pulo, sorteia outro time
  const skipTeam = () => {
    if (skipsLeft <= 0) return;
    setSkipsLeft(s => s - 1);
    setUsedTeamIds(prev => [...prev, rolledTeam.id]); // não pode cair de novo
    setLog(prev => [...prev, { teamLabel: rolledTeam.label, playerName: null, slot: null, skipped: true }]);
    setSelectedPlayer(null);
    const candidates = TEAMS.filter(t => ![...usedTeamIds, rolledTeam.id].includes(t.id));
    if (candidates.length === 0) {
      setPhase('squad');
    } else {
      rollWithAnimation(shuffle2(candidates)[0], candidates);
    }
  };

  const startSeason = () => {
    const oppPool = shuffle2(TEAMS.filter(t => !usedTeamIds.includes(t.id))).slice(0, 8);
    setOpponents(oppPool.length >= 6 ? oppPool : shuffle2(TEAMS).slice(0, 8));
    setResults([]);
    setMatchIdx(0);
    setPhase('playing');
  };


  const playNextMatch = useCallback(() => {
    const opp = opponents[matchIdx];
    const oppOvr = teamStrength(Object.fromEntries(opp.players.map((p, i) => [i, p])));
    const res = simulateMatch(pitch, oppOvr);
    setResults(prev => [...prev, { ...res, oppName: opp.label }]);
    if (matchIdx + 1 < opponents.length) {
      setMatchIdx(matchIdx + 1);
    } else {
      setPhase('results');
    }
  }, [pitch, opponents, matchIdx]);

  const restart = () => {
    setPhase('intro');
    setFormationKey(null);
    setPitchSlots([]);
    setPitch({});
    setResults([]);
    setRolledTeam(null);
  };

  const table = useMemo(() => {
    let pts = 0, gp = 0, gc = 0, v = 0, e = 0, d = 0;
    results.forEach(r => {
      gp += r.myGoals; gc += r.oppGoals;
      if (r.myGoals > r.oppGoals) { pts += 3; v++; }
      else if (r.myGoals === r.oppGoals) { pts += 1; e++; }
      else { d++; }
    });
    return { pts, gp, gc, saldo: gp - gc, v, e, d };
  }, [results]);

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>
      <div style={styles.bgTexture} />
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.crest}>★</div>
          <div>
            <div style={styles.title}>BRASILEIRÃO LENDÁRIO</div>
            <div style={styles.subtitle}>monte · escale · seja campeão</div>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {phase === 'intro' && <Intro onStart={goToFormationPicker} />}
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
            eligibleSlotsForPlayer={eligibleSlotsForPlayer}
            onClickPlayer={clickPlayer}
            onClickPitchSlot={clickPitchSlot}
            onSkipTeam={skipTeam}
          />
        )}
        {phase === 'squad' && (
          <Squad pitch={pitch} pitchSlots={pitchSlots} formationLabel={formationKey ? FORMATIONS[formationKey].label : ''} onConfirm={startSeason} onRedo={() => setPhase('formation')} />
        )}
        {phase === 'playing' && (
          <Playing
            opponents={opponents}
            matchIdx={matchIdx}
            results={results}
            table={table}
            onPlay={playNextMatch}
          />
        )}
        {phase === 'results' && (
          <Results table={table} results={results} onRestart={restart} />
        )}
      </main>
    </div>
  );
}

// ============================================================
// TELAS
// ============================================================
function Intro({ onStart }) {
  return (
    <div style={styles.card}>
      <h1 style={styles.h1}>O Brasileirão dos sonhos.</h1>
      <p style={styles.lead}>
        Escolha um esquema tático, depois role o dado: cai um time campeão brasileiro de 1961
        a 1997. Escolha um craque dele pra cada posição livre no seu campinho. Você tem 3 pulos
        pra recusar times que não te interessam. Monte os 11 e dispute um campeonato de pontos
        corridos.
      </p>
      <button style={styles.btnPrimary} onClick={onStart}>Escolher formação →</button>
    </div>
  );
}

function FormationPicker({ onChoose }) {
  return (
    <div style={styles.card}>
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

function Pitch({ pitch, pitchSlots, highlightSlots = [], onClickSlot }) {
  const highlightKeys = new Set(highlightSlots.map(s => s.key));
  return (
    <div style={styles.pitchWrap}>
      <div style={styles.pitchField}>
        <div style={styles.pitchCircle} />
        <div style={styles.pitchHalfLine} />
        {pitchSlots.map(slot => {
          const occupant = pitch[slot.key];
          const isHighlighted = highlightKeys.has(slot.key);
          const clickable = isHighlighted && !occupant && onClickSlot;
          return (
            <div
              key={slot.key}
              onClick={clickable ? () => onClickSlot(slot.key) : undefined}
              style={{
                ...styles.pitchSpot,
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                background: occupant ? '#d4a23c' : isHighlighted ? 'rgba(127,217,154,0.5)' : 'rgba(255,255,255,0.08)',
                border: isHighlighted ? '2px solid #7fd99a' : '1px solid rgba(255,255,255,0.25)',
                cursor: clickable ? 'pointer' : 'default',
                transform: isHighlighted && !occupant ? 'translate(-50%,-50%) scale(1.12)' : 'translate(-50%,-50%)',
                boxShadow: isHighlighted && !occupant ? '0 0 0 4px rgba(127,217,154,0.25)' : 'none',
              }}
              title={occupant ? `${occupant.name} (${occupant.teamLabel})` : slot.label}
            >
              {occupant ? (
                <span style={styles.pitchSpotName}>{occupant.name.split(' ')[0]}</span>
              ) : (
                <span style={styles.pitchSpotLabel}>{slot.label}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Draft({ rolledTeam, isRolling, rollingPreview, pitch, pitchSlots, formationLabel, skipsLeft, selectedPlayer, eligibleSlotsForPlayer, onClickPlayer, onClickPitchSlot, onSkipTeam }) {
  const filledCount = Object.keys(pitch).length;
  const highlightSlots = selectedPlayer ? eligibleSlotsForPlayer(selectedPlayer) : [];

  if (isRolling) {
    return (
      <div style={styles.card}>
        <div style={styles.draftTopRow}>
          <div style={styles.eyebrow}>{formationLabel} · {filledCount} de {pitchSlots.length} posições preenchidas</div>
          <div style={styles.skipsBadge}>🔁 {skipsLeft} pulo{skipsLeft !== 1 ? 's' : ''} restante{skipsLeft !== 1 ? 's' : ''}</div>
        </div>
        <Pitch pitch={pitch} pitchSlots={pitchSlots} />
        <div style={styles.rollingBox}>
          <span style={styles.diceIconSpin}>🎲</span>
          <div style={styles.rollingName}>{rollingPreview ? rollingPreview.label : '...'}</div>
          <div style={styles.rollingHint}>rolando o dado...</div>
        </div>
      </div>
    );
  }

  if (!rolledTeam) {
    return (
      <div style={styles.card}>
        <div style={styles.emptyState}>
          Os times disponíveis se esgotaram antes de completar o time. Siga com o que foi
          escalado até aqui.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.draftTopRow}>
        <div style={styles.eyebrow}>{formationLabel} · {filledCount} de {pitchSlots.length} posições preenchidas</div>
        <div style={styles.skipsBadge}>🔁 {skipsLeft} pulo{skipsLeft !== 1 ? 's' : ''} restante{skipsLeft !== 1 ? 's' : ''}</div>
      </div>

      <Pitch pitch={pitch} pitchSlots={pitchSlots} highlightSlots={highlightSlots} onClickSlot={onClickPitchSlot} />

      {selectedPlayer && (
        <div style={styles.selectedPlayerBanner}>
          Escolha a posição no campo para <b>{selectedPlayer.name}</b>
        </div>
      )}

      <div style={styles.rolledTeamBox}>
        <div style={{ ...styles.rolledTeamHeader, borderColor: rolledTeam.colors.p }}>
          <span style={styles.diceIcon}>🎲</span>
          <div>
            <div style={styles.rolledTeamLabel}>{rolledTeam.label}</div>
            <div style={styles.rolledTeamCoach}>Técnico: {rolledTeam.coach}</div>
          </div>
        </div>

        <div style={styles.elevenGrid}>
          {rolledTeam.players.map((p, i) => {
            const slots = eligibleSlotsForPlayer(p);
            const canPick = slots.length > 0;
            const isSelected = selectedPlayer && selectedPlayer.name === p.name;
            return (
              <button
                key={i}
                onClick={() => canPick && onClickPlayer(p)}
                disabled={!canPick}
                style={{
                  ...styles.elevenCard,
                  opacity: canPick ? 1 : 0.4,
                  cursor: canPick ? 'pointer' : 'not-allowed',
                  borderColor: isSelected ? '#7fd99a' : 'rgba(255,255,255,0.12)',
                  boxShadow: isSelected ? '0 0 0 2px rgba(127,217,154,0.4)' : 'none',
                }}
              >
                <div style={styles.elevenOvr}>{p.ovr}</div>
                <div style={styles.elevenName}>{p.name}</div>
                <div style={styles.elevenPos}>{p.pos.join(' / ')}</div>
                {!canPick && <div style={styles.elevenBlocked}>posição ocupada</div>}
                {canPick && slots.length > 1 && !isSelected && (
                  <div style={styles.elevenMultiHint}>{slots.length} posições · toque no campo</div>
                )}
                {isSelected && <div style={styles.elevenSelectedHint}>escolha no campo ↑</div>}
              </button>
            );
          })}
        </div>

        <button
          style={{ ...styles.btnGhost, ...(skipsLeft <= 0 ? styles.btnDisabled : {}) }}
          onClick={onSkipTeam}
          disabled={skipsLeft <= 0}
        >
          Pular este time {skipsLeft <= 0 ? '(sem pulos)' : `(usa 1 de ${skipsLeft})`}
        </button>
      </div>
    </div>
  );
}

function Squad({ pitch, pitchSlots, formationLabel, onConfirm, onRedo }) {
  const xi = Object.values(pitch);
  const avgOvr = xi.length ? Math.round(xi.reduce((s, p) => s + p.ovr, 0) / xi.length) : 0;
  return (
    <div style={styles.card}>
      <div style={styles.eyebrow}>{formationLabel}</div>
      <h2 style={styles.h2}>Overall médio: {avgOvr}</h2>
      <Pitch pitch={pitch} pitchSlots={pitchSlots} />
      <div style={styles.squadList}>
        {pitchSlots.map(slot => {
          const p = pitch[slot.key];
          return (
            <div key={slot.key} style={styles.squadRow}>
              <span style={styles.squadPos}>{slot.label}</span>
              <span style={styles.squadName}>{p ? p.name : '— vazio —'}</span>
              <span style={styles.squadTeam}>{p ? p.teamLabel : ''}</span>
              <span style={styles.squadOvr}>{p ? p.ovr : ''}</span>
            </div>
          );
        })}
      </div>
      <div style={styles.btnRow}>
        <button style={styles.btnGhost} onClick={onRedo}>Trocar formação</button>
        <button style={styles.btnPrimary} onClick={onConfirm}>Disputar o Brasileirão →</button>
      </div>
    </div>
  );
}

function Playing({ opponents, matchIdx, results, table, onPlay }) {
  const opp = opponents[matchIdx];
  const done = results.length === opponents.length;

  return (
    <div style={styles.card}>
      <div style={styles.eyebrow}>Rodada {Math.min(results.length + 1, opponents.length)} de {opponents.length}</div>
      <h2 style={styles.h2}>{done ? 'Campeonato encerrado' : `Próximo: vs ${opp.label}`}</h2>

      <div style={styles.tableBar}>
        <span><b>{table.pts}</b> pts</span>
        <span>{table.v}V {table.e}E {table.d}D</span>
        <span>saldo {table.saldo >= 0 ? '+' : ''}{table.saldo}</span>
      </div>

      {results.length > 0 && (
        <div style={styles.resultsList}>
          {results.map((r, i) => (
            <div key={i} style={styles.resultRow}>
              <span style={styles.resultScore}>{r.myGoals} – {r.oppGoals}</span>
              <span style={styles.resultOpp}>{r.oppName}</span>
              <span style={{
                ...styles.resultTag,
                color: r.myGoals > r.oppGoals ? '#7fd99a' : r.myGoals === r.oppGoals ? '#d4a23c' : '#e0593f'
              }}>
                {r.myGoals > r.oppGoals ? 'VITÓRIA' : r.myGoals === r.oppGoals ? 'EMPATE' : 'DERROTA'}
              </span>
            </div>
          ))}
        </div>
      )}

      {!done && <button style={styles.btnPrimary} onClick={onPlay}>Simular jogo →</button>}
    </div>
  );
}

function Results({ table, results, onRestart }) {
  const isChampion = table.pts >= results.length * 2.2;
  const perfectSeven = results.length === 8 && table.v === 8 && table.gc === 0;

  return (
    <div style={styles.card}>
      <div style={styles.eyebrow}>Resultado final</div>
      <h1 style={styles.h1}>{table.pts} pontos em {results.length} jogos</h1>
      <div style={styles.finalStats}>
        <Stat label="Vitórias" value={table.v} />
        <Stat label="Empates" value={table.e} />
        <Stat label="Derrotas" value={table.d} />
        <Stat label="Gols pró" value={table.gp} />
        <Stat label="Gols contra" value={table.gc} />
        <Stat label="Saldo" value={(table.saldo >= 0 ? '+' : '') + table.saldo} />
      </div>
      {perfectSeven && <div style={styles.badge}>🏆 CAMPANHA PERFEITA — invicto e sem levar gol!</div>}
      {!perfectSeven && isChampion && <div style={styles.badge}>🏆 Campanha de campeão!</div>}
      {!isChampion && <div style={styles.badgeMuted}>Campanha honesta — tente um time mais equilibrado na próxima.</div>}
      <button style={styles.btnPrimary} onClick={onRestart}>Jogar de novo →</button>
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
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; }
    [style*="animation"] { animation: none !important; }
  }
`;

const styles = {
  page: { minHeight: '100vh', background: '#0B1A12', color: '#F4F1EA', fontFamily: "'Source Sans 3', system-ui, sans-serif", position: 'relative', overflow: 'hidden' },
  bgTexture: { position: 'fixed', inset: 0, opacity: 0.05, background: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 40px)', pointerEvents: 'none' },
  header: { borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'relative', zIndex: 1 },
  headerInner: { maxWidth: 720, margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 },
  crest: { fontSize: 22, color: '#d4a23c' },
  title: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, letterSpacing: 0.5 },
  subtitle: { fontFamily: "'Space Mono', monospace", fontSize: 11, opacity: 0.6, letterSpacing: 1, textTransform: 'uppercase' },
  main: { maxWidth: 720, margin: '0 auto', padding: '32px 24px 80px', position: 'relative', zIndex: 1 },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32 },
  h1: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 34, lineHeight: 1.15, margin: '0 0 16px' },
  h2: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, margin: '4px 0 20px' },
  lead: { fontSize: 16, lineHeight: 1.6, opacity: 0.85, marginBottom: 28 },
  eyebrow: { fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#d4a23c' },
  skipsBadge: { fontSize: 12, padding: '6px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 999 },
  draftTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  btnPrimary: { background: '#d4a23c', color: '#0B1A12', border: 'none', borderRadius: 10, padding: '14px 28px', fontSize: 16, fontWeight: 700 },
  btnGhost: { background: 'transparent', color: '#F4F1EA', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '12px 24px', fontSize: 14, marginTop: 16, width: '100%' },
  btnDisabled: { opacity: 0.35 },
  btnRow: { display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' },
  emptyState: { background: 'rgba(224,89,63,0.1)', border: '1px solid rgba(224,89,63,0.4)', borderRadius: 10, padding: '16px 18px', fontSize: 14, lineHeight: 1.5 },

  formationGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 },
  formationCard: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '14px 12px', color: '#F4F1EA', textAlign: 'center' },
  formationName: { fontSize: 13, fontWeight: 700, marginBottom: 10, fontFamily: "'Space Mono', monospace" },
  miniPitch: { position: 'relative', width: '100%', aspectRatio: '0.7', background: 'linear-gradient(180deg, #0f3d22, #145c30)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)' },
  miniDot: { position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: '#d4a23c', transform: 'translate(-50%,-50%)' },

  pitchWrap: { margin: '20px 0', display: 'flex', justifyContent: 'center' },
  pitchField: {
    position: 'relative', width: '100%', maxWidth: 380, aspectRatio: '0.68',
    background: 'linear-gradient(180deg, #0f3d22 0%, #145c30 50%, #0f3d22 100%)',
    border: '2px solid rgba(255,255,255,0.3)', borderRadius: 8, overflow: 'hidden',
  },
  pitchCircle: { position: 'absolute', left: '50%', top: '50%', width: 70, height: 70, border: '1px solid rgba(255,255,255,0.25)', borderRadius: '50%', transform: 'translate(-50%,-50%)' },
  pitchHalfLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(255,255,255,0.25)' },
  pitchSpot: {
    position: 'absolute', width: 46, height: 46, borderRadius: '50%',
    transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', fontSize: 9, textAlign: 'center', lineHeight: 1.1, transition: 'background 0.2s',
  },
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

  tableBar: { display: 'flex', gap: 20, fontSize: 14, marginBottom: 20, padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 10 },
  resultsList: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 },
  resultRow: { display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: 12, alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 14 },
  resultScore: { fontFamily: "'Space Mono', monospace", fontWeight: 700 },
  resultOpp: { opacity: 0.8 },
  resultTag: { fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 },
  finalStats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 },
  statBox: { background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '16px 12px', textAlign: 'center' },
  statValue: { fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: '#d4a23c' },
  statLabel: { fontSize: 11, opacity: 0.6, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  badge: { background: 'rgba(212,162,60,0.15)', border: '1px solid #d4a23c', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontWeight: 600 },
  badgeMuted: { background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, opacity: 0.7, fontSize: 14 },
};
