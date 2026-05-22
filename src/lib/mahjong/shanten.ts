// シャンテン数計算（向聴数）・待ち牌・受け入れ（純粋TS / REQUIREMENTS §3.3, §3.4）。
// お助けモード（待ち牌ハイライト・聴牌通知）と CPU 思考（#09）の中核。
// #02 牌定義・#04 手牌の上に乗る。React・通信・I/Oに非依存・高速。
//
// スコープ（§3.2）: 通常形＋七対子の最小シャンテン。国士・役満は対象外。
// 副露（鳴き）を完成面子として考慮する。
//
// 表現: 牌は長さ34の counts 配列（tileToIndex で 0-33）に集計。
//   index: 0-8=m1..m9 / 9-17=p1..p9 / 18-26=s1..s9 / 27-33=z1..z7。
//   アガリ = -1、聴牌 = 0。

import {
  TILE_COUNT,
  tileFromIndex,
  tileToIndex,
  sortTiles,
  type Tile,
} from "@/lib/mahjong/tiles";
import { completedMeldCount, concealedWithDrawn, type Hand } from "@/lib/mahjong/hand";

/** 牌列を長さ34の counts 配列に集計する。 */
export const toCounts = (tiles: readonly Tile[]): number[] => {
  const counts = new Array<number>(TILE_COUNT).fill(0);
  for (const t of tiles) counts[tileToIndex(t)] += 1;
  return counts;
};

// --- 通常形 ---

// 数牌スーツ内の位置（0-8）。順子・塔子は同一スーツ内・字牌不可なので index 境界で守る。
const isNumberIndex = (i: number): boolean => i < 27;
const posInSuit = (i: number): number => i % 9;

/**
 * counts（破壊→復元する作業配列）を index i から走査し、面子（順子・刻子）と
 * 塔子（対子・両面/辺張・嵌張）に分解して到達しうる最小シャンテンを返す。
 * 雀頭はトップレベル（shantenNormal）で別途確保するため、ここでは扱わない。
 * setsUsed は呼び出し側で meldCount を初期値に入れる。
 * 終端値 8 - 2*setsUsed - partials（雀頭ぶんの -1 は呼び出し側で加える）。
 */
const decompose = (
  counts: number[],
  i: number,
  setsUsed: number,
  partials: number,
): number => {
  // 空き index を飛ばす
  while (i < TILE_COUNT && counts[i] === 0) i++;
  if (i >= TILE_COUNT) return 8 - 2 * setsUsed - partials;

  let best = Infinity;

  // ブロック（面子・塔子）は4スロットまで（雀頭は別枠）。
  if (setsUsed + partials < 4) {
    // 刻子
    if (counts[i] >= 3) {
      counts[i] -= 3;
      best = Math.min(best, decompose(counts, i, setsUsed + 1, partials));
      counts[i] += 3;
    }
    // 順子（同一スーツ内・字牌不可）
    if (isNumberIndex(i) && posInSuit(i) <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
      counts[i] -= 1; counts[i + 1] -= 1; counts[i + 2] -= 1;
      best = Math.min(best, decompose(counts, i, setsUsed + 1, partials));
      counts[i] += 1; counts[i + 1] += 1; counts[i + 2] += 1;
    }
    // 対子塔子（→刻子候補）
    if (counts[i] >= 2) {
      counts[i] -= 2;
      best = Math.min(best, decompose(counts, i, setsUsed, partials + 1));
      counts[i] += 2;
    }
    // 両面・辺張塔子（i, i+1）
    if (isNumberIndex(i) && posInSuit(i) <= 7 && counts[i + 1] > 0) {
      counts[i] -= 1; counts[i + 1] -= 1;
      best = Math.min(best, decompose(counts, i, setsUsed, partials + 1));
      counts[i] += 1; counts[i + 1] += 1;
    }
    // 嵌張塔子（i, i+2）
    if (isNumberIndex(i) && posInSuit(i) <= 6 && counts[i + 2] > 0) {
      counts[i] -= 1; counts[i + 2] -= 1;
      best = Math.min(best, decompose(counts, i, setsUsed, partials + 1));
      counts[i] += 1; counts[i + 2] += 1;
    }
  }

  // この牌を1枚浮かせて先へ進む（どのブロックにも使わない）
  counts[i] -= 1;
  best = Math.min(best, decompose(counts, i, setsUsed, partials));
  counts[i] += 1;

  return best;
};

/**
 * 通常形のシャンテン数。meldCount は完成済み副露の数（暗槓含む）。
 * 雀頭はトップレベルで列挙し、本体DFSは4面子スロットだけを最適化する
 * （「雀頭なし5ブロック」の誤判定を避けるため雀頭をDFSから分離）。
 */
export const shantenNormal = (counts: readonly number[], meldCount: number): number => {
  const work = [...counts];
  // 雀頭なし
  let best = decompose(work, 0, meldCount, 0);
  // 各対子を雀頭に確保したケース
  for (let t = 0; t < TILE_COUNT; t++) {
    if (work[t] >= 2) {
      work[t] -= 2;
      best = Math.min(best, decompose(work, 0, meldCount, 0) - 1);
      work[t] += 2;
    }
  }
  return best;
};

// --- 七対子 ---

/**
 * 七対子のシャンテン数。6 - 対子数 + max(0, 7 - 種類数)。
 * 重複牌（3枚目以降）は種類数の項で正しく減点される。
 * 鳴きがあると成立しないが、その除外は combiner（shanten）側で行う（純関数を保つ）。
 */
export const shantenChiitoitsu = (counts: readonly number[]): number => {
  let pairs = 0;
  let kinds = 0;
  for (const c of counts) {
    if (c >= 1) kinds++;
    if (c >= 2) pairs++;
  }
  return 6 - pairs + Math.max(0, 7 - kinds);
};

/** 通常形と七対子（門前のみ）の最小シャンテン数。アガリ=-1、聴牌=0。 */
export const shanten = (tiles: readonly Tile[], meldCount = 0): number => {
  const counts = toCounts(tiles);
  const normal = shantenNormal(counts, meldCount);
  return meldCount === 0 ? Math.min(normal, shantenChiitoitsu(counts)) : normal;
};

// --- 待ち・受け入れ（13枚相当＝3n+1 形を前提） ---

/** 3n+1 形（13枚相当）でなければ throw。 */
const assertDrawForm = (tiles: readonly Tile[], fn: string): void => {
  if (tiles.length % 3 !== 1) {
    throw new Error(`${fn}: 13枚相当(3n+1)の手牌が必要です (received ${tiles.length})`);
  }
};

/**
 * 受け入れ（シャンテンを1つ進める有効牌）。手牌は 3n+1 形であること。
 * 戻り値: 有効牌の種類（ソート）と、その合計残枚数（4 - 手中の枚数 の総和）。
 * 注: 残枚数は与えられた手牌のみで数える（他家の捨て牌等による減算は呼び出し側）。
 */
export const ukeire = (
  tiles: readonly Tile[],
  meldCount = 0,
): { tiles: Tile[]; count: number } => {
  assertDrawForm(tiles, "ukeire");
  const base = shanten(tiles, meldCount);
  const counts = toCounts(tiles);
  const result: Tile[] = [];
  let count = 0;
  for (let t = 0; t < TILE_COUNT; t++) {
    if (counts[t] >= 4) continue; // 5枚目は引けない
    counts[t] += 1;
    const next = meldCount === 0
      ? Math.min(shantenNormal(counts, meldCount), shantenChiitoitsu(counts))
      : shantenNormal(counts, meldCount);
    counts[t] -= 1;
    if (next < base) {
      result.push(tileFromIndex(t));
      count += 4 - counts[t];
    }
  }
  return { tiles: sortTiles(result), count };
};

/** 聴牌（shanten===0）時のアガリ牌。非聴牌なら []。手牌は 3n+1 形であること。 */
export const waits = (tiles: readonly Tile[], meldCount = 0): Tile[] => {
  assertDrawForm(tiles, "waits");
  if (shanten(tiles, meldCount) !== 0) return [];
  return ukeire(tiles, meldCount).tiles;
};

// --- Hand ラッパ ---

/** 手牌のシャンテン数（ツモ牌込み・副露考慮）。13/14枚どちらでも可。 */
export const handShanten = (hand: Hand): number =>
  shanten(concealedWithDrawn(hand), completedMeldCount(hand));

/** 手牌の待ち牌（聴牌時のアガリ牌）。ツモ前（drawn===null＝13枚形）でのみ呼べる。 */
export const handWaits = (hand: Hand): Tile[] => {
  if (hand.drawn !== null) {
    throw new Error("handWaits: ツモ後(14枚)の手牌では呼べません（先に打牌してください）");
  }
  return waits(concealedWithDrawn(hand), completedMeldCount(hand));
};

/** 手牌の受け入れ。ツモ前（drawn===null＝13枚形）でのみ呼べる。 */
export const handUkeire = (hand: Hand): { tiles: Tile[]; count: number } => {
  if (hand.drawn !== null) {
    throw new Error("handUkeire: ツモ後(14枚)の手牌では呼べません（先に打牌してください）");
  }
  return ukeire(concealedWithDrawn(hand), completedMeldCount(hand));
};
