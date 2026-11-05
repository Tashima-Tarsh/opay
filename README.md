# Payment Link + Ledger (integrated)

A UPI payment-link generator with an integrated, from-scratch payment ledger. Combines the frontend
(payment-link generator + UPI checkout) with ledger-service concepts (transaction recording, balances,
ledger entries, idempotency, callbacks) built following build-your-own-x principles.

## What it does

1. **Merchant creates a payment link**: UPI ID is fixed; merchant enters only the amount and clicks Pay Now.
   A pending transaction is created in the ledger (`POST /api/v1/transactions`, idempotent).
2. **Customer pays**: checkout page shows a QR code plus a `upi://pay` intent link and a Pay Now button that
   open any UPI app with the amount/UPI ID/reference.
3. **Callback**: the UPI app returns to `/callback`. The server records the terminal state in the ledger,
   writes a ledger entry, updates the balance, and redirects to a success/failure screen.

## Files

```
server.js          # Unified Express server: API + static + /callback (records to ledger)
ledger.js          # From-scratch append-only ledger (JSON-lines log + in-memory index)
idempotency.js     # From-scratch idempotency store (file-backed, periodic flush)
opay.html          # Merchant: generate payment link (amount only)
index.html         # Customer: checkout (QR + UPI intent link + Pay Now button)
success.html       # Payment success screen
failure.html       # Payment failure screen
css/main.css
img/logo.svg, upi.png
qrious/            # vendored QR library
data/              # runtime: ledger.log + idempotency.json (gitignored)
package.json
```

## API

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/api/v1/transactions` | POST | Create a pending transaction (idempotent), `202 Accepted` |
| `/api/v1/transactions/:id` | GET | Get a transaction |
| `/api/v1/transactions` | GET | List transactions (`?status=`, `?page=`, `?limit=`) |
| `/api/v1/balance` | GET | Merchant balance (sum of completed credits) |
| `/api/v1/ledger` | GET | Ledger entries (`?page=`, `?limit=`) |
| `/callback` | GET | Payment callback → records terminal state → success/failure page |

Amounts are in the smallest currency unit (paise for INR).

## Run locally

```bash
npm install
npm start          # node server.js 8081
```

Open `http://localhost:8081/opay.html`, enter an amount, click **Pay Now**, then pay via the QR/intent
on the checkout page.
