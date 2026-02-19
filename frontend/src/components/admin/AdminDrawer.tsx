import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const getFocusableElements = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );

type AdminDrawerProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClassName?: string;
  bodyClassName?: string;
};

const AdminDrawer = ({
  isOpen,
  title,
  onClose,
  children,
  footer,
  widthClassName,
  bodyClassName = 'flex-1 overflow-y-auto px-4 py-4',
}: AdminDrawerProps) => {
  const titleId = useId();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const body = document.body;
    const originalOverflow = body.style.overflow;
    const originalPaddingRight = body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (scrollBarWidth > 0) {
      body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      body.style.overflow = originalOverflow;
      body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const drawerElement = drawerRef.current;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const focusableElements = drawerElement ? getFocusableElements(drawerElement) : [];
    focusableElements[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !drawerElement) {
        return;
      }

      const elements = getFocusableElements(drawerElement);
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <div
        className={`relative ml-auto flex h-full w-full flex-col bg-white shadow-xl ${
          widthClassName ?? 'max-w-[480px]'
        }`}
      >
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="flex h-full flex-col"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p id={titleId} className="text-sm font-semibold text-slate-800">
              {title}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Закрыть
            </button>
          </div>
          <div className={bodyClassName}>{children}</div>
          {footer ? (
            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AdminDrawer;
