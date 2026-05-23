// サーバー権威のセッションコア（純粋・socket/next 非依存 / docs/11）。
// 部屋・席・ゲーム進行をメモリ上で管理する（DB無し §4.3）。socket グルー（server.ts）は
// これを薄く呼ぶだけ。reducer が単一の真実で、不正アクションは validate で弾く。
// timing/rng は注入（CPUの思考遅延・乱数はグルー/#16 が供給）＝コアは決定的・テスト可能。

import {
  type GameAction,
  type GameState,
  type Seat,
  createInitialState,
  legalActions,
  reducer,
  validate,
} from "@/lib/mahjong/state";
import { type Rng } from "@/lib/mahjong/wall";
import { type CpuStrength, chooseAction } from "@/lib/mahjong/cpu";
import type {
  AdapterError,
  AdapterErrorCode,
  ClientToken,
  Passcode,
  PlayerInfo,
  RoomId,
  StartOptions,
} from "@/lib/adapter/types";

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err = { readonly ok: false; readonly error: AdapterError };
export type Result<T> = Ok<T> | Err;

const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
const ERR_MESSAGE: Readonly<Record<AdapterErrorCode, string>> = {
  ROOM_NOT_FOUND: "部屋が見つかりません",
  WRONG_PASSCODE: "合言葉が違います",
  ROOM_FULL: "この部屋は満員です",
  NAME_REQUIRED: "名前を入力してください",
  GAME_ALREADY_STARTED: "対局はすでに始まっています",
  GAME_NOT_STARTED: "対局はまだ始まっていません",
  NOT_HOST: "ホストのみ操作できます",
  ILLEGAL_ACTION: "その手は出せません",
  INTERNAL: "エラーが発生しました",
};
const err = (code: AdapterErrorCode): Err => ({ ok: false, error: { code, message: ERR_MESSAGE[code] } });

const SEATS: readonly Seat[] = [0, 1, 2, 3];
const DEFAULT_CPU: CpuStrength = "medium";

interface SeatSlot {
  name: string;
  isCpu: boolean;
  connected: boolean;
  token: ClientToken;
  socketId: string | null; // グルーが束ねる（#16 シーム）
  cpuStrength: CpuStrength | null;
}

interface Room {
  roomId: RoomId;
  passcode: Passcode;
  hostSeat: Seat;
  seats: (SeatSlot | null)[]; // length 4, index === seat
  state: GameState | null;
  started: boolean;
  seed: number | null;
}

const randId = (): string => `r-${Math.random().toString(36).slice(2, 8)}`;
const randToken = (): string => Math.random().toString(36).slice(2, 12);

/** awaiting-draw を消化して手番者に drawn を持たせる（自動ツモ）。 */
const settle = (state: GameState): GameState => {
  let s = state;
  let guard = 0;
  while (s.phase.kind === "awaiting-draw" && guard++ < 8) s = reducer(s, { type: "draw" });
  return s;
};

/** 現在アクションを返すべき席（claims は未応答 eligible の先頭）。無ければ null。 */
const actorSeat = (state: GameState): Seat | null => {
  const p = state.phase;
  if (p.kind === "awaiting-draw" || p.kind === "awaiting-discard") return p.seat;
  if (p.kind === "awaiting-claims") {
    const pending = p.window.eligible.find((o) => !p.window.responses.some((r) => r.seat === o.seat));
    return pending ? pending.seat : null;
  }
  return null;
};

export class RoomStore {
  private readonly rooms = new Map<RoomId, Room>();

  private freshPasscode(): Passcode {
    const taken = new Set([...this.rooms.values()].map((r) => r.passcode));
    let code: string;
    do {
      code = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    } while (taken.has(code));
    return code;
  }

  private freshRoomId(): RoomId {
    let id: string;
    do {
      id = randId();
    } while (this.rooms.has(id));
    return id;
  }

  createRoom(hostName: string): Result<{ roomId: RoomId; passcode: Passcode; seat: Seat; token: ClientToken }> {
    if (!hostName.trim()) return err("NAME_REQUIRED");
    const roomId = this.freshRoomId();
    const passcode = this.freshPasscode();
    const token = randToken();
    const seats: (SeatSlot | null)[] = [null, null, null, null];
    seats[0] = { name: hostName.trim(), isCpu: false, connected: true, token, socketId: null, cpuStrength: null };
    this.rooms.set(roomId, { roomId, passcode, hostSeat: 0, seats, state: null, started: false, seed: null });
    return ok({ roomId, passcode, seat: 0, token });
  }

  joinRoom(passcode: Passcode, name: string): Result<{ roomId: RoomId; seat: Seat; token: ClientToken }> {
    if (!name.trim()) return err("NAME_REQUIRED");
    const room = [...this.rooms.values()].find((r) => r.passcode === passcode);
    if (!room) return err("WRONG_PASSCODE"); // 未存在も合言葉違いに丸める（列挙防止）
    if (room.started) return err("GAME_ALREADY_STARTED");
    const seat = SEATS.find((s) => room.seats[s] === null);
    if (seat === undefined) return err("ROOM_FULL");
    const token = randToken();
    room.seats[seat] = { name: name.trim(), isCpu: false, connected: true, token, socketId: null, cpuStrength: null };
    return ok({ roomId: room.roomId, seat, token });
  }

  /** 空席をCPUで埋める（冪等・占有席は変更しない）。 */
  fillWithCpu(roomId: RoomId, strength: CpuStrength = DEFAULT_CPU): void {
    const room = this.rooms.get(roomId);
    if (!room || room.started) return;
    for (const s of SEATS) {
      if (room.seats[s] === null) {
        room.seats[s] = {
          name: `CPU${["東", "南", "西", "北"][s]}`,
          isCpu: true,
          connected: true,
          token: randToken(),
          socketId: null,
          cpuStrength: strength,
        };
      }
    }
  }

  startGame(roomId: RoomId, opts?: StartOptions): Result<GameState> {
    const room = this.rooms.get(roomId);
    if (!room) return err("ROOM_NOT_FOUND");
    if (room.started) return err("GAME_ALREADY_STARTED");
    // 空席は安全側でCPU補完（4席必ず埋める）
    this.fillWithCpu(roomId, opts?.cpuStrength ?? DEFAULT_CPU);
    const seed = opts?.seed ?? Math.floor(Math.random() * 0x7fffffff);
    room.seed = seed;
    room.started = true;
    room.state = settle(createInitialState(seed));
    return ok(room.state);
  }

  applyPlayerAction(roomId: RoomId, seat: Seat, action: GameAction): Result<GameState> {
    const room = this.rooms.get(roomId);
    if (!room) return err("ROOM_NOT_FOUND");
    if (!room.state || !room.started) return err("GAME_NOT_STARTED");
    if (action.type === "draw" || action.type === "init") return err("ILLEGAL_ACTION"); // サーバー管理
    // 席はサーバー束縛を使う（自己申告を信用しない）。seat を持つアクションは上書き。
    const bound = "seat" in action ? ({ ...action, seat } as GameAction) : action;
    if (!validate(room.state, bound)) return err("ILLEGAL_ACTION");
    room.state = settle(reducer(room.state, bound));
    return ok(room.state);
  }

  /**
   * 自動席（CPU、または切断中の人間＝CPU代行）の「次の一手」だけ進める。rng は注入。
   * 接続中の人間の手番・終局・該当なしは acted:false（停止）。一手ずつの思考演出に使う（#16）。
   */
  stepAuto(roomId: RoomId, rngFor: (seat: Seat) => Rng): { state: GameState | null; acted: boolean } {
    const room = this.rooms.get(roomId);
    if (!room?.state) return { state: null, acted: false };
    // 念のため awaiting-draw を解消（通常は settle 済み）。
    if (room.state.phase.kind === "awaiting-draw") room.state = settle(room.state);
    const state = room.state;
    if (state.phase.kind === "ended") return { state, acted: false };
    const seat = actorSeat(state);
    if (seat === null) return { state, acted: false };
    const slot = room.seats[seat];
    const auto = !!slot && (slot.isCpu || !slot.connected); // 切断中の人間は CPU が代行
    if (!auto) return { state, acted: false }; // 接続中の人間の手番で停止
    const action = chooseAction(slot.cpuStrength ?? DEFAULT_CPU, state, seat, rngFor(seat));
    const next = settle(reducer(state, action));
    if (next === state) return { state, acted: false }; // 進まない（保険）
    room.state = next;
    return { state: next, acted: true };
  }

  /** 自動席が続く限りまとめて進める（接続中の人間席・終局で停止）。最終 state を返す（無進行は null）。 */
  advanceAuto(roomId: RoomId, rngFor: (seat: Seat) => Rng): GameState | null {
    let advanced = false;
    let guard = 0;
    while (guard++ < 3000) {
      const r = this.stepAuto(roomId, rngFor);
      if (!r.acted) break;
      advanced = true;
    }
    return advanced ? (this.rooms.get(roomId)?.state ?? null) : null;
  }

  // --- 切断/再接続（#16） ---

  /** socket を席に束ねる（create/join/reconnect 後）。connected=true にする。 */
  bindSocket(roomId: RoomId, seat: Seat, socketId: string): void {
    const slot = this.rooms.get(roomId)?.seats[seat];
    if (!slot) return;
    slot.socketId = socketId;
    slot.connected = true;
  }

  /**
   * socket 切断を反映し、該当席を connected=false にして {roomId,seat} を返す（無ければ null）。
   * socketId 一致のときだけ落とす＝再接続で別IDに束ね直し済みなら旧切断は無視（競合回避）。
   */
  markDisconnected(socketId: string): { roomId: RoomId; seat: Seat } | null {
    for (const room of this.rooms.values()) {
      for (const seat of SEATS) {
        const slot = room.seats[seat];
        if (slot && slot.socketId === socketId) {
          slot.connected = false;
          slot.socketId = null;
          return { roomId: room.roomId, seat };
        }
      }
    }
    return null;
  }

  /** トークンが一致する席を返す（再接続検証の補助）。 */
  findSeatByToken(roomId: RoomId, token: ClientToken): Seat | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return SEATS.find((s) => room.seats[s]?.token === token) ?? null;
  }

  /** 再接続。token 検証のうえ席を再束縛し、現在の state を返す（未開始なら null）。 */
  reconnect(
    roomId: RoomId,
    seat: Seat,
    token: ClientToken,
    socketId: string,
  ): Result<GameState | null> {
    const room = this.rooms.get(roomId);
    if (!room) return err("ROOM_NOT_FOUND");
    const slot = room.seats[seat];
    if (!slot || slot.token !== token) return err("ROOM_NOT_FOUND"); // 不一致は安全側で丸める（列挙防止）
    slot.connected = true;
    slot.socketId = socketId;
    return ok(room.state);
  }

  getPlayers(roomId: RoomId): readonly PlayerInfo[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return SEATS.flatMap((s) => {
      const slot = room.seats[s];
      return slot
        ? [{ seat: s, name: slot.name, isCpu: slot.isCpu, connected: slot.connected, isHost: s === room.hostSeat }]
        : [];
    });
  }

  getState(roomId: RoomId): GameState | null {
    return this.rooms.get(roomId)?.state ?? null;
  }

  /** 自分の合法手（クライアントもローカル計算するが、補助として提供）。 */
  legalActionsFor(roomId: RoomId, seat: Seat) {
    const state = this.getState(roomId);
    return state ? legalActions(state, seat) : null;
  }

  removeRoom(roomId: RoomId): void {
    this.rooms.delete(roomId);
  }
}
