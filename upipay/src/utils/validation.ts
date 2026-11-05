// ============================================================================
// UPIPay — Input Validation (Security-Hardened)
// ============================================================================
// All user input is validated before any API call or QR generation.
// Prevents injection, amount manipulation, replay, and URL-based attacks.

import type { UPIPayConfig, CreatePaymentRequest, UPIQRRequest, Provider, Environment } from '../types.js';
import { InvalidConfigError } from '../errors.js';

const VALID_PROVIDERS: ReadonlySet<Provider> = new Set(['phonepe', 'paytm']);

const REQUIRED_CREDENTIALS: Record<Provider, readonly string[]> = {
  phonepe: ['merchantId', 'saltKey', 'saltIndex'],
  paytm: ['merchantId', 'merchantKey'],
};

// Placeholder values that developers might accidentally leave in
const PLACEHOLDER_PATTERNS = /^(your_|test_|xxx|placeholder|change_me|TODO|FIXME)/i;

// Dangerous URL schemes
const DANGEROUS_SCHEMES = /^(javascript|data|vbscript|file):/i;

// Amount limits (in paise) — ₹1 to ₹1,00,00,000 (1 Crore)
const MIN_AMOUNT_PAISE = 100;        // ₹1
const MAX_AMOUNT_PAISE = 100_000_000; // ₹10,00,000 (10 Lakh — safe UPI limit)

// Order ID: alphanumeric + hyphens/underscores only (prevents injection)
const ORDER_ID_PATTERN = /^[a-zA-Z0-9_\-\.]{1,128}$/;

// Salt Index: must be a simple numeric string
const SALT_INDEX_PATTERN = /^\d{1,4}$/;

// ─── Config Validation ───────────────────────────────────────────────

/** Validate UPIPay config. Throws InvalidConfigError on invalid input. */
export function validateConfig(config: UPIPayConfig): void {
  if (!config.provider || !VALID_PROVIDERS.has(config.provider)) {
    throw new InvalidConfigError(
      `Invalid provider "${config.provider}". Must be: ${[...VALID_PROVIDERS].join(', ')}`,
    );
  }

  const validEnvs: readonly Environment[] = ['sandbox', 'production'];
  if (!config.environment || !validEnvs.includes(config.environment)) {
    throw new InvalidConfigError(`Invalid environment "${config.environment}". Must be: sandbox, production`);
  }

  if (!config.credentials || typeof config.credentials !== 'object') {
    throw new InvalidConfigError('credentials is required', config.provider);
  }

  for (const key of REQUIRED_CREDENTIALS[config.provider]) {
    const val = config.credentials[key];
    if (!val || typeof val !== 'string' || val.trim() === '') {
      throw new InvalidConfigError(`Missing credential: "${key}" is required for ${config.provider}`, config.provider);
    }
    // Detect placeholder/dummy credentials
    if (PLACEHOLDER_PATTERNS.test(val)) {
      throw new InvalidConfigError(
        `Credential "${key}" appears to be a placeholder ("${val.slice(0, 10)}..."). Use real credentials from your PSP dashboard.`,
        config.provider,
      );
    }
  }

  // Provider-specific format constraints
  if (config.provider === 'paytm') {
    const key = config.credentials['merchantKey'];
    // Paytm's checksum algorithm uses the first 16 chars of the key for AES-128-CBC.
    // Reject keys shorter than 16 chars — they will produce cryptic crypto errors at runtime.
    if (typeof key === 'string' && key.length < 16) {
      throw new InvalidConfigError(
        `Paytm merchantKey must be at least 16 characters. Received ${key.length} characters.`,
        'paytm',
      );
    }
  }

  if (config.provider === 'phonepe') {
    const saltIndex = config.credentials['saltIndex'];
    if (typeof saltIndex === 'string' && !SALT_INDEX_PATTERN.test(saltIndex)) {
      throw new InvalidConfigError(
        `PhonePe saltIndex must be a numeric string (e.g. "1"). Received: "${saltIndex}".`,
        'phonepe',
      );
    }
  }

  // Validate timeout if provided
  if (config.options?.timeout !== undefined) {
    if (typeof config.options.timeout !== 'number' || config.options.timeout < 1000 || config.options.timeout > 120000) {
      throw new InvalidConfigError('timeout must be between 1000ms and 120000ms');
    }
  }
}

// ─── Payment Request Validation ──────────────────────────────────────

/** Validate a payment creation request. */
export function validatePaymentRequest(req: CreatePaymentRequest, env: Environment): void {
  // Amount validation
  if (!req.amount || typeof req.amount !== 'number' || !Number.isInteger(req.amount) || req.amount <= 0) {
    throw new InvalidConfigError('amount must be a positive integer (paise). For ₹500, use 50000');
  }
  if (req.amount < MIN_AMOUNT_PAISE) {
    throw new InvalidConfigError(`amount must be at least ${MIN_AMOUNT_PAISE} paise (₹${MIN_AMOUNT_PAISE / 100})`);
  }
  if (req.amount > MAX_AMOUNT_PAISE) {
    throw new InvalidConfigError(`amount exceeds maximum of ${MAX_AMOUNT_PAISE} paise (₹${MAX_AMOUNT_PAISE / 100})`);
  }

  // Order ID validation (prevents injection attacks)
  validateOrderId(req.orderId);

  // Phone validation
  if (!req.customerPhone || !/^[6-9]\d{9}$/.test(req.customerPhone.replace(/[\s\-+]/g, '').replace(/^91/, ''))) {
    throw new InvalidConfigError('customerPhone must be a valid 10-digit Indian mobile number');
  }

  // URL validation
  if (!req.callbackUrl) {
    throw new InvalidConfigError('callbackUrl is required for webhook notifications');
  }
  if (!req.redirectUrl) {
    throw new InvalidConfigError('redirectUrl is required for post-payment redirect');
  }
  validateUrl(req.callbackUrl, 'callbackUrl', env);
  validateUrl(req.redirectUrl, 'redirectUrl', env);

  // Email validation (if provided)
  if (req.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.customerEmail)) {
    throw new InvalidConfigError('customerEmail is not a valid email address');
  }
}

// ─── UPI QR Validation ───────────────────────────────────────────────

/** Validate a UPI QR request. */
export function validateQRRequest(req: UPIQRRequest): void {
  if (!req.vpa || typeof req.vpa !== 'string' || !req.vpa.includes('@')) {
    throw new InvalidConfigError('vpa must be a valid UPI VPA (e.g., "business@ybl")');
  }
  // VPA format: alphanumeric + dots before @, provider handle after @
  if (!/^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+$/.test(req.vpa)) {
    throw new InvalidConfigError('vpa format is invalid. Expected: "name@provider" (e.g., "mybiz@ybl")');
  }
  if (!req.name || typeof req.name !== 'string' || req.name.trim() === '') {
    throw new InvalidConfigError('name (business name) is required');
  }
  if (req.name.length > 100) {
    throw new InvalidConfigError('name must be 100 characters or less');
  }
  if (!req.amount || typeof req.amount !== 'number' || req.amount <= 0) {
    throw new InvalidConfigError('amount must be a positive number in rupees (e.g., 500.00)');
  }
  if (req.amount > MAX_AMOUNT_PAISE / 100) {
    throw new InvalidConfigError(`amount exceeds maximum of ₹${MAX_AMOUNT_PAISE / 100}`);
  }
  if (!req.orderId || typeof req.orderId !== 'string' || req.orderId.trim() === '') {
    throw new InvalidConfigError('orderId is required for transaction tracking');
  }
  validateOrderId(req.orderId);
  // Sanitize note to prevent injection
  if (req.note && req.note.length > 255) {
    throw new InvalidConfigError('note must be 255 characters or less');
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Validate a URL — blocks dangerous schemes and enforces HTTPS in production */
function validateUrl(url: string, fieldName: string, env: Environment): void {
  // Trim before testing so whitespace-padded schemes do not bypass the regex anchor.
  const trimmedUrl = url.trim();
  if (DANGEROUS_SCHEMES.test(trimmedUrl)) {
    throw new InvalidConfigError(`${fieldName} contains a dangerous URL scheme. Only http:// and https:// are allowed`);
  }
  if (env === 'production' && !trimmedUrl.startsWith('https://')) {
    throw new InvalidConfigError(`${fieldName} must use HTTPS in production`);
  }
}

// ─── Shared Validators ─────────────────────────────────────────────────

/** Validate an orderId against injection patterns. Throws InvalidConfigError on invalid input. */
export function validateOrderId(orderId: string): void {
  if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
    throw new InvalidConfigError('orderId is required');
  }
  if (!ORDER_ID_PATTERN.test(orderId)) {
    throw new InvalidConfigError('orderId must be 1-128 characters, alphanumeric with hyphens/underscores/dots only');
  }
}

/** Validate that a PhonePe saltIndex is a simple numeric string (e.g. "1"). */
export function validateSaltIndex(saltIndex: string): void {
  if (!SALT_INDEX_PATTERN.test(saltIndex)) {
    throw new InvalidConfigError('saltIndex must be a numeric string (e.g., "1")');
  }
}

/**
 * Normalize an Indian phone number to a pure 10-digit numeric string.
 * Strips the country code prefix (+91 / 091), spaces, hyphens, and other
 * formatting characters so the value is safe for PSP API payloads.
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 13 && digits.startsWith('091')) {
    return digits.slice(3);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}
