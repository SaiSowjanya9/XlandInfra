module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'server.js',
      cwd: '/var/www/app/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/www/app/backend/logs/error.log',
      out_file: '/var/www/app/backend/logs/output.log',
      log_file: '/var/www/app/backend/logs/combined.log',
      time: true
    }
  ]
};
