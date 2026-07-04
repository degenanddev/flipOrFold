import { useCallback, useMemo } from 'react'
import {
  useWeb3Modal,
  useWeb3ModalAccount,
  useWeb3ModalProvider,
  useSwitchNetwork,
} from '@web3modal/ethers/react'
import { BrowserProvider, formatEther, isError } from 'ethers'
import { KawaiiButton } from './ui'
import { useCryptoBonusCatalog, useWalletBalance, formatBnbFromWei, canAffordCryptoPurchase } from '../hooks/useCryptoShop'
import { useWalletUiStore, type WalletTxPhase } from '../store/walletUiStore'
import { useAuthStore } from '../store/authStore'
import { activeBscChain, isWeb3Configured, shortAddress, WALLETCONNECT_PROJECT_ID } from '../web3/config'
import {
  confirmCryptoPurchase,
  abandonCryptoOrder,
  invokeLinkWallet,
  prepareCryptoOrder,
  prepareWalletLinkMessage,
  unlinkWallet,
  type CryptoOrderIntent,
} from '../supabase/cryptoWallet'
import { isSupabaseConfigured } from '../supabase/client'

export function CryptoBonusPanel() {
  const { open } = useWeb3Modal()
  const { address, isConnected, chainId } = useWeb3ModalAccount()
  const { walletProvider } = useWeb3ModalProvider()
  const { switchNetwork } = useSwitchNetwork()

  const linkedWallet = useAuthStore((s) => s.user?.walletAddress ?? null)
  const trainerName = useAuthStore((s) => s.user?.username ?? null)
  const { data: catalog = [], isLoading: catalogLoading } = useCryptoBonusCatalog()
  const { data: balance } = useWalletBalance()

  const linkPhase = useWalletUiStore((s) => s.linkPhase)
  const purchasePhase = useWalletUiStore((s) => s.purchasePhase)
  const statusMessage = useWalletUiStore((s) => s.statusMessage)
  const txHash = useWalletUiStore((s) => s.txHash)
  const activeItemId = useWalletUiStore((s) => s.activeItemId)
  const setLinkPhase = useWalletUiStore((s) => s.setLinkPhase)
  const setPurchasePhase = useWalletUiStore((s) => s.setPurchasePhase)
  const setActiveItem = useWalletUiStore((s) => s.setActiveItem)
  const resetPurchase = useWalletUiStore((s) => s.resetPurchase)

  const resetLink = useWalletUiStore((s) => s.resetLink)

  const wrongChain = isConnected && chainId !== activeBscChain.chainId
  const walletMatches =
    linkedWallet && address ? linkedWallet.toLowerCase() === address.toLowerCase() : false
  const needsLink = isConnected && !linkedWallet
  const needsReconnect = isConnected && linkedWallet && !walletMatches

  const web3Ready = isWeb3Configured() && isSupabaseConfigured()
  const linkLoading = linkPhase === 'preparing' || linkPhase === 'signing' || linkPhase === 'confirming'
  const purchaseLoading = purchasePhase === 'sending' || purchasePhase === 'confirming'
  const busy = linkLoading || purchaseLoading

  const handleConnect = useCallback(() => {
    resetPurchase()
    open()
  }, [open, resetPurchase])

  const handleSwitchChain = useCallback(async () => {
    try {
      await switchNetwork(activeBscChain.chainId)
    } catch {
      open()
    }
  }, [switchNetwork, open])

  const handleUnlinkWallet = useCallback(async () => {
    resetPurchase()
    setLinkPhase('preparing', 'Unlinking wallet…')
    try {
      const result = await unlinkWallet()
      if (!result.ok) {
        setLinkPhase('error', result.error ?? 'Could not unlink wallet')
        return
      }
      setLinkPhase('success', 'Wallet unlinked — you can link another ✓')
      window.setTimeout(() => resetLink(), 3000)
    } catch {
      setLinkPhase('error', 'Could not unlink wallet')
    }
  }, [resetPurchase, setLinkPhase, resetLink])

  const handleLinkWallet = useCallback(async () => {
    if (!walletProvider || !address) {
      open()
      return
    }
    if (wrongChain) {
      await handleSwitchChain()
      return
    }

    setLinkPhase('preparing', 'Preparing link request…')
    try {
      const prepared = await prepareWalletLinkMessage()
      if (!prepared) {
        setLinkPhase('error', 'Could not prepare link message')
        return
      }

      setLinkPhase('signing', `Open your wallet — sign to link ${trainerName ?? 'your account'}`)
      const provider = new BrowserProvider(walletProvider)
      const signer = await provider.getSigner()
      const signature = await signer.signMessage(prepared.message)

      setLinkPhase('confirming', `Linking wallet to ${trainerName ?? 'your account'}…`)
      const result = await invokeLinkWallet(address, signature, prepared.message)
      if (!result.ok) {
        setLinkPhase('error', result.error ?? 'Link failed')
        return
      }
      setLinkPhase('success', `Wallet linked to ${trainerName ?? 'your account'} ✓`)
      window.setTimeout(() => resetLink(), 3000)
    } catch (err) {
      const rejected =
        err && typeof err === 'object' && 'code' in err && (err.code === 4001 || err.code === 'ACTION_REJECTED')
      setLinkPhase('error', rejected ? 'Signature cancelled' : 'Could not link wallet')
    }
  }, [walletProvider, address, wrongChain, open, handleSwitchChain, setLinkPhase, trainerName, resetLink])

  const handleBuy = useCallback(
    async (itemId: string, priceWei: string) => {
      if (!walletProvider || !address) {
        open()
        return
      }
      if (wrongChain) {
        await handleSwitchChain()
        return
      }
      if (!walletMatches) {
        setPurchasePhase('error', 'Connect the linked wallet first')
        return
      }

      setActiveItem(itemId)
      setPurchasePhase('sending', 'Preparing order…')

      let order: CryptoOrderIntent | null = null
      let txSent = false

      const failPurchase = async (message: string, hash?: string | null) => {
        if (order && !txSent) {
          await abandonCryptoOrder(order.orderId)
        }
        setPurchasePhase('error', message, hash ?? null)
      }

      try {
        const prepared = await prepareCryptoOrder(itemId)
        if (!prepared.ok || !prepared.order) {
          await failPurchase(prepared.error ?? 'Could not prepare order')
          return
        }

        order = prepared.order
        const value = BigInt(order.amountWei)

        if (!balance || !canAffordCryptoPurchase(balance.wei, value)) {
          const have = balance ? Number(formatEther(balance.wei)).toFixed(6) : '?'
          await failPurchase(
            `Not enough ${activeBscChain.currency} in MetaMask (need price + gas). Balance: ${have} ${activeBscChain.currency}`
          )
          return
        }

        setPurchasePhase('sending', `Confirm ${formatBnbFromWei(priceWei)} in your wallet…`)

        const provider = new BrowserProvider(walletProvider)
        const signer = await provider.getSigner()
        const tx = await signer.sendTransaction({
          to: order.treasuryAddress,
          value,
          chainId: activeBscChain.chainId,
        })
        txSent = true

        setPurchasePhase('confirming', 'Waiting for confirmation…', tx.hash)
        await tx.wait()

        setPurchasePhase('confirming', 'Applying bonus to your account…', tx.hash)
        const confirmed = await confirmCryptoPurchase(order.orderId, tx.hash)
        if (!confirmed.ok) {
          setPurchasePhase('error', confirmed.error ?? 'Payment verified but bonus failed — contact support', tx.hash)
          return
        }

        setPurchasePhase('success', 'Bonus unlocked ✓', tx.hash)
        setActiveItem(null)
        window.setTimeout(() => resetPurchase(), 3000)
      } catch (err) {
        const rejected =
          err && typeof err === 'object' && 'code' in err && (err.code === 4001 || err.code === 'ACTION_REJECTED')
        if (isError(err, 'INSUFFICIENT_FUNDS')) {
          await failPurchase(`Not enough ${activeBscChain.currency} in MetaMask — add a little extra for gas`)
          return
        }
        await failPurchase(rejected ? 'Transaction cancelled' : 'Payment failed')
      }
    },
    [
      walletProvider,
      address,
      wrongChain,
      walletMatches,
      balance,
      open,
      handleSwitchChain,
      setActiveItem,
      setPurchasePhase,
      resetPurchase,
    ]
  )

  const walletStatus = useMemo(() => {
    if (!web3Ready) return { tone: 'warn' as const, text: 'Crypto shop is not configured yet' }
    if (!isConnected) {
      if (linkedWallet) {
        return {
          tone: 'info' as const,
          text: `Linked ${shortAddress(linkedWallet)} — connect another wallet to buy`,
        }
      }
      return { tone: 'neutral' as const, text: 'Connect MetaMask / WalletConnect' }
    }
    if (wrongChain) return { tone: 'warn' as const, text: `Switch to ${activeBscChain.name}` }
    if (needsReconnect) return { tone: 'warn' as const, text: `Linked: ${shortAddress(linkedWallet!)} — wrong wallet connected` }
    if (needsLink) return { tone: 'info' as const, text: `Link wallet to trainer ${trainerName ?? '…'}` }
    return { tone: 'ok' as const, text: `Linked ${shortAddress(linkedWallet!)} · ${balance ? `${Number(formatEther(balance.wei)).toFixed(4)} ${activeBscChain.currency}` : '…'}` }
  }, [web3Ready, isConnected, wrongChain, needsReconnect, needsLink, linkedWallet, address, balance, trainerName])

  if (!WALLETCONNECT_PROJECT_ID) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="bg-[#f3e8ff] rounded-xl p-3 border-2 border-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#9b5de5]">
            {activeBscChain.name} · {activeBscChain.currency}
          </p>
          <p className="text-[10px] font-semibold text-[#b185db] mt-0.5 leading-snug">
            Native {activeBscChain.currency} on {activeBscChain.name}
            {activeBscChain.network === 'testnet'
              ? ' — free test coins from a BSC faucet, not real money'
              : ' — plain BNB, not a custom token'}
          </p>
          <p
            className={`text-xs font-semibold mt-1 ${walletStatus.tone === 'ok'
              ? 'text-[#7ec850]'
              : walletStatus.tone === 'warn'
                ? 'text-[#d97706]'
                : walletStatus.tone === 'info'
                  ? 'text-[#4cc9f0]'
                  : 'text-[#9b5de5]'
              }`}
          >
            {walletStatus.text}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {linkedWallet && (
            <KawaiiButton
              variant="yellow"
              onClick={() => void handleUnlinkWallet()}
              disabled={busy}
              className="text-xs px-3 py-1.5 disabled:opacity-50 min-w-[5.5rem]"
            >
              {linkPhase === 'preparing' && statusMessage?.toLowerCase().includes('unlink')
                ? 'Unlinking…'
                : '🔓 Unlink'}
            </KawaiiButton>
          )}
          {!isConnected ? (
            <KawaiiButton variant="purple" onClick={handleConnect} className="text-xs px-3 py-1.5">
              🔗 Connect
            </KawaiiButton>
          ) : wrongChain ? (
            <KawaiiButton variant="yellow" onClick={() => void handleSwitchChain()} className="text-xs px-3 py-1.5">
              ↔ {activeBscChain.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
            </KawaiiButton>
          ) : needsLink || needsReconnect ? (
            <div className="flex flex-col items-stretch sm:items-end gap-1.5">
              {needsLink && trainerName && (
                <p className="text-[10px] font-bold text-[#ff6b9d] text-right">
                  → {trainerName}
                </p>
              )}
              {needsReconnect && (
                <p className="text-[10px] font-bold text-[#d97706] text-right max-w-[11rem]">
                  Unlink first, then link this wallet
                </p>
              )}
              <KawaiiButton
                variant="pink"
                onClick={() => void handleLinkWallet()}
                disabled={busy || Boolean(needsReconnect)}
                className="text-xs px-3 py-1.5 disabled:opacity-50 min-w-[5.5rem]"
              >
                {linkLoading ? 'Linking…' : '✍️ Link'}
              </KawaiiButton>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              className="text-xs font-bold bg-white/80 text-[#9b5de5] border-2 border-[#e0c3fc] rounded-full px-3 py-1.5"
            >
              {shortAddress(address!)}
            </button>
          )}
        </div>
      </div>

      {(linkPhase !== 'idle' || purchasePhase !== 'idle') && (
        <WalletFlowStatus
          phase={linkPhase !== 'idle' ? linkPhase : purchasePhase}
          message={statusMessage}
          txHash={txHash}
          explorerUrl={activeBscChain.explorerUrl}
        />
      )}

      <div className={`space-y-2 transition-opacity ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
        {catalogLoading && (
          <p className="text-center text-sm font-bold text-[#9b5de5] animate-pulse py-4">Loading crypto bonuses…</p>
        )}

        {!catalogLoading && catalog.length === 0 && (
          <p className="text-center text-xs text-[#9b5de5] py-3">
            Crypto bonuses aren&apos;t available right now — check back soon ✨
          </p>
        )}

        {catalog.map((item, index) => {
          const isActive = activeItemId === item.id
          const isPurchasing = isActive && purchaseLoading
          const isOp =
            item.bonus_type === 'legendary' || Number(item.price_wei) >= 1_000_000_000_000_000
          const prev = catalog[index - 1]
          const prevOp = prev
            ? prev.bonus_type === 'legendary' || Number(prev.price_wei) >= 1_000_000_000_000_000
            : false
          const showPremiumHeader = isOp && !prevOp

          return (
            <div key={item.id} className="space-y-2">
              {showPremiumHeader && (
                <p className="text-[10px] font-black uppercase tracking-widest text-[#ffd166] pt-1 flex items-center gap-1.5">
                  <span>🔥</span> Premium
                </p>
              )}
              <div
                className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl p-3 border-2 ${isOp
                  ? 'bg-gradient-to-r from-[#fff9e6] to-[#f3e8ff] border-[#ffd166] shadow-[0_0_12px_rgba(255,209,102,0.35)]'
                  : 'bg-white/90 border-white'
                  }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-3xl shrink-0">{item.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display font-bold text-[#4a3568]">{item.name}</p>
                      {isOp && (
                        <span className="text-[9px] font-black uppercase tracking-wide bg-gradient-to-r from-[#ffd166] to-[#ff6b9d] text-white px-2 py-0.5 rounded-full">
                          OP
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#9b5de5] line-clamp-2">{item.description}</p>
                    <p className={`text-[10px] font-bold mt-1 ${isOp ? 'text-[#d97706]' : 'text-[#b185db]'}`}>
                      {formatBnbFromWei(item.price_wei)} · {activeBscChain.currency}
                    </p>
                  </div>
                </div>
                <KawaiiButton
                  variant={isOp ? 'yellow' : 'green'}
                  disabled={!web3Ready || busy || isPurchasing || (!walletMatches && isConnected && !needsLink)}
                  onClick={() => {
                    if (!isConnected) {
                      handleConnect()
                      return
                    }
                    if (needsLink) {
                      void handleLinkWallet()
                      return
                    }
                    void handleBuy(item.id, item.price_wei)
                  }}
                  className="text-xs px-4 py-2 w-full sm:w-auto shrink-0 disabled:opacity-50"
                >
                  {!isConnected
                    ? 'Connect'
                    : needsLink
                      ? 'Link first'
                      : isPurchasing
                        ? 'Processing…'
                        : `Buy ${formatBnbFromWei(item.price_wei)}`}
                </KawaiiButton>
              </div>
            </div>
          )
        })}

      </div>
    </div>
  )
}

function WalletFlowStatus({
  phase,
  message,
  txHash,
  explorerUrl,
}: {
  phase: WalletTxPhase
  message: string | null
  txHash: string | null
  explorerUrl: string
}) {
  const loading = phase === 'preparing' || phase === 'signing' || phase === 'sending' || phase === 'confirming'
  const isSuccess = phase === 'success'
  const isError = phase === 'error'

  return (
    <div
      className={`rounded-xl px-4 py-3 border-2 flex items-center gap-3 ${isSuccess
        ? 'bg-[#dcfce7] border-[#7ec850]'
        : isError
          ? 'bg-[#fee2e2] border-red-300'
          : 'bg-white/95 border-[#e0c3fc] shadow-sm'
        }`}
      role="status"
      aria-live="polite"
    >
      {loading && (
        <span
          className="shrink-0 w-5 h-5 rounded-full border-2 border-[#9b5de5] border-t-transparent animate-spin"
          aria-hidden
        />
      )}
      {isSuccess && <span className="text-lg shrink-0" aria-hidden>✓</span>}
      {isError && <span className="text-lg shrink-0" aria-hidden>✕</span>}

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-display font-bold leading-snug ${isSuccess ? 'text-[#166534]' : isError ? 'text-red-700' : 'text-[#4a3568]'
            }`}
        >
          {message ?? (loading ? 'Working…' : '')}
        </p>
        {loading && phase === 'signing' && (
          <p className="text-[10px] font-semibold text-[#9b5de5] mt-0.5">Check your wallet extension or app</p>
        )}
        {loading && phase === 'confirming' && (
          <p className="text-[10px] font-semibold text-[#9b5de5] mt-0.5">This may take a few seconds</p>
        )}
        {txHash && (
          <a
            href={`${explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-bold text-[#9b5de5] underline mt-1 inline-block"
          >
            View on BscScan ↗
          </a>
        )}
      </div>
    </div>
  )
}
