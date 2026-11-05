// ============================================================================
// UPIPay — UPI QR Code Generator
// ============================================================================
// Generates NPCI-compliant UPI QR codes for direct bank payments.
// Zero commission. No middleman. Money goes straight to your bank.

import QRCode from 'qrcode';
import type { UPIQRRequest, UPIQRResponse, UPIIntentLink } from '../types.js';
import { validateQRRequest } from '../utils/validation.js';

/**
 * Build a standard NPCI-compliant UPI URI.
 *
 * Format: upi://pay?pa=VPA&pn=Name&am=Amount&tr=TransactionRef&cu=INR
 *
 * This URI is understood by ALL UPI apps (PhonePe, GPay, Paytm, BHIM, etc.)
 *
 * > [!WARNING]
 * > **QR-Only Flow Limitations**: This method does not support automated payment
 * > verification. There is no webhook/callback mechanism or Status API. Payments
 * > must be verified manually (e.g. SMS, soundbox, bank statement).
 *
 * @param request - UPI payment details
 * @returns The UPI URI string
 */
export function buildUPIUri(request: UPIQRRequest): string {
  const params = new URLSearchParams();
  params.set('pa', request.vpa);             // Payee VPA
  params.set('pn', request.name);            // Payee name
  params.set('am', request.amount.toFixed(2)); // Amount in rupees
  params.set('tr', request.orderId);         // Transaction reference (your order ID)
  params.set('cu', 'INR');                   // Currency

  // ── Fixed-Amount Mode (NPCI Specification) ─────────────────────
  // mode=04 tells UPI apps that the amount is EXACT and NON-EDITABLE.
  // The user CANNOT change the amount — not even 1 paisa less or more.
  // This is the default behavior for invoices, e-commerce, and any
  // scenario where the exact amount must be paid.
  //
  // mode=00 (or omitted) allows the user to edit the amount freely.
  const mode = request.mode ?? 'fixed';
  if (mode === 'fixed') {
    params.set('mode', '04');                // NPCI: exact/fixed amount
  }

  // Merchant Category Code (optional, for better NPCI compliance)
  if (request.mc) {
    params.set('mc', request.mc);
  }

  if (request.note) {
    params.set('tn', request.note);          // Transaction note
  }

  return `upi://pay?${params.toString()}`;
}

/**
 * Generate UPI deep links for specific apps.
 *
 * These open the specific UPI app directly on the user's phone,
 * with all payment details pre-filled.
 *
 * > [!WARNING]
 * > **QR-Only Flow Limitations**: This method does not support automated payment
 * > verification. There is no webhook/callback mechanism or Status API. Payments
 * > must be verified manually (e.g. SMS, soundbox, bank statement).
 *
 * @param upiUri - The base UPI URI
 * @returns Deep links for PhonePe, GPay, Paytm, and BHIM
 */
export function buildIntentLinks(upiUri: string): UPIIntentLink {
  // Extract query string from upi:// URI
  const queryString = upiUri.replace('upi://pay?', '');

  return {
    generic: upiUri,
    phonepe: `phonepe://pay?${queryString}`,
    gpay: `tez://upi/pay?${queryString}`,
    paytm: `paytmmp://pay?${queryString}`,
    bhim: `upi://pay?${queryString}`,
  };
}

/**
 * Generate a UPI QR code image.
 *
 * Creates a dynamic QR code with your VPA, amount, and order ID pre-filled.
 * When a customer scans this QR code with ANY UPI app, the payment goes
 * DIRECTLY to your bank account. Zero commission. No middleman.
 *
 * > [!WARNING]
 * > **QR-Only Flow Limitations**: This method does not support automated payment
 * > verification. There is no webhook/callback mechanism or Status API. Payments
 * > must be verified manually (e.g. SMS, soundbox, bank statement).
 *
 * @param request - UPI payment details (VPA, amount, order ID, name)
 * @returns QR image (base64 PNG) + UPI URI + metadata
 *
 * @example
 * ```typescript
 * import { generateUPIQR } from 'upipay/qr';
 *
 * const qr = await generateUPIQR({
 *   vpa: 'mybusiness@ybl',
 *   name: 'My Business',
 *   amount: 500.00,
 *   orderId: 'order_123',
 * });
 *
 * // Display qr.qrImage as <img src={qr.qrImage} /> in your frontend
 * // Or send qr.upiUri as a payment link
 * ```
 */
export async function generateUPIQR(request: UPIQRRequest): Promise<UPIQRResponse> {
  // Validate inputs
  validateQRRequest(request);

  // Build NPCI-compliant UPI URI
  const upiUri = buildUPIUri(request);

  // Generate QR code as base64 PNG data URL
  const qrImage = await QRCode.toDataURL(upiUri, {
    errorCorrectionLevel: 'H', // High error correction for reliable scanning
    type: 'image/png',
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  return {
    upiUri,
    qrImage,
    orderId: request.orderId,
    amount: request.amount,
  };
}

/**
 * Generate a UPI QR code as a raw SVG string.
 * Useful for server-side rendering or embedding in HTML.
 *
 * > [!WARNING]
 * > **QR-Only Flow Limitations**: This method does not support automated payment
 * > verification. There is no webhook/callback mechanism or Status API. Payments
 * > must be verified manually (e.g. SMS, soundbox, bank statement).
 *
 * @param request - UPI payment details
 * @returns SVG string of the QR code
 */
export async function generateUPIQRSvg(request: UPIQRRequest): Promise<string> {
  validateQRRequest(request);
  const upiUri = buildUPIUri(request);
  return QRCode.toString(upiUri, {
    errorCorrectionLevel: 'H',
    type: 'svg',
    width: 400,
    margin: 2,
  });
}

/**
 * Generate a UPI QR code as a raw Buffer (PNG).
 * Useful for saving to file or sending as API response.
 *
 * > [!WARNING]
 * > **QR-Only Flow Limitations**: This method does not support automated payment
 * > verification. There is no webhook/callback mechanism or Status API. Payments
 * > must be verified manually (e.g. SMS, soundbox, bank statement).
 *
 * @param request - UPI payment details
 * @returns PNG Buffer of the QR code
 */
export async function generateUPIQRBuffer(request: UPIQRRequest): Promise<Buffer> {
  validateQRRequest(request);
  const upiUri = buildUPIUri(request);
  return QRCode.toBuffer(upiUri, {
    errorCorrectionLevel: 'H',
    type: 'png',
    width: 400,
    margin: 2,
  });
}

