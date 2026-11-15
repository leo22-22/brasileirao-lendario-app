// Painel de substituição / ajuste tático com o jogo pausado
// (jogo-substituicoes-manual-mockup.html). Só apresentação e fila local: as
// trocas confirmadas passam, uma a uma, pelo MESMO applyLiveSub do App.jsx
// (limite de 5 trocas, 3 paradas fora o intervalo, quem saiu não volta,
// compatibilidade de posição), então as regras são as de sempre. Várias
// trocas confirmadas juntas acontecem no mesmo minuto = 1 parada.
// Usado por todos os modos em que a pessoa controla o time (clássicos, Copa,
// Supercopa, multiplayer). O Modo Carreira tem o próprio painel.
import { useMemo, useState } from 'react';
import { Modal, Icon } from '../ui/index.jsx';
import { PitchSurface, PlayerDot } from '../components/football/Pitch.jsx';
import { posSector, posOrderIndex } from '../lib/format.js';
import { teamStrength, canMakeManualSub, subStopsUsed, MAX_SUBS, MAX_SUB_STOPS } from '../App.jsx';
import './substitutionModal.css';

const POS_NAME = {
  GOL: 'goleiro', LD: 'lateral-direito', LE: 'lateral-esquerdo', ZAG: 'zagueiro', VOL: 'volante', MC: 'meio-campista',
  MD: 'meia-direita', ME: 'meia-esquerda', MEI: 'meia', PD: 'ponta-direita', PE: 'ponta-esquerda', ATA: 'atacante',
};
const fmt1 = (n) => n.toFixed(1).replace('.', ',');
const isHalftime = (m) => m === 45 || m === 46;

function PosChip({ pos }) {
  return <span className={`sbm-pos sbm-${posSector(pos)}`}>{pos}</span>;
}

// Compatibilidade com a vaga — a regra que vale continua a de sempre: só
// entra quem joga na posição da vaga. Setor/fora de posição são informação.
function fitOf(player, realPos) {
  if ((player.pos || []).includes(realPos)) return 'ok';
  if ((player.pos || []).some(p => posSector(p) === posSector(realPos))) return 'mid';
  return 'no';
}
const FIT_LABEL = { ok: 'Mesma posição', mid: 'Mesmo setor', no: 'Fora de posição' };

function Squares({ used, queued, total }) {
  return (
    <span className="sbm-sq" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => <i key={i} className={i < used ? 'u' : i < used + queued ? 'p' : undefined} />)}
    </span>
  );
}

/**
 * header: { eyebrow, home: { name, crest }, away: { name, crest }, score: { home, away } }
 * lineup: objeto slotKey → jogador (titulares e banco, isBench). slots: pitchSlots.
 * onApplySub(starterKey, benchPlayer): troca de verdade (App.jsx). onResume: volta ao jogo.
 * tacticalPitch: o campo de arrastar (ajuste tático) já pronto.
 */
export function SubstitutionModal({
  header, myTeamId, liveEvents = [], forcedSubReason, lineup, slots, subbedOutNames = [], manualSubs = [], minute = 0,
  unavailableNames, onApplySub, onResume, tacticalPitch,
}) {
  const [tab, setTab] = useState('sub');
  const [queue, setQueue] = useState([]); // [{ outName, inName, pos }]
  const [sort, setSort] = useState('fit');
  const [announce, setAnnounce] = useState('');
  const forcedKey = forcedSubReason ? Object.keys(lineup).find(k => lineup[k]?.name === forcedSubReason && !lineup[k]?.isBench) : null;
  const [outKey, setOutKey] = useState(forcedKey || null);

  const starterSlots = slots.filter(s => !s.isBench && lineup[s.key] && !lineup[s.key].isBench);
  const redNames = new Set(liveEvents.filter(ev => ev.type === 'red' && ev.teamId === myTeamId).map(ev => ev.player));
  const yellowNames = new Set(liveEvents.filter(ev => ev.type === 'yellow' && ev.teamId === myTeamId).map(ev => ev.player));
  const queuedOut = new Map(queue.map(q => [q.outName, q]));
  const queuedIn = new Set(queue.map(q => q.inName));

  const left = MAX_SUBS - manualSubs.length;
  const stopsUsed = subStopsUsed(manualSubs);
  const opensStop = !isHalftime(minute) && !manualSubs.some(s => s.minute === minute);
  const canQueueMore = canMakeManualSub(manualSubs, minute) && queue.length < left;
  const blockReason = manualSubs.length + queue.length >= MAX_SUBS
    ? 'Sem trocas restantes (limite de 5)'
    : !canMakeManualSub(manualSubs, minute) ? 'As 3 paradas já foram usadas — só dá pra trocar no intervalo' : null;

  const outPlayer = outKey ? lineup[outKey] : null;
  const outSlot = outKey ? slots.find(s => s.key === outKey) : null;

  const bench = useMemo(() => {
    const list = Object.values(lineup).filter(p => p?.isBench && !subbedOutNames.includes(p.name) && !unavailableNames?.has(p.name));
    const realPos = outSlot?.realPos;
    const rank = { ok: 0, mid: 1, no: 2 };
    return list
      .map(p => ({ p, fit: realPos ? fitOf(p, realPos) : null }))
      .sort((a, b) => (sort === 'fit' && a.fit && b.fit ? rank[a.fit] - rank[b.fit] : 0) || b.p.ovr - a.p.ovr || posOrderIndex(a.p.pos?.[0]) - posOrderIndex(b.p.pos?.[0]));
  }, [lineup, subbedOutNames, unavailableNames, outSlot, sort]);

  // OVR do time em campo: titulares de agora × com a fila aplicada (mesma
  // função de força do jogo).
  const ovrNow = teamStrength(Object.fromEntries(starterSlots.map(s => [s.key, lineup[s.key]])));
  const ovrAfter = teamStrength(Object.fromEntries(starterSlots.map(s => {
    const p = lineup[s.key];
    const q = queuedOut.get(p.name);
    const inP = q ? Object.values(lineup).find(x => x.name === q.inName) : null;
    return [s.key, inP ? { ...inP, isBench: false } : p];
  })));

  const enqueue = (inP) => {
    if (!outPlayer || !canQueueMore) return;
    setQueue(q => [...q, { outName: outPlayer.name, inName: inP.name, pos: outSlot?.realPos || inP.pos?.[0] }]);
    setAnnounce(`Na fila: sai ${outPlayer.name}, entra ${inP.name}.`);
    setOutKey(null);
  };
  const dequeue = (outName) => {
    const q = queue.find(x => x.outName === outName);
    setQueue(list => list.filter(x => x.outName !== outName));
    if (q) setAnnounce(`Removida da fila: ${q.outName} por ${q.inName}.`);
  };
  const confirm = () => {
    queue.forEach(q => {
      const key = Object.keys(lineup).find(k => lineup[k]?.name === q.outName && !lineup[k]?.isBench);
      const benchP = Object.values(lineup).find(p => p?.name === q.inName);
      if (key && benchP) onApplySub(key, benchP);
    });
    onResume();
  };

  const outReason = outPlayer ? [
    forcedSubReason === outPlayer.name ? 'lesionado' : null,
    yellowNames.has(outPlayer.name) ? 'pendurado com amarelo' : null,
  ].filter(Boolean).join(' · ') : '';

  const dotLabel = (p, slot) => [
    p.name, POS_NAME[slot.realPos] || slot.realPos, `OVR ${p.ovr}`,
    yellowNames.has(p.name) ? 'amarelo' : null,
    redNames.has(p.name) ? 'expulso' : null,
    outKey === slot.key ? 'selecionado para sair' : null,
    queuedOut.has(p.name) ? `na fila para sair, entra ${queuedOut.get(p.name).inName}` : null,
  ].filter(Boolean).join(', ');

  const queuedText = queue.length ? ` · +${queue.length} na fila` : '';
  const footText = !queue.length ? `Restam ${left} trocas`
    : `${isHalftime(minute) ? 'No intervalo não gasta parada' : opensStop ? 'Confirmar gasta 1 parada' : 'Mesma parada'} · restam ${left - queue.length} trocas depois`;

  return (
    <Modal onClose={onResume} maxWidth={1120} labelledBy="sbm-title" className="sbm-modal">
      <div className="sbm-h">
        <div className="sbm-h-l">
          <span className="sbm-mono" id="sbm-title">Jogo pausado{header?.eyebrow ? ` · ${header.eyebrow}` : ''}</span>
          {header && (
            <div className="sbm-sc">
              {header.home.crest}<span className="sbm-ell">{header.home.name}</span>
              <b>{header.score.home} – {header.score.away}</b>
              <span className="sbm-ell">{header.away.name}</span>{header.away.crest}
              <span className="sbm-min">{minute}'</span>
            </div>
          )}
        </div>
        <div className="sbm-cnt">
          <div>
            <small>Trocas</small>
            <b>{manualSubs.length} de {MAX_SUBS}{queue.length > 0 && <span className="sbm-gold">{queuedText.replace(' · ', ' ')}</span>}</b>
            <Squares used={manualSubs.length} queued={queue.length} total={MAX_SUBS} />
          </div>
          <div>
            <small>Paradas</small>
            <b>{stopsUsed} de {MAX_SUB_STOPS}{queue.length > 0 && opensStop && <span className="sbm-gold"> +1</span>}</b>
            <Squares used={stopsUsed} queued={queue.length > 0 && opensStop ? 1 : 0} total={MAX_SUB_STOPS} />
          </div>
        </div>
      </div>

      <div className="sbm-bar">
        <div className="sbm-seg" role="tablist" aria-label="Tipo de mudança">
          <button type="button" role="tab" aria-selected={tab === 'sub'} className={tab === 'sub' ? 'on' : undefined} onClick={() => setTab('sub')}><Icon name="swap" size={15} />Substituição</button>
          <button type="button" role="tab" aria-selected={tab === 'tac'} className={tab === 'tac' ? 'on' : undefined} onClick={() => setTab('tac')}>Ajuste tático</button>
        </div>
        <span className="sbm-small">
          {tab === 'sub'
            ? 'Várias trocas confirmadas juntas contam como 1 parada. O intervalo não conta.'
            : 'Arraste um titular para outra vaga para mudar o esquema na hora — sem envolver o banco.'}
        </span>
      </div>

      {tab === 'tac' ? (
        <div className="sbm-tac">{tacticalPitch}</div>
      ) : (
        <div className="sbm-body">
          <div className="sbm-lf">
            <PitchSurface className="sbm-pitch">
              {starterSlots.map(slot => {
                const p = lineup[slot.key];
                const isRed = redNames.has(p.name);
                const q = queuedOut.get(p.name);
                const inP = q ? Object.values(lineup).find(x => x.name === q.inName) : null;
                const shown = inP || p;
                return (
                  <PlayerDot
                    key={slot.key}
                    slot={slot}
                    player={shown}
                    tone={isRed ? 'off' : q ? 'queued' : outKey === slot.key ? 'out' : undefined}
                    badges={{ yellow: !q && yellowNames.has(p.name), swap: !!q }}
                    sub={q ? `entra · sai ${p.name}` : undefined}
                    disabled={isRed || !!q}
                    onClick={() => setOutKey(k => (k === slot.key ? null : slot.key))}
                    label={dotLabel(p, slot)}
                  />
                );
              })}
            </PitchSurface>
            <div className="sbm-lg">
              <span><i style={{ background: 'var(--danger)' }} />selecionado para sair</span>
              <span><i style={{ background: 'var(--gold)' }} />troca na fila</span>
              <span><i className="sbm-lg-y" />amarelo</span>
            </div>
          </div>

          <div className="sbm-rt">
            <div className="sbm-step"><i>1</i>Quem sai</div>
            {outPlayer ? (
              <div className="sbm-out">
                <span className="sbm-ovr">{outPlayer.ovr}</span>
                <div className="sbm-ell-w">
                  <b>{outPlayer.name}</b>
                  <small><PosChip pos={outSlot?.realPos || outPlayer.pos?.[0]} />{outReason ? ` · ${outReason}` : ''}</small>
                </div>
                {forcedSubReason !== outPlayer.name && <button type="button" className="sbm-btn3" onClick={() => setOutKey(null)}>Trocar</button>}
              </div>
            ) : (
              <p className="sbm-hint">Toque num titular no campo para escolher quem sai.</p>
            )}

            <div className="sbm-step"><i>2</i>Quem entra{outPlayer ? ` · banco ${bench.filter(b => !queuedIn.has(b.p.name)).length} disponíveis` : ''}</div>
            {forcedSubReason && outPlayer?.name === forcedSubReason && (
              <div className="sbm-forced" role="alert">
                <b>{forcedSubReason} se machucou.</b> Escolha quem entra ou jogue com um a menos.
                <button type="button" className="sbm-btn3" onClick={onResume}>Jogar com um a menos</button>
              </div>
            )}
            {outPlayer ? (
              <>
                <div className="sbm-chips" role="group" aria-label="Ordenar banco">
                  <button type="button" aria-pressed={sort === 'fit'} className={sort === 'fit' ? 'on' : undefined} onClick={() => setSort('fit')}>Compatíveis primeiro</button>
                  <button type="button" aria-pressed={sort === 'ovr'} className={sort === 'ovr' ? 'on' : undefined} onClick={() => setSort('ovr')}>Maior OVR</button>
                </div>
                <div className="sbm-bl">
                  {bench.length === 0 && <div className="sbm-br sbm-empty">Ninguém disponível no banco.</div>}
                  {bench.map(({ p, fit }) => {
                    const inQueue = queuedIn.has(p.name);
                    const posBlock = fit !== 'ok' ? 'Não joga na posição desse titular' : null;
                    const why = inQueue ? 'Já está na fila' : posBlock || blockReason;
                    const disabled = !!why;
                    return (
                      <div key={p.name} className={`sbm-br${inQueue ? ' used' : ''}`}>
                        <span className="sbm-ovr2">{p.ovr}</span>
                        <div className="sbm-ell-w"><b>{p.name}</b><small><PosChip pos={p.pos?.[0]} />{p.teamLabel ? ` · ${p.teamLabel}` : ''}{inQueue ? ' · na fila para entrar' : ''}</small></div>
                        <span className={`sbm-fit ${inQueue ? 'mid' : fit}`}>{inQueue ? 'Na fila' : FIT_LABEL[fit]}</span>
                        <button
                          type="button"
                          className="sbm-btn3 g"
                          disabled={disabled}
                          title={why || undefined}
                          onClick={() => enqueue(p)}
                          aria-label={`Colocar ${p.name}, ${POS_NAME[p.pos?.[0]] || p.pos?.[0]}, OVR ${p.ovr}, no lugar de ${outPlayer.name}${why ? ` — indisponível: ${why}` : ''}`}
                        >{inQueue ? '—' : 'Colocar'}</button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="sbm-hint">O banco aparece depois de escolher quem sai.</p>
            )}

            <div className="sbm-pend">
              <div className="sbm-step"><i>3</i>Trocas na fila · esta parada</div>
              {queue.length === 0 && <p className="sbm-hint">Nenhuma troca na fila.</p>}
              {queue.map(q => (
                <div key={q.outName} className="sbm-pr">
                  <span className="sbm-o">↓ {q.outName}</span><span className="sbm-i">↑ {q.inName}</span><span className="sbm-small">{q.pos}</span>
                  <button type="button" className="sbm-rm" onClick={() => dequeue(q.outName)}>Desfazer</button>
                </div>
              ))}
              <div className="sbm-imp"><span>OVR do time em campo</span><b>{fmt1(ovrNow)} → {fmt1(ovrAfter)}</b></div>
            </div>
            <span className="sr-only" aria-live="polite">{announce}</span>
          </div>
        </div>
      )}

      <div className="sbm-foot">
        <button type="button" className="sbm-btn2" onClick={onResume}>Voltar sem trocar</button>
        <span className="sbm-small sbm-foot-t">{footText}</span>
        <button type="button" className="sbm-btn2 pri" onClick={confirm}>
          {queue.length ? `Confirmar ${queue.length} ${queue.length === 1 ? 'troca' : 'trocas'} e voltar ao jogo` : 'Voltar ao jogo'}<Icon name="play" size={15} />
        </button>
      </div>
    </Modal>
  );
}
