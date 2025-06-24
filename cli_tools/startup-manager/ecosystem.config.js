module.exports = {
  apps: [
    {
      name: 'startup-manager',
      script: '/usr/bin/python3',
      args: [
        '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents/cli_tools/startup-manager/startup-manager.py',
        'start'
      ],
      cwd: '/Volumes/ExtremeSSD/PersonalAgents/PersonalAgents',
      autorestart: true,
      restart_delay: 300000,  // 5 minutes
      max_restarts: 3,
      error_file: '/Users/areeb2/.startup-manager/logs/startup-manager-error.log',
      out_file: '/Users/areeb2/.startup-manager/logs/startup-manager-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};