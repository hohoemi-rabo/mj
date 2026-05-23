"use client";

// 「待って」ボタン（docs/14 §3.7）。自手番のみ表示。押すと一時停止オーバーレイを出し、
// 落ち着いて考えられるよう操作を覆って止める。自手番では CPU は元々動かないので実害なし。
// サーバー連動の本当の一時停止（CPU思考の停止）は #16。

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

export interface WaitButtonProps {
  visible: boolean;
}

export function WaitButton({ visible }: WaitButtonProps) {
  const [paused, setPaused] = useState(false);

  // 自手番でなくなったら自動で解除（手番が移ったら待機の意味がない）。
  useEffect(() => {
    if (!visible) setPaused(false);
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <div className="fixed bottom-4 left-4 z-20">
        <Button variant="secondary" size="lg" onClick={() => setPaused(true)}>
          待って
        </Button>
      </div>

      {paused && (
        // 盤面を覆って操作を止める（Modal=z-50 より下。トーストと同層 z-30）。
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black/60 text-center">
          <p className="text-2xl font-bold text-white">考え中…（一時停止）</p>
          <Button variant="primary" size="lg" onClick={() => setPaused(false)}>
            再開する
          </Button>
        </div>
      )}
    </>
  );
}
