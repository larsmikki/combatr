import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { CombatProvider, useCombat } from '@/contexts/CombatContext'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { ToastProvider } from '@/components/ui'
import Layout from '@/components/Layout'
import FrontPage from '@/pages/FrontPage'
import EncountersListPage from '@/pages/EncountersListPage'
import EncounterEditPage from '@/pages/EncounterEditPage'
import CampaignsListPage from '@/pages/CampaignsListPage'
import CampaignDetailPage from '@/pages/CampaignDetailPage'
import CharactersListPage from '@/pages/CharactersListPage'
import CharacterDetailPage from '@/pages/CharacterDetailPage'
import CharacterPrintPage from '@/pages/CharacterPrintPage'
import CombatPage from '@/pages/CombatPage'
import CompendiumPage from '@/pages/CompendiumPage'
import SettingsPage from '@/pages/SettingsPage'
import DonatePage from '@/pages/DonatePage'

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
        </BrowserRouter>
        </ToastProvider>
        </ConfirmProvider>
      </CombatProvider>
    </ThemeProvider>
  )
}
