// Relatório de fim de temporada do Modo Carreira — último passo da
// temporada que terminou, parado aqui até o usuário clicar em avançar
// (pedido explícito do usuário, 2026-11-09: "tem um botao de ir para
// proxima temporada e o ultimo passo antes de pular de temporada, como se
// fosse para o usuario verificar como o time dele foi"). `report` vem de
// `save.lastSeasonReport` (montado em endOfSeason/finalizeSeasonAfterUserTie,
// ver seasonReport.js) — essa tela só EXIBE, não calcula nada.
import { useState } from 'react';
import { posColor, ovrColor } from '../../lib/format.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { backButtonStyle } from '../components/styles.js';
import { primaryBtnStyle } from '../components/liveMatchUI.jsx';
import { displayName } from '../../lib/displayName.js';

const cardStyle = {
  padding: '14px', borderRadius: 14,
  background: 'var(--surface)',
  border: '1px solid var(--line)',
};

const TABS = [
  { id: 'team', label: 'Resumo do time' },
  { id: 'squad', label: 'Elenco' },
  { id: 'moves', label: 'Acesso e Queda' },
];

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent || 'var(--ink)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ClubRow({ club, move }) {
  const logo = club ? CLUB_LOGOS[club.club] : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--surface)' }}>
      {logo ? <img src={logo} alt={displayName(club?.club)} style={{ width: 26, height: 26, objectFit: 'contain' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', background: club?.colors?.p || '#333' }} />}
      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{club?.club || '?'}</span>
      <span style={{ fontSize: 14 }}>{move === 'promoted' ? '↑' : '↓'}</span>
    </div>
  );
}

function PlayerRow({ p }) {
  const c = posColor(p.pos?.[0]);
  const oc = ovrColor(p.ovr);
  const isGk = p.pos?.[0] === 'GOL';
  const delta = p.delta;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, background: 'var(--surface)', borderLeft: `3px solid ${c}` }}>
      <span style={{
        width: 32, flexShrink: 0, textAlign: 'center', fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3,
        fontFamily: 'var(--font-mono)', padding: '3px 0', borderRadius: 6, color: c, background: `${c}22`,
      }}>{p.pos?.[0]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
        <div style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          {p.stats.matches}j · {p.stats.goals}g · {p.stats.assists}a{isGk ? ` · ${p.stats.cleanSheets} sg` : ''} · {p.stats.yellows} amar. · {p.stats.reds} verm.
        </div>
      </div>
      <span style={{
        width: 30, height: 30, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11.5, fontWeight: 800, fontFamily: 'var(--font-mono)', color: oc, background: `${oc}18`, border: `1.5px solid ${oc}`,
      }}>{p.ovr}</span>
      {delta && delta.afterOvr != null && delta.afterOvr !== delta.beforeOvr && (
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: delta.afterOvr > delta.beforeOvr ? 'var(--success)' : 'var(--danger)', width: 34, textAlign: 'right' }}>
          {delta.afterOvr > delta.beforeOvr ? '▲' : '▼'}{Math.abs(delta.afterOvr - delta.beforeOvr)}
        </span>
      )}
    </div>
  );
}

export function CareerSeasonReportScreen({ report, onAdvance, onBack }) {
  const [tab, setTab] = useState('team');
  if (!report) return null;
  const { teamStats, playerRows, retired, divisionMoves, teamLabel, season } = report;
  const promoted = divisionMoves.filter(m => m.move === 'promoted');
  const relegated = divisionMoves.filter(m => m.move === 'relegated');

  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      {onBack && <button onClick={onBack} style={backButtonStyle}>← Voltar</button>}
      <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, letterSpacing: '-0.02em', fontSize: 28, marginBottom: 2 }}>Fim da Temporada {season}</h2>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{teamLabel} — como foi a temporada</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '9px 6px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              border: tab === t.id ? '1px solid var(--gold)' : '1px solid var(--line)',
              background: tab === t.id ? 'rgba(194,154,69,0.15)' : 'var(--surface)',
              color: tab === t.id ? 'var(--gold-ink)' : 'var(--ink-2)',
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'team' && teamStats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatCard label="Jogos" value={teamStats.played} />
          <StatCard label="Aproveitamento" value={`${teamStats.played ? Math.round((teamStats.wins * 3 + teamStats.draws) / (teamStats.played * 3) * 100) : 0}%`} accent="#8A6A24" />
          <StatCard label="Vitórias" value={teamStats.wins} accent="#1F7A4D" />
          <StatCard label="Empates" value={teamStats.draws} />
          <StatCard label="Derrotas" value={teamStats.losses} accent="#B23B3B" />
          <StatCard label="Jogos sem sofrer gol" value={teamStats.cleanSheets} />
          <StatCard label="Gols feitos" value={teamStats.goalsFor} sub={`média ${(teamStats.goalsFor / (teamStats.played || 1)).toFixed(2)}/jogo`} />
          <StatCard label="Gols sofridos" value={teamStats.goalsAgainst} sub={`média ${(teamStats.goalsAgainst / (teamStats.played || 1)).toFixed(2)}/jogo`} />
        </div>
      )}

      {tab === 'squad' && (
        <div style={{ display: 'grid', gap: 6 }}>
          {playerRows.map(p => <PlayerRow key={p.name} p={p} />)}
          {retired.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10, marginBottom: 2 }}>Se aposentaram</div>
              {retired.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(178,59,59,0.1)' }}>
                  <span style={{ fontSize: 13, flex: 1 }}>{d.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)' }}>Aposentou</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'moves' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Subiram pra Série A</div>
            <div style={{ display: 'grid', gap: 5 }}>
              {promoted.length ? promoted.map(m => <ClubRow key={m.clubId} club={m.club} move={m.move} />) : <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum.</div>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Caíram pra Série B</div>
            <div style={{ display: 'grid', gap: 5 }}>
              {relegated.length ? relegated.map(m => <ClubRow key={m.clubId} club={m.club} move={m.move} />) : <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum.</div>}
            </div>
          </div>
        </div>
      )}

      <button onClick={onAdvance} style={{ ...primaryBtnStyle, marginTop: 20 }}>▶ Avançar pra Temporada {season + 1}</button>
    </div>
  );
}
