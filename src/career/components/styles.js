// Estilos compartilhados entre telas do Modo Carreira — hoje só o botão
// "← Voltar"/"← Sair da carreira" que toda tela tem no topo. Era um
// `<button>` sem nenhum estilo de botão (sem fundo/borda/padding — só
// texto dourado clicável), o que não parecia clicável de verdade; agora
// tem a cara de botão mesmo, mantendo o mesmo lugar/tamanho de texto.
export const backButtonStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 40, padding: '0 14px', borderRadius: 999,
  border: '1px solid var(--line-strong)', background: 'transparent',
  color: 'var(--ink-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer', marginBottom: 16,
  fontFamily: 'var(--font-body)',
};
