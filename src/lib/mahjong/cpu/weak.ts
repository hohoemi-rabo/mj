// 弱CPU：半ランダム（打牌はランダム）。リーチ・鳴きをせず、生徒が勝ちやすい。
// ただし勝てるとき（ツモ/ロン）は必ず取る。

import { type ChooseAction, chooseTerminal, safeFallback } from "@/lib/mahjong/cpu/common";
import { legalActions } from "@/lib/mahjong/state";

export const weakChoose: ChooseAction = (state, seat, rng) => {
  const terminal = chooseTerminal(state, seat);
  if (terminal) return terminal;

  if (state.phase.kind === "awaiting-discard" && state.phase.seat === seat) {
    const { discards } = legalActions(state, seat);
    if (discards.length === 0) return safeFallback(seat);
    const tile = discards[Math.floor(rng() * discards.length)];
    return { type: "discard", seat, tile };
  }
  if (state.phase.kind === "awaiting-claims") {
    return { type: "pass", seat };
  }
  return safeFallback(seat);
};
