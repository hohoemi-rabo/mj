"use client";

// 対局中の BGM ループ再生（#17 拡張）。GameBoard で1回呼ぶ。
// - 対局中（gameState 非null かつ phase!=ended）かつ bgmOn のときだけ再生
// - 音量はマスター音量 × 0.5（BGM は SE/voice より控えめに固定）
// - muted なら 0（停止はせず音量0で素早く戻れるよう）

import { useEffect } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { setBgmVolume, startBgm, stopBgm } from "@/lib/audio/player";
import { BGM } from "@/lib/audio/manifest";

const BGM_LEVEL = 0.5; // SE/voice に対する相対音量

export const useGameBgm = (): void => {
  const gameState = useGameStore((s) => s.gameState);
  const bgmOn = useSettingsStore((s) => s.bgmOn);
  const muted = useSettingsStore((s) => s.muted);
  const volume = useSettingsStore((s) => s.volume);

  useEffect(() => {
    const playing = gameState !== null && gameState.phase.kind !== "ended";
    if (playing && bgmOn) {
      startBgm(BGM.game); // 同IDが既に鳴っていれば no-op（多重防止）
    } else {
      stopBgm();
    }
    setBgmVolume(muted ? 0 : volume * BGM_LEVEL); // 再生中でなければ no-op
  }, [gameState, bgmOn, muted, volume]);
};
