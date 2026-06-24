"use client";

// 卓中央スコアパネル（Phase 1）。RiverGrid の center スロットに配置。
// 四方向に各家の「風家・名前(CPU)・点数」、中央に場風＋残り山、現手番の枠を amber ハイライト。
// Phase 2/5 で OpponentArea ヘッダと TopBar の局情報を整理するため、現状は情報が重複する。

import { type GameState, type Seat, currentSeat } from "@/lib/mahjong/state";
import { remainingDraws } from "@/lib/mahjong/wall";
import { type PlayerInfo } from "@/lib/adapter/types";
import { opponentSeats } from "@/lib/store/selectors";
import { windLabel } from "@/components/game/labels";
import { cn } from "@/lib/cn";

export interface CenterPanelProps {
  gameState: GameState;
  mySeat: Seat;
  players: readonly PlayerInfo[];
}

function PlayerCell({
  seat,
  gameState,
  info,
  isCurrent,
}: {
  seat: Seat;
  gameState: GameState;
  info?: PlayerInfo;
  isCurrent: boolean;
}) {
  const player = gameState.players[seat];
  const name = info?.name ?? `席${seat}`;
  return (
    <div
      className={cn(
        "flex min-w-[80px] flex-col items-center gap-0.5 whitespace-nowrap rounded-md px-2 py-1 text-center leading-tight transition-colors",
        isCurrent ? "bg-amber-400/30 ring-2 ring-amber-400" : "",
      )}
    >
      <div className="text-sm font-bold">{windLabel(player.seatWind)}</div>
      <div className="flex items-center gap-1 text-xs">
        <span className="max-w-[80px] truncate">{name}</span>
        {info?.isCpu && (
          <span className="rounded bg-gray-400/80 px-1 text-[10px] font-bold text-gray-900">
            CPU
          </span>
        )}
      </div>
      <div className="text-base font-bold tabular-nums">
        {player.points.toLocaleString()}
      </div>
    </div>
  );
}

export function CenterPanel({ gameState, mySeat, players }: CenterPanelProps) {
  const [rightSeat, topSeat, leftSeat] = opponentSeats(mySeat);
  const current = currentSeat(gameState);
  const remaining = remainingDraws(gameState.wall);
  const infoOf = (s: Seat) => players.find((p) => p.seat === s);

  return (
    <div
      role="status"
      aria-label="対局情報パネル"
      className="grid grid-cols-3 grid-rows-3 gap-1 rounded-lg bg-black/60 p-2 text-white shadow-lg"
    >
      {/* 対面（上） */}
      <div className="col-start-2 row-start-1 justify-self-center">
        <PlayerCell
          seat={topSeat}
          gameState={gameState}
          info={infoOf(topSeat)}
          isCurrent={current === topSeat}
        />
      </div>

      {/* 上家（左） */}
      <div className="col-start-1 row-start-2 self-center">
        <PlayerCell
          seat={leftSeat}
          gameState={gameState}
          info={infoOf(leftSeat)}
          isCurrent={current === leftSeat}
        />
      </div>

      {/* 中央: 場風＋残り山。1局のみのルールなので局数は表示しない（CLAUDE.md / mahjong-logic）。 */}
      <div className="col-start-2 row-start-2 flex flex-col items-center justify-center text-center leading-tight">
        <div className="text-sm font-bold">{windLabel(gameState.roundWind)}場</div>
        <div className="text-xs tabular-nums text-white/80">残{remaining}</div>
      </div>

      {/* 下家（右） */}
      <div className="col-start-3 row-start-2 self-center">
        <PlayerCell
          seat={rightSeat}
          gameState={gameState}
          info={infoOf(rightSeat)}
          isCurrent={current === rightSeat}
        />
      </div>

      {/* 自分（下） */}
      <div className="col-start-2 row-start-3 justify-self-center">
        <PlayerCell
          seat={mySeat}
          gameState={gameState}
          info={infoOf(mySeat)}
          isCurrent={current === mySeat}
        />
      </div>
    </div>
  );
}
