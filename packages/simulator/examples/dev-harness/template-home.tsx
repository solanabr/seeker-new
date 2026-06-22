/**
 * Template home screen for the dev harness (T02 + T04 demo surface).
 *
 * This is the root react-native component the `WebRenderBackend` boots via
 * `AppRegistry`. It renders REAL, UNMODIFIED beeman template components — pulled
 * in through the `@template/*` Vite alias — inside the mock `MobileWalletProvider`:
 *
 *   • `AuthUiConnectionStatus` — the template's backend-status card
 *   • `AuthUiSolanaConnect`    — the template's real wallet-connect entry point
 *                                (its `useMobileWallet().connect()` is what the
 *                                 mock MWA layer intercepts → approval sheet)
 *
 * The template's only transaction paths (SIWS, todos) require its oRPC/better-auth
 * backend, which is out of scope this sprint (no real network). So the
 * "Simulator demo" row below adds connect-gated Sign-message / Send-transaction
 * controls that call the SAME `useMobileWallet()` hook the template uses, to
 * exercise the full approval → sign → tx-result flow end-to-end. These controls
 * are simulator scaffolding, clearly labelled, not part of the template.
 */

import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  MobileWalletProvider,
  createSolanaDevnet,
  useMobileWallet,
} from '../../src/index';

// Real template components (resolved by the `@template/` alias; untyped here).
// @ts-expect-error — ambient `@template/*` module (see template-modules.d.ts)
import { AuthUiSolanaConnect } from '@template/features/auth/ui/auth-ui-solana-connect';
// @ts-expect-error — ambient `@template/*` module
import { AuthUiConnectionStatus } from '@template/features/auth/ui/auth-ui-connection-status';

const IDENTITY = {
  name: 'Solana Mobile Monorepo',
  uri: 'https://solana.com',
  icon: 'favicon.png',
};

export function TemplateHome() {
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
        Solana Mobile Monorepo
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
      // UserRejectedError lands here on the reject path — surface it, don't crash.
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
        label="Sign a message"
        disabled={!connected}
        onPress={() =>
          run(() => signMessage(new TextEncoder().encode('Hello from Seeker')))
        }
      />
      <DemoButton
        label="Send a transaction (mock)"
        disabled={!connected}
        onPress={() =>
          run(() =>
            signAndSendTransaction('Send 0.1 SOL', [
              'To: DemoRecipient1111…1111',
              'Amount: 0.1 SOL',
              'Devnet · mock — no funds move',
            ]),
          )
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
