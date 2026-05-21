import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import Footer from '@/components/Footer'

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10.7 1.3a1 1 0 0 0-1.4 0L1.6 9a1 1 0 0 0 1.4 1.4L4 9.4V17a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1V9.4l1 1A1 1 0 0 0 18.4 9L10.7 1.3z"/>
  </svg>
)
const CampaignIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M2 4a2 2 0 0 1 2-2h3l2 2h5a2 2 0 0 1 2 2v1H2V4zm0 4h14v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8zm4 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H6z"/>
  </svg>
)
const SwordIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M7.05 13.406l3.534 3.536-1.413 1.414 1.415 1.415-1.414 1.414-2.475-2.475-2.829 2.829-1.414-1.414 2.829-2.83-2.475-2.474 1.414-1.414 1.414 1.413 1.413-1.414zM3 3l3.546.003 11.817 11.818 1.415-1.414 1.414 1.414-2.474 2.475 2.828 2.829-1.414 1.414-2.829-2.829-2.475 2.475-1.414-1.414 1.414-1.415L3.003 6.531 3 3zm14.457 0L21 3.003l.002 3.523-4.053 4.052-3.536-3.535L17.457 3z"/>
  </svg>
)
const CharacterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 2a4 4 0 0 0-2.9 6.76A7 7 0 0 0 3 15.15V16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-.85a7 7 0 0 0-4.1-6.39A4 4 0 0 0 10 2z" clipRule="evenodd"/>
  </svg>
)
const CombatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 512 512" fill="currentColor">
    <path d="M248 20.3L72 132.6l176-3.8V20.3zm16 0v108.5l175.7 3.8L264 20.3zM242 144.9L55 149l72 192.9 115-197zm28 0l115.4 197L456.6 149 270 144.9zm-14 7.5L139 352.6h234.1L256 152.4zM52 186v173.2l62-5.7L52 186zm408 0l-61.9 167.5 61.9 5.7V186zm-317 182.6l113 123.1 112.8-123.1H143zm-21 .3l-54 4.9 64 41.1-10-46zm268.2 0l-10 46 64-41.1-54-4.9z"/>
  </svg>
)
const BookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14a1 1 0 0 1-1.45.89L10 15.12l-5.55 2.77A1 1 0 0 1 3 17V3z" />
  </svg>
)
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 0 1-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 0 1 .947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 0 1 2.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 0 1 2.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 0 1 .947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 0 1-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 0 1-2.287-.947zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" clipRule="evenodd"/>
  </svg>
)

export default function Layout() {
  const { theme } = useTheme()
  const location = useLocation()

  const navItems = [
    { to: '/',            label: 'Dashboard',  icon: <HomeIcon     /> },
    { to: '/campaigns',   label: 'Campaigns',  icon: <CampaignIcon /> },
    { to: '/characters',  label: 'Characters', icon: <CharacterIcon /> },
    { to: '/encounters',  label: 'Encounters', icon: <SwordIcon   /> },
    { to: '/combat',      label: 'Combat',     icon: <CombatIcon  /> },
    { to: '/compendium',  label: 'Compendium', icon: <BookIcon    /> },
    { to: '/settings',    label: 'Settings',   icon: <SettingsIcon /> },
  ]
  // Highlight Encounters for both /encounters and /encounters/:id, etc.
  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: theme.bg, color: theme.text }}>
      <header
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{ background: `${theme.surface}dd`, borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group" style={{ textDecoration: 'none' }}>
            <img src="/favicon.svg" width={28} height={28} alt="Combatr" className="shrink-0" />
            <span className="text-xl font-extrabold tracking-tight gradient-text select-none">
              Combatr
            </span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {navItems.map(item => {
              const active = isActive(item.to)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                  style={active
                    ? { background: `${theme.accent}22`, color: theme.accent }
                    : { color: theme.text2 }}
                >
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}
