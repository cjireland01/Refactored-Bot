// Install pm2 once:   npm install -g pm2
// Run with pm2:       pm2 start ecosystem.config.cjs
// Save so it survives reboots:   pm2 save
module.exports = {
  apps: [
    {
      name: "vcom-bot",
      script: "index.js",
      cwd: __dirname,
      time: true,            // timestamp the logs
      restart_delay: 5000,   // wait 5s before restarting after a crash
      max_restarts: 10,
      env: { NODE_ENV: "production" },
    },
  ],
};
