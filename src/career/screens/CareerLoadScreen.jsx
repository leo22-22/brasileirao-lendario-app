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
      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(224,80,80,0.08)', border: '1px solid rgba(224,80,80,0.3)', marginBottom: 8 }}>
        <p style={{ fontSize: 12.5, marginBottom: 10 }}>Apagar a carreira do {team.club} (Temporada {save.season}) de vez? Não tem como desfazer.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onDelete(save.seed)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#e05050', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Sim, apagar
          </button>
          <button onClick={() => setConfirming(false)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#F4F1EA', fontSize: 12, cursor: 'pointer' }}>
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
        background: isActive ? 'rgba(212,162,60,0.1)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isActive ? 'rgba(212,162,60,0.4)' : 'rgba(255,255,255,0.1)'}`,
      }}
    >
      <button
        onClick={() => onLoad(save.seed)}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', color: '#F4F1EA', textAlign: 'left', cursor: 'pointer', padding: 0 }}
      >
        {logo && <img src={logo} alt={team.club} style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            {team.club}
            {isActive && <span style={{ fontSize: 9, fontWeight: 700, color: '#d4a23c', background: 'rgba(212,162,60,0.15)', border: '1px solid rgba(212,162,60,0.4)', borderRadius: 999, padding: '2px 7px' }}>ATIVA</span>}
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 2 }}>
            Temporada {save.season} · Série {divisionKey} · {pos}º lugar · {formatMoney(club.budget)}
          </div>
          <div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 1 }}>{formatCalendarDay(save.calendarDay)}</div>
        </div>
      </button>
      <button
        onClick={() => setConfirming(true)}
        title="Apagar essa carreira"
        style={{ background: 'none', border: 'none', color: 'rgba(224,80,80,0.75)', fontSize: 16, cursor: 'pointer', padding: '4px 6px', flexShrink: 0 }}
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
      <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, marginBottom: 6 }}>Carregar carreira</h1>
      <p style={{ fontSize: 12.5, opacity: 0.6, marginBottom: 18 }}>
        {saves.length} carreira{saves.length !== 1 ? 's' : ''} salva{saves.length !== 1 ? 's' : ''} — toque numa pra continuar nela.
      </p>
      {saves.length === 0 && (
        <p style={{ fontSize: 12.5, opacity: 0.5, textAlign: 'center', padding: '20px 0' }}>Nenhuma carreira salva.</p>
      )}
      {saves.map(s => (
        <CareerRow key={s.seed} save={s} isActive={s.seed === activeSeed} onLoad={onLoad} onDelete={onDelete} />
      ))}
    </div>
  );
}
