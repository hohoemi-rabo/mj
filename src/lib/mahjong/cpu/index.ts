// CPU思考のエントリポイント。強さ → ChooseAction をディスパッチする。
// 駆動（手番判定・思考時間演出）は通信/補完層（#16）の責務。

import { type ChooseAction, type CpuStrength } from "@/lib/mahjong/cpu/common";
import { weakChoose } from "@/lib/mahjong/cpu/weak";
import { mediumChoose } from "@/lib/mahjong/cpu/medium";
import { strongChoose } from "@/lib/mahjong/cpu/strong";
import { type GameAction, type GameState, type Seat } from "@/lib/mahjong/state";
import { type Rng } from "@/lib/mahjong/wall";

export type { CpuStrength, ChooseAction } from "@/lib/mahjong/cpu/common";

const TABLE: Readonly<Record<CpuStrength, ChooseAction>> = {
  weak: weakChoose,
  medium: mediumChoose,
  strong: strongChoose,
};

/** 指定した強さで合法手から1手を選ぶ。 */
export const chooseAction = (
  strength: CpuStrength,
  state: GameState,
  seat: Seat,
  rng: Rng,
): GameAction => TABLE[strength](state, seat, rng);
