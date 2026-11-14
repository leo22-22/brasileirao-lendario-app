// Etapas do novo jogo (Esquema → Draft → Capitão → Temporada/Copa/Supercopa)
// — ÚNICA versão. steps: rótulos já filtrados pelo modo; current: índice.
import { Icon } from '../../ui/index.jsx';
import './flowStepper.css';

export function FlowStepper({ steps, current = 0, label = 'Etapas do novo jogo' }) {
  if (!steps?.length) return null;
  return (
    <ol className="fs-steps" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s} className={`fs-sp${i < current ? ' fs-done' : i === current ? ' fs-on' : ''}`} aria-current={i === current ? 'step' : undefined}>
          {i > 0 && <span className="fs-line" aria-hidden="true" />}
          <i>{i < current ? <Icon name="check" size={12} /> : i + 1}</i>{s}
        </li>
      ))}
    </ol>
  );
}
