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
import { SERIE_A_2026_TEAM_IDS, SERIE_B_2026_TEAM_IDS } from '../../data/career-clubs.js';
import { computePlayerValue } from '../engine/pricing.js';
import { MIN_SQUAD_SIZE } from '../engine/rosterStore.js';
import { isTransferWindowOpen } from '../engine/calendar.js';
import { TransferWindowBadge } from '../components/TransferWindowBadge.jsx';
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

function filterPlayers(roster, query, pos) {
  const q = normalize(query.trim());
  // Filtra pela posição PRINCIPAL (pos[0], a mesma que aparece no badge da
  // linha) — não por "p.pos.includes(pos)", que mostraria um jogador
  // versátil (ex.: cadastrado como ['MEI','ATA']) com o badge "MEI" dentro
  // do filtro "ATA", o que pareceria um resultado errado pra quem filtrou.
  return roster
    .filter(p => (!q || normalize(p.name).includes(q)) && (!pos || p.pos[0] === pos))
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

function PlayerSearchBar({ query, setQuery, pos, setPos, resultCount }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="🔍 Buscar jogador pelo nome..." style={{ ...inputStyle, flex: 1 }} />
        <select value={pos} onChange={e => setPos(e.target.value)} style={{ ...inputStyle, flexShrink: 0, colorScheme: 'dark' }}>
          <option value="" style={{ background: '#13241a', color: '#F4F1EA' }}>Todas posições</option>
          {POSITIONS.map(p => <option key={p} value={p} style={{ background: '#13241a', color: '#F4F1EA' }}>{p}</option>)}
        </select>
      </div>
      {(query || pos) && <div style={{ fontSize: 11, opacity: 0.5, marginTop: 5 }}>{resultCount} jogador{resultCount === 1 ? '' : 'es'} encontrado{resultCount === 1 ? '' : 's'}</div>}
    </div>
  );
}

function TabBar({ tab, setTab, offerCount }) {
  const tabs = [
    { id: 'mine', label: 'Meu elenco' },
    { id: 'other', label: 'Outros clubes' },
    { id: 'offers', label: `Propostas${offerCount ? ` (${offerCount})` : ''}` },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            flex: 1, padding: '8px 4px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
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

function MyRosterTab({ save, onToggleListed, windowOpen }) {
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState('');
  const roster = save.clubs[save.myClubId].roster;
  const transferList = save.transferList || [];
  const filtered = filterPlayers(roster, query, pos);
  return (
    <div>
      {!windowOpen && <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>Janela fechada — pode listar jogadores agora, mas as propostas só chegam quando ela abrir (janeiro, ou julho-agosto).</p>}
      {roster.length <= MIN_SQUAD_SIZE && <p style={{ fontSize: 12, color: '#e0a33d', marginBottom: 10 }}>Elenco no mínimo de {MIN_SQUAD_SIZE} jogadores — mesmo que venha proposta, não vai dar pra vender até o elenco crescer.</p>}
      <p style={{ fontSize: 11.5, opacity: 0.55, marginBottom: 10, lineHeight: 1.4 }}>📋 Não dá pra vender direto — coloque o jogador na lista de transferências (aumenta em 50% a chance de vir proposta por ele) e aguarde alguém se interessar. Aceite, rejeite ou mande uma contraproposta na aba Propostas.</p>
      <PlayerSearchBar query={query} setQuery={setQuery} pos={pos} setPos={setPos} resultCount={filtered.length} />
      {filtered.length === 0 && <p style={{ fontSize: 12.5, opacity: 0.5, textAlign: 'center', padding: '12px 0' }}>Nenhum jogador encontrado com esse filtro.</p>}
      {filtered.map(p => {
        const value = computePlayerValue(p, save.myClubId);
        const listed = transferList.includes(p.name);
        return (
          <PlayerRowShell key={p.name} pos={p.pos[0]}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <PosBadge pos={p.pos[0]} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: ovrColor(p.ovr), fontSize: 13 }}>{p.ovr}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, opacity: 0.7 }}>{formatMoney(value)}</span>
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
function ProposeRow({ player, price, enabled, disabledReason, onPropose }) {
  const [proposing, setProposing] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const amount = amountInput ? parseInt(amountInput, 10) : 0;

  const handleOpen = () => {
    setAmountInput(String(price));
    setProposing(true);
  };
  const handleSend = () => {
    if (amount <= 0) return;
    onPropose(player.name, amount);
    setProposing(false);
    setAmountInput('');
  };

  return (
    <PlayerRowShell pos={player.pos[0]}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PosBadge pos={player.pos[0]} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: ovrColor(player.ovr), fontSize: 13 }}>{player.ovr}</span>
      </div>
      {!proposing ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, opacity: 0.7 }}>Valor de mercado: {formatMoney(price)}</span>
          <button
            onClick={handleOpen}
            disabled={!enabled}
            title={disabledReason}
            style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: enabled ? 'pointer' : 'default',
              border: '1px solid rgba(127,217,154,0.4)', background: enabled ? 'rgba(127,217,154,0.12)' : 'transparent',
              color: enabled ? '#7fd99a' : 'rgba(127,217,154,0.3)',
            }}
          >💰 Fazer proposta</button>
        </div>
      ) : (
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
            <button onClick={() => setProposing(false)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#F4F1EA', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}
    </PlayerRowShell>
  );
}

function ClubRosterList({ save, clubId, onPropose, windowOpen }) {
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState('');
  const [lastResult, setLastResult] = useState(null); // { playerName, accepted, reason, price }
  const team = TEAMS.find(t => t.id === clubId);
  const logo = CLUB_LOGOS[team.club];
  const roster = save.clubs[clubId].roster;
  const myBudget = save.clubs[save.myClubId].budget;
  const sellerCanSell = roster.length > MIN_SQUAD_SIZE;
  const filtered = filterPlayers(roster, query, pos);

  const handlePropose = (playerName, amount) => {
    const res = onPropose(clubId, playerName, amount);
    setLastResult({ playerName, ...res });
  };

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
      <PlayerSearchBar query={query} setQuery={setQuery} pos={pos} setPos={setPos} resultCount={filtered.length} />
      {filtered.length === 0 && <p style={{ fontSize: 12.5, opacity: 0.5, textAlign: 'center', padding: '12px 0' }}>Nenhum jogador encontrado com esse filtro.</p>}
      {filtered.map(p => {
        const price = computePlayerValue(p, clubId);
        const canAfford = myBudget >= price * 0.5; // precisa dar pra propor pelo menos um valor com chance real
        const enabled = windowOpen && canAfford && sellerCanSell;
        const disabledReason = !windowOpen ? 'Janela de transferências fechada' : !canAfford ? 'Orçamento insuficiente pra uma proposta com chance real' : !sellerCanSell ? 'Clube vendedor no mínimo de elenco' : '';
        return (
          <ProposeRow key={p.name} player={p} price={price} enabled={enabled} disabledReason={disabledReason} onPropose={handlePropose} />
        );
      })}
    </div>
  );
}

function OtherClubsTab({ save, onPropose, windowOpen }) {
  const [clubId, setClubId] = useState(null);
  const [clubQuery, setClubQuery] = useState('');
  const [division, setDivision] = useState('A');

  if (clubId) {
    return (
      <div>
        <button onClick={() => setClubId(null)} style={{ background: 'none', border: 'none', color: '#d4a23c', fontSize: 12, cursor: 'pointer', marginBottom: 10, padding: 0 }}>← Outro clube</button>
        <ClubRosterList key={clubId} save={save} clubId={clubId} onPropose={onPropose} windowOpen={windowOpen} />
      </div>
    );
  }

  const idsForDivision = division === 'A' ? SERIE_A_2026_TEAM_IDS : SERIE_B_2026_TEAM_IDS;
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

function OfferCard({ offer, idx, onRespond, onCounterOffer }) {
  const [countering, setCountering] = useState(false);
  const [counterInput, setCounterInput] = useState('');
  const buyerTeam = TEAMS.find(t => t.id === offer.fromClubId);
  const counterAmount = counterInput ? parseInt(counterInput, 10) : 0;

  const handleSendCounter = () => {
    if (counterAmount <= offer.amount) return;
    onCounterOffer(idx, counterAmount);
    setCountering(false);
    setCounterInput('');
  };

  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
      <div style={{ fontSize: 13, marginBottom: 6 }}><b>{buyerTeam?.club}</b> oferece <b style={{ color: '#d4a23c' }}>{formatMoney(offer.amount)}</b> por <b>{offer.playerName}</b></div>
      {!countering ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onRespond(idx, true)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: '#7fd99a', color: '#0B1A12', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Aceitar</button>
          <button onClick={() => setCountering(true)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid rgba(212,162,60,0.4)', background: 'rgba(212,162,60,0.1)', color: '#d4a23c', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Contraproposta</button>
          <button onClick={() => onRespond(idx, false)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#F4F1EA', fontSize: 12, cursor: 'pointer' }}>Rejeitar</button>
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

function OffersTab({ save, onRespond, onCounterOffer }) {
  if (!save.pendingOffers?.length) {
    return <p style={{ fontSize: 13, opacity: 0.6 }}>Nenhuma proposta por enquanto — elas podem surgir durante uma janela de transferências aberta (janeiro, ou julho-agosto), quando um clube de IA se interessa por algum jogador seu. Colocar o jogador na lista de transferências (aba "Meu elenco") aumenta a chance.</p>;
  }
  return (
    <div>
      {save.pendingOffers.map((offer, idx) => (
        <OfferCard key={`${offer.fromClubId}-${offer.playerName}-${idx}`} offer={offer} idx={idx} onRespond={onRespond} onCounterOffer={onCounterOffer} />
      ))}
    </div>
  );
}

export function CareerTransferMarket({ save, onPropose, onRespondOffer, onCounterOffer, onToggleListed, onBack }) {
  const [tab, setTab] = useState(save.pendingOffers?.length ? 'offers' : 'mine');
  const windowOpen = isTransferWindowOpen(save.calendarDay);
  return (
    <div style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#d4a23c', fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: 0 }}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 4 }}>Mercado de Transferências</h2>
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 10 }}>Orçamento: <b style={{ color: '#d4a23c' }}>{formatMoney(save.clubs[save.myClubId].budget)}</b></p>
      <TransferWindowBadge day={save.calendarDay} style={{ marginBottom: 12 }} />
      <TabBar tab={tab} setTab={setTab} offerCount={save.pendingOffers?.length || 0} />
      {tab === 'mine' && <MyRosterTab save={save} onToggleListed={onToggleListed} windowOpen={windowOpen} />}
      {tab === 'other' && <OtherClubsTab save={save} onPropose={onPropose} windowOpen={windowOpen} />}
      {tab === 'offers' && <OffersTab save={save} onRespond={onRespondOffer} onCounterOffer={onCounterOffer} />}
    </div>
  );
}
