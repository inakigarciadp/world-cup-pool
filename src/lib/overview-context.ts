import { createContext, useContext } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { Overview } from '@/lib/httpApi'

type OverviewContextValue = {
  overview: Overview
  setOverview: Dispatch<SetStateAction<Overview | null | undefined>>
}

export const OverviewContext = createContext<OverviewContextValue | null>(null)

export function useOverview() {
  const value = useContext(OverviewContext)

  if (!value) {
    throw new Error('useOverview debe usarse dentro de App.')
  }

  return value
}
