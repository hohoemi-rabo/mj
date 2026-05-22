import { describe, it, expect } from "vitest";
import { ALL_136, doraFromIndicator, sortTiles, type Tile } from "@/lib/mahjong/tiles";
import {
  TILE_TOTAL,
  DEAD_WALL_SIZE,
  LIVE_WALL_SIZE,
  HAND_SIZE,
  PLAYER_COUNT,
  RINSHAN_MAX,
  createRng,
  shuffle,
  buildWall,
  deal,
  draw,
  drawRinshan,
  remainingDraws,
  isExhausted,
  currentDora,
  deadWall,
  type Wall,
} from "@/lib/mahjong/wall";

const SEED = 12345;

/** 多重集合（牌→枚数）を作るヘルパー。順序非依存の等価比較に使う */
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

describe("RNG / シャッフル", () => {
  it("createRng は同一シードで同一数列を返す", () => {
    const r1 = createRng(SEED);
    const r2 = createRng(SEED);
    const seq1 = Array.from({ length: 5 }, () => r1());
    const seq2 = Array.from({ length: 5 }, () => r2());
    expect(seq1).toEqual(seq2);
    for (const x of seq1) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("shuffle は同一シードで完全一致、別シードでは（ほぼ）不一致", () => {
    const a = shuffle(ALL_136, createRng(SEED));
    const b = shuffle(ALL_136, createRng(SEED));
    const c = shuffle(ALL_136, createRng(SEED + 1));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("shuffle は非破壊で、結果は元の多重集合の順列", () => {
    const snapshot = [...ALL_136];
    const out = shuffle(ALL_136, createRng(SEED));
    expect(ALL_136).toEqual(snapshot); // 入力不変
    expect(out).toHaveLength(TILE_TOTAL);
    sameMultiset(out, ALL_136);
  });
});

describe("buildWall", () => {
  it("136枚・各牌4枚で ALL_136 と同一多重集合", () => {
    const wall = buildWall(SEED);
    expect(wall.tiles).toHaveLength(TILE_TOTAL);
    sameMultiset(wall.tiles, ALL_136);
  });

  it("初期ポインタが正しい", () => {
    const wall = buildWall(SEED);
    expect(wall.nextDraw).toBe(0);
    expect(wall.liveEnd).toBe(LIVE_WALL_SIZE);
    expect(wall.rinshanDrawn).toBe(0);
    expect(wall.doraIndicators).toEqual([]);
  });

  it("定数が標準麻雀の値", () => {
    expect(TILE_TOTAL).toBe(136);
    expect(DEAD_WALL_SIZE).toBe(14);
    expect(LIVE_WALL_SIZE).toBe(122);
    expect(HAND_SIZE).toBe(13);
    expect(PLAYER_COUNT).toBe(4);
    expect(RINSHAN_MAX).toBe(4);
  });
});

describe("deal（配牌）", () => {
  it("4人×13枚を配り、ポインタと残数が正しい", () => {
    const { hands, wall } = deal(buildWall(SEED));
    expect(hands).toHaveLength(PLAYER_COUNT);
    for (const h of hands) expect(h).toHaveLength(HAND_SIZE);
    expect(wall.nextDraw).toBe(PLAYER_COUNT * HAND_SIZE); // 52
    expect(remainingDraws(wall)).toBe(70);
  });

  it("各手牌は正準順にソート済み", () => {
    const { hands } = deal(buildWall(SEED));
    for (const h of hands) {
      expect(h).toEqual(sortTiles(h));
    }
  });

  it("ドラ表示牌を1枚だけ公開する", () => {
    const fresh = buildWall(SEED);
    const { wall } = deal(fresh);
    expect(wall.doraIndicators).toHaveLength(1);
    // 王牌先頭（liveEnd位置）が表示牌
    expect(wall.doraIndicators[0]).toBe(fresh.tiles[fresh.liveEnd]);
  });

  it("同一シードで配牌が完全一致（決定的）", () => {
    const d1 = deal(buildWall(SEED));
    const d2 = deal(buildWall(SEED));
    expect(d1.hands).toEqual(d2.hands);
    expect(d1.wall.doraIndicators).toEqual(d2.wall.doraIndicators);
  });

  it("配牌済みの山に再度 deal すると例外", () => {
    const { wall } = deal(buildWall(SEED));
    expect(() => deal(wall)).toThrow();
  });
});

describe("枚数整合（完了条件）", () => {
  it("配牌後: 手牌52 + 残り山70 + 王牌14 = 136", () => {
    const { hands, wall } = deal(buildWall(SEED));
    const handTotal = hands.reduce((s, h) => s + h.length, 0);
    expect(handTotal).toBe(52);
    expect(remainingDraws(wall)).toBe(70);
    expect(deadWall(wall)).toHaveLength(DEAD_WALL_SIZE);
    expect(handTotal + remainingDraws(wall) + deadWall(wall).length).toBe(TILE_TOTAL);
  });

  it("手牌 ∪ 残り山 ∪ 王牌 が ALL_136 と同一多重集合（重複・欠落なし）", () => {
    const { hands, wall } = deal(buildWall(SEED));
    const remaining = wall.tiles.slice(wall.nextDraw, wall.liveEnd);
    const all = [...hands.flat(), ...remaining, ...deadWall(wall)];
    expect(all).toHaveLength(TILE_TOTAL);
    sameMultiset(all, ALL_136);
  });
});

describe("draw（通常ツモ）", () => {
  it("先頭から順に tiles[52], tiles[53]... を返し残数が減る", () => {
    const built = buildWall(SEED);
    const { wall } = deal(built);
    const before = remainingDraws(wall);
    const r1 = draw(wall);
    expect(r1.tile).toBe(built.tiles[52]);
    expect(remainingDraws(r1.wall)).toBe(before - 1);
    const r2 = draw(r1.wall);
    expect(r2.tile).toBe(built.tiles[53]);
    expect(remainingDraws(r2.wall)).toBe(before - 2);
  });

  it("70回引き切ると isExhausted=true、71回目は例外", () => {
    const built = buildWall(SEED);
    let wall = deal(built).wall;
    const drawn: Tile[] = [];
    for (let i = 0; i < 70; i++) {
      const r = draw(wall);
      drawn.push(r.tile);
      wall = r.wall;
    }
    expect(remainingDraws(wall)).toBe(0);
    expect(isExhausted(wall)).toBe(true);
    expect(() => draw(wall)).toThrow();
    // 引いた70枚は山の live 区間 tiles[52,122) と完全一致
    expect(drawn).toEqual(built.tiles.slice(52, LIVE_WALL_SIZE));
  });

  it("draw は非破壊（元の山のポインタは不変）", () => {
    const { wall } = deal(buildWall(SEED));
    const snapshot = { ...wall };
    draw(wall);
    expect(wall.nextDraw).toBe(snapshot.nextDraw);
  });
});

describe("drawRinshan（嶺上ツモ・カン）", () => {
  it("末尾から tiles[135],[134],[133],[132] を順に返す", () => {
    const built = buildWall(SEED);
    let { wall } = deal(built);
    for (let k = 0; k < RINSHAN_MAX; k++) {
      const r = drawRinshan(wall);
      expect(r.tile).toBe(built.tiles[TILE_TOTAL - 1 - k]);
      wall = r.wall;
      expect(wall.rinshanDrawn).toBe(k + 1);
    }
  });

  it("1カンごとに海底が1枚後退する（remainingDraws -1）", () => {
    const { wall } = deal(buildWall(SEED));
    const before = remainingDraws(wall);
    const after = drawRinshan(wall).wall;
    expect(remainingDraws(after)).toBe(before - 1);
    expect(after.liveEnd).toBe(wall.liveEnd - 1);
  });

  it("5回目のカンは例外", () => {
    let { wall } = deal(buildWall(SEED));
    for (let k = 0; k < RINSHAN_MAX; k++) wall = drawRinshan(wall).wall;
    expect(() => drawRinshan(wall)).toThrow();
  });

  it("流局状態でのカンは例外", () => {
    let { wall } = deal(buildWall(SEED));
    for (let i = 0; i < 70; i++) wall = draw(wall).wall;
    expect(isExhausted(wall)).toBe(true);
    expect(() => drawRinshan(wall)).toThrow();
  });
});

describe("総ツモ数の不変条件", () => {
  it("kカン挟んでも 通常(70-k) + 嶺上(k) = 70 で打ち止め", () => {
    for (const kans of [0, 1, 4]) {
      let { wall } = deal(buildWall(SEED));
      let rinshan = 0;
      for (let i = 0; i < kans; i++) {
        wall = drawRinshan(wall).wall;
        rinshan++;
      }
      let normal = 0;
      while (!isExhausted(wall)) {
        wall = draw(wall).wall;
        normal++;
      }
      expect(normal).toBe(70 - kans);
      expect(normal + rinshan).toBe(70);
    }
  });
});

describe("currentDora", () => {
  it("公開表示牌を doraFromIndicator で変換した牌を返す", () => {
    const { wall } = deal(buildWall(SEED));
    expect(currentDora(wall)).toEqual([doraFromIndicator(wall.doraIndicators[0])]);
  });

  it("代表的な表示牌→ドラの対応（数牌・風・三元）", () => {
    const make = (indicator: Tile): Wall => ({
      tiles: ALL_136,
      nextDraw: 52,
      liveEnd: LIVE_WALL_SIZE,
      doraIndicators: [indicator],
      rinshanDrawn: 0,
    });
    expect(currentDora(make("m9"))).toEqual(["m1"]); // 9→1
    expect(currentDora(make("z4"))).toEqual(["z1"]); // 北→東（風サイクル）
    expect(currentDora(make("z7"))).toEqual(["z5"]); // 中→白（三元サイクル）
  });
});

describe("deadWall", () => {
  it("配牌直後は王牌14枚（嶺上牌・ドラ表示牌を含む）", () => {
    const { wall } = deal(buildWall(SEED));
    const dw = deadWall(wall);
    expect(dw).toHaveLength(DEAD_WALL_SIZE);
    // ドラ表示牌は王牌の先頭
    expect(dw[0]).toBe(wall.doraIndicators[0]);
  });
});
