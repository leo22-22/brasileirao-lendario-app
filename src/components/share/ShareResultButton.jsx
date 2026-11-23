// Botão "Compartilhar resultado" — mesmo card em todos os modos.
import { useState } from 'react';
import { Icon } from '../../ui/icons.jsx';
import { shareResultCard } from './resultCard.js';

export function ShareResultButton({ cardData, onShared, className = 'ui-btn ui-btn-ghost ui-btn-md', style }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const share = async () => {
    setBusy(true);
    try {
      const outcome = await shareResultCard(cardData);
      setDone(outcome === 'downloaded' ? 'Imagem baixada' : null);
      onShared?.(outcome);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className={className} style={style} onClick={share} disabled={busy} aria-busy={busy}>
      <Icon name="share" size={16} />
      {busy ? 'Gerando imagem…' : done || 'Compartilhar resultado'}
    </button>
  );
}
