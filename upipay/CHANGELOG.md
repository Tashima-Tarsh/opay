# Changelog

All notable changes to **upipay** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-06-03

### Initial release

#### Added

**Core payment flow**
- `UPIPay` — unified client class supporting PhonePe Business and Paytm Business free merchant APIs (0% MDR)
- `client.createPayment()` — initiates a hosted UPI payment session and returns a redirect URL
- `client.checkStatus()` — queries PSP Status API to confirm final payment state; includes built-in exponential back-off (3 attempts, 1 s / 2 s / 4 s) on transient network failures
- `client.verifyWebhook()` — authenticates PSP callbacks with HMAC-SHA256 / AES-128-CBC checksums using constant-time comparison (`crypto.timingSafeEqual`)
- `client.createRefund()` — initiates full or partial refunds via PhonePe `/pg/v1/refund` and Paytm `/v3/order/refund`

**UPI QR Code generation**
- `generateUPIQR()` — NPCI-compliant PNG QR code (base64 data URL)
- `generateUPIQRSvg()` — SVG string variant
- `generateUPIQRBuffer()` — raw PNG `Buffer` for saving to disk
- `buildUPIUri()` — raw `upi://pay?...` URI for sharing via WhatsApp / SMS
- `buildIntentLinks()` — deep links for PhonePe, Google Pay, Paytm, and BHIM

**Security controls**
- Webhook replay protection enabled by default — stale webhooks (> 5 minutes) are rejected
- `expectedAmount` verification in `verifyWebhook()` and `checkStatus()` — prevents amount-substitution attacks
- `createPhonePeWebhookGuard()` / `createPaytmWebhookGuard()` — Express-compatible IP allowlisting middleware; requests from outside the PSP's published CIDR ranges are dropped at the transport layer before any cryptographic work is performed
- `sanitizePspError()` — extracts only safe scalar fields from upstream error responses; prevents internal details from propagating into thrown errors or APM logs
- Order ID restricted to `[a-zA-Z0-9_\-.]` — blocks SQL injection, XSS, and path traversal
- `javascript:`, `data:`, `vbscript:`, `file:` URL schemes blocked on callback and redirect URLs
- HTTPS enforced on all URLs in production mode
- Placeholder credential detection — throws on dummy values like `your_salt_key`
- Browser / React Native runtime guard — throws if instantiated in a client-side bundle
- Secret auto-redaction in all log output

**Idempotency**
- `idempotencyKey` field on `CreatePaymentRequest` — forwarded as `X-IDEMPOTENCY-KEY` (PhonePe) and `head.txnSToken` (Paytm) to prevent duplicate sessions on network retries

**Utilities**
- `rupeesToPaise()` — float-safe rupee-to-paise conversion (`5.99 × 100 = 599`, not `599.0000000000001`)
- `withRetry()` — exponential back-off retry wrapper (exported from `upipay/utils`)
- `sanitizePspError()` — PSP error body sanitiser (exported from `upipay/utils`)

**Types**
- Full TypeScript type surface: `UPIPayConfig`, `UPIPayOptions`, `CreatePaymentRequest`, `CreatePaymentResponse`, `PaymentStatusResponse`, `WebhookEvent`, `WebhookVerifyOptions`, `CheckStatusOptions`, `CreateRefundRequest`, `RefundResponse`, `RefundStatus`, `UPIPayError`, `PaymentError`, `NetworkError`, `RefundError`, `WebhookGuardOptions`

**Package**
- ESM + CommonJS dual output via `tsup`
- Sub-path exports: `upipay`, `upipay/phonepe`, `upipay/paytm`, `upipay/qr`, `upipay/utils`
- Zero runtime dependencies (except `qrcode` for QR image rendering)
- npm provenance attestation via GitHub Actions CI
- Tested on Node.js 18, 20, and 22

---

## Versioning policy

| Change type | Version bump |
|:---|:---|
| New PSP adapter, new API method | Minor — `1.x.0` |
| Behaviour change, type rename, removed export | Major — `x.0.0` |
| Defect resolution, documentation, internal refactor | Patch — `1.0.x` |

> This is a **stable v1 release**. The public API (`UPIPay`, `generateUPIQR`, all exported types) is considered stable and will not change without a major version bump.

[1.0.0]: https://github.com/iamrobinsharaya/upipay/releases/tag/v1.0.0
