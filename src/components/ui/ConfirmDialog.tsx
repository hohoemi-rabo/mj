"use client";

// 確認ダイアログ。Modal 上に構築。打牌確認「この牌を切りますか？」の流用元（§3.7）。
// 純粋な提示部品で設定は参照しない。#14 で「打牌時に useSettingsStore().discardConfirm が true なら表示」
// のように組み合わせる（設定参照と UI を分離して再利用性を保つ）。

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** danger 時は確定ボタンを赤に（取り消し不能な操作向け）。 */
  tone?: "default" | "danger";
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "はい",
  cancelLabel = "いいえ",
  onConfirm,
  onCancel,
  tone = "default",
}: ConfirmDialogProps) {
  return (
    // キャンセル（いいえ）= 閉じると同義。Esc も onCancel に向ける。
    <Modal open={open} onClose={onCancel} title={title}>
      {message && <p className="mb-6 text-base">{message}</p>}
      {/* 大型ボタンを横並び。横画面・縦画面どちらでも押しやすいよう余白を確保。 */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="lg" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          size="lg"
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
