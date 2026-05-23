// ホスト画面のページシェル（Server Component）。対話は Client の HostScreen に委譲。

import type { Metadata } from "next";
import { HostScreen } from "@/components/room/HostScreen";

export const metadata: Metadata = {
  title: "部屋を作る｜ほほ笑み麻雀",
};

export default function HostPage() {
  return <HostScreen />;
}
