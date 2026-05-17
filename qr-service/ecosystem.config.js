module.exports = {
  apps: [
    {
      name: 'xland-qr-service',
      script: 'server.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        QR_SERVICE_PORT: 3500
      },
      env_production: {
        NODE_ENV: 'production',
        QR_SERVICE_PORT: 3500
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
