// Faixas de era usadas no filtro de elencos (home e /times) e o intervalo
// de anos coberto pelo acervo — calculado de TEAMS, pra nunca ficar
// desatualizado quando entra um time novo.
import { TEAMS } from '../data/teams.js';

export const ERA_BUCKETS = [
  { key: 'all', label: 'Todas as eras', test: () => true },
  { key: '60s', label: 'Anos 60', test: y => y < 1970 },
  { key: '70s', label: 'Anos 70', test: y => y >= 1970 && y < 1980 },
  { key: '80s', label: 'Anos 80', test: y => y >= 1980 && y < 1990 },
  { key: '90s', label: 'Anos 90', test: y => y >= 1990 && y < 2000 },
  { key: '2000s', label: 'Anos 2000', test: y => y >= 2000 && y < 2010 },
  { key: '2010s', label: 'Anos 2010', test: y => y >= 2010 && y < 2020 },
  { key: '2020s', label: 'Anos 2020', test: y => y >= 2020 },
];

const years = TEAMS.map(t => t.year).filter(Number.isFinite);
export const FIRST_YEAR = Math.min(...years);
export const LAST_YEAR = Math.max(...years);
export const YEAR_RANGE_LABEL = `${FIRST_YEAR} — ${LAST_YEAR}`;
