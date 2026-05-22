import { describe, it, expect } from "vitest";
import { type Tile } from "@/lib/mahjong/tiles";
import { createHand, drawTile, callPon, discard } from "@/lib/mahjong/hand";
import {
  toCounts,
  shanten,
  shantenNormal,
  shantenChiitoitsu,
  waits,
  ukeire,
  handShanten,
  handWaits,
  handUkeire,
} from "@/lib/mahjong/shanten";

// 代表手牌（すべて手計算で期待値を確認済み）
const COMPLETE: Tile[] = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "p1", "p1", "s5", "s5", "s5"];
const TENPAI_RYANMEN: Tile[] = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "p1", "p1", "s5", "s6"];
const TENPAI_TANKI: Tile[] = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "s1", "s2", "s3", "p5"];
const TENPAI_KANCHAN: Tile[] = ["m1", "m2", "m3", "m4", "m5", "m6", "p1", "p1", "s1", "s3", "s7", "s8", "s9"];
const TENPAI_SHANPON: Tile[] = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "p1", "p1", "s5", "s5"];
const ONE_SHANTEN: Tile[] = ["m1", "m2", "m3", "m4", "m5", "m6", "p1", "p1", "s4", "s5", "s7", "s8", "z1"];
// 2面子+雀頭+1塔子+孤立牌 → 8-4-1-1=2（debugで検証済み）
const TWO_SHANTEN: Tile[] = ["m1", "m2", "m3", "m9", "p4", "p5", "p6", "p9", "s1", "s2", "s9", "z5", "z5"];
// 1面子+3塔子・雀頭なし・字牌4枚は孤立（字牌は順子にならない）→ 8-2-3-0=3
const THREE_SHANTEN: Tile[] = ["m1", "m2", "m3", "m4", "m5", "p1", "p2", "s5", "s6", "z1", "z2", "z3", "z7"];
const NO_PAIR_5BLOCKS: Tile[] = ["m1", "m2", "m3", "p4", "p5", "p6", "s7", "s8", "s9", "m5", "m6", "p2", "p3"];

describe("通常形シャンテン", () => {
  it("完成形は -1", () => {
    expect(shanten(COMPLETE)).toBe(-1);
  });
  it("両面聴牌は 0", () => {
    expect(shanten(TENPAI_RYANMEN)).toBe(0);
  });
  it("単騎聴牌は 0", () => {
    expect(shanten(TENPAI_TANKI)).toBe(0);
  });
  it("嵌張聴牌は 0", () => {
    expect(shanten(TENPAI_KANCHAN)).toBe(0);
  });
  it("シャンポン聴牌は 0", () => {
    expect(shanten(TENPAI_SHANPON)).toBe(0);
  });
  it("1向聴", () => {
    expect(shanten(ONE_SHANTEN)).toBe(1);
  });
  it("2向聴", () => {
    expect(shanten(TWO_SHANTEN)).toBe(2);
  });
  it("3向聴（字牌は順子にならないので z1z2z3 は面子化しない）", () => {
    expect(shanten(THREE_SHANTEN)).toBe(3);
  });
  it("3面子+両面2・雀頭なしは 1（雀頭なし5ブロックの回帰）", () => {
    expect(shanten(NO_PAIR_5BLOCKS)).toBe(1);
  });
});

describe("スーツ境界・字牌で順子/塔子を作らない", () => {
  it("m8 m9 p1 をまたいだ順子を作らない（=7、6ではない）", () => {
    // 誤って m8m9p1 を順子扱いすると 6 になる。正しくは m8m9 塔子 + p1 浮き = 7。
    expect(shantenNormal(toCounts(["m8", "m9", "p1"]), 0)).toBe(7);
  });
  it("字牌は順子にならない（z1 z2 z3 = 8）", () => {
    expect(shantenNormal(toCounts(["z1", "z2", "z3"]), 0)).toBe(8);
  });
});

describe("七対子シャンテン", () => {
  it("6対子+単騎は 0", () => {
    const tiles: Tile[] = ["m1", "m1", "m2", "m2", "m3", "m3", "p4", "p4", "p5", "p5", "s6", "s6", "s7"];
    expect(shantenChiitoitsu(toCounts(tiles))).toBe(0);
    expect(shanten(tiles)).toBe(0);
  });
  it("3枚含み（種類不足）は重複減点で 1", () => {
    const tiles: Tile[] = ["m1", "m1", "m1", "m2", "m2", "m3", "m3", "p4", "p4", "p5", "p5", "s6", "s6"];
    expect(shantenChiitoitsu(toCounts(tiles))).toBe(1);
  });
  it("4対子は 2", () => {
    const tiles: Tile[] = ["m1", "m1", "m2", "m2", "m3", "m3", "p4", "p4", "p5", "s6", "s7", "s8", "z1"];
    expect(shantenChiitoitsu(toCounts(tiles))).toBe(2);
  });
  it("13種バラバラは 6", () => {
    const tiles: Tile[] = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "p1", "p2", "p3", "p4"];
    expect(shantenChiitoitsu(toCounts(tiles))).toBe(6);
  });
});

describe("副露（鳴き）考慮", () => {
  it("2副露で聴牌（meldCount=2）", () => {
    const concealed: Tile[] = ["m1", "m2", "m3", "p5", "p5", "s6", "s7"]; // 7枚
    expect(shanten(concealed, 2)).toBe(0);
    expect(waits(concealed, 2)).toEqual(["s5", "s8"]);
  });
  it("1副露で1向聴（meldCount=1）", () => {
    const concealed: Tile[] = ["m1", "m2", "m3", "m4", "m5", "p1", "p1", "s4", "s5", "z7"]; // 10枚
    expect(shanten(concealed, 1)).toBe(1);
  });
  it("副露ありでは七対子を考慮しない（通常形のみ）", () => {
    // 通常形では高シャンテンだが、七対子が誤適用されないことの確認
    const concealed: Tile[] = ["m1", "m1", "m2", "m2", "p3", "p3", "s4"]; // 7枚, 2副露想定
    expect(shanten(concealed, 2)).toBe(shantenNormal(toCounts(concealed), 2));
  });
});

describe("待ち牌", () => {
  it("両面は2種", () => {
    expect(waits(TENPAI_RYANMEN)).toEqual(["s4", "s7"]);
  });
  it("単騎は1種", () => {
    expect(waits(TENPAI_TANKI)).toEqual(["p5"]);
  });
  it("嵌張は1種", () => {
    expect(waits(TENPAI_KANCHAN)).toEqual(["s2"]);
  });
  it("シャンポンは2種", () => {
    expect(waits(TENPAI_SHANPON)).toEqual(["p1", "s5"]);
  });
  it("非聴牌は []", () => {
    expect(waits(ONE_SHANTEN)).toEqual([]);
  });
});

describe("受け入れ（有効牌）", () => {
  it("単騎 p5 は1種・残3枚", () => {
    expect(ukeire(TENPAI_TANKI)).toEqual({ tiles: ["p5"], count: 3 });
  });
  it("両面 s5s6 は s4/s7・残8枚", () => {
    expect(ukeire(TENPAI_RYANMEN)).toEqual({ tiles: ["s4", "s7"], count: 8 });
  });
  it("1向聴の受け入れ種別と総数", () => {
    expect(ukeire(ONE_SHANTEN)).toEqual({ tiles: ["s3", "s6", "s9"], count: 12 });
  });
});

describe("ガード（3n+1 形・ツモ後）", () => {
  it("ukeire/waits に14枚（3n+2）を渡すと throw", () => {
    const fourteen: Tile[] = [...TENPAI_RYANMEN, "z1"];
    expect(() => ukeire(fourteen)).toThrow();
    expect(() => waits(fourteen)).toThrow();
  });
});

describe("Hand ラッパ", () => {
  it("handShanten / handWaits（門前聴牌）", () => {
    const h = createHand(TENPAI_RYANMEN);
    expect(handShanten(h)).toBe(0);
    expect(handWaits(h)).toEqual(["s4", "s7"]);
  });

  it("handWaits / handUkeire はツモ後（drawn!=null）で throw", () => {
    const h = drawTile(createHand(TENPAI_RYANMEN), "z1");
    expect(() => handWaits(h)).toThrow();
    expect(() => handUkeire(h)).toThrow();
  });

  it("ポン後は副露を考慮（打牌して13枚形にすると聴牌・待ち列挙）", () => {
    let h = createHand(["m1", "m2", "m3", "m4", "m5", "m6", "p5", "p5", "s6", "s7", "z1", "z1", "z2"]);
    h = callPon(h, "p5", 1); // p5×2 を消費・1副露（打牌前の14枚相当）
    expect(handShanten(h)).toBe(0);
    h = discard(h, "z2"); // 13枚形へ
    expect(handShanten(h)).toBe(0);
    expect(handWaits(h)).toEqual(["s5", "s8"]);
  });
});
