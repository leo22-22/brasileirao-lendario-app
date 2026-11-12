// Caixa de entrada completa do Modo Carreira (resultados, mercado e
// diretoria) — a Visão geral mostra só as 4 mais recentes.
import { useState } from 'react';
import { InboxList } from './CareerHub.jsx';
import '../components/careerShell.css';

export function CareerInboxScreen({ save, onNavigate, onMarkRead }) {
  const [filter, setFilter] = useState('all');
  const unread = (save.inbox || []).filter(m => !m.read).length;
  return (
    <div className="ch-main" style={{ maxWidth: 880 }}>
      <div className="ui-sh" style={{ marginBottom: 0 }}>
        <div>
          <span className="ui-eyebrow"><i />Modo Carreira</span>
          <h1 className="ui-title ui-title-md">Caixa de <em>entrada</em></h1>
          <p>{unread ? `${unread} não lida${unread > 1 ? 's' : ''}` : 'Tudo lido'} · resultados, mercado e recados da diretoria.</p>
        </div>
        {unread > 0 && (
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => onMarkRead(null)}>Marcar todas como lidas</button>
        )}
      </div>
      <div className="ch-card" style={{ overflow: 'hidden', paddingTop: 16 }}>
        <InboxList
          save={save}
          filter={filter}
          setFilter={setFilter}
          onOpenItem={(m) => { if (!m.read) onMarkRead([m.id]); if (m.action) onNavigate(m.action); }}
        />
      </div>
    </div>
  );
}
