// Formação do Modo Carreira — campinho visual de verdade, igual os outros
// modos: escolhe o esquema tático, clica numa vaga vazia do campinho pra
// escolher quem joga ali (lista filtrada pelo elenco), clica numa vaga
// ocupada pra tirar o jogador de lá. Sem arrastar (clique só, de
// propósito — mais simples e funciona igual em touch/mouse). Editável
// quantas vezes quiser durante a temporada, reaberto a qualquer momento
// pelo hub. A escalação confirmada (save.myStarters/save.myBench) passa a
// valer de verdade nas partidas simuladas (ver teamForSim em
// simHelpers.js) — titular(11) + banco(até 12, escolhido aqui na tela)
// é todo mundo que entra em campo; quem sobra é "reserva dos reservas",
// nem repositor de lesão (pedido explícito do usuário 2026-11-11).
//
// Criar/Carregar formação (mesmo pedido): `save.savedFormations` guarda
// presets nomeados (esquema+titulares+banco) — "Criar" salva a escalação
// atual da tela com um nome; "Carregar" troca a tela inteira por um
// preset salvo, mas ainda precisa confirmar pra valer de verdade (igual
// qualquer edição aqui).
import { useMemo, useState } from 'react';
import { ovrColor, posColor, posOrderIndex } from '../../lib/format.js';
import { FORMATIONS, buildPitchSlots, autoFillFromPool } from '../engine/formations.js';
import { backButtonStyle } from '../components/styles.js';

const DEFAULT_FORMATION = '4-3-3-misto';

// Reconstrói o titular de cada vaga ao abrir a tela. Se o esquema salvo
// bate com o atual, reaproveita a vaga EXATA de cada titular — mesma
// ordem slots[i] <-> save.myStarters[i] que handleConfirm usa pra
// gravar — em vez de reembaralhar tudo via autoFillFromPool (que só bate
// por posição PRIMÁRIA: perdia quem tinha sido escalado numa posição
// secundária, ex. um ponta numa vaga de ATA, e podia trocar os titulares
// de um "2x ATA"/"2x MC" entre si sem nenhuma mudança real do usuário).
// Bug real reportado pelo usuário — "não tá confirmando a escalação
// quando eu mudo": o jogador escolhido sumia ao reabrir a tela. Só cai
// pro preenchimento automático pras vagas que sobrarem vazias (esquema
// mudou, ou o titular daquela vaga não existe mais no elenco — vendido/
// aposentado no fim de temporada).
function initialStarters(roster, save, slots, formationKey) {
  const rosterNames = new Set(roster.map(p => p.name));
  const starters = {};
  const usedNames = new Set();
  if (save.myFormationKey === formationKey && save.myStarters?.length === slots.length) {
    slots.forEach((slot, i) => {
      const name = save.myStarters[i];
      if (name && rosterNames.has(name) && !usedNames.has(name)) {
        starters[slot.key] = name;
        usedNames.add(name);
      }
    });
  }
  const emptySlots = slots.filter(s => !starters[s.key]);
  if (emptySlots.length > 0) {
    const preferred = (save.myStarters || [])
      .filter(n => rosterNames.has(n) && !usedNames.has(n))
      .map(n => roster.find(p => p.name === n))
      .filter(Boolean);
    const rest = [...roster].filter(p => !usedNames.has(p.name) && !preferred.some(q => q.name === p.name)).sort((a, b) => b.ovr - a.ovr);
    Object.assign(starters, autoFillFromPool([...preferred, ...rest], emptySlots));
  }
  return starters;
}

// Reconstrói a seleção de banco (até 12) ao abrir a tela — mesma ideia de
// `initialStarters`: reaproveita `save.myBench` filtrando quem já saiu do
// elenco (vendido/aposentado) ou virou titular nessa reabertura.
function initialBench(roster, save, starterNames) {
  const rosterNames = new Set(roster.map(p => p.name));
  const starterSet = new Set(starterNames);
  return (save.myBench || []).filter(n => rosterNames.has(n) && !starterSet.has(n)).slice(0, 12);
}

function PitchSlotCircle({ slot, player, pending, suspended, onClick }) {
  const c = posColor(slot.realPos);
  const filled = !!player;
  return (
    <div
      onClick={onClick}
      title={player ? `${player.name}${suspended ? ' — SUSPENSO, não pode jogar essa rodada' : ''} — clique pra tirar do time titular` : `Vazio (${slot.label}) — clique pra escolher quem joga aqui`}
      style={{
        position: 'absolute', left: `${slot.x}%`, top: `${slot.y}%`, transform: 'translate(-50%,-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', zIndex: filled ? 2 : 1,
        width: 56,
      }}
    >
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, fontFamily: "'Space Mono', monospace",
          background: pending ? 'rgba(212,162,60,0.35)' : filled ? c : 'rgba(255,255,255,0.08)',
          border: suspended ? '2.5px solid #e05050' : pending ? '2.5px solid #d4a23c' : filled ? '2px solid rgba(255,255,255,0.65)' : `1.5px dashed ${c}88`,
          color: filled ? '#0B1A12' : pending ? '#d4a23c' : `${c}cc`,
          boxShadow: suspended ? '0 0 14px rgba(224,80,80,0.6)' : pending ? '0 0 14px rgba(212,162,60,0.5)' : filled ? '0 3px 8px rgba(0,0,0,0.5)' : 'none',
        }}>
          {filled ? player.ovr : slot.label}
        </div>
        {suspended && <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 12 }}>🟥</span>}
      </div>
      {filled && (
        <div style={{
          fontSize: 9.5, fontWeight: 600, color: suspended ? '#e05050' : '#F4F1EA', textAlign: 'center', lineHeight: 1.1,
          textShadow: '0 1px 3px rgba(0,0,0,0.9)', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{player.name}</div>
      )}
    </div>
  );
}

function PitchField({ slots, starters, roster, pendingSlotKey, suspendedSet, onSlotClick }) {
  const byName = useMemo(() => Object.fromEntries(roster.map(p => [p.name, p])), [roster]);
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '0.68', borderRadius: 12, overflow: 'hidden',
      background: '#124d27',
      backgroundImage: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0.07) 0%, rgba(0,0,0,0.07) 14.3%, transparent 14.3%, transparent 28.6%)',
      border: '1px solid rgba(255,255,255,0.1)', marginBottom: 12,
    }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(255,255,255,0.3)' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 60, height: 60, border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '50%', transform: 'translate(-50%,-50%)' }} />
      <div style={{ position: 'absolute', top: 0, left: '18%', width: '64%', height: '15%', border: '1.5px solid rgba(255,255,255,0.3)', borderTop: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: '18%', width: '64%', height: '15%', border: '1.5px solid rgba(255,255,255,0.3)', borderBottom: 'none' }} />
      {slots.map(slot => (
        <PitchSlotCircle
          key={slot.key}
          slot={slot}
          player={starters[slot.key] ? byName[starters[slot.key]] : null}
          pending={pendingSlotKey === slot.key}
          suspended={!!starters[slot.key] && suspendedSet.has(starters[slot.key])}
          onClick={() => onSlotClick(slot.key)}
        />
      ))}
    </div>
  );
}

// Lista dos titulares atuais com dois selos por linha pra marcar "funções"
// (pedido explícito do usuário 2026-11-13): capitão (+2 OVR, igual já
// existe no Brasileirão clássico/Atual, ver `captainSlot`/App.jsx) e
// cobrador de pênalti (recurso novo, só aqui no Modo Carreira por enquanto
// — ver `isPenaltyTaker` em teamForSim/simHelpers.js e simAiMatch/App.jsx).
// Só um titular pode ser capitão e só um pode ser cobrador (podem ser a
// mesma pessoa). Clicar de novo no selo já ativo desmarca.
function StartersFunctionsList({ slots, starters, roster, captainName, penaltyTakerName, onToggleCaptain, onTogglePenalty }) {
  const byName = useMemo(() => Object.fromEntries(roster.map(p => [p.name, p])), [roster]);
  const list = slots
    .map(slot => ({ slot, name: starters[slot.key] }))
    .filter(x => x.name && byName[x.name])
    .sort((a, b) => posOrderIndex(byName[a.name].pos[0]) - posOrderIndex(byName[b.name].pos[0]));
  return (
    <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
      {list.map(({ name }) => {
        const p = byName[name];
        const isCap = captainName === name;
        const isPen = penaltyTakerName === name;
        return (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: (isCap || isPen) ? 'rgba(212,162,60,0.08)' : 'rgba(255,255,255,0.03)' }}>
            <span style={{ width: 26, fontSize: 10, fontWeight: 700, color: posColor(p.pos[0]), fontFamily: "'Space Mono', monospace" }}>{p.pos[0]}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 11.5, color: ovrColor(p.ovr), flexShrink: 0 }}>{p.ovr}</span>
            <button
              onClick={() => onToggleCaptain(name)}
              title={isCap ? 'Capitão — clique pra tirar' : 'Definir como capitão (+2 OVR)'}
              style={{
                flexShrink: 0, width: 26, height: 26, borderRadius: 7, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                border: `1px solid ${isCap ? 'rgba(212,162,60,0.6)' : 'rgba(255,255,255,0.15)'}`,
                background: isCap ? '#d4a23c' : 'transparent', color: isCap ? '#0B1A12' : 'rgba(244,241,234,0.5)',
              }}
            >C</button>
            <button
              onClick={() => onTogglePenalty(name)}
              title={isPen ? 'Cobrador de pênalti — clique pra tirar' : 'Definir como cobrador de pênalti'}
              style={{
                flexShrink: 0, width: 26, height: 26, borderRadius: 7, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                border: `1px solid ${isPen ? 'rgba(111,184,224,0.6)' : 'rgba(255,255,255,0.15)'}`,
                background: isPen ? '#6fb8e0' : 'transparent', color: isPen ? '#0B1A12' : 'rgba(244,241,234,0.5)',
              }}
            >P</button>
          </div>
        );
      })}
    </div>
  );
}

function PlayerPoolPicker({ pos, pool, suspendedSet, onPick, onCancel }) {
  // Filtra de verdade pela posição clicada (antes só ordenava, deixando o
  // elenco inteiro visível — incluindo goleiro/zagueiro numa vaga de
  // ponta, bug real reportado pelo usuário). `p.pos` pode ter mais de uma
  // posição (ex.: ['PD','ME']) — qualquer uma batendo já qualifica.
  // Quando ninguém do banco joga ali, cai pro banco inteiro (com aviso),
  // em vez de travar a escalação sem ter quem escalar.
  const compatible = pool.filter(p => p.pos.includes(pos));
  const usingFallback = compatible.length === 0 && pool.length > 0;
  const sorted = [...(usingFallback ? pool : compatible)].sort((a, b) => b.ovr - a.ovr);
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(212,162,60,0.08)', border: '1px solid rgba(212,162,60,0.3)', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#d4a23c' }}>Quem joga em {pos}?</div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'rgba(244,241,234,0.6)', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
      </div>
      {sorted.length === 0 && <p style={{ fontSize: 12, opacity: 0.5 }}>Todo mundo já tá escalado em outra vaga.</p>}
      {usingFallback && <p style={{ fontSize: 11, opacity: 0.55, marginBottom: 6 }}>Ninguém do banco joga de {pos} — mostrando o banco inteiro.</p>}
      <div style={{ display: 'grid', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
        {sorted.map(p => {
          const suspended = suspendedSet.has(p.name);
          return (
            <button
              key={p.name}
              onClick={() => !suspended && onPick(p.name)}
              disabled={suspended}
              title={suspended ? 'Suspenso — não pode ser escalado essa rodada' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, textAlign: 'left',
                cursor: suspended ? 'default' : 'pointer', opacity: suspended ? 0.5 : 1,
                background: suspended ? 'rgba(224,80,80,0.06)' : p.pos.includes(pos) ? 'rgba(127,217,154,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${suspended ? 'rgba(224,80,80,0.3)' : p.pos.includes(pos) ? 'rgba(127,217,154,0.3)' : 'rgba(255,255,255,0.08)'}`, color: '#F4F1EA',
              }}
            >
              <span style={{ width: 28, fontSize: 10, fontWeight: 700, color: posColor(p.pos[0]), fontFamily: "'Space Mono', monospace" }}>{p.pos[0]}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              {suspended && <span style={{ fontSize: 10, fontWeight: 700, color: '#e05050' }}>🟥 suspenso</span>}
              <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: ovrColor(p.ovr), fontSize: 12.5 }}>{p.ovr}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Bolinha de jogador do banco — mesma cara dos círculos do campinho
// (OVR dentro, cor por posição), num carrossel horizontal em vez da
// lista de pílulas de texto anterior. Ordenado por posição, então as
// bolinhas da mesma cor já ficam naturalmente agrupadas lado a lado
// (visual pedido pelo usuário: "separadas pela cor e por posição").
// Clicável agora (pedido explícito do usuário 2026-11-11: banco de até
// 12 — o resto do elenco é "reserva dos reservas", nem joga como
// repositor de lesão) — selecionado = vai pro banco de verdade; o resto
// só fica visível pra trocar, sem nenhuma ação própria além de clicar.
// Suspenso (bug reportado 2026-11-13: "hoje é possível deixar ele como
// reserva") não pode nem ENTRAR no banco — mesma regra que já bloqueia
// titular, mas faltava aqui (PlayerPoolPicker já bloqueava titular).
function BenchBubble({ p, selected, disabled, suspended, onClick }) {
  const c = posColor(p.pos[0]);
  const blocked = disabled || suspended;
  return (
    <button
      onClick={onClick}
      disabled={blocked}
      title={suspended ? 'Suspenso — não pode nem ficar no banco essa rodada' : selected ? 'No banco — clique pra tirar' : disabled ? 'Banco já tem 12 — tire alguém antes' : 'Clique pra colocar no banco'}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0, width: 60, scrollSnapAlign: 'start',
        background: 'none', border: 'none', padding: 0, cursor: blocked ? 'default' : 'pointer',
        opacity: suspended ? 0.4 : selected ? 1 : disabled ? 0.35 : 0.55,
      }}
    >
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, fontFamily: "'Space Mono', monospace",
          background: selected ? c : 'rgba(255,255,255,0.08)', color: selected ? '#0B1A12' : `${c}cc`,
          border: suspended ? '2px solid #e05050' : selected ? '2px solid rgba(255,255,255,0.65)' : `1.5px dashed ${c}88`,
          boxShadow: suspended ? '0 0 10px rgba(224,80,80,0.5)' : selected ? '0 3px 7px rgba(0,0,0,0.4)' : 'none',
        }}>{p.ovr}</div>
        {suspended && <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 11 }}>🟥</span>}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: suspended ? '#e05050' : c, fontFamily: "'Space Mono', monospace" }}>{p.pos[0]}</div>
      <div style={{ fontSize: 9, fontWeight: 600, textAlign: 'center', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: suspended ? '#e05050' : '#F4F1EA', opacity: 0.85 }}>{p.name}</div>
    </button>
  );
}

// Painel pra nomear e salvar a escalação atual (titulares+banco+esquema)
// como um preset novo em `save.savedFormations` — mesmo padrão visual
// inline dos outros painéis desta tela (ex. PlayerPoolPicker).
function SavePresetPanel({ onSave, onCancel }) {
  const [name, setName] = useState('');
  return (
    <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(212,162,60,0.08)', border: '1px solid rgba(212,162,60,0.3)' }}>
      <input
        value={name}
        onChange={e => setName(e.target.value.slice(0, 40))}
        placeholder="Nome da formação (ex.: Time reserva)"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, marginBottom: 8,
          border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#F4F1EA', fontSize: 12.5, outline: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => name.trim() && onSave(name.trim())}
          disabled={!name.trim()}
          style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: name.trim() ? '#d4a23c' : 'rgba(212,162,60,0.3)', color: '#0B1A12', fontWeight: 700, fontSize: 12, cursor: name.trim() ? 'pointer' : 'default' }}
        >Salvar</button>
        <button onClick={onCancel} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#F4F1EA', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
      </div>
    </div>
  );
}

// Lista de presets salvos pra escolher um e carregar na tela (ainda
// precisa confirmar escalação depois, igual qualquer edição) ou apagar.
function LoadPresetPanel({ presets, onLoad, onDelete, onCancel }) {
  return (
    <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(111,184,224,0.06)', border: '1px solid rgba(111,184,224,0.2)' }}>
      {presets.length === 0 && <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Nenhuma formação salva ainda — use "Criar formação" pra guardar a de agora.</p>}
      {presets.map(preset => (
        <div key={preset.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6, marginBottom: 4, background: 'rgba(255,255,255,0.03)' }}>
          <button onClick={() => onLoad(preset)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', color: '#F4F1EA', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {preset.name} <span style={{ opacity: 0.5, fontWeight: 400 }}>({FORMATIONS[preset.formationKey]?.label || preset.formationKey})</span>
          </button>
          <button onClick={() => onDelete(preset.id)} title="Apagar formação" style={{ background: 'none', border: 'none', color: 'rgba(224,80,80,0.75)', fontSize: 15, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>×</button>
        </div>
      ))}
      <button onClick={onCancel} style={{ marginTop: 2, background: 'none', border: 'none', color: 'rgba(244,241,234,0.5)', fontSize: 11, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Fechar</button>
    </div>
  );
}

function BenchCarousel({ players, benchSet, suspendedSet, onToggle }) {
  const sorted = [...players].sort((a, b) => posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]) || b.ovr - a.ovr);
  const full = benchSet.size >= 12;
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6, scrollSnapType: 'x proximity' }}>
      {sorted.map(p => {
        const selected = benchSet.has(p.name);
        const suspended = suspendedSet.has(p.name);
        return <BenchBubble key={p.name} p={p} selected={selected} disabled={!selected && full} suspended={suspended} onClick={() => !suspended && onToggle(p.name)} />;
      })}
    </div>
  );
}

export function CareerFormationScreen({ save, onConfirm, onSaveFormationPreset, onDeleteFormationPreset, onBack }) {
  // Jogador da categoria de base não pode ser escalado até ser promovido
  // ou completar 20 anos (ver CareerYouthScreen.jsx).
  const roster = save.clubs[save.myClubId].roster.filter(p => !p.inAcademy);
  const [formationKey, setFormationKey] = useState(() => (FORMATIONS[save.myFormationKey] ? save.myFormationKey : DEFAULT_FORMATION));
  const slots = useMemo(() => buildPitchSlots(formationKey), [formationKey]);
  const [starters, setStarters] = useState(() => initialStarters(roster, save, slots, formationKey));
  const [pendingSlotKey, setPendingSlotKey] = useState(null);
  // Banco de verdade (até 12, pedido explícito do usuário 2026-11-11) —
  // quem não for titular NEM estiver aqui vira "reserva dos reservas":
  // visível na lista pra trocar, mas não entra em campo nenhuma (ver
  // teamForSim em simHelpers.js).
  const [benchSelected, setBenchSelected] = useState(() => initialBench(roster, save, Object.values(starters)));
  const [presetPanel, setPresetPanel] = useState(null); // null | 'save' | 'load'
  // Funções do titular (pedido explícito do usuário 2026-11-13: "adicionar
  // capitão ganha mais 2 de overall e cobrador de pênalti também") — só
  // existem aqui no Modo Carreira por enquanto (ver plano). Reaproveita o
  // que já estava salvo SE ainda for um titular válido nessa reabertura.
  const [captainName, setCaptainName] = useState(() => {
    const names = new Set(Object.values(starters));
    return save.myCaptain && names.has(save.myCaptain) ? save.myCaptain : null;
  });
  const [penaltyTakerName, setPenaltyTakerName] = useState(() => {
    const names = new Set(Object.values(starters));
    return save.myPenaltyTaker && names.has(save.myPenaltyTaker) ? save.myPenaltyTaker : null;
  });

  // Jogador suspenso (3 amarelos ou vermelho na rodada passada, ver
  // applyUserDiscipline em seasonEngine.js) não pode ser confirmado como
  // titular essa rodada (pedido explícito do usuário 2026-11-12) NEM ficar
  // no banco de reservas (bug real reportado 2026-11-13: "hoje é possível
  // deixar ele como reserva" — suspenso não pode nem estar relacionado).
  const suspendedSet = useMemo(() => new Set(Object.entries(save.suspensions || {}).filter(([, left]) => left > 0).map(([name]) => name)), [save.suspensions]);
  const hasSuspendedStarter = Object.values(starters).some(name => suspendedSet.has(name));
  const hasSuspendedBench = benchSelected.some(name => suspendedSet.has(name));

  const byName = useMemo(() => Object.fromEntries(roster.map(p => [p.name, p])), [roster]);
  const placedNames = new Set(Object.values(starters).filter(Boolean));
  const bench = [...roster].filter(p => !placedNames.has(p.name)).sort((a, b) => b.ovr - a.ovr);
  const filledCount = Object.values(starters).filter(Boolean).length;
  const avgOvr = filledCount ? Math.round(Object.values(starters).filter(Boolean).reduce((s, n) => s + (byName[n]?.ovr || 0), 0) / filledCount) : 0;
  // Capitão/cobrador só valem se ainda forem titulares de verdade agora —
  // trocar de esquema/sugerir/limpar pode ter tirado quem tava marcado,
  // nesse caso pede pra escolher de novo (não carrega um nome inválido).
  const validCaptain = captainName && placedNames.has(captainName) ? captainName : null;
  const validPenaltyTaker = penaltyTakerName && placedNames.has(penaltyTakerName) ? penaltyTakerName : null;
  const handleToggleCaptain = (name) => setCaptainName(prev => (prev === name ? null : name));
  const handleTogglePenalty = (name) => setPenaltyTakerName(prev => (prev === name ? null : name));

  const handleSlotClick = (slotKey) => {
    if (starters[slotKey]) {
      setStarters(prev => { const next = { ...prev }; delete next[slotKey]; return next; });
      setPendingSlotKey(null);
    } else {
      setPendingSlotKey(prev => (prev === slotKey ? null : slotKey));
    }
  };

  const handlePick = (playerName) => {
    if (!pendingSlotKey) return;
    setStarters(prev => ({ ...prev, [pendingSlotKey]: playerName }));
    // Quem vira titular sai do banco — não dá pra ser as duas coisas.
    setBenchSelected(prev => prev.filter(n => n !== playerName));
    setPendingSlotKey(null);
  };

  const handleToggleBench = (playerName) => {
    setBenchSelected(prev => {
      if (prev.includes(playerName)) return prev.filter(n => n !== playerName);
      if (prev.length >= 12) return prev;
      return [...prev, playerName];
    });
  };

  const handleFormationChange = (nextKey) => {
    const nextSlots = buildPitchSlots(nextKey);
    // Troca de esquema tenta reaproveitar quem já tava escalado (preferência
    // por bater a posição na vaga nova); quem não encaixa volta pro banco.
    const currentNames = slots.map(s => starters[s.key]).filter(Boolean);
    const pool = [...currentNames.map(n => byName[n]), ...roster.filter(p => !currentNames.includes(p.name))];
    const nextStarters = autoFillFromPool(pool, nextSlots);
    setFormationKey(nextKey);
    setStarters(nextStarters);
    const nextStarterSet = new Set(Object.values(nextStarters));
    setBenchSelected(prev => prev.filter(n => !nextStarterSet.has(n)));
    setPendingSlotKey(null);
  };

  const handleSuggest = () => {
    const sorted = [...roster].sort((a, b) => b.ovr - a.ovr);
    const nextStarters = autoFillFromPool(sorted, slots);
    setStarters(nextStarters);
    // Sugere também o banco: os 12 melhores que sobraram, pra não deixar o
    // usuário tendo que montar o banco inteiro na mão toda vez.
    const nextStarterSet = new Set(Object.values(nextStarters).filter(Boolean));
    setBenchSelected(sorted.filter(p => !nextStarterSet.has(p.name)).slice(0, 12).map(p => p.name));
    setPendingSlotKey(null);
  };

  const handleClear = () => {
    setStarters({});
    setBenchSelected([]);
    setPendingSlotKey(null);
  };

  // Criar/Carregar formação (pedido explícito do usuário 2026-11-11) —
  // "Criar" salva o esquema+titulares+banco ATUAIS da tela como um preset
  // novo; "Carregar" troca a tela inteira por um preset salvo (ainda
  // precisa clicar "Confirmar escalação" pra valer de verdade, igual
  // qualquer edição aqui).
  const handleSavePreset = (name) => {
    const myStarters = slots.map(s => starters[s.key]).filter(Boolean);
    onSaveFormationPreset({ name, formationKey, starters: myStarters, bench: benchSelected });
    setPresetPanel(null);
  };

  const handleLoadPreset = (preset) => {
    const nextSlots = buildPitchSlots(preset.formationKey);
    const rosterNames = new Set(roster.map(p => p.name));
    const nextStarters = {};
    nextSlots.forEach((slot, i) => {
      const name = preset.starters[i];
      if (name && rosterNames.has(name)) nextStarters[slot.key] = name;
    });
    const nextStarterNames = new Set(Object.values(nextStarters));
    setFormationKey(preset.formationKey);
    setStarters(nextStarters);
    setBenchSelected((preset.bench || []).filter(n => rosterNames.has(n) && !nextStarterNames.has(n)).slice(0, 12));
    setPendingSlotKey(null);
    setPresetPanel(null);
  };

  const canConfirm = filledCount === 11 && !hasSuspendedStarter && !hasSuspendedBench && !!validCaptain && !!validPenaltyTaker;
  const handleConfirm = () => {
    const myStarters = slots.map(s => starters[s.key]).filter(Boolean);
    onConfirm({
      myStarters, myBench: benchSelected, myFormationLabel: FORMATIONS[formationKey].label, myFormationKey: formationKey,
      myCaptain: validCaptain, myPenaltyTaker: validPenaltyTaker,
    });
  };

  const pendingPos = pendingSlotKey ? slots.find(s => s.key === pendingSlotKey)?.realPos : null;

  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <button onClick={onBack} style={backButtonStyle}>← Voltar</button>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, marginBottom: 4 }}>Formação</h2>
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>Clique numa vaga do campinho pra escalar ou tirar um jogador — edite quantas vezes quiser durante a temporada. OVR titular médio {avgOvr}. Escolha também até 12 reservas no banco mais abaixo — quem não for titular nem estiver no banco não entra em campo.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select
          value={formationKey}
          onChange={e => handleFormationChange(e.target.value)}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.04)', color: '#F4F1EA', fontSize: 12.5, outline: 'none', colorScheme: 'dark',
          }}
        >
          {Object.entries(FORMATIONS).map(([key, f]) => (
            <option key={key} value={key} style={{ background: '#13241a', color: '#F4F1EA' }}>{f.label}</option>
          ))}
        </select>
        <button onClick={handleSuggest} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '0 12px', fontSize: 11, color: 'rgba(244,241,234,0.7)', cursor: 'pointer' }}>
          🪄 Sugerir
        </button>
        <button onClick={handleClear} style={{ background: 'none', border: '1px solid rgba(224,80,80,0.35)', borderRadius: 8, padding: '0 12px', fontSize: 11, color: '#e08080', cursor: 'pointer' }}>
          🧹 Limpar
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setPresetPanel(prev => (prev === 'save' ? null : 'save'))}
          style={{ flex: 1, background: 'none', border: `1px solid ${presetPanel === 'save' ? 'rgba(212,162,60,0.5)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, padding: '8px 0', fontSize: 11.5, fontWeight: 700, color: presetPanel === 'save' ? '#d4a23c' : 'rgba(244,241,234,0.7)', cursor: 'pointer' }}
        >💾 Criar formação</button>
        <button
          onClick={() => setPresetPanel(prev => (prev === 'load' ? null : 'load'))}
          style={{ flex: 1, background: 'none', border: `1px solid ${presetPanel === 'load' ? 'rgba(111,184,224,0.5)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, padding: '8px 0', fontSize: 11.5, fontWeight: 700, color: presetPanel === 'load' ? '#6fb8e0' : 'rgba(244,241,234,0.7)', cursor: 'pointer' }}
        >📂 Carregar formação</button>
      </div>
      {presetPanel === 'save' && <SavePresetPanel onSave={handleSavePreset} onCancel={() => setPresetPanel(null)} />}
      {presetPanel === 'load' && (
        <LoadPresetPanel presets={save.savedFormations || []} onLoad={handleLoadPreset} onDelete={onDeleteFormationPreset} onCancel={() => setPresetPanel(null)} />
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: filledCount === 11 ? '#7fd99a' : '#d4a23c', marginBottom: 8 }}>Titulares: {filledCount}/11</div>

      <PitchField slots={slots} starters={starters} roster={roster} pendingSlotKey={pendingSlotKey} suspendedSet={suspendedSet} onSlotClick={handleSlotClick} />

      {pendingSlotKey && (
        <PlayerPoolPicker pos={pendingPos} pool={bench} suspendedSet={suspendedSet} onPick={handlePick} onCancel={() => setPendingSlotKey(null)} />
      )}
      {hasSuspendedStarter && (
        <p style={{ fontSize: 11.5, color: '#e05050', marginBottom: 10 }}>🟥 Tem jogador suspenso na escalação — tire ele antes de confirmar.</p>
      )}

      {filledCount === 11 && (
        <>
          <div style={{
            textAlign: 'center', fontSize: 11.5, padding: '8px 12px', marginBottom: 10, borderRadius: 8,
            background: (validCaptain && validPenaltyTaker) ? 'rgba(212,162,60,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${(validCaptain && validPenaltyTaker) ? 'rgba(212,162,60,0.35)' : 'rgba(255,255,255,0.08)'}`,
            color: (validCaptain && validPenaltyTaker) ? '#d4a23c' : 'rgba(255,255,255,0.5)',
          }}>
            {validCaptain && validPenaltyTaker
              ? `Capitão: ${validCaptain} (+2 OVR) · Cobrador de pênalti: ${validPenaltyTaker}`
              : 'Toque em "C" pra definir o capitão (+2 OVR) e em "P" pra definir o cobrador de pênalti — os dois são obrigatórios.'}
          </div>
          <StartersFunctionsList
            slots={slots} starters={starters} roster={roster}
            captainName={validCaptain} penaltyTakerName={validPenaltyTaker}
            onToggleCaptain={handleToggleCaptain} onTogglePenalty={handleTogglePenalty}
          />
        </>
      )}

      <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        Banco: <span style={{ color: benchSelected.length === 12 ? '#7fd99a' : '#d4a23c' }}>{benchSelected.length}/12</span> · reserva dos reservas: {Math.max(0, bench.length - benchSelected.length)}
      </div>
      {hasSuspendedBench && (
        <p style={{ fontSize: 11.5, color: '#e05050', marginBottom: 10 }}>🟥 Tem suspenso no banco — tire ele antes de confirmar (suspenso não pode nem ficar relacionado).</p>
      )}
      <div style={{ marginBottom: 16 }}>
        <BenchCarousel players={bench} benchSet={new Set(benchSelected)} suspendedSet={suspendedSet} onToggle={handleToggleBench} />
      </div>

      <button onClick={handleConfirm} disabled={!canConfirm} style={{
        width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', cursor: canConfirm ? 'pointer' : 'default',
        background: canConfirm ? '#d4a23c' : 'rgba(212,162,60,0.3)', color: '#0B1A12', fontSize: 15, fontWeight: 700,
      }}>
        {canConfirm
          ? 'Confirmar escalação →'
          : filledCount < 11
            ? `Escolha mais ${11 - filledCount} titular${11 - filledCount > 1 ? 'es' : ''}`
            : hasSuspendedStarter
              ? 'Tire o suspenso da escalação'
              : hasSuspendedBench
                ? 'Tire o suspenso do banco'
                : !validCaptain
                  ? 'Escolha um capitão'
                  : 'Escolha um cobrador de pênalti'}
      </button>
    </div>
  );
}
