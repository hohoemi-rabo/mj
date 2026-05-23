// gameStore 用セレクタ（docs/12）。`useGameStore(selectX)` で必要部分だけ購読し再描画を最小化。
// 盤面の導出はロジック層（state.ts）に委譲する。

import { type Hand, type Discard, concealedWithDrawn, discard } from "@/lib/mahjong/hand";
import { type Tile } from "@/lib/mahjong/tiles";
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
 * 自分の打牌待ち（drawn!==null＝14枚手）のときのみ意味を持つ。それ以外は空集合。
 * handWaits は drawn!==null で throw するため、必ず discard 後（13枚）に対して判定する。
 */
export const tenpaiKeepDiscards = (hand: Hand | null): ReadonlySet<Tile> => {
  if (!hand || hand.drawn === null) return new Set();
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
  if (!hand || hand.drawn === null) return [];
  try {
    const after = discard(hand, tile);
    return handShanten(after) === 0 ? handWaits(after) : [];
  } catch {
    return [];
  }
};
