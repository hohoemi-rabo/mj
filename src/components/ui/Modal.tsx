"use client";

// モーダル/オーバーレイ基盤。createPortal で body 直下に出す。
// アクセシビリティ: role="dialog" / aria-modal、Esc で閉じる、開時にフォーカス移動・閉時に復帰、body スクロールロック。
// シニアの誤タップ対策で、オーバーレイクリックでの閉じはデフォルト無効（dismissOnOverlayClick）。

import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Esc キーで閉じる（既定 true）。 */
  dismissOnEsc?: boolean;
  /** オーバーレイ（背景）クリックで閉じる（既定 false＝誤タップ防止）。 */
  dismissOnOverlayClick?: boolean;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  dismissOnEsc = true,
  dismissOnOverlayClick = false,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc で閉じる + body スクロールロック + フォーカス管理。
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (dismissOnEsc && e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [open, dismissOnEsc, onClose]);

  // SSR では portal を張らない（マウント後にのみ document が存在）。
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={dismissOnOverlayClick ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        // パネル自身のクリックは背景に伝播させない（オーバーレイ閉じの誤発火防止）。
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-lg rounded-2xl bg-background p-6 text-foreground shadow-2xl outline-none",
          "max-h-[90dvh] overflow-y-auto",
          className,
        )}
      >
        {title && <h2 className="mb-4 text-xl font-bold">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
