import { createContext, useContext } from 'react'
import type { Api, AppUser } from './api.ts'
import type { Snapshot } from './types.ts'

export interface Ctx {
  api: Api
  user: AppUser | null
  snap: Snapshot | null
  building: string
  reload: () => Promise<void>
  toast: (msg: string, kind?: 'ok' | 'err') => void
  signOut: () => Promise<void>
  go: (route: string) => void
}

export const AppCtx = createContext<Ctx | null>(null)
export const useApp = () => {
  const c = useContext(AppCtx)
  if (!c) throw new Error('AppCtx yok')
  return c
}
