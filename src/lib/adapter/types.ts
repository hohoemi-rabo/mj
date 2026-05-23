// 通信層の共通インターフェースとワイヤ型（REQUIREMENTS §6.1, §6.3 / docs/11）。
// ゲームロジックから分離した「差し替え可能な通信層」の契約。LocalAdapter（Socket.io）と
// 将来の RemoteAdapter（クラウド）が同じ MahjongAdapter を実装する。
// ペイロードはすべて JSONシリアライズ可能（GameState はプレーンデータ）。

import type { GameAction, GameState, Seat } from "@/lib/mahjong/state";
import type { CpuStrength } from "@/lib/mahjong/cpu";

export type RoomId = string;
export type Passcode = string; // 4桁数字（"0427" 等）
export type ClientToken = string; // 席ごとの再接続トークン（#16 用シーム）

export interface PlayerInfo {
  readonly seat: Seat;
  readonly name: string;
  readonly isCpu: boolean;
  readonly connected: boolean;
  readonly isHost: boolean;
}

/** 入室時にクライアントへ返す「自分は誰か」。passcode はホスト作成時のみ。 */
export interface SeatAssignment {
  readonly roomId: RoomId;
  readonly seat: Seat;
  readonly token: ClientToken;
  readonly passcode?: Passcode;
}

export type AdapterErrorCode =
  | "ROOM_NOT_FOUND"
  | "WRONG_PASSCODE"
  | "ROOM_FULL"
  | "NAME_REQUIRED"
  | "GAME_ALREADY_STARTED"
  | "GAME_NOT_STARTED"
  | "NOT_HOST"
  | "ILLEGAL_ACTION"
  | "INTERNAL";

export interface AdapterError {
  readonly code: AdapterErrorCode;
  readonly message: string; // そのまま表示できる日本語
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

/** ホストのみが指定する開始オプション（CPU補完の本UIは #16）。 */
export interface StartOptions {
  readonly seed?: number;
  readonly cpuStrength?: CpuStrength;
  readonly fillWithCpu?: boolean;
}

/** クライアントが送れるアクション（init/draw/pause/resume はサーバー管理で除外）。 */
export type PlayerAction = Exclude<
  GameAction,
  { type: "init" } | { type: "draw" } | { type: "pause" } | { type: "resume" }
>;

export type Unsubscribe = () => void;

/** UI/ストアが依存する通信層の契約（Socket.io 等の詳細を隠す）。 */
export interface MahjongAdapter {
  connect(): Promise<void>;
  disconnect(): void;

  createRoom(hostName: string): Promise<SeatAssignment>;
  joinRoom(passcode: Passcode, name: string): Promise<SeatAssignment>;
  /** 通信断後の再接続で席を再束縛する（トークンで本人確認・#16）。 */
  reconnect(roomId: RoomId, seat: Seat, token: ClientToken): Promise<void>;
  start(opts?: StartOptions): Promise<void>;

  /** 打牌・鳴き・和了等のプレイヤーアクション。エラーは onError 経由（fire-and-forget）。 */
  send(action: PlayerAction): void;

  onPlayers(cb: (players: readonly PlayerInfo[]) => void): Unsubscribe;
  onState(cb: (state: GameState) => void): Unsubscribe;
  onEnd(cb: (state: GameState) => void): Unsubscribe;
  onError(cb: (err: AdapterError) => void): Unsubscribe;
  onConnectionChange(cb: (status: ConnectionStatus) => void): Unsubscribe;
}
