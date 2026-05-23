import { describe, it, expect } from "vitest";
import { physicalTileCount } from "@/lib/mahjong/hand";
import { TILE_TOTAL, createRng, remainingDraws } from "@/lib/mahjong/wall";
import { handShanten } from "@/lib/mahjong/shanten";
import {
  type GameState,
  type Seat,
  createInitialState,
  currentSeat,
  legalActions,
} from "@/lib/mahjong/state";
import { RoomStore, type Result } from "@/lib/server/session";

// --- 保存則ヘルパ（state.test.ts と同様） ---
const sumPoints = (s: GameState): number => s.players.reduce((a, p) => a + p.points, 0);
const tileTotal = (s: GameState): number => {
  let n = remainingDraws(s.wall) + (TILE_TOTAL - s.wall.liveEnd - s.wall.rinshanDrawn);
  for (const p of s.players) n += physicalTileCount(p.hand) + p.hand.discards.length;
  return n;
};
const assertConservation = (s: GameState): void => {
  expect(sumPoints(s) + s.riichiSticks * 1000).toBe(100000);
  expect(tileTotal(s)).toBe(TILE_TOTAL);
};

const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}`);
  return r.value;
};

describe("部屋作成と合言葉", () => {
  it("ホストは席0・4桁合言葉・isHost", () => {
    const store = new RoomStore();
    const r = unwrap(store.createRoom("ホスト太郎"));
    expect(r.seat).toBe(0);
    expect(r.passcode).toMatch(/^\d{4}$/);
    const players = store.getPlayers(r.roomId);
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ seat: 0, name: "ホスト太郎", isCpu: false, connected: true, isHost: true });
  });

  it("空名はエラー", () => {
    const store = new RoomStore();
    const r = store.createRoom("  ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NAME_REQUIRED");
  });

  it("複数部屋で合言葉は一意", () => {
    const store = new RoomStore();
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) codes.add(unwrap(store.createRoom(`h${i}`)).passcode);
    expect(codes.size).toBe(50);
  });

  it("合言葉は getState/getPlayers に漏れない", () => {
    const store = new RoomStore();
    const { roomId } = unwrap(store.createRoom("h"));
    expect(JSON.stringify(store.getPlayers(roomId))).not.toMatch(/\d{4}/);
  });
});

describe("入室と席割り", () => {
  it("席は 0→1→2→3、5人目は満員", () => {
    const store = new RoomStore();
    const { roomId, passcode } = unwrap(store.createRoom("A"));
    expect(unwrap(store.joinRoom(passcode, "B")).seat).toBe(1);
    expect(unwrap(store.joinRoom(passcode, "C")).seat).toBe(2);
    expect(unwrap(store.joinRoom(passcode, "D")).seat).toBe(3);
    const full = store.joinRoom(passcode, "E");
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.error.code).toBe("ROOM_FULL");
    expect(store.getPlayers(roomId)).toHaveLength(4);
  });

  it("誤合言葉・未存在は WRONG_PASSCODE", () => {
    const store = new RoomStore();
    unwrap(store.createRoom("A"));
    const r = store.joinRoom("9999", "B");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("WRONG_PASSCODE");
  });

  it("空名・開始後はエラー、token は席ごと一意", () => {
    const store = new RoomStore();
    const host = unwrap(store.createRoom("A"));
    const b = unwrap(store.joinRoom(host.passcode, "B"));
    expect(b.token).not.toBe(host.token);
    expect(store.joinRoom(host.passcode, "").ok).toBe(false);
    store.startGame(host.roomId, { seed: 1 });
    const after = store.joinRoom(host.passcode, "C");
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.error.code).toBe("GAME_ALREADY_STARTED");
  });
});

describe("CPU補完と開始", () => {
  it("fillWithCpu は空席をCPU化・冪等", () => {
    const store = new RoomStore();
    const { roomId } = unwrap(store.createRoom("A"));
    store.fillWithCpu(roomId, "strong");
    store.fillWithCpu(roomId, "weak"); // 2回目は占有席を変えない
    const players = store.getPlayers(roomId);
    expect(players).toHaveLength(4);
    expect(players.filter((p) => p.isCpu)).toHaveLength(3);
    expect(players[0].isCpu).toBe(false);
  });

  it("startGame は seed 決定的・開始直後は自動ツモ済み", () => {
    const store = new RoomStore();
    const { roomId } = unwrap(store.createRoom("A"));
    const s = unwrap(store.startGame(roomId, { seed: 1, fillWithCpu: true }));
    // createInitialState(1) を settle（親が1枚ツモ）した状態
    expect(s.phase.kind).toBe("awaiting-discard");
    const dealer = createInitialState(1).dealer;
    expect(s.players[dealer].hand.drawn).not.toBeNull();
    assertConservation(s);
    expect(store.startGame(roomId, { seed: 2 }).ok).toBe(false); // 二重開始不可
  });
});

describe("サーバー権威（不正アクション拒否）", () => {
  const started = () => {
    const store = new RoomStore();
    const { roomId } = unwrap(store.createRoom("A"));
    const s = unwrap(store.startGame(roomId, { seed: 1, fillWithCpu: true }));
    return { store, roomId, s };
  };

  it("手番外の打牌・サーバー管理アクションは ILLEGAL_ACTION、状態不変", () => {
    const { store, roomId, s } = started();
    const turn = currentSeat(s)!;
    const other = ((turn + 1) % 4) as Seat;
    const before = store.getState(roomId);
    const r = store.applyPlayerAction(roomId, other, { type: "discard", seat: other, tile: "m1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("ILLEGAL_ACTION");
    expect(store.getState(roomId)).toBe(before);
    // draw はサーバー管理 → 拒否
    expect(store.applyPlayerAction(roomId, turn, { type: "draw" }).ok).toBe(false);
  });

  it("合法な打牌は受理して状態が進む", () => {
    const { store, roomId, s } = started();
    const turn = currentSeat(s)!;
    const tile = legalActions(s, turn).discards[0];
    const r = store.applyPlayerAction(roomId, turn, { type: "discard", seat: turn, tile });
    expect(r.ok).toBe(true);
    if (r.ok) assertConservation(r.value);
  });

  it("未存在の部屋・未開始は適切なエラー", () => {
    const store = new RoomStore();
    expect(store.applyPlayerAction("nope", 0, { type: "tsumo", seat: 0 }).ok).toBe(false);
    const { roomId } = unwrap(store.createRoom("A"));
    const r = store.applyPlayerAction(roomId, 0, { type: "tsumo", seat: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("GAME_NOT_STARTED");
  });
});

describe("ヘッドレス1局（host=人間 + 3CPU・保存則）", () => {
  // ホストは必ず席0の人間。CPUは advanceAuto が進め、人間席(0)は first-legal で機械的に応答。
  it.each([1, 7, 99999])("seed=%i は終局まで進み各ステップで保存則", (seed) => {
    const store = new RoomStore();
    const { roomId } = unwrap(store.createRoom("human")); // 席0=人間
    store.fillWithCpu(roomId, "medium"); // 席1-3=CPU
    let s = unwrap(store.startGame(roomId, { seed }));
    assertConservation(s);
    const rngs = [0, 1, 2, 3].map((i) => createRng(seed * 100 + i));
    let guard = 0;
    while (s.phase.kind !== "ended" && guard++ < 3000) {
      const auto = store.advanceAuto(roomId, (seat) => rngs[seat]);
      if (auto !== null) {
        s = auto;
        assertConservation(s);
        continue;
      }
      // advanceAuto は人間(席0)の手番で停止する → 合法手から機械的に応答
      const la = legalActions(s, 0);
      let r: Result<GameState>;
      if (la.canTsumo) r = store.applyPlayerAction(roomId, 0, { type: "tsumo", seat: 0 });
      else if (la.canRon) r = store.applyPlayerAction(roomId, 0, { type: "ron", seat: 0 });
      else if (la.canPass) r = store.applyPlayerAction(roomId, 0, { type: "pass", seat: 0 });
      else if (la.discards.length > 0) r = store.applyPlayerAction(roomId, 0, { type: "discard", seat: 0, tile: la.discards[0] });
      else break;
      expect(r.ok).toBe(true);
      if (!r.ok) break;
      s = r.value;
      assertConservation(s);
    }
    expect(s.phase.kind).toBe("ended");
    expect(s.result?.kind === "win" || s.result?.kind === "ryuukyoku").toBe(true);
    if (s.result?.kind === "ryuukyoku") {
      expect(s.result.pointDeltas.reduce((a, b) => a + b, 0)).toBe(0);
      const tenpai = ([0, 1, 2, 3] as Seat[]).filter((seat) => handShanten(s.players[seat].hand) === 0);
      expect([...s.result.tenpaiSeats].sort()).toEqual(tenpai.sort());
    }
  });
});

describe("後始末", () => {
  it("removeRoom 後は状態なし・操作不可", () => {
    const store = new RoomStore();
    const { roomId } = unwrap(store.createRoom("A"));
    store.startGame(roomId, { seed: 1, fillWithCpu: true });
    store.removeRoom(roomId);
    expect(store.getState(roomId)).toBeNull();
    const r = store.applyPlayerAction(roomId, 0, { type: "tsumo", seat: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("ROOM_NOT_FOUND");
  });
});

describe("切断/再接続（#16）", () => {
  const connectedOf = (store: RoomStore, roomId: string, seat: Seat): boolean | undefined =>
    store.getPlayers(roomId).find((p) => p.seat === seat)?.connected;

  it("切断で connected=false・正トークン再接続で復元・誤トークンは失敗", () => {
    const store = new RoomStore();
    const a = unwrap(store.createRoom("A"));
    store.bindSocket(a.roomId, 0, "sA");
    const b = unwrap(store.joinRoom(a.passcode, "B"));
    store.bindSocket(a.roomId, b.seat, "sB");

    // 切断
    expect(store.markDisconnected("sB")).toEqual({ roomId: a.roomId, seat: b.seat });
    expect(connectedOf(store, a.roomId, b.seat)).toBe(false);

    // 誤トークンは失敗
    expect(store.reconnect(a.roomId, b.seat, "wrong", "sB2").ok).toBe(false);
    // 正トークンで復元
    expect(store.reconnect(a.roomId, b.seat, b.token, "sB2").ok).toBe(true);
    expect(connectedOf(store, a.roomId, b.seat)).toBe(true);
  });

  it("再接続後に旧 socketId の切断が来ても無視（競合回避）", () => {
    const store = new RoomStore();
    const a = unwrap(store.createRoom("A"));
    const b = unwrap(store.joinRoom(a.passcode, "B"));
    store.bindSocket(a.roomId, b.seat, "sB");
    store.markDisconnected("sB");
    store.reconnect(a.roomId, b.seat, b.token, "sB2"); // 新IDに束ね直し
    // 旧IDの遅延 disconnect は該当なし
    expect(store.markDisconnected("sB")).toBeNull();
    expect(connectedOf(store, a.roomId, b.seat)).toBe(true);
    // 未知 socket も null
    expect(store.markDisconnected("unknown")).toBeNull();
  });

  it.each([1, 7])("seed=%i 切断中の人間席は CPU 代行で終局まで進む", (seed) => {
    const store = new RoomStore();
    const a = unwrap(store.createRoom("human"));
    store.bindSocket(a.roomId, 0, "sA");
    store.fillWithCpu(a.roomId, "weak");
    unwrap(store.startGame(a.roomId, { seed }));
    store.markDisconnected("sA"); // 人間(席0)も切断 → 全席が自動席
    const rngs = [0, 1, 2, 3].map((i) => createRng(seed * 7 + i));
    let guard = 0;
    while (store.getState(a.roomId)!.phase.kind !== "ended" && guard++ < 5000) {
      if (store.advanceAuto(a.roomId, (s) => rngs[s]) === null) break;
    }
    const s = store.getState(a.roomId)!;
    expect(s.phase.kind).toBe("ended");
    assertConservation(s);
  });

  it("stepAuto は接続中の人間の手番で停止する", () => {
    const store = new RoomStore();
    const a = unwrap(store.createRoom("human"));
    store.bindSocket(a.roomId, 0, "sA");
    store.fillWithCpu(a.roomId, "medium");
    unwrap(store.startGame(a.roomId, { seed: 1 }));
    const rngs = [0, 1, 2, 3].map((i) => createRng(100 + i));
    store.advanceAuto(a.roomId, (s) => rngs[s]); // 人間(席0)まで進む
    const next = store.stepAuto(a.roomId, (s) => rngs[s]);
    const s = store.getState(a.roomId)!;
    if (s.phase.kind !== "ended") {
      expect(next.acted).toBe(false); // 人間の番なので自動では進めない
      const la = legalActions(s, 0);
      const hasMove =
        la.discards.length > 0 || la.canTsumo || la.canRon || la.canPon ||
        la.chiOptions.length > 0 || la.canMinkan || la.canPass;
      expect(hasMove).toBe(true); // 席0の手番で止まっている
    }
  });
});
