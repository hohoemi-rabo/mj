import { describe, it, expect, beforeEach } from "vitest";
import { type GameState, type Seat, createInitialState, legalActions } from "@/lib/mahjong/state";
import type {
  AdapterError,
  ConnectionStatus,
  MahjongAdapter,
  PlayerAction,
  PlayerInfo,
  SeatAssignment,
  StartOptions,
  Unsubscribe,
} from "@/lib/adapter/types";
import { useGameStore } from "@/lib/store/gameStore";
import {
  opponentSeats,
  selectCurrentSeat,
  selectDora,
  selectIsMyTurn,
  selectMyHand,
  selectScores,
} from "@/lib/store/selectors";

class FakeAdapter implements MahjongAdapter {
  stateCb?: (s: GameState) => void;
  endCb?: (s: GameState) => void;
  playersCb?: (p: readonly PlayerInfo[]) => void;
  errorCb?: (e: AdapterError) => void;
  connCb?: (c: ConnectionStatus) => void;
  sent: PlayerAction[] = [];
  reconnects: { roomId: string; seat: Seat; token: string }[] = [];
  createResult: SeatAssignment | AdapterError = { roomId: "r1", seat: 0, token: "t0", passcode: "1234" };
  joinResult: SeatAssignment | AdapterError = { roomId: "r1", seat: 1, token: "t1" };

  connect(): Promise<void> {
    this.connCb?.("connected");
    return Promise.resolve();
  }
  disconnect(): void {}
  createRoom(): Promise<SeatAssignment> {
    return "roomId" in this.createResult ? Promise.resolve(this.createResult) : Promise.reject(this.createResult);
  }
  joinRoom(): Promise<SeatAssignment> {
    return "roomId" in this.joinResult ? Promise.resolve(this.joinResult) : Promise.reject(this.joinResult);
  }
  reconnect(roomId: string, seat: Seat, token: string): Promise<void> {
    this.reconnects.push({ roomId, seat, token });
    return Promise.resolve();
  }
  start(_opts?: StartOptions): Promise<void> {
    return Promise.resolve();
  }
  send(action: PlayerAction): void {
    this.sent.push(action);
  }
  onPlayers(cb: (p: readonly PlayerInfo[]) => void): Unsubscribe {
    this.playersCb = cb;
    return () => { this.playersCb = undefined; };
  }
  onState(cb: (s: GameState) => void): Unsubscribe {
    this.stateCb = cb;
    return () => { this.stateCb = undefined; };
  }
  onEnd(cb: (s: GameState) => void): Unsubscribe {
    this.endCb = cb;
    return () => { this.endCb = undefined; };
  }
  onError(cb: (e: AdapterError) => void): Unsubscribe {
    this.errorCb = cb;
    return () => { this.errorCb = undefined; };
  }
  onConnectionChange(cb: (c: ConnectionStatus) => void): Unsubscribe {
    this.connCb = cb;
    return () => { this.connCb = undefined; };
  }
}

beforeEach(() => {
  useGameStore.getState().disconnect(); // 状態と購読をリセット
});

describe("gameStore: 接続・部屋", () => {
  it("connect で connection=connected", async () => {
    const fake = new FakeAdapter();
    await useGameStore.getState().connect(fake);
    expect(useGameStore.getState().connection).toBe("connected");
  });

  it("createRoom 成功で roomId/mySeat/passcode 反映", async () => {
    const fake = new FakeAdapter();
    await useGameStore.getState().connect(fake);
    await useGameStore.getState().createRoom("ホスト");
    const s = useGameStore.getState();
    expect(s.roomId).toBe("r1");
    expect(s.mySeat).toBe(0);
    expect(s.passcode).toBe("1234");
  });

  it("createRoom 失敗で lastError、clearError で消える", async () => {
    const fake = new FakeAdapter();
    fake.createResult = { code: "ROOM_FULL", message: "満員です" };
    await useGameStore.getState().connect(fake);
    await useGameStore.getState().createRoom("X");
    expect(useGameStore.getState().lastError?.code).toBe("ROOM_FULL");
    useGameStore.getState().clearError();
    expect(useGameStore.getState().lastError).toBeNull();
  });

  it("joinRoom で mySeat/roomId 反映（passcode なし）", async () => {
    const fake = new FakeAdapter();
    await useGameStore.getState().connect(fake);
    await useGameStore.getState().joinRoom("1234", "B");
    const s = useGameStore.getState();
    expect(s.mySeat).toBe(1);
    expect(s.roomId).toBe("r1");
    expect(s.passcode).toBeNull();
  });

  it("通信断復帰(connected 再発火)でトークン再接続を発火・初回は発火しない（#16）", async () => {
    const fake = new FakeAdapter();
    await useGameStore.getState().connect(fake); // 初回 connected（roomId=null）
    expect(fake.reconnects).toHaveLength(0);
    await useGameStore.getState().createRoom("A"); // roomId/mySeat/myToken セット
    fake.connCb!("connected"); // 通信断からの再接続を模擬
    expect(fake.reconnects).toEqual([{ roomId: "r1", seat: 0, token: "t0" }]);
  });
});

describe("gameStore: イベント購読", () => {
  it("onPlayers で players 反映", async () => {
    const fake = new FakeAdapter();
    await useGameStore.getState().connect(fake);
    const players: PlayerInfo[] = [{ seat: 0, name: "A", isCpu: false, connected: true, isHost: true }];
    fake.playersCb!(players);
    expect(useGameStore.getState().players).toEqual(players);
  });

  it("onState で gameState と myLegalActions（自席ぶん）を導出", async () => {
    const fake = new FakeAdapter();
    await useGameStore.getState().connect(fake);
    await useGameStore.getState().createRoom("A"); // mySeat=0
    const gs = createInitialState(1);
    fake.stateCb!(gs);
    const s = useGameStore.getState();
    expect(s.gameState).toBe(gs);
    expect(s.myLegalActions).toEqual(legalActions(gs, 0));
  });

  it("onEnd で gameState 更新、onError で lastError", async () => {
    const fake = new FakeAdapter();
    await useGameStore.getState().connect(fake);
    const gs = createInitialState(2);
    fake.endCb!(gs);
    expect(useGameStore.getState().gameState).toBe(gs);
    fake.errorCb!({ code: "ILLEGAL_ACTION", message: "x" });
    expect(useGameStore.getState().lastError?.code).toBe("ILLEGAL_ACTION");
  });

  it("send は adapter に委譲", async () => {
    const fake = new FakeAdapter();
    await useGameStore.getState().connect(fake);
    const action: PlayerAction = { type: "discard", seat: 0, tile: "m1" };
    useGameStore.getState().send(action);
    expect(fake.sent).toEqual([action]);
  });
});

describe("selectors", () => {
  it("自席の手牌・手番・ドラ・点数・他家席順", async () => {
    const fake = new FakeAdapter();
    await useGameStore.getState().connect(fake);
    await useGameStore.getState().createRoom("A"); // mySeat=0
    const gs = createInitialState(1);
    fake.stateCb!(gs);
    const s = useGameStore.getState();
    expect(selectMyHand(s)).toBe(gs.players[0].hand);
    expect(selectScores(s)).toEqual([25000, 25000, 25000, 25000]);
    expect(selectDora(s)).toHaveLength(1);
    // 親（dealer）が手番。自席が親なら isMyTurn
    expect(selectIsMyTurn(s)).toBe(gs.dealer === 0);
    expect(selectCurrentSeat(s)).toBe(gs.dealer);
    expect(opponentSeats(0 as Seat)).toEqual([1, 2, 3]);
    expect(opponentSeats(2 as Seat)).toEqual([3, 0, 1]);
  });
});
