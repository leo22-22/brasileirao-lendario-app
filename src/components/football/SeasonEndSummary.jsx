// Resumo de fim de temporada / torneio — ÚNICA versão (referência: card de
// encerramento do Simulador 2026): campeão em destaque, situação do meu
// time, zonas (G4, rebaixados, acesso), artilheiro, números e ações.
// Só apresentação: cada modo passa os textos e listas já calculados.
import './seasonEnd.css';

/**
 * eyebrow: texto do topo. title: resultado do meu time ("Campeão!", "10º lugar").
 * crest: escudo do campeão. championLabel / championName / championSub: bloco do campeão.
 * mine: true quando o campeão é o meu time (card dourado).
 * facts: [{ title, text }] (situação, G4, rebaixados, artilheiro…).
 * stats: [{ label, value }]. actions: nó. children: conteúdo extra (ex.: hino).
 */
export function SeasonEndSummary({ eyebrow, title, crest, championLabel = 'Campeão', championName, championSub, mine = false, facts = [], stats = [], actions, children, id = 'se-title' }) {
  return (
    <section className={`fb-se${mine ? ' fb-se-mine' : ''}`} aria-labelledby={id}>
      <span className="fb-se-ring" aria-hidden="true" />
      {eyebrow && <span className="fb-se-mono">{eyebrow}</span>}
      {title && <h1 id={id} className="fb-se-title">{title}</h1>}
      {championName && (
        <div className="fb-se-champ">
          {crest}
          <div style={{ minWidth: 0 }}>
            <span className="fb-se-mono fb-se-gold">{championLabel}</span>
            <h2>{championName}</h2>
            {championSub && <small>{championSub}</small>}
          </div>
        </div>
      )}
      {stats.length > 0 && (
        <div className="fb-se-stats">
          {stats.map(s => <div key={s.label}><b>{s.value}</b><small>{s.label}</small></div>)}
        </div>
      )}
      {facts.length > 0 && (
        <div className="fb-se-facts">
          {facts.map(f => <div key={f.title} className="fb-se-fact"><b>{f.title}</b>{f.text}</div>)}
        </div>
      )}
      {children}
      {actions && <div className="fb-se-acts">{actions}</div>}
    </section>
  );
}
