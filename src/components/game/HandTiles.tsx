"use client";

// 自分の手牌（docs/14 §3.3）。concealed＋drawn（ツモ牌は離して表示）＋melds（face-up）。
// tap 可否は合法手駆動: 通常は discards、リーチselect中は riichiDiscards のみ。お助けで強調。
// 実際の打牌確認/送信は GameBoard（onTileClick で通知）。
// 自手番のハイライトは CenterPanel に集約。ここではツモ牌のみ「ツモ」ラベル＋ring で強調（初心者向け）。

import { type Hand } from "@/lib/mahjong/hand";
import { type LegalActions, type Seat } from "@/lib/mahjong/state";
import { type Tile as TileType } from "@/lib/mahjong/tiles";
import { Tile, type TileHighlight } from "@/components/game/Tile";
import { meldDisplayTiles } from "@/components/game/meldDisplay";

export interface HandTilesProps {
  hand: Hand;
  /** 自席（鳴き表示の方角計算に使う）。 */
  mySeat: Seat;
  legal: LegalActions | null;
  riichiSelect: boolean;
  helpMode: boolean;
  tenpaiKeep: ReadonlySet<TileType>;
  onTileClick: (tile: TileType) => void;
}

export function HandTiles({
  hand,
  mySeat,
  legal,
  riichiSelect,
  helpMode,
  tenpaiKeep,
  onTileClick,
}: HandTilesProps) {
  const riichiSet = new Set(legal?.riichiDiscards ?? []);
  const discardSet = new Set(legal?.discards ?? []);
  const selectableSet = riichiSelect ? riichiSet : discardSet;
  const isMyDiscardTurn = (legal?.discards.length ?? 0) > 0;

  const highlightOf = (tile: TileType, selectable: boolean): TileHighlight => {
    if (!helpMode || !selectable) return "none";
    if (riichiSet.has(tile)) return "riichi"; // リーチ可能牌
    if (tenpaiKeep.has(tile)) return "tenpai-keep"; // 切ってもテンパイ維持
    return "none";
  };

  const renderTile = (tile: TileType, key: string) => {
    const selectable = selectableSet.has(tile);
    return (
      <Tile
        key={key}
        tile={tile}
        size="lg"
        selectable={selectable}
        disabled={isMyDiscardTurn && !selectable}
        highlight={highlightOf(tile, selectable)}
        onClick={() => onTileClick(tile)}
      />
    );
  };

  return (
    <div className="flex items-end justify-center gap-1">
      {/* 純手牌 */}
      <div className="flex items-end gap-0.5">
        {hand.concealed.map((t, i) => renderTile(t, `c${i}`))}
      </div>

      {/* ツモ牌: 「ツモ」ラベル＋amber リングで「いま引いた牌」を視覚分離（初心者向け）。 */}
      {hand.drawn && (
        <div className="ml-4 flex flex-col items-center gap-1">
          <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">
            ツモ
          </span>
          <div className="rounded-xl ring-4 ring-amber-400 ring-offset-2 ring-offset-transparent">
            {renderTile(hand.drawn, "drawn")}
          </div>
        </div>
      )}

      {/* 鳴き（face-up・選択不可）。鳴いた相手の方角に応じて1枚を90°回転＝伝統的な並び。
          回転牌は size=md の box が 60w×45h に入れ替わるので、items-end でほかの直立牌(60h)と底揃え。 */}
      {hand.melds.length > 0 && (
        <div className="ml-4 flex items-end gap-1">
          {hand.melds.map((m, mi) => {
            const display = meldDisplayTiles(m, mySeat);
            return (
              <div key={mi} className="flex items-end gap-0.5">
                {display.map(({ tile, rotated }, ti) =>
                  rotated ? (
                    <div
                      key={ti}
                      className="flex h-[45px] w-[60px] items-center justify-center"
                    >
                      <Tile tile={tile} size="md" rotated />
                    </div>
                  ) : (
                    <Tile key={ti} tile={tile} size="md" />
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
