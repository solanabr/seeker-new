/**
 * expo-constants shim — minimal `Constants` for the preview. The generated app
 * reads `expoConfig?.scheme` (auth client) and `expoConfig?.hostUri` (API URL
 * derivation). The API URL is supplied directly via the env shim, so only a
 * benign default config is needed here.
 */

const Constants = {
  expoConfig: {
    scheme: 'seeker-preview',
    name: 'Seeker Preview',
    slug: 'seeker-preview',
    hostUri: 'localhost:8081',
    extra: {} as Record<string, unknown>,
  },
  manifest: null,
  manifest2: null,
  executionEnvironment: 'storeClient',
};

export default Constants;
