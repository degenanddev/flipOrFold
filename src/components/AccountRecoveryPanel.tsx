import { useCallback, useEffect, useState } from 'react'
import {
  useWeb3Modal,
  useWeb3ModalAccount,
  useWeb3ModalProvider,
  useSwitchNetwork,
} from '@web3modal/ethers/react'
import { BrowserProvider, isError } from 'ethers'
import { KawaiiButton } from './ui'
import { activeBscChain, shortAddress, WALLETCONNECT_PROJECT_ID } from '../web3/config'
import { isSupabaseConfigured } from '../supabase/client'
import {
  invokeWalletRecovery,
  lookupWalletRecovery,
  prepareWalletRecovery,
} from '../supabase/accountRecovery'

type RecoveryPhase = 'idle' | 'preparing' | 'signing' | 'confirming' | 'success' | 'error'

export function AccountRecoveryPanel() {
  const { open } = useWeb3Modal()
  const { address, isConnected, chainId } = useWeb3ModalAccount()
  const { walletProvider } = useWeb3ModalProvider()
  const { switchNetwork } = useSwitchNetwork()

  const [phase, setPhase] = useState<RecoveryPhase>('idle')
  const [status, setStatus] = useState<string | null>(null)
  const [linkedUsername, setLinkedUsername] = useState<string | null>(null)
  const [lookupBusy, setLookupBusy] = useState(false)

  const enabled = Boolean(WALLETCONNECT_PROJECT_ID) && isSupabaseConfigured()
  const wrongChain = isConnected && chainId !== activeBscChain.chainId
  const busy = phase === 'preparing' || phase === 'signing' || phase === 'confirming' || lookupBusy

  useEffect(() => {
    if (!enabled || !isConnected || !address) {
      setLinkedUsername(null)
      return
    }

    let cancelled = false
    setLookupBusy(true)

    void lookupWalletRecovery(address).then((result) => {
      if (cancelled) return
      setLinkedUsername(result.found ? result.username ?? null : null)
      setLookupBusy(false)
    })

    return () => {
      cancelled = true
    }
  }, [enabled, isConnected, address])

  const handleSwitchChain = useCallback(async () => {
    try {
      await switchNetwork(activeBscChain.chainId)
    } catch {
      open()
    }
  }, [switchNetwork, open])

  const handleRecover = useCallback(async () => {
    if (!walletProvider || !address) {
      open()
      return
    }
    if (wrongChain) {
      await handleSwitchChain()
      return
    }

    setPhase('preparing')
    setStatus('Preparing recovery…')

    try {
      const prepared = await prepareWalletRecovery(address)
      if (!prepared.ok) {
        setPhase('error')
        setStatus(prepared.error)
        return
      }

      if (prepared.alreadyOnDevice) {
        setPhase('success')
        setStatus(`Welcome back, ${prepared.username}! ✓`)
        return
      }

      setPhase('signing')
      setStatus(`Sign in your wallet to recover ${prepared.username}`)

      const provider = new BrowserProvider(walletProvider)
      const signer = await provider.getSigner()
      const signature = await signer.signMessage(prepared.message)

      setPhase('confirming')
      setStatus('Restoring your trainer…')

      const result = await invokeWalletRecovery(address, signature, prepared.message)
      if (!result.ok) {
        setPhase('error')
        setStatus(result.error ?? 'Recovery failed')
        return
      }

      setPhase('success')
      setStatus(`Welcome back, ${prepared.username}! ✓`)
    } catch (err) {
      const rejected =
        isError(err, 'ACTION_REJECTED') ||
        (err instanceof Error && /user rejected|denied/i.test(err.message))
      setPhase('error')
      setStatus(rejected ? 'Signature cancelled' : 'Recovery failed — try again')
    }
  }, [walletProvider, address, wrongChain, handleSwitchChain, open])

  if (!enabled) return null

  return (
    <div className="shrink-0 bg-white/70 rounded-xl p-2.5 border-2 border-white space-y-2">
      <div className="text-center space-y-0.5">
        <p className="text-[10px] font-bold text-kawaii-purple uppercase">Welcome back?</p>
        <p className="text-[9px] font-semibold text-[#b185db] leading-snug">
          Recover with the wallet you linked in Shop → Crypto
        </p>
      </div>

      {!isConnected ? (
        <KawaiiButton variant="purple" onClick={() => open()} className="w-full text-xs py-2">
          Connect wallet to recover
        </KawaiiButton>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-center text-[#4a3568]">
            {shortAddress(address!)}
            {lookupBusy && <span className="text-kawaii-purple"> · checking…</span>}
            {!lookupBusy && linkedUsername && (
              <span className="text-kawaii-green"> · trainer {linkedUsername}</span>
            )}
            {!lookupBusy && !linkedUsername && (
              <span className="text-amber-600"> · no linked trainer</span>
            )}
          </p>

          {wrongChain && (
            <KawaiiButton variant="yellow" onClick={handleSwitchChain} className="w-full text-xs py-2">
              Switch to {activeBscChain.name}
            </KawaiiButton>
          )}

          <KawaiiButton
            variant="green"
            onClick={handleRecover}
            disabled={busy || !linkedUsername || wrongChain}
            className="w-full text-xs py-2 disabled:opacity-50"
          >
            {busy ? 'Working…' : linkedUsername ? `Recover ${linkedUsername}` : 'Link wallet in Shop first'}
          </KawaiiButton>
        </div>
      )}

      {status && (
        <p
          className={`text-[10px] font-bold text-center ${
            phase === 'error' ? 'text-red-500' : phase === 'success' ? 'text-kawaii-green' : 'text-kawaii-purple'
          }`}
        >
          {status}
        </p>
      )}
    </div>
  )
}
