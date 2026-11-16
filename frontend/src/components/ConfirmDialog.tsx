import { useEffect, useId, useRef } from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  /** Controls whether the modal dialog is open. */
  open: boolean;
  /** Accessible heading describing the action. */
  title: string;
  /** Explanation of what confirming the action will do. */
  description: string;
  /** Optional amber note identifying a simulated workflow. */
  simulationNote?: string;
  /** Confirm button label. Defaults to Confirm. */
  confirmLabel?: string;
  /** Disables both buttons and Escape cancellation while work is pending. */
  busy?: boolean;
  /** Called by Cancel or Escape; the parent should set open to false. */
  onCancel: () => void;
  /** Called when the user confirms the action. */
  onConfirm: () => void;
}

/** A native modal confirmation dialog with focus restoration and simulation messaging. */
export function ConfirmDialog({ open, title, description, simulationNote, confirmLabel = 'Confirm', busy = false, onCancel, onConfirm }: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null); const titleId = useId(); const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    return () => { if (element.open) element.close(); if (previous instanceof HTMLElement) previous.focus(); };
  }, [open]);
  return <dialog ref={dialog} className="ym-confirm-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p>{simulationNote && <p className="ym-simulation-note">{simulationNote}</p>}
    <div className="ym-dialog-actions"><Button variant="outline" disabled={busy} onClick={onCancel} autoFocus>Cancel</Button><Button disabled={busy} onClick={onConfirm}>{busy ? 'Please wait…' : confirmLabel}</Button></div>
  </dialog>;
}
