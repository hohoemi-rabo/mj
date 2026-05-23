// 対局画面の表示ラベル（風など）。複数コンポーネントで共有する小ヘルパ。

import { type Honor } from "@/lib/mahjong/tiles";

/** 風牌 → 漢字一文字（東/南/西/北）。 */
export const windLabel = (wind: Honor): string =>
  ({ z1: "東", z2: "南", z3: "西", z4: "北" }[wind as "z1" | "z2" | "z3" | "z4"] ?? "");
