export interface ToastProps {
  /** Confirmation message announced by the status live region. */
  message: string;
  /** Whether the toast is visible. Defaults to true. */
  open?: boolean;
  /** Optional dismiss handler; providing it shows a close button. */
  onClose?: () => void;
}

/** A fixed bottom-right confirmation banner. */
export function Toast({ message, open = true, onClose }: ToastProps) {
  if (!open) return null;
  return <div className="ym-toast" role="status"><span aria-hidden="true">✓</span><span>{message}</span>{onClose && <button type="button" onClick={onClose} aria-label="Dismiss confirmation">×</button>}</div>;
}
