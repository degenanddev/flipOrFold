import type { KeyboardControlsEntry } from '@react-three/drei'

export type GameControlName = 'left' | 'right'

/** Physical key codes (KeyA/KeyD) work on QWERTY, AZERTY, QZERTY, etc. */
export const GAME_KEYBOARD_MAP: KeyboardControlsEntry<GameControlName>[] = [
  {
    name: 'left',
    keys: ['ArrowLeft', 'KeyA'],
    up: false,
  },
  {
    name: 'right',
    keys: ['ArrowRight', 'KeyD'],
    up: false,
  },
]
