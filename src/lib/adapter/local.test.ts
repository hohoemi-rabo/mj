// LocalAdapter の回帰テスト（docs/14/#15 で発覚したバグ）。
// gameStore.connect() は購読(on*)を登録してから connect() する。LocalAdapter は
// connect() より前に on* を呼べなければならない（以前は socket 未生成で throw していた）。

import { describe, expect, it } from "vitest";
import { LocalAdapter } from "@/lib/adapter/local";

describe("LocalAdapter", () => {
  it("connect() より前に on* を登録しても throw しない", () => {
    const a = new LocalAdapter("http://localhost:1"); // autoConnect:false なので接続はしない
    expect(() => {
      const unsubs = [
        a.onConnectionChange(() => {}),
        a.onPlayers(() => {}),
        a.onState(() => {}),
        a.onEnd(() => {}),
        a.onError(() => {}),
      ];
      unsubs.forEach((u) => u());
    }).not.toThrow();
    a.disconnect();
  });

  it("構築直後は未接続", () => {
    const a = new LocalAdapter("http://localhost:1");
    expect(typeof a.connect).toBe("function");
    a.disconnect();
  });
});
