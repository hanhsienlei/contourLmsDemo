import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/** false during SSR and hydration, true afterwards: gates anything that depends on the browser clock or timezone. */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
