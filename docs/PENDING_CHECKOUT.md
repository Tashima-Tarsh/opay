# OPAY pending-state checkout (first implementation)
This branch adds server-owned checkout session timestamps and a UPI launch endpoint.

## Routes
- `GET /launch/:orderId` — records launch and redirects to a UPI URI; never marks paid.
- `GET /callback?reference=:orderId` — records an unverified browser return.
- `GET /api/order-status/:orderId` — exposes CREATED, PENDING, RETURNED_UNVERIFIED, EXPIRED_UNVERIFIED, or PAID_VERIFIED.
- `GET /pay/:orderId` — displays the current state and payment expiry.

Set `OPAY_CHECKOUT_MINUTES=10` (default 10, clamped 1–60).

## Security and limitations
A browser redirect, app-return status, or a click on the payment link is **not** proof of receipt. This branch deliberately does not send payment-success callbacks or auto-credit wallets. The existing merchant-side manual confirmation remains intact.

## Remaining work before production
- Durable PostgreSQL order storage: current local JSON storage is not reliable on ephemeral Render instances.
- Authenticated merchant webhook registration, HMAC signatures, idempotency and retries.
- A proper mobile app chooser and automatic return observation (where supported by platform).
- Device tests on Android Chrome/Google Pay/PhonePe/Paytm.
- Unit and integration tests and a deployed staging smoke test.

## Webhook configuration (development / staging)
Set `OPAY_WEBHOOK_URL` to an HTTPS merchant endpoint and `OPAY_WEBHOOK_SECRET` to a randomly generated secret of at least 32 characters. Without both, the checkout still works but no merchant events are sent.

Events currently supported:
- `PAYMENT_INITIATED`: first launch of the UPI payment URI.
- `CHECKOUT_RETURN_OBSERVED`: first visit to the return URL after launch. This is browser-observed, not a trusted app or bank event.

Each POST contains `id`, `event`, `orderId`, `amountPaise`, and `occurredAt`. Verify `x-opay-signature` as lowercase hex HMAC-SHA256 over `x-opay-timestamp + '.' + raw request body`, using the shared secret. Reject stale timestamps and deduplicate by `x-opay-event-id`.

**Limitations:** Return observation can be triggered by visiting a URL, so never grant funds, credit a wallet, or treat it as UPI success. The local file outbox is not suitable for multi-instance hosting or ephemeral Render storage. The mobile app chooser and PostgreSQL migration are not yet implemented.

## PostgreSQL support (draft)
The checkout server now uses PostgreSQL for order rows when `DATABASE_URL` is set, creating the `opay_orders` table on startup. Without that variable it uses the existing local JSON file. The server currently loads orders into memory at startup, so this implementation is intended for **one application instance only**. The webhook outbox remains file-backed and is **not yet durable on Render's ephemeral filesystem**.

The branch adds `pg` to the package manifest and switches the install step to `npm install` until a regenerated lockfile can be committed. Do not merge until CI passes and the dependency lockfile is updated.

The Render database `opay-checkout-free-db` is a free, time-limited database. Configure its internal connection string as `DATABASE_URL` in the OPAY service only after staging validation. Never commit the connection string. If Render's internal database connection does not use TLS, set `OPAY_DB_SSL=disable` for that private connection only.

## Android app chooser
The checkout offers generic UPI and package-specific Android intent URLs for Google Pay, PhonePe and Paytm. These need physical-device tests; package availability and intent handling vary across Android browsers. No website can prevent a customer from leaving the app or force a payment.
