// ============================================================================
// UPIPay — PhonePe Business Adapter (FREE — Zero Commission)
// ============================================================================
// Uses PhonePe Business merchant API. Money goes directly to your bank.
// Get your free credentials at: https://business.phonepe.com
//
// How it works:
// 1. You create a payment → PhonePe returns a payment page URL
// 2. User pays via UPI on that page → money goes to YOUR bank account
// 3. PhonePe sends a webhook to your server → you verify the checksum
// 4. You can also poll the Status API to confirm payment
//
// Cost: ₹0 per transaction (0% MDR on UPI as per govt mandate)

import { createHash } from 'node:crypto';
import type { IPSPAdapter } from '../interfaces/psp-adapter.js';
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  PaymentStatus,
  PaymentMethod,
  PhonePeCredentials,
  Environment,
  UPIPayOptions,
  WebhookVerifyOptions,
  WebhookEvent,
  CheckStatusOptions,
  CreateRefundRequest,
  RefundResponse,
  RefundStatus,
} from '../types.js';
import { PaymentError, NetworkError, InvalidConfigError, RefundError } from '../errors.js';
import { constantTimeEqual, isTimestampFresh } from '../utils/crypto.js';
import { validateSaltIndex, normalizePhoneNumber } from '../utils/validation.js';
import { Logger } from '../utils/logger.js';
import { sanitizePspError } from '../utils/sanitize.js';
import { withRetry } from '../utils/retry.js';

const BASE_URLS = {
  sandbox: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
  production: 'https://api.phonepe.com/apis/hermes',
} as const;

/**
 * PhonePe Business adapter — FREE, zero-commission UPI payments.
 *
 * @example
 * ```typescript
 * import { PhonePeAdapter } from 'upipay/phonepe';
 *
 * const phonepe = new PhonePeAdapter(
 *   {
 *     merchantId: process.env.PHONEPE_MERCHANT_ID!,
 *     saltKey: process.env.PHONEPE_SALT_KEY!,
 *     saltIndex: '1',
 *   },
 *   'sandbox',
 * );
 *
 * // Create payment — user pays via UPI, money goes to your bank
 * const payment = await phonepe.createPayment({
 *   amount: 50000,  // ₹500.00 in paise
 *   orderId: 'order_123',
 *   customerPhone: '9876543210',
 *   callbackUrl: 'https://yoursite.com/webhook',
 *   redirectUrl: 'https://yoursite.com/payment-complete',
 *   idempotencyKey: randomUUID(), // Prevents duplicate sessions on network retries
 * });
 *
 * // Redirect user to payment.paymentUrl
 * ```
 */
export class PhonePeAdapter implements IPSPAdapter {
  readonly provider = 'phonepe' as const;

  private readonly credentials: PhonePeCredentials;
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly timeout: number;

  constructor(credentials: PhonePeCredentials, environment: Environment, options?: UPIPayOptions) {
    // saltIndex must be a simple numeric string (e.g. "1") as required by the PhonePe
    // checksum format: SHA256(payload + path + saltKey) + "###" + saltIndex.
    // A malformed saltIndex would silently produce an invalid X-VERIFY header.
    validateSaltIndex(credentials.saltIndex);

    this.credentials = credentials;
    this.baseUrl = BASE_URLS[environment];
    this.logger = new Logger(options);
    this.timeout = options?.timeout ?? 30000;
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    this.logger.debug('Creating payment via PhonePe Business', { orderId: request.orderId });

    try {
      const phone = normalizePhoneNumber(request.customerPhone);

      const payload = {
        merchantId: this.credentials.merchantId,
        merchantTransactionId: request.orderId,
        merchantUserId: `MUID_${phone}`,
        amount: request.amount,
        redirectUrl: request.redirectUrl,
        redirectMode: 'REDIRECT',
        callbackUrl: request.callbackUrl,
        paymentInstrument: { type: 'PAY_PAGE' },
      };

      const payloadJson = JSON.stringify(payload);
      const base64Payload = Buffer.from(payloadJson).toString('base64');
      const checksum = this.generateChecksum(base64Payload, '/pg/v1/pay');

      // Build outbound headers. `X-IDEMPOTENCY-KEY` prevents PhonePe from
      // creating a second payment session when the same request is retried
      // after a network failure before the response was received.
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
      };
      if (request.idempotencyKey) {
        headers['X-IDEMPOTENCY-KEY'] = request.idempotencyKey;
      }

      const response = await fetch(`${this.baseUrl}/pg/v1/pay`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ request: base64Payload }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new PaymentError(
          `PhonePe API error (${response.status}): ${sanitizePspError(errorBody)}`,
          { provider: 'phonepe', isRetriable: response.status >= 500 },
        );
      }

      const result = await response.json() as PhonePeResponse;
      const paymentUrl = result?.data?.instrumentResponse?.redirectInfo?.url ?? '';

      this.logger.info('Payment created successfully', { orderId: request.orderId });

      return {
        success: result.success,
        paymentUrl,
        orderId: request.orderId,
        providerTransactionId: result?.data?.merchantTransactionId,
        rawResponse: result,
      };
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      throw this.wrapError(error, 'Failed to create payment');
    }
  }

  async checkStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    this.logger.debug('Checking payment status via PhonePe', { orderId });

    return withRetry(
      () => this.fetchStatus(orderId, options),
      { maxAttempts: options?.maxRetries ?? 3, baseDelayMs: options?.retryDelayMs ?? 1000 },
    );
  }

  private async fetchStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    try {
      const path = `/pg/v1/status/${this.credentials.merchantId}/${orderId}`;
      const checksum = this.generateChecksum('', path);

      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': checksum,
          'X-MERCHANT-ID': this.credentials.merchantId,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new PaymentError(
          `PhonePe status API error (${response.status}): ${sanitizePspError(errorBody)}`,
          { provider: 'phonepe', isRetriable: response.status >= 500 },
        );
      }

      const result = await response.json() as PhonePeStatusResponse;

      if (!result.success && result.code !== 'PAYMENT_PENDING') {
        this.logger.warn('PhonePe status API returned non-success', { code: result.code });
      }

      const status = this.mapStatus(result?.code);
      const amount = result?.data?.amount ?? 0;

      // Amount integrity verification. When expectedAmount is provided and the
      // payment is confirmed, the PSP-reported amount must match exactly.
      // This closes the window where a lower-value transaction satisfies
      // a higher-value order on the application layer.
      if (options?.expectedAmount !== undefined && status === 'SUCCESS') {
        if (amount !== options.expectedAmount) {
          throw new PaymentError(
            `Amount mismatch: expected ${options.expectedAmount} paise but PSP returned ${amount} paise. Possible payment manipulation.`,
            { provider: 'phonepe', isRetriable: false },
          );
        }
      } else if (options?.expectedAmount === undefined && status === 'SUCCESS') {
        this.logger.warn(
          'checkStatus called without expectedAmount — amount integrity is not being enforced. ' +
          'Pass { expectedAmount: orderAmountInPaise } to protect against underpayment.',
        );
      }

      return {
        success: true,
        status,
        amount,
        orderId: result?.data?.merchantTransactionId ?? orderId,
        transactionId: result?.data?.transactionId,
        paymentMethod: this.mapMethod(result?.data?.paymentInstrument?.type),
        rawResponse: result,
      };
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      throw this.wrapError(error, 'Failed to check payment status');
    }
  }

  verifyWebhook(payload: string | Buffer, signature: string, options?: WebhookVerifyOptions): WebhookEvent {
    if (!signature || typeof signature !== 'string') {
      this.logger.warn('PhonePe webhook verification FAILED — missing or invalid signature header');
      return { verified: false, status: 'FAILED', orderId: '', rawPayload: payload };
    }

    // Reject oversized signature values before any buffer allocation.
    // A valid PhonePe SHA256 hex signature is 64 characters; allow generous headroom.
    if (signature.length > 512) {
      this.logger.warn('PhonePe webhook verification FAILED — signature exceeds maximum length');
      return { verified: false, status: 'FAILED', orderId: '', rawPayload: payload };
    }

    try {
      const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf8');

      // PhonePe webhooks POST a JSON envelope: {"response":"eyJtZXJjaGFu..."}
      // The X-VERIFY checksum is computed on the base64-encoded "response" value
      // only — not on the outer JSON wrapper. Extract the inner value when
      // the full request body is passed in, or use the string as-is if the
      // caller has already extracted it.
      let base64Response = payloadStr;
      try {
        const wrapper = JSON.parse(payloadStr);
        if (wrapper?.response && typeof wrapper.response === 'string') {
          base64Response = wrapper.response;
        }
      } catch {
        // Not a JSON envelope — treat the raw string as the base64 response
      }

      // PhonePe webhook: X-VERIFY = SHA256(response + saltKey) + ### + saltIndex
      const expectedChecksum = this.generateCallbackChecksum(base64Response);
      const isValid = constantTimeEqual(expectedChecksum, signature);

      if (!isValid) {
        this.logger.warn('PhonePe webhook verification FAILED — possible tampering');
        return { verified: false, status: 'FAILED', orderId: '', rawPayload: payload };
      }

      // Replay protection is off by default. PSPs embed the transaction timestamp,
      // not the webhook delivery time, so a fixed tolerance window silently drops
      // legitimate delayed or retried webhooks. Enable only if you understand this
      // trade-off and pair it with a generous tolerance window.
      const replayEnabled = options?.enableReplayProtection === true; // default false

      // Decode the base64 response to extract event data
      let parsedPayload: any = null;
      try {
        try {
          const decodedStr = Buffer.from(base64Response, 'base64').toString('utf8');
          parsedPayload = JSON.parse(decodedStr);
        } catch {
          parsedPayload = JSON.parse(base64Response);
        }
      } catch {
        // Could not parse — still verified but no parsed data
      }

      if (replayEnabled) {
        let ts = options?.timestamp;

        if (!ts) {
          ts = parsedPayload?.timestamp || parsedPayload?.data?.timestamp || parsedPayload?.expireAt || parsedPayload?.data?.expireAt;
        }

        if (!ts) {
          this.logger.warn('PhonePe webhook replay protection enabled but no timestamp found');
          return { verified: false, status: 'FAILED', orderId: '', rawPayload: payload };
        }

        const tolerance = options?.timestampToleranceSeconds ?? 300;
        if (!isTimestampFresh(ts, tolerance)) {
          this.logger.warn('PhonePe webhook verification FAILED — stale/replayed timestamp');
          return { verified: false, status: 'FAILED', orderId: '', rawPayload: payload };
        }
      }

      const webhookEvent: WebhookEvent = {
        verified: true,
        status: this.mapStatus(parsedPayload?.code),
        orderId: parsedPayload?.data?.merchantTransactionId ?? '',
        transactionId: parsedPayload?.data?.transactionId,
        amount: parsedPayload?.data?.amount,
        rawPayload: parsedPayload ?? payload,
      };

      // Amount integrity verification. When expectedAmount is provided, the
      // webhook-reported amount must match the order total exactly. This
      // prevents amount-substitution attacks where a low-value payment is
      // used to fulfil a higher-value order.
      if (options?.expectedAmount !== undefined) {
        if (webhookEvent.amount === undefined || webhookEvent.amount !== options.expectedAmount) {
          this.logger.warn('PhonePe webhook amount mismatch', {
            expected: String(options.expectedAmount),
            received: String(webhookEvent.amount ?? 'undefined'),
          });
          return { verified: false, status: 'FAILED', orderId: webhookEvent.orderId, rawPayload: payload };
        }
      } else {
        this.logger.warn(
          'verifyWebhook called without expectedAmount — amount integrity is not being enforced. ' +
          'Pass { expectedAmount: orderAmountInPaise } to protect against underpayment.',
        );
      }

      this.logger.debug('PhonePe webhook verified ✓');
      return webhookEvent;
    } catch (error) {
      this.logger.error('Webhook verification error', { error: (error as Error).message });
      return { verified: false, status: 'FAILED', orderId: '', rawPayload: payload };
    }
  }

  /**
   * Initiate a full or partial refund for a previously completed PhonePe payment.
   *
   * PhonePe processes refunds via `/pg/v1/refund`. Partial refunds are supported
   * by passing an `amount` value less than the original transaction amount.
   * Refund status may be `PENDING` on first response — poll `checkStatus` or
   * listen for a refund webhook to determine the final settled state.
   *
   * @param request - Refund details including original order ID, refund ID, and amount in paise.
   */
  async createRefund(request: CreateRefundRequest): Promise<RefundResponse> {
    this.logger.debug('Initiating refund via PhonePe Business', {
      originalOrderId: request.originalOrderId,
      refundId: request.refundId,
    });

    try {
      const payload = {
        merchantId: this.credentials.merchantId,
        merchantUserId: `MUID_REFUND`,
        originalTransactionId: request.originalOrderId,
        merchantTransactionId: request.refundId,
        amount: request.amount,
        callbackUrl: '',
      };

      const payloadJson = JSON.stringify(payload);
      const base64Payload = Buffer.from(payloadJson).toString('base64');
      const checksum = this.generateChecksum(base64Payload, '/pg/v1/refund');

      const response = await fetch(`${this.baseUrl}/pg/v1/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': checksum,
        },
        body: JSON.stringify({ request: base64Payload }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new RefundError(
          `PhonePe refund API error (${response.status}): ${sanitizePspError(errorBody)}`,
          { provider: 'phonepe', isRetriable: response.status >= 500 },
        );
      }

      const result = await response.json() as PhonePeRefundResponse;
      const refundStatus = this.mapRefundStatus(result?.code);

      this.logger.info('Refund initiated', { refundId: request.refundId, status: refundStatus });

      return {
        success: result.success,
        status: refundStatus,
        refundId: request.refundId,
        originalOrderId: request.originalOrderId,
        amount: request.amount,
        providerRefundId: result?.data?.transactionId,
        rawResponse: result,
      };
    } catch (error) {
      if (error instanceof RefundError) throw error;
      const wrapped = this.wrapError(error, 'Failed to initiate refund');
      throw new RefundError(wrapped.message, { provider: 'phonepe', cause: error });
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────────

  /** Generate PhonePe X-VERIFY checksum: SHA256(base64Payload + path + saltKey) + ### + saltIndex */
  private generateChecksum(base64Payload: string, path: string): string {
    const data = base64Payload + path + this.credentials.saltKey;
    const hash = createHash('sha256').update(data).digest('hex');
    return `${hash}###${this.credentials.saltIndex}`;
  }

  /** Generate callback verification checksum: SHA256(response + saltKey) + ### + saltIndex */
  private generateCallbackChecksum(response: string): string {
    const data = response + this.credentials.saltKey;
    const hash = createHash('sha256').update(data).digest('hex');
    return `${hash}###${this.credentials.saltIndex}`;
  }

  private mapStatus(code?: string): PaymentStatus {
    switch (code) {
      case 'PAYMENT_SUCCESS': return 'SUCCESS';
      case 'PAYMENT_ERROR':
      case 'PAYMENT_CANCELLED':
      case 'PAYMENT_DECLINED':
      case 'TIMED_OUT':
      case 'USER_CANCELLED':
      case 'BAD_REQUEST': return 'FAILED';
      case 'PAYMENT_PENDING': return 'PENDING';
      default: return 'PENDING';
    }
  }

  private mapRefundStatus(code?: string): RefundStatus {
    switch (code) {
      case 'PAYMENT_SUCCESS': return 'SUCCESS';
      case 'PAYMENT_ERROR':
      case 'PAYMENT_CANCELLED': return 'FAILED';
      default: return 'PENDING';
    }
  }

  private mapMethod(type?: string): PaymentMethod {
    if (type?.toUpperCase() === 'UPI') return 'upi';
    if (type?.toUpperCase() === 'WALLET') return 'wallet';
    return 'unknown';
  }

  private wrapError(error: unknown, message: string): Error {
    if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') || error.message.includes('fetch'))) {
      return new NetworkError(`${message}: ${error.message}`, { provider: 'phonepe', cause: error });
    }
    return new PaymentError(`${message}: ${(error as Error)?.message ?? 'unknown'}`, { provider: 'phonepe', cause: error });
  }
}

// ─── Internal Types ──────────────────────────────────────────────────

interface PhonePeResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantTransactionId: string;
    instrumentResponse?: {
      type: string;
      redirectInfo?: { url: string; method: string };
    };
  };
}

interface PhonePeStatusResponse {
  success: boolean;
  code: string;
  data?: {
    merchantTransactionId: string;
    transactionId: string;
    amount: number;
    paymentInstrument?: { type: string };
  };
}

interface PhonePeRefundResponse {
  success: boolean;
  code: string;
  message?: string;
  data?: {
    merchantTransactionId: string;
    transactionId: string;
    amount: number;
  };
}
