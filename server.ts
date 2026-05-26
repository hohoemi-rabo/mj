// カスタムサーバー: Next.js（App Router）と Socket.io を同居させる（docs/11 / §5.2, §6.3）。
// 純粋セッションコア（src/lib/server/session.ts）の薄いグルー。ルール・優先度は持たない。
// 起動: tsx server.ts（npm run dev / start）。状態はメモリのみ（DB無し §4.3）。
//
// CPUの思考遅延（1〜3秒の演出）と再接続は #16 の担当。ここでは即時に進める最小版。

import { createServer } from "node:http";
import os from "node:os";
import next from "next";
import { Server, type Socket } from "socket.io";
import { type GameAction, type Seat } from "@/lib/mahjong/state";
import { type Rng, createRng } from "@/lib/mahjong/wall";
import { RoomStore } from "@/lib/server/session";
import type { ClientToken, RoomId, StartOptions } from "@/lib/adapter/types";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
// LAN内の他端末から繋げるよう全インターフェースで待受（既定 0.0.0.0。HOST で上書き可）。
const host = process.env.HOST ?? "0.0.0.0";
const app = next({ dev, turbopack: dev });
const handle = app.getRequestHandler();

/** 非内部 IPv4（LANアドレス）の一覧。QR/URL 表示の手がかりにログ出力する。 */
const lanIPv4 = (): string[] =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((n): n is os.NetworkInterfaceInfo => !!n && n.family === "IPv4" && !n.internal)
    .map((n) => n.address);

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

  const broadcast = (roomId: RoomId): void => {
    const state = store.getState(roomId);
    if (!state) return;
    io.to(roomId).emit("game:state", state);
    if (state.phase.kind === "ended") io.to(roomId).emit("game:end", state);
  };

  // CPUの思考演出の間（ms）。CPU_DELAY_MS env で上書き（テスト/開発は 0）。既定 0.8〜1.8s（§3.4）。
  const cpuDelay = (): number => {
    const env = Number(process.env.CPU_DELAY_MS);
    return Number.isFinite(env) ? env : 800 + Math.floor(Math.random() * 1000);
  };

  // 自動席（CPU・切断中の人間＝代行）の手を一手ずつ遅延配信する（1room1チェイン・多重起動ガード）。
  const driveTimers = new Map<RoomId, NodeJS.Timeout>();
  const driveAutoTimed = (roomId: RoomId): void => {
    if (driveTimers.has(roomId)) return;
    const tick = (): void => {
      driveTimers.delete(roomId);
      const r = store.stepAuto(roomId, rngFor(roomId));
      if (!r.acted || !r.state) return; // 接続中の人間の手番 / 終局 / 該当なしで停止
      io.to(roomId).emit("game:state", r.state);
      if (r.state.phase.kind === "ended") {
        io.to(roomId).emit("game:end", r.state);
        return;
      }
      driveTimers.set(roomId, setTimeout(tick, cpuDelay()));
    };
    driveTimers.set(roomId, setTimeout(tick, cpuDelay()));
  };

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;

    const applyAndBroadcast = (action: GameAction): void => {
      if (data.roomId === undefined || data.seat === undefined) return;
      const res = store.applyPlayerAction(data.roomId, data.seat, action);
      if (!res.ok) {
        socket.emit("app:error", res.error);
        return;
      }
      broadcast(data.roomId); // 人間の手は即時反映
      if (res.value.phase.kind !== "ended") driveAutoTimed(data.roomId); // CPUは一手ずつ遅延
    };

    socket.on("room:create", ({ name }: { name: string }, ack?: (res: unknown) => void) => {
      const res = store.createRoom(name);
      if (!res.ok) { ack?.(res.error); return; }
      data.roomId = res.value.roomId;
      data.seat = res.value.seat;
      store.bindSocket(res.value.roomId, res.value.seat, socket.id); // #16 席に socket を束ねる
      socket.join(res.value.roomId);
      ack?.(res.value); // {roomId, passcode, seat, token}
      io.to(res.value.roomId).emit("room:players", store.getPlayers(res.value.roomId));
    });

    socket.on("room:join", ({ passcode, name }: { passcode: string; name: string }, ack?: (res: unknown) => void) => {
      const res = store.joinRoom(passcode, name);
      if (!res.ok) { ack?.(res.error); return; }
      data.roomId = res.value.roomId;
      data.seat = res.value.seat;
      store.bindSocket(res.value.roomId, res.value.seat, socket.id);
      socket.join(res.value.roomId);
      ack?.(res.value);
      io.to(res.value.roomId).emit("room:players", store.getPlayers(res.value.roomId));
    });

    // #16 通信断からの再接続: トークンで席を再束縛し、現状態を復元配信。
    socket.on(
      "room:reconnect",
      ({ roomId, seat, token }: { roomId: RoomId; seat: Seat; token: ClientToken }, ack?: (res: unknown) => void) => {
        const res = store.reconnect(roomId, seat, token, socket.id);
        if (!res.ok) { ack?.(res.error); return; }
        data.roomId = roomId;
        data.seat = seat;
        socket.join(roomId);
        ack?.({ ok: true });
        io.to(roomId).emit("room:players", store.getPlayers(roomId));
        broadcast(roomId); // 状態復元（再接続者を含む全員へ再送）
      },
    );

    socket.on("game:start", ({ opts }: { opts?: StartOptions }, ack?: (res: unknown) => void) => {
      if (data.roomId === undefined) { ack?.({ code: "ROOM_NOT_FOUND", message: "部屋がありません" }); return; }
      if (data.seat !== 0) { ack?.({ code: "NOT_HOST", message: "ホストのみ操作できます" }); return; }
      if (opts?.fillWithCpu) store.fillWithCpu(data.roomId, opts.cpuStrength);
      const res = store.startGame(data.roomId, opts);
      if (!res.ok) { ack?.(res.error); return; }
      ack?.({ ok: true });
      io.to(data.roomId).emit("room:players", store.getPlayers(data.roomId));
      broadcast(data.roomId);
      driveAutoTimed(data.roomId);
    });

    // #19 もう一局: 終局後にだけ許可。同じ部屋・同じ席で新シードの局を始める。
    socket.on("game:rematch", ({ opts }: { opts?: StartOptions }, ack?: (res: unknown) => void) => {
      if (data.roomId === undefined) { ack?.({ code: "ROOM_NOT_FOUND", message: "部屋がありません" }); return; }
      if (data.seat !== 0) { ack?.({ code: "NOT_HOST", message: "ホストのみ操作できます" }); return; }
      // 旧局の自動ドライブが残っていたら止める（安全側）。
      const old = driveTimers.get(data.roomId);
      if (old) { clearTimeout(old); driveTimers.delete(data.roomId); }
      const res = store.rematch(data.roomId, opts);
      if (!res.ok) { ack?.(res.error); return; }
      ack?.({ ok: true });
      io.to(data.roomId).emit("room:players", store.getPlayers(data.roomId));
      broadcast(data.roomId);
      driveAutoTimed(data.roomId);
    });

    // #19 部屋の解散: タイマー停止 → 全員に room:dissolved を通知 → 部屋削除。
    socket.on("room:dissolve", (_: unknown, ack?: (res: unknown) => void) => {
      if (data.roomId === undefined) { ack?.({ code: "ROOM_NOT_FOUND", message: "部屋がありません" }); return; }
      if (data.seat !== 0) { ack?.({ code: "NOT_HOST", message: "ホストのみ操作できます" }); return; }
      const roomId = data.roomId;
      const t = driveTimers.get(roomId);
      if (t) { clearTimeout(t); driveTimers.delete(roomId); }
      io.to(roomId).emit("room:dissolved");
      store.removeRoom(roomId);
      ack?.({ ok: true });
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
      // #16 切断を反映（席は保持）→ 参加者再配信＋切断席が手番なら CPU 代行で進める。
      const loc = store.markDisconnected(socket.id);
      if (loc) {
        io.to(loc.roomId).emit("room:players", store.getPlayers(loc.roomId));
        driveAutoTimed(loc.roomId);
      }
    });
  });

  httpServer.listen(port, host, () => {
    console.log(`> mahjong server: http://localhost:${port} (${dev ? "dev" : "production"})`);
    for (const ip of lanIPv4()) {
      console.log(`>   LAN: http://${ip}:${port}  （他端末はこのURL/QRで入室）`);
    }
  });
});
