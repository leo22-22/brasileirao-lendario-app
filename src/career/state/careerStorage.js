// Persistência do Modo Carreira — chave PRÓPRIA e separada de `brl_save`
// (a do modo clássico/Atual 2026/Copa), seguindo a convenção `brl_<feature>`
// já usada no projeto. Nunca lida por nenhum outro modo; nunca escreve em
// `brl_save`.
const KEY = 'brl_career_save';

export function loadCareerSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCareerSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // localStorage indisponível/cheio — ignora, igual ao padrão já usado
    // pelo resto do app (brl_save, brl_difficulty etc.).
  }
}

export function clearCareerSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}

export function hasCareerSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}
