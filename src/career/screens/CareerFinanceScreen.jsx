// Finanças do Modo Carreira — só leitura do que o motor já calcula:
// saldo atual, histórico de saldo por rodada (save.budgetHistory), folha
// salarial e receita fixa por mês, bilheteria por jogo em casa (Fase 5,
// clubOps.js), premiação pela posição atual e os últimos lançamentos.
import { computePlayerValue } from '../engine/pricing.js';
import { computePrizeMoney, computeMatchdayRevenue } from '../engine/economy.js';
import { payrollOf, monthlyIncomeFor, ensureContracts } from '../engine/clubOps.js';
import { myDivision } from '../engine/careerMeta.js';
import { formatMoneyShort, financialHealth } from './CareerHub.jsx';
import '../components/careerShell.css';

export function CareerFinanceScreen({ save: rawSave }) {
  const save = ensureContracts(rawSave);
  const club = save.clubs[save.myClubId];
  const payroll = payrollOf(save);
  const income = monthlyIncomeFor(save);
  const gate = computeMatchdayRevenue(save.myClubId, true);
  const ledger = [...(save.financeLog || [])].filter(e => e.season === save.season).reverse().slice(0, 14);
  const { key, data: division } = myDivision(save);
  const pos = division.table.findIndex(r => r.id === save.myClubId) + 1;
  const balance = club.budget;
  const health = financialHealth(balance);
  const squadValue = club.roster.filter(p => !p.inAcademy).reduce((s, p) => s + computePlayerValue(p, save.myClubId), 0);
  const prize = computePrizeMoney(pos, key);
  const hist = (save.budgetHistory || []).filter(h => h.season === save.season);

  const W = 640, H = 160;
  const values = hist.map(h => h.balance);
  const min = Math.min(...values, 0), max = Math.max(...values, 1);
  const span = max - min || 1;
  const path = values.length >= 2
    ? values.map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (values.length - 1)) * W).toFixed(1)} ${(H - 8 - ((v - min) / span) * (H - 16)).toFixed(1)}`).join(' ')
    : null;

  const tiles = [
    { k: 'Saldo atual', v: formatMoneyShort(balance), s: health.text, c: health.color },
    { k: 'Valor do elenco', v: formatMoneyShort(squadValue), s: `${club.roster.filter(p => !p.inAcademy).length} jogadores` },
    { k: 'Variação na temporada', v: hist.length ? formatMoneyShort(balance - hist[0].balance) : '—', s: 'Transferências e prêmios', c: hist.length && balance - hist[0].balance < 0 ? 'var(--danger)' : undefined },
    { k: `Prêmio se terminar em ${pos}º`, v: formatMoneyShort(prize), s: `Tabela CBF · Série ${key}` },
    { k: 'Folha salarial', v: formatMoneyShort(payroll), s: `por mês · ${Object.keys(save.contracts || {}).length} contratos`, c: 'var(--danger)' },
    { k: 'Cotas de TV e patrocínio', v: formatMoneyShort(income), s: `por mês · Série ${key}` },
    { k: 'Bilheteria', v: formatMoneyShort(gate), s: 'por jogo em casa no Brasileirão' },
    { k: 'Saldo do mês', v: formatMoneyShort(income - payroll), s: 'Cotas menos folha, sem bilheteria', c: income - payroll < 0 ? 'var(--danger)' : 'var(--success)' },
  ];

  return (
    <div className="ch-main" style={{ maxWidth: 1100 }}>
      <div className="ui-sh" style={{ marginBottom: 0 }}>
        <div>
          <span className="ui-eyebrow"><i />Modo Carreira</span>
          <h1 className="ui-title ui-title-md"><em>Finanças</em> do clube</h1>
          <p>O saldo muda com compras, vendas, prêmios, bilheteria dos jogos em casa, cotas de TV e patrocínio e a folha salarial, paga no dia 1 de cada mês. Renovar contrato custa luvas na hora.</p>
        </div>
      </div>
      <div className="ch-kpis" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
        {tiles.map(t => (
          <div key={t.k} className="ch-card ch-kpi">
            <span className="ch-mono">{t.k}</span>
            <b>{t.v}</b>
            <span className="ch-d" style={t.c ? { color: t.c } : undefined}>{t.s}</span>
          </div>
        ))}
      </div>
      <div className="ch-card" style={{ padding: '18px 22px 18px' }}>
        <div className="ch-row" style={{ marginBottom: 8 }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 20, margin: 0 }}>Últimos lançamentos</h3>
          <span className="ch-mono">Temporada {save.season}</span>
        </div>
        {ledger.length === 0 ? (
          <p className="ch-small" style={{ margin: 0 }}>A folha e as cotas entram no dia 1 de cada mês; a bilheteria, a cada jogo em casa.</p>
        ) : ledger.map((e, i) => (
          <div key={i} className="ch-row" style={{ padding: '6px 0', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 13 }}>
            <span>{e.label}</span>
            <b style={{ color: e.amount < 0 ? 'var(--danger)' : 'var(--success)' }}>{e.amount < 0 ? '−' : '+'}{formatMoneyShort(Math.abs(e.amount))}</b>
          </div>
        ))}
      </div>
      <div className="ch-card" style={{ padding: '18px 22px 22px' }}>
        <div className="ch-row" style={{ marginBottom: 12 }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 20, margin: 0 }}>Evolução do saldo</h3>
          <span className="ch-mono">Temporada {save.season}</span>
        </div>
        {path ? (
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 180, display: 'block' }} role="img" aria-label="Gráfico da evolução do saldo por rodada">
            <path d={`${path} L${W} ${H} L0 ${H} Z`} fill="rgba(31,122,77,0.08)" />
            <path d={path} fill="none" stroke="#1F7A4D" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : (
          <p className="ch-small" style={{ margin: 0 }}>O histórico começa a ser registrado a partir da próxima rodada jogada.</p>
        )}
        {hist.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }} className="ch-small">
            <span>Rodada {hist[0].round}: {formatMoneyShort(hist[0].balance)}</span>
            <span>Rodada {hist[hist.length - 1].round}: {formatMoneyShort(hist[hist.length - 1].balance)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
