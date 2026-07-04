export type BscNetwork = 'testnet' | 'mainnet'

export interface BscChainConfig {
  network: BscNetwork
  chainId: number
  name: string
  currency: string
  explorerUrl: string
  rpcUrl: string
}

export const BSC_CHAINS: Record<BscNetwork, Omit<BscChainConfig, 'network' | 'rpcUrl'>> = {
  testnet: {
    chainId: 97,
    name: 'BNB Smart Chain Testnet',
    currency: 'tBNB',
    explorerUrl: 'https://testnet.bscscan.com',
  },
  mainnet: {
    chainId: 56,
    name: 'BNB Smart Chain',
    currency: 'BNB',
    explorerUrl: 'https://bscscan.com',
  },
}

export function parseBscNetwork(raw: string | undefined): BscNetwork {
  const v = raw?.trim().toLowerCase()
  return v === 'mainnet' ? 'mainnet' : 'testnet'
}
