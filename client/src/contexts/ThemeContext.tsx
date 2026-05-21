import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface ThemeDefinition {
  name: string
  mode: 'light' | 'dark'
  bg: string
  surface: string
  surface2: string
  border: string
  text: string
  text2: string
  accent: string
  gradient: string
  previewColors: string[]
}

export const THEMES: ThemeDefinition[] = [
  {
    name: 'Default', mode: 'light',
    bg: '#f4f5f7', surface: '#ffffff', surface2: '#e9ebef',
    border: 'rgba(0,0,0,0.09)', text: '#09090b', text2: '#71717a',
    accent: '#e11d48', gradient: 'linear-gradient(135deg, #e11d48 0%, #ea580c 100%)',
    previewColors: ['#f4f5f7', '#ffffff', '#e11d48'],
  },
  {
    name: 'Bone', mode: 'light',
    bg: '#f3eee4', surface: '#ffffff', surface2: '#eae4d4',
    border: 'rgba(0,0,0,0.12)', text: '#1f1b14', text2: '#766c58',
    accent: '#8b4513', gradient: 'linear-gradient(135deg, #8b4513 0%, #d4a017 100%)',
    previewColors: ['#eae4d4', '#d4a017', '#8b4513'],
  },
  {
    name: 'Royal', mode: 'dark',
    bg: '#0c1226', surface: '#141a36', surface2: '#1c2347',
    border: 'rgba(200,162,90,0.18)', text: '#e9edf7', text2: '#8c95b3',
    accent: '#c8a25a', gradient: 'linear-gradient(135deg, #c8a25a 0%, #5e72c8 100%)',
    previewColors: ['#1c2347', '#3a4a8f', '#c8a25a'],
  },
  {
    name: 'Crimson', mode: 'dark',
    bg: '#1a0a0d', surface: '#241114', surface2: '#311619',
    border: 'rgba(200,90,90,0.2)', text: '#fbe9e6', text2: '#b08580',
    accent: '#d2484a', gradient: 'linear-gradient(135deg, #d2484a 0%, #c8a25a 100%)',
    previewColors: ['#311619', '#7b1d2b', '#d2484a'],
  },
  {
    name: 'Forge', mode: 'dark',
    bg: '#1a1410', surface: '#241c16', surface2: '#2f261d',
    border: 'rgba(200,162,90,0.2)', text: '#f3eee4', text2: '#a6957b',
    accent: '#e0a64a', gradient: 'linear-gradient(135deg, #e0a64a 0%, #c84a2a 100%)',
    previewColors: ['#2f261d', '#7a3a18', '#e0a64a'],
  },
  {
    name: 'Arcane', mode: 'dark',
    bg: '#0f0a1f', surface: '#181230', surface2: '#221940',
    border: 'rgba(159,122,234,0.2)', text: '#ece6ff', text2: '#9a8fc4',
    accent: '#9f7aea', gradient: 'linear-gradient(135deg, #9f7aea 0%, #4a8cd2 100%)',
    previewColors: ['#221940', '#5d3aa8', '#9f7aea'],
  },
  {
    name: 'Verdant', mode: 'dark',
    bg: '#0e1a14', surface: '#15251c', surface2: '#1d3127',
    border: 'rgba(95,191,107,0.2)', text: '#e6f3ea', text2: '#8aa896',
    accent: '#5fbf6b', gradient: 'linear-gradient(135deg, #5fbf6b 0%, #2d8870 100%)',
    previewColors: ['#1d3127', '#2d8870', '#5fbf6b'],
  },
  {
    name: 'Twilight', mode: 'dark',
    bg: '#10131d', surface: '#181c2a', surface2: '#222740',
    border: 'rgba(74,140,210,0.2)', text: '#e4ecff', text2: '#8893b0',
    accent: '#4a8cd2', gradient: 'linear-gradient(135deg, #4a8cd2 0%, #9f7aea 100%)',
    previewColors: ['#222740', '#3a558b', '#4a8cd2'],
  },
  {
    name: 'Mono Dark', mode: 'dark',
    bg: '#0e1014', surface: '#171a21', surface2: '#1f232c',
    border: 'rgba(255,255,255,0.08)', text: '#e6e8ee', text2: '#8a93a3',
    accent: '#c8a25a', gradient: 'linear-gradient(135deg, #c8a25a 0%, #8a93a3 100%)',
    previewColors: ['#1f232c', '#41464f', '#c8a25a'],
  },
  {
    name: 'Mono Light', mode: 'light',
    bg: '#f4f5f7', surface: '#ffffff', surface2: '#e9ebef',
    border: 'rgba(0,0,0,0.1)', text: '#1a1d23', text2: '#6b7280',
    accent: '#374151', gradient: 'linear-gradient(135deg, #374151 0%, #6b7280 100%)',
    previewColors: ['#e9ebef', '#9ca3af', '#374151'],
  },
]

interface ThemeContextType {
  theme: ThemeDefinition
  setThemeByName: (name: string) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES[0],
  setThemeByName: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeDefinition>(() => {
    const stored = localStorage.getItem('combatr-theme')
    if (!stored) return THEMES[0]
    return THEMES.find(t => t.name === stored) ?? THEMES[0]
  })

  useEffect(() => {
    localStorage.setItem('combatr-theme', theme.name)
    document.documentElement.classList.toggle('dark', theme.mode === 'dark')

    const root = document.documentElement
    root.style.setProperty('--theme-bg', theme.bg)
    root.style.setProperty('--theme-surface', theme.surface)
    root.style.setProperty('--theme-surface2', theme.surface2)
    root.style.setProperty('--theme-border', theme.border)
    root.style.setProperty('--theme-text', theme.text)
    root.style.setProperty('--theme-text2', theme.text2)
    root.style.setProperty('--theme-accent', theme.accent)
  }, [theme])

  const setThemeByName = (name: string) => {
    const found = THEMES.find(t => t.name === name)
    if (found) setTheme(found)
  }

  return (
    <ThemeContext.Provider value={{ theme, setThemeByName }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
