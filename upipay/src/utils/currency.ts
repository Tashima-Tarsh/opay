// ============================================================================
// UPIPay — Currency Utilities
// ============================================================================

/**
 * Safely converts an amount in Rupees (decimal) to Paise (integer)
 * to avoid JavaScript floating-point precision issues (e.g. 5.99 * 100 = 599.0000000000001).
 * 
 * @param rupees The amount in rupees (e.g. 5.99)
 * @returns The rounded amount in paise (e.g. 599)
 */
export function rupeesToPaise(rupees: number): number {
  if (typeof rupees !== 'number' || Number.isNaN(rupees)) {
    throw new TypeError('Amount in rupees must be a valid number');
  }
  if (rupees <= 0) {
    throw new RangeError('Amount in rupees must be greater than zero');
  }
  // Reject sub-paisa precision to prevent silent rounding discrepancies
  // between the cart total and the amount actually charged.
  if (!/^\d+(\.\d{1,2})?$/.test(String(rupees))) {
    throw new RangeError('Amount in rupees must not exceed 2 decimal places');
  }
  return Math.round(rupees * 100);
}
