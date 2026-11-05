// ============================================================================
// UPIPay — Logger with Secret Masking
// ============================================================================

import type { LogLevel, UPIPayOptions } from '../types.js';

const SENSITIVE_KEYS = new Set([
  'saltkey', 'merchantkey', 'secret', 'password', 'token', 'apikey', 'salt',
]);

function isSensitive(key: string): boolean {
  const k = key.toLowerCase().replace(/[_\-.\s]/g, '');
  return SENSITIVE_KEYS.has(k) || k.includes('secret') || k.includes('password') || k.includes('key');
}

function mask(value: string): string {
  return value.length < 12 ? '***REDACTED***' : `${value.slice(0, 4)}${'*'.repeat(Math.min(value.length - 8, 16))}${value.slice(-4)}`;
}

export function maskSecrets(data: unknown): unknown {
  if (data === null || data === undefined || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(maskSecrets);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (isSensitive(k) && typeof v === 'string') out[k] = mask(v);
    else if (typeof v === 'object' && v !== null) out[k] = maskSecrets(v);
    else out[k] = v;
  }
  return out;
}

export class Logger {
  private readonly enabled: boolean;
  private readonly custom?: UPIPayOptions['logger'];

  constructor(options?: UPIPayOptions) {
    this.enabled = options?.debug ?? false;
    this.custom = options?.logger;
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.enabled && level !== 'warn' && level !== 'error') return;
    const masked = data ? (maskSecrets(data) as Record<string, unknown>) : undefined;
    if (this.custom) { this.custom(level, message, masked); return; }
    const prefix = `${new Date().toISOString()} [UPIPay]:${level.toUpperCase()}`;
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(`${prefix} ${message}`, masked ?? '');
  }

  debug(msg: string, data?: Record<string, unknown>) { this.log('debug', msg, data); }
  info(msg: string, data?: Record<string, unknown>) { this.log('info', msg, data); }
  warn(msg: string, data?: Record<string, unknown>) { this.log('warn', msg, data); }
  error(msg: string, data?: Record<string, unknown>) { this.log('error', msg, data); }
}
