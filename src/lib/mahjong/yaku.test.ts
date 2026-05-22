import { describe, it, expect } from "vitest";
import { type Honor, type Tile, sortTiles } from "@/lib/mahjong/tiles";
import { type Hand, type Meld } from "@/lib/mahjong/hand";
import { evaluateYaku, computeFu, type WinContext } from "@/lib/mahjong/yaku";

interface CtxOpts {
  melds?: Meld[];
  riichi?: boolean;
  tsumo?: boolean;
  seat?: Honor;
  round?: Honor;
  dora?: Tile[];
}

const ctx = (concealed: Tile[], winningTile: Tile, opts: CtxOpts = {}): WinContext => {
  const hand: Hand = {
    concealed: sortTiles(concealed),
    melds: opts.melds ?? [],
    drawn: null,
    riichi: opts.riichi ?? false,
    discards: [],
  };
  return {
    hand,
    winningTile,
    isTsumo: opts.tsumo ?? false,
    seatWind: opts.seat ?? "z1",
    roundWind: opts.round ?? "z1",
    doraIndicators: opts.dora ?? [],
  };
};

const names = (r: { yaku: readonly { name: string }[] }): string[] =>
  r.yaku.map((y) => y.name).slice().sort();

/** 期待役名も同じ規則で整列して順序非依存に比較する。 */
const sorted = (a: string[]): string[] => a.slice().sort();

const pon = (t: Tile, from: number): Meld => ({ type: "pon", tiles: [t, t, t], calledTile: t, from });
const chi = (a: Tile, b: Tile, c: Tile, called: Tile, from: number): Meld => ({
  type: "chi", tiles: sortTiles([a, b, c]), calledTile: called, from,
});

describe("単独役（1翻）", () => {
  it("立直のみ（嵌張・端牌入りで平和/タンヤオを排除）", () => {
    // m234 m678 p456 s789 z2z2、ロン m7（嵌張）
    const r = evaluateYaku(ctx(
      ["m2", "m3", "m4", "m6", "m8", "p4", "p5", "p6", "s7", "s8", "s9", "z2", "z2"],
      "m7", { riichi: true, seat: "z1", round: "z1" },
    ));
    expect(names(r)).toEqual(["立直"]);
    expect(r.totalHan).toBe(1);
    expect(r.hasYaku).toBe(true);
  });

  it("門前清自摸和のみ（同形をツモ）", () => {
    const r = evaluateYaku(ctx(
      ["m2", "m3", "m4", "m6", "m8", "p4", "p5", "p6", "s7", "s8", "s9", "z2", "z2"],
      "m7", { tsumo: true },
    ));
    expect(names(r)).toEqual(["門前清自摸和"]);
    expect(r.totalHan).toBe(1);
  });

  it("平和のみ（全順子・両面・非役牌雀頭・端牌でタンヤオ排除）", () => {
    // m234 m567 p456 s678 s9s9、ロン m5（両面）
    const r = evaluateYaku(ctx(
      ["m2", "m3", "m4", "m6", "m7", "p4", "p5", "p6", "s6", "s7", "s8", "s9", "s9"],
      "m5", {},
    ));
    expect(names(r)).toEqual(["平和"]);
    expect(r.totalHan).toBe(1);
    expect(r.fu).toBe(30); // 平和ロン
  });

  it("断幺九のみ（刻子で平和を排除・門前ロン）", () => {
    // m222 p345 s678 p7p7 s345、ロン s5
    const r = evaluateYaku(ctx(
      ["m2", "m2", "m2", "p3", "p4", "p5", "s6", "s7", "s8", "p7", "p7", "s3", "s4"],
      "s5", {},
    ));
    expect(names(r)).toEqual(["断幺九"]);
    expect(r.totalHan).toBe(1);
  });

  it("役牌 白（明ポンz5・開でも成立）", () => {
    const r = evaluateYaku(ctx(
      ["m1", "m2", "m3", "p4", "p5", "p6", "s7", "s8", "p9", "p9"],
      "s9", { melds: [pon("z5", 1)] },
    ));
    expect(names(r)).toEqual(["役牌 白"]);
    expect(r.totalHan).toBe(1);
  });

  it("一盃口（門前・同一順子2組・単騎で平和排除）", () => {
    // m234 m234 p567 s789 z3z3、ロン z3（単騎）
    const r = evaluateYaku(ctx(
      ["m2", "m3", "m4", "m2", "m3", "m4", "p5", "p6", "p7", "s7", "s8", "s9", "z3"],
      "z3", {},
    ));
    expect(names(r)).toEqual(["一盃口"]);
    expect(r.totalHan).toBe(1);
  });
});

describe("連風", () => {
  it("自風=場風=東 の東刻 → 自風東+場風東=2翻", () => {
    const r = evaluateYaku(ctx(
      ["m2", "m3", "m4", "p4", "p5", "p6", "s7", "s8", "p2", "p2"],
      "s9", { melds: [pon("z1", 2)], seat: "z1", round: "z1" },
    ));
    expect(names(r)).toEqual(sorted(["自風 東", "場風 東"]));
    expect(r.totalHan).toBe(2);
  });
});

describe("2翻役", () => {
  it("三色同順（門前2）", () => {
    // m345 p345 s345 m789 z2z2、ロン z2（単騎）
    const r = evaluateYaku(ctx(
      ["m3", "m4", "m5", "p3", "p4", "p5", "s3", "s4", "s5", "m7", "m8", "m9", "z2"],
      "z2", {},
    ));
    expect(names(r)).toEqual(["三色同順"]);
    expect(r.totalHan).toBe(2);
  });

  it("三色同順（喰い下がり1・チーで開）", () => {
    const r = evaluateYaku(ctx(
      ["p3", "p4", "p5", "s3", "s4", "s5", "m7", "m8", "m9", "z2"],
      "z2", { melds: [chi("m3", "m4", "m5", "m5", 3)] },
    ));
    expect(names(r)).toEqual(["三色同順"]);
    expect(r.totalHan).toBe(1);
  });

  it("一気通貫（門前2）", () => {
    const r = evaluateYaku(ctx(
      ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "p4", "p5", "p6", "z3"],
      "z3", {},
    ));
    expect(names(r)).toEqual(["一気通貫"]);
    expect(r.totalHan).toBe(2);
  });

  it("対々和＋役牌白（明ポン2つ・シャンポンロン）", () => {
    // pon白 pon s2 / m555 s999(ロン) p7p7
    const r = evaluateYaku(ctx(
      ["m5", "m5", "m5", "p7", "p7", "s9", "s9"],
      "s9", { melds: [pon("z5", 1), pon("s2", 2)] },
    ));
    expect(names(r)).toEqual(sorted(["役牌 白", "対々和"]));
    expect(r.totalHan).toBe(3);
  });

  it("七対子", () => {
    const r = evaluateYaku(ctx(
      ["m1", "m1", "m4", "m4", "p2", "p2", "p6", "p6", "s3", "s3", "s8", "s8", "z6"],
      "z6", {},
    ));
    expect(names(r)).toEqual(["七対子"]);
    expect(r.totalHan).toBe(2);
    expect(r.fu).toBe(25);
    expect(r.decomposition.kind).toBe("chiitoitsu");
  });
});

describe("3翻・6翻役", () => {
  it("混一色（門前3）＋役牌白＋一気通貫（m123/456/789）", () => {
    // m123 m456 m789 z555 z3z3、ロン z3（単騎）。m が一気通貫を構成する点に注意。
    const r = evaluateYaku(ctx(
      ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "z5", "z5", "z5", "z3"],
      "z3", {},
    ));
    expect(names(r)).toEqual(sorted(["役牌 白", "混一色", "一気通貫"]));
    expect(r.totalHan).toBe(6); // 混一色3 + 一気通貫2 + 役牌白1
  });

  it("清一色＋一盃口（門前6+1）", () => {
    // m222 m345 m345 m678 m99、ロン m5
    const r = evaluateYaku(ctx(
      ["m2", "m2", "m2", "m3", "m4", "m6", "m7", "m8", "m9", "m9", "m3", "m4", "m5"],
      "m5", {},
    ));
    expect(names(r)).toEqual(sorted(["一盃口", "清一色"]));
    expect(r.totalHan).toBe(7);
  });

  it("混一色（喰い下がり2・明ポンで開）＋役牌白", () => {
    // pon白 / m234 m567 m888(シャンポンロン) z2z2、ロン m8
    const r = evaluateYaku(ctx(
      ["m2", "m3", "m4", "m5", "m6", "m7", "m8", "m8", "z2", "z2"],
      "m8", { melds: [pon("z5", 1)] },
    ));
    expect(names(r)).toEqual(sorted(["役牌 白", "混一色"]));
    expect(r.totalHan).toBe(3); // 混一色(開)2 + 役牌白1
  });

  it("清一色（喰い下がり5・チーで開）", () => {
    const r = evaluateYaku(ctx(
      ["m2", "m2", "m2", "m6", "m7", "m8", "m9", "m9", "m3", "m4"],
      "m5", { melds: [chi("m3", "m4", "m5", "m5", 3)] },
    ));
    expect(names(r)).toEqual(["清一色"]);
    expect(r.totalHan).toBe(5);
  });
});

describe("複合フラッグシップ", () => {
  it("立直+門前清自摸和+平和+断幺九+ドラ1 = 5翻", () => {
    // m234 p345 s678 p7p7 s345、ツモ s3、ドラ表示 s2(→ドラ s3)
    const r = evaluateYaku(ctx(
      ["m2", "m3", "m4", "p3", "p4", "p5", "s6", "s7", "s8", "p7", "p7", "s4", "s5"],
      "s3", { riichi: true, tsumo: true, dora: ["s2"] },
    ));
    expect(names(r)).toEqual(sorted(["立直", "断幺九", "平和", "門前清自摸和"]));
    expect(r.doraCount).toBe(1);
    expect(r.totalHan).toBe(5);
    expect(r.fu).toBe(20); // 平和ツモ
  });
});

describe("役なし・ドラ単独では和了不可", () => {
  it("開・役なし手はドラがあっても hasYaku=false", () => {
    // chi m234 pon s5 / p456 s789 m1m1、ロン s9、ドラ表示 s8(→ドラ s9)
    const r = evaluateYaku(ctx(
      ["p4", "p5", "p6", "s7", "s8", "m1", "m1"],
      "s9", { melds: [chi("m2", "m3", "m4", "m4", 1), pon("s5", 2)], dora: ["s8"] },
    ));
    expect(r.yaku).toEqual([]);
    expect(r.hasYaku).toBe(false);
    expect(r.doraCount).toBe(1);
  });
});

describe("最大翻の選択", () => {
  it("二盃口形は七対子(2)+断幺九(1)=3 を選ぶ（標準解の一盃口=2より高い）", () => {
    const r = evaluateYaku(ctx(
      ["m2", "m2", "m3", "m3", "m4", "m4", "p2", "p2", "p3", "p3", "p4", "p4", "s5"],
      "s5", {},
    ));
    expect(names(r)).toEqual(sorted(["七対子", "断幺九"]));
    expect(r.totalHan).toBe(3);
    expect(r.decomposition.kind).toBe("chiitoitsu");
  });
});

describe("符（喰いタン・喰い平和形）", () => {
  it("喰いタン＋喰い平和形ロンは20符", () => {
    // chi m234 / p345 s678 s2s2 m567、ロン m7（両面・開）
    const r = evaluateYaku(ctx(
      ["p3", "p4", "p5", "s6", "s7", "s8", "s2", "s2", "m5", "m6"],
      "m7", { melds: [chi("m2", "m3", "m4", "m4", 1)] },
    ));
    expect(names(r)).toEqual(["断幺九"]);
    expect(r.totalHan).toBe(1);
    expect(r.fu).toBe(20);
  });
});

describe("computeFu 直接", () => {
  it("七対子は25符固定", () => {
    const c = ctx(
      ["m1", "m1", "m4", "m4", "p2", "p2", "p6", "p6", "s3", "s3", "s8", "s8", "z6"],
      "z6", {},
    );
    const r = evaluateYaku(c);
    expect(computeFu(r.decomposition, c)).toBe(25);
  });
});
