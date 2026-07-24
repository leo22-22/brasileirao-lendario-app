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
