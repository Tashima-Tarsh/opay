// ============================================================================
// UPIPay — Main Client
// ============================================================================
// The primary entry point. Accepts configuration, creates the correct PSP
// adapter, and exposes a unified API for UPI payments, QR generation, and
// webhook verification — all with zero commission.

import type { IPSPAdapter } from './interfaces/psp-adapter.js';
import type {
  UPIPayConfig,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  UPIQRRequest,
  UPIQRResponse,
  UPIIntentLink,
  Provider,
  Environment,
  UPIPayOptions,
  WebhookVerifyOptions,
  WebhookEvent,
  CheckStatusOptions,
  CreateRefundRequest,
  RefundResponse,
} from './types.js';
import { InvalidConfigError } from './errors.js';
import { validateConfig, validatePaymentRequest, validateOrderId } from './utils/validation.js';
import { Logger } from './utils/logger.js';
import { PhonePeAdapter } from './adapters/phonepe.js';
import { PaytmAdapter } from './adapters/paytm.js';
import { generateUPIQR, buildUPIUri, buildIntentLinks } from './upi/qr.js';

/**
 * **UPIPay** — Free, zero-commission UPI payments for India.
 *
 * Accept UPI payments directly into your bank account via the NPCI network.
 * Integrates with PhonePe Business and Paytm Business free merchant APIs.
 * Money goes straight from customer → NPCI → your bank. No middlemen.
 *
 * ### Quick start — UPI QR (no merchant account required):
 * ```typescript
 * import { UPIPay } from 'upipay';
 *
 * const client = new UPIPay({ provider: 'phonepe', environment: 'sandbox', credentials: {...} });
 * const qr = await client.generateQR({ vpa: 'yourbiz@ybl', name: 'My Business', amount: 500, orderId: 'ord_1' });
 * // Render: <img src={qr.qrImage} />
 * ```
 *
 * ### Quick start — Full PSP payment with webhook verification:
 * ```typescript
 * const payment = await client.createPayment({
 *   amount: 50000,          // ₹500.00 in paise
 *   orderId: 'ord_1',
 *   customerPhone: '9876543210',
 *   callbackUrl: 'https://yoursite.com/webhook',
 *   redirectUrl: 'https://yoursite.com/done',
 * });
 * // Redirect user to payment.paymentUrl
 * ```
 */
export class UPIPay {
  private readonly adapter: IPSPAdapter;
  private readonly config: UPIPayConfig;
  private readonly logger: Logger;

  constructor(config: UPIPayConfig) {
    // Prevent accidental use in browser or React Native environments.
    // Merchant credentials (salt keys, merchant keys) must never be exposed
    // in a client-side bundle — they belong exclusively on the server.
    const isBrowser = typeof globalThis !== 'undefined'
      && typeof (globalThis as any).window !== 'undefined'
      && typeof (globalThis as any).window.document !== 'undefined';
    const isReactNative = typeof globalThis !== 'undefined'
      && typeof (globalThis as any).navigator !== 'undefined'
      && (globalThis as any).navigator.product === 'ReactNative';

    if (isBrowser || isReactNative) {
      throw new InvalidConfigError(
        'UPIPay cannot run in browser or React Native environments — merchant credentials ' +
        'must stay on the server. For client-side QR generation, use the standalone QR module: ' +
        'import { generateUPIQR } from "upipay/qr"'
      );
    }

    validateConfig(config);
    this.config = config;
    this.logger = new Logger(config.options);
    this.adapter = this.createAdapter(config);
    this.logger.info(`UPIPay initialised — ${config.provider} (${config.environment}) — ₹0 per transaction`);
  }

  /** Active payment provider */
  get provider(): Provider { return this.config.provider; }

  /** Active environment ('sandbox' or 'production') */
  get environment(): Environment { return this.config.environment; }

  // ─── UPI QR Code Generation ─────────────────────────────────────────

  /**
   * Generate an NPCI-compliant UPI QR code.
   *
   * The customer scans the QR with any UPI app (PhonePe, Google Pay, Paytm,
   * BHIM, etc.) and pays directly into your registered bank account.
   * Zero commission, no merchant account required.
   *
   * > **Important:** QR-only payments have no webhook or status API.
   * > You must verify receipt manually (bank SMS, Soundbox, portal).
   * > For automated, server-side verification use `createPayment()` instead.
   *
   * @param request - VPA, display name, amount (in rupees), and orderId
   */
  async generateQR(request: UPIQRRequest): Promise<UPIQRResponse> {
    this.logger.debug('Generating UPI QR', { orderId: request.orderId, amount: String(request.amount) });
    return generateUPIQR(request);
  }

  /**
   * Build a UPI URI string without rendering a QR image.
   * Useful for sending payment links over WhatsApp or SMS.
   */
  buildUPILink(request: UPIQRRequest): string {
    return buildUPIUri(request);
  }

  /**
   * Build app-specific UPI deep links (PhonePe, Google Pay, Paytm, BHIM).
   * Opens the chosen UPI app with payment details pre-filled.
   */
  buildIntentLinks(request: UPIQRRequest): UPIIntentLink {
    const uri = buildUPIUri(request);
    return buildIntentLinks(uri);
  }

  // ─── PSP Payment (Automated Verification) ──────────────────────────

  /**
   * Initiate a payment via the PSP merchant API.
   *
   * Returns a hosted payment URL where the customer pays via UPI.
   * After payment, the PSP delivers a signed webhook to your `callbackUrl`.
   * Use `verifyWebhook()` to authenticate it, then `checkStatus()` to
   * confirm the final state before fulfilling the order.
   *
   * @param request - Payment details including amount (in paise), orderId, phone
   */
  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    validatePaymentRequest(request, this.config.environment);
    this.logger.debug('Creating payment', { provider: this.config.provider, orderId: request.orderId });
    return this.adapter.createPayment(request);
  }

  /**
   * Check the confirmed status of a payment via the PSP Status API.
   *
   * Always call this after receiving a webhook — never rely solely on the
   * webhook payload. Passing `expectedAmount` adds an extra layer of
   * protection: the SDK will throw if the PSP-returned amount differs from
   * what you originally charged, preventing amount-substitution attacks.
   *
   * @param orderId - Your order ID
   * @param options - Optional `expectedAmount` in paise for amount verification
   */
  async checkStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    // Validate orderId before appending it to API URL paths.
    // Only alphanumeric + hyphen/underscore/dot characters are permitted.
    validateOrderId(orderId);
    this.logger.debug('Checking payment status', { provider: this.config.provider, orderId });
    return this.adapter.checkStatus(orderId, options);
  }

  /**
   * Authenticate a PSP webhook callback and parse its payment event.
   *
   * Always pass the **raw** HTTP request body (`Buffer` or `string`),
   * never a parsed JSON object. Parsing the body before verification
   * allows serialisation-order attacks that bypass signature checks.
   *
   * Replay protection is opt-in — pass `{ enableReplayProtection: true }` to
   * enable timestamp-based stale-webhook rejection. Use database-level
   * idempotency (unique constraint on `transactionId`) as the primary
   * replay-prevention mechanism.
   *
   * Returns a `WebhookEvent` containing:
   * - `verified` — whether the signature is authentic
   * - `status` — normalised payment status: `SUCCESS | PENDING | FAILED`
   * - `orderId` — your order reference, safe to use as an idempotency key
   * - `amount` — amount in paise as reported by the PSP
   * - `transactionId` — the PSP's internal transaction reference
   *
   * @param payload - Raw HTTP request body
   * @param signature - PSP signature header (`x-verify` for PhonePe, `CHECKSUMHASH` for Paytm)
   * @param options - Replay protection tolerance settings
   */
  verifyWebhook(payload: string | Buffer, signature: string, options?: WebhookVerifyOptions): WebhookEvent {
    return this.adapter.verifyWebhook(payload, signature, options);
  }

  /**
   * Initiate a full or partial refund for a previously completed payment.
   *
   * Uses the PSP's refund endpoint to reverse the transaction amount (or a
   * portion of it) back to the customer's originating payment instrument.
   * Partial refunds are supported — pass an `amount` in paise that is less
   * than or equal to the original transaction amount.
   *
   * The returned `status` may be `PENDING` on first response. Listen for the
   * PSP's refund webhook or poll using `checkStatus` to confirm settlement.
   *
   * @param request - Refund details: original order ID, unique refund ID, amount in paise
   */
  async createRefund(request: CreateRefundRequest): Promise<RefundResponse> {
    if (!this.adapter.createRefund) {
      throw new InvalidConfigError(
        `The ${this.config.provider} adapter does not expose a refund API in the current configuration.`,
      );
    }
    return this.adapter.createRefund(request);
  }

  /**
   * Returns the underlying PSP adapter for advanced or provider-specific use cases.
   */
  getAdapter(): IPSPAdapter {
    return this.adapter;
  }

  // ─── Private ───────────────────────────────────────────────────────

  private createAdapter(config: UPIPayConfig): IPSPAdapter {
    const { provider, environment, credentials, options } = config;

    switch (provider) {
      case 'phonepe':
        return new PhonePeAdapter(
          {
            merchantId: credentials['merchantId']!,
            saltKey: credentials['saltKey']!,
            saltIndex: credentials['saltIndex'] ?? '1',
          },
          environment,
          options,
        );

      case 'paytm':
        return new PaytmAdapter(
          {
            merchantId: credentials['merchantId']!,
            merchantKey: credentials['merchantKey']!,
            website: credentials['website'],
          },
          environment,
          options,
        );

      default:
        throw new InvalidConfigError(`Unknown provider: ${provider as string}. Supported providers: phonepe, paytm`);
    }
  }
}
