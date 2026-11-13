// Categoria de base do Modo Carreira — redesenho de 2026-11-13
// (modo-carreira-base-mockup.html). Regras iguais às de antes: jovens com
// `inAcademy` ficam fora de campo e do mercado até o usuário promover
// (promoteYouthPlayer, rosterStore.js) ou completarem 20 anos (graduação
// automática em seasonEngine.js). O potencial continua sendo mostrado como
// FAIXA (low = max(ovr, potential−5), high = min(99, potential+3)) — o motor
// usa um número só, mas para o jogador é sempre uma estimativa de olheiro.
// "O que esperar" lê o TIER_TABLE de youth.js (os mesmos números da geração).
import { useEffect, useRef, useState } from 'react';
import { TEAMS } from '../../data/teams.js';
import { careerClubTier } from '../../data/career-clubs.js';
import { TIER_TABLE } from '../engine/youth.js';
import { squadDepth } from '../../lib/depth.js';
import { computePlayerValue } from '../engine/pricing.js';
import { formatCalendarDay } from '../engine/calendar.js';
import { COPA_DAYS } from '../engine/copaEngine.js';
import { formatMoneyShort } from './CareerHub.jsx';
import { posSector, posOrderIndex } from '../../lib/format.js';
import { displayName } from '../../lib/displayName.js';
import { Icon } from '../../ui/index.jsx';
import '../components/careerShell.css';
import './careerSquad.css';
import './careerYouth.css';

const TIER_LABEL = { elite: 'Clube de elite', grande: 'Clube grande', medio: 'Clube médio', pequeno: 'Clube pequeno' };
const pct = (x) => `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const nameOf = (id) => displayName(TEAMS.find(t => t.id === id)?.club || '');

export function potentialRange(p) {
  if (!p.growthPerSeason) return null; // sem crescimento sorteado — o teto é o overall atual
  return { low: Math.max(p.ovr, p.potential - 5), high: Math.min(99, p.potential + 3) };
}

function Pos({ pos }) {
  return <span className={`sq-pos sq-${posSector(pos)}`}>{pos}</span>;
}

export function CareerYouthScreen({ save, onPromote, onNavigate }) {
  const me = save.myClubId;
  const team = TEAMS.find(t => t.id === me);
  const clubName = displayName(team?.club || '');
  const roster = save.clubs[me].roster;
  const academy = roster.filter(p => p.inAcademy).sort((a, b) => (b.isStar - a.isStar) || posOrderIndex(a.pos[0]) - posOrderIndex(b.pos[0]) || b.ovr - a.ovr);
  const pro = roster.filter(p => !p.inAcademy);
  const depth = squadDepth(pro);
  const tier = careerClubTier(me);
  const T = TIER_TABLE[tier] || TIER_TABLE.pequeno;
  const lastRoundDay = save.seasonCalendar?.[save.seasonCalendar.length - 1];
  // A revelação acontece no fechamento da temporada, que agora espera a
  // final da Copa do Brasil quando ela ainda não foi jogada.
  const copaFinalDay = [].concat(COPA_DAYS[COPA_DAYS.length - 1])[0];
  const copaPending = save.copa && save.copa.phase !== 'done';
  const revealAfterDay = copaPending ? Math.max(lastRoundDay || 0, copaFinalDay) : lastRoundDay;
  const revealAfterText = revealAfterDay ? (copaPending && revealAfterDay === copaFinalDay ? `após a final da Copa, ${formatCalendarDay(revealAfterDay)}` : `após ${formatCalendarDay(revealAfterDay)}`) : null;

  // Formados: jogadores com isYouth já fora da base (promovidos ou subiram aos 20)
  const formed = pro.filter(p => p.isYouth).sort((a, b) => b.ovr - a.ovr);
  const starters = new Set(save.myStarters || []);
  const formedStarters = formed.filter(p => starters.has(p.name)).length;
  // Formados vendidos: desde 2026-11-13 a venda grava isYouth/pos/ovr no
  // transferLog; vendas mais antigas só têm o nome, então para elas o jogador
  // é procurado no elenco do comprador (vai inteiro, com isYouth).
  const soldFormed = (save.transferLog || [])
    .filter(e => e.type === 'user-sell' && e.fromClubId === me)
    .map(e => {
      if (e.isYouth) return { name: e.playerName, toClubId: e.toClubId, amount: e.amount, pos: e.pos, season: e.season };
      const found = save.clubs[e.toClubId]?.roster.find(p => p.name === e.playerName && p.isYouth);
      return found ? { name: e.playerName, toClubId: e.toClubId, amount: e.amount, pos: found.pos?.[0], season: e.season } : null;
    })
    .filter(Boolean)
    .reverse();

  const stars = academy.filter(p => p.isStar).length;
  const withPot = academy.filter(p => p.growthPerSeason).length;
  const nextUp = academy.filter(p => p.age >= 19).length;
  const avgOvr = academy.length ? academy.reduce((s, p) => s + p.ovr, 0) / academy.length : null;
  // Média da FAIXA do olheiro (não o potencial exato, que fica escondido).
  const avgLow = academy.length ? academy.reduce((s, p) => s + (potentialRange(p)?.low ?? p.ovr), 0) / academy.length : null;
  const avgHigh = academy.length ? academy.reduce((s, p) => s + (potentialRange(p)?.high ?? p.ovr), 0) / academy.length : null;
  const fmt1 = (x) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const cancelRef = useRef(null);
  useEffect(() => { if (confirm) cancelRef.current?.focus(); }, [confirm]);
  useEffect(() => {
    if (!confirm) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setConfirm(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const doPromote = (name) => {
    onPromote(name);
    setConfirm(null);
    setToast(name);
  };

  const ProspectCard = (p) => {
    const range = potentialRange(p);
    const group = depth.find(d => d.pos.includes(p.pos[0]));
    const thin = group ? group.count <= 1 : false;
    const samePos = pro.filter(x => x.pos[0] === p.pos[0]);
    const rank = samePos.filter(x => x.ovr > p.ovr).length + 1;
    const yearsTo20 = Math.max(0, 20 - p.age);
    const value = computePlayerValue({ ...p, inAcademy: false }, me);
    const ovrW = Math.min(100, p.ovr);
    const isConfirm = confirm === p.name;
    const potText = range ? `potencial estimado entre ${range.low} e ${range.high}` : 'já no teto, sem potencial de crescimento';
    return (
      <article key={p.name} className={`yb-pc${p.isStar ? ' yb-star' : ''}`} aria-label={`${p.name}, ${p.pos[0]}, ${p.age} anos`}>
        <div className="yb-hd">
          <Pos pos={p.pos[0]} />
          <span className="yb-tags">
            {p.isStar && <span className="yb-jw"><Icon name="star" size={13} />Joia rara</span>}
            {thin && <span className="yb-tg-ok" title={`O elenco tem ${group.count} jogador${group.count === 1 ? '' : 'es'} em ${group.id}`}>Supre carência</span>}
          </span>
        </div>
        <div className="yb-nm"><h4>{p.name}</h4><small>{p.age} anos · {p.revealedSeason ? `revelado na temporada ${p.revealedSeason}` : 'revelado pelo clube'}</small></div>
        <div className="yb-ovrs">
          <div className="yb-big">{p.ovr}<small>OVR hoje</small></div>
          <div className="yb-potw">
            <small>Potencial estimado</small>
            <div className="yb-pbar" role="img" aria-label={`Overall ${p.ovr}, ${potText}`}>
              <span className="yb-cur" style={{ width: `${ovrW}%` }} />
              {range && range.high > p.ovr && <span className="yb-rng" style={{ left: `${range.low}%`, width: `${Math.max(2, range.high - range.low)}%` }} />}
            </div>
            <div className="yb-lb"><span>atual {p.ovr}</span><b>{range ? `${range.low} – ${range.high}` : 'já no teto'}</b></div>
          </div>
        </div>
        <dl className="yb-facts">
          <div><dt>No elenco</dt><dd>{rank}º {p.pos[0]} (de {samePos.length + 1})</dd></div>
          <div><dt>Sobe aos 20</dt><dd className={yearsTo20 <= 1 ? 'yb-warn' : ''}>{yearsTo20 <= 1 ? 'na próxima' : `em ${yearsTo20} temp.`}</dd></div>
          <div><dt>Evolução</dt><dd>{p.growthPerSeason ? (p.ovr >= p.potential ? 'no teto' : `+${p.growthPerSeason}/temp.`) : 'no teto'}</dd></div>
          <div><dt>Valor</dt><dd>{formatMoneyShort(value)}</dd></div>
        </dl>
        <div className="yb-ft">
          {isConfirm ? (
            <div className="yb-confirm" role="alertdialog" aria-label={`Promover ${p.name} ao elenco?`}>
              <span>Promover ao elenco? Ele não volta para a base.</span>
              <span className="yb-confirm-acts">
                <button type="button" ref={cancelRef} className="yb-btn" onClick={() => setConfirm(null)}>Cancelar</button>
                <button type="button" className="yb-btn yb-pri" onClick={() => doPromote(p.name)} aria-label={`Confirmar promoção de ${p.name}`}>Promover</button>
              </span>
            </div>
          ) : (
            <button
              type="button" className={`yb-btn yb-wide${range || p.isStar ? ' yb-pri' : ''}`}
              onClick={() => setConfirm(p.name)}
              aria-label={`${range || p.isStar ? 'Promover' : 'Promover mesmo assim'} ${p.name} ao elenco`}
            ><Icon name="shirt" size={16} />{range || p.isStar ? 'Promover ao elenco' : 'Promover mesmo assim'}</button>
          )}
        </div>
      </article>
    );
  };

  const Expect = (big) => (
    <div className={`ch-card yb-tier${big ? ' yb-tier-big' : ''}`}>
      <div className="yb-tier-t"><span className="ch-mono">Nível da base</span><span className="yb-tierpill">{TIER_LABEL[tier]}</span></div>
      <h4>O que esperar</h4>
      <div className="yb-odd"><span>Overall inicial</span><b>{T.ovr[0]} – {T.ovr[1]}</b></div>
      <div className="yb-odd"><span>Chance de ter potencial</span><b>{pct(T.growthChance)}</b></div>
      <div className="yb-odd"><span>Crescimento por temporada</span><b>+{T.growthRange[0]} a +{T.growthRange[1]}</b></div>
      <div className="yb-odd"><span>Chance de joia ({T.starOvr[0]}–{T.starOvr[1]})</span><b>{pct(T.starChance)}</b></div>
    </div>
  );

  return (
    <div className="ch-main yb-main">
      <div className="sq-ph yb-ph">
        <div style={{ minWidth: 0 }}>
          <span className="ch-mono">{clubName} · Temporada {save.season} · categoria de base</span>
          <h1>Base</h1>
          <p className="yb-lead">Jovens revelados pelo clube. Ficam fora de campo e do mercado até você promover, ou sobem sozinhos aos 20 anos.</p>
        </div>
        <div className="yb-nxt">
          <span className="yb-nxt-ic" aria-hidden="true"><Icon name="sprout" size={18} /></span>
          <div><b>Próxima revelação</b><small>Fim da temporada{revealAfterText ? ` (${revealAfterText})` : ''} · 2 ou 3 jovens</small></div>
        </div>
      </div>

      <div className="yb-kpis">
        <div className="ch-card yb-kpi"><span className="ch-mono">Na base</span><b>{academy.length}</b><span className="yb-d">{academy.length ? `${stars} joia${stars === 1 ? '' : 's'} · ${withPot} com potencial` : 'Nenhum jovem agora'}</span></div>
        <div className="ch-card yb-kpi"><span className="ch-mono">Formados no elenco</span><b>{formed.length}</b><span className="yb-d">{formed.length ? `${formedStarters} titular${formedStarters === 1 ? '' : 'es'} na escalação` : 'Nenhum ainda'}</span></div>
        <div className="ch-card yb-kpi"><span className="ch-mono">Sobem na próxima</span><b>{nextUp}</b><span className="yb-d" style={nextUp ? { color: 'var(--warning-ink, var(--warning))' } : undefined}>{nextUp ? 'Completam 20 anos e sobem sozinhos' : 'Ninguém com 19 anos na base'}</span></div>
        <div className="ch-card yb-kpi"><span className="ch-mono">OVR médio da base</span><b>{avgOvr != null ? fmt1(avgOvr) : '—'}</b><span className="yb-d">{avgLow != null ? `Potencial estimado ${Math.round(avgLow)} – ${Math.round(avgHigh)}` : 'Sem jovens para medir'}</span></div>
      </div>

      <div className="yb-lay">
        <div className="yb-col">
          {academy.length ? (
            <div className="yb-pros">{academy.map(ProspectCard)}</div>
          ) : (
            <div className="yb-empty">
              <div className="yb-empty-main">
                <span className="yb-empty-ic" aria-hidden="true"><Icon name="sprout" size={24} /></span>
                <h3>Nenhum jovem na base agora</h3>
                <p>No fim da temporada{revealAfterText ? ` (${revealAfterText})` : ''}, o {clubName} revela 2 ou 3 jovens de 16 a 19 anos.</p>
              </div>
              {Expect(true)}
            </div>
          )}

          <div className="ch-card yb-how">
            <div><span className="yb-n">01</span><b>Revelação</b><p>No fim de cada temporada o clube revela 2 ou 3 jovens de 16 a 19 anos. Quanto maior o clube, maior o overall inicial e a chance de joia.</p></div>
            <div><span className="yb-n">02</span><b>Evolução</b><p>Quem tem potencial ganha overall a cada temporada até o teto. O olheiro mostra uma faixa, não o número exato.</p></div>
            <div><span className="yb-n">03</span><b>Promoção</b><p>Promova quando quiser. Aos 20 anos o jovem sobe sozinho para o elenco profissional.</p></div>
          </div>
        </div>

        <aside className="yb-side">
          {academy.length > 0 && Expect(false)}
          <div className="ch-card" style={{ overflow: 'hidden' }}>
            <div className="ch-head"><h3>Formados na base</h3><button type="button" className="ch-link" onClick={() => onNavigate('squad')}>Ver elenco</button></div>
            {formed.length === 0 && soldFormed.length === 0 && <div className="ch-empty">Nenhum jogador formado no clube ainda.</div>}
            {formed.map(p => (
              <div key={p.name} className="yb-gr">
                <Pos pos={p.pos[0]} />
                <div style={{ minWidth: 0 }}><b className="cf-ell">{p.name}</b><small>{p.age} anos · {p.promotedHow === 'auto' ? 'subiu aos 20' : p.promotedHow === 'manual' ? 'promovido' : 'formado no clube'}{p.promotedSeason ? ` na temp. ${p.promotedSeason}` : ''}{starters.has(p.name) ? ' · titular' : ''}</small></div>
                <span className="yb-o">{p.ovr}{p.promotedOvr != null && p.ovr !== p.promotedOvr && <small className={p.ovr > p.promotedOvr ? 'yb-up' : 'yb-dn'} aria-label={`${p.ovr > p.promotedOvr ? 'subiu' : 'caiu'} ${Math.abs(p.ovr - p.promotedOvr)} desde a promoção`}>{p.ovr > p.promotedOvr ? '+' : '−'}{Math.abs(p.ovr - p.promotedOvr)}</small>}</span>
              </div>
            ))}
            {soldFormed.map(s => (
              <div key={`sold-${s.name}`} className="yb-gr yb-sold">
                {s.pos ? <Pos pos={s.pos} /> : <span />}
                <div style={{ minWidth: 0 }}><b className="cf-ell">{s.name}</b><small>vendido ao {nameOf(s.toClubId)} · {formatMoneyShort(s.amount)}{s.season ? ` · temp. ${s.season}` : ''}</small></div>
                <span className="yb-o">—</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {toast && (
        <div className="yb-toast" role="status">
          <Icon name="check" size={16} /><span><b>{toast}</b> agora está no elenco</span>
          <button type="button" onClick={() => onNavigate('squad')}>Ver no elenco</button>
          <button type="button" className="yb-toast-x" onClick={() => setToast(null)} aria-label="Fechar aviso"><Icon name="close" size={14} /></button>
        </div>
      )}
    </div>
  );
}
