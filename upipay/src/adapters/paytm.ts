// ============================================================================
// UPIPay — Paytm Business Adapter (FREE — Zero Commission)
// ============================================================================
// Uses Paytm Business merchant API. Money goes directly to your bank.
// Get your free credentials at: https://business.paytm.com
//
// How it works:
// 1. You create a payment → Paytm returns a transaction token + payment URL
// 2. User pays via UPI on Paytm checkout → money goes to YOUR bank account
// 3. Paytm sends a callback to your server → you verify the checksum
// 4. You can also call the Status API to confirm payment
//
// Cost: ₹0 per transaction (0% MDR on UPI as per govt mandate)

import type { IPSPAdapter } from '../interfaces/psp-adapter.js';
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  PaymentStatus,
  PaymentMethod,
  PaytmCredentials,
  Environment,
  UPIPayOptions,
  WebhookVerifyOptions,
  WebhookEvent,
  CheckStatusOptions,
  CreateRefundRequest,
  RefundResponse,
  RefundStatus,
} from '../types.js';
import { PaymentError, NetworkError, RefundError } from '../errors.js';
import { isTimestampFresh, getPaytmParamsString, generatePaytmChecksum, verifyPaytmChecksum, stableStringify } from '../utils/crypto.js';
import { normalizePhoneNumber } from '../utils/validation.js';
import { Logger } from '../utils/logger.js';
import { sanitizePspError } from '../utils/sanitize.js';
import { withRetry } from '../utils/retry.js';

const BASE_URLS = {
  sandbox: 'https://securestage.paytmpayments.com',
  production: 'https://secure.paytmpayments.com',
} as const;

/**
 * Paytm Business adapter — FREE, zero-commission UPI payments.
 *
 * @example
 * ```typescript
 * import { PaytmAdapter } from 'upipay/paytm';
 *
 * const paytm = new PaytmAdapter(
 *   {
 *     merchantId: process.env.PAYTM_MERCHANT_ID!,
 *     merchantKey: process.env.PAYTM_MERCHANT_KEY!,
 *   },
 *   'sandbox',
 * );
 *
 * const payment = await paytm.createPayment({
 *   amount: 50000,
 *   orderId: 'order_456',
 *   customerPhone: '9876543210',
 *   callbackUrl: 'https://yoursite.com/webhook',
 *   redirectUrl: 'https://yoursite.com/done',
 *   idempotencyKey: randomUUID(), // Prevents duplicate sessions on network retries
 * });
 * ```
 */
export class PaytmAdapter implements IPSPAdapter {
  readonly provider = 'paytm' as const;

  private readonly credentials: PaytmCredentials;
  private readonly environment: Environment;
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly timeout: number;

  constructor(credentials: PaytmCredentials, environment: Environment, options?: UPIPayOptions) {
    this.credentials = credentials;
    this.environment = environment;
    this.baseUrl = BASE_URLS[environment];
    this.logger = new Logger(options);
    this.timeout = options?.timeout ?? 30000;
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    this.logger.debug('Creating payment via Paytm Business', { orderId: request.orderId });

    try {
      const amountInRupees = (request.amount / 100).toFixed(2);
      const website = this.credentials.website ?? (this.environment === 'sandbox' ? 'WEBSTAGING' : 'DEFAULT');

      const phone = normalizePhoneNumber(request.customerPhone);

      const body = {
        requestType: 'Payment',
        mid: this.credentials.merchantId,
        websiteName: website,
        orderId: request.orderId,
        txnAmount: {
          value: amountInRupees,
          currency: 'INR',
        },
        userInfo: {
          custId: `CUST_${phone}`,
          mobile: phone,
          ...(request.customerName ? { firstName: request.customerName } : {}),
          ...(request.customerEmail ? { email: request.customerEmail } : {}),
        },
        callbackUrl: request.callbackUrl,
      };

      // Paytm V3 JSON APIs (/initiateTransaction, /v3/order/status) expect the
      // signature to be computed over the serialized JSON body, not the
      // pipe-delimited param string used for V1 form-encoded callbacks.
      const bodyString = stableStringify(body);
      const signature = generatePaytmChecksum(bodyString, this.credentials.merchantKey);

      // Build the `head` object. `txnSToken` is Paytm's idempotency mechanism —
      // passing a stable token ensures the same call is not processed twice
      // when the client retries after a network failure.
      const head: Record<string, string> = { signature };
      if (request.idempotencyKey) {
        head['txnSToken'] = request.idempotencyKey;
      }

      const url = `${this.baseUrl}/theia/api/v1/initiateTransaction?mid=${this.credentials.merchantId}&orderId=${request.orderId}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, head }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new PaymentError(
          `Paytm API error (${response.status}): ${sanitizePspError(errorBody)}`,
          { provider: 'paytm', isRetriable: response.status >= 500 },
        );
      }

      const result = await response.json() as PaytmInitResponse;
      const txnToken = result?.body?.txnToken;

      // Build the payment page URL
      const paymentUrl = txnToken
        ? `${this.baseUrl}/theia/api/v1/showPaymentPage?mid=${this.credentials.merchantId}&orderId=${request.orderId}&txnToken=${txnToken}`
        : '';

      this.logger.info('Payment created successfully', { orderId: request.orderId });

      return {
        success: result?.body?.resultInfo?.resultStatus === 'S',
        paymentUrl,
        orderId: request.orderId,
        providerTransactionId: undefined,
        rawResponse: result,
      };
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      throw this.wrapError(error, 'Failed to create payment');
    }
  }

  async checkStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    this.logger.debug('Checking payment status via Paytm', { orderId });

    return withRetry(
      () => this.fetchStatus(orderId, options),
      { maxAttempts: options?.maxRetries ?? 3, baseDelayMs: options?.retryDelayMs ?? 1000 },
    );
  }

  private async fetchStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse> {
    try {
      const body = {
        mid: this.credentials.merchantId,
        orderId,
      };

      // V3 status endpoint expects JSON-body-based signature (see createPayment)
      const bodyString = stableStringify(body);
      const signature = generatePaytmChecksum(bodyString, this.credentials.merchantKey);

      const response = await fetch(`${this.baseUrl}/v3/order/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, head: { signature } }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new PaymentError(
          `Paytm status API error (${response.status}): ${sanitizePspError(errorBody)}`,
          { provider: 'paytm', isRetriable: response.status >= 500 },
        );
      }

      const result = await response.json() as PaytmStatusResponse;
      const status = this.mapStatus(result?.body?.resultInfo?.resultStatus);

      // Paytm returns resultStatus 'TXN_SUCCESS' for completed payments.
      // Map this to a boolean so callers do not need to inspect the raw response.
      const isSuccess = result?.body?.resultInfo?.resultStatus === 'TXN_SUCCESS' || result?.body?.resultInfo?.resultStatus === 'S';

      // Paytm returns amount in rupees as string
      const amountInPaise = Math.round(parseFloat(result?.body?.txnAmount ?? '0') * 100);

      // Amount integrity verification. When expectedAmount is provided and the
      // payment is confirmed, the PSP-reported amount must match exactly.
      // This closes the window where a lower-value transaction satisfies
      // a higher-value order on the application layer.
      if (options?.expectedAmount !== undefined && status === 'SUCCESS') {
        if (amountInPaise !== options.expectedAmount) {
          throw new PaymentError(
            `Amount mismatch: expected ${options.expectedAmount} paise but PSP returned ${amountInPaise} paise. Possible payment manipulation.`,
            { provider: 'paytm', isRetriable: false },
          );
        }
      } else if (options?.expectedAmount === undefined && status === 'SUCCESS') {
        this.logger.warn(
          'checkStatus called without expectedAmount — amount integrity is not being enforced. ' +
          'Pass { expectedAmount: orderAmountInPaise } to protect against underpayment.',
        );
      }

      return {
        success: isSuccess,
        status,
        amount: amountInPaise,
        orderId: result?.body?.orderId ?? orderId,
        transactionId: result?.body?.txnId,
        paymentMethod: this.mapMethod(result?.body?.paymentMode),
        rawResponse: result,
      };
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      throw this.wrapError(error, 'Failed to check payment status');
    }
  }

  verifyWebhook(payload: string | Buffer, signature: string, options?: WebhookVerifyOptions): WebhookEvent {
    if (!signature || typeof signature !== 'string') {
      this.logger.warn('Paytm webhook verification FAILED — missing or invalid signature');
      return { verified: false, status: 'FAILED', orderId: '', rawPayload: payload };
    }

    // Reject oversized signature values before any buffer allocation.
    if (signature.length > 512) {
      this.logger.warn('Paytm webhook verification FAILED — signature exceeds maximum length');
      return { verified: false, status: 'FAILED', orderId: '', rawPayload: payload };
    }

    try {
      const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf8');

      // Parse the callback data
      let data: Record<string, string>;
      try {
        data = JSON.parse(payloadStr) as Record<string, string>;
      } catch {
        // Paytm sometimes sends form-encoded callbacks
        data = Object.fromEntries(new URLSearchParams(payloadStr).entries());
      }

      // The checksum might be in the payload itself
      const receivedChecksum = data['CHECKSUMHASH'] ?? signature;
      // Remove checksum from data before verification
      const dataForVerification = { ...data };
      delete dataForVerification['CHECKSUMHASH'];

      // Paytm's checksum algorithm: SHA256(paramsString + "|" + randomSalt)
      // encrypted with AES-128-CBC using the merchant key and a static IV.
      // Keys are sorted alphabetically before hashing for deterministic results.
      const paramsString = getPaytmParamsString(dataForVerification);
      const isValid = verifyPaytmChecksum(paramsString, this.credentials.merchantKey, receivedChecksum);

      if (!isValid) {
        this.logger.warn('Paytm webhook verification FAILED — possible tampering');
        return { verified: false, status: 'FAILED', orderId: '', rawPayload: payload };
      }

      // Replay protection is off by default — see WebhookVerifyOptions.enableReplayProtection.
      const replayEnabled = options?.enableReplayProtection === true; // default false

      if (replayEnabled) {
        const ts = options?.timestamp || data['TXNDATE'] || data['TXN_DATE'] || data['txndate'] || data['txnDate'];
        if (!ts) {
          this.logger.warn('Paytm webhook replay protection enabled but no timestamp found');
          return { verified: false, status: 'FAILED', orderId: '', rawPayload: payload };
        }

        const tolerance = options?.timestampToleranceSeconds ?? 300;
        if (!isTimestampFresh(ts, tolerance)) {
          this.logger.warn('Paytm webhook verification FAILED — stale/replayed timestamp');
          return { verified: false, status: 'FAILED', orderId: '', rawPayload: payload };
        }
      }

      // Build WebhookEvent with parsed payment details.
      // Derive status from the STATUS field first; fall back to RESPCODE
      // when STATUS is absent (some older callback formats omit it).
      const rawStatus = data['STATUS']
        || (data['RESPCODE'] === '01' ? 'TXN_SUCCESS' : undefined);

      const webhookEvent: WebhookEvent = {
        verified: true,
        status: this.mapStatus(rawStatus),
        orderId: data['ORDERID'] || data['orderId'] || '',
        transactionId: data['TXNID'] || data['txnId'],
        amount: data['TXNAMOUNT'] ? Math.round(parseFloat(data['TXNAMOUNT']) * 100) : undefined,
        rawPayload: data,
      };

      // Amount integrity verification. When expectedAmount is provided, the
      // webhook-reported amount must match the order total exactly. This
      // prevents amount-substitution attacks where a low-value payment is
      // used to fulfil a higher-value order.
      if (options?.expectedAmount !== undefined) {
        if (webhookEvent.amount === undefined || webhookEvent.amount !== options.expectedAmount) {
          this.logger.warn('Paytm webhook amount mismatch', {
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

      this.logger.debug('Paytm webhook verified ✓');
      return webhookEvent;
    } catch (error) {
      this.logger.error('Webhook verification error', { error: (error as Error).message });
      return { verified: false, status: 'FAILED', orderId: '', rawPayload: payload };
    }
  }

  /**
   * Initiate a full or partial refund for a previously completed Paytm payment.
   *
   * Paytm processes refunds via the `/v3/order/refund` endpoint. Partial refunds
   * are supported — pass an `amount` smaller than the original transaction value.
   * The returned status may be `PENDING` on first response; listen for a refund
   * webhook or poll the status endpoint to determine final settlement.
   *
   * @param request - Refund details including original order ID, refund ID, and amount in paise.
   */
  async createRefund(request: CreateRefundRequest): Promise<RefundResponse> {
    this.logger.debug('Initiating refund via Paytm Business', {
      originalOrderId: request.originalOrderId,
      refundId: request.refundId,
    });

    try {
      const amountInRupees = (request.amount / 100).toFixed(2);

      // Paytm requires the PSP's internal txnId, not the merchant orderId.
      // Obtain it from checkStatus().transactionId or verifyWebhook().transactionId.
      if (!request.providerTransactionId) {
        throw new RefundError(
          'Paytm refunds require providerTransactionId (the PSP transaction ID from checkStatus() or verifyWebhook()). ' +
          'orderId cannot be used as a txnId substitute.',
          { provider: 'paytm', isRetriable: false },
        );
      }

      const body = {
        mid: this.credentials.merchantId,
        txnType: 'REFUND',
        orderId: request.originalOrderId,
        txnId: request.providerTransactionId,
        refId: request.refundId,
        refundAmount: amountInRupees,
        ...(request.reason ? { comment: request.reason } : {}),
      };

      const bodyString = stableStringify(body);
      const signature = generatePaytmChecksum(bodyString, this.credentials.merchantKey);

      const response = await fetch(`${this.baseUrl}/v3/order/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, head: { signature } }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new RefundError(
          `Paytm refund API error (${response.status}): ${sanitizePspError(errorBody)}`,
          { provider: 'paytm', isRetriable: response.status >= 500 },
        );
      }

      const result = await response.json() as PaytmRefundResponse;
      const refundStatus = this.mapRefundStatus(result?.body?.resultInfo?.resultStatus);

      this.logger.info('Refund initiated', { refundId: request.refundId, status: refundStatus });

      return {
        success: refundStatus === 'SUCCESS',
        status: refundStatus,
        refundId: request.refundId,
        originalOrderId: request.originalOrderId,
        amount: request.amount,
        providerRefundId: result?.body?.refundId,
        rawResponse: result,
      };
    } catch (error) {
      if (error instanceof RefundError) throw error;
      const wrapped = this.wrapError(error, 'Failed to initiate refund');
      throw new RefundError(wrapped.message, { provider: 'paytm', cause: error });
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────────

  private mapStatus(status?: string): PaymentStatus {
    switch (status) {
      case 'TXN_SUCCESS':
      case 'S': return 'SUCCESS';
      case 'TXN_FAILURE':
      case 'F': return 'FAILED';
      case 'PENDING': return 'PENDING';
      default: return 'PENDING';
    }
  }

  private mapRefundStatus(status?: string): RefundStatus {
    switch (status) {
      case 'TXN_SUCCESS':
      case 'S': return 'SUCCESS';
      case 'TXN_FAILURE':
      case 'F': return 'FAILED';
      default: return 'PENDING';
    }
  }

  private mapMethod(mode?: string): PaymentMethod {
    if (mode?.toUpperCase() === 'UPI') return 'upi';
    if (['PPI', 'PAYTM'].includes(mode?.toUpperCase() ?? '')) return 'wallet';
    return 'unknown';
  }

  private wrapError(error: unknown, message: string): Error {
    if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') || error.message.includes('fetch'))) {
      return new NetworkError(`${message}: ${error.message}`, { provider: 'paytm', cause: error });
    }
    return new PaymentError(`${message}: ${(error as Error)?.message ?? 'unknown'}`, { provider: 'paytm', cause: error });
  }
}

// ─── Internal Types ──────────────────────────────────────────────────

interface PaytmInitResponse {
  head: { signature: string };
  body: {
    resultInfo: { resultStatus: string; resultCode: string; resultMsg: string };
    txnToken?: string;
  };
}

interface PaytmStatusResponse {
  head: { signature: string };
  body: {
    resultInfo: { resultStatus: string; resultCode: string; resultMsg: string };
    orderId: string;
    txnId: string;
    txnAmount: string;
    paymentMode: string;
  };
}

interface PaytmRefundResponse {
  head: { signature: string };
  body: {
    resultInfo: { resultStatus: string; resultCode: string; resultMsg: string };
    refundId?: string;
    txnAmount?: string;
  };
}
