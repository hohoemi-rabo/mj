// 聴牌通知バッジ（#18 お助け）。helpMode かつ自手牌が shanten===0 のとき「あと1枚でアガリ！」。
// 提示用（受動表示・directive不要）。判定ロジックは呼び出し側で済ませる方針も取れるが、
// shanten 計算は軽いのでここで完結させる。

import { type Hand } from "@/lib/mahjong/hand";
import { handShanten } from "@/lib/mahjong/shanten";
import { Badge } from "@/components/ui";

export interface TenpaiNoticeProps {
  hand: Hand | null;
}

export function TenpaiNotice({ hand }: TenpaiNoticeProps) {
  if (!hand) return null;
  if (handShanten(hand) !== 0) return null;
  return <Badge variant="primary">あと1枚でアガリ！</Badge>;
}
