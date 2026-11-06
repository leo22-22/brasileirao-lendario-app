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

const cardStyle = { padding: '14px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' };
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
    <div style={cardStyle}>
      <div style={{ ...cardLabelStyle, textAlign: 'center', marginBottom: 10 }}>Próximo jogo</div>
      {seasonOver ? (
        <div style={{ fontSize: 12.5, opacity: 0.7, textAlign: 'center', padding: '10px 0' }}>Temporada {save.season} terminada.</div>
      ) : nextMatch ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
              <TeamCrest teamId={nextMatch.homeId} size={52} />
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{TEAMS.find(t => t.id === nextMatch.homeId)?.club}</div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.4, fontWeight: 700, flexShrink: 0 }}>×</div>
            <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
              <TeamCrest teamId={nextMatch.awayId} size={52} />
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{TEAMS.find(t => t.id === nextMatch.awayId)?.club}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, opacity: 0.55, marginTop: 10 }}>Rodada {division.round + 1} · {formatCalendarDay(save.seasonCalendar[division.round])}</div>
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
    <div style={cardStyle}>
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
    <div style={cardStyle}>
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
    <div style={cardStyle}>
      <div style={cardLabelStyle}>O que aconteceu</div>
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
    <div style={cardStyle}>
      <div style={cardLabelStyle}>Top transferências na liga</div>
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

  return (
    <div className="career-hub-grid">
      <style>{`
        .career-hub-grid { display: grid; grid-template-columns: 240px minmax(0, 560px) 240px; gap: 16px; justify-content: center; max-width: 1080px; margin: 0 auto; padding: 24px 16px; }
        .career-hub-col { display: grid; gap: 12px; align-content: start; }
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logo && <img src={logo} alt={team.club} style={{ width: 48, height: 48, objectFit: 'contain' }} />}
          <div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20 }}>{team.club}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{formatCalendarDay(save.calendarDay)} · Temporada {save.season} · Série {divisionKey} · {myPos}º lugar</div>
          </div>
        </div>

        <TransferWindowBadge day={save.calendarDay} />

        {offerCount > 0 && (
          <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(212,162,60,0.1)', border: '1px solid rgba(212,162,60,0.3)', fontSize: 12, color: '#d4a23c', fontWeight: 600, cursor: 'pointer' }} onClick={() => onNavigate('market')}>
            📨 {offerCount} proposta{offerCount > 1 ? 's' : ''} esperando resposta — toque pra ver
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => onNavigate('squad')} style={navBtnStyle}>👕 Elenco</button>
          <button onClick={() => onNavigate('formation')} style={navBtnStyle}>🧩 Formação</button>
          <button onClick={() => onNavigate('market')} style={navBtnStyle}>💰 Mercado{offerCount > 0 ? ` (${offerCount})` : ''}</button>
          <button onClick={() => onNavigate('table')} style={navBtnStyle}>📊 Tabela</button>
          <button onClick={() => onNavigate('calendar')} style={navBtnStyle}>📅 Calendário</button>
          <button onClick={() => onNavigate('copa')} style={navBtnStyle}>🏆 Copa do Brasil</button>
        </div>

        <button onClick={onAdvanceDay} disabled={offerCount > 0} style={{
          width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', cursor: offerCount > 0 ? 'default' : 'pointer',
          background: offerCount > 0 ? 'rgba(212,162,60,0.3)' : '#d4a23c', color: '#0B1A12', fontSize: 15, fontWeight: 700,
        }}>
          {offerCount > 0 ? 'Responda as propostas primeiro' : seasonOver ? 'Encerrar temporada →' : 'Avançar →'}
        </button>
        {!seasonOver && (
          <button onClick={onSimulateSeason} disabled={offerCount > 0} style={{
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
