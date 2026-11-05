// ============================================================================
// UPIPay — PSP Interface (The Contract)
// ============================================================================
// Every free PSP adapter must implement this interface.

import type {
  Provider,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  WebhookVerifyOptions,
  WebhookEvent,
  CheckStatusOptions,
  CreateRefundRequest,
  RefundResponse,
} from '../types.js';

/**
 * Unified PSP interface.
 * Both PhonePe and Paytm adapters implement this.
 */
export interface IPSPAdapter {
  /** Which provider this adapter handles */
  readonly provider: Provider;

  /**
   * Create a payment request with the PSP.
   * Returns a payment URL where the user can pay via UPI QR.
   * Money goes directly to your bank — zero commission.
   */
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;

  /**
   * Check payment status via the PSP's Status API.
   * Use this to verify if a payment was successful.
   * @param orderId - Your order ID
   * @param options - Optional: pass expectedAmount to verify amount integrity
   */
  checkStatus(orderId: string, options?: CheckStatusOptions): Promise<PaymentStatusResponse>;

  /**
   * Verify that a webhook callback is authentic.
   * Uses HMAC/SHA256 checksum verification (constant-time safe).
   *
   * Returns a WebhookEvent with parsed payment details and a `verified` flag.
   */
  verifyWebhook(payload: string | Buffer, signature: string, options?: WebhookVerifyOptions): WebhookEvent;

  /**
   * Initiate a full or partial refund against a previously completed payment.
   * Returns a RefundResponse describing the refund's current state.
   * This operation is always performed over a server-to-server call — the
   * customer's session is not involved.
   */
  createRefund?(request: CreateRefundRequest): Promise<RefundResponse>;
}
