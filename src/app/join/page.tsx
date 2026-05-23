// 入室画面のページシェル（Server Component）。v15 では searchParams が Promise。
// QR由来の ?code= を取り出して Client の JoinScreen に渡す。

import type { Metadata } from "next";
import { JoinScreen } from "@/components/room/JoinScreen";

export const metadata: Metadata = {
  title: "部屋に入る｜ほほ笑み麻雀",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <JoinScreen code={code} />;
}
