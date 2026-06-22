import { useState } from 'react'
import { Button, Text, View } from 'react-native'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { createNoopSigner, type Address } from '@solana/kit'
import { appStyles } from '@/constants/app-styles'
import { ellipsify } from '@/utils/ellipsify'
import { ProgramConfig } from '@/constants/program-config'
import { useCounter } from '@/features/counter/use-counter'
import { getInitializeInstructionAsync } from '@/features/counter/program-client/instructions/initialize'
import { getBumpInstructionAsync } from '@/features/counter/program-client/instructions/bump'

/**
 * Calls the app's deployed Solana program. Reads the counter state live from
 * devnet via the generated client, and sends an initialize/increment instruction
 * through the Mobile Wallet Adapter (connect → approval → sign → tx). The
 * instruction is the real on-chain call built from the deployed program's client.
 */
export function CounterFeatureIndex() {
  const { account, sendTransactions } = useMobileWallet()
  const address = account?.address as Address | undefined
  const counter = useCounter(address)
  const [busy, setBusy] = useState(false)

  async function callProgram(kind: 'initialize' | 'increment') {
    if (!address) {
      return
    }
    setBusy(true)
    try {
      const authority = createNoopSigner(address)
      const instruction =
        kind === 'initialize'
          ? await getInitializeInstructionAsync({ authority })
          : await getBumpInstructionAsync({ authority })

      // Hand the instruction to the wallet: connect → approval → sign → tx.
      const signature = await sendTransactions([instruction])
      console.log(`counter ${kind} signature:`, signature)

      // Re-read the on-chain state from devnet after the call.
      await counter.refresh()
    } catch (error) {
      console.log(`counter ${kind} error:`, error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={appStyles.stack}>
      <Text style={appStyles.title}>Counter Program</Text>
      <View style={appStyles.card}>
        <Text>
          Program <Text style={{ fontWeight: 'bold' }}>{ellipsify(ProgramConfig.programId)}</Text>
        </Text>
        <Text>
          Network <Text style={{ fontWeight: 'bold' }}>{ProgramConfig.label}</Text>
        </Text>
        <Text>
          Status{' '}
          <Text style={{ fontWeight: 'bold' }}>
            {counter.loading
              ? 'Reading devnet…'
              : counter.programLive
                ? 'Live on devnet'
                : counter.programLive === false
                  ? 'Program not found'
                  : '—'}
          </Text>
        </Text>
        {address ? (
          <Text>
            Count{' '}
            <Text style={{ fontWeight: 'bold' }}>
              {counter.exists ? counter.value : 'Not initialized yet'}
            </Text>
          </Text>
        ) : (
          <Text>Connect your wallet to read your counter.</Text>
        )}
        {counter.error ? <Text>Read error: {counter.error}</Text> : null}
      </View>

      {address ? (
        <View style={appStyles.stack}>
          {counter.exists ? (
            <Button
              title={busy ? 'Working…' : 'Increment counter'}
              disabled={busy}
              onPress={() => callProgram('increment')}
            />
          ) : (
            <Button
              title={busy ? 'Working…' : 'Initialize counter'}
              disabled={busy}
              onPress={() => callProgram('initialize')}
            />
          )}
          <Button title="Refresh from devnet" onPress={() => counter.refresh()} />
        </View>
      ) : null}
    </View>
  )
}
