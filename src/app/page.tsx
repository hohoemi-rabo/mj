// 簡易タイトル画面（Server Component）。Link 遷移のみで onClick 不要＝Server のまま。
// 本格的なホーム/入室フローは #15 で実装する。

import Link from "next/link";
import { Heading, ScreenContainer, buttonVariants } from "@/components/ui";

export default function Home() {
  return (
    <ScreenContainer>
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-8 text-center">
        <Heading level={1} className="text-2xl">
          ほほ笑み麻雀
        </Heading>
        <p className="max-w-md text-base text-foreground/80">
          ほほ笑みラボのシニア向け麻雀ゲームです。
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* #15 で入室フローに差し替え。今は導線のみ。 */}
          <span
            className={`${buttonVariants({ variant: "primary", size: "lg" })} cursor-not-allowed opacity-50`}
            aria-disabled="true"
          >
            はじめる（準備中）
          </span>
          <Link
            href="/ui"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            部品ギャラリーを見る
          </Link>
        </div>
      </div>
    </ScreenContainer>
  );
}
