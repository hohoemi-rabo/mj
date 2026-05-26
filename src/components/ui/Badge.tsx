// 小さなピル状ラベル（#18 お助けバッジ等で使う）。提示用・directive なし。
// 高コントラスト固定色＋dark: でモード対応。色のみに頼らず太字＋枠で識別性も確保。

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "primary" | "danger" | "info" | "neutral";

export interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  // 主要（聴牌等の前向き通知）。primary=緑
  primary: "bg-primary text-white",
  // 注意（危険牌等）
  danger: "bg-danger text-white",
  // 情報（役名等）。青系で他と区別。
  info: "bg-blue-600 text-white dark:bg-blue-500",
  // 中立
  neutral:
    "bg-gray-200 text-gray-900 border border-gray-400 dark:bg-gray-700 dark:text-gray-50 dark:border-gray-500",
};

export function Badge({ variant = "neutral", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-bold leading-tight",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
