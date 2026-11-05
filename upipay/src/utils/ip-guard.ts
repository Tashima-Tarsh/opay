// ============================================================================
// UPIPay — Webhook Origin Verification
// ============================================================================
// Express-compatible middleware that restricts webhook endpoints to requests
// originating from the PSP's published network ranges.
//
// Applying origin verification at the transport layer means that malformed
// requests are dropped before any HMAC computation takes place, reducing
// unnecessary CPU load under high-volume conditions.
//
// PSP IP ranges are sourced from official developer documentation:
//   PhonePe: https://developer.phonepe.com/v1/docs/webhook-handling
//   Paytm:   https://developer.paytm.com/docs/webhook
//
// Keep these ranges current whenever the PSP publishes updated network ranges.

/**
 * Minimal HTTP request shape compatible with Express, Fastify raw,
 * and any other framework that exposes a socket or `ip` property.
 */
export interface WebhookRequest {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Minimal HTTP response shape — only `status()` and `send()` are required.
 */
export interface WebhookResponse {
  status(code: number): WebhookResponse;
  send(body?: string): void;
}

type NextFunction = () => void;

// ─── PhonePe Published Ranges ────────────────────────────────────────
// Source: PhonePe Developer Portal → Webhook Handling → IP Allowlist
// Keep these current whenever PhonePe publishes updated network ranges.
const PHONEPE_ALLOWED_CIDRS: readonly string[] = [
  '163.53.76.0/24',
  '163.53.77.0/24',
  '163.53.78.0/24',
  '163.53.79.0/24',
  '103.125.24.0/24',
  '103.125.25.0/24',
  '103.116.34.16/29',
  '103.116.32.16/29',
  '103.116.33.8/30',
  '103.116.33.136/30',
  '103.116.34.0/24',
  '103.116.32.0/24',
  '103.116.33.0/24',
  '103.243.35.242/32',
];

// ─── Paytm Published Ranges ──────────────────────────────────────────
// Paytm does not officially publish guaranteed static webhook egress ranges.
// These are best-effort observations — pair with cryptographic verifyWebhook()
// for reliable production security rather than relying on IP filtering alone.
const PAYTM_ALLOWED_CIDRS: readonly string[] = [
  '103.58.196.0/24',
  '103.58.197.0/24',
  '103.58.198.0/24',
  '182.72.68.0/24',
];

// ─── CIDR Utility ────────────────────────────────────────────────────

/**
 * Convert a dotted-decimal IPv4 string to a 32-bit unsigned integer.
 * Returns NaN for invalid input so callers can reject gracefully.
 */
function ipv4ToInt(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return NaN;
  let result = 0;
  for (const part of parts) {
    const octet = parseInt(part, 10);
    if (Number.isNaN(octet) || octet < 0 || octet > 255) return NaN;
    result = (result << 8) | octet;
  }
  return result >>> 0; // Ensure unsigned 32-bit
}

/**
 * Returns true when `ip` falls within the given `cidr` block.
 * Handles only IPv4 CIDR notation (e.g. "163.53.76.0/24").
 * IPv6-mapped IPv4 addresses ("::ffff:x.x.x.x") are unwrapped before
 * comparison so that dual-stack servers resolve correctly.
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  // Unwrap IPv6-mapped IPv4 addresses produced by dual-stack listeners
  const cleanIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  const [networkStr, prefixStr] = cidr.split('/');
  if (networkStr === undefined || prefixStr === undefined) return false;

  const prefix = parseInt(prefixStr, 10);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const ipInt = ipv4ToInt(cleanIp);
  const networkInt = ipv4ToInt(networkStr);
  if (Number.isNaN(ipInt) || Number.isNaN(networkInt)) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

/**
 * Returns true when `ip` matches any CIDR in the provided list.
 */
function isAllowed(ip: string, cidrs: readonly string[]): boolean {
  for (const cidr of cidrs) {
    if (isIpInCidr(ip, cidr)) return true;
  }
  return false;
}

/**
 * Resolve the originating IP from the request object.
 *
 * When `trustProxy` is true the *rightmost* (last) entry in the
 * `X-Forwarded-For` chain is used — this is the IP appended by the
 * trusted reverse proxy closest to the application server. The leftmost
 * entry is client-controlled and must never be used for access decisions.
 *
 * If the framework (e.g. Express with `trust proxy` configured) has already
 * resolved `req.ip`, that value takes priority over manual header parsing.
 *
 * When `trustProxy` is false (default), the direct socket address is used.
 */
function resolveIp(req: WebhookRequest, trustProxy: boolean): string | undefined {
  // Prefer the framework-resolved IP — Express sets this correctly when
  // `app.set('trust proxy', n)` is configured with the right hop count.
  if (req.ip) {
    return req.ip;
  }

  if (trustProxy) {
    const xff = req.headers?.['x-forwarded-for'];
    if (xff) {
      // Rightmost entry is appended by the trusted proxy closest to the server.
      // The leftmost entry is client-supplied and trivially spoofable.
      const parts = Array.isArray(xff) ? xff : xff.split(',');
      const last = parts[parts.length - 1];
      return last?.trim();
    }
  }
  return req.socket?.remoteAddress;
}

// ─── Guard Factory Options ───────────────────────────────────────────

export interface WebhookGuardOptions {
  /**
   * Additional CIDR ranges to allow alongside the PSP defaults.
   * Useful for including your own staging egress IPs during QA.
   */
  additionalCidrs?: string[];

  /**
   * Set to `true` only when your application runs behind a trusted reverse
   * proxy (Nginx, AWS ALB, Cloudflare, etc.) that **strips or overwrites**
   * client-supplied `X-Forwarded-For` headers before they reach Node.js.
   *
   * If your server is exposed **directly to the internet** without a proxy,
   * a client can forge `X-Forwarded-For: 163.53.76.10` (a valid PhonePe IP)
   * and bypass the guard. Only enable this when you are certain the proxy
   * controls which headers are forwarded.
   *
   * @default false
   */
  trustProxy?: boolean;

  /**
   * Custom handler invoked when the origin IP is not in any allowed range.
   * Use this to add audit logging or metric tracking.
   * The default handler responds with HTTP 403 and no body.
   */
  onBlocked?: (ip: string | undefined, req: WebhookRequest, res: WebhookResponse) => void;
}

// ─── Guard Factories ─────────────────────────────────────────────────

/**
 * Returns an Express-compatible middleware that only passes requests
 * originating from PhonePe's published webhook egress IP ranges.
 *
 * Place this middleware **before** `express.raw()` and `verifyWebhook()`
 * so that unrecognised origins are dropped at the transport layer.
 *
 * @example
 * ```typescript
 * import { createPhonePeWebhookGuard } from 'upipay';
 *
 * const guard = createPhonePeWebhookGuard({ trustProxy: true });
 * app.post('/api/webhook', guard, express.raw({ type: '*\/*' }), handler);
 * ```
 */
export function createPhonePeWebhookGuard(
  options: WebhookGuardOptions = {},
): (req: WebhookRequest, res: WebhookResponse, next: NextFunction) => void {
  const { additionalCidrs = [], trustProxy = false, onBlocked } = options;
  const cidrs = [...PHONEPE_ALLOWED_CIDRS, ...additionalCidrs];

  return function phonePeWebhookGuard(req, res, next) {
    const ip = resolveIp(req, trustProxy);

    if (ip && isAllowed(ip, cidrs)) {
      next();
      return;
    }

    if (onBlocked) {
      onBlocked(ip, req, res);
    } else {
      res.status(403).send();
    }
  };
}

/**
 * Returns an Express-compatible middleware that only passes requests
 * originating from Paytm's known webhook egress IP ranges.
 *
 * Paytm does not publish guaranteed static IP ranges, so this guard is
 * an optional defence-in-depth layer. Always combine it with cryptographic
 * checksum verification via `verifyWebhook()` and a `checkStatus()` call
 * for authoritative confirmation. Use `additionalCidrs` to extend the list
 * if Paytm adds new ranges.
 *
 * @example
 * ```typescript
 * import { createPaytmWebhookGuard } from 'upipay';
 *
 * const guard = createPaytmWebhookGuard({ trustProxy: true });
 * app.post('/api/webhook', guard, express.raw({ type: '*\/*' }), handler);
 * ```
 */
export function createPaytmWebhookGuard(
  options: WebhookGuardOptions = {},
): (req: WebhookRequest, res: WebhookResponse, next: NextFunction) => void {
  const { additionalCidrs = [], trustProxy = false, onBlocked } = options;
  const cidrs = [...PAYTM_ALLOWED_CIDRS, ...additionalCidrs];

  return function paytmWebhookGuard(req, res, next) {
    const ip = resolveIp(req, trustProxy);

    if (ip && isAllowed(ip, cidrs)) {
      next();
      return;
    }

    if (onBlocked) {
      onBlocked(ip, req, res);
    } else {
      res.status(403).send();
    }
  };
}

// ─── Low-Level Helpers (exported for testing) ────────────────────────

export { isIpInCidr, isAllowed, resolveIp, PHONEPE_ALLOWED_CIDRS, PAYTM_ALLOWED_CIDRS };
