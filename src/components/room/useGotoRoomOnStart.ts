"use client";

// 対局開始（gameState 到着）を検知してロビーから対局画面 /room/[id] へ遷移する（docs/15）。
// ホスト（開始ボタン押下）・ゲスト（ホストが開始）の両方で使う。

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";

export const useGotoRoomOnStart = (): void => {
  const router = useRouter();
  const gameState = useGameStore((s) => s.gameState);
  const roomId = useGameStore((s) => s.roomId);

  useEffect(() => {
    if (gameState && roomId) router.push(`/room/${roomId}`);
  }, [gameState, roomId, router]);
};
