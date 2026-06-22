/**
 * @orpc/client/fetch shim — `RPCLink` stand-in (no network). The generated
 * `lib/orpc.ts` constructs an `RPCLink` pointed at the backend URL; in the
 * preview it is inert. See the orpc-client shim for the why.
 */

export class RPCLink {
  constructor(_options?: unknown) {}
}

export default { RPCLink };
