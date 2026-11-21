const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
let ownsLock = false;
function processIdentity(pid) {
  if (process.platform !== 'linux') return null;
  // PIDs are reused after container restarts. Include boot and process start time.
  const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
  return `${fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()}:${stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]}`;
}
function acquireProcessLock() {
  if (ownsLock) throw new Error('This process already holds the bot lock.');
  const directory = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../data'));
  fs.mkdirSync(directory, { recursive: true });
  const lock = path.join(directory, 'bot.lock');
  try {
    const saved = JSON.parse(fs.readFileSync(lock, 'utf8'));
    const previous = typeof saved === 'number' ? saved : saved.pid;
    if (Number.isInteger(previous) && previous > 0) {
      // A lock left by this same PID must belong to an earlier container run.
      if (previous !== process.pid) {
        try {
          process.kill(previous, 0);
          const identity = processIdentity(previous);
          if (!saved.identity || !identity || saved.identity === identity)
            throw new Error(`The bot is already running (process ${previous}). Run only one copy.`);
        } catch (error) { if (!['ESRCH', 'ENOENT'].includes(error.code)) throw error; }
      }
    }
    fs.unlinkSync(lock);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const content = JSON.stringify({ pid: process.pid, identity: processIdentity(process.pid), nonce: randomUUID() });
  const fd = fs.openSync(lock, 'wx');
  try { fs.writeFileSync(fd, content); } finally { fs.closeSync(fd); }
  ownsLock = true;
  process.once('exit', () => {
    try { if (fs.readFileSync(lock, 'utf8') === content) fs.unlinkSync(lock); } catch {}
  });
}
const pending = new Set();
let accepting = true;
function trackTask(fn) {
  return (...args) => {
    if (!accepting) return Promise.resolve();
    const task = Promise.resolve().then(() => fn(...args));
    pending.add(task);
    task.then(() => pending.delete(task), () => pending.delete(task));
    return task;
  };
}
function stopAcceptingTasks() { accepting = false; }
async function drainTasks() {
  while (pending.size) await Promise.allSettled([...pending]);
}
module.exports = { acquireProcessLock, trackTask, stopAcceptingTasks, drainTasks };
