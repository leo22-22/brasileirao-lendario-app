// Recorte dos estilos do placar/feed de eventos "tradicional" (App.jsx,
// objeto `styles`, usado pelo LiveMatchBox do Brasileirão clássico/Atual).
// Copiado aqui (em vez de importado direto de App.jsx) porque `styles` é um
// `const` tardio no arquivo e App.jsx monta este sub-app — import direto
// arriscaria TDZ num ciclo real (mesmo motivo de SERIE_A_2026_FIXTURES ter
// virado arquivo próprio). Pedido do usuário (2026-11-12): usar a simulação
// "tradicional" (clássica) em vez da reconstruída pro Modo Carreira.
export const traditionalMatchStyles = {
  liveMatchBox: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '20px 16px', marginBottom: 20 },
  liveTeamsRow: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 12, marginBottom: 12 },
  liveTeamName: { fontSize: 14, lineHeight: 1.3 },
  liveScoreBlock: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.35)', borderRadius: 10, padding: '8px 16px' },
  liveScoreNum: { fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: '#F4F1EA', minWidth: 24, textAlign: 'center' },
  liveScoreDash: { fontFamily: "'Space Mono', monospace", fontSize: 20, opacity: 0.5 },
  clockRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 },
  clock: { fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700 },
  clockPulse: { width: 8, height: 8, borderRadius: '50%', background: '#7fd99a', animation: 'pulse 1s ease-in-out infinite' },
  clockFull: { fontSize: 12, opacity: 0.5, fontFamily: "'Space Mono', monospace" },
  matchCenter: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 },
  matchCenterRow: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 52px minmax(0,1fr)', alignItems: 'center', gap: 6 },
  matchCenterSide: { display: 'flex', minWidth: 0, overflow: 'hidden' },
  matchCenterCard: { display: 'flex', alignItems: 'center', gap: 7, padding: '6px 9px', borderRadius: 8, border: '1px solid', maxWidth: '100%', minWidth: 0 },
  matchCenterInfo: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
  matchCenterMinuteCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 },
  goalMinute: { fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: '#d4a23c' },
  goalScorer: { fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  goalTeam: { fontSize: 11, opacity: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  goalScore: { fontFamily: "'Space Mono', monospace", fontSize: 11, opacity: 0.6, whiteSpace: 'nowrap' },
  noGoalsMsg: { textAlign: 'center', opacity: 0.5, fontSize: 13, padding: '12px 0' },
};
