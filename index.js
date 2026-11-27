// Keep the worker recoverable after a crash while the hosting container is running.
const { spawn } = require('node:child_process');
const path = require('node:path');
let child, stopping = false, timer, failures = 0;
function launch() {
  const started = Date.now();
  child = spawn(process.execPath, [path.join(__dirname, 'src/index.js')], { stdio: 'inherit', env: process.env });
  child.on('error', error => console.error('Worker launch:', error.message));
  child.once('close', (code, signal) => {
    if (stopping) return process.exit(0);
    failures = Date.now() - started > 300000 ? 0 : failures + 1;
    const delay = Math.min(60000, 5000 * 2 ** Math.min(failures - 1, 4));
    console.error(`Bot worker stopped (${signal || code}); restarting in ${delay / 1000}s.`);
    timer = setTimeout(launch, delay);
  });
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  if (stopping) return;
  stopping = true; clearTimeout(timer);
  if (child && child.exitCode === null) {
    child.kill(signal);
    setTimeout(() => { child.kill('SIGKILL'); process.exit(0); }, 20000).unref();
  } else process.exit(0);
});
launch();
