// gameStore 用セレクタ（docs/12）。`useGameStore(selectX)` で必要部分だけ購読し再描画を最小化。
// 盤面の導出はロジック層（state.ts）に委譲する。

import { type Hand, type Discard, concealedWithDrawn, discard, isMenzen } from "@/lib/mahjong/hand";
import { type Honor, type Tile, isHonor, isSimple, suitOf } from "@/lib/mahjong/tiles";
import { handShanten, handWaits } from "@/lib/mahjong/shanten";
import { remainingDraws } from "@/lib/mahjong/wall";
import { type Seat, currentSeat, doraTiles } from "@/lib/mahjong/state";
import type { GameStore } from "@/lib/store/gameStore";

/** 自分の手牌（自席が未確定/未開始なら null）。 */
export const selectMyHand = (s: GameStore): Hand | null =>
  s.gameState && s.mySeat !== null ? s.gameState.players[s.mySeat].hand : null;

/** 指定席の捨て牌（河）。 */
export const selectDiscards = (s: GameStore, seat: Seat): readonly Discard[] =>
  s.gameState ? s.gameState.players[seat].hand.discards : [];

/** 現在の手番席（claims/ended は null）。 */
export const selectCurrentSeat = (s: GameStore): Seat | null =>
  s.gameState ? currentSeat(s.gameState) : null;

/** 自分の手番か。 */
export const selectIsMyTurn = (s: GameStore): boolean =>
  s.gameState !== null && s.mySeat !== null && currentSeat(s.gameState) === s.mySeat;

/** 現在のドラ（表示牌→ドラ変換済み）。 */
export const selectDora = (s: GameStore): Tile[] =>
  s.gameState ? doraTiles(s.gameState) : [];

/** 各席の持ち点（index=席）。 */
export const selectScores = (s: GameStore): readonly number[] =>
  s.gameState ? s.gameState.players.map((p) => p.points) : [];

/** 他家の席を 下家(+1)・対面(+2)・上家(+3) の順で返す。 */
export const opponentSeats = (mySeat: Seat): [Seat, Seat, Seat] => [
  ((mySeat + 1) % 4) as Seat,
  ((mySeat + 2) % 4) as Seat,
  ((mySeat + 3) % 4) as Seat,
];

/** 残りツモ可能数（山の生牌）。 */
export const selectWallRemaining = (s: GameStore): number =>
  s.gameState ? remainingDraws(s.gameState.wall) : 0;

// --- お助けモード用の純ヘルパ（store セレクタではない） ---
// 新しい Set/配列を返すため useSyncExternalStore に直接渡さない。コンポーネントで
// `useMemo(() => tenpaiKeepDiscards(hand), [hand])` のように安定参照(hand)で memo 化して使う。

/**
 * いま切るとテンパイ維持（聴牌のまま）になる牌種の集合。
 * 「打牌が必要」な状態（ツモ後＝drawn!==null、もしくはポン/チー/明槓直後＝3n+2形）でのみ意味を持つ。それ以外は空集合。
 * handWaits は 3n+1 形でないと throw するため、必ず discard 後（3n+1）に対して判定する。
 */
export const tenpaiKeepDiscards = (hand: Hand | null): ReadonlySet<Tile> => {
  if (!hand || concealedWithDrawn(hand).length % 3 !== 2) return new Set();
  const out = new Set<Tile>();
  for (const t of new Set(concealedWithDrawn(hand))) {
    try {
      if (handShanten(discard(hand, t)) === 0) out.add(t);
    } catch {
      /* 切れない牌（理論上ありえない）はスキップ */
    }
  }
  return out;
};

/** ある牌 tile を切った後の待ち牌（テンパイなら）。テンパイでなければ空配列。 */
export const waitsAfterDiscard = (hand: Hand | null, tile: Tile): Tile[] => {
  if (!hand || concealedWithDrawn(hand).length % 3 !== 2) return [];
  try {
    const after = discard(hand, tile);
    return handShanten(after) === 0 ? handWaits(after) : [];
  } catch {
    return [];
  }
};

/**
 * 自分の「待ち牌」集合（お助けの河ハイライト用・#18）。
 * 「次のツモ待ち」状態（3n+1形）かつテンパイのときだけ意味を持つ。それ以外は空集合。
 * ツモ後（14枚）やポン/チー/明槓直後（3n+2）では handWaits が throw するので空にする。
 */
export const selectMyWaits = (hand: Hand | null): ReadonlySet<Tile> => {
  if (!hand || concealedWithDrawn(hand).length % 3 !== 1) return new Set();
  if (handShanten(hand) !== 0) return new Set();
  return new Set(handWaits(hand));
};

// --- 成立しうる役のヒューリスティック（#18 お助け）---
// 14枚和了形向けの `evaluateYaku()` と違い、13/14枚どちらの不完全手にも使える「狙えそうな役」判定。
// 高確度な役だけを返し、進行中の三色/一気通貫/一盃口/平和は誤検出回避のため対象外。
// 戻り値の文字列は `yaku.ts` の `YakuHit.name` と一致させる（音声 mp3 マッピング・表示の統一）。

const DRAGON_LABEL: Readonly<Record<"z5" | "z6" | "z7", string>> = {
  z5: "役牌 白",
  z6: "役牌 發",
  z7: "役牌 中",
};
const WIND_LABEL: Readonly<Record<"z1" | "z2" | "z3" | "z4", string>> = {
  z1: "東",
  z2: "南",
  z3: "西",
  z4: "北",
};

const countByTile = (tiles: readonly Tile[]): Map<Tile, number> => {
  const m = new Map<Tile, number>();
  for (const t of tiles) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
};

/** 保有する全牌（concealed＋drawn＋鳴き牌すべて）。 */
const allOwnedTiles = (hand: Hand): Tile[] => [
  ...concealedWithDrawn(hand),
  ...hand.melds.flatMap((m) => m.tiles),
];

/**
 * 「狙えそうな役」を文字列配列で返す（順序は概ね手から見える順）。
 * 未開始/null は空。誤検出抑制のため進行中の順子系（三色/一気通貫/一盃口）は除外。
 * `seatWind` は自風（z1..z4）、`roundWind` は場風（このプロジェクトでは常に z1）。
 */
export const currentlyPossibleYaku = (
  hand: Hand | null,
  seatWind: Honor,
  roundWind: Honor,
): string[] => {
  if (!hand) return [];
  const all = allOwnedTiles(hand);
  if (all.length === 0) return [];
  const counts = countByTile(all);
  const out: string[] = [];

  // リーチ済みなら確定で表示
  if (hand.riichi) out.push("立直");
  // 門前なら門前清自摸和の可能性
  if (isMenzen(hand)) out.push("門前清自摸和");

  // タンヤオ（全牌が中張牌）
  if (all.every(isSimple)) out.push("断幺九");

  // 清一色 / 混一色（数牌が1スーツのみ）
  const numberSuits = new Set<string>();
  let hasHonor = false;
  for (const t of all) {
    if (isHonor(t)) hasHonor = true;
    else numberSuits.add(suitOf(t));
  }
  if (numberSuits.size === 1) {
    out.push(hasHonor ? "混一色" : "清一色");
  }

  // 七対子（門前・鳴きなし・2枚種数 ≥ 5）
  if (isMenzen(hand) && hand.melds.length === 0) {
    const concealedCounts = countByTile(concealedWithDrawn(hand));
    let pairs = 0;
    for (const c of concealedCounts.values()) if (c >= 2) pairs++;
    if (pairs >= 5) out.push("七対子");
  }

  // 対々和（鳴きの刻子/槓 ＋ 純手牌で 3 枚一致種数 ≥ 2）
  const meldTriplets = hand.melds.filter(
    (m) => m.type === "pon" || m.type === "minkan" || m.type === "ankan" || m.type === "kakan",
  ).length;
  const concealedCounts2 = countByTile(concealedWithDrawn(hand));
  const concealedTriplets = [...concealedCounts2.values()].filter((c) => c >= 3).length;
  if (meldTriplets + concealedTriplets >= 2) out.push("対々和");

  // 役牌（白發中・自風・場風） — 2 枚以上保有で「狙える」扱い
  for (const t of ["z5", "z6", "z7"] as const) {
    if ((counts.get(t) ?? 0) >= 2) out.push(DRAGON_LABEL[t]);
  }
  if ((counts.get(seatWind) ?? 0) >= 2) {
    out.push(`自風 ${WIND_LABEL[seatWind as "z1" | "z2" | "z3" | "z4"]}`);
  }
  // 連風（自風==場風）のときは両方計上（yaku.ts と同方針）。違うときは場風を別途。
  if (seatWind === roundWind) {
    if ((counts.get(seatWind) ?? 0) >= 2) {
      out.push(`場風 ${WIND_LABEL[seatWind as "z1" | "z2" | "z3" | "z4"]}`);
    }
  } else if ((counts.get(roundWind) ?? 0) >= 2) {
    out.push(`場風 ${WIND_LABEL[roundWind as "z1" | "z2" | "z3" | "z4"]}`);
  }

  return out;
};
