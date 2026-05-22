import { describe, it, expect } from "vitest";
import { sortTiles } from "@/lib/mahjong/tiles";
import { type Hand } from "@/lib/mahjong/hand";
import { evaluateYaku, type WinContext } from "@/lib/mahjong/yaku";
import { score, scoreFromYaku, type Payment } from "@/lib/mahjong/score";

// すべて公式点数表で検証済みの既知値（Plan agent が確認）。

const ron = (n: number): Payment => ({ type: "ron", discarder: n });

describe("子（非親）ロン", () => {
  const cases: [number, number, number][] = [
    [1, 30, 1000], [1, 40, 1300], [2, 30, 2000], [2, 40, 2600],
    [3, 30, 3900], [3, 40, 5200], [4, 30, 7700], // 3翻40符はbase1280→5200（4翻30符=base1920→7700と別）
  ];
  it.each(cases)("%i翻%i符 → %i点", (han, fu, pts) => {
    const r = score({ han, fu, isDealer: false, isTsumo: false });
    expect(r.payment).toEqual(ron(pts));
    expect(r.total).toBe(pts);
  });
});

describe("子ツモ", () => {
  it("2翻20符（平和ツモ相当）= 400/700", () => {
    const r = score({ han: 2, fu: 20, isDealer: false, isTsumo: true });
    expect(r.payment).toEqual({ type: "tsumo-nondealer", dealer: 700, nonDealer: 400 });
    expect(r.total).toBe(1500);
  });
  it("4翻20符 = 1300/2600", () => {
    const r = score({ han: 4, fu: 20, isDealer: false, isTsumo: true });
    expect(r.payment).toEqual({ type: "tsumo-nondealer", dealer: 2600, nonDealer: 1300 });
    expect(r.total).toBe(5200);
  });
  it("3翻30符 = 1000/2000", () => {
    const r = score({ han: 3, fu: 30, isDealer: false, isTsumo: true });
    expect(r.payment).toEqual({ type: "tsumo-nondealer", dealer: 2000, nonDealer: 1000 });
    expect(r.total).toBe(4000);
  });
  it("4翻30符 = 2000/3900", () => {
    const r = score({ han: 4, fu: 30, isDealer: false, isTsumo: true });
    expect(r.payment).toEqual({ type: "tsumo-nondealer", dealer: 3900, nonDealer: 2000 });
    expect(r.total).toBe(7900);
  });
});

describe("親ロン", () => {
  it.each([
    [2, 30, 2900], [3, 40, 7700], [4, 30, 11600], // 親3翻40符=base1280→7700 / 4翻30符=base1920→11600
  ] as [number, number, number][])("%i翻%i符 → %i点", (han, fu, pts) => {
    const r = score({ han, fu, isDealer: true, isTsumo: false });
    expect(r.payment).toEqual(ron(pts));
    expect(r.total).toBe(pts);
  });
});

describe("親ツモ", () => {
  it("2翻20符 = 700オール", () => {
    const r = score({ han: 2, fu: 20, isDealer: true, isTsumo: true });
    expect(r.payment).toEqual({ type: "tsumo-dealer", each: 700 });
    expect(r.total).toBe(2100);
  });
  it("4翻30符 = 3900オール", () => {
    const r = score({ han: 4, fu: 30, isDealer: true, isTsumo: true });
    expect(r.payment).toEqual({ type: "tsumo-dealer", each: 3900 });
    expect(r.total).toBe(11700);
  });
});

describe("満貫（5翻）", () => {
  it("子ロン8000", () => {
    const r = score({ han: 5, fu: 30, isDealer: false, isTsumo: false });
    expect(r.limitName).toBe("満貫");
    expect(r.payment).toEqual(ron(8000));
  });
  it("子ツモ 2000/4000（total 8000）", () => {
    const r = score({ han: 5, fu: 20, isDealer: false, isTsumo: true });
    expect(r.payment).toEqual({ type: "tsumo-nondealer", dealer: 4000, nonDealer: 2000 });
    expect(r.total).toBe(8000);
  });
  it("親ロン12000", () => {
    const r = score({ han: 5, fu: 40, isDealer: true, isTsumo: false });
    expect(r.payment).toEqual(ron(12000));
  });
  it("親ツモ 4000オール（total 12000）", () => {
    const r = score({ han: 5, fu: 30, isDealer: true, isTsumo: true });
    expect(r.payment).toEqual({ type: "tsumo-dealer", each: 4000 });
    expect(r.total).toBe(12000);
  });
});

describe("跳満・倍満・三倍満・数え役満", () => {
  it("跳満(6翻) 子ロン12000 / 親ロン18000", () => {
    expect(score({ han: 6, fu: 30, isDealer: false, isTsumo: false }).payment).toEqual(ron(12000));
    const oya = score({ han: 6, fu: 30, isDealer: true, isTsumo: false });
    expect(oya.limitName).toBe("跳満");
    expect(oya.payment).toEqual(ron(18000));
  });
  it("倍満(8翻) 子ロン16000 / 親ロン24000", () => {
    expect(score({ han: 8, fu: 30, isDealer: false, isTsumo: false }).payment).toEqual(ron(16000));
    expect(score({ han: 8, fu: 30, isDealer: true, isTsumo: false }).payment).toEqual(ron(24000));
  });
  it("三倍満(11翻) 子ロン24000 / 親ロン36000", () => {
    expect(score({ han: 11, fu: 30, isDealer: false, isTsumo: false }).payment).toEqual(ron(24000));
    expect(score({ han: 11, fu: 30, isDealer: true, isTsumo: false }).payment).toEqual(ron(36000));
  });
  it("数え役満(13翻) 子ロン32000 / 親ロン48000 / 子ツモ 8000/16000", () => {
    const ko = score({ han: 13, fu: 30, isDealer: false, isTsumo: false });
    expect(ko.limitName).toBe("数え役満");
    expect(ko.payment).toEqual(ron(32000));
    expect(score({ han: 13, fu: 30, isDealer: true, isTsumo: false }).payment).toEqual(ron(48000));
    expect(score({ han: 13, fu: 30, isDealer: false, isTsumo: true }).payment).toEqual({
      type: "tsumo-nondealer", dealer: 16000, nonDealer: 8000,
    });
  });
});

describe("満貫境界（切り上げ満貫なし）", () => {
  it("子30符4翻は7700で満貫ではない（limitName=null）", () => {
    const r = score({ han: 4, fu: 30, isDealer: false, isTsumo: false });
    expect(r.payment).toEqual(ron(7700));
    expect(r.limitName).toBeNull();
  });
  it("親30符4翻は11600で満貫ではない", () => {
    const r = score({ han: 4, fu: 30, isDealer: true, isTsumo: false });
    expect(r.payment).toEqual(ron(11600));
    expect(r.limitName).toBeNull();
  });
  it("子40符4翻はbase2560→2000で満貫", () => {
    const r = score({ han: 4, fu: 40, isDealer: false, isTsumo: false });
    expect(r.base).toBe(2000);
    expect(r.limitName).toBe("満貫");
    expect(r.payment).toEqual(ron(8000));
  });
});

describe("リーチ棒の精算", () => {
  it("子3翻30符ロン＋供託1本 → winnerGain = 3900 + 1000", () => {
    const r = score({ han: 3, fu: 30, isDealer: false, isTsumo: false, riichiSticks: 1 });
    expect(r.total).toBe(3900);
    expect(r.riichiStickPoints).toBe(1000);
    expect(r.winnerGain).toBe(4900);
  });
  it("供託なしは winnerGain = total", () => {
    const r = score({ han: 2, fu: 30, isDealer: false, isTsumo: false });
    expect(r.winnerGain).toBe(2000);
  });
});

describe("ガード", () => {
  it("翻<1 で throw", () => {
    expect(() => score({ han: 0, fu: 30, isDealer: false, isTsumo: false })).toThrow();
  });
  it("符<20 で throw", () => {
    expect(() => score({ han: 2, fu: 10, isDealer: false, isTsumo: false })).toThrow();
  });
});

describe("scoreFromYaku（#06 連携）", () => {
  it("立直+門前ツモ+平和+断幺九 の子ツモを点数化", () => {
    // yaku.test.ts のフラッグシップ手と同じ：m234 p345 s678 p7p7 s345、ツモ s3
    const hand: Hand = {
      concealed: sortTiles(["m2", "m3", "m4", "p3", "p4", "p5", "s6", "s7", "s8", "p7", "p7", "s4", "s5"]),
      melds: [],
      drawn: null,
      riichi: true,
      discards: [],
    };
    const ctx: WinContext = {
      hand, winningTile: "s3", isTsumo: true, seatWind: "z1", roundWind: "z1", doraIndicators: [],
    };
    const y = evaluateYaku(ctx);
    // 立直1+門前ツモ1+平和1+断幺九1 = 4翻、平和ツモ20符
    expect(y.totalHan).toBe(4);
    expect(y.fu).toBe(20);
    const r = scoreFromYaku(y, { isDealer: false });
    // 子4翻20符ツモ = 1300/2600
    expect(r.payment).toEqual({ type: "tsumo-nondealer", dealer: 2600, nonDealer: 1300 });
    expect(r.total).toBe(5200);
  });
});
