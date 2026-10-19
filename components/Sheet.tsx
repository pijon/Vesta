import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { Portal } from './Portal';
import { useAnimatedClose } from '../hooks/useAnimatedClose';

interface SheetProps {
  title: string;
  dismissible?: boolean;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Sticky area under the scrolling body */
  footer?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
  /** Field to focus when the sheet opens (default: the close button) */
  initialFocus?: React.RefObject<HTMLElement | null>;
  /** Keep the full height whatever the content, so controls at the top don't move as it changes */
  fixedHeight?: boolean;
}

/**
 * Bottom sheet on mobile, centred dialog from md up. Escape closes it, focus starts on the
 * close button (or `initialFocus`) and returns to the opener, and the page behind stops scrolling.
 */
export const Sheet: React.FC<SheetProps> = ({ title, subtitle, onClose, children, footer, size = 'md', initialFocus, fixedHeight, dismissible = true }) => {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { closing, close: animateClose } = useAnimatedClose(onClose);
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;
  const close = () => { if (dismissibleRef.current) animateClose(); };

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (initialFocus?.current ?? closeRef.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  return (
    <Portal>
      <div
        className={`fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4 bg-scrim modal-backdrop ${closing ? 'is-closing' : ''}`}
        onClick={close}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={e => e.stopPropagation()}
          className={`bg-surface w-full ${size === 'xl' ? 'md:max-w-4xl' : size === 'lg' ? 'md:max-w-2xl' : 'md:max-w-lg'} rounded-t-[32px] md:rounded-[32px] shadow-[var(--elev-lg)] ${fixedHeight ? 'h-[90vh] md:h-[min(85vh,720px)]' : 'max-h-[90vh] md:max-h-[85vh]'} flex flex-col overflow-hidden modal-panel ${closing ? 'is-closing' : ''}`}
        >
          <div className="flex items-start gap-3 px-5 pt-5 pb-3">
            <div className="flex-1 min-w-0">
              <h2 id={titleId} className="heading-2">{title}</h2>
              {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
            </div>
            <button ref={closeRef} disabled={!dismissible} onClick={close} className="icon-btn -mr-1 -mt-1" aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
          {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
};
