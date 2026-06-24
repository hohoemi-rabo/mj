// 副露の見た目順を計算する。鳴いた相手の方角に応じて1枚を90°回転表示する伝統的な並びを再現。
// 上家(kamicha)=leftmost回転 / 対面(toimen)=2番目 / 下家(shimocha)=rightmost。
// チーは常に上家由来なので、calledTile を左端へ移動して回転表示する（残りはソート順で右へ）。
// 暗槓は from=null なので無回転。加槓は4枚並びの大明槓相当（上積みスタックは省略）。

import { type Meld } from "@/lib/mahjong/hand";
import { type Tile } from "@/lib/mahjong/tiles";

export interface MeldDisplayTile {
  readonly tile: Tile;
  readonly rotated: boolean;
}

export function meldDisplayTiles(meld: Meld, viewerSeat: number): MeldDisplayTile[] {
  if (meld.from === null || meld.type === "ankan") {
    return meld.tiles.map((t) => ({ tile: t, rotated: false }));
  }

  // 1=下家(右), 2=対面, 3=上家(左)
  const rel = (meld.from - viewerSeat + 4) % 4;

  if (meld.type === "chi") {
    if (meld.calledTile === null) {
      return meld.tiles.map((t) => ({ tile: t, rotated: false }));
    }
    const others: Tile[] = [];
    let removed = false;
    for (const t of meld.tiles) {
      if (!removed && t === meld.calledTile) {
        removed = true;
        continue;
      }
      others.push(t);
    }
    return [
      { tile: meld.calledTile, rotated: true },
      ...others.map((t) => ({ tile: t, rotated: false })),
    ];
  }

  const total = meld.tiles.length;
  const rotatedIndex = rel === 1 ? total - 1 : rel === 2 ? 1 : 0;
  return meld.tiles.map((t, i) => ({ tile: t, rotated: i === rotatedIndex }));
}
