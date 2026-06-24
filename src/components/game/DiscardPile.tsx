"use client";

// 1席分の河（捨て牌）。6枚/行で折り返す。リーチ宣言牌は横向き、ツモ切りは淡いマーク。
// お助けON時は他家河で自分の当たり牌を 'wait' ハイライト（#18）。

import { type Discard } from "@/lib/mahjong/hand";
import { type Tile as TileType } from "@/lib/mahjong/tiles";
import { Tile } from "@/components/game/Tile";
import { cn } from "@/lib/cn";

export interface DiscardPileProps {
  discards: readonly Discard[];
  /** 当たり牌集合（お助けON時のみ、他家河に渡す）。 */
  helpHighlight?: ReadonlySet<TileType>;
  className?: string;
}

export function DiscardPile({ discards, helpHighlight, className }: DiscardPileProps) {
  // 幅は枚数によらず常に 6 列分（30px×6 + 2px×5 gap = 190px）を確保。
  // これがないと RiverGrid 側の auto 列が捨て牌の枚数で伸縮し、左右の捨て牌枚数が違う
  // 1巡目に中央パネルが横にずれる（2巡目以降は枚数差が縮まって見た目には収まる）。
  return (
    <div className={cn("grid grid-cols-6 gap-0.5 min-w-[190px]", className)}>
      {discards.map((d, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-center",
            // ツモ切りは下に淡いドット（色のみに頼らず位置でも区別）。
            d.tsumogiri && "border-b-2 border-gray-400",
          )}
        >
          <Tile
            tile={d.tile}
            size="sm"
            rotated={d.riichi}
            highlight={helpHighlight?.has(d.tile) ? "wait" : "none"}
          />
        </div>
      ))}
    </div>
  );
}
