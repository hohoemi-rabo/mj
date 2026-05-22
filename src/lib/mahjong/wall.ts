// 山牌・配牌・ツモ・嶺上ツモ・ドラ表示・流局判定（純粋TS / REQUIREMENTS §3.1, §3.2）。
// #02 tiles.ts を単一の出所として再利用する。React・通信・I/Oに非依存。
// 乱数はシード可能（テスト再現性 / CLAUDE.md テスト規律）。
// Wall は #11 で game:state として同期されるため、メソッドを持たないプレーンな
// JSONシリアライズ可能オブジェクトに保つ（不変更新で新しい Wall を返す）。

import { ALL_136, doraFromIndicator, sortTiles, type Tile } from "@/lib/mahjong/tiles";

/** 牌の総数（136枚） */
export const TILE_TOTAL = 136;
/** 王牌の枚数（14枚固定） */
export const DEAD_WALL_SIZE = 14;
/** ツモ可能な山（live wall）の初期枚数（136 - 14） */
export const LIVE_WALL_SIZE = TILE_TOTAL - DEAD_WALL_SIZE;
/** 1人あたりの配牌枚数 */
export const HAND_SIZE = 13;
/** プレイヤー数 */
export const PLAYER_COUNT = 4;
/** カン可能な最大回数＝嶺上牌の枚数 */
export const RINSHAN_MAX = 4;

/**
 * 山の状態。インデックスポインタで「シャッフル済み136枚」への進行を表す。
 *
 * 配置: tiles[0, liveEnd) = 山（ツモ可能） / tiles[liveEnd, 136) = 王牌（14枚）。
 * - ドラ表示牌は配牌時に王牌先頭 tiles[liveEnd] を公開（表ドラのみ・カンドラなし）。
 * - 嶺上牌は末尾4枚。k回目（0始まり）のカンで tiles[135 - k] を引く。
 * - カンのたびに liveEnd を1減らす（海底が後退し、王牌が末尾から補充される挙動）。
 */
export interface Wall {
  /** 136枚（シャッフル済み・不変） */
  readonly tiles: readonly Tile[];
  /** 次の通常ツモのindex（先頭から消費） */
  readonly nextDraw: number;
  /** 通常ツモ可能範囲の終端(exclusive)。カンで1ずつ減る */
  readonly liveEnd: number;
  /** 公開済みドラ表示牌（配牌後は1枚で固定。カンドラなし） */
  readonly doraIndicators: readonly Tile[];
  /** 嶺上ツモ済み枚数＝カン回数（0..RINSHAN_MAX） */
  readonly rinshanDrawn: number;
}

// --- シード可能な乱数（mulberry32） ---

/** [0,1) を返すシード可能な擬似乱数生成器 */
export type Rng = () => number;

/**
 * mulberry32: 32bitシードから決定的な擬似乱数列を生成する軽量PRNG。
 * 同一シードなら常に同一の数列を返す（テストの再現性確保）。
 */
export const createRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Fisher–Yates シャッフル（非破壊。入力配列は変更しない） */
export const shuffle = <T>(items: readonly T[], rng: Rng): T[] => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// --- 山の生成・配牌 ---

/** シードから136枚をシャッフルした未配牌の山を作る */
export const buildWall = (seed: number): Wall => ({
  tiles: shuffle(ALL_136, createRng(seed)),
  nextDraw: 0,
  liveEnd: LIVE_WALL_SIZE,
  doraIndicators: [],
  rinshanDrawn: 0,
});

/**
 * 配牌。4人へ13枚ずつ配り、ドラ表示牌を1枚公開した山を返す。
 * 親の14枚目はここでは引かない（最初のツモはステートマシン #08 の責務）。
 * 未配牌の山に対してのみ実行できる。
 */
export const deal = (wall: Wall): { hands: Tile[][]; wall: Wall } => {
  if (wall.nextDraw !== 0) {
    throw new Error("deal: wall has already been dealt");
  }
  const hands: Tile[][] = [];
  for (let p = 0; p < PLAYER_COUNT; p++) {
    hands.push(sortTiles(wall.tiles.slice(p * HAND_SIZE, (p + 1) * HAND_SIZE)));
  }
  return {
    hands,
    wall: {
      ...wall,
      nextDraw: PLAYER_COUNT * HAND_SIZE,
      // 王牌先頭をドラ表示牌として公開（表ドラのみ）。
      doraIndicators: [wall.tiles[wall.liveEnd]],
    },
  };
};

// --- ツモ ---

/** 山に残る通常ツモ可能な枚数（配牌後は70） */
export const remainingDraws = (wall: Wall): number => wall.liveEnd - wall.nextDraw;

/** 山が尽きたか（流局判定の土台） */
export const isExhausted = (wall: Wall): boolean => remainingDraws(wall) <= 0;

/** 通常ツモ。山が尽きていれば例外（合法手は呼び出し側が isExhausted で事前判定する前提） */
export const draw = (wall: Wall): { tile: Tile; wall: Wall } => {
  if (isExhausted(wall)) {
    throw new Error("draw: wall is exhausted");
  }
  return {
    tile: wall.tiles[wall.nextDraw],
    wall: { ...wall, nextDraw: wall.nextDraw + 1 },
  };
};

/**
 * 嶺上ツモ（カンの補充牌）。嶺上牌を1枚引き、海底を1枚後退させる（liveEnd--）。
 * これによりカン回数に関係なく総ツモ数は常に70になる（通常 70-k ＋ 嶺上 k）。
 * カンドラは公開しない（§3.2）。嶺上牌切れ・流局後のカンは例外。
 */
export const drawRinshan = (wall: Wall): { tile: Tile; wall: Wall } => {
  if (wall.rinshanDrawn >= RINSHAN_MAX) {
    throw new Error("drawRinshan: no rinshan tiles left");
  }
  if (isExhausted(wall)) {
    throw new Error("drawRinshan: wall is exhausted");
  }
  return {
    tile: wall.tiles[TILE_TOTAL - 1 - wall.rinshanDrawn],
    wall: {
      ...wall,
      rinshanDrawn: wall.rinshanDrawn + 1,
      liveEnd: wall.liveEnd - 1,
    },
  };
};

// --- ドラ・王牌 ---

/** 現在のドラ牌（公開表示牌→ドラ変換。#02 doraFromIndicator 連携） */
export const currentDora = (wall: Wall): Tile[] =>
  wall.doraIndicators.map(doraFromIndicator);

/** 王牌（嶺上牌・ドラ表示牌を含む14枚）。整合確認・UI向けの補助 */
export const deadWall = (wall: Wall): Tile[] => wall.tiles.slice(wall.liveEnd);
