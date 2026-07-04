import { JsonRpcProvider } from 'ethers'
import { BSC_CHAINS, parseBscNetwork, type BscChainConfig, type BscNetwork } from './chains'

const trimEnv = (v: string | undefined) => v?.trim().replace(/^["']|["']$/g, '') ?? ''

export const WALLETCONNECT_PROJECT_ID = trimEnv(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID)

/** Switch: `testnet` | `mainnet` — one var to rule them all */
export const BSC_NETWORK: BscNetwork = parseBscNetwork(import.meta.env.VITE_BSC_NETWORK)

const BSC_TESTNET_RPC =
  trimEnv(import.meta.env.VITE_REACT_APP_ALCHEMY_KEY_BSC_TESTNET) ||
  'https://data-seed-prebsc-1-s1.binance.org:8545'

const BSC_MAINNET_RPC =
  trimEnv(import.meta.env.VITE_REACT_APP_ALCHEMY_KEY_BSC_MAINNET) ||
  'https://bsc-dataseed.binance.org'

export const CRYPTO_TREASURY_ADDRESS = trimEnv(import.meta.env.VITE_CRYPTO_TREASURY_ADDRESS)

const base = BSC_CHAINS[BSC_NETWORK]

export const activeBscChain: BscChainConfig = {
  network: BSC_NETWORK,
  ...base,
  rpcUrl: BSC_NETWORK === 'mainnet' ? BSC_MAINNET_RPC : BSC_TESTNET_RPC,
}

/** @deprecated use activeBscChain.chainId */
export const BSC_TESTNET_CHAIN_ID = activeBscChain.chainId

/** @deprecated use activeBscChain.explorerUrl */
export const BSC_TESTNET_EXPLORER = activeBscChain.explorerUrl

export const bscTestnetChain = {
  chainId: activeBscChain.chainId,
  name: activeBscChain.name,
  currency: activeBscChain.currency,
  explorerUrl: activeBscChain.explorerUrl,
  rpcUrl: activeBscChain.rpcUrl,
} as const

export const readProvider = new JsonRpcProvider(activeBscChain.rpcUrl, activeBscChain.chainId)

export function isWeb3Configured(): boolean {
  return Boolean(WALLETCONNECT_PROJECT_ID && CRYPTO_TREASURY_ADDRESS)
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
