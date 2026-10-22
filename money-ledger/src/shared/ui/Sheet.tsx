import { Fragment, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Sheet({ 
  isOpen, 
  onClose, 
  title, 
  description, 
  children, 
  className = '',
}: SheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      contentRef.current?.focus();
    } else {
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!isOpen) return null;

  const sheetContent = (
    <Fragment>
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white shadow-xl animate-slide-up ${className}`}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'sheet-title' : undefined}
        aria-describedby={description ? 'sheet-description' : undefined}
      >
        <div className="flex items-center justify-center px-4 py-3 border-b border-border">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
        {(title || description) && (
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                {title && (
                  <h2 id="sheet-title" className="text-lg font-semibold text-text">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id="sheet-description" className="mt-1 text-sm text-text-muted">
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
        <div className="p-4 pb-safe-bottom max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </Fragment>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(sheetContent, document.body);
}