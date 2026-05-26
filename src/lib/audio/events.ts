// gameState の差分から音声イベントを検出する純関数（docs/17）。
// 副作用なし＝単体テスト容易。フック側はこの結果を再生キューに流すだけ。

import { type GameResult, type GameState, type Seat } from "@/lib/mahjong/state";
import { type MeldType } from "@/lib/mahjong/hand";

export type AudioEvent =
  | { kind: "shuffle" }
  | { kind: "discard" }
  | { kind: "riichi"; seat: Seat }
  | { kind: "meld"; seat: Seat; type: MeldType }
  | { kind: "win"; result: Extract<GameResult, { kind: "win" }> }
  | { kind: "ryuukyoku"; result: Extract<GameResult, { kind: "ryuukyoku" }> };

const SEATS: readonly Seat[] = [0, 1, 2, 3];

/**
 * prev → curr の差分から発火すべき音声イベント列を返す。
 * 同時発火順は: shuffle → meld → riichi → discard → ended。
 * 1ターンで riichi と discard 両方を出さない（riichi 優先＝SE と宣言が打牌音より目立つべき）。
 */
export const detectAudioEvents = (
  prev: GameState | null,
  curr: GameState,
): AudioEvent[] => {
  const events: AudioEvent[] = [];

  // 配牌（ゲーム開始）
  if (prev === null) events.push({ kind: "shuffle" });

  // 鳴き（各席の melds.length が増えた）
  if (prev !== null) {
    for (const s of SEATS) {
      const before = prev.players[s].hand.melds.length;
      const after = curr.players[s].hand.melds.length;
      if (after > before) {
        const meld = curr.players[s].hand.melds[after - 1];
        events.push({ kind: "meld", seat: s, type: meld.type });
      }
    }
  }

  // リーチ宣言（hand.riichi が false→true になった席）と打牌
  let riichiSeen = false;
  if (prev !== null) {
    for (const s of SEATS) {
      if (!prev.players[s].hand.riichi && curr.players[s].hand.riichi) {
        events.push({ kind: "riichi", seat: s });
        riichiSeen = true;
      }
    }
  }
  // 打牌（lastDiscard の参照変化。リーチが出たターンは省略＝音声が重ならないように）
  if (!riichiSeen) {
    const before = prev?.lastDiscard ?? null;
    if (curr.lastDiscard !== before && curr.lastDiscard !== null) {
      events.push({ kind: "discard" });
    }
  }

  // 終局（phase が ended に遷移）
  const wasEnded = prev?.phase.kind === "ended";
  if (!wasEnded && curr.phase.kind === "ended" && curr.result) {
    if (curr.result.kind === "win") {
      events.push({ kind: "win", result: curr.result });
    } else {
      events.push({ kind: "ryuukyoku", result: curr.result });
    }
  }

  return events;
};
