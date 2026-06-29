# Brasileirão Lendário ⭐

Jogo de draft de futebol: role o dado, monte seu time dos sonhos com craques de
27 times campeões brasileiros (1961-2006), escolha um esquema tático entre 15
formações reais, e dispute um campeonato de pontos corridos.

## Como rodar localmente

Pré-requisitos: [Node.js](https://nodejs.org/) instalado (versão 18 ou mais recente).

```bash
# instalar dependências
npm install

# rodar em modo desenvolvimento
npm run dev
```

Depois abra o endereço que aparecer no terminal (geralmente `http://localhost:5173`).

## Como gerar a versão de produção

```bash
npm run build
```

Os arquivos finais ficam na pasta `dist/`, prontos para publicar em qualquer
serviço de hospedagem estática (Vercel, Netlify, GitHub Pages, etc).

## Estrutura do projeto

```
brasileirao-lendario-app/
├── index.html          # HTML base
├── package.json         # dependências e scripts
├── vite.config.js       # configuração do Vite
└── src/
    ├── main.jsx          # ponto de entrada React
    └── App.jsx           # todo o jogo (dados, lógica e telas)
```

## Como subir para o GitHub

1. Crie um repositório novo no GitHub (sem adicionar README/license por lá, pra evitar conflito).
2. No terminal, dentro desta pasta, rode:

```bash
git init
git add .
git commit -m "Primeira versão do Brasileirão Lendário"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
git push -u origin main
```

Troque `SEU_USUARIO/NOME_DO_REPO` pelo endereço do seu repositório.

## Abrindo no VS Code

```bash
code .
```

(ou abra a pasta manualmente pelo menu File > Open Folder do VS Code)
