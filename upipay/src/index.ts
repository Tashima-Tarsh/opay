// ============================================================================
// UPIPay — Public API
// ============================================================================
// Single entry point for the upipay package. Import from here in your app.

// ─── Main Client ─────────────────────────────────────────────────────
export { UPIPay } from './client.js';

// ─── UPI QR Code Generation ─────────────────────────────────────────
export {
  generateUPIQR,
  generateUPIQRSvg,
  generateUPIQRBuffer,
  buildUPIUri,
  buildIntentLinks,
} from './upi/qr.js';

// ─── Currency Utilities ─────────────────────────────────────────────
// rupeesToPaise is re-exported from the main barrel for convenience.
// Using this helper avoids JavaScript floating-point precision bugs
// that arise from naive multiplication (e.g. 5.99 * 100 = 599.0000000000001).
export { rupeesToPaise } from './utils/currency.js';

// ─── Types ───────────────────────────────────────────────────────────
export type {
  Provider,
  Environment,
  PaymentStatus,
  PaymentMethod,
  LogLevel,
  UPIPayConfig,
  UPIPayOptions,
  UPIQRRequest,
  UPIQRResponse,
  UPIIntentLink,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  WebhookEvent,
  WebhookVerifyOptions,
  CheckStatusOptions,
  PhonePeCredentials,
  PaytmCredentials,
  // Refund
  RefundStatus,
  CreateRefundRequest,
  RefundResponse,
} from './types.js';

// ─── Errors ──────────────────────────────────────────────────────────
export {
  UPIPayError,
  InvalidConfigError,
  PaymentError,
  WebhookVerificationError,
  NetworkError,
  RefundError,
} from './errors.js';

// ─── Interface ───────────────────────────────────────────────────────
export type { IPSPAdapter } from './interfaces/psp-adapter.js';

// ─── Adapters (for direct use) ───────────────────────────────────────
export { PhonePeAdapter } from './adapters/phonepe.js';
export { PaytmAdapter } from './adapters/paytm.js';

// ─── Webhook Origin Guards ───────────────────────────────────────────
// Express-compatible middleware that restricts webhook endpoints to requests
// originating from the PSP's published network ranges. Drop in before
// express.raw() and verifyWebhook() in your middleware chain.
export {
  createPhonePeWebhookGuard,
  createPaytmWebhookGuard,
} from './utils/ip-guard.js';
export type {
  WebhookGuardOptions,
  WebhookRequest,
  WebhookResponse,
} from './utils/ip-guard.js';
