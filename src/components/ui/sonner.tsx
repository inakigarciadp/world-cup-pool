import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      closeButton
      position="top-center"
      icons={{
        success: <CheckCircle2 className="size-5 text-mint-ink" />,
        error: <XCircle className="size-5 text-coral-deep" />,
        info: <Info className="size-5 text-coral-ink" />,
        warning: <AlertTriangle className="size-5 text-sun-ink" />,
      }}
      toastOptions={{
        classNames: {
          toast: 'toast',
          title: 'toast-title',
          description: 'toast-description',
          icon: 'toast-icon',
          actionButton: 'toast-action-button',
          cancelButton: 'toast-cancel-button',
          closeButton: 'toast-close-button',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
