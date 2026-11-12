// Visão geral do Modo Carreira — redesenho de 2026-11-13 seguindo o mockup
// modo-carreira-hub-mockup.html (fonte da verdade de espaçamento/cores).
// A navegação (Elenco, Formação, Mercado...) saiu do meio da tela e virou o
// menu lateral (components/CareerShell.jsx). Tudo aqui é DERIVADO do save
// (ver engine/careerMeta.js) — nada de dado inventado.
import { useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { CLUB_STADIUMS } from '../../data/info-content.js';
import { careerClubTier } from '../../data/career-clubs.js';
import { computePlayerValue } from '../engine/pricing.js';
import { clubForm, teamForSim } from '../engine/simHelpers.js';
import { matchOutcomeProbabilities } from '../../App.jsx';
import { MatchPreviewModal } from '../components/MatchPreviewModal.jsx';
import { displayName } from '../../lib/displayName.js';
import { readableOn } from '../../lib/color.js';
import { Icon, TeamBadge } from '../../ui/index.jsx';
import {
  myDivision, computeBoard, moraleFrom, upcomingFixtures, assistantInsight, squadAlerts,
  tableSlice, transferWindowText, dayParts,
} from '../engine/careerMeta.js';
import '../components/careerShell.css';

function formatMoney(n) {
  return 'R$ ' + n.toLocaleString('pt-BR');
}

export function formatMoneyShort(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000_000) return `${sign}R$ ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}B`;
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(0)}K`;
  return `${sign}R$ ${abs}`;
}

// Linha de texto de um evento do dia — usada pela animação de avanço do
// calendário (CareerAdvanceModal, via CareerApp).
export function eventLine(ev, myClubId) {
  if (ev.type === 'match') {
    const isHome = ev.homeId === myClubId;
    const oppId = isHome ? ev.awayId : ev.homeId;
    const oppTeam = TEAMS.find(t => t.id === oppId);
    const myTeam = TEAMS.find(t => t.id === myClubId);
    const myGoals = isHome ? ev.homeGoals : ev.awayGoals;
    const oppGoals = isHome ? ev.awayGoals : ev.homeGoals;
    const result = myGoals > oppGoals ? '🟢' : myGoals < oppGoals ? '🔴' : '🟡';
    return `${result} ${displayName(myTeam?.club || '')} ${myGoals} x ${oppGoals} ${displayName(oppTeam?.club || '')}`;
  }
  if (ev.type === 'transfer-ai') {
    const from = TEAMS.find(t => t.id === ev.fromClubId);
    const to = TEAMS.find(t => t.id === ev.toClubId);
    return `🔄 ${displayName(from?.club)} comprou ${ev.playerName} do ${displayName(to?.club)} por ${formatMoney(ev.amount)}`;
  }
  if (ev.type === 'offer') {
    return ev.offerKind === 'loan'
      ? `🔁 Proposta de empréstimo recebida pelo ${ev.playerName}`
      : `📨 Proposta recebida pelo ${ev.playerName}`;
  }
  if (ev.type === 'copa-round') {
    return `🏆 Copa do Brasil — ${ev.roundLabel} resolvida`;
  }
  return null;
}

const clubOf = (id) => TEAMS.find(t => t.id === id);
const TIER_TEXT = { elite: 'Clube de elite', grande: 'Clube grande', medio: 'Clube médio', pequeno: 'Clube pequeno' };
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// O calendário do motor é o de 2026 (temporada 1); cada temporada nova
// recomeça em 1º de janeiro do ano seguinte.
function weekdayOf(season, day) {
  const d = new Date(Date.UTC(2025 + season, 0, 1));
  d.setUTCDate(d.getUTCDate() + day - 1);
  return WEEKDAYS[d.getUTCDay()];
}
function longDate(season, day) {
  const { d } = dayParts(day);
  let r = day; let m = 0;
  const L = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  while (m < 11 && r > L[m]) { r -= L[m]; m++; }
  return `${weekdayOf(season, day)}, ${d} de ${MONTHS_FULL[m]}`;
}

function Crest({ clubId, size = 40, ring = false }) {
  const team = clubOf(clubId);
  const badge = <TeamBadge src={CLUB_LOGOS[team?.club]} name={team?.club || ''} color={team?.colors?.p || '#0D3A29'} size={ring ? Math.round(size * 0.66) : size} radius={ring ? 6 : Math.round(size / 2)} />;
  if (!ring) return badge;
  return <span className="ch-crest-ring" style={{ width: size, height: size }}>{badge}</span>;
}

function FormBadges({ form }) {
  if (!form.length) return <span style={{ fontSize: 12, color: '#B6CBBF' }}>sem jogos</span>;
  return (
    <div className="ch-form" aria-label={`Últimos resultados: ${form.join(' ')}`}>
      {[...form].reverse().map((r, i) => <i key={i} className={r === 'V' ? 'ch-fv' : r === 'D' ? 'ch-fd' : 'ch-fe'}>{r}</i>)}
    </div>
  );
}

function Sparkline({ points, color = 'var(--success)', height = 28 }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const W = 200;
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (points.length - 1)) * W).toFixed(1)} ${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, marginTop: 8, display: 'block' }} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function financialHealth(budget) {
  if (budget >= 100_000_000) return { text: 'Saúde ótima', color: 'var(--success)' };
  if (budget >= 30_000_000) return { text: 'Saudável', color: 'var(--success)' };
  if (budget >= 5_000_000) return { text: 'Apertado', color: 'var(--warning-ink)' };
  return { text: 'Crítico', color: 'var(--danger)' };
}
export { financialHealth };

const TONE_COLOR = { success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)', muted: 'var(--muted)', info: 'var(--info)' };
const ALERT_STYLE = {
  danger: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning-ink)' },
  info: { bg: 'var(--info-soft)', fg: 'var(--info)' },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)' },
};

const INBOX_FILTERS = [
  { id: 'all', label: 'Tudo' },
  { id: 'diretoria', label: 'Diretoria' },
  { id: 'mercado', label: 'Mercado' },
  { id: 'imprensa', label: 'Imprensa' },
];

export function InboxList({ save, limit, onOpenItem, filter, setFilter }) {
  const all = save.inbox || [];
  const list = all.filter(m => filter === 'all' || m.cat === filter);
  const shown = limit ? list.slice(0, limit) : list;
  return (
    <>
      <div className="ch-chips" role="tablist" aria-label="Filtrar caixa de entrada">
        {INBOX_FILTERS.map(f => {
          const unread = all.filter(m => !m.read && (f.id === 'all' || m.cat === f.id)).length;
          return (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={`ch-chip${filter === f.id ? ' ch-on' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}{unread > 0 && f.id !== 'all' ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{unread}</span> : null}
            </button>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <div className="ch-empty">Nada por aqui ainda. As mensagens chegam conforme a temporada anda.</div>
      ) : shown.map(m => (
        <button key={m.id} type="button" className="ch-al" onClick={() => onOpenItem(m)}>
          {m.read ? <span style={{ width: 8, flexShrink: 0 }} /> : <i className="ch-unread" aria-label="não lida" />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <b style={{ fontWeight: m.read ? 500 : 600 }}>{m.title}</b>
            <p>{m.text} · {dayParts(m.day).d} {dayParts(m.day).m}{m.season !== save.season ? ` · temp. ${m.season}` : ''}</p>
          </div>
          <span className="ch-act" style={{ color: 'var(--muted)', fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{m.cat}</span>
        </button>
      ))}
    </>
  );
}

export function CareerHub({ save, onNavigate, onAdvanceDay, onSimulateSeason, onMarkRead }) {
  const team = clubOf(save.myClubId);
  const club = save.clubs[save.myClubId];
  const { key: divisionKey, data: division } = myDivision(save);
  const n = division.table.length;
  const myIdx = division.table.findIndex(r => r.id === save.myClubId);
  const myPos = myIdx + 1;
  const myRow = division.table[myIdx];
  const seasonOver = division.round >= division.fixtures.length;
  const offerCount = save.pendingOffers?.length || 0;
  const noFormation = !save.myStarters?.length;
  const suspendedStarters = noFormation ? [] : save.myStarters.filter(name => (save.suspensions?.[name] || 0) > 0);
  const advanceBlocked = offerCount > 0 || noFormation || suspendedStarters.length > 0;
  const [preview, setPreview] = useState(null);
  const [inboxFilter, setInboxFilter] = useState('all');

  const board = computeBoard(save);
  const myForm = clubForm(division, save.myClubId, 5);
  const morale = moraleFrom(myForm);
  const agenda = upcomingFixtures(save, 5);
  const next = agenda[0] || null;
  const tableInfo = tableSlice(save);
  const alerts = squadAlerts(save);
  const windowInfo = transferWindowText(save.calendarDay);
  const tier = careerClubTier(save.myClubId);

  // Variação de posição na rodada: compara com o registro da rodada anterior.
  const hist = (save.budgetHistory || []).filter(h => h.season === save.season);
  const prevPos = hist.length >= 2 ? hist[hist.length - 2].pos : null;
  const posDelta = prevPos && division.round > 0 ? prevPos - myPos : null;
  const balance = club.budget;
  const health = financialHealth(balance);
  const sparkPoints = hist.map(h => h.balance);
  const squadValue = club.roster.filter(p => !p.inAcademy).reduce((s, p) => s + computePlayerValue(p, save.myClubId), 0);

  // Próximo jogo: probabilidades com a mesma fórmula da simulação.
  let odds = null, homeId = null, awayId = null;
  if (next) {
    homeId = next.isHome === false ? next.oppId : save.myClubId;
    awayId = next.isHome === false ? save.myClubId : next.oppId;
    odds = matchOutcomeProbabilities(teamForSim(save, homeId), teamForSim(save, awayId));
  }
  const pHome = odds ? Math.round(odds.homeWin * 100) : 0;
  const pDraw = odds ? Math.round(odds.draw * 100) : 0;
  const pAway = odds ? Math.max(0, 100 - pHome - pDraw) : 0;
  const nextLeague = agenda.find(a => a.comp === 'Brasileirão');
  const insight = next ? assistantInsight(save, nextLeague && nextLeague.day === next.day ? nextLeague : { homeId, awayId }) : null;
  const oppDivision = (id) => (save.clubs[id]?.division === 'B' ? save.divisionB : save.divisionA);

  const stripe = `repeating-linear-gradient(180deg, ${team.colors?.p || '#0D3A29'} 0 14px, ${team.colors?.s || '#FBF9F4'} 14px 28px)`;
  const started = division.round > 0;
  const inZ4 = started && myPos > n - 4;
  const lastPlayed = (() => {
    if (division.round <= 0) return null;
    const m = (division.results?.[division.round - 1] || []).find(r => r.homeId === save.myClubId || r.awayId === save.myClubId);
    if (!m) return null;
    const isHome = m.homeId === save.myClubId;
    const my = isHome ? m.homeGoals : m.awayGoals;
    const op = isHome ? m.awayGoals : m.homeGoals;
    return { m, res: my > op ? 'V' : my < op ? 'D' : 'E', day: save.seasonCalendar[division.round - 1], round: division.round };
  })();

  const primaryLabel = offerCount > 0 ? 'Responder propostas'
    : noFormation ? 'Definir formação'
      : suspendedStarters.length ? 'Tirar suspenso da escalação'
        : seasonOver ? 'Encerrar temporada'
          : next?.comp === 'Brasileirão' ? `Jogar rodada ${next.roundIdx + 1}`
            : next ? `Avançar até a Copa` : 'Avançar';
  const primaryAction = offerCount > 0 ? () => onNavigate('market')
    : (noFormation || suspendedStarters.length) ? () => onNavigate('formation')
      : onAdvanceDay;

  const openInboxItem = (m) => {
    if (!m.read) onMarkRead([m.id]);
    if (m.action) onNavigate(m.action);
  };

  return (
    <div className="ch-main">
      {/* ── Hero do clube ── */}
      <section className="ch-card ch-hero">
        <span className="ch-hero-stripe" style={{ background: stripe }} aria-hidden="true" />
        <div className="ch-hero-id" style={{ display: 'flex', gap: 22, alignItems: 'center', minWidth: 0 }}>
          <span className="ch-hero-crest" style={{ width: 84, height: 84, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <TeamBadge src={CLUB_LOGOS[team.club]} name={team.club} color={team.colors?.p} size={84} radius={42} />
          </span>
          <div style={{ minWidth: 0 }}>
            <span className="ch-mono">Temporada {save.season} · {longDate(save.season, save.calendarDay)}</span>
            <h1>{displayName(team.club)}</h1>
            <div className="ch-hero-meta">
              <span className="ch-tag ch-t-mute">Série {divisionKey}</span>
              {division.round > 0 && (
                <span className={`ch-tag ${inZ4 ? 'ch-t-danger' : myPos <= (divisionKey === 'A' ? 6 : 2) ? 'ch-t-success' : 'ch-t-mute'}`}>
                  {myPos}º{inZ4 ? ' · Zona de rebaixamento' : divisionKey === 'A' && myPos <= 4 ? ' · G4' : divisionKey === 'B' && myPos <= 2 ? ' · Acesso direto' : ''}
                </span>
              )}
              <span className={`ch-tag ${windowInfo.open ? 'ch-t-success' : 'ch-t-mute'}`}>{windowInfo.text}</span>
              <span className="ch-tag ch-t-gold">{TIER_TEXT[tier]}</span>
            </div>
          </div>
        </div>
        <div className="ch-board">
          <div className="ch-row"><span className="ch-mono">Objetivo da diretoria</span><span className={`ch-tag ch-t-${board.tone}`}>{board.status}</span></div>
          <h4>{board.text}</h4>
          <div className="ch-row ch-small" style={{ marginBottom: 8 }}><span>Confiança da diretoria</span><b style={{ color: TONE_COLOR[board.tone] }}>{board.confidence}%</b></div>
          <div className="ch-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={board.confidence} aria-label="Confiança da diretoria"><i style={{ width: `${board.confidence}%`, background: TONE_COLOR[board.tone] }} /></div>
          <div className="ch-small" style={{ marginTop: 10 }}>
            {division.round === 0 ? `${board.roundsLeft} rodadas pela frente`
              : board.ptsGap > 0 ? `Falta${board.ptsGap > 1 ? 'm' : ''} ${board.ptsGap} ponto${board.ptsGap > 1 ? 's' : ''} para ficar ${board.short} · ${board.roundsLeft} rodadas restantes`
                : board.pos <= board.target ? `Dentro da meta · ${board.roundsLeft} rodadas restantes`
                  : `Empatado em pontos com o ${board.short} · ${board.roundsLeft} rodadas restantes`}
          </div>
        </div>
      </section>

      {/* ── KPIs ── */}
      <section className="ch-kpis" aria-label="Indicadores da temporada">
        <div className="ch-card ch-kpi">
          <span className="ch-mono">Posição</span>
          <b style={{ color: inZ4 ? 'var(--danger)' : undefined }}>{started ? `${myPos}º` : '—'}</b>
          <span className={`ch-d`} style={{ color: posDelta > 0 ? 'var(--success)' : posDelta < 0 ? 'var(--danger)' : undefined }}>
            {division.round === 0 ? 'Temporada não começou' : posDelta == null ? `Série ${divisionKey}` : posDelta === 0 ? 'Mesma posição na rodada' : `${posDelta > 0 ? '▲' : '▼'} ${Math.abs(posDelta)} posiç${Math.abs(posDelta) > 1 ? 'ões' : 'ão'} na rodada`}
          </span>
        </div>
        <div className="ch-card ch-kpi">
          <span className="ch-mono">Pontos</span>
          <b>{myRow?.pts ?? 0}</b>
          <span className="ch-d">{myRow?.pj ?? 0} jogos · {myRow?.v ?? 0}V {myRow?.e ?? 0}E {myRow?.d ?? 0}D</span>
        </div>
        <div className="ch-card ch-kpi">
          <span className="ch-mono">Saldo de gols</span>
          <b>{(() => { const sg = (myRow?.gp ?? 0) - (myRow?.gc ?? 0); return sg > 0 ? `+${sg}` : sg < 0 ? `−${-sg}` : '0'; })()}</b>
          <span className="ch-d">{myRow?.gp ?? 0} marcados · {myRow?.gc ?? 0} sofridos</span>
        </div>
        <div className="ch-card ch-kpi" title={`Valor do elenco: ${formatMoneyShort(squadValue)}`}>
          <span className="ch-mono">Orçamento</span>
          <b>{formatMoneyShort(balance)}</b>
          <span className="ch-d" style={{ color: health.color }}>{health.text}</span>
          {sparkPoints.length >= 2
            ? <Sparkline points={sparkPoints} color={sparkPoints[sparkPoints.length - 1] >= sparkPoints[0] ? '#1F7A4D' : '#B23B3B'} />
            : <span className="ch-d" style={{ marginTop: 8 }}>Elenco vale {formatMoneyShort(squadValue)}</span>}
        </div>
        <div className="ch-card ch-kpi">
          <span className="ch-mono">Moral do elenco</span>
          <b>{morale.label}</b>
          <span className="ch-d">{morale.detail}</span>
          <div className="ch-bar" style={{ marginTop: 12, height: 6 }}><i style={{ width: `${Math.max(6, morale.pct)}%`, background: TONE_COLOR[morale.tone] }} /></div>
        </div>
      </section>

      {/* ── Próximo jogo + agenda ── */}
      <section className="ch-row2">
        <div className="ch-match on-dark">
          <span className="ch-ring" aria-hidden="true" />
          {seasonOver || !next ? (
            <div style={{ position: 'relative' }}>
              <span className="ch-mono">Próximo jogo</span>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, margin: '18px 0 8px' }}>{seasonOver ? `Temporada ${save.season} terminada` : 'Sem jogo marcado'}</div>
              <p style={{ color: '#B6CBBF', margin: 0 }}>{seasonOver ? 'Feche a temporada para ver o relatório e começar a próxima.' : 'Avance o calendário para seguir com a temporada.'}</p>
              <div className="ch-actions">
                <button type="button" className="ch-btn ch-btn-gold" onClick={primaryAction}>
                  <Icon name="play" size={16} />{primaryLabel}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="ch-row" style={{ position: 'relative' }}>
                <span className="ch-mono">Próximo jogo · {next.comp} · {next.detail}</span>
                <span className="ch-mono">{next.isHome === null ? 'Jogo único' : next.isHome ? 'Em casa' : 'Fora de casa'}</span>
              </div>
              <button type="button" className="ch-vs" onClick={() => setPreview({ homeId, awayId })} title="Ver prévia do confronto" style={{ background: 'none', border: 'none', color: 'inherit', width: '100%', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}>
                <div className="ch-team">
                  <Crest clubId={homeId} size={72} ring />
                  <b>{displayName(clubOf(homeId)?.club)}</b>
                  <FormBadges form={clubForm(oppDivision(homeId), homeId, 5)} />
                </div>
                <div className="ch-mid">
                  <div className="ch-when">{dayParts(next.day).d} {dayParts(next.day).m}</div>
                  <small style={{ textTransform: 'capitalize' }}>{weekdayOf(save.season, next.day)}{CLUB_STADIUMS[clubOf(homeId)?.club] ? ` · ${CLUB_STADIUMS[clubOf(homeId)?.club]}` : ''}</small>
                </div>
                <div className="ch-team">
                  <Crest clubId={awayId} size={72} ring />
                  <b>{displayName(clubOf(awayId)?.club)}</b>
                  <FormBadges form={clubForm(oppDivision(awayId), awayId, 5)} />
                </div>
              </button>
              <div className="ch-prob">
                <span>Vitória {displayName(clubOf(homeId)?.club)} {pHome}%</span>
                <span>Empate {pDraw}%</span>
                <span style={{ textAlign: 'right' }}>Vitória {displayName(clubOf(awayId)?.club)} {pAway}%</span>
              </div>
              <div className="ch-bar" role="img" aria-label={`Probabilidades: ${pHome}% mandante, ${pDraw}% empate, ${pAway}% visitante`}>
                <i style={{ width: `${pHome}%`, background: homeId === save.myClubId ? 'var(--gold)' : '#C24747' }} />
                <i style={{ width: `${pDraw}%`, background: 'rgba(255,255,255,.35)' }} />
                <i style={{ width: `${pAway}%`, background: awayId === save.myClubId ? 'var(--gold)' : '#C24747' }} />
              </div>
              {insight && (
                <div className="ch-insight">
                  <Icon name="bolt" size={18} style={{ color: 'var(--gold)', marginTop: 1 }} />
                  <div><b>Leitura do auxiliar:</b> {insight}</div>
                </div>
              )}
              <div className="ch-actions">
                <button type="button" className="ch-btn ch-btn-ghost" onClick={() => onNavigate('formation')}>
                  <Icon name="formation" size={18} />Ajustar escalação
                </button>
                <button type="button" className="ch-btn ch-btn-gold" onClick={primaryAction}>
                  <Icon name={noFormation || suspendedStarters.length ? 'formation' : offerCount ? 'chat' : 'play'} size={16} />{primaryLabel}
                </button>
              </div>
              {!seasonOver && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                  <button type="button" className="ch-sim" onClick={onSimulateSeason} disabled={advanceBlocked} title={advanceBlocked ? 'Resolva a pendência acima primeiro' : 'Simula o resto da temporada sem parar'}>
                    <Icon name="forward" size={14} />Simular temporada até o fim
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="ch-card" style={{ overflow: 'hidden' }}>
          <div className="ch-head"><h3>Agenda</h3><button type="button" className="ch-link" onClick={() => onNavigate('calendar')}>Calendário completo</button></div>
          {agenda.length === 0 && <div className="ch-empty">Nenhum jogo marcado até o fim da temporada.</div>}
          {agenda.map((a, i) => (
            <div key={`${a.comp}-${a.day}-${i}`} className="ch-fx">
              <div className="ch-dt"><b>{String(dayParts(a.day).d).padStart(2, '0')}</b><span>{dayParts(a.day).m}</span></div>
              <div className="ch-nm">
                <b>{displayName(clubOf(a.oppId)?.club)}</b> <span className="ch-small">{a.isHome === null ? 'neutro' : a.isHome ? 'casa' : 'fora'}</span>
                <small>{a.comp} · {a.detail}</small>
              </div>
              <div className="ch-dif" title={`Dificuldade ${a.difficulty} de 5`} aria-label={`Dificuldade ${a.difficulty} de 5`}>
                {[1, 2, 3, 4, 5].map(k => <i key={k} className={k <= a.difficulty ? 'ch-on' : ''} />)}
              </div>
            </div>
          ))}
          {lastPlayed && (() => {
            const isHome = lastPlayed.m.homeId === save.myClubId;
            const { d, m } = dayParts(lastPlayed.day);
            return (
              <div className="ch-fx" style={{ background: 'var(--bg)' }}>
                <div className="ch-dt"><b>{String(d).padStart(2, '0')}</b><span>{m}</span></div>
                <div className="ch-nm">
                  <b>{displayName(clubOf(lastPlayed.m.homeId)?.club)} {lastPlayed.m.homeGoals} × {lastPlayed.m.awayGoals} {displayName(clubOf(lastPlayed.m.awayId)?.club)}</b>
                  <small>Último jogo · Brasileirão · Rodada {lastPlayed.round} · {isHome ? 'em casa' : 'fora'}</small>
                </div>
                <span className={`ch-tag ${lastPlayed.res === 'V' ? 'ch-t-success' : lastPlayed.res === 'D' ? 'ch-t-danger' : 'ch-t-mute'}`}>{lastPlayed.res}</span>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── Tabela, avisos e caixa de entrada ── */}
      <section className="ch-row3">
        <div className="ch-card" style={{ overflow: 'hidden' }}>
          <div className="ch-head"><h3>Tabela</h3><button type="button" className="ch-link" onClick={() => onNavigate('table')}>Ver completa</button></div>
          <table className="ch-table">
            <tbody>
              {tableInfo.rows.map(r => r.gap ? (
                <tr key={r.key}><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '4px 0', fontFamily: 'var(--font-body)' }}>···</td></tr>
              ) : (
                <FragmentRow key={r.id} r={r} n={tableInfo.n} started={started} />
              ))}
            </tbody>
          </table>
          <div className="ch-small" style={{ padding: '12px 22px 18px', borderTop: '1px solid var(--line)' }}>{division.round === 0 ? 'A tabela começa a andar na rodada 1.' : tableInfo.sentence}</div>
        </div>

        <div className="ch-card" style={{ overflow: 'hidden' }}>
          <div className="ch-head"><h3>Avisos do elenco</h3><button type="button" className="ch-link" onClick={() => onNavigate('squad')}>Abrir elenco</button></div>
          {alerts.length === 0 && <div className="ch-empty">Nenhum aviso: elenco sem suspensos, pendurados ou pendências.</div>}
          {alerts.slice(0, 5).map((a, i) => {
            const st = ALERT_STYLE[a.tone] || ALERT_STYLE.info;
            const As = a.action ? 'button' : 'div';
            return (
              <As key={`${a.kind}-${i}`} type={a.action ? 'button' : undefined} className="ch-al" onClick={a.action ? () => onNavigate(a.action) : undefined}>
                <span className="ch-ico" style={{ background: st.bg, color: st.fg }}><Icon name={a.icon} size={18} /></span>
                <div style={{ minWidth: 0 }}><b>{a.title}</b><p>{a.text}</p></div>
                {a.action && <span className="ch-act">{a.actionLabel}</span>}
              </As>
            );
          })}
        </div>

        <div className="ch-card" style={{ overflow: 'hidden' }}>
          <div className="ch-head"><h3>Caixa de entrada</h3><button type="button" className="ch-link" onClick={() => onNavigate('inbox')}>Tudo</button></div>
          <InboxList save={save} limit={4} filter={inboxFilter} setFilter={setInboxFilter} onOpenItem={openInboxItem} />
        </div>
      </section>

      {preview && (
        <MatchPreviewModal save={save} division={division} homeId={preview.homeId} awayId={preview.awayId} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

function FragmentRow({ r, n, started }) {
  const team = clubOf(r.id);
  return (
    <>
      {started && r.pos === n - 3 && <tr className="ch-zline" aria-hidden="true"><td colSpan={4} /></tr>}
      <tr className={`${r.mine ? 'ch-me' : ''} ${started && r.z4 ? 'ch-z' : ''}`}>
        <td>{r.pos}</td>
        <td><span className="ch-cl"><TeamBadge src={CLUB_LOGOS[team?.club]} name={team?.club || ''} color={team?.colors?.p} size={20} radius={10} /><span style={{ fontWeight: r.mine ? 700 : 400 }}>{displayName(team?.club)}</span></span></td>
        <td className="ch-j">{r.pj}J</td>
        <td>{r.pts}</td>
      </tr>
    </>
  );
}

// Cor do clube como texto (contraste garantido sobre o creme).
export const clubInk = (clubId) => readableOn('#FBF9F4', clubOf(clubId)?.colors?.p || '#0D3A29');
