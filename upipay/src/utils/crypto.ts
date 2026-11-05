// ============================================================================
// UPIPay — Cryptographic Utilities
// ============================================================================
// Secure HMAC/SHA for webhook verification. Node.js built-in crypto only.

import { createHash, createHmac, createCipheriv, createDecipheriv, timingSafeEqual, randomBytes } from 'node:crypto';

/**
 * HMAC-SHA256 hex digest.
 */
export function hmacSha256(data: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * SHA256 hex digest (used by PhonePe for checksum).
 */
export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Constant-time string comparison.
 *
 * Prevents timing-based side-channel attacks in webhook signature verification.
 * Both inputs are padded to the same buffer length before comparison so that
 * the CPU time taken does not vary with the length or content of either string.
 * The length equality check is performed after the constant-time operation to
 * avoid early returns that would leak length information.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  const maxLen = Math.max(bufA.length, bufB.length, 1); // at least 1 to avoid 0-length buffer

  // Pad both buffers to the same length (filled with 0)
  const paddedA = Buffer.alloc(maxLen);
  const paddedB = Buffer.alloc(maxLen);
  bufA.copy(paddedA);
  bufB.copy(paddedB);

  // Always perform constant-time comparison regardless of length
  const contentsEqual = timingSafeEqual(paddedA, paddedB);

  // Only return true if lengths also match (checked AFTER constant-time op)
  return bufA.length === bufB.length && contentsEqual;
}

/**
 * Check if a webhook timestamp is fresh (prevents replay attacks).
 * Supports Unix timestamps (seconds/milliseconds as number or string) and ISO date strings.
 */
export function isTimestampFresh(timestamp: number | string, toleranceSeconds = 300): boolean {
  // Reject non-scalar values — objects and arrays must never reach date parsing.
  if (typeof timestamp !== 'string' && typeof timestamp !== 'number') {
    return false;
  }

  let webhookTime: number;

  if (typeof timestamp === 'number') {
    webhookTime = timestamp;
  } else if (/^\d+$/.test(timestamp)) {
    webhookTime = parseInt(timestamp, 10);
  } else if (/^\d+\.\d+$/.test(timestamp)) {
    webhookTime = parseFloat(timestamp);
  } else {
    // Paytm callbacks send timestamps in "YYYY-MM-DD HH:mm:ss.S" format
    // without a timezone qualifier. These are implicitly in IST (UTC+05:30).
    // Append the offset so Date parsing is accurate regardless of the
    // server's local timezone configuration.
    const NAIVE_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/;
    let dateStr = timestamp;
    if (NAIVE_DATETIME_PATTERN.test(dateStr) && !/[+-]\d{2}:?\d{2}$/.test(dateStr) && !/Z$/i.test(dateStr)) {
      dateStr = dateStr.trimEnd() + ' +05:30';
    }
    webhookTime = new Date(dateStr).getTime() / 1000;
  }

  if (Number.isNaN(webhookTime) || !Number.isFinite(webhookTime)) {
    return false;
  }

  // Convert milliseconds to seconds if the value exceeds 99999999999 (Year 5138)
  if (webhookTime > 99999999999) {
    webhookTime = webhookTime / 1000;
  }

  return Math.abs(Math.floor(Date.now() / 1000) - webhookTime) <= toleranceSeconds;
}

// Paytm uses a static IV for AES-128-CBC across all language implementations
const PAYTM_IV = '@@@@&&&&####$$$$';

/**
 * Convert a parameter object to Paytm's pipe-delimited sorted string format.
 * Keys are sorted alphabetically and values joined with `|`.
 *
 * Null and undefined values are coerced to empty strings to preserve
 * positional alignment in the pipe-delimited output. This matches the
 * serialization behaviour of Paytm's official checksum library
 * (paytmchecksum / Paytm_Node_Checksum).
 *
 * Example: { B: '2', A: '1' }        → '1|2'
 * Example: { B: null, A: '1', C: 3 } → '1||3'
 */
export function getPaytmParamsString(params: Record<string, unknown>): string {
  return Object.keys(params)
    .sort()
    .map(key => {
      const val = params[key];
      // Coerce null/undefined to empty string to maintain positional integrity
      if (val === null || val === undefined) return '';
      return `${String(val)}`;
    })
    .join('|');
}

/**
 * Generate a Paytm checksum (signature) for a request body.
 *
 * Algorithm (from official Paytm_Node_Checksum):
 * 1. Generate a random 4-character alphanumeric salt
 * 2. SHA256( paramsString + "|" + salt )
 * 3. Concatenate: sha256Hash + salt
 * 4. AES-128-CBC encrypt with merchantKey (first 16 chars) and static IV
 */
export function generatePaytmChecksum(paramsString: string, merchantKey: string): string {
  const salt = randomBytes(4).toString('hex').slice(0, 4);
  const hash = createHash('sha256').update(paramsString + '|' + salt).digest('hex');
  const hashWithSalt = hash + salt;

  const key = merchantKey.slice(0, 16);
  const cipher = createCipheriv('aes-128-cbc', key, PAYTM_IV);
  let encrypted = cipher.update(hashWithSalt, 'binary', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

/**
 * Verify a Paytm checksum by decrypting it and re-computing the hash.
 *
 * Algorithm:
 * 1. AES-128-CBC decrypt the checksum to get hash+salt
 * 2. Extract salt (last 4 characters)
 * 3. Extract hash (everything before the salt)
 * 4. Recompute SHA256( paramsString + "|" + salt )
 * 5. Constant-time compare recomputed hash with decrypted hash
 */
export function verifyPaytmChecksum(paramsString: string, merchantKey: string, checksum: string): boolean {
  try {
    const key = merchantKey.slice(0, 16);
    const decipher = createDecipheriv('aes-128-cbc', key, PAYTM_IV);
    let decrypted = decipher.update(checksum, 'base64', 'binary');
    decrypted += decipher.final('binary');

    // The decrypted string is: SHA256_hex_hash (64 chars) + salt (4 chars)
    const salt = decrypted.slice(-4);
    const hash = decrypted.slice(0, -4);

    const expectedHash = createHash('sha256').update(paramsString + '|' + salt).digest('hex');
    return constantTimeEqual(hash, expectedHash);
  } catch {
    // Decryption failure = invalid checksum
    return false;
  }
}

/**
 * Deterministic JSON.stringify with sorted keys (recursive).
 * Ensures consistent serialization regardless of key insertion order.
 */
export function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => stableStringify(item)).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const parts = sortedKeys.map(key => {
    const val = (obj as Record<string, unknown>)[key];
    return JSON.stringify(key) + ':' + stableStringify(val);
  });
  return '{' + parts.join(',') + '}';
}

