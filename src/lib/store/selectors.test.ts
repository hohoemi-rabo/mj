// お助けモード関連の純ヘルパテスト（#18）。
// tenpaiKeepDiscards / waitsAfterDiscard（#14 で追加・未テスト）と
// selectMyWaits / currentlyPossibleYaku（#18 新規）を網羅。

import { describe, expect, it } from "vitest";
import { type Hand, type Meld } from "@/lib/mahjong/hand";
import { type Honor, type Tile, sortTiles } from "@/lib/mahjong/tiles";
import {
  currentlyPossibleYaku,
  selectMyWaits,
  tenpaiKeepDiscards,
  waitsAfterDiscard,
} from "@/lib/store/selectors";

// 手牌のテスト用ファクトリ。Hand は読み取り専用な構造データなので直接組む。
const mkHand = (
  concealed: Tile[],
  opts?: { melds?: Meld[]; drawn?: Tile | null; riichi?: boolean },
): Hand => ({
  concealed: sortTiles(concealed),
  melds: opts?.melds ?? [],
  drawn: opts?.drawn ?? null,
  discards: [],
  riichi: opts?.riichi ?? false,
});

// テンパイの定型: m1m1 / m2m3m4 / p2p3p4 / s5s6s7 / p7p8（p6 or p9 待ち）の13枚
const TENPAI_13: Tile[] = ["m1", "m1", "m2", "m3", "m4", "p2", "p3", "p4", "s5", "s6", "s7", "p7", "p8"];

describe("tenpaiKeepDiscards（#14 既存ヘルパ）", () => {
  it("drawn===null かつ 3n+1 形（次のツモ待ち）は空集合", () => {
    const h = mkHand(TENPAI_13);
    expect(tenpaiKeepDiscards(h).size).toBe(0);
  });
  it("テンパイ手にツモを加えた14枚手で、テンパイ維持となる切り牌を返す", () => {
    // ツモ p6（=和了牌）→ どれを切ってもテンパイ維持 or 上がりが選べる
    // 簡単化のため、無関係な牌をツモった例で確認：drawn=z5 → z5を切るとテンパイ維持
    const h = mkHand(TENPAI_13, { drawn: "z5" });
    const keep = tenpaiKeepDiscards(h);
    expect(keep.has("z5")).toBe(true); // ツモ切りで元のテンパイに戻る
  });
  it("ポン直後（3n+2形・drawn=null）も「打牌が必要」な状態として扱い、テンパイ維持の切り牌を返す", () => {
    // 鳴き×1 + 純手牌 11 枚。p3 をポンで使った想定で、ここから z5 を切れば
    // m1m1 / m2m3m4 / p2p3p4 / p7p8 + ポン s9s9s9 のテンパイ（p6/p9 待ち）が残る。
    const pon: Meld = { type: "pon", tiles: ["s9", "s9", "s9"], calledTile: "s9", from: 1 };
    const afterPon = mkHand(
      ["m1", "m1", "m2", "m3", "m4", "p2", "p3", "p4", "p7", "p8", "z5"],
      { melds: [pon] },
    );
    expect(() => tenpaiKeepDiscards(afterPon)).not.toThrow();
    const keep = tenpaiKeepDiscards(afterPon);
    expect(keep.has("z5")).toBe(true);
  });
  it("null は空", () => {
    expect(tenpaiKeepDiscards(null).size).toBe(0);
  });
});

describe("waitsAfterDiscard（#14 既存ヘルパ）", () => {
  it("drawn===null は空（14枚手でないと判定不能）", () => {
    expect(waitsAfterDiscard(mkHand(TENPAI_13), "p7")).toEqual([]);
  });
  it("テンパイ維持となる切り方の待ち牌を返す", () => {
    const h = mkHand(TENPAI_13, { drawn: "z5" });
    // z5 ツモ切りで p6/p9 待ち（両面）
    const waits = waitsAfterDiscard(h, "z5");
    expect(new Set(waits)).toEqual(new Set<Tile>(["p6", "p9"]));
  });
  it("テンパイ崩れの切り方は空", () => {
    const h = mkHand(TENPAI_13, { drawn: "z5" });
    // p2 を切るとテンパイ崩れ
    expect(waitsAfterDiscard(h, "p2")).toEqual([]);
  });
});

describe("selectMyWaits（#18 新規）", () => {
  it("drawn!==null（自分の打牌待ち）は空", () => {
    const h = mkHand(TENPAI_13, { drawn: "z5" });
    expect(selectMyWaits(h).size).toBe(0);
  });
  it("非テンパイは空", () => {
    const h = mkHand(["m1", "p2", "p5", "s3", "s7", "z1", "z2", "z3", "z4", "z5", "z6", "z7", "m9"]);
    expect(selectMyWaits(h).size).toBe(0);
  });
  it("テンパイ13枚手では handWaits と一致した集合を返す", () => {
    const h = mkHand(TENPAI_13);
    const waits = selectMyWaits(h);
    expect(waits).toEqual(new Set<Tile>(["p6", "p9"]));
  });
  it("null は空", () => {
    expect(selectMyWaits(null).size).toBe(0);
  });
  it("ポン直後の打牌待ち（3n+2形・concealed=11）でも throw せず空を返す（リグレッション）", () => {
    // 鳴き×1 + 純手牌 11 枚（13 - ポンで使った 2 枚）。drawn=null だが「打牌が必要」な状態。
    const pon: Meld = { type: "pon", tiles: ["s9", "s9", "s9"], calledTile: "s9", from: 1 };
    const afterPon = mkHand(
      ["m1", "m1", "m2", "m3", "m4", "p2", "p3", "p4", "p5", "p7", "p8"],
      { melds: [pon] },
    );
    expect(() => selectMyWaits(afterPon)).not.toThrow();
    expect(selectMyWaits(afterPon).size).toBe(0);
  });
  it("チー直後の打牌待ち（3n+2形・concealed=11）でも throw しない（ポンと同形）", () => {
    const chi: Meld = { type: "chi", tiles: ["s7", "s8", "s9"], calledTile: "s9", from: 3 };
    const afterChi = mkHand(
      ["m1", "m1", "m2", "m3", "m4", "p2", "p3", "p4", "p5", "p7", "p8"],
      { melds: [chi] },
    );
    expect(() => selectMyWaits(afterChi)).not.toThrow();
    expect(selectMyWaits(afterChi).size).toBe(0);
  });
  it("カン直後（嶺上ツモ前・3n+1形・concealed=10）も throw せず、テンパイなら待ち牌を返す", () => {
    // 大明槓 s9 + 純手牌 10 枚で p6/p9 待ちのテンパイ（m1m1 / m2m3m4 / p2p3p4 / p7p8）。
    // この形は嶺上ツモ前の瞬間（concealed=10, drawn=null, meldCount=1 → 10+3=13 = 3n+1）。
    const minkan: Meld = {
      type: "minkan",
      tiles: ["s9", "s9", "s9", "s9"],
      calledTile: "s9",
      from: 1,
    };
    const afterMinkan = mkHand(
      ["m1", "m1", "m2", "m3", "m4", "p2", "p3", "p4", "p7", "p8"],
      { melds: [minkan] },
    );
    expect(() => selectMyWaits(afterMinkan)).not.toThrow();
    expect(selectMyWaits(afterMinkan)).toEqual(new Set<Tile>(["p6", "p9"]));
  });
  it("カン後の打牌待ち（嶺上ツモ後・3n+2形・concealed=10+drawn）でも throw しない", () => {
    const minkan: Meld = {
      type: "minkan",
      tiles: ["s9", "s9", "s9", "s9"],
      calledTile: "s9",
      from: 1,
    };
    const afterRinshan = mkHand(
      ["m1", "m1", "m2", "m3", "m4", "p2", "p3", "p4", "p7", "p8"],
      { melds: [minkan], drawn: "z5" },
    );
    // 嶺上ツモ後は drawn!==null＝3n+2形 → selectMyWaits は空、tenpaiKeepDiscards が打牌候補を返す。
    expect(selectMyWaits(afterRinshan).size).toBe(0);
    expect(() => tenpaiKeepDiscards(afterRinshan)).not.toThrow();
    expect(tenpaiKeepDiscards(afterRinshan).has("z5")).toBe(true);
  });
});

describe("currentlyPossibleYaku（#18 新規ヒューリスティック）", () => {
  const z1: Honor = "z1";
  it("null/空手は空", () => {
    expect(currentlyPossibleYaku(null, z1, z1)).toEqual([]);
  });

  it("リーチ済みなら 立直", () => {
    const h = mkHand(TENPAI_13, { riichi: true });
    expect(currentlyPossibleYaku(h, z1, z1)).toContain("立直");
  });

  it("門前手なら 門前清自摸和 を含む（鳴きあり手は含まない）", () => {
    const menzen = mkHand(TENPAI_13);
    expect(currentlyPossibleYaku(menzen, z1, z1)).toContain("門前清自摸和");
    // 鳴き入り
    const pon: Meld = { type: "pon", tiles: ["s9", "s9", "s9"], calledTile: "s9", from: 1 };
    const open = mkHand(["m1", "m1", "m2", "m3", "m4", "p2", "p3", "p4", "p7", "p8"], { melds: [pon] });
    expect(currentlyPossibleYaku(open, z1, z1)).not.toContain("門前清自摸和");
  });

  it("全牌が中張牌なら 断幺九 を含む（端牌があると含まない）", () => {
    const tanyao = mkHand(["m2", "m3", "m4", "p2", "p3", "p4", "p5", "p6", "s5", "s6", "s7", "s4", "s4"]);
    expect(currentlyPossibleYaku(tanyao, z1, z1)).toContain("断幺九");
    // m1（端牌）が混ざる
    const notTanyao = mkHand(["m1", "m2", "m3", "p4", "p5", "p6", "s5", "s6", "s7", "p2", "p3", "s4", "s4"]);
    expect(currentlyPossibleYaku(notTanyao, z1, z1)).not.toContain("断幺九");
  });

  it("数牌1スーツのみ：字牌なしで 清一色、字牌ありで 混一色", () => {
    const chin = mkHand(["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m2", "m3", "m4", "m5"]);
    expect(currentlyPossibleYaku(chin, z1, z1)).toContain("清一色");
    expect(currentlyPossibleYaku(chin, z1, z1)).not.toContain("混一色");
    const hon = mkHand(["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "z1", "z1", "z5", "z5"]);
    expect(currentlyPossibleYaku(hon, z1, z1)).toContain("混一色");
    expect(currentlyPossibleYaku(hon, z1, z1)).not.toContain("清一色");
  });

  it("七対子：門前・鳴きなし・2枚種数≥5", () => {
    // 6対子 + 1単（13枚）
    const chiitoi = mkHand(["m1", "m1", "p2", "p2", "s3", "s3", "z1", "z1", "z5", "z5", "m9", "m9", "p7"]);
    expect(currentlyPossibleYaku(chiitoi, z1, z1)).toContain("七対子");
    // 鳴きが入ると不可
    const pon: Meld = { type: "pon", tiles: ["s9", "s9", "s9"], calledTile: "s9", from: 1 };
    const open = mkHand(["m1", "m1", "p2", "p2", "s3", "s3", "z1", "z1", "z5", "z5"], { melds: [pon] });
    expect(currentlyPossibleYaku(open, z1, z1)).not.toContain("七対子");
  });

  it("対々和：鳴き刻子 + 純手牌の3枚一致 ≥ 2", () => {
    const pon: Meld = { type: "pon", tiles: ["s9", "s9", "s9"], calledTile: "s9", from: 1 };
    // 鳴き×1 + 純手牌に刻子×1 → 計2 で対々和
    const h = mkHand(["m1", "m1", "m1", "p5", "p6", "p7", "z5", "z5", "s3", "s3"], { melds: [pon] });
    expect(currentlyPossibleYaku(h, z1, z1)).toContain("対々和");
  });

  it("役牌 白：z5 が 2 枚以上で含む", () => {
    const h = mkHand(["z5", "z5", "m1", "m2", "m3", "p4", "p5", "p6", "s7", "s8", "s9", "p2", "p3"]);
    expect(currentlyPossibleYaku(h, z1, z1)).toContain("役牌 白");
    // 1枚なら含まない
    const one = mkHand(["z5", "z6", "m1", "m2", "m3", "p4", "p5", "p6", "s7", "s8", "s9", "p2", "p3"]);
    expect(currentlyPossibleYaku(one, z1, z1)).not.toContain("役牌 白");
  });

  it("自風・場風：seatWind=z2 で z2 を2枚 → 自風 南。連風(z1=z1)で z1×2 → 両方計上", () => {
    const south = mkHand(["z2", "z2", "m1", "m2", "m3", "p4", "p5", "p6", "s7", "s8", "s9", "p2", "p3"]);
    const r = currentlyPossibleYaku(south, "z2", "z1");
    expect(r).toContain("自風 南");
    expect(r).not.toContain("場風 南");
    expect(r).not.toContain("場風 東");

    const ton = mkHand(["z1", "z1", "m1", "m2", "m3", "p4", "p5", "p6", "s7", "s8", "s9", "p2", "p3"]);
    const r2 = currentlyPossibleYaku(ton, "z1", "z1"); // 連風（東家・東場）
    expect(r2).toContain("自風 東");
    expect(r2).toContain("場風 東");
  });
});
