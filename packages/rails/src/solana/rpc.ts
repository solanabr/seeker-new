import type { ClusterTarget } from '../cluster/ClusterTarget.js';

interface JsonRpcResponse<T> {
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

interface GetBalanceResult {
  value: number;
}

interface SignatureStatus {
  confirmationStatus?: 'processed' | 'confirmed' | 'finalized';
  confirmations?: number | null;
  err?: unknown;
}

interface GetSignatureStatusesResult {
  value: Array<SignatureStatus | null>;
}

interface SignatureInfo {
  signature: string;
}

const DEFAULT_CONFIRM_ATTEMPTS = 30;
const DEFAULT_CONFIRM_DELAY_MS = 500;

export const LAMPORTS_PER_SOL = 1_000_000_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function rpcRequest<T>(target: ClusterTarget, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(target.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'seeker-rails',
      method,
      params,
    }),
  });

  const text = await response.text();
  let payload: JsonRpcResponse<T>;
  try {
    payload = JSON.parse(text) as JsonRpcResponse<T>;
  } catch {
    throw new Error(`RPC ${method} returned non-JSON response (${response.status}): ${text}`);
  }

  if (!response.ok) {
    const message = payload.error?.message ?? text;
    throw new Error(`${response.status} ${response.statusText}: ${message}`);
  }
  if (payload.error) {
    throw new Error(`${payload.error.code}: ${payload.error.message}`);
  }
  if (payload.result === undefined) {
    throw new Error(`RPC ${method} returned no result`);
  }

  return payload.result;
}

export async function getBalanceLamports(target: ClusterTarget, address: string): Promise<number> {
  const result = await rpcRequest<GetBalanceResult>(target, 'getBalance', [
    address,
    { commitment: 'confirmed' },
  ]);
  return result.value;
}

export async function requestAirdropLamports(
  target: ClusterTarget,
  address: string,
  lamports: number,
): Promise<string> {
  return rpcRequest<string>(target, 'requestAirdrop', [
    address,
    lamports,
    { commitment: 'confirmed' },
  ]);
}

export async function confirmSignature(target: ClusterTarget, signature: string): Promise<void> {
  for (let attempt = 0; attempt < DEFAULT_CONFIRM_ATTEMPTS; attempt += 1) {
    const result = await rpcRequest<GetSignatureStatusesResult>(target, 'getSignatureStatuses', [
      [signature],
      { searchTransactionHistory: true },
    ]);
    const status = result.value[0];
    if (status?.err) {
      throw new Error(`Transaction ${signature} failed: ${JSON.stringify(status.err)}`);
    }
    if (
      status?.confirmationStatus === 'confirmed' ||
      status?.confirmationStatus === 'finalized' ||
      status?.confirmations === null
    ) {
      return;
    }
    await sleep(DEFAULT_CONFIRM_DELAY_MS);
  }

  throw new Error(`Timed out waiting for transaction ${signature} to confirm`);
}

export async function getLatestSignatureForAddress(
  target: ClusterTarget,
  address: string,
): Promise<string> {
  const signatures = await rpcRequest<SignatureInfo[]>(target, 'getSignaturesForAddress', [
    address,
    { limit: 1 },
  ]);
  const latest = signatures[0];
  if (!latest) {
    throw new Error(`No signatures found for deployed program ${address}`);
  }
  return latest.signature;
}
