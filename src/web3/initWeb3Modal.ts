import { createWeb3Modal, defaultConfig } from '@web3modal/ethers/react'
import {
  activeBscChain,
  WALLETCONNECT_PROJECT_ID,
  bscTestnetChain,
} from './config'

let initialized = false

export function initWeb3Modal(): void {
  if (initialized || !WALLETCONNECT_PROJECT_ID) return

  createWeb3Modal({
    ethersConfig: defaultConfig({
      metadata: {
        name: 'Flip or Fold',
        description: 'Crypto bonuses in the Flip or Fold shop',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://fliporfold.game',
        icons: ['https://avatars.githubusercontent.com/u/37784886'],
      },
      enableEIP6963: true,
      enableInjected: true,
      enableCoinbase: true,
      auth: {
        email: false,
        socials: [],
        showWallets: true,
      },
      rpcUrl: activeBscChain.rpcUrl,
      defaultChainId: activeBscChain.chainId,
      chains: [bscTestnetChain],
    }),
    chains: [bscTestnetChain],
    projectId: WALLETCONNECT_PROJECT_ID,
    enableAnalytics: false,
    themeMode: 'light',
    themeVariables: {
      '--w3m-accent': '#9b5de5',
      '--w3m-border-radius-master': '16px',
    },
  })

  initialized = true
}

export function isWeb3ModalInitialized(): boolean {
  return initialized
}
