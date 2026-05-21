import { describe, it, expect } from "vitest";
import {
  ALL_TILES,
  ALL_136,
  TILE_COUNT,
  TILE_NAMES,
  type Tile,
  suitOf,
  rankOf,
  isHonor,
  isNumber,
  isTerminal,
  isTerminalOrHonor,
  isSimple,
  isWind,
  isDragon,
  compareTiles,
  sortTiles,
  tileToIndex,
  tileFromIndex,
  tileName,
  doraFromIndicator,
} from "@/lib/mahjong/tiles";

describe("枚数", () => {
  it("ALL_TILES は34種・ユニーク", () => {
    expect(ALL_TILES).toHaveLength(34);
    expect(new Set(ALL_TILES).size).toBe(34);
    expect(TILE_COUNT).toBe(34);
  });

  it("ALL_136 は136枚で各種ちょうど4枚", () => {
    expect(ALL_136).toHaveLength(136);
    const tally = new Map<Tile, number>();
    for (const t of ALL_136) tally.set(t, (tally.get(t) ?? 0) + 1);
    expect(tally.size).toBe(34);
    for (const t of ALL_TILES) expect(tally.get(t)).toBe(4);
  });
});

describe("正準順", () => {
  it("先頭・境界の並びが正しい", () => {
    expect(ALL_TILES[0]).toBe("m1");
    expect(ALL_TILES[8]).toBe("m9");
    expect(ALL_TILES[9]).toBe("p1");
    expect(ALL_TILES[17]).toBe("p9");
    expect(ALL_TILES[18]).toBe("s1");
    expect(ALL_TILES[26]).toBe("s9");
    expect(ALL_TILES[27]).toBe("z1");
    expect(ALL_TILES[33]).toBe("z7");
  });
});

describe("抽出", () => {
  it("suitOf / rankOf / isHonor", () => {
    expect(suitOf("m5")).toBe("m");
    expect(suitOf("z3")).toBe("z");
    expect(rankOf("p7")).toBe(7);
    expect(rankOf("z6")).toBe(6);
    expect(isHonor("z1")).toBe(true);
    expect(isHonor("s9")).toBe(false);
  });
});

describe("述語（境界込み真理値表）", () => {
  it("isNumber", () => {
    for (const t of ["m1", "m9", "p5", "s1"] as Tile[]) expect(isNumber(t)).toBe(true);
    for (const t of ["z1", "z5", "z7"] as Tile[]) expect(isNumber(t)).toBe(false);
  });
  it("isTerminal", () => {
    for (const t of ["m1", "m9", "p1", "p9", "s1", "s9"] as Tile[]) expect(isTerminal(t)).toBe(true);
    for (const t of ["m2", "m8", "s5", "z1", "z7"] as Tile[]) expect(isTerminal(t)).toBe(false);
  });
  it("isTerminalOrHonor", () => {
    for (const t of ["m1", "m9", "z1", "z4", "z5", "z7"] as Tile[]) expect(isTerminalOrHonor(t)).toBe(true);
    for (const t of ["m2", "m8", "s5"] as Tile[]) expect(isTerminalOrHonor(t)).toBe(false);
  });
  it("isSimple", () => {
    for (const t of ["m2", "m8", "p2", "s8"] as Tile[]) expect(isSimple(t)).toBe(true);
    for (const t of ["m1", "m9", "z1", "z5"] as Tile[]) expect(isSimple(t)).toBe(false);
  });
  it("isWind", () => {
    for (const t of ["z1", "z2", "z3", "z4"] as Tile[]) expect(isWind(t)).toBe(true);
    for (const t of ["z5", "z6", "z7", "m1"] as Tile[]) expect(isWind(t)).toBe(false);
  });
  it("isDragon", () => {
    for (const t of ["z5", "z6", "z7"] as Tile[]) expect(isDragon(t)).toBe(true);
    for (const t of ["z1", "z4", "p1"] as Tile[]) expect(isDragon(t)).toBe(false);
  });

  it("全34種で述語の整合性が保たれる", () => {
    for (const t of ALL_TILES) {
      expect(isNumber(t)).toBe(!isHonor(t));
      expect(isTerminalOrHonor(t)).toBe(isTerminal(t) || isHonor(t));
      expect(isSimple(t)).toBe(isNumber(t) && !isTerminal(t));
      expect(isWind(t) && isDragon(t)).toBe(false);
    }
  });
});

describe("index 変換", () => {
  it("全34種で round-trip が成立する", () => {
    for (const t of ALL_TILES) {
      expect(tileFromIndex(tileToIndex(t))).toBe(t);
    }
  });
  it("代表 index", () => {
    expect(tileToIndex("m1")).toBe(0);
    expect(tileToIndex("z7")).toBe(33);
    expect(tileFromIndex(9)).toBe("p1");
  });
  it("範囲外・非整数は throw", () => {
    expect(() => tileFromIndex(-1)).toThrow(RangeError);
    expect(() => tileFromIndex(34)).toThrow(RangeError);
    expect(() => tileFromIndex(1.5)).toThrow(RangeError);
  });
});

describe("ソート", () => {
  it("シャッフル列を正準順に並べ、入力は破壊しない", () => {
    const input: Tile[] = ["z7", "m1", "s5", "p2", "z1", "m9", "s1", "p9", "z5"];
    const snapshot = [...input];
    const expected: Tile[] = ["m1", "m9", "p2", "p9", "s1", "s5", "z1", "z5", "z7"];
    expect(sortTiles(input)).toEqual(expected);
    expect(input).toEqual(snapshot); // 非破壊
  });
  it("正準順は idempotent、compareTiles は符号が正しい", () => {
    expect(sortTiles(ALL_TILES)).toEqual([...ALL_TILES]);
    expect(compareTiles("m1", "m2")).toBeLessThan(0);
    expect(compareTiles("z1", "s9")).toBeGreaterThan(0);
    expect(compareTiles("p5", "p5")).toBe(0);
  });
});

describe("ドラ（表ドラ）", () => {
  it("数牌は次の数、9は1に戻る", () => {
    expect(doraFromIndicator("m3")).toBe("m4");
    expect(doraFromIndicator("p5")).toBe("p6");
    expect(doraFromIndicator("s8")).toBe("s9");
    expect(doraFromIndicator("m9")).toBe("m1");
    expect(doraFromIndicator("p9")).toBe("p1");
    expect(doraFromIndicator("s9")).toBe("s1");
  });
  it("風は東→南→西→北→東", () => {
    expect(doraFromIndicator("z1")).toBe("z2");
    expect(doraFromIndicator("z3")).toBe("z4");
    expect(doraFromIndicator("z4")).toBe("z1");
  });
  it("三元は白→發→中→白", () => {
    expect(doraFromIndicator("z5")).toBe("z6");
    expect(doraFromIndicator("z6")).toBe("z7");
    expect(doraFromIndicator("z7")).toBe("z5");
  });
  it("風と三元は別サイクル（北は白に回らない）", () => {
    expect(doraFromIndicator("z4")).not.toBe("z5");
  });
});

describe("表示名", () => {
  it("字牌7種が確定文字列に一致", () => {
    expect(tileName("z1")).toBe("東（ひがし）");
    expect(tileName("z2")).toBe("南（みなみ）");
    expect(tileName("z3")).toBe("西（にし）");
    expect(tileName("z4")).toBe("北（きた）");
    expect(tileName("z5")).toBe("白（はく）");
    expect(tileName("z6")).toBe("發（はつ）");
    expect(tileName("z7")).toBe("中（ちゅん）");
  });
  it("数牌は漢数字＋読み仮名", () => {
    expect(tileName("m1")).toBe("一萬（いちマン）");
    expect(tileName("p5")).toBe("五筒（ごピン）");
    expect(tileName("s9")).toBe("九索（きゅうソー）");
  });
  it("TILE_NAMES は34キーで空値なし", () => {
    expect(Object.keys(TILE_NAMES)).toHaveLength(34);
    for (const t of ALL_TILES) {
      expect(TILE_NAMES[t]).toBeTruthy();
    }
  });
});
