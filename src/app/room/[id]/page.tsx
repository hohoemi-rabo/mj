// 対局画面のページシェル（Server Component）。v15 では params が Promise なので await する。
// 対局UIは実質すべて対話なので、薄いシェルから Client の GameBoard を描画する。

import type { Metadata } from "next";
import { GameBoard } from "@/components/game/GameBoard";

export const metadata: Metadata = {
  title: "対局中｜ほほ笑み麻雀",
};

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GameBoard roomId={id} />;
}
