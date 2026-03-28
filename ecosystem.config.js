module.exports = {
  apps: [
    {
      name:    'velocitee',
      script:  'server.js',
      cwd:     '/home/velocitee/velocitee',
      instances:  1,
      autorestart: true,
      watch:   false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/home/velocitee/.pm2/logs/velocitee-error.log',
      out_file:   '/home/velocitee/.pm2/logs/velocitee-out.log',
      merge_logs: true,
    },
  ],
};
