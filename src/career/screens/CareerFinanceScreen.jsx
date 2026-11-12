// Finanças do Modo Carreira — só leitura do que o motor já calcula:
// saldo atual, histórico de saldo por rodada (save.budgetHistory),
// renda de bilheteria por jogo em casa e premiação pela posição atual.
import { computePlayerValue } from '../engine/pricing.js';
import { computePrizeMoney } from '../engine/economy.js';
import { myDivision } from '../engine/careerMeta.js';
import { formatMoneyShort, financialHealth } from './CareerHub.jsx';
import '../components/careerShell.css';

export function CareerFinanceScreen({ save }) {
  const club = save.clubs[save.myClubId];
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
  ];

  return (
    <div className="ch-main" style={{ maxWidth: 1100 }}>
      <div className="ui-sh" style={{ marginBottom: 0 }}>
        <div>
          <span className="ui-eyebrow"><i />Modo Carreira</span>
          <h1 className="ui-title ui-title-md"><em>Finanças</em> do clube</h1>
          <p>O saldo muda com compras, vendas, prêmios da Copa do Brasil e a premiação de fim de temporada. Salários, bilheteria e contratos não existem no Modo Carreira.</p>
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
