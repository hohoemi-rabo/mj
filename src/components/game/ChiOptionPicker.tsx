"use client";

// チーの組合せ選択（docs/14 §3.6）。複数候補があるとき、どの2枚で順子を作るかを実牌で選ばせる。
// 候補1通りなら呼び出し側（ActionButtons）が即送信し、これは開かれない。

import { type Tile as TileType } from "@/lib/mahjong/tiles";
import { Modal } from "@/components/ui";
import { Tile } from "@/components/game/Tile";

export interface ChiOptionPickerProps {
  open: boolean;
  options: readonly [TileType, TileType][];
  calledTile: TileType | null; // 鳴く相手の捨て牌（表示用）
  onSelect: (option: [TileType, TileType]) => void;
  onCancel: () => void;
}

export function ChiOptionPicker({
  open,
  options,
  calledTile,
  onSelect,
  onCancel,
}: ChiOptionPickerProps) {
  return (
    <Modal open={open} onClose={onCancel} title="どの形でチーしますか？">
      <div className="flex flex-col gap-3">
        {options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(opt)}
            className="flex min-h-tap items-center justify-center gap-1 rounded-xl border-2 border-gray-400 p-2 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary dark:hover:bg-gray-800"
          >
            <Tile tile={opt[0]} size="md" />
            <Tile tile={opt[1]} size="md" />
            {calledTile && (
              <span className="ml-1">
                <Tile tile={calledTile} size="md" highlight="wait" />
              </span>
            )}
          </button>
        ))}
      </div>
    </Modal>
  );
}
