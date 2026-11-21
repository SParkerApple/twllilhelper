const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const runtime = require.resolve('../src/runtime');

function run(t, setup, body = 'runtime.acquireProcessLock();') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'twl-lock-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = `const fs=require('node:fs');const runtime=require(${JSON.stringify(runtime)});const lock=${JSON.stringify(path.join(dir, 'bot.lock'))};${setup};${body}`;
  return { dir, result: spawnSync(process.execPath, ['-e', source], { env: { ...process.env, DATA_DIR: dir }, encoding: 'utf8' }) };
}
test('restart replaces legacy lock with the same recycled PID', t => {
  const { dir, result } = run(t, "fs.writeFileSync(lock,String(process.pid))");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(dir, 'bot.lock')), false);
});
test('a live other process still prevents duplicate startup', t => {
  const { result } = run(t, `fs.writeFileSync(lock,${JSON.stringify(String(process.pid))})`);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /already running/);
});
test('repeated acquisition within the same process is rejected', t => {
  const { result } = run(t, '', 'runtime.acquireProcessLock();runtime.acquireProcessLock();');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /already holds/);
});
test('exit does not remove a replacement lock', t => {
  const { dir, result } = run(t, '', "runtime.acquireProcessLock();fs.writeFileSync(lock,'replacement');");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(dir, 'bot.lock'), 'utf8'), 'replacement');
});
test('Linux ignores a PID reused by a different process instance', { skip: process.platform !== 'linux' }, t => {
  const saved = JSON.stringify({ pid: process.pid, identity: 'previous-boot:123' });
  const { result } = run(t, `fs.writeFileSync(lock,${JSON.stringify(saved)})`);
  assert.equal(result.status, 0, result.stderr);
});
