// ============================================================================
// UPIPay — Types for Free Zero-Commission UPI Payment System
// ============================================================================

/**
 * Supported free PSP providers.
 * These provide merchant APIs with ZERO transaction fees.
 * - 'phonepe': PhonePe Business (https://business.phonepe.com)
 * - 'paytm': Paytm Business (https://business.paytm.com)
 */
export type Provider = 'phonepe' | 'paytm';

/**
 * Environment mode.
 * - sandbox: Test/UAT APIs. No real money.
 * - production: Live APIs. Real transactions.
 */
export type Environment = 'sandbox' | 'production';

/**
 * Normalized payment status.
 */
export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED';

/**
 * Payment method used by the customer.
 */
export type PaymentMethod = 'upi' | 'wallet' | 'unknown';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for initializing UPIPay.
 */
export interface UPIPayConfig {
  /** Free PSP provider to use */
  provider: Provider;

  /** Environment mode */
  environment: Environment;

  /**
   * Provider-specific merchant credentials (from dashboard, always free).
   * Use the correct shape for your provider:
   * - PhonePe: { merchantId, saltKey, saltIndex }
   * - Paytm: { merchantId, merchantKey, website? }
   */
  credentials: Record<string, string>;

  /** Advanced options */
  options?: UPIPayOptions;
}

/**
 * Advanced options.
 */
export interface UPIPayOptions {
  /** Request timeout in ms (default: 30000) */
  timeout?: number;

  /** Enable debug logging — secrets auto-redacted (default: false) */
  debug?: boolean;

  /** Custom logger */
  logger?: (level: LogLevel, message: string, data?: Record<string, unknown>) => void;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ============================================================================
// UPI QR Code Types
// ============================================================================

/**
 * Request to generate a UPI QR code.
 */
export interface UPIQRRequest {
  /** Your UPI VPA / Virtual Payment Address (e.g., 'yourbusiness@ybl') */
  vpa: string;

  /** Business/Merchant display name */
  name: string;

  /** Amount in rupees (e.g., 500.00 for ₹500) */
  amount: number;

  /** Your unique order/transaction reference ID */
  orderId: string;

  /** Optional transaction note shown in UPI app */
  note?: string;

  /**
   * QR amount mode.
   * - `'fixed'` (default): Amount is locked — user CANNOT change it (sets NPCI `mode=04`)
   * - `'open'`: Amount is editable — user can change the amount in their UPI app
   *
   * Use `'fixed'` for invoices, e-commerce, and any scenario where the exact
   * amount must be paid — not even 1 paisa less or more.
   */
  mode?: 'fixed' | 'open';

  /** Optional Merchant Category Code (4-digit MCC as per NPCI/ISO 18245) */
  mc?: string;
}

/**
 * Generated UPI QR code response.
 */
export interface UPIQRResponse {
  /** The UPI URI string (upi://pay?pa=...&pn=...&am=...&tr=...) */
  upiUri: string;

  /** Base64-encoded PNG image of the QR code */
  qrImage: string;

  /** The order ID passed in the request */
  orderId: string;

  /** Amount in rupees */
  amount: number;
}

/**
 * UPI deep link / intent for mobile apps.
 */
export interface UPIIntentLink {
  /** Generic UPI intent URI (opens any UPI app) */
  generic: string;

  /** PhonePe-specific deep link */
  phonepe: string;

  /** Google Pay deep link */
  gpay: string;

  /** Paytm deep link */
  paytm: string;

  /** BHIM app deep link */
  bhim: string;
}

// ============================================================================
// Payment Request / Response Types
// ============================================================================

/**
 * Request to create a payment via PSP merchant API.
 * The PSP will generate a payment page/QR — money goes directly to your bank.
 */
export interface CreatePaymentRequest {
  /** Amount in paise (50000 = ₹500.00) */
  amount: number;

  /** Your unique order ID */
  orderId: string;

  /** Customer phone number (10-digit Indian mobile) */
  customerPhone: string;

  /** Customer name (optional but recommended) */
  customerName?: string;

  /** Customer email (optional) */
  customerEmail?: string;

  /** Server-to-server callback URL for webhook */
  callbackUrl: string;

  /** Frontend redirect URL after payment */
  redirectUrl: string;

  /**
   * Caller-supplied idempotency token for the payment creation request.
   * When provided, the PSP will return the same response for duplicate
   * calls carrying the same token, preventing double-session creation
   * on network retries. Use `randomUUID()` or a stable hash of your order ID.
   */
  idempotencyKey?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Response from creating a payment.
 */
export interface CreatePaymentResponse {
  /** Whether the request succeeded */
  success: boolean;

  /** URL to redirect user to for payment (QR-based checkout page) */
  paymentUrl: string;

  /** Your order ID */
  orderId: string;

  /** PSP's transaction ID */
  providerTransactionId?: string;

  /** Raw response from the PSP */
  rawResponse: unknown;
}

/**
 * Payment status check response.
 */
export interface PaymentStatusResponse {
  /** Whether the status check succeeded */
  success: boolean;

  /** Normalized payment status */
  status: PaymentStatus;

  /** Amount in paise */
  amount: number;

  /** Your order ID */
  orderId: string;

  /** PSP's transaction ID */
  transactionId?: string;

  /** Payment method used */
  paymentMethod: PaymentMethod;

  /** Raw response from the PSP */
  rawResponse: unknown;
}

/**
 * Parsed webhook event after verification.
 */
export interface WebhookEvent {
  /** Is the webhook signature valid? */
  verified: boolean;

  /** Normalized status */
  status: PaymentStatus;

  /** Your order ID */
  orderId: string;

  /** PSP's transaction ID */
  transactionId?: string;

  /** Amount in paise */
  amount?: number;

  /** Raw payload */
  rawPayload: unknown;
}

/**
 * Options for verifying webhook signatures and validity.
 */
export interface WebhookVerifyOptions {
  /**
   * When true, rejects webhooks whose embedded transaction timestamp falls
   * outside the `timestampToleranceSeconds` window.
   *
   * **Default: false.** PSPs embed the *transaction* timestamp (not the webhook
   * delivery time), so enabling this window will silently reject legitimate
   * webhooks that are delayed by network congestion, bank processing, or PSP
   * retry intervals. Use database-level idempotency (unique constraint on
   * `transactionId`) as the reliable replay-prevention mechanism instead.
   */
  enableReplayProtection?: boolean;

  /**
   * The maximum allowed age of the webhook timestamp in seconds (default: 300 seconds).
   */
  timestampToleranceSeconds?: number;

  /**
   * Optional explicit timestamp to verify (Unix timestamp in seconds or Date string).
   * If not provided, the adapter will look for timestamp fields within the payload body.
   */
  timestamp?: number | string;

  /**
   * Expected payment amount in paise. If provided, the SDK will verify that the
   * amount in the webhook payload matches exactly. This prevents amount-substitution
   * attacks where a ₹1 payment webhook is used to fulfil a ₹10,000 order.
   *
   * @example
   * ```typescript
   * const event = client.verifyWebhook(rawBody, signature, {
   *   expectedAmount: 50000, // ₹500.00
   * });
   * ```
   */
  expectedAmount?: number;
}

/**
 * Options for checking payment status.
 */
export interface CheckStatusOptions {
  /**
   * The expected amount in paise. If provided, the SDK will verify that the
   * amount returned by the PSP matches this value. This prevents attacks
   * where a ₹1 payment is used to fulfill a ₹10,000 order.
   */
  expectedAmount?: number;

  /**
   * Total number of call attempts including the initial one.
   * The call will be re-attempted on transient network failures
   * using exponential back-off between each attempt.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Base delay in milliseconds for the first retry interval.
   * Subsequent intervals double: baseDelayMs, baseDelayMs * 2, …
   * @default 1000
   */
  retryDelayMs?: number;
}

// ============================================================================
// Refund Types
// ============================================================================

/** Normalised refund status. */
export type RefundStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

/**
 * Request to initiate a refund against a previously completed payment.
 */
export interface CreateRefundRequest {
  /**
   * The original order ID that was paid. Must match the value used
   * when calling `createPayment()`.
   */
  originalOrderId: string;

  /**
   * A unique identifier for this refund attempt.
   * Use a stable, distinct value per refund (e.g. `refund_${randomUUID()}`).
   * PSPs use this to deduplicate concurrent or retried refund calls.
   */
  refundId: string;

  /**
   * Amount to refund in paise. Must be ≤ the original transaction amount.
   * Partial refunds are supported by both PhonePe and Paytm.
   */
  amount: number;

  /**
   * The PSP's internal transaction ID for the original payment.
   *
   * **Required for Paytm refunds.** Paytm's `/v3/order/refund` endpoint
   * uses `txnId` to identify the transaction — this is the value returned
   * in `PaymentStatusResponse.transactionId` or `WebhookEvent.transactionId`,
   * not the merchant's `orderId`.
   *
   * For PhonePe this is optional — the adapter uses the merchant transaction
   * ID (`originalOrderId`) internally.
   */
  providerTransactionId?: string;

  /**
   * Optional human-readable reason for the refund.
   * Surfaced in the PSP settlement report and merchant dashboard.
   */
  reason?: string;
}

/**
 * Response returned after initiating a refund.
 */
export interface RefundResponse {
  /** Whether the refund request was accepted by the PSP. */
  success: boolean;

  /** Normalised refund status at the time of the response. */
  status: RefundStatus;

  /** Your refund reference ID (mirrors `CreateRefundRequest.refundId`). */
  refundId: string;

  /** The original order ID against which the refund was raised. */
  originalOrderId: string;

  /** Amount refunded in paise. */
  amount: number;

  /** PSP's internal refund transaction reference. */
  providerRefundId?: string;

  /** Raw response from the PSP for advanced inspection. */
  rawResponse: unknown;
}

// ============================================================================
// Provider Credential Shapes
// ============================================================================

export interface PhonePeCredentials {
  /** Merchant ID from PhonePe Business dashboard */
  merchantId: string;

  /** Salt Key from PhonePe Business dashboard */
  saltKey: string;

  /** Salt Index (usually '1') */
  saltIndex: string;
}

export interface PaytmCredentials {
  /** Merchant ID from Paytm Business dashboard */
  merchantId: string;

  /** Merchant Key from Paytm Business dashboard */
  merchantKey: string;

  /** Website name (default: 'WEBSTAGING' for sandbox, 'DEFAULT' for production) */
  website?: string;
}
