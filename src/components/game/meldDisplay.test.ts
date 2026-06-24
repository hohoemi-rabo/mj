import { describe, expect, it } from "vitest";
import { meldDisplayTiles } from "@/components/game/meldDisplay";
import { type Meld } from "@/lib/mahjong/hand";

const pon = (from: number): Meld => ({
  type: "pon",
  tiles: ["m5", "m5", "m5"],
  calledTile: "m5",
  from,
});

const chi = (from: number, called: "m4" | "m5" | "m6"): Meld => ({
  type: "chi",
  tiles: ["m4", "m5", "m6"],
  calledTile: called,
  from,
});

const minkan = (from: number): Meld => ({
  type: "minkan",
  tiles: ["s7", "s7", "s7", "s7"],
  calledTile: "s7",
  from,
});

const ankan: Meld = {
  type: "ankan",
  tiles: ["z5", "z5", "z5", "z5"],
  calledTile: null,
  from: null,
};

describe("meldDisplayTiles", () => {
  it("ポン: 上家(rel=3)から → 左端を回転", () => {
    const r = meldDisplayTiles(pon(3), 0);
    expect(r.map((t) => t.rotated)).toEqual([true, false, false]);
  });

  it("ポン: 対面(rel=2)から → 2番目を回転", () => {
    const r = meldDisplayTiles(pon(2), 0);
    expect(r.map((t) => t.rotated)).toEqual([false, true, false]);
  });

  it("ポン: 下家(rel=1)から → 右端を回転", () => {
    const r = meldDisplayTiles(pon(1), 0);
    expect(r.map((t) => t.rotated)).toEqual([false, false, true]);
  });

  it("チー: 常に上家。calledTile を左端へ移動して回転、残りはソート順", () => {
    // m5 を鳴いた → [m5回転, m4, m6]
    const r = meldDisplayTiles(chi(3, "m5"), 0);
    expect(r).toEqual([
      { tile: "m5", rotated: true },
      { tile: "m4", rotated: false },
      { tile: "m6", rotated: false },
    ]);
  });

  it("チー: m4 を鳴いた → [m4回転, m5, m6]", () => {
    const r = meldDisplayTiles(chi(3, "m4"), 0);
    expect(r).toEqual([
      { tile: "m4", rotated: true },
      { tile: "m5", rotated: false },
      { tile: "m6", rotated: false },
    ]);
  });

  it("大明槓: 4枚並び、対面(rel=2)から → 2番目を回転", () => {
    const r = meldDisplayTiles(minkan(2), 0);
    expect(r.map((t) => t.rotated)).toEqual([false, true, false, false]);
  });

  it("大明槓: 下家(rel=1)から → 末尾を回転", () => {
    const r = meldDisplayTiles(minkan(1), 0);
    expect(r.map((t) => t.rotated)).toEqual([false, false, false, true]);
  });

  it("暗槓: 回転なし", () => {
    const r = meldDisplayTiles(ankan, 0);
    expect(r.every((t) => !t.rotated)).toBe(true);
  });

  it("viewerSeat が変わると相対方角も変わる", () => {
    // from=2 を seat=1 から見ると rel=1 (下家) → 右端を回転
    const r = meldDisplayTiles(pon(2), 1);
    expect(r.map((t) => t.rotated)).toEqual([false, false, true]);
  });
});
