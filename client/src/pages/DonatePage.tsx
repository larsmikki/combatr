import { useTheme } from '@/contexts/ThemeContext'
import { Surface, Button } from '@/components/ui'

export default function DonatePage() {
  const { theme } = useTheme()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: theme.text }}>Support Combatr</h1>
        <p className="text-sm mt-0.5" style={{ color: theme.text2 }}>
          I build privacy-first, self-hosted tools — no subscriptions, no ads, no tracking.
          Your data stays yours. If this saves you time at the table, consider supporting the work.
        </p>
      </div>

      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1" style={{ color: theme.text }}>What you get</h2>
        <p className="text-xs mb-4" style={{ color: theme.text2 }}>Combatr is and always will be free, open source, and self-hosted.</p>
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { icon: '🛡️', label: '100% Free Forever', color: '#22c55e' },
            { icon: '🔒', label: 'No Ads or Tracking', color: '#f59e0b' },
            { icon: '💾', label: 'Your data, your device', color: theme.accent },
          ].map(({ icon, label, color }) => (
            <div key={label}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: `${color}15`, color, border: `1px solid ${color}20` }}>
              <span>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </Surface>

      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1" style={{ color: theme.text }}>Donate</h2>
        <p className="text-xs mb-5" style={{ color: theme.text2 }}>One-time donations via Buy Me a Coffee or PayPal. Any amount is appreciated.</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { emoji: '☕', title: 'Buy Me a Coffee', sub: 'One-time donation, any amount', url: 'https://buymeacoffee.com/larsmikki', label: '☕ Buy Me a Coffee' },
            { emoji: '💙', title: 'PayPal',          sub: 'Quick & secure donation',     url: 'https://paypal.me/larsmikki',     label: '💙 Donate via PayPal' },
          ].map(({ emoji, title, sub, url, label }) => (
            <div key={title} className="flex flex-col items-center text-center gap-4 rounded-xl p-6"
              style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
              <div className="text-4xl">{emoji}</div>
              <div>
                <h3 className="text-sm font-bold mb-1" style={{ color: theme.text }}>{title}</h3>
                <p className="text-xs" style={{ color: theme.text2 }}>{sub}</p>
              </div>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              >
                {label}
              </Button>
            </div>
          ))}
        </div>
      </Surface>

      <Surface className="p-6">
        <h2 className="text-base font-bold mb-1" style={{ color: theme.text }}>Thank you!</h2>
        <p className="text-xs" style={{ color: theme.text2 }}>
          Every bit of support keeps Combatr free. Roll well, and may your initiative always be high.
        </p>
      </Surface>
    </div>
  )
}
