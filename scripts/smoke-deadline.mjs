export function smokeDeadline(value = '30000') {
  if (!/^[0-9]+$/.test(value) || Number(value) < 30000 || Number(value) > 120000) throw new Error('Smoke deadline must be 30000–120000 milliseconds.');
  return Number(value);
}
// Even a dirty application that declines a graceful close must not orphan a test.
export function watchSmokeProcess(child, milliseconds, onTimeout, forceAfter = 5000) {
  let force;
  const dispose = () => { clearTimeout(timer); clearTimeout(force); };
  const timer = setTimeout(() => {
    onTimeout();
    try { child.kill(); } catch { /* Still attempt the forced termination. */ }
    force = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* The child exit/error handler remains authoritative. */ } }, forceAfter);
  }, milliseconds);
  child.once('exit', dispose); child.once('error', dispose);
  return dispose;
}
