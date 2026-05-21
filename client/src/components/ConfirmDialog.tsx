import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { Modal, Button } from '@/components/ui'

type ConfirmOptions = {
  title?: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme()
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    const normalized: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts
    return new Promise<boolean>((resolve) => {
      setState({ opts: normalized, resolve })
    })
  }, [])

  const close = (result: boolean) => {
    if (!state) return
    state.resolve(result)
    setState(null)
  }

  const opts = state?.opts

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={opts?.title ?? 'Confirm'}
        maxWidth="420px"
      >
        <div className="text-sm" style={{ color: theme.text }}>{opts?.message}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => close(false)}>
            {opts?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            size="sm"
            variant={opts?.destructive ? 'danger' : 'primary'}
            autoFocus
            onClick={() => close(true)}
          >
            {opts?.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}
