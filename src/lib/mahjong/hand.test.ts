import { describe, it, expect } from "vitest";
import { type Tile } from "@/lib/mahjong/tiles";
import {
  STARTING_HAND_SIZE,
  type Hand,
  createHand,
  drawTile,
  discard,
  callPon,
  callChi,
  callMinkan,
  callAnkan,
  callKakan,
  canCallPon,
  canCallChi,
  canCallMinkan,
  canCallAnkan,
  canCallKakan,
  isMenzen,
  isOpenMeld,
  isClosedMeld,
  concealedWithDrawn,
  completedMeldCount,
  handTileCount,
  physicalTileCount,
  lastDiscard,
} from "@/lib/mahjong/hand";

/** 13枚の標準的な配牌（ソート前。順不同で渡してソートを検証する） */
const DEAL13: Tile[] = [
  "m3", "m1", "m2", "p5", "p5", "p6", "s7", "s8", "s9", "z1", "z1", "z5", "m9",
];

const freshHand = (): Hand => createHand(DEAL13);

const tally = (tiles: readonly Tile[]): Map<Tile, number> => {
  const m = new Map<Tile, number>();
  for (const t of tiles) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
};
const sameMultiset = (a: readonly Tile[], b: readonly Tile[]) => {
  const ma = tally(a);
  const mb = tally(b);
  expect(ma.size).toBe(mb.size);
  for (const [t, n] of ma) expect(mb.get(t)).toBe(n);
};

describe("createHand", () => {
  it("13枚から concealed ソート済み・他は初期化", () => {
    const h = createHand(DEAL13);
    expect(h.concealed).toEqual([
      "m1", "m2", "m3", "m9", "p5", "p5", "p6", "s7", "s8", "s9", "z1", "z1", "z5",
    ]);
    expect(h.melds).toEqual([]);
    expect(h.drawn).toBeNull();
    expect(h.discards).toEqual([]);
    expect(h.riichi).toBe(false);
    expect(handTileCount(h)).toBe(STARTING_HAND_SIZE);
  });

  it("入力配列を破壊しない", () => {
    const input = [...DEAL13];
    const snapshot = [...input];
    createHand(input);
    expect(input).toEqual(snapshot);
  });

  it("13枚以外は throw", () => {
    expect(() => createHand(DEAL13.slice(0, 12))).toThrow();
    expect(() => createHand([...DEAL13, "m1"])).toThrow();
  });
});

describe("drawTile", () => {
  it("drawn にセットされ handTileCount=14、concealed 不変", () => {
    const h = freshHand();
    const after = drawTile(h, "p7");
    expect(after.drawn).toBe("p7");
    expect(after.concealed).toEqual(h.concealed);
    expect(handTileCount(after)).toBe(14);
  });

  it("二重ツモは throw", () => {
    const h = drawTile(freshHand(), "p7");
    expect(() => drawTile(h, "m4")).toThrow();
  });
});

describe("discard（ツモ切り）", () => {
  it("ツモ牌と同一を切ると tsumogiri=true・concealed 不変・drawn=null", () => {
    const h = drawTile(freshHand(), "p7");
    const after = discard(h, "p7");
    expect(after.drawn).toBeNull();
    expect(after.concealed).toEqual(h.concealed);
    expect(after.discards).toHaveLength(1);
    expect(after.discards[0]).toEqual({ tile: "p7", tsumogiri: true, riichi: false });
  });
});

describe("discard（手出し）", () => {
  it("ツモ牌を手に入れ別牌を切る→concealed が更新されソート維持", () => {
    const h = drawTile(freshHand(), "p7");
    const after = discard(h, "z5");
    expect(after.drawn).toBeNull();
    expect(after.discards[0].tsumogiri).toBe(false);
    // z5 が抜け、ツモった p7 が入る
    expect(after.concealed).toEqual([
      "m1", "m2", "m3", "m9", "p5", "p5", "p6", "p7", "s7", "s8", "s9", "z1", "z1",
    ]);
    expect(after.concealed).toContain("p7");
    expect(after.concealed).not.toContain("z5");
  });

  it("鳴き後（drawn=null）でも手出しできる", () => {
    const h = freshHand();
    const after = discard(h, "z5");
    expect(after.concealed).not.toContain("z5");
    expect(after.concealed).toHaveLength(12);
    expect(after.discards[0].tsumogiri).toBe(false);
  });

  it("プールに無い牌は throw", () => {
    const h = drawTile(freshHand(), "p7");
    expect(() => discard(h, "m5")).toThrow();
  });
});

describe("callPon", () => {
  it("同種2枚を消費し明刻・isMenzen=false", () => {
    const h = freshHand(); // p5 が2枚
    const after = callPon(h, "p5", 2);
    expect(after.melds).toHaveLength(1);
    expect(after.melds[0]).toEqual({
      type: "pon",
      tiles: ["p5", "p5", "p5"],
      calledTile: "p5",
      from: 2,
    });
    expect(after.concealed.filter((t) => t === "p5")).toHaveLength(0);
    expect(isMenzen(after)).toBe(false);
    expect(isOpenMeld(after.melds[0])).toBe(true);
    expect(canCallPon(h, "p5")).toBe(true);
  });

  it("2枚未満は throw / canCallPon=false", () => {
    const h = freshHand(); // z5 は1枚
    expect(canCallPon(h, "z5")).toBe(false);
    expect(() => callPon(h, "z5", 1)).toThrow();
  });

  it("ツモ牌がある状態では throw", () => {
    const h = drawTile(freshHand(), "p7");
    expect(canCallPon(h, "p5")).toBe(false);
    expect(() => callPon(h, "p5", 1)).toThrow();
  });

  it("リーチ後は throw（安全網）", () => {
    const h: Hand = { ...freshHand(), riichi: true };
    expect(() => callPon(h, "p5", 1)).toThrow(/リーチ後/);
  });
});

describe("callChi", () => {
  it("手中2枚＋鳴き牌で順子（s7,s8 + s9）", () => {
    const h = freshHand();
    const after = callChi(h, "s9", 3, ["s7", "s8"]);
    expect(after.melds[0]).toEqual({
      type: "chi",
      tiles: ["s7", "s8", "s9"],
      calledTile: "s9",
      from: 3,
    });
    expect(after.concealed).not.toContain("s7");
    expect(after.concealed).not.toContain("s8");
    expect(isMenzen(after)).toBe(false);
    expect(canCallChi(h, "s9", ["s7", "s8"])).toBe(true);
  });

  it("非連続・スーツ違い・字牌は throw / canCallChi=false", () => {
    const h = freshHand();
    expect(canCallChi(h, "s9", ["s7", "s9" as Tile])).toBe(false); // 非連続
    expect(() => callChi(h, "m5", 3, ["p5", "p6"])).toThrow(); // スーツ違い
    expect(() => callChi(h, "z1", 3, ["z1", "z1"] as [Tile, Tile])).toThrow(); // 字牌
  });

  it("手牌に無い構成牌は canCallChi=false", () => {
    const h = freshHand();
    expect(canCallChi(h, "m5", ["m6", "m7"])).toBe(false); // m6,m7 は手に無い
  });

  it("ツモ牌がある状態では throw", () => {
    const h = drawTile(freshHand(), "p7");
    expect(canCallChi(h, "s9", ["s7", "s8"])).toBe(false);
    expect(() => callChi(h, "s9", 3, ["s7", "s8"])).toThrow();
  });

  it("リーチ後は throw（安全網）", () => {
    const h: Hand = { ...freshHand(), riichi: true };
    expect(() => callChi(h, "s9", 3, ["s7", "s8"])).toThrow(/リーチ後/);
  });
});

describe("callMinkan（大明槓）", () => {
  const threeP5: Tile[] = ["p5", "p5", "p5", "m1", "m2", "m3", "s7", "s8", "s9", "z1", "z2", "z3", "z4"];

  it("同種3枚消費し4枚meld・isMenzen=false", () => {
    const h = createHand(threeP5);
    const after = callMinkan(h, "p5", 0);
    expect(after.melds[0].type).toBe("minkan");
    expect(after.melds[0].tiles).toEqual(["p5", "p5", "p5", "p5"]);
    expect(after.melds[0].calledTile).toBe("p5");
    expect(after.concealed).not.toContain("p5");
    expect(isMenzen(after)).toBe(false);
    expect(canCallMinkan(h, "p5")).toBe(true);
  });

  it("3枚未満は throw / canCallMinkan=false", () => {
    const h = freshHand(); // p5 は2枚
    expect(canCallMinkan(h, "p5")).toBe(false);
    expect(() => callMinkan(h, "p5", 0)).toThrow();
  });

  it("リーチ後は throw（安全網）", () => {
    const h: Hand = { ...createHand(threeP5), riichi: true };
    expect(() => callMinkan(h, "p5", 0)).toThrow(/リーチ後/);
  });
});

describe("callAnkan（暗槓）", () => {
  const threeZ1: Tile[] = ["z1", "z1", "z1", "m1", "m2", "m3", "p4", "p5", "p6", "s7", "s8", "s9", "m9"];

  it("concealed3枚+ツモ1枚で4枚meld・drawn=null・門前維持", () => {
    const h = drawTile(createHand(threeZ1), "z1");
    expect(canCallAnkan(h, "z1")).toBe(true);
    const after = callAnkan(h, "z1");
    expect(after.melds[0].type).toBe("ankan");
    expect(after.melds[0].tiles).toEqual(["z1", "z1", "z1", "z1"]);
    expect(after.melds[0].calledTile).toBeNull();
    expect(after.melds[0].from).toBeNull();
    expect(after.drawn).toBeNull();
    expect(isMenzen(after)).toBe(true); // 暗槓は門前維持
    expect(isClosedMeld(after.melds[0])).toBe(true);
  });

  it("4枚未満は throw / canCallAnkan=false", () => {
    const h = drawTile(createHand(threeZ1), "m4"); // z1 は3枚のみ
    expect(canCallAnkan(h, "z1")).toBe(false);
    expect(() => callAnkan(h, "z1")).toThrow();
  });
});

describe("callKakan（加槓）", () => {
  it("既存ポンに4枚目を加えカン化・calledTile/from 継承・drawn=null", () => {
    const h0 = freshHand(); // p5 ×2
    const poned = callPon(h0, "p5", 2); // pon from 2
    const drawn = drawTile(poned, "p5"); // 4枚目をツモ
    expect(canCallKakan(drawn, "p5")).toBe(true);
    const after = callKakan(drawn, "p5");
    expect(after.melds).toHaveLength(1);
    expect(after.melds[0].type).toBe("kakan");
    expect(after.melds[0].tiles).toEqual(["p5", "p5", "p5", "p5"]);
    expect(after.melds[0].calledTile).toBe("p5");
    expect(after.melds[0].from).toBe(2); // 元ポンを継承
    expect(after.drawn).toBeNull();
    expect(isMenzen(after)).toBe(false);
  });

  it("対応するポンが無いと throw / canCallKakan=false", () => {
    const h = drawTile(freshHand(), "p5"); // ポンしていない
    expect(canCallKakan(h, "p5")).toBe(false);
    expect(() => callKakan(h, "p5")).toThrow();
  });
});

describe("menzen 遷移", () => {
  it("配牌直後は門前", () => {
    expect(isMenzen(freshHand())).toBe(true);
  });
  it("ポンで門前が崩れる", () => {
    expect(isMenzen(callPon(freshHand(), "p5", 1))).toBe(false);
  });
});

describe("riichi 宣言", () => {
  it("門前で riichi 宣言→hand.riichi=true・該当 Discard.riichi=true", () => {
    const h = drawTile(freshHand(), "p7");
    const after = discard(h, "z5", { riichi: true });
    expect(after.riichi).toBe(true);
    expect(lastDiscard(after)?.riichi).toBe(true);
  });
  it("副露ありで riichi 宣言は throw", () => {
    const h = drawTile(callPon(freshHand(), "p5", 1), "p7");
    expect(() => discard(h, "z5", { riichi: true })).toThrow();
  });
  it("二重 riichi は throw", () => {
    const r = discard(drawTile(freshHand(), "p7"), "z5", { riichi: true });
    const next = drawTile(r, "m4");
    expect(() => discard(next, "m4", { riichi: true })).toThrow();
  });
});

describe("枚数の不変条件", () => {
  it("handTileCount はカンを跨いでも手番間13/ツモ時14", () => {
    const threeZ1: Tile[] = ["z1", "z1", "z1", "m1", "m2", "m3", "p4", "p5", "p6", "s7", "s8", "s9", "m9"];
    let h = createHand(threeZ1);
    expect(handTileCount(h)).toBe(13);
    h = drawTile(h, "z1");
    expect(handTileCount(h)).toBe(14);
    h = callAnkan(h, "z1"); // 暗槓後（嶺上ツモ前）は論理13
    expect(handTileCount(h)).toBe(13);
    h = drawTile(h, "p7"); // 嶺上ツモ相当
    expect(handTileCount(h)).toBe(14);
  });

  it("physicalTileCount は暗槓後にカンの4枚を数える（logicalと別物）", () => {
    const threeZ1: Tile[] = ["z1", "z1", "z1", "m1", "m2", "m3", "p4", "p5", "p6", "s7", "s8", "s9", "m9"];
    const h = callAnkan(drawTile(createHand(threeZ1), "z1"), "z1");
    expect(physicalTileCount(h)).toBe(14); // concealed10 + meld4
    expect(handTileCount(h)).toBe(13);
  });
});

describe("保存則（多重集合の保存）", () => {
  it("ポン→打牌で 全牌(副露+concealed+捨て) が 配牌＋鳴いた牌 と一致", () => {
    const h0 = freshHand();
    // ポンは他家の捨て牌1枚を取り込むので、手牌が持つ牌は 配牌13枚＋鳴いた p5 1枚。
    const after = discard(callPon(h0, "p5", 1), "z5");
    const all = [
      ...after.melds.flatMap((m) => m.tiles),
      ...after.concealed,
      ...after.discards.map((d) => d.tile),
    ];
    sameMultiset(all, [...DEAL13, "p5"]);
  });

  it("ツモ→ツモ切りで 全牌が 配牌＋ツモ牌 と一致", () => {
    const after = discard(drawTile(freshHand(), "p7"), "p7");
    const all = [...after.concealed, ...after.discards.map((d) => d.tile)];
    sameMultiset(all, [...DEAL13, "p7"]);
  });
});

describe("immutability（入力不変）", () => {
  it("各 op は入力 Hand と配列を変更しない", () => {
    const h = freshHand();
    const snapshotConcealed = [...h.concealed];
    drawTile(h, "p7");
    discard(drawTile(h, "p7"), "z5");
    callPon(h, "p5", 1);
    callChi(h, "s9", 3, ["s7", "s8"]);
    expect(h.concealed).toEqual(snapshotConcealed);
    expect(h.melds).toEqual([]);
    expect(h.drawn).toBeNull();
    expect(h.discards).toEqual([]);
  });
});

describe("一連の遷移（完了条件）", () => {
  it("配牌→ツモ→チー→打牌→ツモ→ポン→打牌→ツモ→リーチ", () => {
    let h = freshHand();
    expect(isMenzen(h)).toBe(true);
    expect(completedMeldCount(h)).toBe(0);

    // ツモ→チー（s7,s8 + s9）→打牌
    h = drawTile(h, "m4");
    h = discard(h, "m4"); // ツモ切りで手番終了の体
    h = callChi(h, "s9", 0, ["s7", "s8"]);
    expect(completedMeldCount(h)).toBe(1);
    h = discard(h, "z1"); // 鳴き後の打牌
    expect(isMenzen(h)).toBe(false);

    // ツモ→ポン（p5×2 + p5）→打牌
    h = callPon(h, "p5", 2);
    expect(completedMeldCount(h)).toBe(2);
    h = discard(h, "z5");

    // concealedWithDrawn はツモ込みでソートされる
    h = drawTile(h, "m5");
    expect(concealedWithDrawn(h)).toEqual([...h.concealed, "m5"].sort());

    // 副露ありなのでリーチは不可（throw）
    expect(() => discard(h, "m5", { riichi: true })).toThrow();
    expect(handTileCount(h)).toBe(14);
  });
});
