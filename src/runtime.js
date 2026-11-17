const fs = require('node:fs');
const path = require('node:path');
function acquireProcessLock() {
  const directory = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../data'));
  fs.mkdirSync(directory, { recursive: true });
  const lock = path.join(directory, 'bot.lock');
  try {
    const previous = Number(fs.readFileSync(lock, 'utf8'));
    if (Number.isInteger(previous) && previous > 0) {
      try { process.kill(previous, 0); throw new Error(`The bot is already running (process ${previous}). Run only one copy.`); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    fs.unlinkSync(lock);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const fd = fs.openSync(lock, 'wx'); fs.writeFileSync(fd, String(process.pid)); fs.closeSync(fd);
  process.once('exit', () => {
    try { if (fs.readFileSync(lock, 'utf8').trim() === String(process.pid)) fs.unlinkSync(lock); } catch {}
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
