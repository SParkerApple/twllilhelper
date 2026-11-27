function createSetupRecovery(tasks, report = console.warn) {
  const remaining = new Map(Object.entries(tasks));
  let busy = false;
  return async function retry() {
    if (busy) return;
    busy = true;
    try {
      for (const [name, task] of remaining) {
        try { await task(); remaining.delete(name); }
        catch (error) { report(`Setup ${name} will retry:`, error.code || error.message); }
      }
    } finally { busy = false; }
  };
}
module.exports = { createSetupRecovery };
