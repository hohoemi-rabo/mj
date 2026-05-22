// gameStore 用セレクタ（docs/12）。`useGameStore(selectX)` で必要部分だけ購読し再描画を最小化。
// 盤面の導出はロジック層（state.ts）に委譲する。

import { type Hand } from "@/lib/mahjong/hand";
import { type Discard } from "@/lib/mahjong/hand";
import { type Tile } from "@/lib/mahjong/tiles";
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
