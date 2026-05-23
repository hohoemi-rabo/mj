// 簡易タイトル画面（Server Component）。Link 遷移のみで onClick 不要＝Server のまま。
// 本格的なホーム/入室フローは #15 で実装する。

import Link from "next/link";
import { Heading, ScreenContainer, buttonVariants } from "@/components/ui";
import { PracticeStartButton } from "@/components/game/PracticeStartButton";

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
        <div className="flex flex-col items-center gap-4">
          {/* みんなで対戦（同一LAN）の2導線 */}
          <Link href="/host" className={buttonVariants({ variant: "primary", size: "lg" })}>
            部屋を作る
          </Link>
          <Link href="/join" className={buttonVariants({ variant: "primary", size: "lg" })}>
            部屋に入る
          </Link>
          {/* ひとりで練習（CPU対戦） */}
          <PracticeStartButton />
          <Link
            href="/ui"
            className={`${buttonVariants({ variant: "ghost", size: "default" })} text-sm`}
          >
            部品ギャラリー（開発用）
          </Link>
        </div>
      </div>
    </ScreenContainer>
  );
}
