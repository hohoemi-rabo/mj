"use client";

// gameState の差分から音声・効果音を発火するフック（docs/17）。GameBoard で1回呼ぶ。
// 差分検知は `lib/audio/events` の純関数、再生は `lib/audio/player`。

import { useEffect, useRef } from "react";
import { type GameState } from "@/lib/mahjong/state";
import { useGameStore } from "@/lib/store/gameStore";
import { type AudioEvent, detectAudioEvents } from "@/lib/audio/events";
import { play, playSequence } from "@/lib/audio/player";
import { LIMIT_FILE, SFX, VOICE, YAKU_FILE } from "@/lib/audio/manifest";

const fireEvent = (e: AudioEvent): void => {
  switch (e.kind) {
    case "shuffle":
      void play(SFX.shuffle);
      return;
    case "discard":
      void play(SFX.discard);
      return;
    case "riichi":
      void playSequence([SFX.riichi, VOICE.riichi]);
      return;
    case "meld": {
      const voice = e.type === "chi" ? VOICE.chi : e.type === "pon" ? VOICE.pon : VOICE.kan;
      void playSequence([SFX.meld, voice]);
      return;
    }
    case "win": {
      const ids: string[] = [];
      for (const w of e.result.winners) ids.push(w.isTsumo ? VOICE.tsumo : VOICE.ron);
      ids.push(SFX.applause);
      for (const w of e.result.winners) {
        for (const y of w.yaku) {
          const id = YAKU_FILE[y.name];
          if (id) ids.push(id);
        }
        if (w.limitName) {
          const lid = LIMIT_FILE[w.limitName];
          if (lid) ids.push(lid);
        }
      }
      void playSequence(ids);
      return;
    }
    case "ryuukyoku":
      void play(VOICE.ryuukyoku);
      return;
  }
};

export const useGameEventAudio = (): void => {
  const gameState = useGameStore((s) => s.gameState);
  const prevRef = useRef<GameState | null>(null);

  useEffect(() => {
    if (gameState === null) {
      prevRef.current = null; // タイトル復帰等でリセット（次の開始で shuffle が鳴る）
      return;
    }
    const events = detectAudioEvents(prevRef.current, gameState);
    prevRef.current = gameState;
    for (const e of events) fireEvent(e);
  }, [gameState]);
};
