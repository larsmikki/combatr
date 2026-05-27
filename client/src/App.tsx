import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { useCombat } from '@/contexts/CombatContext'
import { CombatProvider } from '@/contexts/CombatProvider'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { ToastProvider } from '@/components/ui'
import Layout from '@/components/Layout'

const FrontPage = lazy(() => import('@/pages/FrontPage'))
const EncountersListPage = lazy(() => import('@/pages/EncountersListPage'))
const EncounterEditPage = lazy(() => import('@/pages/EncounterEditPage'))
const CampaignsListPage = lazy(() => import('@/pages/CampaignsListPage'))
const CampaignDetailPage = lazy(() => import('@/pages/CampaignDetailPage'))
const CharactersListPage = lazy(() => import('@/pages/CharactersListPage'))
const CharacterDetailPage = lazy(() => import('@/pages/CharacterDetailPage'))
const CharacterPrintPage = lazy(() => import('@/pages/CharacterPrintPage'))
const CombatPage = lazy(() => import('@/pages/CombatPage'))
const CompendiumPage = lazy(() => import('@/pages/CompendiumPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const DonatePage = lazy(() => import('@/pages/DonatePage'))

// Legacy /party route — sends the user to the active campaign's detail page
// (where party setup now lives). Falls back to the campaign list if there's
// no active campaign yet (e.g. brand-new install pre-load).
function PartyRedirect() {
  const { activeCampaignId, loaded } = useCombat()
  if (!loaded) return null
  return activeCampaignId
    ? <Navigate to={`/campaigns/${activeCampaignId}`} replace />
    : <Navigate to="/campaigns" replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <CombatProvider>
        <ConfirmProvider>
        <ToastProvider>
        <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<FrontPage />} />
              <Route path="/campaigns" element={<CampaignsListPage />} />
              <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
              <Route path="/characters" element={<CharactersListPage />} />
              <Route path="/characters/:id" element={<CharacterDetailPage />} />
              <Route path="/characters/:id/print" element={<CharacterPrintPage />} />
              <Route path="/encounters" element={<EncountersListPage />} />
              <Route path="/encounters/:id" element={<EncounterEditPage />} />
              <Route path="/party" element={<PartyRedirect />} />
              <Route path="/combat" element={<CombatPage />} />
              <Route path="/compendium" element={<CompendiumPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/donate" element={<DonatePage />} />
              {/* Legacy route redirects */}
              <Route path="/saved" element={<Navigate to="/encounters" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
        </BrowserRouter>
        </ToastProvider>
        </ConfirmProvider>
      </CombatProvider>
    </ThemeProvider>
  )
}
