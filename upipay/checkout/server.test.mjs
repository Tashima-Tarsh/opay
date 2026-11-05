import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { test } from 'node:test';

test('merchant creates, shares, and confirms a UPI order', { timeout: 15000 }, async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'upipay-'));
  let child;
  const stop = async () => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const closed = once(child, 'exit');
    child.kill();
    await closed;
  };
  t.after(async () => {
    await stop();
    await rm(dir, { recursive: true, force: true });
  });

  async function start() {
    child = spawn(process.execPath, ['checkout/server.mjs'], {
      env: {
        ...process.env, HOST: '127.0.0.1', PORT: '0', MERCHANT_UPI_ID: 'test@ybl',
        MERCHANT_NAME: 'Test & Co', OPAY_ADMIN_USER: '', UPIPAY_ADMIN_PASSWORD: 'test-password',
        UPIPAY_DATA_FILE: join(dir, 'orders.json'),
      },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const lines = createInterface({ input: child.stdout });
    const [line] = await once(lines, 'line');
    return line.split(' ').at(-1);
  }

  let url = await start();
  const headers = { Authorization: 'Basic ' + Buffer.from('admin:test-password').toString('base64') };
  assert.equal((await fetch(url)).status, 401);
  const merchant = await (await fetch(url, { headers })).text();
  const csrf = merchant.match(/name="csrf" value="([^"]+)"/)[1];

  const post = (path, fields) => fetch(url + path, {
    method: 'POST', headers, redirect: 'manual', body: new URLSearchParams(fields),
  });
  assert.equal((await post('/orders', { amount: '10.25' })).status, 403);
  assert.equal((await post('/orders', { csrf, amount: '10.255' })).status, 400);
  const created = await post('/orders', { csrf, amount: '10.25' });
  assert.equal(created.status, 303);
  const checkout = created.headers.get('location');
  const id = checkout.split('/').at(-1);
  const pending = await (await fetch(url + checkout)).text();
  assert.match(pending, /data:image\/png;base64,/);
  assert.match(pending, /upi:\/\/pay\?pa=test%40ybl.*am=10\.25/);
  assert.match(pending, /Test &amp; Co/);
  const returned = await fetch(url + '/callback?status=success&reference=' + id, { redirect: 'manual' });
  assert.equal(returned.status, 303);
  assert.equal(returned.headers.get('location'), checkout);
  assert.match(await (await fetch(url + checkout)).text(), /Pending merchant confirmation/);

  const receipt = { csrf, id, utr: '123456789012' };
  assert.equal((await post('/confirm', receipt)).status, 303);
  assert.equal((await post('/confirm', receipt)).status, 303);
  const second = await post('/orders', { csrf, amount: '5' });
  assert.equal((await post('/confirm', { ...receipt, id: second.headers.get('location').split('/').at(-1) })).status, 409);
  await stop();

  url = await start();
  assert.match(await (await fetch(url + checkout)).text(), /Payment confirmed/);
  assert.match(await (await fetch(url, { headers })).text(), /Confirmed receipts: INR 10\.25/);
});
