// 成立しうる役のバッジ列（#18 お助け）。自手牌の下に常時表示。
// names は selectors の currentlyPossibleYaku() の結果をそのまま渡す。空のときは null。

import { Badge } from "@/components/ui";

export interface YakuBadgesProps {
  names: readonly string[];
}

export function YakuBadges({ names }: YakuBadgesProps) {
  if (names.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {/* GameBoard のフェルト面に乗るので、ライトモードでも読めるよう固定で白系。 */}
      <span className="text-sm text-white/80">狙えそうな役：</span>
      {names.map((n) => (
        <Badge key={n} variant="info">
          {n}
        </Badge>
      ))}
    </div>
  );
}
