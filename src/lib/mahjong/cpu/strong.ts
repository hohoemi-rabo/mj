// 強CPU：中の手作りに簡易ベタ降りを追加。他家リーチ中かつ自分ノーテンなら現物で降りる
// （リーチしない・鳴かない）。自分がテンパイなら押す。中級者相当。

import {
  type ChooseAction,
  bestRiichiDiscard,
  chooseTerminal,
  efficientDiscard,
  isYakuhaiTileFor,
  riichiOpponents,
  safeFallback,
  safestDiscard,
} from "@/lib/mahjong/cpu/common";
import { discard } from "@/lib/mahjong/hand";
import { handShanten } from "@/lib/mahjong/shanten";
import { legalActions } from "@/lib/mahjong/state";

export const strongChoose: ChooseAction = (state, seat) => {
  const terminal = chooseTerminal(state, seat);
  if (terminal) return terminal;

  const hand = state.players[seat].hand;
  const opps = riichiOpponents(state, seat);

  if (state.phase.kind === "awaiting-discard" && state.phase.seat === seat) {
    const la = legalActions(state, seat);
    if (la.discards.length === 0) return safeFallback(seat);

    const selfTenpai = la.discards.some((t) => handShanten(discard(hand, t)) === 0);
    if (opps.length > 0 && !selfTenpai) {
      // ベタ降り：安全牌を打つ（リーチしない）
      return { type: "discard", seat, tile: safestDiscard(state, seat, la.discards, opps) };
    }
    if (la.riichiDiscards.length > 0) {
      return { type: "discard", seat, tile: bestRiichiDiscard(hand, la.riichiDiscards), riichi: true };
    }
    return { type: "discard", seat, tile: efficientDiscard(hand, la.discards) };
  }

  if (state.phase.kind === "awaiting-claims") {
    const la = legalActions(state, seat);
    // 他家リーチ中は鳴かず守る。平穏なら役牌ポンのみ。
    if (opps.length === 0 && la.canPon && isYakuhaiTileFor(state, seat, state.phase.window.discardTile)) {
      return { type: "pon", seat };
    }
    return { type: "pass", seat };
  }
  return safeFallback(seat);
};
