# Contributing to UPIPay

Thanks for helping make free UPI payments accessible to every Indian developer! 🇮🇳

## Development Setup

```bash
git clone https://github.com/iamrobinsharaya/upipay.git
cd upipay
npm install
npm test          # Run tests (46 tests)
npm run typecheck # TypeScript check
npm run build     # Build ESM + CJS + types
```

## Project Structure

```
src/
├── types.ts            # All TypeScript types
├── errors.ts           # Custom error classes
├── client.ts           # Main UPIPay class
├── index.ts            # Public API exports
├── interfaces/
│   └── psp-adapter.ts  # PSP adapter interface
├── adapters/
│   ├── phonepe.ts      # PhonePe Business (free)
│   └── paytm.ts        # Paytm Business (free)
├── upi/
│   └── qr.ts           # UPI QR code generator
└── utils/
    ├── crypto.ts        # HMAC, SHA256, constant-time compare
    ├── logger.ts        # Secret-masking logger
    └── validation.ts    # Input validation (security-hardened)
```

## Adding a New Free PSP

1. Create `src/adapters/your-psp.ts` implementing `IPSPAdapter`
2. Add credential types to `src/types.ts`
3. Add provider to `Provider` union type
4. Add required credentials to `src/utils/validation.ts`
5. Register in `src/client.ts` → `createAdapter()`
6. Add subpath export in `package.json` and `tsup.config.ts`
7. Write tests in `tests/`
8. Update `README.md`

## Important Rules

### Only Free PSPs
We only support PSPs that offer **zero-commission** merchant accounts. Do not add paid payment gateways (Razorpay PG, Stripe, etc.). The whole point of UPIPay is avoiding middleman fees.

### Security First
- All webhook verification must use `constantTimeEqual` (never `===` for signatures)
- All credentials must be validated before use
- Never log sensitive data — use the `Logger` class which auto-masks secrets
- All URLs must be validated against dangerous schemes

### Code Quality
- TypeScript strict mode — no `any` without justification
- Every public function needs JSDoc comments
- All changes need tests

## Submitting a PR

1. Fork and create a branch: `git checkout -b feat/your-feature`
2. Make changes and add tests
3. Run `npm test && npm run typecheck && npm run build`
4. Submit PR with clear description

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
