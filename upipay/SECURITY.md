# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in UPIPay, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Email: **security@upipay.dev** (or create a private advisory on GitHub)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within **48 hours** and aim to release a fix within **7 days**.

## Security Measures Built Into UPIPay

### Webhook Verification
- **SHA256/HMAC-SHA256** checksums for all webhook payloads
- **Constant-time comparison** (`crypto.timingSafeEqual`) — prevents timing attacks
- Both buffers are padded to the same length before comparison, preventing length-based timing leaks
- Null/undefined signature values are explicitly rejected before processing

### Replay Attack Prevention
- **Replay protection is opt-in** — pass `{ enableReplayProtection: true }` to `verifyWebhook()` to enable timestamp-based stale-webhook rejection
- PSPs embed the *transaction* timestamp (not the webhook delivery time), so a fixed tolerance window can silently reject legitimate delayed or retried webhooks; it is off by default for this reason
- When enabled, developers can configure the tolerance via `timestampToleranceSeconds` (default: 300 seconds)
- The PhonePe and Paytm adapters automatically parse payload timestamps (e.g. `timestamp`/`expireAt` for PhonePe, `TXNDATE` for Paytm), or developers can explicitly pass a custom/header timestamp via `options.timestamp`
- **Recommended primary mechanism**: enforce a `UNIQUE` constraint on `transactionId` in your database — this blocks duplicate processing regardless of delivery timing

### Amount Verification
- **Range limits**: ₹1 to ₹10,00,000 enforced on payment creation
- **`expectedAmount` verification**: Pass `expectedAmount` to `checkStatus()` — the SDK will throw if the PSP-returned amount doesn't match, preventing attacks where a ₹1 payment fulfills a ₹10,000 order
- **Float-safe conversion**: `rupeesToPaise()` utility prevents JavaScript floating-point precision bugs

### Input Validation
- **Order ID injection prevention** — only alphanumeric + hyphens/underscores allowed (enforced in both `createPayment` and `checkStatus`)
- **URL scheme blocking** — `javascript:`, `data:`, `vbscript:`, `file:` schemes rejected
- **HTTPS enforcement** — callback/redirect URLs must use HTTPS in production
- **Placeholder credential detection** — warns against dummy/test values in production
- **VPA format validation** — prevents UPI VPA injection
- **Salt index validation** — ensures PhonePe salt index is numeric

### Idempotency / Duplicate Payment Protection
- `verifyWebhook()` returns a `WebhookEvent` object containing `orderId`, `status`, `amount`, and `transactionId`
- Use `event.orderId` as a deduplication key in your database
- **You MUST enforce a unique constraint** on order IDs in your database and check a "fulfilled" flag before processing
- PSPs routinely retry webhook delivery 3-5 times — without idempotency, you risk double-shipping or double-crediting

### Rate Limiting (Your Responsibility)
- The SDK does not implement rate limiting (it's a library, not a server)
- **You MUST rate-limit your webhook endpoint** to prevent DoS attacks via fake webhook floods
- Even though each fake webhook will fail HMAC verification, the SHA256 computation is CPU-intensive
- Recommended: use `express-rate-limit`, Nginx rate limiting, or your cloud provider's WAF
- Suggested limit: 100 requests/minute per IP on webhook endpoints

### Secret Protection
- All credentials are **automatically redacted** in logs and error messages
- Sensitive fields (`saltKey`, `merchantKey`, `secret`, `password`, `token`, `apiKey`) are masked
- Debug mode respects masking — secrets never appear in console output
- Error messages from PSP APIs are truncated to prevent leaking internal details

### Network Security
- **30-second request timeout** (configurable) — prevents hanging connections
- All PSP API calls use HTTPS
- No data is stored or cached by the SDK

### Supply Chain Security
- **Zero runtime dependencies** except `qrcode` (for QR image generation)
- No `postinstall` scripts
- `files` allowlist in `package.json` — only `dist/` is published
- npm provenance attestation enabled in CI

## What UPIPay Does NOT Do

- ❌ Does NOT store any payment data
- ❌ Does NOT log sensitive customer information
- ❌ Does NOT make network requests except to the PSP APIs you configure
- ❌ Does NOT use `eval()`, `Function()`, or dynamic code execution
- ❌ Does NOT require any lifecycle scripts (`preinstall`, `postinstall`)

## Supported Node.js Versions

| Version | Supported |
|:--------|:----------|
| 22.x    | ✅ Yes    |
| 20.x    | ✅ Yes    |
| 18.x    | ✅ Yes    |
| < 18    | ❌ No     |
