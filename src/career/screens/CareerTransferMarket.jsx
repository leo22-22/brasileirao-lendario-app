// Mercado de transferências do Modo Carreira — com orçamento de verdade,
// diferente do TransferMarket usado pelos outros modos (App.jsx, troca
// direta sem preço). Três abas: listar/consultar o próprio elenco (sem
// venda direta — só marca disponibilidade e espera proposta, estilo "lista
// de transferências" de EA FC), fazer proposta por um jogador de qualquer
// um dos outros 39 clubes (o clube vendedor decide aceitar ou não, estilo
// FIFA/Football Manager — nunca uma compra automática), e responder
// propostas recebidas (aceitar, rejeitar ou mandar contraproposta). Busca
// por nome + filtro de posição em toda lista de jogador, e busca por nome
// + divisão na lista de clubes.
import { useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { CAREER_CLUB_IDS } from '../../data/career-clubs.js';
import { computePlayerValue } from '../engine/pricing.js';
import { MIN_SQUAD_SIZE } from '../engine/rosterStore.js';
import { isTransferWindowOpen } from '../engine/calendar.js';
import { LOAN_DURATIONS } from '../engine/loans.js';
import { TransferWindowBadge } from '../components/TransferWindowBadge.jsx';
import { backButtonStyle } from '../components/styles.js';
import { ovrColor, posOrderIndex, posColor, POS_ORDER } from '../../lib/format.js';

// Reaproveita POS_ORDER (lib/format.js) em vez de manter uma lista própria
// — já cobre os 12 códigos de posição que existem nos dados (inclusive MD/
// ME, usados por alguns jogadores reais, que uma lista escrita à mão aqui
// tinha deixado de fora).
const POSITIONS = POS_ORDER;

function formatMoney(n) {
  return 'R$ ' + n.toLocaleString('pt-BR');
}

// Normaliza acento pra busca não exigir digitar "ã"/"é" certinho (ex.:
// buscar "sao paulo" ou "joao" encontra "São Paulo"/"João").
function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// `adv` (opcional) = busca avançada (pedido explícito do usuário
// 2026-11-13: "filtrar de tal idade a tal idade, de tal valor a tal
// valor") — { ageMin, ageMax, valueMin, valueMax, getValue }. Jogador sem
// idade conhecida (elenco histórico/legado sem backfill, ver pricing.js)
// nunca bate um filtro de idade — mostrar ele dentro de qualquer faixa
// seria inventar um dado que não existe.
function filterPlayers(roster, query, pos, adv) {
  const q = normalize(query.trim());
  return roster
    // Filtra pela posição PRINCIPAL (pos[0], a mesma que aparece no badge
    // da linha) — não por "p.pos.includes(pos)", que mostraria um jogador
    // versátil (ex.: cadastrado como ['MEI','ATA']) com o badge "MEI"
    // dentro do filtro "ATA", o que pareceria um resultado errado.
    .filter(p => (!q || normalize(p.name).includes(q)) && (!pos || p.pos[0] === pos))
    .filter(p => {
      if (!adv) return true;
      if (adv.ageMin != null && (p.age == null || p.age < adv.ageMin)) return false;
      if (adv.ageMax != null && (p.age == null || p.age > adv.ageMax)) return false;
      if (adv.valueMin != null || adv.valueMax != null) {
        const v = adv.getValue(p);
        if (adv.valueMin != null && v < adv.valueMin) return false;
        if (adv.valueMax != null && v > adv.valueMax) return false;
      }
      return true;
    })
    .sort((a, b) => posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]) || b.ovr - a.ovr);
}

const inputStyle = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.04)', color: '#F4F1EA', fontSize: 12.5, outline: 'none',
};

function PosBadge({ pos }) {
  const c = posColor(pos);
  return (
    <span style={{
      width: 34, flexShrink: 0, textAlign: 'center', fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3,
      fontFamily: "'Space Mono', monospace", padding: '3px 0', borderRadius: 6,
      color: c, background: `${c}22`, border: `1px solid ${c}55`,
    }}>{pos}</span>
  );
}

const EMPTY_ADV = { ageMin: '', ageMax: '', valueMin: '', valueMax: '' };

// Busca avançada (pedido explícito do usuário 2026-11-13: "tipo busca
// avançada aí lá dá pra filtrar de tal idade a tal idade, de tal valor a
// tal valor etc") — painel recolhível abaixo da busca normal, só com
// idade e valor de mercado (os dois únicos atributos numéricos que fazem
// sentido pra faixa aqui; posição já tem o seletor dedicado ao lado).
function AdvancedFilters({ adv, setAdv }) {
  const [open, setOpen] = useState(false);
  const active = !!(adv.ageMin || adv.ageMax || adv.valueMin || adv.valueMax);
  const update = (key, val) => setAdv(prev => ({ ...prev, [key]: val }));
  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', padding: 0, color: active ? '#d4a23c' : 'rgba(244,241,234,0.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
      >🔎 Busca avançada{active ? ' (ativa)' : ''} {open ? '▲' : '▼'}</button>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4 }}>Idade</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={adv.ageMin} onChange={e => update('ageMin', e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="min" inputMode="numeric" style={{ ...inputStyle, width: '100%', padding: '6px 8px', boxSizing: 'border-box' }} />
              <span style={{ opacity: 0.4, fontSize: 11, flexShrink: 0 }}>até</span>
              <input value={adv.ageMax} onChange={e => update('ageMax', e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="max" inputMode="numeric" style={{ ...inputStyle, width: '100%', padding: '6px 8px', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4 }}>Valor de mercado (R$)</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={adv.valueMin ? Number(adv.valueMin).toLocaleString('pt-BR') : ''} onChange={e => update('valueMin', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="min" inputMode="numeric" style={{ ...inputStyle, width: '100%', padding: '6px 8px', boxSizing: 'border-box' }} />
              <span style={{ opacity: 0.4, fontSize: 11, flexShrink: 0 }}>até</span>
              <input value={adv.valueMax ? Number(adv.valueMax).toLocaleString('pt-BR') : ''} onChange={e => update('valueMax', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="max" inputMode="numeric" style={{ ...inputStyle, width: '100%', padding: '6px 8px', boxSizing: 'border-box' }} />
            </div>
          </div>
          {active && (
            <button
              onClick={() => setAdv(EMPTY_ADV)}
              style={{ gridColumn: '1 / -1', background: 'none', border: '1px solid rgba(224,80,80,0.35)', borderRadius: 8, padding: '6px 0', color: '#e08080', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >Limpar busca avançada</button>
          )}
        </div>
      )}
    </div>
  );
}

function PlayerSearchBar({ query, setQuery, pos, setPos, resultCount, adv, setAdv }) {
  const advActive = !!(adv?.ageMin || adv?.ageMax || adv?.valueMin || adv?.valueMax);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="🔍 Buscar jogador pelo nome..." style={{ ...inputStyle, flex: 1 }} />
        <select value={pos} onChange={e => setPos(e.target.value)} style={{ ...inputStyle, flexShrink: 0, colorScheme: 'dark' }}>
          <option value="" style={{ background: '#13241a', color: '#F4F1EA' }}>Todas posições</option>
          {POSITIONS.map(p => <option key={p} value={p} style={{ background: '#13241a', color: '#F4F1EA' }}>{p}</option>)}
        </select>
      </div>
      {adv && setAdv && <AdvancedFilters adv={adv} setAdv={setAdv} />}
      {(query || pos || advActive) && <div style={{ fontSize: 11, opacity: 0.5, marginTop: 5 }}>{resultCount} jogador{resultCount === 1 ? '' : 'es'} encontrado{resultCount === 1 ? '' : 's'}</div>}
    </div>
  );
}

function TabBar({ tab, setTab, offerCount }) {
  const tabs = [
    { id: 'mine', label: 'Meu elenco' },
    { id: 'other', label: 'Outros clubes' },
    { id: 'offers', label: `Propostas${offerCount ? ` (${offerCount})` : ''}` },
    { id: 'history', label: 'Histórico' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            flex: '1 1 auto', padding: '8px 4px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${tab === t.id ? '#d4a23c' : 'rgba(255,255,255,0.15)'}`,
            background: tab === t.id ? 'rgba(212,162,60,0.12)' : 'transparent',
            color: tab === t.id ? '#d4a23c' : 'rgba(244,241,234,0.6)',
          }}
        >{t.label}</button>
      ))}
    </div>
  );
}

function PlayerRowShell({ pos, children }) {
  const c = posColor(pos);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 10,
      background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `3px solid ${c}`, marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

// Botões de duração (6 meses / 1 temporada / 2 temporadas) reaproveitados
// nos dois fluxos de empréstimo (emprestar o meu / pedir emprestado).
function DurationPicker({ kind, setKind }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {LOAN_DURATIONS.map(d => (
        <button
          key={d.kind}
          onClick={() => setKind(d.kind)}
          style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${kind === d.kind ? '#6fb8e0' : 'rgba(255,255,255,0.2)'}`,
            background: kind === d.kind ? 'rgba(111,184,224,0.15)' : 'transparent',
            color: kind === d.kind ? '#6fb8e0' : 'rgba(244,241,234,0.7)',
          }}
        >{d.label}</button>
      ))}
    </div>
  );
}

function MyRosterTab({ save, onToggleListed, onToggleLoanList, windowOpen }) {
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState('');
  const [adv, setAdv] = useState(EMPTY_ADV);
  const roster = save.clubs[save.myClubId].roster.filter(p => !p.inAcademy);
  const transferList = save.transferList || [];
  const loanList = save.loanList || [];
  const advParsed = {
    ageMin: adv.ageMin ? Number(adv.ageMin) : null,
    ageMax: adv.ageMax ? Number(adv.ageMax) : null,
    valueMin: adv.valueMin ? Number(adv.valueMin) : null,
    valueMax: adv.valueMax ? Number(adv.valueMax) : null,
    getValue: p => computePlayerValue(p, save.myClubId),
  };
  const filtered = filterPlayers(roster, query, pos, advParsed);
  return (
    <div>
      {!windowOpen && <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>Janela fechada — pode listar jogadores agora, mas as propostas só chegam quando ela abrir (janeiro, ou julho).</p>}
      {roster.length <= MIN_SQUAD_SIZE && <p style={{ fontSize: 12, color: '#e0a33d', marginBottom: 10 }}>Elenco no mínimo de {MIN_SQUAD_SIZE} jogadores — mesmo que venha proposta, não vai dar pra vender/emprestar até o elenco crescer.</p>}
      <p style={{ fontSize: 11.5, opacity: 0.55, marginBottom: 10, lineHeight: 1.4 }}>📋 Não dá pra vender direto — coloque o jogador na lista de transferências (aumenta em 50% a chance de vir proposta por ele) e aguarde alguém se interessar. 🔁 Empréstimo funciona igual: colocar na lista de empréstimo não empresta ninguém sozinho, só sinaliza que o jogador tá disponível — uma proposta de empréstimo (com a duração que o clube propôs) pode ou não aparecer depois. Aceite ou rejeite as duas na aba Propostas.</p>
      <PlayerSearchBar query={query} setQuery={setQuery} pos={pos} setPos={setPos} resultCount={filtered.length} adv={adv} setAdv={setAdv} />
      {filtered.length === 0 && <p style={{ fontSize: 12.5, opacity: 0.5, textAlign: 'center', padding: '12px 0' }}>Nenhum jogador encontrado com esse filtro.</p>}
      {filtered.map(p => {
        const value = computePlayerValue(p, save.myClubId);
        const listed = transferList.includes(p.name);
        const loanListed = loanList.includes(p.name);
        const borrowed = !!p.onLoanFrom; // jogador que EU peguei emprestado — não dá pra re-emprestar
        return (
          <PlayerRowShell key={p.name} pos={p.pos[0]}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <PosBadge pos={p.pos[0]} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              {borrowed && <span style={{ fontSize: 9.5, color: '#6fb8e0', fontWeight: 700, border: '1px solid rgba(111,184,224,0.4)', borderRadius: 999, padding: '2px 6px' }}>EMPRESTADO</span>}
              <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: ovrColor(p.ovr), fontSize: 13 }}>{p.ovr}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, opacity: 0.7 }}>{formatMoney(value)}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {!borrowed && (
                  <button
                    onClick={() => onToggleLoanList(p.name)}
                    title={loanListed ? 'Tirar da lista de empréstimo' : 'Colocar na lista de empréstimo (pode vir proposta de empréstimo)'}
                    style={{
                      padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                      border: `1px solid ${loanListed ? 'rgba(111,184,224,0.5)' : 'rgba(255,255,255,0.2)'}`,
                      background: loanListed ? 'rgba(111,184,224,0.15)' : 'transparent',
                      color: loanListed ? '#6fb8e0' : 'rgba(244,241,234,0.6)',
                    }}
                  >{loanListed ? '🔁 Na lista' : '🔁 Emprestar'}</button>
                )}
                <button
                  onClick={() => onToggleListed(p.name)}
                  title={listed ? 'Tirar da lista de transferências' : 'Colocar na lista de transferências (+50% chance de proposta)'}
                  style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${listed ? 'rgba(212,162,60,0.5)' : 'rgba(255,255,255,0.2)'}`,
                    background: listed ? 'rgba(212,162,60,0.15)' : 'transparent',
                    color: listed ? '#d4a23c' : 'rgba(244,241,234,0.6)',
                  }}
                >{listed ? '📋 Na lista' : '📋 Listar'}</button>
              </div>
            </div>
          </PlayerRowShell>
        );
      })}
    </div>
  );
}

// Linha de um jogador de outro clube, com proposta inline — digita um
// valor e envia; o clube vendedor decide aceitar ou recusar (nunca uma
// compra automática). `onPropose` já devolve o resultado síncrono pra
// tela mostrar na hora.
function ProposeRow({ player, price, enabled, disabledReason, onPropose, onRequestLoan }) {
  const [mode, setMode] = useState(null); // null | 'buy' | 'loan'
  const [amountInput, setAmountInput] = useState('');
  const [loanKind, setLoanKind] = useState(null);
  const [loanResult, setLoanResult] = useState(null);
  const amount = amountInput ? parseInt(amountInput, 10) : 0;
  const borrowed = !!player.onLoanFrom;

  const handleOpenBuy = () => {
    setAmountInput(String(price));
    setMode('buy');
  };
  const handleSend = () => {
    if (amount <= 0) return;
    onPropose(player.name, amount);
    setMode(null);
    setAmountInput('');
  };
  const handleSendLoan = () => {
    if (!loanKind) return;
    setLoanResult(onRequestLoan(player.name, loanKind));
  };

  return (
    <PlayerRowShell pos={player.pos[0]}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PosBadge pos={player.pos[0]} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: ovrColor(player.ovr), fontSize: 13 }}>{player.ovr}</span>
      </div>
      {mode === null && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, opacity: 0.7 }}>Valor de mercado: {formatMoney(price)}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {!borrowed && (
              <button
                onClick={() => { setLoanResult(null); setLoanKind(null); setMode('loan'); }}
                title="Pedir emprestado"
                style={{ padding: '6px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(111,184,224,0.4)', background: 'transparent', color: '#6fb8e0' }}
              >🔁 Emprestado</button>
            )}
            <button
              onClick={handleOpenBuy}
              disabled={!enabled}
              title={disabledReason}
              style={{
                padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: enabled ? 'pointer' : 'default',
                border: '1px solid rgba(127,217,154,0.4)', background: enabled ? 'rgba(127,217,154,0.12)' : 'transparent',
                color: enabled ? '#7fd99a' : 'rgba(127,217,154,0.3)',
              }}
            >💰 Fazer proposta</button>
          </div>
        </div>
      )}
      {mode === 'buy' && (
        <div>
          <p style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>Quanto menor que {formatMoney(price)}, menor a chance do clube aceitar.</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={amountInput ? Number(amountInput).toLocaleString('pt-BR') : ''}
              onChange={e => setAmountInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={handleSend}
              disabled={amount <= 0}
              style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: amount > 0 ? '#7fd99a' : 'rgba(127,217,154,0.3)', color: '#0B1A12', fontWeight: 700, fontSize: 12, cursor: amount > 0 ? 'pointer' : 'default' }}
            >Enviar</button>
            <button onClick={() => setMode(null)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#F4F1EA', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}
      {mode === 'loan' && (
        loanResult ? (
          <div style={{ fontSize: 12, color: loanResult.accepted ? '#6fb8e0' : '#e05050' }}>
            {loanResult.accepted ? `✅ ${player.name} veio emprestado!` : '❌ O clube recusou emprestar.'}{' '}
            <button onClick={() => setMode(null)} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>fechar</button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>Pedir {player.name} emprestado por:</p>
            <DurationPicker kind={loanKind} setKind={setLoanKind} />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={handleSendLoan} disabled={!loanKind} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: loanKind ? '#6fb8e0' : 'rgba(111,184,224,0.3)', color: '#0B1A12', fontWeight: 700, fontSize: 12, cursor: loanKind ? 'pointer' : 'default' }}>Enviar pedido</button>
              <button onClick={() => setMode(null)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#F4F1EA', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )
      )}
    </PlayerRowShell>
  );
}

function ClubRosterList({ save, clubId, onPropose, onRequestLoan, windowOpen }) {
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState('');
  const [adv, setAdv] = useState(EMPTY_ADV);
  const [lastResult, setLastResult] = useState(null); // { playerName, accepted, reason, price }
  const team = TEAMS.find(t => t.id === clubId);
  const logo = CLUB_LOGOS[team.club];
  const roster = save.clubs[clubId].roster.filter(p => !p.inAcademy);
  const myBudget = save.clubs[save.myClubId].budget;
  const sellerCanSell = roster.length > MIN_SQUAD_SIZE;
  const advParsed = {
    ageMin: adv.ageMin ? Number(adv.ageMin) : null,
    ageMax: adv.ageMax ? Number(adv.ageMax) : null,
    valueMin: adv.valueMin ? Number(adv.valueMin) : null,
    valueMax: adv.valueMax ? Number(adv.valueMax) : null,
    getValue: p => computePlayerValue(p, clubId),
  };
  const filtered = filterPlayers(roster, query, pos, advParsed);

  const handlePropose = (playerName, amount) => {
    const res = onPropose(clubId, playerName, amount);
    setLastResult({ playerName, ...res });
  };
  const handleRequestLoan = (playerName, kind) => onRequestLoan(clubId, playerName, kind);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {logo && <img src={logo} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
        <div style={{ fontWeight: 700, fontSize: 15 }}>{team.club}</div>
      </div>
      {!windowOpen && <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>Janela fechada — só dá pra consultar os preços, não propor.</p>}
      {lastResult && (
        <div style={{
          padding: '9px 12px', borderRadius: 8, marginBottom: 10, fontSize: 12.5,
          background: lastResult.accepted ? 'rgba(127,217,154,0.1)' : 'rgba(224,80,80,0.1)',
          border: `1px solid ${lastResult.accepted ? 'rgba(127,217,154,0.35)' : 'rgba(224,80,80,0.35)'}`,
          color: lastResult.accepted ? '#7fd99a' : '#e05050',
        }}>
          {lastResult.accepted
            ? `✅ Proposta por ${lastResult.playerName} aceita — comprado por ${formatMoney(lastResult.price)}!`
            : lastResult.reason === 'orçamento insuficiente'
              ? `❌ Não foi possível propor por ${lastResult.playerName}: orçamento insuficiente.`
              : `❌ Proposta por ${lastResult.playerName} recusada — tente um valor mais perto do de mercado.`}
        </div>
      )}
      <PlayerSearchBar query={query} setQuery={setQuery} pos={pos} setPos={setPos} resultCount={filtered.length} adv={adv} setAdv={setAdv} />
      {filtered.length === 0 && <p style={{ fontSize: 12.5, opacity: 0.5, textAlign: 'center', padding: '12px 0' }}>Nenhum jogador encontrado com esse filtro.</p>}
      {filtered.map(p => {
        const price = computePlayerValue(p, clubId);
        const canAfford = myBudget >= price * 0.5; // precisa dar pra propor pelo menos um valor com chance real
        const enabled = windowOpen && canAfford && sellerCanSell;
        const disabledReason = !windowOpen ? 'Janela de transferências fechada' : !canAfford ? 'Orçamento insuficiente pra uma proposta com chance real' : !sellerCanSell ? 'Clube vendedor no mínimo de elenco' : '';
        return (
          <ProposeRow key={p.name} player={p} price={price} enabled={enabled} disabledReason={disabledReason} onPropose={handlePropose} onRequestLoan={handleRequestLoan} />
        );
      })}
    </div>
  );
}

function OtherClubsTab({ save, onPropose, onRequestLoan, windowOpen }) {
  const [clubId, setClubId] = useState(null);
  const [clubQuery, setClubQuery] = useState('');
  const [division, setDivision] = useState('A');

  if (clubId) {
    return (
      <div>
        <button onClick={() => setClubId(null)} style={{ ...backButtonStyle, fontSize: 12, padding: '6px 12px', marginBottom: 10 }}>← Outro clube</button>
        <ClubRosterList key={clubId} save={save} clubId={clubId} onPropose={onPropose} onRequestLoan={onRequestLoan} windowOpen={windowOpen} />
      </div>
    );
  }

  // Divisão ATUAL de cada clube (save.clubs[id].division, atualizada de
  // verdade a cada acesso/queda no fim de temporada — ver seasonEngine.js)
  // em vez da lista estática SERIE_A/B_2026_TEAM_IDS (a composição real de
  // 2026): bug reportado pelo usuário 2026-11-13 — um clube rebaixado pra
  // Série B continuava aparecendo em "Série A" aqui pra sempre.
  const idsForDivision = CAREER_CLUB_IDS.filter(id => save.clubs[id].division === division);
  const q = normalize(clubQuery.trim());
  const filteredIds = idsForDivision
    .filter(id => id !== save.myClubId)
    .filter(id => !q || normalize(TEAMS.find(t => t.id === id).club).includes(q));

  return (
    <div>
      <input value={clubQuery} onChange={e => setClubQuery(e.target.value)} placeholder="🔍 Buscar clube pelo nome..." style={{ ...inputStyle, width: '100%', marginBottom: 8, boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {['A', 'B'].map(d => (
          <button
            key={d}
            onClick={() => setDivision(d)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${division === d ? '#d4a23c' : 'rgba(255,255,255,0.15)'}`,
              background: division === d ? 'rgba(212,162,60,0.12)' : 'transparent',
              color: division === d ? '#d4a23c' : 'rgba(244,241,234,0.6)',
            }}
          >Série {d}</button>
        ))}
      </div>
      {filteredIds.length === 0 && <p style={{ fontSize: 12.5, opacity: 0.5, textAlign: 'center', padding: '12px 0' }}>Nenhum clube encontrado com esse nome.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {filteredIds.map(id => {
          const team = TEAMS.find(t => t.id === id);
          const logo = CLUB_LOGOS[team.club];
          return (
            <button key={id} onClick={() => setClubId(id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.035)', color: '#F4F1EA', cursor: 'pointer', textAlign: 'left' }} className="mode-card-hover">
              {logo && <img src={logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
              <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.club}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OfferCard({ offer, idx, onRespond, onCounterOffer, onResult }) {
  const [countering, setCountering] = useState(false);
  const [counterInput, setCounterInput] = useState('');
  const buyerTeam = TEAMS.find(t => t.id === offer.fromClubId);
  const counterAmount = counterInput ? parseInt(counterInput, 10) : 0;
  const isLoan = offer.type === 'loan';
  const loanLabel = isLoan ? LOAN_DURATIONS.find(d => d.kind === offer.kind)?.label : null;

  const handleAccept = () => {
    onRespond(idx, true);
    onResult({ type: isLoan ? 'loan-accept' : 'accept', playerName: offer.playerName, clubName: buyerTeam?.club, amount: offer.amount, loanLabel });
  };
  const handleReject = () => {
    onRespond(idx, false);
    onResult({ type: isLoan ? 'loan-reject' : 'reject', playerName: offer.playerName, clubName: buyerTeam?.club });
  };
  const handleSendCounter = () => {
    if (counterAmount <= offer.amount) return;
    const result = onCounterOffer(idx, counterAmount);
    onResult({
      type: result?.accepted ? 'counter-accept' : 'counter-reject',
      playerName: offer.playerName, clubName: buyerTeam?.club, amount: counterAmount,
    });
    setCountering(false);
    setCounterInput('');
  };

  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
      {isLoan ? (
        <div style={{ fontSize: 13, marginBottom: 6 }}><b>{buyerTeam?.club}</b> quer pegar <b>{offer.playerName}</b> emprestado por <b style={{ color: '#6fb8e0' }}>{loanLabel}</b></div>
      ) : (
        <div style={{ fontSize: 13, marginBottom: 6 }}><b>{buyerTeam?.club}</b> oferece <b style={{ color: '#d4a23c' }}>{formatMoney(offer.amount)}</b> por <b>{offer.playerName}</b></div>
      )}
      {!countering ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleAccept} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: '#7fd99a', color: '#0B1A12', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Aceitar</button>
          {!isLoan && <button onClick={() => setCountering(true)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid rgba(212,162,60,0.4)', background: 'rgba(212,162,60,0.1)', color: '#d4a23c', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Contraproposta</button>}
          <button onClick={handleReject} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#F4F1EA', fontSize: 12, cursor: 'pointer' }}>Rejeitar</button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>Peça um valor maior — se o clube topar pagar, a venda sai nesse valor; se achar caro demais, desiste e a proposta cai.</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={counterInput ? Number(counterInput).toLocaleString('pt-BR') : ''}
              onChange={e => setCounterInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder={`Maior que ${formatMoney(offer.amount)}`}
              inputMode="numeric"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={handleSendCounter}
              disabled={counterAmount <= offer.amount}
              style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: counterAmount > offer.amount ? '#d4a23c' : 'rgba(212,162,60,0.3)', color: '#0B1A12', fontWeight: 700, fontSize: 12, cursor: counterAmount > offer.amount ? 'pointer' : 'default' }}
            >Enviar</button>
            <button onClick={() => { setCountering(false); setCounterInput(''); }} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#F4F1EA', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Mensagem informativa depois de aceitar/rejeitar/contrapropor — pedido
// explícito do usuário (2026-11-06: antes a proposta só sumia da lista
// sem dizer o que aconteceu).
function offerResultMessage(result) {
  if (result.type === 'accept') return { ok: true, text: `✅ Proposta aceita — ${result.playerName} foi vendido para o ${result.clubName} por ${formatMoney(result.amount)}.` };
  if (result.type === 'reject') return { ok: false, text: `❌ Proposta por ${result.playerName} recusada.` };
  if (result.type === 'loan-accept') return { ok: true, text: `✅ Empréstimo aceito — ${result.playerName} foi pro ${result.clubName} por ${result.loanLabel}.` };
  if (result.type === 'loan-reject') return { ok: false, text: `❌ Proposta de empréstimo por ${result.playerName} recusada.` };
  if (result.type === 'counter-accept') return { ok: true, text: `✅ Contraproposta aceita — ${result.playerName} foi vendido para o ${result.clubName} por ${formatMoney(result.amount)}.` };
  return { ok: false, text: `↩️ O ${result.clubName} não topou pagar ${formatMoney(result.amount)} por ${result.playerName} e desistiu do negócio.` };
}

function OffersTab({ save, onRespond, onCounterOffer }) {
  const [lastResult, setLastResult] = useState(null);
  if (!save.pendingOffers?.length) {
    return (
      <div>
        {lastResult && (() => {
          const msg = offerResultMessage(lastResult);
          return (
            <div style={{
              padding: '9px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12.5,
              background: msg.ok ? 'rgba(127,217,154,0.1)' : 'rgba(224,80,80,0.1)',
              border: `1px solid ${msg.ok ? 'rgba(127,217,154,0.35)' : 'rgba(224,80,80,0.35)'}`,
              color: msg.ok ? '#7fd99a' : '#e05050',
            }}>{msg.text}</div>
          );
        })()}
        <p style={{ fontSize: 13, opacity: 0.6 }}>Nenhuma proposta por enquanto — elas podem surgir durante uma janela de transferências aberta (janeiro, ou julho), quando um clube de IA se interessa por algum jogador seu (pra comprar ou pra pegar emprestado). Colocar o jogador na lista de transferências ou na lista de empréstimo (aba "Meu elenco") aumenta a chance.</p>
      </div>
    );
  }
  return (
    <div>
      {lastResult && (() => {
        const msg = offerResultMessage(lastResult);
        return (
          <div style={{
            padding: '9px 12px', borderRadius: 8, marginBottom: 10, fontSize: 12.5,
            background: msg.ok ? 'rgba(127,217,154,0.1)' : 'rgba(224,80,80,0.1)',
            border: `1px solid ${msg.ok ? 'rgba(127,217,154,0.35)' : 'rgba(224,80,80,0.35)'}`,
            color: msg.ok ? '#7fd99a' : '#e05050',
          }}>{msg.text}</div>
        );
      })()}
      {save.pendingOffers.map((offer, idx) => (
        <OfferCard key={`${offer.fromClubId}-${offer.playerName}-${idx}`} offer={offer} idx={idx} onRespond={onRespond} onCounterOffer={onCounterOffer} onResult={setLastResult} />
      ))}
    </div>
  );
}

const HISTORY_FILTERS = [
  { id: '', label: 'Todos' },
  { id: 'user-buy', label: 'Comprados' },
  { id: 'user-sell', label: 'Vendidos' },
  { id: 'loan-out', label: 'Emprestados' },
  { id: 'loan-in', label: 'Pegos emprestado' },
  { id: 'retired', label: 'Aposentados' },
];

// Uma linha do histórico, já com ícone/texto/cor prontos pra UI — cada tipo
// de evento (comprado/vendido/emprestado/pegado emprestado/aposentado) lê
// os clubes certos pra formar a frase (quem compra/empresta é sempre o
// outro lado do negócio, nunca o próprio usuário, que a frase já assume).
function historyLine(entry, myClubId) {
  const otherId = entry.fromClubId === myClubId ? entry.toClubId : entry.fromClubId;
  const otherTeam = TEAMS.find(t => t.id === otherId);
  switch (entry.type) {
    case 'user-buy':
      return { icon: '📥', color: '#7fd99a', text: `Comprado — ${entry.playerName} do ${otherTeam?.club} por ${formatMoney(entry.amount)}` };
    case 'user-sell':
      return { icon: '📤', color: '#e0a33d', text: `Vendido — ${entry.playerName} para o ${otherTeam?.club} por ${formatMoney(entry.amount)}` };
    case 'loan-out':
      return { icon: '🔁', color: '#6fb8e0', text: `Emprestado — ${entry.playerName} para o ${otherTeam?.club}${entry.durationLabel ? ` por ${entry.durationLabel}` : ''}` };
    case 'loan-in':
      return { icon: '🔁', color: '#6fb8e0', text: `Pego emprestado — ${entry.playerName} do ${otherTeam?.club}${entry.durationLabel ? ` por ${entry.durationLabel}` : ''}` };
    case 'retired':
      return { icon: '🏁', color: 'rgba(244,241,234,0.6)', text: `Aposentado — ${entry.playerName}` };
    default:
      return { icon: '🔄', color: 'rgba(244,241,234,0.6)', text: entry.playerName };
  }
}

function HistoryTab({ save }) {
  const [filter, setFilter] = useState('');
  const myId = save.myClubId;
  const mine = (save.transferLog || []).filter(e => e.fromClubId === myId || e.toClubId === myId);
  const filtered = (filter ? mine.filter(e => e.type === filter) : mine).slice().reverse(); // mais recente primeiro
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {HISTORY_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${filter === f.id ? '#d4a23c' : 'rgba(255,255,255,0.15)'}`,
              background: filter === f.id ? 'rgba(212,162,60,0.12)' : 'transparent',
              color: filter === f.id ? '#d4a23c' : 'rgba(244,241,234,0.55)',
            }}
          >{f.label}</button>
        ))}
      </div>
      {filtered.length === 0 && <p style={{ fontSize: 12.5, opacity: 0.5, textAlign: 'center', padding: '12px 0' }}>Nenhum registro {filter ? 'desse tipo ' : ''}ainda.</p>}
      {filtered.map((entry, i) => {
        const line = historyLine(entry, myId);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 6 }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>{line.icon}</span>
            <span style={{ flex: 1, fontSize: 12.5, color: line.color }}>{line.text}</span>
            <span style={{ fontSize: 10.5, opacity: 0.4, fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>T{entry.season} · d{entry.day}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CareerTransferMarket({ save, onPropose, onRespondOffer, onCounterOffer, onToggleListed, onToggleLoanList, onRequestLoan, onBack }) {
  const [tab, setTab] = useState(save.pendingOffers?.length ? 'offers' : 'mine');
  const windowOpen = isTransferWindowOpen(save.calendarDay);
  return (
    <div style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={backButtonStyle}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 4 }}>Mercado de Transferências</h2>
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>Orçamento: <b style={{ color: '#d4a23c' }}>{formatMoney(save.clubs[save.myClubId].budget)}</b></p>
      <TransferWindowBadge day={save.calendarDay} style={{ marginBottom: 12 }} />
      <TabBar tab={tab} setTab={setTab} offerCount={save.pendingOffers?.length || 0} />
      {tab === 'mine' && <MyRosterTab save={save} onToggleListed={onToggleListed} onToggleLoanList={onToggleLoanList} windowOpen={windowOpen} />}
      {tab === 'other' && <OtherClubsTab save={save} onPropose={onPropose} onRequestLoan={onRequestLoan} windowOpen={windowOpen} />}
      {tab === 'offers' && <OffersTab save={save} onRespond={onRespondOffer} onCounterOffer={onCounterOffer} />}
      {tab === 'history' && <HistoryTab save={save} />}
    </div>
  );
}
