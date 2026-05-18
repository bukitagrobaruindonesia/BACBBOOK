"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnOverlayClick?: boolean;
}

export default function Modal(props: ModalProps) {
  const { isOpen, onClose, title, children, footer, size = "md", closeOnOverlayClick = true } = props;
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = "hidden";

      const timer = setTimeout(() => {
        const focusable = modalRef.current?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement;
        focusable?.focus();
      }, 100);

      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = "unset";
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if (e.key === "Tab") {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  const sizes: Record<string, string> = {
    sm: "max-w-sm mx-4",
    md: "max-w-lg mx-4",
    lg: "max-w-2xl mx-4",
    xl: "max-w-4xl mx-4 sm:mx-6",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      ></div>
      <div
        ref={modalRef}
        className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} transform transition-all max-h-[90vh] flex flex-col`}
      >
        {title ? (
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <h2 id="modal-title" className="text-lg sm:text-xl font-bold text-gray-800 truncate pr-4">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Tutup modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : null}
        <div className="px-4 sm:px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {footer ? (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex-shrink-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}