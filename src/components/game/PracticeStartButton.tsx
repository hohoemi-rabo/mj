"use client";

// 練習開始導線（docs/14 §2）。#15 の部屋作成/入室UIが未実装なので、当面の起動口。
// connect → createRoom("あなた") → start({fillWithCpu, weak}) → /room/[id] へ遷移。
// createRoom/start は throw せず lastError をセットするため、各段で roomId/lastError を確認する。

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { LocalAdapter } from "@/lib/adapter/local";
import { useGameStore } from "@/lib/store/gameStore";

export function PracticeStartButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "starting" | "error">("idle");

  const startPractice = async () => {
    setStatus("starting");
    const store = useGameStore.getState();
    try {
      if (store.connection !== "connected") {
        await store.connect(new LocalAdapter());
      }
      store.clearError();
      await store.createRoom("あなた");
      const roomId = useGameStore.getState().roomId;
      if (!roomId || useGameStore.getState().lastError) {
        setStatus("error");
        return;
      }
      await store.start({ fillWithCpu: true, cpuStrength: "weak" });
      if (useGameStore.getState().lastError) {
        setStatus("error");
        return;
      }
      // start の game:state はソケット経由で非同期到着。盤面は GameBoard 側で待つ。
      router.push(`/room/${roomId}`);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant="primary"
        size="lg"
        onClick={startPractice}
        disabled={status === "starting"}
      >
        {status === "starting" ? "準備中…" : "ひとりで練習（CPU3人と対戦）"}
      </Button>
      {status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {useGameStore.getState().lastError?.message ?? "開始できませんでした"}。もう一度お試しください。
        </p>
      )}
    </div>
  );
}
