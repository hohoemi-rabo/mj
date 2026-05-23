"use client";

// 自分の手牌（docs/14 §3.3）。concealed＋drawn（ツモ牌は離して表示）＋melds（face-up）。
// tap 可否は合法手駆動: 通常は discards、リーチselect中は riichiDiscards のみ。お助けで強調。
// 実際の打牌確認/送信は GameBoard（onTileClick で通知）。

import { type Hand } from "@/lib/mahjong/hand";
import { type LegalActions } from "@/lib/mahjong/state";
import { type Tile as TileType } from "@/lib/mahjong/tiles";
import { Tile, type TileHighlight } from "@/components/game/Tile";

export interface HandTilesProps {
  hand: Hand;
  legal: LegalActions | null;
  riichiSelect: boolean;
  helpMode: boolean;
  tenpaiKeep: ReadonlySet<TileType>;
  onTileClick: (tile: TileType) => void;
}

export function HandTiles({
  hand,
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

      {/* ツモ牌（少し離す） */}
      {hand.drawn && <div className="ml-3">{renderTile(hand.drawn, "drawn")}</div>}

      {/* 鳴き（face-up・選択不可） */}
      {hand.melds.length > 0 && (
        <div className="ml-4 flex items-end gap-1">
          {hand.melds.map((m, mi) => (
            <div key={mi} className="flex gap-0.5">
              {m.tiles.map((t, ti) => (
                <Tile key={ti} tile={t} size="md" />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
