// 麻雀用語＋カッコ補足（提示用・directiveなし）。
// §3.7「読みやすい日本語：用語にカッコ書きで補足」を全画面で統一するための部品。
// 例: <Term word="リーチ" hint="あと1枚で完成" /> → 「リーチ（あと1枚で完成）」
// hint 省略時は word のみ表示。

import { cn } from "@/lib/cn";

export interface TermProps {
  word: string;
  hint?: string;
  className?: string;
}

export function Term({ word, hint, className }: TermProps) {
  return (
    <span className={cn("text-foreground", className)}>
      <span className="font-bold">{word}</span>
      {hint && (
        // 補足は僅かに小さく（sm=約18px で可読性は確保）。括弧は全角で日本語に馴染ませる。
        <span className="text-sm text-foreground/80">（{hint}）</span>
      )}
    </span>
  );
}
