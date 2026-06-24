"use client";

// 他家1人分（docs/14 §3.5）。裏向き手牌（枚数のみ・中身は絶対に渡さない＝情報漏洩防止）と、
// 公開情報の鳴き(face-up)・リーチ表示のみ。風家/名前/CPU/点数/手番枠は CenterPanel に集約済み（Phase 2）。

import { type PlayerState } from "@/lib/mahjong/state";
import { Tile } from "@/components/game/Tile";
import { meldDisplayTiles } from "@/components/game/meldDisplay";

export interface OpponentAreaProps {
  player: PlayerState;
  position: "top" | "left" | "right";
}

export function OpponentArea({ player, position }: OpponentAreaProps) {
  // 裏向き枚数 = 純手牌 + ツモ牌（中身は描かない）。
  const backCount = player.hand.concealed.length + (player.hand.drawn ? 1 : 0);
  const backs = Array.from({ length: backCount });

  // 対面は横並び（折返し）、上家/下家は本物の麻雀卓のように縦並びで牌を 90° 回転表示。
  // 回転後の見た目は 40w×30h なので、ラッパで box 寸法を入れ替え（rotate は box 寸法を変えないため）。
  const isSide = position === "left" || position === "right";

  return (
    <div className="flex flex-col gap-1 p-2">
      {player.hand.riichi && (
        <span className="self-start rounded bg-danger px-2 py-0.5 text-xs font-bold text-white">
          リーチ
        </span>
      )}

      {/* 裏向き手牌（枚数だけ）。上家/下家は縦並び＋90°回転、対面は横並び折返し。
          牌同士は隙間なしで詰める＝伝統的な手牌の見た目。 */}
      {isSide ? (
        <div className="flex flex-col items-center">
          {backs.map((_, i) => (
            <div key={i} className="flex h-[30px] w-[40px] items-center justify-center">
              <Tile faceDown size="sm" rotated />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex max-w-[460px] flex-wrap">
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
              <div key={mi} className="flex items-end">
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
