// カスタムサーバー: Next.js（App Router）と Socket.io を同居させる（docs/11 / §5.2, §6.3）。
// 純粋セッションコア（src/lib/server/session.ts）の薄いグルー。ルール・優先度は持たない。
// 起動: tsx server.ts（npm run dev / start）。状態はメモリのみ（DB無し §4.3）。
//
// CPUの思考遅延（1〜3秒の演出）と再接続は #16 の担当。ここでは即時に進める最小版。

import { createServer } from "node:http";
import next from "next";
import { Server, type Socket } from "socket.io";
import { type GameAction, type Seat } from "@/lib/mahjong/state";
import { type Rng, createRng } from "@/lib/mahjong/wall";
import { RoomStore } from "@/lib/server/session";
import type { RoomId, StartOptions } from "@/lib/adapter/types";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, turbopack: dev });
const handle = app.getRequestHandler();

const store = new RoomStore();
const rngsByRoom = new Map<RoomId, Rng[]>();
const rngFor = (roomId: RoomId) => (seat: Seat): Rng => {
  let rngs = rngsByRoom.get(roomId);
  if (!rngs) {
    const base = Math.floor(Math.random() * 0x7fffffff);
    rngs = [0, 1, 2, 3].map((i) => createRng(base + i * 1009));
    rngsByRoom.set(roomId, rngs);
  }
  return rngs[seat];
};

interface SocketData {
  roomId?: RoomId;
  seat?: Seat;
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new Server(httpServer);

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;

    const broadcast = (roomId: RoomId): void => {
      const state = store.getState(roomId);
      if (!state) return;
      io.to(roomId).emit("game:state", state);
      if (state.phase.kind === "ended") io.to(roomId).emit("game:end", state);
    };

    // 現アクション席がCPUの間だけ進めて配信（演出遅延は #16）。
    const driveAuto = (roomId: RoomId): void => {
      const next = store.advanceAuto(roomId, rngFor(roomId));
      if (next) {
        io.to(roomId).emit("game:state", next);
        if (next.phase.kind === "ended") io.to(roomId).emit("game:end", next);
      }
    };

    const applyAndBroadcast = (action: GameAction): void => {
      if (data.roomId === undefined || data.seat === undefined) return;
      const res = store.applyPlayerAction(data.roomId, data.seat, action);
      if (!res.ok) {
        socket.emit("app:error", res.error);
        return;
      }
      broadcast(data.roomId);
      if (res.value.phase.kind !== "ended") driveAuto(data.roomId);
    };

    socket.on("room:create", ({ name }: { name: string }, ack?: (res: unknown) => void) => {
      const res = store.createRoom(name);
      if (!res.ok) { ack?.(res.error); return; }
      data.roomId = res.value.roomId;
      data.seat = res.value.seat;
      socket.join(res.value.roomId);
      ack?.(res.value); // {roomId, passcode, seat, token}
      io.to(res.value.roomId).emit("room:players", store.getPlayers(res.value.roomId));
    });

    socket.on("room:join", ({ passcode, name }: { passcode: string; name: string }, ack?: (res: unknown) => void) => {
      const res = store.joinRoom(passcode, name);
      if (!res.ok) { ack?.(res.error); return; }
      data.roomId = res.value.roomId;
      data.seat = res.value.seat;
      socket.join(res.value.roomId);
      ack?.(res.value);
      io.to(res.value.roomId).emit("room:players", store.getPlayers(res.value.roomId));
    });

    socket.on("game:start", ({ opts }: { opts?: StartOptions }, ack?: (res: unknown) => void) => {
      if (data.roomId === undefined) { ack?.({ code: "ROOM_NOT_FOUND", message: "部屋がありません" }); return; }
      if (data.seat !== 0) { ack?.({ code: "NOT_HOST", message: "ホストのみ操作できます" }); return; }
      if (opts?.fillWithCpu) store.fillWithCpu(data.roomId, opts.cpuStrength);
      const res = store.startGame(data.roomId, opts);
      if (!res.ok) { ack?.(res.error); return; }
      ack?.({ ok: true });
      io.to(data.roomId).emit("room:players", store.getPlayers(data.roomId));
      broadcast(data.roomId);
      driveAuto(data.roomId);
    });

    // プレイヤーアクション（席はサーバー束縛を使う＝自己申告を信用しない）。
    const onAction = ({ action }: { action: GameAction }) => applyAndBroadcast(action);
    socket.on("player:discard", onAction);
    socket.on("player:riichi", onAction);
    socket.on("player:pon", onAction);
    socket.on("player:chi", onAction);
    socket.on("player:kan", onAction);
    socket.on("player:tsumo", onAction);
    socket.on("player:ron", onAction);
    socket.on("player:pass", onAction);
    socket.on("player:draw", () => { /* サーバーが自動ツモするため無視 */ });

    socket.on("disconnect", () => {
      // #16: store.markDisconnected(socket.id) → room:players 再配信（席は保持して再接続）
      if (data.roomId !== undefined) {
        io.to(data.roomId).emit("room:players", store.getPlayers(data.roomId));
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> mahjong server: http://localhost:${port} (${dev ? "dev" : "production"})`);
  });
});
