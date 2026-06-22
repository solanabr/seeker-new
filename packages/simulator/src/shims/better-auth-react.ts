/**
 * better-auth/react shim — `createAuthClient` stand-in (no backend).
 *
 * The generated `lib/auth-client.ts` builds a better-auth client (with the expo +
 * SIWS plugins) that talks to the backend. In the preview there is no backend, so
 * this returns a client whose `useSession()` reports a signed-out session and
 * whose actions resolve to inert `{ data, error }` results — letting auth screens
 * render their signed-out state. The SIWS nonce/verify calls return mock data so
 * the wallet sign-in flow can be exercised end to end against the mock wallet.
 */

const sessionResult = {
  data: null as unknown,
  isPending: false,
  isRefetching: false,
  error: null,
  refetch: () => {},
};

function makeActionProxy(): unknown {
  const fn = async () => ({ data: null, error: null });
  return new Proxy(fn, {
    get: () => makeActionProxy(),
    apply: async () => ({ data: null, error: null }),
  });
}

export function createAuthClient(_options?: unknown) {
  const base: Record<string, unknown> = {
    useSession: () => ({ ...sessionResult }),
    getSession: async () => ({ data: null, error: null }),
    signOut: async () => ({ data: null, error: null }),
    signIn: makeActionProxy(),
    signUp: makeActionProxy(),
    getCookie: () => '',
    siws: {
      nonce: async () => ({ data: 'preview-mock-nonce', error: null }),
      verify: async () => ({
        data: { token: 'preview-mock-token' },
        error: null,
      }),
    },
  };

  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      return makeActionProxy();
    },
  });
}

export default { createAuthClient };
