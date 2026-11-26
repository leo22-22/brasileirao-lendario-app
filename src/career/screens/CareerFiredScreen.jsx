// Demissão pela diretoria (Fase 5, clubOps.js): mostra o motivo e até 3
// convites de outros clubes (mesmo porte ou menor). Aceitar continua a
// mesma carreira no clube novo; "carreira nova" volta pra escolha de clube
// sem apagar esta (ela fica salva no slot dela).
import { TEAMS } from '../../data/teams.js';
import { CLUB_LOGOS } from '../../data/club-logos.js';
import { careerClubTier } from '../../data/career-clubs.js';
import { displayName } from '../../lib/displayName.js';
import { formatMoneyShort } from './CareerHub.jsx';
import '../components/careerShell.css';

const TIER_LABEL = { elite: 'Gigante', grande: 'Grande', medio: 'Médio', pequeno: 'Pequeno' };

export function CareerFiredScreen({ save, onAccept, onNewCareer }) {
  const f = save.fired;
  if (!f) return null;
  const from = TEAMS.find(t => t.id === f.fromClubId);
  return (
    <div className="ch-main" style={{ maxWidth: 640, margin: '0 auto', padding: '28px 16px' }}>
      <span className="ch-mono">Modo Carreira · temporada {f.season}</span>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 30, margin: '6px 0 4px' }}>Você foi demitido</h1>
      <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 18px' }}>
        A diretoria do {displayName(from?.club)} perdeu a confiança ({f.confidence}%). {f.final ? 'Ao fim da temporada' : 'No meio da temporada'}, o time estava em {f.pos}º e a meta era {String(f.goal || '').toLowerCase()}.
      </p>
      <h2 style={{ fontSize: 15, margin: '0 0 8px' }}>Convites recebidos</h2>
      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {f.offers.map(id => {
          const t = TEAMS.find(x => x.id === id);
          const club = save.clubs[id];
          return (
            <div key={id} className="ch-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
              {CLUB_LOGOS[t?.club] && <img src={CLUB_LOGOS[t.club]} alt="" style={{ width: 38, height: 38, objectFit: 'contain', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 15 }}>{displayName(t?.club)}</b>
                <div className="ch-small">Série {club?.division} · {TIER_LABEL[careerClubTier(id)] || ''} · caixa {formatMoneyShort(club?.budget || 0)}</div>
              </div>
              <button type="button" className="ui-btn ui-btn-dark ui-btn-md" onClick={() => onAccept(id)}>Assumir</button>
            </div>
          );
        })}
      </div>
      <button type="button" className="ui-btn ui-btn-ghost ui-btn-md ui-btn-block" onClick={onNewCareer}>Começar uma carreira nova</button>
      <p className="ch-small" style={{ marginTop: 8 }}>Ao assumir outro clube, a carreira continua do mesmo dia, com o elenco, o caixa e a tabela do clube novo.</p>
    </div>
  );
}
