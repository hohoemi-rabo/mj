// 中CPU：シャンテンを意識した手作り（効率打牌＋テンパイでリーチ）。役は役牌ポンのみ
// で確保（チー・カン・明槓はしない＝役なし開手を避け門前価値を保つ）。降り判断はなし。

import {
  type ChooseAction,
  bestRiichiDiscard,
  chooseTerminal,
  efficientDiscard,
  isYakuhaiTileFor,
  safeFallback,
} from "@/lib/mahjong/cpu/common";
import { legalActions } from "@/lib/mahjong/state";

export const mediumChoose: ChooseAction = (state, seat) => {
  const terminal = chooseTerminal(state, seat);
  if (terminal) return terminal;

  const hand = state.players[seat].hand;
  if (state.phase.kind === "awaiting-discard" && state.phase.seat === seat) {
    const la = legalActions(state, seat);
    if (la.riichiDiscards.length > 0) {
      return { type: "discard", seat, tile: bestRiichiDiscard(hand, la.riichiDiscards), riichi: true };
    }
    if (la.discards.length === 0) return safeFallback(seat);
    return { type: "discard", seat, tile: efficientDiscard(hand, la.discards) };
  }
  if (state.phase.kind === "awaiting-claims") {
    const la = legalActions(state, seat);
    if (la.canPon && isYakuhaiTileFor(state, seat, state.phase.window.discardTile)) {
      return { type: "pon", seat };
    }
    return { type: "pass", seat };
  }
  return safeFallback(seat);
};
