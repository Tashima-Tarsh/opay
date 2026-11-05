// ============================================================================
// UPIPay — UPI QR Code Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { buildUPIUri, buildIntentLinks, generateUPIQR } from '../src/upi/qr';
import { InvalidConfigError } from '../src/errors';

describe('buildUPIUri', () => {
  it('should generate a valid NPCI UPI URI', () => {
    const uri = buildUPIUri({
      vpa: 'mybusiness@ybl',
      name: 'My Business',
      amount: 500,
      orderId: 'order_123',
    });

    expect(uri).toContain('upi://pay?');
    expect(uri).toContain('pa=mybusiness%40ybl');
    expect(uri).toContain('pn=My+Business');
    expect(uri).toContain('am=500.00');
    expect(uri).toContain('tr=order_123');
    expect(uri).toContain('cu=INR');
  });

  it('should include transaction note when provided', () => {
    const uri = buildUPIUri({
      vpa: 'shop@paytm',
      name: 'Shop',
      amount: 99.50,
      orderId: 'txn_456',
      note: 'Payment for order 456',
    });

    expect(uri).toContain('tn=Payment+for+order+456');
  });

  it('should format amount to 2 decimal places', () => {
    const uri = buildUPIUri({
      vpa: 'test@upi',
      name: 'Test',
      amount: 100,
      orderId: 'o1',
    });

    expect(uri).toContain('am=100.00');
  });
});

describe('buildIntentLinks', () => {
  it('should generate app-specific deep links', () => {
    const links = buildIntentLinks('upi://pay?pa=test@ybl&pn=Test&am=100.00&tr=o1&cu=INR');

    expect(links.generic).toContain('upi://pay?');
    expect(links.phonepe).toContain('phonepe://pay?');
    expect(links.gpay).toContain('tez://upi/pay?');
    expect(links.paytm).toContain('paytmmp://pay?');
    expect(links.bhim).toContain('upi://pay?');
  });

  it('should preserve all payment parameters', () => {
    const links = buildIntentLinks('upi://pay?pa=biz@ybl&am=500.00&tr=ord_1');

    expect(links.phonepe).toContain('pa=biz@ybl');
    expect(links.phonepe).toContain('am=500.00');
    expect(links.gpay).toContain('tr=ord_1');
  });
});

describe('generateUPIQR', () => {
  it('should generate a QR code with valid data', async () => {
    const result = await generateUPIQR({
      vpa: 'mybusiness@ybl',
      name: 'My Business',
      amount: 500,
      orderId: 'order_123',
    });

    expect(result.upiUri).toContain('upi://pay?');
    expect(result.qrImage).toContain('data:image/png;base64,');
    expect(result.orderId).toBe('order_123');
    expect(result.amount).toBe(500);
  });

  it('should generate different QR codes for different amounts', async () => {
    const qr1 = await generateUPIQR({
      vpa: 'test@ybl',
      name: 'Test',
      amount: 100,
      orderId: 'o1',
    });
    const qr2 = await generateUPIQR({
      vpa: 'test@ybl',
      name: 'Test',
      amount: 200,
      orderId: 'o2',
    });

    expect(qr1.qrImage).not.toBe(qr2.qrImage);
    expect(qr1.upiUri).not.toBe(qr2.upiUri);
  });

  it('should throw on invalid VPA', async () => {
    await expect(generateUPIQR({
      vpa: 'invalid-no-at',
      name: 'Test',
      amount: 100,
      orderId: 'o1',
    })).rejects.toThrow(InvalidConfigError);
  });

  it('should throw on zero amount', async () => {
    await expect(generateUPIQR({
      vpa: 'test@ybl',
      name: 'Test',
      amount: 0,
      orderId: 'o1',
    })).rejects.toThrow(InvalidConfigError);
  });

  it('should throw on empty orderId', async () => {
    await expect(generateUPIQR({
      vpa: 'test@ybl',
      name: 'Test',
      amount: 100,
      orderId: '',
    })).rejects.toThrow(InvalidConfigError);
  });

  it('should throw on empty name', async () => {
    await expect(generateUPIQR({
      vpa: 'test@ybl',
      name: '',
      amount: 100,
      orderId: 'o1',
    })).rejects.toThrow(InvalidConfigError);
  });
});

// ─── Fixed-Amount QR Mode ─────────────────────────────────────────────

describe('Fixed-Amount QR Mode', () => {
  it('should include mode=04 by default (fixed amount)', () => {
    const uri = buildUPIUri({
      vpa: 'mybusiness@ybl',
      name: 'My Business',
      amount: 500,
      orderId: 'order_fixed_1',
    });

    expect(uri).toContain('mode=04');
  });

  it('should include mode=04 when mode is explicitly "fixed"', () => {
    const uri = buildUPIUri({
      vpa: 'mybusiness@ybl',
      name: 'My Business',
      amount: 500,
      orderId: 'order_fixed_2',
      mode: 'fixed',
    });

    expect(uri).toContain('mode=04');
  });

  it('should NOT include mode=04 when mode is "open"', () => {
    const uri = buildUPIUri({
      vpa: 'mybusiness@ybl',
      name: 'My Business',
      amount: 500,
      orderId: 'order_open_1',
      mode: 'open',
    });

    expect(uri).not.toContain('mode=04');
  });

  it('should include mc (Merchant Category Code) when provided', () => {
    const uri = buildUPIUri({
      vpa: 'mybusiness@ybl',
      name: 'My Business',
      amount: 500,
      orderId: 'order_mc_1',
      mc: '5411',
    });

    expect(uri).toContain('mc=5411');
  });

  it('should generate QR with fixed amount mode', async () => {
    const result = await generateUPIQR({
      vpa: 'mybusiness@ybl',
      name: 'My Business',
      amount: 500,
      orderId: 'order_qr_fixed',
      mode: 'fixed',
    });

    expect(result.upiUri).toContain('mode=04');
    expect(result.qrImage).toContain('data:image/png;base64,');
  });
});
