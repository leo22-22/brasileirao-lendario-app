// Painel principal do Modo Carreira — pedido explícito do usuário
// (2026-11-06): layout de 3 colunas estilo Football Manager/EA FC, seguindo
// um mockup HTML/Tailwind completo que o usuário colou como referência.
// Reproduzido aqui com o mesmo padrão inline-style/<style> que o resto do
// Modo Carreira já usa (sem Tailwind — não existe em nenhum outro lugar do
// app) e, principalmente, só com dados REAIS: nada de clima/estádio/folha
// salarial do mockup (o motor não tem nenhum desses conceitos) — qualquer
// número aqui vem de algo que o save realmente guarda (força de elenco por
// OVR médio, valor de mercado somado, retrospecto real das últimas 3
// rodadas, etc.).
import { Icon, Alert } from '../../ui/index.jsx';
import { useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { formatCalendarDay } from '../engine/calendar.js';
import { computePlayerValue } from '../engine/pricing.js';
import { COPA_ROUND_LABELS } from '../engine/copaEngine.js';
import { clubForm, teamForSim } from '../engine/simHelpers.js';
import { matchOutcomeProbabilities } from '../../App.jsx';
import { TransferWindowBadge } from '../components/TransferWindowBadge.jsx';
import { isTransferWindowOpen } from '../engine/calendar.js';
import { backButtonStyle } from '../components/styles.js';
import { MatchPreviewModal } from '../components/MatchPreviewModal.jsx';
import { displayName } from '../../lib/displayName.js';

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

// Tag curta por tipo de evento, pro card de notícias da direita (mesma
// ideia do mockup — "Mercado"/"Bastidores" — só que derivada do tipo real
// do evento, não inventada).
const EVENT_TAG = {
  match: { text: 'Partida', color: 'var(--success)' },
  'transfer-ai': { text: 'Mercado', color: 'var(--gold-ink)' },
  offer: { text: 'Proposta', color: 'var(--info)' },
  'copa-round': { text: 'Copa do Brasil', color: 'var(--gold-ink)' },
};

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

// Valor de mercado somado do elenco profissional (fora da base) — mesma
// fonte de preço que o Mercado usa (computePlayerValue).
function squadValueTotal(save, clubId) {
  return save.clubs[clubId].roster.filter(p => !p.inAcademy).reduce((s, p) => s + computePlayerValue(p, clubId), 0);
}

function financialHealth(budget) {
  if (budget >= 100_000_000) return { text: 'Saúde ótima', color: 'var(--success)' };
  if (budget >= 30_000_000) return { text: 'Saudável', color: 'var(--gold-ink)' };
  if (budget >= 5_000_000) return { text: 'Apertado', color: 'var(--warning-ink)' };
  return { text: 'Crítico', color: 'var(--danger)' };
}

// Texto de zona na tabela pro cabeçalho do clube — G4/rebaixamento pra
// Série A, acesso/playoff/rebaixamento pra Série B (mesmas faixas que
// CareerTableScreen.jsx usa, resumidas aqui só como um aviso contextual).
function zoneStatus(divisionKey, pos, total) {
  if (pos > total - 4) return { text: 'Zona de rebaixamento', color: 'var(--danger)' };
  if (divisionKey === 'A' && pos <= 4) return { text: 'G4 — Libertadores', color: 'var(--success)' };
  if (divisionKey === 'B' && pos <= 2) return { text: 'Zona de acesso direto', color: 'var(--success)' };
  if (divisionKey === 'B' && pos <= 6) return { text: 'Zona de playoff', color: 'var(--gold-ink)' };
  return null;
}

// Vidro fosco (glassmorphism) — pedido explícito do usuário (2026-11-06,
// com briefings de design colados, o mais recente um mockup HTML/Tailwind
// completo): fundo semi-transparente + blur + borda sutil + sombra.
// `backdropFilter` cai graciosamente pra um fundo um pouco mais opaco em
// navegadores sem suporte (nenhuma quebra visual, só perde o blur).
const cardStyle = {
  padding: '16px', borderRadius: 16,
  background: 'var(--surface)',
  border: '1px solid var(--line)', boxShadow: 'var(--shadow-sm)', borderRadius: 20,
};
const cardLabelStyle = { fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, fontFamily: 'var(--font-mono)' };
const RESULT_COLORS = { V: '#1F7A4D', D: '#B23B3B', E: '#CFC6B1' };

function TeamCrest({ teamId, size }) {
  const team = TEAMS.find(t => t.id === teamId);
  const logo = team && CLUB_LOGOS[team.club];
  return logo
    ? <img src={logo} alt={displayName(team.club)} style={{ width: size, height: size, objectFit: 'contain' }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface-2)' }} />;
}

function FormDots({ form }) {
  if (!form.length) return <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>sem jogos</span>;
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {form.map((r, i) => (
        <span key={i} style={{
          width: 14, height: 14, borderRadius: 4, fontSize: 8.5, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: RESULT_COLORS[r], color: r === 'E' ? 'var(--ink)' : '#fff',
        }}>{r}</span>
      ))}
    </div>
  );
}

function NextMatchCard({ save, division, seasonOver, nextMatch, onOpenPreview }) {
  // Chance de vitória/empate real (pedido explícito do usuário 2026-11-13:
  // "tem que aparecer a chance de vitoria empate tire isso de força que nao
  // ta fazendo muito sentido") — mesma fórmula da simulação de verdade
  // (matchOutcomeProbabilities, App.jsx) que a prévia do confronto
  // (MatchPreviewModal) já usa, em vez da força bruta de elenco sem moral/
  // fator casa que só dava uma ideia vaga de "difícil ou fácil".
  const odds = nextMatch ? matchOutcomeProbabilities(teamForSim(save, nextMatch.homeId), teamForSim(save, nextMatch.awayId)) : null;
  const homeWinPct = odds ? Math.round(odds.homeWin * 100) : 0;
  const drawPct = odds ? Math.round(odds.draw * 100) : 0;
  const awayWinPct = odds ? Math.max(0, 100 - homeWinPct - drawPct) : 0;
  // Clicável (pedido explícito do usuário 2026-11-12) — abre a prévia do
  // confronto (MatchPreviewModal): força de cada lado já com moral, time
  // titular previsto, posição na tabela e últimos 5 jogos.
  const clickable = !seasonOver && !!nextMatch;
  return (
    <div
      className="career-hub-card"
      onClick={clickable ? () => onOpenPreview(nextMatch) : undefined}
      title={clickable ? 'Ver prévia do confronto' : undefined}
      style={{ ...cardStyle, position: 'relative', overflow: 'hidden', borderLeft: '3px solid var(--gold)', cursor: clickable ? 'pointer' : 'default' }}
    >
      <div style={{ ...cardLabelStyle, textAlign: 'center', marginBottom: 12, color: 'var(--gold-ink)', opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        ⚽ Próximo jogo
        {clickable && <span style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'none', fontWeight: 600, letterSpacing: 0 }}>· toque pra ver prévia</span>}
      </div>
      {seasonOver ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', textAlign: 'center', padding: '10px 0' }}>Temporada {save.season} terminada.</div>
      ) : nextMatch ? (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 14, position: 'relative' }}>
            <div style={{
              position: 'absolute', left: '50%', top: '32%', transform: 'translate(-50%,-50%)',
              width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle, rgba(194,154,69,0.16), transparent 70%)', pointerEvents: 'none',
            }} />
            <div style={{ textAlign: 'center', flex: 1, minWidth: 0, position: 'relative' }}>
              <TeamCrest teamId={nextMatch.homeId} size={56} />
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{TEAMS.find(t => t.id === nextMatch.homeId)?.club}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>{nextMatch.homeId === save.myClubId ? 'Seu time' : 'Casa'}</div>
              <FormDots form={clubForm(division, nextMatch.homeId)} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, flexShrink: 0, position: 'relative', marginTop: 20 }}>×</div>
            <div style={{ textAlign: 'center', flex: 1, minWidth: 0, position: 'relative' }}>
              <TeamCrest teamId={nextMatch.awayId} size={56} />
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{TEAMS.find(t => t.id === nextMatch.awayId)?.club}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>{nextMatch.awayId === save.myClubId ? 'Seu time' : 'Fora'}</div>
              <FormDots form={clubForm(division, nextMatch.awayId)} />
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', margin: '12px 0 10px', fontFamily: 'var(--font-mono)' }}>Rodada {division.round + 1} · {formatCalendarDay(save.seasonCalendar[division.round])}</div>
          <div style={{ paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, fontWeight: 600, opacity: 0.8, marginBottom: 4 }}>
              <span style={{ color: 'var(--ink)' }}>Vitória {homeWinPct}%</span>
              <span style={{ opacity: 0.6 }}>Empate {drawPct}%</span>
              <span style={{ color: 'var(--gold-ink)' }}>Vitória {awayWinPct}%</span>
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${homeWinPct}%`, background: 'var(--line-strong)' }} />
              <div style={{ width: `${drawPct}%`, background: 'var(--surface-2)' }} />
              <div style={{ width: `${awayWinPct}%`, background: 'linear-gradient(90deg, var(--gold), var(--gold))' }} />
            </div>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>Sem jogo seu nesta rodada.</div>
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
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 800, color: RESULT_COLORS[last.res], flexShrink: 0, padding: '0 8px' }}>
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

// Medidor visual do orçamento (semicírculo, teto de referência R$250M — só
// pra escala visual, satura em 100% acima disso) + status de saúde
// financeira + valor total do elenco (dado real, computePlayerValue).
function MoneyMeter({ save }) {
  const budget = save.clubs[save.myClubId].budget;
  const health = financialHealth(budget);
  const squadValue = squadValueTotal(save, save.myClubId);
  const REF_MAX = 250_000_000;
  const pct = Math.max(0, Math.min(1, budget / REF_MAX));
  const r = 60, cx = 90, cy = 72;
  const circ = Math.PI * r;
  return (
    <div className="career-hub-card" style={cardStyle}>
      <div style={{ ...cardLabelStyle, textAlign: 'center' }}>Orçamento</div>
      <svg width="100%" height="84" viewBox="0 0 180 84" style={{ display: 'block', marginTop: 4 }}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--muted)" strokeWidth={12} strokeLinecap="round" />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="var(--gold-ink)" strokeWidth={12} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
        <text x={cx} y={cy - 16} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--gold-ink)" fontFamily='var(--font-mono)'>{formatMoneyShort(budget)}</text>
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="9" fontWeight="700" fill={health.color}>{health.text}</text>
      </svg>
      <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)', textAlign: 'center' }}>
        <div style={{ fontSize: 9.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Valor do elenco</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{formatMoneyShort(squadValue)}</div>
      </div>
    </div>
  );
}

function NovidadesCard({ dayEventsRich }) {
  return (
    <div className="career-hub-card" style={cardStyle}>
      <div style={cardLabelStyle}>📰 O que aconteceu</div>
      {dayEventsRich.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Nada de novo por enquanto.</div>
      ) : (
        <div style={{ marginTop: 8, display: 'grid', gap: 7 }}>
          {dayEventsRich.map((ev, i) => {
            const tag = EVENT_TAG[ev.type] || { text: 'Novidade', color: 'var(--gold-ink)' };
            return (
              <div key={i} style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, marginBottom: 4 }}>
                  <span style={{ color: tag.color, fontWeight: 700 }}>{tag.text}</span>
                  <span style={{ opacity: 0.45, fontFamily: 'var(--font-mono)' }}>{formatCalendarDay(ev.day)}</span>
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.4, margin: 0 }}>{ev.text}</p>
              </div>
            );
          })}
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
  const seasonLog = (save.transferLog || []).filter(e => e.season === save.season && e.amount > 0);
  const top = [...seasonLog].sort((a, b) => b.amount - a.amount).slice(0, 5);
  return (
    <div className="career-hub-card" style={cardStyle}>
      <div style={cardLabelStyle}>🔥 Top transferências na liga</div>
      {top.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Nenhuma negociação ainda nesta temporada.</div>
      ) : (
        <div style={{ marginTop: 8, display: 'grid', gap: 7 }}>
          {top.map((t, i) => {
            const fromTeam = TEAMS.find(x => x.id === t.fromClubId);
            const toTeam = TEAMS.find(x => x.id === t.toClubId);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, background: 'var(--surface)' }}>
                <TeamCrest teamId={t.toClubId} size={22} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.playerName}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(fromTeam?.club)} ➔ {displayName(toTeam?.club)}</div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gold-ink)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{formatMoneyShort(t.amount)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Tabela rápida — topo 2 + a linha do usuário destacada (igual o mockup).
// Reaproveita `division.table`, já ordenado por posição (mesma fonte que
// CareerTableScreen.jsx usa).
function MiniTableCard({ division, divisionKey, myClubId, myPos }) {
  const table = division.table;
  const rows = new Map();
  table.slice(0, 2).forEach((r, i) => rows.set(r.id, i + 1));
  rows.set(myClubId, myPos);
  const sortedRows = [...rows.entries()].sort((a, b) => a[1] - b[1]);
  return (
    <div className="career-hub-card" style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={cardLabelStyle}>📊 Tabela rápida</div>
        <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>Série {divisionKey} · R{division.round}/{division.fixtures.length}</span>
      </div>
      <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
        {sortedRows.map(([clubId, pos]) => {
          const row = table.find(r => r.id === clubId);
          const team = TEAMS.find(t => t.id === clubId);
          const mine = clubId === myClubId;
          return (
            <div key={clubId} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8,
              background: mine ? 'rgba(194,154,69,0.12)' : 'transparent',
              borderLeft: mine ? '2px solid var(--gold)' : '2px solid transparent',
            }}>
              <span style={{ width: 16, fontSize: 11, fontWeight: 800, color: mine ? 'var(--gold-ink)' : 'var(--success)', fontFamily: 'var(--font-mono)' }}>{pos}</span>
              <TeamCrest teamId={clubId} size={16} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: mine ? 700 : 500, color: mine ? 'var(--gold-ink)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(team?.club)}</span>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{row?.pj ?? 0}J</span>
              <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)', color: mine ? 'var(--gold-ink)' : 'var(--ink)' }}>{row?.pts ?? 0}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NavButton({ icon, label, sub, onClick, accent, style }) {
  return (
    <button className="career-nav-btn" onClick={onClick} style={{ ...navBtnStyle, ...style }}>
      <span style={{
        width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 10, background: accent ? 'var(--gold-soft)' : 'var(--surface-2)', color: accent ? 'var(--gold-ink)' : 'var(--green)',
      }}><Icon name={icon} size={20} /></span>
      <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 16 }}>{label}</span>
      <span style={{ fontSize: 12, marginTop: 2, color: accent ? 'var(--gold-ink)' : 'var(--muted)', fontWeight: accent ? 600 : 400 }}>{sub}</span>
    </button>
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
  // Pedido explícito do usuário (2026-11-12): não deixar iniciar uma
  // partida sem formação definida, nem com jogador suspenso na escalação
  // (ver applyUserDiscipline em seasonEngine.js) — bloqueia os dois
  // botões de avanço, igual já acontecia com proposta pendente.
  const noFormation = !save.myStarters?.length;
  const suspendedStarters = noFormation ? [] : save.myStarters.filter(name => (save.suspensions?.[name] || 0) > 0);
  const hasSuspendedStarter = suspendedStarters.length > 0;
  const advanceBlocked = offerCount > 0 || noFormation || hasSuspendedStarter;
  const [preview, setPreview] = useState(null); // null | { homeId, awayId }
  const dayEventsRich = (save.lastDayEvents || [])
    .map(ev => ({ type: ev.type, day: ev.day, text: eventLine(ev, save.myClubId) }))
    .filter(e => e.text);
  const academyCount = club.roster.filter(p => p.inAcademy).length;
  const windowOpen = isTransferWindowOpen(save.calendarDay);
  const zone = zoneStatus(divisionKey, myPos, division.table.length);
  const rosterCount = club.roster.filter(p => !p.inAcademy).length;
  const copaStatus = !save.copa ? null
    : save.copa.phase === 'done' ? (save.copa.champion === save.myClubId ? 'Campeão!' : 'Encerrada')
    : COPA_ROUND_LABELS[save.copa.round];

  return (
    <div className="career-hub-grid">
      <style>{`
        /* Largura cheia (pedido explícito do usuário, 2026-11-06, reforçado
           duas vezes: um teto de 1800px ainda deixava faixa preta visível
           em monitor mais largo) — SEM teto de largura nenhum agora, só
           98% da tela (igual pedido: "w-full max-w-[98%]"). Colunas
           PROPORCIONAIS (1fr/2fr/1fr, equivalente a col-span-3/6/3 de um
           grid de 12) com piso mínimo (minmax) só pra não esmagar o
           conteúdo em telas médias. */
        .career-hub-grid { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(420px, 2fr) minmax(260px, 1fr); gap: 18px; width: 98%; max-width: none; margin: 0 auto; padding: 24px 12px; box-sizing: border-box; }
        .career-hub-col { display: grid; gap: 10px; align-content: start; min-width: 0; }
        .career-hub-card { transition: border-color 0.18s ease, transform 0.18s ease; }
        .career-hub-card:hover { border-color: var(--line-strong); }
        .career-nav-btn { transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease; }
        .career-nav-btn:hover { background: var(--surface); border-color: var(--gold); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
        .career-advance-btn { transition: filter 0.15s ease, transform 0.15s ease; }
        .career-advance-btn:not(:disabled):hover { filter: brightness(1.12); transform: translateY(-1px); box-shadow: var(--shadow); }
        .career-simulate-btn:not(:disabled):hover { background: var(--surface-2); border-color: var(--line-strong); }
        @media (max-width: 1100px) {
          .career-hub-grid { grid-template-columns: 1fr 1fr; }
          .career-hub-col:first-child { grid-column: 1; }
          .career-hub-col:nth-child(2) { grid-column: 1 / -1; order: -1; }
          .career-hub-col:last-child { grid-column: 2; }
        }
        @media (max-width: 760px) {
          .career-hub-grid { grid-template-columns: 1fr; max-width: 560px; }
          .career-hub-col:first-child, .career-hub-col:nth-child(2), .career-hub-col:last-child { grid-column: 1; order: initial; }
        }
      `}</style>

      <div className="career-hub-col">
        <NextMatchCard save={save} division={division} seasonOver={seasonOver} nextMatch={nextMatch} onOpenPreview={setPreview} />
        <LastGameCard save={save} division={division} />
        <MoneyMeter save={save} />
      </div>

      {preview && (
        <MatchPreviewModal save={save} division={division} homeId={preview.homeId} awayId={preview.awayId} onClose={() => setPreview(null)} />
      )}

      <div className="career-hub-col">
        <button onClick={onExit} style={{ ...backButtonStyle, marginBottom: 0, justifySelf: 'start' }}><Icon name="arrowLeft" size={15} /> Sair da carreira</button>

        <div className="career-hub-card" style={{ ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {logo && <img src={logo} alt={displayName(team.club)} style={{ width: 52, height: 52, objectFit: 'contain' }} />}
              <span style={{
                position: 'absolute', bottom: -4, right: -8, minWidth: 22, height: 20, padding: '0 4px', borderRadius: 999,
                background: 'var(--green)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--surface)', fontFamily: 'var(--font-mono)',
              }}>{myPos}º</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {displayName(team.club)}
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--gold-ink)', background: 'rgba(194,154,69,0.12)', border: '1px solid var(--gold)', borderRadius: 999, padding: '2px 7px' }}>Série {divisionKey}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                {formatCalendarDay(save.calendarDay)} · Temporada {save.season}
                {zone && <span style={{ color: zone.color, fontWeight: 700 }}> · {zone.text}</span>}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <TransferWindowBadge day={save.calendarDay} style={{ width: '100%', boxSizing: 'border-box' }} />
          </div>
          {windowOpen && (
            <button onClick={() => onNavigate('market')} style={{ marginTop: 6, width: '100%', background: 'none', border: 'none', color: 'var(--gold-ink)', fontSize: 11, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', textAlign: 'right' }}>
              Explorar Mercado →
            </button>
          )}
        </div>

        {offerCount > 0 && (
          <Alert tone="info" icon="chat" onClick={() => onNavigate('market')}>
            <b>{offerCount} proposta{offerCount > 1 ? 's' : ''}</b> esperando resposta — toque pra ver
          </Alert>
        )}
        {offerCount === 0 && noFormation && (
          <Alert tone="warning" icon="formation" onClick={() => onNavigate('formation')}>
            <b>Defina sua formação</b> antes de jogar — toque pra escalar
          </Alert>
        )}
        {offerCount === 0 && !noFormation && hasSuspendedStarter && (
          <Alert tone="danger" onClick={() => onNavigate('formation')}>
            <b>{suspendedStarters.join(', ')}</b> suspenso{suspendedStarters.length > 1 ? 's' : ''} — ajuste a formação antes de jogar
          </Alert>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <NavButton icon="shirt" label="Elenco" sub={`${rosterCount} jogadores`} onClick={() => onNavigate('squad')} />
          <NavButton icon="formation" label="Formação" sub={save.myFormationLabel || 'Não definida'} onClick={() => onNavigate('formation')} />
          <NavButton icon="market" label="Mercado" sub={windowOpen ? 'Janela aberta' : 'Janela fechada'} accent={offerCount > 0 || windowOpen} onClick={() => onNavigate('market')} />
          <NavButton icon="table" label="Tabela" sub={`${myPos}º lugar`} onClick={() => onNavigate('table')} />
          <NavButton icon="calendar" label="Calendário" sub={`${division.fixtures.length} rodadas`} onClick={() => onNavigate('calendar')} />
          <NavButton icon="cup" label="Copa do Brasil" sub={copaStatus} accent={save.copa?.phase === 'done' && save.copa.champion === save.myClubId} onClick={() => onNavigate('copa')} />
        </div>

        <button className="career-nav-btn" onClick={() => onNavigate('youth')} style={{
          width: '100%', padding: '0 16px', minHeight: 52, borderRadius: 16, border: '1px solid var(--line)',
          background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-body)',
        }}>
          <span style={{ color: 'var(--green)', display: 'flex' }}><Icon name="sprout" size={20} /></span>
          <span style={{ fontSize: 14, fontWeight: 600, flex: 1, textAlign: 'left' }}>Categoria de base</span>
          {academyCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', background: 'rgba(31,122,77,0.12)', border: '1px solid rgba(31,122,77,0.4)', borderRadius: 999, padding: '2px 8px' }}>{academyCount} promessa{academyCount > 1 ? 's' : ''}</span>}
        </button>

        <div style={{ paddingTop: 4 }}>
          <button className="career-advance-btn" onClick={onAdvanceDay} disabled={advanceBlocked} style={{
            width: '100%', minHeight: 56, padding: '0 20px', borderRadius: 999, border: advanceBlocked ? '1px dashed var(--line-strong)' : 'none', cursor: advanceBlocked ? 'not-allowed' : 'pointer',
            background: advanceBlocked ? 'var(--surface-2)' : 'var(--green)',
            color: advanceBlocked ? 'var(--muted)' : '#fff', fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-body)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            {advanceBlocked ? <Icon name="lock" size={17} /> : seasonOver ? null : <Icon name="play" size={15} />}
            {offerCount > 0 ? 'Responda as propostas primeiro' : noFormation ? 'Defina a formação primeiro' : hasSuspendedStarter ? 'Tire o suspenso da escalação' : seasonOver ? 'Encerrar temporada →' : 'Avançar rodada'}
          </button>
        </div>
        {!seasonOver && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="career-simulate-btn" onClick={onSimulateSeason} disabled={advanceBlocked} style={{
              minHeight: 44, padding: '0 20px', borderRadius: 999, cursor: advanceBlocked ? 'not-allowed' : 'pointer',
              border: '1px solid var(--line-strong)', background: 'transparent', color: advanceBlocked ? 'var(--muted)' : 'var(--ink-2)', fontSize: 13, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', opacity: advanceBlocked ? 0.6 : 1,
            }}>
              <Icon name="forward" size={15} /> Simular temporada até o fim
            </button>
          </div>
        )}
      </div>

      <div className="career-hub-col">
        <NovidadesCard dayEventsRich={dayEventsRich} />
        <TopTransfersCard save={save} />
        <MiniTableCard division={division} divisionKey={divisionKey} myClubId={save.myClubId} myPos={myPos} />
      </div>
    </div>
  );
}

const navBtnStyle = {
  padding: '16px 14px', borderRadius: 18, border: '1px solid var(--line)',
  background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', minHeight: 112,
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', fontFamily: 'var(--font-body)',
};
