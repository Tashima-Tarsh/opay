// ============================================================================
// UPIPay — Security Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { hmacSha256, sha256, constantTimeEqual, isTimestampFresh, stableStringify, generatePaytmChecksum, verifyPaytmChecksum, getPaytmParamsString } from '../src/utils/crypto';
import { maskSecrets, Logger } from '../src/utils/logger';
import { validateConfig, validatePaymentRequest, validateQRRequest, validateOrderId, validateSaltIndex } from '../src/utils/validation';
import { PhonePeAdapter } from '../src/adapters/phonepe';
import { PaytmAdapter } from '../src/adapters/paytm';
import { InvalidConfigError } from '../src/errors';
import { UPIPay } from '../src/client';
import { rupeesToPaise } from '../src/utils/currency';

// ─── Crypto ──────────────────────────────────────────────────────────

describe('hmacSha256', () => {
  it('should generate correct HMAC-SHA256', () => {
    expect(hmacSha256('hello', 'secret'))
      .toBe('88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b');
  });

  it('should handle Buffer input', () => {
    expect(hmacSha256(Buffer.from('hello'), 'secret'))
      .toBe('88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b');
  });
});

describe('sha256', () => {
  it('should generate correct SHA256', () => {
    expect(sha256('hello'))
      .toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});

describe('constantTimeEqual', () => {
  it('returns true for equal strings', () => expect(constantTimeEqual('abc', 'abc')).toBe(true));
  it('returns false for different strings', () => expect(constantTimeEqual('abc', 'def')).toBe(false));
  it('returns false for different lengths', () => expect(constantTimeEqual('abc', 'abcd')).toBe(false));
  it('handles empty strings', () => expect(constantTimeEqual('', '')).toBe(true));
  it('handles unicode', () => {
    expect(constantTimeEqual('hello 🌍', 'hello 🌍')).toBe(true);
    expect(constantTimeEqual('hello 🌍', 'hello 🌎')).toBe(false);
  });
  // Verify that two strings of different lengths are not considered equal.
  // This catches the edge case where padding is applied but length is ignored.
  it('returns false for strings with same content but different lengths', () => {
    expect(constantTimeEqual('abc', 'abc\0')).toBe(false);
  });
});

describe('stableStringify', () => {
  it('sorts keys deterministically', () => {
    const obj1 = { b: 2, a: 1, c: 3 };
    const obj2 = { c: 3, a: 1, b: 2 };
    expect(stableStringify(obj1)).toBe(stableStringify(obj2));
  });

  it('handles nested objects', () => {
    const obj = { z: { b: 2, a: 1 }, a: 'hello' };
    expect(stableStringify(obj)).toBe('{"a":"hello","z":{"a":1,"b":2}}');
  });

  it('handles arrays', () => {
    const obj = { b: [3, 1, 2], a: 'x' };
    expect(stableStringify(obj)).toBe('{"a":"x","b":[3,1,2]}');
  });

  it('handles null and undefined', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(undefined)).toBe(undefined as any);
  });
});

describe('Paytm AES-128-CBC Checksum', () => {
  const merchantKey = '1234567890123456'; // 16-char key for AES-128

  it('generates and verifies checksum roundtrip', () => {
    const params = { ORDERID: 'o123', MID: 'M123', TXNAMOUNT: '500.00' };
    const paramsString = getPaytmParamsString(params);
    const checksum = generatePaytmChecksum(paramsString, merchantKey);
    expect(verifyPaytmChecksum(paramsString, merchantKey, checksum)).toBe(true);
  });

  it('produces consistent verification regardless of key order', () => {
    const data1 = { ORDERID: 'o123', MID: 'M123', TXNAMOUNT: '500.00' };
    const data2 = { TXNAMOUNT: '500.00', ORDERID: 'o123', MID: 'M123' };
    // getPaytmParamsString sorts keys, so both should produce identical strings
    expect(getPaytmParamsString(data1)).toBe(getPaytmParamsString(data2));
  });

  it('rejects wrong merchant key', () => {
    const params = { ORDERID: 'o123', MID: 'M123' };
    const paramsString = getPaytmParamsString(params);
    const checksum = generatePaytmChecksum(paramsString, merchantKey);
    expect(verifyPaytmChecksum(paramsString, 'wrong-key-1234567', checksum)).toBe(false);
  });

  it('rejects tampered params', () => {
    const params = { ORDERID: 'o123', MID: 'M123' };
    const paramsString = getPaytmParamsString(params);
    const checksum = generatePaytmChecksum(paramsString, merchantKey);
    const tamperedParams = getPaytmParamsString({ ORDERID: 'o999', MID: 'M123' });
    expect(verifyPaytmChecksum(tamperedParams, merchantKey, checksum)).toBe(false);
  });

  it('rejects invalid base64 checksum', () => {
    expect(verifyPaytmChecksum('test', merchantKey, 'not-base64!!')).toBe(false);
  });
});

describe('getPaytmParamsString null/undefined handling', () => {
  it('coerces null values to empty strings, preserving positional alignment', () => {
    const params = { A: '1', B: null, C: '3' };
    // B must appear as an empty segment between A and C
    expect(getPaytmParamsString(params)).toBe('1||3');
  });

  it('coerces undefined values to empty strings', () => {
    const params = { A: '1', B: undefined, C: '3' };
    expect(getPaytmParamsString(params)).toBe('1||3');
  });

  it('generates and verifies checksums with null parameters in roundtrip', () => {
    const merchantKey = '1234567890123456';
    const params = { ORDERID: 'o123', MID: 'M123', REFUNDAMT: null };
    const paramsString = getPaytmParamsString(params);
    const checksum = generatePaytmChecksum(paramsString, merchantKey);
    expect(verifyPaytmChecksum(paramsString, merchantKey, checksum)).toBe(true);
  });
});

describe('isTimestampFresh', () => {
  it('accepts fresh timestamp', () => expect(isTimestampFresh(Math.floor(Date.now() / 1000))).toBe(true));
  it('rejects old timestamp', () => expect(isTimestampFresh(Math.floor(Date.now() / 1000) - 600, 300)).toBe(false));
  it('rejects future timestamp', () => expect(isTimestampFresh(Math.floor(Date.now() / 1000) + 600, 300)).toBe(false));

  it('handles numeric string timestamps', () => {
    expect(isTimestampFresh(String(Math.floor(Date.now() / 1000)))).toBe(true);
    expect(isTimestampFresh(String(Math.floor(Date.now() / 1000) - 600))).toBe(false);
  });
  
  it('handles millisecond timestamps', () => {
    expect(isTimestampFresh(Date.now())).toBe(true);
    expect(isTimestampFresh(Date.now() - 600000)).toBe(false);
    expect(isTimestampFresh(String(Date.now()))).toBe(true);
  });

  it('rejects invalid date strings', () => {
    expect(isTimestampFresh('invalid-date')).toBe(false);
  });
});

// ─── Input Injection Prevention ──────────────────────────────────────

describe('Order ID Injection Prevention', () => {
  it('accepts valid orderId', () => {
    expect(() => validatePaymentRequest({
      amount: 50000, orderId: 'order_123-abc.456', customerPhone: '9876543210',
      callbackUrl: 'http://localhost/cb', redirectUrl: 'http://localhost/done',
    }, 'sandbox')).not.toThrow();
  });

  it('rejects SQL injection in orderId', () => {
    expect(() => validatePaymentRequest({
      amount: 50000, orderId: "order'; DROP TABLE payments;--", customerPhone: '9876543210',
      callbackUrl: 'http://localhost/cb', redirectUrl: 'http://localhost/done',
    }, 'sandbox')).toThrow(InvalidConfigError);
  });

  it('rejects XSS in orderId', () => {
    expect(() => validatePaymentRequest({
      amount: 50000, orderId: '<script>alert(1)</script>', customerPhone: '9876543210',
      callbackUrl: 'http://localhost/cb', redirectUrl: 'http://localhost/done',
    }, 'sandbox')).toThrow(InvalidConfigError);
  });

  it('rejects path traversal in orderId', () => {
    expect(() => validatePaymentRequest({
      amount: 50000, orderId: '../../etc/passwd', customerPhone: '9876543210',
      callbackUrl: 'http://localhost/cb', redirectUrl: 'http://localhost/done',
    }, 'sandbox')).toThrow(InvalidConfigError);
  });
});

describe('validateOrderId (standalone)', () => {
  it('accepts valid orderId', () => {
    expect(() => validateOrderId('order_123')).not.toThrow();
    expect(() => validateOrderId('abc-def.ghi')).not.toThrow();
  });

  it('rejects empty orderId', () => {
    expect(() => validateOrderId('')).toThrow(InvalidConfigError);
  });

  it('rejects injection characters', () => {
    expect(() => validateOrderId('order"; DROP TABLE--')).toThrow(InvalidConfigError);
    expect(() => validateOrderId('../../etc/passwd')).toThrow(InvalidConfigError);
  });
});

describe('validateSaltIndex', () => {
  it('accepts valid numeric salt index', () => {
    expect(() => validateSaltIndex('1')).not.toThrow();
    expect(() => validateSaltIndex('2')).not.toThrow();
    expect(() => validateSaltIndex('123')).not.toThrow();
  });

  it('rejects non-numeric salt index', () => {
    expect(() => validateSaltIndex('###2')).toThrow(InvalidConfigError);
    expect(() => validateSaltIndex('abc')).toThrow(InvalidConfigError);
    expect(() => validateSaltIndex('')).toThrow(InvalidConfigError);
  });
});

describe('URL Scheme Injection Prevention', () => {
  it('rejects javascript: URLs', () => {
    expect(() => validatePaymentRequest({
      amount: 50000, orderId: 'order_1', customerPhone: '9876543210',
      callbackUrl: 'javascript:alert(document.cookie)', redirectUrl: 'http://localhost',
    }, 'sandbox')).toThrow(/dangerous/);
  });

  it('rejects data: URLs', () => {
    expect(() => validatePaymentRequest({
      amount: 50000, orderId: 'order_1', customerPhone: '9876543210',
      callbackUrl: 'http://localhost', redirectUrl: 'data:text/html,<script>',
    }, 'sandbox')).toThrow(/dangerous/);
  });
});

describe('Amount Range Validation', () => {
  it('rejects amount below ₹1 (100 paise)', () => {
    expect(() => validatePaymentRequest({
      amount: 50, orderId: 'order_1', customerPhone: '9876543210',
      callbackUrl: 'http://localhost/cb', redirectUrl: 'http://localhost/done',
    }, 'sandbox')).toThrow(/at least/);
  });

  it('rejects amount above limit', () => {
    expect(() => validatePaymentRequest({
      amount: 200_000_000, orderId: 'order_1', customerPhone: '9876543210',
      callbackUrl: 'http://localhost/cb', redirectUrl: 'http://localhost/done',
    }, 'sandbox')).toThrow(/exceeds maximum/);
  });
});

describe('Placeholder Credential Detection', () => {
  it('rejects placeholder saltKey', () => {
    expect(() => validateConfig({
      provider: 'phonepe', environment: 'sandbox',
      credentials: { merchantId: 'MERCHANT123', saltKey: 'your_salt_key', saltIndex: '1' },
    })).toThrow(/placeholder/i);
  });

  it('rejects placeholder merchantKey', () => {
    expect(() => validateConfig({
      provider: 'paytm', environment: 'sandbox',
      credentials: { merchantId: 'MERCHANT123', merchantKey: 'test_key_here' },
    })).toThrow(/placeholder/i);
  });
});

describe('VPA Format Validation', () => {
  it('accepts valid VPAs', () => {
    expect(() => validateQRRequest({ vpa: 'mybiz@ybl', name: 'Biz', amount: 100, orderId: 'o1' })).not.toThrow();
    expect(() => validateQRRequest({ vpa: 'shop.name@paytm', name: 'Shop', amount: 50, orderId: 'o2' })).not.toThrow();
  });

  it('rejects VPA without @', () => {
    expect(() => validateQRRequest({ vpa: 'invalid', name: 'Biz', amount: 100, orderId: 'o1' })).toThrow();
  });

  it('rejects VPA with special chars', () => {
    expect(() => validateQRRequest({ vpa: 'biz@ybl<script>', name: 'Biz', amount: 100, orderId: 'o1' })).toThrow();
  });
});

// ─── Secret Masking ──────────────────────────────────────────────────

describe('maskSecrets', () => {
  it('masks salt keys', () => {
    const r = maskSecrets({ saltKey: 'super-secret-salt-key-1234' }) as Record<string, string>;
    expect(r.saltKey).toContain('*');
  });

  it('masks merchant keys', () => {
    const r = maskSecrets({ merchantKey: 'paytm-merchant-key-test' }) as Record<string, string>;
    expect(r.merchantKey).toContain('*');
  });

  it('preserves non-sensitive data', () => {
    const r = maskSecrets({ orderId: 'order_123', amount: 500 }) as Record<string, unknown>;
    expect(r.orderId).toBe('order_123');
    expect(r.amount).toBe(500);
  });

  it('handles null/undefined', () => {
    expect(maskSecrets(null)).toBeNull();
    expect(maskSecrets(undefined)).toBeUndefined();
  });
});

describe('Logger', () => {
  it('does not log debug/info in non-debug mode', () => {
    const logs: string[] = [];
    const logger = new Logger({ debug: false, logger: (level, msg) => logs.push(`${level}: ${msg}`) });
    logger.debug('secret'); logger.info('info');
    expect(logs).toHaveLength(0);
  });

  it('always logs warnings and errors', () => {
    const logs: string[] = [];
    const logger = new Logger({ debug: false, logger: (level, msg) => logs.push(`${level}: ${msg}`) });
    logger.warn('warning'); logger.error('error');
    expect(logs).toHaveLength(2);
  });

  it('masks secrets in log data', () => {
    const data: Record<string, unknown>[] = [];
    const logger = new Logger({ debug: true, logger: (_l, _m, d) => { if (d) data.push(d); } });
    logger.debug('test', { saltKey: 'very-secret-salt-key-12345' });
    expect((data[0] as Record<string, string>).saltKey).toContain('*');
  });
});

// ─── Webhook Verification ────────────────────────────────────────────

describe('PhonePe Webhook Verification', () => {
  const adapter = new PhonePeAdapter(
    { merchantId: 'MERCHANT_TEST', saltKey: 'ab1c2d3e-salt-key-12345', saltIndex: '1' },
    'sandbox',
  );

  it('rejects invalid signature', () => {
    const event = adapter.verifyWebhook('{"test":"data"}', 'wrong', { enableReplayProtection: false });
    expect(event.verified).toBe(false);
  });

  it('handles Buffer payloads', () => {
    const event = adapter.verifyWebhook(Buffer.from('test'), 'wrong', { enableReplayProtection: false });
    expect(event.verified).toBe(false);
  });

  it('rejects null/undefined signature', () => {
    const event = adapter.verifyWebhook('test', null as any, { enableReplayProtection: false });
    expect(event.verified).toBe(false);
  });

  it('rejects undefined signature', () => {
    const event = adapter.verifyWebhook('test', undefined as any, { enableReplayProtection: false });
    expect(event.verified).toBe(false);
  });
});

describe('Paytm Webhook Verification', () => {
  const adapter = new PaytmAdapter(
    { merchantId: 'TEST_MID', merchantKey: 'ab1c2d3e-merchant-key-12345' },
    'sandbox',
  );

  it('rejects invalid signature', () => {
    const event = adapter.verifyWebhook('{"ORDERID":"o1"}', 'wrong', { enableReplayProtection: false });
    expect(event.verified).toBe(false);
  });

  it('rejects null signature', () => {
    const event = adapter.verifyWebhook('{"ORDERID":"o1"}', null as any, { enableReplayProtection: false });
    expect(event.verified).toBe(false);
  });
});

describe('Adapter Initialisation', () => {
  it('PhonePe', () => {
    const a = new PhonePeAdapter({ merchantId: 'M', saltKey: 'salt-key-12345', saltIndex: '1' }, 'sandbox');
    expect(a.provider).toBe('phonepe');
  });
  it('Paytm', () => {
    const a = new PaytmAdapter({ merchantId: 'M', merchantKey: 'merchant-key-12345' }, 'sandbox');
    expect(a.provider).toBe('paytm');
  });

  it('PhonePe rejects a non-numeric saltIndex', () => {
    expect(() => new PhonePeAdapter({ merchantId: 'M', saltKey: 'salt-key-12345', saltIndex: '###2' }, 'sandbox'))
      .toThrow(InvalidConfigError);
  });
});

// ─── rupeesToPaise ───────────────────────────────────────────────────

describe('rupeesToPaise', () => {
  it('safely converts rupees to paise', () => {
    expect(rupeesToPaise(5.99)).toBe(599);
    expect(rupeesToPaise(10)).toBe(1000);
    expect(rupeesToPaise(0.01)).toBe(1);
    expect(rupeesToPaise(100000.03)).toBe(10000003);
  });

  it('throws TypeError for non-numbers', () => {
    expect(() => rupeesToPaise('10' as any)).toThrow(TypeError);
    expect(() => rupeesToPaise(NaN)).toThrow(TypeError);
  });

  it('throws RangeError for zero or negative numbers', () => {
    expect(() => rupeesToPaise(0)).toThrow(RangeError);
    expect(() => rupeesToPaise(-5)).toThrow(RangeError);
  });
});

// ─── Browser/ReactNative Runtime Guard ─────────────────────────────────

describe('Browser/ReactNative Runtime Guard', () => {
  it('throws when window is defined (browser environment)', () => {
    Object.defineProperty(globalThis, 'window', {
      value: { document: {} },
      configurable: true,
      writable: true,
    });
    expect(() => new UPIPay({
      provider: 'phonepe',
      environment: 'sandbox',
      credentials: { merchantId: 'MERCHANT_TEST', saltKey: 'ab1c2d3e-salt-key-12345', saltIndex: '1' }
    })).toThrow(InvalidConfigError);
    delete (globalThis as any).window;
  });

  it('throws when navigator.product is ReactNative', () => {
    const originalNavigator = (globalThis as any).navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: { product: 'ReactNative' },
      configurable: true,
      writable: true,
    });
    expect(() => new UPIPay({
      provider: 'phonepe',
      environment: 'sandbox',
      credentials: { merchantId: 'MERCHANT_TEST', saltKey: 'ab1c2d3e-salt-key-12345', saltIndex: '1' }
    })).toThrow(InvalidConfigError);
    
    if (originalNavigator === undefined) {
      delete (globalThis as any).navigator;
    } else {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    }
  });
});

// ─── Webhook Replay Protection ─────────────────────────────────────────

describe('PhonePe Webhook Replay Protection', () => {
  const adapter = new PhonePeAdapter(
    { merchantId: 'MERCHANT_TEST', saltKey: 'ab1c2d3e-salt-key-12345', saltIndex: '1' },
    'sandbox',
  );

  it('accepts fresh timestamp', () => {
    const payload = JSON.stringify({ timestamp: Math.floor(Date.now() / 1000) });
    const payloadB64 = Buffer.from(payload).toString('base64');
    const checksum = sha256(payloadB64 + 'ab1c2d3e-salt-key-12345') + '###1';
    
    const event = adapter.verifyWebhook(payloadB64, checksum, { enableReplayProtection: true });
    expect(event.verified).toBe(true);
  });

  it('rejects stale timestamp', () => {
    const payload = JSON.stringify({ timestamp: Math.floor(Date.now() / 1000) - 600 });
    const payloadB64 = Buffer.from(payload).toString('base64');
    const checksum = sha256(payloadB64 + 'ab1c2d3e-salt-key-12345') + '###1';

    const event = adapter.verifyWebhook(payloadB64, checksum, { enableReplayProtection: true });
    expect(event.verified).toBe(false);
  });

  it('passes without timestamp when replay protection is off by default', () => {
    const payload = JSON.stringify({ message: 'no timestamp' });
    const payloadB64 = Buffer.from(payload).toString('base64');
    const checksum = sha256(payloadB64 + 'ab1c2d3e-salt-key-12345') + '###1';

    // Default behavior (no options) — replay protection is OFF
    const event = adapter.verifyWebhook(payloadB64, checksum);
    expect(event.verified).toBe(true);
  });

  it('allows skipping replay protection when explicitly disabled', () => {
    const payload = JSON.stringify({ message: 'no timestamp' });
    const payloadB64 = Buffer.from(payload).toString('base64');
    const checksum = sha256(payloadB64 + 'ab1c2d3e-salt-key-12345') + '###1';

    const event = adapter.verifyWebhook(payloadB64, checksum, { enableReplayProtection: false });
    expect(event.verified).toBe(true);
  });
  
  it('accepts explicit fresh timestamp in options', () => {
    const payloadB64 = Buffer.from('test-payload').toString('base64');
    const checksum = sha256(payloadB64 + 'ab1c2d3e-salt-key-12345') + '###1';

    const event = adapter.verifyWebhook(payloadB64, checksum, {
      enableReplayProtection: true,
      timestamp: Math.floor(Date.now() / 1000)
    });
    expect(event.verified).toBe(true);
  });

  it('returns parsed WebhookEvent with orderId and amount', () => {
    const payloadData = {
      code: 'PAYMENT_SUCCESS',
      data: {
        merchantTransactionId: 'order_xyz',
        transactionId: 'txn_abc',
        amount: 50000,
      },
      timestamp: Math.floor(Date.now() / 1000),
    };
    const payload = JSON.stringify(payloadData);
    const payloadB64 = Buffer.from(payload).toString('base64');
    const checksum = sha256(payloadB64 + 'ab1c2d3e-salt-key-12345') + '###1';

    const event = adapter.verifyWebhook(payloadB64, checksum, { enableReplayProtection: true });
    expect(event.verified).toBe(true);
    expect(event.status).toBe('SUCCESS');
    expect(event.orderId).toBe('order_xyz');
    expect(event.transactionId).toBe('txn_abc');
    expect(event.amount).toBe(50000);
  });
});

describe('Paytm Webhook Replay Protection', () => {
  // Paytm AES requires a 16-char key (first 16 chars used for AES-128)
  const merchantKey = 'ab1c2d3eKey12345';
  const adapter = new PaytmAdapter(
    { merchantId: 'TEST_MID', merchantKey },
    'sandbox',
  );

  it('accepts fresh timestamp', () => {
    const now = new Date().toISOString();
    const data = { ORDERID: 'o123', TXNDATE: now };
    const paramsString = getPaytmParamsString(data);
    const checksum = generatePaytmChecksum(paramsString, merchantKey);
    const payload = JSON.stringify({ ...data, CHECKSUMHASH: checksum });

    const event = adapter.verifyWebhook(payload, checksum, { enableReplayProtection: true });
    expect(event.verified).toBe(true);
  });

  it('rejects stale timestamp', () => {
    const oldDate = new Date(Date.now() - 600000).toISOString();
    const data = { ORDERID: 'o123', TXNDATE: oldDate };
    const paramsString = getPaytmParamsString(data);
    const checksum = generatePaytmChecksum(paramsString, merchantKey);
    const payload = JSON.stringify({ ...data, CHECKSUMHASH: checksum });

    const event = adapter.verifyWebhook(payload, checksum, { enableReplayProtection: true });
    expect(event.verified).toBe(false);
  });

  it('returns WebhookEvent with orderId', () => {
    const now = new Date().toISOString();
    const data = { ORDERID: 'o_test_456', TXNDATE: now, STATUS: 'TXN_SUCCESS', TXNAMOUNT: '500.00' };
    const paramsString = getPaytmParamsString(data);
    const checksum = generatePaytmChecksum(paramsString, merchantKey);
    const payload = JSON.stringify({ ...data, CHECKSUMHASH: checksum });

    const event = adapter.verifyWebhook(payload, checksum, { enableReplayProtection: true });
    expect(event.verified).toBe(true);
    expect(event.orderId).toBe('o_test_456');
  });

  it('maps TXN_FAILURE status correctly (does not promote to SUCCESS)', () => {
    const now = new Date().toISOString();
    const data = { ORDERID: 'o_fail_789', TXNDATE: now, STATUS: 'TXN_FAILURE', TXNAMOUNT: '500.00' };
    const paramsString = getPaytmParamsString(data);
    const checksum = generatePaytmChecksum(paramsString, merchantKey);
    const payload = JSON.stringify({ ...data, CHECKSUMHASH: checksum });

    const event = adapter.verifyWebhook(payload, checksum, { enableReplayProtection: true });
    expect(event.verified).toBe(true);
    expect(event.status).toBe('FAILED');
    expect(event.orderId).toBe('o_fail_789');
  });

  it('maps PENDING status correctly', () => {
    const now = new Date().toISOString();
    const data = { ORDERID: 'o_pend_101', TXNDATE: now, STATUS: 'PENDING', TXNAMOUNT: '200.00' };
    const paramsString = getPaytmParamsString(data);
    const checksum = generatePaytmChecksum(paramsString, merchantKey);
    const payload = JSON.stringify({ ...data, CHECKSUMHASH: checksum });

    const event = adapter.verifyWebhook(payload, checksum, { enableReplayProtection: true });
    expect(event.verified).toBe(true);
    expect(event.status).toBe('PENDING');
  });
});

// ─── PhonePe Webhook JSON Envelope Handling ─────────────────────────

describe('PhonePe Webhook JSON Envelope', () => {
  const adapter = new PhonePeAdapter(
    { merchantId: 'MERCHANT_TEST', saltKey: 'ab1c2d3e-salt-key-12345', saltIndex: '1' },
    'sandbox',
  );

  it('verifies webhook when payload is wrapped in {"response":"..."}', () => {
    const payloadData = {
      code: 'PAYMENT_SUCCESS',
      data: {
        merchantTransactionId: 'order_wrap_test',
        transactionId: 'txn_wrap',
        amount: 50000,
      },
      timestamp: Math.floor(Date.now() / 1000),
    };
    const base64Response = Buffer.from(JSON.stringify(payloadData)).toString('base64');
    // X-VERIFY checksum is computed on the base64 value, not the outer JSON envelope
    const checksum = sha256(base64Response + 'ab1c2d3e-salt-key-12345') + '###1';
    // Pass the full JSON envelope as the body — SDK extracts the inner response
    const jsonWrapper = JSON.stringify({ response: base64Response });

    const event = adapter.verifyWebhook(jsonWrapper, checksum, { enableReplayProtection: true });
    expect(event.verified).toBe(true);
    expect(event.orderId).toBe('order_wrap_test');
    expect(event.amount).toBe(50000);
  });

  it('still works when payload is raw base64 (backwards compatible)', () => {
    const payloadData = {
      code: 'PAYMENT_SUCCESS',
      data: {
        merchantTransactionId: 'order_raw_b64',
        transactionId: 'txn_raw',
        amount: 30000,
      },
      timestamp: Math.floor(Date.now() / 1000),
    };
    const base64Response = Buffer.from(JSON.stringify(payloadData)).toString('base64');
    const checksum = sha256(base64Response + 'ab1c2d3e-salt-key-12345') + '###1';

    const event = adapter.verifyWebhook(base64Response, checksum, { enableReplayProtection: true });
    expect(event.verified).toBe(true);
    expect(event.orderId).toBe('order_raw_b64');
  });
});

// ─── Webhook Amount Validation ───────────────────────────────────────

describe('PhonePe Webhook Amount Validation', () => {
  const adapter = new PhonePeAdapter(
    { merchantId: 'MERCHANT_TEST', saltKey: 'ab1c2d3e-salt-key-12345', saltIndex: '1' },
    'sandbox',
  );

  it('accepts webhook when expectedAmount matches', () => {
    const payloadData = {
      code: 'PAYMENT_SUCCESS',
      data: { merchantTransactionId: 'ord_amt', transactionId: 'txn_amt', amount: 50000 },
      timestamp: Math.floor(Date.now() / 1000),
    };
    const base64 = Buffer.from(JSON.stringify(payloadData)).toString('base64');
    const checksum = sha256(base64 + 'ab1c2d3e-salt-key-12345') + '###1';

    const event = adapter.verifyWebhook(base64, checksum, {
      enableReplayProtection: true,
      expectedAmount: 50000,
    });
    expect(event.verified).toBe(true);
  });

  it('rejects webhook when expectedAmount does NOT match', () => {
    const payloadData = {
      code: 'PAYMENT_SUCCESS',
      data: { merchantTransactionId: 'ord_mismatch', transactionId: 'txn_mm', amount: 100 },
      timestamp: Math.floor(Date.now() / 1000),
    };
    const base64 = Buffer.from(JSON.stringify(payloadData)).toString('base64');
    const checksum = sha256(base64 + 'ab1c2d3e-salt-key-12345') + '###1';

    const event = adapter.verifyWebhook(base64, checksum, {
      enableReplayProtection: true,
      expectedAmount: 50000, // expects ₹500, but webhook says ₹1
    });
    expect(event.verified).toBe(false);
    expect(event.orderId).toBe('ord_mismatch');
  });
});

describe('Paytm Webhook Amount Validation', () => {
  const merchantKey = 'ab1c2d3eKey12345';
  const adapter = new PaytmAdapter(
    { merchantId: 'TEST_MID', merchantKey },
    'sandbox',
  );

  it('accepts webhook when expectedAmount matches', () => {
    const now = new Date().toISOString();
    const data = { ORDERID: 'ord_amt_ok', TXNDATE: now, STATUS: 'TXN_SUCCESS', TXNAMOUNT: '500.00' };
    const paramsString = getPaytmParamsString(data);
    const checksum = generatePaytmChecksum(paramsString, merchantKey);
    const payload = JSON.stringify({ ...data, CHECKSUMHASH: checksum });

    const event = adapter.verifyWebhook(payload, checksum, {
      enableReplayProtection: true,
      expectedAmount: 50000, // ₹500 in paise
    });
    expect(event.verified).toBe(true);
  });

  it('rejects webhook when expectedAmount does NOT match', () => {
    const now = new Date().toISOString();
    const data = { ORDERID: 'ord_amt_bad', TXNDATE: now, STATUS: 'TXN_SUCCESS', TXNAMOUNT: '1.00' };
    const paramsString = getPaytmParamsString(data);
    const checksum = generatePaytmChecksum(paramsString, merchantKey);
    const payload = JSON.stringify({ ...data, CHECKSUMHASH: checksum });

    const event = adapter.verifyWebhook(payload, checksum, {
      enableReplayProtection: true,
      expectedAmount: 50000, // expects ₹500 but webhook says ₹1
    });
    expect(event.verified).toBe(false);
    expect(event.orderId).toBe('ord_amt_bad');
  });
});
