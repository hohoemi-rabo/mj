// CPU思考の共通インターフェースと共有ヘルパ（純粋TS / REQUIREMENTS §3.4）。
// 各CPUは state.legalActions 駆動の純粋関数。公開情報＋自分の手牌のみ参照する。
// 既存ロジック（state/hand/shanten）の上に乗る追加レイヤーで、エンジンは一切変更しない。

import { type Tile, isDragon, isHonor, isTerminal, isTerminalOrHonor } from "@/lib/mahjong/tiles";
import { type Hand, discard } from "@/lib/mahjong/hand";
import { handShanten, handUkeire } from "@/lib/mahjong/shanten";
import { type Rng } from "@/lib/mahjong/wall";
import { type GameAction, type GameState, type Seat, legalActions } from "@/lib/mahjong/state";

export type CpuStrength = "weak" | "medium" | "strong";

/** 合法手 → 選択アクション を返す純粋関数。弱のみ rng を使う（中/強は決定的）。 */
export type ChooseAction = (state: GameState, seat: Seat, rng: Rng) => GameAction;

const SEATS: readonly Seat[] = [0, 1, 2, 3];

/** 想定外フェーズでの無害な no-op（reducer は claims 外の pass を素通し）。 */
export const safeFallback = (seat: Seat): GameAction => ({ type: "pass", seat });

/**
 * 勝ち/ドローの背骨。全レベル共通で「引ける/ツモれる/ロンできる」を優先する。
 * la のフラグはフェーズ＆席に紐づくので、フェーズ判定は不要。
 */
export const chooseTerminal = (state: GameState, seat: Seat): GameAction | null => {
  const la = legalActions(state, seat);
  if (la.canDraw) return { type: "draw" };
  if (la.canTsumo) return { type: "tsumo", seat };
  if (la.canRon) return { type: "ron", seat };
  return null;
};

/** 効率打牌：打牌後シャンテン最小 → 受け入れ最大 → 正準順（discards は整列済み）。 */
export const efficientDiscard = (hand: Hand, discards: readonly Tile[]): Tile => {
  let best = discards[0];
  let bestShanten = Infinity;
  let bestUkeire = -1;
  for (const t of discards) {
    const after = discard(hand, t);
    const s = handShanten(after);
    if (s > bestShanten) continue;
    const u = handUkeire(after).count;
    if (s < bestShanten || u > bestUkeire) {
      best = t;
      bestShanten = s;
      bestUkeire = u;
    }
  }
  return best;
};

/** リーチ宣言牌：受け入れ最大（riichiDiscards は全てテンパイ到達済み）。 */
export const bestRiichiDiscard = (hand: Hand, riichiDiscards: readonly Tile[]): Tile => {
  let best = riichiDiscards[0];
  let bestUkeire = -1;
  for (const t of riichiDiscards) {
    const u = handUkeire(discard(hand, t)).count;
    if (u > bestUkeire) {
      best = t;
      bestUkeire = u;
    }
  }
  return best;
};

/** リーチ宣言済みの他家（公開フラグ）。 */
export const riichiOpponents = (state: GameState, seat: Seat): Seat[] =>
  SEATS.filter((s) => s !== seat && state.players[s].hand.riichi);

/** その席にとっての役牌か（三元・自風・場風）。役牌ポンは必ず役を確保する。 */
export const isYakuhaiTileFor = (state: GameState, seat: Seat, tile: Tile): boolean =>
  isDragon(tile) || tile === state.players[seat].seatWind || tile === state.roundWind;

/**
 * 簡易ベタ降りの安全牌選択（公開情報のみ・決定的）。候補は必ず discards 内。
 * ① 全リーチ者の現物 → ② 現物になる人数が最大 → ③ 字牌→老頭 → ④ 先頭。
 */
export const safestDiscard = (
  state: GameState,
  seat: Seat,
  discards: readonly Tile[],
  opps: readonly Seat[],
): Tile => {
  const rivers = opps.map((o) => state.players[o].hand.discards.map((d) => d.tile));
  const coverage = (t: Tile): number => rivers.filter((river) => river.includes(t)).length;

  const safeVsAll = discards.filter((t) => coverage(t) === opps.length);
  if (safeVsAll.length > 0) return safeVsAll[0];

  let best = discards[0];
  let bestCov = -1;
  for (const t of discards) {
    const cov = coverage(t);
    if (cov > bestCov) {
      bestCov = cov;
      best = t;
    }
  }
  if (bestCov > 0) return best;

  const honors = discards.filter(isHonor);
  if (honors.length > 0) return honors[0];
  const terminals = discards.filter((t) => isTerminal(t) || isTerminalOrHonor(t));
  if (terminals.length > 0) return terminals[0];
  return discards[0];
};
