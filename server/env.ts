// Carrega server/.env por CAMINHO FIXO (não o `.env` do diretório de onde o
// processo foi iniciado, que é o que `dotenv/config` faz por padrão). Sem
// isso, rodar `node server/dist/index.js` a partir da raiz do repo (como o
// script `npm start` da raiz faz) não encontrava o .env e o servidor
// derrubava logo no boot por falta de JWT_SECRET.
//
// Precisa ser o PRIMEIRO import de index.ts: em ESM, todos os imports de um
// arquivo são resolvidos e avaliados antes do corpo do próprio arquivo rodar
// — se esse carregamento do .env viesse depois do import de auth.ts (que lê
// JWT_SECRET assim que o módulo carrega), já seria tarde demais.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Mesma normalização usada em db.ts: compilado, este arquivo vira
// server/dist/env.js, então precisa subir um nível pra achar server/.env.
const serverRoot = path.basename(__dirname) === 'dist' ? path.join(__dirname, '..') : __dirname;
dotenv.config({ path: path.join(serverRoot, '.env') });
