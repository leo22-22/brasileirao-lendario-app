-- ============================================================
-- BRASILEIRAO LENDARIO - SQL COMPLETO
-- Todos os times historicos 1959-2026
-- 20 jogadores por time com overall calibrado
-- Compativel com MySQL / MariaDB / PostgreSQL
-- ============================================================

SET NAMES utf8mb4;

DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS teams;

CREATE TABLE teams (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  club            VARCHAR(60)  NOT NULL,
  year            SMALLINT     NOT NULL,
  label           VARCHAR(100) NOT NULL,
  coach           VARCHAR(80)  NOT NULL,
  color_primary   VARCHAR(7)   NOT NULL DEFAULT '#000000',
  color_secondary VARCHAR(7)   NOT NULL DEFAULT '#ffffff',
  notes           TEXT,
  INDEX idx_year (year),
  INDEX idx_club (club)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE players (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  team_id       INT         NOT NULL,
  jersey        TINYINT     NOT NULL,
  name          VARCHAR(80) NOT NULL,
  pos_primary   VARCHAR(4)  NOT NULL COMMENT 'GOL LD ZAG LE VOL MEI PD PE ATA',
  pos_secondary VARCHAR(20) NULL,
  pos_terciaria VARCHAR(4)  NULL,
  pos_quaternaria VARCHAR(4) NULL,
  overall       TINYINT     NOT NULL COMMENT '40-99',
  is_starter    TINYINT(1)  NOT NULL DEFAULT 1 COMMENT '1=titular 0=reserva',
  notes         TEXT,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  INDEX idx_team (team_id),
  INDEX idx_ovr  (overall)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- TITULARES
-- ============================================================
-- REGISTRO DOS TIMES 1 A 9 (estavam ausentes no arquivo original)
-- ============================================================
INSERT INTO teams VALUES (1,'Bahia',1959,'Bahia 1959 (Taca Brasil)','Gradim','#003399','#C8102E','Primeiro campeao brasileiro da historia. Bateu o Santos de Pele na final.');
INSERT INTO teams VALUES (2,'Santos',1961,'Santos 1961 (Taca Brasil)','Lula','#000000','#ffffff','Primeiro titulo nacional do Santos. Inicio da era mais gloriosa do clube.');
INSERT INTO teams VALUES (3,'Santos',1962,'Santos 1962 (Campeao do Mundo)','Lula','#000000','#ffffff','Libertadores, Mundial e Taca Brasil no mesmo ano. O maior time do planeta.');
INSERT INTO teams VALUES (4,'Botafogo',1968,'Botafogo 1968 (Robertao)','Zagallo','#000000','#ffffff','Gerson, Jairzinho, Paulo Cezar Caju e Roberto. Talento puro em General Severiano.');
INSERT INTO teams VALUES (5,'Fluminense',1970,'Fluminense 1970','Paulo Amaral','#7A1921','#006633','Felix, Marco Antonio, Cafuringa e Didi. Base da futura Maquina Tricolor.');
INSERT INTO teams VALUES (6,'Atletico-MG',1971,'Atletico-MG 1971 (1o Brasileirao)','Telê Santana','#000000','#ffffff','Campeao da primeira edicao unificada do Brasileirao. Dadá Maravilha artilheiro.');
INSERT INTO teams VALUES (7,'Palmeiras',1972,'Palmeiras 1972 (Academia)','Osvaldo Brandao','#006437','#ffffff','A Academia de Ademir da Guia, Leivinha, Luis Pereira e Leao. Campeao brasileiro.');
INSERT INTO teams VALUES (8,'Palmeiras',1973,'Palmeiras 1973 (Bicampeao)','Osvaldo Brandao','#006437','#ffffff','Bicampeonato nacional consecutivo com a Segunda Academia em altissimo nivel.');
INSERT INTO teams VALUES (9,'Vasco',1974,'Vasco 1974 (Campeao Brasileiro)','Mario Travaglini','#000000','#ffffff','Roberto Dinamite no auge e o gol historico de Jorginho Carvoeiro no Maracana.');

INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,1,'Nadinho','GOL',NULL,85,1,'Goleiro seguro e heroi nas finais contra o Santos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,2,'Leone','LD','ZAG',82,1,'Lateral de muita forca fisica e excelente marcador.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,3,'Henrique','ZAG',NULL,84,1,'O grande lider da defesa tricolor na campanha de 1959.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,4,'Nenzinho','LE','ZAG',81,1,'Lateral esquerdo firme no apoio e eficiente na recomposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,7,'Vicente','ZAG','VOL',84,1,'Polivalente defensivo, jogou na zaga na final e anulou o ataque do Santos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,6,'Flávio','VOL','MC',83,1,'Volante classico de boa saida de bola e distribuicao no meio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,8,'Mário','MEI','ME',81,1,'O cerebro do meio-campo, articulador inteligente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,11,'Marito','PD','MD',86,1,'Ponta de extrema velocidade, infernizava as defesas adversarias.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,17,'Biriba','PE','ME',84,1,'Jovem ponta-esquerda decisivo, autor de gols cruciais nas finais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,9,'Léo Briglia','ATA',NULL,88,1,'Artilheiro maximo da Taca Brasil de 1959 com 8 gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,10,'Alencar','ATA',NULL,85,1,'Atacante extremamente vertical e decisivo nas tres partidas da final.');

-- RESERVAS E ROTACAO
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,5,'Hermínio','ZAG',NULL,79,0,'Zagueiro firme que atuou em grande parte da campanha como titular.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,12,'Florisvaldo','LD','ZAG',74,0,'Reserva imediato da linha defensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,13,'Bacamarte','ZAG',NULL,73,0,'Zagueiro reserva de pouca minutagem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,14,'Beto','MC','VOL',78,0,'Meia de ligacao que entrava para dar consistencia ao setor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,15,'Bombeiro','MC','MD',75,0,'Jogador de composicao no elenco tricolor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,16,'Ari','MEI','MD',76,0,'Reserva para o setor de criacao ofensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,18,'Carioca','ATA','PD',75,0,'Atacante reserva de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,19,'Careca','ATA',NULL,74,0,'Centroavante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (1,20,'Jair','GOL',NULL,72,0,'Goleiro reserva imediato de Nadinho.');

-- TITULARES
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,12,'Laercio','GOL',NULL,81,1,'O verdadeiro titular do gol santista na Taca Brasil de 1961.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,2,'Lima','LD','MC',82,1,'O Curinga da Vila. Atuava na lateral, no meio e na ponta com extrema qualidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,3,'Mauro','ZAG',NULL,86,1,'Zagueiro de elegancia e antecipacao raras, o xerife da area santista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,4,'Calvet','ZAG',NULL,84,1,'Zagueiro classico e tecnico, formou dupla perfeita com Mauro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,5,'Dalmo','LE','ZAG',83,1,'Lateral esquerdo muito seguro na marcacao e batedor oficial de penaltis.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,6,'Zito','VOL','MC',88,1,'O Gerente. Lideranca maxima dentro de campo e motor do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,7,'Mengalvio','MC','VOL',86,1,'Meia de passos longos, cadencia perfeita e passes milimetricos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,8,'Dorval','PD','MD',85,1,'Veloz e habilidoso, dono absoluto da ponta direita.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,9,'Coutinho','ATA',NULL,89,1,'Genio da grande area e parceiro perfeito de tabelas com Pele.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,10,'Pele','ATA','MEI',99,1,'O Rei do Futebol em seu auge fisico e tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,11,'Pepe','PE','ME',88,1,'O Canhao da Vila. Dono de um chute esquerdo devastador e artilheiro.');

-- RESERVAS E ROTACAO
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,1,'Gylmar','GOL',NULL,86,0,'Bicampeao do mundo que chegou no final do ano para assumir o gol em 1962.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,13,'Fioti','LD',NULL,73,0,'Lateral direito de oficio e reserva imediato.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,14,'Formiga','ZAG','VOL',76,0,'Veterano polivalente de muita raca que cobria zaga e meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,15,'Getulio','LE',NULL,72,0,'Lateral esquerdo reserva da equipe.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,16,'Pagao','ATA',NULL,80,0,'Centroavante de refinamento tecnico absurdo, reserva de luxo de Coutinho.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,17,'Tite','PE','ME',76,0,'Ponta esquerda experiente, reserva de Pepe.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,18,'Sormani','PD',NULL,75,0,'Ponta direita jovem que depois faria historia na Italia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,19,'Brandao','VOL',NULL,72,0,'Meio-campista marcador para dar suporte defensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (2,20,'Nene','ATA','MEI',74,0,'Atacante reserva promissor da base santista.');

-- TITULARES
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,1,'Gylmar','GOL',NULL,91,1,'Bicampeao do mundo por clube e selecao no mesmo ano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,2,'Lima','LD','MC',86,1,'O Curinga. Jogou o Mundial na lateral e a final da Libertadores no meio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,3,'Mauro','ZAG',NULL,89,1,'Capitao incontestavel do Santos e da Selecao Brasileira. Zagueiro de classe mundial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,4,'Calvet','ZAG',NULL,86,1,'Zagueiro tecnico, fundamental nos titulos internacionais do ano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,5,'Dalmo','LE','ZAG',85,1,'Dono da lateral esquerda, cobrador oficial de penaltis.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,6,'Zito','VOL','MC',92,1,'O lider supremo em campo, dita o ritmo do maior time do mundo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,7,'Mengalvio','MC','VOL',87,1,'Cadencia e visao de jogo perfeitas no meio-campo santista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,8,'Dorval','PD','MD',88,1,'Velocidade pura na ponta direita e garcon de Coutinho.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,9,'Coutinho','ATA',NULL,93,1,'Artilheiro da Libertadores 1962 e genio das tabelas com Pele.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,10,'Pele','ATA','MEI',99,1,'O Rei do Futebol. Destruiu o Benfica em Lisboa com 3 gols no Mundial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,11,'Pepe','PE','ME',91,1,'O Canhao da Vila, devastador na ponta esquerda.');

-- RESERVAS E ROTACAO
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,12,'Laercio','GOL',NULL,78,0,'Goleiro reserva imediato de altissimo nivel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,13,'Ismael','LD','ZAG',76,0,'Lateral direito reserva muito acionado quando Lima subia ao meio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,14,'Formiga','ZAG','VOL',76,0,'Veterano polivalente de confianca do tecnico Lula.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,15,'Decio Brito','LE',NULL,73,0,'Lateral esquerdo reserva de bom vigor fisico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,16,'Tite','PE','ME',75,0,'Ponta esquerda reserva experiente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,17,'Pagao','ATA',NULL,80,0,'Centroavante genial, reserva de luxo de Coutinho.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,18,'Toninho Guerreiro','ATA',NULL,79,0,'Contratado em 62, comecava sua trajetoria de muitos gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,19,'Oswaldo','PD','ATA',74,0,'Atacante reserva de velocidade para os lados do campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (3,20,'Bibe','MEI',NULL,73,0,'Meio-campista jovem que compunha o elenco campeao.');

-- TITULARES
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,1,'Cao','GOL',NULL,79,1,'Goleiro seguro, muito regular sob as traves do Glorioso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,2,'Moreira','LD',NULL,80,1,'Lateral direito de muita consistencia defensiva e otimo senso de posicionamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,3,'Ze Carlos','ZAG',NULL,83,1,'Zagueiro muito tecnico, elegante na saida de bola e desarmes precisos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,4,'Leonidas','ZAG',NULL,81,1,'Xerife de area de muita imposicao fisica e excelente jogo aereo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,5,'Waltencir','LE',NULL,81,1,'Lateral esquerdo moderno para a epoca, forte no apoio ofensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,6,'Carlos Roberto','VOL','MC',84,1,'Volante marcador implacavel que dava sustentacao e liberdade para Gerson criar.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,7,'Gerson','MEI','VOL',94,1,'O Canhotinha de Ouro. O maior passador de longa distancia do futebol mundial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,8,'Rogerio','PD','MD',82,1,'Ponta direita veloz e tatico, especialista em servir os companheiros.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,9,'Roberto','ATA',NULL,84,1,'Centroavante inteligente que abria espacos na defesa adversaria.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,10,'Jairzinho','ATA','PD',94,1,'O Furacao. Forca fisica absurda, velocidade e faro de gol impecavel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,11,'Paulo Cezar Caju','PE','ME',89,1,'Genio tecnico irreverente, dribles curtos plasticos e muita personalidade.');

-- RESERVAS E ROTACAO
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,12,'Ubirajara Motta','GOL',NULL,77,0,'Goleiro reserva experiente e de excelente colocacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,13,'Chiquinho Pastor','ZAG',NULL,75,0,'Zagueiro reserva de otimo porte fisico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,14,'Dimas','ZAG','LE',74,0,'Polivalente do setor defensivo que cobria zaga e lateral.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,15,'Nei Conceicao','VOL','MC',79,0,'Meio-campista reserva de muita qualidade e refinamento tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,16,'Zequinha','PD','MD',77,0,'Ponta direita de boa velocidade e muito acionado.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,17,'Ferretti','ATA',NULL,82,0,'Artilheiro reserva decisivo na reta final da Taca Brasil de 68.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,18,'Humberto','ATA',NULL,74,0,'Centroavante reserva de oficio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,19,'Afonsinho','MC','VOL',78,0,'Meio-campista tatico de muito futebol e muita lucidez em campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (4,20,'Torino','PE','ATA',75,0,'Ponta de forca que atuava pelos dois lados do ataque.');

-- TITULARES
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,1,'Felix','GOL',NULL,88,1,'Goleiro tricampeao do mundo em 1970. Agil e muito elastico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,2,'Oliveira','LD',NULL,79,1,'Lateral direito de excelente poder de marcacao e vigor fisico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,3,'Galhardo','ZAG',NULL,80,1,'Zagueiro seguro de otima antecipacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,4,'Assis','ZAG',NULL,81,1,'O xerife e lider absoluto do miolo de zaga tricolor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,5,'Marco Antonio','LE','ME',85,1,'Lateral esquerdo de extrema tecnica, campeao do mundo no Mexico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,6,'Denilson','VOL','ZAG',84,1,'O Rei do Carrinho. Volante destruidor indispensavel no meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,7,'Didi','MC','VOL',86,1,'Meio-campista operario de muita entrega tatica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,8,'Samarone','MEI',NULL,83,1,'O Diabo Loiro. Maestro inteligente, organizava todas as acoes do time.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,9,'Cafuringa','PD','MD',81,1,'Velocidade impressionante na ponta direita, especialista em cruzamentos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,10,'Flavio Minuano','ATA',NULL,85,1,'Centroavante artilheiro implacavel, faro de gol apuradissimo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,11,'Lula','PE','ME',82,1,'Ponta esquerda agudo, de drible facil e muito decisivo.');

-- RESERVAS E ROTACAO
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,12,'Jorge Vitorio','GOL',NULL,73,0,'Goleiro reserva seguro quando acionado.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,13,'Toninho','LD','MC',74,0,'Lateral direito reserva para compor o setor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,14,'Silveira','ZAG','VOL',78,0,'Curinga defensivo muito acionado pelo tecnico Paulo Amaral.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,15,'Lulinha','MEI','MD',72,0,'Jovem meia reserva promissor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,16,'Claudio Garcia','PD','MEI',76,0,'Meia-atacante dinâmico que mudava o ritmo do jogo vindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,17,'Wilton','PD',NULL,74,0,'Reserva de velocidade para os lados do campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,18,'Mickey','ATA',NULL,83,0,'O Iluminado. Marcou os gols mais importantes do quadrangular final do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,19,'Gilson Nunes','PE','ME',76,0,'Ponta esquerda reserva de otimo nivel tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (5,20,'Jair','ATA','MC',71,0,'Atacante reserva de apoio tatico.');

-- TITULARES
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,1,'Renato','GOL',NULL,82,1,'Goleiro seguro e peca fundamental no titulo de 1971.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,2,'Humberto Monteiro','LD',NULL,79,1,'Lateral direito firme no apoio e na marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,3,'Grapete','ZAG',NULL,81,1,'Zagueiro historico do Galo, raca pura e desarmes cirurgicos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,4,'Vantuir','ZAG',NULL,83,1,'Zagueiro tecnico de alto nivel e soberano no jogo aereo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,5,'Oldair','LE','ZAG',83,1,'Capitao do time, grande lideranca e eximio batedor de faltas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,6,'Vanderlei Paiva','VOL',NULL,83,1,'O motorzinho do meio-campo, dava ritmo e combatividade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,7,'Ronaldo Drumond','MEI','PD',80,1,'Meia-atacante ofensivo de muita movimentacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,8,'Humberto Ramos','MEI',NULL,81,1,'Meia cerebral, autor do cruzamento para o gol do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,9,'Lola','ATA','PD',81,1,'Ponta-de-lanca habilidoso que recuava para ajudar na criacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,10,'Dario','ATA',NULL,89,1,'Dada Maravilha. Parava no ar, artilheiro do campeonato e autor do gol do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,11,'Tião','PE','ME',79,1,'Ponta esquerda muito tatico de recomposicao veloz.');

-- RESERVAS E ROTACAO
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,12,'Careca','GOL',NULL,72,0,'Goleiro reserva do elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,13,'Zica','LD',NULL,73,0,'Lateral direito suplente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,14,'Bibi','LE',NULL,74,0,'Lateral esquerdo reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,15,'Nadir','ZAG',NULL,74,0,'Zagueiro reserva do elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,16,'Danilo','VOL','MC',75,0,'Volante de contencao reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,17,'Spencer','MEI','ME',74,0,'Meio-campista de rotacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,18,'Caldeira','PE',NULL,76,0,'Ponta esquerda reserva bastante acionado no ano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,19,'Guara','ATA',NULL,73,0,'Atacante de oficio reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (6,20,'Romeu','ATA',NULL,72,0,'Jovem atacante suplente.');

-- TITULARES
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,1,'Ademir da Guia','MC','MEI',96,1,'O Divino. Elegancia, controle mental de jogo e passes milimetricamente perfeitos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,2,'Leivinha','MEI','ATA',91,1,'Meio-campista de refinamento fantastico, excelente cabeceador e muito artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,3,'Luís Pereira','ZAG',NULL,93,1,'Luisao. Um dos maiores zagueiros do futebol mundial, seguro e com tecnica de armador.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,4,'Emerson Leão','GOL',NULL,91,1,'Goleiro elastico, de reflexo absurdo e lider de extrema personalidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,5,'Dudu','VOL','MC',89,1,'O motor e carregador de piano perfeito de Ademir da Guia no meio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,6,'César Maluco','ATA',NULL,89,1,'Centroavante artilheiro irreverente, oportunista e goleador da campanha.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,7,'Eurico','LD',NULL,85,1,'Lateral direito muito seguro e de excelente recomposicao tática.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,8,'Alfredo Mostarda','ZAG',NULL,84,1,'Zagueiro de muita raca e otimo senso de cobertura ao lado de Luis Pereira.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,9,'Zeca','LE',NULL,83,1,'Lateral esquerdo firme na marcacao e preciso no apoio pelas alas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,10,'Edu Bala','PD','MD',84,1,'Ponta direita de velocidade incrivel, abria as defesas pelas pontas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,11,'Nei','PE','ME',84,1,'Ponta esquerda inteligente e muito participativo no esquema de Brandao.');

-- RESERVAS E ROTACAO
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,12,'Ronaldo','ATA','PD',81,0,'Reserva de ataque que cumpria funcoes taticas em velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,13,'Madurga','MC','MEI',82,0,'Meio-campista argentino refinado de otimo toque de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,14,'Polaco','ZAG','LE',78,0,'Curinga da linha defensiva do elenco palmeirense.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,15,'Fedato','ATA',NULL,78,0,'Centroavante de area reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,16,'Pio','PE','ATA',79,0,'Ponta de forca fisica e chute potente de longa distancia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,17,'João Carlos','LD','ZAG',76,0,'Suplente da lateral direita.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,18,'Bernard','GOL',NULL,77,0,'Goleiro reserva imediato de Emerson Leao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,19,'Marinho','VOL','MC',78,0,'Volante combativo para reter resultados no segundo tempo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (7,20,'Celso','MC','MEI',75,0,'Meio-campista de rotacao.');

-- TITULARES
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,1,'Ademir da Guia','MC','MEI',96,1,'O Divino. Maestro incomparavel e dono do ritmo do bicampeao nacional.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,2,'Luís Pereira','ZAG',NULL,94,1,'Melhor zagueiro do Brasil. Dono da area, fez um campeonato impecavel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,3,'Leivinha','MEI','ATA',91,1,'Craque do setor ofensivo, aliando gols importantes a muita plasticidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,4,'Emerson Leão','GOL',NULL,92,1,'Temporada brilhante, liderou a defesa menos vazada da historia do campeonato.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,5,'Dudu','VOL','MC',89,1,'A engrenagem silenciosa da Academia. Marcador infatigavel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,6,'César Maluco','ATA',NULL,88,1,'Goleador implacavel e herói das frentes de ataque alviverdes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,7,'Alfredo Mostarda','ZAG',NULL,85,1,'Teve o auge de sua forma tecnica, formando a zaga historica com Luis Pereira.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,8,'Eurico','LD',NULL,85,1,'Lateral direito de extrema seguranca na retaguarda defensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,9,'Zeca','LE',NULL,83,1,'Muito solido defensivamente e forte na recomposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,10,'Edu Bala','PD','MD',84,1,'Explosao e drible em velocidade pelas pontas tracionando contra-ataques.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,11,'Nei','PE','ME',83,1,'Muito operario no sistema de Brandao, fechava o corredor esquerdo.');

-- RESERVAS E ROTACAO
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,12,'Ronaldo','ATA','PD',81,0,'Ponta de velocidade bastante acionado nas rotacoes do campeonato.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,13,'Fedato','ATA',NULL,78,0,'Centroavante de area suplente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,14,'Polaco','ZAG','LE',77,0,'Curinga util na linha defensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,15,'Pio','PE','ATA',79,0,'Ponta de forca fisica e otimo finalizador de longa distancia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,16,'Toninho Vanusa','MC','MEI',78,0,'Substituto imediato das posicoes de criacao do meio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,17,'De Rosis','VOL','MC',76,0,'Meio-campista marcador.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,18,'João Carlos','LD','ZAG',75,0,'Lateral reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,19,'Bernard','GOL',NULL,77,0,'Goleiro reserva com plena confianca do elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (8,20,'Édson','MC','ME',75,0,'Meio-campista de rotacao.');

-- TITULARES
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,1,'Roberto Dinamite','ATA',NULL,94,1,'A consolidacao do mito. Artilheiro do Brasileirao e motor da conquista vascaína.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,2,'Andrada','GOL',NULL,87,1,'Goleiro seguro, elastico, de posicionamento excepcional sob as traves.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,3,'Zanata','MC','MEI',84,1,'Meio-campista completo de excelente passe e muita participacao na transicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,4,'Alcir','VOL','MC',83,1,'Alcir Portela. Lider, xerife do meio-campo e protecao da defesa vascaína.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,5,'Miguel','ZAG',NULL,83,1,'Zagueiro vigoroso e muito seguro nos duelos individuais na area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,6,'Fidélis','LD',NULL,82,1,'Lateral direito experiente, muito forte na marcacao e no posicionamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,7,'Alfinete','LE','LD',81,1,'Lateral de boa capacidade de improvisacao e apoio pelos dois lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,8,'Moisés','ZAG',NULL,82,1,'Zagueiro raçudo e de muita raca, o grande xerife da zaga de Travaglini.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,9,'Jorginho Carvoeiro','PD','MD',83,1,'Autor do historico gol do titulo contra o Cruzeiro no Maracana.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,10,'Luiz Carlos','PE','ME',81,1,'Ponta esquerda habilidoso e muito vertical, municiando Dinamite.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,11,'Ademir','MEI','MC',81,1,'Meia-atacante agudo e de otima visao para acelerar as jogadas.');

-- RESERVAS E ROTACAO
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,12,'Joel Santana','ZAG','LD',78,0,'Zagueiro reserva que atuava com frequencia na lateral direita de oficio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,13,'Peres','MC','MEI',77,0,'Reserva imediato das posicoes centrais do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,14,'Paulo César','LE',NULL,76,0,'Lateral esquerdo suplente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,15,'Mazarópi','GOL',NULL,78,0,'Jovem goleiro reserva promissor que faria grande historia anos depois.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,16,'Fred','VOL','MC',75,0,'Volante de contencao de forca fisica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,17,'Amarildo','ATA',NULL,76,0,'Experiente atacante reserva de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,18,'Jaílson','PD','ATA',74,0,'Ponta reserva de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,19,'Gaúcho','ZAG','MC',74,0,'Curinga defensivo suplente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (9,20,'Galdino','PE','ME',73,0,'Suplente da ponta esquerda.');

-- =========================================================================
-- REGISTRO DO TIME
-- =========================================================================
INSERT INTO teams VALUES (10, 'Internacional', 1975, 'Internacional 1975/1976', 'Rubens Minelli', '#FF0000', '#FFFFFF', 'Falcão, Figueroa, Carpegiani e Manga. Bicampeões Brasileiros 75/76. Esquadrão Imortal.');

-- =========================================================================
-- TITULARES
-- =========================================================================
INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 1, 'Falcão', 'VOL', 'MC', 95, 1, 'O Rei de Roma. Tecnica inacreditavel, visao impecavel e elegancia incomparavel.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 2, 'Figueroa', 'ZAG', NULL, 96, 1, 'Don Elias. Zagueiro lendario do futebol sul-americano e autor do Gol Iluminado na final.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 3, 'Carpegiani', 'MC', 'MEI', 91, 1, 'Meio-campista cerebral de muita visao de jogo e qualidade extrema nos passes.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 4, 'Manga', 'GOL', NULL, 90, 1, 'Uma lenda sob as traves, elastico, seguro e de carater vencedor místico.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 5, 'Lula', 'PE', 'ME', 87, 1, 'Ponta esquerda habilidoso, velocissimo e de drible facil.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 6, 'Valdomiro', 'PD', 'MD', 88, 1, 'Ponta direita de forca, cruzamentos cirurgicos e heroi das bolas paradas.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 7, 'Flávio Minuano', 'ATA', NULL, 87, 1, 'Grande centroavante artilheiro, faro de gol e definicao cirurgica na area.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 8, 'Caçapava', 'VOL', 'MC', 85, 1, 'O esteio de contencao defensiva no meio-campo, liberando Falcao e Carpegiani.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 9, 'Vacaria', 'LE', NULL, 84, 1, 'Lateral de muita seguranca defensiva e excelente cruzador.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 10, 'Hermínio', 'ZAG', NULL, 83, 1, 'Zagueiro seguro que complementava com precisao o brilhantismo de Figueroa.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 11, 'Valdir', 'LD', NULL, 83, 1, 'Lateral direito muito firme e eficiente nas coberturas taticas.');


-- =========================================================================
-- RESERVAS E ROTAÇÃO
-- =========================================================================
INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 12, 'Batista', 'VOL', 'MC', 82, 0, 'Jovem volante de muita tecnica e que seria titular incontestavel logo depois.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 13, 'Jair', 'MEI', 'MC', 81, 0, 'Meia-atacante de excelente conducao e otimo drible.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 14, 'Cláudio Duarte', 'LD', 'ZAG', 78, 0, 'Curinga defensivo muito solido quando acionado.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 15, 'Ramon', 'ATA', 'MD', 77, 0, 'Centroavante de area reserva.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 16, 'Chico Spina', 'PD', 'ATA', 78, 0, 'Atacante veloz que entrava para quebrar linhas de marcacao.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 17, 'Schneider', 'GOL', NULL, 76, 0, 'Goleiro reserva de Manga.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 18, 'Borjão', 'ATA', NULL, 75, 0, 'Centroavante de oficio suplente.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 19, 'Escurinho', 'ATA', 'MEI', 79, 0, 'O reserva de ouro definitivo. Entrava de centroavante para resolver no jogo aereo.');

INSERT INTO players (team_id, jersey, name, pos_primary, pos_secondary, overall, is_starter, notes) 
VALUES (10, 20, 'Edinho', 'LE', 'ME', 74, 0, 'Reserva da lateral esquerda.');

INSERT INTO teams VALUES (11,'Corinthians',1977,'Corinthians 1977','Oswaldo Brandao','#000000','#ffffff','Ze Maria, Basilio, Palinha e Wladimir. Campeoes do Brasileiro 1977. Lendario elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,1,'Tobias','GOL',NULL,NULL,NULL,84,1,'Goleiro seguro, heroi das semifinais do ano anterior contra o Fluminense.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,2,'Zé Maria','LD','MD',NULL,NULL,89,1,'O Super Ze. Lateral de raca pura, forca fisica e cruzamentos precisos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,3,'Wladimir','LE','ME',NULL,NULL,89,1,'Lenda absoluta do clube, regularidade impressionante na lateral.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,4,'Moisés','ZAG',NULL,NULL,NULL,84,1,'O Xerife. Zagueiro de muita imposicao fisica e lideranca nata.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,5,'Ademir','ZAG',NULL,NULL,NULL,82,1,'Formou a dupla titular com Moises na finalissima de 77.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,6,'Ruço','VOL','MC',NULL,NULL,83,1,'O Beleza. Muita entrega na marcacao e pisava na area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,7,'Basílio','MC','MEI','ATA',NULL,86,1,'O Pe de Anjo. Marcou o gol mais importante da historia do clube.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,8,'Palhinha','MEI','ATA','MC',NULL,90,1,'Contratacao mais cara do futebol brasileiro na epoca, genialidade que faltava.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,9,'Vaguinho','PD','ATA',NULL,NULL,85,1,'Autor do gol na primeira final e do chute na trave no gol do Basilio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,10,'Geraldão','ATA',NULL,NULL,NULL,84,1,'Homem gol do time, centroavante rompedor de muita forca fisica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,11,'Romeu Cambalhota','PE','PD',NULL,NULL,84,1,'Atacante insinuante e irreverente, entortava os defensores pela ponta.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,12,'Jairo','GOL',NULL,NULL,NULL,79,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,13,'Cláudio Mineiro','LE','ME',NULL,NULL,79,0,'Chegou no decorrer do ano, atuou muito no quadrangular decisivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,14,'Zé Eduardo','ZAG',NULL,NULL,NULL,78,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,15,'Givanildo Oliveira','VOL','MC',NULL,NULL,82,0,'Cadencia e muita experiencia tatica na contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,16,'Tião','VOL',NULL,NULL,NULL,77,0,'Volante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,17,'Luciano','MEI',NULL,NULL,NULL,76,0,'Meia reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,18,'Ivan','PD',NULL,NULL,NULL,75,0,'Ponta reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,19,'Edu','PE','MEI',NULL,NULL,80,0,'Irmao de Zico, ponta-esquerda de muita tecnica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (11,20,'Lance','ATA',NULL,NULL,NULL,76,0,'Centroavante reserva.');

INSERT INTO teams VALUES (12,'Guarani',1978,'Guarani 1978 (Campeao Brasileiro)','Carlos Alberto Silva','#006437','#ffffff','Unico clube do interior do Brasil a conquistar a elite nacional desbancando gigantes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,1,'Careca','ATA',NULL,94,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,2,'Zenon','MEI','MC',92,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,3,'Renato','MC',NULL,89,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,4,'Neneca','GOL',NULL,88,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,5,'Gomes','ZAG',NULL,87,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,6,'Capitão','PD','MD',86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,7,'Bozó','PE','ME',86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,8,'Miranda','LE',NULL,85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,9,'Mauro','LD','ME',85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,10,'Zé Carlos','VOL','MC',85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,11,'Edson','ZAG','ME',85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,12,'Manguinha','VOL','MC',83,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,13,'Silvinho','PE','ATA',82,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,14,'Macedo','ATA',NULL,81,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,15,'João de Deus','GOL',NULL,80,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,16,'Adriano','MC',NULL,80,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,17,'Alexandre','LD','ZAG',79,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,18,'Almeida','LE',NULL,79,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,19,'Gersinho','PD',NULL,78,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (12,20,'Cidão','ZAG',NULL,78,0,'Elenco lendario.');

INSERT INTO teams VALUES (13,'Internacional',1979,'Internacional 1979 (Invicto)','Enio Andrade','#D2122E','#ffffff','O unico campeao invicto da historia do Brasileirao. 23 jogos sem nenhuma derrota na campanha.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,1,'Benítez','GOL',NULL,NULL,NULL,89,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,2,'João Carlos','LD',NULL,NULL,NULL,80,1,'Apoio agressivo pela direita no esquema sem pontas fixas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,3,'Cláudio Mineiro','LE','ME',NULL,NULL,85,1,'Apoio agressivo pela esquerda no esquema sem pontas fixas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,4,'Mauro Galvão','ZAG','VOL',NULL,NULL,88,1,'Iniciou a carreira naquela campanha historica com apenas 17 anos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,5,'Mauro Pastor','ZAG',NULL,NULL,NULL,86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,6,'Batista','VOL','MC',NULL,NULL,90,1,'Segundo volante de forte combatividade e saida de jogo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,7,'Falcão','MC','MEI','VOL',NULL,98,1,'O Rei de Roma. Motor e cerebro tecnico do time.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,8,'Jair','MEI','MC','ATA',NULL,91,1,'O Principe Jaja, responsavel pela bola parada refinada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,9,'Mário Sérgio','MEI','PE','ME',NULL,88,1,'O Vesgo, um dos maiores curingas de movimentacao da equipe.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,10,'Valdomiro','PD','ATA',NULL,NULL,89,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,11,'Bira','ATA',NULL,NULL,NULL,87,1,'Centroavante de area. Homem gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,12,'Gasperin','GOL',NULL,NULL,NULL,76,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,13,'Édson Galvão','LD',NULL,NULL,NULL,76,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,14,'Beliato','ZAG',NULL,NULL,NULL,79,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,15,'Valdir Lima','VOL',NULL,NULL,NULL,79,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,16,'Tonho','MEI',NULL,NULL,NULL,83,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,17,'Chico Spina','PD','ATA',NULL,NULL,83,0,'Heroi do primeiro jogo da finalissima, dois gols no Maracana.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,18,'Silvinho','PE',NULL,NULL,NULL,78,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,19,'Adílson','PE',NULL,NULL,NULL,82,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (13,20,'Mário Motta','ATA',NULL,NULL,NULL,78,0,'Atacante reserva.');

INSERT INTO teams VALUES (14,'Flamengo',1980,'Flamengo 1980 (Campeao Brasileiro)','Claudio Coutinho','#C8102E','#000000','O primeiro titulo brasileiro do clube. Arrancada da geracao de ouro no Maracana.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,1,'Raul Plassmann','GOL',NULL,NULL,NULL,85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,2,'Leandro','LD','ZAG','MC',NULL,92,1,'Um dos laterais mais tecnicos da historia do futebol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,3,'Mozer','ZAG',NULL,NULL,NULL,87,1,'Zagueiro de muita imponencia fisica, tecnica e raca.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,4,'Marinho','ZAG',NULL,NULL,NULL,83,1,'Formava a dupla titular de zaga com extrema velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,5,'Júnior','LE','MC','ME',NULL,93,1,'O Capacete. Genio da lateral que ditava o ritmo do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,6,'Andrade','VOL','MC',NULL,NULL,88,1,'Pilar de sustentacao defensiva, passe longo absurdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,7,'Adílio','MC','MEI','ME',NULL,89,1,'Ginga e controle de bola espetaculares, motor do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,8,'Zico','MEI','ATA','MC',NULL,97,1,'O Galinho de Quintino. O maior jogador da historia do clube.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,9,'Tita','MEI','PD','ATA',NULL,86,1,'Curinga ofensivo de altissimo nivel tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,10,'Nunes','ATA',NULL,NULL,NULL,86,1,'O Artilheiro das Decisoes. Homem gol que guardava nas finais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,11,'Júlio César Uri Geller','PE',NULL,NULL,NULL,81,1,'Entrava para entortar as defesas com dribles plasticos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,12,'Cantarele','GOL',NULL,NULL,NULL,78,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,13,'Antunes','LD',NULL,NULL,NULL,74,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,14,'Figueiredo','ZAG',NULL,NULL,NULL,78,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,15,'Vítor','VOL',NULL,NULL,NULL,76,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,16,'Lico','MEI','PE',NULL,NULL,83,0,'Peca tatica fundamental para o equilibrio ofensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,17,'Chiquinho','PD',NULL,NULL,NULL,76,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,18,'Anselmo','ATA',NULL,NULL,NULL,77,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,19,'Reinaldo','ATA',NULL,NULL,NULL,75,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (14,20,'Popoca','ATA','MEI',NULL,NULL,74,0,'Segundo atacante reserva.');

INSERT INTO teams VALUES (15,'Flamengo',1981,'Flamengo 1981 (Mundial)','Paulo Cesar Carpegiani','#C8102E','#000000','O maior ano da historia do clube. Campeao da Libertadores e do Mundo contra o Liverpool.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,1,'Raul Plassmann','GOL',NULL,NULL,NULL,87,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,2,'Leandro','LD','ZAG','MC',NULL,94,1,'Em 1981 desfilou toda a sua categoria tecnica indiscutivel pela lateral.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,3,'Marinho','ZAG',NULL,NULL,NULL,85,1,'Velocidade e tempo de cobertura perfeitos ao lado de Mozer.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,4,'Mozer','ZAG',NULL,NULL,NULL,89,1,'Imponente na forca fisica, na raca e com excelente tecnica na saida de jogo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,5,'Júnior','LE','MC','ME',NULL,95,1,'O Capacete, genio tatico ambidestro que comandava o ritmo do time.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,6,'Andrade','VOL','MC',NULL,NULL,90,1,'Pilar defensivo com o passe longo mais refinado do futebol brasileiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,7,'Adílio','MC','MEI','ME',NULL,91,1,'Ginga curta e controle de bola espetaculares, motor dinamico do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,8,'Zico','MEI','ATA','MC',NULL,99,1,'O Galinho de Quintino no apice, destruiu o Liverpool em Toquio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,9,'Tita','MEI','PD','ATA',NULL,88,1,'Curinga ofensivo de altissimo nivel, drible e recomposicao pela meia-direita.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,10,'Lico','MEI','PE',NULL,NULL,85,1,'Peca tatica brilhante, equilibrio perfeito flutuando para armar pela esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,11,'Nunes','ATA',NULL,NULL,NULL,89,1,'O Artilheiro das Decisoes, dois gols na final da Libertadores e no Mundial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,12,'Cantarele','GOL',NULL,NULL,NULL,78,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,13,'Nei Dias','LD',NULL,NULL,NULL,76,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,14,'Figueiredo','ZAG',NULL,NULL,NULL,78,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,15,'Rondinelli','ZAG',NULL,NULL,NULL,81,0,'O Deus da Raca, atuou no inicio da campanha da Libertadores.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,16,'Vítor','VOL',NULL,NULL,NULL,76,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,17,'Chiquinho','PD',NULL,NULL,NULL,76,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,18,'Júlio César Uri Geller','PE',NULL,NULL,NULL,82,0,'Entrava para entortar as defesas com dribles plasticos na ponta.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,19,'Anselmo','ATA',NULL,NULL,NULL,78,0,'Reserva imediato do comando de ataque, entrou na historia em Cobreloa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (15,20,'Baroninho','PE','ATA',NULL,NULL,81,0,'Atacante canhoto de muita forca e velocidade na ponta-esquerda.');

INSERT INTO teams VALUES (16,'Flamengo',1982,'Flamengo 1982 (Bicampeao Brasileiro)','Paulo Cesar Carpegiani','#C8102E','#000000','Bicampeonato nacional consecutivo. Vitoria epica contra o Gremio no Olimpico com gol de Nunes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,1,'Zico','MEI','MC',99,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,2,'Júnior','LE','MC',94,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,3,'Leandro','LD','MC',94,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,4,'Mozer','ZAG',NULL,89,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,5,'Nunes','ATA',NULL,89,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,6,'Adílio','MC','MEI',89,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,7,'Tita','PD','MD',89,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,8,'Raul Plassmann','GOL',NULL,88,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,9,'Andrade','VOL','MC',88,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,10,'Marinho','ZAG',NULL,86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,11,'Lico','PE','MD',86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,12,'Vítor','VOL','MC',82,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,13,'Cantarele','GOL',NULL,81,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,14,'Figueiredo','ZAG',NULL,81,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,15,'Popoca','MEI','MC',81,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,16,'Chiquinho','ATA','MC',80,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,17,'Antunes','LD',NULL,79,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,18,'Reinaldo','PE',NULL,79,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,19,'Anselmo','ATA',NULL,79,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (16,20,'Wilsinho','PD','MD',78,0,'Elenco lendario.');

INSERT INTO teams VALUES (17,'Fluminense',1984,'Fluminense 1984 (Campeao Brasileiro)','Carlos Alberto Parreira','#7A1921','#006633','O ano do Casal 20 (Assis e Washington) e do brilho de Romerito. Campeao em cima do Vasco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,1,'Paulo Vítor','GOL',NULL,NULL,NULL,84,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,2,'Aldo','LD',NULL,NULL,NULL,82,1,'Lateral de grande regularidade e excelente marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,3,'Branco','LE','ME',NULL,NULL,88,1,'Joia da lateral, famoso pelos chutes potentes e cruzamentos precisos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,4,'Duílio','ZAG',NULL,NULL,NULL,83,1,'Xerife e lider tecnico do miolo de zaga.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,5,'Ricardo Rocha','ZAG','VOL',NULL,NULL,86,1,'Zagueiro rapido e antecipador, faria historia na Selecao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,6,'Jandir','VOL',NULL,NULL,NULL,83,1,'Cao de guarda incansavel, dava liberdade aos meias.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,7,'Delei','VOL','MC',NULL,NULL,85,1,'Maestro classico da saida de bola, distribuia com elegancia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,8,'Assis','MC','MEI',NULL,NULL,88,1,'O Carrasco. Metade do Casal 20, chegada na area e gols decisivos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,9,'Romerito','MEI','PD','MC',NULL,91,1,'O paraguaio, grande craque do campeonato e autor do gol do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,10,'Tato','PE','ME',NULL,NULL,82,1,'Ponta de muita velocidade e drible, municiava os centroavantes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,11,'Washington','ATA',NULL,NULL,NULL,87,1,'Outra metade do Casal 20. Forca fisica e presenca de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,12,'Ricardo Pinto','GOL',NULL,NULL,NULL,75,0,'Jovem promessa na epoca.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,13,'Renato','LE',NULL,NULL,NULL,74,0,'Lateral esquerdo reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,14,'Vica','ZAG',NULL,NULL,NULL,80,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,15,'Renê','MEI','MC',NULL,NULL,78,0,'Meia reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,16,'Wilsinho','PD',NULL,NULL,NULL,79,0,'Ponta reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,17,'Paulinho','PE',NULL,NULL,NULL,76,0,'Ponta reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,18,'Cláudio Adão','ATA',NULL,NULL,NULL,84,0,'Centroavante rodado e tecnico, revezava com Washington.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,19,'Agnaldo','ATA',NULL,NULL,NULL,76,0,'Atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (17,20,'Gustavo','ATA',NULL,NULL,NULL,74,0,'Atacante do banco.');

INSERT INTO teams VALUES (18,'Coritiba',1985,'Coritiba 1985 (Campeao Brasileiro)','Enio Andrade','#006437','#ffffff','Unico titulo nacional do Coxa. Conquistado em uma final emocionante nos pênaltis contra o Bangu.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,1,'Rafael Cammarota','GOL',NULL,NULL,NULL,84,1,'Lider da defesa, heroi na disputa de penaltis na final contra o Bangu.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,2,'André','LD','ZAG',NULL,NULL,80,1,'Lateral de muita imposicao fisica e excelente marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,3,'Dida','LE','ZAG',NULL,NULL,81,1,'Pilar do lado esquerdo da defesa, muita seguranca defensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,4,'Gomes','ZAG',NULL,NULL,NULL,83,1,'Xerife e capitao do time, ja campeao brasileiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,5,'Heraldo','ZAG',NULL,NULL,NULL,81,1,'Dupla de zaga entrosada e firme com Gomes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,6,'Almir','VOL',NULL,NULL,NULL,82,1,'Volante cao de guarda do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,7,'Marildo','VOL','MC',NULL,NULL,79,1,'Equilibrio de saida de jogo e preenchimento de espacos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,8,'Édson','PE',NULL,NULL,NULL,79,1,'Velocista pela esquerda, ajudava no encaixe do contra-ataque.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,9,'Lela','PD','ATA',NULL,NULL,85,1,'O Careca. Grande simbolo e vice-artilheiro do time.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,10,'Índio','ATA',NULL,NULL,NULL,83,1,'Grande artilheiro do Coxa na competicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,11,'Toby','ATA','MEI',NULL,NULL,81,1,'Muita raca e movimentacao, flutuava vindo de tras.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,12,'Jairo','GOL',NULL,NULL,NULL,77,0,'Goleiro reserva experiente, uma lenda da historia do clube.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,13,'Caxias','LD',NULL,NULL,NULL,74,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,14,'Vavá','ZAG',NULL,NULL,NULL,75,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,15,'Marco Aurélio','MC','MEI',NULL,NULL,83,0,'Cerebro tatico do meio-campo, distribuicao e cadencia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,16,'Tovar','MEI','MC',NULL,NULL,80,0,'Meia de muita dinamica e excelente visao de jogo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,17,'Miltinho','MEI',NULL,NULL,NULL,76,0,'Meia reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,18,'Paulinho','PD',NULL,NULL,NULL,75,0,'Ponta reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,19,'Vicente','PE',NULL,NULL,NULL,74,0,'Ponta reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (18,20,'Hélcio','ATA',NULL,NULL,NULL,75,0,'Atacante do banco.');

INSERT INTO teams VALUES (19,'Sao Paulo',1986,'São Paulo 1986 (Campeão Brasileiro)','Pepe','#C8102E','#ffffff','Campeão em uma das finais mais emocionantes da história contra o Guarani. Careca no auge.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,1,'Careca','ATA',NULL,96,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,2,'Müller','ATA','MD',92,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,3,'Darío Pereyra','ZAG','VOL',90,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,4,'Gilmar Rinaldi','GOL',NULL,88,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,5,'Silas','MC',NULL,88,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,6,'Oscar','ZAG',NULL,88,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,7,'Nelsinho','LE',NULL,87,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,8,'Bernardo','VOL','MC',86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,9,'Pita','MEI','MC',86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,10,'Zé Teodoro','LD',NULL,85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,11,'Sidnei','PD','MC',84,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,12,'Wagner Basílio','ZAG',NULL,83,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,13,'Fonseca','LD','ZAG',83,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,14,'Ronaldão','ZAG','MC',82,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,15,'Vizolli','VOL',NULL,82,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,16,'Pianelli','MEI','PE',81,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,17,'Lange','ATA',NULL,81,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,18,'Abelha','GOL',NULL,80,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,19,'Manu','MC','ME',79,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (19,20,'Quarenta','LE',NULL,78,0,'Elenco lendario.');

INSERT INTO teams VALUES (20,'Sport',1987,'Sport 1987 (Campeão Brasileiro)','Emerson Leao','#C8102E','#000000','Campeão da Taça de Ouro de 1987. Conquista histórica consolidada na Ilha do Retiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,1,'Flávio','GOL',NULL,NULL,NULL,84,1,'Verdadeiro paredao de extrema regularidade durante toda a competicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,2,'Betão','LD',NULL,NULL,NULL,82,1,'Lateral muito forte fisicamente e com excelente poder de marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,3,'Macaxeira','LE',NULL,NULL,NULL,81,1,'Grande consistencia defensiva e apoios precisos na ala esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,4,'Estevam','ZAG',NULL,NULL,NULL,85,1,'Grande capitao e xerife do time, lideranca maxima na defesa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,5,'Marco Antônio','ZAG',NULL,NULL,NULL,83,1,'Dupla de zaga impecavel e muito entrosada com Estevam.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,6,'Rogério','VOL',NULL,NULL,NULL,83,1,'Incansavel cao de guarda, protecao total a frente da zaga.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,7,'Zé do Carmo','VOL','MC',NULL,NULL,86,1,'Cria da base, elegancia e qualidade na saida de jogo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,8,'Ribamar','MC','MEI',NULL,NULL,84,1,'Grande motor do meio-campo, articulava as jogadas com dinamica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,9,'Robertinho','PD','ATA',NULL,NULL,83,1,'Velocista de drible agressivo que quebrava as linhas de defesa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,10,'Neco','PE','ME',NULL,NULL,85,1,'O grande ponta-esquerda do Leao, criativo e identificado com o clube.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,11,'Nando','ATA',NULL,NULL,NULL,85,1,'Centroavante matador, grande artilheiro e decisivo na reta final.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,12,'Moacir','GOL',NULL,NULL,NULL,76,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,13,'Adriano','ZAG',NULL,NULL,NULL,77,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,14,'Dedé','VOL',NULL,NULL,NULL,77,0,'Primeiro ou segundo volante de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,15,'Nando','MEI','MC',NULL,NULL,82,0,'Meia de muita categoria tecnica e passes refinados para o ataque.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,16,'Zico','MEI',NULL,NULL,NULL,78,0,'Homonimo do craque carioca, tambem de muita habilidade na armacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,17,'Augusto','PD',NULL,NULL,NULL,75,0,'Ponta reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,18,'Émerson','PE',NULL,NULL,NULL,76,0,'Ponta reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,19,'Betinho','ATA',NULL,NULL,NULL,80,0,'Atacante de muita movimentacao que flutuava abrindo espacos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (20,20,'Isaías','ATA',NULL,NULL,NULL,75,0,'Elenco lendario.');

INSERT INTO teams VALUES (21,'Bahia',1988,'Bahia 1988 (Bicampeão Brasileiro)','Evaristo de Macedo','#003399','#C8102E','Segundo título nacional do Esquadrão de Aço. Conquistado no Beira-Rio diante do Internacional.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,1,'Ronaldo','GOL',NULL,NULL,NULL,88,1,'Verdadeiro paredao de extrema regularidade e seguranca debaixo das traves.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,2,'Tarantini','LD','ZAG',NULL,NULL,83,1,'Lateral de muita raca e forte poder de marcacao defensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,3,'Paulo Róbson','LE','ME',NULL,NULL,84,1,'Solido na defesa e excelente tempo de apoio e cruzamento pela ala esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,4,'João Marcelo','ZAG',NULL,NULL,NULL,86,1,'Xerife tecnico da zaga, mestre no tempo de bola e nas antecipacoes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,5,'Claudir','ZAG',NULL,NULL,NULL,85,1,'Dupla impecavel, de muita imposicao fisica e raca com Joao Marcelo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,6,'Paulo Rodrigues','VOL','MC',NULL,NULL,87,1,'Elegante termometro do time, protegia a zaga e iniciava o jogo com passes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,7,'Zé Carlos','MC','MEI','VOL',NULL,88,1,'Dinamica absurda box-to-box, pisava constantemente na area para fazer gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,8,'Bobô','MEI','MC','ATA',NULL,92,1,'Grande maestro e craque genial, eleito o Bola de Prata, cerebro da conquista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,9,'Marquinhos','PD','PE',NULL,NULL,81,1,'Ponta de muita habilidade que entrou bem na reta final da campanha.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,10,'Sandro','PE','ME',NULL,NULL,84,1,'Infernizava os laterais adversarios com velocidade e cruzamentos precisos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,11,'Charles Fabian','ATA',NULL,NULL,NULL,89,1,'O Anjo Loiro, centroavante de muita mobilidade e artilheiro do time.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,12,'Sidmar','GOL',NULL,NULL,NULL,77,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,13,'Maizena','LD',NULL,NULL,NULL,76,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,14,'Edinho','LE',NULL,NULL,NULL,75,0,'Lateral esquerdo reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,15,'Newmar','ZAG',NULL,NULL,NULL,78,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,16,'Sales','VOL',NULL,NULL,NULL,83,0,'Incansavel na marcacao, o operario que carregava o piano para os meias.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,17,'Gil Sergipano','VOL','MC',NULL,NULL,81,0,'Meia de origem que dava intensidade e dinamica vindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,18,'Dácio','MEI',NULL,NULL,NULL,75,0,'Meia reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,19,'Osmar','PD','ATA',NULL,NULL,83,0,'Velocista de drible agressivo, profundidade ao ataque pelo lado direito.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (21,20,'Renato','ATA',NULL,NULL,NULL,80,0,'Centroavante de referencia e mais estatico, importante no jogo aereo.');

INSERT INTO teams VALUES (22,'Vasco',1989,'Vasco 1989 (Campeão Brasileiro)','Nelsinho Rosa','#000000','#ffffff','O elenco conhecido como SeleVasco. Conquistou o bicampeonato nacional vencendo o São Paulo no Morumbi.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,1,'Acácio','GOL',NULL,85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,2,'Luís Carlos Winck','LD',NULL,84,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,3,'Quiñonez','ZAG',NULL,83,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,4,'Marco Aurélio','ZAG','MC',82,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,5,'Célio Silva','ZAG',NULL,80,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,6,'Mazinho','LE','VOL',88,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,7,'Zé do Carmo','VOL','MC',84,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,8,'Andrade','VOL','MC',83,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,9,'Marco Antônio Boiadeiro','MC',NULL,83,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,10,'Bismarck','MEI','MD',86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,11,'Bebeto','ATA','MEI',92,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,12,'Tita','MEI','MD',85,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,13,'William','MEI','ME',82,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,14,'Sorato','ATA',NULL,83,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,15,'Tato','PE','ME',80,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,16,'Ayupe','LD',NULL,74,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,17,'Leonardo Siqueira','ZAG',NULL,76,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,18,'Cássio','LE',NULL,74,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,19,'França','VOL',NULL,75,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (22,20,'Reginaldo','GOL',NULL,75,0,'Elenco lendario.');

INSERT INTO teams VALUES (23,'Corinthians',1990,'Corinthians 1990 (Primeiro Titulo)','Nelsinho Baptista','#000000','#ffffff','A primeira conquista do Brasileirão na história do clube. Consagração eterna do camisa 10 Neto.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,1,'Neto','MEI','MC',93,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,2,'Ronaldo Giovanelli','GOL',NULL,89,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,3,'Márcio Bittencourt','VOL','MC',87,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,4,'Tupãzinho','MC','MD',87,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,5,'Marcelo Djian','ZAG',NULL,86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,6,'Wilson Mano','VOL','LD',86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,7,'Giba','LD',NULL,85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,8,'Jacenir','LE',NULL,85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,9,'Fabinho','PD','MC',85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,10,'Mauro','ZAG','ME',84,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,11,'Guinei','ZAG',NULL,84,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,12,'Dinei','ATA',NULL,84,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,13,'Gérson','ZAG','LD',78,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,14,'Ezequiel','VOL','MC',83,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,15,'Paulo Sérgio','ATA','ME',82,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,16,'Jairo','ATA',NULL,81,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,17,'Marcos Roberto','LE',NULL,80,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,18,'Wilson','GOL',NULL,80,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,19,'Dama','ZAG',NULL,79,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (23,20,'Dagoberto','GOL',NULL,74,0,'Elenco lendario.');

INSERT INTO teams VALUES (24,'Sao Paulo',1991,'São Paulo 1991 (Campeão Brasileiro)','Tele Santana','#C8102E','#ffffff','O titulo que iniciou a era de ouro de Telê Santana no Morumbi desbancando o Bragantino.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,1,'Zetti','GOL',NULL,NULL,NULL,91,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,2,'Cafu','LD','MD','PD','MC',92,1,'Grande locomotiva do time pela direita, jogando em toda a extensao do corredor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,3,'Ricardo Rocha','ZAG','VOL',NULL,NULL,92,1,'Xerife tecnico da zaga, mestre no tempo de bola e nas antecipacoes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,4,'Antônio Carlos Zago','ZAG',NULL,NULL,NULL,86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,5,'Leonardo','LE','ME','MC',NULL,90,1,'Refinado tecnicamente, apoiava o meio-campo por dentro com facilidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,6,'Bernardo','VOL','MC',NULL,NULL,85,1,'Motor de combate e sustentacao do meio-campo de Tele.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,7,'Sídnei','VOL',NULL,NULL,NULL,81,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,8,'Raí','MEI','ATA',NULL,NULL,93,1,'Grande maestro e protagonista do titulo, gol decisivo na primeira final.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,9,'Elivélton','PE','ME',NULL,NULL,84,1,'Dribles agudos e cruzamentos precisos na ponta-esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,10,'Müller','ATA','PD','PE','MEI',91,1,'Inteligencia tatica pura, atacante movel que flutuava por todo o setor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,11,'Macedo','ATA','PD',NULL,NULL,83,1,'Talisma da velocidade, infernizava as defesas cansadas no segundo tempo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,12,'Marcos Bonequini','GOL',NULL,NULL,NULL,76,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,13,'Zé Teodoro','LD',NULL,NULL,NULL,80,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,14,'Nelsinho','LE',NULL,NULL,NULL,82,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,15,'Ronaldão','ZAG','VOL',NULL,NULL,85,0,'Imposicao fisica absurda na zaga ou protegendo a area como volante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,16,'Suélio','VOL',NULL,NULL,NULL,79,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,17,'Catê','ATA','PD',NULL,NULL,75,0,'Jovem revelacao da base que comecava a ganhar seus primeiros minutos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,18,'Flávio Campos','MC','VOL',NULL,NULL,81,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,19,'Mário Tilico','PD','PE',NULL,NULL,83,0,'Velocista insinuante que rompia as linhas defensivas pelos lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (24,20,'Rinaldo','ATA',NULL,NULL,NULL,78,0,'Elenco lendario.');

INSERT INTO teams VALUES (25,'Flamengo',1992,'Flamengo 1992 (Campeão Brasileiro)','Carlinhos','#C8102E','#000000','O quinto título nacional do clube. Liderado pelo Maestro Júnior aos 38 anos comandando uma safra de garotos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,1,'Júnior','MC','LE',93,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,2,'Gilmar','GOL','MC',88,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,3,'Zinho','ME','MC',88,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,4,'Gaúcho','ATA','MC',87,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,5,'Wilson Gottardo','ZAG',NULL,87,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,6,'Djalminha','MEI','MC',86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,7,'Piá','LE',NULL,86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,8,'Charles','LD',NULL,85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,9,'Júnior Baiano','ZAG',NULL,85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,10,'Uidemar','VOL','MC',85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,11,'Nélio','PE','MC',85,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,12,'Marcelinho Carioca','MEI','ME',84,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,13,'Rogério','ZAG',NULL,83,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,14,'Marquinhos','MC','ME',83,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,15,'Paulo Nunes','PD','ATA',83,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,16,'Fabinho','VOL','MC',82,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,17,'Totó','ATA',NULL,81,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,18,'Gelson','ZAG',NULL,80,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,19,'Adriano','GOL','MC',79,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (25,20,'Luís Antônio','LE','MC',78,0,'Elenco lendario.');

INSERT INTO teams VALUES (26,'Palmeiras',1993,'Palmeiras 1993 (Campeão Brasileiro)','Vanderlei Luxemburgo','#006437','#ffffff','O início da histórica Era Parmalat. Quebrou o jejum de 16 anos sem títulos expressivos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,1,'Sérgio','GOL',NULL,NULL,NULL,87,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,2,'Mazinho','LD','VOL','LE','MC',87,1,'Atuava constantemente invertido pela esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,3,'Cláudio','LD','MD',NULL,NULL,86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,4,'Roberto Carlos','LE','ME',NULL,NULL,92,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,5,'Antônio Carlos Zago','ZAG',NULL,NULL,NULL,89,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,6,'Cléber','ZAG',NULL,NULL,NULL,86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,7,'César Sampaio','VOL','MC',NULL,NULL,91,1,'Primeiro volante classico de extrema tecnica e desarmes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,8,'Zinho','MEI','ME','MC',NULL,90,1,'Motor tatico do time, cadenciava pelo centro-esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,9,'Edmundo','PD','ATA','MEI',NULL,93,1,'O Animal. Atuava com total mobilidade no ataque de 93.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,10,'Edílson','PE','ATA','PD','MEI',87,1,'O Capetinha, contratado do Guarani, grande curinga ofensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,11,'Evair','ATA','MEI',NULL,NULL,92,1,'Centroavante armador, definia e recuava para pifar os pontas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,12,'Velloso','GOL',NULL,NULL,NULL,80,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,13,'Tonhão','ZAG',NULL,NULL,NULL,83,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,14,'Edinho Baiano','ZAG',NULL,NULL,NULL,78,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,15,'Daniel Frasson','VOL','MC',NULL,NULL,84,0,'Segundo volante de combate.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,16,'Amaral','VOL',NULL,NULL,NULL,82,0,'Primeiro volante de forte marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,17,'Jean Carlo','MEI','PE',NULL,NULL,81,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,18,'Maurílio','PD','ATA','LD',NULL,82,0,'Quebrou galhos na lateral direita.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,19,'Sorato','ATA',NULL,NULL,NULL,83,0,'Centroavante de referencia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (26,20,'Saulo','ATA',NULL,NULL,NULL,78,0,'Centroavante de area.');

INSERT INTO teams VALUES (27,'Palmeiras',1994,'Palmeiras 1994 (Bicampeão Brasileiro)','Vanderlei Luxemburgo','#006437','#ffffff','O Bicampeonato consecutivo consolidado em cima do arquirrival Corinthians com brilho de Rivaldo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,1,'Rivaldo','MEI','MC',94,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,2,'Edmundo','PD','ATA',93,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,3,'Roberto Carlos','LE',NULL,93,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,4,'Evair','ATA','ME',92,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,5,'César Sampaio','VOL','MC',91,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,6,'Zinho','ME','MC',90,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,7,'Cléber','ZAG',NULL,89,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,8,'Antônio Carlos','ZAG',NULL,88,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,9,'Velloso','GOL',NULL,88,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,10,'Flávio Conceição','MC',NULL,87,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,11,'Mazinho','MC','LD',86,1,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,12,'Cláudio','LD',NULL,85,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,13,'Amaral','VOL','ME',85,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,14,'Maurílio','PD','ATA',83,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,15,'Tonhão','ZAG',NULL,83,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,16,'Sorato','ATA',NULL,82,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,17,'Wagner','LE','MC',81,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,18,'Sérgio','GOL',NULL,80,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,19,'Macula','MC',NULL,79,0,'Elenco lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (27,20,'Chiquinho','PE','MC',78,0,'Elenco lendario.');
-- [removido] linha duplicada de Zinho (ja consta na camisa 6) que no arquivo original apontava para a tabela inexistente 'p'

INSERT INTO teams VALUES (28,'Botafogo',1995,'Botafogo 1995','Paulo Autuori','#000000','#ffffff','Tulio 23 gols artilheiro historico. Donizete Pantera parceiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,1,'Wagner','GOL','MC',81,1,'Goleiro do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,2,'Wilson Goiano','LD',NULL,77,1,'Lateral direito.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,3,'Wilson Gottardo','ZAG',NULL,80,1,'Zagueiro tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,4,'Goncalves','ZAG',NULL,79,1,'Parceiro solido.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,5,'Andre Silva','LE',NULL,76,1,'Lateral esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,6,'Leandro Avila','VOL','MC',78,1,'Volante de marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,7,'Jamir','VOL','MEI',78,1,'Volante tecnico versatil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,8,'Beto','MEI','VOL',77,1,'Meia de organizacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,9,'Sergio Manoel','MEI','PD',80,1,'Meia com visao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,10,'Donizete','ATA',NULL,81,1,'Pantera. Artilheiro parceiro de Tulio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,11,'Tulio Maravilha','ATA',NULL,89,1,'23 gols. Artilheiro historico. Idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,12,'Moises','LE',NULL,72,0,'Lateral reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,13,'Iranildo','MEI','MC',75,0,'Meia reserva criativo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,14,'Marcelo Alves','MEI','MC',72,0,'Meia do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,15,'Narcizio','ATA',NULL,71,0,'Atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,16,'Rui','ATA',NULL,71,0,'Centroavante de recurso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,17,'Marcio','LD','MC',71,0,'Lateral de recurso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,18,'Claudinho','ZAG',NULL,70,0,'Zagueiro jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,19,'Jorginho','MEI','MC',71,0,'Meia jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (28,20,'Alan','PE','ME',70,0,'Ponta reserva.');

INSERT INTO teams VALUES (29,'Gremio',1996,'Gremio 1996','Luiz Felipe Scolari','#1c3f94','#000000','Felipao pre-Copa 98. Paulo Nunes artilheiro. Emerson jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,1,'Danrlei','GOL',NULL,NULL,NULL,88,1,'Idolo incontestavel, reflexos absurdos e extrema lideranca e catimba.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,2,'Arce','LD','MD',NULL,NULL,90,1,'Uma das batidas de bola mais perfeitas do continente, letal em faltas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,3,'Roger Machado','LE','ZAG',NULL,NULL,86,1,'Extremamente tecnico e tatico, equilibrio perfeito para os avancos de Arce.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,4,'Adilson Batista','ZAG',NULL,NULL,NULL,87,1,'Capitao America, lider maximo do espirito de raca e imposicao do time.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,5,'Rivarola','ZAG',NULL,NULL,NULL,85,1,'Zagueiro paraguaio implacavel no combate fisico e xerife do miolo de zaga.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,6,'Dinho','VOL',NULL,NULL,NULL,85,1,'O Cangaceiro. Maior simbolo da mistica copeira e forte marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,7,'Goiano','VOL','MC',NULL,NULL,86,1,'Sustentacao de saida de bola com passes precisos e chutes potentes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,8,'Emerson','MC','VOL',NULL,NULL,84,1,'Jovem revelacao de extrema categoria, depois fez historia na Europa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,9,'Carlos Miguel','MEI','ME','PE',NULL,86,1,'Maestro cadenciador pelo lado esquerdo, passes refinados e gols decisivos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,10,'Paulo Nunes','PD','ATA',NULL,NULL,90,1,'O Diabo Loiro. Fase espetacular, movimentacao, gols e inteligencia tatica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,11,'Jardel','ATA',NULL,NULL,NULL,91,1,'Rei do jogo aereo mundial. Primeiro semestre de 96 antes do Porto.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,12,'Murilo','GOL',NULL,NULL,NULL,77,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,13,'Marco Antônio','LD',NULL,NULL,NULL,76,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,14,'Cristiano','LE',NULL,NULL,NULL,75,0,'Lateral esquerdo reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,15,'Mauro Galvão','ZAG','VOL',NULL,NULL,89,0,'Elegancia, antecipacao e experiencia tecnica na sobra da defesa aos 36 anos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,16,'João Antônio','VOL','MC',NULL,NULL,81,0,'Segundo volante de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,17,'Ailton','MEI','ATA',NULL,NULL,82,0,'Predestinado heroi do titulo brasileiro, gol da taca contra a Portuguesa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,18,'Zinho','PE','PD',NULL,NULL,80,0,'Velocidade pelo lado esquerdo, ajudava no encaixe ofensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,19,'Zé Alcino','ATA',NULL,NULL,NULL,85,0,'Assumiu o comando do ataque no segundo semestre com gols no Brasileirao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (29,20,'Rodrigo Gral','ATA',NULL,NULL,NULL,77,0,'Jovem promessa, folego novo e velocidade ao setor ofensivo.');

INSERT INTO teams VALUES (30,'Vasco',1997,'Vasco 1997 (Brasileiro)','Antonio Lopes','#000000','#ffffff','29 gols de Edmundo = RECORDE historico do Brasileirao. Juninho e Ramon.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,1,'Carlos Germano','GOL',NULL,85,1,'Goleiro solido.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,2,'Valber','LD',NULL,81,1,'Lateral direito combativo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,3,'Odvan','ZAG',NULL,82,1,'Zagueiro racudo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,4,'Mauro Galvao','ZAG',NULL,84,1,'Veterano ainda eficiente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,5,'Felipe','LE',NULL,83,1,'Lateral esquerdo tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,6,'Luisinho','VOL','MEI',82,1,'Volante-meia versatil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,7,'Nasa','VOL','MEI',81,1,'Volante tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,8,'Juninho Pernambucano','MEI','MD',88,1,'Cobracas de falta letais. Meia genial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,9,'Ramon','MEI','MD',84,1,'Meia ofensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,10,'Edmundo','ATA',NULL,95,1,'29 GOLS. RECORDE do Brasileirao. Fenomenal.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,11,'Evair','PE','ME',88,1,'Parceiro de Edmundo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,12,'Marica','LD',NULL,76,0,'Lateral reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,13,'Alex Pinho','ZAG',NULL,75,0,'Terceiro zagueiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,14,'Pedrinho','MEI','MC',80,0,'Meia reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,15,'Mauricinho','MEI','MC',75,0,'Meia do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,16,'Donizete','ATA',NULL,82,0,'Atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,17,'Brener','ATA',NULL,76,0,'Centroavante de recurso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,18,'Luizao','ATA',NULL,83,0,'Jovem; estrela no Corinthians 99.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,19,'Gil','ZAG','MC',74,0,'Zagueiro jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (30,20,'Sandro','MEI','MC',73,0,'Meia em desenvolvimento.');

INSERT INTO teams VALUES (31,'Vasco',1998,'Vasco 1998 (Libertadores)','Antonio Lopes','#000000','#ffffff','Campeao da Libertadores. Edmundo, Luizao, Donizete, Juninho.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,1,'Carlos Germano','GOL',NULL,NULL,NULL,91,1,'Idolo incontestavel, um dos maiores pegadores de penalti da historia do clube.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,2,'Vágner','LD','VOL','MC',NULL,85,1,'Meia de origem que voou na lateral-direita na Libertadores.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,3,'Mauro Galvão','ZAG','VOL',NULL,NULL,92,1,'O Cerebro do time, elegancia na antecipacao e posicionamento aos 36 anos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,4,'Odvan','ZAG',NULL,NULL,NULL,85,1,'O Zagueiro-Zagueiro, forca fisica implacavel e raca ate a Selecao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,5,'Felipe','LE','ME','MEI',NULL,91,1,'Maestro da Lateral, dribles curtos desconcertantes e tecnica refinada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,6,'Luisinho','VOL',NULL,NULL,NULL,85,1,'Cao de guarda da cabeca de area, combate duro e protecao da zaga.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,7,'Nasa','VOL',NULL,NULL,NULL,84,1,'Insubstituivel, trabalho sujo de marcacao individual com folego infinito.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,8,'Juninho Pernambucano','MC','MEI','MD',NULL,92,1,'Reizinho da Colina, passes magistrais e falta lendaria contra o River Plate.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,9,'Pedrinho','MEI','ME','PE',NULL,87,1,'Joia tecnica de drible e velocidade, vital na campanha.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,10,'Donizete','PD','ATA',NULL,NULL,89,1,'O Pantera, arrancadas imparaveis e forca fisica que infernizava defensores.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,11,'Luizão','PE','ATA',NULL,NULL,90,1,'Artilheiro do Vasco na Libertadores com 7 gols, mortal no jogo aereo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,12,'Márcio','GOL',NULL,NULL,NULL,77,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,13,'Filipe Alvim','LD',NULL,NULL,NULL,76,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,14,'Géder','ZAG',NULL,NULL,NULL,78,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,15,'Nelson','VOL',NULL,NULL,NULL,79,0,'Primeiro volante de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,16,'Válber','MEI','MC','LD',NULL,83,0,'Curinga experiente e tecnico, entrava para ditar o ritmo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,17,'Gian','MEI',NULL,NULL,NULL,77,0,'Meia reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,18,'Mauricinho','PE',NULL,NULL,NULL,78,0,'Ponta de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,19,'Sorato','ATA',NULL,NULL,NULL,80,0,'Experiente heroi do titulo brasileiro de 89, rotacao ofensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (31,20,'Luiz Cláudio','ATA',NULL,NULL,NULL,76,0,'Centroavante de area, reserva.');

INSERT INTO teams VALUES (32,'Corinthians',1998,'Corinthians 1998 (Bicampeao)','Vanderlei Luxemburgo','#000000','#ffffff','Gamarra, Vampeta, Rincon, Marcelinho. Bicampeonato nascendo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,1,'Nei','GOL',NULL,NULL,NULL,77,1,'Goleiro do titulo 98.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,2,'Índio','LD',NULL,NULL,NULL,80,1,'Lateral direito bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,3,'Gamarra','ZAG',NULL,NULL,NULL,92,1,'Paraguaio. Jogou a Copa de 98 sem cometer faltas. Lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,4,'Batata','ZAG',NULL,NULL,NULL,79,1,'Zagueiro central.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,5,'Silvinho','LE','ME',NULL,NULL,85,1,'Copa 98/02. Lateral moderno.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,6,'Vampeta','VOL','MC','LD',NULL,88,1,'Motor dinamico que revolucionou o segundo volante no pais. Idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,7,'Rincón','VOL','MC','MEI',NULL,87,1,'Transformado por Luxemburgo em um dos maiores volantes do Brasil. Copa 90/94/98.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,8,'Marcelinho Carioca','MEI','MD','PD','ATA',91,1,'Pe de anjo. Grande craque e cobrador de faltas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,9,'Ricardinho','MEI','ME','MC',NULL,88,1,'Contratado do Parana. Passes refinados e cadencia pelo centro-esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,10,'Edílson','PE','ATA','PD','MEI',90,1,'O Capetinha. Bola de Ouro 98. 15 gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,11,'Mirandinha','PD','ATA',NULL,NULL,79,1,'Ponta de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,12,'Maurício','GOL',NULL,NULL,NULL,74,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,13,'Rodrigo','LD',NULL,NULL,NULL,75,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,14,'Cris','ZAG',NULL,NULL,NULL,74,0,'Jovem; seria titular no Cruzeiro 2003.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,15,'Romeu','ZAG',NULL,NULL,NULL,75,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,16,'Amaral','VOL',NULL,NULL,NULL,76,0,'Primeiro volante de forte marcacao. Saiu para o Vasco no meio do ano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,17,'Gilmar Fubá','VOL',NULL,NULL,NULL,76,0,'Primeiro volante de contencao de 98.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,18,'Souza','MEI',NULL,NULL,NULL,76,0,'Meia-atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,19,'Didi','ATA',NULL,NULL,NULL,75,0,'Atacante de movimentacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (32,20,'Dinei','ATA',NULL,NULL,NULL,78,0,'Talisma que saia do banco para decidir finais.');

INSERT INTO teams VALUES (33,'Corinthians',1999,'Corinthians 1999 (Tricampeao)','Oswaldo de Oliveira','#000000','#ffffff','Tri. Dida reforco, Luizao parceiro de Edilson. Pre-Mundial 2000.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,1,'Dida','GOL',NULL,88,1,'No auge. Defendeu penaltis na semifinal.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,2,'Indio','LD',NULL,80,1,'Lateral tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,3,'Joao Carlos','ZAG',NULL,79,1,'Zagueiro solido.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,4,'Marcio Costa','ZAG',NULL,79,1,'Parceiro na zaga.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,5,'Kleber','LE',NULL,79,1,'Lateral esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,6,'Vampeta','VOL','MC',89,1,'Melhorou muito em 99. Idolo eterno.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,7,'Rincon','MEI','MC',87,1,'Colombiano ainda no auge.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,8,'Ricardinho','MEI','MC',88,1,'Meia refinado do tri.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,9,'Marcelinho Carioca','MEI','ME',92,1,'Geracao de ouro do Corinthians.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,10,'Edilson','ATA','MD',89,1,'Decisivo na campanha.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,11,'Luizao','ATA',NULL,87,1,'Reforco importante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,12,'Dinei','ATA',NULL,79,0,'Participou dos 5 gols nas finais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,13,'Marcos Senna','VOL','MC',81,0,'Chegou em 99. Depois bicampeao Europa com Espanha.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,14,'Sylvinho','LE','PE',86,0,'Reserva importante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,15,'Adilson','ZAG',NULL,74,0,'Reserva da zaga.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,16,'Gilmar','VOL','MC',75,0,'Volante de suporte.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,17,'Edu','MEI','ME',75,0,'Meia de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,18,'Fabinho','ZAG','MC',73,0,'Zagueiro jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,19,'Luis Carlos','PD','MD',72,0,'Ponta reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (33,20,'Anderson','ATA',NULL,71,0,'Atacante jovem.');

INSERT INTO teams VALUES (34,'Vasco',2000,'Vasco 2000 (Brasileiro + Mercosul)','Oswaldo de Oliveira','#000000','#ffffff','Romario 36 anos ainda artilheiro. Donizete e Luizao. Campeao Copa Mercosul.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,1,'Carlos Germano','GOL',NULL,85,1,'Goleiro campeao 2000.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,2,'Valber','LD',NULL,80,1,'Lateral veterano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,3,'Anderson Polga','ZAG',NULL,83,1,'Zagueiro titular.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,4,'Odvan','ZAG',NULL,81,1,'Veterano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,5,'Felipe','LE',NULL,82,1,'Lateral esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,6,'Ramon','MEI','MD',85,1,'Meia ofensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,7,'Juninho Paulista','MEI','MC',87,1,'Meia virtuoso artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,8,'Pedrinho','MEI','MC',83,1,'Meia criativo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,9,'Luizao','ATA',NULL,89,1,'Centroavante de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,10,'Donizete','ATA',NULL,87,1,'Artilheiro parceiro de Romario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,11,'Romario','ATA',NULL,94,1,'36 anos e ainda artilheiro. Lenda maxima.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,12,'Sandro','GOL','MC',74,0,'Segundo goleiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,13,'Valdir','LD',NULL,76,0,'Lateral reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,14,'Mauro Galvao','ZAG',NULL,82,0,'Veterano ainda no plantel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,15,'Everton','ATA',NULL,76,0,'Atacante jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,16,'Nasa','VOL',NULL,80,0,'Volante ainda presente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,17,'Nilton','VOL','MC',79,0,'Volante de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,18,'Paulo Victor','MEI','MC',77,0,'Meia jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,19,'Alexandre Pires','ATA',NULL,78,0,'Atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (34,20,'Fabio Augusto','LD',NULL,75,0,'Lateral jovem.');

INSERT INTO teams VALUES (35,'Athletico-PR',2001,'Athletico-PR 2001','Geninho','#c8102e','#000000','Maior titulo paranaense. Kleberson Copa 02. Alex Mineiro idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,1,'Flávio','GOL',NULL,NULL,NULL,82,1,'Goleiro titular.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,2,'Nem','ZAG',NULL,NULL,NULL,84,1,'O capitao e xerife do trio de zaga.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,3,'Gustavo','ZAG',NULL,NULL,NULL,81,1,'Zagueiro do trio titular.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,4,'Rogério Corrêa','ZAG',NULL,NULL,NULL,81,1,'Zagueiro do trio titular.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,5,'Alessandro','LD','MD',NULL,NULL,81,1,'Ala direito no 3-5-2, sem pontas fixos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,6,'Fabiano','LE','ME',NULL,NULL,80,1,'Ala esquerdo no 3-5-2, sem pontas fixos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,7,'Cocito','VOL',NULL,NULL,NULL,82,1,'Incansavel cao de guarda da cabeca de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,8,'Kléberson','VOL','MC','MD',NULL,87,1,'Motorzinho do time, titular no penta em 2002.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,9,'Adriano Gabiru','MC','MEI','MD',NULL,83,1,'Meia de transicao e conducao de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,10,'Alex Mineiro','ATA',NULL,NULL,NULL,88,1,'Heroi absoluto do titulo, 8 gols nos 4 jogos decisivos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,11,'Kléber Pereira','ATA',NULL,NULL,NULL,86,1,'Kleber Incendiario. Artilheiro do time com 17 gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,12,'Luisinho Netto','LD','MD',NULL,NULL,76,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,13,'Vicente','LE',NULL,NULL,NULL,75,0,'Lateral esquerdo reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,14,'Igor','ZAG',NULL,NULL,NULL,76,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,15,'Pires','VOL',NULL,NULL,NULL,77,0,'Primeiro ou segundo volante de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,16,'Souza','MEI','MC',NULL,NULL,81,0,'Meia reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,17,'Lobatón','MEI',NULL,NULL,NULL,74,0,'Meia reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,18,'Ilan','ATA','PD',NULL,NULL,79,0,'Segundo atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,19,'Dagoberto','ATA','PE',NULL,NULL,72,0,'Subiu das categorias de base no final do ano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (35,20,'Adauto','ATA',NULL,NULL,NULL,74,0,'Atacante do banco.');

INSERT INTO teams VALUES (36,'Santos',2002,'Santos 2002 (Meninos da Vila)','Emerson Leao','#000000','#ffffff','Meninos da Vila. Robinho, Diego, Elano revelados. Pedaladas na final.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,1,'Fabio Costa','GOL',NULL,86,1,'Goleiro agil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,2,'Maurinho','LD',NULL,78,1,'Lateral direito.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,3,'Andre Luis','ZAG',NULL,83,1,'Zagueiro tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,4,'Alex','ZAG',NULL,85,1,'Defensor solido.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,5,'Leo','LE',NULL,83,1,'Lateral esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,6,'Paulo Almeida','VOL','MC',82,1,'Volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,7,'Renato','VOL','MC',86,1,'Versatil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,8,'Elano','MEI','MD',87,1,'Meia que foi ao Manchester City.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,9,'Diego','MEI','MC',88,1,'Genio revelado. Werder Bremen.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (36,10,'Robinho','ATA','PE','ME',NULL,92,1,'Pedaladas na final. Revelacao Copa 02.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,11,'William','PE','ME',76,1,'Ponta esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,12,'Julio Cesar','GOL',NULL,73,0,'Reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,13,'Wellington','MEI','MC',72,0,'Meia reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,14,'Alexandre','ATA',NULL,73,0,'Atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,15,'Robert','ATA',NULL,82,0,'Centroavante de recurso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,16,'Michel','ATA',NULL,71,0,'Atacante jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,17,'Adriano','ZAG',NULL,73,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,18,'Felipe','LD',NULL,72,0,'Lateral de apoio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,19,'Marcos','VOL','MD',71,0,'Volante jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (36,20,'Junior','MEI','MC',70,0,'Meia em desenvolvimento.');

INSERT INTO teams VALUES (37,'Cruzeiro',2003,'Cruzeiro 2003 (Triplice Coroa)','Vanderlei Luxemburgo','#1c3f94','#ffffff','Triplice Coroa. Alex artilheiro e Bola de Ouro. Cruzeiro invicto em casa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,1,'Gomes','GOL',NULL,80,1,'Goleiro do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,2,'Maurinho','LD',NULL,78,1,'Lateral direito.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,3,'Cris','ZAG',NULL,79,1,'Zagueiro tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,4,'Edu Dracena','ZAG',NULL,82,1,'Zagueiro alto nivel. Copa 14.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,5,'Leandro','LE','MC',78,1,'Lateral esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,6,'Maldonado','VOL','MC',79,1,'Volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,7,'Augusto Recife','VOL','MC',77,1,'Volante tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,8,'Wendell','MEI','MC',78,1,'Meia de ligacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,9,'Alex','MEI','MC',90,1,'23 gols artilheiro. Bola de Ouro 2003.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,10,'Aristizabal','ATA',NULL,82,1,'Colombiano artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,11,'Mota','ATA',NULL,79,1,'Centroavante de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,12,'Maicon','LD',NULL,76,0,'Jovem que foi ao Inter de Milao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,13,'Luisao','ZAG',NULL,79,0,'Zagueiro que foi ao Benfica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,14,'Felipe Melo','VOL','MC',78,0,'Volante que foi ao exterior.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,15,'Zinho','MEI','MC',73,0,'Veterano ainda com qualidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,16,'Marcio Nobre','ATA',NULL,75,0,'Atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,17,'Deivid','ATA',NULL,78,0,'Centroavante; brilharia no Santos 2004.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,18,'Alex Alves','ATA',NULL,74,0,'Atacante de recurso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,19,'Martinez','MEI','MC',73,0,'Meia reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (37,20,'Thiago','ZAG',NULL,75,0,'Terceiro zagueiro.');

INSERT INTO teams VALUES (38,'Santos',2004,'Santos 2004 (Bicampeonato + 103 gols)','Vanderlei Luxemburgo','#000000','#ffffff','Recorde 103 gols. Robinho Bola de Ouro. Deivid 22 gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,1,'Mauro','GOL',NULL,81,1,'Titular na reta final do campeonato e decisivo na conquista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,2,'Alex','ZAG',NULL,86,1,'Zagueiro central, forte fisicamente e um dos pilares da defesa santista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,3,'André Luís','ZAG',NULL,83,1,'Zagueiro firme que formou a dupla titular ideal com Alex.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,4,'Paulo César','LD',NULL,83,1,'Lateral-direito de muita força física e chegada ao ataque.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,5,'Léo','LE',NULL,87,1,'Lateral-esquerdo histórico, veloz no apoio e seguro na marcação.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,6,'Renato','VOL','MC',85,1,'Volante técnico de excelente passe e posicionamento impecável.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,7,'Paulo Almeida','VOL','MC',84,1,'Volante de contenção e capitão com forte espírito de liderança.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,8,'Elano','MEI','MD',91,1,'Meio-campista versátil, habilidoso e decisivo nas bolas paradas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,9,'Ricardinho','MEI','MC',89,1,'Maestro contratado para ditar o ritmo e organizar a armação do time.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,10,'Robinho','ATA','ME',94,1,'O grande craque e protagonista do time com seus dribles e gols. Bola de Ouro 2004.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,11,'Deivid','ATA',NULL,87,1,'Centroavante letal e um dos principais artilheiros da campanha.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,12,'Doni','GOL',NULL,77,0,'Goleiro experiente com passagens marcantes que integrou o elenco naquele ano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,13,'Júlio Sérgio','GOL',NULL,75,0,'Atuou em partidas importantes ao longo da temporada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,14,'Ávalos','ZAG',NULL,79,0,'Zagueiro argentino de muita raça, reserva imediato de extrema confiança.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,15,'Flávio','LD','LE',77,0,'Lateral polivalente que atuava em ambos os lados do campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,16,'Fabinho','VOL','MC',79,0,'Volante marcador que dava sustentação defensiva ao meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,17,'Preto Casagrande','MEI','VOL',79,0,'Meia experiente que deu equilíbrio tático na arrancada final.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,18,'Marcinho','MEI','ATA',77,0,'Meia-atacante veloz usado para quebrar linhas defensivas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,19,'Basílio','ATA',NULL,82,0,'O lendário talismã, autor de gols decisivos vindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (38,20,'William','ATA','ME',76,0,'Jovem atacante de velocidade que compôs as opções ofensivas.');

INSERT INTO teams VALUES (39,'Corinthians',2005,'Corinthians 2005','Antonio Lopes','#000000','#ffffff','Tevez Bola de Ouro. 20 gols. Mascherano no elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,1,'Fábio Costa','GOL',NULL,NULL,NULL,88,1,'Goleiro de qualidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,2,'Marinho','ZAG',NULL,NULL,NULL,82,1,'Forca fisica e imposicao nos combates por baixo e pelo alto.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,3,'Betão','ZAG','LD',NULL,NULL,82,1,'Cria do clube, zagueiro de muita raca e dedicacao defensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,4,'Gustavo Nery','LE','ME','MC',NULL,86,1,'Ala muito ofensivo, forte chegada a linha de fundo e finalizacao de fora da area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,5,'Coelho','LD','MD',NULL,NULL,83,1,'Excelentes cruzamentos e cobrancas de falta potentes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,6,'Marcelo Mattos','VOL',NULL,NULL,NULL,86,1,'Grande cao de guarda do meio-campo, equilibrio total a defesa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,7,'Wendel','VOL','LD',NULL,NULL,78,1,'Segundo volante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,8,'Bruno Octávio','VOL',NULL,NULL,NULL,76,1,'Primeiro volante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,9,'Carlos Alberto','MC','MEI','PD',NULL,87,1,'Ousado e habilidoso, quebrava linhas de marcacao conduzindo com velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,10,'Tevez','ATA','MEI','PE',NULL,95,1,'O Rei da conquista, raca absurda e faro de gol implacavel. Depois Man City.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,11,'Nilmar','ATA','PD','PE',NULL,90,1,'Parceria magica com Tevez, destruindo defesas com velocidade e dribles secos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,12,'Tiago Campagnaro','GOL',NULL,NULL,NULL,77,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,13,'Edson','LD',NULL,NULL,NULL,76,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,14,'Sebá Domínguez','ZAG',NULL,NULL,NULL,84,0,'Zagueiro argentino de muita lideranca e tecnica na saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,15,'Marcus Vinícius','ZAG',NULL,NULL,NULL,77,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,16,'Rosinei','VOL','MC','MD',NULL,85,0,'Motorzinho do meio-campo, intensidade, velocidade e infiltracoes na area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,17,'Roger Flores','MEI','MC',NULL,NULL,86,0,'Maestro classico da armacao, passes precisos e otima visao de jogo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,18,'Hugo','MEI','ME',NULL,NULL,80,0,'Meia reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,19,'Jô','ATA','PE',NULL,NULL,82,0,'Jovem revelacao, muita forca fisica e velocidade pelos lados do campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (39,20,'Bobô','ATA',NULL,NULL,NULL,76,0,'Atacante de referencia.');

INSERT INTO teams VALUES (40,'Sao Paulo',2006,'Sao Paulo 2006','Muricy Ramalho','#c8102e','#000000','Rogerio Ceni melhor do titulo. Tricampeonato iniciando.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,1,'Rogerio Ceni','GOL',NULL,94,1,'Melhor do titulo. Goleiro-artilheiro lenda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,2,'Ilsinho','LD','PD',78,1,'Lateral-ponta criativo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,3,'Fabao','ZAG',NULL,81,1,'Zagueiro solido.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,4,'Miranda','ZAG',NULL,82,1,'Iniciando o brilho. Copa 14.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,5,'Junior','LE','MC',77,1,'Lateral esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,6,'Mineiro','VOL','MC',81,1,'Volante tecnico. Copa 10.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,7,'Josue','VOL','MEI',80,1,'Volante criativo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,8,'Souza','MEI','MC',78,1,'Meia de ligacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,9,'Danilo','MEI','MC',80,1,'Meia que foi ao Wolfsburg.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,10,'Leandro','PD','MC',77,1,'Ponta pelos dois lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,11,'Aloisio','ATA',NULL,81,1,'Centroavante artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,12,'Lugano','ZAG',NULL,82,0,'Uruguaio de alto nivel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,13,'Alex Silva','ZAG',NULL,73,0,'Terceiro zagueiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,14,'Cicinho','LD','PD',79,0,'Lateral-ponta dinamico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,15,'Thiago Ribeiro','MEI','MD',75,0,'Meia jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,16,'Richarlyson','MEI','MC',74,0,'Meia polivalente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,17,'Lenilson','ATA',NULL,73,0,'Atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,18,'Anderson','ATA',NULL,72,0,'Atacante jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,19,'Rodrigo','LD',NULL,71,0,'Lateral de recurso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (40,20,'Edcarlos','ZAG',NULL,76,0,'Zagueiro jovem.');

INSERT INTO teams VALUES (41,'Sao Paulo',2007,'Sao Paulo 2007 (Bicampeonato)','Muricy Ramalho','#c8102e','#000000','Grafite 20 gols artilheiro. Hernanes despontando. Bicampeonato.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,1,'Rogério Ceni','GOL',NULL,NULL,NULL,92,1,'Capitao, lider e batedor oficial de faltas e penaltis.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,2,'Breno','ZAG',NULL,NULL,NULL,82,1,'Revelacao do campeonato pelo lado direito do trio de zaga.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,3,'Miranda','ZAG',NULL,NULL,NULL,84,1,'Pilar tecnico da sobra no esquema 3-5-2.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,4,'Alex Silva','ZAG',NULL,NULL,NULL,74,1,'Zagueiro pelo lado esquerdo, muita imposicao fisica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,5,'Ilsinho','LD','MD','MC',NULL,78,1,'Fundamental no primeiro semestre antes de ir ao Shakhtar.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,6,'Jorge Wagner','ME','MEI','LE',NULL,82,1,'Bola parada cirurgica e cruzamentos precisos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,7,'Josué','VOL',NULL,NULL,NULL,81,1,'Dupla lendaria com Mineiro e depois Hernanes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,8,'Richarlyson','VOL','LE','ZAG','MC',79,1,'Grande curinga tatico de Muricy Ramalho.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,9,'Hernanes','MC','VOL','MEI',NULL,86,1,'Assumiu a titularidade no meio do ano. Melhor jogador do campeonato.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,10,'Aloísio Chulapa','ATA',NULL,NULL,NULL,80,1,'Mestre do pivo, referencia para os meias.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,11,'Borges','ATA',NULL,NULL,NULL,79,1,'Artilheiro do time com gols decisivos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,12,'Bosco','GOL',NULL,NULL,NULL,74,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,13,'Reasco','LD',NULL,NULL,NULL,76,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,14,'Júnior','LE','ME','MC',NULL,77,0,'Lateral esquerdo de cadencia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,15,'Jadilson','LE','ME',NULL,NULL,76,0,'Lateral esquerdo reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,16,'André Dias','ZAG',NULL,NULL,NULL,78,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,17,'Fernando','VOL',NULL,NULL,NULL,77,0,'Primeiro volante de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,18,'Hugo','MEI','MC','ME',NULL,75,0,'Meia de infiltracao e forte jogo aereo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,19,'Leandro','ATA','MD','PD',NULL,76,0,'O Guerreiro, sacrificava-se taticamente como ala-direito.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (41,20,'Dagoberto','ATA','PE','PD',NULL,81,0,'Contratado do Atletico-PR, drible e velocidade.');

INSERT INTO teams VALUES (42,'Sao Paulo',2008,'Sao Paulo 2008 (Tricampeonato)','Muricy Ramalho','#c8102e','#000000','Tricampeonato historico. Rogerio Ceni ainda titular. Miranda consolidado.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,1,'Rogerio Ceni','GOL',NULL,91,1,'Tri. Idolo maximo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,2,'Ilsinho','LD','PD',77,1,'Lateral-ponta tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,3,'Fabao','ZAG',NULL,80,1,'Zagueiro tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,4,'Miranda','ZAG',NULL,85,1,'No auge. Melhor zagueiro do Brasil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,5,'Lugano','ZAG',NULL,84,1,'Uruguaio tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,6,'Junior','LE','MC',76,1,'Lateral tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,7,'Mineiro','VOL','MC',82,1,'Volante tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,8,'Josue','VOL','MEI',80,1,'Meia-volante tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,9,'Danilo','MEI','MC',80,1,'Meia tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,10,'Hernanes','MEI','MC',88,1,'No auge artilheiro pela meia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,11,'Borges','ATA',NULL,80,1,'18 gols artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,12,'Aloisio','ATA',NULL,79,0,'Atacante tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,13,'Diego Tardelli','ATA',NULL,81,0,'Atacante no auge.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,14,'Grafite','ATA',NULL,82,0,'Artilheiro ainda presente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,15,'Alex Silva','ZAG',NULL,74,0,'Terceiro zagueiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,16,'Eder Luis','ATA',NULL,74,0,'Atacante de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,17,'Rafael','ZAG',NULL,73,0,'Zagueiro jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,18,'Jadson','MEI','MC',77,0,'Meia jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,19,'Junior Cesar','LE',NULL,72,0,'Lateral jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (42,20,'Souza','MEI','MC',79,0,'Meia tricampeao.');
INSERT INTO teams VALUES (43,'Flamengo',2009,'Flamengo 2009 (Hexacampeonato)','Andrade','#c8102e','#000000','Hexacampeonato improvavel. Petkovic 37 anos no meio. Juan e Leo Moura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,1,'Bruno','GOL',NULL,82,1,'Melhor goleiro do Brasil em 2009. 37 jogos na campanha.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,2,'Ronaldo Angelim','ZAG',NULL,82,1,'Marcou o gol do titulo. Heroi. 36 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,3,'Leo Moura','LD','PD',86,1,'Lateral-ponta idolo. Eleito selecao. 32 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,4,'Willians','LE',NULL,79,1,'Lateral esquerdo titular do hexa. 31 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,5,'Wellinton Souza','ZAG',NULL,78,1,'Parceiro de Angelim na zaga titular. 21 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,6,'Ze Roberto','MD','MEI',80,1,'Veterano ex-Bayern. Decisivo. 25 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,7,'Gonzalo Fierro','MEI','MC',81,1,'Meia-armador chileno de qualidade. 23 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,8,'Petkovic','MEI','MC',85,1,'Servio 37 anos. Gol olimpico. Heroi. 23 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,9,'Rafael Toro','MC','MEI',78,1,'Meio-campista de apoio titular. 22 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,10,'Adriano','ATA','MEI',88,1,'Imperador. Artilheiro do hexa. 30 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,11,'Kleber','ATA',NULL,83,1,'Centroavante de referencia. 29 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,12,'Juan','ZAG',NULL,84,0,'Zagueiro brasileiro, chegou na reta final da campanha. 19 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,13,'Alvaro','LD','LE',74,0,'Lateral de reposicao. 18 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,14,'Emerson Sheik','PD','ATA',78,0,'Ponta velocista. 14 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,15,'Maldonado','VOL','MC',74,0,'Volante de rotacao. 13 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,16,'Denis Marques','ATA',NULL,73,0,'Atacante jovem. 12 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,17,'Everton Silva','ZAG',NULL,74,0,'Zagueiro/lateral de reposicao. 11 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,18,'David Braz','ZAG',NULL,80,0,'Zagueiro seguro. 10 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,19,'Ibson','VOL','MC',79,0,'Volante/meia de qualidade. 9 jogos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (43,20,'Diego','GOL',NULL,72,0,'Goleiro reserva. 1 jogo.');

INSERT INTO teams VALUES (44,'Santos',2010,'Santos 2010 (Copa do Brasil)','Dorival Junior','#000000','#ffffff','Copa do Brasil campeao. Neymar 18 anos emergindo ao lado de Robinho, Elano e Ganso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,1,'Rafael','GOL',NULL,87,1,'Goleiro jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (44,2,'Danilo','LD','MC','VOL',NULL,83,1,'Copa 18/22. Lateral revelacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,3,'Edu Dracena','ZAG',NULL,85,1,'Zagueiro tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,4,'Durval','ZAG',NULL,86,1,'Parceiro de Edu.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,5,'Leo','LE',NULL,81,1,'Copa 10. Lateral campeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,6,'Adriano','VOL','MC',79,1,'Volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,7,'Arouca','VOL','MC',85,1,'Volante tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,8,'Elano','MEI','MD',87,1,'Ex-Man City. Maestro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,9,'Paulo Henrique Ganso','MEI','MC',88,1,'Revelacao genial. Visao unica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,10,'Robinho','PE','ME',89,1,'Artilheiro retornando. Copa 10.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,11,'Neymar','ATA','PE',93,1,'18 anos 18 gols. Explodindo para o mundo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,12,'Andre','ATA',NULL,82,0,'Centroavante artilheiro Copa do Brasil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,13,'Ze Eduardo','ATA',NULL,79,0,'Centroavante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,14,'Alan Kardec','ATA',NULL,78,0,'Atacante de poder.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,15,'Alan Patrick','MEI','MC',78,0,'Meia jovem revelacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,16,'Alex Sandro','LE',NULL,81,0,'Jovem que foi a Juventus.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (44,17,'Wesley','VOL','MC','LD','MD',82,0,'Volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,18,'Bruno Rodrigo','ZAG',NULL,79,0,'Terceiro zagueiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,19,'Felipe','GOL',NULL,75,0,'Reserva do gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (44,20,'Para','LD',NULL,78,0,'Lateral de reposicao.');

INSERT INTO teams VALUES (45,'Fluminense',2010,'Fluminense 2010 (Tricampeonato)','Muricy Ramalho','#7a1e3c','#006437','Conca, Fred, Deco e Emerson Sheik. Tricampeonato historico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,1,'Ricardo Berna','GOL',NULL,79,1,'Goleiro tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,2,'Mariano','LD','MD',83,1,'Lateral direito tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,3,'Gum','ZAG',NULL,81,1,'Capitao e zagueiro idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,4,'Leandro Euzebio','ZAG',NULL,80,1,'Zagueiro tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,5,'Carlinhos','LE',NULL,79,1,'Lateral atacante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,6,'Diguinho','VOL','MC',80,1,'Volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,7,'Deco','MC',NULL,85,1,'Ex-Barcelona. Maestro do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,8,'Conca','MEI','MC',88,1,'Argentino. 9 gols 20 assistencias. Craque.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,9,'Emerson Sheik','ATA','ME',79,1,'Marcou o gol do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,10,'Washington','ATA',NULL,82,1,'Veterano artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,11,'Fred','ATA',NULL,86,1,'Artilheiro 20 gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,12,'Fernando Henrique','GOL',NULL,76,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,13,'Valencia','VOL',NULL,78,0,'Volante colombiano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,14,'Rodrigo Souto','VOL','MC',77,0,'Volante de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,15,'Julio Cesar','LE','ME',76,0,'Lateral esquerdo reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,16,'Thiago Neves','MEI','ME',76,0,'Meia criativo reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,17,'Marquinho','ME','MC',76,0,'Meia esquerda versatil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,18,'Rodrigueiro','MEI','MC',74,0,'Meia de apoio reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,19,'Alan','ATA','ME',74,0,'Atacante de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (45,20,'Andre Luis','ZAG',NULL,73,0,'Zagueiro reserva jovem.');

INSERT INTO teams VALUES (46,'Santos',2011,'Santos 2011 (Libertadores)','Adilson Batista','#000000','#ffffff','Campeao da Copa Libertadores 2011. Neymar, Ganso, Elano, Arouca. Geracao historica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,1,'Rafael Cabral','GOL',NULL,NULL,NULL,82,1,'Goleiro jovem. Depois Roma.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,2,'Danilo','LD','VOL','MC','MD',85,1,'Lateral revelacao, apoio total pela direita.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,3,'Edu Dracena','ZAG',NULL,NULL,NULL,84,1,'Zagueiro solido.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,4,'Durval','ZAG',NULL,NULL,NULL,78,1,'Parceiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,5,'Léo','LE','ME',NULL,NULL,82,1,'Lateral Copa 10.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,6,'Arouca','VOL','MC',NULL,NULL,84,1,'Volante tecnico campeao Libertadores.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,7,'Wesley','MC','LD','VOL',NULL,78,1,'Meia box-to-box de muita entrega.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,8,'Ganso','MEI','MC',NULL,NULL,89,1,'Maestro absoluto da Libertadores. Camisa 10 classico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,9,'Marquinhos','MEI','MC',NULL,NULL,78,1,'Meia-atacante de apoio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,10,'Neymar','PE','PD','MEI','ATA',95,1,'Revelacao do seculo. Campeao Libertadores.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,11,'Zé Eduardo','ATA','PE','PD',NULL,80,1,'Zé Love. Centroavante movel parceiro de Neymar.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,12,'Felipe','GOL',NULL,NULL,NULL,77,0,'Reserva do gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,13,'Pará','LD','LE','VOL',NULL,80,0,'Lateral veterano polivalente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,14,'Alex Sandro','LE','ME',NULL,NULL,80,0,'Jovem que foi a Juventus.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,15,'Bruno Aguiar','ZAG',NULL,NULL,NULL,76,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,16,'Roberto Brum','VOL',NULL,NULL,NULL,76,0,'Primeiro volante de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,17,'Rodrigo Mancha','VOL',NULL,NULL,NULL,75,0,'Volante de rotacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,18,'Madson','MEI','PD',NULL,NULL,78,0,'Meia-atacante versatil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,19,'Robinho','ATA','PE','PD',NULL,87,0,'Bicampeao voltando.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (46,20,'André','ATA',NULL,NULL,NULL,83,0,'Centroavante de referencia.');

INSERT INTO teams VALUES (47,'Corinthians',2011,'Corinthians 2011 (Pentacampeonato)','Tite','#000000','#ffffff','Penta. Base do bi Libertadores/Mundial 2012. Tite transformou o time.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,1,'Júlio César','GOL',NULL,NULL,NULL,78,1,'Goleiro titular do penta de Tite.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,2,'Alessandro','LD','LE',NULL,NULL,79,1,'Lateral tecnico, quebrava galho invertido.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,3,'Chicão','ZAG',NULL,NULL,NULL,84,1,'Zagueiro idolo. Campeao mundial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,4,'Leandro Castán','ZAG','LE',NULL,NULL,85,1,'Zagueiro alto nivel. Inter de Milao depois.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,5,'Fábio Santos','LE',NULL,NULL,NULL,83,1,'Lateral esquerdo bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,6,'Ralf','VOL',NULL,NULL,NULL,86,1,'Primeiro volante classico de forte marcacao. Idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,7,'Paulinho','VOL','MC',NULL,NULL,88,1,'Segundo volante infiltrador. Selecao. Depois Barcelona.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,8,'Alex','MC','MEI','ME',NULL,85,1,'Meia genial de ligacao. Cobracas letais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,9,'Danilo','MEI','MC','PE','ATA',84,1,'Meia-armador de cadencia, falso 9 na area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,10,'Emerson Sheik','PE','ATA','PD',NULL,85,1,'Artilheiro do penta.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,11,'Liédson','ATA',NULL,NULL,NULL,82,1,'Centroavante classico de area. Idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,12,'Danilo Fernandes','GOL',NULL,NULL,NULL,74,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,13,'Weldinho','LD',NULL,NULL,NULL,74,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,14,'Ramon','LE','ME',NULL,NULL,76,0,'Lateral esquerdo/ala reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,15,'Wallace','ZAG',NULL,NULL,NULL,79,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,16,'Paulo André','ZAG',NULL,NULL,NULL,80,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,17,'Edenílson','VOL','LD','MD',NULL,77,0,'Segundo volante versatil de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,18,'Morais','MEI','MD',NULL,NULL,76,0,'Meia-atacante de rotacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,19,'Jorge Henrique','PD','PE','MD',NULL,80,0,'Ponta reserva tatico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (47,20,'Willian Bigode','ATA','PD','PE',NULL,76,0,'Segundo atacante movel de recurso.');

INSERT INTO teams VALUES (48,'Fluminense',2012,'Fluminense 2012 (Tetracampeonato)','Abel Braga','#7a1e3c','#006437','Tetracampeonato. Fred 25 gols artilheiro. Deco maestro em fim de carreira.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,1,'Diego Cavalieri','GOL',NULL,84,1,'Goleiro do tetra.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,2,'Bruno','LD',NULL,81,1,'Lateral direito tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,3,'Gum','ZAG',NULL,85,1,'Capitao tetracampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,4,'Leandro Euzebio','ZAG',NULL,82,1,'Zagueiro tetracampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,5,'Carlinhos','LE',NULL,82,1,'Lateral atacante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,6,'Edinho','VOL','ME',78,1,'Meia-volante versatil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,7,'Jean','VOL','MC',79,1,'Volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,8,'Deco','MEI','MC',87,1,'Portugues bicampeao Champions. Maestro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,9,'Thiago Neves','MEI','ME',88,1,'Craque do tetra.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,10,'Wellington Nem','PD','MEI',83,1,'Ponta-meia criativo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,11,'Fred','ATA',NULL,90,1,'25 gols artilheiro do Brasileirao 2012.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,12,'Rafael Sobis','ATA',NULL,82,0,'Atacante de qualidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,13,'Rafael Moura','ATA',NULL,79,0,'Atacante versatil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,14,'Wagner','MEI','MC',76,0,'Meia de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,15,'Lanzini','MEI','MC',80,0,'Jovem argentino. Foi ao West Ham.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,16,'Michael','MEI','MD',74,0,'Meia jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,17,'Rodrigo Lindoso','VOL',NULL,78,0,'Volante de suporte.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,18,'Samuel','ATA',NULL,73,0,'Atacante jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,19,'Martinuccio','MEI','MC',74,0,'Meia reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (48,20,'Anderson','ZAG',NULL,78,0,'Terceiro zagueiro.');

INSERT INTO teams VALUES (49,'Atletico-MG',2013,'Atletico-MG 2013 (Libertadores)','Cuca','#000000','#ffffff','Campeao da Libertadores. Victor heroi, Ronaldinho maestro, Tardelli artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,1,'Victor','GOL',NULL,NULL,NULL,91,1,'Sao Victor. Heroi eterno com defesas de penalti milagrosas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,2,'Marcos Rocha','LD','MD',NULL,NULL,85,1,'Enorme apoio ofensivo e arremessos laterais longos cruciais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,3,'Réver','ZAG',NULL,NULL,NULL,87,1,'Capitao America. Posicionamento e arma letal no jogo aereo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,4,'Leonardo Silva','ZAG',NULL,NULL,NULL,87,1,'Torres Gemeas com Rever. Gol salvador na finalissima no Mineirao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,5,'Junior Cesar','LE',NULL,NULL,NULL,81,1,'Assumiu a titularidade na reta final com velocidade e entrega.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,6,'Richarlyson','LE','VOL','ZAG',NULL,81,1,'Curinga defensivo de muita raca, titular em boa parte da Libertadores.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,7,'Pierre','VOL',NULL,NULL,NULL,84,1,'Incansavel cao de guarda, carregava o piano para os craques.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,8,'Josué','VOL',NULL,NULL,NULL,82,1,'Contratado no meio da competicao, experiencia internacional e passe.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,9,'Ronaldinho Gaúcho','MEI','PE','ATA',NULL,95,1,'O Bruxo. Cerebro tecnico e mistico, assistencias geniais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,10,'Diego Tardelli','PD','ATA','PE',NULL,89,1,'Retornou ao Galo no auge tecnico, recomposicao e faro de gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,11,'Bernard','PE','PD','MEI',NULL,87,1,'Alegria nas Pernas. Velocidade e dribles pelo corredor esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,12,'Giovanni','GOL',NULL,NULL,NULL,78,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,13,'Carlos César','LD',NULL,NULL,NULL,76,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,14,'Gilberto Silva','ZAG','VOL',NULL,NULL,80,0,'Pentacampeao mundial, lideranca e peso ao banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,15,'Rafael Marques','ZAG',NULL,NULL,NULL,77,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,16,'Leandro Donizete','VOL','MC',NULL,NULL,84,0,'O General. Dupla de volantes racuda e temida com Pierre.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,17,'Guilherme','MEI','ATA',NULL,NULL,82,0,'Marcou o gol decisivo contra o Newells na semifinal.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,18,'Leleu','MEI',NULL,NULL,NULL,72,0,'Meia reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,19,'Luan','PD','PE',NULL,NULL,82,0,'Menino Maluquinho, intensidade absurda vindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (49,20,'Jô','ATA',NULL,NULL,NULL,88,0,'Artilheiro maximo daquela Libertadores com 7 gols.');

INSERT INTO teams VALUES (50,'Cruzeiro',2013,'Cruzeiro 2013 (Brasileiro)','Marcelo Oliveira','#1c3f94','#ffffff','20 titulares usados. Everton Bola de Ouro. Dede lider defensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,1,'Fábio','GOL',NULL,NULL,NULL,89,1,'Verdadeiro paredao e capitao incontestavel do time.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,2,'Ceará','LD',NULL,NULL,NULL,82,1,'Enorme experiencia e solidez defensiva a linha de quatro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,3,'Dedé','ZAG',NULL,NULL,NULL,86,1,'O Mito, contratado a peso de ouro, imposicao fisica e aerea.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,4,'Bruno Rodrigo','ZAG',NULL,NULL,NULL,84,1,'Zagueiro extremamente seguro e letal no jogo aereo ofensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,5,'Egídio','LE','ME',NULL,NULL,82,1,'Excelentes cruzamentos e passes que abasteciam o ataque.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,6,'Nilton','VOL',NULL,NULL,NULL,85,1,'Gigante no meio-campo, forte marcacao, infiltracao e chute potente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,7,'Lucas Silva','VOL','MC',NULL,NULL,84,1,'Cria da base, assumiu a titularidade com desarmes e passes longos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,8,'Éverton Ribeiro','MEI','PD','MC',NULL,91,1,'Grande craque do campeonato, dribles curtos e assistencias geniais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,9,'Ricardo Goulart','MEI','ATA',NULL,NULL,87,1,'Motor do time, infiltracao como elemento surpresa na area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,10,'Willian Bigode','PE','PD','ATA',NULL,85,1,'Caiu nas gracas da torcida com muita raca e gols importantes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,11,'Borges','ATA',NULL,NULL,NULL,85,1,'Homem gol da equipe na reta final, mestre no posicionamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,12,'Rafael','GOL',NULL,NULL,NULL,79,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,13,'Mayke','LD','MD',NULL,NULL,82,0,'Jovem revelacao que voava no apoio ofensivo em velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,14,'Leo','ZAG','LD',NULL,NULL,80,0,'Zagueiro reserva versatil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,15,'Paulão','ZAG',NULL,NULL,NULL,77,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,16,'Henrique','VOL',NULL,NULL,NULL,81,0,'Retornou ao clube no decorrer do ano para dar cadencia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,17,'Leandro Guerreiro','VOL','ZAG',NULL,NULL,77,0,'Primeiro volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,18,'Júlio Baptista','MEI','ATA',NULL,NULL,81,0,'O Bestia. Grande contratacao de impacto que trouxe peso ao elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,19,'Luan','PD','PE',NULL,NULL,79,0,'O Menino Maluquinho, velocidade e intensidade tatica pelos lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (50,20,'Dagoberto','PE','ATA',NULL,NULL,84,0,'Peca tecnica refinada, drible e experiencia de titulos.');

INSERT INTO teams VALUES (51,'Cruzeiro',2014,'Cruzeiro 2014 (Tetracampeonato)','Marcelo Oliveira','#1c3f94','#ffffff','Tetra. Lider por 33 rodadas. Moreno artilheiro 15 gols. Everton e Goulart na Selecao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,1,'Fábio','GOL',NULL,NULL,NULL,87,1,'Bicampeao. Idolo maximo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,2,'Ceará','LD',NULL,NULL,NULL,82,1,'Lateral bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,3,'Dedé','ZAG',NULL,NULL,NULL,90,1,'Melhor zagueiro do Brasil 2014.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,4,'Bruno Rodrigo','ZAG',NULL,NULL,NULL,81,1,'Parceiro de Dede.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,5,'Egídio','LE','ME',NULL,NULL,81,1,'Lateral esquerdo bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,6,'Lucas Silva','VOL','MC',NULL,NULL,84,1,'Segundo volante de excelente passe longo e chute de fora.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,7,'Henrique','VOL',NULL,NULL,NULL,81,1,'Primeiro volante tatico de marcacao e cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,8,'Nilton','VOL',NULL,NULL,NULL,83,1,'Volante de forca fisica e infiltracao aerea. Artilheiro bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,9,'Éverton Ribeiro','MEI','PD','MC',NULL,90,1,'Bicampeao. Na Selecao Brasileira.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,10,'Ricardo Goulart','MEI','ATA','MC',NULL,89,1,'Falso 9. Artilheiro e Selecao 2014.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,11,'Marcelo Moreno','ATA',NULL,NULL,NULL,85,1,'15 gols artilheiro bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,12,'Rafael','GOL',NULL,NULL,NULL,75,0,'Reserva do gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,13,'Mayke','LD','MD',NULL,NULL,80,0,'Lateral jovem bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,14,'Samudio','LE',NULL,NULL,NULL,73,0,'Reserva da lateral.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,15,'Manoel','ZAG',NULL,NULL,NULL,78,0,'Reserva da zaga.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,16,'Leo','ZAG','LD',NULL,NULL,80,0,'Terceiro zagueiro, atuava na lateral direita.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,17,'Willian Farias','VOL',NULL,NULL,NULL,79,0,'Primeiro volante classico de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,18,'Marlone','MEI','PE',NULL,NULL,78,0,'Meia-atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,19,'Marquinhos','PD','PE',NULL,NULL,77,0,'Atacante de velocidade pelo lado direito.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (51,20,'Willian Bigode','PE','PD','ATA',NULL,75,0,'Ponta de muita intensidade e movimentacao.');

INSERT INTO teams VALUES (52,'Corinthians',2015,'Corinthians 2015 (Hexacampeonato)','Tite','#000000','#ffffff','Defesa solida com Cassio. Jadson maestro criativo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,1,'Cassio','GOL',NULL,89,1,'Melhor goleiro do Brasil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,2,'Fagner','LD',NULL,82,1,'Lateral Copa 18.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,3,'Gil Baiano','ZAG',NULL,87,1,'Zagueiro idolo. Copa 18.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,4,'Edu Dracena','ZAG',NULL,84,1,'Zagueiro experiente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,5,'Guilherme Arana','LE',NULL,83,1,'Jovem da base Copa 21/22.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,6,'Ralf','VOL','MC',85,1,'Veterano idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,7,'Elias','VOL','MEI',84,1,'Volante-meia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,8,'Renato Augusto','MEI','MC',86,1,'Meia criativo. Copa 18.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,9,'Jadson','MEI','MC',88,1,'Maestro. Cobracas magneticas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,10,'Roberto Firmino','ATA','MEI',85,1,'Revelacao; foi ao Liverpool.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,11,'Malcom','PD','MD',82,1,'Jovem; depois Barcelona.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,12,'Alessandro','LD',NULL,78,0,'Lateral veterano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,13,'Chicao','ZAG',NULL,82,0,'Veterano presente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,14,'Rodriguinho','MEI','MC',83,0,'Meia criativo importante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,15,'Willian Arao','VOL','MC',80,0,'Volante Copa 18.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,16,'Petros','VOL','MC',77,0,'Volante de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,17,'Lucca','ATA',NULL,73,0,'Atacante jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,18,'Luciano','ATA',NULL,79,0,'Atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,19,'Danilo Avelar','LE',NULL,77,0,'Lateral reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (52,20,'Uendel','LE',NULL,78,0,'Lateral esquerdo.');

INSERT INTO teams VALUES (53,'Palmeiras',2016,'Palmeiras 2016','Cuca','#006437','#ffffff','Gabriel Jesus revelacao. Dudu e Felipe Melo. 80 pontos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,1,'Fernando Prass','GOL',NULL,84,1,'Goleiro-idolo do retorno.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,2,'Marcos Rocha','LD',NULL,82,1,'Lateral Copa 18.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,3,'Edu Dracena','ZAG',NULL,83,1,'Zagueiro experiente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,4,'Mina','ZAG',NULL,84,1,'Colombiano. Depois Barcelona.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,5,'Egidio','LE',NULL,81,1,'Lateral esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,6,'Arouca','VOL','MC',83,1,'Volante ex-Fluminense Copa 14.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,7,'Felipe Melo','VOL','MC',87,1,'Lideranca e raca. Copa 14.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,8,'Thiago Santos','VOL','MC',79,1,'Volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,9,'Allione','MEI','PD',82,1,'Argentino criativo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,10,'Dudu','PD','MD',88,1,'Craque idolo artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,11,'Gabriel Jesus','ATA',NULL,91,1,'Revelacao do ano. Foi ao Man City.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,12,'Cleiton Xavier','MEI','MC',79,0,'Meia experiente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,13,'Tche Tche','MEI','VOL',80,0,'Meia-volante de qualidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,14,'Rafael Marques','ATA',NULL,77,0,'Atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,15,'Willian','ATA','ME',78,0,'Atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,16,'Mauricio Ramos','ZAG',NULL,76,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,17,'Jean','LD','MC',78,0,'Lateral direito.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,18,'Thiago Martins','ZAG',NULL,79,0,'Zagueiro tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,19,'Raphael Veiga','MEI','MC',80,0,'Jovem que seria idolo depois.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (53,20,'Roger Guedes','ATA','PE',80,0,'Jovem com gols importantes.');

INSERT INTO teams VALUES (54,'Corinthians',2017,'Corinthians 2017 (Heptacampeonato)','Fabio Carille','#000000','#ffffff','Carille campeao com 9 pontos de vantagem. Maycon e Pablo revelacoes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,1,'Cássio','GOL',NULL,NULL,NULL,90,1,'Lider do elenco e decisivo nos momentos criticos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,2,'Fagner','LD',NULL,NULL,NULL,85,1,'Peca fundamental no apoio e na solidez defensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,3,'Balbuena','ZAG',NULL,NULL,NULL,84,1,'O General. Xerife da zaga, perigoso nas bolas paradas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,4,'Pablo','ZAG',NULL,NULL,NULL,82,1,'Dupla quase intransponivel com Balbuena.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,5,'Guilherme Arana','LE','ME',NULL,NULL,83,1,'Grande destaque ofensivo, atacando bem a linha de fundo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,6,'Gabriel','VOL',NULL,NULL,NULL,82,1,'Cao de guarda a frente da zaga, contencao do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,7,'Maycon','VOL','MC','LE',NULL,85,1,'Cria da base, equilibrio na transicao de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,8,'Jadson','MEI','MD','MC',NULL,89,1,'Cerebro tecnico, organizava o jogo pela meia-direita.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,9,'Ángel Romero','PD','PE','ATA',NULL,82,1,'Simbolo maximo da entrega tatica e marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,10,'Clayson','PE','PD',NULL,NULL,80,1,'Contratado da Ponte Preta, titular na reta final.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,11,'Jô','ATA',NULL,NULL,NULL,87,1,'Artilheiro do Brasileirao. Decisivo nos classicos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,12,'Walter','GOL',NULL,NULL,NULL,75,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,13,'Léo Príncipe','LD',NULL,NULL,NULL,76,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,14,'Moisés','LE',NULL,NULL,NULL,76,0,'Lateral esquerdo reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,15,'Pedro Henrique','ZAG',NULL,NULL,NULL,77,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,16,'Camacho','VOL','MC',NULL,NULL,74,0,'Segundo volante de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,17,'Paulo Roberto','VOL','LD',NULL,NULL,76,0,'Primeiro volante, quebrou galhos na lateral.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,18,'Rodriguinho','MC','MEI','ATA',NULL,84,0,'Articulador central que pisava na area para fazer gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,19,'Marquinhos Gabriel','MEI','MD','PD',NULL,80,0,'Ponta de qualidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (54,20,'Pedrinho','PE','PD','MEI',NULL,78,0,'Xodo da torcida, vinha do banco para mudar o ritmo.');

INSERT INTO teams VALUES (55,'Palmeiras',2018,'Palmeiras 2018 (80 pontos recorde)','Luiz Felipe Scolari','#006437','#ffffff','80 pontos recorde na epoca. Dudu artilheiro 21 gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,1,'Weverton','GOL',NULL,89,1,'Melhor goleiro do Brasil. Copa 18.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,2,'Marcos Rocha','LD',NULL,84,1,'Lateral bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,3,'Gustavo Gomez','ZAG',NULL,88,1,'Paraguaio idolo. Lider defensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,4,'Luan','ZAG',NULL,83,1,'Zagueiro de qualidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,5,'Diogo Barbosa','LE',NULL,82,1,'Lateral esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,6,'Felipe Melo','VOL','MC',88,1,'Capitao e lideranca.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,7,'Bruno Henrique','VOL','ME',84,1,'Volante; seria estrela no Flamengo 2019.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,8,'Ze Rafael','VOL','MC',83,1,'Volante tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,9,'Hyoran','MEI','MC',80,1,'Meia criativo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,10,'Dudu','PD','MD',92,1,'21 gols artilheiro. Melhor do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,11,'Borja','ATA',NULL,81,1,'Colombiano artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,12,'Lucas Lima','MEI','MC',82,0,'Meia de categoria.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,13,'Willian','ATA','ME',82,0,'Atacante importante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,14,'Deyverson','ATA',NULL,80,0,'Controverso mas gols importantes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,15,'Moises','VOL','LE',79,0,'Versatil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,16,'Mayke','LD',NULL,80,0,'Lateral reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,17,'Edu Dracena','ZAG',NULL,82,0,'Veterano lider.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,18,'Thiago Santos','VOL','MC',78,0,'Volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,19,'Rafael Marques','ATA',NULL,76,0,'Atacante veterano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (55,20,'Raphael Veiga','MEI','MC',80,0,'Jovem; seria idolo.');

INSERT INTO teams VALUES (56,'Athletico-PR',2019,'Athletico-PR 2019 (Copa do Brasil)','Tiago Nunes','#c8102e','#000000','Campeao Copa do Brasil. Bruno Guimaraes revelacao para o mundo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,1,'Santos','GOL',NULL,82,1,'Goleiro do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,2,'Marcio Azevedo','LD',NULL,79,1,'Lateral de combate.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,3,'Pedro Henrique','ZAG',NULL,80,1,'Zagueiro solido.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,4,'Thiago Heleno','ZAG',NULL,82,1,'Capitao e idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,5,'Leo Pereira','LE',NULL,80,1,'Lateral; foi ao Flamengo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,6,'Christian','VOL','MC',83,1,'Volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,7,'Matheus Fernandes','VOL','MC',82,1,'Volante tecnico; depois Barcelona.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (56,8,'Bruno Guimaraes','VOL','MC','MEI',NULL,86,1,'Revelacao. Depois Lyon/Arsenal.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,9,'Nikao','MEI','MD',88,1,'Meia-ponta craque e artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,10,'Rony','PD','ME',86,1,'Artilheiro; depois Palmeiras.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,11,'Marco Ruben','ATA',NULL,81,1,'Argentino centroavante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,12,'Jonathan','GOL',NULL,75,0,'Reserva do gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,13,'Robson Bambu','ZAG',NULL,79,0,'Jovem zagueiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,14,'Abner','LE',NULL,77,0,'Lateral jovem revelado.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,15,'Lucho Gonzalez','MEI','MC',83,0,'Argentino veterano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,16,'Marcelo Cirino','PE','ME',81,0,'Ponta esquerda veloz.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,17,'Wellington','VOL','MC',79,0,'Volante de suporte.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,18,'Jonathan Rios','LD',NULL,78,0,'Lateral reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,19,'Vitinho','PD',NULL,80,0,'Ponta de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (56,20,'Marcinho','LD','MC',76,0,'Lateral de recurso.');

INSERT INTO teams VALUES (57,'Flamengo',2019,'Flamengo 2019 (Bicampeonato + Libertadores)','Jorge Jesus','#c8102e','#000000','Melhor campanha da historia. Jorge Jesus revolucionario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,1,'Diego Alves','GOL',NULL,87,1,'Goleiro. Defende penaltis.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,2,'Rafinha','LD',NULL,86,1,'Lateral da Libertadores.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,3,'Rodrigo Caio','ZAG',NULL,86,1,'Zagueiro tecnico Copa 21.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,4,'Pablo Mari','ZAG',NULL,85,1,'Espanhol de alto nivel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,5,'Filipe Luis','LE',NULL,91,1,'Campeao Champions. Idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (57,6,'Willian Arao','VOL','MC','ZAG',NULL,88,1,'Volante campeao Copa 21.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (57,7,'Gerson','VOL','MC','MD','MEI',90,1,'Maestro criativo Copa 21.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,8,'Everton Ribeiro','MEI','MD',91,1,'Melhor do Brasileirao. Idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,9,'Arrascaeta','MEI','MC',92,1,'Uruguaio genial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (57,10,'Bruno Henrique','PE','ATA','ME','PD',90,1,'Ponta-atacante decisivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,11,'Gabigol','ATA',NULL,97,1,'25 gols no BR. Artilheiro da Libertadores.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,12,'Pedro','ATA',NULL,88,0,'Reserva que seria titular no bi.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,13,'Diego','MEI','MC',84,0,'Veterano e idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,14,'Cuellar','VOL','MC',85,0,'Volante colombiano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,15,'Rodinei','LD',NULL,82,0,'Lateral reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (57,16,'Reinier','MEI','MC','ATA',NULL,82,0,'Jovem; foi ao Real Madrid.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (57,17,'Michael','PE','ME','ATA',NULL,82,0,'Ponta veloz.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,18,'Thiago Maia','VOL','MC',83,0,'Volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,19,'Lincoln','ATA',NULL,79,0,'Jovem atacante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (57,20,'Leo Ortiz','ZAG',NULL,80,0,'Zagueiro jovem.');

INSERT INTO teams VALUES (58,'Flamengo',2020,'Flamengo 2020 (Bicampeonato)','Rogerio Ceni','#c8102e','#000000','Bicampeonato em pandemia. Pedro chegando. Gerson e Willian Arao consolidados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,1,'Diego Alves','GOL',NULL,86,1,'Bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,2,'Rafinha','LD',NULL,84,1,'Bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,3,'Rodrigo Caio','ZAG',NULL,87,1,'Bicampeao Copa 21.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,4,'Leo Pereira','ZAG',NULL,84,1,'Reforco importante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,5,'Filipe Luis','LE',NULL,89,1,'Bicampeao Flamengo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,6,'Willian Arao','VOL','MC',88,1,'Bicampeao Copa 21.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,7,'Gerson','MEI','VOL',90,1,'Bicampeao depois Marseille.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,8,'Everton Ribeiro','MEI','MD',91,1,'Bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,9,'Arrascaeta','MEI','MC',91,1,'Bicampeao uruguaio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,10,'Bruno Henrique','PE','ME',89,1,'Bicampeao artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,11,'Gabigol','ATA',NULL,96,1,'Bicampeao 22 gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,12,'Pedro','ATA',NULL,90,0,'Brilhou no bi.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,13,'Thiago Maia','VOL','MC',84,0,'Bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,14,'Michael','ATA','MD',83,0,'Ponta veloz.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,15,'Rodinei','LD',NULL,82,0,'Lateral reserva bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,16,'Diego','MEI','MC',82,0,'Veterano contribuindo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,17,'Vitinho','PD','MD',81,0,'Ponta criativa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,18,'Hugo Souza','GOL',NULL,76,0,'Jovem goleiro revelado.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,19,'Rene','LE','MC',82,0,'Reserva da lateral.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (58,20,'Leo Ortiz','ZAG',NULL,80,0,'Zagueiro jovem.');

INSERT INTO teams VALUES (59,'Atletico-MG',2021,'Atletico-MG 2021 (Brasileiro + Copa do Brasil)','Cuca','#000000','#ffffff','Hulk 35 anos artilheiro. Nacho Fernandez maestro. Copa do Brasil bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,1,'Everson','GOL',NULL,88,1,'Melhor goleiro do Brasil 2021.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,2,'Mariano','LD','VOL',78,1,'Lateral-direito titular do dobradinha 2021.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,3,'Rever','ZAG','VOL',82,1,'Capitao veterano idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,4,'Junior Alonso','ZAG','LE',83,1,'Zagueiro paraguaio, parceiro de Rever.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,5,'Guilherme Arana','LE','ME',88,1,'Copa 21/22. Craque.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,6,'Allan','VOL','MC',86,1,'Ex-Napoli. Copa 21.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,7,'Jair','VOL','MC',83,1,'Volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,8,'Matias Zaracho','MC','MD',87,1,'Argentino de qualidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,9,'Nacho Fernandez','MEI','MC',90,1,'Venezolano maestro. Craque do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,10,'Jefferson Savarino','PD','MD',84,1,'Venezuelano habilidoso, ponta titular.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,11,'Hulk','ATA','PD',94,1,'35 anos artilheiro 19 gols. Lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,12,'Guga','LD','LE',80,0,'Lateral jovem, reserva de Mariano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,13,'Dodo','LE','ME',79,0,'Lateral jovem em ascensao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,14,'Tche Tche','VOL','MC',78,0,'Volante de rotacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,15,'Hyoran','MEI','ME',79,0,'Meia criativo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,16,'Savio','PD','PE',76,0,'Ponta jovem promissor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,17,'Keno','PE','PD',85,0,'Ponta artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,18,'Eduardo Vargas','PE','ATA',84,0,'Chileno versatil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,19,'Diego Costa','ATA',NULL,77,0,'Atacante de rotacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (59,20,'Eduardo Sasha','ATA','MEI',82,0,'Atacante importante.');

INSERT INTO teams VALUES (60,'Palmeiras',2022,'Palmeiras 2022 (81 pontos RECORDE historico)','Abel Ferreira','#006437','#ffffff','81 pontos RECORDE historico absoluto. Endrick 16 anos revelacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,1,'Weverton','GOL',NULL,92,1,'Melhor goleiro do Brasil. Copa 21/22.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,2,'Marcos Rocha','LD',NULL,84,1,'Lateral bicampeao com Abel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,3,'Gustavo Gomez','ZAG',NULL,90,1,'Paraguaio idolo capitao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,4,'Murilo','ZAG',NULL,87,1,'Zagueiro alto nivel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,5,'Piquerez','LE',NULL,89,1,'Uruguaio. Melhor lateral esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,6,'Danilo','VOL','MC',88,1,'Volante-meia completo. Copa 22.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,7,'Ze Rafael','VOL','MC',86,1,'Volante tecnico Copa 22.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,8,'Atuesta','VOL','MC',81,1,'Volante colombiano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,9,'Raphael Veiga','MEI','MC',90,1,'18 gols artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,10,'Dudu','PD','MD',88,1,'Ponta idolo bicampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,11,'Flaco Lopez','ATA',NULL,86,1,'Argentino artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,12,'Rony','PE','ME',85,0,'Atacante racudo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,13,'Endrick','ATA',NULL,91,0,'Fenomeno 16 anos. Depois Real Madrid.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,14,'Mayke','LD',NULL,81,0,'Lateral reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,15,'Gabriel Menino','VOL','MC',82,0,'Jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,16,'Luan','ZAG',NULL,80,0,'Zagueiro solido.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,17,'Vanderlan','LE',NULL,78,0,'Lateral jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,18,'Pedro Geromel','ZAG',NULL,79,0,'Veterano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,19,'Jose Manuel Lopez','ATA',NULL,75,0,'Atacante de recurso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (60,20,'Jhon Jhon','MEI','MC',79,0,'Meia jovem.');

INSERT INTO teams VALUES (61,'Athletico-PR',2022,'Athletico-PR 2022 (Finalista Libertadores)','Luiz Felipe Scolari','#c8102e','#000000','Final da Libertadores 2022. Fernandinho retornando como idolo. Vitor Roque revelacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,1,'Bento','GOL',NULL,87,1,'Melhor goleiro jovem. Copa 22.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,2,'Orejuela','LD',NULL,80,1,'Lateral colombiano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,3,'Pedro Henrique','ZAG',NULL,83,1,'Capitao do finalista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,4,'Thiago Heleno','ZAG',NULL,82,1,'Veterano idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,5,'Abner','LE',NULL,83,1,'Copa 22. Depois Lyon.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,6,'Christian','VOL','MC',84,1,'Volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,7,'Matheus Fernandes','VOL','MC',83,1,'Voltou apos Barcelona.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,8,'Erick','VOL','MC',82,1,'Volante jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (61,9,'Fernandinho','VOL','MC','MEI',NULL,90,1,'Ex-Man City. Idolo eterno.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,10,'David Terans','MEI','MC',86,1,'Uruguaio artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,11,'Canobbio','PD','MD',84,1,'Uruguaio criativo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,12,'Romulo','ATA',NULL,83,0,'Artilheiro 12 gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,13,'Pablo','ATA',NULL,82,0,'Centroavante veterano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,14,'Vitor Roque','ATA',NULL,87,0,'Fenomeno 17 anos. Depois Barcelona.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,15,'Vitinho','PD',NULL,82,0,'Ponta velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,16,'Ze Ivaldo','ZAG',NULL,82,0,'Zagueiro. Depois Santos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,17,'Anderson','GOL',NULL,79,0,'Reserva de qualidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,18,'Matheus Felipe','ZAG',NULL,81,0,'Zagueiro jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,19,'Pedrinho','LE','MC',81,0,'Lateral reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (61,20,'Khellven','LD',NULL,79,0,'Lateral reserva.');

INSERT INTO teams VALUES (62,'Palmeiras',2023,'Palmeiras 2023 (Tricampeonato com Abel)','Abel Ferreira','#006437','#ffffff','Flaco Lopez artilheiro 16 gols. Estevao revelacao. Abel bicampeao Brasileiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,1,'Weverton','GOL',NULL,NULL,NULL,90,1,'Tricampeao com Abel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,2,'Marcos Rocha','LD','ZAG',NULL,NULL,83,1,'Lateral tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,3,'Gustavo Gómez','ZAG',NULL,NULL,NULL,91,1,'Paraguaio idolo tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,4,'Murilo','ZAG',NULL,NULL,NULL,86,1,'Zagueiro tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,5,'Joaquín Piquerez','LE','ME','ZAG',NULL,88,1,'Uruguaio tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,6,'Zé Rafael','VOL','MC',NULL,NULL,87,1,'Volante tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,7,'Richard Ríos','VOL','MC',NULL,NULL,82,1,'Volante colombiano de qualidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,8,'Gabriel Menino','VOL','MC','LD',NULL,82,1,'Jovem em crescimento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,9,'Raphael Veiga','MEI','MC','MD',NULL,91,1,'Idolo cobracas impossiveis.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,10,'Dudu','PE','PD','MEI',NULL,88,1,'Ponta idolo tricampeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,11,'Endrick','ATA',NULL,NULL,NULL,90,1,'Fenomeno jovem. Artilheiro historico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,12,'Marcelo Lomba','GOL',NULL,NULL,NULL,79,0,'Goleiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,13,'Mayke','LD','MD','PD',NULL,86,0,'Lateral reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,14,'Vanderlan','LE','ME',NULL,NULL,79,0,'Lateral reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,15,'Luan','ZAG','VOL',NULL,NULL,83,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,16,'Fabinho','VOL',NULL,NULL,NULL,76,0,'Volante de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,17,'Luis Guilherme','MEI','PD',NULL,NULL,77,0,'Meia jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,18,'Artur','PD','PE','ATA',NULL,84,0,'Ponta reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,19,'Breno Lopes','PE','PD',NULL,NULL,81,0,'Ponta de intensidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (62,20,'Rony','ATA','PD','PE',NULL,84,0,'Atacante racudo.');

INSERT INTO teams VALUES (63,'Botafogo',2024,'Botafogo 2024 (Brasileirao + Libertadores)','Artur Jorge','#000000','#ffffff','Igor Jesus, Luiz Henrique, Thiago Almada. Fim do jejum de 29 anos com dupla coroa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,1,'John','GOL',NULL,87,1,'Goleiro confiavel e seguro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,2,'Vitinho','LD',NULL,83,1,'Lateral direito tecnico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,3,'Alexander Barboza','ZAG',NULL,86,1,'Uruguaio. Zagueiro alto nivel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,4,'Bastos','ZAG',NULL,85,1,'Zagueiro solido da defesa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,5,'Cuiabano','LE',NULL,84,1,'Lateral esquerdo veloz.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,6,'Marlon Freitas','MC','VOL',86,1,'Meia central tecnico. Melhor do meio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,7,'Gregore','VOL','MC',85,1,'Volante de contencao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,8,'Thiago Almada','MEI','ME',89,1,'Argentino genial. MVP da temporada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,9,'Igor Jesus','ATA',NULL,91,1,'13 gols. Revelacao historica. Selecao Brasileira.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,10,'Jefferson Savarino','PE','ME',85,1,'Venezuelano criativo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,11,'Luiz Henrique','PD','MD',90,1,'Artilheiro e destaque absoluto.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,12,'Gatito Fernandez','GOL',NULL,78,0,'Goleiro veterano idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,13,'Adryelson','ZAG',NULL,80,0,'Zagueiro jovem reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,14,'Tiquinho Soares','ATA',NULL,81,0,'Artilheiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,15,'Danilo Barbosa','VOL','MC',80,0,'Volante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,16,'Tche Tche','MC','VOL',80,0,'Meia central polivalente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,17,'Marcal','LE',NULL,78,0,'Lateral esquerdo reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,18,'Mateo Ponte','LD',NULL,79,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,19,'Junior Santos','PD','ATA',78,0,'Ponta direita reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (63,20,'Carlos Alberto','PE','MC',76,0,'Atacante jovem.');

INSERT INTO teams VALUES (64,'Santos',2015,'Santos 2015 (Paulistao + Vice Copa BR)','Dorival Junior','#000000','#ffffff','Ricardo Oliveira 39 anos artilheiro. Thiago Maia, Lucas Lima, Gabigol revelacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,1,'Vanderlei','GOL',NULL,NULL,NULL,88,1,'Verdadeiro paredao operando milagres ao longo de todo o ano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,2,'Victor Ferraz','LD','MD','LE',NULL,84,1,'Pilar tecnico, excelente no apoio construtor e cruzamentos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,3,'David Braz','ZAG',NULL,NULL,NULL,83,1,'Xerife da zaga, forte no combate fisico e perigoso na bola parada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,4,'Gustavo Henrique','ZAG',NULL,NULL,NULL,82,1,'Dupla solida e de grande imposicao aerea com David Braz.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,5,'Zeca','LE','LD','ME',NULL,83,1,'Cria da base, titular com Dorival Junior, voava na marcacao e apoio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,6,'Renato','VOL','MC',NULL,NULL,86,1,'Elegancia em forma de volante, ditava o ritmo com rarissimos erros.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,7,'Thiago Maia','VOL',NULL,NULL,NULL,84,1,'Dinamica absurda de desarmes e transicao em velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,8,'Lucas Lima','MEI','MC',NULL,NULL,91,1,'Auge tecnico em 2015, cerebro do time com assistencias geniais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,9,'Marquinhos Gabriel','MEI','PD','PE',NULL,84,1,'Curinga ofensivo do segundo semestre, gols pesados e jogadas criadas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,10,'Ricardo Oliveira','ATA',NULL,NULL,NULL,92,1,'O Pastor. Capitao, artilheiro do Brasileirao com 20 gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,11,'Gabigol','PD','ATA',NULL,NULL,89,1,'Artilheiro maximo da Copa do Brasil com 8 gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,12,'Vladimir','GOL',NULL,NULL,NULL,81,0,'Heroi do titulo paulista defendendo penalti na finalissima.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,13,'Daniel Guedes','LD',NULL,NULL,NULL,77,0,'Lateral de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,14,'Chiquinho','LE','ME',NULL,NULL,77,0,'Lateral esquerdo reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,15,'Werley','ZAG',NULL,NULL,NULL,79,0,'Titular na campanha do titulo paulista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,16,'Valencia','VOL',NULL,NULL,NULL,78,0,'Volante colombiano de muita pegada antes da grave lesao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,17,'Geuvânio','PD','PE',NULL,NULL,83,0,'Caveirinha. Infernizava as defesas no primeiro semestre.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,18,'Robinho','PE','MEI','ATA',NULL,88,0,'Capitao e lider do titulo paulista no primeiro semestre.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,19,'Leandro Damião','ATA',NULL,NULL,NULL,80,0,'Fez parte do inicio do ano antes de ser emprestado ao Cruzeiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (64,20,'Nilson','ATA',NULL,NULL,NULL,74,0,'Reserva imediato do comando de ataque.');

INSERT INTO teams VALUES (65,'Santos',2020,'Santos 2020 (Vice-Campeao da Libertadores)','Cuca','#000000','#ffffff','Marinho, Soteldo, Lucas Verissimo e Kaio Jorge. Vice da Libertadores 2020.');

-- TIME TITULAR LENDÁRIO DE 2020 (11 JOGADORES)
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,31,'John','GOL',NULL,NULL,NULL,82,1,'Goleiro gigante no mata-mata da Libertadores.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,4,'Pará','LD','LE','VOL',NULL,78,1,'Lateral veterano de muita entrega tática.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,28,'Lucas Veríssimo','ZAG',NULL,NULL,NULL,86,1,'Xerife lendário da zaga santista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,14,'Luan Peres','ZAG','LE',NULL,NULL,83,1,'Zagueiro técnico com saída de bola impecável.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,3,'Felipe Jonatan','LE','ME','MC',NULL,79,1,'Lateral de muita qualidade no apoio ofensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,5,'Alison','VOL',NULL,NULL,NULL,80,1,'O capitão raçudo que mordia o meio-campo inteiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,18,'Sandry','VOL','MC',NULL,NULL,79,1,'Jovem maestro que deu equilíbrio ao time, passe refinado.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,21,'Diego Pituca','VOL','MC','LE',NULL,84,1,'Motor dinâmico com fôlego interminável.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,11,'Marinho','PD','ATA',NULL,NULL,90,1,'Rei da América. Atinge elite internacional.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,10,'Soteldo','PE','MEI','PD',NULL,88,1,'Camisa 10 lendário, o terror das defesas no drible.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,9,'Kaio Jorge','ATA',NULL,NULL,NULL,83,1,'Centroavante moderno de muita inteligência tática.');

-- BANCO DE RESERVAS LENDÁRIO DE 2020 (9 JOGADORES)
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,34,'João Paulo','GOL',NULL,NULL,NULL,81,0,'Paredão seguro que operava milagres.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,6,'Laércio','ZAG',NULL,NULL,NULL,75,0,'Zagueiro de muita força física para o segundo tempo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,13,'Madson','LD','MD',NULL,NULL,79,0,'Reserva de luxo, arma mortal nas bolas aéreas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,26,'Luiz Felipe','ZAG',NULL,NULL,NULL,77,0,'Zagueiro reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,7,'Jobson','VOL','MC',NULL,NULL,76,0,'Volante de forte pegada e combate físico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,41,'Jean Mota','MC','MEI','LE',NULL,76,0,'Meio-campista versátil com ótimo chute de fora.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,44,'Lucas Lourenço','MEI',NULL,NULL,NULL,73,0,'Meia de armacao da base muito utilizado por Cuca.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,23,'Arthur Gomes','PE','PD','LE',NULL,76,0,'Ponta liso de muita velocidade pelos lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,pos_terciaria,pos_quaternaria,overall,is_starter,notes) VALUES (65,36,'Lucas Braga','PE','PD',NULL,NULL,81,0,'Ponta tático e incansável que decidiu jogos chave.');

INSERT INTO teams VALUES (66,'Botafogo',2023,'Botafogo 2023 (Deixou escapar)','Luis Castro','#000000','#ffffff','13 pontos de vantagem e deixou escapar. Base do titulo historico de 2024.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,1,'Lucas Perri','GOL',NULL,85,1,'Goleiro excelente em 2023.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,2,'Di Plácido','LD',NULL,81,1,'Lateral-direito argentino, titular na maior parte do Brasileirão.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,3,'Adryelson','ZAG',NULL,83,1,'Zagueiro jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,4,'Victor Cuesta','ZAG',NULL,82,1,'Argentino solido.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,5,'Marcal','LE',NULL,80,1,'Lateral experiente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,6,'Eduardo','MEI','VOL',83,1,'Meia-armador de criacao titular ao longo do ano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,7,'Marlon Freitas','VOL',NULL,84,1,'Volante tecnico. Depois Palmeiras.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,8,'Tche Tche','MEI','VOL',83,1,'Versatil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,9,'Gustavo Sauer','PD',NULL,83,1,'Ponta artilheiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,10,'Tiquinho Soares','ATA',NULL,89,1,'Artilheiro no brilhante turno.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,11,'Jeffinho','PE','ATA',84,1,'Ponta veloz e habilidoso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,12,'Diego Hernandez','MEI',NULL,80,0,'Meia paraguaio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,13,'Hugo','LE',NULL,78,0,'Lateral-esquerdo de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,14,'Rafael','LD',NULL,79,0,'Lateral de reposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,15,'Kayque','VOL',NULL,80,0,'Volante jovem revelado.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,16,'Júnior Santos','PD','ATA',83,0,'Peca fundamental no ataque, jogando pelo lado direito.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,17,'Diego Costa','ATA',NULL,79,0,'Atacante reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,18,'Patrick de Paula','VOL',NULL,82,0,'Volante jovem.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,19,'Victor Sa','ATA',NULL,82,0,'Atacante alternativo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (66,20,'Gatito Fernández','GOL',NULL,82,0,'Goleiro idolo e reserva imediato de Lucas Perri.');


-- ============================================================
-- RECALIBRAGEM DE OVERALL (times subestimados)
-- Delta aplicado a todo o elenco, teto 96 (preserva a hierarquia interna)
-- ============================================================
UPDATE players SET overall = LEAST(96, overall + 6) WHERE team_id = 37;  -- Cruzeiro 2003 (Triplice Coroa) 80.2 -> ~86
UPDATE players SET overall = LEAST(96, overall + 5) WHERE team_id = 40;  -- Sao Paulo 2006          80.8 -> ~86
UPDATE players SET overall = LEAST(96, overall + 5) WHERE team_id = 41;  -- Sao Paulo 2007 (BI)     81.5 -> ~86.5
UPDATE players SET overall = LEAST(96, overall + 4) WHERE team_id = 42;  -- Sao Paulo 2008 (TRI)    82.1 -> ~86
UPDATE players SET overall = LEAST(96, overall + 4) WHERE team_id = 28;  -- Botafogo 1995           79.6 -> ~83.6
UPDATE players SET overall = LEAST(96, overall + 3) WHERE team_id = 43;  -- Flamengo 2009           82.0 -> ~85
UPDATE players SET overall = LEAST(96, overall + 3) WHERE team_id = 45;  -- Fluminense 2010         82.0 -> ~85
UPDATE players SET overall = LEAST(96, overall + 3) WHERE team_id = 46;  -- Santos 2011 (Neymar)    83.2 -> ~86
UPDATE players SET overall = LEAST(96, overall + 2) WHERE team_id = 18;  -- Coritiba 1985           81.6 -> ~83.6
UPDATE players SET overall = LEAST(96, overall + 2) WHERE team_id = 47;  -- Corinthians 2011        83.5 -> ~85.5
UPDATE players SET overall = LEAST(96, overall + 2) WHERE team_id = 56;  -- Athletico-PR 2019       82.6 -> ~84.6
UPDATE players SET overall = LEAST(96, overall + 2) WHERE team_id = 65;  -- Santos 2020             82.9 -> ~85


-- ============================================================
-- NOVOS TIMES 67 A 100
-- ============================================================
-- ===== 67. SANTOS 1963 =====
INSERT INTO teams VALUES (67,'Santos',1963,'Santos 1963 (Bicampeao do Mundo)','Lula','#000000','#ffffff','Bicampeao mundial em cima do Milan. O apogeu absoluto do Santos de Pele.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,1,'Gylmar','GOL',NULL,91,1,'Goleiro da selecao bicampea do mundo, seguranca total sob as traves.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,2,'Lima','LD','MC',86,1,'O curinga da Vila, resolvia na lateral e no meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,3,'Mauro','ZAG',NULL,89,1,'Capitao do Santos e da Selecao, zagueiro de antecipacao perfeita.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,4,'Haroldo','ZAG',NULL,84,1,'Zagueiro de forca e marcacao dura ao lado de Mauro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,5,'Dalmo','LE','ZAG',85,1,'Lateral seguro e cobrador oficial de penaltis do time.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,6,'Zito','VOL','MC',91,1,'O Gerente. Cerebro tatico e lideranca absoluta do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,7,'Mengalvio','MC','VOL',87,1,'Cadencia, passe longo milimetrico e visao privilegiada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,8,'Dorval','PD','MD',88,1,'Velocidade e drible na ponta direita, garcom de Coutinho e Pele.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,9,'Coutinho','ATA',NULL,92,1,'Genio da area e parceiro telepatico de Pele nas tabelas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,10,'Pele','ATA','MEI',99,1,'O Rei. Decisivo nas duas finais do Mundial contra o Milan.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,11,'Pepe','PE','ME',90,1,'O Canhao da Vila. Chute esquerdo mais forte do futebol brasileiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,12,'Laercio','GOL',NULL,80,0,'Goleiro reserva de confianca, titular em boa parte de 1961.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,13,'Calvet','ZAG',NULL,84,0,'Zagueiro tecnico, titular nos anos anteriores e reserva de luxo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,14,'Fioti','LD',NULL,75,0,'Lateral direito de oficio, reserva imediato de Lima.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,15,'Getulio','LE',NULL,74,0,'Lateral esquerdo suplente do elenco santista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,16,'Formiga','ZAG','VOL',77,0,'Veterano polivalente que cobria zaga e meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,17,'Ismael','VOL','MC',78,0,'Volante de marcacao para dar descanso a Zito.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,18,'Geraldino','MEI','MD',77,0,'Meia de criacao suplente do setor ofensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,19,'Tite','PE','ME',76,0,'Ponta esquerda experiente, reserva direto de Pepe.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (67,20,'Nene','ATA','MEI',76,0,'Atacante da base santista com boa finalizacao.');

-- ===== 68. CRUZEIRO 1966 =====
INSERT INTO teams VALUES (68,'Cruzeiro',1966,'Cruzeiro 1966 (Taca Brasil)','Ayrton Moreira','#0033A0','#ffffff','Atropelou o Santos de Pele na final por 6x2 e 3x2. Tostao e Dirceu Lopes no auge.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,1,'Raul','GOL',NULL,86,1,'Goleiro seguro e lider da defesa celeste por mais de uma decada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,2,'Pedro Paulo','LD',NULL,82,1,'Lateral direito de bom apoio e marcacao consistente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,3,'Wilson Piazza','ZAG','VOL',91,1,'Elegancia e leitura de jogo raras, um dos maiores da historia do clube.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,4,'Procopio','ZAG',NULL,84,1,'Zagueiro raçudo e implacavel nos duelos dentro da area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,5,'Neco','LE',NULL,82,1,'Lateral esquerdo de muita disposicao e apoio constante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,6,'Ze Carlos','VOL','MC',84,1,'Volante de contencao que sustentava o meio-campo ofensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,7,'Natal','PD','MD',83,1,'Ponta direita de velocidade e cruzamentos precisos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,8,'Evaldo','MC','MEI',84,1,'Meia de ligacao inteligente entre defesa e ataque.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,9,'Tostao','ATA','MEI',95,1,'Genio absoluto, comandou a goleada historica sobre o Santos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,10,'Dirceu Lopes','MEI','ATA',93,1,'Canhota privilegiada e o maior artilheiro da historia celeste.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,11,'Hilton Oliveira','PE','ATA',86,1,'Ponta esquerda decisivo e goleador nas finais da Taca Brasil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,12,'Loureiro','ATA',NULL,82,0,'Centroavante reserva de bom faro de gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,13,'Wanderley','MEI','MC',80,0,'Meia suplente de boa tecnica e chegada a area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,14,'Vanderlei','MC','VOL',78,0,'Meio-campista de composicao no elenco celeste.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,15,'Willian','ZAG',NULL,77,0,'Zagueiro reserva firme na cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,16,'Nilton','GOL',NULL,74,0,'Goleiro suplente de Raul.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,17,'Djalma Dias','ZAG',NULL,80,0,'Zagueiro tecnico com passagem marcante pelo futebol mineiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,18,'Joao Batista','LD','LE',75,0,'Lateral reserva pelos dois lados do campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,19,'Antoninho','PD','ME',76,0,'Ponta suplente de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (68,20,'Raimundinho','VOL',NULL,74,0,'Volante de marcacao para rodizio do elenco.');

-- ===== 69. PALMEIRAS 1967 =====
INSERT INTO teams VALUES (69,'Palmeiras',1967,'Palmeiras 1967 (Academia)','Filpo Nunez','#006437','#ffffff','A Primeira Academia. Campeao do Robertao e da Taca Brasil no mesmo ano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,1,'Valdir de Moraes','GOL',NULL,86,1,'Goleiro tecnico e seguro, referencia de uma geracao inteira.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,2,'Ferrari','LD',NULL,83,1,'Lateral direito de apoio constante e cruzamento afiado.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,3,'Djalma Dias','ZAG',NULL,87,1,'Zagueiro de saida de bola refinada, xerife da Academia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,4,'Baldocchi','ZAG',NULL,85,1,'Marcador implacavel e de posicionamento impecavel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,5,'Zeca','LE',NULL,83,1,'Lateral esquerdo veloz e de forte presenca ofensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,6,'Dudu','MC','MEI',89,1,'Motor do meio-campo, tecnica e raca em doses iguais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,7,'Ademir da Guia','MEI','MC',94,1,'O Divino. O maior jogador da historia do Palmeiras.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,8,'Rinaldo','PD','MD',84,1,'Ponta direita de drible curto e muita velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,9,'Tupazinho','ATA',NULL,87,1,'Centroavante artilheiro e goleador nato da Academia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,10,'Servilio','ATA','MEI',85,1,'Atacante de movimentacao inteligente e bom acabamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,11,'Cesar Maluco','ATA','PD',85,1,'Forca fisica e explosao, terror das zagas adversarias.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,12,'Reinaldo','PE','ME',80,0,'Ponta esquerda suplente de bom cruzamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,13,'Alfredo Mostarda','ZAG','VOL',81,0,'Jovem defensor que viraria peca chave da Segunda Academia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,14,'Eurico','LD',NULL,79,0,'Lateral reserva de muita regularidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,15,'Emerson Leao','GOL',NULL,80,0,'Goleiro jovem que assumiria a meta alviverde nos anos seguintes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,16,'Nei','MC','VOL',78,0,'Meio-campista de contencao no rodizio da Academia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,17,'Pio','ATA',NULL,77,0,'Atacante suplente de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,18,'Edu Bala','PE','ATA',79,0,'Ponta de velocidade explosiva vindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,19,'Fedato','MEI','MD',77,0,'Meia reserva de boa insercao ofensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (69,20,'Marinho','LE',NULL,75,0,'Lateral esquerdo suplente do elenco.');

-- ===== 70. SANTOS 1968 =====
INSERT INTO teams VALUES (70,'Santos',1968,'Santos 1968 (Robertao)','Antoninho','#000000','#ffffff','Pele, Carlos Alberto Torres, Clodoaldo e Edu. Campeao do Roberto Gomes Pedrosa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,1,'Cejas','GOL',NULL,84,1,'Goleiro argentino de reflexos rapidos sob as traves santistas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,2,'Carlos Alberto Torres','LD','ZAG',93,1,'O Capitao do Mundo. Lateral mais completo da historia do futebol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,3,'Joel Camargo','ZAG',NULL,85,1,'Zagueiro de forca e antecipacao, titular da Selecao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,4,'Ramos Delgado','ZAG',NULL,86,1,'Argentino de classe absurda, elegante na saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,5,'Rildo','LE',NULL,86,1,'Lateral esquerdo veloz e ofensivo, titular da Selecao Brasileira.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,6,'Clodoaldo','VOL','MC',89,1,'Volante de tecnica rara, futuro heroi do tetra de 1970.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,7,'Lima','MC','LD',85,1,'Curinga de sempre, agora consolidado no meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,8,'Abel','MEI','MC',83,1,'Meia de criacao com boa chegada a area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,9,'Toninho Guerreiro','ATA',NULL,88,1,'Centroavante artilheiro implacavel e goleador da Vila.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,10,'Pele','ATA','MEI',98,1,'O Rei em plena maturidade, ainda decidindo tudo sozinho.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,11,'Edu','PE','ATA',88,1,'O mais jovem a vestir a camisa da Selecao, canhota fenomenal.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,12,'Claudio','ATA','PD',81,0,'Atacante reserva de bom acabamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,13,'Zito','VOL','MC',84,0,'Veterano lendario ainda dando aulas taticas no fim da carreira.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,14,'Mengalvio','MC',NULL,83,0,'Meia de passes longos, reserva de luxo do setor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,15,'Laercio','GOL',NULL,78,0,'Goleiro suplente experiente do elenco santista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,16,'Oberdan','ZAG',NULL,77,0,'Zagueiro reserva de marcacao dura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,17,'Dorval','PD','MD',82,0,'Ponta veterano ainda util na rotacao ofensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,18,'Newton','LE',NULL,75,0,'Lateral esquerdo suplente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,19,'Manoel Maria','PE','ATA',79,0,'Ponta esquerda jovem e veloz da base santista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (70,20,'Turcao','VOL',NULL,76,0,'Volante de marcacao para dar folga a Clodoaldo.');

-- ===== 71. FLUMINENSE 1976 =====
INSERT INTO teams VALUES (71,'Fluminense',1976,'Fluminense 1976 (Maquina Tricolor)','Duque','#7A1921','#006633','Rivelino, Carlos Alberto Torres, Doval e Cafuringa. O elenco mais caro do pais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,1,'Felix','GOL',NULL,84,1,'Goleiro campeao do mundo em 1970, seguro sob as traves tricolores.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,2,'Carlos Alberto Torres','LD','ZAG',91,1,'O Capitao do Mundo comandando a Maquina das Laranjeiras.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,3,'Edinho','ZAG',NULL,87,1,'Zagueiro canhoto de saida de bola refinada e lideranca natural.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,4,'Miguel','ZAG',NULL,83,1,'Zagueiro de marcacao firme na dupla defensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,5,'Rodrigues Neto','LE',NULL,86,1,'Lateral esquerdo ofensivo e cobrador perigoso de falta.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,6,'Carlos Alberto Pintinho','VOL','MC',85,1,'Volante de marcacao inteligente e otima saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,7,'Rivelino','MEI','ME',95,1,'O Reizinho do Parque. Canhota mais perfeita do futebol brasileiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,8,'Gilson Nunes','MC','MD',82,1,'Meia de muita entrega e disposicao no meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,9,'Cafuringa','PD','MD',87,1,'Ponta direita de drible desconcertante e cruzamentos precisos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,10,'Doval','ATA',NULL,88,1,'Argentino artilheiro, idolo maximo da torcida tricolor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,11,'Paulo Cezar Caju','PE','MEI',89,1,'Talento explosivo, drible e velocidade pela esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,12,'Marco Antonio','LE','LD',85,0,'Campeao do mundo em 1970, reserva de altissimo nivel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,13,'Manfrini','ATA',NULL,82,0,'Centroavante reserva de bom posicionamento na area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,14,'Dirceu','MEI','ME',86,0,'Canhota privilegiada e chute de longa distancia perigoso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,15,'Renato','GOL',NULL,77,0,'Goleiro suplente do elenco das Laranjeiras.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,16,'Ze Mario','LD','ZAG',79,0,'Lateral direito reserva de boa marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,17,'Cleber','VOL',NULL,78,0,'Volante de contencao no rodizio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,18,'Nilton Batata','ATA','PD',77,0,'Atacante suplente de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,19,'Ruy Rey','MC','MEI',78,0,'Meio-campista de composicao do elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (71,20,'Jorge Vitorio','ZAG',NULL,76,0,'Zagueiro reserva de raca e disposicao.');

-- ===== 72. CRUZEIRO 1976 =====
INSERT INTO teams VALUES (72,'Cruzeiro',1976,'Cruzeiro 1976 (Libertadores)','Zeze Moreira','#0033A0','#ffffff','Primeiro titulo continental do clube. Nelinho, Piazza, Palhinha e Joaozinho.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,1,'Raul','GOL',NULL,87,1,'Goleiro heroi da campanha da Libertadores, defendeu penaltis decisivos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,2,'Nelinho','LD',NULL,92,1,'O chute mais forte do futebol brasileiro, lateral goleador lendario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,3,'Morais','ZAG',NULL,85,1,'Zagueiro campeao do mundo em 1970, seguranca total na area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,4,'Osmar Guarnelli','ZAG','VOL',83,1,'Defensor de forca fisica e marcacao pesada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,5,'Vanderlei','LE',NULL,82,1,'Lateral esquerdo de apoio constante e boa recomposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,6,'Wilson Piazza','VOL','ZAG',90,1,'Capitao e cerebro do time, um dos maiores idolos celestes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,7,'Zeze','MC','MEI',82,1,'Meio-campista de ligacao e muita entrega tatica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,8,'Eduardo','MEI','MC',85,1,'Meia articulador de passes e visao de jogo apurada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,9,'Palhinha','ATA',NULL,89,1,'Artilheiro da Libertadores de 1976, goleador implacavel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,10,'Joaozinho','MEI','PE',88,1,'Habilidade e drible curto, o craque criativo do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,11,'Roberto Batata','ATA','PD',86,1,'Atacante veloz e decisivo, eternizado na historia celeste.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,12,'Jairzinho','PD','ATA',88,0,'O Furacao da Copa de 70, reserva de altissimo nivel no elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,13,'Waldo','ATA',NULL,80,0,'Centroavante suplente de bom jogo aereo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,14,'Vanderlei Paiva','MC','VOL',79,0,'Volante de marcacao no rodizio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,15,'Rafael','GOL',NULL,76,0,'Goleiro reserva imediato de Raul.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,16,'Piazza Filho','ZAG',NULL,75,0,'Zagueiro suplente de composicao do elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,17,'Ze Carlos','LD','LE',78,0,'Lateral reserva pelos dois lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,18,'Ronaldo','MEI','MD',79,0,'Meia suplente de boa insercao ofensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,19,'Neco','LE',NULL,77,0,'Lateral esquerdo veterano do elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (72,20,'Marcelo','PE','ME',76,0,'Ponta esquerda reserva de velocidade.');

-- ===== 73. SAO PAULO 1977 =====
INSERT INTO teams VALUES (73,'Sao Paulo',1977,'Sao Paulo 1977 (1o Brasileirao)','Rubens Minelli','#C8102E','#ffffff','Primeiro titulo brasileiro do clube, conquistado nos penaltis contra o Atletico-MG.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,1,'Waldir Peres','GOL',NULL,86,1,'Goleiro da Selecao Brasileira, heroi na decisao por penaltis.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,2,'Getulio','LD',NULL,82,1,'Lateral direito de marcacao firme e apoio constante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,3,'Arlindo','ZAG',NULL,83,1,'Zagueiro de forca e presenca aerea dominante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,4,'Chicao','ZAG',NULL,85,1,'Lider da defesa tricolor, seguro e de otima antecipacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,5,'Everaldo','LE',NULL,81,1,'Lateral esquerdo de boa recomposicao defensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,6,'Ze Teodoro','VOL','LE',82,1,'Volante de marcacao incansavel no meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,7,'Pedrinho','MC','MEI',83,1,'Meia de ligacao com boa distribuicao de jogo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,8,'Terto','MEI','MD',84,1,'Meia criativo, cerebro ofensivo da campanha do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,9,'Serginho Chulapa','ATA',NULL,88,1,'Centroavante raçudo e artilheiro, idolo maximo do Morumbi.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,10,'Mirandinha','ATA','MEI',84,1,'Atacante movel de boa finalizacao e tabela.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,11,'Ze Sergio','PE','ME',87,1,'Ponta esquerda velocissimo, um dos mais rapidos do pais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,12,'Valdir Peres Jr','GOL',NULL,75,0,'Goleiro suplente do elenco tricolor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,13,'Renato','ZAG',NULL,78,0,'Zagueiro reserva de marcacao dura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,14,'Chico Fraga','MC','VOL',79,0,'Meio-campista de composicao e boa leitura tatica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,15,'Nelsinho','LD',NULL,78,0,'Lateral direito reserva imediato.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,16,'Paulo Isidoro','PD','MD',82,0,'Ponta veloz e habilidoso vindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,17,'Nei','ATA',NULL,77,0,'Atacante suplente de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,18,'Zezinho','MEI',NULL,76,0,'Meia reserva de criacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,19,'Wanderley','LE',NULL,75,0,'Lateral esquerdo suplente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (73,20,'Dario','VOL',NULL,76,0,'Volante de marcacao para rodizio.');

-- ===== 74. GREMIO 1981 =====
INSERT INTO teams VALUES (74,'Gremio',1981,'Gremio 1981 (Campeao Brasileiro)','Enio Andrade','#0D80BF','#000000','Primeiro titulo brasileiro do clube. Base do futuro campeao do mundo de 1983.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,1,'Mazaropi','GOL',NULL,85,1,'Goleiro de reflexos rapidos e enorme personalidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,2,'Paulo Roberto','LD',NULL,82,1,'Lateral direito de apoio constante pela ponta.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,3,'De Leon','ZAG',NULL,88,1,'Uruguaio implacavel, um dos zagueiros mais duros da historia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,4,'Casemiro Mior','ZAG',NULL,83,1,'Zagueiro de marcacao firme ao lado de De Leon.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,5,'Baidek','LE',NULL,83,1,'Lateral esquerdo consistente e de boa saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,6,'China','VOL','MC',84,1,'Volante de marcacao pesada e lideranca no meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,7,'Osvaldo','MC','MEI',83,1,'Meio-campista de muita corrida e boa insercao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,8,'Tarciso','MEI','MD',86,1,'Idolo tricolor, chegada a area e gols decisivos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,9,'Baltazar','ATA',NULL,85,1,'Centroavante artilheiro e goleador do titulo brasileiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,10,'Paulo Cesar Magalhaes','MEI','PE',82,1,'Meia-atacante habilidoso pelo lado esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,11,'Vantuir','PD','MD',81,1,'Ponta direita de velocidade e cruzamentos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,12,'Renato Gaucho','PD','ATA',84,0,'Jovem revelacao que explodiria dois anos depois no Mundial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,13,'Sergio','GOL',NULL,75,0,'Goleiro reserva do elenco gremista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,14,'Betinho','ZAG',NULL,77,0,'Zagueiro suplente de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,15,'Valdo','MC','MEI',79,0,'Meia jovem de tecnica apurada saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,16,'Nunes','ATA',NULL,80,0,'Centroavante reserva de faro de gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,17,'Bonamigo','VOL',NULL,77,0,'Volante de contencao para rodizio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,18,'Andre Catimba','PE','ME',78,0,'Ponta esquerda suplente de drible.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,19,'Joao Antonio','LD',NULL,75,0,'Lateral direito reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (74,20,'Ancheta','ZAG',NULL,79,0,'Zagueiro uruguaio veterano de muita experiencia.');

-- ===== 75. GREMIO 1983 =====
INSERT INTO teams VALUES (75,'Gremio',1983,'Gremio 1983 (Campeao do Mundo)','Valdir Espinosa','#0D80BF','#000000','Libertadores e Mundial em cima do Hamburgo. Renato Gaucho decisivo em Tokyo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,1,'Mazaropi','GOL',NULL,87,1,'Goleiro heroi do Mundial, gigante nas decisoes por penaltis.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,2,'Paulo Roberto','LD',NULL,83,1,'Lateral direito de apoio constante e boa marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,3,'De Leon','ZAG',NULL,90,1,'O xerife uruguaio. Capitao e simbolo do time campeao do mundo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,4,'Casemiro Mior','ZAG',NULL,84,1,'Zagueiro seguro que completava a dupla com De Leon.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,5,'Baidek','LE',NULL,84,1,'Lateral esquerdo firme e de boa saida pela ponta.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,6,'China','VOL','MC',85,1,'Volante de marcacao pesada, alicerce do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,7,'Osvaldo','MC','MEI',84,1,'Meio-campista de muita corrida e equilibrio tatico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,8,'Mario Sergio','MEI','ME',88,1,'Canhota refinada, cerebro criativo do time campeao do mundo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,9,'Caio','ATA',NULL,85,1,'Centroavante de forca e faro de gol na decisao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,10,'Tita','MEI','ATA',86,1,'Meia-atacante de tecnica apurada e chegada a area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,11,'Renato Gaucho','PD','ATA',91,1,'Autor dos dois gols na final contra o Hamburgo. Eterno idolo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,12,'Tarciso','MEI','MD',84,0,'Idolo veterano ainda decisivo saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,13,'Valdo','MC','MEI',82,0,'Meia jovem de muita tecnica no rodizio do meio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,14,'Bonamigo','VOL',NULL,79,0,'Volante de contencao suplente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,15,'Sergio','GOL',NULL,76,0,'Goleiro reserva imediato de Mazaropi.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,16,'Betinho','ZAG',NULL,78,0,'Zagueiro suplente de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,17,'Vantuir','PD','MD',80,0,'Ponta direita reserva de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,18,'Andre Catimba','PE','ME',79,0,'Ponta esquerda de drible curto vindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,19,'Joao Antonio','LD',NULL,76,0,'Lateral direito suplente do elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (75,20,'Baltazar','ATA',NULL,82,0,'Artilheiro veterano como opcao ofensiva de peso.');

-- ===== 76. FLAMENGO 1983 =====
INSERT INTO teams VALUES (76,'Flamengo',1983,'Flamengo 1983 (Tricampeao Brasileiro)','Carlinhos','#C8102E','#000000','Tricampeonato nacional em quatro anos, mesmo sem Zico, que estava na Italia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,1,'Cantarele','GOL',NULL,84,1,'Goleiro de reflexos rapidos, seguro na campanha do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,2,'Leandro','LD',NULL,92,1,'O lateral direito mais tecnico da historia do futebol brasileiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,3,'Marinho','ZAG',NULL,85,1,'Zagueiro de forca e lideranca na defesa rubro-negra.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,4,'Mozer','ZAG',NULL,88,1,'Zagueiro canhoto de saida de bola elegante e antecipacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,5,'Junior','LE','MC',92,1,'O Maestro. Lateral esquerdo de tecnica e visao incomparaveis.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,6,'Andrade','VOL','MC',86,1,'Volante de marcacao e boa saida, motor do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,7,'Adilio','MC','MEI',87,1,'Meia de ligacao com passe preciso e chegada a area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,8,'Peu','MEI','MD',82,1,'Meia de muita corrida e apoio ao ataque.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,9,'Baltazar','ATA',NULL,84,1,'Centroavante de area, goleador da campanha.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,10,'Bebeto','ATA','MEI',86,1,'Jovem craque em ascensao, drible e finalizacao de elite.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,11,'Tita','PD','MEI',85,1,'Ponta de muita tecnica e chegada perigosa a area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,12,'Nunes','ATA',NULL,84,0,'Artilheiro historico do Mundial de 1981, reserva de peso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,13,'Zinho','ME','MEI',78,0,'Jovem canhoto da base rubro-negra em formacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,14,'Vitor','MC','VOL',79,0,'Volante de composicao no rodizio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,15,'Raul','GOL',NULL,77,0,'Goleiro suplente do elenco rubro-negro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,16,'Figueiredo','ZAG',NULL,78,0,'Zagueiro reserva de marcacao firme.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,17,'Jorginho','LD','LE',80,0,'Lateral jovem que se tornaria campeao do mundo em 1994.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,18,'Cladson','PE','ME',77,0,'Ponta esquerda suplente de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,19,'Rondinelli','ZAG',NULL,82,0,'O Deus da Raca, zagueiro veterano de enorme historia no clube.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (76,20,'Marquinho','MEI','MD',79,0,'Meia reserva de criacao e boa tecnica.');

-- ===== 77. FLAMENGO 1987 =====
INSERT INTO teams VALUES (77,'Flamengo',1987,'Flamengo 1987 (Copa Uniao)','Carlinhos','#C8102E','#000000','O time do modulo verde. Zico, Bebeto, Renato Gaucho e Leandro no mesmo elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,1,'Zetti','GOL',NULL,84,1,'Goleiro jovem de grandes reflexos, futuro campeao do mundo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,2,'Josimar','LD',NULL,86,1,'Lateral direito de chute devastador e apoio constante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,3,'Aldair','ZAG',NULL,88,1,'Zagueiro elegante e de antecipacao perfeita, futuro idolo da Roma.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,4,'Leandro','ZAG','LD',90,1,'Craque absoluto atuando recuado, tecnica de meia na defesa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,5,'Leonardo','LE','MC',86,1,'Lateral canhoto de tecnica refinada, futuro campeao do mundo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,6,'Andrade','VOL','MC',85,1,'Volante lider, equilibrio do meio-campo rubro-negro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,7,'Zinho','ME','MEI',84,1,'Canhota habilidosa pelo lado esquerdo, drible e passe.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,8,'Zico','MEI','ATA',96,1,'O Galinho de Quintino. O maior jogador da historia do Flamengo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,9,'Bebeto','ATA','MEI',90,1,'Artilheiro do Brasileiro de 1987, drible e finalizacao de elite.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,10,'Renato Gaucho','PD','ATA',89,1,'Talento explosivo e velocidade pela ponta direita.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,11,'Zinho Pereira','MD','PD',80,1,'Meia de lado com boa chegada e cruzamentos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,12,'Jorginho','LD','LE',83,0,'Lateral de muita corrida, futuro campeao do mundo em 1994.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,13,'Ailton','ZAG',NULL,79,0,'Zagueiro reserva de marcacao dura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,14,'Marcio Costa','VOL',NULL,78,0,'Volante de contencao no rodizio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,15,'Cantarele','GOL',NULL,80,0,'Goleiro veterano de muita experiencia no elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,16,'Edinho','MC','MEI',80,0,'Meio-campista suplente de boa distribuicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,17,'Ze Carlos','ATA',NULL,79,0,'Atacante reserva de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,18,'Paulinho','MD','PD',78,0,'Meia de lado suplente de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,19,'Rogerio','LE',NULL,76,0,'Lateral esquerdo reserva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (77,20,'Marcelo','ATA','PE',77,0,'Atacante jovem de velocidade saindo do banco.');

-- ===== 78. SAO PAULO 1992 =====
INSERT INTO teams VALUES (78,'Sao Paulo',1992,'Sao Paulo 1992 (Campeao do Mundo)','Tele Santana','#C8102E','#ffffff','Libertadores e Mundial sobre o Barcelona de Cruyff. O melhor time do mundo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,1,'Zetti','GOL',NULL,91,1,'Goleiro decisivo nas penalidades, seguranca absoluta na meta.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,2,'Cafu','LD','MD',92,1,'O Pendolino. Lateral que subia e descia o campo inteiro sem cansar.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,3,'Ronaldao','ZAG',NULL,88,1,'Zagueiro de forca e presenca aerea dominante nas bolas paradas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,4,'Valber','ZAG',NULL,87,1,'Zagueiro de boa saida de bola e leitura de jogo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,5,'Ronaldo Luiz','LE',NULL,86,1,'Lateral esquerdo de apoio constante no esquema de Tele.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,6,'Pintado','VOL','MC',87,1,'Volante incansavel, o pulmao do meio-campo tricolor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,7,'Toninho Cerezo','MC','VOL',91,1,'Veterano de tecnica sublime, o cerebro tatico do time.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,8,'Rai','MEI','ATA',96,1,'O capitao. Autor dos dois gols da final do Mundial contra o Barcelona.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,9,'Muller','ATA','PD',91,1,'Atacante veloz e decisivo, letal nos contra-ataques.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,10,'Palhinha','ATA',NULL,89,1,'Centroavante artilheiro e goleador da Libertadores.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,11,'Macedo','PE','ME',85,1,'Ponta esquerda de velocidade e boa cobertura defensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,12,'Elivelton','MEI','PD',84,0,'Meia-atacante de drible e chegada saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,13,'Gilmar','GOL',NULL,82,0,'Goleiro reserva imediato de Zetti.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,14,'Adilson','VOL','ZAG',82,0,'Volante de marcacao para equilibrar o meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,15,'Ivan','ZAG',NULL,80,0,'Zagueiro suplente de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,16,'Doriva','VOL','MC',82,0,'Volante jovem de muita corrida no rodizio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,17,'Vitor','LE','LD',79,0,'Lateral reserva pelos dois lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,18,'Cafuringa','ATA','PD',80,0,'Atacante suplente de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,19,'Dinho','MC','MEI',82,0,'Meio-campista de ligacao com boa visao de jogo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (78,20,'Andre Luiz','ZAG','LD',79,0,'Defensor polivalente de composicao do elenco.');

-- ===== 79. SAO PAULO 1993 =====
INSERT INTO teams VALUES (79,'Sao Paulo',1993,'Sao Paulo 1993 (Bicampeao do Mundo)','Tele Santana','#C8102E','#ffffff','Bi da Libertadores e do Mundial sobre o Milan. Consagracao definitiva da era Tele.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,1,'Zetti','GOL',NULL,92,1,'Goleiro no auge absoluto, gigante nas decisoes internacionais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,2,'Cafu','LD','MD',93,1,'Lateral direito mais completo do mundo em sua posicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,3,'Ronaldao','ZAG',NULL,88,1,'Zagueiro imponente e goleador nas bolas paradas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,4,'Valber','ZAG',NULL,88,1,'Zagueiro tecnico de saida de bola limpa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,5,'Ronaldo Luiz','LE',NULL,86,1,'Lateral esquerdo de apoio e boa recomposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,6,'Doriva','VOL','MC',85,1,'Volante de marcacao intensa e muita corrida.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,7,'Toninho Cerezo','MC','VOL',90,1,'Maestro veterano, ditava o ritmo do time inteiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,8,'Dinho','MEI','MC',86,1,'Meia de ligacao com passe preciso e boa insercao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,9,'Muller','ATA','PD',91,1,'Atacante decisivo, autor de gol na final do Mundial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,10,'Palhinha','ATA',NULL,90,1,'Artilheiro de area, letal na finalizacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,11,'Juninho Paulista','MEI','MD',88,1,'Jovem craque revelado por Tele, drible curto e passe genial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,12,'Rai','MEI','ATA',95,0,'Capitao do bicampeonato antes de se transferir ao PSG.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,13,'Leonardo','LE','MC',89,0,'Canhota refinada, reserva de altissimo nivel na lateral e no meio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,14,'Gilmar','GOL',NULL,82,0,'Goleiro reserva de confianca.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,15,'Pintado','VOL','MC',86,0,'Volante incansavel no rodizio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,16,'Axel','ZAG',NULL,81,0,'Zagueiro suplente de marcacao firme.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,17,'Elivelton','MEI','PD',85,0,'Meia-atacante habilidoso saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,18,'Macedo','PE','ME',84,0,'Ponta esquerda de velocidade e entrega tatica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,19,'Andre Luiz','ZAG','LD',80,0,'Defensor polivalente do elenco tricolor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (79,20,'Guilherme','ATA',NULL,81,0,'Centroavante reserva de area.');

-- ===== 80. GREMIO 1995 =====
INSERT INTO teams VALUES (80,'Gremio',1995,'Gremio 1995 (Libertadores)','Luiz Felipe Scolari','#0D80BF','#000000','Bicampeao da America com Jardel artilheiro e Danrlei gigante no gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,1,'Danrlei','GOL',NULL,87,1,'Goleiro heroi da campanha, decisivo nas disputas por penaltis.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,2,'Arce','LD','MD',86,1,'Paraguaio de cruzamento perfeito e apoio incansavel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,3,'Adilson Batista','ZAG',NULL,85,1,'Zagueiro lider, marcacao dura e otima saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,4,'Rivarola','ZAG',NULL,83,1,'Zagueiro paraguaio de forca e presenca aerea.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,5,'Roger','LE','LD',83,1,'Lateral esquerdo de muita corrida e boa marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,6,'Dinho','VOL','MC',85,1,'Volante de marcacao pesada e lideranca no meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,7,'Goiano','VOL','MC',82,1,'Volante de contencao que dava equilibrio ao setor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,8,'Arilson','MEI','MC',86,1,'Meia armador de passe refinado, cerebro criativo do time.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,9,'Jardel','ATA',NULL,91,1,'Artilheiro absoluto da Libertadores, maquina de fazer gols.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,10,'Paulo Nunes','ATA','PD',86,1,'Atacante veloz e provocador, decisivo nas fases finais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,11,'Carlos Miguel','MEI','PE',82,1,'Meia-atacante de drible e boa insercao pela esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,12,'Emerson','VOL','MC',80,0,'Jovem volante de forca fisica, futuro Puma da Selecao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,13,'Luciano','ZAG',NULL,78,0,'Zagueiro reserva de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,14,'Marcos Adriano','LD',NULL,77,0,'Lateral direito suplente do elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,15,'Rodrigo Fabri','MEI','MD',80,0,'Meia jovem de tecnica apurada saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,16,'Ricardo Rocha','GOL',NULL,75,0,'Goleiro reserva imediato de Danrlei.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,17,'Nando','ATA',NULL,78,0,'Centroavante reserva de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,18,'Marcelo Ramos','ATA','PE',79,0,'Atacante jovem de velocidade e faro de gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,19,'Fabio Baiano','MEI','MD',81,0,'Meia habilidoso de bom passe e chegada a area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (80,20,'Charles','VOL',NULL,77,0,'Volante de composicao do elenco gremista.');

-- ===== 81. CRUZEIRO 1997 =====
INSERT INTO teams VALUES (81,'Cruzeiro',1997,'Cruzeiro 1997 (Libertadores)','Levir Culpi','#0033A0','#ffffff','Bicampeao da America sobre o Sporting Cristal. Dida gigante e Elivelton decisivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,1,'Dida','GOL',NULL,89,1,'Goleiro espetacular, o grande nome da conquista continental.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,2,'Vitor','LD',NULL,82,1,'Lateral direito de apoio constante e cruzamentos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,3,'Wilson Gottardo','ZAG',NULL,84,1,'Zagueiro experiente e lider da defesa celeste.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,4,'Gelson Baresi','ZAG',NULL,83,1,'Zagueiro de marcacao firme e boa saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,5,'Nonato','LE',NULL,82,1,'Lateral esquerdo de muita disposicao ofensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,6,'Fabinho','VOL','MC',83,1,'Volante de contencao e recomposicao rapida.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,7,'Ricardinho','MC','MEI',86,1,'Meia de passe refinado e visao de jogo privilegiada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,8,'Palhinha','MEI','ATA',85,1,'Meia-atacante de chegada a area e boa finalizacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,9,'Marcelo Ramos','ATA',NULL,86,1,'Artilheiro veloz e oportunista dentro da area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,10,'Elivelton','MEI','PD',85,1,'Autor do gol do titulo continental no Mineirao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,11,'Donizete','ATA','PE',84,1,'Atacante de velocidade e drible pelo lado esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,12,'Cleisson','ZAG',NULL,78,0,'Zagueiro reserva de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,13,'Rodrigo','GOL',NULL,76,0,'Goleiro suplente de Dida.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,14,'Ademir','VOL',NULL,78,0,'Volante de marcacao para rodizio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,15,'Marcelo Djian','MC','MEI',80,0,'Meia de bom passe e experiencia no elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,16,'Careca','ATA',NULL,79,0,'Centroavante reserva de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,17,'Luizao','ATA',NULL,82,0,'Centroavante jovem de forca fisica e faro de gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,18,'Marcio Santos','ZAG',NULL,80,0,'Zagueiro campeao do mundo em 1994, opcao de experiencia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,19,'Sandro','LE','LD',76,0,'Lateral reserva pelos dois lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (81,20,'Rodrigo Fabri','MEI','MD',80,0,'Meia habilidoso de boa insercao ofensiva.');

-- ===== 82. PALMEIRAS 1999 =====
INSERT INTO teams VALUES (82,'Palmeiras',1999,'Palmeiras 1999 (Libertadores)','Luiz Felipe Scolari','#006437','#ffffff','Primeiro titulo continental do clube. Marcos gigante nos penaltis contra o Deportivo Cali.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,1,'Marcos','GOL',NULL,91,1,'O Sao Marcos. Heroi absoluto da conquista da America.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,2,'Arce','LD','MD',87,1,'Lateral direito paraguaio de cruzamento cirurgico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,3,'Junior Baiano','ZAG',NULL,85,1,'Zagueiro de forca e marcacao implacavel na area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,4,'Roque Junior','ZAG',NULL,87,1,'Zagueiro elegante de antecipacao perfeita, futuro campeao do mundo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,5,'Junior','LE','MC',85,1,'Lateral esquerdo de muita corrida e bom cruzamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,6,'Cesar Sampaio','VOL','ZAG',87,1,'Capitao e lider absoluto, volante de marcacao e chegada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,7,'Rogerio','VOL','MC',82,1,'Volante de contencao no equilibrio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,8,'Zinho','ME','MEI',86,1,'Campeao do mundo em 1994, canhota refinada pela esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,9,'Oseas','ATA',NULL,84,1,'Centroavante artilheiro e goleador nas fases decisivas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,10,'Alex','MEI','ATA',89,1,'Craque canhoto de passe genial e chute perigoso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,11,'Paulo Nunes','ATA','PD',85,1,'Atacante veloz e provocador, decisivo na campanha.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,12,'Euller','PE','ATA',83,0,'Ponta esquerda de drible curto e velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,13,'Evair','ATA',NULL,82,0,'Idolo veterano de faro de gol como opcao de peso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,14,'Galeano','ATA','PD',80,0,'Atacante paraguaio de velocidade saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,15,'Sergio','GOL',NULL,76,0,'Goleiro reserva imediato de Marcos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,16,'Cleber','ZAG',NULL,80,0,'Zagueiro reserva de boa marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,17,'Fabio Junior','ATA','PE',79,0,'Atacante jovem de velocidade explosiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,18,'Marcinho','LE','LD',78,0,'Lateral reserva pelos dois lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,19,'Pedrinho','MEI','MD',80,0,'Meia jovem de tecnica apurada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (82,20,'Alceu','VOL',NULL,77,0,'Volante de composicao do elenco alviverde.');

-- ===== 83. CORINTHIANS 2000 =====
INSERT INTO teams VALUES (83,'Corinthians',2000,'Corinthians 2000 (Mundial FIFA)','Oswaldo de Oliveira','#000000','#ffffff','Primeiro campeao do Mundial de Clubes da FIFA, no Maracana contra o Vasco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,1,'Dida','GOL',NULL,89,1,'Goleiro decisivo na final por penaltis do Mundial da FIFA.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,2,'Indio','LD','ZAG',82,1,'Lateral direito de marcacao firme e apoio moderado.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,3,'Fabio Luciano','ZAG',NULL,85,1,'Zagueiro lider, forte no jogo aereo e na antecipacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,4,'Joao Carlos','ZAG',NULL,83,1,'Zagueiro de marcacao dura ao lado de Fabio Luciano.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,5,'Kleber','LE',NULL,84,1,'Lateral esquerdo de apoio constante e bom cruzamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,6,'Vampeta','VOL','MC',86,1,'Volante lider, marcacao e saida de bola de qualidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,7,'Freddy Rincon','MC','MEI',87,1,'Colombiano de forca fisica e chegada demolidora a area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,8,'Ricardinho','MEI','MC',87,1,'Meia armador de passe refinado e visao privilegiada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,9,'Luizao','ATA',NULL,88,1,'Centroavante artilheiro, eleito o melhor jogador do Mundial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,10,'Marcelinho Carioca','MEI','ME',89,1,'O Pe de Anjo. O melhor cobrador de faltas do futebol brasileiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,11,'Edilson','PD','ATA',88,1,'Capetinha. Drible desconcertante e velocidade pela direita.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,12,'Fabio Costa','GOL',NULL,80,0,'Goleiro reserva imediato de Dida.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,13,'Gilmar Fubá','MC','VOL',80,0,'Meio-campista de forca fisica saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,14,'Rogerio Correa','ZAG',NULL,79,0,'Zagueiro reserva de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,15,'Adilson','LD','LE',78,0,'Lateral reserva pelos dois lados do campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,16,'Ewerthon','ATA','PD',81,0,'Atacante jovem de velocidade e faro de gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,17,'Fabio Baiano','MEI','MD',81,0,'Meia habilidoso de bom passe e chegada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,18,'Marquinhos','ATA',NULL,78,0,'Centroavante reserva de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,19,'Silvinho','LE','ME',80,0,'Lateral canhoto de bom apoio e cruzamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (83,20,'Sylvinho Melo','VOL',NULL,77,0,'Volante de composicao do elenco alvinegro.');

-- ===== 84. GREMIO 2001 =====
INSERT INTO teams VALUES (84,'Gremio',2001,'Gremio 2001 (Copa do Brasil)','Tite','#0D80BF','#000000','A ultima Copa do Brasil de Ronaldinho Gaucho antes da ida para a Europa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,1,'Danrlei','GOL',NULL,84,1,'Goleiro experiente e lider da defesa gremista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,2,'Rodrigo','LD',NULL,80,1,'Lateral direito de apoio constante pela ponta.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,3,'Anderson Polga','ZAG',NULL,84,1,'Zagueiro tecnico de saida de bola limpa, futuro da Selecao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,4,'Claudio Milar','ZAG',NULL,80,1,'Zagueiro uruguaio de marcacao firme.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,5,'Marcio Careca','LE',NULL,79,1,'Lateral esquerdo de muita corrida e recomposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,6,'Tinga','VOL','MC',83,1,'Volante incansavel, o pulmao do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,7,'Fabio Pinto','VOL','MC',80,1,'Volante de contencao e boa recomposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,8,'Zinho','ME','MEI',84,1,'Campeao do mundo em 1994, canhota refinada pela esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,9,'Christian','ATA',NULL,81,1,'Centroavante de area com bom posicionamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,10,'Ronaldinho Gaucho','MEI','PE',92,1,'Genio absoluto do drible e da criacao, craque em ascensao mundial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,11,'Rodrigo Fabri','MEI','MD',83,1,'Meia de tecnica apurada e boa chegada a area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,12,'Claudio Pitbull','ATA','PD',80,0,'Atacante de velocidade e raca saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,13,'Fabio','GOL',NULL,76,0,'Goleiro reserva do elenco tricolor.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,14,'Gelson','ZAG',NULL,77,0,'Zagueiro suplente de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,15,'Anderson Lima','LD','LE',79,0,'Lateral de bom cruzamento pelos dois lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,16,'Andrei','MC','MEI',78,0,'Meio-campista de composicao no rodizio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,17,'Alex Alves','ATA',NULL,79,0,'Centroavante reserva de bom jogo aereo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,18,'Rafael Marques','ATA','PE',78,0,'Atacante jovem de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,19,'Guilherme','MC','VOL',77,0,'Volante suplente de marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (84,20,'Luizinho Vieira','MEI','MD',76,0,'Meia reserva de criacao.');

-- ===== 85. SAO CAETANO 2001 =====
INSERT INTO teams VALUES (85,'Sao Caetano',2001,'Sao Caetano 2001 (Vice-campeao Brasileiro)','Jair Picerni','#003399','#ffffff','A Cinderela do ABC. Vice do Brasileirao e depois vice da Libertadores em 2002.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,1,'Silvio Luiz','GOL',NULL,84,1,'Goleiro gigante, principal nome da campanha historica do clube.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,2,'Daniel','LD',NULL,79,1,'Lateral direito de apoio constante e boa marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,3,'Dininho','ZAG',NULL,83,1,'Zagueiro lider, forte no jogo aereo e na saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,4,'Fabio Santos','ZAG',NULL,80,1,'Zagueiro de marcacao firme e boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,5,'Marcelo Costa','LE',NULL,79,1,'Lateral esquerdo de muita corrida pela ponta.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,6,'Adaozinho','VOL','MC',80,1,'Volante de marcacao pesada no meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,7,'Maraba','VOL','MC',79,1,'Volante de contencao e equilibrio tatico.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,8,'Esquerdinha','MEI','ME',81,1,'Meia canhoto de bom passe e bolas paradas perigosas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,9,'Anailson','ATA',NULL,82,1,'Centroavante artilheiro e goleador da campanha.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,10,'Magrao','MEI','MC',82,1,'Meia armador, cerebro criativo do time do ABC.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,11,'Warley','PD','ATA',82,1,'Ponta de velocidade explosiva e drible no um contra um.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,12,'Serginho','ATA',NULL,78,0,'Centroavante reserva de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,13,'Marcos','GOL',NULL,74,0,'Goleiro suplente do elenco azulao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,14,'Rubens Cardoso','ZAG',NULL,76,0,'Zagueiro reserva de marcacao firme.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,15,'Robson','MC','VOL',76,0,'Volante de composicao no rodizio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,16,'Marcinho','LD','LE',75,0,'Lateral reserva pelos dois lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,17,'Adhemar','MEI','MD',77,0,'Meia suplente de criacao e boa insercao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,18,'Brandao','ATA','PE',78,0,'Atacante jovem de forca fisica e velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,19,'Capitao','ZAG','VOL',76,0,'Defensor polivalente do elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (85,20,'Gustavo','PE','ME',75,0,'Ponta esquerda reserva de velocidade.');

-- ===== 86. SAO PAULO 2005 =====
INSERT INTO teams VALUES (86,'Sao Paulo',2005,'Sao Paulo 2005 (Libertadores + Mundial)','Paulo Autuori','#C8102E','#ffffff','Tri da America e Mundial sobre o Liverpool. Rogerio Ceni no auge absoluto.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,1,'Rogerio Ceni','GOL',NULL,94,1,'O maior goleiro-artilheiro da historia. Capitao e simbolo eterno do clube.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,2,'Cicinho','LD','MD',87,1,'Lateral direito de velocidade absurda e apoio incansavel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,3,'Lugano','ZAG',NULL,89,1,'Capitao uruguaio, lider raçudo e marcador implacavel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,4,'Fabao','ZAG',NULL,84,1,'Zagueiro forte no jogo aereo e seguro na cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,5,'Junior','LE','MC',85,1,'Lateral esquerdo experiente de bom cruzamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,6,'Mineiro','VOL','MC',86,1,'Volante de marcacao e chegada, autor do gol do titulo mundial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,7,'Josue','VOL','MC',85,1,'Volante de contencao e recomposicao rapida no meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,8,'Danilo','MEI','MC',86,1,'Meia armador de passe refinado e visao de jogo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,9,'Amoroso','ATA',NULL,87,1,'Atacante de tecnica e faro de gol, experiencia europeia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,10,'Souza','MEI','PE',85,1,'Meia-atacante de drible e velocidade pelo lado esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,11,'Aloisio','ATA','PD',85,1,'O Boi Bandido. Forca fisica e gols decisivos na Libertadores.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,12,'Grafite','ATA',NULL,84,0,'Centroavante de forca e velocidade como opcao de peso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,13,'Diego Tardelli','ATA','PE',82,0,'Atacante jovem de movimentacao e boa finalizacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,14,'Christian','MEI','MC',81,0,'Meia suplente de criacao e bom passe.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,15,'Bosco','GOL',NULL,78,0,'Goleiro reserva imediato de Rogerio Ceni.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,16,'Edcarlos','ZAG',NULL,80,0,'Zagueiro jovem de boa saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,17,'Flavio Donizete','ATA','PD',79,0,'Atacante de velocidade saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,18,'Renan','VOL',NULL,79,0,'Volante de marcacao no rodizio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,19,'Alex Silva','ZAG',NULL,80,0,'Zagueiro jovem de forca e antecipacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (86,20,'Luizao','ATA',NULL,81,0,'Centroavante veterano com faro de gol na area.');

-- ===== 87. INTERNACIONAL 2006 =====
INSERT INTO teams VALUES (87,'Internacional',2006,'Internacional 2006 (Libertadores + Mundial)','Abel Braga','#D2122E','#ffffff','Campeao da America e do Mundo sobre o Barcelona de Ronaldinho. Fernandao capitao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,1,'Clemer','GOL',NULL,84,1,'Goleiro seguro e decisivo na campanha continental.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,2,'Ceara','LD','MD',82,1,'Lateral direito de muita corrida e apoio constante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,3,'Indio','ZAG',NULL,85,1,'Zagueiro lider, marcacao implacavel e presenca aerea.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,4,'Fabiano Eller','ZAG',NULL,83,1,'Zagueiro de forca fisica e marcacao dura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,5,'Wellington Monteiro','LE',NULL,81,1,'Lateral esquerdo de boa recomposicao e apoio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,6,'Edinho','VOL','ZAG',84,1,'Volante de marcacao pesada, alicerce defensivo do time.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,7,'Tinga','VOL','MC',85,1,'Volante incansavel de muita corrida e entrega.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,8,'Alex','MEI','MC',84,1,'Meia armador de passe preciso e boa insercao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,9,'Fernandao','ATA',NULL,88,1,'Capitao e simbolo eterno. Autor do gol do titulo mundial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,10,'Iarley','MEI','ATA',85,1,'Meia-atacante decisivo, gol na final da Libertadores.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,11,'Rafael Sobis','ATA','PE',85,1,'Atacante jovem de tecnica e faro de gol nas decisoes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,12,'Adriano Gabiru','ATA','PD',82,0,'Autor do gol do titulo mundial contra o Barcelona.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,13,'Michel','ZAG',NULL,79,0,'Zagueiro reserva de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,14,'Perdigao','LD','LE',78,0,'Lateral reserva pelos dois lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,15,'Renan','GOL',NULL,79,0,'Goleiro jovem promissor do elenco colorado.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,16,'Jorge Wagner','MEI','ME',82,0,'Meia canhoto de bolas paradas perigosas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,17,'Elder Granja','ATA','PE',79,0,'Atacante de velocidade saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,18,'Rubens Cardoso','VOL',NULL,78,0,'Volante de marcacao para rodizio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,19,'Marcio Careca','LE',NULL,77,0,'Lateral esquerdo suplente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (87,20,'Luizao','ATA',NULL,79,0,'Centroavante veterano como opcao de area.');

-- ===== 88. CORINTHIANS 2009 =====
INSERT INTO teams VALUES (88,'Corinthians',2009,'Corinthians 2009 (Copa do Brasil)','Mano Menezes','#000000','#ffffff','O ano do Fenomeno Ronaldo. Copa do Brasil e reconstrucao apos o rebaixamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,1,'Felipe','GOL',NULL,82,1,'Goleiro seguro e regular na campanha do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,2,'Alessandro','LD',NULL,82,1,'Lateral direito de muita corrida e lideranca.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,3,'Chicao','ZAG',NULL,85,1,'Zagueiro capitao, forte no aereo e cobrador de faltas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,4,'William','ZAG',NULL,81,1,'Zagueiro de marcacao firme e boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,5,'Roberto Carlos','LE','ME',86,1,'Lenda do futebol mundial, canhota devastadora nas faltas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,6,'Cristian','VOL','MC',82,1,'Volante de marcacao e boa saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,7,'Elias','VOL','MC',85,1,'Volante box-to-box de muita chegada e recomposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,8,'Douglas','MEI','MC',82,1,'Meia armador de passe preciso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,9,'Ronaldo','ATA',NULL,90,1,'O Fenomeno. Mesmo sem o fisico de antes, decidia com classe absurda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,10,'Jorge Henrique','PD','ATA',82,1,'Atacante de velocidade e muita entrega tatica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,11,'Dentinho','PE','ATA',83,1,'Ponta esquerda de drible curto e velocidade explosiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,12,'Danilo','MEI','MC',83,0,'Meia canhoto de bom passe e chute de fora da area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,13,'Julio Cesar','ZAG',NULL,79,0,'Zagueiro reserva de marcacao firme.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,14,'Andre Santos','LE','ME',81,0,'Lateral canhoto de bom apoio ofensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,15,'Bruno Octavio','GOL',NULL,75,0,'Goleiro suplente do elenco alvinegro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,16,'Iarley','MEI','MD',80,0,'Meia veterano de criacao saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,17,'Tcheco','MEI','MC',79,0,'Meia de bom passe no rodizio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,18,'Ralf','VOL',NULL,80,0,'Volante jovem de marcacao pesada em ascensao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,19,'Morais','LD',NULL,77,0,'Lateral direito reserva imediato.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (88,20,'Souza','ATA',NULL,79,0,'Centroavante reserva de area.');

-- ===== 89. INTERNACIONAL 2010 =====
INSERT INTO teams VALUES (89,'Internacional',2010,'Internacional 2010 (Libertadores)','Celso Roth','#D2122E','#ffffff','Bicampeao da America sobre o Guadalajara. D Alessandro maestro absoluto.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,1,'Renan','GOL',NULL,84,1,'Goleiro seguro e decisivo nas fases eliminatorias.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,2,'Nei','LD','MD',82,1,'Lateral direito de muita corrida e apoio pela ponta.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,3,'Bolivar','ZAG',NULL,85,1,'Zagueiro capitao, lider e implacavel na marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,4,'Indio','ZAG',NULL,84,1,'Zagueiro veterano de enorme experiencia em decisoes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,5,'Kleber','LE',NULL,81,1,'Lateral esquerdo de boa recomposicao defensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,6,'Sandro','VOL','MC',85,1,'Volante de forca fisica e desarme, futuro do Tottenham.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,7,'Guinazu','VOL','MC',84,1,'Argentino de marcacao inteligente e boa saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,8,'D''Alessandro','MEI','ME',91,1,'O maestro. Genio argentino que comandou o bicampeonato continental.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,9,'Leandro Damiao','ATA',NULL,86,1,'Centroavante artilheiro, revelacao do ano no futebol brasileiro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,10,'Giuliano','MEI','ATA',85,1,'Meia-atacante de drible e chegada, decisivo na final.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,11,'Alecsandro','ATA','PD',83,1,'Atacante de forca fisica e faro de gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,12,'Andrezinho','MEI','MD',82,0,'Meia de criacao e boa insercao saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,13,'Tinga','VOL','MC',83,0,'Volante veterano incansavel no rodizio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,14,'Muriel','GOL',NULL,79,0,'Goleiro reserva imediato de Renan.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,15,'Juan','ZAG',NULL,80,0,'Zagueiro reserva de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,16,'Wilson Matias','LD','LE',77,0,'Lateral reserva pelos dois lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,17,'Taison','PE','ATA',83,0,'Ponta esquerda de velocidade e drible explosivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,18,'Rafael Sobis','ATA','PE',83,0,'Atacante de tecnica apurada como opcao ofensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,19,'Pablo Guinazu Jr','VOL',NULL,76,0,'Volante de composicao do elenco colorado.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (89,20,'Elton','ATA',NULL,78,0,'Centroavante reserva de area.');

-- ===== 90. VASCO 2011 =====
INSERT INTO teams VALUES (90,'Vasco',2011,'Vasco 2011 (Copa do Brasil)','Ricardo Gomes','#000000','#ffffff','Copa do Brasil e vice do Brasileirao. Juninho Pernambucano de volta a Sao Januario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,1,'Fernando Prass','GOL',NULL,86,1,'Goleiro gigante, um dos melhores do pais na temporada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,2,'Fagner','LD','MD',84,1,'Lateral direito de muita corrida e cruzamento perigoso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,3,'Dede','ZAG',NULL,86,1,'Zagueiro de fisico impressionante e antecipacao perfeita.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,4,'Anderson Salles','ZAG',NULL,81,1,'Zagueiro de marcacao firme e boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,5,'Ramon','LE',NULL,81,1,'Lateral esquerdo de apoio constante pela ponta.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,6,'Fellipe Bastos','VOL','MC',82,1,'Volante de marcacao e boa distribuicao de jogo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,7,'Juninho Pernambucano','MC','MEI',89,1,'O maior cobrador de faltas da historia, maestro absoluto.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,8,'Diego Souza','MEI','ATA',86,1,'Meia-atacante de tecnica refinada e chegada a area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,9,'Alecsandro','ATA',NULL,84,1,'Centroavante artilheiro de forca fisica e faro de gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,10,'Eder Luis','PE','ATA',83,1,'Ponta esquerda de velocidade explosiva e drible.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,11,'Bernardo','MEI','PD',82,1,'Meia habilidoso de drible curto pelo lado direito.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,12,'Elton','ATA','PD',80,0,'Atacante de velocidade saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,13,'Rodolfo','ZAG',NULL,78,0,'Zagueiro reserva de marcacao dura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,14,'Alan Kardec','ATA',NULL,81,0,'Centroavante de bom jogo aereo como opcao de peso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,15,'Diego Cavalieri','GOL',NULL,80,0,'Goleiro reserva de boa qualidade tecnica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,16,'Nilton','VOL','MC',79,0,'Volante de contencao no rodizio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,17,'Felipe','MC','MEI',81,0,'Meia de boa visao e passe no elenco cruzmaltino.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,18,'Marcio Careca','LE',NULL,77,0,'Lateral esquerdo reserva imediato.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,19,'Jumar','LD','ZAG',76,0,'Defensor polivalente do elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (90,20,'Souza','MEI','MD',78,0,'Meia reserva de criacao.');

-- ===== 91. CORINTHIANS 2012 =====
INSERT INTO teams VALUES (91,'Corinthians',2012,'Corinthians 2012 (Libertadores + Mundial)','Tite','#000000','#ffffff','Invicto na Libertadores e campeao mundial sobre o Chelsea. Cassio gigante.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,1,'Cassio','GOL',NULL,90,1,'Melhor jogador do Mundial. Muralha absoluta na final contra o Chelsea.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,2,'Alessandro','LD',NULL,83,1,'Capitao, lateral de muita lideranca e experiencia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,3,'Chicao','ZAG',NULL,86,1,'Zagueiro lider, forte no aereo e seguro na marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,4,'Paulo Andre','ZAG',NULL,85,1,'Zagueiro de saida de bola limpa e antecipacao apurada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,5,'Fabio Santos','LE','ME',85,1,'Lateral canhoto de cruzamento preciso e cobranca de falta.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,6,'Ralf','VOL',NULL,84,1,'Volante de marcacao pesada, o cao de guarda do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,7,'Paulinho','VOL','MC',89,1,'Volante box-to-box no auge, chegada e gols decisivos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,8,'Douglas','MEI','MC',83,1,'Meia armador de passe preciso e boa leitura de jogo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,9,'Danilo','MEI','ME',85,1,'Meia canhoto de chute perigoso, autor de gol na final do Mundial.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,10,'Emerson Sheik','ATA','PE',86,1,'Autor dos dois gols do titulo da Libertadores no Pacaembu.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,11,'Jorge Henrique','PD','ATA',82,1,'Atacante de muita entrega tatica e velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,12,'Guerrero','ATA',NULL,87,0,'Autor do gol do titulo mundial contra o Chelsea.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,13,'Romarinho','ATA','PD',80,0,'Atacante de gols decisivos entrando do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,14,'Julio Cesar','ZAG',NULL,80,0,'Zagueiro reserva de marcacao firme.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,15,'Danilo Fernandes','GOL',NULL,79,0,'Goleiro reserva imediato de Cassio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,16,'Willian Arana','LE',NULL,77,0,'Lateral esquerdo suplente do elenco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,17,'Alex','MEI','MC',85,0,'Craque canhoto veterano, tecnica e passe de elite.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,18,'Edenilson','VOL','MD',79,0,'Volante jovem de muita corrida no rodizio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,19,'Wallace','ZAG',NULL,77,0,'Zagueiro jovem de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (91,20,'Martinez','LD','MD',78,0,'Lateral direito reserva de apoio ofensivo.');

-- ===== 92. BOTAFOGO 2013 =====
INSERT INTO teams VALUES (92,'Botafogo',2013,'Botafogo 2013 (Era Seedorf)','Oswaldo de Oliveira','#000000','#ffffff','O time mais bonito de se ver do ano. Seedorf, Jefferson e Vitinho encantando o pais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,1,'Jefferson','GOL',NULL,88,1,'Melhor goleiro do Brasil no ano, titular da Selecao Brasileira.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,2,'Gabriel','LD','MD',80,1,'Lateral direito de muita corrida e apoio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,3,'Bolivar','ZAG',NULL,83,1,'Zagueiro veterano lider, marcacao firme e experiencia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,4,'Doria','ZAG',NULL,80,1,'Zagueiro jovem de boa saida de bola e antecipacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,5,'Julio Cesar','LE',NULL,79,1,'Lateral esquerdo de boa recomposicao defensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,6,'Renato','VOL','MC',83,1,'Volante capitao de marcacao inteligente e lideranca.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,7,'Gabriel Silva','VOL','MC',80,1,'Volante de contencao no equilibrio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,8,'Seedorf','MEI','MC',87,1,'Tetracampeao da Champions League, classe pura no Engenhao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,9,'Rafael Marques','ATA',NULL,82,1,'Centroavante artilheiro de bom jogo aereo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,10,'Lodeiro','MEI','PE',85,1,'Uruguaio de drible e passe geniais pelo lado esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,11,'Vitinho','PD','ATA',84,1,'Revelacao do ano, drible desconcertante e velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,12,'Andrezinho','MEI','MD',80,0,'Meia de criacao e boa insercao saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,13,'Emerson Sheik','ATA','PE',82,0,'Atacante veterano de tecnica e faro de gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,14,'Renan Fonseca','ZAG',NULL,77,0,'Zagueiro reserva de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,15,'Marcio Ramos','GOL',NULL,75,0,'Goleiro suplente do elenco alvinegro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,16,'Airton','VOL',NULL,78,0,'Volante de marcacao no rodizio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,17,'Elias','ATA','PD',77,0,'Atacante suplente de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,18,'Lucas Zen','LD','LE',76,0,'Lateral reserva pelos dois lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,19,'Hyuri','ATA','PE',78,0,'Atacante jovem de velocidade explosiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (92,20,'Ferreyra','ATA',NULL,77,0,'Centroavante reserva de area.');

-- ===== 93. GREMIO 2016 =====
INSERT INTO teams VALUES (93,'Gremio',2016,'Gremio 2016 (Copa do Brasil)','Renato Portaluppi','#0D80BF','#000000','Fim do jejum de 15 anos sem titulo nacional. Base do bicampeonato da America.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,1,'Marcelo Grohe','GOL',NULL,86,1,'Goleiro decisivo, defesas milagrosas na campanha do titulo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,2,'Edilson','LD','MD',82,1,'Lateral direito de muita corrida e cruzamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,3,'Pedro Geromel','ZAG',NULL,86,1,'Zagueiro capitao, lider e de saida de bola refinada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,4,'Kannemann','ZAG',NULL,85,1,'Argentino raçudo, marcacao dura e antecipacao perfeita.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,5,'Marcelo Oliveira','LE',NULL,81,1,'Lateral esquerdo de bom apoio e recomposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,6,'Maicon','VOL','MC',84,1,'Volante de marcacao inteligente e boa saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,7,'Ramiro','MC','MD',83,1,'Meio-campista incansavel de muita chegada a area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,8,'Douglas','MEI','MC',84,1,'Meia armador de passe refinado e visao de jogo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,9,'Bolanos','MEI','PD',82,1,'Equatoriano de drible e criacao pelo lado direito.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,10,'Luan','ATA','MEI',86,1,'Craque em ascensao, drible e finalizacao decisivos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,11,'Pedro Rocha','ATA','PE',82,1,'Atacante de velocidade e boa movimentacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,12,'Everton Cebolinha','PE','ATA',82,0,'Jovem ponta de drible explosivo em ascensao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,13,'Bressan','ZAG',NULL,79,0,'Zagueiro reserva de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,14,'Fernandinho','ATA','PD',80,0,'Atacante de velocidade saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,15,'Tiago','GOL',NULL,77,0,'Goleiro reserva imediato de Grohe.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,16,'Wallace Oliveira','LD','LE',77,0,'Lateral reserva pelos dois lados.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,17,'Miller Bolanos Jr','MEI','MD',77,0,'Meia suplente de criacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,18,'Henrique Almeida','ATA',NULL,79,0,'Centroavante reserva de bom jogo aereo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,19,'Walace','VOL','MC',81,0,'Volante jovem de forca fisica e desarme.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (93,20,'Lincoln','ATA','PE',77,0,'Atacante da base gremista de velocidade.');

-- ===== 94. GREMIO 2017 =====
INSERT INTO teams VALUES (94,'Gremio',2017,'Gremio 2017 (Tri da Libertadores)','Renato Portaluppi','#0D80BF','#000000','Tricampeao da America sobre o Lanus. Arthur, Luan e Geromel em altissimo nivel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,1,'Marcelo Grohe','GOL',NULL,88,1,'Goleiro de defesas impossiveis, um dos melhores do continente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,2,'Edilson','LD','MD',83,1,'Lateral direito de apoio incansavel pela ponta.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,3,'Pedro Geromel','ZAG',NULL,88,1,'Capitao e melhor zagueiro do continente na temporada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,4,'Kannemann','ZAG',NULL,87,1,'Argentino implacavel, dupla perfeita com Geromel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,5,'Bruno Cortez','LE',NULL,83,1,'Lateral esquerdo de bom cruzamento e recomposicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,6,'Michel','VOL','MC',82,1,'Volante de marcacao e boa distribuicao de jogo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,7,'Arthur','MC','MEI',87,1,'Maestro do meio-campo, passe e conducao de nivel europeu.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,8,'Ramiro','MC','MD',83,1,'Meio-campista de muita corrida e chegada a area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,9,'Cicero','MEI','MC',83,1,'Meia experiente de boa insercao e finalizacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,10,'Luan','ATA','MEI',89,1,'Melhor jogador da America. Craque absoluto da conquista.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,11,'Everton Cebolinha','PE','ATA',85,1,'Ponta de drible explosivo e velocidade pela esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,12,'Fernandinho','PD','ATA',81,0,'Ponta de velocidade saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,13,'Lucas Barrios','ATA',NULL,82,0,'Centroavante paraguaio de forca e faro de gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,14,'Jael','ATA',NULL,79,0,'Centroavante de jogo aereo como opcao de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,15,'Leo Moura','LD',NULL,80,0,'Lateral veterano de enorme experiencia em decisoes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,16,'Paulo Victor','GOL',NULL,79,0,'Goleiro reserva imediato de Grohe.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,17,'Bressan','ZAG',NULL,79,0,'Zagueiro reserva de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,18,'Jailson','VOL',NULL,80,0,'Volante de marcacao no rodizio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,19,'Pedro Rocha','ATA','PE',81,0,'Atacante de velocidade e boa movimentacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (94,20,'Marcelo Oliveira','LE',NULL,79,0,'Lateral esquerdo reserva imediato.');

-- ===== 95. ATHLETICO-PR 2018 =====
INSERT INTO teams VALUES (95,'Athletico-PR',2018,'Athletico-PR 2018 (Sul-Americana)','Tiago Nunes','#C8102E','#000000','Primeiro titulo internacional do clube, nos penaltis contra o Junior Barranquilla.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,1,'Santos','GOL',NULL,85,1,'Goleiro heroi da final, defendeu penaltis decisivos na Arena.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,2,'Jonathan','LD','MD',81,1,'Lateral direito de apoio constante e cruzamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,3,'Thiago Heleno','ZAG',NULL,83,1,'Zagueiro raçudo, lider e implacavel na marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,4,'Paulo Andre','ZAG',NULL,82,1,'Zagueiro veterano de saida de bola limpa e experiencia.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,5,'Renan Lodi','LE','ME',83,1,'Lateral esquerdo de muita corrida, futuro do Atletico de Madrid.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,6,'Wellington','VOL','MC',81,1,'Volante de marcacao e recomposicao rapida.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,7,'Bruno Guimaraes','VOL','MC',84,1,'Volante de tecnica rara, revelacao que brilharia na Europa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,8,'Lucho Gonzalez','MEI','MC',85,1,'Argentino maestro, cerebro e lideranca do time campeao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,9,'Pablo','ATA',NULL,85,1,'Centroavante artilheiro, forte no aereo e na finalizacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,10,'Nikao','MEI','PE',84,1,'Meia-atacante de drible e chute perigoso pela esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,11,'Marcelo Cirino','ATA','PD',82,1,'Atacante de velocidade e boa movimentacao ofensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,12,'Rony','ATA','PD',82,0,'Atacante de velocidade explosiva saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,13,'Leo Pereira','ZAG',NULL,80,0,'Zagueiro jovem de boa saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,14,'Raphael Veiga','MEI','MC',82,0,'Meia canhoto de bom passe e finalizacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,15,'Felipe Alves','GOL',NULL,77,0,'Goleiro reserva imediato do elenco rubro-negro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,16,'Camacho','VOL',NULL,79,0,'Volante de marcacao no rodizio do meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,17,'Marcinho','LD','MD',78,0,'Lateral direito reserva de apoio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,18,'Guilherme Bissoli','ATA',NULL,78,0,'Centroavante jovem de area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,19,'Zezinho','MEI','MD',78,0,'Meia suplente de criacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (95,20,'Bruno Nazario','MEI','ME',79,0,'Meia canhoto de bom drible saindo do banco.');

-- ===== 96. CRUZEIRO 2018 =====
INSERT INTO teams VALUES (96,'Cruzeiro',2018,'Cruzeiro 2018 (Bi da Copa do Brasil)','Mano Menezes','#0033A0','#ffffff','Bicampeao consecutivo da Copa do Brasil. Fabio e Dede comandando a defesa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,1,'Fabio','GOL',NULL,89,1,'Goleiro eterno do clube, decisivo em disputas por penaltis.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,2,'Edilson','LD','MD',82,1,'Lateral direito de muita corrida e cruzamento perigoso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,3,'Dede','ZAG',NULL,87,1,'Zagueiro dominante, um dos melhores do Brasil na posicao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,4,'Leo','ZAG',NULL,84,1,'Zagueiro capitao, lider e seguro na marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,5,'Egidio','LE','ME',83,1,'Lateral canhoto de cruzamento preciso e bom apoio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,6,'Henrique','VOL','MC',84,1,'Volante lider, marcacao inteligente e saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,7,'Lucas Romero','VOL','MC',81,1,'Argentino de contencao e equilibrio no meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,8,'Thiago Neves','MEI','ATA',86,1,'Meia de tecnica refinada e gols decisivos nas finais.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,9,'Barcos','ATA',NULL,83,1,'Centroavante argentino de forca fisica e faro de gol.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,10,'Arrascaeta','MEI','PE',88,1,'Uruguaio genial, drible, passe e finalizacao de elite.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,11,'Robinho','MEI','MD',83,1,'Meia de boa insercao ofensiva e chegada a area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,12,'Rafinha','ATA','PD',81,0,'Atacante de velocidade saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,13,'Sassa','ATA',NULL,80,0,'Centroavante reserva de bom jogo aereo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,14,'Murilo','ZAG',NULL,79,0,'Zagueiro jovem de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,15,'Rafael','GOL',NULL,78,0,'Goleiro reserva imediato de Fabio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,16,'Ariel Cabral','VOL',NULL,80,0,'Volante argentino de marcacao no rodizio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,17,'Raniel','ATA',NULL,79,0,'Centroavante jovem de movimentacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,18,'Marcelo Hermes','LE',NULL,78,0,'Lateral esquerdo reserva de apoio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,19,'David','ATA','PE',80,0,'Atacante de velocidade e drible pela esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (96,20,'Lucas Silva','MC','VOL',81,0,'Volante de boa saida de bola e visao de jogo.');

-- ===== 97. PALMEIRAS 2020 =====
INSERT INTO teams VALUES (97,'Palmeiras',2020,'Palmeiras 2020 (Libertadores)','Abel Ferreira','#006437','#ffffff','Bicampeao da America apos 21 anos, gol de Breno Lopes no ultimo minuto do Maracana.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,1,'Weverton','GOL',NULL,86,1,'Goleiro campeao olimpico, seguranca absoluta na campanha.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,2,'Marcos Rocha','LD','MD',84,1,'Lateral direito de muita velocidade e boa marcacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,3,'Gustavo Gomez','ZAG',NULL,87,1,'Paraguaio capitao, marcacao implacavel e goleador de bola parada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,4,'Luan','ZAG',NULL,83,1,'Zagueiro de boa saida de bola e antecipacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,5,'Vina','LE','ME',83,1,'Uruguaio de apoio constante e cruzamento preciso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,6,'Felipe Melo','VOL','ZAG',83,1,'Volante raçudo, lideranca e marcacao pesada no meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,7,'Danilo','VOL','MC',83,1,'Volante jovem de forca fisica e boa saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,8,'Ze Rafael','MC','MEI',83,1,'Meio-campista de muita corrida e chegada a area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,9,'Luiz Adriano','ATA',NULL,84,1,'Centroavante artilheiro de faro de gol apurado.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,10,'Raphael Veiga','MEI','ME',85,1,'Meia canhoto de passe e finalizacao de alto nivel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,11,'Rony','ATA','PD',84,1,'Atacante de velocidade explosiva e muita entrega tatica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,12,'Breno Lopes','ATA','PD',79,0,'Autor do gol do titulo da Libertadores no Maracana.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,13,'Gabriel Menino','MC','MD',82,0,'Meio-campista jovem de boa tecnica e versatilidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,14,'Patrick de Paula','VOL','MC',80,0,'Volante jovem de boa saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,15,'Jailson','GOL',NULL,79,0,'Goleiro reserva imediato de Weverton.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,16,'Empereur','ZAG',NULL,79,0,'Zagueiro reserva de marcacao firme.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,17,'Willian','ATA','PE',80,0,'Atacante veloz e experiente saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,18,'Mayke','LD',NULL,81,0,'Lateral direito reserva de muita corrida.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,19,'Lucas Lima','MEI','MC',80,0,'Meia de bom passe como opcao de criacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (97,20,'Wesley','ATA','PE',79,0,'Atacante da base de velocidade e drible.');

-- ===== 98. PALMEIRAS 2021 =====
INSERT INTO teams VALUES (98,'Palmeiras',2021,'Palmeiras 2021 (Bi da Libertadores)','Abel Ferreira','#006437','#ffffff','Bicampeao consecutivo da America sobre o Flamengo, gol de Deyverson na prorrogacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,1,'Weverton','GOL',NULL,87,1,'Goleiro decisivo, muralha na final contra o Flamengo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,2,'Marcos Rocha','LD','MD',84,1,'Lateral direito de velocidade e marcacao consistente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,3,'Gustavo Gomez','ZAG',NULL,88,1,'Capitao paraguaio, o melhor zagueiro do continente.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,4,'Luan','ZAG',NULL,84,1,'Zagueiro de saida de bola limpa e boa antecipacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,5,'Piquerez','LE','ME',85,1,'Uruguaio de apoio incansavel e cruzamento preciso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,6,'Danilo','VOL','MC',85,1,'Volante de forca e tecnica, futuro do Nottingham Forest.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,7,'Ze Rafael','MC','MEI',84,1,'Meio-campista de muita corrida e boa insercao ofensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,8,'Raphael Veiga','MEI','ME',87,1,'Meia canhoto no auge, passe e finalizacao decisivos.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,9,'Rony','ATA','PD',85,1,'Atacante de velocidade explosiva e gols em decisoes.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,10,'Dudu','MEI','PE',86,1,'Idolo alviverde, drible curto e criacao pelo lado esquerdo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,11,'Gustavo Scarpa','MEI','ME',85,1,'Canhota refinada e cobrancas de falta perigosissimas.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,12,'Deyverson','ATA',NULL,80,0,'Autor do gol do bicampeonato da America na prorrogacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,13,'Felipe Melo','VOL','ZAG',82,0,'Volante veterano raçudo, lideranca dentro e fora de campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,14,'Mayke','LD',NULL,82,0,'Lateral direito reserva de muita corrida e apoio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,15,'Jailson','GOL',NULL,79,0,'Goleiro reserva imediato de Weverton.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,16,'Gabriel Menino','MC','MD',82,0,'Meio-campista versatil de boa tecnica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,17,'Renan','ZAG',NULL,79,0,'Zagueiro jovem de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,18,'Wesley','ATA','PE',80,0,'Atacante jovem de velocidade e drible.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,19,'Patrick de Paula','VOL','MC',80,0,'Volante de boa saida de bola no rodizio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (98,20,'Breno Lopes','ATA','PD',79,0,'Atacante de velocidade como opcao ofensiva.');

-- ===== 99. FLAMENGO 2022 =====
INSERT INTO teams VALUES (99,'Flamengo',2022,'Flamengo 2022 (Libertadores + Copa do Brasil)','Dorival Junior','#C8102E','#000000','Tri da America sobre o Athletico e Copa do Brasil no mesmo ano. Elenco milionario.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,1,'Santos','GOL',NULL,86,1,'Goleiro decisivo nas penalidades da Copa do Brasil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,2,'Rodinei','LD','MD',84,1,'Lateral direito de muita corrida e apoio incansavel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,3,'Fabricio Bruno','ZAG',NULL,85,1,'Zagueiro de forca fisica e otima antecipacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,4,'David Luiz','ZAG',NULL,87,1,'Zagueiro de nivel europeu, saida de bola e lideranca.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,5,'Filipe Luis','LE','ME',86,1,'Lateral campeao da Champions, inteligencia tatica pura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,6,'Thiago Maia','VOL','MC',84,1,'Volante de marcacao e boa distribuicao no meio-campo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,7,'Joao Gomes','VOL','MC',85,1,'Volante de raca e desarme, futuro do Wolverhampton.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,8,'Everton Ribeiro','MEI','MD',88,1,'Capitao e maestro, drible curto e passe de elite.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,9,'Pedro','ATA',NULL,89,1,'Artilheiro da Libertadores, centroavante mais letal do Brasil.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,10,'Arrascaeta','MEI','PE',92,1,'Uruguaio genial, o melhor meia do continente na temporada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,11,'Gabigol','ATA','PE',90,1,'O maior artilheiro de finais da historia recente do clube.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,12,'Arturo Vidal','VOL','MC',86,0,'Chileno vencedor, raca e experiencia europeia no banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,13,'Everton Cebolinha','PE','ATA',85,0,'Ponta de drible explosivo como opcao de altissimo nivel.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,14,'Ayrton Lucas','LE','ME',84,0,'Lateral canhoto de muita corrida e bom cruzamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,15,'Leo Pereira','ZAG',NULL,83,0,'Zagueiro canhoto de boa saida de bola.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,16,'Hugo Souza','GOL',NULL,80,0,'Goleiro jovem reserva do elenco rubro-negro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,17,'Matheuzinho','LD','MD',81,0,'Lateral direito reserva de velocidade.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,18,'Vitinho','ATA','PD',80,0,'Atacante de drible e velocidade saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,19,'Marinho','ATA','PE',82,0,'Atacante experiente de drible e chute perigoso.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (99,20,'Pablo','ZAG',NULL,80,0,'Zagueiro reserva de marcacao firme.');

-- ===== 100. FLUMINENSE 2023 =====
INSERT INTO teams VALUES (100,'Fluminense',2023,'Fluminense 2023 (Libertadores)','Fernando Diniz','#7A1921','#006633','Primeiro titulo continental do clube, no Maracana. O Dinizismo em estado puro.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,1,'Fabio','GOL',NULL,89,1,'Goleiro eterno aos 43 anos, defesas milagrosas na final.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,2,'Samuel Xavier','LD','MD',83,1,'Lateral direito de muita corrida e apoio no sistema de Diniz.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,3,'Nino','ZAG',NULL,86,1,'Capitao e zagueiro de saida de bola refinada, lider da defesa.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,4,'Felipe Melo','ZAG','VOL',83,1,'Veterano raçudo, lideranca e leitura tatica apurada.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,5,'Marcelo','LE','ME',86,1,'Lenda do Real Madrid, tecnica e criatividade pela esquerda.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,6,'Andre','VOL','MC',87,1,'O melhor volante do Brasil, desarme e saida de bola de elite.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,7,'Martinelli','MC','VOL',82,1,'Meio-campista de muita corrida e entrega tatica.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,8,'Ganso','MEI','MC',86,1,'Maestro de passe milimetrico, cerebro do Dinizismo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,9,'Cano','ATA',NULL,88,1,'Artilheiro argentino implacavel, maquina de gols na area.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,10,'Jhon Arias','MEI','PD',88,1,'Colombiano craque absoluto, drible, passe e finalizacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,11,'Keno','PE','ATA',84,1,'Ponta esquerda de velocidade e drible no um contra um.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,12,'John Kennedy','ATA','PE',80,0,'Autor do gol do titulo da Libertadores na prorrogacao.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,13,'Alexsander','MC','MEI',80,0,'Meio-campista jovem de boa tecnica e passe.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,14,'Lima','MEI','MD',81,0,'Meia de criacao e boa insercao ofensiva.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,15,'Diogo Barbosa','LE',NULL,80,0,'Lateral esquerdo reserva de bom cruzamento.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,16,'Vitor Mendes','ZAG',NULL,79,0,'Zagueiro reserva de boa cobertura.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,17,'Pedro Rangel','GOL',NULL,77,0,'Goleiro reserva imediato de Fabio.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,18,'Guga','LD','MD',79,0,'Lateral direito reserva de apoio ofensivo.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,19,'Yony Gonzalez','ATA','PE',79,0,'Atacante colombiano de velocidade saindo do banco.');
INSERT INTO players(team_id,jersey,name,pos_primary,pos_secondary,overall,is_starter,notes) VALUES (100,20,'Alan','MEI','PD',78,0,'Meia jovem de drible e velocidade pela direita.');
