// 共通UI部品ギャラリー（/ui）。薄い Server シェル＋metadata。対話は UiShowcase（Client）に委譲。

import type { Metadata } from "next";
import { UiShowcase } from "@/components/showcase/UiShowcase";

export const metadata: Metadata = {
  title: "部品ギャラリー｜ほほ笑み麻雀",
  description: "共通UI部品の確認用ページ（開発用）",
};

export default function UiPage() {
  return <UiShowcase />;
}
