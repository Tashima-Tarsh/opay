import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    outDir: 'dist',
  },
  {
    entry: {
      'adapters/phonepe': 'src/adapters/phonepe.ts',
      'adapters/paytm': 'src/adapters/paytm.ts',
      'upi/qr': 'src/upi/qr.ts',
      'utils/index': 'src/utils/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    outDir: 'dist',
  },
]);
