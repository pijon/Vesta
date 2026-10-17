import React, { useState } from 'react';
import { Sheet } from './Sheet';

interface ConfirmSheetProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  /** Danger for actions that throw data away */
  tone?: 'default' | 'danger';
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

/**
 * Asks before an action that can't be undone. Use it instead of window.confirm, which some
 * installed apps and web views skip silently (it returns false, so the action never happens).
 */
export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({ title, message, confirmLabel, tone = 'default', onConfirm, onClose }) => {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} disabled={busy} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={confirm}
            disabled={busy}
            className={`flex-1 ${tone === 'danger' ? 'btn-base bg-error-bg text-error hover:opacity-90' : 'btn-primary'}`}
          >
            {busy && <span className="spinner spinner-sm" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-muted">{message}</p>
    </Sheet>
  );
};
