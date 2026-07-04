import { useQuery } from '@tanstack/react-query'
import { BrowserProvider, formatEther } from 'ethers'
import { useWeb3ModalAccount, useWeb3ModalProvider } from '@web3modal/ethers/react'
import { activeBscChain } from '../web3/config'
import { fetchCryptoBonusCatalog } from '../supabase/cryptoWallet'

/** Headroom for BSC native transfer gas (price + ~21000 gas) */
export const BSC_GAS_BUFFER_WEI = 30_000_000_000_000n

export function canAffordCryptoPurchase(balanceWei: bigint, priceWei: bigint): boolean {
  return balanceWei >= priceWei + BSC_GAS_BUFFER_WEI
}

export function useCryptoBonusCatalog() {
  return useQuery({
    queryKey: ['crypto', 'catalog'],
    queryFn: fetchCryptoBonusCatalog,
    staleTime: 60_000,
  })
}

export function useWalletBalance() {
  const { address, isConnected, chainId } = useWeb3ModalAccount()
  const { walletProvider } = useWeb3ModalProvider()
  const onCorrectChain = chainId === activeBscChain.chainId

  return useQuery({
    queryKey: ['wallet', 'balance', chainId, address],
    queryFn: async () => {
      if (!address || !walletProvider) return null
      const provider = new BrowserProvider(walletProvider)
      const wei = await provider.getBalance(address)
      return { wei, formatted: formatEther(wei) }
    },
    enabled: isConnected && !!address && !!walletProvider && onCorrectChain,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}

export function formatBnbFromWei(wei: string): string {
  const n = Number(formatEther(wei))
  const sym = activeBscChain.currency
  if (n >= 0.001) return `${n.toFixed(4)} ${sym}`
  return `${n.toFixed(6)} ${sym}`
}
