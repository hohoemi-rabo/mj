import { describe, it, expect } from "vitest";
import { type Tile, sortTiles } from "@/lib/mahjong/tiles";
import { type Hand, createHand, drawTile, concealedWithDrawn, physicalTileCount } from "@/lib/mahjong/hand";
import { TILE_TOTAL, createRng, remainingDraws } from "@/lib/mahjong/wall";
import {
  type GameState,
  type Seat,
  createInitialState,
  reducer,
  validate,
} from "@/lib/mahjong/state";
import { type CpuStrength, chooseAction } from "@/lib/mahjong/cpu";
import { weakChoose } from "@/lib/mahjong/cpu/weak";
import { mediumChoose } from "@/lib/mahjong/cpu/medium";
import { strongChoose } from "@/lib/mahjong/cpu/strong";
import { efficientDiscard, safestDiscard } from "@/lib/mahjong/cpu/common";

// --- クラフトヘルパ（state.test.ts と同様） ---

const mkHand = (tiles: Tile[], drawn?: Tile): Hand =>
  drawn ? drawTile(createHand(tiles), drawn) : createHand(tiles);

const withHands = (s: GameState, map: Partial<Record<Seat, Hand>>): GameState => ({
  ...s,
  players: s.players.map((p) => (map[p.seat] ? { ...p, hand: map[p.seat]! } : p)),
});

const atDiscard = (s: GameState, seat: Seat): GameState => ({ ...s, phase: { kind: "awaiting-discard", seat } });

const HONOR_HAND: Tile[] = ["z1", "z1", "z2", "z2", "z3", "z3", "z4", "z4", "z5", "z5", "z6", "z6", "z7"];
// 門前テンパイ（s3/s6待ち）＋孤立 z5 をツモった14枚形
const TENPAI_WITH_ISOLATED = (): Hand =>
  mkHand(["m2", "m3", "m4", "p3", "p4", "p5", "s6", "s7", "s8", "p7", "p7", "s4", "s5"], "z5");

const sumPoints = (s: GameState): number => s.players.reduce((a, p) => a + p.points, 0);
const tileTotal = (s: GameState): number => {
  let n = remainingDraws(s.wall) + (TILE_TOTAL - s.wall.liveEnd - s.wall.rinshanDrawn);
  for (const p of s.players) n += physicalTileCount(p.hand) + p.hand.discards.length;
  return n;
};
const assertConservation = (s: GameState): void => {
  expect(sumPoints(s) + s.riichiSticks * 1000).toBe(100000);
  expect(tileTotal(s)).toBe(TILE_TOTAL);
};

/** ポン窓を1つ作る（seat0 が tile を打ち、seat2 が tile×2 を持つ）。 */
const ponWindow = (tile: Tile, seat2Hand: Tile[]): GameState => {
  const base = createInitialState(1, { dealer: 0 });
  const s = withHands(base, {
    0: mkHand(HONOR_HAND.slice(0, 13) as Tile[], tile),
    1: createHand(HONOR_HAND),
    2: createHand(seat2Hand),
    3: createHand(HONOR_HAND),
  });
  return reducer(atDiscard(s, 0), { type: "discard", seat: 0, tile });
};

describe("自己対局ハーネス（合法手・保存則・終局）", () => {
  const tables: [string, [CpuStrength, CpuStrength, CpuStrength, CpuStrength]][] = [
    ["全弱", ["weak", "weak", "weak", "weak"]],
    ["全中", ["medium", "medium", "medium", "medium"]],
    ["全強", ["strong", "strong", "strong", "strong"]],
    ["混在", ["weak", "medium", "strong", "medium"]],
  ];
  // 各ゲームが数十アクションで全 legalActions を網羅するため、シードは少数で十分。
  const seeds = [1, 99999];

  for (const [label, strengths] of tables) {
    it.each(seeds)(`${label} seed=%i は合法手のみで終局・保存則`, (seed) => {
      let s = createInitialState(seed, { dealer: 0 });
      const rngs = strengths.map((_, i) => createRng(seed * 100 + i));
      let guard = 0;
      while (s.phase.kind !== "ended" && guard++ < 2000) {
        let seat: Seat;
        if (s.phase.kind === "awaiting-draw" || s.phase.kind === "awaiting-discard") {
          seat = s.phase.seat;
        } else if (s.phase.kind === "awaiting-claims") {
          const w = s.phase.window;
          const pending = w.eligible.find((o) => !w.responses.some((r) => r.seat === o.seat));
          if (!pending) break;
          seat = pending.seat;
        } else break;
        const action = chooseAction(strengths[seat], s, seat, rngs[seat]);
        expect(validate(s, action)).toBe(true); // 必ず合法手
        s = reducer(s, action);
        assertConservation(s);
      }
      expect(s.phase.kind).toBe("ended");
    });
  }
});

describe("全レベル共通：勝ちは取る", () => {
  it("canTsumo ならツモる", () => {
    const s = atDiscard(withHands(createInitialState(1, { dealer: 0 }), { 0: TENPAI_WITH_ISOLATED() }), 0);
    // 注: z5切りでテンパイ。ツモ和了ではないので canTsumo は false。完成形でツモを確認する別ケース:
    const winHand = mkHand(["m2", "m3", "m4", "p3", "p4", "p5", "s6", "s7", "s8", "p7", "p7", "s4", "s5"], "s3");
    const sw = atDiscard(withHands(createInitialState(1, { dealer: 0 }), { 0: winHand }), 0);
    for (const lvl of ["weak", "medium", "strong"] as CpuStrength[]) {
      expect(chooseAction(lvl, sw, 0, createRng(1))).toEqual({ type: "tsumo", seat: 0 });
    }
    void s;
  });
});

describe("弱CPU", () => {
  it("打牌は discards 内・リーチしない", () => {
    const s = atDiscard(withHands(createInitialState(1, { dealer: 0 }), { 0: TENPAI_WITH_ISOLATED() }), 0);
    const a = weakChoose(s, 0, createRng(3));
    expect(a.type).toBe("discard");
    if (a.type === "discard") {
      expect(concealedWithDrawn(s.players[0].hand)).toContain(a.tile);
      expect(a.riichi).toBeFalsy();
    }
  });

  it("シードで打牌がばらける（半ランダム）", () => {
    const s = atDiscard(withHands(createInitialState(1, { dealer: 0 }), { 0: TENPAI_WITH_ISOLATED() }), 0);
    const chosen = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const a = weakChoose(s, 0, createRng(seed));
      if (a.type === "discard") chosen.add(a.tile);
    }
    expect(chosen.size).toBeGreaterThan(1);
  });

  it("ポン窓では pass", () => {
    const w = ponWindow("z5", ["z5", "z5", "m1", "m2", "m4", "p1", "p3", "p5", "p7", "p9", "s1", "s3", "s5"]);
    expect(weakChoose(w, 2, createRng(1))).toEqual({ type: "pass", seat: 2 });
  });
});

describe("中CPU", () => {
  it("効率打牌（孤立牌 z5 を切る）= efficientDiscard 単体", () => {
    const hand = TENPAI_WITH_ISOLATED();
    const candidates = sortTiles([...new Set(concealedWithDrawn(hand))]);
    expect(efficientDiscard(hand, candidates)).toBe("z5");
  });

  it("テンパイ到達時はリーチ宣言（z5切りリーチ）", () => {
    const s = atDiscard(withHands(createInitialState(1, { dealer: 0 }), {
      0: TENPAI_WITH_ISOLATED(),
      1: createHand(HONOR_HAND), 2: createHand(HONOR_HAND), 3: createHand(HONOR_HAND),
    }), 0);
    expect(mediumChoose(s, 0, createRng(1))).toEqual({ type: "discard", seat: 0, tile: "z5", riichi: true });
  });

  it("役牌（白z5）はポン、非役牌（p5）はポンしない", () => {
    const yakuhai = ponWindow("z5", ["z5", "z5", "m1", "m2", "m4", "p1", "p3", "p5", "p7", "p9", "s1", "s3", "s5"]);
    expect(mediumChoose(yakuhai, 2, createRng(1))).toEqual({ type: "pon", seat: 2 });
    const plain = ponWindow("p5", ["p5", "p5", "m1", "m2", "m4", "z1", "z2", "z3", "s1", "s3", "s5", "s7", "s9"]);
    expect(mediumChoose(plain, 2, createRng(1))).toEqual({ type: "pass", seat: 2 });
  });

  it("rng に依存しない（別シードで同結果）", () => {
    const s = atDiscard(withHands(createInitialState(5, { dealer: 0 }), { 0: TENPAI_WITH_ISOLATED() }), 0);
    expect(mediumChoose(s, 0, createRng(1))).toEqual(mediumChoose(s, 0, createRng(999)));
  });
});

describe("強CPU（簡易ベタ降り）", () => {
  const riichiOppState = (seat0Hand: Hand): GameState => {
    const base = createInitialState(1, { dealer: 0 });
    const oppRiichi: Hand = {
      ...createHand(["m2", "m3", "m4", "p2", "p3", "p4", "s2", "s3", "s4", "s6", "s7", "z1", "z1"]),
      riichi: true,
      discards: [{ tile: "m1", tsumogiri: false, riichi: true }],
    };
    return atDiscard(withHands(base, { 0: seat0Hand, 1: oppRiichi }), 0);
  };

  it("他家リーチ＆自分ノーテンは現物（m1）で降りる・リーチしない", () => {
    const scattered = mkHand(["m1", "p1", "p4", "p7", "s1", "s4", "s7", "z1", "z2", "z3", "z5", "z6", "m9"], "m4");
    const a = strongChoose(riichiOppState(scattered), 0, createRng(1));
    expect(a).toEqual({ type: "discard", seat: 0, tile: "m1" });
  });

  it("他家リーチでも自分テンパイなら押す（リーチ）", () => {
    const a = strongChoose(riichiOppState(TENPAI_WITH_ISOLATED()), 0, createRng(1));
    expect(a).toEqual({ type: "discard", seat: 0, tile: "z5", riichi: true });
  });

  it("他家リーチ中はポンしない", () => {
    // ポン窓だが seat2 視点で他家(seat1)がリーチ → pass
    const base = createInitialState(1, { dealer: 0 });
    const oppRiichi: Hand = { ...createHand(HONOR_HAND), riichi: true };
    let s = withHands(base, {
      0: mkHand(HONOR_HAND.slice(0, 13) as Tile[], "z5"),
      1: oppRiichi,
      2: createHand(["z5", "z5", "m1", "m2", "m4", "p1", "p3", "p5", "p7", "p9", "s1", "s3", "s5"]),
      3: createHand(HONOR_HAND),
    });
    s = reducer(atDiscard(s, 0), { type: "discard", seat: 0, tile: "z5" });
    if (s.phase.kind === "awaiting-claims") {
      expect(strongChoose(s, 2, createRng(1))).toEqual({ type: "pass", seat: 2 });
    } else {
      throw new Error("expected awaiting-claims");
    }
  });
});

describe("safestDiscard の段階", () => {
  const withRivers = (rivers: Partial<Record<Seat, Tile[]>>): GameState => {
    const base = createInitialState(1, { dealer: 0 });
    return {
      ...base,
      players: base.players.map((p) =>
        rivers[p.seat]
          ? { ...p, hand: { ...p.hand, riichi: true, discards: rivers[p.seat]!.map((t) => ({ tile: t, tsumogiri: false, riichi: false })) } }
          : p,
      ),
    };
  };

  it("全リーチ者の現物を最優先", () => {
    const s = withRivers({ 1: ["m1", "p9"], 2: ["m1", "s9"] });
    expect(safestDiscard(s, 0, ["s5", "m1", "p3"], [1, 2])).toBe("m1");
  });

  it("全現物がなければカバー人数最大", () => {
    const s = withRivers({ 1: ["m1"], 2: ["p1"] });
    expect(safestDiscard(s, 0, ["z5", "m1", "p1"], [1, 2])).toBe("m1"); // 正準順で先頭の最大カバー
  });

  it("現物が無ければ字牌を優先", () => {
    const s = withRivers({ 1: [] });
    expect(safestDiscard(s, 0, ["m5", "z5", "m1"], [1])).toBe("z5");
  });
});
