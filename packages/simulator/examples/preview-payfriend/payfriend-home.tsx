/**
 * PayFriend preview root — a CONCRETE PROOF that a seeker.new-generated app
 * (not the vendored template) previews itself in the simulator.
 *
 * It renders the REAL, UNMODIFIED wallet-flow components from the generated
 * project at `generated/payfriend/apps/mobile` — pulled in through the
 * `@template/*` Vite alias, which this preview points at PayFriend's source (see
 * vite.config.ts) — inside the mock `MobileWalletProvider`:
 *
 *   • `AuthUiConnectionStatus` — PayFriend's backend-status card
 *   • `AuthUiSolanaConnect`    — PayFriend's real wallet-connect entry point
 *                                (its `useMobileWallet().connect()` is what the
 *                                 mock MWA layer intercepts → approval sheet)
 *
 * PayFriend's home screen (`home-feature-index`) needs its oRPC/better-auth
 * backend (real network — out of scope for the mock), so this composes the
 * wallet-renderable slice plus a connect-gated demo row that drives the SAME
 * `useMobileWallet()` hook, exercising connect → approval → sign → tx-result.
 * This composition is the per-app "preview root" the generation/template-engine
 * track will emit automatically; here it is written by hand to prove the loop.
 */

import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  MobileWalletProvider,
  createSolanaDevnet,
  useMobileWallet,
} from '../../src/index';

// Real PayFriend components (resolved by the `@template/` alias → PayFriend src).
// @ts-expect-error — ambient `@template/*` module (see dev-harness/template-modules.d.ts)
import { AuthUiSolanaConnect } from '@template/features/auth/ui/auth-ui-solana-connect';
// @ts-expect-error — ambient `@template/*` module
import { AuthUiConnectionStatus } from '@template/features/auth/ui/auth-ui-connection-status';

const IDENTITY = {
  name: 'PayFriend',
  uri: 'https://solana.com',
  icon: 'favicon.png',
};

export function PayFriendHome() {
  return (
    <MobileWalletProvider cluster={createSolanaDevnet()} identity={IDENTITY}>
      <View style={{ flex: 1, backgroundColor: '#0d0d12' }}>
        <Header />
        <ScrollView
          style={{ flex: 1, backgroundColor: '#0d0d12' }}
          contentContainerStyle={{ padding: 16, gap: 16 }}
        >
          <AuthUiConnectionStatus isConnected={false} isLoading={false} />
          <AuthUiSolanaConnect />
          <DemoControls />
        </ScrollView>
      </View>
    </MobileWalletProvider>
  );
}

function Header() {
  return (
    <View
      style={{
        paddingTop: 16,
        paddingBottom: 14,
        paddingHorizontal: 16,
        backgroundColor: '#0d0d12',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <Text style={{ color: '#f5f5f7', fontSize: 18, fontWeight: '600' }}>
        PayFriend
      </Text>
    </View>
  );
}

function DemoControls() {
  const { account, signMessage, signAndSendTransaction } = useMobileWallet();
  const [lastError, setLastError] = useState<string | null>(null);
  const connected = Boolean(account);

  async function run(action: () => Promise<unknown>) {
    setLastError(null);
    try {
      await action();
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(153,69,255,0.5)',
        backgroundColor: 'rgba(153,69,255,0.06)',
      }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700' }}>
        SIMULATOR DEMO · drives useMobileWallet()
      </Text>
      <DemoButton
        label="Send a payment (mock)"
        disabled={!connected}
        onPress={() =>
          run(() =>
            signAndSendTransaction('Send 0.1 SOL to a friend', [
              'To: Friend1111…1111',
              'Amount: 0.1 SOL',
              'Devnet · mock — no funds move',
            ]),
          )
        }
      />
      <DemoButton
        label="Sign a message"
        disabled={!connected}
        onPress={() =>
          run(() => signMessage(new TextEncoder().encode('Hello from PayFriend')))
        }
      />
      {!connected ? (
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
          Connect the wallet above to enable these.
        </Text>
      ) : null}
      {lastError ? (
        <Text style={{ color: '#ff8a8a', fontSize: 11 }}>{lastError}</Text>
      ) : null}
    </View>
  );
}

function DemoButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
