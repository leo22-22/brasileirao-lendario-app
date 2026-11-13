// Rótulo de time "Clube Ano (Conquista)" — só reformata o que já está no
// dado de TEAMS, não inventa nenhum fato novo.

// { baseName: "Guarani 1978", achievement: "Campeão Brasileiro" | null }
export function parseTeamLabel(label = '') {
  const m = String(label).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { baseName: m[1], achievement: m[2] } : { baseName: String(label), achievement: null };
}

// Só "Clube Ano", sem a conquista.
export const teamBaseName = (label) => parseTeamLabel(label).baseName;

// Nome do clube sem o sufixo de ano ("Santos 1962" → "Santos").
export function stripYear(name = '') {
  return String(name).replace(/\s+\d{4}(\/\d{2,4})?$/, '');
}
