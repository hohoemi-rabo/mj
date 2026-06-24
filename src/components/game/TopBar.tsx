"use client";

// 上部バー（docs/14 §3.7）。ドラ表示＋お助けToggle＋設定ボタン。
// 場風/自風/残り山は CenterPanel に集約済みなので冗長分は持たない（UI集約リワーク Phase 5）。

import { useMemo } from "react";
import { Settings } from "lucide-react";
import { type GameState, doraTiles } from "@/lib/mahjong/state";
import { Toggle } from "@/components/ui";
import { Tile } from "@/components/game/Tile";
import { useSettingsStore } from "@/lib/store/settingsStore";

export interface TopBarProps {
  gameState: GameState;
  onOpenSettings: () => void;
}

export function TopBar({ gameState, onOpenSettings }: TopBarProps) {
  const dora = useMemo(() => doraTiles(gameState), [gameState]);
  const helpMode = useSettingsStore((s) => s.helpMode);
  const toggleHelpMode = useSettingsStore((s) => s.toggleHelpMode);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-gray-100 px-3 py-2 dark:bg-gray-800">
      <div className="flex items-center gap-1">
        <span className="text-sm">ドラ</span>
        {dora.map((t, i) => (
          <Tile key={i} tile={t} size="sm" />
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Toggle
          checked={helpMode}
          onChange={() => toggleHelpMode()}
          label="お助け"
          hint="初心者向けの案内"
        />
        <button
          type="button"
          aria-label="設定"
          onClick={onOpenSettings}
          className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-xl hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary dark:hover:bg-gray-700"
        >
          <Settings className="h-7 w-7" aria-hidden />
        </button>
      </div>
    </div>
  );
}
