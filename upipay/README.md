<div align="center">

# 🇮🇳 UPIPay

### The Zero-Commission UPI Payment Gateway — No Middlemen. No Fees. Direct to Your Bank.

[![npm version](https://img.shields.io/npm/v/upipay?style=flat-square&color=CB3837)](https://www.npmjs.com/package/upipay)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Tests](https://img.shields.io/badge/Tests-120%20passed-brightgreen?style=flat-square)](https://github.com/iamrobinsharaya/upipay)
[![Zero Commission](https://img.shields.io/badge/Commission-₹0%20Forever-success?style=flat-square)](https://www.npmjs.com/package/upipay)
[![Security](https://img.shields.io/badge/Security-Hardened-blueviolet?style=flat-square)](./SECURITY.md)

**Accept UPI payments in any JavaScript or TypeScript app — React, Next.js, Express, Vue, SvelteKit, NestJS, or plain Node.js.**
**₹0 per transaction. No commission. No middlemen. Direct bank settlement. Forever.**

[Quick Start](#quick-start) · [No Middleman Explained](#no-middleman-explained) · [vs Razorpay / Stripe](#upipay-vs-razorpay-vs-stripe-vs-cashfree) · [API Reference](#api-reference) · [Security](#security) · [Examples](#complete-integration-examples) · [FAQ](#frequently-asked-questions) · [Contributing](./CONTRIBUTING.md)

</div>

---

## Table of Contents

1. [What Is UPIPay?](#what-is-upipay)
2. [No Middleman Explained](#no-middleman-explained)
3. [Why UPIPay?](#why-upipay)
4. [UPIPay vs Razorpay vs Stripe vs Cashfree](#upipay-vs-razorpay-vs-stripe-vs-cashfree)
5. [Features](#features)
6. [Quick Start](#quick-start)
7. [Getting Free Merchant Credentials](#getting-free-merchant-credentials)
8. [Environment Variables Setup](#environment-variables-setup)
9. [API Reference](#api-reference)
   - [`generateUPIQR`](#generateupiqrrequest--upi-qr-code)
   - [`buildUPIUri`](#buildupirirequest--upi-payment-link)
   - [`buildIntentLinks`](#buildintentlinksupiuri--app-deep-links)
   - [`client.createPayment`](#clientcreatepaymentrequest--initiate-psp-payment)
   - [`client.checkStatus`](#clientcheckstatusorderid-options--confirm-payment-status)
   - [`client.verifyWebhook`](#clientverifywebhookpayload-signature-options--authenticate-webhook)
   - [`client.createRefund`](#clientcreaterefundrequest--initiate-refund)
   - [Full Config Options](#full-configuration-options)
10. [Security](#security)
11. [Complete Integration Examples](#complete-integration-examples)
    - [Express.js](#complete-expressjs-integration-example)
    - [Next.js App Router](#full-stack-example--nextjs-app-router)
    - [Fastify](#fastify-integration)
    - [NestJS](#nestjs-integration)
    - [Paytm Full Example](#complete-paytm-integration-example)
12. [Architecture](#architecture--how-money-flows)
13. [Works With Any Framework](#works-with-any-javascript-app-or-website)
14. [Project Structure](#project-structure)
15. [FAQ](#frequently-asked-questions)
16. [Comparison Summary](#comparison-with-paid-gateways)
17. [Contributing](#contributing)
18. [License](#license)

---

<!--
SEO Keywords: accept upi payments javascript, free open payment gateway india, upi payment gateway free india,
phonepe api nodejs, paytm api nodejs, upi qr code generator, zero commission payment gateway india,
free razorpay alternative, upi webhook verification, upi payment typescript, npci upi javascript,
google pay phonepe paytm integration, upi payment without fees, zero mdr upi, open source payment gateway india,
upi deep link generator, bhim upi integration, accept upi react nextjs, upi payment express js nextjs,
phonepe business api, paytm business api, upi sdk javascript, upipay npm, accept upi without razorpay,
free payment gateway india website, upi payment nextjs, upi payment react, open payment gateway india,
how to accept upi payment without razorpay, upi payment integration nodejs, zero mdr upi payment gateway,
no commission payment gateway india, direct upi payment bank, upi payment free india 2024,
phonepe merchant api free, paytm merchant api free, npci upi specification, upi payment sdk,
razorpay alternative free india, cashfree alternative free, payu alternative free india
-->

## What Is UPIPay?

UPIPay is a **free, open-source Node.js SDK** that lets you accept UPI payments directly into your bank account — bypassing all paid payment aggregators like Razorpay, Cashfree, PayU, or Stripe.

It works by directly integrating with the free merchant APIs provided by **PhonePe Business** and **Paytm Business** — both of which are legally required to offer 0% commission on UPI transactions under the Government of India's 2020 mandate. UPIPay wraps these APIs into a clean, TypeScript-first developer experience with production-grade security.

```
Without UPIPay:   Customer → Razorpay (takes 2%) → Your Bank
With UPIPay:      Customer → NPCI Network          → Your Bank
```

---

## No Middleman Explained

### The Problem: Why Developers Pay Unnecessary Commissions

Most Indian developers use Razorpay, Cashfree, or PayU because they are well-documented and easy to integrate. But these platforms are **commercial aggregators** — they sit between your customer and your bank and take a cut of every transaction:

- **Razorpay**: 2% + GST per UPI transaction
- **Cashfree**: 1.9% per UPI transaction
- **PayU**: 1.99% per UPI transaction
- **Stripe India**: 2–3% per transaction

On ₹1,00,000 in monthly sales, you lose **₹2,000–₹3,000 every month** — that is **₹24,000–₹36,000 per year** — for doing absolutely nothing. The money is yours. You earned it. You should keep it.

### The Solution: Use the Free APIs That Already Exist

The Indian government mandated **0% MDR (Merchant Discount Rate)** on all standard bank-to-bank UPI transactions in January 2020. This means:

> PhonePe, Paytm, Google Pay, and every UPI-enabled bank are **legally prohibited from charging merchants** for standard bank-to-bank UPI transactions.

*Note on PPI / Credit Cards:* Under NPCI guidelines, transactions paid via **Prepaid Payment Instruments (PPI)** like digital wallets (e.g. Paytm Wallet, PhonePe Wallet) or **Credit Cards linked to UPI** may attract interchange fees (typically 0.5%–1.1% for transactions above ₹2,000). Standard bank-account-based UPI transfers remain 100% free of charge for all amounts.

PhonePe Business and Paytm Business expose **free, official merchant APIs** with full access to payment initiation, status checking, and webhook notifications. These APIs route transactions directly to the same underlying UPI network (NPCI) that paid aggregators connect to. But when you use a paid aggregator like Razorpay, they route the transaction through their own commercial gateway and charge you a platform fee/MDR for the integration layer and convenience.

**UPIPay removes that layer entirely.**

### How Money Actually Flows

```
┌─────────────────────────────────────────────────────────────────────┐
│  WITH RAZORPAY / CASHFREE / PAYU (Paid Aggregator)                 │
│                                                                     │
│  Customer Bank → NPCI → Aggregator (takes 2%) → Your Bank          │
│                           ↑                                         │
│                    Bills you monthly,                               │
│                    holds settlements,                               │
│                    can freeze your account                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  WITH UPIPAY (Direct — Zero Commission)                             │
│                                                                     │
│  Customer Bank → NPCI → Your Bank (100% of funds, instantly)       │
│                                                                     │
│  PhonePe / Paytm role: authenticate + notify only (₹0 fee)         │
│  UPIPay role:          sign requests + verify webhooks (₹0 fee)     │
└─────────────────────────────────────────────────────────────────────┘
```

### What PhonePe and Paytm Do (and Don't Do)

PhonePe Business and Paytm Business are **not middlemen in the commission sense**. They are free infrastructure providers:

| Role | PhonePe / Paytm with UPIPay |
|:-----|:----------------------------|
| Route money | ❌ No — NPCI does this directly |
| Take commission | ❌ No — 0% MDR mandated by law |
| Hold settlement | ❌ No — instant settlement to your bank |
| Authenticate payment | ✅ Yes — via signed API request |
| Send you a webhook | ✅ Yes — signed POST to your server |
| Provide Status API | ✅ Yes — so you can verify the payment |

They are effectively free notification and authentication infrastructure — like email but for payments.

### Real Savings Calculator

| Monthly UPI Revenue | Razorpay (2%) | Cashfree (1.9%) | **UPIPay (0%)** | **Annual Savings** |
|:--------------------|:--------------|:----------------|:----------------|:-------------------|
| ₹50,000 | ₹1,000 lost | ₹950 lost | **₹0** | **₹12,000** |
| ₹1,00,000 | ₹2,000 lost | ₹1,900 lost | **₹0** | **₹24,000** |
| ₹5,00,000 | ₹10,000 lost | ₹9,500 lost | **₹0** | **₹1,20,000** |
| ₹10,00,000 | ₹20,000 lost | ₹19,000 lost | **₹0** | **₹2,40,000** |
| ₹50,00,000 | ₹1,00,000 lost | ₹95,000 lost | **₹0** | **₹12,00,000** |

*\*Calculations are based on standard bank-to-bank UPI transactions. Wallet (PPI) and Credit Card UPI payments over ₹2,000 may incur small interchange fees (0.5%–1.1%) as per NPCI rules.*

---

## Why UPIPay?

Indian developers building websites, apps, SaaS products, and e-commerce stores need to accept payments. Most use paid gateways like Razorpay or Stripe that charge **2–3% commission per transaction**. On ₹1 lakh in monthly sales, that is ₹2,000–₹3,000 gone every month — forever.

**UPIPay eliminates that fee entirely.** Money flows directly from the customer's UPI app → NPCI network → your bank account. No middlemen, no platform cuts.

UPIPay is an **open payment gateway** — open-source, free to use, no vendor lock-in, and no per-transaction fees. It works in any JavaScript or TypeScript project:

| Where you build | How UPIPay fits |
|:----------------|:----------------|
| **Next.js** | Payment API routes + QR in React components |
| **React** | QR generation in the browser (`upipay/qr`); payment logic in API routes |
| **Express / Fastify / Hono** | Full payment flow on the server |
| **NestJS** | Injectable service wrapping `UPIPay` |
| **SvelteKit / Remix / Nuxt** | Server-side hooks/loaders handle payments |
| **Plain Node.js scripts** | CLI tools, cron jobs, batch payment checks |
| **Bun / Deno** | Supported via npm compatibility |

### How This Is Legally Possible

The Indian government mandates **0% MDR (Merchant Discount Rate)** on all UPI transactions since 2020. PhonePe Business and Paytm Business are required to offer **free** merchant accounts with full API access. UPIPay is a **library** (sometimes called an SDK — a Software Development Kit) that wraps these free, official APIs into a secure, TypeScript-first developer experience.

> **What is an SDK?** An SDK (Software Development Kit) is a ready-to-use library that lets you integrate a service into your app without writing all the networking, security, and validation code yourself. `npm install upipay` gives you the full UPI payment toolkit in one command.

```
₹0 per transaction. No setup fees. No annual charges. No hidden costs.
```

---

## UPIPay vs Razorpay vs Stripe vs Cashfree

This is the most important table in this document. Read it carefully.

| Feature | **UPIPay** | Razorpay | Stripe India | Cashfree | PayU India |
|:--------|:-----------|:---------|:-------------|:---------|:-----------|
| **UPI Payments** | ✅ Free* | ✅ 2% fee | ✅ 2–3% fee | ✅ 1.9% fee | ✅ 1.99% fee |
| **Per-transaction cost** | **₹0*** | ~₹2 per ₹100 | ~₹2–3 per ₹100 | ~₹1.90 per ₹100 | ~₹1.99 per ₹100 |
| **Setup cost** | ₹0 | ₹0 | ₹0 | ₹0 | ₹0 |
| **Monthly fees** | ₹0 | ₹0 | ₹0 | ₹0 | ₹0 |
| **Settlement hold** | None | 2–3 days | 2–7 days | 2–3 days | 2–3 days |
| **Money routing** | Direct to your bank | Via Razorpay escrow | Via Stripe escrow | Via Cashfree escrow | Via PayU escrow |
| **Account freeze risk** | None | Yes — TOS violations | Yes | Yes | Yes |
| **Open source** | ✅ MIT | ❌ Proprietary | ❌ Proprietary | ❌ Proprietary | ❌ Proprietary |
| **Vendor lock-in** | ❌ None | ✅ High | ✅ High | ✅ Medium | ✅ Medium |
| **TypeScript support** | ✅ Full types | ⚠️ Partial | ✅ Full | ⚠️ Partial | ❌ Minimal |
| **Webhook verification** | ✅ HMAC-SHA256 | ✅ | ✅ | ✅ | ✅ |
| **Amount verification** | ✅ Built-in | ✅ | ✅ | ⚠️ Manual | ⚠️ Manual |
| **Replay protection** | ✅ Opt-in + DB idempotency | ✅ | ✅ | ⚠️ | ⚠️ |
| **IP allowlisting** | ✅ Built-in middleware | ❌ | ❌ | ❌ | ❌ |
| **QR Code generation** | ✅ NPCI-compliant | ✅ | ❌ | ✅ | ✅ |
| **UPI Deep links** | ✅ All apps | ⚠️ | ❌ | ⚠️ | ⚠️ |
| **Refunds** | ✅ Full + partial | ✅ | ✅ | ✅ | ✅ |
| **Idempotency keys** | ✅ Built-in | ✅ | ✅ | ⚠️ | ❌ |
| **Retry with backoff** | ✅ Built-in | ❌ | ❌ | ❌ | ❌ |
| **Secret redaction in logs** | ✅ Auto | ❌ | ❌ | ❌ | ❌ |
| **Browser guard** | ✅ Throws at runtime | ❌ | ❌ | ❌ | ❌ |
| **Merchant account needed** | Optional (QR) / Yes (PSP) | Yes | Yes | Yes | Yes |
| **Replay protection default** | Opt-in (DB idempotency recommended) | ✅ On | ✅ On | ⚠️ | ⚠️ |
| **Supply chain risk** | Minimal (1 dependency) | High (100+ deps) | High | High | High |

*\*Free for standard bank-to-bank UPI transactions. Wallet (PPI) and Credit Card UPI payments over ₹2,000 may incur small interchange fees (0.5%–1.1%) per NPCI guidelines.*

### When to Use Razorpay Instead

UPIPay is not for every use case. Use Razorpay, Stripe, or Cashfree if you need:

- **Credit/Debit card payments** — UPIPay only handles UPI
- **International payments** — UPIPay is India-only
- **EMI / Buy Now Pay Later** — not supported
- **Marketplace / split payments** — not supported
- **Zero developer time** — if you cannot manage your own server infra

For pure UPI payment acceptance in India with full developer control, UPIPay is the correct choice.

---

## Features

| Feature | Details |
|:--------|:--------|
| **Zero Commission** | ₹0 per transaction — 0% MDR mandated by Government of India |
| **No Middlemen** | Money flows directly: Customer Bank → NPCI → Your Bank |
| **No Vendor Lock-in** | Open-source MIT license — switch providers or fork freely |
| **Works Everywhere** | React, Next.js, Vue, SvelteKit, Express, NestJS, Fastify, Remix, plain Node.js |
| **Free UPI Payments** | PhonePe Business & Paytm Business free merchant APIs |
| **UPI QR Code** | NPCI-compliant QR accepted by ALL UPI apps — GPay, PhonePe, Paytm, BHIM |
| **UPI Deep Links** | App intent links: `phonepe://`, `tez://`, `paytmmp://`, `upi://` |
| **Webhook Verification** | HMAC-SHA256 + constant-time comparison — same standard as Stripe |
| **Amount Verification** | Prevents amount-substitution attacks with `expectedAmount` option |
| **Replay Protection** | Timestamp-based stale webhook rejection — opt-in via `enableReplayProtection: true` |
| **Idempotency Keys** | Built-in support for PSP idempotency tokens — prevents duplicate sessions |
| **Auto Retry** | Exponential backoff on transient network failures — built into `checkStatus` |
| **Refunds** | Full and partial refund support for both PhonePe and Paytm |
| **IP Allowlisting** | `createPhonePeWebhookGuard()` / `createPaytmWebhookGuard()` — blocks forged webhooks |
| **TypeScript + JavaScript** | Full types, JSDoc, autocomplete in VS Code / WebStorm |
| **ESM + CommonJS** | Works with `import` and `require` — any bundler or build tool |
| **Minimal Footprint** | Only `qrcode` dependency — zero supply chain risk |
| **Security Hardened** | Injection prevention, secret masking, browser environment guard, error sanitisation |

---

## Quick Start

### Install

```bash
npm install upipay
```

### 1. Generate a UPI QR Code (No Merchant Account Needed)

The simplest way to accept UPI payments in Node.js — generate an NPCI-compliant QR code that works with every Indian UPI app:

```typescript
import { generateUPIQR, buildIntentLinks } from 'upipay';

// Generate a QR code your customer can scan with PhonePe, GPay, Paytm, or BHIM
// Amount is FIXED by default — user CANNOT change it (not even 1 paisa)
const qr = await generateUPIQR({
  vpa: 'mybusiness@ybl',       // Your UPI VPA (Virtual Payment Address)
  name: 'My Business',          // Display name shown in the UPI app
  amount: 500.00,               // Amount in rupees
  orderId: 'order_001',         // Your reference ID for tracking
  note: 'Payment for Order 001',
  mode: 'fixed',                // DEFAULT — amount is locked, non-editable
  // mode: 'open',              // Use this ONLY if you want user to choose amount
});

// Render the QR image: <img src={qr.qrImage} />
// Share a payment link: qr.upiUri

// Build deep links that open a specific UPI app directly
const links = buildIntentLinks(qr.upiUri);
// links.phonepe → 'phonepe://pay?...'    (opens PhonePe)
// links.gpay    → 'tez://upi/pay?...'   (opens Google Pay)
// links.paytm   → 'paytmmp://pay?...'   (opens Paytm)
// links.bhim    → 'upi://pay?...'       (opens BHIM / any UPI app)
```

> [!CAUTION]
> **QR-Only Flow = No Automated Verification.** Raw UPI QR codes have no webhook or status API — there is no server-side way to automatically confirm a payment. Do not ship products or credit wallets based solely on a QR scan. Verify payment manually via your bank SMS or portal. For fully automated payment confirmation, use the PSP flow below.

### 2. Full Payment Flow with PhonePe Business (Free)

This is the production approach for e-commerce, SaaS, and any app that needs automatic payment confirmation:

```typescript
import { UPIPay } from 'upipay';

const client = new UPIPay({
  provider: 'phonepe',
  environment: 'sandbox',   // Change to 'production' for real payments
  credentials: {
    merchantId: process.env.PHONEPE_MERCHANT_ID!,
    saltKey:    process.env.PHONEPE_SALT_KEY!,
    saltIndex:  '1',
  },
});

// Step 1 — Create a payment session
const payment = await client.createPayment({
  amount:          50000,                              // ₹500.00 in paise (1 rupee = 100 paise)
  orderId:         'order_abc123',
  customerPhone:   '9876543210',
  callbackUrl:     'https://yoursite.com/api/webhook', // PhonePe will POST here after payment
  redirectUrl:     'https://yoursite.com/payment-done',
});

// Step 2 — Redirect the customer to the PhonePe payment page
// res.redirect(payment.paymentUrl);

// Step 3 — Verify the webhook PhonePe sends to your server
// The SDK auto-detects PhonePe's {"response":"eyJ..."} wrapper format
app.post('/api/webhook', express.raw({ type: '*/*' }), (req, res) => {
  const event = client.verifyWebhook(req.body, req.headers['x-verify'] as string, {
    expectedAmount: 50000,  // Validates the paid amount matches your order (prevents fraud)
  });
  if (!event.verified) return res.status(401).send('Unauthorized');

  // event.orderId, event.status, event.amount, event.transactionId
  console.log(`Payment ${event.status} — Order: ${event.orderId}`);
  res.status(200).send('OK');
});

// Step 4 — Confirm via Status API before fulfilling the order
const status = await client.checkStatus('order_abc123', { expectedAmount: 50000 });
if (status.status === 'SUCCESS') {
  console.log(`₹${status.amount / 100} received!`);
}
```

### 3. Same Flow with Paytm Business (Free)

```typescript
import { UPIPay } from 'upipay';

const client = new UPIPay({
  provider: 'paytm',
  environment: 'sandbox',
  credentials: {
    merchantId:  process.env.PAYTM_MERCHANT_ID!,
    merchantKey: process.env.PAYTM_MERCHANT_KEY!,
  },
});

// Identical API: createPayment(), checkStatus(), verifyWebhook()
```

> [!IMPORTANT]
> **Paytm Callback Behaviour:** Unlike PhonePe (which sends a background server-to-server webhook), Paytm redirects the **customer's browser** via a POST request to your `callbackUrl`. Your handler must verify the checksum, update the database, and then **render a success/failure page or redirect the user** — not return a raw JSON response. Failing to do so will display a blank JSON response to the customer.

### 4. Currency Conversion — Avoid Float Bugs

JavaScript floating-point arithmetic is notoriously imprecise: `5.99 * 100 = 599.0000000000001`. UPIPay ships a safe conversion helper:

```typescript
import { rupeesToPaise } from 'upipay';

const paise = rupeesToPaise(5.99); // Returns exactly 599
const paise2 = rupeesToPaise(499); // Returns exactly 49900
```

### 5. Webhook Replay Protection

Replay protection is **opt-in** (`enableReplayProtection: false` by default). PSPs embed the *transaction* timestamp in webhook payloads, not the webhook delivery time. Enabling a strict time window against this value will silently reject legitimate webhooks delayed by network congestion or PSP retry intervals.

The recommended replay-prevention mechanism is a **database-level unique constraint** on `transactionId`. This is robust against both delayed delivery and intentional replays:

```sql
ALTER TABLE payments ADD CONSTRAINT unique_txn_id UNIQUE (transaction_id);
```

If you still want timestamp-based protection, enable it explicitly with a generous tolerance window:

```typescript
// Opt-in: reject webhooks whose transaction timestamp is older than 10 minutes
const event = client.verifyWebhook(rawBody, signature, {
  enableReplayProtection: true,
  timestampToleranceSeconds: 600,
});

// Default (recommended): replay protection off — rely on DB idempotency instead
const event = client.verifyWebhook(rawBody, signature);
```

---

## Getting Free Merchant Credentials

### PhonePe Business (Recommended for most developers)

1. Visit [business.phonepe.com](https://business.phonepe.com)
2. Register with your mobile number and business details
3. Complete KYC (takes 1–3 working days)
4. Go to **Developer Settings** → copy **Merchant ID**, **Salt Key**, **Salt Index**

### Paytm Business

1. Visit [business.paytm.com](https://business.paytm.com)
2. Sign up with your business details
3. Complete KYC → **Developer Settings** → copy **Merchant ID**, **Merchant Key**

| Document | Required |
|:---------|:---------|
| PAN Card | ✅ Yes |
| Aadhaar Card | ✅ Yes |
| Bank Account | ✅ Yes |
| GST Certificate | ❌ Optional |

> **Both are 100% free.** No setup fees, no annual charges, no per-transaction commission — mandated by the Government of India.

---

## Environment Variables Setup

Never hardcode credentials. Create a `.env` file in your project root:

```bash
# .env — NEVER commit this file to Git
# Add .env to your .gitignore

# PhonePe Business (get from business.phonepe.com → Developer Settings)
PHONEPE_MERCHANT_ID=YOUR_MERCHANT_ID_HERE
PHONEPE_SALT_KEY=YOUR_SALT_KEY_HERE
PHONEPE_SALT_INDEX=1
PHONEPE_ENV=sandbox           # Change to 'production' for real payments

# Paytm Business (get from business.paytm.com → Developer Settings)
PAYTM_MERCHANT_ID=YOUR_MERCHANT_ID_HERE
PAYTM_MERCHANT_KEY=YOUR_MERCHANT_KEY_HERE
PAYTM_ENV=sandbox             # Change to 'production' for real payments

# Your app URLs
APP_BASE_URL=https://yoursite.com
WEBHOOK_URL=https://yoursite.com/api/webhook
REDIRECT_URL=https://yoursite.com/payment/success
```

```bash
# .gitignore — make sure this is there
.env
.env.local
.env.production
```

Load env vars in your app:

```bash
# Node.js 20.6+ has native .env support
node --env-file=.env server.js

# Or use dotenv
npm install dotenv
```

```typescript
// At the top of your entry file (server.ts / app.ts)
import 'dotenv/config';
import { UPIPay } from 'upipay';

const provider = (process.env.PROVIDER as 'phonepe' | 'paytm') ?? 'phonepe';
const environment = (process.env.PAYMENT_ENV as 'sandbox' | 'production') ?? 'sandbox';

const credentials = provider === 'phonepe'
  ? {
      merchantId: process.env.PHONEPE_MERCHANT_ID!,
      saltKey:    process.env.PHONEPE_SALT_KEY!,
      saltIndex:  process.env.PHONEPE_SALT_INDEX ?? '1',
    }
  : {
      merchantId: process.env.PAYTM_MERCHANT_ID!,
      merchantKey: process.env.PAYTM_MERCHANT_KEY!,
    };

const client = new UPIPay({
  provider,
  environment,
  credentials,
});
```

> [!CAUTION]
> **Never commit `.env` to Git.** Your `saltKey` and `merchantKey` are equivalent to a password — anyone who obtains them can initiate API calls as your merchant account. Use secret managers (AWS Secrets Manager, GCP Secret Manager, Vault, Vercel Env) in production.

---

## API Reference

### `generateUPIQR(request)` — UPI QR Code

```typescript
const qr = await generateUPIQR({
  vpa:    'business@ybl',   // Your UPI VPA
  name:   'Business Name',  // Display name in UPI app
  amount: 500.00,           // Amount in rupees
  orderId: 'order_123',     // Your tracking reference
  note:   'Optional note',  // Shown in UPI app (max 255 chars)
});
// qr.qrImage  → 'data:image/png;base64,...'  (embed in <img> tag)
// qr.upiUri   → 'upi://pay?pa=...&mode=04'   (share as link)
// qr.orderId  → 'order_123'
```

**Fixed-Amount Mode** — By default, `mode: 'fixed'` sets NPCI `mode=04` in the UPI URI. This tells UPI apps to **lock the amount** so the user cannot change it — not even 1 paisa:

```typescript
// Amount is locked (default) — user pays exactly ₹500.00
const qrFixed = await generateUPIQR({ vpa: 'shop@ybl', name: 'Shop', amount: 500, orderId: 'o1' });

// Amount is editable — user can change the amount
const qrOpen = await generateUPIQR({ vpa: 'shop@ybl', name: 'Shop', amount: 500, orderId: 'o2', mode: 'open' });
```

### `generateUPIQRSvg(request)` → SVG string
### `generateUPIQRBuffer(request)` → PNG Buffer (for saving to disk)

### `buildUPIUri(request)` — UPI Payment Link

```typescript
const link = buildUPIUri({ vpa: 'shop@paytm', name: 'Shop', amount: 299, orderId: 'o1' });
// Share via WhatsApp or SMS — tapping the link opens the customer's UPI app
```

### `buildIntentLinks(upiUri)` — App Deep Links

```typescript
const links = buildIntentLinks(upiUri);
// links.phonepe → 'phonepe://pay?...'
// links.gpay    → 'tez://upi/pay?...'
// links.paytm   → 'paytmmp://pay?...'
// links.bhim    → 'upi://pay?...'
```

### `client.createPayment(request)` — Initiate PSP Payment

```typescript
const payment = await client.createPayment({
  amount:        50000,              // Amount in paise (₹500 = 50000 paise)
  orderId:       'order_unique_id',  // Alphanumeric + hyphens/underscores, max 128 chars
  customerPhone: '9876543210',       // 10-digit Indian mobile number
  callbackUrl:   'https://...',      // Webhook URL (must be HTTPS in production)
  redirectUrl:   'https://...',      // Where to redirect after payment
  idempotencyKey: randomUUID(),      // Prevents duplicate sessions on network retry
});
// payment.paymentUrl → redirect the customer here
```

### `client.checkStatus(orderId, options?)` — Confirm Payment Status

```typescript
const status = await client.checkStatus('order_unique_id', {
  expectedAmount: 50000,  // Recommended: throws if PSP-returned amount differs
  maxRetries: 3,          // Auto-retries with exponential backoff on network errors
});
// status.status        → 'SUCCESS' | 'PENDING' | 'FAILED'
// status.amount        → amount in paise as confirmed by the PSP
// status.transactionId → PSP's internal transaction reference
```

### `client.verifyWebhook(payload, signature, options?)` — Authenticate Webhook

```typescript
// Always pass the RAW request body (Buffer), never parsed JSON
// The SDK auto-detects PhonePe's {"response":"eyJ..."} wrapper
const event = client.verifyWebhook(req.body, req.headers['x-verify'] as string, {
  expectedAmount: order.totalPriceInPaise,  // Prevents amount-substitution attacks
});

if (!event.verified) return res.status(401).send();

// event.verified       → true (signature is authentic AND amount matches)
// event.status         → 'SUCCESS' | 'PENDING' | 'FAILED'
// event.orderId        → your order reference (use as idempotency key)
// event.amount         → payment amount in paise
// event.transactionId  → PSP transaction ID
```

### `client.createRefund(request)` — Initiate Refund

```typescript
const refund = await client.createRefund({
  originalOrderId:       'order_abc123',
  refundId:              `refund_${randomUUID()}`,
  amount:                50000,          // Full or partial refund in paise
  providerTransactionId: status.transactionId,  // Required for Paytm
  reason:                'Customer requested cancellation',
});
// refund.status → 'PENDING' | 'SUCCESS' | 'FAILED'
// refund.refundId         → your refund reference
// refund.providerRefundId → PSP's internal refund ID
// refund.amount           → refunded amount in paise
```

> [!NOTE]
> Refund status is often `PENDING` on first response. Poll `client.checkStatus()` or listen for a refund webhook to determine the final settled state.

### Full Configuration Options

```typescript
const client = new UPIPay({
  provider:    'phonepe',      // 'phonepe' | 'paytm'
  environment: 'sandbox',      // 'sandbox' | 'production'
  credentials: {
    // PhonePe:
    merchantId: '...',
    saltKey:    '...',
    saltIndex:  '1',
    // Paytm:
    // merchantId:  '...',
    // merchantKey: '...',
    // website:     'DEFAULT',  // optional — defaults auto from environment
  },
  options: {
    timeout: 30000,  // Request timeout in ms (default: 30000, max: 120000)
    debug:   false,  // Enable verbose logging — secrets auto-redacted (default: false)

    // Provide a custom logger (e.g. Winston, Pino, or your own):
    logger: (level, message, data) => {
      myLogger[level](message, data);
    },
  },
});
```

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `timeout` | `number` | `30000` | HTTP request timeout in milliseconds (min 1000, max 120000) |
| `debug` | `boolean` | `false` | Enables `debug` and `info` log output. Secrets are always redacted. |
| `logger` | `function` | `console.*` | Custom log handler — receives `(level, message, data?)` |

---

## Security

UPIPay is built with **defence-in-depth** security — the same standard used by Stripe and Razorpay. See [SECURITY.md](./SECURITY.md) for full details.

| Layer | Protection |
|:------|:-----------|
| **Webhook Auth** | HMAC-SHA256 checksum + constant-time comparison (prevents timing attacks) |
| **Replay Protection** | Timestamp-based stale webhook rejection (opt-in) — enforce DB `UNIQUE` on `transactionId` |
| **Injection Prevention** | Order ID restricted to `[a-zA-Z0-9_\-.]` — blocks SQL injection, XSS, path traversal |
| **Amount Verification** | Range enforced (₹1–₹10,00,000) + optional `expectedAmount` check in Status API |
| **Idempotency** | `WebhookEvent.orderId` as deduplication key; enforce a DB unique constraint |
| **URL Safety** | `javascript:`, `data:`, `vbscript:`, `file:` schemes blocked |
| **HTTPS Enforcement** | Callback and redirect URLs must be HTTPS in production |
| **Credential Safety** | Placeholder detection + auto-redaction in all logs and error messages |
| **Browser Guard** | Throws at runtime if used in browser/React Native — keeps secrets server-side |
| **Signature Length Guard** | Signatures >512 bytes rejected before any buffer allocation |
| **Network** | 30-second timeout, no data stored, all API calls over HTTPS |
| **Supply Chain** | 1 dependency (`qrcode`), no `postinstall` scripts, `files` allowlist on npm |
| **Rate Limiting** | Use `express-rate-limit` on webhook endpoints — guidance below |

### Rate Limiting Your Webhook Endpoint

Since UPIPay is an SDK (not a hosted platform), your webhook endpoints are exposed to the internet. Without rate limiting, attackers can flood your `/webhook` route with fake signatures, causing CPU exhaustion from SHA256/HMAC hash computations.

```typescript
import rateLimit from 'express-rate-limit';

// Limit webhook endpoint to 20 requests per minute per IP
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 20,              // max 20 requests per IP per minute
  message: 'Too many webhook requests',
  standardHeaders: true,
});

app.post('/api/webhook', webhookLimiter, express.raw({ type: '*/*' }), async (req, res) => {
  const event = client.verifyWebhook(req.body, req.headers['x-verify'] as string, {
    expectedAmount: order.totalPriceInPaise,
  });
  // ... handle verified event
});
```

### Webhook Origin Guard (IP Allowlisting)

Drop `createPhonePeWebhookGuard()` (or `createPaytmWebhookGuard()`) **before** the body parser and signature verifier in your middleware chain. Requests from any IP outside the PSP's published network ranges are dropped with `403` before any cryptographic work is performed.

```typescript
import { createPhonePeWebhookGuard } from 'upipay';

const phonePeGuard = createPhonePeWebhookGuard({
  trustProxy: true,      // Only set true when behind Nginx / AWS ALB / Cloudflare
  onBlocked: (ip, _req, res) => {
    console.warn(`Webhook blocked — origin not in PhonePe range: ${ip}`);
    res.status(403).send();
  },
});

// Middleware order: origin guard → rate limiter → body parser → signature verifier
app.post('/api/webhook', phonePeGuard, webhookLimiter, express.raw({ type: '*/*' }), async (req, res) => {
  const event = client.verifyWebhook(req.body, req.headers['x-verify'] as string, {
    expectedAmount: order.totalPriceInPaise,
  });
  // ...
});
```

> [!WARNING]
> **`trustProxy: true` requires a real reverse proxy.** If your server is exposed directly to the internet, a client can forge `X-Forwarded-For: 163.53.76.10` (a valid PhonePe IP) and bypass the IP guard. Only enable `trustProxy` when a proxy like Nginx, AWS ALB, or Cloudflare sits in front of your application and actively controls which headers are forwarded.

### Async Webhook Processing (Acknowledge-First Pattern)

PhonePe and Paytm expect a `200 OK` response within **3–5 seconds** of delivering a webhook. If your handler performs synchronous database writes and `checkStatus` API calls before responding, the PSP will interpret the delay as a failed delivery and retry — leading to repeated webhook floods and potential double-fulfillment.

The production-grade pattern is to **acknowledge immediately** and hand off processing to a background worker:

```typescript
import { createPhonePeWebhookGuard } from 'upipay';
// Use any queue: BullMQ, SQS, RabbitMQ, Postgres LISTEN/NOTIFY, etc.
import { paymentQueue } from './queues/payment-queue';

app.post(
  '/api/webhook',
  createPhonePeWebhookGuard({ trustProxy: true }),
  express.raw({ type: '*/*' }),
  async (req, res) => {

    // Step 1 — Verify signature before touching anything else.
    //           This is fast (pure CPU, no I/O).
    const event = client.verifyWebhook(req.body, req.headers['x-verify'] as string);
    if (!event.verified) return res.status(401).send();

    // Step 2 — Acknowledge to the PSP immediately.
    //           Do this BEFORE any database or network I/O.
    res.status(200).send('OK');

    // Step 3 — Enqueue for background processing.
    //           The worker performs checkStatus + DB update + order fulfilment.
    await paymentQueue.add('process-payment', {
      orderId: event.orderId,
      transactionId: event.transactionId,
      amount: event.amount,
    });
  },
);

// ─── Background worker (runs in a separate process or thread) ────────

paymentQueue.process('process-payment', async (job) => {
  const { orderId } = job.data;

  // Idempotency guard — PSPs retry, workers may also retry on failure
  const order = await db.getOrder(orderId);
  if (!order || order.fulfilled) return; // already processed

  // Confirm final state and verify amount via the Status API
  const status = await client.checkStatus(orderId, {
    expectedAmount: order.totalPriceInPaise,
    maxRetries: 3,       // Built-in exponential back-off
  });

  if (status.status === 'SUCCESS') {
    await db.markOrderFulfilled(orderId, status.transactionId);
  }
});
```

> [!IMPORTANT]
> **Why this matters:** If the PSP's webhook delivery times out, it will retry the same webhook 3–5 times over the next few minutes. Without the acknowledge-first pattern, each retry can trigger a duplicate database write or duplicate shipment. The pattern above, combined with the idempotency guard, makes your webhook handler fully idempotent regardless of how many times the PSP delivers the event.



### Database Idempotency (Prevent Double-Fulfillment)

PSPs retry webhook delivery multiple times. Always enforce unique constraints:

```sql
-- PostgreSQL example
ALTER TABLE orders ADD CONSTRAINT unique_payment_ref UNIQUE (payment_ref_id);
ALTER TABLE orders ADD CONSTRAINT unique_txn_id UNIQUE (transaction_id);
```

```typescript
// Before fulfilling, check if already processed
const order = await db.getOrderByPaymentRef(event.orderId);
if (order?.fulfilled) return res.status(200).send('OK'); // already done— idempotent response
```

### Security Best Practices

```typescript
// ✅ Always load prices from your database — never trust user-submitted amounts
const order = await db.getOrder(orderId);
const payment = await client.createPayment({
  amount: order.totalPriceInPaise,  // from YOUR database
  orderId: `order_${randomUUID()}`, // collision-safe unique ID
  ...
});

// ✅ Use the raw request body for webhook verification
app.post('/webhook', express.raw({ type: '*/*' }), (req, res) => {
  const event = client.verifyWebhook(req.body, req.headers['x-verify'] as string);
  if (!event.verified) return res.status(401).send();
});

// ✅ Implement idempotency — PSPs retry webhooks multiple times
const order = await db.getOrderByPaymentId(event.orderId);
if (order?.fulfilled) return res.status(200).send('OK'); // already done

// ✅ Confirm payment amount via the Status API before fulfilling
const status = await client.checkStatus(event.orderId, {
  expectedAmount: order.totalPriceInPaise,
});
if (status.status === 'SUCCESS') {
  await db.markFulfilled(event.orderId);
}

// ✅ Rate-limit your webhook endpoint
// Use express-rate-limit, Nginx, or your cloud WAF

// ❌ Never trust client-side callbacks for payment status
// ❌ Never hardcode merchant keys or salt keys in source code
// ❌ Never skip amount verification
// ❌ Never use Date.now() for order IDs — use randomUUID()
```

---

## Complete Express.js Integration Example

```typescript
import express from 'express';
import { randomUUID } from 'node:crypto';
import { UPIPay, rupeesToPaise } from 'upipay';

const app = express();
const client = new UPIPay({
  provider: 'phonepe',
  environment: 'production',
  credentials: {
    merchantId: process.env.PHONEPE_MERCHANT_ID!,
    saltKey:    process.env.PHONEPE_SALT_KEY!,
    saltIndex:  '1',
  },
});

// Create a payment session — amount must come from your database, not the request
app.post('/api/pay', express.json(), async (req, res) => {
  const order = await db.getOrder(req.body.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const payment = await client.createPayment({
    amount:        order.totalPriceInPaise,  // server-authoritative price
    orderId:       `pay_${randomUUID()}`,    // globally unique, collision-safe
    customerPhone: req.body.phone,
    callbackUrl:   'https://yoursite.com/api/webhook',
    redirectUrl:   'https://yoursite.com/payment/success',
    idempotencyKey: randomUUID(),
  });

  res.json({ paymentUrl: payment.paymentUrl });
});

// Webhook handler — PSPs retry delivery several times, so implement idempotency
app.post('/api/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const event = client.verifyWebhook(req.body, req.headers['x-verify'] as string);
  if (!event.verified) return res.status(401).send('Unauthorized');

  // Idempotency check — avoid double-fulfilling the same order
  const order = await db.getOrderByPaymentRef(event.orderId);
  if (!order || order.fulfilled) return res.status(200).send('OK');

  // Confirm final status via the Status API and verify amount integrity
  const status = await client.checkStatus(event.orderId, {
    expectedAmount: order.totalPriceInPaise,
  });

  if (status.status === 'SUCCESS') {
    await db.markOrderFulfilled(event.orderId, status.transactionId);
    console.log(`✅ ₹${status.amount / 100} confirmed for order ${event.orderId}`);
  }

  res.status(200).send('OK');
});

// UPI QR code endpoint — for in-store or invoice payments
app.get('/api/qr/:orderId', async (req, res) => {
  const { generateUPIQR } = await import('upipay');
  const order = await db.getOrder(req.params.orderId!);
  const qr = await generateUPIQR({
    vpa:    'yourbusiness@ybl',
    name:   'Your Business Name',
    amount: order.totalPriceInRupees,   // amount in rupees for QR
    orderId: req.params.orderId!,
  });
  res.json(qr);
});

app.listen(3000);
```

---

## Complete Paytm Integration Example

```typescript
import express from 'express';
import { randomUUID } from 'node:crypto';
import { UPIPay } from 'upipay';

const app = express();
const client = new UPIPay({
  provider: 'paytm',
  environment: 'production',
  credentials: {
    merchantId:  process.env.PAYTM_MERCHANT_ID!,
    merchantKey: process.env.PAYTM_MERCHANT_KEY!,
  },
});

// Step 1 — Create payment
app.post('/api/pay', express.json(), async (req, res) => {
  const order = await db.getOrder(req.body.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const payment = await client.createPayment({
    amount:        order.totalPriceInPaise,
    orderId:       `pay_${randomUUID()}`,
    customerPhone: req.body.phone,
    callbackUrl:   `${process.env.APP_BASE_URL}/api/paytm-callback`,
    redirectUrl:   `${process.env.APP_BASE_URL}/payment/success`,
    idempotencyKey: randomUUID(),
  });

  // Redirect user to Paytm checkout page
  res.redirect(payment.paymentUrl);
});

// Step 2 — Paytm redirects the CUSTOMER'S BROWSER (not a server webhook) to this URL.
// You MUST render a page/redirect here — do NOT return raw JSON.
app.post('/api/paytm-callback', express.urlencoded({ extended: true }), async (req, res) => {
  // req.body contains form-encoded Paytm callback data + CHECKSUMHASH
  const rawBody = new URLSearchParams(req.body).toString();
  const event = client.verifyWebhook(rawBody, req.body.CHECKSUMHASH ?? '');

  if (!event.verified) {
    return res.redirect('/payment/failed');
  }

  // Confirm via Status API — the callback status field can be spoofed
  const status = await client.checkStatus(event.orderId, {
    expectedAmount: await db.getOrderAmount(event.orderId),
  });

  if (status.status === 'SUCCESS') {
    await db.markOrderFulfilled(event.orderId, status.transactionId);
    // Render success page to the customer
    return res.redirect('/payment/success');
  }

  return res.redirect('/payment/failed');
});

app.listen(3000);
```

> [!IMPORTANT]
> **Paytm vs PhonePe callback difference:**
> - **PhonePe** sends a **server-to-server POST** in the background — respond with `200 OK` text.
> - **Paytm** redirects the **customer's browser** via a form POST — respond with a redirect or HTML page.
>
> Using `express.json()` for the Paytm callback will fail — use `express.urlencoded({ extended: true })` instead.

---

## Fastify Integration

```typescript
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { UPIPay } from 'upipay';

const fastify = Fastify({ logger: true });
const client = new UPIPay({
  provider: 'phonepe',
  environment: 'production',
  credentials: {
    merchantId: process.env.PHONEPE_MERCHANT_ID!,
    saltKey:    process.env.PHONEPE_SALT_KEY!,
    saltIndex:  '1',
  },
});

// Fastify needs the raw body for webhook verification
// Add content-type parser that preserves the raw buffer
fastify.addContentTypeParser('*', { parseAs: 'buffer' }, (req, body, done) => {
  done(null, body);
});

// Create payment
fastify.post('/api/pay', async (request, reply) => {
  const { orderId, phone } = request.body as { orderId: string; phone: string };
  const order = await db.getOrder(orderId);

  const payment = await client.createPayment({
    amount:        order.totalPriceInPaise,
    orderId:       `pay_${randomUUID()}`,
    customerPhone: phone,
    callbackUrl:   `${process.env.APP_BASE_URL}/api/webhook`,
    redirectUrl:   `${process.env.APP_BASE_URL}/payment/success`,
    idempotencyKey: randomUUID(),
  });

  return { paymentUrl: payment.paymentUrl };
});

// Webhook — Fastify delivers raw Buffer when content parser is set up as above
fastify.post('/api/webhook', async (request, reply) => {
  const rawBody = request.body as Buffer;
  const sig = (request.headers['x-verify'] ?? '') as string;

  const event = client.verifyWebhook(rawBody, sig, {
    expectedAmount: await db.getOrderAmount((JSON.parse(rawBody.toString()) as any).orderId ?? ''),
  });

  if (!event.verified) return reply.status(401).send();

  const status = await client.checkStatus(event.orderId, {
    expectedAmount: await db.getOrderAmount(event.orderId),
  });
  if (status.status === 'SUCCESS') await db.fulfil(event.orderId);

  return reply.send('OK');
});

fastify.listen({ port: 3000 });
```

---

## NestJS Integration

```typescript
// payment.module.ts
import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  providers: [PaymentService],
  controllers: [PaymentController],
})
export class PaymentModule {}

// payment.service.ts
import { Injectable } from '@nestjs/common';
import { UPIPay, WebhookEvent, PaymentStatusResponse } from 'upipay';
import { randomUUID } from 'node:crypto';

@Injectable()
export class PaymentService {
  private readonly client: UPIPay;

  constructor() {
    this.client = new UPIPay({
      provider: 'phonepe',
      environment: process.env.PHONEPE_ENV as 'sandbox' | 'production',
      credentials: {
        merchantId: process.env.PHONEPE_MERCHANT_ID!,
        saltKey:    process.env.PHONEPE_SALT_KEY!,
        saltIndex:  process.env.PHONEPE_SALT_INDEX ?? '1',
      },
    });
  }

  async createPaymentSession(orderId: string, amountInPaise: number, phone: string) {
    return this.client.createPayment({
      amount:        amountInPaise,
      orderId:       `pay_${randomUUID()}`,
      customerPhone: phone,
      callbackUrl:   `${process.env.APP_BASE_URL}/api/payments/webhook`,
      redirectUrl:   `${process.env.APP_BASE_URL}/payment/success`,
      idempotencyKey: randomUUID(),
    });
  }

  verifyWebhook(rawBody: Buffer, signature: string, expectedAmount: number): WebhookEvent {
    return this.client.verifyWebhook(rawBody, signature, { expectedAmount });
  }

  async checkStatus(orderId: string, expectedAmount: number): Promise<PaymentStatusResponse> {
    return this.client.checkStatus(orderId, { expectedAmount });
  }
}

// payment.controller.ts
import { Controller, Post, Body, Headers, RawBodyRequest, Req, Res } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Request, Response } from 'express';

@Controller('api/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  async create(@Body() body: { orderId: string; phone: string }) {
    const order = await db.getOrder(body.orderId);
    const session = await this.paymentService.createPaymentSession(
      body.orderId,
      order.totalPriceInPaise,
      body.phone,
    );
    return { paymentUrl: session.paymentUrl };
  }

  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('x-verify') signature: string,
  ) {
    const order = await db.getOrderByPaymentRef(/* orderId from raw body */null);
    const event = this.paymentService.verifyWebhook(
      req.rawBody!, signature, order?.totalPriceInPaise ?? 0,
    );
    if (!event.verified) return res.status(401).send();

    if (!order?.fulfilled) {
      const status = await this.paymentService.checkStatus(
        event.orderId, order.totalPriceInPaise,
      );
      if (status.status === 'SUCCESS') await db.fulfil(event.orderId);
    }

    return res.status(200).send('OK');
  }
}
```

> [!NOTE]
> For NestJS raw body access in webhooks, enable `rawBody: true` in `NestFactory.create()` options:
> ```typescript
> const app = await NestFactory.create(AppModule, { rawBody: true });
> ```

---

## Architecture — How Money Flows

```
┌─────────────────┐     ┌────────────────┐     ┌──────────┐     ┌──────────┐
│   Your Backend  │     │  Customer UPI  │     │   NPCI   │     │   Your   │
│   (upipay SDK)  │────▶│  App (PhonePe/ │────▶│ Network  │────▶│   Bank   │
│                 │     │  GPay / Paytm) │     │          │     │ Account  │
└────────┬────────┘     └────────────────┘     └──────────┘     └──────────┘
         │                                                              │
         │  ◀─── Webhook: "Payment confirmed" ─────────────────────────┘
         ▼
   Verify signature → Check Status API → Update DB → Fulfil order
```

**UPIPay never holds or touches money.** The library only handles:
1. Generating authenticated API requests to PhonePe / Paytm
2. Verifying that inbound webhooks are genuinely from the PSP
3. Checking payment status securely

Money flows directly: **Customer Bank → NPCI → Your Bank**. UPIPay is the security and orchestration layer.

**Zero middlemen. Zero commission. Direct bank settlement.**

---

## Works With Any JavaScript App or Website

UPIPay is split into two parts so it fits **any architecture**:

### Server-side (payment logic)
The `UPIPay` class and webhook verification run on your **server or backend**. This is where your merchant credentials live — they must never be in the browser bundle.

| Framework | Integration |
|:----------|:------------|
| **Next.js** | `app/api/pay/route.ts` or `pages/api/pay.ts` |
| **Express.js** | `app.post('/api/pay', ...)` |
| **Fastify** | `fastify.post('/api/pay', ...)` |
| **NestJS** | `@Injectable()` PaymentService |
| **SvelteKit** | `+server.ts` route handler |
| **Remix** | `action()` function |
| **Nuxt** | `server/api/pay.post.ts` |
| **Hono** | `app.post('/api/pay', ...)` |
| **Bun / Deno** | Native HTTP server |
| **AWS Lambda** | Serverless function handler |
| **Vercel / Railway** | Edge/serverless functions |

### Client-side (QR code only)
The QR module has no credentials and runs safely in the browser:

```typescript
// Safe to use in React, Vue, Svelte, or any frontend
import { generateUPIQR } from 'upipay/qr';

// Inside a React component:
const qr = await generateUPIQR({ vpa: 'mybiz@ybl', name: 'My Biz', amount: 500, orderId: 'o1' });
<img src={qr.qrImage} alt="Scan to pay" />
```

### Full-stack example — Next.js App Router

```typescript
// app/api/pay/route.ts — server-side, credentials stay safe
import { UPIPay } from 'upipay';
import { randomUUID } from 'node:crypto';

const client = new UPIPay({
  provider: 'phonepe',
  environment: 'production',
  credentials: {
    merchantId: process.env.PHONEPE_MERCHANT_ID!,
    saltKey:    process.env.PHONEPE_SALT_KEY!,
    saltIndex:  '1',
  },
});

export async function POST(req: Request) {
  const { orderId, phone } = await req.json();
  const order = await db.getOrder(orderId);

  const payment = await client.createPayment({
    amount:        order.totalPriceInPaise,
    orderId:       `pay_${randomUUID()}`,
    customerPhone: phone,
    callbackUrl:   'https://yoursite.com/api/webhook',
    redirectUrl:   'https://yoursite.com/payment/success',
  });

  return Response.json({ paymentUrl: payment.paymentUrl });
}

// app/api/webhook/route.ts — PhonePe calls this after payment
export async function POST(req: Request) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const sig = req.headers.get('x-verify') ?? '';

  const event = client.verifyWebhook(rawBody, sig);
  if (!event.verified) return new Response('Unauthorized', { status: 401 });

  const status = await client.checkStatus(event.orderId, {
    expectedAmount: await db.getOrderAmount(event.orderId),
  });
  if (status.status === 'SUCCESS') await db.fulfil(event.orderId);

  return new Response('OK');
}
```

> [!CAUTION]
> **Do not use the main `UPIPay` class in browser or React Native apps.** Your merchant salt key and merchant key would be visible in the client bundle — anyone could steal them and make API calls as your merchant account.
>
> For React component QR generation with zero credentials:
> ```typescript
> // This is safe in React, Vue, Svelte — no merchant credentials needed
> import { generateUPIQR } from 'upipay/qr';
> ```
>
> For payment creation and webhook verification, always use server-side code:
> Next.js API routes, SvelteKit server hooks, Remix actions, Express endpoints, etc.

### Using with Python, Go, or Other Languages

UPIPay is an npm library and runs in Node.js. For non-JS backends:

1. **Recommended** — Run a lightweight Node.js microservice that imports UPIPay and exposes `/create-payment` and `/verify-webhook` endpoints.
2. **Manual implementation** — Implement the signature yourself:
   - **PhonePe**: `SHA256(base64Payload + apiPath + saltKey) + "###" + saltIndex`
   - **Paytm**: `HMAC-SHA256(stableJSONString, merchantKey)` where keys are sorted alphabetically

---

## Project Structure

```
upipay/
├── src/
│   ├── client.ts             # UPIPay main class — start here
│   ├── index.ts              # Public API barrel exports
│   ├── types.ts              # All TypeScript interfaces and types
│   ├── errors.ts             # Typed error classes (PaymentError, NetworkError, …)
│   ├── interfaces/
│   │   └── psp-adapter.ts    # IPSPAdapter interface (PhonePe & Paytm both implement this)
│   ├── adapters/
│   │   ├── phonepe.ts        # PhonePe Business adapter (free)
│   │   └── paytm.ts          # Paytm Business adapter (free)
│   ├── upi/
│   │   └── qr.ts             # NPCI-compliant UPI QR code generator
│   └── utils/
│       ├── crypto.ts         # HMAC-SHA256, constant-time comparison, replay protection
│       ├── currency.ts       # Float-safe rupee → paise conversion
│       ├── ip-guard.ts       # Express middleware for PSP IP allowlisting
│       ├── logger.ts         # Secret-masking structured logger
│       ├── retry.ts          # Exponential backoff retry helper
│       ├── sanitize.ts       # PSP error body sanitisation
│       └── validation.ts     # Security-hardened input validation
├── tests/                    # 120 tests — security, client, QR
├── SECURITY.md               # Security policy and vulnerability reporting
├── CONTRIBUTING.md           # Contribution guide
└── .github/workflows/ci.yml  # CI: typecheck + test + build + conditional npm publish
```

---

## Frequently Asked Questions

### Is this legal? Can I really avoid paying Razorpay?

Yes. The Government of India mandated 0% MDR on UPI to encourage digital payments. You are using the open public infrastructure you are entitled to.

### What happens if PhonePe or Paytm shut down their free API?

Their API access is legally mandated under the Payment and Settlement Systems Act (amended 2020). They cannot shut it down or start charging without government authorisation. Even if they tried, UPIPay's `IPSPAdapter` interface makes it trivial to add a new provider.

### Is the money safe? Can PhonePe or Paytm hold my funds?

No. With the direct integration model, funds settle **directly from NPCI to your bank**. PhonePe and Paytm act as authentication and notification brokers only — they do not hold your money in transit. This is fundamentally different from payment aggregators, where your money passes through their escrow account before being sent to you.

### How long does settlement take?

Instant to same-day. NPCI processes UPI payments within seconds. Your bank typically credits the account within minutes to a few hours depending on your bank's processing time. There is no 2–3 day settlement hold that aggregators impose.

### Can I get refunds?

Yes. UPIPay supports full and partial refunds via `client.createRefund()`. Both PhonePe and Paytm expose refund APIs at no charge.

### Does this work for high-volume merchants (₹1 crore+/month)?

Yes. PhonePe Business and Paytm Business impose no volume limits on merchant accounts. For very high volume (₹10 crore+/month), you may want to negotiate a direct settlement agreement with your bank, but the APIs remain the same.

### What if I need card payments or international payments?

UPIPay is UPI-only and India-only. For card payments, use Razorpay or Stripe alongside UPIPay — you can keep UPI transactions on UPIPay (₹0 fee) and card transactions on a paid gateway, reducing your overall commission bill significantly.

---

## Comparison with Paid Gateways

| | **UPIPay** | Razorpay | Stripe India | Cashfree | PayU India |
|:--|:--|:--|:--|:--|:--|
| UPI Payments | ✅ Free* | ✅ 2% fee | ✅ 2–3% fee | ✅ 1.9% fee | ✅ 1.99% fee |
| Auto webhook verification | ✅ | ✅ | ✅ | ✅ | ✅ |
| TypeScript support | ✅ Full types | ⚠️ Partial | ✅ | ⚠️ Partial | ❌ |
| Open source | ✅ MIT | ❌ | ❌ | ❌ | ❌ |
| Setup cost | ₹0 | ₹0 | ₹0 | ₹0 | ₹0 |
| Per-transaction cost | **₹0*** | **₹2 per ₹100** | **₹2–3 per ₹100** | **₹1.90 per ₹100** | **₹1.99 per ₹100** |
| Settlement hold | None | 2–3 days | 2–7 days | 2–3 days | 2–3 days |
| Money routing | Direct | Via escrow | Via escrow | Via escrow | Via escrow |
| Vendor lock-in | ❌ None | ✅ High | ✅ High | ✅ Medium | ✅ Medium |
| Merchant account required | Optional (QR) / Yes (PSP) | Yes | Yes | Yes | Yes |
| IP allowlisting middleware | ✅ Built-in | ❌ | ❌ | ❌ | ❌ |
| Built-in retry with backoff | ✅ | ❌ | ❌ | ❌ | ❌ |
| Secret auto-redaction | ✅ | ❌ | ❌ | ❌ | ❌ |

*\*Free for standard bank-to-bank UPI transactions. Wallet (PPI) and Credit Card UPI payments over ₹2,000 may incur small interchange fees (0.5%–1.1%) per NPCI guidelines.*

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Contributions welcome for:

- New free PSP adapters (UPI-only, zero-commission — no paid gateways)
- Security improvements
- Documentation translations (Hindi, Tamil, Telugu, Marathi, Bengali)
- Framework-specific integration guides (NestJS, Fastify, Next.js, Remix)

---

## License

[MIT](./LICENSE) — free to use in any project, commercial or personal.

---

<div align="center">

**Made with 🇮🇳 for Indian developers. Stop paying per transaction.**

[Report a Bug](https://github.com/iamrobinsharaya/upipay/issues) · [Request a Feature](https://github.com/iamrobinsharaya/upipay/issues) · [Security Disclosure](./SECURITY.md)

</div>

## Run the browser checkout

The merchant page creates a shareable checkout link and keeps a local ledger.
Customers can scan the QR code or open their UPI app from the link. Check your
bank records for the exact amount and UPI transaction reference before confirming
receipt in the ledger.

From the repository root, in PowerShell:

```powershell
npm ci
npm run build
$env:MERCHANT_UPI_ID = 'your-business@bank'
$env:MERCHANT_NAME = 'Your Business'
$env:UPIPAY_ADMIN_PASSWORD = 'replace-with-a-long-unique-password'
npm start
```

Open http://127.0.0.1:8080 and sign in as `admin` with the configured password.
Enter an amount and create a link, then copy the checkout page URL from the
address bar. Use the merchant homepage to view orders and confirm receipts.
Only confirmed orders count toward the ledger total.

The default address is local to your computer. To share checkout links with
customers, serve the app through an HTTPS reverse proxy and share the public
HTTPS checkout URL. Set `HOST` and `PORT` if the proxy needs a different bind
address. Run one app process per data file and keep `upipay-orders.json` on
persistent storage. Set `UPIPAY_DATA_FILE` to use another file location. Each
order retains the UPI ID configured when its link was created.

Run the checkout smoke test after building with `node --test checkout/server.test.mjs`.
