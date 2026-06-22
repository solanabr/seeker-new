/**
 * @solana-mobile-monorepo/env/mobile shim — the generated app's workspace `env`
 * package is neither published nor installed in the isolated preview, so the real
 * import cannot resolve. This stub supplies a configured `EXPO_PUBLIC_API_URL` so
 * `getApiUrl()` returns a value instead of throwing. The data layer is mocked
 * (see the oRPC / better-auth shims), so the URL is never actually fetched.
 */

export const env = {
  EXPO_PUBLIC_API_URL: 'http://localhost:3000',
} as Record<string, string | undefined>;

export default { env };
