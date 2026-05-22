// LocalAdapter: 同一LAN向け Socket.io 実装（docs/11）。MahjongAdapter を満たし、
// UI/ストアは Socket.io の詳細を知らずに済む。サーバー権威なので楽観適用はしない
// （送信→次の game:state で反映）。

import { type Socket, io } from "socket.io-client";
import type { GameState } from "@/lib/mahjong/state";
import type {
  AdapterError,
  ConnectionStatus,
  MahjongAdapter,
  Passcode,
  PlayerAction,
  PlayerInfo,
  SeatAssignment,
  StartOptions,
  Unsubscribe,
} from "@/lib/adapter/types";

export class LocalAdapter implements MahjongAdapter {
  private socket: Socket | null = null;

  constructor(private readonly url?: string) {}

  private get s(): Socket {
    if (!this.socket) throw new Error("LocalAdapter: connect() を先に呼んでください");
    return this.socket;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = this.url ? io(this.url) : io(); // 既定は same-origin（LAN ホストでそのまま動く）
      this.socket = socket;
      socket.once("connect", () => resolve());
      socket.once("connect_error", (e: Error) => reject(e));
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  createRoom(hostName: string): Promise<SeatAssignment> {
    return new Promise((resolve, reject) => {
      this.s.emit("room:create", { name: hostName }, (res: SeatAssignment | AdapterError) => {
        if ("roomId" in res) resolve(res);
        else reject(new Error(res.message));
      });
    });
  }

  joinRoom(passcode: Passcode, name: string): Promise<SeatAssignment> {
    return new Promise((resolve, reject) => {
      this.s.emit("room:join", { passcode, name }, (res: SeatAssignment | AdapterError) => {
        if ("roomId" in res) resolve(res);
        else reject(new Error(res.message));
      });
    });
  }

  start(opts?: StartOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      this.s.emit("game:start", { opts }, (res: { ok: true } | AdapterError) => {
        if ("ok" in res) resolve();
        else reject(new Error(res.message));
      });
    });
  }

  send(action: PlayerAction): void {
    const s = this.s;
    switch (action.type) {
      case "discard":
        s.emit(action.riichi ? "player:riichi" : "player:discard", { action });
        break;
      case "pon":
        s.emit("player:pon", { action });
        break;
      case "chi":
        s.emit("player:chi", { action });
        break;
      case "minkan":
      case "ankan":
      case "kakan":
        s.emit("player:kan", { action });
        break;
      case "tsumo":
        s.emit("player:tsumo", { action });
        break;
      case "ron":
        s.emit("player:ron", { action });
        break;
      case "pass":
        s.emit("player:pass", { action });
        break;
    }
  }

  onPlayers(cb: (players: readonly PlayerInfo[]) => void): Unsubscribe {
    const h = (players: readonly PlayerInfo[]) => cb(players);
    this.s.on("room:players", h);
    return () => this.socket?.off("room:players", h);
  }

  onState(cb: (state: GameState) => void): Unsubscribe {
    const h = (state: GameState) => cb(state);
    this.s.on("game:state", h);
    return () => this.socket?.off("game:state", h);
  }

  onEnd(cb: (state: GameState) => void): Unsubscribe {
    const h = (state: GameState) => cb(state);
    this.s.on("game:end", h);
    return () => this.socket?.off("game:end", h);
  }

  onError(cb: (err: AdapterError) => void): Unsubscribe {
    const h = (err: AdapterError) => cb(err);
    this.s.on("app:error", h); // "error" は socket.io 予約系を避ける
    return () => this.socket?.off("app:error", h);
  }

  onConnectionChange(cb: (status: ConnectionStatus) => void): Unsubscribe {
    const onConnect = () => cb("connected");
    const onDisconnect = () => cb("disconnected");
    const onErr = () => cb("error");
    this.s.on("connect", onConnect);
    this.s.on("disconnect", onDisconnect);
    this.s.on("connect_error", onErr);
    return () => {
      this.socket?.off("connect", onConnect);
      this.socket?.off("disconnect", onDisconnect);
      this.socket?.off("connect_error", onErr);
    };
  }
}
