"use client";

// ホストのロビー（docs/15 §3.6 1〜4）。合言葉・QR・LAN URL・参加者一覧・CPU強さ・対局開始。
// 開始すると gameState が届き、HostScreen の useGotoRoomOnStart が /room/[id] へ遷移させる。

import { useState } from "react";
import { type CpuStrength } from "@/lib/mahjong/cpu";
import { useGameStore } from "@/lib/store/gameStore";
import { Button, Heading } from "@/components/ui";
import { QrCode } from "@/components/game/QrCode";
import { PlayerList } from "@/components/room/PlayerList";
import { useServerInfo } from "@/components/room/useServerInfo";

const STRENGTHS: { value: CpuStrength; label: string }[] = [
  { value: "weak", label: "弱い" },
  { value: "medium", label: "普通" },
  { value: "strong", label: "強い" },
];

export function HostLobby() {
  const passcode = useGameStore((s) => s.passcode);
  const lastError = useGameStore((s) => s.lastError);
  const info = useServerInfo();
  const [cpuStrength, setCpuStrength] = useState<CpuStrength>("medium");
  const [starting, setStarting] = useState(false);

  // 他端末が開く入室URL（同一オリジンで繋がるよう、ホストのLAN URLを使う）。
  const joinUrl =
    info && passcode
      ? `${info.url}/join?code=${passcode}`
      : passcode
        ? `/join?code=${passcode}`
        : null;

  const startGame = async () => {
    setStarting(true);
    useGameStore.getState().clearError();
    await useGameStore.getState().start({ fillWithCpu: true, cpuStrength });
    if (useGameStore.getState().lastError) setStarting(false);
    // 成功時は gameState 到着 → useGotoRoomOnStart が遷移（このまま starting 表示でよい）。
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <Heading level={1} className="text-2xl">
        部屋ができました
      </Heading>

      {/* 合言葉 */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-base">合言葉（あいことば）</span>
        <span className="text-2xl font-bold tracking-[0.3em] tabular-nums">{passcode}</span>
      </div>

      {/* QR + URL */}
      {joinUrl && (
        <div className="flex flex-col items-center gap-2">
          <QrCode value={joinUrl} />
          {info && (
            <p className="break-all text-center text-base">
              ほかの端末でひらく：<br />
              <span className="font-bold">{info.url}</span>
            </p>
          )}
          <p className="text-sm text-foreground/70">
            QRを読み取るか、上のURLをひらいて合言葉を入れてください。
          </p>
        </div>
      )}

      {/* 参加者 */}
      <div className="w-full max-w-md">
        <Heading level={3} className="mb-2">
          参加者
        </Heading>
        <PlayerList />
      </div>

      {/* CPUの強さ */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-base">空席に入るCPUの強さ</span>
        <div className="flex gap-2">
          {STRENGTHS.map((s) => (
            <Button
              key={s.value}
              variant={cpuStrength === s.value ? "primary" : "secondary"}
              size="lg"
              onClick={() => setCpuStrength(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <Button variant="primary" size="lg" onClick={startGame} disabled={starting}>
        {starting ? "開始しています…" : "対局開始"}
      </Button>
      {lastError && !starting && (
        <p role="alert" className="text-sm text-danger">
          {lastError.message}
        </p>
      )}
    </div>
  );
}
