// Estilos compartilhados entre telas do Modo Carreira — hoje só o botão
// "← Voltar"/"← Sair da carreira" que toda tela tem no topo. Era um
// `<button>` sem nenhum estilo de botão (sem fundo/borda/padding — só
// texto dourado clicável), o que não parecia clicável de verdade; agora
// tem a cara de botão mesmo, mantendo o mesmo lugar/tamanho de texto.
export const backButtonStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 8,
  border: '1px solid rgba(194,154,69,0.5)', background: 'rgba(194,154,69,0.1)',
  color: 'var(--gold-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
};
