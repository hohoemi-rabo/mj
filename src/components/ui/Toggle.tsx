"use client";

// トグルスイッチ（お助けモード・打牌確認・ミュート等の設定用）。制御コンポーネント。
// アクセシビリティ: role="switch" / aria-checked、ラベルクリック・Space/Enter で切替。
// useSettingsStore の helpMode/discardConfirm/muted にそのまま接続できる形（接続は呼び出し側）。

import { useId } from "react";
import { Term } from "@/components/ui/Term";
import { cn } from "@/lib/cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** ラベルのカッコ補足（例「待ち牌を色分け表示」）。 */
  hint?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  id,
  className,
}: ToggleProps) {
  const autoId = useId();
  const labelId = id ?? autoId;

  return (
    // ラベル全体を 60px 級のタップ領域に。ラベルクリックでも切り替わる。
    <label
      htmlFor={labelId}
      className={cn(
        "flex min-h-tap cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2",
        "hover:bg-gray-100",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span className="text-base">
        <Term word={label} hint={hint} />
      </span>
      <button
        id={labelId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          // トラック。ON=primary・OFF=グレーで高コントラスト。
          "relative inline-flex h-9 w-16 shrink-0 items-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2",
          checked
            ? "bg-primary focus-visible:ring-primary"
            : "bg-gray-400 focus-visible:ring-gray-500",
          disabled && "cursor-not-allowed",
        )}
      >
        {/* つまみ */}
        <span
          aria-hidden
          className={cn(
            "inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-8" : "translate-x-1",
          )}
        />
      </button>
    </label>
  );
}
