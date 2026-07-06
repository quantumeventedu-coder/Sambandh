// scripts/dev.js — one-command local run: starts the server, waits for it to be
// healthy, then opens the web app in the default browser. Used by `npm run dev`.

const { spawn, exec } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PORT = process.env.PORT || 3010;
const URL = `http://localhost:${PORT}`;

console.log('Starting Sambandh…\n');
const server = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], {
  stdio: 'inherit',
  env: process.env
});

let opened = false;
async function waitAndOpen() {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1500));
    try {
      const res = await fetch(URL + '/health');
      if (res.ok) {
        if (!opened) {
          opened = true;
          const cmd = process.platform === 'win32' ? `start "" "${URL}"`
            : process.platform === 'darwin' ? `open "${URL}"` : `xdg-open "${URL}"`;
          exec(cmd, { shell: process.platform === 'win32' ? 'cmd.exe' : undefined });
          console.log(`\n>>> Sambandh is open in your browser: ${URL}`);
          console.log(`>>> Admin panel: ${URL}/admin.html`);
          console.log('>>> Press Ctrl+C here to stop the app.\n');
        }
        return;
      }
    } catch { /* server still booting (first run downloads the local DB) */ }
  }
  console.log(`Could not confirm the server started — try opening ${URL} yourself.`);
}
waitAndOpen();

server.on('exit', code => process.exit(code ?? 0));
process.on('SIGINT', () => { server.kill('SIGINT'); process.exit(0); });
