// Escolha do clube pra começar uma carreira nova — grade dos 40 clubes
// reais de 2026 (Série A + B), por divisão. Tela isolada, não reaproveita
// nem modifica o TeamPickerModal usado pelos outros modos.
//
// Fluxo: seleciona um clube (fica destacado, não começa a carreira ainda)
// → define o orçamento inicial que quiser → confirma em "Começar
// carreira". Sem valor base de orçamento mostrado nos cards — o jogador
// decide o número, não o tamanho do clube (continua usando o padrão por
// tier só como fallback silencioso se deixar o campo vazio).
import { useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { SERIE_A_2026_TEAM_IDS, SERIE_B_2026_TEAM_IDS, CAREER_CLUB_META } from '../../data/career-clubs.js';

const TIER_LABEL = { elite: 'Elite', grande: 'Grande', medio: 'Médio', pequeno: 'Pequeno' };
const TIER_COLOR = { elite: '#d4a23c', grande: '#7fd99a', medio: '#9fb3a8', pequeno: '#8a8a8a' };

// Teto do orçamento personalizado — "até 1 bilhão", pedido do usuário.
const MAX_CUSTOM_BUDGET = 1_000_000_000;
const MIN_CUSTOM_BUDGET = 100_000;

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function ClubCard({ clubId, selected, onSelect }) {
  const team = TEAMS.find(t => t.id === clubId);
  const meta = CAREER_CLUB_META[clubId];
  const logo = CLUB_LOGOS[team.club];
  return (
    <button
      onClick={() => onSelect(clubId)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
        border: selected ? '1px solid rgba(212,162,60,0.6)' : '1px solid rgba(255,255,255,0.1)',
        background: selected ? 'rgba(212,162,60,0.12)' : 'rgba(255,255,255,0.03)',
        color: '#F4F1EA', cursor: 'pointer', textAlign: 'left', width: '100%',
      }}
      className="mode-card-hover"
    >
      {logo ? (
        <img src={logo} alt={team.club} style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <div style={{ width: 32, height: 32, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.club}</div>
      {selected && <span style={{ fontSize: 13, color: '#d4a23c', flexShrink: 0 }}>✓</span>}
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
        padding: '3px 7px', borderRadius: 999, flexShrink: 0,
        color: TIER_COLOR[meta.tier], border: `1px solid ${TIER_COLOR[meta.tier]}55`,
      }}>{TIER_LABEL[meta.tier]}</span>
    </button>
  );
}

export function ClubPickerScreen({ onPick, onBack }) {
  const [division, setDivision] = useState('A');
  const [query, setQuery] = useState('');
  const [budgetInput, setBudgetInput] = useState('');
  const [selectedClubId, setSelectedClubId] = useState(null);
  const ids = division === 'A' ? SERIE_A_2026_TEAM_IDS : SERIE_B_2026_TEAM_IDS;
  const q = normalize(query.trim());
  const filteredIds = ids.filter(id => !q || normalize(TEAMS.find(t => t.id === id).club).includes(q));

  const rawBudget = budgetInput ? parseInt(budgetInput, 10) : 0;
  const customBudget = rawBudget > 0 ? Math.min(MAX_CUSTOM_BUDGET, Math.max(MIN_CUSTOM_BUDGET, rawBudget)) : 0;
  const budgetClamped = rawBudget > MAX_CUSTOM_BUDGET;

  const selectedTeam = selectedClubId ? TEAMS.find(t => t.id === selectedClubId) : null;
  const selectedLogo = selectedTeam ? CLUB_LOGOS[selectedTeam.club] : null;

  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#d4a23c', fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: 0 }}>← Voltar</button>
      <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, marginBottom: 6 }}>Escolha seu clube</h1>
      <p style={{ fontSize: 13, opacity: 0.65, marginBottom: 16, lineHeight: 1.5 }}>
        Comece o Modo Carreira num dos 40 clubes reais da Série A ou B de 2026 — selecione um clube, defina o orçamento inicial que quiser e confirme.
      </p>

      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="🔍 Buscar clube pelo nome..."
        style={{
          width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, marginBottom: 10,
          border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)', color: '#F4F1EA', fontSize: 13, outline: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['A', 'B'].map(d => (
          <button
            key={d}
            onClick={() => setDivision(d)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${division === d ? '#d4a23c' : 'rgba(255,255,255,0.15)'}`,
              background: division === d ? 'rgba(212,162,60,0.12)' : 'transparent',
              color: division === d ? '#d4a23c' : 'rgba(244,241,234,0.6)',
            }}
          >Série {d}</button>
        ))}
      </div>
      {filteredIds.length === 0 && <p style={{ fontSize: 12.5, opacity: 0.5, textAlign: 'center', padding: '12px 0' }}>Nenhum clube encontrado com esse nome nesta divisão.</p>}
      <div style={{ display: 'grid', gap: 8, marginBottom: selectedClubId ? 16 : 0 }}>
        {filteredIds.map(id => (
          <ClubCard key={id} clubId={id} selected={id === selectedClubId} onSelect={setSelectedClubId} />
        ))}
      </div>

      {selectedClubId && (
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(212,162,60,0.08)', border: '1px solid rgba(212,162,60,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {selectedLogo && <img src={selectedLogo} alt={selectedTeam.club} style={{ width: 32, height: 32, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedTeam.club} selecionado</div>
          </div>

          <label style={{ display: 'block', fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Orçamento inicial (até R$ 1.000.000.000)
          </label>
          <input
            value={budgetInput ? Number(budgetInput).toLocaleString('pt-BR') : ''}
            onChange={e => setBudgetInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="Digite o orçamento inicial..."
            inputMode="numeric"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, marginBottom: 6,
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)', color: '#F4F1EA',
              fontSize: 13, outline: 'none', fontFamily: "'Space Mono', monospace",
            }}
          />
          <div style={{ fontSize: 11, marginBottom: 14, color: budgetClamped ? '#e05050' : 'rgba(244,241,234,0.5)' }}>
            {budgetClamped
              ? `Limitado a R$ ${MAX_CUSTOM_BUDGET.toLocaleString('pt-BR')}.`
              : budgetInput
                ? `Vai começar com R$ ${customBudget.toLocaleString('pt-BR')}.`
                : 'Deixe vazio pra usar o orçamento padrão do clube.'}
          </div>

          <button
            onClick={() => onPick(selectedClubId, customBudget)}
            style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: '#d4a23c', color: '#0B1A12', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            Começar carreira →
          </button>
        </div>
      )}
    </div>
  );
}
