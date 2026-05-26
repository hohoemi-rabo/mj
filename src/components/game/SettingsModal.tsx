"use client";

// 設定モーダル（docs/14 §3.5/§3.7・#17）。お助け・打牌確認・ミュート・音量・音の動作確認。
// すべて useSettingsStore に接続（localStorage 永続）。音量/ミュートは player.ts が毎再生で参照。

import { Button, Modal, Toggle } from "@/components/ui";
import { play } from "@/lib/audio/player";
import { SFX } from "@/lib/audio/manifest";
import { useSettingsStore } from "@/lib/store/settingsStore";

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const helpMode = useSettingsStore((s) => s.helpMode);
  const discardConfirm = useSettingsStore((s) => s.discardConfirm);
  const muted = useSettingsStore((s) => s.muted);
  const volume = useSettingsStore((s) => s.volume);
  const bgmOn = useSettingsStore((s) => s.bgmOn);
  const setHelpMode = useSettingsStore((s) => s.setHelpMode);
  const setDiscardConfirm = useSettingsStore((s) => s.setDiscardConfirm);
  const setMuted = useSettingsStore((s) => s.setMuted);
  const setVolume = useSettingsStore((s) => s.setVolume);
  const setBgmOn = useSettingsStore((s) => s.setBgmOn);

  return (
    <Modal open={open} onClose={onClose} title="設定">
      <div className="flex flex-col gap-2">
        <Toggle checked={helpMode} onChange={setHelpMode} label="お助けモード" hint="初心者向けの案内を表示" />
        <Toggle checked={discardConfirm} onChange={setDiscardConfirm} label="打牌確認" hint="牌を切る前に確認する" />
        <Toggle checked={muted} onChange={setMuted} label="ミュート" hint="音を消す" />
        <Toggle checked={bgmOn} onChange={setBgmOn} label="BGM" hint="対局中の音楽を鳴らす" />

        <label className="flex min-h-tap items-center justify-between gap-4 rounded-xl px-3 py-2">
          <span className="text-base">音量</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={volume}
            disabled={muted}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-2 w-40 cursor-pointer disabled:opacity-50"
            aria-label="音量"
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-foreground/70">
            音が鳴らない場合は mp3 が未配置です（ゲームは無音で続行）。
          </span>
          <Button variant="secondary" size="default" onClick={() => void play(SFX.discard)}>
            音を試す
          </Button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="primary" size="lg" onClick={onClose}>
          閉じる
        </Button>
      </div>
    </Modal>
  );
}
