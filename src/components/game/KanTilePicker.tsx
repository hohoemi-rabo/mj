"use client";

// 暗カン/加カンの牌選択（docs/14 §3.6）。候補が複数のとき牌を選ばせる。
// 候補1つなら呼び出し側が確認のうえ即送信し、これは開かれない。

import { type Tile as TileType } from "@/lib/mahjong/tiles";
import { Modal } from "@/components/ui";
import { Tile } from "@/components/game/Tile";

export interface KanCandidate {
  type: "ankan" | "kakan";
  tile: TileType;
}

export interface KanTilePickerProps {
  open: boolean;
  candidates: readonly KanCandidate[];
  onSelect: (candidate: KanCandidate) => void;
  onCancel: () => void;
}

const KAN_LABEL: Record<KanCandidate["type"], string> = {
  ankan: "暗カン",
  kakan: "加カン",
};

export function KanTilePicker({ open, candidates, onSelect, onCancel }: KanTilePickerProps) {
  return (
    <Modal open={open} onClose={onCancel} title="どの牌でカンしますか？">
      <div className="flex flex-col gap-3">
        {candidates.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(c)}
            className="flex min-h-tap items-center justify-center gap-2 rounded-xl border-2 border-gray-400 p-2 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary dark:hover:bg-gray-800"
          >
            <Tile tile={c.tile} size="md" />
            <span className="text-base font-bold">{KAN_LABEL[c.type]}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
