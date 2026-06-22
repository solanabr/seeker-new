import { useCallback, useEffect, useState } from 'react'
import { createSolanaRpc, type Address } from '@solana/kit'
import { ProgramConfig } from '@/constants/program-config'
import { findStatePda } from '@/features/counter/program-client/pdas/state'
import { fetchMaybeTally } from '@/features/counter/program-client/accounts/tally'

// A direct @solana/kit RPC against devnet. The counter state is read live from
// the deployed program — this is a real on-chain read, not mocked. (We talk to
// the RPC directly instead of via TanStack Query so the read genuinely hits
// devnet inside the in-browser preview.)
const programAddress = ProgramConfig.programId as Address
const rpc = createSolanaRpc(ProgramConfig.rpcUrl)

export interface CounterState {
  /** A devnet read is in flight. */
  loading: boolean
  /** Whether the deployed program account is live + executable on devnet. */
  programLive: boolean | null
  /** Whether this authority's counter PDA has been initialized. */
  exists: boolean
  /** The current counter value (as a string), when initialized. */
  value: string | null
  /** The derived counter PDA address for the connected authority. */
  pda: string | null
  error: string | null
}

const INITIAL: CounterState = {
  loading: false,
  programLive: null,
  exists: false,
  value: null,
  pda: null,
  error: null,
}

/**
 * Read the deployed counter program's state from devnet. Confirms the program is
 * live, then (when an authority is connected) derives and reads that authority's
 * counter PDA — all via the generated program client.
 */
export function useCounter(authority?: Address) {
  const [state, setState] = useState<CounterState>(INITIAL)

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      // 1) Confirm the deployed program is reachable + executable on devnet.
      const program = await rpc.getAccountInfo(programAddress, { encoding: 'base64' }).send()
      const programLive = Boolean(program.value?.executable)

      // 2) When connected, derive + read this authority's counter PDA on devnet.
      let exists = false
      let value: string | null = null
      let pda: string | null = null
      if (authority) {
        const [statePda] = await findStatePda({ authority }, { programAddress })
        pda = statePda as string
        const account = await fetchMaybeTally(rpc, statePda)
        exists = account.exists
        if (account.exists) {
          value = account.data.tally.toString()
        }
      }

      setState({ loading: false, programLive, exists, value, pda, error: null })
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      }))
    }
  }, [authority])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { ...state, refresh }
}
