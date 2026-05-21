import { useTheme } from '@/contexts/ThemeContext'
import { Button } from './Button'
import { Modal } from './Modal'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onClose,
}: Props) {
  const { theme } = useTheme()
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Modal open={open} title={title} onClose={onClose} maxWidth="420px">
      <p className="text-sm leading-relaxed" style={{ color: theme.text2 }}>{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onClose}>{cancelLabel}</Button>
        <Button variant={destructive ? 'danger' : 'primary'} onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
