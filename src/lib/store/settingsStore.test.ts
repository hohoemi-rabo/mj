import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "@/lib/store/settingsStore";

beforeEach(() => {
  useSettingsStore.setState({ helpMode: true, volume: 0.5, muted: false, discardConfirm: true });
});

describe("settingsStore 既定値", () => {
  it("お助けON・音量0.5・ミュートoff・打牌確認ON", () => {
    const s = useSettingsStore.getState();
    expect(s.helpMode).toBe(true);
    expect(s.volume).toBe(0.5);
    expect(s.muted).toBe(false);
    expect(s.discardConfirm).toBe(true);
  });
});

describe("settingsStore 操作", () => {
  it("お助けトグル", () => {
    useSettingsStore.getState().toggleHelpMode();
    expect(useSettingsStore.getState().helpMode).toBe(false);
  });
  it("音量は 0..1 にクランプ", () => {
    useSettingsStore.getState().setVolume(1.5);
    expect(useSettingsStore.getState().volume).toBe(1);
    useSettingsStore.getState().setVolume(-1);
    expect(useSettingsStore.getState().volume).toBe(0);
    useSettingsStore.getState().setVolume(0.3);
    expect(useSettingsStore.getState().volume).toBe(0.3);
  });
  it("ミュート/打牌確認の切替", () => {
    useSettingsStore.getState().toggleMuted();
    expect(useSettingsStore.getState().muted).toBe(true);
    useSettingsStore.getState().setDiscardConfirm(false);
    expect(useSettingsStore.getState().discardConfirm).toBe(false);
  });
});
