export type BscNetwork = 'testnet' | 'mainnet'

export function parseBscNetwork(raw: string | undefined): BscNetwork {
  const v = raw?.trim().toLowerCase()
  return v === 'mainnet' ? 'mainnet' : 'testnet'
}

export function getBscConfig() {
  const network = parseBscNetwork(Deno.env.get('BSC_NETWORK'))
  const isMainnet = network === 'mainnet'

  return {
    network,
    chainId: isMainnet ? 56 : 97,
    rpcUrl: isMainnet
      ? Deno.env.get('BSC_MAINNET_RPC') ?? 'https://bsc-dataseed.binance.org'
      : Deno.env.get('BSC_TESTNET_RPC') ??
        'https://data-seed-prebsc-1-s1.binance.org:8545',
  }
}
