import { describe, it, expect } from "vitest";
import { type Tile } from "@/lib/mahjong/tiles";
import { type Hand, type Meld, createHand, drawTile, physicalTileCount } from "@/lib/mahjong/hand";
import { TILE_TOTAL, remainingDraws } from "@/lib/mahjong/wall";
import { handShanten } from "@/lib/mahjong/shanten";
import {
  type GameState,
  type Seat,
  createInitialState,
  reducer,
  legalActions,
} from "@/lib/mahjong/state";

// --- 不変条件ヘルパ ---

const sumPoints = (s: GameState): number => s.players.reduce((a, p) => a + p.points, 0);

/** 山に残る（どの手にもない）牌数。嶺上ツモを liveEnd/rinshanDrawn で正しく数える。 */
const untouchedWall = (s: GameState): number =>
  remainingDraws(s.wall) + (TILE_TOTAL - s.wall.liveEnd - s.wall.rinshanDrawn);

const tileTotal = (s: GameState): number => {
  let n = untouchedWall(s);
  for (const p of s.players) n += physicalTileCount(p.hand) + p.hand.discards.length;
  return n;
};

const assertConservation = (s: GameState): void => {
  expect(sumPoints(s) + s.riichiSticks * 1000).toBe(100000);
  expect(tileTotal(s)).toBe(TILE_TOTAL);
};

// クラフト状態は drawn を注入するため絶対値は136でないが、遷移で牌が増減しないことを検証する。
const assertNoTileLeak = (before: GameState, after: GameState): void => {
  expect(tileTotal(after)).toBe(tileTotal(before));
};

// --- 状態クラフトヘルパ ---

const mkHand = (tiles: Tile[], drawn?: Tile): Hand =>
  drawn ? drawTile(createHand(tiles), drawn) : createHand(tiles);

const withHands = (s: GameState, map: Partial<Record<Seat, Hand>>): GameState => ({
  ...s,
  players: s.players.map((p) => (map[p.seat] ? { ...p, hand: map[p.seat]! } : p)),
});

const atDiscard = (s: GameState, seat: Seat): GameState => ({
  ...s,
  phase: { kind: "awaiting-discard", seat },
});

// 七対子テンパイ（z7待ち）の無害手：m5等を鳴けず・ロンできない埋め草に使う
const HONOR_HAND: Tile[] = ["z1", "z1", "z2", "z2", "z3", "z3", "z4", "z4", "z5", "z5", "z6", "z6", "z7"];

describe("createInitialState", () => {
  it("4人・各13枚・25000点・親は東・phase=awaiting-draw{親}", () => {
    const s = createInitialState(123, { dealer: 1 });
    expect(s.players).toHaveLength(4);
    for (const p of s.players) {
      expect(p.hand.concealed).toHaveLength(13);
      expect(p.points).toBe(25000);
    }
    expect(s.players[1].seatWind).toBe("z1"); // 親=東
    expect(s.players[2].seatWind).toBe("z2"); // 下家=南
    expect(s.dealer).toBe(1);
    expect(s.roundWind).toBe("z1");
    expect(s.phase).toEqual({ kind: "awaiting-draw", seat: 1, rinshan: false });
    expect(remainingDraws(s.wall)).toBe(70);
    assertConservation(s);
  });

  it("同一シードで決定的", () => {
    expect(createInitialState(7)).toEqual(createInitialState(7));
  });
});

describe("保存則を保ちつつ1局を流局まで進める（全シード走査）", () => {
  // 全 pass・先頭牌打牌のドライバ。鳴き/和了せず必ず流局に至る。
  const runToEnd = (seed: number): GameState => {
    let s = createInitialState(seed, { dealer: 0 });
    for (let guard = 0; guard < 500 && s.phase.kind !== "ended"; guard++) {
      assertConservation(s);
      if (s.phase.kind === "awaiting-draw") {
        s = reducer(s, { type: "draw" });
      } else if (s.phase.kind === "awaiting-discard") {
        const seat = s.phase.seat;
        const tile = legalActions(s, seat).discards[0];
        s = reducer(s, { type: "discard", seat, tile });
      } else if (s.phase.kind === "awaiting-claims") {
        const w = s.phase.window;
        const pending = w.eligible.find((o) => !w.responses.some((r) => r.seat === o.seat))!;
        s = reducer(s, { type: "pass", seat: pending.seat });
      }
    }
    return s;
  };

  it.each([1, 2, 3, 12345, 99999])("seed=%i は流局し保存則・テンパイ料整合", (seed) => {
    const s = runToEnd(seed);
    expect(s.phase.kind).toBe("ended");
    expect(s.result?.kind).toBe("ryuukyoku");
    assertConservation(s);
    if (s.result?.kind === "ryuukyoku") {
      const expectedTenpai = ([0, 1, 2, 3] as Seat[]).filter((seat) => handShanten(s.players[seat].hand) === 0);
      expect([...s.result.tenpaiSeats].sort()).toEqual(expectedTenpai.sort());
      expect(s.result.pointDeltas.reduce((a, b) => a + b, 0)).toBe(0);
    }
  });
});

describe("ツモ和了", () => {
  it("門前テンパイをツモ→ended・win・保存則", () => {
    // m234 p345 s678 p7p7 s45 + ツモ s3（門前ツモ＋平和＋断幺九）
    const hand = mkHand(
      ["m2", "m3", "m4", "p3", "p4", "p5", "s6", "s7", "s8", "p7", "p7", "s4", "s5"],
      "s3",
    );
    const base = createInitialState(1, { dealer: 0 });
    const s = atDiscard(withHands(base, { 0: hand }), 0);
    expect(legalActions(s, 0).canTsumo).toBe(true);
    const after = reducer(s, { type: "tsumo", seat: 0 });
    expect(after.phase.kind).toBe("ended");
    expect(after.result?.kind).toBe("win");
    if (after.result?.kind === "win") {
      expect(after.result.winners[0].seat).toBe(0);
      expect(after.result.winners[0].isTsumo).toBe(true);
      expect(after.result.loserSeat).toBeNull();
    }
    expect(sumPoints(after)).toBe(100000);
  });
});

describe("ロンとフリテン", () => {
  // seat2 が m5/m8 待ちのタンヤオ手（ロンで断幺九）。seat0 が m5 を打つ。
  const tenpai2: Tile[] = ["m2", "m3", "m4", "p3", "p4", "p5", "s6", "s7", "s8", "p7", "p7", "m6", "m7"];
  const setup = (furiten: boolean): GameState => {
    const base = createInitialState(1, { dealer: 0 });
    let hand2 = createHand(tenpai2);
    if (furiten) hand2 = { ...hand2, discards: [{ tile: "m5", tsumogiri: false, riichi: false }] };
    const s = withHands(base, {
      0: mkHand(HONOR_HAND.slice(0, 13) as Tile[], "m5"),
      1: createHand(HONOR_HAND),
      2: hand2,
      3: createHand(HONOR_HAND),
    });
    return atDiscard(s, 0);
  };

  it("フリテンでなければロンできて ended・放銃者=0", () => {
    let s = setup(false);
    s = reducer(s, { type: "discard", seat: 0, tile: "m5" });
    expect(s.phase.kind).toBe("awaiting-claims");
    if (s.phase.kind === "awaiting-claims") {
      expect(s.phase.window.eligible.find((o) => o.seat === 2)?.canRon).toBe(true);
    }
    s = reducer(s, { type: "ron", seat: 2 });
    expect(s.phase.kind).toBe("ended");
    if (s.result?.kind === "win") {
      expect(s.result.winners[0].seat).toBe(2);
      expect(s.result.loserSeat).toBe(0);
    }
    expect(sumPoints(s)).toBe(100000);
  });

  it("自河に待ち牌があるとロン不可（窓が開かず進行・ron は no-op）", () => {
    let s = setup(true);
    s = reducer(s, { type: "discard", seat: 0, tile: "m5" });
    // seat2 はフリテンでロン不可、他家も鳴けない → 窓は開かず次のツモへ
    expect(s.phase.kind).toBe("awaiting-draw");
    const noop = reducer(s, { type: "ron", seat: 2 });
    expect(noop).toBe(s);
  });
});

describe("ポン割り込み", () => {
  it("下家でない席がポン→手番がその席に移り次席はスキップ", () => {
    const base = createInitialState(1, { dealer: 0 });
    // seat2 が p5 を2枚持つ。seat0 が p5 を打つ。
    const hand2 = createHand(["p5", "p5", "m1", "m2", "m3", "s7", "s8", "s9", "z1", "z2", "z3", "z4", "m9"]);
    const s = atDiscard(
      withHands(base, {
        0: mkHand(HONOR_HAND.slice(0, 13) as Tile[], "p5"),
        1: createHand(HONOR_HAND),
        2: hand2,
        3: createHand(HONOR_HAND),
      }),
      0,
    );
    let next = reducer(s, { type: "discard", seat: 0, tile: "p5" });
    expect(next.phase.kind).toBe("awaiting-claims");
    next = reducer(next, { type: "pon", seat: 2 });
    expect(next.phase).toEqual({ kind: "awaiting-discard", seat: 2 });
    expect(next.players[2].hand.melds.some((m: Meld) => m.type === "pon")).toBe(true);
    expect(next.players[2].hand.drawn).toBeNull();
    // 鳴かれた牌は放銃者の河から除かれる（保存則）
    expect(next.players[0].hand.discards).toHaveLength(0);
    assertNoTileLeak(s, next);
    expect(sumPoints(next)).toBe(100000);
  });
});

describe("暗槓→嶺上ツモ", () => {
  it("ankan→awaiting-draw{rinshan}→draw で枚数保存・カンドラ非公開", () => {
    const base = createInitialState(1, { dealer: 0 });
    const hand = mkHand(
      ["z1", "z1", "z1", "m1", "m2", "m3", "p4", "p5", "p6", "s7", "s8", "s9", "m9"],
      "z1",
    );
    const s = atDiscard(withHands(base, { 0: hand }), 0);
    expect(legalActions(s, 0).ankanTiles).toContain("z1");
    const beforeRemaining = remainingDraws(s.wall);
    let after = reducer(s, { type: "ankan", seat: 0, tile: "z1" });
    expect(after.phase).toEqual({ kind: "awaiting-draw", seat: 0, rinshan: true });
    after = reducer(after, { type: "draw" });
    expect(after.phase).toEqual({ kind: "awaiting-discard", seat: 0 });
    expect(after.wall.rinshanDrawn).toBe(1);
    expect(after.wall.liveEnd).toBe(s.wall.liveEnd - 1);
    expect(remainingDraws(after.wall)).toBe(beforeRemaining - 1); // 海底後退
    expect(after.wall.doraIndicators).toHaveLength(1); // カンドラなし
    assertNoTileLeak(s, after);
  });
});

describe("リーチ宣言", () => {
  it("riichi打牌で1000点供託・hand.riichi", () => {
    const base = createInitialState(1, { dealer: 0 });
    // m234 p345 s678 p7p7 m67 テンパイ + ツモ z1（z1ツモ切りでテンパイ維持）
    const hand = mkHand(
      ["m2", "m3", "m4", "p3", "p4", "p5", "s6", "s7", "s8", "p7", "p7", "m6", "m7"],
      "z1",
    );
    const s = withHands(base, { 1: createHand(HONOR_HAND), 2: createHand(HONOR_HAND), 3: createHand(HONOR_HAND) });
    const s0 = atDiscard(withHands(s, { 0: hand }), 0);
    expect(legalActions(s0, 0).riichiDiscards).toContain("z1");
    const after = reducer(s0, { type: "discard", seat: 0, tile: "z1", riichi: true });
    expect(after.players[0].points).toBe(24000);
    expect(after.riichiSticks).toBe(1);
    expect(after.players[0].hand.riichi).toBe(true);
    assertNoTileLeak(s0, after);
    expect(sumPoints(after) + after.riichiSticks * 1000).toBe(100000);
  });
});

describe("リーチ後は手牌を変えられない", () => {
  // 共通：seat0 リーチ済 + ドロー後（drawn=z6）状態
  const setupRiichiAfterDraw = (): GameState => {
    const base = createInitialState(1, { dealer: 0 });
    const tiles: Tile[] = [
      "m2", "m3", "m4", "p3", "p4", "p5", "s6", "s7", "s8", "p7", "p7", "m6", "m7",
    ];
    const hand0: Hand = { ...mkHand(tiles, "z6"), riichi: true };
    const s = withHands(base, {
      0: hand0,
      1: createHand(HONOR_HAND),
      2: createHand(HONOR_HAND),
      3: createHand(HONOR_HAND),
    });
    return atDiscard(s, 0);
  };

  it("リーチ済はツモ切り（drawn）のみが合法打牌", () => {
    const s = setupRiichiAfterDraw();
    const la = legalActions(s, 0);
    expect(la.discards).toEqual(["z6"]); // drawn 以外は出ない
    expect(la.riichiDiscards).toEqual([]); // 再リーチ不可
    expect(la.ankanTiles).toEqual([]); // 暗槓不可
    expect(la.kakanTiles).toEqual([]); // 加槓不可
  });

  it("リーチ済が手出し（drawn以外の牌）を試みても no-op", () => {
    const s = setupRiichiAfterDraw();
    const after = reducer(s, { type: "discard", seat: 0, tile: "m2" });
    expect(after).toBe(s); // 状態不変＝拒否
  });

  it("リーチ済が再リーチを試みても no-op", () => {
    const s = setupRiichiAfterDraw();
    const after = reducer(s, { type: "discard", seat: 0, tile: "z6", riichi: true });
    expect(after).toBe(s);
  });

  it("リーチ済が暗槓を試みても no-op（手に4枚あっても）", () => {
    const base = createInitialState(1, { dealer: 0 });
    // 手に z5×4 を含む状態でリーチ済
    const tiles: Tile[] = [
      "m1", "m2", "m3", "m4", "m5", "m6", "p1", "p2", "p3", "z5", "z5", "z5", "z5",
    ];
    const hand0: Hand = { ...mkHand(tiles, "p4"), riichi: true };
    const sBase = withHands(base, {
      0: hand0,
      1: createHand(HONOR_HAND),
      2: createHand(HONOR_HAND),
      3: createHand(HONOR_HAND),
    });
    const s = atDiscard(sBase, 0);
    expect(legalActions(s, 0).ankanTiles).toEqual([]);
    const after = reducer(s, { type: "ankan", seat: 0, tile: "z5" });
    expect(after).toBe(s);
  });
});

describe("リーチ後の鳴き禁止", () => {
  it("リーチ済プレイヤーには pon/chi/minkan の選択肢が出ない（ロン以外不可）", () => {
    const base = createInitialState(1, { dealer: 0 });
    // seat 0: ポン候補（m5×2）もチー候補（m4,m6）もある形 + リーチ済
    const hand0Tiles: Tile[] = [
      "m4", "m5", "m5", "m6", "p1", "p2", "p3", "s1", "s2", "s3", "z5", "z6", "z7",
    ];
    const hand0: Hand = { ...createHand(hand0Tiles), riichi: true };
    const sBase = withHands(base, {
      0: hand0,
      1: createHand(HONOR_HAND),
      2: createHand(HONOR_HAND),
      3: mkHand(HONOR_HAND.slice(0, 13) as Tile[], "m5"),
    });
    // ロン誤判定の影響を切り離すため、seat0 はリーチフリテンとして扱う
    const s: GameState = {
      ...atDiscard(sBase, 3),
      riichiFuriten: [true, false, false, false],
    };
    const after = reducer(s, { type: "discard", seat: 3, tile: "m5" });
    // seat 0 はリーチ済 → 鳴き不可、リーチフリテン → ロン不可。
    // 他家(HONOR_HAND)も鳴き不可なのでクレーム窓は開かず進行する。
    expect(after.phase.kind).toBe("awaiting-draw");
  });

  it("リーチ済プレイヤーにはチー対象牌でも chiOptions が空になる", () => {
    const base = createInitialState(1, { dealer: 0 });
    // seat 0: チー候補（m4,m6）あり + リーチ済。ポン候補なし、ロン形でもない。
    const hand0Tiles: Tile[] = [
      "m4", "m6", "p1", "p2", "p3", "s1", "s2", "s3", "z1", "z2", "z3", "z5", "z6",
    ];
    const hand0: Hand = { ...createHand(hand0Tiles), riichi: true };
    // seat 3 が discardSeat。next(3)=0 なので seat 0 がチー対象席。
    const sBase = withHands(base, {
      0: hand0,
      1: createHand(HONOR_HAND),
      2: createHand(HONOR_HAND),
      3: mkHand(HONOR_HAND.slice(0, 13) as Tile[], "m5"),
    });
    const s = atDiscard(sBase, 3);
    const after = reducer(s, { type: "discard", seat: 3, tile: "m5" });
    // 誰も鳴けない・誰もロンできない → クレーム窓は開かない
    expect(after.phase.kind).toBe("awaiting-draw");
  });
});

describe("流局のテンパイ料", () => {
  it("2人テンパイ→各+1500 / 2人ノーテン→各-1500", () => {
    const base = createInitialState(1, { dealer: 0 });
    const tenpai: Tile[] = ["m2", "m3", "m4", "p3", "p4", "p5", "s6", "s7", "s8", "p7", "p7", "m6", "m7"]; // テンパイ
    const noten: Tile[] = ["m1", "m4", "m7", "p1", "p4", "p7", "s1", "s4", "s7", "z1", "z2", "z3", "z5"]; // バラバラ
    // seat0 は打牌できるよう drawn 付きテンパイ（z9相当の余剰...は無いので noten牌をツモって切る）
    const hand0 = mkHand(tenpai, "z6"); // z6 を切ってテンパイ維持
    let s = withHands(base, {
      0: hand0,
      1: createHand(tenpai),
      2: createHand(noten),
      3: createHand(noten),
    });
    // 山を尽きさせる
    s = { ...s, wall: { ...s.wall, nextDraw: s.wall.liveEnd } };
    s = atDiscard(s, 0);
    expect(remainingDraws(s.wall)).toBe(0);
    const after = reducer(s, { type: "discard", seat: 0, tile: "z6" });
    expect(after.phase.kind).toBe("ended");
    expect(after.result?.kind).toBe("ryuukyoku");
    if (after.result?.kind === "ryuukyoku") {
      expect([...after.result.tenpaiSeats].sort()).toEqual([0, 1]);
      expect(after.result.pointDeltas).toEqual([1500, 1500, -1500, -1500]);
    }
    expect(sumPoints(after)).toBe(100000);
  });
});

describe("役なしはロン不可", () => {
  it("役のない和了形は窓が開かず ron は no-op", () => {
    const base = createInitialState(1, { dealer: 0 });
    // seat2: chi m234 + pon s5 / p4p5p6 s7s8 m1m1 → s9 で和了形だが役なし
    const melds: Meld[] = [
      { type: "chi", tiles: ["m2", "m3", "m4"], calledTile: "m4", from: 1 },
      { type: "pon", tiles: ["s5", "s5", "s5"], calledTile: "s5", from: 2 },
    ];
    const hand2: Hand = { concealed: ["m1", "m1", "p4", "p5", "p6", "s7", "s8"], melds, drawn: null, discards: [], riichi: false };
    const s = atDiscard(
      withHands(base, {
        0: mkHand(HONOR_HAND.slice(0, 13) as Tile[], "s9"),
        1: createHand(HONOR_HAND),
        2: hand2,
        3: createHand(HONOR_HAND),
      }),
      0,
    );
    const after = reducer(s, { type: "discard", seat: 0, tile: "s9" });
    // 役なしなのでロン窓は開かない（他家も鳴けない）→ 進行
    expect(after.phase.kind).toBe("awaiting-draw");
    expect(reducer(after, { type: "ron", seat: 2 })).toBe(after);
  });
});

describe("一時停止と純粋性", () => {
  it("paused 中は legalActions 全空・アクションは no-op、resume で復帰", () => {
    const s = createInitialState(1, { dealer: 0 });
    const paused = reducer(s, { type: "pause" });
    expect(paused.paused).toBe(true);
    expect(legalActions(paused, 0)).toEqual(legalActions(paused, 1)); // どの席も同じ（全空）
    expect(legalActions(paused, 0).canDraw).toBe(false);
    expect(reducer(paused, { type: "draw" })).toBe(paused); // no-op
    const resumed = reducer(paused, { type: "resume" });
    expect(resumed.paused).toBe(false);
    expect(legalActions(resumed, 0).canDraw).toBe(true);
  });

  it("no-op は同一参照、入力は不変", () => {
    const s = createInitialState(1, { dealer: 0 });
    const frozen = Object.freeze(s);
    // 手番でない席の打牌は no-op（同一参照）
    expect(reducer(frozen, { type: "discard", seat: 2, tile: "m1" })).toBe(frozen);
    // pause が無い状態での resume も no-op
    expect(reducer(frozen, { type: "resume" })).toBe(frozen);
  });
});
