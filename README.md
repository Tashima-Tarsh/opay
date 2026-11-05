# opay — UPI Payment Link + Ledger (integrated)

**opay** is a UPI payment-link generator with an integrated, from-scratch payment ledger. It combines the
opay frontend (payment-link generator + UPI checkout) with ledger-service concepts (transaction recording,
balances, ledger entries, idempotency, callbacks) — built from scratch following
[codecrafters-io/build-your-own-x](https://github.com/codecrafters-io/build-your-own-x) principles.

## What it does

1. **Merchant creates a payment link** (`opay.html`): UPI ID is fixed (`nkumar906099-5@oksbi`); merchant
   enters only the amount and clicks **Pay Now**.
2. A **pending transaction** is created in the ledger (`POST /api/v1/transactions`, idempotent) and the
   customer is sent to the checkout page (`index.html?pa=...&am=...&reference=...`).
3. **Customer pays** (`index.html`): shows a QR code plus a `upi://pay` intent link and a **Pay Now**
   button. Both open any UPI app with the amount/UPI ID/reference.
4. **Callback**: the UPI app returns to `/callback?status=success&reference=...&utr=...`. The server records
   the terminal state in the ledger, writes a ledger entry, updates the balance, and redirects to
   `success.html` (or `failure.html`).

## Files

```
opay/
├── server.js          # Unified Express server: API + static + /callback (records to ledger)
├── ledger.js          # From-scratch append-only ledger (JSON-lines log + in-memory index)
├── idempotency.js     # From-scratch idempotency store (file-backed, periodic flush)
├── opay.html          # Merchant: generate payment link (amount only)
├── index.html         # Customer: checkout (QR + UPI intent link + Pay Now button)
├── success.html       # Payment success screen
├── failure.html       # Payment failure screen
├── css/main.css
├── img/logo.svg, upi.png, opay.png, opaybadge.*
├── qrious/            # vendored QR library
├── data/              # runtime: ledger.log + idempotency.json (gitignored)
├── package.json
└── README.md
```

## API (mirrors payment-ledger-service)

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/api/v1/transactions` | POST | Create a pending transaction (idempotent by `merchantId:reference`), `202 Accepted` |
| `/api/v1/transactions/:id` | GET | Get a transaction |
| `/api/v1/transactions` | GET | List transactions (`?status=`, `?page=`, `?limit=`) |
| `/api/v1/balance` | GET | Merchant balance (sum of completed credits) |
| `/api/v1/ledger` | GET | Ledger entries (`?page=`, `?limit=`) |
| `/callback` | GET | UPI app callback → records terminal state → success/failure page |

Amounts are in the smallest currency unit (paise for INR) to avoid floating-point issues.

## Integration with payment-ledger-service

opay reuses the design of [nurullahgd/payment-ledger-service](https://github.com/nurullahgd/payment-ledger-service)
but in a single-file Node/Express stack:

- **Ledger** → `ledger.js`: transactions, balances, ledger entries (schema-per-tenant simplified to one merchant).
- **Worker pool / async** → callback-driven terminal-state recording (instead of a Go worker pool + webhooks).
- **Idempotency** → `idempotency.js`: `merchantId:reference` key with cached response, `Idempotency-Replayed: true`.
- **Balance consistency** → completed-status guard on `getBalance()` (analogous to `SELECT FOR UPDATE`).
- **Webhook** → `/callback` redirect to success/failure page (analogous to webhook-notify on terminal state).

## codecrafters build-your-own principles applied

- **Build your own database**: `ledger.js` is an append-only, crash-safe log (`ledger.log`, JSON lines) with an
  in-memory index rebuilt by replaying on startup — no external database.
- **Build your own web server**: Express static + API routing, with explicit request/response handling.
- **Build idempotency from scratch**: `idempotency.js` dedupes retried payment-link creations.
- **Amounts in smallest unit**: integer paise, no floats.

## Run locally

```bash
cd opay
npm install          # express (already in package-lock)
npm start            # node server.js 8081
```

Open `http://localhost:8081/opay.html`, enter an amount, click **Pay Now**, then pay via the QR/intent
on the checkout page. The callback records the transaction and shows `success.html`.

### Test the API

```bash
# Create a payment
curl -X POST http://localhost:8081/api/v1/transactions \
  -H 'Content-Type: application/json' \
  -d '{"reference":"order-001","amount":100}'

# Balance
curl http://localhost:8081/api/v1/balance

# Ledger
curl http://localhost:8081/api/v1/ledger
```

## Notes

- This is a local demo; real UPI `upi://pay` links only open on devices with a UPI app installed.
- The `data/` directory (ledger log + idempotency store) is gitignored.
- Not connected to a real bank/gateway; it records the payment outcome reported by the callback.
