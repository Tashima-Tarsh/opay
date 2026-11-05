// ============================================================================
// UPIPay — Client & Validation Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { UPIPay } from '../src/client';
import { InvalidConfigError, UPIPayError } from '../src/errors';

describe('UPIPay Client', () => {
  it('should initialise with PhonePe config', () => {
    const client = new UPIPay({
      provider: 'phonepe',
      environment: 'sandbox',
      credentials: {
        merchantId: 'MERCHANTUAT',
        saltKey: 'ab1c2d3e-f4g5-6789-abcd-ef1234567890',
        saltIndex: '1',
      },
    });
    expect(client.provider).toBe('phonepe');
    expect(client.environment).toBe('sandbox');
  });

  it('should initialise with Paytm config', () => {
    const client = new UPIPay({
      provider: 'paytm',
      environment: 'sandbox',
      credentials: {
        merchantId: 'PAYTM_MID_12345',
        merchantKey: 'ab1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q',
      },
    });
    expect(client.provider).toBe('paytm');
  });

  it('should throw for invalid provider', () => {
    expect(() => new UPIPay({
      provider: 'razorpay' as any,
      environment: 'sandbox',
      credentials: {},
    })).toThrow(InvalidConfigError);
  });

  it('should throw for missing credentials', () => {
    expect(() => new UPIPay({
      provider: 'phonepe',
      environment: 'sandbox',
      credentials: {},
    })).toThrow(InvalidConfigError);
  });

  it('should throw for invalid environment', () => {
    expect(() => new UPIPay({
      provider: 'phonepe',
      environment: 'staging' as any,
      credentials: {
        merchantId: 'MID123',
        saltKey: 'ab1c2d3e-f4g5-6789-abcd-ef1234567890',
        saltIndex: '1',
      },
    })).toThrow(InvalidConfigError);
  });

  it('should throw for empty credential values', () => {
    expect(() => new UPIPay({
      provider: 'phonepe',
      environment: 'sandbox',
      credentials: {
        merchantId: '',
        saltKey: 'abc',
        saltIndex: '1',
      },
    })).toThrow(InvalidConfigError);
  });

  it('should throw for placeholder credentials', () => {
    expect(() => new UPIPay({
      provider: 'phonepe',
      environment: 'sandbox',
      credentials: {
        merchantId: 'MERCHANTUAT',
        saltKey: 'your_salt_key_here',
        saltIndex: '1',
      },
    })).toThrow(/placeholder/i);
  });

  it('checkStatus validates orderId to prevent injection attacks', async () => {
    const client = makeClient();
    await expect(client.checkStatus('')).rejects.toThrow(InvalidConfigError);
  });

  it('checkStatus rejects path traversal in orderId', async () => {
    const client = makeClient();
    await expect(client.checkStatus('../../etc/passwd')).rejects.toThrow(/alphanumeric/);
    await expect(client.checkStatus('order"; DROP TABLE--')).rejects.toThrow(/alphanumeric/);
  });

  it('should validate payment amount is positive', async () => {
    const client = makeClient();
    await expect(client.createPayment({
      amount: 0,
      orderId: 'order_1',
      customerPhone: '9876543210',
      callbackUrl: 'http://localhost/cb',
      redirectUrl: 'http://localhost/done',
    })).rejects.toThrow(InvalidConfigError);
  });

  it('should enforce minimum payment amount (₹1 = 100 paise)', async () => {
    const client = makeClient();
    await expect(client.createPayment({
      amount: 50,
      orderId: 'order_1',
      customerPhone: '9876543210',
      callbackUrl: 'http://localhost/cb',
      redirectUrl: 'http://localhost/done',
    })).rejects.toThrow(/at least/);
  });

  it('should enforce maximum payment amount', async () => {
    const client = makeClient();
    await expect(client.createPayment({
      amount: 200_000_000,
      orderId: 'order_1',
      customerPhone: '9876543210',
      callbackUrl: 'http://localhost/cb',
      redirectUrl: 'http://localhost/done',
    })).rejects.toThrow(/exceeds maximum/);
  });

  it('should reject orderId containing injection characters', async () => {
    const client = makeClient();
    await expect(client.createPayment({
      amount: 50000,
      orderId: 'order"; DROP TABLE--',
      customerPhone: '9876543210',
      callbackUrl: 'http://localhost/cb',
      redirectUrl: 'http://localhost/done',
    })).rejects.toThrow(/alphanumeric/);
  });

  it('should reject dangerous URL schemes in callbackUrl', async () => {
    const client = makeClient();
    await expect(client.createPayment({
      amount: 50000,
      orderId: 'order_1',
      customerPhone: '9876543210',
      callbackUrl: 'javascript:alert(1)',
      redirectUrl: 'http://localhost/done',
    })).rejects.toThrow(/dangerous/);
  });

  it('should enforce HTTPS URLs in production mode', async () => {
    const client = new UPIPay({
      provider: 'phonepe',
      environment: 'production',
      credentials: {
        merchantId: 'MERCHANT_PROD',
        saltKey: 'ab1c2d3e-f4g5-6789-abcd-ef1234567890',
        saltIndex: '1',
      },
    });
    await expect(client.createPayment({
      amount: 50000,
      orderId: 'order_1',
      customerPhone: '9876543210',
      callbackUrl: 'http://example.com/webhook',
      redirectUrl: 'https://example.com/done',
    })).rejects.toThrow('HTTPS');
  });

  it('should expose the underlying adapter via getAdapter()', () => {
    const client = makeClient();
    expect(client.getAdapter().provider).toBe('phonepe');
  });

  it('should have a proper error class hierarchy', () => {
    const err = new InvalidConfigError('test');
    expect(err).toBeInstanceOf(InvalidConfigError);
    expect(err).toBeInstanceOf(UPIPayError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('INVALID_CONFIG');
    expect(err.isRetriable).toBe(false);
  });

  it('verifyWebhook returns a WebhookEvent object', () => {
    const client = makeClient();
    const event = client.verifyWebhook('test', 'invalid-sig', { enableReplayProtection: false });
    expect(event).toHaveProperty('verified');
    expect(event).toHaveProperty('status');
    expect(event).toHaveProperty('orderId');
    expect(event.verified).toBe(false);
  });
});

describe('UPI QR via UPIPay client', () => {
  it('should generate QR code', async () => {
    const client = makeClient();
    const qr = await client.generateQR({
      vpa: 'mybusiness@ybl',
      name: 'My Business',
      amount: 500,
      orderId: 'order_qr_test',
    });
    expect(qr.qrImage).toContain('data:image/png;base64,');
    expect(qr.upiUri).toContain('pa=mybusiness%40ybl');
    expect(qr.orderId).toBe('order_qr_test');
  });

  it('should build a UPI payment link', () => {
    const client = makeClient();
    const link = client.buildUPILink({
      vpa: 'shop@paytm',
      name: 'My Shop',
      amount: 299.99,
      orderId: 'link_test',
    });
    expect(link).toContain('upi://pay?');
    expect(link).toContain('am=299.99');
  });

  it('should build app-specific intent links', () => {
    const client = makeClient();
    const links = client.buildIntentLinks({
      vpa: 'biz@ybl',
      name: 'Biz',
      amount: 100,
      orderId: 'intent_test',
    });
    expect(links.phonepe).toContain('phonepe://pay?');
    expect(links.gpay).toContain('tez://upi/pay?');
    expect(links.paytm).toContain('paytmmp://pay?');
  });
});

// ─── Helper ──────────────────────────────────────────────────────────

function makeClient() {
  return new UPIPay({
    provider: 'phonepe',
    environment: 'sandbox',
    credentials: {
      merchantId: 'MERCHANTUAT',
      saltKey: 'ab1c2d3e-f4g5-6789-abcd-ef1234567890',
      saltIndex: '1',
    },
  });
}
