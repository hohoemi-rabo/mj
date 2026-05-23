"use client";

// 上部バー（docs/14 §3.7）。局情報（場風/自風/ドラ/残ツモ）＋お助けToggle＋設定ボタン。

import { useMemo } from "react";
import { Settings } from "lucide-react";
import { type GameState, type Seat, doraTiles } from "@/lib/mahjong/state";
import { remainingDraws } from "@/lib/mahjong/wall";
import { Toggle } from "@/components/ui";
import { Tile } from "@/components/game/Tile";
import { windLabel } from "@/components/game/labels";
import { useSettingsStore } from "@/lib/store/settingsStore";

export interface TopBarProps {
  gameState: GameState;
  mySeat: Seat;
  onOpenSettings: () => void;
}

export function TopBar({ gameState, mySeat, onOpenSettings }: TopBarProps) {
  const dora = useMemo(() => doraTiles(gameState), [gameState]);
  const remaining = remainingDraws(gameState.wall);
  const helpMode = useSettingsStore((s) => s.helpMode);
  const toggleHelpMode = useSettingsStore((s) => s.toggleHelpMode);
  const myWind = gameState.players[mySeat].seatWind;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-gray-100 px-3 py-2 dark:bg-gray-800">
      <div className="flex items-center gap-3 text-base">
        <span className="font-bold">場 {windLabel(gameState.roundWind)}</span>
        <span className="font-bold">自風 {windLabel(myWind)}</span>
        <span className="tabular-nums">残り {remaining}</span>
      </div>

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
