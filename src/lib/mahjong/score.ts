// 点数計算（純粋TS / REQUIREMENTS §3.2）。
// 符は #06 yaku.ts で算出済み。本モジュールは (翻, 符) を基本点→点数授受に変換し、
// リーチ棒供託を精算する。1局制（連荘・本場なし）。I/O・React 非依存。
//
// 計算式は本格リーチ麻雀に準拠（切り上げ満貫なし）。値は公式点数表で検証済み。

import type { YakuResult } from "@/lib/mahjong/yaku";

export type LimitName = "満貫" | "跳満" | "倍満" | "三倍満" | "数え役満";

/** 点数授受の内訳。 */
export type Payment =
  | { readonly type: "ron"; readonly discarder: number } // 放銃者の支払い
  | { readonly type: "tsumo-dealer"; readonly each: number } // 親ツモ: 子3人が each
  | { readonly type: "tsumo-nondealer"; readonly dealer: number; readonly nonDealer: number }; // 子ツモ

export interface ScoreInput {
  readonly han: number;
  readonly fu: number;
  readonly isDealer: boolean; // 和了者が親か
  readonly isTsumo: boolean;
  readonly riichiSticks?: number; // 卓上のリーチ棒本数（勝者自身の棒を含む）。既定0
}

export interface ScoreResult {
  readonly han: number;
  readonly fu: number;
  readonly base: number; // 基本点（上限適用後）
  readonly limitName: LimitName | null;
  readonly total: number; // 手から受け取る合計（リーチ棒除く）
  readonly payment: Payment;
  readonly riichiSticks: number;
  readonly riichiStickPoints: number; // 1000 * riichiSticks
  readonly winnerGain: number; // total + riichiStickPoints
}

/** 100点単位で切り上げ。 */
const roundUp100 = (x: number): number => Math.ceil(x / 100) * 100;

/** 翻・符 → 基本点と満貫以上の名称。 */
const computeBase = (han: number, fu: number): { base: number; limitName: LimitName | null } => {
  if (han >= 13) return { base: 8000, limitName: "数え役満" };
  if (han >= 11) return { base: 6000, limitName: "三倍満" };
  if (han >= 8) return { base: 4000, limitName: "倍満" };
  if (han >= 6) return { base: 3000, limitName: "跳満" };
  if (han >= 5) return { base: 2000, limitName: "満貫" };
  // han 1–4: 素点。2000以上に達したときだけ満貫にキャップ（切り上げ満貫はしない）
  const raw = fu * 2 ** (2 + han);
  if (raw >= 2000) return { base: 2000, limitName: "満貫" };
  return { base: raw, limitName: null };
};

/** 基本点 → 支払い内訳と合計。各支払いは100点単位で切り上げ。 */
const computePayment = (
  base: number,
  isDealer: boolean,
  isTsumo: boolean,
): { payment: Payment; total: number } => {
  if (!isTsumo) {
    const discarder = roundUp100(base * (isDealer ? 6 : 4));
    return { payment: { type: "ron", discarder }, total: discarder };
  }
  if (isDealer) {
    const each = roundUp100(base * 2);
    return { payment: { type: "tsumo-dealer", each }, total: each * 3 };
  }
  const dealer = roundUp100(base * 2);
  const nonDealer = roundUp100(base * 1);
  return { payment: { type: "tsumo-nondealer", dealer, nonDealer }, total: dealer + nonDealer * 2 };
};

/** 翻・符・親子・ツモ/ロン・リーチ棒から点数授受を確定する。 */
export const score = (input: ScoreInput): ScoreResult => {
  const { han, fu, isDealer, isTsumo, riichiSticks = 0 } = input;
  if (!Number.isInteger(han) || han < 1) {
    throw new Error(`score: 翻は1以上の整数が必要です (received ${han})`);
  }
  if (!Number.isInteger(fu) || fu < 20) {
    throw new Error(`score: 符は20以上の整数が必要です (received ${fu})`);
  }
  if (!Number.isInteger(riichiSticks) || riichiSticks < 0) {
    throw new Error(`score: リーチ棒は0以上の整数が必要です (received ${riichiSticks})`);
  }

  const { base, limitName } = computeBase(han, fu);
  const { payment, total } = computePayment(base, isDealer, isTsumo);
  const riichiStickPoints = 1000 * riichiSticks;

  return {
    han,
    fu,
    base,
    limitName,
    total,
    payment,
    riichiSticks,
    riichiStickPoints,
    winnerGain: total + riichiStickPoints,
  };
};

/** #06 の YakuResult から点数を算出する便宜関数（han=totalHan, fu, isTsumo を取り込む）。 */
export const scoreFromYaku = (
  y: YakuResult,
  opts: { isDealer: boolean; riichiSticks?: number },
): ScoreResult =>
  score({
    han: y.totalHan,
    fu: y.fu,
    isDealer: opts.isDealer,
    isTsumo: y.isTsumo,
    riichiSticks: opts.riichiSticks,
  });
