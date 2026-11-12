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
import { backButtonStyle } from '../components/styles.js';
import { Icon, Tag, Tabs, Input, Button, SectionHeader, TeamBadge } from '../../ui/index.jsx';
import { displayName } from '../../lib/displayName.js';

const TIER_LABEL = { elite: 'Elite', grande: 'Grande', medio: 'Médio', pequeno: 'Pequeno' };
const TIER_TONE = { elite: 'gold', grande: 'success', medio: 'info', pequeno: undefined };

// Teto do orçamento personalizado — "até 1 bilhão", pedido do usuário. Sem
// piso: o usuário pode começar com R$0 de propósito (pedido explícito
// 2026-11-09: "deixe colocar 0 mesmo se o cara quiser tudo realista") —
// um desafio real de começar sem dinheiro nenhum, não um valor mínimo
// imposto pelo jogo.
const MAX_CUSTOM_BUDGET = 1_000_000_000;

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function ClubCard({ clubId, selected, onSelect }) {
  const team = TEAMS.find(t => t.id === clubId);
  const meta = CAREER_CLUB_META[clubId];
  const logo = CLUB_LOGOS[team.club];
  return (
    <button
      type="button"
      onClick={() => onSelect(clubId)}
      aria-pressed={selected}
      className="club-pick-card"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, minHeight: 64,
        border: selected ? '1.5px solid var(--green)' : '1px solid var(--line)',
        background: selected ? 'var(--surface)' : 'var(--surface)',
        boxShadow: selected ? '0 0 0 3px rgba(13,58,41,0.12)' : 'none',
        color: 'var(--ink)', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'var(--font-body)',
      }}
    >
      <TeamBadge src={logo} name={displayName(team.club)} color={team.colors?.p || '#0D3A29'} size={38} radius={10} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(team.club)}</div>
        <div style={{ marginTop: 4 }}><Tag tone={TIER_TONE[meta.tier]}>{TIER_LABEL[meta.tier]}</Tag></div>
      </div>
      <span style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
        border: selected ? 'none' : '1.5px solid var(--line-strong)', background: selected ? 'var(--green)' : 'transparent', color: '#fff',
      }}>{selected && <Icon name="check" size={14} strokeWidth={2.4} />}</span>
    </button>
  );
}

export function ClubPickerScreen({ onPick, onBack }) {
  const [division, setDivision] = useState('A');
  const [query, setQuery] = useState('');
  const [budgetInput, setBudgetInput] = useState('');
  const [selectedClubId, setSelectedClubId] = useState(null);
  // Ordem alfabética pelo nome do clube (pedido explícito do usuário
  // 2026-11-11: "deixe tudo por ordem alfabetica") — SERIE_A/B_2026_TEAM_IDS
  // vêm ordenados por tier (Elite→Pequeno), só pra outros usos internos.
  const ids = [...(division === 'A' ? SERIE_A_2026_TEAM_IDS : SERIE_B_2026_TEAM_IDS)]
    .sort((a, b) => TEAMS.find(t => t.id === a).club.localeCompare(TEAMS.find(t => t.id === b).club));
  const q = normalize(query.trim());
  const filteredIds = ids.filter(id => !q || normalize(TEAMS.find(t => t.id === id).club).includes(q));

  // Campo vazio = "sem orçamento personalizado" (cai no padrão do tier do
  // clube) — diferente de digitar "0" de propósito, que precisa chegar em
  // createCareerSave como 0 mesmo, não ser tratado como "não informado".
  // `null` (não 0) é o sinal de "use o padrão" passado adiante.
  const hasCustomBudget = budgetInput !== '';
  const rawBudget = hasCustomBudget ? parseInt(budgetInput, 10) : 0;
  const customBudget = hasCustomBudget ? Math.min(MAX_CUSTOM_BUDGET, rawBudget) : null;
  const budgetClamped = rawBudget > MAX_CUSTOM_BUDGET;

  const selectedTeam = selectedClubId ? TEAMS.find(t => t.id === selectedClubId) : null;
  const selectedLogo = selectedTeam ? CLUB_LOGOS[selectedTeam.club] : null;
  const selectedMeta = selectedClubId ? CAREER_CLUB_META[selectedClubId] : null;

  return (
    <div className="club-picker" style={{ width: '100%', maxWidth: 1240, margin: '0 auto', padding: '24px 16px 140px' }}>
      <style>{`
        .club-picker-layout { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 24px; align-items: start; }
        .club-picker-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
        .club-picker-panel { position: sticky; top: 16px; }
        @media (hover: hover) { .club-pick-card:hover { border-color: var(--line-strong) !important; transform: translateY(-1px); } }
        .club-pick-card { transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease; }
        @media (max-width: 1100px) { .club-picker-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 860px) {
          .club-picker-layout { grid-template-columns: 1fr; }
          .club-picker-panel { position: fixed; left: 0; right: 0; bottom: 0; top: auto; z-index: 50; border-radius: 20px 20px 0 0 !important; box-shadow: 0 -12px 30px -12px rgba(15,31,23,.25) !important; max-height: 70vh; overflow-y: auto; }
        }
        @media (max-width: 860px) { .club-picker-panel-empty { display: none; } }
        @media (max-width: 560px) { .club-picker-grid { grid-template-columns: 1fr; } }
      `}</style>
      <button onClick={onBack} style={backButtonStyle}><Icon name="arrowLeft" size={15} /> Voltar</button>
      <SectionHeader
        eyebrow="Modo Carreira · temporada 2026"
        title="Escolha seu"
        accent="clube"
        size="lg"
        as="h1"
        desc="Comece num dos 40 clubes reais da Série A ou B de 2026. Selecione um clube, defina o orçamento inicial e confirme."
      />

      <div className="club-picker-layout">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <Tabs
              tabs={[{ id: 'A', label: 'Série A' }, { id: 'B', label: 'Série B' }]}
              value={division}
              onChange={setDivision}
              style={{ flex: '0 0 auto', minWidth: 220 }}
            />
            <Input
              icon="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar clube pelo nome…"
              aria-label="Buscar clube"
              style={{ flex: '1 1 220px' }}
            />
          </div>
          {filteredIds.length === 0 && <p style={{ fontSize: 13.5, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>Nenhum clube encontrado com esse nome nesta divisão.</p>}
          <div className="club-picker-grid">
            {filteredIds.map(id => (
              <ClubCard key={id} clubId={id} selected={id === selectedClubId} onSelect={setSelectedClubId} />
            ))}
          </div>
        </div>

        <aside className={`club-picker-panel${selectedTeam ? '' : ' club-picker-panel-empty'}`} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 20, boxShadow: 'var(--shadow)' }}>
          {selectedTeam ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <TeamBadge src={selectedLogo} name={displayName(selectedTeam.club)} color={selectedTeam.colors?.p || '#0D3A29'} size={44} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, lineHeight: 1.15 }}>{displayName(selectedTeam.club)}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>Série {division} · {TIER_LABEL[selectedMeta.tier]}</div>
                </div>
              </div>
              <Input
                label="Orçamento inicial (R$ 0 a R$ 1 bilhão)"
                value={budgetInput ? Number(budgetInput).toLocaleString('pt-BR') : ''}
                onChange={e => setBudgetInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Padrão do clube"
                inputMode="numeric"
                style={{ marginBottom: 6 }}
              />
              <div style={{ fontSize: 12, marginBottom: 16, color: budgetClamped ? 'var(--danger)' : 'var(--muted)' }}>
                {budgetClamped
                  ? `Limitado a R$ ${MAX_CUSTOM_BUDGET.toLocaleString('pt-BR')}.`
                  : hasCustomBudget
                    ? `Vai começar com R$ ${customBudget.toLocaleString('pt-BR')}.`
                    : 'Deixe vazio pra usar o orçamento padrão do clube.'}
              </div>
              <Button variant="dark" size="lg" block iconRight="arrowRight" onClick={() => onPick(selectedClubId, customBudget)}>
                Começar carreira
              </Button>
            </>
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.55, display: 'flex', gap: 10, alignItems: 'center' }}>
              <Icon name="info" size={18} />
              <span>Selecione um clube na lista pra definir o orçamento e começar.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
