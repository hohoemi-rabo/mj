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
  volume: number; // 0..1（既定 中=0.5）
  muted: boolean; // ミュート（既定 false）
  discardConfirm: boolean; // 打牌確認ダイアログ（既定 ON）

  setHelpMode(on: boolean): void;
  toggleHelpMode(): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  toggleMuted(): void;
  setDiscardConfirm(on: boolean): void;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      helpMode: true,
      volume: 0.5,
      muted: false,
      discardConfirm: true,

      setHelpMode: (on) => set({ helpMode: on }),
      toggleHelpMode: () => set((s) => ({ helpMode: !s.helpMode })),
      setVolume: (v) => set({ volume: clamp01(v) }),
      setMuted: (m) => set({ muted: m }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setDiscardConfirm: (on) => set({ discardConfirm: on }),
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
      }),
    },
  ),
);
