import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createServer } from 'node:http';
import { generateUPIQR } from 'upipay/qr';

const { MERCHANT_UPI_ID: vpa, MERCHANT_NAME: name = 'Merchant', UPIPAY_ADMIN_PASSWORD: password = process.env.OPAY_ADMIN_PASSWORD,
  UPIPAY_DATA_FILE: dataFile = 'upipay-orders.json', HOST = process.env.RENDER === 'true' ? '0.0.0.0' : '127.0.0.1', PORT = '8080' } = process.env;

if (!vpa || !password) throw new Error('Set MERCHANT_UPI_ID and UPIPAY_ADMIN_PASSWORD before starting.');
await generateUPIQR({ vpa, name, amount: 1, orderId: 'startup-check' });

const digest = (value) => createHash('sha256').update(value).digest();
const admin = digest((process.env.OPAY_ADMIN_USER || 'admin') + ':' + password);
const csrf = randomUUID();
const orders = new Map();
const checkoutMinutes = Math.max(1, Math.min(60, Number(process.env.OPAY_CHECKOUT_MINUTES || 10)));


try {
  for (const order of JSON.parse(readFileSync(dataFile, 'utf8'))) orders.set(order.id, order);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

function save(order) {
  const next = new Map(orders);
  next.set(order.id, order);
  writeFileSync(dataFile + '.tmp', JSON.stringify([...next.values()]), { mode: 0o600 });
  renameSync(dataFile + '.tmp', dataFile);
  orders.set(order.id, order);
}

const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const money = (paise) => 'INR ' + (paise / 100).toFixed(2);
const token = '<input type="hidden" name="csrf" value="' + csrf + '">';

function page(res, title, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | UpiPay</title>
<style>
body{font:1rem/1.5 system-ui;max-width:48rem;margin:3rem auto;padding:0 1rem}
input,button{font:inherit;margin:.25rem;padding:.4rem}img{max-width:100%;height:auto}
li{margin:.75rem 0}a{color:#164da1}
</style><main><h1>${title}</h1>${body}</main></html>`);
}

function redirect(res, path) {
  res.writeHead(303, { Location: path }).end();
}

function fail(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(message);
}

const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    if (req.method === 'GET' && path === '/health') return fail(res, 200, 'OK');

    if (req.method === 'GET' && path === '/opay.html') return redirect(res, '/');

    if (req.method === 'GET' && path.startsWith('/api/order-status/')) {
      const order = orders.get(path.slice('/api/order-status/'.length));
      if (!order) return fail(res, 404, 'Order not found.');
      const expiresAt = order.expiresAt || null;
      const status = order.utr ? 'PAID_VERIFIED' : (expiresAt && Date.now() >= Date.parse(expiresAt) ? 'EXPIRED_UNVERIFIED' : (order.returnedAt ? 'RETURNED_UNVERIFIED' : (order.launchedAt ? 'PENDING' : 'CREATED')));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ orderId: order.id, amountPaise: order.amount, status, expiresAt }));
    }

    if (req.method === 'GET' && path.startsWith('/launch/')) {
      const order = orders.get(path.slice('/launch/'.length));
      if (!order) return fail(res, 404, 'Order not found.');
      if (order.utr) return redirect(res, '/pay/' + order.id);
      if (order.expiresAt && Date.now() >= Date.parse(order.expiresAt)) return redirect(res, '/pay/' + order.id);
      const qr = await generateUPIQR({ vpa: order.vpa, name: order.name, amount: order.amount / 100, orderId: order.id.replaceAll('-', ''), mode: 'open' });
      save({ ...order, launchedAt: new Date().toISOString() });
      // This redirect initiates UPI; it does not prove the payment succeeded.
      res.writeHead(302, { Location: qr.upiUri }).end();
      return;
    }

    if (req.method === 'GET' && path === '/callback') {
      const order = orders.get(url.searchParams.get('reference'));
      if (!order) return fail(res, 404, 'Payment link not found.');
      // App/browser return is an unverified observation, never payment proof.
      if (!order.utr && !order.returnedAt) save({ ...order, returnedAt: new Date().toISOString() });
      return redirect(res, '/pay/' + order.id);
    }

    if (req.method === 'GET' && path.startsWith('/pay/')) {
      const order = orders.get(path.slice(5));
      if (!order) return fail(res, 404, 'Payment link not found.');
      const { id, amount, utr } = order;
      const details = `<p>${escape(order.name)} &middot; ${money(amount)}</p><p>Reference: ${id}</p>`;
      if (utr) return page(res, 'Payment confirmed', details);
      const expired = order.expiresAt && Date.now() >= Date.parse(order.expiresAt);
      const state = expired ? 'EXPIRED_UNVERIFIED' : (order.returnedAt ? 'RETURNED_UNVERIFIED' : (order.launchedAt ? 'PENDING' : 'CREATED'));
      const qr = await generateUPIQR({
        vpa: order.vpa, name: order.name, amount: amount / 100,
        orderId: id.replaceAll('-', ''), mode: 'open',
      });
      return page(res, 'Pay with UPI', details + `<p><img src="${qr.qrImage}" width="280" height="280"
alt="Scan this QR code with your UPI app"></p><p>${expired ? "Checkout expired; do not retry this order." : `<a href="/launch/${id}">Pay using UPI app</a>`}</p>
<p>You can also enter UPI ID <code>${escape(order.vpa)}</code> and amount ${money(amount)} directly in your UPI app.</p>
<p>Order status: <strong>${state}</strong>. Returning from a UPI app never confirms receipt.</p><p>Expires: ${escape(order.expiresAt || "Not set")}</p><p><a href="/callback?reference=${id}">I returned from my UPI app (check status)</a></p><p><a href="/api/order-status/${id}">Read order status JSON</a></p>`);
    }

    if (path !== '/' && path !== '/orders' && path !== '/confirm') return fail(res, 404, 'Not found.');
    const auth = req.headers.authorization ?? '';
    const credentials = auth.startsWith('Basic ') ? Buffer.from(auth.slice(6), 'base64') : '';
    if (!timingSafeEqual(digest(credentials), admin)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="UpiPay merchant", charset="UTF-8"');
      return fail(res, 401, 'Merchant sign-in required.');
    }

    if (req.method === 'GET' && path === '/') {
      let total = 0;
      const rows = [...orders.values()].reverse().map(({ id, amount, utr }) => {
        if (utr) total += amount;
        return `<li><a href="/pay/${id}">${money(amount)} &middot; ${id}</a> &middot;
${utr ? 'Confirmed &middot; ' + escape(utr) : `Pending
<form action="/confirm" method="post">${token}<input type="hidden" name="id" value="${id}">
<label>Verified UPI reference <input name="utr" required maxlength="32"></label>
<button>Confirm receipt</button></form>`}</li>`;
      });
      return page(res, 'UpiPay merchant', `<form action="/orders" method="post">${token}
<label>Amount in INR <input name="amount" inputmode="decimal" required maxlength="12"></label>
<button>Create payment link</button></form><h2>Ledger</h2>
<p>Confirmed receipts: ${money(total)}</p>
<p>Check your bank records for the exact amount and payment reference before confirming an order.</p>
${rows.length ? '<ul>' + rows.join('') + '</ul>' : '<p>No orders yet.</p>'}`);
    }

    if (req.method !== 'POST' || path === '/') return fail(res, 405, 'Method not allowed.');
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
      return fail(res, 415, 'Expected form data.');
    }
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 2048) return fail(res, 413, 'Form too large.');
    }
    const form = new URLSearchParams(body);
    if (form.get('csrf') !== csrf) return fail(res, 403, 'Reload the merchant page and try again.');

    if (path === '/orders') {
      const input = form.get('amount') ?? '';
      if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(input)) return fail(res, 400, 'Enter an INR amount with up to two decimal places.');
      const [rupees, fraction = ''] = input.split('.');
      const amount = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
      if (amount < 1 || amount > 100000000) return fail(res, 400, 'Amount must be between INR 0.01 and INR 1,000,000.');
      const id = randomUUID();
      save({ id, amount, vpa, name, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + checkoutMinutes * 60000).toISOString() });
      return redirect(res, '/pay/' + id);
    }

    const order = orders.get(form.get('id'));
    if (!order) return fail(res, 404, 'Payment link not found.');
    const utr = (form.get('utr') ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6,32}$/.test(utr)) return fail(res, 400, 'Enter a valid UPI transaction reference.');
    if (order.utr === utr) return redirect(res, '/');
    if (order.utr || [...orders.values()].some((entry) => entry.utr === utr)) {
      return fail(res, 409, 'The order or payment reference is already confirmed.');
    }
    save({ ...order, utr });
    return redirect(res, '/');
  } catch (error) {
    console.error(error);
    fail(res, 500, 'UpiPay could not complete the request.');
  }
});

server.listen(Number(PORT), HOST, () => console.log('UpiPay listening at http://' + HOST + ':' + server.address().port));
