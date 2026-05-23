"use client";

// 1席分の河（捨て牌）。6枚/行で折り返す。リーチ宣言牌は横向き、ツモ切りは淡いマーク。
// 当たり牌の色分け（他家河）は #18。ここでは基本表示のみ。

import { type Discard } from "@/lib/mahjong/hand";
import { Tile } from "@/components/game/Tile";
import { cn } from "@/lib/cn";

export interface DiscardPileProps {
  discards: readonly Discard[];
  className?: string;
}

export function DiscardPile({ discards, className }: DiscardPileProps) {
  return (
    <div className={cn("grid grid-cols-6 gap-0.5", className)}>
      {discards.map((d, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-center",
            // ツモ切りは下に淡いドット（色のみに頼らず位置でも区別）。
            d.tsumogiri && "border-b-2 border-gray-400",
          )}
        >
          <Tile tile={d.tile} size="sm" rotated={d.riichi} />
        </div>
      ))}
    </div>
  );
}
