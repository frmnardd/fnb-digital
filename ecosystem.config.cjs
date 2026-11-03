/**
 * Konfigurasi PM2 untuk deployment VPS (production).
 *
 * Pakai:
 *   pm2 startOrReload ecosystem.config.cjs --update-env
 *   pm2 save
 *
 * Catatan:
 * - Aplikasi berjalan di port 3000 dan HANYA diakses lewat Nginx (127.0.0.1).
 * - `instances: 1` disarankan: rate-limit PIN & cache env bersifat in-memory.
 *   Jika ingin cluster, pindahkan rate-limit ke Redis terlebih dahulu.
 */
module.exports = {
  apps: [
    {
      name: "fnb-digital",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "768M",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        TZ: "Asia/Jakarta",
      },
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
