// 音声イベント検出ロジックの単体テスト（純関数）。

import { describe, expect, it } from "vitest";
import { type GameState, createInitialState } from "@/lib/mahjong/state";
import { type Meld } from "@/lib/mahjong/hand";
import { detectAudioEvents } from "@/lib/audio/events";

// 検出に必要な部分だけ書き換える深いコピーヘルパ。
const clone = (s: GameState): GameState => structuredClone(s) as GameState;

const setHand = (s: GameState, seat: 0 | 1 | 2 | 3, hand: Partial<GameState["players"][number]["hand"]>): GameState => {
  const c = clone(s);
  const players = c.players.map((p, i) =>
    i === seat ? { ...p, hand: { ...p.hand, ...hand } } : p,
  ) as GameState["players"];
  return { ...c, players };
};

const base = (): GameState => createInitialState(1, { dealer: 0 });

describe("detectAudioEvents", () => {
  it("prev===null は shuffle を出す（ゲーム開始）", () => {
    expect(detectAudioEvents(null, base())).toEqual([{ kind: "shuffle" }]);
  });

  it("差分が無ければ空", () => {
    const s = base();
    expect(detectAudioEvents(s, s)).toEqual([]);
  });

  it("lastDiscard が新規に入れば discard", () => {
    const prev = base();
    const curr = { ...clone(prev), lastDiscard: { seat: 0 as const, tile: "m1" as const } };
    expect(detectAudioEvents(prev, curr)).toEqual([{ kind: "discard" }]);
  });

  it("hand.riichi が false→true なら riichi（discard は出さない）", () => {
    const prev = base();
    const curr = setHand(prev, 1, { riichi: true });
    // lastDiscard も同時に更新されたケースでも riichi 優先
    const currWithDiscard = { ...curr, lastDiscard: { seat: 1 as const, tile: "p5" as const } };
    expect(detectAudioEvents(prev, currWithDiscard)).toEqual([{ kind: "riichi", seat: 1 }]);
  });

  it("melds.length が増えれば meld（type が新メルドの type）", () => {
    const prev = base();
    const newMeld: Meld = { type: "pon", tiles: ["s3", "s3", "s3"], calledTile: "s3", from: 0 };
    const curr = setHand(prev, 2, { melds: [newMeld] });
    expect(detectAudioEvents(prev, curr)).toEqual([{ kind: "meld", seat: 2, type: "pon" }]);
  });

  it("phase が ended(win) に遷移すれば win", () => {
    const prev = base();
    const curr = clone(prev);
    const result = {
      kind: "win" as const,
      winners: [],
      loserSeat: null,
      pointDeltas: [0, 0, 0, 0],
      riichiSticksCollected: 0,
    };
    const ended: GameState = { ...curr, phase: { kind: "ended", result }, result };
    expect(detectAudioEvents(prev, ended)).toEqual([{ kind: "win", result }]);
  });

  it("phase が ended(ryuukyoku) に遷移すれば ryuukyoku", () => {
    const prev = base();
    const curr = clone(prev);
    const result = {
      kind: "ryuukyoku" as const,
      tenpaiSeats: [],
      pointDeltas: [0, 0, 0, 0],
    };
    const ended: GameState = { ...curr, phase: { kind: "ended", result }, result };
    expect(detectAudioEvents(prev, ended)).toEqual([{ kind: "ryuukyoku", result }]);
  });

  it("既に ended の状態のままなら win/ryuukyoku は再発火しない", () => {
    const result = {
      kind: "ryuukyoku" as const,
      tenpaiSeats: [],
      pointDeltas: [0, 0, 0, 0],
    };
    const ended: GameState = { ...clone(base()), phase: { kind: "ended", result }, result };
    expect(detectAudioEvents(ended, ended)).toEqual([]);
  });
});
