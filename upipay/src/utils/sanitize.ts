// ============================================================================
// UPIPay — PSP Error Body Sanitisation
// ============================================================================
// Transforms raw upstream error payloads into safe, bounded strings before
// they are surfaced in thrown errors or forwarded to logging systems.
//
// Only scalar `message` and `code` properties from the PSP JSON response are
// retained. All other fields — which may carry internal routing details,
// partial credential echoes, or structured diagnostics — are discarded.
// If the body is not parseable JSON, a generic upstream-error string is
// returned so that no raw content enters the application error layer.

/** Known safe scalar fields to surface from PSP error JSON responses. */
const SAFE_FIELDS = ['message', 'code', 'resultMsg', 'resultCode', 'description'] as const;

/**
 * Extracts human-readable diagnostic text from a raw PSP error response body.
 *
 * @param rawBody  - The raw HTTP response body text from the upstream PSP call.
 * @param maxLength - Maximum character length of the returned string (default 150).
 * @returns A safe, bounded string suitable for inclusion in thrown errors or logs.
 *
 * @example
 * ```typescript
 * // raw body: '{"code":"PAYMENT_FAILED","message":"Insufficient funds","internalTrace":"abc123..."}'
 * sanitizePspError(rawBody);
 * // → 'PAYMENT_FAILED — Insufficient funds'
 * ```
 */
export function sanitizePspError(rawBody: string, maxLength = 150): string {
  if (!rawBody || typeof rawBody !== 'string') {
    return 'Upstream provider returned an unreadable response.';
  }

  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;

    // Walk top-level and one level of nesting (e.g. body.resultInfo for Paytm)
    const candidates: Record<string, unknown>[] = [parsed];
    for (const val of Object.values(parsed)) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        candidates.push(val as Record<string, unknown>);
      }
    }

    const parts: string[] = [];
    for (const obj of candidates) {
      for (const field of SAFE_FIELDS) {
        const val = obj[field];
        if (typeof val === 'string' && val.trim() !== '') {
          const trimmed = val.trim();
          if (!parts.includes(trimmed)) {
            parts.push(trimmed);
          }
        }
      }
    }

    if (parts.length === 0) {
      return 'Upstream provider returned an error response.';
    }

    const joined = parts.join(' — ');
    return joined.length > maxLength ? joined.slice(0, maxLength) : joined;
  } catch {
    // Body is not JSON — return a generic string without surfacing raw content
    return 'Upstream provider returned an unrecognised error response.';
  }
}
