// ============================================================================
// UPIPay — Custom Errors
// ============================================================================

/**
 * Base error class for all UPIPay errors.
 */
export class UPIPayError extends Error {
  public readonly code: string;
  public readonly provider?: string;
  public readonly isRetriable: boolean;

  constructor(
    message: string,
    options: { code?: string; provider?: string; isRetriable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'UPIPayError';
    this.code = options.code ?? 'UPIPAY_ERROR';
    this.provider = options.provider;
    this.isRetriable = options.isRetriable ?? false;
    if (options.cause) {
      (this as Record<string, unknown>)['cause'] = options.cause;
    }
  }
}

/** Invalid configuration (missing credentials, bad provider name, etc.) */
export class InvalidConfigError extends UPIPayError {
  constructor(message: string, provider?: string) {
    super(message, { code: 'INVALID_CONFIG', provider, isRetriable: false });
    this.name = 'InvalidConfigError';
  }
}

/** Payment creation or verification failed */
export class PaymentError extends UPIPayError {
  constructor(message: string, options: { provider?: string; isRetriable?: boolean; cause?: unknown } = {}) {
    super(message, { code: 'PAYMENT_ERROR', ...options });
    this.name = 'PaymentError';
  }
}

/** Webhook signature verification failed — security event */
export class WebhookVerificationError extends UPIPayError {
  constructor(message: string, provider?: string) {
    super(message, { code: 'WEBHOOK_VERIFICATION_FAILED', provider, isRetriable: false });
    this.name = 'WebhookVerificationError';
  }
}

/** Network error — always retriable */
export class NetworkError extends UPIPayError {
  constructor(message: string, options: { provider?: string; cause?: unknown } = {}) {
    super(message, { code: 'NETWORK_ERROR', isRetriable: true, ...options });
    this.name = 'NetworkError';
  }
}

/** Refund initiation or status check failed */
export class RefundError extends UPIPayError {
  constructor(message: string, options: { provider?: string; isRetriable?: boolean; cause?: unknown } = {}) {
    super(message, { code: 'REFUND_ERROR', ...options });
    this.name = 'RefundError';
  }
}
