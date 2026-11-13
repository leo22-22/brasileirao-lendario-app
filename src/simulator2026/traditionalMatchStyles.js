// Recorte dos estilos do placar/feed de eventos "tradicional" (App.jsx,
// objeto `styles`, usado pelo LiveMatchBox do Brasileirão clássico/Atual).
// Copiado aqui (em vez de importado direto de App.jsx) porque `styles` é um
// `const` tardio no arquivo e App.jsx monta este sub-app — import direto
// arriscaria TDZ num ciclo real (mesmo motivo de SERIE_A_2026_FIXTURES ter
// virado arquivo próprio). Pedido do usuário (2026-11-12): usar a simulação
// "tradicional" (clássica) em vez da reconstruída pro Modo Carreira.
// 2026-11-13: só os valores mudaram para o padrão creme (placar em Fraunces
// num bloco verde, cantos maiores) — mesmas chaves e mesma estrutura.
export const traditionalMatchStyles = {
  liveMatchBox: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22, padding: '22px 18px', marginBottom: 18 },
  liveTeamsRow: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 12, marginBottom: 12 },
  liveTeamName: { fontSize: 15, lineHeight: 1.3 },
  liveScoreBlock: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--green)', borderRadius: 16, padding: '10px 18px' },
  liveScoreNum: { fontFamily: 'var(--font-serif)', fontSize: 40, fontWeight: 400, color: '#fff', minWidth: 28, textAlign: 'center', lineHeight: 1 },
  liveScoreDash: { fontFamily: 'var(--font-serif)', fontSize: 22, color: '#B6CBBF' },
  clockRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 },
  clock: { fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700 },
  clockPulse: { width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', animation: 'pulse 1s ease-in-out infinite' },
  clockFull: { fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' },
  matchCenter: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 },
  matchCenterRow: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 52px minmax(0,1fr)', alignItems: 'center', gap: 6 },
  matchCenterSide: { display: 'flex', minWidth: 0, overflow: 'hidden' },
  matchCenterCard: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 12, border: '1px solid', maxWidth: '100%', minWidth: 0 },
  matchCenterInfo: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
  matchCenterMinuteCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 },
  goalMinute: { fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--gold-ink)' },
  goalScorer: { fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  goalTeam: { fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  goalScore: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' },
  noGoalsMsg: { textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '12px 0' },
};
