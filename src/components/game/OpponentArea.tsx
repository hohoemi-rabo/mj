"use client";

// 他家1人分（docs/14 §3.5）。裏向き手牌（枚数のみ・中身は絶対に渡さない＝情報漏洩防止）、
// 鳴き melds は公開情報なので face-up、名前・持ち点・CPUバッジ・手番枠・リーチ表示。

import { type PlayerState } from "@/lib/mahjong/state";
import { type PlayerInfo } from "@/lib/adapter/types";
import { Tile } from "@/components/game/Tile";
import { meldDisplayTiles } from "@/components/game/meldDisplay";
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

  // 対面は横並び（折返し）、上家/下家は本物の麻雀卓のように縦並びで牌を 90° 回転表示。
  // 回転後の見た目は 40w×30h なので、ラッパで box 寸法を入れ替え（rotate は box 寸法を変えないため）。
  const isSide = position === "left" || position === "right";

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border-2 p-2",
        isCurrent ? "border-primary bg-primary/5" : "border-transparent",
      )}
    >
      {/* ヘッダは2行: 上=風家+名前+CPU、下=点数。狭い枠でも崩れず、シニアにも読みやすい。 */}
      <div className="flex flex-col gap-0.5 whitespace-nowrap leading-tight">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-bold">{windLabel(player.seatWind)}家</span>
          <span className="font-bold">{name}</span>
          {info?.isCpu && (
            <span className="rounded bg-gray-300 px-1.5 text-xs font-bold text-gray-800 dark:bg-gray-600 dark:text-gray-100">
              CPU
            </span>
          )}
        </div>
        <div className="text-base font-bold tabular-nums">
          {player.points.toLocaleString()}点
        </div>
      </div>

      {player.hand.riichi && (
        <span className="self-start rounded bg-danger px-2 py-0.5 text-xs font-bold text-white">
          リーチ
        </span>
      )}

      {/* 裏向き手牌（枚数だけ）。上家/下家は縦並び＋90°回転、対面は横並び折返し。 */}
      {isSide ? (
        <div className="flex flex-col items-center gap-0.5">
          {backs.map((_, i) => (
            <div key={i} className="flex h-[30px] w-[40px] items-center justify-center">
              <Tile faceDown size="sm" rotated />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex max-w-[460px] flex-wrap gap-0.5">
          {backs.map((_, i) => (
            <Tile key={i} faceDown size="sm" />
          ))}
        </div>
      )}

      {/* 鳴き（公開情報・face-up）。読みやすさ優先で常に横並び。
          鳴いた相手の方角に応じて1枚を90°回転＝伝統的な並び。viewer は鳴いた本人(player.seat)。 */}
      {player.hand.melds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {player.hand.melds.map((m, mi) => {
            const display = meldDisplayTiles(m, player.seat);
            return (
              <div key={mi} className="flex items-end gap-0.5">
                {display.map(({ tile, rotated }, ti) =>
                  rotated ? (
                    <div
                      key={ti}
                      className="flex h-[30px] w-[40px] items-center justify-center"
                    >
                      <Tile tile={tile} size="sm" rotated />
                    </div>
                  ) : (
                    <Tile key={ti} tile={tile} size="sm" />
                  ),
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
