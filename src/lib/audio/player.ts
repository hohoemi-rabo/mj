"use client";

// 音声プレイヤー（docs/17 §3.5・§5.4）。singleton 的に使う。
// 失敗（404／autoplay ブロック／不在 mp3）は**握りつぶしてゲーム継続**。
// mp3 を後から `public/audio/` に置けば自動で鳴り出す（manifest と一致するファイル名であれば）。

import { useSettingsStore } from "@/lib/store/settingsStore";

/** `manifest.ts` の ID（例: "voice/tsumo"） → `/audio/{id}.mp3`。 */
const srcOf = (id: string): string => `/audio/${id}.mp3`;

const cache = new Map<string, HTMLAudioElement>();

const getAudio = (id: string): HTMLAudioElement | null => {
  if (typeof window === "undefined") return null; // SSR 安全策
  let a = cache.get(id);
  if (!a) {
    a = new Audio(srcOf(id));
    a.preload = "auto";
    cache.set(id, a);
  }
  return a;
};

/**
 * 1音を再生する。ミュート時は no-op。終了 or エラーで解決する Promise を返す。
 * 失敗は throw しない（404・autoplay ブロック等は静かに無視）。
 */
export const play = (id: string): Promise<void> =>
  new Promise<void>((resolve) => {
    const { volume, muted } = useSettingsStore.getState();
    if (muted) {
      resolve();
      return;
    }
    const audio = getAudio(id);
    if (!audio) {
      resolve();
      return;
    }
    audio.volume = Math.max(0, Math.min(1, volume));
    const cleanup = (): void => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onErr);
    };
    const onEnded = (): void => {
      cleanup();
      resolve();
    };
    const onErr = (): void => {
      cleanup();
      resolve(); // 失敗は握りつぶす（次の音はスキップせず鳴らせるよう resolve）
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onErr);
    try {
      audio.currentTime = 0;
    } catch {
      /* 一部ブラウザで読み込み前は throw する */
    }
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.catch(() => {
        cleanup();
        resolve();
      });
    }
  });

/** 複数音を順番に再生（前が終わってから次）。失敗は無視して次へ。 */
export const playSequence = async (ids: readonly string[]): Promise<void> => {
  for (const id of ids) {
    await play(id);
  }
};

/** Audio 要素だけ先に作って `load()`（任意の事前ロード）。 */
export const preload = (ids: readonly string[]): void => {
  if (typeof window === "undefined") return;
  for (const id of ids) {
    const a = getAudio(id);
    a?.load();
  }
};
