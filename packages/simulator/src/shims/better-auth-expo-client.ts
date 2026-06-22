/**
 * @better-auth/expo/client shim — `expoClient` plugin no-op. The real plugin
 * wires Expo SecureStore cookie storage; in the preview the auth client is
 * inert (see better-auth-react shim), so the plugin is a no-op descriptor.
 */

export function expoClient(_options?: unknown) {
  return { id: 'expo' };
}

export default { expoClient };
