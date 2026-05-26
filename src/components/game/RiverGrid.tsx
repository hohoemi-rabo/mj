"use client";

// 中央に4河を方位配置（docs/14 §7）。自分=下、対面=上、下家=右、上家=左。
// 各河は相手視点に合わせて回転（自分は無回転）。中央セルにドラ等を置ける。

import { type GameState, type Seat } from "@/lib/mahjong/state";
import { type Tile as TileType } from "@/lib/mahjong/tiles";
import { opponentSeats } from "@/lib/store/selectors";
import { DiscardPile } from "@/components/game/DiscardPile";

export interface RiverGridProps {
  gameState: GameState;
  mySeat: Seat;
  center?: React.ReactNode;
  /** お助けONかつ自分がテンパイ時の当たり牌集合。他家3河だけに渡される。 */
  helpHighlight?: ReadonlySet<TileType> | null;
}

export function RiverGrid({ gameState, mySeat, center, helpHighlight }: RiverGridProps) {
  const [right, top, left] = opponentSeats(mySeat); // [下家+1, 対面+2, 上家+3]
  const discardsOf = (seat: Seat) => gameState.players[seat].hand.discards;
  // 自席の河はハイライトしない（自分の捨て牌に当たり牌はないため）。
  const opponentHighlight = helpHighlight ?? undefined;

  return (
    <div className="grid h-full w-full grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] place-items-center gap-2">
      {/* 対面（上・180度） */}
      <div className="col-start-2 row-start-1 rotate-180">
        <DiscardPile discards={discardsOf(top)} helpHighlight={opponentHighlight} />
      </div>
      {/* 上家（左・90度） */}
      <div className="col-start-1 row-start-2 rotate-90">
        <DiscardPile discards={discardsOf(left)} helpHighlight={opponentHighlight} />
      </div>
      {/* 中央 */}
      <div className="col-start-2 row-start-2 flex items-center justify-center">{center}</div>
      {/* 下家（右・-90度） */}
      <div className="col-start-3 row-start-2 -rotate-90">
        <DiscardPile discards={discardsOf(right)} helpHighlight={opponentHighlight} />
      </div>
      {/* 自分（下・無回転） */}
      <div className="col-start-2 row-start-3">
        <DiscardPile discards={discardsOf(mySeat)} />
      </div>
    </div>
  );
}
