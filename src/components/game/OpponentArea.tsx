"use client";

// 他家1人分（docs/14 §3.5）。裏向き手牌（枚数のみ・中身は絶対に渡さない＝情報漏洩防止）、
// 鳴き melds は公開情報なので face-up、名前・持ち点・CPUバッジ・手番枠・リーチ表示。

import { type PlayerState } from "@/lib/mahjong/state";
import { type PlayerInfo } from "@/lib/adapter/types";
import { Tile } from "@/components/game/Tile";
import { windLabel } from "@/components/game/labels";
import { cn } from "@/lib/cn";

export interface OpponentAreaProps {
  player: PlayerState;
  info?: PlayerInfo;
  isCurrent: boolean;
  position: "top" | "left" | "right";
}

export function OpponentArea({ player, info, isCurrent, position }: OpponentAreaProps) {
  // 裏向き枚数 = 純手牌 + ツモ牌（中身は描かない）。
  const backCount = player.hand.concealed.length + (player.hand.drawn ? 1 : 0);
  const backs = Array.from({ length: backCount });
  const name = info?.name ?? `席${player.seat}`;

  // 上は横並び、左右は少し細めに折り返す。
  const maxW = position === "top" ? "max-w-[460px]" : "max-w-[180px]";

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border-2 p-2",
        isCurrent ? "border-primary bg-primary/5" : "border-transparent",
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="font-bold">{windLabel(player.seatWind)}</span>
        <span className="font-bold">{name}</span>
        {info?.isCpu && (
          <span className="rounded bg-gray-300 px-1 text-xs text-gray-800 dark:bg-gray-600 dark:text-gray-100">
            CPU
          </span>
        )}
        <span className="ml-auto tabular-nums">{player.points}点</span>
      </div>

      {player.hand.riichi && (
        <span className="self-start rounded bg-danger px-2 py-0.5 text-xs font-bold text-white">
          リーチ
        </span>
      )}

      {/* 裏向き手牌（枚数だけ） */}
      <div className={cn("flex flex-wrap gap-0.5", maxW)}>
        {backs.map((_, i) => (
          <Tile key={i} faceDown size="sm" />
        ))}
      </div>

      {/* 鳴き（公開情報・face-up） */}
      {player.hand.melds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {player.hand.melds.map((m, mi) => (
            <div key={mi} className="flex gap-0.5">
              {m.tiles.map((t, ti) => (
                <Tile key={ti} tile={t} size="sm" />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
