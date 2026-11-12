// Lista todas as carreiras salvas (um clube por carreira, cada uma no seu
// próprio slot — ver careerStorage.js) pra trocar de uma pra outra, sem
// apagar nenhuma — pedido explícito do usuário (2026-11-12): "permita
// criar mais de uma carreira também e depois só clicar em carregar
// carreira". Apagar uma carreira de vez é uma ação própria aqui (ícone 🗑
// por linha, com confirmação), separada de "trocar pra ela".
import { useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { formatCalendarDay } from '../engine/calendar.js';
import { backButtonStyle } from '../components/styles.js';
import { displayName } from '../../lib/displayName.js';

function formatMoney(n) {
  return 'R$ ' + n.toLocaleString('pt-BR');
}

function careerTablePos(save) {
  const division = save.clubs[save.myClubId].division === 'A' ? save.divisionA : save.divisionB;
  const pos = division.table.findIndex(r => r.id === save.myClubId) + 1;
  return { pos, divisionKey: save.clubs[save.myClubId].division };
}

function CareerRow({ save, isActive, onLoad, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const team = TEAMS.find(t => t.id === save.myClubId);
  const logo = CLUB_LOGOS[team.club];
  const club = save.clubs[save.myClubId];
  const { pos, divisionKey } = careerTablePos(save);

  if (confirming) {
    return (
      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(178,59,59,0.1)', border: '1px solid rgba(178,59,59,0.4)', marginBottom: 8 }}>
        <p style={{ fontSize: 12.5, marginBottom: 10 }}>Apagar a carreira do {displayName(team.club)} (Temporada {save.season}) de vez? Não tem como desfazer.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onDelete(save.seed)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Sim, apagar
          </button>
          <button onClick={() => setConfirming(false)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--ink)', fontSize: 12, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, marginBottom: 8,
        background: isActive ? 'rgba(194,154,69,0.1)' : 'var(--surface)',
        border: `1px solid ${isActive ? 'rgba(194,154,69,0.55)' : 'var(--line)'}`,
      }}
    >
      <button
        onClick={() => onLoad(save.seed)}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer', padding: 0 }}
      >
        {logo && <img src={logo} alt={displayName(team.club)} style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            {displayName(team.club)}
            {isActive && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--gold-ink)', background: 'rgba(194,154,69,0.15)', border: '1px solid var(--gold)', borderRadius: 999, padding: '2px 7px' }}>ATIVA</span>}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
            Temporada {save.season} · Série {divisionKey} · {pos}º lugar · {formatMoney(club.budget)}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 1 }}>{formatCalendarDay(save.calendarDay)}</div>
        </div>
      </button>
      <button
        onClick={() => setConfirming(true)}
        title="Apagar essa carreira"
        style={{ background: 'none', border: 'none', color: 'rgb(178,59,59)', fontSize: 16, cursor: 'pointer', padding: '4px 6px', flexShrink: 0 }}
      >
        🗑
      </button>
    </div>
  );
}

export function CareerLoadScreen({ saves, activeSeed, onLoad, onDelete, onBack }) {
  return (
    <div style={{ width: '100%', maxWidth: 460, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={{ ...backButtonStyle, marginBottom: 20 }}>← Voltar</button>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, letterSpacing: '-0.02em', fontSize: 28, marginBottom: 6 }}>Carregar carreira</h1>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 18 }}>
        {saves.length} carreira{saves.length !== 1 ? 's' : ''} salva{saves.length !== 1 ? 's' : ''} — toque numa pra continuar nela.
      </p>
      {saves.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Nenhuma carreira salva.</p>
      )}
      {saves.map(s => (
        <CareerRow key={s.seed} save={s} isActive={s.seed === activeSeed} onLoad={onLoad} onDelete={onDelete} />
      ))}
    </div>
  );
}
