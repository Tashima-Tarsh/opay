import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

test('checkout never treats launch or return as payment proof', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'opay-test-'));
  const port = 30000 + Math.floor(Math.random() * 20000);
  const server = spawn(process.execPath, ['checkout/server.mjs'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MERCHANT_UPI_ID: 'merchant@upi', UPIPAY_ADMIN_PASSWORD: 'test-only-password', UPIPAY_DATA_FILE: join(dir, 'orders.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { server.kill(); rmSync(dir, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + port;
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(base + '/health')).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(ready, 'server did not start');
  const auth = 'Basic ' + Buffer.from('admin:test-only-password').toString('base64');
  const home = await (await fetch(base + '/', { headers: { authorization: auth } })).text();
  const csrf = home.match(/name="csrf" value="([^"]+)"/)?.[1];
  assert.ok(csrf);
  const created = await fetch(base + '/orders', { method: 'POST', headers: { authorization: auth, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf, amount: '200.00' }), redirect: 'manual' });
  assert.equal(created.status, 303);
  const orderId = created.headers.get('location').split('/').at(-1);
  let status = await (await fetch(base + '/api/order-status/' + orderId)).json();
  assert.equal(status.status, 'CREATED');
  assert.equal(status.amountPaise, 20000);
  const launched = await fetch(base + '/launch/' + orderId + '?app=gpay', { redirect: 'manual' });
  assert.equal(launched.status, 302);
  assert.match(launched.headers.get('location'), /intent:\/\/pay\?/);
  status = await (await fetch(base + '/api/order-status/' + orderId)).json();
  assert.equal(status.status, 'PENDING');
  const returned = await fetch(base + '/callback?reference=' + orderId, { redirect: 'manual' });
  assert.equal(returned.status, 303);
  status = await (await fetch(base + '/api/order-status/' + orderId)).json();
  assert.equal(status.status, 'RETURNED_UNVERIFIED');
  assert.notEqual(status.status, 'PAID_VERIFIED');
});
