"use client";

// エラートースト（docs/14 §3.10）。lastError を一時表示し自動で消す。
// message はサーバーが日本語化済み（例「その手は出せません」）なのでそのまま出す。

import { useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";

export function ErrorToast() {
  const lastError = useGameStore((s) => s.lastError);
  const clearError = useGameStore((s) => s.clearError);

  useEffect(() => {
    if (!lastError) return;
    const id = setTimeout(() => clearError(), 4000);
    return () => clearTimeout(id);
  }, [lastError, clearError]);

  if (!lastError) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-danger px-6 py-3 text-base font-bold text-white shadow-2xl"
    >
      {lastError.message}
    </div>
  );
}
