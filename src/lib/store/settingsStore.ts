// 端末ローカルのUI設定ストア（Zustand persist / docs/12 §3.3,§3.5,§3.7）。
// お助けモード・音量・打牌確認のみ localStorage 永続化（記録なし方針 §4.3 の例外＝端末設定）。
// SSR/Node では window が無いので persist は無効化されメモリ動作になる。

import { create } from "zustand";
import { type StateStorage, createJSONStorage, persist } from "zustand/middleware";

/** Node/SSR では window が無いのでメモリ実装にフォールバック（永続化はしないがクラッシュしない）。 */
const memoryStorage = (): StateStorage => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
  };
};

export interface SettingsStore {
  helpMode: boolean; // お助けモード（既定 ON）
  volume: number; // 0..1（既定 MAX=1.0。シニアのノートPCで本体音量を下げ気味でも聞き取れる前提・mp3の素の音量を最大限活かす）
  muted: boolean; // ミュート（既定 false）
  discardConfirm: boolean; // 打牌確認ダイアログ（既定 ON）
  bgmOn: boolean; // BGM 再生（既定 ON。ミュートとは独立に切替可）

  setHelpMode(on: boolean): void;
  toggleHelpMode(): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  toggleMuted(): void;
  setDiscardConfirm(on: boolean): void;
  setBgmOn(on: boolean): void;
  toggleBgmOn(): void;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      helpMode: true,
      volume: 1.0,
      muted: false,
      discardConfirm: true,
      bgmOn: true,

      setHelpMode: (on) => set({ helpMode: on }),
      toggleHelpMode: () => set((s) => ({ helpMode: !s.helpMode })),
      setVolume: (v) => set({ volume: clamp01(v) }),
      setMuted: (m) => set({ muted: m }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setDiscardConfirm: (on) => set({ discardConfirm: on }),
      setBgmOn: (on) => set({ bgmOn: on }),
      toggleBgmOn: () => set((s) => ({ bgmOn: !s.bgmOn })),
    }),
    {
      name: "mj-settings",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : memoryStorage(),
      ),
      partialize: (s) => ({
        helpMode: s.helpMode,
        volume: s.volume,
        muted: s.muted,
        discardConfirm: s.discardConfirm,
        bgmOn: s.bgmOn,
      }),
      // 既存端末は localStorage の古いデフォルト（0.5 → 一時 0.85）を読み続けるので、version up
      // で MAX=1.0 まで引き上げる。mp3 の素の音量がそもそも控えめなのでクランプ上限まで使う。
      // ユーザーが SettingsModal で個別調整するのは常時可能。
      version: 2,
      migrate: (persisted, fromVersion) => {
        const state = (persisted as Partial<SettingsStore> | undefined) ?? {};
        if (fromVersion < 2 && typeof state.volume === "number" && state.volume < 1.0) {
          return { ...state, volume: 1.0 };
        }
        return state;
      },
    },
  ),
);
