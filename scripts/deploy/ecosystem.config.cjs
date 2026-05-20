/** PM2 konfigurace — cwd se přepíše v deploy-app.sh na APP_DIR. */
module.exports = {
  apps: [
    {
      name: "west-county-akce",
      cwd: "/var/www/west-county-akce",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
