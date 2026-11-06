// Painel principal do Modo Carreira — pedido explícito do usuário
// (2026-11-06, com imagem de referência): layout de 3 colunas estilo
// Soccer Manager/EA FC — esquerda com o próximo jogo em destaque (escudos
// grandes), o último resultado e um medidor visual de orçamento; centro
// com o essencial (cabeçalho, o que aconteceu, atalhos, avançar); direita
// com novidades (mesmo feed de antes, só reposicionado) e os maiores
// negócios da liga inteira na temporada (não só do clube do usuário — ver
// `transferLog`, alimentado em rosterStore.js/seasonEngine.js). Empilha
// numa coluna só em telas estreitas (ver breakpoint no <style> abaixo).
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { formatCalendarDay } from '../engine/calendar.js';
import { TransferWindowBadge } from '../components/TransferWindowBadge.jsx';
import { backButtonStyle } from '../components/styles.js';

function formatMoney(n) {
  return 'R$ ' + n.toLocaleString('pt-BR');
}

// Versão curta pro medidor de orçamento (pouco espaço) — "R$ 69,2M" em vez
// de "R$ 69.200.000".
function formatMoneyShort(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `R$ ${(n / 1_000_000_000).toFixed(1).replace('.', ',')}B`;
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}K`;
  return `R$ ${n}`;
}

function myDivisionData(save) {
  const division = save.clubs[save.myClubId].division;
  return { key: division, data: division === 'A' ? save.divisionA : save.divisionB };
}

export function eventLine(ev, myClubId) {
  if (ev.type === 'match') {
    const isHome = ev.homeId === myClubId;
    const oppId = isHome ? ev.awayId : ev.homeId;
    const oppTeam = TEAMS.find(t => t.id === oppId);
    const myTeam = TEAMS.find(t => t.id === myClubId);
    const myGoals = isHome ? ev.homeGoals : ev.awayGoals;
    const oppGoals = isHome ? ev.awayGoals : ev.homeGoals;
    const result = myGoals > oppGoals ? '🟢' : myGoals < oppGoals ? '🔴' : '🟡';
    return `${result} ${myTeam?.club || ''} ${myGoals} x ${oppGoals} ${oppTeam?.club || ''}`;
  }
  if (ev.type === 'transfer-ai') {
    const from = TEAMS.find(t => t.id === ev.fromClubId);
    const to = TEAMS.find(t => t.id === ev.toClubId);
    return `🔄 ${from?.club} comprou ${ev.playerName} do ${to?.club} por ${formatMoney(ev.amount)}`;
  }
  if (ev.type === 'offer') {
    return `📨 Proposta recebida pelo ${ev.playerName}`;
  }
  if (ev.type === 'copa-round') {
    return `🏆 Copa do Brasil — ${ev.roundLabel} resolvida`;
  }
  return null;
}

// Último resultado do usuário já jogado (não o próximo) — procura na
// última rodada resolvida da divisão dele.
function lastMatchResult(save, division) {
  if (division.round <= 0) return null;
  const results = division.results?.[division.round - 1] || [];
  const m = results.find(r => r.homeId === save.myClubId || r.awayId === save.myClubId);
  if (!m) return null;
  const isHome = m.homeId === save.myClubId;
  const oppId = isHome ? m.awayId : m.homeId;
  const myGoals = isHome ? m.homeGoals : m.awayGoals;
  const oppGoals = isHome ? m.awayGoals : m.homeGoals;
  return { oppId, myGoals, oppGoals, isHome, res: myGoals > oppGoals ? 'V' : myGoals < oppGoals ? 'D' : 'E' };
}

// Vidro fosco (glassmorphism) — pedido explícito do usuário (2026-11-06,
// com um briefing de design colado): fundo semi-transparente + blur +
// borda sutil + sombra, em vez do card "chapado" de antes. `backdropFilter`
// cai graciosamente pra um fundo um pouco mais opaco em navegadores sem
// suporte (nenhuma quebra visual, só perde o blur).
const cardStyle = {
  padding: '16px', borderRadius: 16,
  background: 'rgba(20,28,22,0.55)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
};
const cardLabelStyle = { fontSize: 10.5, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 };
const RESULT_COLORS = { V: '#7fd99a', D: '#e05050', E: 'rgba(244,241,234,0.6)' };

function TeamCrest({ teamId, size }) {
  const team = TEAMS.find(t => t.id === teamId);
  const logo = team && CLUB_LOGOS[team.club];
  return logo
    ? <img src={logo} alt={team.club} style={{ width: size, height: size, objectFit: 'contain' }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />;
}

function NextMatchCard({ save, division, seasonOver, nextMatch }) {
  return (
    <div className="career-hub-card" style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
      <div style={{ ...cardLabelStyle, textAlign: 'center', marginBottom: 12, color: '#d4a23c', opacity: 0.85 }}>⚽ Próximo jogo</div>
      {seasonOver ? (
        <div style={{ fontSize: 12.5, opacity: 0.7, textAlign: 'center', padding: '10px 0' }}>Temporada {save.season} terminada.</div>
      ) : nextMatch ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, position: 'relative' }}>
            <div style={{
              position: 'absolute', left: '50%', top: '38%', transform: 'translate(-50%,-50%)',
              width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,162,60,0.16), transparent 70%)', pointerEvents: 'none',
            }} />
            <div style={{ textAlign: 'center', flex: 1, minWidth: 0, position: 'relative' }}>
              <TeamCrest teamId={nextMatch.homeId} size={60} />
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{TEAMS.find(t => t.id === nextMatch.homeId)?.club}</div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.45, fontWeight: 700, flexShrink: 0, position: 'relative' }}>×</div>
            <div style={{ textAlign: 'center', flex: 1, minWidth: 0, position: 'relative' }}>
              <TeamCrest teamId={nextMatch.awayId} size={60} />
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{TEAMS.find(t => t.id === nextMatch.awayId)?.club}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, opacity: 0.55, marginTop: 12, fontFamily: "'Space Mono', monospace" }}>Rodada {division.round + 1} · {formatCalendarDay(save.seasonCalendar[division.round])}</div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, opacity: 0.6, textAlign: 'center', padding: '10px 0' }}>Sem jogo seu nesta rodada.</div>
      )}
    </div>
  );
}

function LastGameCard({ save, division }) {
  const last = lastMatchResult(save, division);
  if (!last) return null;
  const oppTeam = TEAMS.find(t => t.id === last.oppId);
  const myGoalsFirst = last.isHome;
  return (
    <div className="career-hub-card" style={cardStyle}>
      <div style={cardLabelStyle}>Último jogo</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <TeamCrest teamId={myGoalsFirst ? save.myClubId : last.oppId} size={24} />
          <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {myGoalsFirst ? TEAMS.find(t => t.id === save.myClubId)?.club : oppTeam?.club}
          </span>
        </div>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 800, color: RESULT_COLORS[last.res], flexShrink: 0, padding: '0 8px' }}>
          {myGoalsFirst ? last.myGoals : last.oppGoals} - {myGoalsFirst ? last.oppGoals : last.myGoals}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {myGoalsFirst ? oppTeam?.club : TEAMS.find(t => t.id === save.myClubId)?.club}
          </span>
          <TeamCrest teamId={myGoalsFirst ? last.oppId : save.myClubId} size={24} />
        </div>
      </div>
    </div>
  );
}

// Medidor visual do orçamento — semicírculo preenchido proporcionalmente a
// um teto de referência (R$250M, cobre a faixa normal de orçamento dos 40
// clubes neste modo); acima disso o medidor só satura em 100%, sem quebrar
// nada (é só um indicador visual, o valor exato já aparece no texto dele).
function MoneyMeter({ budget }) {
  const REF_MAX = 250_000_000;
  const pct = Math.max(0, Math.min(1, budget / REF_MAX));
  const r = 68, cx = 90, cy = 80;
  const circ = Math.PI * r;
  return (
    <div className="career-hub-card" style={cardStyle}>
      <div style={{ ...cardLabelStyle, textAlign: 'center' }}>Orçamento</div>
      <svg width="100%" height="92" viewBox="0 0 180 92" style={{ display: 'block', marginTop: 4 }}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={13} strokeLinecap="round" />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#d4a23c" strokeWidth={13} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize="15" fontWeight="700" fill="#d4a23c" fontFamily="'Space Mono', monospace">{formatMoneyShort(budget)}</text>
      </svg>
    </div>
  );
}

function NovidadesCard({ dayEvents }) {
  return (
    <div className="career-hub-card" style={cardStyle}>
      <div style={cardLabelStyle}>📰 O que aconteceu</div>
      {dayEvents.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.45, marginTop: 8 }}>Nada de novo por enquanto.</div>
      ) : (
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          {dayEvents.map((line, i) => <div key={i} style={{ fontSize: 12.5, lineHeight: 1.4 }}>{line}</div>)}
        </div>
      )}
    </div>
  );
}

// Maiores negócios da LIGA INTEIRA nesta temporada (os 40 clubes, não só o
// do usuário) — vem de `save.transferLog`, alimentado em cada venda/compra
// (rosterStore.js/seasonEngine.js). Fica vazio até a primeira janela de
// transferências da temporada produzir alguma negociação de IA.
function TopTransfersCard({ save }) {
  const seasonLog = (save.transferLog || []).filter(e => e.season === save.season);
  const top = [...seasonLog].sort((a, b) => b.amount - a.amount).slice(0, 5);
  return (
    <div className="career-hub-card" style={cardStyle}>
      <div style={cardLabelStyle}>🔥 Top transferências na liga</div>
      {top.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.45, marginTop: 8 }}>Nenhuma negociação ainda nesta temporada.</div>
      ) : (
        <div style={{ marginTop: 8, display: 'grid', gap: 7 }}>
          {top.map((t, i) => {
            const toTeam = TEAMS.find(x => x.id === t.toClubId);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10.5, opacity: 0.4, fontFamily: "'Space Mono', monospace", width: 12, flexShrink: 0 }}>{i + 1}</span>
                <TeamCrest teamId={t.toClubId} size={18} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.playerName}</div>
                  <div style={{ fontSize: 10, opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toTeam?.club}</div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#d4a23c', fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>{formatMoneyShort(t.amount)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CareerHub({ save, onNavigate, onAdvanceDay, onSimulateSeason, onExit }) {
  const team = TEAMS.find(t => t.id === save.myClubId);
  const club = save.clubs[save.myClubId];
  const logo = CLUB_LOGOS[team.club];
  const { key: divisionKey, data: division } = myDivisionData(save);
  const myPos = division.table.findIndex(r => r.id === save.myClubId) + 1;
  const nextMatches = division.fixtures[division.round] || [];
  const nextMatch = nextMatches.find(m => m.homeId === save.myClubId || m.awayId === save.myClubId);
  const seasonOver = division.round >= division.fixtures.length;
  const offerCount = save.pendingOffers?.length || 0;
  const dayEvents = (save.lastDayEvents || []).map(ev => eventLine(ev, save.myClubId)).filter(Boolean);
  const academyCount = club.roster.filter(p => p.inAcademy).length;

  return (
    <div className="career-hub-grid">
      <style>{`
        .career-hub-grid { display: grid; grid-template-columns: 250px minmax(0, 560px) 250px; gap: 14px; justify-content: center; max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
        .career-hub-col { display: grid; gap: 10px; align-content: start; }
        .career-hub-card { transition: border-color 0.18s ease, transform 0.18s ease; }
        .career-hub-card:hover { border-color: rgba(212,162,60,0.3); }
        .career-nav-btn { transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease; }
        .career-nav-btn:hover { background: rgba(255,255,255,0.07); border-color: rgba(212,162,60,0.4); transform: translateY(-1px); }
        .career-advance-btn { transition: filter 0.15s ease, transform 0.15s ease; }
        .career-advance-btn:not(:disabled):hover { filter: brightness(1.08); transform: translateY(-1px); }
        .career-simulate-btn:not(:disabled):hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.3); }
        @media (max-width: 900px) {
          .career-hub-grid { grid-template-columns: 1fr; max-width: 560px; }
        }
      `}</style>

      <div className="career-hub-col">
        <NextMatchCard save={save} division={division} seasonOver={seasonOver} nextMatch={nextMatch} />
        <LastGameCard save={save} division={division} />
        <MoneyMeter budget={club.budget} />
      </div>

      <div className="career-hub-col">
        <button onClick={onExit} style={backButtonStyle}>← Sair da carreira</button>

        <div className="career-hub-card" style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
          {logo && <img src={logo} alt={team.club} style={{ width: 48, height: 48, objectFit: 'contain' }} />}
          <div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20 }}>{team.club}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{formatCalendarDay(save.calendarDay)} · Temporada {save.season} · Série {divisionKey} · <span style={{ color: '#d4a23c', fontWeight: 700 }}>{myPos}º lugar</span></div>
          </div>
        </div>

        <TransferWindowBadge day={save.calendarDay} />

        {offerCount > 0 && (
          <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(212,162,60,0.1)', border: '1px solid rgba(212,162,60,0.3)', fontSize: 12, color: '#d4a23c', fontWeight: 600, cursor: 'pointer' }} onClick={() => onNavigate('market')}>
            📨 {offerCount} proposta{offerCount > 1 ? 's' : ''} esperando resposta — toque pra ver
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="career-nav-btn" onClick={() => onNavigate('squad')} style={navBtnStyle}>👕 Elenco</button>
          <button className="career-nav-btn" onClick={() => onNavigate('formation')} style={navBtnStyle}>🧩 Formação</button>
          <button className="career-nav-btn" onClick={() => onNavigate('market')} style={navBtnStyle}>💰 Mercado{offerCount > 0 ? ` (${offerCount})` : ''}</button>
          <button className="career-nav-btn" onClick={() => onNavigate('table')} style={navBtnStyle}>📊 Tabela</button>
          <button className="career-nav-btn" onClick={() => onNavigate('calendar')} style={navBtnStyle}>📅 Calendário</button>
          <button className="career-nav-btn" onClick={() => onNavigate('copa')} style={navBtnStyle}>🏆 Copa do Brasil</button>
          <button className="career-nav-btn" onClick={() => onNavigate('youth')} style={{ ...navBtnStyle, gridColumn: '1 / -1' }}>🌱 Categoria de Base{academyCount > 0 ? ` (${academyCount})` : ''}</button>
        </div>

        <button className="career-advance-btn" onClick={onAdvanceDay} disabled={offerCount > 0} style={{
          width: '100%', padding: '16px 0', borderRadius: 12, border: 'none', cursor: offerCount > 0 ? 'default' : 'pointer',
          background: offerCount > 0 ? 'rgba(212,162,60,0.3)' : 'linear-gradient(180deg, #e3b85a, #d4a23c)',
          color: '#0B1A12', fontSize: 16, fontWeight: 800, letterSpacing: 0.3,
          boxShadow: offerCount > 0 ? 'none' : '0 0 0 1px rgba(212,162,60,0.35), 0 10px 26px rgba(212,162,60,0.3), 0 2px 6px rgba(0,0,0,0.25)',
        }}>
          {offerCount > 0 ? 'Responda as propostas primeiro' : seasonOver ? 'Encerrar temporada →' : 'Avançar →'}
        </button>
        {!seasonOver && (
          <button className="career-simulate-btn" onClick={onSimulateSeason} disabled={offerCount > 0} style={{
            width: '100%', padding: '11px 0', borderRadius: 10, cursor: offerCount > 0 ? 'default' : 'pointer',
            border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(244,241,234,0.7)', fontSize: 12.5, fontWeight: 600,
          }}>
            ⏩ Simular temporada até o fim
          </button>
        )}
      </div>

      <div className="career-hub-col">
        <NovidadesCard dayEvents={dayEvents} />
        <TopTransfersCard save={save} />
      </div>
    </div>
  );
}

const navBtnStyle = {
  padding: '14px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.03)', color: '#F4F1EA', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
