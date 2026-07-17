// Config do PM2 pro backend em produção. `cwd` aponta pra server/ de propósito
// — é o mesmo diretório de onde o server/.env é lido (dotenv/config resolve a
// partir do cwd do processo), então não precisa mudar nada no server/index.ts.
module.exports = {
  apps: [
    {
      name: 'brasileirao-lendario',
      script: 'dist/index.js',
      cwd: './server',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
    },
  ],
};
