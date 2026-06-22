/**
 * MockMwaProvider — the in-browser mock of Mobile Wallet Adapter (T03).
 *
 * This is the load-bearing trick of the whole simulator: the rendered template
 * app makes real Mobile-Wallet-Adapter calls (authorize/connect, signMessage,
 * signTransaction, signAndSendTransaction) and they resolve through an
 * ephemeral keypair generated with `@solana/kit`, gated behind a Seeker-style
 * approval sheet (T04). Program-call transactions can be broadcast to devnet;
 * no real secret is read or persisted, and the template app is never modified:
 * interception happens at the simulator boundary by aliasing
 * `@wallet-ui/react-native-kit` to a mock that drives this controller (see
 * `mock-wallet-ui-kit.tsx`).
 *
 * The controller is deliberately framework-agnostic (no React import). Both the
 * mock `useMobileWallet()` hook and the `ApprovalSheet` overlay subscribe to it,
 * even though they render in two different React trees (the app runs inside the
 * device screen via react-native-web; the sheet is simulator chrome above it).
 *
 * Swap note: the method surface mirrors the real MWA protocol, so a later sprint
 * can replace the ephemeral devnet signer with a real wallet without touching
 * the template or the approval UI.
 */

import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  generateKeyPair,
  getAddressFromPublicKey,
  signBytes,
  getBase58Decoder,
  getBase58Encoder,
  getBase64Decoder,
  getBase64EncodedWireTransaction,
  getUtf8Encoder,
  lamports,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransaction,
  type Address,
  type Instruction,
  type Signature,
} from '@solana/kit';

/** MWA-style request kinds the mock intercepts. */
export type MockRequestType =
  | 'authorize'
  | 'sign-message'
  | 'sign-transaction'
  | 'sign-and-send';

/**
 * Account shape returned by the mock — mirrors `@wallet-ui/react-native-kit`'s
 * `Account` (the subset the template reads: `address`, `label`).
 */
export interface MockAccount {
  /** Base58 Solana address (string-compatible with `@solana/kit` `Address`). */
  address: Address;
  /** Base64-encoded address bytes — present for MWA-shape parity. */
  addressBase64: string;
  /** Display label shown by the template (e.g. on the connect card). */
  label?: string;
  /** Optional wallet icon (data URI); the mock leaves it undefined. */
  icon?: string;
}

/** A pending wallet request awaiting the user's approve/reject decision. */
export interface MockWalletRequest {
  /** Correlates the request with its resolution. */
  id: string;
  /** Which MWA call raised it. */
  type: MockRequestType;
  /** One-line human summary shown on the approval sheet. */
  summary: string;
  /** Longer detail lines shown under the summary (addresses, amounts, etc.). */
  details?: string[];
}

/** Outcome surfaced to the approval sheet after a request resolves. */
export interface MockWalletResult {
  id: string;
  type: MockRequestType;
  /** `true` when the user approved and the mock produced a result. */
  approved: boolean;
  /** Human label, e.g. a (mock) signature/txid, shown on the result screen. */
  label?: string;
  /** Set when the user rejected or local resolution failed. */
  error?: string;
}

/** Coarse phase the approval sheet renders from. */
export type MockWalletPhase =
  | 'idle'
  | 'awaiting-approval'
  | 'signing'
  | 'result';

/** Snapshot the UI layers subscribe to. */
export interface MockWalletState {
  phase: MockWalletPhase;
  connected: boolean;
  account: MockAccount | null;
  pending: MockWalletRequest | null;
  result: MockWalletResult | null;
}

export interface MockMwaOptions {
  /** Account label the mock reports (defaults to "Seeker (Simulated)"). */
  accountLabel?: string;
  /**
   * Auto-resolve every request after `autoApproveMs` with no user interaction.
   * Off by default — the approval sheet drives decisions. Handy for tests.
   */
  autoApproveMs?: number;
}

type Listener = (state: MockWalletState) => void;

let requestSeq = 0;
const DEFAULT_DEVNET_RPC_URL = 'https://api.devnet.solana.com';
const MIN_SEND_BALANCE_LAMPORTS = 100_000_000n;
const AIRDROP_LAMPORTS = 1_000_000_000n;
const CONFIRMATION_POLL_MS = 500;
const CONFIRMATION_ATTEMPTS = 40;

interface MockCluster {
  id?: string;
  url?: string;
}

type DevnetAirdropRpc = ReturnType<typeof createSolanaRpc> & {
  requestAirdrop(
    address: Address,
    amount: ReturnType<typeof lamports>,
    config: { commitment: 'confirmed' },
  ): { send(): Promise<Signature> };
};

/**
 * The mock wallet engine. One instance is shared between the aliased
 * `@wallet-ui/react-native-kit` (used inside the rendered app) and the
 * `ApprovalSheet` (rendered as simulator chrome).
 */
export class MockMwaProvider {
  private readonly options: MockMwaOptions;
  private readonly listeners = new Set<Listener>();

  /** Ephemeral keypair — created on first connect, never persisted/printed. */
  private keyPair: CryptoKeyPair | null = null;
  private account: MockAccount | null = null;
  private cluster: MockCluster = {
    id: 'solana:devnet',
    url: DEFAULT_DEVNET_RPC_URL,
  };

  private state: MockWalletState = {
    phase: 'idle',
    connected: false,
    account: null,
    pending: null,
    result: null,
  };

  /** Resolver for the request currently shown on the sheet. */
  private decision: ((approved: boolean) => void) | null = null;

  constructor(options: MockMwaOptions = {}) {
    this.options = options;
  }

  // ── Subscription ────────────────────────────────────────────────────────

  getState(): MockWalletState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(patch: Partial<MockWalletState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  // ── User decisions (called by the ApprovalSheet) ──────────────────────────

  /** Approve the pending request. No-op if nothing is pending. */
  approve(): void {
    this.decision?.(true);
  }

  /** Reject the pending request. The originating MWA call rejects its promise. */
  reject(): void {
    this.decision?.(false);
  }

  /** Dismiss a finished result screen back to idle. */
  dismissResult(): void {
    if (this.state.phase === 'result') {
      this.setState({ phase: 'idle', pending: null, result: null });
    }
  }

  /** Track the template-selected cluster. Phase 3 broadcasts only to devnet. */
  setCluster(cluster: MockCluster): void {
    this.cluster = {
      id: cluster.id,
      url: cluster.url ?? DEFAULT_DEVNET_RPC_URL,
    };
  }

  // ── MWA-shaped surface (called by the mock kit / the rendered app) ─────────

  /** authorize/connect — returns the (approved) mock account. */
  async connect(): Promise<MockAccount> {
    if (this.account) {
      return this.account;
    }
    const account = await this.ensureAccount();
    const approved = await this.requestApproval({
      type: 'authorize',
      summary: 'Connect to this app',
      details: [
        `Account: ${account.label ?? 'Seeker'}`,
        shortAddress(account.address),
        'The app will be able to request signatures.',
      ],
    });
    if (!approved) {
      this.finishRejected('authorize');
      throw new UserRejectedError('connect');
    }
    this.account = account;
    // Authorization just closes the sheet and returns the account — real wallets
    // don't show a "result" screen for a connect.
    this.setState({
      connected: true,
      account,
      phase: 'idle',
      pending: null,
      result: null,
    });
    return account;
  }

  /** Deauthorize the session. */
  async disconnect(): Promise<void> {
    this.account = null;
    this.setState({ connected: false, account: null });
  }

  /** signMessage — returns ed25519 signature bytes over the message. */
  async signMessage<K extends Uint8Array | Uint8Array[]>(message: K): Promise<K> {
    const messages: Uint8Array[] = Array.isArray(message) ? message : [message];
    const account = await this.requireConnected();
    const approved = await this.requestApproval({
      type: 'sign-message',
      summary:
        messages.length > 1
          ? `Sign ${messages.length} messages`
          : 'Sign a message',
      details: [
        previewMessage(messages[0]),
        shortAddress(account.address),
      ],
    });
    if (!approved) {
      this.finishRejected('sign-message');
      throw new UserRejectedError('signMessage');
    }
    this.setState({ phase: 'signing' });
    const signatures = await Promise.all(
      messages.map((m) => this.signLocally(m)),
    );
    this.finishResult({
      type: 'sign-message',
      label: getBase58Decoder().decode(signatures[0]),
    });
    return (Array.isArray(message) ? signatures : signatures[0]) as K;
  }

  /**
   * signTransaction — mock "signs" the transaction by acknowledging it locally.
   * Returns the same transaction object (the template treats it opaquely).
   */
  async signTransaction<T>(transaction: T): Promise<T> {
    const account = await this.requireConnected();
    const txs = Array.isArray(transaction) ? transaction : [transaction];
    const approved = await this.requestApproval({
      type: 'sign-transaction',
      summary:
        txs.length > 1 ? `Sign ${txs.length} transactions` : 'Sign a transaction',
      details: [shortAddress(account.address), 'No funds will move (mock).'],
    });
    if (!approved) {
      this.finishRejected('sign-transaction');
      throw new UserRejectedError('signTransaction');
    }
    this.setState({ phase: 'signing' });
    const sig = await this.signLocally(syntheticPayload());
    this.finishResult({
      type: 'sign-transaction',
      label: getBase58Decoder().decode(sig),
    });
    return transaction;
  }

  /**
   * signAndSendTransaction — produces a local ed25519 signature and returns its
   * bytes as the (mock) transaction signature. No transaction is broadcast.
   */
  async signAndSendTransaction(
    summary = 'Approve transaction',
    details?: string[],
  ): Promise<Uint8Array> {
    const account = await this.requireConnected();
    const approved = await this.requestApproval({
      type: 'sign-and-send',
      summary,
      details: details ?? [
        shortAddress(account.address),
        'Devnet · mock — no funds move this sprint.',
      ],
    });
    if (!approved) {
      this.finishRejected('sign-and-send');
      throw new UserRejectedError('signAndSendTransaction');
    }
    this.setState({ phase: 'signing' });
    // Simulate network round-trip latency so the signing state is visible.
    await delay(650);
    const sig = await this.signLocally(syntheticPayload());
    this.finishResult({
      type: 'sign-and-send',
      label: getBase58Decoder().decode(sig),
    });
    return sig;
  }

  /**
   * sendTransaction(s) — approve, sign, and broadcast generated-app
   * instructions to devnet with the simulator's ephemeral account.
   */
  async sendInstructions(instructions: readonly Instruction[]): Promise<Signature | Uint8Array> {
    if (instructions.length === 0) {
      return this.signAndSendTransaction();
    }

    if (this.cluster.id !== 'solana:devnet') {
      throw new Error('Simulator program transactions are devnet-only in this sprint.');
    }

    const account = await this.requireConnected();
    const approved = await this.requestApproval({
      type: 'sign-and-send',
      summary:
        instructions.length > 1
          ? `Approve ${instructions.length} devnet instructions`
          : 'Approve devnet transaction',
      details: [
        shortAddress(account.address),
        'Devnet transaction will be broadcast.',
      ],
    });
    if (!approved) {
      this.finishRejected('sign-and-send');
      throw new UserRejectedError('sendTransactions');
    }

    this.setState({ phase: 'signing' });
    try {
      const signature = await this.broadcastInstructions(account.address, instructions);
      this.finishResult({
        type: 'sign-and-send',
        label: signature,
      });
      return signature;
    } catch (error) {
      this.finishFailed('sign-and-send', error);
      throw error;
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async ensureAccount(): Promise<MockAccount> {
    if (!this.keyPair) {
      // Ephemeral, in-memory only. The private CryptoKey is non-extractable and
      // never serialized, logged, or written anywhere.
      this.keyPair = await generateKeyPair();
    }
    const address = await getAddressFromPublicKey(this.keyPair.publicKey);
    const addressBytes = Uint8Array.from(getBase58Encoder().encode(address));
    const addressBase64 = getBase64Decoder().decode(addressBytes);
    return {
      address,
      addressBase64,
      label: this.options.accountLabel ?? 'Seeker (Simulated)',
    };
  }

  private async requireConnected(): Promise<MockAccount> {
    if (this.account) {
      return this.account;
    }
    // The real adapter implicitly authorizes; mirror that by connecting first.
    return this.connect();
  }

  private async signLocally(payload: Uint8Array): Promise<Uint8Array> {
    if (!this.keyPair) {
      this.keyPair = await generateKeyPair();
    }
    return signBytes(this.keyPair.privateKey, payload);
  }

  private async broadcastInstructions(
    feePayer: Address,
    instructions: readonly Instruction[],
  ): Promise<Signature> {
    if (!this.keyPair) {
      this.keyPair = await generateKeyPair();
    }

    const rpc = createSolanaRpc(this.cluster.url ?? DEFAULT_DEVNET_RPC_URL);
    await this.ensureDevnetBalance(rpc, feePayer);

    const { value: latestBlockhash } = await rpc
      .getLatestBlockhash({ commitment: 'confirmed' })
      .send();

    const message = appendTransactionMessageInstructions(
      instructions,
      setTransactionMessageLifetimeUsingBlockhash(
        latestBlockhash,
        setTransactionMessageFeePayer(
          feePayer,
          createTransactionMessage({ version: 0 }),
        ),
      ),
    );
    const transaction = compileTransaction(message);
    const signedTransaction = await signTransaction([this.keyPair], transaction);
    const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);
    const signature = await rpc
      .sendTransaction(wireTransaction, {
        encoding: 'base64',
        preflightCommitment: 'confirmed',
        maxRetries: 3n,
      })
      .send();

    await this.waitForSignature(rpc, signature);
    return signature;
  }

  private async ensureDevnetBalance(
    rpc: ReturnType<typeof createSolanaRpc>,
    address: Address,
  ): Promise<void> {
    const balance = await rpc.getBalance(address, { commitment: 'confirmed' }).send();
    if (balance.value >= MIN_SEND_BALANCE_LAMPORTS) {
      return;
    }

    const signature = await (rpc as DevnetAirdropRpc)
      .requestAirdrop(address, lamports(AIRDROP_LAMPORTS), {
        commitment: 'confirmed',
      })
      .send();
    await this.waitForSignature(rpc, signature);

    const updated = await rpc.getBalance(address, { commitment: 'confirmed' }).send();
    if (updated.value < MIN_SEND_BALANCE_LAMPORTS) {
      throw new Error('Devnet airdrop did not fund the simulator wallet enough to send.');
    }
  }

  private async waitForSignature(
    rpc: ReturnType<typeof createSolanaRpc>,
    signature: Signature,
  ): Promise<void> {
    for (let attempt = 0; attempt < CONFIRMATION_ATTEMPTS; attempt++) {
      const { value } = await rpc
        .getSignatureStatuses([signature], { searchTransactionHistory: true })
        .send();
      const status = value[0];
      if (status?.err) {
        throw new Error(`Devnet transaction failed: ${JSON.stringify(status.err)}`);
      }
      if (
        status?.confirmationStatus === 'confirmed' ||
        status?.confirmationStatus === 'finalized'
      ) {
        return;
      }
      await delay(CONFIRMATION_POLL_MS);
    }

    throw new Error(`Timed out waiting for devnet signature ${signature}`);
  }

  private requestApproval(
    req: Omit<MockWalletRequest, 'id'>,
  ): Promise<boolean> {
    const pending: MockWalletRequest = { id: `req-${requestSeq++}`, ...req };
    this.setState({ phase: 'awaiting-approval', pending, result: null });

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (approved: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        this.decision = null;
        resolve(approved);
      };
      this.decision = settle;

      if (this.options.autoApproveMs != null) {
        setTimeout(() => settle(true), this.options.autoApproveMs);
      }
    });
  }

  private finishResult(result: Omit<MockWalletResult, 'id' | 'approved'>): void {
    this.setState({
      phase: 'result',
      result: { id: this.state.pending?.id ?? '', approved: true, ...result },
    });
  }

  /** Surface a rejected-result screen, then let the caller throw. */
  private finishRejected(type: MockRequestType): void {
    this.setState({
      phase: 'result',
      result: {
        id: this.state.pending?.id ?? '',
        type,
        approved: false,
        error: 'Request rejected',
      },
    });
  }

  private finishFailed(type: MockRequestType, error: unknown): void {
    this.setState({
      phase: 'result',
      result: {
        id: this.state.pending?.id ?? '',
        type,
        approved: false,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

/** Error thrown when the user rejects a request (mirrors MWA rejection). */
export class UserRejectedError extends Error {
  readonly code = 'USER_REJECTED';
  constructor(operation: string) {
    super(`User rejected the ${operation} request.`);
    this.name = 'UserRejectedError';
  }
}

// ── small helpers (no real secrets touched) ─────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A deterministic-ish synthetic payload to sign for tx mocks. */
function syntheticPayload(): Uint8Array {
  return Uint8Array.from(getUtf8Encoder().encode(`seeker-sim-tx`));
}

function shortAddress(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-6)}`
    : address;
}

function previewMessage(bytes: Uint8Array): string {
  try {
    const text = new TextDecoder().decode(bytes);
    // Show readable text if it is printable, else fall back to byte length.
    if (/^[\x20-\x7e\s]*$/.test(text) && text.trim().length > 0) {
      return text.length > 64 ? `${text.slice(0, 64)}…` : text;
    }
  } catch {
    // fall through
  }
  return `${bytes.length} bytes`;
}
