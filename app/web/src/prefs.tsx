import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type TextSize = 'md' | 'lg' | 'xl'
export interface Prefs {
  focus: boolean
  textSize: TextSize
  bionic: boolean
  rate: number
}

const DEFAULTS: Prefs = { focus: false, textSize: 'md', bionic: false, rate: 0.95 }
const KEY = 'tracedesk-reading-prefs'
const ROOT_SIZE: Record<TextSize, string> = { md: '100%', lg: '112.5%', xl: '125%' }

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

const Ctx = createContext<{ prefs: Prefs; set: (patch: Partial<Prefs>) => void }>({ prefs: DEFAULTS, set: () => {} })

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      /* ignore */
    }
    // Mantine sizes are in rem, so scaling the root font size scales the whole interface.
    document.documentElement.style.fontSize = ROOT_SIZE[prefs.textSize]
    document.body.classList.toggle('focus-mode', prefs.focus)
  }, [prefs])

  return <Ctx.Provider value={{ prefs, set: (patch) => setPrefs((p) => ({ ...p, ...patch })) }}>{children}</Ctx.Provider>
}

export const usePrefs = () => useContext(Ctx)
